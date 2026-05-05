# Debug Report: billsec + recording issues (2026-04-17)

**Scope:** 7 outbound calls ext 101 → 0919239894, today ~17:12–18:24 UTC+7  
**DB:** `crm_db` on `crm-postgres` (dev server 10.10.101.207)

---

## 1. Raw Evidence

### call_logs (last 7 today, UTC stored)

| call_uuid (short) | duration | billsec | answer_time | end_time | rec_status |
|---|---|---|---|---|---|
| 74aa3d2f (18:24) | 6 | 2 | 11:25:02 | 11:25:04 | available |
| 0fa6f976 (18:22) | 8 | 2 | 11:22:52 | 11:22:54 | none |
| 2224af74 (18:08) | 7 | 2 | 11:08:39 | 11:08:41 | none |
| d9e16397 (17:55) | 8 | 2 | 10:55:09 | 10:55:11 | none |
| 0f159877 (17:41) | 8 | 3 | 10:41:27 | 10:41:30 | none |
| b2960a5f (17:13) | 7 | 2 | 10:13:24 | 10:13:26 | none |
| 8ac98ca0 (17:12) | 9 | 2 | 10:12:07 | 10:12:09 | none |

`end_time - answer_time` equals `billsec` in all rows — timestamps are internally consistent.

### CDR legs per call (pattern confirmed for all 7)

Each call sends **4 CDR legs** to the webhook:

| # | channel_name | error_message in webhook_log | billsec | record_path |
|---|---|---|---|---|
| 1 | `loopback/0919239894-b` | (processed → canonical row) | **2** | none (6/7 calls); present on 18:24 |
| 2 | `loopback/0919239894-?` | Skipped orphan leg | — | — |
| 3 | `sofia/internal/0919239894` | Skipped agent SIP leg | 10–12 | none |
| 4 | `sofia/internal/101@10.10.101.224:57182` | Skipped agent SIP leg | 16 | none |

**Key variable values extracted from CDR XML:**

**Loopback-B leg (canonical, all calls):**
- `<billsec>2</billsec>` (or 3 on one call)
- `<flow_billsec>6–9</flow_billsec>` (matches displayed `Thời lượng`)
- `<duration>6–9</duration>`

**sofia/internal/0919239894 leg (gateway trunk, skipped):**
- `<billsec>10–12</billsec>` ← real talk time
- `<record_ms>11420</record_ms>` (18:24 call only; 0 on all others)
- No `record_path` or `record_name` on any leg

**sofia/internal/101@... leg (agent SIP phone, skipped):**
- `<billsec>16</billsec>` (total including ringing)
- `record_stereo=true` but no `record_path`, no `record_ms`

**18:24 call — loopback-B leg had recording:**
- `<record_path>/var/lib/freeswitch/recordings/blueva/archive/2026/Apr/17</record_path>`
- `<record_name>1cc66ba1-3c37-4cd9-b5a9-939368214957.mp3</record_name>`
- `record_in_progress=true`, `RECORD_ANSWER_REQ=true`
- `app_log` shows `record_session` action fired (the `user_exists` dialplan ran completely)

**All other 6 calls — loopback-B leg had NO recording:**
- `user_exists=false` (correct — 0919239894 is not a FusionPBX user)
- `app_log` shows `extension name="user_exists"` matched, but the recording block was absent
- No `mkdir`, no `record_path`, no `record_session` in app_log
- The dialplan hit `user_exists` extension but stopped BEFORE the recording actions

---

## 2. Root Cause Analysis

### Issue 1 — billsec = 2 (wrong)

**Root cause: FusionPBX reports `billsec=2` on the loopback-B leg, and that is the only leg the webhook code writes to `call_logs`.**

The loopback-B leg (`loopback/0919239894-b`) measures billsec from when the bridge starts until the loopback bowout completes — roughly the time between FusionPBX forwarding the call to the gateway and the loopback releasing the channel. This is ~2s (channel signaling overhead), not actual talk time.

The **real talk time** lives on the `sofia/internal/0919239894` leg (gateway trunk):
- `billsec=10–12` on the gateway trunk leg
- `flow_billsec=6–9` on the loopback-B leg matches displayed `Thời lượng` which is correct

The webhook code at `webhook-controller.ts:253` skips agent SIP legs entirely with `return` after potentially patching recording — so the gateway leg's real `billsec` is **never merged into `bestBillsec`**.

The `isAgentSipLeg` guard only checks `channelName.startsWith('sofia/internal/')` — **both** the gateway trunk leg (`sofia/internal/0919239894`) and the agent phone leg (`sofia/internal/101@...`) are caught by this guard and skipped.

**Actual billsec the user should see: `flow_billsec` from the loopback-B leg = 6–9s, OR `billsec` from the gateway trunk leg = 10–12s.**

The simplest correct value is `flow_billsec` from the loopback-B leg, which represents the total bridged duration including answer time. Alternatively, `end_epoch - answer_epoch` from the same leg gives the same value.

**Fix location:** `packages/backend/src/controllers/webhook-controller.ts`

Line 150 reads `billsec` from `variables['billsec']`. The loopback-B leg reports `billsec=2` (time from bridge-start to bowout) and `flow_billsec=6` (total elapsed since channel answered). The fix is to prefer `flow_billsec` over `billsec` for loopback channel legs, OR compute `billsec = answerEpoch ? (endEpoch - answerEpoch) : 0` directly from the epoch timestamps which are accurate.

Recommended code change at **line 150**:
```ts
// Current:
const billsec = Number(variables['billsec'] || cfTimes['billsec'] || cdr['billsec'] || 0);

// Fix: for loopback legs, flow_billsec = actual bridged time; billsec = loopback handoff overhead
const isLoopback = channelName.startsWith('loopback/');
const rawBillsec = Number(variables['billsec'] || cfTimes['billsec'] || cdr['billsec'] || 0);
const flowBillsec = Number(variables['flow_billsec'] || 0);
const billsec = isLoopback && flowBillsec > rawBillsec ? flowBillsec : rawBillsec;
```

Note: `channelName` must be read before `billsec` on line 150. It is already available at line 183. Refactor to read `channelName` at line ~149 (move it up from 183).

---

### Issue 2 — recordings missing on 6/7 calls

**Root cause: The `user_exists` FusionPBX dialplan (which was patched to add recording actions) intermittently does NOT fire the recording actions on the loopback-B leg.**

Evidence:
- 18:24 call: loopback-B `app_log` shows `record_path` set, `mkdir` ran, `record_session` fired → `record_path` present in CDR variables → webhook code saves recording.
- 11:22 call and all others: loopback-B `app_log` shows `extension name="user_exists"` matched but only the pre-recording boilerplate actions ran (domain_name, user_exists, caller_destination, etc.); **the recording block (record_path, mkdir, bind_digit_action, record_session) is absent** — the dialplan matched the extension but the recording actions are inside a separate condition that is failing.

This is the **same root cause from the March 2026 investigation**: the `user_exists` dialplan has a condition that requires `${user_exists}=true` before setting recording vars. When `user_exists=false` (0919239894 is not a FusionPBX user), the recording condition block is skipped.

The 18:24 call worked because it happened to hit a different execution path (possibly the dialplan cache was refreshed between calls, or FusionPBX picked a different condition evaluation order transiently).

**The OUT-ALL / user_exists dialplan recording fix applied in March was NOT persistent across all calls**, or the `user_exists` condition guard is still active on the recording actions block within the `user_exists` extension.

**Fix location:** FusionPBX `v_dialplans` — the `user_exists` dialplan extension must have the recording actions in a condition that does NOT require `user_exists=true`. The recording block should be in the `OUT-ALL` dialplan (which catches all outbound calls regardless of user_exists), not gated behind the user_exists check.

Alternatively, the March fix to `OUT-ALL` correctly added recording there, but the `blueva` domain's OUT-ALL dialplan was NOT updated (only `crm` domain was fixed — note `blueva` domain in CDR vs `crm` domain in old investigation).

Check: `SELECT dialplan_name, domain_name, dialplan_xml FROM v_dialplans WHERE domain_name = 'blueva' AND dialplan_name LIKE '%OUT%';` on FusionPBX DB.

---

## 3. Fix Summary

| Issue | Root Cause | Fix Location |
|---|---|---|
| billsec=2 | Loopback-B leg `billsec` = channel handoff time (~2s), not talk time. Code uses this value directly. Real talk time is in `flow_billsec` (same leg) or on the skipped gateway trunk leg. | `webhook-controller.ts` line ~150: use `flow_billsec` when `is_loopback=1` |
| No recording on 6/7 calls | `blueva` domain's OUT-ALL dialplan was NOT given recording actions (March fix only touched `crm` domain). Loopback-B leg reaches OUT-ALL without triggering recording. | FusionPBX `v_dialplans` for domain `blueva` — add same recording actions to OUT-ALL as were added for `crm` domain in March |

---

## Unresolved Questions

1. **Why did the 18:24 call work?** The loopback-B had `record_path` set, meaning the recording block DID fire. Needs confirmation whether the `blueva` OUT-ALL was briefly modified or if `user_exists` happened to be `true` for one call. Check `v_dialplans.dialplan_xml` for `blueva` domain's OUT-ALL to see current state.

2. **billsec on gateway trunk vs flow_billsec:** The gateway trunk (`sofia/internal/0919239894`) reported `billsec=10–12` while `flow_billsec=6–9` on loopback-B. These are different measurements. Clarify which the business considers "talk time" — from answer to hangup on the external leg (gateway, 10–12s) vs the loopback channel duration (6–9s). The `end_epoch - answer_epoch` calculation (= `flow_billsec`) is likely the most user-intuitive value.

3. **`record_ms` on gateway trunk:** Only the 18:24 call has `record_ms=11420` on the gateway leg; all others have `record_ms=0`. This is consistent with the recording only actually running on that one call. Confirms recording is a FusionPBX config issue, not a CRM code issue.

---

## Fix Applied (2026-04-17 18:42)

**PBX:** `10.10.101.206` — cluster `PBX-101.206_blueva`, domain `blueva`  
**Dialplan patched:** `OUT-ALL` (dialplan_uuid `263e6335-6df6-44a3-a431-f6fba7e762a8`)  
**Backup:** `/root/blueva_dialplan_backup_20260417_1849.csv` on `10.10.101.207` (138K, all v_dialplans rows)

### SQL Executed

```sql
BEGIN;
UPDATE v_dialplans
SET dialplan_xml = '<extension name="OUT-ALL" ...>'   -- full XML below
WHERE dialplan_uuid = '263e6335-6df6-44a3-a431-f6fba7e762a8';
SELECT substring(dialplan_xml ...) AS xml_preview FROM v_dialplans WHERE dialplan_uuid = '...';
COMMIT;
-- Result: UPDATE 1 / COMMIT
```

### Diff (recording block added at top of condition, before existing routing actions)

```diff
  <condition field="destination_number" expression="^(0(3|5|7|8|9)\d{8})$">
+         <action application="set" data="record_path=${recordings_dir}/${domain_name}/archive/${strftime(%Y)}/${strftime(%b)}/${strftime(%d)}"/>
+         <action application="set" data="record_name=${caller_id_number}_${destination_number}_${strftime(%d-%m-%Y_%H:%M:%S)}.${record_ext}"/>
+         <action application="mkdir" data="${record_path}"/>
+         <action application="set" data="RECORD_ANSWER_REQ=true"/>
+         <action application="set" data="api_on_answer=uuid_record ${uuid} start ${record_path}/${record_name}"/>
+         <action application="set" data="sip_h_accountcode=${accountcode}"/>
          <action application="export" data="call_direction=outbound" inline="true"/>
          ... (existing actions unchanged)
```

Note: `effective_caller_id_name/number` kept as `${outbound_caller_id_name}/${outbound_caller_id_number}` (dynamic, not hardcoded like `crm` domain). Gateway UUID `05885e10-eaaf-49e0-9b06-76cd6afceb31` unchanged.

### Cache Flush + Reload

Connected via ESL on port 8021 (SSH port 22 closed on 10.10.101.206):

```
api xml_flush_cache  →  +OK cleared 0 entries
api reloadxml        →  +OK [Success]
FreeSWITCH 1.10.12   →  UP, ready
```

### Verification Needed

Ask user to place 1 test outbound call from `blueva` tenant ext 101 → any mobile number, then confirm:
1. `recording_path` is populated in the most recent `call_logs` row.
2. MP3 file exists at `/var/lib/freeswitch/recordings/blueva/archive/YYYY/Mon/DD/`.

### Unresolved Questions (post-fix)

1. **18:24 anomaly:** The `blueva` OUT-ALL before this fix had NO recording actions — yet the 18:24 call produced a recording. The `user_exists` dialplan (separate extension) may have had recording actions from a prior March fix attempt. That extension fires when `user_exists=true`, but 0919239894 is not a FusionPBX user so `user_exists=false`. Cause of the anomaly still unclear — may have been a transient dialplan cache state.
2. **billsec fix** (Issue 1) still pending — requires code change in `webhook-controller.ts` line ~150 (separate task).

---

## Round 2 Evidence (2026-04-17 19:15)

### 1. Deployment Status

```
docker exec crm-backend grep -c flow_billsec .../dist/controllers/webhook-controller.js
→ 0
```

**The prior fix did NOT deploy.** The TypeScript source (`webhook-controller.ts`) was updated with `flow_billsec` logic, but `npm run build` was never run (or the container was not restarted with the new build). The live JS still contains `isAgentSipLeg` but no `flow_billsec` reference. The 19:09 test call ran against the original code.

### 2. Raw CDR Legs — 19:09 Call

Call UUID: `a3f45468-aee2-4e77-93f7-c5c9f45226b1`  
DB start_time: `2026-04-17 12:09:47 UTC` (= 19:09 ICT)  
DB result: `duration=10, billsec=2`, recording_path present (dialplan fix confirmed working).

| webhook_log id (short) | channel_name | direction | start_e | answer_e | end_e | var_dur | var_bill | flow_bill | answer→end (computed) | rec_ms | status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 21734eca | `loopback/0919239894-a` | — | 1776427787 | 1776427795 | 1776427797 | 10 | 2 | **10** | 2s | — | Skipped orphan |
| 287ecc35 | `loopback/0919239894-b` | outbound | 1776427787 | 1776427795 | 1776427797 | 10 | 2 | **10** | 2s | — | **Processed (canonical)** |
| 9d746bfa | `sofia/internal/101%40...` | — | 1776427787 | 1776427787 | 1776427810 | 23 | **23** | 23 | **23s** | — | Skipped agent SIP |

Epoch arithmetic:
- Loopback answer→end: `1776427797 - 1776427795 = 2s` (matches `var_bill=2`)
- Loopback start→end: `1776427797 - 1776427787 = 10s` (matches `var_dur=10` and `flow_bill=10`)
- Agent SIP answer→end: `1776427810 - 1776427787 = 23s` (matches `var_bill=23`; answer=start → never rang on agent side)

**Recording duration cross-check (15s):**  
`agent_SIP.end_epoch − loopback_b.answer_epoch = 1776427810 − 1776427795 = 15s`  
This is the interval from "bridge answered on external gateway" to "agent SIP leg hung up" — i.e., the actual bridged talk window. The recording file spans exactly this window.

### 3. Explicit Answers

**Q: Which leg's billsec equals ~15s (real talk time)?**  
None directly. 15s = `agent_SIP.end_epoch - loopback_b.answer_epoch` — a cross-leg computation. No single CDR field on any processed leg holds 15.

**Q: Which leg's duration equals ~22s (softphone display)?**  
Agent SIP leg: `duration=23` (≈ 22s softphone display; 1s rounding). Currently **skipped**.

**Q: Does that leg get skipped by `isAgentSipLeg`?**  
Yes. `channelName = sofia/internal/101%4010.10.101.224%3A22336` → `startsWith('sofia/internal/')` → true → skipped entirely (timing not merged).

**Q: Is there ANY non-skipped leg carrying 15s or 22s?**  
No. The canonical loopback-B leg carries `billsec=2`, `flow_billsec=10`, `duration=10`. None of these are 15 or 22.

**Bottom line:** Even if `flow_billsec` fix had deployed, it would have written `10s` to `billsec` (not 15s). `flow_billsec` was not the right fix — it corrects a ~6–9s error (old calls) but for this call it still diverges from the recording by 5s.

### 4. Why flow_billsec Still Wrong

`flow_billsec` = time since FusionPBX channel creation to hangup = `end_epoch - start_epoch` = total leg lifetime including IVR/routing pre-answer time. For this call:
- Loopback channel created at start_epoch=1776427787
- Call answered (bridged) at answer_epoch=1776427795 (8s later)
- Loopback leg hung up at end_epoch=1776427797 (only 2s after bridge answer — the loopback bowout)
- So `flow_billsec=10` = start→end of loopback = **total elapsed, not talk time**

The loopback leg terminates at bowout (1776427797), 15 seconds before the actual call ends (1776427810). The loopback does not know when the real SIP bridge ends.

### 5. Recommended Fix

**Option (c) — Compute billsec from `answer_epoch → agent_SIP.end_epoch` cross-leg** is architecturally cleanest but requires multi-leg state (not available at per-leg processing time).

**Option (b) — Use agent SIP leg's `end_epoch - answer_epoch` as talk time, skip its `duration`** is feasible but agent SIP `answer_epoch = start_epoch` (phone rang immediately, no queue hold in this flow), so `answer→end = 23s` which is total leg lifetime = softphone duration including ring. Still wrong for billsec (not just talk).

**Recommended: Option (a) with scoped change — stop skipping agent SIP leg's `duration` AND `billsec`, and compute billsec as `end_epoch - loopback_b.answer_epoch`.**

This is complex. The **practical single-file fix** is:

> **Use the agent SIP leg's `billsec` directly** (the agent SIP `billsec` field = 23s = total SIP call duration from agent phone perspective). Accept this as "duration" (the field currently labeled `Thời lượng`). For `billsec` (talk only), compute `end_epoch - answer_epoch` on the loopback-B leg's epochs but use the **agent SIP's `end_epoch`** as the end anchor.

However, the simplest viable fix with minimal risk:

**Recommended: Option (b′) — When processing the canonical loopback-B leg, defer final timing write until the agent SIP leg is seen; OR store agent SIP leg's end_epoch into the call_logs row when it arrives, and compute `billsec = stored_agent_end - answer_epoch`.**

This requires schema + two-pass processing. Too invasive.

**Concrete minimal fix (recommended):**

**File:** `packages/backend/src/controllers/webhook-controller.ts`

**Change the `isAgentSipLeg` block (lines 257–291):**  
Currently it skips all timing. Change to: also merge `billsec` from the agent SIP leg if it is the `sofia/internal/<ext>@<ip>` pattern (agent phone, not gateway trunk). The agent SIP `billsec` is `end_epoch - start_epoch` (since answer=start), which equals the full SIP session = softphone display. Write this as `duration`; compute actual billsec = `agent_sip.end_epoch - loopback_b.answer_epoch` via the already-stored `answerTime` in the DB row.

**Exact lines to change — `webhook-controller.ts:257`:**

```ts
// BEFORE (line 257-291): isAgentSipLeg block only patches recording, returns
if (isAgentSipLeg) {
  const hasRecording = ...
  // ... only writes recording, ignores timing
  return;
}

// AFTER: also write duration (agent SIP duration = softphone display) and
// recompute billsec = agent.end_epoch - existing answerTime epoch
if (isAgentSipLeg) {
  const hasRecording = recordingPath && recordingPath !== 'null' && recordMs > 0;
  let mergedNote = 'Skipped agent SIP leg (inflated timing)';
  if (canonicalUuid) {
    const existing = await prisma.callLog.findUnique({
      where: { callUuid: canonicalUuid },
      select: { answerTime: true, duration: true, billsec: true },
    });
    // agent SIP duration = full SIP session ≈ what the softphone displays
    // agent SIP end_epoch - loopback answer_epoch = actual bridged talk time
    const agentDuration = duration; // var_duration from agent SIP leg = 23s
    const computedBillsec = (endEpoch && existing?.answerTime)
      ? Math.max(0, endEpoch - Math.floor(existing.answerTime.getTime() / 1000))
      : null;
    await prisma.callLog.update({
      where: { callUuid: canonicalUuid },
      data: {
        duration: Math.max(agentDuration, existing?.duration || 0),
        ...(computedBillsec !== null ? { billsec: computedBillsec } : {}),
        ...(hasRecording ? { recordingPath: String(recordingPath), recordingStatus: 'available' as const } : {}),
      },
    });
    mergedNote = `Merged agent SIP timing: duration=${agentDuration}, billsec=${computedBillsec ?? 'n/a'}`;
  }
  await prisma.webhookLog.update({ where: { id: webhookLog.id }, data: { status: 'processed', errorMessage: mergedNote } });
  res.json({ success: true, data: null });
  return;
}
```

**Expected result for 19:09 call:**
- `duration` = MAX(23, 10) = **23s** (matches softphone 22s ± 1s rounding)
- `billsec` = `agent_SIP.end_epoch(1776427810) - loopback_b.answer_epoch(1776427795)` = **15s** (matches recording)

**Risk check — inbound queue flows:** The codebase currently has no inbound queue (all calls are ext-to-mobile outbound). The `isAgentSipLeg` condition fires only on `sofia/internal/*` channels. Inbound calls where an agent receives are also `sofia/internal/<ext>` — but those would have a loopback-b leg carrying queue hold time in its `duration`. The `computedBillsec` formula (agent.end - loopback.answer) would still be safe since it anchors on the loopback's `answer_epoch` which is when the call was actually bridged to the agent.

**Deployment gap to fix first:** Run `npm run build` in the backend container or CI and restart before any code change takes effect.

### 6. Unresolved Questions

1. **Why does loopback `end_epoch` = `answer_epoch + 2s` (1776427797) while the agent SIP ends at 1776427810 (23s later)?** The loopback channel terminates at bowout (bridge transfer complete), not at call end — this is expected FusionPBX behavior. Confirmed: loopback is not a reliable source of talk time.
2. **flow_billsec = 10 but start→end delta = 10, answer→end delta = 2.** FusionPBX `flow_billsec` = channel lifetime from creation, not from bridge answer. This makes it equal to `duration` (10s), not actual talk time. Prior fix recommendation was wrong.
3. **Build/deploy process:** How is `dist/` updated on the dev server? Is there a CI step or manual `npm run build`? If manual, this should be automated to prevent future deploy drift.
4. **Does the agent SIP leg always arrive AFTER loopback-B?** The `existing.answerTime` must be populated before `computedBillsec` can be calculated. The webhook_log timestamps show agent SIP arrives ~13s after loopback (12:09:57 vs 12:10:10) — so yes, loopback-B processes first and `answerTime` is available when agent SIP arrives. But this ordering is not guaranteed under load — consider adding a null-guard fallback.

---

## Fix Shipped (2026-04-17 19:36)

User tested and confirmed: `Thời lượng` + `Thời gian nói` both correct on new calls, recording icon present.

### What shipped

**Backend — `packages/backend/src/controllers/webhook-controller.ts`:**
- Agent-SIP leg no longer discarded. Merges `duration = MAX(agent.duration, existing)` and `billsec` via the cross-leg formula (`endTime − answerTime`).
- Canonical upsert (loopback-B handler) applies the same formula when it arrives after the agent leg — both arrival orderings converge. Null-guard handles the race identified in unresolved question #4.
- `startTime/answerTime/endTime` conversions hoisted before the `isAgentSipLeg` branch so both branches share them.

**Backend — `packages/backend/src/lib/cdr-merge.ts` (NEW):**
- Extracted `mergeBillsec(candidate, existing, answerTime, endTime)` and `mergeDuration(candidate, existing)` to kill the duplication between the two leg handlers and enable unit testing.

**Tests — `packages/backend/tests/cdr-merge.test.ts` (NEW):**
- 7/7 passing. Covers: cross-leg formula wins when both timestamps known; falls back to MAX on either ordering; ignores zero/negative on clock skew; nullish coerce.

**FusionPBX — `10.10.101.206` `blueva` domain OUT-ALL dialplan:**
- 6 recording actions added to `v_dialplans.dialplan_xml` (`record_path`, `record_name`, `mkdir`, `RECORD_ANSWER_REQ`, `api_on_answer=uuid_record`, `sip_h_accountcode`). Backup: `/root/blueva_dialplan_backup_20260417_1849.csv`. Cache flushed + `reloadxml`.

### Deployment process fix

Prior deploy rsync'd to `/opt/crm/packages/...` but only ran `docker compose restart backend` — `/app/` inside the container is baked into the image, not bind-mounted, so the new code never ran. Correct flow now used:

```
rsync packages/backend/src/ packages/backend/dist/ packages/shared/ → /opt/crm
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d backend
```

Verification step: `docker exec crm-backend grep -c "<sentinel>" /app/packages/backend/dist/...` must return ≥ 1. Added to crm-deploy skill learnings.

Image SHA deployed: `99d464188dc5`.

### Data preservation

No rows in `call_logs` modified or deleted. Manual calls (route `/call-logs/manual`, `callUuid` prefix `manual-`) bypass the webhook and are untouched.

### Docs/skill updates

- `docs/project-changelog.md` → v1.3.5 entry
- `.claude/skills/crm-pbx-cluster/SKILL.md` → new "CDR Leg Semantics" + "Recording Prerequisites" sections

### Follow-up

- Helper extraction (`cdr-merge.ts`) is behavior-preserving and unit-tested but not yet redeployed. Next backend deploy will pick it up; no rush since the inlined logic currently running is identical.
- Consider a CI step to prevent deploy drift (unresolved question #3 still open).

### Unresolved

None blocking. Open items carried from prior rounds — all non-blocking for shipped fix.

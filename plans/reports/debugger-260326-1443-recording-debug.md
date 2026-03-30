# Recording Debug Report
**Date:** 2026-03-26
**Scope:** FusionPBX recording not saving + link recordings to CRM

---

## Executive Summary

FusionPBX outbound call recordings were not being saved for the `crm` domain. Root cause: the FusionPBX outbound gateway dialplans (`OUT-ALL`, etc.) had no recording actions. The `user_record` dialplan only fires when `user_exists=true`, but outbound external calls use a loopback channel where the destination number (e.g., `0901239894`) is not a registered FusionPBX user.

**Status after fix:**
- Recordings ARE now being created on FusionPBX
- Recording path IS being stored in CRM DB (`recording_status=available`)
- Recording proxy endpoint has a code bug (separate issue) blocking playback in the frontend

---

## Root Cause Analysis

### Call Flow
```
ESL originate user/1005@crm
    → sofia/internal/1005 (agent phone rings) → answered
    → bridge(loopback/0901239894/crm)
        → loopback/0901239894-b processed by dialplan context=crm
            → user_record dialplan: FAIL (user_exists=false for 0901239894)
            → OUT-ALL dialplan: PASS → bridge to gateway
```

### Why `user_record` Dialplan Failed

The `user_record` dialplan (UUID `e610a4ba`) requires `${user_exists}=true` in ALL condition groups (0–8) before setting `record_session=true`. On the outbound loopback B-leg:

```
loopback/0901239894-b set(user_exists=false)  ← 0901239894 is not a FusionPBX user
user_record: FAIL [user_exists](false) =~ /^true$/
```

Even though extension `1005` has `user_record=all` in the directory, the B-leg checks the DESTINATION number, not the agent.

### Evidence (FreeSwitch log)
```
e789ca00 Dialplan: loopback/0901239894-b Regex (FAIL) [user_record] ${user_exists}(false) =~ /^true$/
e789ca00 Dialplan: loopback/0901239894-b Regex (FAIL) [user_record] ${user_record}() =~ /^all$/
e789ca00 Dialplan: loopback/0901239894-b Regex (FAIL) [user_record] ${record_session}() =~ /^true$/
```

CDR confirms: `user_record=all` and `record_stereo=true` present (from agent 1005's directory), but NO `record_path`, `record_name`, or `record_session` variables — recording never initiated.

### Why OUT-ALL Dialplan Had No Recording

The `OUT-ALL` dialplan had no recording actions at all. It only handled call routing to the SIP gateway.

---

## Additional Findings

### Duplicate `user_record` Dialplans
- Two `user_record` dialplan UUIDs in `crm` domain: `e610a4ba` and `85293f39`
- Both identical and enabled — causes redundant processing but not the root issue

### FusionPBX Cache Mechanism
- FusionPBX uses a **file-based XML cache** at `/var/cache/fusionpbx/dialplan.crm`
- Dialplan XML is pre-built and stored in `v_dialplans.dialplan_xml` column
- Modifying `v_dialplan_details` alone does NOT update the served dialplan
- Must update `v_dialplans.dialplan_xml` AND delete `/var/cache/fusionpbx/dialplan.crm`

### Recording Proxy URL Bug (Application Code — NOT Fixed)
See "Remaining Issues" section.

---

## Fixes Applied

### 1. Updated `OUT-ALL` dialplan_xml (FusionPBX DB)
Added recording actions before the bridge in `v_dialplans.dialplan_xml` for UUID `4ae4bf74-727c-4ace-bca9-312891f97af4`:

```xml
<action application="set" data="record_path=${recordings_dir}/${domain_name}/archive/${strftime(%Y)}/${strftime(%b)}/${strftime(%d)}"/>
<action application="set" data="record_name=${caller_id_number}_${destination_number}_${strftime(%d-%m-%Y_%H:%M:%S)}.${record_ext}"/>
<action application="mkdir" data="${record_path}"/>
<action application="set" data="RECORD_ANSWER_REQ=true"/>
<action application="set" data="api_on_answer=uuid_record ${uuid} start ${record_path}/${record_name}"/>
```

Inserted at order 25–29, before `export call_direction=outbound` (order 40) and `bridge` (order 130).

### 2. Updated `v_dialplan_details` for OUT-ALL, OUT-VINA-CRM, OUT-MOBI-CRM
Added matching recording detail rows in `v_dialplan_details` for DB consistency (even though FusionPBX uses `dialplan_xml` for live serving).

### 3. Flushed dialplan cache
```bash
rm /var/cache/fusionpbx/dialplan.crm
fs_cli -p ClueCon -x 'xml_flush_cache'
fs_cli -p ClueCon -x 'reloadxml'
```

---

## Test Results

### Test 1 (before fix) — 2026-03-26 14:34:46
- Extension 1005 → `0901239894` via `OUT-ALL`
- Cause: `NO_ANSWER` (test call)
- Recording: NO file created
- CDR: `user_record=all`, `record_stereo=true`, NO `record_path`/`record_name`

### Test 2 (after fix) — 2026-03-26 14:57:20
- Extension 1005 → `0901239894` via `OUT-ALL`
- Recording file created: `/var/lib/freeswitch/recordings/crm/archive/2026/Mar/26/1005_0901239894_26-03-2026_14:57:20.mp3` (14K)
- CRM DB updated: `recording_status=available`, `recording_path=/var/lib/freeswitch/recordings/crm/archive/2026/Mar/26/1005_0901239894_26-03-2026_14:57:20.mp3`
- Nginx serving: `HTTP 200` from `http://10.10.101.189:8088/recordings/crm/archive/2026/Mar/26/1005_0901239894_26-03-2026_14%3A57%3A20.mp3`

---

## Nginx Recordings Proxy (Port 8088)

Already configured at `/etc/nginx/sites-available/recordings-proxy`:
- Listens on port `8088`
- `allow 10.10.101.207` (CRM server only)
- `location /recordings/` → `alias /var/lib/freeswitch/recordings/`
- Status: Working correctly

---

## Remaining Issues

### CRITICAL: Recording Proxy URL Bug in `recording-service.ts`

**File:** `packages/backend/src/services/recording-service.ts:49`

```js
const fileUrl = `${baseUrl}/${encodeURIComponent(recordingPath)}`;
```

**Problem:** `encodeURIComponent()` encodes path separators (`/` → `%2F`), producing an invalid URL:
```
http://10.10.101.189:8088/recordings/%2Fvar%2Flib%2Ffreeswitch%2Frecordings%2Fcrm%2Farchive%2F2026%2FMar%2F26%2F1005_0901239894.mp3
```
nginx cannot resolve this → HTTP 404.

**Fix needed** (application code change required):
```js
// Strip the recordings base directory from the path
const RECORDINGS_BASE = '/var/lib/freeswitch/recordings/';
const relativePath = recordingPath.startsWith(RECORDINGS_BASE)
  ? recordingPath.slice(RECORDINGS_BASE.length)
  : recordingPath;
const fileUrl = `${baseUrl}/${relativePath}`;
```

Or encode each path segment individually:
```js
const segments = recordingPath.split('/').filter(Boolean);
const fileUrl = `${baseUrl}/${segments.map(encodeURIComponent).join('/')}`;
```

**Impact:** `GET /api/v1/call-logs/:id/recording` returns HTTP 404 for all recordings. Frontend cannot play recordings.

### MEDIUM: Missing `recordingUrl` in Call Log API Response

**File:** `packages/backend/src/services/call-log-service.ts`

The `callLogSelect` object doesn't include `recordingPath` and doesn't compute `recordingUrl`. The frontend expects `call.recordingUrl` to render the audio player. Currently returns `undefined` → audio player never shown.

**Fix needed:**
```ts
// In callLogSelect, add:
recordingStatus: true,
// Add to getCallLogById response transformation:
recordingUrl: log.recordingStatus === 'available' ? `/api/v1/call-logs/${log.id}/recording` : null,
```

### LOW: Duplicate `user_record` Dialplans
Two `user_record` dialplans in `crm` domain (UUIDs: `e610a4ba`, `85293f39`). Both enabled, both identical. Causes double processing. The older one (`85293f39`) should be disabled:
```sql
UPDATE v_dialplans SET dialplan_enabled = false WHERE dialplan_uuid = '85293f39-da05-488c-b5ce-c183f7090689';
```

---

## Configuration Reference

| Item | Value |
|------|-------|
| FusionPBX server | `10.10.101.189` |
| CRM server | `10.10.101.207` |
| Recording dir | `/var/lib/freeswitch/recordings/crm/archive/YYYY/Mon/DD/` |
| Recording format | `mp3` (`record_ext=mp3`) |
| Recording naming | `{caller_id}_{destination}_{dd-mm-yyyy_HH:MM:SS}.mp3` |
| Nginx recordings URL | `http://10.10.101.189:8088/recordings/` |
| CRM env var | `FUSIONPBX_RECORDING_URL=http://10.10.101.189:8088/recordings` |
| Cache file | `/var/cache/fusionpbx/dialplan.crm` |

---

## Unresolved Questions

1. Should `OUT-VINA-CRM` and `OUT-MOBI-CRM` dialplans also have recording? Their `dialplan_xml` is empty — unclear if they are in use. If activated, they need the same recording actions.
2. The `RECORD_ANSWER_REQ=true` + `api_on_answer=uuid_record` approach records only when the external party answers. If the call is not answered, no recording is created. Is this the desired behavior?
3. Will `uuid_record` on the loopback B-leg capture both sides of the conversation (agent + customer) in stereo? `record_stereo=true` is set on the agent channel but may not propagate to the loopback channel.

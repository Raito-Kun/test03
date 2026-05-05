# Cross-Tenant Call Log Leak — Debug Report
**Date:** 2026-04-20 18:26 | **Reporter:** debugger agent

---

## Executive Summary

**NOT a CRM code bug.** The CRM correctly rejects all `hoangthienfinance.vn` CDRs. The calls admin@blueva sees (ext 103/104/105) **are genuine blueva-domain calls** — FusionPBX sent CDRs with `domain_name=blueva` and those calls correctly land in the blueva cluster. The confusion arises because:

1. Extensions 103/104/105 are **dual-registered** on both FusionPBX domains, so the same extension numbers appear in both tenants' agent pools.
2. FusionPBX's `v_xml_cdr` table is **missing the specific call records** that CRM received — but CRM's `webhook_logs.raw_payload` proves they arrived with `domain_name=blueva`.
3. The user's FusionPBX CDR UI search **found nothing** because those call rows don't exist in `v_xml_cdr` — likely a FusionPBX `mod_cdr_csv`/`mod_xml_cdr` write failure or domain misconfiguration on the PBX side.

---

## Findings by Hypothesis

### H1: Extensions dual-registered — CONFIRMED
```
domain_name           | extension
blueva                | 103
hoangthienfinance.vn  | 103
blueva                | 104
hoangthienfinance.vn  | 104
blueva                | 105
hoangthienfinance.vn  | 105
```
Same extension numbers exist in both domains. This is the source of visual confusion — seeing "103" in CRM doesn't mean it's a hoangthienfinance.vn agent.

### H2: CRM webhook misattributes hoangthienfinance.vn calls — REFUTED
`getClusterIdByPbxIpAndDomain()` in `active-cluster.ts` requires BOTH `pbx_ip` AND `sip_domain` to match. All 602+ hoangthienfinance.vn CDRs are correctly rejected with "Skipped CDR — domain not registered". No fallback IP-only path exists.

`webhook-controller.ts` lines 120-128:
```ts
const clusterId = await getClusterIdByPbxIpAndDomain(req.ip, cdrDomain);
if (!clusterId) {
  // → status: processed, errorMessage: "Skipped CDR..."
  return;
}
```

### H3: Raw payload domain check — CONFIRMED BLUEVA
Both accepted call_uuid records (`6ab631ea...`, `f4747f7b...`):
- `domain_name` = **blueva**
- `user_context` = **blueva**
- `sip_from_host` = **blueva**
- `channel_name` = **sofia/external/103%40blueva** (outbound trunk, correct)

These CDRs are legitimately tagged blueva by FusionPBX. CRM behavior is correct.

### H4: admin@blueva scope — NOT THE ISSUE
```
email         | role  | cluster_id
admin@blueva  | admin | 13bec0b3-a748-4bff-9e4e-046e20c65319  (blueva)
```
`data-scope-middleware.ts`: role=admin → `req.dataScope = {}` (full access within cluster).
`call-log-service.ts` line 48-50: `resolveListClusterFilter(role, userClusterId)` → returns `13bec0b3...` → `where.clusterId = '13bec0b3...'`.

Admin sees all call_logs **scoped to blueva cluster only**. No cross-cluster bleed.

### H5: FusionPBX v_xml_cdr missing the records — CONFIRMED
Queried `v_xml_cdr` for the two exact call UUIDs:
```sql
WHERE x.xml_cdr_uuid IN ('6ab631ea...', 'f4747f7b...')
→ (0 rows)
```
Also confirmed: no blueva CDR for ext 103 → 0974477335 in the symptom window (10:42–10:45 UTC today). Only March 17-18 historical records exist for that destination.

FusionPBX **sent the webhook** (CRM received and stored `raw_payload` with blueva variables) but **did not write to its own v_xml_cdr** table. This is a FusionPBX-side write failure, not a CRM bug.

---

## Root Cause

**FusionPBX mod_xml_cdr webhook-to-DB inconsistency.** FusionPBX successfully POSTed CDR data to CRM's webhook endpoint with correct `domain_name=blueva` variables, but failed to persist those same call records to its own `v_xml_cdr` table. Consequence: CRM's call history is correct; the FusionPBX CDR search UI appears empty because v_xml_cdr was never updated.

Secondary observation: ext 103/104/105 are dual-registered on both domains. When blueva agents with those extensions make calls, they correctly appear in blueva's CRM call log. This is expected and correct behavior — it only looks suspicious because the same extension numbers also exist in hoangthienfinance.vn.

---

## What Is NOT Wrong (do not touch)

- `webhook-controller.ts` domain filter — works correctly
- `getClusterIdByPbxIpAndDomain` — works correctly
- `call-log-service.ts` cluster scoping — works correctly
- `data-scope-middleware.ts` admin role — correctly scoped to cluster
- CRM stored_domain for all symptom calls = `blueva` — correct

---

## Recommended Actions

### Immediate (FusionPBX side — no CRM code change needed)
1. **Check FusionPBX `mod_xml_cdr` logs** on 10.10.101.206 for write errors around 10:42-10:45 UTC today:
   ```bash
   grep -i "xml_cdr\|cdr_csv" /var/log/freeswitch/freeswitch.log | grep -E "10:4[2-5]"
   ```
2. **Verify FusionPBX CDR storage config** for blueva domain — check `v_xml_cdr` storage is enabled and the domain_uuid is correct (`cc7dc887-4713-4a0f-9f08-5007a9f4f133`).
3. If v_xml_cdr writes are unreliable, CRM's webhook log IS the authoritative CDR — the PBX-side gap is a FusionPBX housekeeping issue.

### Optional / Low Priority (CRM hardening)
4. **Add `domain_name` field to `call_logs` table** so each row explicitly records which FusionPBX domain it originated from (useful for audit trails but not required for correctness).
5. **Clarify FusionPBX CDR search scope** to users: CRM call history may contain calls that FusionPBX's own UI doesn't show when v_xml_cdr writes are incomplete.

### Rollback Plan
No code changes proposed — nothing to roll back. If a defensive domain field is added later, rollback = drop the column and revert the migration.

---

## Evidence Summary

| Evidence | Value |
|---|---|
| CRM stored_domain for symptom calls | `blueva` (correct) |
| Webhook raw_payload domain_name | `blueva` (correct) |
| Webhook raw_payload channel | `sofia/external/103%40blueva` (correct) |
| FusionPBX v_xml_cdr for those UUIDs | 0 rows (FusionPBX write failure) |
| hoangthienfinance.vn CDRs accepted by CRM | 0 (all correctly rejected) |
| admin@blueva cluster_id | `13bec0b3...` (blueva only) |
| Cluster filter in call-log-service | Applied via `resolveListClusterFilter` |

---

## Unresolved Questions

1. Why did FusionPBX send the webhook but not write to v_xml_cdr? Needs investigation on the PBX host (FreeSWITCH log, disk space, DB connection state for `mod_xml_cdr`).
2. Are ext 103/104/105 intentionally dual-registered on both domains, or is this a FusionPBX provisioning error? If unintentional, deregistering them from hoangthienfinance.vn would reduce webhook noise by ~600+ rejected CDRs per 2 hours.

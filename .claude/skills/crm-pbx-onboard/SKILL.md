---
name: crm-pbx-onboard
description: Onboarding checklist for adding a new FusionPBX host OR a new tenant domain on an existing PBX. Ensures every required step (dialplan recording, CDR webhook, CRM cluster record, extension sync, feature flags) is applied — born from the 2026-04-17 blueva-domain recording miss.
version: 1.0.0
argument-hint: "[new-pbx|new-domain] <cluster-slug>"
---

# CRM PBX Onboarding Skill

Activate this skill **before** creating a new `PbxCluster` record or adding a new tenant domain to an existing FusionPBX host. Every step below is mandatory — skipping one has caused silent production regressions (see "Known Failures").

> **Preferred UX:** admin uses the in-app **Tiền kiểm** tab at `Settings → Cluster Management → <cluster> → Tiền kiểm` (added in v1.3.6). It runs 7 read-only checks and reports pass/fail with actionable hints. This skill is the manual runbook that explains what each check expects and how to fix failures.

> **Multi-rule dialplan selection (v1.3.8):** outbound recording is rarely one dialplan rule — tenants usually have `OUT-VIETTEL`, `OUT-MOBI`, `OUT-VINA`, etc. In the SSH/FusionPBX PG section of the cluster form there's a **checkbox list** loaded from FusionPBX. Tick every rule that carries outbound-with-recording traffic. Preflight then checks each rule independently and reports per-rule pass/fail. Rules intentionally without recording (e.g. emergency numbers) should NOT be ticked — keeping them unticked avoids false "warn" noise.

## When to Use

- Onboarding a brand-new PBX host (new IP, new FusionPBX instance)
- Adding a new tenant domain on an existing PBX (e.g. adding `foo.vn` alongside `blueva` on `10.10.101.206`)
- Migrating a tenant between PBX hosts
- Re-verifying an existing cluster after a PBX software upgrade

## Known Failures — Why This Skill Exists

| Date | Miss | Blast radius |
|---|---|---|
| 2026-04-20 | Someone commented out `<param name="log-http-and-disk" value="true"/>` in `xml_cdr.conf.xml` on `10.10.101.206`. mod_xml_cdr only POSTed CDR to CRM webhook, wrote no disk XML → FusionPBX's `xml_cdr_import.php` cron had nothing to ingest → `v_xml_cdr` stale → FusionPBX UI showed no new calls for ALL tenants since 2026-04-17. Fix: uncomment param + `fs_cli -x 'reload mod_xml_cdr'`. Backfill from `webhook_logs.raw_payload` via CRM DB (see `crm-pbx-cluster` skill triage). | All tenants on that PBX — UI visibility only; recordings + CRM unaffected |
| 2026-04-17 | Added `blueva` domain on `10.10.101.206` but never copied OUT-ALL recording actions from the `crm` domain's dialplan. Result: every C2C call had no recording for weeks. | All outbound calls for tenant |
| 2026-03-26 | `crm` domain's OUT-ALL had no recording actions at all. `user_record` dialplan failed on loopback B-leg because destination is not a FusionPBX user. | Same |

Pattern: FusionPBX tenant creation in the admin UI does NOT automatically inject outbound-recording actions. Every new domain MUST be patched manually or via this skill. Upstream FusionPBX installs/upgrades sometimes reset `xml_cdr.conf.xml` to webhook-only mode — verify disk-logging param on every fresh host and after every upgrade.

## Scenario A — New PBX Host

Steps in order. Mark each done before proceeding.

### 1. Network reachability
- From backend host: `ping <pbx-ip>`, `nc -zv <pbx-ip> 22 5060 8021` (SSH, SIP, ESL)
- ESL must be reachable from backend — it is the source of truth for "C2C works"

### 2. Create the `PbxCluster` DB row
Use `crm-db` skill. Required fields:
- `name`, `sip_domain` (first domain on this host), `pbx_ip`, `esl_host`, `esl_port`, `esl_password`
- `ssh_host`, `ssh_user`, `ssh_password` (for extension sync)
- `recording_base_url` (e.g. `http://<pbx-ip>:8088/recordings` — nginx alias on PBX)
- `is_active = false` initially — flip only after smoke test passes

### 3. Patch OUT-ALL dialplan for recording
This is the step the prior miss skipped. Use `crm-pbx-cluster` SKILL's "Recording Prerequisites" block — same XML applies. Template recording actions must be injected into `v_dialplans.dialplan_xml` **before** the bridge action.

Required actions (copy-paste safe, domain-agnostic):
```xml
<action application="set" data="record_path=${recordings_dir}/${domain_name}/archive/${strftime(%Y)}/${strftime(%b)}/${strftime(%d)}"/>
<action application="set" data="record_name=${caller_id_number}_${destination_number}_${strftime(%d-%m-%Y_%H:%M:%S)}.${record_ext}"/>
<action application="mkdir" data="${record_path}"/>
<action application="set" data="RECORD_ANSWER_REQ=true"/>
<action application="set" data="api_on_answer=uuid_record ${uuid} start ${record_path}/${record_name}"/>
<action application="set" data="sip_h_accountcode=${accountcode}"/>
```

After update: `rm /var/cache/fusionpbx/dialplan.<domain>` then `fs_cli -p ClueCon -x 'reloadxml'`.

### 4. Configure CDR webhook on FusionPBX
FusionPBX → Advanced → Default Settings → `cdr.url` must point at CRM backend:
```
http://<crm-backend-host>:<port>/api/v1/webhooks/cdr
```
Set Basic Auth user/pass matching `WEBHOOK_BASIC_USER` / `WEBHOOK_BASIC_PASS` on the backend. Add the PBX's egress IP to `WEBHOOK_ALLOWED_IPS` on the backend `.env` (comma-separated).

**Critical:** verify `/etc/freeswitch/autoload_configs/xml_cdr.conf.xml` has `<param name="log-http-and-disk" value="true"/>` **uncommented**. If it's commented out (default in some FusionPBX builds), mod_xml_cdr POSTs to CRM but writes no disk XML → FusionPBX UI's CDR page stays empty forever for all tenants. After editing: `fs_cli -x 'reload mod_xml_cdr'`. This is the 2026-04-20 miss — invisible until a user opens FusionPBX UI and sees stale data.

### 5. Extension sync
Trigger `POST /api/v1/pbx-clusters/<id>/sync-extensions` (or use cluster-management UI). Confirm extensions appear in DB and registration status resolves via ESL.

### 6. Nginx recording proxy
On the PBX host, nginx must serve `/recordings/` aliased to `/var/lib/freeswitch/recordings/`. Verify with:
```bash
curl -I http://<pbx-ip>:8088/recordings/<domain>/archive/2026/Apr/17/ANY.mp3
```
A 200 or 404 (not "connection refused") is acceptable. Set `recording_base_url` on the cluster accordingly.

### 7. Feature flag audit
Use `crm-feature-flag` skill. For the new tenant, at minimum enable: `call_history`, `recording_playback`, `click_to_call`, `dashboard`. Default-off flags stay off.

### 8. Smoke test before going active
- Place 1 C2C call from a seeded agent on this cluster → any mobile number
- Verify in `call_logs`:
  - `duration ≈ softphone display` (matches agent-SIP leg via cross-leg merge)
  - `billsec ≈ real talk time`
  - `recording_status = 'available'` and `recording_path` populated
  - Mic icon renders in UI; playback works
- Verify `webhook_logs` shows `status=processed` for all CDR legs

### 9. Activate
Only after step 8 passes: `UPDATE pbx_clusters SET is_active = true WHERE id = '<id>'`. ESL daemon reloads automatically.

## Scenario B — New Domain on Existing PBX

### 1. Add cluster record in CRM
Same as Scenario A step 2, but reuse the existing `pbx_ip`, `ssh_*`, `esl_*` values. Only `sip_domain` and `name` change.

### 2. Create the domain in FusionPBX
FusionPBX admin UI → Advanced → Domains → Add. The domain string must exactly match `sip_domain` on the cluster record.

### 3. **Patch OUT-ALL dialplan for the NEW domain (do not forget this one)**
This is the step that was missed on 2026-04-17. The new domain starts with a **blank** OUT-ALL — the recording actions from the peer domain (e.g. `crm`) are NOT inherited.

Shortcut: copy the existing working domain's OUT-ALL XML and rewrite `domain_uuid` only. SQL template in `crm-pbx-cluster` SKILL → Recording Prerequisites.

**Safety:** backup `v_dialplans` first: `pg_dump -t v_dialplans fusionpbx > /root/vdialplans_backup_$(date +%Y%m%d_%H%M).csv`.

### 4. CDR webhook tenant isolation
The CDR webhook filters legs by `(pbx_ip, cdr.domain_name) → clusterId`. The mapping is read from `pbx_clusters` at request time — no restart needed. BUT verify the new `sip_domain` is spelled exactly as FusionPBX emits it in `<variables><domain_name>`. Mismatch = every CDR silently discarded with reason "domain not registered".

### 5. Extension sync, feature flags, smoke test, activate
Same as Scenario A steps 5–9. For smoke, use a seeded agent whose `clusterId` matches the new cluster row.

## Post-Onboard Verification (copy-paste)

```sql
-- Run after smoke test, expect 1 row with recording_path non-null
SELECT call_uuid, duration, billsec, recording_status, recording_path
  FROM call_logs
 WHERE cluster_id = '<new-cluster-id>'
 ORDER BY start_time DESC LIMIT 1;

-- Expect all legs with status='processed' and no 'domain not registered' errors
SELECT status, error_message, count(*)
  FROM webhook_logs
 WHERE created_at > now() - interval '10 min'
 GROUP BY 1,2;
```

## Anti-patterns

- **Creating a tenant in CRM without patching its FusionPBX OUT-ALL dialplan for recording.** Every time. Caused the 2026-04-17 miss.
- **Flipping `is_active = true` before the smoke test passes.** Leaks broken config into click-to-call for all agents.
- **Skipping the `WEBHOOK_ALLOWED_IPS` update when onboarding a new PBX host.** CDRs arrive, 403, silently dropped. Backend log shows the IP rejection but nobody reads backend logs until users complain 3 weeks later.
- **Assuming FusionPBX UI "Create Domain" handles dialplan copying.** It does not. Loopback legs go through OUT-ALL, not `user_record`, and OUT-ALL starts blank per domain.
- **Copying OUT-ALL XML from another tenant without updating `effective_caller_id_number`.** Outbound caller-ID will leak across tenants.

## Reference

- Webhook: `packages/backend/src/controllers/webhook-controller.ts`
- Cluster service: `packages/backend/src/services/cluster-service.ts`
- Active-cluster resolver (used by CDR webhook for tenant isolation): `packages/backend/src/lib/active-cluster.ts`
- Prior incidents: `plans/reports/debugger-260326-1443-recording-debug.md`, `plans/reports/debugger-260417-1836-billsec-and-recording.md`
- Related skills: `crm-pbx-cluster` (debug + semantics), `crm-db` (mutations), `crm-feature-flag`, `crm-deploy` (backend restart when env changes)

---
name: crm-pbx-cluster
description: Debug and manage CRM PBX clusters — FreeSWITCH ESL connectivity, extension sync from FusionPBX over SSH, active-cluster switching, and CDR webhook diagnostics.
version: 1.0.0
argument-hint: "[test|sync|switch|discover] [cluster-id]"
---

# CRM PBX Cluster Skill

Operate the multi-cluster VoIP layer: keep ESL healthy, sync extensions, and isolate CDR issues fast.

## When to Use

- Click-to-call is failing or returning 5xx
- Extensions show "Unknown" registration status
- CDRs are not turning into `CallLog` rows
- Switching the active cluster in a multi-tenant deployment
- Adding a new PBX cluster and syncing its extensions

## Components

| Piece | Role |
|---|---|
| ESL daemon | Persistent FreeSWITCH connection, loads active cluster on start |
| Cluster service | CRUD on `PbxCluster`, triggers daemon reload on switch |
| Extension sync service | SSH into FusionPBX host, upsert `v_extensions` into DB |
| CDR webhook | Basic-auth + IP-allowlist endpoint that parses CDR XML into `CallLog` |
| Cluster UI | Settings → Cluster Management |

## Triage Map

| Symptom | First check | Second check |
|---|---|---|
| C2C 5xx | Active cluster exists + ESL reachable | Backend log for ESL reconnect loop |
| Extensions "Unknown" | ESL daemon status | Test-connection against saved cluster |
| No CDR rows | Webhook allowlist + basic auth | FusionPBX dialplan hook |
| FusionPBX UI shows stale CDR date (all tenants) | `xml_cdr.conf.xml` → `log-http-and-disk` param | `/var/log/freeswitch/xml_cdr/` empty while CRM keeps receiving webhooks |
| Sync fails "auth" | SSH creds stored on cluster record | SSH manually to confirm password |
| Sync fails "psql" | FusionPBX user has sudo to postgres | Schema `v_extensions` visibility |
| Cluster "Tiền kiểm" badge 🔴 | Open tab, read failing check | Follow hint link (skill `crm-pbx-onboard`) |

## Switch Active Cluster

Switching triggers an ESL daemon reload and changes the default `clusterId` for new records. Existing records keep their original cluster — switches do not rewrite history.

## Discovery

Network scan endpoint exists for finding PBX hosts on a subnet. Use it instead of manual port probing, and confirm ESL reachable before creating the cluster record.

## Reference

- ESL daemon: `packages/backend/src/lib/esl-daemon.ts`
- Cluster service: `packages/backend/src/services/cluster-service.ts`
- Extension sync: `packages/backend/src/services/extension-sync-service.ts`
- UI: `packages/frontend/src/pages/settings/cluster-management.tsx`
- Architecture: `docs/system-architecture.md` → "VoIP Integration" + "Extension Sync Flow"
- Related skills: `crm-db` (CallLog inspection), `crm-deploy` (backend restart), `crm-pbx-onboard` (new PBX/domain checklist)

## Anti-patterns

- Storing ESL credentials in `.env` instead of the `PbxCluster` record
- Deleting clusters that still have linked records
- Switching active cluster on prod without testing the connection first

## CDR Leg Semantics (C2C outbound)

FusionPBX emits 3–4 CDR legs per C2C call. The webhook merges them into **one** `call_logs` row keyed by canonical UUID. Each leg reports different timing — knowing which is authoritative avoids weeks of "why is billsec wrong" debugging:

| Leg | `channel_name` | `duration` | `billsec` | `flow_billsec` | Authoritative for |
|---|---|---|---|---|---|
| Loopback-A orphan | `loopback/<dest>-a` | short | 2 | 10 | nothing — skipped |
| Loopback-B canonical | `loopback/<dest>-b` | 10–12 | 2 | 10 | `answerTime` (moment customer picked up), `startTime`, recording_path fallback |
| Gateway/trunk | `sofia/internal/<dest>` (or `sofia/external/<dest>`) | trunk-side lifetime | trunk talk | same | — |
| **Agent SIP** | `sofia/internal/<ext>@<domain>` | **ring + talk** (matches softphone) | full leg | same | **`endTime`** (real hangup), **`duration`** (softphone total), **recording path** |

**Real customer talk time** is NOT any single leg's `billsec`. Use the cross-leg formula:

```
billsec = agent.endTime − loopback-B.answerTime
```

Handle both arrival orderings: compute on whichever leg arrives second, after the canonical row has both timestamps.

## Recording Prerequisites (per FusionPBX domain)

Recording only fires if the outbound dialplan (OUT-ALL or equivalent) has these actions **before** the `bridge`:

```
set record_path=${recordings_dir}/${domain_name}/archive/${strftime(%Y)}/${strftime(%b)}/${strftime(%d)}
set record_name=${caller_id_number}_${destination_number}_${strftime(%d-%m-%Y_%H:%M:%S)}.${record_ext}
mkdir ${record_path}
set RECORD_ANSWER_REQ=true
set api_on_answer=uuid_record ${uuid} start ${record_path}/${record_name}
set sip_h_accountcode=${accountcode}
```

The `user_record` dialplan does NOT fire on loopback-B legs because `user_exists=false` for external numbers. Each new tenant domain needs this block added to its OUT-ALL `v_dialplans.dialplan_xml`, followed by:

```
rm /var/cache/fusionpbx/dialplan.<domain>
fs_cli -p ClueCon -x 'reloadxml'
```

Backup `v_dialplans` before editing: `pg_dump -t v_dialplans fusionpbx > backup_$(date +%Y%m%d_%H%M).csv`.

## FusionPBX CDR UI shows stale data (2026-04-20 incident)

**Symptom:** Tenant UI on FusionPBX (e.g. `https://<pbx>/app/xml_cdr/`) shows Call Detail Records frozen at an old date. CRM still receives webhooks, calls still ring, recordings still write `.mp3` to disk. Affects every tenant on the PBX, not just one.

**Root cause:** `/etc/freeswitch/autoload_configs/xml_cdr.conf.xml` has `<param name="log-http-and-disk" value="true"/>` commented out (default in some FusionPBX builds). mod_xml_cdr then only POSTs to the webhook URL and writes no disk XML. FusionPBX's `xml_cdr_import.php` cron (crontab: `* * * * * php /var/www/fusionpbx/app/xml_cdr/xml_cdr_import.php 300`) reads from `/var/log/freeswitch/xml_cdr/` and inserts into `v_xml_cdr` — the table the UI queries. Empty folder → no inserts → UI stays stale.

**Fix (< 1 min, no FS restart):**
```bash
sed -i 's|<!-- <param name="log-http-and-disk" value="true"/> -->|<param name="log-http-and-disk" value="true"/>|' \
  /etc/freeswitch/autoload_configs/xml_cdr.conf.xml
fs_cli -x 'reload mod_xml_cdr'
```
Verify: after next call, `ls /var/log/freeswitch/xml_cdr/` contains `<uuid>.cdr.xml` (and `a_<uuid>.cdr.xml` for A-leg when `prefix-a-leg=true`). Within 1 minute cron ingests and `v_xml_cdr` grows.

**Backfill past calls from CRM's `webhook_logs`:** CRM keeps every CDR XML the PBX POSTed (even rejected ones) in `webhook_logs.raw_payload`. Extract → write to disk → let cron ingest:

```python
# Run from CRM host (has docker exec access). Writes files to /tmp/cdr-backfill/
import subprocess, re, os, base64, sys
os.makedirs('/tmp/cdr-backfill', exist_ok=True)
# SQL: base64-encode raw_payload so each row is one line, no CSV/XML escaping headaches
q = "SELECT regexp_replace(encode(raw_payload::bytea, 'base64'), E'\\n', '', 'g') " \
    "FROM webhook_logs WHERE raw_payload LIKE '<?xml%' " \
    "AND created_at >= 'YYYY-MM-DD'::timestamp ORDER BY created_at"
p = subprocess.run(['docker','exec','crm-postgres','psql','-U','crm_user','-d','crm_db','-t','-A','-c',q],
                   capture_output=True, text=True)
for b64 in [l for l in p.stdout.split('\n') if l.strip()]:
    xml = base64.b64decode(b64).decode('utf-8', 'replace')
    # Real call UUID lives in <variables><uuid>… — NOT core-uuid= on <cdr> (that is FS switch UUID, same for every row)
    m = re.search(r'<variables>.*?<uuid>([0-9a-f-]{36})</uuid>', xml, re.DOTALL)
    if not m: continue
    d = re.search(r'<direction>(\w+)</direction>', xml)
    prefix = 'a_' if d and d.group(1) == 'inbound' else ''
    with open(f'/tmp/cdr-backfill/{prefix}{m.group(1)}.cdr.xml', 'w') as f:
        f.write(xml)
```
Then rsync to PBX: `rsync -az /tmp/cdr-backfill/ root@<pbx>:/var/log/freeswitch/xml_cdr/`. Cron drains ~300 files/min. A few percent will fail with `SQLSTATE 25P02` (aborted transaction — usually a domain_uuid FK for a now-deleted domain); cron catches + moves on.

**Safety:**
- mod_xml_cdr disk files are throw-away — once `xml_cdr_import.php` inserts them they get deleted. Rsync is idempotent until ingest.
- Backup config before edit: `cp xml_cdr.conf.xml xml_cdr.conf.xml.bak-$(date +%Y%m%d)`.
- Recordings are written by `record_session` (dialplan), unaffected by this toggle. CRM `call_logs` is populated by the webhook POST, also unaffected.

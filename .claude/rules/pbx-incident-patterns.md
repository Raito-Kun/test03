# PBX Incident Patterns

Recurring FusionPBX/CDR/recording gotchas. When a symptom here matches, jump straight to the referenced skill — these have burned hours of debugging each.

## Symptom → Skill map

| Symptom | Likely cause | Skill |
|---|---|---|
| CRM UI shows mic icon but audio download 404, recordings silent | OUT-ALL dialplan sets `record_path` but `uuid_record start` fails (condition gate, wrong leg, bypass_media) | `crm-pbx-cluster` → "Recording Prerequisites" |
| Some tenants' outbound calls never record, others fine on same PBX | OUT-ALL dialplan missing recording actions for the broken domain (per-domain, NOT inherited from FusionPBX template) | `crm-pbx-onboard` Scenario B step 3 |
| FusionPBX tenant UI's CDR page stuck at an old date, CRM keeps logging calls | `log-http-and-disk=true` commented in `xml_cdr.conf.xml` — mod_xml_cdr writes no disk XML → cron can't populate `v_xml_cdr` | `crm-pbx-cluster` → "FusionPBX CDR UI shows stale data" |
| CDR webhooks rejected with "domain X not registered for PBX Y" | Domain on PBX has no matching `PbxCluster.sip_domain` in CRM DB; or CRM cluster record's `sip_domain` typo'd | `crm-pbx-cluster` triage + `crm-db` to inspect `pbx_clusters` |
| `billsec=0` on answered calls | Cross-leg merge happened on wrong leg; `answerTime` not set on canonical row | `crm-pbx-cluster` → "CDR Leg Semantics" |
| Clock/timezone looks wrong on PBX vs CRM | Almost always not the actual cause — check v_xml_cdr row count first (stale data masquerades as clock drift) | Same row — verify with `date` + `timedatectl status` on both hosts before touching NTP |

## Hard rules

- **Never edit FusionPBX `v_dialplans.dialplan_xml` without** `pg_dump -t v_dialplans fusionpbx > backup_$(date +%Y%m%d_%H%M).csv` first.
- **Never edit `/etc/freeswitch/autoload_configs/*.xml` without** `cp <file> <file>.bak-$(date +%Y%m%d)` first; apply with `fs_cli -x 'reload mod_<name>'` (not a full FS restart).
- **Verify CDR disk logging on every new PBX host**: `grep -q 'log-http-and-disk.*true' /etc/freeswitch/autoload_configs/xml_cdr.conf.xml || echo DISK-LOGGING-OFF`.
- **Recording troubleshooting starts with file listing, not dialplan editing**: `find /var/lib/freeswitch/recordings/<domain>/archive/<YYYY>/<Mon>/<dd>/ -name '*.mp3' | wc -l` tells you if the issue is "no files" vs "0-byte files" vs "files fine, UI broken" — each has a different fix path.
- **Backfill CDR from CRM when PBX `v_xml_cdr` has gaps**: CRM's `webhook_logs.raw_payload` is the source of truth. Recipe in `crm-pbx-cluster` skill.

## Known incident log (latest first)

- **2026-04-20** — `xml_cdr.conf.xml` `log-http-and-disk` commented on `10.10.101.206`. All tenants' FusionPBX CDR UI stuck at 2026-04-17. Fix: uncomment + `reload mod_xml_cdr`. Backfilled ~4800 calls from CRM `webhook_logs` to `/var/log/freeswitch/xml_cdr/`; cron ingested.
- **2026-04-17** — `blueva` domain on `10.10.101.206` had OUT-ALL without recording actions. All outbound C2C recording silently missing for weeks.
- **2026-03-26** — `crm` domain OUT-ALL had no recording; `user_record` dialplan doesn't fire on loopback-B legs for external destinations.

Pattern across all: **FusionPBX UI/template workflows do not copy recording-related config between domains or across version upgrades.** Verify every such config after any tenant change, FusionPBX upgrade, or reported "recording missing" ticket.

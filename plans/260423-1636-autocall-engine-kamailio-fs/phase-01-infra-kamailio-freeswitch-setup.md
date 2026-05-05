---
phase: 01
title: "Infra: Kamailio + FreeSWITCH setup"
size: L
status: pending
---

# Phase 01 — Infra: Kamailio + FreeSWITCH Cluster

## Context
- Research: [researcher-01](research/researcher-01-kamailio-architecture.md), [researcher-02](research/researcher-02-freeswitch-progressive-cdr.md)
- Rules: `.claude/rules/pbx-incident-patterns.md` (CDR disk logging, chown gotchas)

## Overview
- Priority: P2 (blocks all runtime phases)
- Status: pending
- Provision 3 VMs in dev: 1 Kamailio edge, 2 FreeSWITCH nodes. Base configs, carrier trunk registered, OPTIONS ping health-check working, one manual test call end-to-end (Kamailio → FS-01 → carrier → real phone).

## Key Insights
- Kamailio handles agent REGISTER + dispatcher; FS never sees agents directly except via bridged leg.
- rtpengine co-resident with Kamailio; no TURN needed.
- `log-http-and-disk=true` MUST be set in `xml_cdr.conf.xml` on both FS nodes (2026-04-20 incident).
- Recording dir owner MUST stay `www-data:www-data` after any rsync (2026-04-20 part 2 incident).
- **Infra subnet LOCKED: shared `10.10.101.x`** with existing FusionPBX (.206/.207/.208). No new subnet. Assign: Kamailio `10.10.101.210`, FS-1 `10.10.101.211`, FS-2 `10.10.101.212` — verify no conflict with existing DHCP/static pool before provisioning; adjust if taken.
- **Recording format LOCKED: stereo** — agent LEFT, customer RIGHT. Set `RECORD_STEREO=true` globally and `RECORD_SOFTWARE` filename templated with `-stereo.{wav,mp3}` suffix. QA: mute one channel to isolate noise source.
- **Carrier whitelist:** NEW source IPs (.211, .212) must be added to carrier allow-list BEFORE first originate attempt. Existing FusionPBX IPs (.206/.208) remain unchanged.

## Requirements
**Functional**
- Agent can REGISTER to Kamailio via MicroSIP with digest auth.
- Dispatcher round-robins INVITEs between FS-01 and FS-02, fails over on OPTIONS timeout.
- FS can originate to carrier trunk with digest auth, hear ringback, bridge audio both ways via rtpengine.
- Both FS nodes POST xml_cdr to CRM `/api/v1/webhooks/cdr` on hangup.

**Non-functional**
- 300 CCU headroom (target 150/FS, 50% utilization at peak).
- OPTIONS ping every 30s, auto-failover <5s.
- Recording I/O on local SSD, not NFS.

## Architecture
```
[agents]──UDP/5060──▶[Kamailio 10.10.101.210]──┬──▶[FS-01 10.10.101.211]──▶[carrier trunk]
                           │ rtpengine :30000-40000 └──▶[FS-02 10.10.101.212]──▶
                           │
                           └──Postgres(kamailio DB on same host)
```
Shares subnet with existing FusionPBX (`10.10.101.206/.207/.208`). No new VLAN.

## Related Code Files
**Create**
- `infra/autocall/kamailio/kamailio.cfg` (main)
- `infra/autocall/kamailio/routes/register.cfg`, `routes/dispatch.cfg`, `routes/nat.cfg`
- `infra/autocall/kamailio/dispatcher.list`
- `infra/autocall/kamailio/kamailio-postgres.sql` (schema import)
- `infra/autocall/freeswitch/autoload_configs/xml_cdr.conf.xml`
- `infra/autocall/freeswitch/autoload_configs/event_socket.conf.xml`
- `infra/autocall/freeswitch/sip_profiles/internal.xml`
- `infra/autocall/freeswitch/sip_profiles/external.xml`
- `infra/autocall/freeswitch/dialplan/autocall.xml`
- `infra/autocall/freeswitch/vars.xml`
- `infra/autocall/deploy/provision-kamailio.sh`
- `infra/autocall/deploy/provision-freeswitch.sh`
- `infra/autocall/README.md` (runbook: install, upgrade, troubleshoot)

**Modify**: none (no CRM code touched this phase).

## Implementation Steps
1. Provision 3 Ubuntu 22.04 VMs in dev (1 Kamailio, 2 FS). Static IPs `10.10.101.210/.211/.212` (verify unused vs DHCP/existing allocations first; adjust +1 if taken).
2. Install Kamailio 5.8+ with modules: `dispatcher, usrloc, registrar, auth_db, rtpengine, pike, pipelimit, permissions, jsonrpcs, htable`.
3. Install rtpengine on Kamailio host. Open UDP 30000-40000.
4. Import `kamailio-postgres.sql` to local Postgres. Create `subscriber` + `location` tables.
5. Write `kamailio.cfg` skeleton (<250 lines, split into `routes/*.cfg`). Copy patterns from researcher-01.
6. Write `dispatcher.list` with two FS entries, setid=1, weight=1. Enable `ds_probing_mode=1`.
7. Install FreeSWITCH 1.10+ on each FS node. Modules: `mod_sofia, mod_xml_cdr, mod_esl, mod_dptools`.
8. Configure `internal` profile on FS bound to Kamailio-facing IP. ACL allow only Kamailio source IP.
9. Configure `external` profile with carrier gateway (digest auth, src-IP allow-listed by carrier).
10. Configure `xml_cdr.conf.xml` → url=`http://<crm-dev-host>/api/v1/webhooks/cdr`, `log-http-and-disk=true`. Verify with `grep`.
11. Configure `event_socket.conf.xml` password (per-cluster, stored in CRM DB phase 02).
12. Create recording dir `/var/lib/freeswitch/recordings/autocall` owner `www-data:www-data`. Set channel vars for stereo recording in `vars.xml`: `RECORD_STEREO=true`, `RECORD_CHANNELS=2`, filename template suffixed `-stereo`. Confirm mp3 stereo encode works (`mod_shout` or `mod_sndfile` with `.wav`).
13. Manual test: `kamctl add 1001 testpass`, register MicroSIP, dial carrier test number, verify audio + recording + CDR POST.
14. Write `README.md` runbook with install/upgrade/troubleshoot commands including `fs_cli -x 'reload mod_xml_cdr'` and chown reminder.
15. Add `fail2ban` filter for Kamailio auth failures.

## Todo List
- [ ] Provision 3 VMs
- [ ] Install Kamailio + rtpengine
- [ ] Install Postgres (reuse CRM DB host or local)
- [ ] Write kamailio.cfg + routes/*.cfg + dispatcher.list
- [ ] Install FS on both nodes
- [ ] Configure SIP profiles + ACL
- [ ] Configure xml_cdr (log-http-and-disk=true verified)
- [ ] Configure ESL
- [ ] Create recording dir with correct owner
- [ ] End-to-end test call
- [ ] Runbook doc
- [ ] fail2ban

## Success Criteria
- MicroSIP registers to Kamailio, shows `Registered` via `kamctl ul show`.
- `kamctl dispatcher list` shows both FS with state `AP` (active+probing).
- Stop FS-01 → dispatcher auto-marks inactive <10s → INVITE still completes via FS-02.
- Originate via `fs_cli -x 'originate sofia/gateway/<name>/<test-number> &echo()'` connects + audio works.
- CDR XML lands at CRM webhook endpoint (verify via `webhook_logs` table).
- Recording file appears at correct path, owner `www-data:www-data`, playable.

## Risk Assessment
| Risk | Impact | Mitigation |
|---|---|---|
| rtpengine port range conflict | no audio | dedicated 30000-40000, documented firewall rule |
| Carrier refuses IP | no outbound | submit NEW source IPs `10.10.101.211/.212` to carrier allow-list BEFORE install (existing `.206/.208` unaffected) |
| FS disk fills with recordings | outage | retention cron + alert at 80% disk |
| Postgres shared with CRM gets noisy neighbour | CRM slowness | dedicated Kamailio Postgres DB or separate instance |

## Security
- SIP on UDP 5060 open only to agent office CIDR + carrier IPs.
- ESL 8021 bound to loopback + autocall-engine internal IP only.
- Kamailio digest passwords stored hashed (`ha1`) in `subscriber` table.

## Next Steps
Unblocks: phase-03 (engine needs ESL endpoints), phase-05 (orchestrator needs working cluster), phase-06 (CDR webhook needs real FS posting).

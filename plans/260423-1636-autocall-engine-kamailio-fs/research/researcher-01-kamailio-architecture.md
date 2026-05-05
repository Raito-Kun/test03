---
title: "Kamailio Architecture for Autocall Dialer + Agent Registrar"
topic: kamailio-outbound-dialer
audience: planner
created: 2026-04-23
---

# Researcher 01 — Kamailio Architecture

## Scope
Dedicated Kamailio cluster fronting 2x FreeSWITCH for autocall. 20-50 agents via MicroSIP, single upstream carrier trunk, 100-300 CCU.

## Topology

```
 [MicroSIP agents]──UDP/5060──▶ [Kamailio edge] ──┬──▶ [FS-01]
                                                  └──▶ [FS-02]
                                     │
                                     └──▶ [Carrier SIP trunk] (digest auth, src-IP pinned)
                                     │
                              [rtpengine] (media relay / NAT anchor)
```

- **Kamailio** = SIP registrar + dispatcher + auth gateway.
- **FreeSWITCH 2x** = dialplan/recording/ESL endpoints, behind Kamailio dispatcher (active-active, health-pinged via OPTIONS).
- **rtpengine** = media anchor. Agents are behind office NAT; rtpengine relays RTP so Kamailio/FS never see NAT issues.
- **Carrier trunk** = single gateway (defined in FS `sofia`/`external` profile). Kamailio does NOT talk to carrier directly — FS handles carrier auth so autocall-engine can use FS channel variables for per-call caller-ID.

## Modules Required

| Module | Purpose |
|---|---|
| `tm`, `sl`, `rr`, `path`, `textops` | baseline transaction + record-route |
| `auth`, `auth_db`, `usrloc`, `registrar` | agent SIP REGISTER + digest auth |
| `dispatcher` | LB + failover across FS-01/FS-02 |
| `rtpengine` | media anchor / NAT handling |
| `pike`, `pipelimit` | rate limiting (per-IP flood, per-trunk CPS) |
| `acc`, `acc_db` | optional: SIP-level accounting (FS CDR is primary) |
| `permissions` | ACL for carrier source IP |
| `htable`, `cfgutils` | in-memory counters, runtime flags |
| `jsonrpcs`, `kex`, `ctl` | kamctl / kamcmd runtime control |

Storage backend for `location` + `subscribers`: **Postgres** (reuse existing CRM Postgres host or a dedicated DB on Kamailio box). Small dataset (<100 rows), Postgres preferred over dbtext for consistency with monorepo ops.

## Key Config Snippets

### dispatcher.list
```
# setid destination  flags priorities attrs
1 sip:10.10.102.11:5060 0 50 weight=1;ping_from=sip:kamailio@autocall
1 sip:10.10.102.12:5060 0 50 weight=1;ping_from=sip:kamailio@autocall
```
- `ds_probing_mode=1` → send OPTIONS every 30s. Auto-disable dead nodes.
- Algorithm `ds_select_dst(1, 4)` = round-robin with state awareness.

### Request routing skeleton
```
# REGISTER from agent → auth + save location
if (is_method("REGISTER")) {
    if (!www_authenticate("$td", "subscriber")) { www_challenge(...); exit; }
    save("location");
    exit;
}

# INVITE from agent → dispatch to FS
if (is_method("INVITE") && from_agent()) {
    rtpengine_manage();
    ds_select_dst("1", "4");   # round-robin FS pool
    t_on_failure("ds_failover");
    t_relay();
    exit;
}

# INVITE from FS → agent → lookup location, relay
if (src_ip_in_fs_pool()) {
    lookup("location");
    rtpengine_manage();
    t_relay();
}
```

### Rate limit (pipelimit)
```
modparam("pipelimit", "db_url", "")
# 20 calls/sec per FS node to protect carrier CPS
if (!pl_check("fs_pool", "TAILDROP", 20)) { send_reply("503","slow down"); exit; }
```

## Capacity Assessment

- 1 Kamailio node handles **thousands of CCU** on modest hardware (2 vCPU, 4 GB RAM). 300 CCU autocall is <5% of single-node capacity. No need for Kamailio HA at MVP — single node, documented failover runbook.
- Registrations: 50 agents re-register every 300s → ~0.2 req/s. Trivial.
- OPTIONS pings to FS nodes: 2 nodes × 1 every 30s = negligible.

**Bottleneck will be FS recording I/O, not Kamailio.**

## NAT Handling

- Agents behind office router: Kamailio `force_rport()` + `fix_nated_contact()` on REGISTER.
- rtpengine on same host as Kamailio. Set `rtpengine_manage()` on every INVITE + re-INVITE.
- No TURN needed (no WebRTC).

## Security

| Concern | Mitigation |
|---|---|
| Brute-force REGISTER | `pike` module: ≥10 failed auths/60s → ban IP 10 min via `htable` |
| Toll fraud from stolen agent cred | agent accounts can ONLY dial via FS-originated legs (INVITE from agent with To ≠ FS is 403). Autocall engine places calls via ESL to FS, which bridges agent leg. |
| Carrier source-IP spoof | `permissions` module allow-list; drop if src_ip not in carrier range |
| Unencrypted SIP | TLS not required for MVP (agents on LAN/VPN). Plan for 5061/TLS in phase 2 if agents go remote. |

## Deliverables for Infra Phase
- `kamailio.cfg` skeleton (~250 lines, split into included `routes/*.cfg` files)
- `dispatcher.list` with 2 FS entries
- Postgres DDL for `subscriber`, `location`, `version` tables (Kamailio-provided scripts)
- systemd unit + log rotation
- `fail2ban` filter for Kamailio auth failures

## Unresolved
- Who owns subscriber provisioning UI? (CRM admin creates agent → auto-INSERT into kamailio.subscriber via CRM backend? Or manual `kamctl add`?) — recommend CRM-driven via a small provisioning service in phase 3.
- rtpengine port range sizing: 100-300 CCU × 4 ports = 1200 UDP ports. Open `30000-40000` on firewall.

## Sources
- [Kamailio Dispatcher Module](https://kamailio.org/docs/modules/4.3.x/modules/dispatcher.html)
- [dOpenSource: Load balancing traffic with Kamailio](https://dopensource.com/2014/12/17/load-balancing-traffic-with-kamailio-v4-1/)
- [Nick vs Networking: Kamailio Dispatcher](https://nickvsnetworking.com/kamailio-dispatcher/)
- [GitHub os11k/dispatcher example config](https://github.com/os11k/dispatcher)
- [Medium Day 8: Load Balancing SIP Calls with Kamailio Dispatcher](https://medium.com/@srivastava.vikash/day-8-load-balancing-sip-calls-with-kamailio-dispatcher-2fa2bee922a5)

---
phase: 07
title: "Frontend: campaign management + lead upload"
size: M
status: pending
---

# Phase 07 — Frontend Campaign Management

## Context
- Rules: `.claude/skills/crm-frontend-page/SKILL.md`
- Backend: phase 03 endpoints

## Overview
- Priority: P2
- Status: pending
- Pages: campaign list, campaign detail/edit, lead CSV upload, disposition configurator, DNC list manager, **agent SIP credentials admin panel** (decision #1). All under `/autocall/*`, feature-gated + permission-gated.

## Key Insights
- Reuse existing table/list patterns from `campaigns`, `contacts`, `leads` pages. No design-from-scratch.
- CSV upload progress via existing file-upload component; if none, build minimal one (≤150 lines).
- Disposition configurator per campaign — drag-reorder list of `{ code, label, isSuccess }`.

## Requirements
**Functional**
- `/autocall` — landing with list of campaigns (status, active calls, contact rate).
- `/autocall/campaigns/new` + `/autocall/campaigns/:id/edit` — form (name, dialer mode (progressive only for MVP), timezone, window start/end hours, max attempts, retry cooldown, trunk gateway, caller ID). **No holiday/weekend fields** (decision #3).
- `/autocall/campaigns/:id` — detail: lead table, disposition config, upload CSV, start/pause toggle.
- `/autocall/dnc` — list, add, remove, bulk import.
- `/autocall/admin/agent-sip` — **agent SIP credentials panel** (decision #1). Lists users with `autocall.agent.work` permission, their Kamailio username + domain, "Show password (once)" on creation, "Regenerate" button (rotates + shows new plaintext once). Copy-to-clipboard helper for MicroSIP paste. Permission gate: `autocall.campaigns.write` (admin-only).

**Non-functional**
- Every route wrapped in `<FeatureGuard feature="autocall">`.
- Every button/menu wrapped in `hasPermission` check.
- i18n: Vietnamese labels (project standard).

## Architecture

```
packages/frontend/src/pages/autocall/
├── AutocallIndexPage.tsx                # list + new
├── AutocallCampaignDetailPage.tsx
├── AutocallCampaignFormPage.tsx
├── AutocallDncPage.tsx
├── AutocallAgentSipAdminPage.tsx        # decision #1: admin-only SIP creds panel
└── components/
    ├── CampaignTable.tsx
    ├── CampaignForm.tsx
    ├── LeadUploadCard.tsx
    ├── LeadTable.tsx
    ├── DispositionConfigurator.tsx
    ├── DncManager.tsx
    └── AgentSipCredsTable.tsx           # username, domain, "Regenerate" button, one-time password modal

packages/frontend/src/services/
└── autocall-api.ts                      # typed fetch wrappers

packages/frontend/src/hooks/
└── use-autocall-campaigns.ts            # React Query hooks
```

Each component/page ≤200 lines.

## Related Code Files
**Create**: all listed above.

**Modify**
- `packages/frontend/src/app.tsx` (or router) — add `/autocall/*` routes under feature guard.
- Sidebar/nav component — add "Autocall" entry with `featureKey="autocall"`.
- Permission matrix UI — new keys auto-appear once seeded (phase 02).

## Implementation Steps
1. `autocall-api.ts` — typed wrappers for all endpoints from phase 03.
2. React Query hooks per entity: `useCampaigns`, `useCampaign(id)`, `useLeads(campaignId)`, `useDispositions(campaignId)`, `useDnc`, mutations for each.
3. `AutocallIndexPage` — table, new button.
4. `CampaignForm` — controlled form with Zod validation mirroring backend.
5. `LeadUploadCard` — drag-drop CSV, progress bar, result toast `{imported, skipped, duplicates}`.
6. `DispositionConfigurator` — list with add/remove/reorder + isSuccess toggle.
7. `DncManager` — filterable table + add modal + CSV bulk import (same pattern as leads).
8. `AutocallAgentSipAdminPage` + `AgentSipCredsTable` — list agents with perm, show username/domain, "Regenerate" button → calls `POST /api/v1/autocall/admin/agent-sip-creds/:userId/regenerate`, shows plaintext in one-time modal with copy-to-clipboard + "I copied it" checkbox before close.
9. Router: wrap all routes in `<FeatureGuard feature="autocall"><PermissionGuard .../></FeatureGuard>`.
10. Sidebar entry.

## Todo List
- [ ] API client
- [ ] React Query hooks
- [ ] Campaign list + form (no holiday fields)
- [ ] Detail page
- [ ] Lead upload
- [ ] Disposition configurator
- [ ] DNC manager
- [ ] Agent SIP creds admin panel + one-time password modal
- [ ] Router + feature guards
- [ ] Sidebar
- [ ] Compile + lint

## Success Criteria
- Super-admin can create campaign, upload 1000 leads, add dispositions, add DNC entries.
- Feature flag OFF → sidebar entry hides, direct URL redirects to 404/home.
- Agent role sees no menu entry (including agent SIP admin).
- Admin grants `autocall.agent.work` to user → agent SIP creds panel shows the new user with a regenerate button → click shows one-time plaintext password; user pastes into MicroSIP and registers successfully to Kamailio.

## Risk Assessment
- CSV format ambiguity: require header row with fixed names (`phone`, `full_name`, `priority?`, `metadata?`). Reject on missing.
- Large lead list (100k+) render: paginate server-side 50/page.

## Security
- All file uploads pass content-type + size checks.
- No phone numbers in URL params.

## Next Steps
Unblocks phase 08 (agent workstation consumes same API + hooks), phase 09 (monitor reads campaigns list).

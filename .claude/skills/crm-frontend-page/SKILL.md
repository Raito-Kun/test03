---
name: crm-frontend-page
description: Scaffold a new CRM frontend page or feature module using React + Vite + Zustand + TanStack Query + shadcn/ui + Tailwind, with Vietnamese labels, FeatureGuard wrapping, and sidebar registration.
version: 1.0.0
argument-hint: "[feature-name]"
---

# CRM Frontend Page Skill

Produce new pages and feature modules that slot into the existing navigation, styling, and data-fetching conventions.

## When to Use

- Adding a listing, detail, or form page for a new entity
- Adding a secondary view under an existing module
- Registering a sidebar item gated by a feature flag
- Wiring real-time updates into an existing page

## Pattern

```
packages/frontend/src/
├── pages/<feature>/
│   ├── <feature>-list.tsx
│   ├── <feature>-detail.tsx
│   └── <feature>-form.tsx
├── components/<feature>/     # feature-local reusable parts (optional)
├── hooks/api/use-<feature>.ts
└── app.tsx                    # register routes
```

Pages are thin; reusable pieces move into `components/`. All fetching goes through `services/api-client.ts` so JWT refresh works uniformly.

## Conventions

| Concern | Rule |
|---|---|
| Server state | TanStack Query, never Zustand |
| Client/UI state | Zustand store when cross-page, else local |
| Language | All user-visible strings Vietnamese |
| Gating | Wrap routes in `<FeatureGuard feature="...">` |
| Sidebar | Add item with `featureKey` so hide-on-disabled works |
| Errors | Toast via shared toast component; surface `error.message` |
| Responsiveness | Tailwind `sm:`/`md:`/`lg:` for mobile coverage |

## Copy-From

Representative pages to study before scaffolding:
- `pages/contacts/` — full CRUD, import wizard, merge
- `pages/leads/` — status pipeline, scoring UI
- `pages/reports/` — multi-tab layout, shared filters

## Real-time Wiring

Subscribe to relevant events through `hooks/use-socket.ts` and invalidate the TanStack Query cache on update. Do not mutate store state imperatively from a socket handler.

## Reference

- Sidebar groups + labels: `packages/frontend/src/components/sidebar.tsx`
- Feature flag hook: `packages/frontend/src/hooks/use-feature-flags.ts`
- Shared UI: `packages/frontend/src/components/ui/`
- Related skills: `crm-backend-feature`, `crm-feature-flag`, `crm-test`

## Anti-patterns

- Hardcoded English strings in user-visible spots
- Raw `axios` calls that bypass `api-client`
- New form libraries when existing pages use controlled state
- New "enhanced" page variants instead of editing in place

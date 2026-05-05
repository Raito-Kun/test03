---
name: crm-feature-flag
description: Manage CRM feature flags at cluster and domain level. Use to gate routes, hide menu items, and toggle major capabilities on or off for a tenant.
version: 1.0.0
argument-hint: "[enable|disable|add-key] [feature-key]"
---

# CRM Feature Flag Skill

Add, toggle, and wire feature flags through the `ClusterFeatureFlag` system that controls tenant-visible capabilities.

## When to Use

- Introducing a new gated capability
- Enabling or disabling a capability for a specific cluster or domain
- Adding route + sidebar protection for a new feature
- Debugging why a feature appears disabled for a user

## Hierarchy

- **Cluster-level** flag (empty `domain_name`) is the master switch
- **Domain-level** flag can only override when cluster-level is enabled
- A disabled cluster-level flag shadows any domain-level enable
- `super_admin` bypasses all flag checks

## Wiring a New Flag

1. Register the key in backend feature-flag service + frontend type union
2. Seed default state for existing clusters (usually enabled)
3. Protect backend route with `checkFeatureEnabled('<key>')`
4. Wrap frontend route with `<FeatureGuard feature="<key>">`
5. Add sidebar entry with matching `featureKey` so it hides when disabled

## Toggle Paths

| Situation | Path |
|---|---|
| Normal admin work | Settings → Feature Flags (super_admin only) |
| Scripted bulk change | `PUT /api/v1/feature-flags` (super_admin token) |
| Emergency | Direct SQL upsert into `cluster_feature_flags` |

Always prefer the UI or API over direct SQL.

## Key Groups

CRM, VoIP, Monitoring, Reports, AI, Admin — see backend feature-flag service for the authoritative list. Pick a key that fits an existing group; avoid scattering flags.

## Permission vs Role vs Feature Flag

| Concept | Scope |
|---|---|
| Role | Coarse — an entire surface is admin-only |
| Permission | Fine-grained, per-role, configurable via matrix UI |
| Feature flag | Tenant/domain-level on/off for a whole capability |

Use all three in combination, not as substitutes.

## Reference

- Middleware: `packages/backend/src/middleware/feature-flag-middleware.ts`
- Service: `packages/backend/src/services/feature-flag-service.ts`
- Frontend hook: `packages/frontend/src/hooks/use-feature-flags.ts`
- Schema model: `ClusterFeatureFlag` in `schema.prisma`
- Related skills: `crm-permission`, `crm-backend-feature`

## Anti-patterns

- Checking `is_enabled` directly in business logic instead of using middleware
- Deleting flag rows to disable — set `is_enabled = false` to preserve audit
- Reusing one key for unrelated capabilities
- Adding a flag without a default seed for existing clusters

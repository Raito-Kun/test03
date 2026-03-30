# Phase 13: Extension Mapping Config

## Context Links
- ESL service: `packages/backend/src/services/esl-service.ts`
- ESL daemon: `packages/backend/src/lib/esl-daemon.ts`
- User model: `packages/backend/prisma/schema.prisma` (User.sipExtension)
- Settings page: `packages/frontend/src/pages/settings/settings-page.tsx`

## Overview
- **Priority**: P2
- **Status**: pending
- **Description**: Build extension management page under Settings allowing super_admin/admin to view all extensions, their assigned agents, SIP registration status, and reassign extensions.

## Key Insights
- `User.sipExtension` already exists as nullable string field
- ESL service already has `sendBgapi()` helper for FreeSWITCH commands
- `sofia status profile internal reg` returns registration table text -- needs parsing
- Current Settings page lets individual users set their own extension -- admin page manages all

## Requirements

### Functional
- Table view: Extension | Agent Name | Agent Email | SIP Domain | Registration Status
- Super admin/admin can reassign extension to a different agent (dropdown of active users)
- Super admin/admin can clear an extension assignment
- Registration status from FreeSWITCH: "Registered" / "Unregistered" / "Unknown" (if ESL unavailable)
- API: `GET /api/v1/extensions` and `PUT /api/v1/extensions/:ext/assign`

### Non-Functional
- ESL query timeout: 5s max
- If ESL unavailable, still show extension list from DB (status = "Unknown")

## Architecture

### GET /api/v1/extensions Response
```json
{
  "data": [
    {
      "extension": "1001",
      "userId": "uuid",
      "userName": "Admin User",
      "userEmail": "admin@crm.local",
      "sipDomain": "crm",
      "registrationStatus": "Registered"
    }
  ]
}
```

Data source: JOIN users WHERE sipExtension IS NOT NULL, then cross-reference with FreeSWITCH registration data.

### PUT /api/v1/extensions/:ext/assign
```json
{ "userId": "uuid-of-new-agent" }  // or { "userId": null } to unassign
```
Updates `User.sipExtension`. If another user had that extension, clears theirs first.

### FreeSWITCH Registration Parsing
`sofia status profile internal reg` output format:
```
Call-ID|User|Contact|Agent|Status|Ping-Status|...
xxx|1001@crm|...|...|Registered(UDP)|...
```
Parse each row, extract user (extension@domain) and status.

## Related Code Files

### Files to Create
| File | Purpose |
|------|---------|
| `packages/backend/src/services/extension-service.ts` | List extensions, parse ESL reg status, assign/unassign |
| `packages/backend/src/controllers/extension-controller.ts` | API handlers |
| `packages/backend/src/routes/extension-routes.ts` | Route definitions |
| `packages/frontend/src/pages/settings/extension-config.tsx` | Extension mapping UI |

### Files to Modify
| File | Change |
|------|--------|
| `packages/backend/src/services/esl-service.ts` | Add `getSofiaRegistrations(): Promise<Map<string, string>>` to query + parse reg status |
| `packages/backend/src/index.ts` | Register extension routes |
| `packages/frontend/src/app.tsx` | Add route `/settings/extensions` |
| `packages/frontend/src/pages/settings/settings-page.tsx` | Add navigation link to Extension Config (admin/super_admin only) |
| `packages/frontend/src/components/layout/sidebar.tsx` | No change (accessed via Settings sub-page) |

## Implementation Steps

### Step 1: ESL Service - Registration Query
1. Add to `esl-service.ts`:
   ```typescript
   export async function getSofiaRegistrations(): Promise<Map<string, string>> {
     // Returns Map<extension, status> e.g. Map { "1001" => "Registered", "1002" => "Unregistered" }
   }
   ```
2. Use `sendApi('sofia status profile internal reg')` (synchronous API, not bgapi)
3. Add a new `sendApi()` helper that returns the response body (unlike bgapi which is fire-and-forget)
4. Parse the pipe-delimited output: split by newline, then by `|`, extract extension from User field, Status field
5. On ESL error/timeout, return empty Map (UI shows "Unknown")

### Step 2: Extension Service
1. Create `extension-service.ts`:
   - `listExtensions()`: Query all users with sipExtension, merge with ESL registration data
   - `assignExtension(extension: string, userId: string | null)`: Update user.sipExtension, handle conflicts
2. For `assignExtension`:
   - If userId provided: clear sipExtension from any user who currently has it, then set it on target user
   - If userId null: clear sipExtension from user who has it
   - Validate extension format (digits only, 3-6 chars)

### Step 3: Controller + Routes
1. Create extension controller: `list` and `assign` handlers
2. Create extension routes:
   - `GET /` -- `requireRole('admin', 'super_admin')`
   - `PUT /:ext/assign` -- `requireRole('admin', 'super_admin')`
3. Register in `index.ts`: `app.use('/api/v1/extensions', extensionRoutes)`

### Step 4: Frontend - Extension Config Page
1. Create `extension-config.tsx`:
   - `useQuery` to fetch `GET /api/v1/extensions`
   - Table with columns: Extension, Agent (with avatar/name), Email, Domain, Status (badge)
   - Status badges: green = Registered, red = Unregistered, gray = Unknown
   - Each row has "Reassign" button -> opens dropdown/dialog with user list
   - "Unassign" button to clear
2. Use shadcn `Table`, `Badge`, `Select`, `Dialog` components

### Step 5: Settings Integration
1. Add link/tab in settings-page.tsx for admin/super_admin: "Cau hinh may nhanh"
2. Add route in app.tsx: `/settings/extensions` -> `ExtensionConfig`

## Todo List
- [ ] Add `sendApi()` helper to esl-service.ts
- [ ] Add `getSofiaRegistrations()` to esl-service.ts
- [ ] Create extension-service.ts
- [ ] Create extension-controller.ts
- [ ] Create extension-routes.ts
- [ ] Register routes in index.ts
- [ ] Create extension-config.tsx UI
- [ ] Add route in app.tsx
- [ ] Add link in settings-page.tsx
- [ ] Test with ESL connected
- [ ] Test with ESL disconnected (graceful fallback)

## Success Criteria
- Admin/super_admin can see all extensions with registration status
- Can reassign extension from one agent to another
- If ESL is down, page still loads with "Unknown" status
- Extension reassignment updates DB immediately

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|-----------|
| ESL connection timeout blocks API | Medium | 5s timeout, fallback to empty reg data |
| Two users assigned same extension | Medium | Transaction: clear old assignment before setting new |
| FreeSWITCH output format varies by version | Low | Flexible parser, log unparseable lines |

## Security Considerations
- Only admin/super_admin can view/modify extensions
- Extension value validated: digits only, 3-6 chars
- ESL commands use existing sanitization from esl-service.ts

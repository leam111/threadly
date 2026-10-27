# Spec coverage

This table shows, for each part of the spec (sections 4.1 to 4.4, the data model and the stack),
what is built today. Paths start from `api/`.

- **Done**: built and working.
- **Later**: not built yet, planned for a later phase.
- **Deliberate difference**: built in another way than the spec, on purpose.

## 4.1 Accounts and login

| Spec part | State | Where |
|-----------|-------|-------|
| Register | Done | `routes/auth.ts`, `controllers/authController.ts`, `services/authService.ts`, `dtos/authDto.ts` |
| Login (one message for every failure) | Done | `services/authService.ts` |
| Logout | Done | `services/authService.ts`, `controllers/authController.ts` |
| Refresh | Done | `services/authService.ts` |
| Change password (logs out every device) | Done | `services/authService.ts` |
| Revoke other sessions (`/auth/logout-others`) | Done | `services/authService.ts`, `repositories/refreshTokenRepository.ts` |
| Deactivate my account | Done | `services/authService.ts` |
| Admin switches a user on or off | Done | `routes/admin.ts`, `services/adminService.ts` |
| Rate limiting | Done | `middleware/rateLimiters.ts` |
| Access token: JWT, 15 minutes | Done | `services/authService.ts` |
| Refresh token: 7 days, httpOnly cookie, stored only as a hash | Done | `utils/tokens.ts`, `controllers/authController.ts`, `models/RefreshTokens.ts` |
| Rotation (each refresh gives a new token) | Done | `services/authService.ts` |
| Reuse detection (an old token cancels its whole family) | Done | `services/authService.ts` |

## 4.2 Roles and permissions

| Spec part | State | Where |
|-----------|-------|-------|
| Access based on permissions, checked on every request | Done | `middleware/requirePermission.ts`, `repositories/roleRepository.ts` |
| The 16 permissions | Done | `utils/permissions.ts`, `migrations/003-roles-and-permissions.ts` |
| Role matrix (member 7, moderator 10, admin 14, superadmin 16) | Done | `migrations/003-roles-and-permissions.ts` |
| A Super Admin edits roles while the server runs | Done | `routes/admin.ts` (`PUT /admin/roles/:name/permissions`, `PATCH /admin/users/:id/role`), `services/adminService.ts` |
| Guest role | Deliberate difference | Not stored: a guest has no login, and public routes need no login (`migrations/003-roles-and-permissions.ts`) |
| UserRoles (many roles per user) | Deliberate difference | One role per user, in the `role` field (`models/User.ts`) |
| Listing, order, review and report permissions | Later | Seeded by migration 003, but no route uses them until the marketplace |

## 4.3 Member profile

| Spec part | State | Where |
|-----------|-------|-------|
| Display name, bio, city, country | Done | `models/Profile.ts`, `dtos/profileDto.ts`, `services/profileService.ts` |
| Avatar | Done | `routes/profile.ts`, `services/profileService.ts`, `storage/imageStorage.ts` |
| Sizes (top, bottom, dress, shoes) | Done | `models/Profile.ts` |
| Favorite styles (the field `styles`) and favorite colors | Done | `models/Profile.ts`, `utils/profileOptions.ts` |
| Public seller rating | Later | Comes with reviews (marketplace) |

## 4.4 Wardrobe

| Spec part | State | Where |
|-----------|-------|-------|
| All item fields (name, category, colors, season, style tags, condition, price, notes, wear count, ...) | Done | `models/WardrobeItem.ts`, `utils/wardrobeOptions.ts`, `dtos/itemDto.ts` |
| Soft delete | Done | `services/itemService.ts`, `repositories/itemRepository.ts` |
| Original photo | Done | `models/ItemImage.ts`, `services/itemImageService.ts`, `storage/imageStorage.ts` |
| Cutout photo | Later | `models/ItemImage.ts` already allows `kind: "cutout"`; the AI service will make it. Members can only upload `original` |
| Statuses `in_closet` and `archived` | Done | `utils/wardrobeOptions.ts`, `services/itemService.ts`: the API sets only these two (restore and archive) |
| Statuses `listed` and `sold` | Later | Allowed in `utils/wardrobeOptions.ts`, but no route sets them: they come with the marketplace |

## Data model

| Spec collection | State | Where |
|-----------------|-------|-------|
| Users | Done | `models/User.ts` |
| Roles | Done | `models/Role.ts` |
| Permissions | Done | `models/Permission.ts` |
| RolePermissions | Done | `models/RolePermission.ts` |
| RefreshTokens | Done | `models/RefreshTokens.ts` |
| AuditLogs | Done | `models/AuditLog.ts`, `utils/audit.ts` |
| WardrobeItems | Done | `models/WardrobeItem.ts` |
| ItemImages | Done | `models/ItemImage.ts` |
| Profile | Deliberate difference | Its own collection, one per user (`models/Profile.ts`), not fields inside Users |
| Tags and ItemTags | Later | For now, `styleTags` is a list of words inside each item (`models/WardrobeItem.ts`) |
| Outfits, WearLogs, and everything from Listings onward | Later | Not built. Today an item only keeps `wearCount` and `lastWornAt` |

## Stack

| Spec part | State | Where |
|-----------|-------|-------|
| MongoDB with Mongoose | Done | `models/`, `repositories/`, `db.ts` |
| Migrations (migrate-mongo) | Done | `migrations/`, `migrate-mongo-config.ts` |
| Validation (Zod) | Done | `dtos/` |
| API docs (Swagger) | Done | `openapi.json`, `routes/docs.ts` |
| Layers with DTOs | Done | `routes/`, `controllers/`, `services/`, `repositories/`, `dtos/`, `container.ts` |
| Jest, CI and Stripe | Deliberate difference | Removed by the owner's decision; the revised spec agrees. The old tests are in the tag `with-tests` |
| docker-compose, `web/` (React) and `ai-service/` | Later | Not in the repository yet |

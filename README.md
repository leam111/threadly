# Threadly

An AI wardrobe and resale marketplace.
Snap your clothes. Style your closet. Sell what you no longer wear.

This is an individual portfolio project, built step by step to learn the full life of a web app.

## Status

- Phase 0: setup (done)
- Phase 1: authentication, roles and accounts (done)
- Phase 2: the wardrobe and the member profile (done)
- Phase 3 and later: not started

### What works today

**Accounts and login**
- Register with email and password (hashed with bcrypt). Passwords need 8+ characters, a letter and a number
- Login with a signed access token (JWT, 15 minutes)
- Refresh tokens: 7 days, saved only as a hash in MongoDB, sent in an httpOnly cookie
- Rotation: every refresh gives a new refresh token and marks the old one as used
- Reuse detection: a used token shown again cancels its whole login family, and only that family
- Logout, and "log out everywhere else"
- Change password (needs the current password, and ends every session)
- Deactivate your own account (needs the password, and ends every session)

**Protection**
- `requireAuth` guard: checks the token, then checks in the database that the user is still active
- `requirePermission` guard: "does your role allow this action?", read from the database on every request (see [Roles and permissions](#roles-and-permissions))
- Rate limits: login 6 per minute, register 5 per hour, refresh 10 per minute, and change password, deactivate and logout-others 5 per 15 minutes. The wardrobe and profile write routes (adding, editing, archiving and restoring items, and editing the profile) share one limit of 60 per 15 minutes. Limits count per IP address and live in memory, so a server restart resets them
- Login does the same bcrypt work for every email, so response time does not reveal which emails exist
- CORS: only the frontend address may call the API, and cookies are allowed
- Security headers (helmet)
- Unknown routes get a JSON 404 (`route not found`)
- An error handler answers with JSON only: 500 `something went wrong` for server errors, and the 4xx code for client errors like broken JSON. It never sends stack traces or error details

**Admin**
- List users with pages, and filter by email, role or status. Never sends the password hash
- Switch a user on or off. Switching off also cancels that user's refresh tokens
- Safety rules: nobody can switch off their own account, only a superadmin can change a superadmin, and the last active superadmin can never be switched off
- Roles and permissions: a superadmin can read the roles and permissions, change the permission list of a role (it works at once), and give a user another role
- Audit log: records admin user switches, role changes, permission edits and admin logins (success and failure). Read-only, newest first, with pages and a page size cap of 50

**Wardrobe**
- Add a clothing item: name, category, and optional brand, color and size. Text is trimmed and has a length limit
- An empty text clears an optional field: in an edit, `brand: ""` removes the brand. When adding an item, an empty optional text is simply not saved. The name can never be empty
- List your items, newest first, with pages (page size cap of 50) and filters by category and status
- See, edit, archive and restore one item. There is no delete: archive hides an item, restore brings it back
- The owner always comes from the token, never from the body or the address. An `ownerId` or `status` sent in the body is ignored
- An item policy (`policies/itemPolicy.ts`) decides in one place who may see, edit, archive or restore an item. For now, only the owner
- A stranger asking for someone else's item gets 404 `item not found`, the same answer as for an item that does not exist, so nobody learns which items exist

**Member profile**
- Each member has one profile: display name, bio, city, sizes (top, bottom, dress, shoes) and up to 5 styles from a fixed list
- An empty text (`""`) in an edit clears display name, bio, city or one size
- You can only read and change your own profile. There is no id in the address
- Reading before you have a profile gives an empty default and writes nothing. The first change creates the profile
- The answer leaves out empty text fields. `sizes` is always an object and `styles` always a list, even when empty. It includes `updatedAt` once the profile exists, and never `_id`

### Not built yet

The plan to finish Phase 1 and 2 is in [docs/finish-plan.md](docs/finish-plan.md). Still to come:

- The richer wardrobe: more item fields, soft delete, "wear", more filters, new status values
- Profile extras: country and favorite colors
- Image upload: item photos and the avatar
- Swagger docs
- The React frontend, the AI service, and the whole marketplace

## Tech

- Node.js, Express 5, TypeScript
- MongoDB (Atlas) with Mongoose
- JSON Web Tokens (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- Validation (`zod`)
- Rate limiting (`express-rate-limit`)
- Cookies (`cookie-parser`), CORS (`cors`), security headers (`helmet`)
- Code checks: TypeScript (`tsc`), ESLint and Prettier

## Project layout

```
threadly/
└── api/
    ├── index.ts          starts the server
    ├── app.ts            builds the app: middleware, routes, 404 and error handler
    ├── container.ts      puts the pieces together: gives each service its repositories
    ├── db.ts             connects to MongoDB
    ├── routes/           thin routers: which guards run, then which controller
    ├── controllers/      read the request, call a service, send the answer
    ├── services/         the rules (no Express here); a refusal is an AppError
    ├── repositories/     ALL the database queries (the only files that use the models)
    ├── dtos/             Zod schemas for what comes in, small mappers for what goes out
    ├── models/           data plans: User, RefreshTokens, AuditLog, WardrobeItem, Profile,
    │                     Permission, Role, RolePermission
    ├── middleware/       guards (requireAuth, requirePermission) and rate limiters
    ├── policies/         itemPolicy.ts: who may do what to a wardrobe item
    ├── migrations/       database changes, run with migrate-mongo
    ├── scripts/          the database safety lock, index helpers, the superadmin seed
    └── utils/            AppError, token helpers, password rules, the audit log writer,
                          the id check, and the allowed values for items and profiles
```

## How a request flows

Each layer has one job, and only talks to the layer below it.
Example: `PATCH /wardrobe/:id` (edit one of my items).

```
  Postman / the frontend
          │  PATCH /wardrobe/123  { "brand": "" }
          ▼
  route         routes/wardrobe.ts
                guards in order: writeLimiter → requireAuth → requirePermission("wardrobe:manage_own")
          ▼
  controller    controllers/itemController.ts
                checks the body with the Zod schema (dtos/itemDto.ts)
                bad body → 400 "invalid input" and stop
          ▼
  service       services/itemService.ts
                the rules: "nothing to change"? is the id valid? is it my item (policies/itemPolicy.ts)?
                a "no" is thrown as AppError(404, "item not found")
          ▼
  repository    repositories/itemRepository.ts
                the database query: find the item with this id AND my id as owner, then save it
          ▼
  model         models/WardrobeItem.ts  →  MongoDB
```

On the way back, the service gives the item to the controller, which turns it into the answer with
a DTO mapper (`toItemDto`) and sends it. When a service throws an `AppError`, the error handler in
`app.ts` answers `{ message }` with its status. Any other error answers 500 "something went wrong",
and the details stay in the server log.

`container.ts` builds every service once and hands it its repositories, like
`makeItemService({ items: itemRepository })`. This is simple "dependency injection": a service never
picks its own database code, it is given it.

## Endpoints

| Method | Path | Who | What it does |
|---|---|---|---|
| POST | `/auth/register` | anyone | Create an account |
| POST | `/auth/login` | anyone | Log in. Gives an access token and a refresh cookie |
| POST | `/auth/refresh` | has the cookie | Swap the cookie for a new access token (rotation) |
| POST | `/auth/logout` | anyone | Cancel this device's refresh token and clear the cookie |
| POST | `/auth/logout-others` | logged in | Cancel every other device's refresh token |
| POST | `/auth/change-password` | logged in | Change the password and end every session |
| POST | `/auth/deactivate` | logged in | Switch your own account off |
| GET | `/auth/me` | logged in | Who am I? |
| PATCH | `/admin/users/:id/active` | `user:ban` | Switch a user on or off |
| GET | `/admin/users` | `user:view` | List users. Query: page, limit, email, role, status |
| GET | `/admin/audit` | `audit:view` | Read the audit log. Query: page, limit, action |
| GET | `/admin/permissions` | `permission:edit` | List every permission |
| GET | `/admin/roles` | `permission:edit` | List every role with its permissions |
| PUT | `/admin/roles/:name/permissions` | `permission:edit` | Replace the permission list of a role. Body: `{ permissions: [names] }` |
| PATCH | `/admin/users/:id/role` | `role:assign` | Give a user another role. Body: `{ role }` |
| POST | `/wardrobe` | `wardrobe:manage_own` | Add an item to my wardrobe |
| GET | `/wardrobe` | `wardrobe:manage_own` | List my items. Query: page, limit, category, status |
| GET | `/wardrobe/:id` | `wardrobe:manage_own`, the owner | See one of my items |
| PATCH | `/wardrobe/:id` | `wardrobe:manage_own`, the owner | Change name, category, brand, color or size |
| PATCH | `/wardrobe/:id/archive` | `wardrobe:manage_own`, the owner | Archive an item |
| PATCH | `/wardrobe/:id/restore` | `wardrobe:manage_own`, the owner | Put an archived item back to active |
| GET | `/profile/me` | logged in | Read my profile (an empty default if I have none yet) |
| PATCH | `/profile/me` | logged in | Create or change my profile |

## Roles and permissions

A **permission** is one action, like `user:ban`. A **role** is a bundle of permissions.
The guard `requirePermission("user:ban")` runs after `requireAuth` and asks:
"does the role of this user have this permission?" The answer comes from the database
(collections `permissions`, `roles` and `rolepermissions`), read again on every request, with no cache.
So when a superadmin changes a role, the change works at the very next request.

**Fail closed.** If the role does not exist, the row is missing, or the database lookup fails,
the answer is always 403 `You are not allowed here`, never "yes". This also means: with an empty
permissions table (migration 003 not run yet), everyone is refused, even a superadmin.

**The permission matrix** (made by migration 003; each role has everything the role on its left has):

| Permission | member | moderator | admin | superadmin |
|---|:-:|:-:|:-:|:-:|
| `listing:read` | ✓ | ✓ | ✓ | ✓ |
| `wardrobe:manage_own` | ✓ | ✓ | ✓ | ✓ |
| `listing:create` | ✓ | ✓ | ✓ | ✓ |
| `listing:update_own` | ✓ | ✓ | ✓ | ✓ |
| `order:create` | ✓ | ✓ | ✓ | ✓ |
| `review:create` | ✓ | ✓ | ✓ | ✓ |
| `report:create` | ✓ | ✓ | ✓ | ✓ |
| `listing:hide` | | ✓ | ✓ | ✓ |
| `listing:remove` | | ✓ | ✓ | ✓ |
| `report:resolve` | | ✓ | ✓ | ✓ |
| `user:view` | | | ✓ | ✓ |
| `user:ban` | | | ✓ | ✓ |
| `order:refund` | | | ✓ | ✓ |
| `audit:view` | | | ✓ | ✓ |
| `role:assign` | | | | ✓ |
| `permission:edit` | | | | ✓ |
| **total** | 7 | 10 | 14 | 16 |

Some permissions (listings, orders, reviews, reports) are for parts that are not built yet.

**One role per user (a decision).** A user keeps ONE role, saved as a role name in the `role` field
of the user. The spec also describes a many-to-many "UserRoles" table (a user with several roles).
That is NOT built now: one role is enough today, and it keeps the guard simple.

**No "guest" role (a decision).** A guest is a visitor with no login. Public routes (like register
and login) need no login and no permission, so a guest role would never be checked. It is not stored.

**Safety rules for roles:**
- The superadmin role can never lose `role:assign` or `permission:edit`.
- Nobody can change their own role.
- Only a superadmin can give or take the superadmin role, or change someone who is a superadmin.
- The last active superadmin can never be demoted or switched off.
- Every role change (`role.assign`) and permission edit (`permission.edit`) is written in the audit log.

Known and accepted for now: if two superadmins change each other at the exact same moment,
both requests could pass (the check counts first, then saves).

## Run it locally

You need Node.js 22 and a free MongoDB Atlas cluster.

1. Go into the api folder and install packages:
```
   cd api
   npm install
```
2. Create `api/.env` (never commit this file):
```
   MONGODB_URI=your-atlas-connection-string
   MONGODB_URI_TEST=a-second-connection-string-for-a-sandbox
   JWT_SECRET=a-long-random-text
   FRONTEND_ORIGIN=http://localhost:5173
   SEED_SUPERADMIN_EMAIL=only-for-the-seed-script
   SEED_SUPERADMIN_PASSWORD=only-for-the-seed-script
```
   `FRONTEND_ORIGIN` is optional. It falls back to `http://localhost:5173`.
   `MONGODB_URI_TEST` is a sandbox database, to try migrations and the seed safely. Its database name must contain `_test`.
3. Start the server:
```
   npm run dev
```
   You should see `Connected to MongoDB`, then `server is running on port 3000`.

## Migrations and the first superadmin

A migration is a small script that changes the database itself (for example an index),
written down once so every database gets exactly the same change. Each one has an `up`
(do it) and a `down` (undo it), and can run twice without harm.

| File | What it does |
|---|---|
| `migrations/001-wardrobe-owner-index.ts` | Drops the old `ownerId_1` index on wardrobe items and makes sure `ownerId_1_createdAt_-1` exists |
| `migrations/002-refresh-token-ttl.ts` | A TTL index on `refreshtokens.expiresAt`: MongoDB deletes a refresh token by itself once it has expired |
| `migrations/003-roles-and-permissions.ts` | Adds the 16 permissions, the 4 roles and the 47 "role has permission" rows (see the matrix above). Its `down` removes only those |

**Run migration 003 BEFORE you start the server with this version.** Until it has run, the
permissions table is empty and every admin and wardrobe route answers 403 to everyone.
Migration 003 runs only once: changes made later by a superadmin are not undone by a new `migrate:up`.

Why the TTL index is safe: an expired token can never be swapped for a new one (the refresh route checks
`expiresAt`), so deleting it changes nothing for real users. Reuse detection only needs tokens that are not
expired yet, and those are never deleted. The one small loss: someone who shows a stolen token *after* it
expired gets "invalid refresh token" without cancelling its family. That token was useless to them anyway.

**The safety lock.** Every migration and seed command refuses a database whose name has no `_test`,
unless you add `CONFIRM_REAL_DB=yes`. `USE_TEST_DB=yes` makes them use `MONGODB_URI_TEST` instead of `MONGODB_URI`.
The connection string must name its database (like `.../threadly?...`).

From the api folder (Git Bash syntax; the variables go before the command):
```
   USE_TEST_DB=yes npm run migrate:status      # list migrations on the test database
   USE_TEST_DB=yes npm run migrate:up          # run the pending ones
   USE_TEST_DB=yes npm run migrate:down        # undo the LAST one only

   CONFIRM_REAL_DB=yes npm run migrate:status  # the same on the real database (MONGODB_URI)
   CONFIRM_REAL_DB=yes npm run migrate:up
```
The list of migrations already run is kept in the `changelog` collection.

On the real database, in this order: `migrate:up` first (it runs 001, 002 and 003 if they are
pending), then the superadmin seed below, then `npm run dev`.

**The first superadmin.** Put `SEED_SUPERADMIN_EMAIL` and `SEED_SUPERADMIN_PASSWORD` in `api/.env`, then:
```
   CONFIRM_REAL_DB=yes npm run seed:superadmin              # creates the user if the email is new
   CONFIRM_REAL_DB=yes npm run seed:superadmin -- --promote # makes an existing user superadmin
```
The password must follow the normal password rules. The script never prints it. Without `--promote`,
an existing user is left alone. With `--promote`, they keep their own password. Remove the two
`SEED_` lines from `.env` afterwards.

## How I check my work

This project has no automated tests (my decision, in the revised plan). Before every pull request,
from the api folder:
```
   npx tsc --noEmit        # TypeScript finds type errors
   npm run lint            # ESLint finds real problems in the code
   npm run format:check    # Prettier checks the layout
```
All three must be clean. Then I start the server (`npm run dev`) and go through
[docs/manual-checklist.md](docs/manual-checklist.md) by hand in Postman.
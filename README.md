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
- Rate limits: login 6 per minute, register 5 per hour, refresh 10 per minute, and change password, deactivate and logout-others 5 per 15 minutes. The wardrobe and profile write routes (adding, editing, archiving, restoring, wearing and deleting items, uploading, editing and deleting photos, editing the profile, and uploading or deleting the avatar) share one limit of 60 per 15 minutes. Limits count per IP address and live in memory, so a server restart resets them
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
- Add a clothing item: name and category (top, bottom, dress, outerwear, shoes, accessory, bag or other)
- Optional fields: subCategory, brand, color (free text), colors (up to 5 words), size, pattern, material,
  season (spring, summer, autumn, winter or all), styleTags (up to 10 words), condition (new_with_tags,
  like_new, very_good, good or fair), purchasePrice (0 to 1000000, at most 2 decimals) and notes (up to 500 characters).
  Text is trimmed and has a length limit. The words in colors and styleTags are trimmed, saved in lowercase, and never twice
- Clearing a field in an edit: `""` clears a text or a choice (like `brand: ""` or `season: ""`), `[]` clears a list,
  `null` clears the price. When adding an item, an empty value is simply not saved. The name can never be empty
- The answer always has `colors` and `styleTags` as lists (empty when there are none), and never `__v`, `isDeleted` or `deletedAt`
- Status: `in_closet` (the normal state), `archived`, and later `listed` and `sold` for the marketplace.
  Archive sets `archived`, restore sets `in_closet`. Both can be repeated safely (200 again)
- Note on `color`: the old free-text `color` field stays next to the `colors` list until the AI tagging
  phase. The `color` filter searches the `colors` list only
- Note on restore: restore sets `in_closet` from ANY status, even `listed` or `sold`. This must be
  revisited when the marketplace exists (a listed or sold item should probably not go back to the closet)
- "I wore it": `POST /wardrobe/:id/wear` adds 1 to `wearCount` and sets `lastWornAt` to now
- Delete is a SOFT delete: the item stays in the database, marked `isDeleted`, but every route then acts
  as if it was gone (404 `item not found`) and lists never show it. Nothing is ever really deleted
- List your items, newest first, with pages (page size cap of 50). Filters, freely combined: status, category,
  color, season (an "all" season item matches every season), styleTag, and notWornDays (30, 60 or 90:
  last worn longer ago than that, or never worn)
- The owner always comes from the token, never from the body or the address. The server-managed fields
  (`ownerId`, `status`, `wearCount`, `lastWornAt`, `isDeleted`) sent in a body are ignored
- An item policy (`policies/itemPolicy.ts`) decides in one place who may see, edit, archive, restore, delete or wear an item. For now, only the owner
- A stranger asking for someone else's item gets 404 `item not found`, the same answer as for an item that does not exist, so nobody learns which items exist

**Member profile**
- Each member has one profile: display name, bio, city, country, sizes (top, bottom, dress, shoes), up to 5 styles from a fixed list, and up to 10 favorite colors
- Favorite colors are free words (like "navy" or "sage green"): trimmed, saved in lowercase, never twice, 1 to 30 characters each
- An empty text (`""`) in an edit clears display name, bio, city, country or one size. An empty list (`favoriteColors: []`) clears the favorite colors
- You can only read and change your own profile. There is no id in the address
- Reading before you have a profile gives an empty default and writes nothing. The first change creates the profile
- The answer leaves out empty text fields. `sizes` is always an object, `styles` and `favoriteColors` always lists, even when empty. It includes `updatedAt` once the profile exists, and never `_id`
- Country and favorite colors need **no migration**: both fields are optional, so existing profiles simply do not have them yet, and the answer shows `favoriteColors: []` for them
- The seller rating is not built yet: it comes with the reviews, in the marketplace

**Photos and the avatar** (image storage: Supabase Storage, a private bucket)
- Up to 5 photos per item: `POST /wardrobe/:id/images` (Body form-data, key `image`, type File, and an optional text key `alt`)
- One file per request, at most 5 MB, only JPEG, PNG or WebP. The type is decided by the real content
  of the file (its first bytes, the "magic bytes"), never by the file name or the type the client says.
  The file stays in memory: nothing is written to the server disk
- The upload step runs AFTER the login and the permission, so an anonymous person cannot send a big file
- The bucket is private. The database keeps only the file path, never a link. Every answer gets a fresh
  **signed link** (`url`, `coverUrl`, `avatarUrl`) that works for 1 hour. If making the link fails, the
  answer simply has no link (a request never fails because of that). The file path is never sent
- Paths: `items/<ownerId>/<itemId>/<random id>.<ext>` and `avatars/<ownerId>/<random id>.<ext>`. The
  extension comes from the real file type, never from the client's file name
- Item answers have `coverUrl`: a link to the oldest original photo of the item (left out when there
  is none). A whole page of items needs ONE extra database query and ONE signing call
- `alt` (a short description, max 150 characters) can be changed with PATCH; `""` clears it
- Delete: the file is removed from the image storage FIRST, then the database row. If the storage fails,
  the answer is 502 "image storage failed" and the row stays, so you can simply try again
- Avatar: `POST /profile/me/avatar` replaces the old one (the old file is removed only after the new one
  is saved), `DELETE /profile/me/avatar` removes it. The profile answer has `avatarUrl` when there is one
- `kind` is `original` for every photo a member sends. `cutout` is kept for the AI service later
- If a storage setting is missing, the server still starts, prints one line with the missing names,
  and the upload routes answer 503 "image storage is not set up"
- Known and accepted for now: the limit of 5 photos counts, then saves, so two uploads at the very same
  moment could make 6. A soft deleted item keeps its photos in the bucket

### Not built yet

The plan to finish Phase 1 and 2 is in [docs/finish-plan.md](docs/finish-plan.md). Still to come:

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
- File uploads (`multer`, in memory) and image storage (Supabase Storage, `@supabase/supabase-js`)
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
    ├── models/           data plans: User, RefreshTokens, AuditLog, WardrobeItem, ItemImage,
    │                     Profile, Permission, Role, RolePermission
    ├── storage/          imageStorage.ts: the ONLY file that talks to the image storage (Supabase)
    ├── middleware/       guards (requireAuth, requirePermission), rate limiters, receiveImage (multer)
    ├── policies/         itemPolicy.ts: who may do what to a wardrobe item
    ├── migrations/       database changes, run with migrate-mongo
    ├── scripts/          the database safety lock, index helpers, the superadmin seed
    └── utils/            AppError, token helpers, password rules, the audit log writer,
                          the id check, the image type check, and the allowed values for items,
                          profiles and images
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
| GET | `/wardrobe` | `wardrobe:manage_own` | List my items. Query: page, limit, status, category, color, season, styleTag, notWornDays |
| GET | `/wardrobe/:id` | `wardrobe:manage_own`, the owner | See one of my items |
| PATCH | `/wardrobe/:id` | `wardrobe:manage_own`, the owner | Change any of the item's own fields |
| PATCH | `/wardrobe/:id/archive` | `wardrobe:manage_own`, the owner | Archive an item |
| PATCH | `/wardrobe/:id/restore` | `wardrobe:manage_own`, the owner | Put an archived item back in the closet (`in_closet`) |
| POST | `/wardrobe/:id/wear` | `wardrobe:manage_own`, the owner | Count one wear (wearCount + 1, lastWornAt now) |
| DELETE | `/wardrobe/:id` | `wardrobe:manage_own`, the owner | Soft delete an item |
| POST | `/wardrobe/:id/images` | `wardrobe:manage_own`, the owner | Upload a photo (form-data key `image`, optional `alt`) |
| GET | `/wardrobe/:id/images` | `wardrobe:manage_own`, the owner | List the photos of an item, newest first |
| PATCH | `/wardrobe/:id/images/:imageId` | `wardrobe:manage_own`, the owner | Change the `alt` of a photo |
| DELETE | `/wardrobe/:id/images/:imageId` | `wardrobe:manage_own`, the owner | Delete a photo (storage first, then the database) |
| GET | `/profile/me` | logged in | Read my profile (an empty default if I have none yet) |
| PATCH | `/profile/me` | logged in | Create or change my profile |
| POST | `/profile/me/avatar` | logged in | Upload or replace my avatar (form-data key `image`) |
| DELETE | `/profile/me/avatar` | logged in | Delete my avatar |

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
   SUPABASE_URL=your-project-url
   SUPABASE_SERVICE_ROLE_KEY=your-secret-key
   SUPABASE_BUCKET=your-bucket-name
```
   `FRONTEND_ORIGIN` is optional. It falls back to `http://localhost:5173`.
   `MONGODB_URI_TEST` is a sandbox database, to try migrations and the seed safely. Its database name must contain `_test`.
   The three `SUPABASE_` values are for photos (see [Image storage](#image-storage-supabase) below).
   Without them the server still starts, but uploads answer 503.
3. Start the server:
```
   npm run dev
```
   You should see `Connected to MongoDB`, then `server is running on port 3000`.

## Image storage (Supabase)

Photos and avatars are kept in **Supabase Storage**, in a PRIVATE bucket. Only the server can reach it.
The app answers with signed links that work for 1 hour.

**Make a free account and a private bucket**
1. Go to [supabase.com](https://supabase.com) and sign up (the free plan is enough).
2. Create a new project: pick a name, a database password (Threadly does not use it, but keep it
   somewhere safe) and a region close to you. Wait until the project is ready.
3. In the left menu open **Storage**, then **New bucket**. Give it a name (for example
   `threadly-images`). Leave **Public bucket OFF**: the bucket must be private.
   Optional, as a second safety: in the bucket settings, limit the file size to 5 MB and the types to
   `image/jpeg`, `image/png` and `image/webp`.

**Where to find the three values**
- `SUPABASE_URL`: Project Settings, **API** (or **Data API**): the **Project URL**
  (it looks like `https://<something>.supabase.co`).
- `SUPABASE_SERVICE_ROLE_KEY`: Project Settings, **API Keys**: the **service_role** key, or a
  **secret** key on newer projects. This key can do EVERYTHING in your project: put it only in
  `api/.env`. Never in the frontend, never in git, never in a chat or a screenshot.
- `SUPABASE_BUCKET`: the name of the bucket you made in step 3.

Put the three lines in `api/.env` (the names are also in `api/.env.example`), then restart the server.
If one is missing, the server prints `image storage is not set up, missing: <names>`.

**Two facts about the free plan**
- A free project **pauses after about a week without activity**. While it is paused, uploads and
  deletes answer 502 "image storage failed", and answers have no links. Open the Supabase dashboard,
  click **Restore project**, and wait a few minutes.
- There is **no image resizing** on the free plan. Photos are kept and sent at the size they were
  uploaded (at most 5 MB each).

## Migrations and the first superadmin

A migration is a small script that changes the database itself (for example an index),
written down once so every database gets exactly the same change. Each one has an `up`
(do it) and a `down` (undo it), and can run twice without harm.

| File | What it does |
|---|---|
| `migrations/001-wardrobe-owner-index.ts` | Drops the old `ownerId_1` index on wardrobe items and makes sure `ownerId_1_createdAt_-1` exists |
| `migrations/002-refresh-token-ttl.ts` | A TTL index on `refreshtokens.expiresAt`: MongoDB deletes a refresh token by itself once it has expired |
| `migrations/003-roles-and-permissions.ts` | Adds the 16 permissions, the 4 roles and the 47 "role has permission" rows (see the matrix above). Its `down` removes only those |
| `migrations/004-wardrobe-2f.ts` | The richer wardrobe: the status `active` becomes `in_closet`, `isDeleted: false` and `wearCount: 0` are added where missing, and an index on `ownerId` + `status`. Its `down` turns `in_closet` back into `active` and removes `isDeleted`/`wearCount` only where they still hold `false`/`0`. A soft deleted item keeps `isDeleted: true` after `down`, and the old code would show it again |
| `migrations/005-item-images.ts` | The two indexes of the new `itemimages` collection: `itemId` + `createdAt` (the photos of an item, newest first, and its cover) and `ownerId`. Its `down` drops them. It never changes or deletes a photo |

**Run migration 005 before you upload photos on the real database.** It only adds indexes, so nothing breaks
without it, but lists of photos and covers get slower as the collection grows.

**Run migration 004 BEFORE you start the server with the richer wardrobe.** Until it has run, old items
still say `active`: the filter `status=in_closet` misses them, and archiving or restoring them can fail
with 500, because `active` is no longer an allowed value.

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
The same in PowerShell (a variable is set first, and removed again afterwards):
```
   $env:CONFIRM_REAL_DB = "yes"; npm run migrate:status; npm run migrate:up; Remove-Item Env:CONFIRM_REAL_DB
```
The list of migrations already run is kept in the `changelog` collection.

On the real database, in this order: `migrate:up` first (it runs 001 to 005 if they are
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
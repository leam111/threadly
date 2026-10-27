# Manual checklist

This project has no automated tests. Before a pull request is merged, go through this list by hand.
Tick a box only when the status AND the message are exactly what is written.

Base URL: `http://localhost:3000` (start the server from `api/` with `npm run dev`).

## Before you start

- **Tip: use two Postman tabs, Owner and Stranger**, each with its own token in
  Authorization > Bearer Token. Before EVERY privacy test, send `GET /auth/me` in that tab and
  check the email, so you know which person you are.
- Postman keeps ONE cookie jar for `localhost`, shared by all tabs. The refresh cookie of the last
  login wins. For the "two devices" tests, copy the `refreshToken` value after each login and send it
  by hand as a header: `Cookie: refreshToken=<value>`.
- The dev server uses the database in `MONGODB_URI`. Use throw-away emails (like
  `owner1@example.com`), and remove those users afterwards if this is the real database.
- Limits count per IP and live in memory: register 5 per hour, login 6 per minute. Every try counts,
  even a wrong one. If you hit a limit too early, restart the server (`npm run dev`) to reset them.
- The admin part needs an admin account and a superadmin account. Make the roles by hand in the
  database (`role` field of the user), or make the superadmin with `npm run seed:superadmin`.
- Placeholders: `<owner-token>`, `<stranger-token>`, `<admin-token>`, `<owner-id>`,
  `<owner-item-id>`, `<superadmin-id>`, `<admin-id>`, `<member-id>`. Never paste real ids or tokens
  into this file.

## AUTH

- [ ] `POST /auth/register` with `{ "email": "owner1@example.com", "password": "short" }`
      → **400** "the email must be valid and the password needs at least 8 characters , with a letter and a number"
- [ ] `POST /auth/register` with `{ "email": "owner1@example.com", "password": "Passw0rd1" }`
      → **201** "user created successfully" (do the same for `stranger1@example.com`)
- [ ] `POST /auth/register` again with `owner1@example.com`
      → **409** "user with this email already exists"
- [ ] `POST /auth/login` with the right email and a wrong password
      → **401** "Invalid email or password"
- [ ] `POST /auth/login` with an email that does not exist
      → **401** "Invalid email or password" (the SAME answer as above)
- [ ] `POST /auth/login` with the right email and password
      → **200** with `accessToken` and `user`, and a `refreshToken` cookie
- [ ] `GET /auth/me` with no token
      → **401** "Log in first"
- [ ] `GET /auth/me` with `<owner-token>`
      → **200** with the owner's id, email and role
- [ ] `POST /auth/refresh` with the refresh cookie
      → **200** with a NEW `accessToken`, and a NEW `refreshToken` cookie (the value changed)
- [ ] `POST /auth/refresh` again with the OLD cookie value (from before the refresh above)
      → **401** "invalid refresh token". Then `POST /auth/refresh` with the NEW cookie
      → also **401** "invalid refresh token": the whole family is cancelled
- [ ] Log in twice as the owner (device A and device B, keep both cookie values).
      `POST /auth/logout-others` with token and cookie of device A
      → **200** "other sessions logged out". Then `POST /auth/refresh` with the cookie of device B
      → **401** "invalid refresh token". Device A's cookie still refreshes (**200**)
- [ ] `POST /auth/change-password` with `{ "currentPassword": "Passw0rd1", "newPassword": "Passw0rd2" }`
      → **200** "password changed, please log in again". Then `POST /auth/refresh` with any old
      cookie of this user → **401** "invalid refresh token". (An access token already given still
      works until it expires, at most 15 minutes.) Log in with the new password → **200**
- [ ] Wait one minute (or restart the server), then send `POST /auth/login` with a wrong password
      7 times within one minute: tries 1 to 6 → **401** "Invalid email or password",
      try 7 → **429** "too many login attempts , please try again after a minute"

## ADMIN

- [ ] `GET /admin/users` with `<owner-token>` (a member)
      → **403** "You are not allowed here"
- [ ] `GET /admin/users` with `<admin-token>`
      → **200** with `page`, `limit`, `total`, `items`, and no `passwordHash` in any item
- [ ] `PATCH /admin/users/<admin-id>/active` with `<admin-token>` and `{ "isActive": false }`
      (the admin's own account) → **400** "you cannot switch off your own account"
- [ ] `PATCH /admin/users/<superadmin-id>/active` with `<admin-token>` and `{ "isActive": false }`
      → **403** "only a superadmin can change a superadmin"
- [ ] `PATCH /admin/users/<member-id>/active` with `<admin-token>` and `{ "isActive": false }`
      → **200** "user updated" with `isActive: false`. At once, `GET /auth/me` with that member's
      token → **401** "Log in again", and `POST /auth/refresh` with their cookie
      → **401** "invalid refresh token"
- [ ] `GET /admin/audit?action=user.deactivate` with `<admin-token>`
      → **200**, and the newest row has action `user.deactivate` and target `<member-id>`
- [ ] Switch the member back on: `PATCH /admin/users/<member-id>/active` with `{ "isActive": true }`
      → **200** "user updated" with `isActive: true`

## PERMISSIONS

**Run migration 003 on the real database BEFORE starting the server** (`CONFIRM_REAL_DB=yes npm run migrate:up`
from `api/`), because an empty permissions table refuses everyone, even a superadmin.

You need `<superadmin-token>` (with `<superadmin-id>`), `<admin-token>` (with `<admin-id>`) and
`<owner-token>` (a member, with `<member-id>`). Use a second superadmin, `<superadmin2-id>`, only where
a step says so.

**Who gets in**
- [ ] `GET /admin/users` with `<owner-token>` (a member) → **403** "You are not allowed here".
      The same for `GET /admin/audit`, `GET /admin/roles` and `PATCH /admin/users/<admin-id>/active`
- [ ] `GET /admin/users` with `<admin-token>` → **200**
- [ ] `GET /admin/roles` and `GET /admin/permissions` with `<admin-token>` → **403** "You are not allowed here"
- [ ] `PUT /admin/roles/member/permissions` and `PATCH /admin/users/<member-id>/role` with `<admin-token>`
      → **403** "You are not allowed here"
- [ ] `GET /wardrobe` with `<owner-token>` → **200** (members have `wardrobe:manage_own`)
- [ ] `GET /profile/me` and `GET /auth/me` with `<owner-token>` → **200** (no permission needed)
- [ ] `GET /admin/permissions` with `<superadmin-token>` → **200** with 16 items
- [ ] `GET /admin/roles` with `<superadmin-token>` → **200** with 4 roles: member 7, moderator 10,
      admin 14, superadmin 16 permissions

**Edit a role (the effect is immediate)**
- [ ] `PUT /admin/roles/admin/permissions` with `<superadmin-token>` and the admin list from
      `GET /admin/roles` WITHOUT `user:view` → **200** "role updated". At once, with no new login,
      `GET /admin/users` with `<admin-token>` → **403** "You are not allowed here"
- [ ] Put the full admin list back (with `user:view`) → **200** "role updated". At once
      `GET /admin/users` with `<admin-token>` → **200**
- [ ] `GET /admin/audit?action=permission.edit` with `<superadmin-token>` → **200**, the newest rows
      have `details.role` = "admin", the `added` and `removed` lists, an `ip`, and no `targetId`
- [ ] `PUT /admin/roles/admin/permissions` with `{ "permissions": ["user:view", "made:up"] }`
      → **400** "invalid input"
- [ ] `PUT /admin/roles/admin/permissions` with `{ "permissions": "user:view" }` (not a list)
      → **400** "invalid input"
- [ ] `PUT /admin/roles/nobody/permissions` with `{ "permissions": [] }` → **404** "role not found"
- [ ] `PUT /admin/roles/superadmin/permissions` with the superadmin list WITHOUT `role:assign`
      → **400** "superadmin must keep role:assign and permission:edit". The same without
      `permission:edit`. `GET /admin/roles` still shows 16 for superadmin

**Change a user's role**
- [ ] `PATCH /admin/users/abc/role` with `{ "role": "moderator" }` → **400** "invalid id!"
- [ ] `PATCH /admin/users/000000000000000000000000/role` with `{ "role": "moderator" }`
      → **404** "user not found"
- [ ] `PATCH /admin/users/<member-id>/role` with `{ "role": "boss" }` → **400** "invalid input".
      With `{}` → **400** "invalid input"
- [ ] `PATCH /admin/users/<superadmin-id>/role` with `<superadmin-token>` (your own id) and
      `{ "role": "admin" }` → **400** "you cannot change your own role"
- [ ] `PATCH /admin/users/<member-id>/role` with `{ "role": "member" }` (the role they already have)
      → **400** "nothing to change"
- [ ] `PATCH /admin/users/<member-id>/role` with `{ "role": "moderator" }` → **200** "role updated"
      with `role: "moderator"`. `GET /admin/audit?action=role.assign` → the newest row has
      `targetId` = `<member-id>`, details `from: "member"`, `to: "moderator"`, and an `ip`.
      Then put them back with `{ "role": "member" }` → **200**
- [ ] Only a superadmin for superadmins: as the superadmin, give the admin role `role:assign` with
      `PUT /admin/roles/admin/permissions` (the admin list plus `role:assign`). Then with `<admin-token>`:
      `PATCH /admin/users/<member-id>/role` with `{ "role": "superadmin" }`
      → **403** "only a superadmin can change a superadmin", and
      `PATCH /admin/users/<superadmin-id>/role` with `{ "role": "member" }` → **403** (same message).
      Then take `role:assign` away from admin again (the 14 permissions) → **200**
- [ ] Last superadmin, with ONE active superadmin: `PATCH /admin/users/<superadmin-id>/role` with
      `{ "role": "admin" }` and `PATCH /admin/users/<superadmin-id>/active` with `{ "isActive": false }`,
      both with `<superadmin-token>` → **400** "you cannot change your own role" and **400** "you cannot
      switch off your own account". With `<admin-token>` → **403** "only a superadmin can change a superadmin"
      (for `/role`, first give admin `role:assign` as above, then take it away again).
      So the last superadmin always stays.
      Note: the message **400** "there must be at least one superadmin" cannot be reached by hand. The
      person asking is always another active superadmin, so there are at least two. It is a safety net
      in the code in case the other rules change later. (It counts, then saves: two requests at the
      very same moment could both pass. Not a problem with one or two superadmins in practice.)
- [ ] With TWO active superadmins: `PATCH /admin/users/<superadmin2-id>/role` with `<superadmin-token>`
      and `{ "role": "admin" }` → **200** "role updated" (one may go, because another one stays)

## WARDROBE

- [ ] `POST /wardrobe` (Owner) with `{ "name": "Blue shirt", "category": "hat" }`
      → **400** "invalid input"
- [ ] `POST /wardrobe` (Owner) with
      `{ "name": "Blue shirt", "category": "top", "ownerId": "<stranger-id>", "status": "archived" }`
      → **201**, and the answer has `ownerId` = `<owner-id>` and `status` = "in_closet"
      (the fake ownerId and status were ignored). Keep the `_id` as `<owner-item-id>`
- [ ] `GET /wardrobe` (Owner) → **200**, only the owner's items
- [ ] `GET /wardrobe?ownerId=<owner-id>` (Stranger, with no items of their own)
      → **200** with `total: 0`
- [ ] `GET /wardrobe/<owner-item-id>` (Owner) → **200** with the item
- [ ] `GET /wardrobe/<made-up-id>` (Owner, a valid but unknown id like `000000000000000000000000`)
      → **404** "item not found"
- [ ] `GET /wardrobe/<owner-item-id>` (Stranger) → **404** "item not found" (the SAME answer)
- [ ] `GET /wardrobe/abc` (Owner) → **400** "invalid id"
- [ ] `GET /wardrobe/<owner-item-id>` with no token → **401** "Log in first"
- [ ] `PATCH /wardrobe/<owner-item-id>/archive` (Owner) → **200**, `status` = "archived"
- [ ] `PATCH /wardrobe/<owner-item-id>/restore` (Owner) → **200**, `status` = "in_closet"
- [ ] Note the item's `updatedAt`. `PATCH /wardrobe/<owner-item-id>/archive` (Stranger)
      → **404** "item not found". `PATCH /wardrobe/<owner-item-id>/restore` (Stranger)
      → **404** "item not found". Then `GET /wardrobe/<owner-item-id>` (Owner): `updatedAt` and
      `status` did not change
- [ ] `PATCH /wardrobe/<owner-item-id>` (Owner) with `{}` → **400** "nothing to change"
- [ ] `PATCH /wardrobe/<owner-item-id>` (Owner) with `{ "category": "hat" }` → **400** "invalid input"
- [ ] `PATCH /wardrobe/<owner-item-id>` (Stranger) with `{ "name": "Stolen" }`
      → **404** "item not found", and the owner still sees the old name

## PROFILE

- [ ] `GET /profile/me` (a user with no profile yet) → **200** with
      `{ "userId": "<their id>", "sizes": {}, "styles": [], "favoriteColors": [] }` and no `updatedAt`
- [ ] `PATCH /profile/me` (Owner) with `{ "displayName": "Owner One", "city": "Paris", "styles": ["minimal"] }`
      → **200** with those values and an `updatedAt`. `GET /profile/me` shows the same
- [ ] `GET /profile/me` (Stranger) → **200** with the stranger's OWN profile, never the owner's
- [ ] `PATCH /profile/me` (Owner) with `{}` → **400** "nothing to change"

## STEP 1: LAYERS (no change in behavior)

Step 1 (`refactor/layers`) only moved code into controllers, services, repositories and DTOs.
Every answer must be exactly the same as before.

- [ ] Run EVERY group above again (AUTH, ADMIN, PERMISSIONS, WARDROBE, PROFILE): every status and
      message is the same as written there

Then these checks, for the parts the move touched most:

**The error handler**
- [ ] `GET /nothing-here` → **404** "route not found"
- [ ] `POST /auth/login` with Body raw JSON `{ "email": ` (broken JSON, header
      `Content-Type: application/json`) → **400** "bad request"
- [ ] A service refusal keeps its own status and message: `GET /wardrobe/000000000000000000000000`
      (Owner) → **404** "item not found"

**The order of the checks did not change**
- [ ] `PATCH /wardrobe/abc` (Owner) with `{}` → **400** "nothing to change" (checked before the id)
- [ ] `PATCH /wardrobe/abc` (Owner) with `{ "name": "Blue" }` → **400** "invalid id"
- [ ] `PATCH /wardrobe/abc` (Owner) with `{ "category": "hat" }` → **400** "invalid input" (the body is
      checked first)
- [ ] `PATCH /admin/users/abc/active` (`<admin-token>`) with `{}` → **400** "invalid input";
      with `{ "isActive": true }` → **400** "invalid id!"
- [ ] `PATCH /admin/users/000000000000000000000000/role` (`<superadmin-token>`) with `{ "role": "boss" }`
      → **404** "user not found" (the user is checked before the role)

**Auth messages that differ only by a capital letter (they must stay as they are)**
- [ ] `POST /auth/refresh` with no cookie (delete it in Postman's Cookies window) → **401** "log in first"
- [ ] `POST /auth/logout-others` with `<owner-token>` and no cookie → **401** "log in first"
- [ ] `GET /auth/me` with no token → **401** "Log in first"
- [ ] `POST /auth/logout` with no cookie → **200** "logged out"

**Answers keep their shape**
- [ ] `GET /wardrobe` (Owner) → **200** with `page`, `limit`, `total`, `items`, and no `__v` in any item
- [ ] `POST /auth/login` → **200** with `accessToken` and `user` (`id`, `email`, `role` only)
- [ ] `GET /admin/roles` (`<superadmin-token>`) → **200**, each item has `name`, `description`,
      `isSystem` and `permissions`

## STEP 2: THE RICHER WARDROBE

**Run migration 004 on the real database BEFORE starting the server** (see the README, "Migrations").
Use two Postman tabs, Owner and Stranger, as above.

**New fields**
- [ ] `POST /wardrobe` (Owner) with
      `{ "name": "Tote", "category": "bag", "subCategory": "tote", "colors": [" Navy ", "Red"], "pattern": "plain", "material": "leather", "season": "all", "styleTags": ["Minimal"], "condition": "like_new", "purchasePrice": 49.99, "notes": "gift" }`
      → **201**: `colors` = ["navy", "red"], `styleTags` = ["minimal"], `status` = "in_closet",
      `wearCount` = 0, and no `__v`, `isDeleted` or `deletedAt`. Keep the `_id` as `<bag-id>`
- [ ] `POST /wardrobe` (Owner) with `{ "name": "Cap", "category": "top", "wearCount": 50, "lastWornAt": "2020-01-01", "status": "sold", "isDeleted": true, "ownerId": "<stranger-id>" }`
      → **201** with `wearCount` 0, no `lastWornAt`, `status` "in_closet", `ownerId` = `<owner-id>`
      (every server-managed field was ignored). The answer has `colors: []` and `styleTags: []`
- [ ] `POST /wardrobe` with `"colors": ["red", "Red"]` → **400** "invalid input" (the same color twice)
- [ ] `POST /wardrobe` with 6 colors → **400** "invalid input". With 11 styleTags → **400** "invalid input"
- [ ] `POST /wardrobe` with `"purchasePrice": 10.999` → **400** "invalid input". With `-1` or
      `1000000.01` → **400** "invalid input". With `0.1` → **201**
- [ ] `POST /wardrobe` with `"season": "monsoon"` or `"condition": "broken"` → **400** "invalid input"
- [ ] `POST /wardrobe` with `"notes"` of 501 characters → **400** "invalid input"

**Edit and clear**
- [ ] `PATCH /wardrobe/<bag-id>` (Owner) with `{ "season": "", "colors": [], "purchasePrice": null, "notes": "" }`
      → **200**: no `season`, no `purchasePrice`, no `notes`, and `colors: []`
- [ ] `PATCH /wardrobe/<bag-id>` (Owner) with `{ "wearCount": 5, "status": "listed" }` → **400** "nothing to change"
      (both keys are dropped, so nothing is left)

**Status, archive and restore**
- [ ] `PATCH /wardrobe/<bag-id>/archive` twice → **200** both times, `status` "archived"
- [ ] `PATCH /wardrobe/<bag-id>/restore` twice → **200** both times, `status` "in_closet"
- [ ] `GET /wardrobe?status=active` → **400** "invalid query" (the old name is gone).
      `GET /wardrobe?status=in_closet` → **200**

**Wear**
- [ ] `POST /wardrobe/<bag-id>/wear` (Owner) → **200**, `wearCount` 1 and a `lastWornAt` of now.
      Again → **200**, `wearCount` 2
- [ ] `POST /wardrobe/abc/wear` (Owner) → **400** "invalid id"

**A stranger changes nothing (404, and updatedAt stays)**
- [ ] Note `updatedAt` and `wearCount` of `<bag-id>` (Owner, `GET /wardrobe/<bag-id>`).
      As the Stranger: `PATCH /wardrobe/<bag-id>` with `{ "name": "Stolen" }` → **404** "item not found";
      `POST /wardrobe/<bag-id>/wear` → **404** "item not found";
      `DELETE /wardrobe/<bag-id>` → **404** "item not found".
      Then as the Owner, `GET /wardrobe/<bag-id>` → **200** with the same name, `wearCount` and `updatedAt`

**Filters** (create a few items first; the Cap above was never worn)
- [ ] `GET /wardrobe?category=bag` → only bags. `GET /wardrobe?color=NAVY` → items whose `colors` has "navy"
- [ ] `GET /wardrobe?season=all&styleTag=minimal` → only items with both
- [ ] Make one item with `"season": "summer"` and one with `"season": "winter"` (the Tote has "all").
      `GET /wardrobe?season=summer` → the summer item AND the Tote ("all" matches every season), not the
      winter item. `GET /wardrobe?season=all` → only items marked "all"
- [ ] `GET /wardrobe?notWornDays=30` → the Cap is in the list (never worn), the Tote is not (worn today)
- [ ] `GET /wardrobe?notWornDays=45` → **400** "invalid query". `GET /wardrobe?season=monsoon` → **400** "invalid query"
- [ ] `GET /wardrobe?limit=500` → **200** with `limit` 50
- [ ] `GET /wardrobe?ownerId=<owner-id>` (Stranger) → **200** with only the Stranger's items

**Soft delete**
- [ ] `DELETE /wardrobe/abc` (Owner) → **400** "invalid id"
- [ ] `DELETE /wardrobe/<bag-id>` (Owner) → **200** "item deleted"
- [ ] After that, as the Owner: `GET /wardrobe/<bag-id>`, `PATCH /wardrobe/<bag-id>` with `{ "name": "x" }`,
      `PATCH /wardrobe/<bag-id>/archive`, `PATCH /wardrobe/<bag-id>/restore`, `POST /wardrobe/<bag-id>/wear`
      and `DELETE /wardrobe/<bag-id>` → all **404** "item not found"
- [ ] `GET /wardrobe` (Owner) → the deleted item is not in `items`, and `total` went down by 1
- [ ] In the database (Atlas, collection `wardrobeitems`) the item is still there, with `isDeleted: true`
      and a `deletedAt`

## STEP 3: PROFILE EXTRAS

No migration is needed. Use the Owner tab.

- [ ] `PATCH /profile/me` with `{ "country": "  France ", "favoriteColors": [" Sage Green ", "NAVY"] }`
      → **200** with `country` "France" and `favoriteColors` ["sage green", "navy"]. `GET /profile/me` shows the same
- [ ] `PATCH /profile/me` with `{ "favoriteColors": ["red", "Red"] }` → **400** "invalid input" (the same color twice)
- [ ] `PATCH /profile/me` with 11 favorite colors → **400** "invalid input"
- [ ] `PATCH /profile/me` with `{ "favoriteColors": [" "] }` → **400** "invalid input" (an empty word)
- [ ] `PATCH /profile/me` with a `country` of 61 characters → **400** "invalid input"
- [ ] `PATCH /profile/me` with `{ "country": "", "favoriteColors": [] }` → **200**: no `country` in the answer,
      and `favoriteColors: []`. The other fields (like `city`) did not change
- [ ] `GET /profile/me` (Stranger, never set a color) → **200** with `favoriteColors: []` and no `country`

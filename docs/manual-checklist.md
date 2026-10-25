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

## WARDROBE

- [ ] `POST /wardrobe` (Owner) with `{ "name": "Blue shirt", "category": "hat" }`
      → **400** "invalid input"
- [ ] `POST /wardrobe` (Owner) with
      `{ "name": "Blue shirt", "category": "top", "ownerId": "<stranger-id>", "status": "archived" }`
      → **201**, and the answer has `ownerId` = `<owner-id>` and `status` = "active"
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
- [ ] `PATCH /wardrobe/<owner-item-id>/restore` (Owner) → **200**, `status` = "active"
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
      `{ "userId": "<their id>", "sizes": {}, "styles": [] }` and no `updatedAt`
- [ ] `PATCH /profile/me` (Owner) with `{ "displayName": "Owner One", "city": "Paris", "styles": ["minimal"] }`
      → **200** with those values and an `updatedAt`. `GET /profile/me` shows the same
- [ ] `GET /profile/me` (Stranger) → **200** with the stranger's OWN profile, never the owner's
- [ ] `PATCH /profile/me` (Owner) with `{}` → **400** "nothing to change"

## After PR 5

To fill in when PR 5 (`feat/wardrobe-2f`) is built: the new item fields, soft delete, wear,
the new filters and the new status values.

- [ ] ...

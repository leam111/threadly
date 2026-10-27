# Structure run: the plan

> **Replaced.** PR 1 to 3 below are merged. The rest of the work now follows
> [docs/finish-plan.md](finish-plan.md). This file is kept for history.

This file lets a new chat continue the work.
A new chat is told: "Read CLAUDE.md, docs/structure-run.md and docs/status.md, check git log to see
which PRs are merged, and continue with the first one that is not."

Rollback points: the tag `pre-structure-run` (main before the run started) and the tag `with-tests`
(main just before the automated tests were removed).

## Goal

Six separate pull requests, merged one after the other. This project has NO automated tests
(the owner's decision, revised spec). Each PR:

1. gets its own branch from the latest main,
2. has its own commits, and finishes with `npx tsc --noEmit`, `npm run lint` and
   `npm run format:check` all clean (run from `api/`),
3. updates `docs/manual-checklist.md` for the new behavior,
4. is opened as a pull request with the review table filled in (see below), and then the assistant
   STOPS: it never merges and never starts the next PR on its own,
5. is checked by the owner, who runs the manual checklist by hand and then tells the assistant to merge.
   Only then: `gh pr merge N --merge --delete-branch`.

After each merge: `git switch main`, `git pull`, and the three checks on main (must be clean).
Never start PR N+1 while PR N is unmerged or its checks are not clean.

## The six PRs, in this order

1. `chore/tidy-and-lint` (done, merged as #12)
2. `feat/migrations-and-seed` (done, merged as #13)
3. `feat/rbac-permissions`
4. `refactor/layers`
5. `feat/wardrobe-2f`
6. `feat/swagger-docs`

Extra PRs outside the plan: #14 `chore/jest-max-workers`, #15 `docs/status`, #16 `chore/env-example`,
and `chore/remove-tests-ci-stripe` (removes the automated tests and updates this plan).

How to know where you are: `git log --oneline --merges main` shows "Merge pull request #N from leam111/<branch>".
The first branch in the list above with no merge commit is the next one.

## Safety rules (obey always)

1. Rollback points: tags `pre-structure-run` and `with-tests` on main (already pushed).
2. NEVER run migrations, seeds or any script against the real database (`MONGODB_URI`).
   Only `MONGODB_URI_TEST` (a sandbox database, its name must contain `_test`) may be used by the
   assistant. The owner runs migrations on the real database. Every migrate and seed script must
   REFUSE to run when the database name does not contain `_test`, unless `CONFIRM_REAL_DB=yes` is set.
3. Never open, print or edit any `.env` file. Never print a secret. Add files by name, never
   `git add .`. No force push. Never `gh pr merge --admin`.
4. NO behavior change in PR 1 to 4 and 6. Every existing route keeps its path, status codes and
   exact messages ("item not found", "invalid id", "invalid id!", "invalid input", "invalid query",
   "nothing to change", "Log in first", "Log in again", "You are not allowed here",
   "Invalid email or password", and the rest). A stranger still gets 404 "item not found", never 403.
   Only PR 5 may rename status values.
5. If a check (tsc, lint or format check) fails and cannot be fixed in two tries, STOP and report.
6. If running out of room, STOP right after the last opened or merged PR and say which PR is next.
   Never leave a PR half merged.
7. Do not change CLAUDE.md or the .claude folder.
8. No automated tests: never write tests unless the owner asks.

## Rules for every remaining PR (3 to 6)

1. Finish with `npx tsc --noEmit` clean, `npm run lint` clean and `npm run format:check` clean.
2. Update `docs/manual-checklist.md` for the new behavior (requests, exact status and message).
3. Open the pull request, fill in the review table, and STOP: never merge, never start the next PR.
4. The owner runs the checklist by hand and then tells the assistant to merge.

## PR 1: tidy and lint (done)

- `.gitignore` (root and api): `.env` becomes `.env*`, but `.env.example` stays tracked (`!.env.example`).
- Fix the TypeScript errors. `npx tsc --noEmit` must be clean.
- The policy code checks the id twice (`loadAllowedItem` and `findItemFor`). Check it once.
  Keep every exported function unchanged.
- ESLint (typescript-eslint) and Prettier in `api/`. Scripts: `lint`, `lint:fix`, `format`,
  `format:check`. Reasonable rules: fix real problems, turn noisy style rules off.
  Do not format node_modules or the README.
- Two separate commits: tooling and config first, then "style: format the code with prettier"
  that changes ONLY formatting (prove it with `git diff -w`).

## PR 2: migrations and seed (done)

- migrate-mongo in `api/`: folder `api/migrations`, scripts `migrate:up`, `migrate:down`,
  `migrate:status`. Every migration has up and down and is idempotent. Obey safety rule 2.
- 001: drop the old index `ownerId_1` on `wardrobeitems` if it exists, and make sure the compound
  index `ownerId_1_createdAt_-1` exists.
- 002: a TTL index on `refreshtokens.expiresAt` (expireAfterSeconds 0). Also declare it in the
  RefreshToken model, with no duplicate or conflicting index. Explain why it is safe.
- Seed script `api/scripts/seedSuperadmin.ts`: reads `SEED_SUPERADMIN_EMAIL` and
  `SEED_SUPERADMIN_PASSWORD`, refuses when missing or when the password breaks the rules, creates a
  superadmin only if the email does not exist, promotes an existing user only with `--promote`,
  never prints the password. Add `.env.example` with variable NAMES only. Obey safety rule 2.
- README: how to run them.

## PR 3: permissions (spec section 4.2)

- Collections: Permissions (name like "user:ban", description), Roles (name, description, isSystem),
  RolePermissions (role name + permission name, unique pair). A user keeps ONE role (a role name).
  Many-to-many UserRoles is NOT built now. Write this decision in the README.
- Migration 003 seeds the 16 permissions and the 4 stored roles (member, moderator, admin, superadmin).
  "Guest" is NOT stored: a guest is a visitor with no login, and public routes need no login.
  - listing:read, wardrobe:manage_own, listing:create, listing:update_own, order:create, review:create,
    report:create (member and up)
  - listing:hide, listing:remove, report:resolve (moderator and up)
  - user:view, user:ban, order:refund, audit:view (admin and up)
  - role:assign, permission:edit (superadmin only)
  Each role includes everything below it. Idempotent (upsert).
- Guard `requirePermission(name)` after requireAuth: reads the permissions of the user's role from
  the database on every request (no cache). 403 "You are not allowed here" when missing.
  FAIL CLOSED when the role does not exist. Replace requireRole everywhere:
  GET /admin/users needs user:view, PATCH /admin/users/:id/active needs user:ban,
  GET /admin/audit needs audit:view, wardrobe routes need wardrobe:manage_own.
  Profile routes stay requireAuth only. Remove requireRole if nothing uses it.
- New admin routes, all audited (actions role.assign and permission.edit, with actor, target,
  details and ip):
  - GET /admin/roles and GET /admin/permissions (permission:edit).
  - PUT /admin/roles/:name/permissions (permission:edit), body `{ permissions: [names] }` replaces
    the list. Unknown permission: 400 "invalid input". Unknown role: 404 "role not found".
    The superadmin role can never lose role:assign or permission:edit:
    400 "superadmin must keep role:assign and permission:edit".
  - PATCH /admin/users/:id/role (role:assign), body `{ role }`. Bad id: 400 "invalid id!".
    Unknown user: 404 "user not found". Unknown role: 400 "invalid input".
    Your own role: 400 "you cannot change your own role".
    Only a superadmin can give or take the superadmin role: 403 "only a superadmin can change a superadmin".
    The last active superadmin cannot be demoted: 400 "there must be at least one superadmin".
    Also refuse switching off the last active superadmin in PATCH /admin/users/:id/active with the same 400.
- Manual checklist: every rule above, including: after the permission list of the admin role
  changes, an admin is refused at once. README: the permission matrix.

## PR 4: layers (controllers, services, repositories, DTOs)

- Folders `api/controllers`, `api/services`, `api/repositories`, `api/dtos`. `api/routes` stays as
  thin routers. Do NOT move files into a src folder.
- Routes only connect middleware to controllers. Controllers only read the request, call a service
  and send the answer. Services hold the business rules and know nothing about Express.
  Repositories contain ALL Mongoose queries (the only place that imports models, apart from models,
  seeds and migrations). DTOs are Zod input schemas plus small output mappers (like toItemDto).
- Simple dependency injection: services receive repositories through a factory
  (`makeItemService({ items })`), assembled in `api/container.ts`.
- Services report errors with a small `AppError(status, message)`. The error handler sends the
  message of an AppError and keeps its safe answers for everything else.
- ONE module per commit, in this order: profile, wardrobe (keep itemPolicy and its exports), admin,
  auth. `npx tsc --noEmit` and `npm run lint` after EACH commit. No new behavior, so the existing
  manual checklist must still pass unchanged. README: a short "how a request flows" diagram.

## PR 5: richer wardrobe 2F (in the layers from PR 4)

- Model, all optional: subCategory (trimmed, max 50); colors (list, max 5, each trimmed lowercase
  1 to 30, unique); pattern (trimmed, max 30); material (max 50); season (spring, summer, autumn,
  winter or all); styleTags (list, max 10, each trimmed lowercase 1 to 30, unique); condition
  (new_with_tags, like_new, very_good, good or fair); purchasePrice (0 to 1000000, 2 decimals);
  notes (max 500); wearCount (default 0, server-managed); lastWornAt (server-managed);
  isDeleted (default false) and deletedAt.
- status becomes in_closet (default), listed, sold or archived. The API cannot set listed or sold.
  Archive sets archived, restore sets in_closet.
- POST and PATCH accept the new fields with Zod. Unknown keys are dropped. An empty text clears an
  optional text field and an empty list clears a list. wearCount, lastWornAt, status, isDeleted and
  ownerId are NEVER accepted from the body.
- DELETE /wardrobe/:id is a SOFT delete (isDeleted true, deletedAt now). Owner only. A stranger or an
  already deleted item gets 404 "item not found". Answer 200 `{ message: "item deleted" }`.
  A deleted item disappears from lists and every route (404) and can no longer be edited, archived
  or restored. Never delete physically.
- POST /wardrobe/:id/wear: owner only, wearCount +1, lastWornAt now, answer the item.
- GET /wardrobe filters (Zod, combined freely inside the owner filter): status, category, color,
  season, styleTag, notWornDays (30, 60 or 90: lastWornAt older than that, or never worn).
  Deleted items never appear. Pages and the cap of 50 stay.
- The item answer hides __v, isDeleted and deletedAt.
- Index on ownerId + status. Migration 004 (up and down, idempotent): status "active" becomes
  "in_closet"; isDeleted false and wearCount 0 where missing.
- Manual checklist: fill in the "after PR 5" section (new fields, the stranger checks with 404 and
  updatedAt unchanged for edit, delete and wear, soft delete invisibility, the notWornDays filter,
  the new status values). Change the README and the checklist only where "active" is renamed to
  "in_closet".

## PR 6: Swagger

- swagger-ui-express and one OpenAPI 3 file describing EVERY route (auth, admin users, active, audit,
  roles, permissions, user role, wardrobe, profile): request bodies, responses with the real
  messages, the bearer token, the refresh cookie, and the permission each route needs.
- Serve /docs and /docs.json ONLY when NODE_ENV is not production. Loosen helmet only for /docs.
- Manual checklist: /docs opens, /docs.json loads and lists every path.
- README: how to open /docs and try a route with a token.

## Review table in every pull request (check, result, note)

1. No .env or secret in the diff or file list.
2. Every item lookup is still scoped by the owner from the token.
3. Messages unchanged.
4. Every refusal answers, then returns.
5. No query outside the repositories (after PR 4).
6. Migrations and seeds refuse the real database without the flag (after PR 2).
7. `npx tsc --noEmit`, `npm run lint` and `npm run format:check` clean.
8. `docs/manual-checklist.md` updated for the new behavior.
9. Any BLOCKER (security or data bug) means: say so in the PR, stop and report.

## Final report (after the last merge)

1. A table of the six PRs: number, title, merge commit.
2. tsc, lint and format check clean on main.
3. The exact commands the owner must run on the real database, in order, with `CONFIRM_REAL_DB`,
   to run `migrate:up` and the superadmin seed.
4. Every question or decision for the owner.
5. What is left, or what was changed on purpose.

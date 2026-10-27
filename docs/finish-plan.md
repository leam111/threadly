# Finish plan: Phase 1 and Phase 2

This file lets a new chat continue the work. It replaces the remaining part of
`docs/structure-run.md` (PR 1 to 3 of that plan are merged). Where the two differ, THIS file wins.

A new chat is told:

> Read CLAUDE.md, docs/finish-plan.md and docs/status.md. git switch main, git pull,
> git log --oneline -10. Do the next step that is not merged. Stop at its pull request.

Rollback tag: `before-layers` (main just before Step 1 started). Older tags: `pre-structure-run`,
`with-tests`.

## How to work

- Ask the owner NOTHING during a run. Collect every question for the final report of the step.
- Explain every step in short, easy English (the owner is a beginner).
- Five steps. Each step is its own branch and its own pull request. After EACH pull request: STOP.
  Never merge, never start the next step. The owner checks the pull request by hand with
  `docs/manual-checklist.md`, runs any migration, then says to merge and to continue.
- Do ONLY the step the owner asks for.
- How to know where you are: `git log --oneline --merges main` shows
  "Merge pull request #N from leam111/<branch>". The first step below with no merge commit is next.

## The five steps, in this order

1. `refactor/layers`: controllers, services, repositories and DTOs. No change in behavior.
2. `feat/wardrobe-2f`: the richer wardrobe.
3. `feat/profile-extras`: country and favorite colors.
4. `feat/image-upload`: image storage, item photos and the avatar.
5. `feat/swagger-docs`: Swagger.

## Start of every step

`git fetch`, `git switch main`, `git pull`. `git status` must be clean, or STOP.
Then `git switch -c <branch>`. (Step 1 also made the rollback tag `before-layers`.)

## Safety (obey always)

- Never open, print or edit any .env file. Never print, log or write any secret. Never touch the
  real database (`MONGODB_URI`). Never start the dev server: it connects to the real database.
  Use tsc, lint and format check only.
- Migrations and seeds may run on the SANDBOX only (`USE_TEST_DB=yes`) and must obey the existing
  safety lock. Never use `CONFIRM_REAL_DB`.
- Add files by name, never `git add .`. No force push. Never use `gh pr merge`. Do not touch the
  .claude folder. Write NO automated tests (the owner's decision).
- Every existing route keeps its path, status codes and messages, except what a step below adds or
  changes. A stranger always gets 404 "item not found", never 403. Every refusal answers, then returns.
- New packages: only the ones named below. Pick maintained versions with no high-severity advisory.
  Do NOT run `npm audit fix`.
- If something fails twice, or there is any doubt that data could be lost, STOP and tell the owner.
- Commit types: feat, fix, docs, chore (no space before the colon). A pure refactor uses `chore`.

## Quality gate for every step

1. `npx tsc --noEmit`, `npm run lint` and `npm run format:check` clean (from `api/`).
2. A route guard table in the pull request: every route, method, path, and its guard.
3. `docs/manual-checklist.md` updated with a new group for the step: exact request, expected status
   and message.
4. README and `docs/status.md` updated (what is merged, what is next, the exact resume message).
5. A review table: no .env or secret in the diff; every item lookup still scoped by the owner from the
   token; old messages unchanged; every refusal answers then returns; (after Step 1) no database
   query outside the repositories; migrations obey the lock.
6. Small commits, one idea each. `git push -u origin <branch>`, then `gh pr create --base main` with a
   clear title and the tables in the description. STOP.

## Step 1: layers

- New folders `api/controllers`, `api/services`, `api/repositories`, `api/dtos`. Keep `api/routes`
  as thin routers. Do not move files into a src folder.
- Routes only connect guards to controllers. Controllers only read the request, call a service and
  send the answer. Services hold the business rules and know nothing about Express. Repositories
  contain ALL Mongoose queries (the only files that import models, apart from models, migrations and
  scripts). This includes the queries inside requireAuth, requirePermission, the audit util and the
  item policy: they must use repositories too. DTOs are Zod input schemas plus small output mappers.
- Simple dependency injection: factories like `makeItemService({ items })`, assembled in one file
  `api/container.ts`.
- Services report errors with a small `AppError(status, message)`. The error handler sends the
  message of an AppError and keeps its safe answers for everything else.
- ONE module per commit, in this order: profile, wardrobe (keep itemPolicy and its exported
  functions), admin (users, audit, roles, permissions), auth (register, login, refresh, logout,
  logout-others, change-password, deactivate, me).
- No new behavior. Instead of tests, build a BEHAVIOR MAP: for every route, take the status codes and
  messages from the OLD file (`git show main:path`) and from the NEW files. They must be identical.
  Put the map in the pull request. Any difference is a BLOCKER: fix it first.
- Add a short "how a request flows" diagram to the README.

## Step 2: the richer wardrobe (written in the layers)

- Add the category "bag" to the category list (keep the other six). Put the category list, the status
  list and the other lists in ONE shared file.
- Model, all optional: subCategory (trimmed, max 50); colors (list, max 5, each trimmed lowercase
  1 to 30, unique); pattern (trimmed, max 30); material (max 50); season (spring, summer, autumn,
  winter or all); styleTags (list, max 10, each trimmed lowercase 1 to 30, unique); condition
  (new_with_tags, like_new, very_good, good or fair); purchasePrice (0 to 1000000, 2 decimals);
  notes (max 500); wearCount (default 0, server-managed); lastWornAt (server-managed);
  isDeleted (default false) and deletedAt.
- status becomes in_closet (default), listed, sold or archived. The API can only set archived
  (archive route) and in_closet (restore route); listed and sold belong to the marketplace later.
  Archive and restore stay idempotent (200 when repeated).
- POST and PATCH accept the new fields with Zod. Unknown keys are dropped. An empty text clears an
  optional text field and an empty list clears a list, as today. wearCount, lastWornAt, status,
  isDeleted and ownerId are NEVER accepted from the body.
- DELETE /wardrobe/:id is a SOFT delete (isDeleted true, deletedAt now), owner only, answer 200
  `{ message: "item deleted" }`. A deleted item disappears from lists and from every route
  (404 "item not found"). Never delete physically.
- POST /wardrobe/:id/wear: owner only, wearCount +1, lastWornAt now, answer the item.
- GET /wardrobe filters, validated by Zod and combined freely inside the owner filter: status,
  category, color, season, styleTag, notWornDays (30, 60 or 90: lastWornAt older than that, or never
  worn). Deleted items never appear. Pages and the cap of 50 stay.
- Item answers hide __v, isDeleted and deletedAt. Index on ownerId + status.
- Migration 004 (up and down, idempotent, obeying the lock): status "active" becomes "in_closet";
  isDeleted false and wearCount 0 where missing. Test it on the SANDBOX with scratch documents
  created by a script OUTSIDE the project: insert 2 sample items, run up, show them, run down, show
  them, delete the samples. Show the owner the output.

## Step 3: profile extras

- Profile: add country (trimmed, max 60, "" clears) and favoriteColors (list, max 10, each trimmed
  lowercase 1 to 30, unique, [] clears). Same answer rules as today: empty text fields left out,
  favoriteColors always a list. The seller rating is NOT built now (it comes with reviews).
  No migration needed: write that in the README.

## Step 4: image upload

- Packages: cloudinary and multer only. Settings come from process.env: `CLOUDINARY_CLOUD_NAME`,
  `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. If any is missing the server still starts (print
  one line with the missing NAMES only), and the upload routes answer 503 "image storage is not set up".
- Validation of every upload: field name "image", one file, max 5 MB, only JPEG, PNG or WebP, decided
  by the real file content (magic bytes), never by the client's mimetype or file name. Memory
  storage only (nothing is written to disk).
- Model ItemImage: itemId (ref WardrobeItem, required), ownerId (required), kind (original or cutout,
  default original; members can only create original, the cutout is for the AI service later), url,
  publicId (NEVER sent in answers), alt (trimmed, max 150, optional), width, height, bytes, mimeType,
  timestamps. Indexes: itemId + createdAt, and ownerId. Cloudinary folders:
  `threadly/items/<ownerId>` and `threadly/avatars`.
- Routes. Guard order for writes: writeLimiter, requireAuth, requirePermission("wardrobe:manage_own"),
  THEN multer (so an anonymous person cannot send a big file). Reads need requireAuth and the same
  permission.
  - POST /wardrobe/:id/images (multipart): owner only; the item is found with the policy (owner, not
    deleted), else 404 "item not found"; bad id 400 "invalid id"; no file 400 "image is required";
    wrong type 415 "only jpeg, png or webp images"; too large 413 "image too large (max 5 MB)"; more
    than 5 images on the item 409 "this item already has 5 images"; storage not set up 503; storage
    failure 502 "image storage failed" with nothing saved in the database. Answer 201 with the image
    (no publicId).
  - GET /wardrobe/:id/images: owner only, newest first, answer `{ items }`.
  - PATCH /wardrobe/:id/images/:imageId: only alt, "" clears, {} gives 400 "nothing to change".
  - DELETE /wardrobe/:id/images/:imageId: owner only. Delete from Cloudinary FIRST, then the database
    row. If Cloudinary fails: 502 "image storage failed" and keep the row, so the owner can retry.
    Success 200 `{ message: "image deleted" }`. An image that is not on that item or not mine:
    404 "image not found". Bad ids 400 "invalid id".
  - Item answers get coverUrl (the url of the oldest original image, or left out). Use ONE extra
    query per page of items, never one per item.
  - Avatar: POST /profile/me/avatar (same checks, writeLimiter and requireAuth) replaces the old
    avatar (destroy the old one only after the new one is saved); DELETE /profile/me/avatar. The
    profile answer includes avatarUrl when set; avatarPublicId is never sent.
- Migration 005: the indexes of ItemImage (obey the lock, up and down, demo on the sandbox as in
  Step 2).
- The assistant CANNOT reach Cloudinary (no keys). Do NOT fake or mock it. Write the code, keep tsc
  clean, and write the exact Postman steps in `docs/manual-checklist.md` (Body form-data, key image,
  type File). The owner tests with their own account. In the README: how to make a free Cloudinary
  account, and the three variable NAMES for `api/.env`. The owner adds them to `api/.env.example`.

## Step 5: Swagger

- swagger-ui-express and ONE OpenAPI 3 file describing EVERY route (auth, profile, admin users,
  active, role, audit, roles, permissions, wardrobe, images, avatar): request bodies, responses with
  the real messages, the bearer token, the refresh cookie, multipart for uploads, and the permission
  each route needs. Check it by loading the file with a small script OUTSIDE the project and
  comparing its paths with the route guard table: every route must appear.
- Serve /docs and /docs.json only when NODE_ENV is not production. Loosen the helmet policy only for
  /docs.
- README: how to open /docs and try a route with a token.

## Final report of each step (short)

1. The commits.
2. The route guard table.
3. The behavior map (Step 1) or the sandbox output (migrations).
4. The review table.
5. The pull request link.
6. The commands the owner must run (migrations on the real database, in PowerShell, with the lock
   flag) and what to test by hand.
7. Anything the owner should decide.

After Step 5, also give a table: each spec item of sections 4.1 to 4.4 and the data model, with
"done" and where, or the deliberate difference.

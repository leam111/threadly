# Status

Date: 2026-10-27 (after Step 5 was opened)

The plan is now [docs/finish-plan.md](finish-plan.md) (five steps to finish Phase 1 and 2).
The older plan, `docs/structure-run.md`, is kept for history: its PR 1 to 3 are merged.

## Merged pull requests

| PR | Branch | Merge commit |
|----|--------|--------------|
| #12 | chore/tidy-and-lint | 391b410 |
| #13 | feat/migrations-and-seed | 7430a53 |
| #14 | chore/jest-max-workers (extra) | 9a84b8c |
| #15 | docs/status (extra) | 96a1f3c |
| #16 | chore/env-example (extra) | 0c3de3c |
| #17 | chore/remove-tests-ci-stripe (extra) | 2586ce1 |
| #18 | feat/rbac-permissions | f3dbd92 |
| #19 | refactor/layers (Step 1) | bb57c29 |
| #20 | feat/wardrobe-2f (Step 2) | 0c267d3 |
| #21 | feat/profile-extras (Step 3) | 945ec3e |
| #22 | chore/env-example-supabase (extra) | aa195d6 |
| #23 | feat/image-upload (Step 4) | 27eeed8 |
| #24 | fix/supabase-url-origin (extra) | d431f47 |

## The five steps of docs/finish-plan.md

| Step | Branch | State |
|------|--------|-------|
| 1 | refactor/layers | merged (#19) |
| 2 | feat/wardrobe-2f | merged (#20) |
| 3 | feat/profile-extras | merged (#21) |
| 4 | feat/image-upload | merged (#23) |
| 5 | feat/swagger-docs | pull request open, waiting for the owner's check |

Rollback tag for this run: `before-layers` (main just before Step 1).

## No automated tests

The project has no automated tests (the owner's decision, revised spec).
The old tests are kept in the tag `with-tests`.
Work is checked with `npx tsc --noEmit`, `npm run lint`, `npm run format:check` (from `api/`)
and `docs/manual-checklist.md`, run by hand.

## Next

Step 5 (`feat/swagger-docs`) is the LAST step of [finish-plan.md](finish-plan.md).
Check it with the "STEP 5: SWAGGER" group of [manual-checklist.md](manual-checklist.md), then merge it.
No migration is needed for Step 5.

After it is merged, Phase 1 and Phase 2 are finished. Next comes a new plan (the React frontend,
the AI service, the marketplace): there is no next step in finish-plan.md.

The API docs live in `api/openapi.json`: when a route is added or changed, change that file too
(the Swagger page at `/docs` reads it).

Message to resume (only useful while a step of finish-plan.md is still not merged):

> Read CLAUDE.md, docs/finish-plan.md and docs/status.md. git switch main, git pull, git log --oneline -10. Do the next step that is not merged. Stop at its pull request.

## Warning

Migrations 003 and 004 must have run on the real database before the server starts
(from `api/`, PowerShell: `$env:CONFIRM_REAL_DB = "yes"; npm run migrate:up; Remove-Item Env:CONFIRM_REAL_DB`).
- Without 003, the permissions table is empty and refuses everyone: every admin and wardrobe route answers 403.
- Without 004, old items still say `active`: `status=in_closet` misses them, and archive or restore can fail with 500.

Migration 005 (item image indexes) should run on the real database before photos are uploaded.

Migrations 004 and 005 were tried on the sandbox only (insert 2 samples, up, down, delete the samples).
The sandbox has 004 and 005 pending again (and an empty `itemimages` collection).

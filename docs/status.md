# Status

Date: 2026-10-27

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

## The five steps of docs/finish-plan.md

| Step | Branch | State |
|------|--------|-------|
| 1 | refactor/layers | pull request open, waiting for the owner's check |
| 2 | feat/wardrobe-2f | not started |
| 3 | feat/profile-extras | not started |
| 4 | feat/image-upload | not started |
| 5 | feat/swagger-docs | not started |

Rollback tag for this run: `before-layers` (main just before Step 1).

## No automated tests

The project has no automated tests (the owner's decision, revised spec).
The old tests are kept in the tag `with-tests`.
Work is checked with `npx tsc --noEmit`, `npm run lint`, `npm run format:check` (from `api/`)
and `docs/manual-checklist.md`, run by hand.

## Next

Once Step 1 (`refactor/layers`) is merged: Step 2, `feat/wardrobe-2f`.

Message to resume:

> Read CLAUDE.md, docs/finish-plan.md and docs/status.md. git switch main, git pull, git log --oneline -10. Do the next step that is not merged. Stop at its pull request.

## Warning

Migration 003 must have run on the real database before the server starts
(`CONFIRM_REAL_DB=yes npm run migrate:up` from `api/`). An empty permissions table refuses everyone:
every admin and wardrobe route would answer 403.

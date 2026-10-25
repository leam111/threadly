# Status for tomorrow

Date: 2026-10-25

## Merged pull requests

| PR | Branch | Merge commit |
|----|--------|--------------|
| #12 | chore/tidy-and-lint | 391b410 |
| #13 | feat/migrations-and-seed | 7430a53 |
| #14 | chore/jest-max-workers (extra, not in the plan) | 9a84b8c |
| #15 | docs/status (extra) | 96a1f3c |
| #16 | chore/env-example (extra) | 0c3de3c |
| #17 | chore/remove-tests-ci-stripe (extra) | 2586ce1 |

Open, waiting for the owner's check: PR 3, `feat/rbac-permissions` (permissions, roles and role
assignment).

## No automated tests

The project has no automated tests any more (the owner's decision, revised spec).
The old tests are kept in the tag `with-tests`.
Work is checked with `npx tsc --noEmit`, `npm run lint`, `npm run format:check` (from `api/`)
and `docs/manual-checklist.md`, run by hand.

## PR 3: what changed from docs/structure-run.md

The owner's prompt for PR 3 overrode the plan in two places:
- 4 roles are stored (member, moderator, admin, superadmin), not 5: "guest" is not stored
  (a guest has no login, and public routes need no login).
- `PATCH /admin/users/:id/role` with the role the user already has answers 400 "nothing to change".

Migration 003 was tried on the sandbox only (up, down, up): 16 permissions, 4 roles, 47 rows.

## Next

Once `feat/rbac-permissions` is merged: PR 4, `refactor/layers`, as written in docs/structure-run.md.

Message to resume:

> Read CLAUDE.md, docs/structure-run.md and docs/status.md. Run git fetch, git switch main, git pull and git --no-pager log --oneline -6, then do PR 4 (refactor/layers) exactly as written, with all the safety rules. Finish with tsc, lint and format check clean, update docs/manual-checklist.md, open the pull request with the review table, and STOP. Do not merge.

## Warning

After PR 3 merges, do NOT start the real server until migration 003 was run on the real database
(`CONFIRM_REAL_DB=yes npm run migrate:up` from `api/`). An empty permissions table refuses everyone:
every admin and wardrobe route would answer 403.

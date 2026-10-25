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

Open, waiting for the owner's check: `chore/remove-tests-ci-stripe` (removes the automated tests,
the test tools, and updates the plan).

## No automated tests

The project has no automated tests any more (the owner's decision, revised spec).
The old tests are kept in the tag `with-tests`.
Work is checked with `npx tsc --noEmit`, `npm run lint`, `npm run format:check` (from `api/`)
and `docs/manual-checklist.md`, run by hand.

## Next

Once `chore/remove-tests-ci-stripe` is merged: PR 3, `feat/rbac-permissions`, as written in
docs/structure-run.md.

Message to resume:

> Read CLAUDE.md, docs/structure-run.md and docs/status.md. Run git fetch, git switch main, git pull and git --no-pager log --oneline -6, then do PR 3 (feat/rbac-permissions) exactly as written, with all the safety rules. Finish with tsc, lint and format check clean, update docs/manual-checklist.md, open the pull request with the review table, and STOP. Do not merge.

## Warning

After PR 3 merges, do NOT restart the real server until the migrations were run on the real database.

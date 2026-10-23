# Status for tomorrow

Date: 2026-10-23

## Merged pull requests

| PR | Branch | Merge commit |
|----|--------|--------------|
| #12 | chore/tidy-and-lint | 391b410 |
| #13 | feat/migrations-and-seed | 7430a53 |
| #14 | chore/jest-max-workers (extra, not in the plan) | 9a84b8c |

## Last npm test on main

At 9a84b8c: 15 of 15 files and 154 of 154 tests passed (with maxWorkers: 2).

## Next

PR 3: `feat/rbac-permissions`, as written in docs/structure-run.md.

Message to resume:

> Read CLAUDE.md, docs/structure-run.md and docs/status.md. Run git fetch, git switch main, git pull and git --no-pager log --oneline -6, then continue with PR 3 (feat/rbac-permissions) exactly as written, with all the safety rules.

## Warning

After PR 3 merges, do NOT restart the real server until the migrations were run on the real database.

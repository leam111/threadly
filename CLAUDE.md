# Threadly rules
- Stack: Node 22, Express 5, TypeScript, MongoDB with Mongoose, Zod.
- The backend is in api/. Run npm commands from api/.
- Never open, print or edit .env files. MONGODB_URI_TEST is a sandbox database for trying migrations, not for tests (its name must contain _test).
- One branch per task. Commit types: feat, fix, docs, chore, with no space before the colon.
- Routes: check the input with Zod first, answer then return, one message for every login failure.
- No automated tests in this project (my decision, revised spec). Check work with npx tsc --noEmit, npm run lint, npm run format:check and docs/manual-checklist.md. Never write tests unless I ask.
- Explain things in short, easy English. The author is a beginner who wants to understand.
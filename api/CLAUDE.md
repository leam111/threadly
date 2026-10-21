# Threadly rules
- Stack: Node 22, Express 5, TypeScript, MongoDB with Mongoose, Zod, Jest and Supertest.
- The backend is in api/. Run npm commands from api/.
- Never open, print or edit .env files. Tests use MONGODB_URI_TEST (its name must contain _test).
- One branch per task. Commit types: feat, fix, test, docs, chore, with no space before the colon.
- Routes: check the input with Zod first, answer then return, one message for every login failure.
- Every new route needs tests, and npm test must pass.
- Explain things in short, easy English. The author is a beginner who wants to understand.
# Threadly

An AI wardrobe and resale marketplace.
Snap your clothes. Style your closet. Sell what you no longer wear.

This is an individual portfolio project, built step by step to learn the full life of a web app.

## Status

- Phase 0: setup (done)
- Phase 1: authentication, roles and accounts (done, with automated tests)
- Phase 2: the wardrobe and the member profile (done, with automated tests)
- Phase 3 and later: not started

### What works today

**Accounts and login**
- Register with email and password (hashed with bcrypt). Passwords need 8+ characters, a letter and a number
- Login with a signed access token (JWT, 15 minutes)
- Refresh tokens: 7 days, saved only as a hash in MongoDB, sent in an httpOnly cookie
- Rotation: every refresh gives a new refresh token and marks the old one as used
- Reuse detection: a used token shown again cancels its whole login family, and only that family
- Logout, and "log out everywhere else"
- Change password (needs the current password, and ends every session)
- Deactivate your own account (needs the password, and ends every session)

**Protection**
- `requireAuth` guard: checks the token, then checks in the database that the user is still active
- `requireRole` guard: a simple list of allowed roles, 403 for the wrong role
- Rate limits: login 6 per minute, register 5 per hour, refresh 10 per minute, and change password, deactivate and logout-others 5 per 15 minutes. The wardrobe and profile write routes (adding, editing, archiving and restoring items, and editing the profile) share one limit of 60 per 15 minutes. Limits count per IP address and live in memory, so a server restart resets them
- Login does the same bcrypt work for every email, so response time does not reveal which emails exist
- CORS: only the frontend address may call the API, and cookies are allowed
- Security headers (helmet)
- Unknown routes get a JSON 404 (`route not found`)
- An error handler answers with JSON only: 500 `something went wrong` for server errors, and the 4xx code for client errors like broken JSON. It never sends stack traces or error details

**Admin**
- List users with pages, and filter by email, role or status. Never sends the password hash
- Switch a user on or off. Switching off also cancels that user's refresh tokens
- Safety rules: nobody can switch off their own account, and only a superadmin can change a superadmin
- Audit log: records admin user switches and admin logins (success and failure). Read-only, newest first, with pages and a page size cap of 50

**Wardrobe**
- Add a clothing item: name, category, and optional brand, color and size. Text is trimmed and has a length limit
- List your items, newest first, with pages (page size cap of 50) and filters by category and status
- See, edit, archive and restore one item. There is no delete: archive hides an item, restore brings it back
- The owner always comes from the token, never from the body or the address. An `ownerId` or `status` sent in the body is ignored
- An item policy (`policies/itemPolicy.ts`) decides in one place who may see, edit, archive or restore an item. For now, only the owner
- A stranger asking for someone else's item gets 404 `item not found`, the same answer as for an item that does not exist, so nobody learns which items exist

**Member profile**
- Each member has one profile: display name, bio, city, sizes (top, bottom, dress, shoes) and up to 5 styles from a fixed list
- You can only read and change your own profile. There is no id in the address
- Reading before you have a profile gives an empty default and writes nothing. The first change creates the profile

### Not built yet

- Permissions that can be edited at runtime (roles are a simple list for now)
- Splitting the routes into controller, service and repository layers
- Swagger docs, migrations, lint rules
- The React frontend, the AI service, and the whole marketplace

## Tech

- Node.js, Express 5, TypeScript
- MongoDB (Atlas) with Mongoose
- JSON Web Tokens (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- Validation (`zod`)
- Rate limiting (`express-rate-limit`)
- Cookies (`cookie-parser`), CORS (`cors`), security headers (`helmet`)
- Tests: Jest and Supertest, against a separate test database

## Project layout

```
threadly/
└── api/
    ├── index.ts          starts the server
    ├── app.ts            builds the app: middleware, routes, 404 and error handler
    ├── db.ts             connects to MongoDB
    ├── models/           data plans: User, RefreshTokens, AuditLog, WardrobeItem, Profile
    ├── routes/           auth.ts, admin.ts, wardrobe.ts and profile.ts
    ├── middleware/       guards (requireAuth, requireRole) and rate limiters
    ├── policies/         itemPolicy.ts: who may do what to a wardrobe item
    ├── utils/            token helpers, password rules, the audit log writer,
    │                     and the allowed values for items and profiles
    └── tests/            Jest and Supertest tests
```

## Endpoints

| Method | Path | Who | What it does |
|---|---|---|---|
| POST | `/auth/register` | anyone | Create an account |
| POST | `/auth/login` | anyone | Log in. Gives an access token and a refresh cookie |
| POST | `/auth/refresh` | has the cookie | Swap the cookie for a new access token (rotation) |
| POST | `/auth/logout` | anyone | Cancel this device's refresh token and clear the cookie |
| POST | `/auth/logout-others` | logged in | Cancel every other device's refresh token |
| POST | `/auth/change-password` | logged in | Change the password and end every session |
| POST | `/auth/deactivate` | logged in | Switch your own account off |
| GET | `/auth/me` | logged in | Who am I? |
| PATCH | `/admin/users/:id/active` | admin, superadmin | Switch a user on or off |
| GET | `/admin/users` | admin, superadmin | List users. Query: page, limit, email, role, status |
| GET | `/admin/audit` | admin, superadmin | Read the audit log. Query: page, limit, action |
| POST | `/wardrobe` | logged in | Add an item to my wardrobe |
| GET | `/wardrobe` | logged in | List my items. Query: page, limit, category, status |
| GET | `/wardrobe/:id` | the owner | See one of my items |
| PATCH | `/wardrobe/:id` | the owner | Change name, category, brand, color or size |
| PATCH | `/wardrobe/:id/archive` | the owner | Archive an item |
| PATCH | `/wardrobe/:id/restore` | the owner | Put an archived item back to active |
| GET | `/profile/me` | logged in | Read my profile (an empty default if I have none yet) |
| PATCH | `/profile/me` | logged in | Create or change my profile |

## Run it locally

You need Node.js 22 and a free MongoDB Atlas cluster.

1. Go into the api folder and install packages:
```
   cd api
   npm install
```
2. Create `api/.env` (never commit this file):
```
   MONGODB_URI=your-atlas-connection-string
   MONGODB_URI_TEST=a-second-connection-string-for-tests
   JWT_SECRET=a-long-random-text
   FRONTEND_ORIGIN=http://localhost:5173
```
   `FRONTEND_ORIGIN` is optional. It falls back to `http://localhost:5173`.
   `MONGODB_URI_TEST` is only for tests. Its database name must contain `_test`, or the tests refuse to start.
3. Start the server:
```
   npm run dev
```
   You should see `Connected to MongoDB`, then `server is running on port 3000`.

## Run the tests

From the api folder:
```
   npm test
```
There are 117 tests in 13 files. They run against the `MONGODB_URI_TEST` database. The newer test files delete every user, token, audit row, wardrobe item and profile they create. Two older files still leave a little behind: `auth.test.ts` leaves refresh tokens, and `adminUsers.test.ts` leaves audit rows.
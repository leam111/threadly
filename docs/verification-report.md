# Verification report

Verified by a script on 2026-11-02, not by hand.

This report does NOT tick any box in [manual-checklist.md](manual-checklist.md). The boxes stay for the
owner's own check by hand.

## How it was done

- A small script (kept outside the project, never committed) went through
  [manual-checklist.md](manual-checklist.md) box by box and sent the box's requests.
- Database: a throw-away MongoDB **in memory** (mongodb-memory-server with MongoDB 7.0.24). It is
  deleted when the script ends. No real database, no sandbox database, no Atlas, no Supabase was used.
  No `.env` file was read: every setting was a made-up value (for example a made-up `JWT_SECRET`).
- The app (`api/app.ts`) was loaded as it is, listened on a random port, and got **real HTTP
  requests** (fetch). So headers, `Set-Cookie`, the error handler and the rate limits worked as in the
  real server. The refresh cookie was read from `Set-Cookie` and sent back by hand.
- Every group ran in a **fresh app with a fresh database**, so no limit and no data carried over
  (the same as restarting the server).
- The roles and permissions came from migration 003 itself (its `up` was run, with 001, 002, 004 and
  005): 4 roles, 16 permissions, 47 role-permission rows, checked in every run.
- Users (owner, stranger, admin, superadmin, member, a second superadmin) were made with
  `POST /auth/register` and `POST /auth/login`. The admin and superadmin roles were set in the
  database, as the checklist says ("Make the roles by hand in the database").
- Step 4: Supabase was NOT faked. Only the cases that answer before the storage is reached were run
  (401, "image is required", 415, 413, bad ids, 404), plus 503 (no `SUPABASE_BUCKET`) and 502. For the
  502 case `SUPABASE_URL` was `http://127.0.0.1:9` (an address where nobody listens), so the storage
  could not be reached.
- Step 5: `/docs`, `/docs.json`, the `Content-Security-Policy` headers, and `/docs` with
  `NODE_ENV=production` (a fresh app).
- Results: **PASS** (status AND message as written in the box), **FAIL** (what came back versus the
  box), **SKIPPED** (it needs real Supabase, a browser, the dashboard or human eyes). When only a part of a
  box could run, the box is SKIPPED and its note says which part ran and passed.

## Totals

| Group | Boxes | PASS | FAIL | SKIPPED |
|---|---|---|---|---|
| AUTH | 13 | 13 | 0 | 0 |
| ADMIN | 7 | 7 | 0 | 0 |
| PERMISSIONS | 24 | 24 | 0 | 0 |
| WARDROBE | 15 | 15 | 0 | 0 |
| PROFILE | 4 | 4 | 0 | 0 |
| STEP 1: LAYERS | 16 | 16 | 0 | 0 |
| STEP 2: THE RICHER WARDROBE | 27 | 27 | 0 | 0 |
| STEP 3: PROFILE EXTRAS | 7 | 7 | 0 | 0 |
| STEP 4: PHOTOS AND THE AVATAR | 47 | 23 | 0 | 24 |
| STEP 5: SWAGGER | 16 | 6 | 0 | 10 |
| **All** | **176** | **142** | **0** | **34** |

## AUTH

| Box | Result | Note |
|---|---|---|
| register with a short password → 400 | PASS |  |
| register owner and stranger → 201 | PASS |  |
| register the same email again → 409 | PASS |  |
| login with a wrong password → 401 | PASS |  |
| login with an unknown email → 401 (same answer) | PASS |  |
| login right → 200 with accessToken, user and cookie | PASS |  |
| GET /auth/me with no token → 401 | PASS |  |
| GET /auth/me with the owner token → 200 | PASS |  |
| refresh → 200 with a new token and a new cookie | PASS |  |
| refresh with the OLD cookie → 401, then the NEW one → 401 (family cancelled) | PASS |  |
| logout-others: device B is out, device A still refreshes | PASS |  |
| change-password → 200, old cookies → 401, new password logs in | PASS |  |
| 7 wrong logins within one minute → 6× 401, then 429 | PASS | Run in a fresh app (the same as restarting the server). |

## ADMIN

| Box | Result | Note |
|---|---|---|
| GET /admin/users as a member → 403 | PASS |  |
| GET /admin/users as admin → 200, no passwordHash | PASS |  |
| admin switches off their own account → 400 | PASS |  |
| admin switches off a superadmin → 403 | PASS |  |
| admin switches off a member → 200; their token and cookie stop working | PASS |  |
| GET /admin/audit?action=user.deactivate → newest row is the member | PASS |  |
| switch the member back on → 200 | PASS |  |

## PERMISSIONS

| Box | Result | Note |
|---|---|---|
| a member is refused on admin routes → 403 | PASS |  |
| GET /admin/users as admin → 200 | PASS |  |
| GET /admin/roles and /admin/permissions as admin → 403 | PASS |  |
| PUT role permissions and PATCH a role as admin → 403 | PASS |  |
| GET /wardrobe as a member → 200 | PASS |  |
| GET /profile/me and /auth/me as a member → 200 | PASS |  |
| GET /admin/permissions as superadmin → 200 with 16 items | PASS |  |
| GET /admin/roles as superadmin → 4 roles: 7, 10, 14, 16 | PASS |  |
| remove user:view from admin → 200, admin refused at once | PASS |  |
| put the full admin list back → 200, admin gets in at once | PASS |  |
| GET /admin/audit?action=permission.edit → role, added, removed, ip, no targetId | PASS |  |
| PUT with a made-up permission → 400 | PASS |  |
| PUT with permissions not a list → 400 | PASS |  |
| PUT /admin/roles/nobody/permissions → 404 | PASS |  |
| superadmin must keep role:assign and permission:edit → 400 | PASS |  |
| PATCH /admin/users/abc/role → 400 invalid id! | PASS |  |
| PATCH an unknown user's role → 404 | PASS |  |
| PATCH role "boss" or {} → 400 invalid input | PASS |  |
| superadmin changes their own role → 400 | PASS |  |
| the role the user already has → 400 nothing to change | PASS |  |
| member → moderator → 200, audit row, then back | PASS |  |
| only a superadmin can change a superadmin (admin with role:assign → 403) | PASS |  |
| the last superadmin always stays | PASS |  |
| with TWO superadmins, one may become admin → 200 | PASS |  |

## WARDROBE

| Box | Result | Note |
|---|---|---|
| POST category "hat" → 400 | PASS |  |
| POST with a fake ownerId and status → 201, both ignored | PASS |  |
| GET /wardrobe (Owner) → only the owner's items | PASS |  |
| GET /wardrobe?ownerId=<owner-id> (Stranger) → total 0 | PASS |  |
| GET /wardrobe/<owner-item-id> (Owner) → 200 | PASS |  |
| GET a made-up id → 404 | PASS |  |
| GET the owner's item as Stranger → 404 (same answer) | PASS |  |
| GET /wardrobe/abc → 400 | PASS |  |
| GET an item with no token → 401 | PASS |  |
| archive (Owner) → 200 archived | PASS |  |
| restore (Owner) → 200 in_closet | PASS |  |
| Stranger archive/restore → 404, updatedAt and status unchanged | PASS |  |
| PATCH {} → 400 nothing to change | PASS |  |
| PATCH category "hat" → 400 | PASS |  |
| Stranger PATCH name → 404, owner keeps the name | PASS |  |

## PROFILE

| Box | Result | Note |
|---|---|---|
| GET /profile/me with no profile yet → the empty default | PASS |  |
| PATCH displayName, city, styles → 200; GET shows the same | PASS |  |
| GET /profile/me (Stranger) → their own profile | PASS |  |
| PATCH {} → 400 nothing to change | PASS |  |

## STEP 1: LAYERS

| Box | Result | Note |
|---|---|---|
| run every group above again (AUTH, ADMIN, PERMISSIONS, WARDROBE, PROFILE) | PASS | Those groups ran in this same run, on the current code: 63 boxes, 0 FAIL. |
| GET /nothing-here → 404 | PASS |  |
| broken JSON → 400 bad request | PASS |  |
| a service refusal keeps its message → 404 | PASS |  |
| PATCH /wardrobe/abc {} → 400 nothing to change | PASS |  |
| PATCH /wardrobe/abc {name} → 400 invalid id | PASS |  |
| PATCH /wardrobe/abc {category "hat"} → 400 invalid input | PASS |  |
| PATCH /admin/users/abc/active: {} → invalid input, then invalid id! | PASS |  |
| PATCH unknown user role "boss" → 404 (user checked first) | PASS |  |
| POST /auth/refresh with no cookie → 401 log in first | PASS |  |
| POST /auth/logout-others with no cookie → 401 log in first | PASS |  |
| GET /auth/me with no token → 401 Log in first | PASS |  |
| POST /auth/logout with no cookie → 200 | PASS |  |
| GET /wardrobe → page, limit, total, items, no __v | PASS | One item was made first, so the list is not empty. |
| POST /auth/login → user has id, email, role only | PASS |  |
| GET /admin/roles → name, description, isSystem, permissions | PASS |  |

## STEP 2: THE RICHER WARDROBE

| Box | Result | Note |
|---|---|---|
| POST the Tote with every new field → 201, cleaned values | PASS |  |
| POST the Cap with server fields → all ignored | PASS |  |
| colors ["red", "Red"] → 400 | PASS |  |
| 6 colors or 11 styleTags → 400 | PASS |  |
| purchasePrice 10.999, -1, 1000000.01 → 400; 0.1 → 201 | PASS |  |
| season "monsoon" or condition "broken" → 400 | PASS |  |
| notes of 501 characters → 400 | PASS |  |
| PATCH clears season, colors, purchasePrice, notes → 200 | PASS |  |
| PATCH only wearCount and status → 400 nothing to change | PASS |  |
| archive twice → 200 both times | PASS |  |
| restore twice → 200 both times | PASS |  |
| status=active → 400; status=in_closet → 200 | PASS |  |
| wear → 200 wearCount 1 and lastWornAt now; again → 2 | PASS |  |
| POST /wardrobe/abc/wear → 400 | PASS |  |
| a Stranger changes nothing (404, updatedAt stays) | PASS |  |
| category=bag → only bags; color=NAVY → items with navy | PASS | Before the filters, the Tote's season "all" and colors were put back (the "Edit and clear" box above removed them). |
| season=all&styleTag=minimal → only items with both | PASS | Before the filters, the Tote's season "all" and colors were put back (the "Edit and clear" box above removed them). |
| season=summer → summer item and the Tote, not winter; season=all → only "all" | PASS | Before the filters, the Tote's season "all" and colors were put back (the "Edit and clear" box above removed them). |
| notWornDays=30 → the Cap is in, the Tote is not | PASS |  |
| notWornDays=45 or season=monsoon → 400 invalid query | PASS |  |
| limit=500 → limit 50 | PASS |  |
| ownerId=<owner-id> (Stranger) → only the Stranger's items | PASS | The Stranger was given one item first, so the list is not empty. |
| DELETE /wardrobe/abc → 400 | PASS |  |
| DELETE the Tote → 200 item deleted | PASS |  |
| after the delete, every route → 404 | PASS |  |
| GET /wardrobe → the deleted item is gone, total down by 1 | PASS |  |
| in the database the item is still there, isDeleted true and a deletedAt | PASS | Checked in the in-memory database (the same collection), not in Atlas. |

## STEP 3: PROFILE EXTRAS

| Box | Result | Note |
|---|---|---|
| country and favoriteColors are cleaned → 200; GET the same | PASS |  |
| favoriteColors ["red", "Red"] → 400 | PASS |  |
| 11 favorite colors → 400 | PASS |  |
| favoriteColors [" "] → 400 | PASS |  |
| country of 61 characters → 400 | PASS |  |
| country "" and favoriteColors [] → cleared, city unchanged | PASS | The city was set to "Paris" first, to see that it did not change. |
| GET /profile/me (Stranger) → favoriteColors [] and no country | PASS |  |

## STEP 4: PHOTOS AND THE AVATAR

| Box | Result | Note |
|---|---|---|
| upload with no token → 401 | PASS |  |
| upload with no body → 400 image is required | PASS |  |
| file under the key "photo" → 400 image is required | PASS |  |
| two "image" files → 400 only one image at a time | PASS |  |
| fake.jpg (a text file) → 415 | PASS |  |
| a GIF → 415 | PASS |  |
| a photo bigger than 5 MB → 413 | PASS |  |
| alt of 151 characters → 400 | PASS |  |
| /wardrobe/abc/images → 400 invalid id | PASS |  |
| /wardrobe/000…/images → 404 | PASS |  |
| the owner's item with the Stranger token → 404 | PASS |  |
| the JPEG with alt → 201 with the image, no storagePath | SKIPPED | Needs a real Supabase project (the script does not fake it). Without it the answer was 503 "image storage is not set up". |
| the url opens; without the ? part it does not | SKIPPED | Needs a real Supabase project (the script does not fake it). Also needs a browser. |
| the file path in the Supabase dashboard | SKIPPED | Needs a real Supabase project (the script does not fake it). Also needs the dashboard. |
| the PNG named photo.jpg → 201 image/png, .png in the dashboard | SKIPPED | Needs a real Supabase project (the script does not fake it). |
| the WebP with kind "cutout" → 201 kind "original" | SKIPPED | Needs a real Supabase project (the script does not fake it). |
| a 6th photo → 409 | SKIPPED | Needs a real Supabase project (the script does not fake it). (5 photos must be stored first). |
| GET images (Owner) → newest first, url, no storagePath | SKIPPED | Needs a real Supabase project (the script does not fake it). The part that could run passed: GET answered 200 with { items: [] }. |
| GET images with the Stranger token → 404 | PASS |  |
| coverUrl on GET /wardrobe and GET /wardrobe/<id> | SKIPPED | Needs a real Supabase project (the script does not fake it). |
| PATCH alt "back view" → 200 with a fresh url | SKIPPED | Needs a real Supabase project (the script does not fake it). |
| PATCH alt "" → 200 with no alt | SKIPPED | Needs a real Supabase project (the script does not fake it). |
| PATCH image {} → 400 nothing to change | PASS | No photo can exist without Supabase, so a made-up image id was used; the answer comes before the image is looked up. |
| PATCH image alt of 151 characters → 400 | PASS | No photo can exist without Supabase, so a made-up image id was used; the answer comes before the image is looked up. |
| PATCH images/abc → 400 invalid id | PASS |  |
| PATCH images/000… → 404 image not found; a photo of another item → 404 | SKIPPED | Needs a real Supabase project (the script does not fake it). (a photo of another item must exist) The part that could run passed: images/000… answered 404 "image not found". |
| PATCH <image-1> as Stranger → 404, the owner keeps the alt | SKIPPED | Needs a real Supabase project (the script does not fake it). (the owner's alt must exist) The part that could run passed: with a made-up image id the Stranger got 404 "item not found". |
| DELETE <image-1> as Stranger → 404 item not found | PASS | No photo can exist without Supabase, so a made-up image id was used; the answer comes before the image is looked up. |
| DELETE <image-1> (Owner) → 200, file gone, cover moves on | SKIPPED | Needs a real Supabase project (the script does not fake it). Also needs the dashboard. |
| the same DELETE again → 404 image not found | PASS | An image that is not there was used (the same thing as a deleted one): No photo can exist without Supabase, so a made-up image id was used; the answer comes before the image is looked up. |
| DELETE /wardrobe/abc/images/<image-1> → 400 | PASS |  |
| after a soft delete of the item, GET images → 404 | PASS | Done on a second item of the owner, so the first one stays for the other boxes. |
| avatar with no token → 401 | PASS |  |
| avatar: no file → 400, GIF → 415, big photo → 413 | PASS |  |
| avatar JPEG → 200 with avatarUrl | SKIPPED | Needs a real Supabase project (the script does not fake it). Without it the answer was 503 "image storage is not set up". |
| avatar PNG → 200, still ONE file in the dashboard | SKIPPED | Needs a real Supabase project (the script does not fake it). Also needs the dashboard. |
| GET and PATCH /profile/me → both with avatarUrl | SKIPPED | Needs a real Supabase project (the script does not fake it). |
| GET /profile/me (Stranger) → no avatarUrl | SKIPPED | Needs a real Supabase project (the script does not fake it). (only means something when the owner has an avatar). |
| DELETE /profile/me/avatar → 200 avatar deleted | SKIPPED | Needs a real Supabase project (the script does not fake it). Also needs the dashboard. |
| DELETE /profile/me/avatar again → 404 avatar not found | PASS | The owner never had an avatar (the same thing as after a delete). |
| missing SUPABASE_BUCKET: one start line, the server still starts | PASS | A fresh app with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set to made-up values and no SUPABASE_BUCKET. |
| upload → 503, avatar → 503, DELETE of a photo → 503 | SKIPPED | Needs a real Supabase project (the script does not fake it). (the DELETE needs a stored photo) The part that could run passed: the upload and the avatar both answered 503. |
| GET /wardrobe and GET images → 200 with no coverUrl or url | SKIPPED | Needs a real Supabase project (the script does not fake it). (with no stored photo there is no link to leave out) The part that could run passed: both answered 200. |
| remove the "#" again and restart | SKIPPED | A setup step, not a check. |
| storage fails → upload 502, nothing saved; DELETE 502; fixed → 200 | SKIPPED | Needs a real Supabase project (the script does not fake it). (the DELETE needs a stored photo, and the fix needs a real bucket) The part that could run passed: with SUPABASE_URL = http://127.0.0.1:9 (nobody listens there), the upload answered 502 "image storage failed" and GET images showed no new photo. |
| note about a paused Supabase project | SKIPPED | Needs a real Supabase project (the script does not fake it). |
| nothing secret in the log | SKIPPED | A real signed link was never made, so the full check needs real Supabase. The part that could run passed: in the 502 run the log never showed the (made-up) service key or "token=". |

## STEP 5: SWAGGER

| Box | Result | Note |
|---|---|---|
| /docs shows "Threadly API" with five groups, nothing red | SKIPPED | Needs a browser and human eyes. (GET /docs answered 200 with an HTML page.) |
| /docs/ with a slash → the same page | PASS | fetch follows the redirect from /docs to /docs/, as a browser does. |
| F12 console: no Content Security Policy error | SKIPPED | Needs a browser. |
| /docs.json → 200, starts with "openapi": "3.0.3" | PASS |  |
| 31 routes (8 auth, 4 profile, 7 admin, 8 wardrobe, 4 images), every README row | PASS | Counted in /docs.json (the file the page shows), not by eye on the page. |
| Try it out: GET /auth/me with no token → 401 | SKIPPED | Needs a browser (the Swagger page). |
| Try it out: login, then Authorize with the token | SKIPPED | Needs a browser (the Swagger page). |
| Try it out: GET /auth/me → 200, Curl shows the Bearer header | SKIPPED | Needs a browser (the Swagger page). |
| Try it out: POST /auth/refresh → 200 (the browser sends the cookie) | SKIPPED | Needs a browser (the browser's own cookie is the point of this box). |
| Try it out: GET /admin/users as a member → 403, description says user:view | SKIPPED | Needs a browser. (In /docs.json the description does say "Permission: `user:view`".) |
| Try it out: GET /wardrobe → 200 | SKIPPED | Needs a browser (the Swagger page). |
| Try it out: POST /wardrobe/{id}/images has a Choose File button | SKIPPED | Needs a browser, and real Supabase for the 201. |
| Authorize > Logout, then GET /auth/me → 401 | SKIPPED | Needs a browser (the Swagger page). |
| GET /docs/ → CSP without upgrade-insecure-requests | PASS |  |
| GET /auth/me → CSP with upgrade-insecure-requests | PASS |  |
| NODE_ENV=production: /docs and /docs.json → 404 route not found | PASS | A fresh app with NODE_ENV=production. |

## Every FAIL

None. Every box that could run gave the status AND the message written in the checklist.

## Every SKIPPED, with its reason

- **STEP 4: PHOTOS AND THE AVATAR / the JPEG with alt → 201 with the image, no storagePath**: Needs a real Supabase project (the script does not fake it). Without it the answer was 503 "image storage is not set up".
- **STEP 4: PHOTOS AND THE AVATAR / the url opens; without the ? part it does not**: Needs a real Supabase project (the script does not fake it). Also needs a browser.
- **STEP 4: PHOTOS AND THE AVATAR / the file path in the Supabase dashboard**: Needs a real Supabase project (the script does not fake it). Also needs the dashboard.
- **STEP 4: PHOTOS AND THE AVATAR / the PNG named photo.jpg → 201 image/png, .png in the dashboard**: Needs a real Supabase project (the script does not fake it).
- **STEP 4: PHOTOS AND THE AVATAR / the WebP with kind "cutout" → 201 kind "original"**: Needs a real Supabase project (the script does not fake it).
- **STEP 4: PHOTOS AND THE AVATAR / a 6th photo → 409**: Needs a real Supabase project (the script does not fake it). (5 photos must be stored first).
- **STEP 4: PHOTOS AND THE AVATAR / GET images (Owner) → newest first, url, no storagePath**: Needs a real Supabase project (the script does not fake it). The part that could run passed: GET answered 200 with { items: [] }.
- **STEP 4: PHOTOS AND THE AVATAR / coverUrl on GET /wardrobe and GET /wardrobe/<id>**: Needs a real Supabase project (the script does not fake it).
- **STEP 4: PHOTOS AND THE AVATAR / PATCH alt "back view" → 200 with a fresh url**: Needs a real Supabase project (the script does not fake it).
- **STEP 4: PHOTOS AND THE AVATAR / PATCH alt "" → 200 with no alt**: Needs a real Supabase project (the script does not fake it).
- **STEP 4: PHOTOS AND THE AVATAR / PATCH images/000… → 404 image not found; a photo of another item → 404**: Needs a real Supabase project (the script does not fake it). (a photo of another item must exist) The part that could run passed: images/000… answered 404 "image not found".
- **STEP 4: PHOTOS AND THE AVATAR / PATCH <image-1> as Stranger → 404, the owner keeps the alt**: Needs a real Supabase project (the script does not fake it). (the owner's alt must exist) The part that could run passed: with a made-up image id the Stranger got 404 "item not found".
- **STEP 4: PHOTOS AND THE AVATAR / DELETE <image-1> (Owner) → 200, file gone, cover moves on**: Needs a real Supabase project (the script does not fake it). Also needs the dashboard.
- **STEP 4: PHOTOS AND THE AVATAR / avatar JPEG → 200 with avatarUrl**: Needs a real Supabase project (the script does not fake it). Without it the answer was 503 "image storage is not set up".
- **STEP 4: PHOTOS AND THE AVATAR / avatar PNG → 200, still ONE file in the dashboard**: Needs a real Supabase project (the script does not fake it). Also needs the dashboard.
- **STEP 4: PHOTOS AND THE AVATAR / GET and PATCH /profile/me → both with avatarUrl**: Needs a real Supabase project (the script does not fake it).
- **STEP 4: PHOTOS AND THE AVATAR / GET /profile/me (Stranger) → no avatarUrl**: Needs a real Supabase project (the script does not fake it). (only means something when the owner has an avatar).
- **STEP 4: PHOTOS AND THE AVATAR / DELETE /profile/me/avatar → 200 avatar deleted**: Needs a real Supabase project (the script does not fake it). Also needs the dashboard.
- **STEP 4: PHOTOS AND THE AVATAR / upload → 503, avatar → 503, DELETE of a photo → 503**: Needs a real Supabase project (the script does not fake it). (the DELETE needs a stored photo) The part that could run passed: the upload and the avatar both answered 503.
- **STEP 4: PHOTOS AND THE AVATAR / GET /wardrobe and GET images → 200 with no coverUrl or url**: Needs a real Supabase project (the script does not fake it). (with no stored photo there is no link to leave out) The part that could run passed: both answered 200.
- **STEP 4: PHOTOS AND THE AVATAR / remove the "#" again and restart**: A setup step, not a check.
- **STEP 4: PHOTOS AND THE AVATAR / storage fails → upload 502, nothing saved; DELETE 502; fixed → 200**: Needs a real Supabase project (the script does not fake it). (the DELETE needs a stored photo, and the fix needs a real bucket) The part that could run passed: with SUPABASE_URL = http://127.0.0.1:9 (nobody listens there), the upload answered 502 "image storage failed" and GET images showed no new photo.
- **STEP 4: PHOTOS AND THE AVATAR / note about a paused Supabase project**: Needs a real Supabase project (the script does not fake it).
- **STEP 4: PHOTOS AND THE AVATAR / nothing secret in the log**: A real signed link was never made, so the full check needs real Supabase. The part that could run passed: in the 502 run the log never showed the (made-up) service key or "token=".
- **STEP 5: SWAGGER / /docs shows "Threadly API" with five groups, nothing red**: Needs a browser and human eyes. (GET /docs answered 200 with an HTML page.)
- **STEP 5: SWAGGER / F12 console: no Content Security Policy error**: Needs a browser.
- **STEP 5: SWAGGER / Try it out: GET /auth/me with no token → 401**: Needs a browser (the Swagger page).
- **STEP 5: SWAGGER / Try it out: login, then Authorize with the token**: Needs a browser (the Swagger page).
- **STEP 5: SWAGGER / Try it out: GET /auth/me → 200, Curl shows the Bearer header**: Needs a browser (the Swagger page).
- **STEP 5: SWAGGER / Try it out: POST /auth/refresh → 200 (the browser sends the cookie)**: Needs a browser (the browser's own cookie is the point of this box).
- **STEP 5: SWAGGER / Try it out: GET /admin/users as a member → 403, description says user:view**: Needs a browser. (In /docs.json the description does say "Permission: `user:view`".)
- **STEP 5: SWAGGER / Try it out: GET /wardrobe → 200**: Needs a browser (the Swagger page).
- **STEP 5: SWAGGER / Try it out: POST /wardrobe/{id}/images has a Choose File button**: Needs a browser, and real Supabase for the 201.
- **STEP 5: SWAGGER / Authorize > Logout, then GET /auth/me → 401**: Needs a browser (the Swagger page).

## Findings and notes

- No bug was found: there is no FAIL.
- The checklist order: in STEP 2, the box "Edit and clear" removes the Tote's `season` and `colors`, but
  the later filter boxes expect the Tote to still have season "all" (and `color=NAVY` to find it). The
  script put them back before the filters. Someone checking by hand meets the same thing: it may be worth
  a short line in the checklist.
- Small changes to make a box runnable are written in its note (a made-up image id where no photo can
  exist, an item made first so a list is not empty, the city set first to see it does not change).
- This was a one-time check of the current `main`. It is not a test suite, and nothing was added to the
  project apart from this report.

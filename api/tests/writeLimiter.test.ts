import request from "supertest";
import { app } from "../app";
import { resetSensitiveLimiters } from "../middleware/rateLimiters";

// a valid id that no item has
const ITEM_ID = "64b7f0c2a1b2c3d4e5f60718";

// the five write routes that share ONE limiter
const WRITE_ROUTES: { method: "post" | "patch"; path: string }[] = [
  { method: "post", path: "/wardrobe" },
  { method: "patch", path: `/wardrobe/${ITEM_ID}` },
  { method: "patch", path: `/wardrobe/${ITEM_ID}/archive` },
  { method: "patch", path: `/wardrobe/${ITEM_ID}/restore` },
  { method: "patch", path: "/profile/me" },
];

function send(route: { method: "post" | "patch"; path: string }) {
  return request(app)[route.method](route.path);
}

describe("shared write limiter", () => {
  beforeEach(async () => {
    await resetSensitiveLimiters();
  });

  afterAll(async () => {
    await resetSensitiveLimiters();
  });

  test("60 writes spread over the five routes pass, then every write route gives 429", async () => {
    // no token, so each try is a 401, but the limiter still counts it
    for (let i = 0; i < 60; i++) {
      const res = await send(WRITE_ROUTES[i % WRITE_ROUTES.length]);
      expect(res.status).toBe(401);
    }

    // the count is shared: every route is now blocked, not only the last one used
    for (const route of WRITE_ROUTES) {
      const blocked = await send(route);
      expect(blocked.status).toBe(429);
      expect(blocked.body.message).toMatch(/too many/);
    }
  });

  test("reading is not limited", async () => {
    for (let i = 0; i < 61; i++) {
      await send(WRITE_ROUTES[0]);
    }
    const list = await request(app).get("/wardrobe");
    const profile = await request(app).get("/profile/me");
    expect(list.status).toBe(401);
    expect(profile.status).toBe(401);
  });

  test("the reset helper lets writes in again", async () => {
    for (let i = 0; i < 61; i++) {
      await send(WRITE_ROUTES[0]);
    }
    await resetSensitiveLimiters();

    const res = await send(WRITE_ROUTES[0]);
    expect(res.status).toBe(401);
  });
});

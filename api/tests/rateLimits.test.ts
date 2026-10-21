import request from "supertest";
import { app } from "../app";
import { resetSensitiveLimiters } from "../middleware/rateLimiters";

const SENSITIVE_ROUTES = ["/auth/change-password", "/auth/deactivate", "/auth/logout-others"];

describe("rate limits on sensitive routes", () => {
  beforeEach(async () => {
    await resetSensitiveLimiters();
  });

  afterAll(async () => {
    await resetSensitiveLimiters();
  });

  test.each(SENSITIVE_ROUTES)("%s gives 429 after 5 tries", async (path) => {
    // no token, so each try is a 401, but the limiter still counts it
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post(path);
      expect(res.status).toBe(401);
    }

    const blocked = await request(app).post(path);
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many/);
  });

  test("the reset helper lets requests in again", async () => {
    for (let i = 0; i < 6; i++) {
      await request(app).post("/auth/deactivate");
    }
    await resetSensitiveLimiters();

    const res = await request(app).post("/auth/deactivate");
    expect(res.status).toBe(401);
  });
});

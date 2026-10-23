import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../app";
import { User } from "../models/User";
import { RefreshToken } from "../models/RefreshTokens";

const EMAIL = "refresh-test@test.com";
const PASSWORD = "abcd1234";

// reads the refresh cookie from an answer, like "refreshToken=abc123"
function refreshCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? (raw as string[]) : [];
  const line = list.find((c) => c.startsWith("refreshToken="));
  return line ? line.split(";")[0] : "";
}

async function cleanup() {
  const user = await User.findOne({ email: EMAIL });
  if (user) {
    await RefreshToken.deleteMany({ userId: user._id });
  }
  await User.deleteMany({ email: EMAIL });
}

async function login() {
  return request(app).post("/auth/login").send({ email: EMAIL, password: PASSWORD });
}

describe("refresh tickets", () => {
  beforeAll(async () => {
    await cleanup();
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    await User.create({ email: EMAIL, passwordHash });
  });

  afterAll(async () => {
    await cleanup();
  });

  test("refresh gives a new access token and a new cookie", async () => {
    const first = refreshCookie(await login());
    expect(first).not.toBe("");

    const res = await request(app).post("/auth/refresh").set("Cookie", first);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(refreshCookie(res)).not.toBe(first);
  });

  test("a used cookie is refused, and the whole family is cancelled", async () => {
    const a = refreshCookie(await login());

    const swap = await request(app).post("/auth/refresh").set("Cookie", a);
    const b = refreshCookie(swap);

    const replay = await request(app).post("/auth/refresh").set("Cookie", a);
    expect(replay.status).toBe(401);

    const newest = await request(app).post("/auth/refresh").set("Cookie", b);
    expect(newest.status).toBe(401);
  });

  test("the alarm cancels only that family, not another device", async () => {
    const phone = refreshCookie(await login());
    const laptop = refreshCookie(await login());

    await request(app).post("/auth/refresh").set("Cookie", phone);
    const replay = await request(app).post("/auth/refresh").set("Cookie", phone);
    expect(replay.status).toBe(401);

    const other = await request(app).post("/auth/refresh").set("Cookie", laptop);
    expect(other.status).toBe(200);
  });
});

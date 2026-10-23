import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Types } from "mongoose";
import { app } from "../app";
import { User } from "../models/User";
import { RefreshToken } from "../models/RefreshTokens";
import { generateRefreshToken, hashToken } from "../utils/tokens";
import { resetSensitiveLimiters } from "../middleware/rateLimiters";

const EMAIL = "session-test@test.com";
const OTHER_EMAIL = "session-other@test.com";
const ALL_EMAILS = [EMAIL, OTHER_EMAIL];
const PASSWORD = "abcd1234";
const NEW_PASSWORD = "efgh5678";

function tokenFor(user: { _id: unknown; role: string }) {
  return jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET as string, {
    expiresIn: "15m",
  });
}

// saves a refresh token like login does, and gives back its cookie
async function startSession(userId: Types.ObjectId) {
  const token = generateRefreshToken();
  const familyId = crypto.randomUUID();
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(token),
    familyId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return { cookie: `refreshToken=${token}`, tokenHash: hashToken(token) };
}

async function isRevoked(tokenHash: string) {
  const stored = await RefreshToken.findOne({ tokenHash });
  return Boolean(stored?.revokedAt);
}

async function cleanup() {
  const users = await User.find({ email: { $in: ALL_EMAILS } });
  await RefreshToken.deleteMany({ userId: { $in: users.map((u) => u._id) } });
  await User.deleteMany({ email: { $in: ALL_EMAILS } });
}

describe("session routes", () => {
  let user: InstanceType<typeof User>;
  let other: InstanceType<typeof User>;
  let accessToken = "";

  beforeEach(async () => {
    await resetSensitiveLimiters();
    await cleanup();
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    user = await User.create({ email: EMAIL, passwordHash });
    other = await User.create({ email: OTHER_EMAIL, passwordHash });
    accessToken = tokenFor(user);
  });

  afterAll(async () => {
    await cleanup();
    await resetSensitiveLimiters();
  });

  describe("POST /auth/logout", () => {
    test("cancels this device's token and clears the cookie", async () => {
      const session = await startSession(user._id);

      const res = await request(app).post("/auth/logout").set("Cookie", session.cookie);

      expect(res.status).toBe(200);
      expect(await isRevoked(session.tokenHash)).toBe(true);
      const cookies = res.headers["set-cookie"] as unknown as string[];
      expect(cookies.some((c) => c.startsWith("refreshToken=;"))).toBe(true);

      const refresh = await request(app).post("/auth/refresh").set("Cookie", session.cookie);
      expect(refresh.status).toBe(401);
    });

    test("works with no cookie", async () => {
      const res = await request(app).post("/auth/logout");
      expect(res.status).toBe(200);
    });
  });

  describe("POST /auth/logout-others", () => {
    test("refuses a request with no token", async () => {
      const res = await request(app).post("/auth/logout-others");
      expect(res.status).toBe(401);
    });

    test("cancels the other devices and keeps this one", async () => {
      const here = await startSession(user._id);
      const phone = await startSession(user._id);

      const res = await request(app)
        .post("/auth/logout-others")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Cookie", here.cookie);

      expect(res.status).toBe(200);
      expect(await isRevoked(phone.tokenHash)).toBe(true);
      expect(await isRevoked(here.tokenHash)).toBe(false);
    });

    test("refuses a cookie that belongs to another user", async () => {
      const otherSession = await startSession(other._id);

      const res = await request(app)
        .post("/auth/logout-others")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Cookie", otherSession.cookie);

      expect(res.status).toBe(401);
      expect(await isRevoked(otherSession.tokenHash)).toBe(false);
    });
  });

  describe("POST /auth/change-password", () => {
    test("refuses a wrong current password", async () => {
      const res = await request(app)
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: "wrong1234", newPassword: NEW_PASSWORD });

      expect(res.status).toBe(401);
      const saved = await User.findById(user._id);
      expect(await bcrypt.compare(PASSWORD, saved!.passwordHash)).toBe(true);
    });

    test("refuses a weak new password with 400", async () => {
      const res = await request(app)
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: PASSWORD, newPassword: "short" });

      expect(res.status).toBe(400);
    });

    test("changes the password and ends every session", async () => {
      const a = await startSession(user._id);
      const b = await startSession(user._id);

      const res = await request(app)
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

      expect(res.status).toBe(200);
      expect(await isRevoked(a.tokenHash)).toBe(true);
      expect(await isRevoked(b.tokenHash)).toBe(true);

      const oldLogin = await request(app)
        .post("/auth/login")
        .send({ email: EMAIL, password: PASSWORD });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app)
        .post("/auth/login")
        .send({ email: EMAIL, password: NEW_PASSWORD });
      expect(newLogin.status).toBe(200);
    });
  });

  describe("POST /auth/deactivate", () => {
    test("refuses a wrong password and keeps the account on", async () => {
      const res = await request(app)
        .post("/auth/deactivate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: "wrong1234" });

      expect(res.status).toBe(401);
      const saved = await User.findById(user._id);
      expect(saved?.isActive).toBe(true);
    });

    test("switches the account off and ends every session", async () => {
      const session = await startSession(user._id);

      const res = await request(app)
        .post("/auth/deactivate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: PASSWORD });

      expect(res.status).toBe(200);
      const saved = await User.findById(user._id);
      expect(saved?.isActive).toBe(false);
      expect(await isRevoked(session.tokenHash)).toBe(true);

      // the old access token no longer works
      const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${accessToken}`);
      expect(me.status).toBe(401);
    });
  });
});

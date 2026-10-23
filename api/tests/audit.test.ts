import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { app } from "../app";
import { User } from "../models/User";
import { RefreshToken } from "../models/RefreshTokens";
import { AuditLog } from "../models/AuditLog";

const ADMIN_EMAIL = "audit-admin@test.com";
const OFF_ADMIN_EMAIL = "audit-off-admin@test.com";
const MEMBER_EMAIL = "audit-member@test.com";
const ALL_EMAILS = [ADMIN_EMAIL, OFF_ADMIN_EMAIL, MEMBER_EMAIL];
const PASSWORD = "abcd1234";

function tokenFor(user: { _id: unknown; role: string }) {
  return jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET as string, {
    expiresIn: "15m",
  });
}

// login writes its audit row without waiting, so look a few times
async function findRow(filter: Record<string, unknown>) {
  for (let i = 0; i < 20; i++) {
    const row = await AuditLog.findOne(filter);
    if (row) return row;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

async function cleanup() {
  const users = await User.find({ email: { $in: ALL_EMAILS } });
  const ids = users.map((u) => u._id);
  await AuditLog.deleteMany({ $or: [{ actorId: { $in: ids } }, { targetId: { $in: ids } }] });
  await RefreshToken.deleteMany({ userId: { $in: ids } });
  await User.deleteMany({ email: { $in: ALL_EMAILS } });
}

describe("audit log", () => {
  let adminId = "";
  let offAdminId = "";
  let memberId = "";
  let adminToken = "";

  beforeAll(async () => {
    await cleanup();
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const admin = await User.create({ email: ADMIN_EMAIL, passwordHash, role: "admin" });
    const offAdmin = await User.create({
      email: OFF_ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      isActive: false,
    });
    const member = await User.create({ email: MEMBER_EMAIL, passwordHash });
    adminId = admin._id.toString();
    offAdminId = offAdmin._id.toString();
    memberId = member._id.toString();
    adminToken = tokenFor(admin);
  });

  afterAll(async () => {
    await cleanup();
  });

  test("an admin switch off writes a user.deactivate row", async () => {
    const res = await request(app)
      .patch(`/admin/users/${memberId}/active`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(200);

    const row = await findRow({ action: "user.deactivate", targetId: memberId });
    expect(row).not.toBeNull();
    expect(row!.actorId.toString()).toBe(adminId);
    expect(row!.details).toEqual({ isActive: false });
  });

  test("an admin switch on writes a user.activate row", async () => {
    const res = await request(app)
      .patch(`/admin/users/${memberId}/active`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: true });
    expect(res.status).toBe(200);

    const row = await findRow({ action: "user.activate", targetId: memberId });
    expect(row).not.toBeNull();
    expect(row!.actorId.toString()).toBe(adminId);
  });

  test("an admin login writes an auth.login.success row", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: ADMIN_EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);

    const row = await findRow({ action: "auth.login.success", actorId: adminId });
    expect(row).not.toBeNull();
  });

  test("an admin wrong password writes a failure row", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: ADMIN_EMAIL, password: "wrong1234" });
    expect(res.status).toBe(401);

    const row = await findRow({ action: "auth.login.failure", actorId: adminId });
    expect(row).not.toBeNull();
    expect(row!.details).toEqual({ reason: "wrong password" });
  });

  test("a switched off admin login writes a failure row", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: OFF_ADMIN_EMAIL, password: PASSWORD });
    expect(res.status).toBe(401);

    const row = await findRow({ action: "auth.login.failure", actorId: offAdminId });
    expect(row).not.toBeNull();
    expect(row!.details).toEqual({ reason: "account off" });
  });

  test("a member login writes no row", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: MEMBER_EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);

    // give a missing row time to show up, then check it never did
    await new Promise((resolve) => setTimeout(resolve, 300));
    const count = await AuditLog.countDocuments({ actorId: memberId });
    expect(count).toBe(0);
  });

  test("an admin can read the rows, newest first", async () => {
    const res = await request(app)
      .get("/admin/audit?action=user.deactivate")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const mine = res.body.items.filter((item: { targetId: string }) => item.targetId === memberId);
    expect(mine).toHaveLength(1);
    expect(mine[0].action).toBe("user.deactivate");

    const dates = res.body.items.map((item: { createdAt: string }) => Date.parse(item.createdAt));
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });
});

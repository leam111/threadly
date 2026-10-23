import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { app } from "../app";
import { User } from "../models/User";

const MEMBER_EMAIL = "list-member@test.com";
const ADMIN_EMAIL = "list-admin@test.com";
const DOT_EMAIL = "list-a.b@test.com";
const X_EMAIL = "list-axb@test.com";
const INACTIVE_EMAIL = "list-inactive@test.com";
const ALL_EMAILS = [MEMBER_EMAIL, ADMIN_EMAIL, DOT_EMAIL, X_EMAIL, INACTIVE_EMAIL];

function tokenFor(user: { _id: unknown; role: string }) {
  return jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET as string, {
    expiresIn: "15m",
  });
}

describe("GET /admin/users", () => {
  let memberToken = "";
  let adminToken = "";

  beforeAll(async () => {
    await User.deleteMany({ email: { $in: ALL_EMAILS } });
    const passwordHash = await bcrypt.hash("abcd1234", 4);
    const member = await User.create({ email: MEMBER_EMAIL, passwordHash });
    const admin = await User.create({ email: ADMIN_EMAIL, passwordHash, role: "admin" });
    await User.create({ email: DOT_EMAIL, passwordHash });
    await User.create({ email: X_EMAIL, passwordHash });
    await User.create({ email: INACTIVE_EMAIL, passwordHash, isActive: false });
    memberToken = tokenFor(member);
    adminToken = tokenFor(admin);
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ALL_EMAILS } });
  });

  test("refuses a request with no token", async () => {
    const res = await request(app).get("/admin/users");
    expect(res.status).toBe(401);
  });

  test("refuses a member with 403", async () => {
    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  test("lets an admin in and sends page, limit, total and items", async () => {
    const res = await request(app).get("/admin/users").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
    expect(typeof res.body.total).toBe("number");
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test("caps the limit at 50", async () => {
    const res = await request(app)
      .get("/admin/users?limit=500")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(50);
  });

  test("never sends passwordHash", async () => {
    const res = await request(app).get("/admin/users").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item).not.toHaveProperty("passwordHash");
    }
  });

  test("treats a dot in the email search as a real dot", async () => {
    const res = await request(app)
      .get("/admin/users?email=list-a.b")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const emails = res.body.items.map((item: { email: string }) => item.email);
    expect(emails).toContain(DOT_EMAIL);
    expect(emails).not.toContain(X_EMAIL);
  });

  test("refuses a role that does not exist with 400", async () => {
    const res = await request(app)
      .get("/admin/users?role=king")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test("refuses a status that does not exist with 400", async () => {
    const res = await request(app)
      .get("/admin/users?status=maybe")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test("filters by role", async () => {
    const res = await request(app)
      .get("/admin/users?email=list-&role=admin")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const emails = res.body.items.map((item: { email: string }) => item.email);
    expect(emails).toEqual([ADMIN_EMAIL]);
  });

  test("filters by status", async () => {
    const res = await request(app)
      .get("/admin/users?email=list-&status=inactive")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const emails = res.body.items.map((item: { email: string }) => item.email);
    expect(emails).toEqual([INACTIVE_EMAIL]);
  });

  test("gives a different user on page 2", async () => {
    const page1 = await request(app)
      .get("/admin/users?email=list-&page=1&limit=1")
      .set("Authorization", `Bearer ${adminToken}`);
    const page2 = await request(app)
      .get("/admin/users?email=list-&page=2&limit=1")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);
    expect(page1.body.items).toHaveLength(1);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.page).toBe(2);
    expect(page1.body.total).toBe(ALL_EMAILS.length);
    expect(page2.body.items[0]._id).not.toBe(page1.body.items[0]._id);
  });
});

const SAFE_ADMIN_EMAIL = "safe-admin@test.com";
const SAFE_SUPER_EMAIL = "safe-super@test.com";
const SAFE_SUPER2_EMAIL = "safe-super2@test.com";
const SAFE_MEMBER_EMAIL = "safe-member@test.com";
const SAFE_EMAILS = [SAFE_ADMIN_EMAIL, SAFE_SUPER_EMAIL, SAFE_SUPER2_EMAIL, SAFE_MEMBER_EMAIL];

describe("PATCH /admin/users/:id/active", () => {
  let adminId = "";
  let superId2 = "";
  let memberId = "";
  let adminToken = "";
  let superToken = "";

  beforeAll(async () => {
    await User.deleteMany({ email: { $in: SAFE_EMAILS } });
    const passwordHash = await bcrypt.hash("abcd1234", 4);
    const admin = await User.create({ email: SAFE_ADMIN_EMAIL, passwordHash, role: "admin" });
    const superadmin = await User.create({
      email: SAFE_SUPER_EMAIL,
      passwordHash,
      role: "superadmin",
    });
    const superadmin2 = await User.create({
      email: SAFE_SUPER2_EMAIL,
      passwordHash,
      role: "superadmin",
    });
    const member = await User.create({ email: SAFE_MEMBER_EMAIL, passwordHash });
    adminId = admin._id.toString();
    superId2 = superadmin2._id.toString();
    memberId = member._id.toString();
    adminToken = tokenFor(admin);
    superToken = tokenFor(superadmin);
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: SAFE_EMAILS } });
  });

  test("refuses to switch off your own account with 400", async () => {
    const res = await request(app)
      .patch(`/admin/users/${adminId}/active`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(400);
    const admin = await User.findById(adminId);
    expect(admin?.isActive).toBe(true);
  });

  test("refuses an admin who changes a superadmin with 403", async () => {
    const res = await request(app)
      .patch(`/admin/users/${superId2}/active`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(403);
    const superadmin2 = await User.findById(superId2);
    expect(superadmin2?.isActive).toBe(true);
  });

  test("lets a superadmin switch off another superadmin", async () => {
    const res = await request(app)
      .patch(`/admin/users/${superId2}/active`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    const superadmin2 = await User.findById(superId2);
    expect(superadmin2?.isActive).toBe(false);
  });

  test("lets an admin switch off a member", async () => {
    const res = await request(app)
      .patch(`/admin/users/${memberId}/active`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    const member = await User.findById(memberId);
    expect(member?.isActive).toBe(false);
  });
});

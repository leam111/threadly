import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { app } from "../app";
import { User } from "../models/User";

const MEMBER_EMAIL = "guard-member@test.com";
const ADMIN_EMAIL = "guard-admin@test.com";

function tokenFor(user: { _id: unknown; role: string }) {
  return jwt.sign(
    { sub: String(user._id), role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  );
}

describe("guards", () => {
  let memberToken = "";
  let adminToken = "";

  beforeAll(async () => {
    await User.deleteMany({ email: { $in: [MEMBER_EMAIL, ADMIN_EMAIL] } });
    const passwordHash = await bcrypt.hash("abcd1234", 4);
    const member = await User.create({ email: MEMBER_EMAIL, passwordHash });
    const admin = await User.create({ email: ADMIN_EMAIL, passwordHash, role: "admin" });
    memberToken = tokenFor(member);
    adminToken = tokenFor(admin);
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: [MEMBER_EMAIL, ADMIN_EMAIL] } });
  });

  test("the admin route refuses a request with no token", async () => {
    const res = await request(app).get("/admin/users");
    expect(res.status).toBe(401);
  });



  test("the admin route lets an admin in", async () => {
    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test("the admin route refuses a member with 403", async () => {
    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });


});


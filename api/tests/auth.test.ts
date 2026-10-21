import request from "supertest";
import { app } from "../app";
import bcrypt from "bcryptjs";
import { User } from "../models/User";

const TEST_EMAIL = "login-test@test.com";
const TEST_PASSWORD = "abcd1234";

describe("auth routes", () => {
  beforeAll(async () => {
    await User.deleteMany({ email: TEST_EMAIL });
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
    await User.create({ email: TEST_EMAIL, passwordHash });
  });

  afterAll(async () => {
    await User.deleteMany({ email: TEST_EMAIL });
  });

  test("register refuses a short password", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "a@test.com", password: "abc" });
    expect(res.status).toBe(400);
  });

  test("me refuses a request with no token", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  test("refresh refuses a request with no cookie", async () => {
    const res = await request(app).post("/auth/refresh");
    expect(res.status).toBe(401);
  });

  test("login works with the right password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });
});
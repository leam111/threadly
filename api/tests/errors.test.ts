import request from "supertest";
import { app } from "../app";
import { User } from "../models/User";

describe("404 and error handler", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("an unknown route gives 404 JSON", async () => {
    const res = await request(app).get("/no-such-route");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ message: "route not found" });
  });

  test("a route that throws gives 500 JSON with no details", async () => {
    // make the login route throw, and hide the console.error noise
    jest.spyOn(User, "findOne").mockRejectedValue(new Error("secret database detail"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "error-test@test.com", password: "abcd1234" });

    expect(res.status).toBe(500);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ message: "something went wrong" });
    expect(res.text).not.toMatch(/secret database detail/);
    expect(res.text).not.toMatch(/at /);
  });

  test("broken JSON gives 400 JSON, not 500", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "bad request" });
  });
});

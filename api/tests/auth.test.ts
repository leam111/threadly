import request from "supertest";
import { app } from "../app";
import { email } from "zod";

test("register refuses a short password", async () => {
  const res = await request(app)
    .post("/auth/register")
    .send({ email: "a@test.com", password: "abc" });
  expect(res.status).toBe(400);
});


test("me refuses a request with no token",async ()=>{
const res = await request(app).get("/auth/me");
expect(res.status).toBe(401);
});

test("refresh refuses a request with no cookie",async()=>{
const res = await request(app).post("/auth/refresh");
expect(res.status).toBe(401);

});
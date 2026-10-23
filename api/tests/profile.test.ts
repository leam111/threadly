import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { app } from "../app";
import { User } from "../models/User";
import { resetSensitiveLimiters } from "../middleware/rateLimiters";
import { Profile } from "../models/Profile";

const ALICE_EMAIL = "profile-alice@test.com";
const BOB_EMAIL = "profile-bob@test.com";
const EMAILS = [ALICE_EMAIL, BOB_EMAIL];

function tokenFor(user: { _id: unknown; role: string }) {
  return jwt.sign(
    { sub: String(user._id), role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  );
}

describe("member profile", () => {
  let aliceToken = "";
  let bobToken = "";
  let aliceId = "";
  let bobId = "";

  async function cleanProfiles() {
    const users = await User.find({ email: { $in: EMAILS } });
    await Profile.deleteMany({ userId: { $in: users.map((u) => u._id) } });
  }

  beforeAll(async () => {
    await cleanProfiles();
    await User.deleteMany({ email: { $in: EMAILS } });
    const passwordHash = await bcrypt.hash("abcd1234", 4);
    const alice = await User.create({ email: ALICE_EMAIL, passwordHash });
    const bob = await User.create({ email: BOB_EMAIL, passwordHash });
    aliceToken = tokenFor(alice);
    bobToken = tokenFor(bob);
    aliceId = String(alice._id);
    bobId = String(bob._id);
  });

  // every test starts with no profile at all
  beforeEach(async () => {
    await cleanProfiles();
    // the write limiter counts every PATCH: start each test from 0
    await resetSensitiveLimiters();
  });

  afterAll(async () => {
    await resetSensitiveLimiters();
    await cleanProfiles();
    await User.deleteMany({ email: { $in: EMAILS } });
  });

  function patchAs(token: string, body: unknown) {
    return request(app)
      .patch("/profile/me")
      .set("Authorization", `Bearer ${token}`)
      .send(body as object);
  }

  test("GET with no profile gives the empty default and writes nothing", async () => {
    const res = await request(app)
      .get("/profile/me")
      .set("Authorization", `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    // no empty texts, no updatedAt (nothing is stored yet), but sizes and styles are there
    expect(res.body).toEqual({ userId: aliceId, sizes: {}, styles: [] });
    expect(await Profile.countDocuments({ userId: aliceId })).toBe(0);
  });

  test("no token gives 401 on GET and PATCH", async () => {
    const get = await request(app).get("/profile/me");
    const patch = await request(app).patch("/profile/me").send({ city: "Paris" });
    expect(get.status).toBe(401);
    expect(patch.status).toBe(401);
    expect(patch.body).toEqual({ message: "Log in first" });
  });

  test("PATCH creates the profile, then changes it", async () => {
    const created = await patchAs(aliceToken, {
      displayName: "  Alice  ",
      city: "Paris",
      sizes: { top: "M", shoes: "38" },
      styles: ["classic", "y2k"],
    });
    expect(created.status).toBe(200);
    expect(created.body).toEqual({
      userId: aliceId,
      displayName: "Alice",
      city: "Paris",
      sizes: { top: "M", shoes: "38" },
      styles: ["classic", "y2k"],
      updatedAt: expect.any(String),
    });
    expect(await Profile.countDocuments({ userId: aliceId })).toBe(1);

    const changed = await patchAs(aliceToken, { bio: "I love jeans", sizes: { top: "L" } });
    expect(changed.status).toBe(200);
    expect(changed.body.bio).toBe("I love jeans");
    // changing one size keeps the others
    expect(changed.body.sizes).toEqual({ top: "L", shoes: "38" });
    expect(changed.body.city).toBe("Paris");
    // updatedAt moves forward when the profile changes
    expect(new Date(changed.body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.body.updatedAt).getTime(),
    );
    // still one profile, not two
    expect(await Profile.countDocuments({ userId: aliceId })).toBe(1);

    const read = await request(app)
      .get("/profile/me")
      .set("Authorization", `Bearer ${aliceToken}`);
    expect(read.body).toEqual(changed.body);
  });

  test("an empty body gives 400 nothing to change and writes nothing", async () => {
    const res = await patchAs(aliceToken, {});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "nothing to change" });
    expect(await Profile.countDocuments({ userId: aliceId })).toBe(0);
  });

  test("unknown keys are ignored, and a fake userId cannot target someone else", async () => {
    const res = await patchAs(aliceToken, { userId: bobId, city: "Lyon", hacker: true });
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(aliceId);
    expect(res.body).not.toHaveProperty("hacker");
    expect(await Profile.countDocuments({ userId: bobId })).toBe(0);
  });

  test("only unknown keys give 400 nothing to change", async () => {
    const res = await patchAs(aliceToken, { hacker: true });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "nothing to change" });
  });

  test("a bad style gives 400 invalid input", async () => {
    const res = await patchAs(aliceToken, { styles: ["punk"] });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "invalid input" });
  });

  test("a sixth style gives 400 invalid input", async () => {
    const res = await patchAs(aliceToken, {
      styles: ["classic", "streetwear", "y2k", "preppy", "boho", "minimal"],
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "invalid input" });
  });

  test("the same style twice gives 400 invalid input", async () => {
    const res = await patchAs(aliceToken, { styles: ["boho", "boho"] });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "invalid input" });
  });

  test("too long text gives 400 invalid input", async () => {
    const cases = [
      { displayName: "x".repeat(41) },
      { bio: "x".repeat(201) },
      { city: "x".repeat(61) },
      { sizes: { top: "x".repeat(11) } },
    ];
    for (const body of cases) {
      const res = await patchAs(aliceToken, body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "invalid input" });
    }
    expect(await Profile.countDocuments({ userId: aliceId })).toBe(0);
  });

  test("an empty text clears displayName, bio and city (the fields are removed)", async () => {
    await patchAs(aliceToken, { displayName: "Alice", bio: "Hi", city: "Paris", styles: ["boho"] }).expect(200);

    const res = await patchAs(aliceToken, { displayName: "", bio: "   ", city: "" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      userId: aliceId,
      sizes: {},
      styles: ["boho"],
      updatedAt: expect.any(String),
    });

    const saved = await Profile.findOne({ userId: aliceId }).lean();
    expect(saved).not.toHaveProperty("displayName");
    expect(saved).not.toHaveProperty("bio");
    expect(saved).not.toHaveProperty("city");
    // the rest stays
    expect(saved?.styles).toEqual(["boho"]);
  });

  test("an empty size clears that size and keeps the others", async () => {
    await patchAs(aliceToken, { sizes: { top: "M", shoes: "38" } }).expect(200);

    const res = await patchAs(aliceToken, { sizes: { top: "" } });
    expect(res.status).toBe(200);

    const saved = await Profile.findOne({ userId: aliceId }).lean();
    expect(saved?.sizes).not.toHaveProperty("top");
    expect(saved?.sizes?.shoes).toBe("38");
  });

  test("clearing and setting in one request both work", async () => {
    await patchAs(aliceToken, { displayName: "Alice", city: "Paris" }).expect(200);

    await patchAs(aliceToken, { city: "", bio: "New bio" }).expect(200);

    const saved = await Profile.findOne({ userId: aliceId }).lean();
    expect(saved).not.toHaveProperty("city");
    expect(saved?.bio).toBe("New bio");
    expect(saved?.displayName).toBe("Alice");
  });

  test("the answer never has _id or __v", async () => {
    const patch = await patchAs(aliceToken, { city: "Paris" });
    const get = await request(app)
      .get("/profile/me")
      .set("Authorization", `Bearer ${aliceToken}`);
    for (const body of [patch.body, get.body]) {
      expect(body).not.toHaveProperty("_id");
      expect(body).not.toHaveProperty("__v");
      expect(body).toHaveProperty("updatedAt");
    }
  });

  test("two users never see each other's profile", async () => {
    await patchAs(aliceToken, { displayName: "Alice", city: "Paris" }).expect(200);
    await patchAs(bobToken, { displayName: "Bob", city: "Rome" }).expect(200);

    const alice = await request(app)
      .get("/profile/me")
      .set("Authorization", `Bearer ${aliceToken}`);
    const bob = await request(app)
      .get("/profile/me")
      .set("Authorization", `Bearer ${bobToken}`);

    expect(alice.body).toMatchObject({ userId: aliceId, displayName: "Alice", city: "Paris" });
    expect(bob.body).toMatchObject({ userId: bobId, displayName: "Bob", city: "Rome" });
  });

  test("the model refuses repeated styles and more than 5 styles", async () => {
    const repeated = new Profile({ userId: aliceId, styles: ["boho", "boho"] });
    const tooMany = new Profile({
      userId: aliceId,
      styles: ["classic", "streetwear", "y2k", "preppy", "boho", "minimal"],
    });
    await expect(repeated.validate()).rejects.toHaveProperty("errors.styles");
    await expect(tooMany.validate()).rejects.toHaveProperty("errors.styles");
  });
});

import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { app } from "../app";
import { User } from "../models/User";
import { WardrobeItem } from "../models/WardrobeItem";
import { ITEM_CATEGORIES, ITEM_STATUSES } from "../utils/wardrobeOptions";

const OWNER_EMAIL = "wardrobe-owner@test.com";
const STRANGER_EMAIL = "wardrobe-stranger@test.com";
const EMAILS = [OWNER_EMAIL, STRANGER_EMAIL];

function tokenFor(user: { _id: unknown; role: string }) {
  return jwt.sign(
    { sub: String(user._id), role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  );
}

describe("wardrobe", () => {
  let ownerToken = "";
  let strangerToken = "";
  let ownerId = "";
  let strangerId = "";

  // remove every item that belongs to our two test users
  async function cleanItems() {
    const users = await User.find({ email: { $in: EMAILS } });
    await WardrobeItem.deleteMany({ ownerId: { $in: users.map((u) => u._id) } });
  }

  async function createItem(body: Record<string, unknown> = { name: "Blue shirt", category: "top" }) {
    const res = await request(app)
      .post("/wardrobe")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(body);
    expect(res.status).toBe(201);
    return res.body;
  }

  beforeAll(async () => {
    await cleanItems();
    await User.deleteMany({ email: { $in: EMAILS } });
    const passwordHash = await bcrypt.hash("abcd1234", 4);
    const owner = await User.create({ email: OWNER_EMAIL, passwordHash });
    const stranger = await User.create({ email: STRANGER_EMAIL, passwordHash });
    ownerToken = tokenFor(owner);
    strangerToken = tokenFor(stranger);
    ownerId = String(owner._id);
    strangerId = String(stranger._id);
  });

  afterAll(async () => {
    await cleanItems();
    await User.deleteMany({ email: { $in: EMAILS } });
  });

  describe("audit fixes", () => {
    test("the model and the routes share one category and status list", () => {
      const schema = WardrobeItem.schema;
      expect(schema.path("category").options.enum).toEqual(ITEM_CATEGORIES);
      expect(schema.path("status").options.enum).toEqual(ITEM_STATUSES);
    });

    test("the model refuses a brand, color or size longer than 50", () => {
      for (const field of ["brand", "color", "size"]) {
        const item = new WardrobeItem({
          ownerId,
          name: "Shirt",
          category: "top",
          [field]: "x".repeat(51),
        });
        expect(item.validateSync()?.errors[field]).toBeDefined();
      }
    });

    test("the model has an owner plus newest-first index for the list", () => {
      const keys = WardrobeItem.schema.indexes().map(([fields]) => fields);
      expect(keys).toContainEqual({ ownerId: 1, createdAt: -1 });
    });

    test("PATCH with no body at all answers nothing to change", async () => {
      const item = await createItem();
      const res = await request(app)
        .patch(`/wardrobe/${item._id}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "nothing to change" });
    });
  });

  describe("PATCH /wardrobe/:id/restore", () => {
    test("the owner puts an archived item back to active", async () => {
      const item = await createItem();
      await request(app)
        .patch(`/wardrobe/${item._id}/archive`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      const res = await request(app)
        .patch(`/wardrobe/${item._id}/restore`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("active");
    });

    test("a stranger gets 404 and the item stays archived", async () => {
      const item = await createItem();
      await request(app)
        .patch(`/wardrobe/${item._id}/archive`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);
      const before = await WardrobeItem.findById(item._id).lean();

      const res = await request(app)
        .patch(`/wardrobe/${item._id}/restore`)
        .set("Authorization", `Bearer ${strangerToken}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "item not found" });

      const after = await WardrobeItem.findById(item._id).lean();
      expect(after?.status).toBe("archived");
      expect(after?.updatedAt).toEqual(before?.updatedAt);
    });

    test("a bad id gives 400 invalid id", async () => {
      const res = await request(app)
        .patch("/wardrobe/abc/restore")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "invalid id" });
    });

    test("no token gives 401", async () => {
      const item = await createItem();
      const res = await request(app).patch(`/wardrobe/${item._id}/restore`);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Log in first" });
    });
  });
});

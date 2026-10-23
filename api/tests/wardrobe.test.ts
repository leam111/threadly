import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { app } from "../app";
import { User } from "../models/User";
import { resetSensitiveLimiters } from "../middleware/rateLimiters";
import { WardrobeItem } from "../models/WardrobeItem";
import { ITEM_CATEGORIES, ITEM_STATUSES } from "../utils/wardrobeOptions";

const OWNER_EMAIL = "wardrobe-owner@test.com";
const STRANGER_EMAIL = "wardrobe-stranger@test.com";
const EMAILS = [OWNER_EMAIL, STRANGER_EMAIL];

// a valid id that no item has
const MADE_UP_ID = "64b7f0c2a1b2c3d4e5f60718";

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

  async function createItem(
    body: Record<string, unknown> = { name: "Blue shirt", category: "top" },
    token = ownerToken,
  ) {
    const res = await request(app)
      .post("/wardrobe")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    expect(res.status).toBe(201);
    return res.body;
  }

  function as(token: string) {
    return {
      get: (path: string) => request(app).get(path).set("Authorization", `Bearer ${token}`),
      patch: (path: string) => request(app).patch(path).set("Authorization", `Bearer ${token}`),
    };
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

  // every test starts with an empty wardrobe, so counts are exact
  beforeEach(async () => {
    await cleanItems();
    // the write limiter counts every POST and PATCH: start each test from 0
    await resetSensitiveLimiters();
  });

  afterAll(async () => {
    await resetSensitiveLimiters();
    await cleanItems();
    await User.deleteMany({ email: { $in: EMAILS } });
  });

  describe("POST /wardrobe", () => {
    test("a bad category gives 400 invalid input", async () => {
      const res = await request(app)
        .post("/wardrobe")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Hat", category: "spaceship" });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "invalid input" });
    });

    test("a fake ownerId and a fake status in the body are ignored", async () => {
      const item = await createItem({
        name: "Coat",
        category: "outerwear",
        ownerId: strangerId,
        status: "archived",
      });
      expect(item.ownerId).toBe(ownerId);
      expect(item.status).toBe("active");

      const saved = await WardrobeItem.findById(item._id).lean();
      expect(String(saved?.ownerId)).toBe(ownerId);
      expect(saved?.status).toBe("active");
    });

    test("the name is trimmed", async () => {
      const item = await createItem({ name: "   Red dress   ", category: "dress" });
      expect(item.name).toBe("Red dress");
    });

    test("no token gives 401", async () => {
      const res = await request(app).post("/wardrobe").send({ name: "Hat", category: "accessory" });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Log in first" });
    });
  });

  describe("GET /wardrobe", () => {
    test("I only see my own items", async () => {
      await createItem({ name: "Mine", category: "top" });
      await createItem({ name: "Not mine", category: "top" }, strangerToken);

      const res = await as(ownerToken).get("/wardrobe");
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(["Mine"]);
    });

    test("a stranger gets total 0, even with ?ownerId= in the address", async () => {
      await createItem();
      await createItem();

      const res = await as(strangerToken).get(`/wardrobe?ownerId=${ownerId}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.items).toEqual([]);
    });

    test("filters by category and status work", async () => {
      await createItem({ name: "Shirt", category: "top" });
      await createItem({ name: "Jeans", category: "bottom" });
      const old = await createItem({ name: "Old shirt", category: "top" });
      await as(ownerToken).patch(`/wardrobe/${old._id}/archive`).expect(200);

      const tops = await as(ownerToken).get("/wardrobe?category=top");
      expect(tops.body.total).toBe(2);

      const activeTops = await as(ownerToken).get("/wardrobe?category=top&status=active");
      expect(activeTops.body.total).toBe(1);
      expect(activeTops.body.items[0].name).toBe("Shirt");

      const archived = await as(ownerToken).get("/wardrobe?status=archived");
      expect(archived.body.total).toBe(1);
      expect(archived.body.items[0].name).toBe("Old shirt");
    });

    test("limit=500 is capped at 50", async () => {
      const res = await as(ownerToken).get("/wardrobe?limit=500");
      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(50);
    });

    test.each(["page=abc", "status=inactive"])("%s gives 400 invalid query", async (query) => {
      const res = await as(ownerToken).get(`/wardrobe?${query}`);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "invalid query" });
    });
  });

  describe("GET /wardrobe/:id", () => {
    test("the owner gets 200", async () => {
      const item = await createItem();
      const res = await as(ownerToken).get(`/wardrobe/${item._id}`);
      expect(res.status).toBe(200);
      expect(res.body._id).toBe(item._id);
    });

    test("a made-up valid id gives 404", async () => {
      const res = await as(ownerToken).get(`/wardrobe/${MADE_UP_ID}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "item not found" });
    });

    test("a stranger gets 404 with the SAME body as a made-up id", async () => {
      const item = await createItem();
      const stranger = await as(strangerToken).get(`/wardrobe/${item._id}`);
      const madeUp = await as(strangerToken).get(`/wardrobe/${MADE_UP_ID}`);
      expect(stranger.status).toBe(404);
      expect(stranger.body).toEqual(madeUp.body);
    });

    test("abc gives 400 invalid id", async () => {
      const res = await as(ownerToken).get("/wardrobe/abc");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "invalid id" });
    });

    test("no token gives 401", async () => {
      const item = await createItem();
      const res = await request(app).get(`/wardrobe/${item._id}`);
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /wardrobe/:id/archive and /restore", () => {
    test("the owner moves the item between the active and archived lists", async () => {
      const item = await createItem();

      const archived = await as(ownerToken).patch(`/wardrobe/${item._id}/archive`);
      expect(archived.status).toBe(200);
      expect(archived.body.status).toBe("archived");
      expect((await as(ownerToken).get("/wardrobe?status=active")).body.total).toBe(0);
      expect((await as(ownerToken).get("/wardrobe?status=archived")).body.total).toBe(1);

      const restored = await as(ownerToken).patch(`/wardrobe/${item._id}/restore`);
      expect(restored.status).toBe(200);
      expect(restored.body.status).toBe("active");
      expect((await as(ownerToken).get("/wardrobe?status=active")).body.total).toBe(1);
      expect((await as(ownerToken).get("/wardrobe?status=archived")).body.total).toBe(0);
    });

    // decided on purpose: repeating archive or restore is not an error
    test("archive twice and restore twice both answer 200", async () => {
      const item = await createItem();

      for (let i = 0; i < 2; i++) {
        const res = await as(ownerToken).patch(`/wardrobe/${item._id}/archive`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("archived");
      }

      for (let i = 0; i < 2; i++) {
        const res = await as(ownerToken).patch(`/wardrobe/${item._id}/restore`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("active");
      }
    });

    test("a stranger cannot archive: 404 and the item is unchanged", async () => {
      const item = await createItem();
      const before = await WardrobeItem.findById(item._id).lean();

      const res = await as(strangerToken).patch(`/wardrobe/${item._id}/archive`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "item not found" });

      const after = await WardrobeItem.findById(item._id).lean();
      expect(after?.status).toBe("active");
      expect(after?.updatedAt).toEqual(before?.updatedAt);
    });

    test("a stranger cannot restore: 404 and the item stays archived", async () => {
      const item = await createItem();
      await as(ownerToken).patch(`/wardrobe/${item._id}/archive`).expect(200);
      const before = await WardrobeItem.findById(item._id).lean();

      const res = await as(strangerToken).patch(`/wardrobe/${item._id}/restore`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "item not found" });

      const after = await WardrobeItem.findById(item._id).lean();
      expect(after?.status).toBe("archived");
      expect(after?.updatedAt).toEqual(before?.updatedAt);
    });

    test.each(["archive", "restore"])("abc gives 400 invalid id on /%s", async (action) => {
      const res = await as(ownerToken).patch(`/wardrobe/abc/${action}`);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "invalid id" });
    });

    test.each(["archive", "restore"])("no token gives 401 on /%s", async (action) => {
      const item = await createItem();
      const res = await request(app).patch(`/wardrobe/${item._id}/${action}`);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Log in first" });
    });
  });

  describe("PATCH /wardrobe/:id", () => {
    test("the owner changes the size", async () => {
      const item = await createItem({ name: "Shirt", category: "top", size: "S" });
      const res = await as(ownerToken).patch(`/wardrobe/${item._id}`).send({ size: "M" });
      expect(res.status).toBe(200);
      expect(res.body.size).toBe("M");
      expect(res.body.name).toBe("Shirt");
    });

    test("a bad category gives 400 invalid input", async () => {
      const item = await createItem();
      const res = await as(ownerToken).patch(`/wardrobe/${item._id}`).send({ category: "spaceship" });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "invalid input" });
    });

    test("{} gives 400 nothing to change", async () => {
      const item = await createItem();
      const res = await as(ownerToken).patch(`/wardrobe/${item._id}`).send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "nothing to change" });
    });

    test("no body at all also gives 400 nothing to change", async () => {
      const item = await createItem();
      const res = await as(ownerToken).patch(`/wardrobe/${item._id}`);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "nothing to change" });
    });

    test("a fake ownerId in the body is ignored", async () => {
      const item = await createItem();
      const res = await as(ownerToken)
        .patch(`/wardrobe/${item._id}`)
        .send({ ownerId: strangerId, color: "green" });
      expect(res.status).toBe(200);
      expect(res.body.color).toBe("green");
      expect(res.body.ownerId).toBe(ownerId);

      const saved = await WardrobeItem.findById(item._id).lean();
      expect(String(saved?.ownerId)).toBe(ownerId);
    });

    test("a stranger gets 404 and the item is unchanged", async () => {
      const item = await createItem({ name: "Shirt", category: "top", size: "S" });
      const before = await WardrobeItem.findById(item._id).lean();

      const res = await as(strangerToken).patch(`/wardrobe/${item._id}`).send({ size: "XL" });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "item not found" });

      const after = await WardrobeItem.findById(item._id).lean();
      expect(after?.size).toBe("S");
      expect(after?.updatedAt).toEqual(before?.updatedAt);
    });

    test("abc gives 400 invalid id", async () => {
      const res = await as(ownerToken).patch("/wardrobe/abc").send({ size: "M" });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "invalid id" });
    });
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
  });
});

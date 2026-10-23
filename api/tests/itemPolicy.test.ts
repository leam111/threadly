import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { WardrobeItem } from "../models/WardrobeItem";
import {
  Actor,
  canViewItem,
  canEditItem,
  canArchiveItem,
  canRestoreItem,
  findItemFor,
} from "../policies/itemPolicy";

const OWNER_EMAIL = "policy-owner@test.com";
const STRANGER_EMAIL = "policy-stranger@test.com";
const MODERATOR_EMAIL = "policy-moderator@test.com";
const EMAILS = [OWNER_EMAIL, STRANGER_EMAIL, MODERATOR_EMAIL];

const CHECKS = { canViewItem, canEditItem, canArchiveItem, canRestoreItem };

describe("item policy", () => {
  let owner: Actor;
  let stranger: Actor;
  let moderator: Actor;
  let itemId = "";

  async function cleanItems() {
    const users = await User.find({ email: { $in: EMAILS } });
    await WardrobeItem.deleteMany({ ownerId: { $in: users.map((u) => u._id) } });
  }

  beforeAll(async () => {
    await cleanItems();
    await User.deleteMany({ email: { $in: EMAILS } });
    const passwordHash = await bcrypt.hash("abcd1234", 4);
    const o = await User.create({ email: OWNER_EMAIL, passwordHash });
    const s = await User.create({ email: STRANGER_EMAIL, passwordHash });
    const m = await User.create({ email: MODERATOR_EMAIL, passwordHash, role: "moderator" });
    owner = { id: String(o._id), role: o.role };
    stranger = { id: String(s._id), role: s.role };
    moderator = { id: String(m._id), role: m.role };

    const item = await WardrobeItem.create({ ownerId: o._id, name: "Shirt", category: "top" });
    itemId = String(item._id);
  });

  afterAll(async () => {
    await cleanItems();
    await User.deleteMany({ email: { $in: EMAILS } });
  });

  describe.each(Object.entries(CHECKS))("%s", (_name, check) => {
    test("says yes to the owner", async () => {
      const item = await WardrobeItem.findById(itemId);
      expect(check(owner, item!)).toBe(true);
    });

    test("says no to a stranger", async () => {
      const item = await WardrobeItem.findById(itemId);
      expect(check(stranger, item!)).toBe(false);
    });

    test("says no to a moderator too (no extra powers for now)", async () => {
      const item = await WardrobeItem.findById(itemId);
      expect(check(moderator, item!)).toBe(false);
    });
  });

  describe("findItemFor", () => {
    test("finds the item for its owner", async () => {
      const item = await findItemFor(owner, itemId);
      expect(item).not.toBeNull();
      expect(String(item!._id)).toBe(itemId);
    });

    test("gives null to a stranger", async () => {
      expect(await findItemFor(stranger, itemId)).toBeNull();
    });

    test("gives null to a moderator", async () => {
      expect(await findItemFor(moderator, itemId)).toBeNull();
    });

    test("gives null for a valid id that does not exist", async () => {
      expect(await findItemFor(owner, "64b7f0c2a1b2c3d4e5f60718")).toBeNull();
    });

    test("gives null for a broken id instead of crashing", async () => {
      expect(await findItemFor(owner, "abc")).toBeNull();
    });
  });
});

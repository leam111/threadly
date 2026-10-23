import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { z } from "zod";
import { WardrobeItem } from "../models/WardrobeItem";
import mongoose from "mongoose";
import { ITEM_CATEGORIES, ITEM_STATUSES, ITEM_NAME_MAX, ITEM_TEXT_MAX } from "../utils/wardrobeOptions";
import {
  Actor,
  canViewItem,
  canEditItem,
  canArchiveItem,
  canRestoreItem,
  findItemFor,
} from "../policies/itemPolicy";

const router = Router();

// checks the id, finds the item for the caller, then asks the policy
// it answers 400 or 404 itself and gives null, so the route only has to return
// a stranger gets the same 404 as an id that does not exist (see itemPolicy.ts)
async function loadAllowedItem(req: Request, res: Response, allowed: typeof canViewItem) {
  const id = req.params.id as string;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: "invalid id" });
    return null;
  }

  const actor: Actor = res.locals.user;
  const item = await findItemFor(actor, id);
  if (!item || !allowed(actor, item)) {
    res.status(404).json({ message: "item not found" });
    return null;
  }

  return item;
}

// Zod drops any key not listed here (like ownerId or status),
// so a client can never choose the owner or the status
const createItemSchema = z.object({
  name: z.string().trim().min(1).max(ITEM_NAME_MAX),
  category: z.enum(ITEM_CATEGORIES),
  brand: z.string().trim().max(ITEM_TEXT_MAX).optional(),
  color: z.string().trim().max(ITEM_TEXT_MAX).optional(),
  size: z.string().trim().max(ITEM_TEXT_MAX).optional(),
});

router.post("/", requireAuth, async (req, res) => {
  const result = createItemSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  const item = await WardrobeItem.create({
    ownerId: res.locals.user.id,
    ...result.data,
  });

  res.status(201).json(item);
});

const listItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20),
  status: z.enum(ITEM_STATUSES).optional(),
  category: z.enum(ITEM_CATEGORIES).optional(),
});

// the list is always "my items": the owner filter comes from the token,
// so it does not need the policy (there is no single item to ask about)
router.get("/", requireAuth, async (req, res) => {
  const result = listItemsQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ message: "invalid query" });
    return;
  }

  const page = result.data.page;
  const limit = Math.min(result.data.limit, 50);
  const filter: Record<string, unknown> = { ownerId: res.locals.user.id };
  if (result.data.status) {
    filter.status = result.data.status;
  }
  if (result.data.category) {
    filter.category = result.data.category;
  }

  const total = await WardrobeItem.countDocuments(filter);
  const items = await WardrobeItem.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.json({ page, limit, total, items });
});

router.get("/:id", requireAuth, async (req, res) => {
  const item = await loadAllowedItem(req, res, canViewItem);
  if (!item) {
    return;
  }

  res.json(item);
});

router.patch("/:id/archive", requireAuth, async (req, res) => {
  const item = await loadAllowedItem(req, res, canArchiveItem);
  if (!item) {
    return;
  }

  item.status = "archived";
  await item.save();
  res.json(item);
});

// the opposite of archive: put the item back in the active list
router.patch("/:id/restore", requireAuth, async (req, res) => {
  const item = await loadAllowedItem(req, res, canRestoreItem);
  if (!item) {
    return;
  }

  item.status = "active";
  await item.save();
  res.json(item);
});

const editItemSchema = createItemSchema.partial();

router.patch("/:id", requireAuth, async (req, res) => {
  // with no body at all, Express 5 leaves req.body undefined:
  // treat it like {} so the answer is "nothing to change", not "invalid input"
  const result = editItemSchema.safeParse(req.body ?? {});
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  if (Object.keys(result.data).length === 0) {
    res.status(400).json({ message: "nothing to change" });
    return;
  }

  const item = await loadAllowedItem(req, res, canEditItem);
  if (!item) {
    return;
  }

  item.set(result.data);
  await item.save();
  res.json(item);
});

export default router;

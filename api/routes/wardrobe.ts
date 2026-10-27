import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requirePermission";
import { writeLimiter } from "../middleware/rateLimiters";
import {
  createItem,
  listItems,
  getItem,
  archiveItem,
  restoreItem,
  editItem,
} from "../controllers/itemController";

const router = Router();

// every wardrobe route needs this permission (members and up have it)
const canManageWardrobe = requirePermission("wardrobe:manage_own");

router.post("/", writeLimiter, requireAuth, canManageWardrobe, createItem);
router.get("/", requireAuth, canManageWardrobe, listItems);
router.get("/:id", requireAuth, canManageWardrobe, getItem);
router.patch("/:id/archive", writeLimiter, requireAuth, canManageWardrobe, archiveItem);
router.patch("/:id/restore", writeLimiter, requireAuth, canManageWardrobe, restoreItem);
router.patch("/:id", writeLimiter, requireAuth, canManageWardrobe, editItem);

export default router;

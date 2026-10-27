import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requirePermission";
import { writeLimiter } from "../middleware/rateLimiters";
import { receiveImage } from "../middleware/receiveImage";
import {
  createItem,
  listItems,
  getItem,
  archiveItem,
  restoreItem,
  editItem,
  deleteItem,
  wearItem,
} from "../controllers/itemController";
import {
  uploadItemImage,
  listItemImages,
  editItemImage,
  deleteItemImage,
} from "../controllers/imageController";

const router = Router();

// every wardrobe route needs this permission (members and up have it)
const canManageWardrobe = requirePermission("wardrobe:manage_own");

router.post("/", writeLimiter, requireAuth, canManageWardrobe, createItem);
router.get("/", requireAuth, canManageWardrobe, listItems);
router.get("/:id", requireAuth, canManageWardrobe, getItem);
router.patch("/:id/archive", writeLimiter, requireAuth, canManageWardrobe, archiveItem);
router.patch("/:id/restore", writeLimiter, requireAuth, canManageWardrobe, restoreItem);
router.post("/:id/wear", writeLimiter, requireAuth, canManageWardrobe, wearItem);
router.patch("/:id", writeLimiter, requireAuth, canManageWardrobe, editItem);
router.delete("/:id", writeLimiter, requireAuth, canManageWardrobe, deleteItem);

// the photos of an item. receiveImage (multer) runs LAST, after the login and the permission,
// so an anonymous person cannot send a big file
router.post(
  "/:id/images",
  writeLimiter,
  requireAuth,
  canManageWardrobe,
  receiveImage,
  uploadItemImage,
);
router.get("/:id/images", requireAuth, canManageWardrobe, listItemImages);
router.patch("/:id/images/:imageId", writeLimiter, requireAuth, canManageWardrobe, editItemImage);
router.delete(
  "/:id/images/:imageId",
  writeLimiter,
  requireAuth,
  canManageWardrobe,
  deleteItemImage,
);

export default router;

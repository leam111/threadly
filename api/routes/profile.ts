import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { writeLimiter } from "../middleware/rateLimiters";
import { receiveImage } from "../middleware/receiveImage";
import {
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
  deleteMyAvatar,
} from "../controllers/profileController";

const router = Router();

// no id in any address here: the profile is always the caller's (see services/profileService.ts)
router.get("/me", requireAuth, getMyProfile);
router.patch("/me", writeLimiter, requireAuth, updateMyProfile);
// receiveImage (multer) runs LAST, after the login, so an anonymous person cannot send a big file
router.post("/me/avatar", writeLimiter, requireAuth, receiveImage, uploadMyAvatar);
router.delete("/me/avatar", writeLimiter, requireAuth, deleteMyAvatar);

export default router;

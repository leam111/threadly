import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { writeLimiter } from "../middleware/rateLimiters";
import { getMyProfile, updateMyProfile } from "../controllers/profileController";

const router = Router();

// no id in any address here: the profile is always the caller's (see services/profileService.ts)
router.get("/me", requireAuth, getMyProfile);
router.patch("/me", writeLimiter, requireAuth, updateMyProfile);

export default router;

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  registerLimiter,
  loginLimiter,
  RefreshLimiter,
  changePasswordLimiter,
  deactivateLimiter,
  logoutOthersLimiter,
} from "../middleware/rateLimiters";
import {
  register,
  login,
  me,
  refresh,
  logout,
  logoutOthers,
  changePassword,
  deactivate,
} from "../controllers/authController";

const router = Router();

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.get("/me", requireAuth, me);
router.post("/refresh", RefreshLimiter, refresh);
router.post("/logout", logout);
router.post("/logout-others", logoutOthersLimiter, requireAuth, logoutOthers);
router.post("/change-password", changePasswordLimiter, requireAuth, changePassword);
router.post("/deactivate", deactivateLimiter, requireAuth, deactivate);

export default router;

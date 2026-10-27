import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requirePermission";
import {
  setUserActive,
  listAudit,
  listUsers,
  listPermissions,
  listRoles,
  replaceRolePermissions,
  setUserRole,
} from "../controllers/adminController";

const router = Router();

router.patch("/users/:id/active", requireAuth, requirePermission("user:ban"), setUserActive);
router.get("/audit", requireAuth, requirePermission("audit:view"), listAudit);
router.get("/users", requireAuth, requirePermission("user:view"), listUsers);
router.get("/permissions", requireAuth, requirePermission("permission:edit"), listPermissions);
router.get("/roles", requireAuth, requirePermission("permission:edit"), listRoles);
router.put(
  "/roles/:name/permissions",
  requireAuth,
  requirePermission("permission:edit"),
  replaceRolePermissions,
);
router.patch("/users/:id/role", requireAuth, requirePermission("role:assign"), setUserRole);

export default router;

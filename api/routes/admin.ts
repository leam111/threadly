import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requirePermission";
import mongoose from "mongoose";
import { z } from "zod";
import { User } from "../models/User";
import { RefreshToken } from "../models/RefreshTokens";
import { AuditLog } from "../models/AuditLog";
import { Role } from "../models/Role";
import { Permission } from "../models/Permission";
import { RolePermission } from "../models/RolePermission";
import { logAudit } from "../utils/audit";
const router = Router();

// true when this user is the only active superadmin left
// (there must always be at least one, or nobody could change roles any more)
async function isLastActiveSuperadmin(user: { role?: string | null; isActive?: boolean | null }) {
  if (user.role !== "superadmin" || !user.isActive) {
    return false;
  }
  const activeSuperadmins = await User.countDocuments({ role: "superadmin", isActive: true });
  return activeSuperadmins <= 1;
}

const activeSchema = z.object({
  isActive: z.boolean(),
});

router.patch("/users/:id/active", requireAuth, requirePermission("user:ban"), async (req, res) => {
  const result = activeSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: "invalid id!" });
    return;
  }

  const userId = await User.findById(id);
  if (!userId) {
    res.status(404).json({ message: "user not found" });
    return;
  }

  const actor = res.locals.user;

  // nobody may switch off their own account
  if (actor.id === userId._id.toString() && result.data.isActive === false) {
    res.status(400).json({ message: "you cannot switch off your own account" });
    return;
  }

  // only a superadmin may change another superadmin
  if (userId.role === "superadmin" && actor.role !== "superadmin") {
    res.status(403).json({ message: "only a superadmin can change a superadmin" });
    return;
  }

  if (result.data.isActive === false && (await isLastActiveSuperadmin(userId))) {
    res.status(400).json({ message: "there must be at least one superadmin" });
    return;
  }

  userId.isActive = result.data.isActive;
  await userId.save();

  await logAudit({
    actorId: res.locals.user.id,
    action: userId.isActive ? "user.activate" : "user.deactivate",
    targetId: userId._id.toString(),
    details: { isActive: userId.isActive },
    ip: req.ip,
  });

  if (!userId.isActive) {
    await RefreshToken.updateMany(
      { userId: userId._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  }

  res.json({ message: "user updated", isActive: userId.isActive });
});

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20),
  action: z.string().optional(),
});

router.get("/audit", requireAuth, requirePermission("audit:view"), async (req, res) => {
  const result = auditQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ message: "invalid query" });
    return;
  }

  const page = result.data.page;
  const limit = Math.min(result.data.limit, 50);
  const filter = result.data.action ? { action: result.data.action } : {};

  const total = await AuditLog.countDocuments(filter);
  const items = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.json({ page, limit, total, items });
});

// put a "\" before every regex special character, so each one only means itself
function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20),
  email: z.string().trim().min(1).max(100).optional(),
  role: z.enum(["member", "moderator", "admin", "superadmin"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

router.get("/users", requireAuth, requirePermission("user:view"), async (req, res) => {
  const result = userListQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ message: "invalid query" });
    return;
  }

  const page = result.data.page;
  const limit = Math.min(result.data.limit, 50);

  // build the filter only from checked data, never from req.query
  const filter: Record<string, unknown> = {};
  if (result.data.email) {
    filter.email = { $regex: escapeRegex(result.data.email), $options: "i" };
  }
  if (result.data.role) {
    filter.role = result.data.role;
  }
  if (result.data.status) {
    filter.isActive = result.data.status === "active";
  }

  const total = await User.countDocuments(filter);
  const items = await User.find(filter)
    .select("-passwordHash")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.json({ page, limit, total, items });
});

// the permissions a role must never lose, or nobody could change roles any more
const SUPERADMIN_MUST_KEEP = ["role:assign", "permission:edit"];

router.get("/permissions", requireAuth, requirePermission("permission:edit"), async (req, res) => {
  const items = await Permission.find().select("name description -_id").sort({ name: 1 });
  res.json({ items });
});

router.get("/roles", requireAuth, requirePermission("permission:edit"), async (req, res) => {
  const roles = await Role.find().select("name description isSystem -_id").sort({ name: 1 });
  const rows = await RolePermission.find().sort({ permission: 1 });

  const items = roles.map((role) => ({
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: rows.filter((row) => row.role === role.name).map((row) => row.permission),
  }));

  res.json({ items });
});

const rolePermissionsSchema = z.object({
  permissions: z.array(z.string().trim().min(1).max(50)).max(100),
});

// replaces the whole permission list of one role
// the guard reads the database on every request, so the change works at once
router.put(
  "/roles/:name/permissions",
  requireAuth,
  requirePermission("permission:edit"),
  async (req, res) => {
    const result = rolePermissionsSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: "invalid input" });
      return;
    }

    // the same name twice counts once
    const wanted = [...new Set(result.data.permissions)].sort();

    // every name must be a real permission
    const known = await Permission.countDocuments({ name: { $in: wanted } });
    if (known !== wanted.length) {
      res.status(400).json({ message: "invalid input" });
      return;
    }

    const role = await Role.findOne({ name: req.params.name });
    if (!role) {
      res.status(404).json({ message: "role not found" });
      return;
    }

    if (
      role.name === "superadmin" &&
      !SUPERADMIN_MUST_KEEP.every((permission) => wanted.includes(permission))
    ) {
      res.status(400).json({ message: "superadmin must keep role:assign and permission:edit" });
      return;
    }

    const before = (await RolePermission.find({ role: role.name })).map((row) => row.permission);
    const added = wanted.filter((permission) => !before.includes(permission));
    const removed = before.filter((permission) => !wanted.includes(permission)).sort();

    if (added.length > 0) {
      await RolePermission.insertMany(added.map((permission) => ({ role: role.name, permission })));
    }
    if (removed.length > 0) {
      await RolePermission.deleteMany({ role: role.name, permission: { $in: removed } });
    }

    // targetId can only hold a user id, so the role name goes in the details
    await logAudit({
      actorId: res.locals.user.id,
      action: "permission.edit",
      details: { role: role.name, added, removed },
      ip: req.ip,
    });

    res.json({ message: "role updated", role: role.name, permissions: wanted });
  },
);

const userRoleSchema = z.object({
  role: z.string().trim().min(1).max(50),
});

router.patch("/users/:id/role", requireAuth, requirePermission("role:assign"), async (req, res) => {
  const result = userRoleSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: "invalid id!" });
    return;
  }

  const target = await User.findById(id);
  if (!target) {
    res.status(404).json({ message: "user not found" });
    return;
  }

  // the role must exist in the database
  const newRole = result.data.role;
  if (!(await Role.exists({ name: newRole }))) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  const actor = res.locals.user;

  if (actor.id === target._id.toString()) {
    res.status(400).json({ message: "you cannot change your own role" });
    return;
  }

  const oldRole = target.role;
  if (oldRole === newRole) {
    res.status(400).json({ message: "nothing to change" });
    return;
  }

  // giving or taking the superadmin role, or changing a superadmin: superadmin only
  if ((oldRole === "superadmin" || newRole === "superadmin") && actor.role !== "superadmin") {
    res.status(403).json({ message: "only a superadmin can change a superadmin" });
    return;
  }

  if (await isLastActiveSuperadmin(target)) {
    res.status(400).json({ message: "there must be at least one superadmin" });
    return;
  }

  target.set("role", newRole);
  await target.save();

  await logAudit({
    actorId: actor.id,
    action: "role.assign",
    targetId: target._id.toString(),
    details: { from: oldRole, to: newRole },
    ip: req.ip,
  });

  res.json({ message: "role updated", role: newRole });
});

export default router;

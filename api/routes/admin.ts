import {Router} from "express";
import {requireAuth} from "../middleware/requireAuth";
import {requireRole} from "../middleware/requireRole";
import mongoose from 'mongoose';
import {z} from "zod";
import { User} from "../models/User";
import { RefreshToken } from "../models/RefreshTokens";
import { AuditLog } from "../models/AuditLog";
import { logAudit } from "../utils/audit";
const router = Router();


const activeSchema =z.object({
  isActive : z.boolean()
})

router.patch("/users/:id/active", requireAuth,requireRole(["admin","superadmin"]), async (req, res) => {
 
const result = activeSchema.safeParse(req.body);
if(!result.success){
   res.status(400).json({message:"invalid input"});
    return ;
}




 const id = req.params.id;
 if(!mongoose.isValidObjectId(id)){
res.status(400).json({message:"invalid id!"});
return;
 }

const userId = await User.findById(id);
if(!userId){
  res.status(404).json({message:"user not found"});
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


  userId.isActive = result.data.isActive;
  await userId.save();

await logAudit({actorId:res.locals.user.id , action: userId.isActive ? "user.activate" : "user.deactivate",targetId:userId._id.toString(),details:{isActive:userId.isActive },ip:req.ip});





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

router.get("/audit", requireAuth, requireRole(["admin", "superadmin"]), async (req, res) => {
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

router.get("/users", requireAuth, requireRole(["admin", "superadmin"]), async (req, res) => {
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


export default router;
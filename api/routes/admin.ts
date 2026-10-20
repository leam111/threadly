import {Router} from "express";
import {requireAuth} from "../middleware/requireAuth";
import {requireRole} from "../middleware/requireRole";
import mongoose from 'mongoose';
import {z} from "zod";
import { User} from "../models/User";
import { RefreshToken } from "../models/RefreshTokens";
import { AuditLog } from "../models/AuditLog";
import { logAudit } from "../utils/audit";
import { isAscii } from "node:buffer";
const router = Router();



router.get("/leaaa", requireAuth, requireRole(["admin","superadmin"]), (req, res) => {
  res.json({ message: "Welcome to the admin route!" });
});


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









export default router;
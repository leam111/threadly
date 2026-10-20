import {Router} from "express";
import {requireAuth} from "../middleware/requireAuth";
import {requireRole} from "../middleware/requireRole";
import mongoose from 'mongoose';
import {z} from "zod";
import { User} from "../models/User";
import { RefreshToken } from "../models/RefreshTokens";

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

  if (!userId.isActive) {
    await RefreshToken.updateMany(
      { userId: userId._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  }

  res.json({ message: "user updated", isActive: userId.isActive });



});












export default router;
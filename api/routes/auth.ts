import { Router } from "express";
import {z} from "zod";
import bcrypt from "bcryptjs";
import {User} from '../models/User';

const router =Router();
const registerSchema = z.object({
email : z.email(),
password : z.string().min(8),
});

router.post("/register",async(req,res)=>{
const result = registerSchema.safeParse(req.body);
if(!result.success){
    res.status(400).json({message:"invalid email , or password shorter than 8 characters"});
    return;
}

const email = result.data.email;
const {password}=result.data;
const existingUser = await User.findOne({email});

if(existingUser){
 res.status(409).json({message:"user with this email already exists"});
return;
}
const passwordHash = await bcrypt.hash(password,12);
const user = await User.create({email,passwordHash});
res.status(201).json({message:"user created successfully",userId:user._id , email:user.email,role:user.role});





});

export default router;
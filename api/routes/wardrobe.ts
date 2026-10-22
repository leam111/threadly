import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {z}from "zod";
import { WardrobeItem } from "../models/WardrobeItem";

const router  = Router();


const createItemSchema = z.object({
name:z.string().trim().min(1).max(100),
category: z.enum(["top","bottom","dress","outerwear","shoes","accessory","other"]),
brand:z.string().trim().max(50).optional(),
color:z.string().trim().max(50).optional(),
size:z.string().trim().max(50).optional()


});

router.post("/",requireAuth,async(req,res)=>{
const result = createItemSchema.safeParse(req.body);

if(!result.success){
res.status(400).json({message:"invalid input"});
return;
}
const item = await WardrobeItem.create({
ownerId : res.locals.user.id,
...result.data,

});

res.status(201).json(item);
return;


});



export default router;
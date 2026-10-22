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







const listItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20),
 status: z.enum(["active", "archived"]).optional(),
  category: z.enum(["top","bottom","dress","outerwear","shoes","accessory","other"]).optional(),

});

router.get("/", requireAuth, async (req, res) => {
  const result = listItemsQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ message: "invalid query" });
    return;
  }

  const page = result.data.page;
  const limit = Math.min(result.data.limit, 50);

  const filter: Record<string, unknown> = {ownerId:res.locals.user.id};


if (result.data.status) {
  filter.status = result.data.status;
}

if (result.data.category) {
  filter.category = result.data.category;
}


const total = await WardrobeItem.countDocuments(filter);
const items = await WardrobeItem.find(filter)
  .sort({ createdAt: -1 })
  .skip((page - 1) * limit)
  .limit(limit);

  res.json({ page, limit, total,items });
});



















export default router;
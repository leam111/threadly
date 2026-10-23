import { Schema, model } from "mongoose";
import { ITEM_CATEGORIES, ITEM_STATUSES, ITEM_NAME_MAX, ITEM_TEXT_MAX } from "../utils/wardrobeOptions";

const WardrobeItemSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxLength: ITEM_NAME_MAX },
    category: { type: String, required: true, enum: ITEM_CATEGORIES },
    brand: { type: String, trim: true, maxLength: ITEM_TEXT_MAX },
    color: { type: String, trim: true, maxLength: ITEM_TEXT_MAX },
    size: { type: String, trim: true, maxLength: ITEM_TEXT_MAX },
    status: { type: String, default: "active", enum: ITEM_STATUSES },
  },
  { timestamps: true }
);

// the list asks "my items, newest first": this index answers it directly
// it also starts with ownerId, so it serves every "find by owner" lookup too
WardrobeItemSchema.index({ ownerId: 1, createdAt: -1 });

export const WardrobeItem = model("WardrobeItem", WardrobeItemSchema);

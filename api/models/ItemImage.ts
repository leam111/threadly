import { Schema, model } from "mongoose";
import { IMAGE_KINDS, IMAGE_ALT_MAX } from "../utils/imageOptions";

// One photo of a wardrobe item. The file itself is in the image storage (a private bucket);
// here we keep only its path and some facts about it. No link is stored: a fresh signed link
// is made for every answer.
const ItemImageSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "WardrobeItem", required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: IMAGE_KINDS, default: "original" },
    // where the file is in the bucket: items/<ownerId>/<itemId>/<uuid>.<ext>
    // NEVER sent in an answer
    storagePath: { type: String, required: true },
    alt: { type: String, trim: true, maxLength: IMAGE_ALT_MAX },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
    bytes: { type: Number, required: true, min: 1 },
    mimeType: { type: String, required: true },
  },
  { timestamps: true },
);

// when an image is turned into JSON, leave out __v and the storage path
// (a second safety: dtos/imageDto.ts also picks only the fields it sends)
ItemImageSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const { __v, storagePath: _storagePath, ...rest } = ret;
    return rest;
  },
});

// "the images of this item, newest first" (and the oldest one, for the cover)
ItemImageSchema.index({ itemId: 1, createdAt: -1 });
// "all the images of this owner"
ItemImageSchema.index({ ownerId: 1 });

export const ItemImage = model("ItemImage", ItemImageSchema);

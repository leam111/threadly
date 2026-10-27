import { Types } from "mongoose";
import { ItemImage } from "../models/ItemImage";

// one image with this id, on this item, of this owner, or null
// (the owner and the item are part of the query, so someone else's image is never found)
function findOnItem(ownerId: string, itemId: Types.ObjectId, imageId: string) {
  return ItemImage.findOne({ _id: imageId, itemId, ownerId });
}

// an item image as the database gives it (a Mongoose document)
export type ImageDocument = NonNullable<Awaited<ReturnType<typeof findOnItem>>>;

export type NewImage = {
  itemId: Types.ObjectId;
  ownerId: string;
  storagePath: string;
  alt?: string;
  width?: number;
  height?: number;
  bytes: number;
  mimeType: string;
};

// every database query for item images lives here
export const imageRepository = {
  findOnItem,

  // kind is not given: it is always "original" (the model's default)
  create(fields: NewImage) {
    return ItemImage.create(fields);
  },

  countForItem(itemId: Types.ObjectId) {
    return ItemImage.countDocuments({ itemId });
  },

  // newest first
  listForItem(itemId: Types.ObjectId) {
    return ItemImage.find({ itemId }).sort({ createdAt: -1, _id: -1 });
  },

  // undefined removes alt: Mongoose sends $unset when it saves
  async setAlt(image: ImageDocument, alt: string | undefined) {
    image.set("alt", alt);
    await image.save();
    return image;
  },

  async deleteOne(image: ImageDocument) {
    await ItemImage.deleteOne({ _id: image._id, ownerId: image.ownerId });
  },

  // the cover of each item: the storage path of its OLDEST original image
  // ONE query for a whole page of items. Gives a map: item id -> storage path
  async coverPaths(itemIds: Types.ObjectId[]) {
    const covers = new Map<string, string>();
    if (itemIds.length === 0) {
      return covers;
    }

    const rows = await ItemImage.aggregate<{ _id: Types.ObjectId; storagePath: string }>([
      { $match: { itemId: { $in: itemIds }, kind: "original" } },
      { $sort: { itemId: 1, createdAt: 1, _id: 1 } },
      { $group: { _id: "$itemId", storagePath: { $first: "$storagePath" } } },
    ]);
    for (const row of rows) {
      covers.set(String(row._id), row.storagePath);
    }
    return covers;
  },
};

export type ImageRepository = typeof imageRepository;

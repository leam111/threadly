import { WardrobeItem } from "../models/WardrobeItem";
import type { ItemCategory, ItemSeason, ItemStatus } from "../utils/wardrobeOptions";

export type ItemListFilters = {
  status?: ItemStatus;
  category?: ItemCategory;
  color?: string;
  season?: ItemSeason;
  styleTag?: string;
  notWornSince?: Date;
};

// "not soft deleted": $ne also matches an old item that has no isDeleted field yet
const NOT_DELETED = { isDeleted: { $ne: true } };

// one item with this id AND this owner that is not deleted, or null
// (the owner is part of the query, so someone else's item is never found)
function findOwned(ownerId: string, id: string) {
  return WardrobeItem.findOne({ _id: id, ownerId, ...NOT_DELETED });
}

// a wardrobe item as the database gives it (a Mongoose document)
export type ItemDocument = NonNullable<Awaited<ReturnType<typeof findOwned>>>;

// every database query for wardrobe items lives here
export const itemRepository = {
  findOwned,

  create(ownerId: string, fields: Record<string, unknown>) {
    return WardrobeItem.create({ ownerId, ...fields });
  },

  // one page of this owner's items, newest first, and how many there are in total
  async listByOwner(ownerId: string, filters: ItemListFilters, page: number, limit: number) {
    // the owner and "not deleted" are ALWAYS in the filter; the others are added when given
    const filter: Record<string, unknown> = { ownerId, ...NOT_DELETED };
    if (filters.status) {
      filter.status = filters.status;
    }
    if (filters.category) {
      filter.category = filters.category;
    }
    if (filters.color) {
      // on a list field, { colors: "red" } means "the list contains red"
      filter.colors = filters.color;
    }
    if (filters.season) {
      // an "all" season item is worn in every season, so it matches any season filter
      filter.season = { $in: [...new Set([filters.season, "all"])] };
    }
    if (filters.styleTag) {
      filter.styleTags = filters.styleTag;
    }
    if (filters.notWornSince) {
      // worn last before that date, or never worn (null also matches a missing field)
      filter.$or = [{ lastWornAt: { $lt: filters.notWornSince } }, { lastWornAt: null }];
    }

    const total = await WardrobeItem.countDocuments(filter);
    const items = await WardrobeItem.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    return { total, items };
  },

  async setStatus(item: ItemDocument, status: ItemStatus) {
    item.status = status;
    await item.save();
    return item;
  },

  // never a real delete: the item is only marked, and every query above skips it
  async softDelete(item: ItemDocument) {
    item.isDeleted = true;
    item.deletedAt = new Date();
    await item.save();
  },

  // wearCount + 1 and lastWornAt = now, in ONE database step ($inc), so two wears at the
  // same moment both count. Gives the updated item, or null if it was deleted in between
  recordWear(item: ItemDocument) {
    return WardrobeItem.findOneAndUpdate(
      { _id: item._id, ownerId: item.ownerId, ...NOT_DELETED },
      { $inc: { wearCount: 1 }, $set: { lastWornAt: new Date() } },
      { returnDocument: "after" },
    );
  },

  // a value of undefined removes the field: Mongoose sends $unset when it saves
  async applyChanges(item: ItemDocument, changes: Record<string, unknown>) {
    for (const [key, value] of Object.entries(changes)) {
      item.set(key, value);
    }
    await item.save();
    return item;
  },
};

export type ItemRepository = typeof itemRepository;

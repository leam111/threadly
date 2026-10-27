import { WardrobeItem } from "../models/WardrobeItem";
import { ITEM_CATEGORIES, ITEM_STATUSES } from "../utils/wardrobeOptions";

type ItemStatus = (typeof ITEM_STATUSES)[number];
type ItemCategory = (typeof ITEM_CATEGORIES)[number];

// one item with this id AND this owner, or null
// (the owner is part of the query, so someone else's item is never found)
function findOwned(ownerId: string, id: string) {
  return WardrobeItem.findOne({ _id: id, ownerId });
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
  async listByOwner(
    ownerId: string,
    filters: { status?: ItemStatus; category?: ItemCategory },
    page: number,
    limit: number,
  ) {
    const filter: Record<string, unknown> = { ownerId };
    if (filters.status) {
      filter.status = filters.status;
    }
    if (filters.category) {
      filter.category = filters.category;
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

import { Db, dropIndexIfExists } from "../scripts/indexTools";

// Item images (Step 4): the two indexes of the new "itemimages" collection
// - itemId + createdAt: "the images of this item, newest first", and the cover (the oldest)
// - ownerId: "all the images of this owner"
//
// Safe to run twice: createIndex does nothing when the same index already exists,
// and down only drops an index that is there. No image document is changed or deleted.
// Values are written out here on purpose (not imported): a migration must always do the same thing.

const COLLECTION = "itemimages";
const ITEM_INDEX = "itemId_1_createdAt_-1";
const OWNER_INDEX = "ownerId_1";

export async function up(db: Db) {
  const images = db.collection(COLLECTION);
  await images.createIndex({ itemId: 1, createdAt: -1 }, { name: ITEM_INDEX });
  await images.createIndex({ ownerId: 1 }, { name: OWNER_INDEX });
}

export async function down(db: Db) {
  await dropIndexIfExists(db, COLLECTION, ITEM_INDEX);
  await dropIndexIfExists(db, COLLECTION, OWNER_INDEX);
}

import { Db, dropIndexIfExists } from "../scripts/indexTools";

// The wardrobe list asks "my items, newest first".
// The old index on ownerId alone is replaced by ownerId + createdAt,
// which answers that question directly and still serves every "find by owner".
// (This replaces the manual step in Atlas.)

const COLLECTION = "wardrobeitems";

export async function up(db: Db) {
  await dropIndexIfExists(db, COLLECTION, "ownerId_1");
  // createIndex does nothing when the same index already exists
  await db
    .collection(COLLECTION)
    .createIndex({ ownerId: 1, createdAt: -1 }, { name: "ownerId_1_createdAt_-1" });
}

export async function down(db: Db) {
  await db.collection(COLLECTION).createIndex({ ownerId: 1 }, { name: "ownerId_1" });
  await dropIndexIfExists(db, COLLECTION, "ownerId_1_createdAt_-1");
}

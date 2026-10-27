import { Db, dropIndexIfExists } from "../scripts/indexTools";

// The richer wardrobe (Step 2):
// - the status "active" is renamed "in_closet"
// - every item gets isDeleted: false and wearCount: 0 when the field is missing
// - a new index answers "my items with this status"
//
// Safe to run twice: each update only touches items that still need it.
// Values are written out here on purpose (not imported): a migration must always do the same thing.

const COLLECTION = "wardrobeitems";
const STATUS_INDEX = "ownerId_1_status_1";

export async function up(db: Db) {
  const items = db.collection(COLLECTION);

  await items.updateMany({ status: "active" }, { $set: { status: "in_closet" } });
  await items.updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } });
  await items.updateMany({ wearCount: { $exists: false } }, { $set: { wearCount: 0 } });

  // createIndex does nothing when the same index already exists
  await items.createIndex({ ownerId: 1, status: 1 }, { name: STATUS_INDEX });
}

export async function down(db: Db) {
  const items = db.collection(COLLECTION);

  await items.updateMany({ status: "in_closet" }, { $set: { status: "active" } });
  // the old code does not know these fields: remove them only where they still hold the
  // starting value, so nothing a user did is lost
  await items.updateMany({ isDeleted: false }, { $unset: { isDeleted: "" } });
  await items.updateMany({ wearCount: 0 }, { $unset: { wearCount: "" } });

  await dropIndexIfExists(db, COLLECTION, STATUS_INDEX);
}

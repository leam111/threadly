import { Db, findIndex, dropIndexIfExists } from "../scripts/indexTools";

// A TTL ("time to live") index: MongoDB deletes a refresh token by itself
// once its expiresAt date has passed (expireAfterSeconds 0 = right at that date).
// MongoDB checks about once a minute, so a token can stay a little longer;
// the refresh route still refuses it, because it checks expiresAt itself.
//
// Why it is safe: an expired token can never be swapped for a new one anyway.
// Reuse detection (a used token shown again cancels its family) only matters
// while a token is not expired, and those tokens are never deleted.

const COLLECTION = "refreshtokens";
const NAME = "expiresAt_1";

export async function up(db: Db) {
  // an older plain index with the same name would block the TTL one: replace it
  const existing = await findIndex(db, COLLECTION, NAME);
  if (existing && existing.expireAfterSeconds !== 0) {
    await db.collection(COLLECTION).dropIndex(NAME);
  }
  await db
    .collection(COLLECTION)
    .createIndex({ expiresAt: 1 }, { name: NAME, expireAfterSeconds: 0 });
}

export async function down(db: Db) {
  await dropIndexIfExists(db, COLLECTION, NAME);
}

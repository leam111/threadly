import type mongoose from "mongoose";

// small helpers for the migrations, so each migration can say
// "only if it exists" and run twice without breaking (idempotent)
// (they live here, not in migrations/, because migrate-mongo runs every file in that folder)

export type Db = mongoose.mongo.Db;

// the index with this name, or undefined
// a collection that does not exist yet simply has no indexes
export async function findIndex(db: Db, collection: string, name: string) {
  try {
    const indexes = await db.collection(collection).indexes();
    return indexes.find((index) => index.name === name);
  } catch (error) {
    if ((error as { codeName?: string }).codeName === "NamespaceNotFound") {
      return undefined;
    }
    throw error;
  }
}

export async function dropIndexIfExists(db: Db, collection: string, name: string) {
  if (await findIndex(db, collection, name)) {
    await db.collection(collection).dropIndex(name);
  }
}

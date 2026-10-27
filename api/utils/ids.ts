import mongoose from "mongoose";

// true when the text has the shape of a MongoDB id
// (only a check of the text: it never asks the database)
export function isValidId(id: string) {
  return mongoose.isValidObjectId(id);
}

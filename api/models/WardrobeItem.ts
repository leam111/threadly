import { Schema, model } from "mongoose";
import {
  ITEM_CATEGORIES,
  ITEM_STATUSES,
  ITEM_SEASONS,
  ITEM_CONDITIONS,
  ITEM_NAME_MAX,
  ITEM_TEXT_MAX,
  ITEM_PATTERN_MAX,
  ITEM_NOTES_MAX,
  ITEM_WORD_MAX,
  ITEM_COLORS_MAX,
  ITEM_STYLE_TAGS_MAX,
  ITEM_PRICE_MAX,
  hasAtMostTwoDecimals,
} from "../utils/wardrobeOptions";

// a list of short lowercase words (colors, styleTags): at most `max`, and no word twice
function wordList(max: number, label: string) {
  return {
    type: [{ type: String, trim: true, lowercase: true, minLength: 1, maxLength: ITEM_WORD_MAX }],
    // no empty list is stored for an item that never had one
    default: undefined,
    validate: [
      {
        validator: (list: string[]) => list.length <= max,
        message: `at most ${max} ${label}`,
      },
      {
        validator: (list: string[]) => new Set(list).size === list.length,
        message: `${label} must not repeat`,
      },
    ],
  };
}

const WardrobeItemSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxLength: ITEM_NAME_MAX },
    category: { type: String, required: true, enum: ITEM_CATEGORIES },
    subCategory: { type: String, trim: true, maxLength: ITEM_TEXT_MAX },
    brand: { type: String, trim: true, maxLength: ITEM_TEXT_MAX },
    color: { type: String, trim: true, maxLength: ITEM_TEXT_MAX },
    colors: wordList(ITEM_COLORS_MAX, "colors"),
    size: { type: String, trim: true, maxLength: ITEM_TEXT_MAX },
    pattern: { type: String, trim: true, maxLength: ITEM_PATTERN_MAX },
    material: { type: String, trim: true, maxLength: ITEM_TEXT_MAX },
    season: { type: String, enum: ITEM_SEASONS },
    styleTags: wordList(ITEM_STYLE_TAGS_MAX, "style tags"),
    condition: { type: String, enum: ITEM_CONDITIONS },
    purchasePrice: {
      type: Number,
      min: 0,
      max: ITEM_PRICE_MAX,
      validate: {
        validator: hasAtMostTwoDecimals,
        message: "the price has at most 2 decimals",
      },
    },
    notes: { type: String, trim: true, maxLength: ITEM_NOTES_MAX },
    status: { type: String, default: "in_closet", enum: ITEM_STATUSES },

    // managed by the server only: never taken from a request body
    wearCount: { type: Number, default: 0, min: 0 },
    lastWornAt: { type: Date },
    // soft delete: the item stays in the database, but every route acts as if it was gone
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

// when an item is turned into JSON for an answer, leave out __v
// (Mongoose's internal version number) and the soft delete fields. They are still stored
// (set here, not in the options above, so TypeScript still knows the item's fields)
WardrobeItemSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const { __v, isDeleted: _isDeleted, deletedAt: _deletedAt, ...rest } = ret;
    return rest;
  },
});

// the list asks "my items, newest first": this index answers it directly
// it also starts with ownerId, so it serves every "find by owner" lookup too
WardrobeItemSchema.index({ ownerId: 1, createdAt: -1 });
// "my items with this status" (the same index as migration 004)
WardrobeItemSchema.index({ ownerId: 1, status: 1 });

export const WardrobeItem = model("WardrobeItem", WardrobeItemSchema);

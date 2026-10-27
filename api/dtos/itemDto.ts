import { z } from "zod";
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
import type { ItemDocument } from "../repositories/itemRepository";

// ---- what comes in ----

// an optional text: "" is allowed, it means "clear this field"
function optionalText(max: number) {
  return z.string().trim().max(max).optional();
}

// one of a fixed list, or "" to clear it
function optionalChoice<T extends readonly [string, ...string[]]>(values: T) {
  return z.union([z.enum(values), z.literal("")]).optional();
}

// one short word, trimmed and in lowercase ("  Navy " becomes "navy")
const word = z.string().trim().toLowerCase().min(1).max(ITEM_WORD_MAX);

// a list of words: at most `max`, and no word twice (checked after the lowercase step)
// [] is allowed, it means "clear this list"
function wordList(max: number) {
  return z
    .array(word)
    .max(max)
    .refine((list) => new Set(list).size === list.length)
    .optional();
}

// Zod drops any key not listed here (like ownerId, status, wearCount, lastWornAt or isDeleted),
// so a client can never choose the owner, the status or the server-managed fields
export const createItemSchema = z.object({
  name: z.string().trim().min(1).max(ITEM_NAME_MAX),
  category: z.enum(ITEM_CATEGORIES),
  subCategory: optionalText(ITEM_TEXT_MAX),
  brand: optionalText(ITEM_TEXT_MAX),
  color: optionalText(ITEM_TEXT_MAX),
  colors: wordList(ITEM_COLORS_MAX),
  size: optionalText(ITEM_TEXT_MAX),
  pattern: optionalText(ITEM_PATTERN_MAX),
  material: optionalText(ITEM_TEXT_MAX),
  season: optionalChoice(ITEM_SEASONS),
  styleTags: wordList(ITEM_STYLE_TAGS_MAX),
  condition: optionalChoice(ITEM_CONDITIONS),
  // a number from 0 to 1000000 with at most 2 decimals, or null to clear it
  purchasePrice: z
    .number()
    .min(0)
    .max(ITEM_PRICE_MAX)
    .refine(hasAtMostTwoDecimals)
    .nullable()
    .optional(),
  notes: optionalText(ITEM_NOTES_MAX),
});

// the same fields, all optional (name still needs at least 1 character when it is sent)
export const editItemSchema = createItemSchema.partial();

export const listItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20),
  status: z.enum(ITEM_STATUSES).optional(),
  category: z.enum(ITEM_CATEGORIES).optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type EditItemInput = z.infer<typeof editItemSchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;

// a value that means "nothing here": "" for a text or a choice, [] for a list, null for the price
export function isEmptyValue(value: unknown) {
  return value === "" || value === null || (Array.isArray(value) && value.length === 0);
}

// ---- what goes out ----

// the item as JSON: the model's toJSON leaves out __v, isDeleted and deletedAt
// colors and styleTags are always lists, even when the item has none
export function toItemDto(item: ItemDocument) {
  const json = item.toJSON();
  return { ...json, colors: json.colors ?? [], styleTags: json.styleTags ?? [] };
}

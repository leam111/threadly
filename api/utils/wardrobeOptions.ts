// the allowed values for a wardrobe item, kept in ONE place
// the model, the Zod schemas and the repository all read these lists, so they can never drift apart
export const ITEM_CATEGORIES = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "shoes",
  "accessory",
  "bag",
  "other",
] as const;

// in_closet: the normal state. archived: hidden by the owner.
// listed and sold belong to the marketplace (later): the API cannot set them yet
export const ITEM_STATUSES = ["in_closet", "listed", "sold", "archived"] as const;
export const ITEM_SEASONS = ["spring", "summer", "autumn", "winter", "all"] as const;
export const ITEM_CONDITIONS = ["new_with_tags", "like_new", "very_good", "good", "fair"] as const;

// the list filter "not worn for N days" accepts only these
export const NOT_WORN_DAYS = ["30", "60", "90"] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
export type ItemSeason = (typeof ITEM_SEASONS)[number];

// the longest text we accept for each field
export const ITEM_NAME_MAX = 100;
export const ITEM_TEXT_MAX = 50; // brand, color, size, subCategory, material
export const ITEM_PATTERN_MAX = 30;
export const ITEM_NOTES_MAX = 500;

// the lists of words (colors, styleTags)
export const ITEM_WORD_MAX = 30; // each word: 1 to 30 characters
export const ITEM_COLORS_MAX = 5;
export const ITEM_STYLE_TAGS_MAX = 10;

export const ITEM_PRICE_MAX = 1_000_000;

// true when the number has at most 2 decimals (12.5 and 12.99 yes, 12.999 no)
// (computed with a small tolerance, because 0.1 * 100 is 10.000000000000002 for a computer)
export function hasAtMostTwoDecimals(value: number) {
  const cents = value * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-6;
}

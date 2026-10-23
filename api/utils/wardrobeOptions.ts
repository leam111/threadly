// the allowed values for a wardrobe item, kept in ONE place
// the model and the Zod schemas both read these lists, so they can never drift apart
export const ITEM_CATEGORIES = ["top", "bottom", "dress", "outerwear", "shoes", "accessory", "other"] as const;
export const ITEM_STATUSES = ["active", "archived"] as const;

// the longest text we accept for each field
export const ITEM_NAME_MAX = 100;
export const ITEM_TEXT_MAX = 50;

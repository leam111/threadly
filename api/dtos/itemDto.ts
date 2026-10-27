import { z } from "zod";
import {
  ITEM_CATEGORIES,
  ITEM_STATUSES,
  ITEM_NAME_MAX,
  ITEM_TEXT_MAX,
} from "../utils/wardrobeOptions";
import type { ItemDocument } from "../repositories/itemRepository";

// ---- what comes in ----

// Zod drops any key not listed here (like ownerId or status),
// so a client can never choose the owner or the status
export const createItemSchema = z.object({
  name: z.string().trim().min(1).max(ITEM_NAME_MAX),
  category: z.enum(ITEM_CATEGORIES),
  brand: z.string().trim().max(ITEM_TEXT_MAX).optional(),
  color: z.string().trim().max(ITEM_TEXT_MAX).optional(),
  size: z.string().trim().max(ITEM_TEXT_MAX).optional(),
});

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

// ---- what goes out ----

// the item as JSON: the model's toJSON leaves out __v
export function toItemDto(item: ItemDocument) {
  return item.toJSON();
}

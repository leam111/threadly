import { AppError } from "../utils/appError";
import {
  Actor,
  canViewItem,
  canEditItem,
  canArchiveItem,
  canRestoreItem,
  lookupItemFor,
} from "../policies/itemPolicy";
import { isEmptyValue } from "../dtos/itemDto";
import type { CreateItemInput, EditItemInput, ListItemsQuery } from "../dtos/itemDto";
import type { ItemRepository } from "../repositories/itemRepository";

export function makeItemService({ items }: { items: ItemRepository }) {
  // checks the id, finds the item for the caller, then asks the policy
  // a stranger gets the same 404 as an id that does not exist (see itemPolicy.ts)
  async function loadAllowedItem(actor: Actor, id: string, allowed: typeof canViewItem) {
    const { validId, item } = await lookupItemFor(actor, id);
    if (!validId) {
      throw new AppError(400, "invalid id");
    }

    if (!item || !allowed(actor, item)) {
      throw new AppError(404, "item not found");
    }

    return item;
  }

  return {
    // the owner always comes from the token (actor), never from the body
    create(actor: Actor, input: CreateItemInput) {
      // an empty optional value (like brand: "", colors: [] or purchasePrice: null) is simply not saved
      const fields = Object.fromEntries(
        Object.entries(input).filter(([, value]) => !isEmptyValue(value)),
      );
      return items.create(actor.id, fields);
    },

    // the list is always "my items": the owner filter comes from the token,
    // so it does not need the policy (there is no single item to ask about)
    async list(actor: Actor, query: ListItemsQuery) {
      const page = query.page;
      const limit = Math.min(query.limit, 50);
      const { total, items: list } = await items.listByOwner(
        actor.id,
        { status: query.status, category: query.category },
        page,
        limit,
      );
      return { page, limit, total, items: list };
    },

    get(actor: Actor, id: string) {
      return loadAllowedItem(actor, id, canViewItem);
    },

    async archive(actor: Actor, id: string) {
      const item = await loadAllowedItem(actor, id, canArchiveItem);
      return items.setStatus(item, "archived");
    },

    // the opposite of archive: put the item back in the closet
    async restore(actor: Actor, id: string) {
      const item = await loadAllowedItem(actor, id, canRestoreItem);
      return items.setStatus(item, "in_closet");
    },

    async edit(actor: Actor, id: string, input: EditItemInput) {
      // checked before the id, as before: {} on any id answers "nothing to change"
      if (Object.keys(input).length === 0) {
        throw new AppError(400, "nothing to change");
      }

      const item = await loadAllowedItem(actor, id, canEditItem);

      // an empty value ("" for a text or a choice, [] for a list, null for the price) clears
      // the field: it becomes undefined, and the field is removed from the database when the
      // item is saved (name can never be "": Zod asks for at least 1 character)
      const changes = Object.fromEntries(
        Object.entries(input).map(([key, value]) => [key, isEmptyValue(value) ? undefined : value]),
      );
      return items.applyChanges(item, changes);
    },
  };
}

export type ItemService = ReturnType<typeof makeItemService>;

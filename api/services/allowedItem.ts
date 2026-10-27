import { AppError } from "../utils/appError";
import { Actor, canViewItem, lookupItemFor } from "../policies/itemPolicy";

// checks the id, finds the item for the caller, then asks the policy
// a stranger gets the same 404 as an id that does not exist (see itemPolicy.ts)
// shared by the item service and the item image service
export async function loadAllowedItem(actor: Actor, id: string, allowed: typeof canViewItem) {
  const { validId, item } = await lookupItemFor(actor, id);
  if (!validId) {
    throw new AppError(400, "invalid id");
  }

  if (!item || !allowed(actor, item)) {
    throw new AppError(404, "item not found");
  }

  return item;
}

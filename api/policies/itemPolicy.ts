import { itemRepository } from "../repositories/itemRepository";
import { isValidId } from "../utils/ids";

// This file answers ONE question: "may this person do this to this item?"
// Every wardrobe route asks here, so the rules live in one place.
//
// Why a stranger gets 404 "item not found" and never 403:
// a 403 would say "this item exists, but it is not yours".
// That leaks information: anyone could test ids and learn which items exist.
// With 404, a stranger cannot tell "not yours" from "does not exist".
//
// Where a future rule would go (do NOT add it yet):
// for example "a moderator may remove an item", you would
// 1. add a canRemoveItem function below that also checks actor.role,
// 2. change findItemFor so it finds by id only, then lets the can... function decide,
//    because today the lookup itself keeps only the caller's own items.

// the logged-in person, as requireAuth puts it in res.locals.user
export type Actor = { id: string; role: string };

// any item that has an owner (a full document or a plain object)
type OwnedItem = { ownerId: unknown };

function isOwner(actor: Actor, item: OwnedItem) {
  return String(item.ownerId) === actor.id;
}

// for now every action is "the owner only"
export function canViewItem(actor: Actor, item: OwnedItem) {
  return isOwner(actor, item);
}

export function canEditItem(actor: Actor, item: OwnedItem) {
  return isOwner(actor, item);
}

export function canArchiveItem(actor: Actor, item: OwnedItem) {
  return isOwner(actor, item);
}

export function canRestoreItem(actor: Actor, item: OwnedItem) {
  return isOwner(actor, item);
}

export function canDeleteItem(actor: Actor, item: OwnedItem) {
  return isOwner(actor, item);
}

export function canWearItem(actor: Actor, item: OwnedItem) {
  return isOwner(actor, item);
}

// add, list, edit or delete the photos of an item
export function canManageItemImages(actor: Actor, item: OwnedItem) {
  return isOwner(actor, item);
}

// look up one item for this person: the id AND the owner must match, and it is not deleted
// (a soft deleted item is "gone": every route answers 404 for it)
// the id is checked here, and only here: validId tells the caller if it was valid,
// item is null when there is no such item or when it is someone else's
export async function lookupItemFor(actor: Actor, id: string) {
  if (!isValidId(id)) {
    return { validId: false, item: null } as const;
  }
  // the query itself keeps only the caller's own items (see repositories/itemRepository.ts)
  const item = await itemRepository.findOwned(actor.id, id);
  return { validId: true, item } as const;
}

// find one item for this person
// gives null when there is no such item, when it is someone else's, or when the id is not valid
export async function findItemFor(actor: Actor, id: string) {
  const { item } = await lookupItemFor(actor, id);
  return item;
}

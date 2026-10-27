import { Request, Response } from "express";
import { itemImageService, itemService } from "../container";
import { createItemSchema, editItemSchema, listItemsQuerySchema, toItemDto } from "../dtos/itemDto";
import type { Actor } from "../policies/itemPolicy";
import type { ItemDocument } from "../repositories/itemRepository";

// the answer for one item or a page of items, each with its coverUrl
// ONE query and ONE signing call for the whole page, never one per item
async function toItemAnswers(items: ItemDocument[]) {
  const covers = await itemImageService.coverUrls(items);
  return items.map((item) => toItemDto(item, covers.get(String(item._id))));
}

async function toItemAnswer(item: ItemDocument) {
  const [answer] = await toItemAnswers([item]);
  return answer;
}

export async function createItem(req: Request, res: Response) {
  const result = createItemSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  const actor: Actor = res.locals.user;
  const item = await itemService.create(actor, result.data);
  res.status(201).json(await toItemAnswer(item));
}

export async function listItems(req: Request, res: Response) {
  const result = listItemsQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ message: "invalid query" });
    return;
  }

  const actor: Actor = res.locals.user;
  const { page, limit, total, items } = await itemService.list(actor, result.data);
  res.json({ page, limit, total, items: await toItemAnswers(items) });
}

export async function getItem(req: Request, res: Response) {
  const actor: Actor = res.locals.user;
  const item = await itemService.get(actor, req.params.id as string);
  res.json(await toItemAnswer(item));
}

export async function archiveItem(req: Request, res: Response) {
  const actor: Actor = res.locals.user;
  const item = await itemService.archive(actor, req.params.id as string);
  res.json(await toItemAnswer(item));
}

export async function restoreItem(req: Request, res: Response) {
  const actor: Actor = res.locals.user;
  const item = await itemService.restore(actor, req.params.id as string);
  res.json(await toItemAnswer(item));
}

export async function deleteItem(req: Request, res: Response) {
  const actor: Actor = res.locals.user;
  await itemService.remove(actor, req.params.id as string);
  res.json({ message: "item deleted" });
}

export async function wearItem(req: Request, res: Response) {
  const actor: Actor = res.locals.user;
  const item = await itemService.wear(actor, req.params.id as string);
  res.json(await toItemAnswer(item));
}

export async function editItem(req: Request, res: Response) {
  // with no body at all, Express 5 leaves req.body undefined:
  // treat it like {} so the answer is "nothing to change", not "invalid input"
  const result = editItemSchema.safeParse(req.body ?? {});
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  const actor: Actor = res.locals.user;
  const item = await itemService.edit(actor, req.params.id as string, result.data);
  res.json(await toItemAnswer(item));
}

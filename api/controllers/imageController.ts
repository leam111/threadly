import { Request, Response } from "express";
import { itemImageService } from "../container";
import { editImageSchema, toImageDto, uploadImageSchema } from "../dtos/imageDto";
import type { Actor } from "../policies/itemPolicy";

export async function uploadItemImage(req: Request, res: Response) {
  // the text fields of the form (only alt); the file itself is on req.file (see receiveImage.ts)
  const result = uploadImageSchema.safeParse(req.body ?? {});
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  const actor: Actor = res.locals.user;
  const { image, url } = await itemImageService.upload(
    actor,
    req.params.id as string,
    req.file,
    result.data,
  );
  res.status(201).json(toImageDto(image, url));
}

export async function listItemImages(req: Request, res: Response) {
  const actor: Actor = res.locals.user;
  const list = await itemImageService.list(actor, req.params.id as string);
  res.json({ items: list.map(({ image, url }) => toImageDto(image, url)) });
}

export async function editItemImage(req: Request, res: Response) {
  // no body at all counts as {}: the answer is "nothing to change"
  const result = editImageSchema.safeParse(req.body ?? {});
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  const actor: Actor = res.locals.user;
  const { image, url } = await itemImageService.edit(
    actor,
    req.params.id as string,
    req.params.imageId as string,
    result.data,
  );
  res.json(toImageDto(image, url));
}

export async function deleteItemImage(req: Request, res: Response) {
  const actor: Actor = res.locals.user;
  await itemImageService.remove(actor, req.params.id as string, req.params.imageId as string);
  res.json({ message: "image deleted" });
}

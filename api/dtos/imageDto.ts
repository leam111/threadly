import { z } from "zod";
import { IMAGE_ALT_MAX } from "../utils/imageOptions";
import type { ImageDocument } from "../repositories/imageRepository";

// ---- what comes in ----

// alt: a short text that describes the photo. "" is allowed, it means "no alt" (or "clear it")
// Zod drops every other key (like kind, ownerId or storagePath), so a member can only make an
// "original" image, and never chooses the owner or the path
export const uploadImageSchema = z.object({
  alt: z.string().trim().max(IMAGE_ALT_MAX).optional(),
});

// an edit can only change alt
export const editImageSchema = uploadImageSchema;

export type UploadImageInput = z.infer<typeof uploadImageSchema>;
export type EditImageInput = z.infer<typeof editImageSchema>;

// ---- what goes out ----

// the image as JSON: the fields are picked one by one, so storagePath and __v are NEVER sent
// url is a fresh signed link (valid 1 hour); it is left out when signing failed
export function toImageDto(image: ImageDocument, url?: string) {
  const view: Record<string, unknown> = {
    _id: image._id,
    itemId: image.itemId,
    ownerId: image.ownerId,
    kind: image.kind,
  };
  if (image.alt) {
    view.alt = image.alt;
  }
  if (image.width && image.height) {
    view.width = image.width;
    view.height = image.height;
  }
  view.bytes = image.bytes;
  view.mimeType = image.mimeType;
  view.createdAt = image.createdAt;
  view.updatedAt = image.updatedAt;
  if (url) {
    view.url = url;
  }
  return view;
}

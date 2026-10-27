import type { Types } from "mongoose";
import { AppError } from "../utils/appError";
import { isValidId } from "../utils/ids";
import { IMAGES_PER_ITEM_MAX, SIGNED_URL_SECONDS } from "../utils/imageOptions";
import { Actor, canManageItemImages } from "../policies/itemPolicy";
import { loadAllowedItem } from "./allowedItem";
import { UploadedFile, callStorage, checkImageFile, newStoragePath } from "./imageFiles";
import type { EditImageInput, UploadImageInput } from "../dtos/imageDto";
import type { ImageDocument, ImageRepository } from "../repositories/imageRepository";
import type { ImageStorage } from "../storage/imageStorage";

// The photos of a wardrobe item. The files live in the image storage (private),
// the facts about them in the database. Every answer gets fresh signed links.
export function makeItemImageService({
  images,
  storage,
}: {
  images: ImageRepository;
  storage: ImageStorage;
}) {
  // ONE signing call for the whole list; an image whose link could not be made has no url
  async function withUrls(list: ImageDocument[]) {
    const links = await storage.signedUrls(
      list.map((image) => image.storagePath),
      SIGNED_URL_SECONDS,
    );
    return list.map((image) => ({ image, url: links.get(image.storagePath) }));
  }

  // both ids are checked first (400), then my item (404 "item not found"),
  // then the image on that item (404 "image not found")
  async function loadImage(actor: Actor, itemId: string, imageId: string) {
    if (!isValidId(itemId) || !isValidId(imageId)) {
      throw new AppError(400, "invalid id");
    }
    const item = await loadAllowedItem(actor, itemId, canManageItemImages);
    const image = await images.findOnItem(actor.id, item._id, imageId);
    if (!image) {
      throw new AppError(404, "image not found");
    }
    return image;
  }

  return {
    async upload(
      actor: Actor,
      itemId: string,
      file: UploadedFile | undefined,
      input: UploadImageInput,
    ) {
      const item = await loadAllowedItem(actor, itemId, canManageItemImages);
      const checked = checkImageFile(file);

      // counted first, then saved: two uploads at the very same moment could both pass
      if ((await images.countForItem(item._id)) >= IMAGES_PER_ITEM_MAX) {
        throw new AppError(409, "this item already has 5 images");
      }

      // the file goes to the storage FIRST: if that fails, nothing is saved in the database
      const storagePath = newStoragePath(`items/${actor.id}/${item._id}`, checked.ext);
      await callStorage(() => storage.upload(storagePath, checked.buffer, checked.mimeType));

      let image: ImageDocument;
      try {
        image = await images.create({
          itemId: item._id,
          ownerId: actor.id,
          storagePath,
          // "" means "no alt": it is not saved
          alt: input.alt || undefined,
          width: checked.width,
          height: checked.height,
          bytes: checked.bytes,
          mimeType: checked.mimeType,
        });
      } catch (error) {
        // the database said no: take the file away again, so no file is left without its row
        await storage.remove([storagePath]).catch(() => undefined);
        throw error;
      }

      const [answer] = await withUrls([image]);
      return answer;
    },

    // newest first
    async list(actor: Actor, itemId: string) {
      const item = await loadAllowedItem(actor, itemId, canManageItemImages);
      return withUrls(await images.listForItem(item._id));
    },

    async edit(actor: Actor, itemId: string, imageId: string, input: EditImageInput) {
      // checked before the ids, like an item edit: {} answers "nothing to change"
      if (Object.keys(input).length === 0) {
        throw new AppError(400, "nothing to change");
      }
      const image = await loadImage(actor, itemId, imageId);
      // "" clears alt: undefined removes the field when the image is saved
      const updated = await images.setAlt(image, input.alt || undefined);
      const [answer] = await withUrls([updated]);
      return answer;
    },

    // the file is deleted from the storage FIRST, then the row.
    // If the storage fails, the row stays (502), so the owner can simply try again
    async remove(actor: Actor, itemId: string, imageId: string) {
      const image = await loadImage(actor, itemId, imageId);
      await callStorage(() => storage.remove([image.storagePath]));
      await images.deleteOne(image);
    },

    // the cover of each item on a page: a signed link to its oldest original image
    // ONE query and ONE signing call for the whole page. Gives a map: item id -> link
    async coverUrls(items: { _id: Types.ObjectId }[]) {
      const paths = await images.coverPaths(items.map((item) => item._id));
      const links = await storage.signedUrls([...paths.values()], SIGNED_URL_SECONDS);

      const covers = new Map<string, string>();
      for (const [itemId, path] of paths) {
        const link = links.get(path);
        if (link) {
          covers.set(itemId, link);
        }
      }
      return covers;
    },
  };
}

export type ItemImageService = ReturnType<typeof makeItemImageService>;

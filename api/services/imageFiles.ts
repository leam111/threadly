import { randomUUID } from "node:crypto";
import { AppError } from "../utils/appError";
import { detectImage } from "../utils/imageType";
import { ImageStorageFailed, ImageStorageNotSetUp } from "../storage/imageStorage";

// Small helpers shared by the item photos and the avatar.

// the file as the controller gives it (no Express here: only the bytes and the size)
export type UploadedFile = { buffer: Buffer; size: number };

// there must be a file, and its CONTENT must be a JPEG, PNG or WebP
// (the size limit of 5 MB was already checked while receiving it, see middleware/receiveImage.ts)
export function checkImageFile(file: UploadedFile | undefined) {
  if (!file) {
    throw new AppError(400, "image is required");
  }
  const type = detectImage(file.buffer);
  if (!type) {
    throw new AppError(415, "only jpeg, png or webp images");
  }
  return { buffer: file.buffer, bytes: file.size, ...type };
}

// a new path in the bucket, like items/<ownerId>/<itemId>/<uuid>.jpg
// a random name: two uploads never meet, and the client's file name is never used
export function newStoragePath(folder: string, ext: string) {
  return `${folder}/${randomUUID()}.${ext}`;
}

// run one action of the image storage, and turn its errors into answers:
// not set up -> 503, failed -> 502. Any other error goes on as it is (500)
export async function callStorage<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ImageStorageNotSetUp) {
      throw new AppError(503, "image storage is not set up");
    }
    if (error instanceof ImageStorageFailed) {
      throw new AppError(502, "image storage failed");
    }
    throw error;
  }
}

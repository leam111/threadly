import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { IMAGE_MAX_BYTES } from "../utils/imageOptions";

// Receives ONE uploaded file in the form field "image" (Body form-data in Postman).
// It runs AFTER requireAuth and the permission, so an anonymous person cannot send a big file.
// The file stays in memory (nothing is written to disk) and is put on req.file.
// The real type of the file is checked later, from its content (see utils/imageType.ts).
const upload = multer({
  storage: multer.memoryStorage(),
  // fields and fieldSize: a few short text fields only (like alt), never a big text
  limits: { fileSize: IMAGE_MAX_BYTES, files: 1, fields: 5, fieldSize: 1024 },
}).single("image");

export function receiveImage(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (err?: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ message: "image too large (max 5 MB)" });
        return;
      }
      // a second file, in "image" or in another field
      if (
        err.code === "LIMIT_FILE_COUNT" ||
        (err.code === "LIMIT_UNEXPECTED_FILE" && err.field === "image")
      ) {
        res.status(400).json({ message: "only one image at a time" });
        return;
      }
      // one file, but not in the field "image"
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        res.status(400).json({ message: "image is required" });
        return;
      }
      // too many text fields, or a text field that is too long
      res.status(400).json({ message: "invalid input" });
      return;
    }

    // a broken form (for example cut in the middle): a client mistake, like broken JSON
    res.status(400).json({ message: "bad request" });
  });
}

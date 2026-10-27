import type multer from "multer";

// multer puts the received file on req.file: tell TypeScript it can be there
declare global {
  namespace Express {
    interface Request {
      file?: multer.File;
    }
  }
}

export {};

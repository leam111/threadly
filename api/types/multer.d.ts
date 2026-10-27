// multer has no TypeScript types of its own. This small file describes ONLY the parts we use
// (see middleware/receiveImage.ts), so TypeScript can check our code.
declare module "multer" {
  import type { RequestHandler } from "express";

  namespace multer {
    // one file kept in memory (memoryStorage): nothing is written to disk
    interface File {
      fieldname: string;
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }

    interface Limits {
      fileSize?: number;
      files?: number;
      fields?: number;
      fieldSize?: number;
      parts?: number;
    }

    interface StorageEngine {
      _handleFile: unknown;
    }

    interface Options {
      storage?: StorageEngine;
      limits?: Limits;
    }

    interface Multer {
      single(fieldName: string): RequestHandler;
    }

    function memoryStorage(): StorageEngine;

    class MulterError extends Error {
      code: string;
      field?: string;
    }
  }

  function multer(options?: multer.Options): multer.Multer;

  export = multer;
}

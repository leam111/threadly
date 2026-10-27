import { createClient } from "@supabase/supabase-js";

// The ONE file that talks to the image storage (today: Supabase Storage).
// Everything else uses only the three functions below, so the provider can change later
// without touching the services.
//
// The bucket is PRIVATE: nobody can open a file without a signed link, and a signed link
// stops working after some seconds. We never store a link, only the path of the file.
//
// Safety: the service key gives full access to the storage. It stays on the server.
// Never log, print or write the key or a signed link.

// image storage is not set up (a setting is missing): the routes answer 503
export class ImageStorageNotSetUp extends Error {
  constructor() {
    super("image storage is not set up");
    this.name = "ImageStorageNotSetUp";
  }
}

// the storage said no, or could not be reached (for example a paused project): the routes answer 502
export class ImageStorageFailed extends Error {
  constructor(action: string) {
    super(`image storage failed to ${action}`);
    this.name = "ImageStorageFailed";
  }
}

const SETTING_NAMES = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_BUCKET"] as const;

// a short reason for the server log: the kind of error and its status, never a link or a key
function describe(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return "unknown error";
  }
  const { name, status, statusCode } = error as Record<string, unknown>;
  return [name, status ?? statusCode].filter((part) => part !== undefined).join(" ");
}

// read the settings once, when the server starts
// a missing setting does not stop the server: one line with the missing NAMES, then 503 on uploads
function connect() {
  const missing = SETTING_NAMES.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.warn(`image storage is not set up, missing: ${missing.join(", ")}`);
    return null;
  }

  try {
    const client = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      // a server has no user session to keep or refresh
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    return client.storage.from(process.env.SUPABASE_BUCKET as string);
  } catch {
    // for example SUPABASE_URL is not a web address (the value itself is never printed)
    console.warn("image storage is not set up: SUPABASE_URL is not a valid address");
    return null;
  }
}

const bucket = connect();

function needBucket() {
  if (!bucket) {
    throw new ImageStorageNotSetUp();
  }
  return bucket;
}

export const imageStorage = {
  // save one file at this path; a file already there is never replaced
  async upload(path: string, buffer: Buffer, contentType: string) {
    const files = needBucket();
    let error: unknown;
    try {
      ({ error } = await files.upload(path, buffer, { contentType, upsert: false }));
    } catch (thrown) {
      error = thrown;
    }
    if (error) {
      console.error(`image storage: upload failed (${describe(error)})`);
      throw new ImageStorageFailed("upload");
    }
  },

  // delete these files; a path that is already gone is not an error, so a retry is safe
  async remove(paths: string[]) {
    const files = needBucket();
    if (paths.length === 0) {
      return;
    }
    let error: unknown;
    try {
      ({ error } = await files.remove(paths));
    } catch (thrown) {
      error = thrown;
    }
    if (error) {
      console.error(`image storage: remove failed (${describe(error)})`);
      throw new ImageStorageFailed("remove");
    }
  },

  // fresh signed links for many paths, in ONE call. Gives a map: path -> link
  // never throws: when signing fails (or storage is not set up) a path simply has no link,
  // and the answer leaves the url out
  async signedUrls(paths: string[], seconds: number) {
    const links = new Map<string, string>();
    const unique = [...new Set(paths)];
    if (!bucket || unique.length === 0) {
      return links;
    }

    try {
      const { data, error } = await bucket.createSignedUrls(unique, seconds);
      if (error) {
        console.error(`image storage: signing failed (${describe(error)})`);
        return links;
      }
      for (const entry of data) {
        if (entry.path && entry.signedUrl && !entry.error) {
          links.set(entry.path, entry.signedUrl);
        }
      }
    } catch (thrown) {
      console.error(`image storage: signing failed (${describe(thrown)})`);
    }
    return links;
  },
};

export type ImageStorage = typeof imageStorage;

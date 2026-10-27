import { AppError } from "../utils/appError";
import { PROFILE_SIZE_KEYS } from "../utils/profileOptions";
import type { EditProfileInput } from "../dtos/profileDto";
import type { ProfileRepository } from "../repositories/profileRepository";
import type { ImageStorage } from "../storage/imageStorage";
import { SIGNED_URL_SECONDS } from "../utils/imageOptions";
import { UploadedFile, callStorage, checkImageFile, newStoragePath } from "./imageFiles";

// There is no id from the address here: the profile is ALWAYS the caller's,
// found with the user id from the token. So nobody can read or change someone else's.
export function makeProfileService({
  profiles,
  storage,
}: {
  profiles: ProfileRepository;
  storage: ImageStorage;
}) {
  type StoredProfile = Awaited<ReturnType<ProfileRepository["findByUser"]>>;

  // the profile with a fresh signed link to the avatar (no link when there is no avatar,
  // or when signing failed: the answer then simply has no avatarUrl)
  async function withAvatarUrl(profile: StoredProfile) {
    const path = profile?.avatarStoragePath;
    if (!path) {
      return { profile, avatarUrl: undefined };
    }
    const links = await storage.signedUrls([path], SIGNED_URL_SECONDS);
    return { profile, avatarUrl: links.get(path) };
  }

  return {
    // only read: if there is no profile yet the answer is the empty default and nothing is written
    async getMine(userId: string) {
      return withAvatarUrl(await profiles.findByUser(userId));
    },

    async updateMine(userId: string, input: EditProfileInput) {
      // build two lists: fields to save (set) and fields to remove (unset)
      // an empty text "" goes to the remove list, so we never save an empty text
      // favoriteColors: [] also goes to the remove list (styles: [] is saved as an empty list, as before)
      // sizes are handled one by one ("sizes.top"), so changing one size keeps the others
      const set: Record<string, unknown> = {};
      const unset: string[] = [];
      function addChange(path: string, value: unknown) {
        const emptyColors = path === "favoriteColors" && Array.isArray(value) && value.length === 0;
        if (value === "" || emptyColors) {
          unset.push(path);
        } else {
          set[path] = value;
        }
      }

      const { sizes, ...fields } = input;
      for (const [key, value] of Object.entries(fields)) {
        addChange(key, value);
      }
      for (const key of PROFILE_SIZE_KEYS) {
        if (sizes?.[key] !== undefined) {
          addChange(`sizes.${key}`, sizes[key]);
        }
      }

      if (Object.keys(set).length === 0 && unset.length === 0) {
        throw new AppError(400, "nothing to change");
      }

      return withAvatarUrl(await profiles.upsertForUser(userId, { set, unset }));
    },

    // a new avatar replaces the old one
    // order: the new file is stored, then saved in the profile, and only THEN the old file is
    // removed. So if anything fails on the way, the profile still points to a file that exists
    async setAvatar(userId: string, file: UploadedFile | undefined) {
      const checked = checkImageFile(file);
      const storagePath = newStoragePath(`avatars/${userId}`, checked.ext);
      await callStorage(() => storage.upload(storagePath, checked.buffer, checked.mimeType));

      let before: StoredProfile;
      try {
        before = await profiles.setAvatar(userId, storagePath);
      } catch (error) {
        // the database said no: take the new file away again
        await storage.remove([storagePath]).catch(() => undefined);
        throw error;
      }

      const oldPath = before?.avatarStoragePath;
      if (oldPath && oldPath !== storagePath) {
        // the new avatar is saved already: if removing the old file fails, the answer is still a
        // success, and the old file simply stays in the bucket (the error is in the server log)
        await storage.remove([oldPath]).catch(() => undefined);
      }

      return withAvatarUrl(await profiles.findByUser(userId));
    },

    // the file is removed from the storage FIRST, then from the profile.
    // If the storage fails (502), the profile keeps its avatar, so the user can try again
    async removeAvatar(userId: string) {
      const profile = await profiles.findByUser(userId);
      const path = profile?.avatarStoragePath;
      if (!path) {
        throw new AppError(404, "avatar not found");
      }
      await callStorage(() => storage.remove([path]));
      await profiles.clearAvatar(userId, path);
    },
  };
}

export type ProfileService = ReturnType<typeof makeProfileService>;

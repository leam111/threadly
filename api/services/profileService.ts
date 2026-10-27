import { AppError } from "../utils/appError";
import { PROFILE_SIZE_KEYS } from "../utils/profileOptions";
import type { EditProfileInput } from "../dtos/profileDto";
import type { ProfileRepository } from "../repositories/profileRepository";

// There is no id from the address here: the profile is ALWAYS the caller's,
// found with the user id from the token. So nobody can read or change someone else's.
export function makeProfileService({ profiles }: { profiles: ProfileRepository }) {
  return {
    // only read: if there is no profile yet the answer is the empty default and nothing is written
    getMine(userId: string) {
      return profiles.findByUser(userId);
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

      return profiles.upsertForUser(userId, { set, unset });
    },
  };
}

export type ProfileService = ReturnType<typeof makeProfileService>;

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { Profile } from "../models/Profile";
import {
  PROFILE_STYLES,
  PROFILE_SIZE_KEYS,
  DISPLAY_NAME_MAX,
  BIO_MAX,
  CITY_MAX,
  SIZE_MAX,
  STYLES_MAX,
} from "../utils/profileOptions";

const router = Router();

// There is no id in any address here: the profile is ALWAYS the caller's,
// found with the user id from the token. So nobody can read or change someone else's.

type StoredProfile = {
  displayName?: string | null;
  bio?: string | null;
  city?: string | null;
  sizes?: { top?: string | null; bottom?: string | null; dress?: string | null; shoes?: string | null } | null;
  styles?: string[] | null;
};

// the answer always has the same keys, with "" or [] when a field is empty
function toProfileView(userId: string, profile: StoredProfile | null) {
  return {
    userId,
    displayName: profile?.displayName ?? "",
    bio: profile?.bio ?? "",
    city: profile?.city ?? "",
    sizes: {
      top: profile?.sizes?.top ?? "",
      bottom: profile?.sizes?.bottom ?? "",
      dress: profile?.sizes?.dress ?? "",
      shoes: profile?.sizes?.shoes ?? "",
    },
    styles: profile?.styles ?? [],
  };
}

router.get("/me", requireAuth, async (req, res) => {
  const userId = res.locals.user.id;
  // only read: if there is no profile yet we answer the empty default and write nothing
  const profile = await Profile.findOne({ userId }).lean();
  res.json(toProfileView(userId, profile));
});

const sizeText = z.string().trim().max(SIZE_MAX).optional();

// every field is optional; Zod drops keys it does not know (like userId)
const editProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX).optional(),
  bio: z.string().trim().max(BIO_MAX).optional(),
  city: z.string().trim().max(CITY_MAX).optional(),
  sizes: z
    .object({ top: sizeText, bottom: sizeText, dress: sizeText, shoes: sizeText })
    .optional(),
  styles: z
    .array(z.enum(PROFILE_STYLES))
    .max(STYLES_MAX)
    .refine((list) => new Set(list).size === list.length)
    .optional(),
});

router.patch("/me", requireAuth, async (req, res) => {
  const result = editProfileSchema.safeParse(req.body ?? {});
  if (!result.success) {
    res.status(400).json({ message: "invalid input" });
    return;
  }

  // build the list of changes
  // sizes are set one by one ("sizes.top"), so changing one size keeps the others
  const { sizes, ...fields } = result.data;
  const changes: Record<string, unknown> = { ...fields };
  for (const key of PROFILE_SIZE_KEYS) {
    if (sizes?.[key] !== undefined) {
      changes[`sizes.${key}`] = sizes[key];
    }
  }

  if (Object.keys(changes).length === 0) {
    res.status(400).json({ message: "nothing to change" });
    return;
  }

  const userId = res.locals.user.id;
  // upsert: update my profile, or create it if it does not exist yet
  const profile = await Profile.findOneAndUpdate(
    { userId },
    { $set: changes },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
  ).lean();

  res.json(toProfileView(userId, profile));
});

export default router;

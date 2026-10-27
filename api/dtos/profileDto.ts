import { z } from "zod";
import {
  PROFILE_STYLES,
  PROFILE_SIZE_KEYS,
  DISPLAY_NAME_MAX,
  BIO_MAX,
  CITY_MAX,
  COUNTRY_MAX,
  SIZE_MAX,
  STYLES_MAX,
  FAVORITE_COLORS_MAX,
  COLOR_WORD_MAX,
} from "../utils/profileOptions";

// ---- what comes in ----

const sizeText = z.string().trim().max(SIZE_MAX).optional();

// every field is optional; Zod drops keys it does not know (like userId)
export const editProfileSchema = z.object({
  // "" is allowed in every text field: it means "clear this field"
  displayName: z.string().trim().max(DISPLAY_NAME_MAX).optional(),
  bio: z.string().trim().max(BIO_MAX).optional(),
  city: z.string().trim().max(CITY_MAX).optional(),
  country: z.string().trim().max(COUNTRY_MAX).optional(),
  sizes: z.object({ top: sizeText, bottom: sizeText, dress: sizeText, shoes: sizeText }).optional(),
  styles: z
    .array(z.enum(PROFILE_STYLES))
    .max(STYLES_MAX)
    .refine((list) => new Set(list).size === list.length)
    .optional(),
  // each color trimmed and in lowercase, no color twice (checked after the lowercase step)
  // [] is allowed: it means "clear the list"
  favoriteColors: z
    .array(z.string().trim().toLowerCase().min(1).max(COLOR_WORD_MAX))
    .max(FAVORITE_COLORS_MAX)
    .refine((list) => new Set(list).size === list.length)
    .optional(),
});

export type EditProfileInput = z.infer<typeof editProfileSchema>;

// ---- what goes out ----

type StoredProfile = {
  displayName?: string | null;
  bio?: string | null;
  city?: string | null;
  country?: string | null;
  sizes?: {
    top?: string | null;
    bottom?: string | null;
    dress?: string | null;
    shoes?: string | null;
  } | null;
  styles?: string[] | null;
  favoriteColors?: string[] | null;
  updatedAt?: Date | null;
};

// the answer:
// - text fields (displayName, bio, city, country, each size) only when they have a value
// - sizes is always an object, styles and favoriteColors always lists, even when empty
// - updatedAt when the profile exists in the database; never _id or __v
// - avatarUrl (a fresh signed link) when there is an avatar; never avatarStoragePath
export function toProfileDto(userId: string, profile: StoredProfile | null, avatarUrl?: string) {
  const view: Record<string, unknown> = { userId };

  for (const key of ["displayName", "bio", "city", "country"] as const) {
    const value = profile?.[key];
    if (value) {
      view[key] = value;
    }
  }

  const sizes: Record<string, string> = {};
  for (const key of PROFILE_SIZE_KEYS) {
    const value = profile?.sizes?.[key];
    if (value) {
      sizes[key] = value;
    }
  }
  view.sizes = sizes;
  view.styles = profile?.styles ?? [];
  view.favoriteColors = profile?.favoriteColors ?? [];

  if (avatarUrl) {
    view.avatarUrl = avatarUrl;
  }

  if (profile?.updatedAt) {
    view.updatedAt = profile.updatedAt;
  }

  return view;
}

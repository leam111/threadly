// the allowed values for a member profile, kept in ONE place
// the model and the Zod schema both read these, so they can never drift apart
export const PROFILE_STYLES = [
  "classic",
  "streetwear",
  "y2k",
  "preppy",
  "boho",
  "minimal",
  "vintage",
  "sporty",
  "glam",
] as const;
export const PROFILE_SIZE_KEYS = ["top", "bottom", "dress", "shoes"] as const;

export const DISPLAY_NAME_MAX = 40;
export const BIO_MAX = 200;
export const CITY_MAX = 60;
export const SIZE_MAX = 10;
export const STYLES_MAX = 5;

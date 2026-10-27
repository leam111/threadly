// The allowed values and limits for images (item photos and the avatar), in one place.

// "original" is the photo the member sends; "cutout" is for the AI service later
// (members can only create originals)
export const IMAGE_KINDS = ["original", "cutout"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const IMAGES_PER_ITEM_MAX = 5;
export const IMAGE_ALT_MAX = 150;

// how long a signed link to a private image works, in seconds (1 hour)
export const SIGNED_URL_SECONDS = 3600;

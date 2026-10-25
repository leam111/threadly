// every permission name the code may ask for
// the database (migration 003) decides which role has which one
export const PERMISSION_NAMES = [
  "listing:read",
  "wardrobe:manage_own",
  "listing:create",
  "listing:update_own",
  "order:create",
  "review:create",
  "report:create",
  "listing:hide",
  "listing:remove",
  "report:resolve",
  "user:view",
  "user:ban",
  "order:refund",
  "audit:view",
  "role:assign",
  "permission:edit",
] as const;

export type PermissionName = (typeof PERMISSION_NAMES)[number];

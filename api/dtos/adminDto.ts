import { z } from "zod";

// ---- what comes in ----

export const activeSchema = z.object({
  isActive: z.boolean(),
});

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20),
  action: z.string().optional(),
});

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20),
  email: z.string().trim().min(1).max(100).optional(),
  role: z.enum(["member", "moderator", "admin", "superadmin"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const rolePermissionsSchema = z.object({
  permissions: z.array(z.string().trim().min(1).max(50)).max(100),
});

export const userRoleSchema = z.object({
  role: z.string().trim().min(1).max(50),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;

// ---- what goes out ----

type StoredRole = { name: string; description: string; isSystem?: boolean | null };
type StoredRow = { role: string; permission: string };

// each role with the names of its permissions
export function toRoleListDto(roles: StoredRole[], rows: StoredRow[]) {
  return roles.map((role) => ({
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: rows.filter((row) => row.role === role.name).map((row) => row.permission),
  }));
}

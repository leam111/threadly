import { Role } from "../models/Role";
import { RolePermission } from "../models/RolePermission";

// every database query for roles, and for "this role has this permission", lives here
export const roleRepository = {
  // is there a role with this name? (gives a small object, or null)
  exists(name: string) {
    return Role.exists({ name });
  },

  findByName(name: string) {
    return Role.findOne({ name });
  },

  // does this role have this permission? (gives a small object, or null)
  hasPermission(role: string, permission: string) {
    return RolePermission.exists({ role, permission });
  },

  listAll() {
    return Role.find().select("name description isSystem -_id").sort({ name: 1 });
  },

  // every "role has permission" row, sorted by permission name
  listAllRows() {
    return RolePermission.find().sort({ permission: 1 });
  },

  async permissionsOf(role: string) {
    const rows = await RolePermission.find({ role });
    return rows.map((row) => row.permission);
  },

  addPermissions(role: string, permissions: string[]) {
    return RolePermission.insertMany(permissions.map((permission) => ({ role, permission })));
  },

  removePermissions(role: string, permissions: string[]) {
    return RolePermission.deleteMany({ role, permission: { $in: permissions } });
  },
};

export type RoleRepository = typeof roleRepository;

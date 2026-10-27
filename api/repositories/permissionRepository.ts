import { Permission } from "../models/Permission";

// every database query for permissions lives here
export const permissionRepository = {
  listAll() {
    return Permission.find().select("name description -_id").sort({ name: 1 });
  },

  // how many of these names are real permissions
  countKnown(names: string[]) {
    return Permission.countDocuments({ name: { $in: names } });
  },
};

export type PermissionRepository = typeof permissionRepository;

import { Schema, model } from "mongoose";

// a role is a name for a bundle of permissions (see RolePermission)
// isSystem: true for the 4 roles made by migration 003
const RoleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Role = model("Role", RoleSchema);

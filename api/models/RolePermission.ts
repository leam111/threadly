import { Schema, model } from "mongoose";

// one row = "this role has this permission"
// both are names (like "admin" and "user:ban"), the same names as in Role and Permission
const RolePermissionSchema = new Schema(
  {
    role: { type: String, required: true },
    permission: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// the same pair can never be stored twice
// this index also answers "which permissions does this role have?"
RolePermissionSchema.index({ role: 1, permission: 1 }, { unique: true });

export const RolePermission = model("RolePermission", RolePermissionSchema);

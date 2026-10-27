import { Schema, model } from "mongoose";

// one thing a user may do, like "user:ban" (filled by migration 003)
const PermissionSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
  },
  { timestamps: true },
);

export const Permission = model("Permission", PermissionSchema);

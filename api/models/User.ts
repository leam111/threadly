import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["member", "moderator", "admin", "superadmin"], default: "member" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const User = model("User", userSchema);

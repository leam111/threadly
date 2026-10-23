import { Schema, model } from "mongoose";

const RefreshTokenSchema = new Schema(
  {
    userId: { index: true, type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

export const RefreshToken = model("RefreshToken", RefreshTokenSchema);

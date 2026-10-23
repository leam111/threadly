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

// TTL index: MongoDB deletes a token by itself once expiresAt has passed
// (the same index as migration 002; declared only here, not also on the field)
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model("RefreshToken", RefreshTokenSchema);

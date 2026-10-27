import { Types } from "mongoose";
import { RefreshToken } from "../models/RefreshTokens";

export type UserId = Types.ObjectId | string;

function findByHash(tokenHash: string) {
  return RefreshToken.findOne({ tokenHash });
}

// a refresh token as the database gives it (a Mongoose document)
export type RefreshTokenDocument = NonNullable<Awaited<ReturnType<typeof findByHash>>>;

// every database query for refresh tokens lives here
// (only the hash of a token is stored, never the token itself)
export const refreshTokenRepository = {
  findByHash,

  create(entry: { userId: UserId; tokenHash: string; familyId: string; expiresAt: Date }) {
    return RefreshToken.create(entry);
  },

  async markUsed(token: RefreshTokenDocument) {
    token.usedAt = new Date();
    await token.save();
  },

  async revoke(token: RefreshTokenDocument) {
    token.revokedAt = new Date();
    await token.save();
  },

  // cancel every refresh token of this user that is not cancelled yet
  revokeAllForUser(userId: UserId) {
    return RefreshToken.updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  },

  // cancel a whole login family (used when a used token is shown again)
  revokeFamily(familyId: string) {
    return RefreshToken.updateMany(
      { familyId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  },

  // cancel every family of this user except this one ("log out everywhere else")
  revokeOtherFamilies(userId: UserId, familyId: string) {
    return RefreshToken.updateMany(
      {
        userId,
        familyId: { $ne: familyId },
        revokedAt: { $exists: false },
      },
      { $set: { revokedAt: new Date() } },
    );
  },
};

export type RefreshTokenRepository = typeof refreshTokenRepository;

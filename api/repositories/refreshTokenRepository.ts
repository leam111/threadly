import { Types } from "mongoose";
import { RefreshToken } from "../models/RefreshTokens";

type UserId = Types.ObjectId | string;

// every database query for refresh tokens lives here
export const refreshTokenRepository = {
  // cancel every refresh token of this user that is not cancelled yet
  revokeAllForUser(userId: UserId) {
    return RefreshToken.updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  },
};

export type RefreshTokenRepository = typeof refreshTokenRepository;

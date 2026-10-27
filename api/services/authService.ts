import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/appError";
import { logAudit } from "../utils/audit";
import { REFRESH_MS, generateRefreshToken, hashToken } from "../utils/tokens";
import type { Actor } from "../policies/itemPolicy";
import type { UserRepository } from "../repositories/userRepository";
import type { RefreshTokenRepository, UserId } from "../repositories/refreshTokenRepository";

const fakeHash = bcrypt.hashSync("fakepassword", 12); // fake hash to prevent timing attacks

// every login failure gets this ONE answer, so nobody learns which emails exist
const LOGIN_FAILED = "Invalid email or password";

function signAccessToken(user: { _id: { toString(): string }; role: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing in .env");
  }

  return jwt.sign({ sub: user._id.toString(), role: user.role }, secret, {
    expiresIn: "15m",
  });
}

type Deps = { users: UserRepository; tokens: RefreshTokenRepository };

export function makeAuthService({ users, tokens }: Deps) {
  // a new refresh token in this family: only its hash is saved, the token itself goes in the cookie
  async function issueRefreshToken(userId: UserId, familyId: string) {
    const refreshToken = generateRefreshToken();
    await tokens.create({
      userId,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: new Date(Date.now() + REFRESH_MS),
    });
    return refreshToken;
  }

  return {
    async register(rawEmail: string, password: string) {
      const email = rawEmail.toLowerCase();

      const existingUser = await users.findByEmail(email);
      if (existingUser) {
        throw new AppError(409, "user with this email already exists");
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await users.create(email, passwordHash);
      if (!user) {
        throw new AppError(409, "user with this email already exists");
      }
      return user;
    },

    async login(rawEmail: string, password: string, ip: string | undefined) {
      const email = rawEmail.toLowerCase();
      const user = await users.findByEmail(email);

      if (!user) {
        // the same bcrypt work as a real check, so the time does not tell the email is unknown
        await bcrypt.compare(password, fakeHash);
        throw new AppError(401, LOGIN_FAILED);
      }

      const passwordOk = await bcrypt.compare(password, user.passwordHash);

      if (!user.isActive || !passwordOk) {
        if (["admin", "superadmin"].includes(user.role)) {
          void logAudit({
            actorId: user._id.toString(),
            action: "auth.login.failure",
            details: { reason: user.isActive ? "wrong password" : "account off" },
            ip,
          });
        }

        throw new AppError(401, LOGIN_FAILED);
      }

      const accessToken = signAccessToken(user);
      const refreshToken = await issueRefreshToken(user._id, crypto.randomUUID());

      if (["admin", "superadmin"].includes(user.role)) {
        void logAudit({
          actorId: user._id.toString(),
          action: "auth.login.success",
          ip,
        });
      }

      return { accessToken, refreshToken, user };
    },

    async me(actor: Actor) {
      const user = await users.findById(actor.id);
      if (!user || !user.isActive) {
        throw new AppError(401, "Log in again");
      }
      return user;
    },

    // swap a refresh token for a new one (rotation) and a new access token
    async refresh(cookie: unknown) {
      if (typeof cookie !== "string") {
        throw new AppError(401, "log in first");
      }

      const stored = await tokens.findByHash(hashToken(cookie));
      if (!stored) {
        throw new AppError(401, "invalid refresh token");
      }

      // a used token shown again: someone may have stolen it, so cancel its whole family
      if (stored.usedAt) {
        await tokens.revokeFamily(stored.familyId);
        throw new AppError(401, "invalid refresh token");
      }

      if (stored.expiresAt < new Date() || stored.usedAt || stored.revokedAt) {
        throw new AppError(401, "invalid refresh token");
      }

      const userFound = await users.findById(stored.userId);
      if (!userFound || !userFound.isActive) {
        throw new AppError(401, "invalid refresh token");
      }

      await tokens.markUsed(stored);
      const refreshToken = await issueRefreshToken(stored.userId, stored.familyId);
      const accessToken = signAccessToken(userFound);

      return { accessToken, refreshToken };
    },

    // cancel this device's refresh token, if there is one
    async logout(cookie: unknown) {
      if (typeof cookie !== "string") {
        return;
      }

      const stored = await tokens.findByHash(hashToken(cookie));
      if (stored) {
        await tokens.revoke(stored);
      }
    },

    // cancel every other device: this cookie's family stays
    async logoutOthers(actor: Actor, cookie: unknown) {
      if (typeof cookie !== "string") {
        throw new AppError(401, "log in first");
      }

      const stored = await tokens.findByHash(hashToken(cookie));
      if (!stored) {
        throw new AppError(401, "invalid refresh token");
      }
      if (stored.userId.toString() !== actor.id) {
        throw new AppError(401, "invalid refresh token");
      }

      await tokens.revokeOtherFamilies(stored.userId, stored.familyId);
    },

    async changePassword(actor: Actor, currentPassword: string, newPassword: string) {
      const user = await users.findById(actor.id);
      if (!user || !user.isActive) {
        throw new AppError(401, "you need to log in again");
      }

      const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!passwordOk) {
        throw new AppError(401, "current password is wrong");
      }

      await users.setPasswordHash(user, await bcrypt.hash(newPassword, 12));
      await tokens.revokeAllForUser(user._id);
    },

    async deactivate(actor: Actor, currentPassword: string) {
      const user = await users.findById(actor.id);
      if (!user || !user.isActive) {
        throw new AppError(401, "log in again");
      }

      const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!passwordOk) {
        throw new AppError(401, "password is wrong");
      }

      await users.setActive(user, false);
      await tokens.revokeAllForUser(user._id);
    },
  };
}

export type AuthService = ReturnType<typeof makeAuthService>;

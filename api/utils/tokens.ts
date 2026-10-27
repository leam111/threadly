import crypto from "crypto";

// a refresh token lives 7 days
export const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

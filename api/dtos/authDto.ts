import { z } from "zod";
import { passwordRules } from "../utils/passwordRules";

// ---- what comes in ----

export const registerSchema = z.object({
  email: z.email(),
  password: passwordRules,
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordRules,
});

export const deactivateSchema = z.object({
  currentPassword: z.string().min(1),
});

// ---- what goes out ----

type StoredUser = { _id: unknown; email: string; role?: string | null };

// who I am: never the password hash
export function toUserDto(user: StoredUser) {
  return { id: user._id, email: user.email, role: user.role };
}

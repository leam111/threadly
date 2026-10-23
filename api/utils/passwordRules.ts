import { z } from "zod";

export const passwordRules = z
  .string()
  .min(8)
  .regex(/[A-Za-z]/, "at least one letter is required")
  .regex(/[0-9]/, "at least one number is required");

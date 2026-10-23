import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { User } from "../models/User";
import { passwordRules } from "../utils/passwordRules";
import { chooseDatabase } from "./dbTarget";

// Creates the first superadmin, or promotes an existing user with --promote.
// Run it with: npm run seed:superadmin   (see the README)
// It never prints the password, and it refuses the real database without CONFIRM_REAL_DB=yes.

type Env = Record<string, string | undefined>;

export type SeedInput = { email: string; password: string; promote: boolean };

// read and check SEED_SUPERADMIN_EMAIL, SEED_SUPERADMIN_PASSWORD and the --promote flag
export function readSeedInput(env: Env, args: string[]): SeedInput {
  const email = env.SEED_SUPERADMIN_EMAIL?.trim();
  const password = env.SEED_SUPERADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD must both be set");
  }
  if (!z.email().safeParse(email).success) {
    throw new Error("SEED_SUPERADMIN_EMAIL is not a valid email");
  }
  if (!passwordRules.safeParse(password).success) {
    throw new Error(
      "SEED_SUPERADMIN_PASSWORD breaks the password rules: at least 8 characters, with a letter and a number",
    );
  }
  return { email: email.toLowerCase(), password, promote: args.includes("--promote") };
}

export type SeedResult = "created" | "promoted" | "already superadmin" | "exists";

// uses the database mongoose is already connected to
// an existing user keeps their password: only their role changes, and only with --promote
export async function seedSuperadmin(input: SeedInput): Promise<SeedResult> {
  const existing = await User.findOne({ email: input.email });

  if (!existing) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    await User.create({ email: input.email, passwordHash, role: "superadmin" });
    return "created";
  }

  if (existing.role === "superadmin") {
    return "already superadmin";
  }

  if (!input.promote) {
    return "exists";
  }

  existing.role = "superadmin";
  await existing.save();
  return "promoted";
}

const MESSAGES: Record<SeedResult, string> = {
  created: "superadmin created",
  promoted: "user promoted to superadmin",
  "already superadmin": "this user is already a superadmin: nothing changed",
  exists:
    "a user with this email already exists: nothing changed. Run again with --promote to make them superadmin",
};

async function main() {
  const input = readSeedInput(process.env, process.argv.slice(2));
  const { uri, databaseName } = chooseDatabase(process.env);

  await mongoose.connect(uri);
  try {
    const result = await seedSuperadmin(input);
    console.log(`${MESSAGES[result]} (${input.email}, database ${databaseName})`);
    if (result === "exists") {
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
  }
}

// only when the file is run directly, not when a test imports it
if (require.main === module) {
  main().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

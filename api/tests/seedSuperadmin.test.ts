import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { readSeedInput, seedSuperadmin } from "../scripts/seedSuperadmin";

const run = promisify(execFile);
const API_DIR = path.join(__dirname, "..");
const TSX = path.join(API_DIR, "node_modules", "tsx", "dist", "cli.mjs");
const SCRIPT = path.join(API_DIR, "scripts", "seedSuperadmin.ts");

const NEW_EMAIL = "seed-new@test.com";
const MEMBER_EMAIL = "seed-member@test.com";
const CLI_EMAIL = "seed-cli@test.com";
const EMAILS = [NEW_EMAIL, MEMBER_EMAIL, CLI_EMAIL];
const PASSWORD = "Seedpass123";

describe("readSeedInput", () => {
  test("reads the email (trimmed, lowercase), the password and --promote", () => {
    const input = readSeedInput(
      { SEED_SUPERADMIN_EMAIL: "  Boss@Test.com ", SEED_SUPERADMIN_PASSWORD: PASSWORD },
      ["--promote"],
    );
    expect(input).toEqual({ email: "boss@test.com", password: PASSWORD, promote: true });
    expect(
      readSeedInput({ SEED_SUPERADMIN_EMAIL: "a@test.com", SEED_SUPERADMIN_PASSWORD: PASSWORD }, [])
        .promote,
    ).toBe(false);
  });

  test("refuses when a variable is missing", () => {
    expect(() => readSeedInput({ SEED_SUPERADMIN_PASSWORD: PASSWORD }, [])).toThrow(
      /must both be set/,
    );
    expect(() => readSeedInput({ SEED_SUPERADMIN_EMAIL: "a@test.com" }, [])).toThrow(
      /must both be set/,
    );
  });

  test("refuses a bad email", () => {
    expect(() =>
      readSeedInput(
        { SEED_SUPERADMIN_EMAIL: "not-an-email", SEED_SUPERADMIN_PASSWORD: PASSWORD },
        [],
      ),
    ).toThrow(/not a valid email/);
  });

  test.each(["short1", "onlyletters", "12345678"])(
    "refuses the weak password %s, without showing it",
    (weak) => {
      try {
        readSeedInput({ SEED_SUPERADMIN_EMAIL: "a@test.com", SEED_SUPERADMIN_PASSWORD: weak }, []);
        throw new Error("should have refused");
      } catch (error) {
        expect((error as Error).message).toMatch(/breaks the password rules/);
        expect((error as Error).message).not.toContain(weak);
      }
    },
  );
});

describe("seedSuperadmin", () => {
  async function cleanup() {
    await User.deleteMany({ email: { $in: EMAILS } });
  }
  beforeEach(cleanup);
  afterAll(cleanup);

  test("creates a superadmin when the email is new, with a hashed password", async () => {
    const result = await seedSuperadmin({ email: NEW_EMAIL, password: PASSWORD, promote: false });

    expect(result).toBe("created");
    const saved = await User.findOne({ email: NEW_EMAIL });
    expect(saved?.role).toBe("superadmin");
    expect(saved?.passwordHash).not.toBe(PASSWORD);
    expect(await bcrypt.compare(PASSWORD, saved!.passwordHash)).toBe(true);
  });

  test("leaves an existing user alone without --promote", async () => {
    await User.create({ email: MEMBER_EMAIL, passwordHash: "old-hash" });

    const result = await seedSuperadmin({
      email: MEMBER_EMAIL,
      password: PASSWORD,
      promote: false,
    });

    expect(result).toBe("exists");
    const saved = await User.findOne({ email: MEMBER_EMAIL });
    expect(saved?.role).toBe("member");
  });

  test("promotes an existing user with --promote, and keeps their password", async () => {
    await User.create({ email: MEMBER_EMAIL, passwordHash: "old-hash" });

    const result = await seedSuperadmin({ email: MEMBER_EMAIL, password: PASSWORD, promote: true });

    expect(result).toBe("promoted");
    const saved = await User.findOne({ email: MEMBER_EMAIL });
    expect(saved?.role).toBe("superadmin");
    expect(saved?.passwordHash).toBe("old-hash");
  });

  test("does nothing for a user who is already superadmin", async () => {
    await User.create({ email: MEMBER_EMAIL, passwordHash: "old-hash", role: "superadmin" });
    expect(await seedSuperadmin({ email: MEMBER_EMAIL, password: PASSWORD, promote: true })).toBe(
      "already superadmin",
    );
    expect(await User.countDocuments({ email: MEMBER_EMAIL })).toBe(1);
  });
});

describe("npm run seed:superadmin (the real script)", () => {
  afterAll(async () => {
    await User.deleteMany({ email: { $in: EMAILS } });
  });

  function baseEnv() {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      SEED_SUPERADMIN_EMAIL: CLI_EMAIL,
      SEED_SUPERADMIN_PASSWORD: PASSWORD,
    };
    delete env.CONFIRM_REAL_DB;
    delete env.USE_TEST_DB;
    return env;
  }

  test("refuses the real database without CONFIRM_REAL_DB=yes, before connecting", async () => {
    // a fake address: even a bug could not reach a real database
    const env = { ...baseEnv(), MONGODB_URI: "mongodb://localhost:1/threadly" };

    const failure = await run(process.execPath, [TSX, SCRIPT], { cwd: API_DIR, env }).catch(
      (e) => e,
    );

    expect(failure.code).toBe(1);
    expect(failure.stderr).toContain("refusing to run");
    expect(await User.countDocuments({ email: CLI_EMAIL })).toBe(0);
  });

  test("creates the user on the test database and never prints the password", async () => {
    const env = { ...baseEnv(), USE_TEST_DB: "yes" };

    const { stdout, stderr } = await run(process.execPath, [TSX, SCRIPT], { cwd: API_DIR, env });

    expect(stdout).toContain("superadmin created");
    expect(stdout + stderr).not.toContain(PASSWORD);
    const saved = await User.findOne({ email: CLI_EMAIL });
    expect(saved?.role).toBe("superadmin");
  });
});

import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import mongoose from "mongoose";
import { RefreshToken } from "../models/RefreshTokens";
import { databaseNameFromUri, chooseDatabase } from "../scripts/dbTarget";
import { Db, findIndex } from "../scripts/indexTools";
import * as m001 from "../migrations/001-wardrobe-owner-index";
import * as m002 from "../migrations/002-refresh-token-ttl";

const run = promisify(execFile);
const API_DIR = path.join(__dirname, "..");
const TSX = path.join(API_DIR, "node_modules", "tsx", "dist", "cli.mjs");

// a fake "real" address: nothing listens there, so even a bug could not reach a real database
const FAKE_REAL_URI = "mongodb://localhost:1/threadly";

describe("the database safety lock (dbTarget)", () => {
  test("reads the database name from a connection string", () => {
    expect(databaseNameFromUri("mongodb+srv://u:p@x.mongodb.net/threadly?retryWrites=true")).toBe(
      "threadly",
    );
    expect(databaseNameFromUri("mongodb://u:p@host:27017/shop_test")).toBe("shop_test");
    expect(databaseNameFromUri("mongodb+srv://u:p@x.mongodb.net/?retryWrites=true")).toBe("");
    expect(databaseNameFromUri("mongodb://host:27017")).toBe("");
  });

  test("refuses a database with no _test in its name", () => {
    expect(() => chooseDatabase({ MONGODB_URI: "mongodb://u:secret@h/threadly" })).toThrow(
      /refusing to run on the database "threadly"/,
    );
  });

  test("the refusal never shows the connection string or its password", () => {
    try {
      chooseDatabase({ MONGODB_URI: "mongodb://u:secret123@h/threadly" });
      throw new Error("should have refused");
    } catch (error) {
      expect((error as Error).message).not.toContain("secret123");
      expect((error as Error).message).not.toContain("mongodb://");
    }
  });

  test("refuses a connection string that names no database (it would use 'test')", () => {
    expect(() => chooseDatabase({ MONGODB_URI: "mongodb://h/?x=1" })).toThrow(
      /must name a database/,
    );
  });

  test("CONFIRM_REAL_DB=yes lets the real database through, and nothing else does", () => {
    const uri = "mongodb://h/threadly";
    expect(chooseDatabase({ MONGODB_URI: uri, CONFIRM_REAL_DB: "yes" }).databaseName).toBe(
      "threadly",
    );
    expect(() => chooseDatabase({ MONGODB_URI: uri, CONFIRM_REAL_DB: "true" })).toThrow();
  });

  test("a _test database needs no flag, and USE_TEST_DB=yes picks MONGODB_URI_TEST", () => {
    const result = chooseDatabase({
      MONGODB_URI: "mongodb://h/threadly",
      MONGODB_URI_TEST: "mongodb://h/threadly_test",
      USE_TEST_DB: "yes",
    });
    expect(result.databaseName).toBe("threadly_test");
  });

  test("refuses when the variable is missing", () => {
    expect(() => chooseDatabase({})).toThrow("MONGODB_URI is missing");
  });

  test("npm run migrate:* stops before connecting when the database is the real one", async () => {
    const env: NodeJS.ProcessEnv = { ...process.env, MONGODB_URI: FAKE_REAL_URI };
    delete env.USE_TEST_DB;
    delete env.CONFIRM_REAL_DB;
    const bin = path.join(API_DIR, "node_modules", "migrate-mongo", "bin", "migrate-mongo.js");

    await expect(
      run(process.execPath, [TSX, bin, "up", "-f", "migrate-mongo-config.ts"], {
        cwd: API_DIR,
        env,
      }),
    ).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("refusing to run") });
  });
});

describe("migrations 001 and 002", () => {
  // a separate database, so the other test files (running at the same time)
  // never see their indexes appear and disappear
  let db: Db;

  beforeAll(async () => {
    const name = `${mongoose.connection.name}_mig`;
    expect(name).toContain("_test");
    db = mongoose.connection.getClient().db(name);
    await db.dropDatabase();
  });

  afterAll(async () => {
    expect(db.databaseName).toContain("_test");
    await db.dropDatabase();
  });

  test("001 up swaps ownerId_1 for ownerId_1_createdAt_-1, and runs twice safely", async () => {
    await db.collection("wardrobeitems").createIndex({ ownerId: 1 }, { name: "ownerId_1" });

    await m001.up(db);
    await m001.up(db);

    expect(await findIndex(db, "wardrobeitems", "ownerId_1")).toBeUndefined();
    const compound = await findIndex(db, "wardrobeitems", "ownerId_1_createdAt_-1");
    expect(compound?.key).toEqual({ ownerId: 1, createdAt: -1 });
  });

  test("001 down brings ownerId_1 back and removes the compound index, twice safely", async () => {
    await m001.down(db);
    await m001.down(db);

    expect(await findIndex(db, "wardrobeitems", "ownerId_1")).toBeDefined();
    expect(await findIndex(db, "wardrobeitems", "ownerId_1_createdAt_-1")).toBeUndefined();
  });

  test("001 up works when the collection does not exist yet", async () => {
    await db.collection("wardrobeitems").drop();
    await m001.up(db);
    expect(await findIndex(db, "wardrobeitems", "ownerId_1_createdAt_-1")).toBeDefined();
  });

  test("002 up replaces a plain expiresAt index with a TTL index, and runs twice safely", async () => {
    await db.collection("refreshtokens").createIndex({ expiresAt: 1 }, { name: "expiresAt_1" });

    await m002.up(db);
    await m002.up(db);

    const ttl = await findIndex(db, "refreshtokens", "expiresAt_1");
    expect(ttl?.expireAfterSeconds).toBe(0);
  });

  test("002 down removes the TTL index, twice safely", async () => {
    await m002.down(db);
    await m002.down(db);
    expect(await findIndex(db, "refreshtokens", "expiresAt_1")).toBeUndefined();
  });
});

describe("the RefreshToken model", () => {
  test("declares the TTL index on expiresAt exactly once", () => {
    const onExpiresAt = RefreshToken.schema
      .indexes()
      .filter(([fields]) => Object.keys(fields).includes("expiresAt"));
    expect(onExpiresAt).toEqual([
      [{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })],
    ]);
  });

  test("the test database has the TTL index", async () => {
    const ttl = await findIndex(mongoose.connection.db as Db, "refreshtokens", "expiresAt_1");
    expect(ttl?.expireAfterSeconds).toBe(0);
  });
});

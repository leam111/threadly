import { Db, dropIndexIfExists } from "../scripts/indexTools";

// Seeds the permissions, the 4 roles, and which role has which permission.
// Each role has everything the role below it has, plus a few more.
// "guest" is not stored: a guest has no login, and public routes need no login.
//
// The lists are written out here on purpose (not imported): a migration must
// always do the same thing, even if the code changes later.
// Upserts make it safe to run twice. Down removes only what up added.

const PERMISSIONS = [
  { name: "listing:read", description: "Read the listings" },
  { name: "wardrobe:manage_own", description: "Add, see and change your own wardrobe items" },
  { name: "listing:create", description: "Create a listing" },
  { name: "listing:update_own", description: "Change your own listings" },
  { name: "order:create", description: "Place an order" },
  { name: "review:create", description: "Write a review" },
  { name: "report:create", description: "Report a listing or a user" },
  { name: "listing:hide", description: "Hide any listing" },
  { name: "listing:remove", description: "Remove any listing" },
  { name: "report:resolve", description: "Close a report" },
  { name: "user:view", description: "List the users" },
  { name: "user:ban", description: "Switch a user on or off" },
  { name: "order:refund", description: "Refund an order" },
  { name: "audit:view", description: "Read the audit log" },
  { name: "role:assign", description: "Give a user another role" },
  { name: "permission:edit", description: "Change the permissions of a role" },
];

const MEMBER = [
  "listing:read",
  "wardrobe:manage_own",
  "listing:create",
  "listing:update_own",
  "order:create",
  "review:create",
  "report:create",
];
const MODERATOR = [...MEMBER, "listing:hide", "listing:remove", "report:resolve"];
const ADMIN = [...MODERATOR, "user:view", "user:ban", "order:refund", "audit:view"];
const SUPERADMIN = [...ADMIN, "role:assign", "permission:edit"];

const ROLES = [
  { name: "member", description: "A normal user", permissions: MEMBER },
  { name: "moderator", description: "Looks after listings and reports", permissions: MODERATOR },
  { name: "admin", description: "Looks after users", permissions: ADMIN },
  { name: "superadmin", description: "Can change roles and permissions", permissions: SUPERADMIN },
];

const PERMISSION_NAMES = PERMISSIONS.map((permission) => permission.name);
const ROLE_NAMES = ROLES.map((role) => role.name);

export async function up(db: Db) {
  // the unique indexes first, so no duplicate can ever be stored
  // (the same indexes as in the models; createIndex does nothing when they exist)
  await db.collection("permissions").createIndex({ name: 1 }, { name: "name_1", unique: true });
  await db.collection("roles").createIndex({ name: 1 }, { name: "name_1", unique: true });
  await db
    .collection("rolepermissions")
    .createIndex({ role: 1, permission: 1 }, { name: "role_1_permission_1", unique: true });

  const now = new Date();

  for (const permission of PERMISSIONS) {
    await db.collection("permissions").updateOne(
      { name: permission.name },
      {
        $set: { description: permission.description, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }

  for (const role of ROLES) {
    await db.collection("roles").updateOne(
      { name: role.name },
      {
        $set: { description: role.description, isSystem: true, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    for (const permission of role.permissions) {
      await db
        .collection("rolepermissions")
        .updateOne(
          { role: role.name, permission },
          { $setOnInsert: { createdAt: now } },
          { upsert: true },
        );
    }
  }
}

export async function down(db: Db) {
  // only the names this migration added: any other row stays
  await db
    .collection("rolepermissions")
    .deleteMany({ role: { $in: ROLE_NAMES }, permission: { $in: PERMISSION_NAMES } });
  await db.collection("roles").deleteMany({ name: { $in: ROLE_NAMES } });
  await db.collection("permissions").deleteMany({ name: { $in: PERMISSION_NAMES } });

  await dropIndexIfExists(db, "rolepermissions", "role_1_permission_1");
  await dropIndexIfExists(db, "roles", "name_1");
  await dropIndexIfExists(db, "permissions", "name_1");
}

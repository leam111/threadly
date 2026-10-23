import "dotenv/config";
import { chooseDatabase } from "./scripts/dbTarget";

// migrate-mongo reads this file before every command (up, down, status)
// chooseDatabase throws, and so stops everything, when the database is not a test one
// and CONFIRM_REAL_DB=yes was not given
const { uri, databaseName } = chooseDatabase(process.env);

export default {
  mongodb: { url: uri, databaseName },
  migrationsDir: "migrations",
  migrationFileExtension: ".ts",
  // the list of migrations already run is kept in this collection
  changelogCollectionName: "changelog",
  lockCollectionName: "changelog_lock",
  lockTtl: 0,
  useFileHash: false,
  moduleSystem: "commonjs",
};

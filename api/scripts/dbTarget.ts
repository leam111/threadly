// Which database may a script (a migration or a seed) touch?
// This is the safety lock: a script refuses every database whose name has no "_test",
// unless the person running it says CONFIRM_REAL_DB=yes on purpose.
// The error messages never contain the connection string, because it holds the password.

type Env = Record<string, string | undefined>;

// "mongodb+srv://user:pass@host/threadly?retryWrites=true" gives "threadly"
// gives "" when the string names no database
export function databaseNameFromUri(uri: string) {
  const afterScheme = uri.replace(/^mongodb(\+srv)?:\/\//, "");
  const afterLogin = afterScheme.slice(afterScheme.lastIndexOf("@") + 1);
  const slash = afterLogin.indexOf("/");
  if (slash === -1) {
    return "";
  }
  return decodeURIComponent(afterLogin.slice(slash + 1).split("?")[0]);
}

// USE_TEST_DB=yes picks MONGODB_URI_TEST, otherwise MONGODB_URI (the real database)
export function chooseDatabase(env: Env) {
  const variable = env.USE_TEST_DB === "yes" ? "MONGODB_URI_TEST" : "MONGODB_URI";
  const uri = env[variable];
  if (!uri) {
    throw new Error(`${variable} is missing`);
  }

  const databaseName = databaseNameFromUri(uri);
  if (!databaseName) {
    throw new Error(`${variable} must name a database, like .../threadly?...`);
  }

  if (!databaseName.includes("_test") && env.CONFIRM_REAL_DB !== "yes") {
    throw new Error(
      `refusing to run on the database "${databaseName}": its name has no _test. ` +
        "If you really mean the real database, run again with CONFIRM_REAL_DB=yes",
    );
  }

  return { uri, databaseName };
}

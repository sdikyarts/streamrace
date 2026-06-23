import { execSync } from "child_process";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

config({ path: ".env" });

function getCurrentBranch(): string {
  if (process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME;
  }
  try {
    return execSync("git branch --show-current", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function getDirectUrl(): string {
  const branch = getCurrentBranch();
  let url: string | undefined;

  if (branch === "main") {
    url = process.env.DIRECT_DATABASE_URL;
  } else if (branch === "staging") {
    url = process.env.DIRECT_DATABASE_URL_STAGING;
  } else {
    url = process.env.DIRECT_DATABASE_URL_DEVELOPMENT;
  }

  if (!url) {
    throw new Error(`No direct database URL found for branch: ${branch}`);
  }
  return url;
}

// drizzle-orm stores its migration journal in "drizzle.__drizzle_migrations".
// If that journal has entries but the actual schema is gone (e.g. tables were
// dropped while the journal was preserved), the migrator will skip migration
// 0000 (already recorded) and fail on 0001 with "relation does not exist".
// This function detects and repairs that inconsistency before migrating.
async function resetStaleJournalIfNeeded(pool: Pool): Promise<void> {
  const { rows: schemaRows } = await pool.query<{ drizzle_schema_exists: boolean }>(`
    SELECT EXISTS (
      SELECT FROM information_schema.schemata WHERE schema_name = 'drizzle'
    ) AS drizzle_schema_exists
  `);

  if (!schemaRows[0].drizzle_schema_exists) return;

  const { rows: tableRows } = await pool.query<{ journal_table_exists: boolean }>(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
    ) AS journal_table_exists
  `);

  if (!tableRows[0].journal_table_exists) return;

  const { rows: journalRows } = await pool.query<{ has_entries: boolean }>(`
    SELECT EXISTS (SELECT FROM drizzle.__drizzle_migrations) AS has_entries
  `);

  if (!journalRows[0].has_entries) return;

  const { rows: schemaCheck } = await pool.query<{ artists_exists: boolean }>(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'artists'
    ) AS artists_exists
  `);

  if (!schemaCheck[0].artists_exists) {
    console.log(
      "Stale migration journal detected (journal has entries but schema is missing). Resetting.",
    );
    await pool.query("TRUNCATE drizzle.__drizzle_migrations");
  }
}

async function run() {
  const url = getDirectUrl();
  const pool = new Pool({ connectionString: url });

  try {
    await resetStaleJournalIfNeeded(pool);

    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied successfully.");
  } catch (err) {
    console.error("Migration failed:");
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

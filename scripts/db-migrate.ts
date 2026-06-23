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

async function run() {
  const url = getDirectUrl();
  const pool = new Pool({ connectionString: url });

  try {
    // If the journal records migrations as applied but the actual schema is
    // missing (e.g. tables were dropped while the journal was preserved),
    // reset the journal so all migrations re-run from scratch.
    const { rows } = await pool.query<{ journal_exists: boolean; artists_exists: boolean }>(`
      SELECT
        EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = '__drizzle_migrations'
        ) AS journal_exists,
        EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'artists'
        ) AS artists_exists
    `);

    const { journal_exists, artists_exists } = rows[0];

    if (journal_exists && !artists_exists) {
      console.log(
        "Stale migration journal detected (journal exists but schema is missing). Resetting journal.",
      );
      await pool.query("TRUNCATE __drizzle_migrations");
    }

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

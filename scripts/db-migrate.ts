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

const url = getDirectUrl();
const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

migrate(db, { migrationsFolder: "./drizzle" })
  .then(() => {
    console.log("Migrations applied successfully.");
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("Migration failed:");
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });

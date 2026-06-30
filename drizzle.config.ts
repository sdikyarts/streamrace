import { execSync } from "child_process";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

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

function getDbUrls(): { runtime: string; direct: string } {
  const branch = getCurrentBranch();

  if (branch === "main") {
    return {
      runtime: process.env.DATABASE_URL!,
      direct: process.env.DIRECT_DATABASE_URL!,
    };
  }

  if (branch === "staging") {
    return {
      runtime: process.env.DATABASE_URL_STAGING!,
      direct: process.env.DIRECT_DATABASE_URL_STAGING!,
    };
  }

  return {
    runtime: process.env.DATABASE_URL_DEVELOPMENT!,
    direct: process.env.DIRECT_DATABASE_URL_DEVELOPMENT!,
  };
}

const { runtime, direct } = getDbUrls();

if (!direct) {
  throw new Error("No DIRECT_DATABASE_URL found for the current branch.");
}

function getNeonEndpointKey(url: string) {
  try {
    const host = new URL(url).hostname;
    const endpoint = host.split(".")[0];
    return endpoint?.replace(/-pooler$/, "") ?? null;
  } catch {
    return null;
  }
}

if (runtime) {
  const runtimeEndpoint = getNeonEndpointKey(runtime);
  const directEndpoint = getNeonEndpointKey(direct);
  if (runtimeEndpoint && directEndpoint && runtimeEndpoint !== directEndpoint) {
    throw new Error(
      `Direct URL (${directEndpoint}) must target the same Neon endpoint as runtime URL (${runtimeEndpoint}).`,
    );
  }
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: direct,
  },
});

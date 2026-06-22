import { readFile } from "node:fs/promises";
import path from "node:path";

import { config } from "dotenv";

import { createDatabaseClient } from "../src/db/client";
import {
  getLocalDateString,
  importAllCreditsRows,
  parseSourceDate,
} from "../src/lib/chartmasters/import-all-credits";
import { getDirectDatabaseUrl } from "../src/lib/env";
import { parseMarkdownAllCredits } from "../src/lib/chartmasters/parse-markdown-all-credits";

config({ path: ".env" });

async function main() {
  const sourceDate = parseSourceDate(process.argv[2] ?? getLocalDateString());
  const directDatabaseUrl = getDirectDatabaseUrl();
  const markdownPath = path.join(
    process.cwd(),
    "docs",
    "chartmasters",
    "chartmasters_top_1000_all_credits.md",
  );
  const markdown = await readFile(markdownPath, "utf8");
  const rows = parseMarkdownAllCredits(markdown);
  const client = createDatabaseClient(directDatabaseUrl);

  try {
    const summary = await importAllCreditsRows({
      db: client.db,
      rows,
      sourceDate,
      collectionMethod: "markdown",
    });

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

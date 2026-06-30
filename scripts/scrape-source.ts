import { config } from "dotenv";
import puppeteer from "puppeteer";

import { createDatabaseClient } from "../src/db/client";
import {
  getLocalDateString,
  importAllCreditsRows,
  parseSourceDate,
} from "../src/lib/source/import-all-credits";
import { getDirectDatabaseUrl } from "../src/lib/env";
import type { ParsedAllCreditsRow } from "../src/lib/source/types";

config({ path: ".env" });

const SOURCE_URL = "https://chartmasters.org/most-streamed-artists-ever-on-spotify/";

type DataTablesApi = {
  rows(): {
    count(): number;
    data(): {
      toArray(): unknown[];
    };
  };
};

type JQuery = (el: Element) => { DataTable(): DataTablesApi };

type DataTablesWindow = Window & {
  $?: JQuery & {
    fn?: {
      dataTable?: {
        isDataTable(el: Element): boolean;
      };
    };
  };
};

function parseStreams(raw: string): bigint {
  return BigInt(raw.replace(/[^\d]/g, "") || "0");
}

function parseRank(raw: string): number | null {
  const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function getSpotifyArtistId(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get("artist_spotify_id");
  } catch {
    return null;
  }
}

async function scrapeRows(): Promise<ParsedAllCreditsRow[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    console.log("Loading source page...");
    await page.goto(SOURCE_URL, { waitUntil: "networkidle2", timeout: 60000 });

    // Wait for DataTables to initialise
    await page.waitForFunction(
      () => document.querySelector("table tbody tr") !== null,
      { timeout: 30000 },
    );

    // Try DataTables JS API first — gives us hidden columns (gender, language, genre, country).
    // The page has multiple tables; find the one under the "All Credits" heading to avoid
    // mixing in data from the other rankings (Top 1000, Apple, etc.).
    const dtRows = await page.evaluate((): unknown[][] | null => {
      try {
        const $ = (window as DataTablesWindow).$;
        if (!$?.fn?.dataTable) return null;

        // Walk headings to find the "All Credits" section, then pick its table.
        const headings = Array.from(document.querySelectorAll("h2, h3, h4"));
        const allCreditsHeading = headings.find((h) =>
          h.textContent?.toLowerCase().includes("all credits"),
        );

        let tableEl: Element | null = null;
        if (allCreditsHeading) {
          let el = allCreditsHeading.nextElementSibling;
          while (el && !tableEl) {
            const candidate =
              el.tagName === "TABLE" ? el : el.querySelector("table");
            if (candidate && $.fn.dataTable.isDataTable(candidate)) tableEl = candidate;
            el = el.nextElementSibling;
          }
        }

        if (!tableEl) return null;

        const api = $(tableEl).DataTable();
        if (api.rows().count() === 0) return null;

        return api
          .rows()
          .data()
          .toArray()
          .map((row: unknown) =>
            Array.isArray(row)
              ? row
              : row && typeof row === "object"
                ? Object.values(row)
                : [row],
          );
      } catch {
        return null;
      }
    });

    if (dtRows && dtRows.length > 0) {
      console.log(`Got ${dtRows.length} rows via DataTables API.`);
      return parseDtRows(dtRows);
    }

    // Fallback: find the All Credits table, select "All" entries, then scrape its DOM.
    console.log("Falling back to DOM scraping...");
    const allCreditsTable = await page.evaluateHandle((): Element | null => {
      const headings = Array.from(document.querySelectorAll("h2, h3, h4"));
      const heading = headings.find((h) =>
        h.textContent?.toLowerCase().includes("all credits"),
      );
      if (!heading) return null;
      let el = heading.nextElementSibling;
      let result: Element | null = null;
      while (el && !result) {
        if (el.tagName === "TABLE") result = el;
        else {
          const nested = el.querySelector("table");
          if (nested) result = nested;
        }
        el = el.nextElementSibling;
      }
      return result;
    });

    const tableId = await page.evaluate(
      (el) => (el as Element | null)?.id ?? null,
      allCreditsTable,
    );
    const lengthSelectSelector = tableId
      ? `select[name='${tableId}_length']`
      : "select[name$='_length']";

    const lengthSelect = await page.$(lengthSelectSelector);
    if (lengthSelect) {
      await lengthSelect.select("-1");
      await page.waitForFunction(
        (sel) =>
          (
            document
              .querySelector(sel)
              ?.closest("div")
              ?.querySelectorAll("table tbody tr").length ?? 0
          ) > 100,
        { timeout: 30000 },
        lengthSelectSelector,
      );
    }

    const domRows = await page.evaluate((tableEl): unknown[][] => {
      const table = tableEl as Element | null;
      if (!table) return [];
      const rows: unknown[][] = [];
      table.querySelectorAll("tbody tr").forEach((tr) => {
        const cells = tr.querySelectorAll("td");
        // cells[2] is the image/pic column; artist is cells[3], streams are cells[4-6]
        if (cells.length < 7) return;
        const anchor = cells[3]?.querySelector("a");
        rows.push([
          cells[0]?.textContent?.trim() ?? "",
          cells[1]?.textContent?.trim() ?? "",
          anchor?.outerHTML ?? cells[3]?.textContent?.trim() ?? "",
          cells[4]?.textContent?.trim() ?? "0",
          cells[5]?.textContent?.trim() ?? "0",
          cells[6]?.textContent?.trim() ?? "0",
        ]);
      });
      return rows;
    }, allCreditsTable);

    return parseDtRows(domRows);
  } finally {
    await browser.close();
  }
}

function parseDtRows(rows: unknown[][]): ParsedAllCreditsRow[] {
  const parsedRows: ParsedAllCreditsRow[] = [];

  for (const cells of rows) {
    const rank = parseRank(String(cells[0] ?? ""));
    if (!rank) continue;

    const artistCell = String(cells[2] ?? "");
    const hrefMatch = artistCell.match(/href="([^"]+)"/);
    const nameMatch = artistCell.match(/>([^<]+)</);
    const href = hrefMatch?.[1] ?? null;
    const artistName =
      nameMatch?.[1]?.trim() ?? artistCell.replace(/<[^>]+>/g, "").trim();

    parsedRows.push({
      allCreditRank: rank,
      rawGRank: parseRank(String(cells[1] ?? "")),
      artistName,
      spotifyArtistId: getSpotifyArtistId(href),
      sourceUrl: href,
      leadStreams: parseStreams(String(cells[3] ?? "")),
      nonLeadStreams: parseStreams(String(cells[4] ?? "")),
      allCreditStreams: parseStreams(String(cells[5] ?? "")),
      gender: cells[6] ? String(cells[6]).trim() || null : null,
      language: cells[7] ? String(cells[7]).trim() || null : null,
      genre: cells[8] ? String(cells[8]).trim() || null : null,
      country: cells[9] ? String(cells[9]).trim() || null : null,
    });
  }

  return parsedRows;
}

async function main() {
  const sourceDate = parseSourceDate(process.argv[2] ?? getLocalDateString());
  const rows = await scrapeRows();

  if (rows.length < 100) {
    throw new Error(`Only got ${rows.length} rows — something went wrong with scraping.`);
  }

  console.log(`Scraped ${rows.length} rows. Importing...`);

  const client = createDatabaseClient(getDirectDatabaseUrl());
  try {
    const summary = await importAllCreditsRows({
      db: client.db,
      rows,
      sourceDate,
      collectionMethod: "static_html",
      sourceUrl: SOURCE_URL,
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

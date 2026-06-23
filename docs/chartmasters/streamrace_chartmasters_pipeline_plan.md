# StreamRace ChartMasters All-Credits Data Pipeline Plan

## Revised Plan With Your Uploaded HTML Included

You now have two useful source forms:

1. **Your full top-1,000 artist table** from ChartMasters, with `#`, `g#`, `Artist`, `Lead Streams`, `Feat Streams`, and `All-Credits Streams`. The uploaded table confirms the exact columns and values you need, including the split between lead, featured/non-lead, and all-credit streams. fileciteturn9file0
2. **The saved ChartMasters page HTML**, which shows how the second table is rendered on the page: the “Most-Streamed Artists on Spotify by All Credits” table is a wpDataTables/DataTables table with server-side pagination, table ID `82`, HTML table ID `table_2`, a default 25-row view, and a server-side Ajax endpoint. fileciteturn10file0

The important conclusion is:

```txt
Do not rely on visible DOM rows.
Use the DataTables server-side endpoint or import your full saved table.
```

The saved HTML only contains the currently visible first page of the table, meaning 25 rows, while the page says it is showing 1 to 25 of 1,000 entries. The incremental “Show 1 / 5 / 10 / 25 / 50 / 100 / All” control exists because the table is paginated. Your importer should therefore treat the static DOM as a fallback/debug source, not the main daily source. fileciteturn10file0

ChartMasters’ live page confirms that the all-credits section combines lead and featured streams, with Drake topping that all-credit list. ChartMasters also explains that lead streams come from an artist’s Albums, Singles, and Compilations sections, while “Appears On” tracks are treated as featured streams.

---

## The Correct Architecture Now

Your database should be built around this rule:

```txt
Artists are permanent.
Top-1,000 membership is temporary.
Snapshots are historical.
Current stats are for gameplay.
Game rounds freeze the values used at guess time.
```

This handles all the problems:

```txt
Artists can leave the top 1,000.
Artists can re-enter the top 1,000.
Positions can change daily.
Lead-stream rank can differ from all-credit rank.
The game needs current values.
Old leaderboard/session data must remain historically valid.
```

The all-credit source table should be your core source table because it already contains both metrics you need:

```txt
Overall mode → All-Credits Streams
Lead mode    → Lead Streams
```

---

## Part 4 — Data Health Route, Not Just DB Health

Previously, the idea was to create a simple DB health route. Now that you have real ChartMasters data, the health route should check whether the latest playable dataset exists.

Create:

```txt
src/app/api/health/db/route.ts
```

It should return something like:

```json
{
  "ok": true,
  "appEnv": "development",
  "latestSuccessfulImport": {
    "sourceName": "chartmasters",
    "sourceTable": "spotify_artists_all_credits",
    "sourceDate": "2026-06-20",
    "rowsFound": 1000,
    "status": "success"
  },
  "currentRankedArtists": 1000,
  "playableArtists": 1000
}
```

The route should check:

```txt
DATABASE_URL exists.
Database connection works.
Latest successful ChartMasters all-credit import exists.
Current ranked artist count is close to 1,000.
Playable artist count is high enough.
Latest import status is success.
```

For your app runtime, use the pooled Neon `DATABASE_URL`. For migration/import scripts, use `DIRECT_DATABASE_URL`.

---

## Part 5 — Expanded Database Model

You should expand the database beyond a simple `artists` and `current_stats` setup.

Use these tables:

```txt
artists
data_ingestion_runs
artist_stream_snapshots
artist_stream_current
artist_top1000_periods
ingestion_anomalies
game_sessions
game_rounds
leaderboard_entries
```

Do **not** include:

```txt
spotify_followers
spotify_popularity
```

Those are not relevant to your concept and are fluctuative. Your game is about cumulative Spotify stream totals.

---

## Part 6 — Recommended Schema

### `artists`

This table stores stable artist identity and display metadata.

```sql
CREATE TABLE artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  spotify_artist_id TEXT UNIQUE,
  chartmasters_artist_key TEXT UNIQUE,

  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,

  chartmasters_url TEXT,
  image_url TEXT,
  image_hash TEXT,

  gender TEXT,
  language TEXT,
  genre TEXT,
  country TEXT,

  is_disabled BOOLEAN NOT NULL DEFAULT false,

  metadata_checked_at TIMESTAMPTZ,
  metadata_updated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX artists_normalized_name_idx
ON artists (normalized_name);
```

Notes:

```txt
spotify_artist_id comes from ChartMasters artist links.
display_name is the clean artist name.
image_url can come from the table image first, then Spotify later.
gender/language/genre/country can come from hidden DataTables columns if you collect the Ajax data.
is_disabled lets you manually exclude bad records.
```

---

### `data_ingestion_runs`

Every import attempt gets one row.

```sql
CREATE TABLE data_ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source_name TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_url TEXT,
  source_date DATE NOT NULL,

  status TEXT NOT NULL,

  collection_method TEXT NOT NULL,
  rows_found INTEGER NOT NULL DEFAULT 0,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  rows_dropped_out INTEGER NOT NULL DEFAULT 0,
  rows_reentered INTEGER NOT NULL DEFAULT 0,
  anomalies_count INTEGER NOT NULL DEFAULT 0,

  error_message TEXT,

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
```

Use:

```txt
source_name = chartmasters
source_table = spotify_artists_all_credits
collection_method = markdown | static_html | datatables_ajax
```

Import statuses:

```txt
running
success
failed
rejected
partial
```

Use `rejected` when the collector gets only 25, 50, or 100 rows instead of the full top 1,000.

---

### `artist_stream_snapshots`

This table is append-only. Every successful import inserts one row per artist found on that source date.

```sql
CREATE TABLE artist_stream_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  import_run_id UUID NOT NULL REFERENCES data_ingestion_runs(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,

  source_date DATE NOT NULL,
  source_name TEXT NOT NULL DEFAULT 'chartmasters',
  source_table TEXT NOT NULL DEFAULT 'spotify_artists_all_credits',

  all_credit_rank INTEGER NOT NULL,
  raw_g_rank INTEGER,

  lead_rank_in_dataset INTEGER,

  lead_streams BIGINT NOT NULL,
  non_lead_streams BIGINT NOT NULL,
  all_credit_streams BIGINT NOT NULL,

  raw_artist_name TEXT NOT NULL,
  raw_artist_url TEXT,
  raw_image_url TEXT,
  raw_data_freshness_label TEXT,

  gender TEXT,
  language TEXT,
  genre TEXT,
  country TEXT,

  row_hash TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (artist_id, source_date, source_table)
);

CREATE INDEX artist_stream_snapshots_date_rank_idx
ON artist_stream_snapshots (source_date, all_credit_rank);

CREATE INDEX artist_stream_snapshots_artist_date_idx
ON artist_stream_snapshots (artist_id, source_date);
```

Why this table matters:

```txt
It preserves daily history.
It lets you calculate daily gains.
It lets you show rank movement.
It protects old game rounds from future data changes.
It lets you detect dropouts and re-entries.
```

---

### `artist_stream_current`

This table is the fast gameplay table.

```sql
CREATE TABLE artist_stream_current (
  artist_id UUID PRIMARY KEY REFERENCES artists(id) ON DELETE CASCADE,

  latest_snapshot_id UUID REFERENCES artist_stream_snapshots(id) ON DELETE SET NULL,

  source_date DATE,
  currently_ranked BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',

  first_seen_on DATE,
  last_seen_on DATE,
  dropped_out_on DATE,
  reentered_on DATE,

  all_credit_rank INTEGER,
  previous_all_credit_rank INTEGER,
  all_credit_rank_change INTEGER,

  lead_rank_in_dataset INTEGER,
  previous_lead_rank_in_dataset INTEGER,
  lead_rank_change_in_dataset INTEGER,

  raw_g_rank INTEGER,
  previous_raw_g_rank INTEGER,
  raw_g_rank_change INTEGER,

  lead_streams BIGINT,
  previous_lead_streams BIGINT,
  lead_daily_gain BIGINT,

  non_lead_streams BIGINT,
  previous_non_lead_streams BIGINT,
  non_lead_daily_gain BIGINT,

  all_credit_streams BIGINT,
  previous_all_credit_streams BIGINT,
  all_credit_daily_gain BIGINT,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX artist_stream_current_ranked_idx
ON artist_stream_current (currently_ranked, all_credit_rank);

CREATE INDEX artist_stream_current_all_credit_streams_idx
ON artist_stream_current (all_credit_streams);

CREATE INDEX artist_stream_current_lead_streams_idx
ON artist_stream_current (lead_streams);
```

The game should read from `artist_stream_current`, not from `artist_stream_snapshots`, because the current table is optimized for live gameplay.

---

### `artist_top1000_periods`

This table tracks entry, exit, and re-entry.

```sql
CREATE TABLE artist_top1000_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,

  entered_on DATE NOT NULL,
  exited_on DATE,

  entry_all_credit_rank INTEGER,
  exit_all_credit_rank INTEGER,

  is_open BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX artist_top1000_periods_artist_open_idx
ON artist_top1000_periods (artist_id, is_open);
```

This is the cleanest solution for artists leaving and re-entering the top 1,000.

---

### `ingestion_anomalies`

This table stores parser/import problems.

```sql
CREATE TABLE ingestion_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  import_run_id UUID NOT NULL REFERENCES data_ingestion_runs(id) ON DELETE CASCADE,

  severity TEXT NOT NULL,
  code TEXT NOT NULL,

  row_number INTEGER,
  artist_name TEXT,

  message TEXT NOT NULL,
  raw_value TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Useful anomaly codes:

```txt
ROW_COUNT_TOO_LOW
ROW_COUNT_TOO_HIGH
DUPLICATE_RANK
DUPLICATE_SPOTIFY_ID
MISSING_ARTIST_URL
MISSING_STREAM_VALUE
STREAM_SUM_MISMATCH
INVALID_RANK
AJAX_ENDPOINT_MISSING
TABLE_CONFIG_MISSING
STATIC_HTML_ONLY_25_ROWS
PARSE_FAILED
```

---

### `game_sessions`

```sql
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  mode TEXT NOT NULL,
  dataset_source_date DATE NOT NULL,
  dataset_source_table TEXT NOT NULL DEFAULT 'spotify_artists_all_credits',

  anonymous_id TEXT,

  streak INTEGER NOT NULL DEFAULT 0,
  max_streak INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'active',

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
```

Store `dataset_source_date` so old sessions remain tied to the version of the data that was used.

---

### `game_rounds`

```sql
CREATE TABLE game_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,

  round_number INTEGER NOT NULL,

  left_artist_id UUID NOT NULL REFERENCES artists(id),
  right_artist_id UUID NOT NULL REFERENCES artists(id),

  mode TEXT NOT NULL,

  left_streams BIGINT NOT NULL,
  right_streams BIGINT NOT NULL,

  left_rank INTEGER,
  right_rank INTEGER,

  player_guess TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,

  stream_gap BIGINT NOT NULL,

  dataset_source_date DATE NOT NULL,

  answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

This freezes the exact values used in the game round.

---

### `leaderboard_entries`

```sql
CREATE TABLE leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,

  player_name TEXT,
  anonymous_id TEXT,

  mode TEXT NOT NULL,

  score INTEGER NOT NULL,
  rounds_played INTEGER NOT NULL,

  dataset_source_date DATE NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Part 7 — HTML Matching for the ChartMasters All-Credits Table

From your uploaded HTML, the all-credit table is not just “the second table” in a loose DOM sense. It has very specific identifiers and configuration.

Use this matching strategy.

### Primary Section Match

Find the heading:

```txt
Most-Streamed Artists on Spotify by All Credits
```

Then search after that heading for the wpDataTables wrapper.

### Current Table Identity

Your uploaded HTML shows this identity:

| Thing | Value |
|---|---|
| wpDataTables ID | `82` |
| HTML table ID | `table_2` |
| Wrapper | `#table_2_wrapper` |
| Config input | `#table_2_desc` |
| Server-side nonce input | `#wdtNonceFrontendServerSide_82` |
| Ajax endpoint | `https://chartmasters.org/wp-admin/admin-ajax.php?action=get_wdtable&table_id=82` |
| Default visible length | `25` |
| Total rows shown by UI | `1,000` |
| Server-side mode | `true` |
| Default ordering | column `6`, descending |
| All-credit column index | `6` |

The `#table_2_desc` configuration contains `tableType: "mysql"`, `tableWpId: 82`, `serverSide: true`, and the Ajax URL for `get_wdtable&table_id=82`. The length menu in the saved HTML includes `1`, `5`, `10`, `25`, `50`, `100`, and `All`, where `All` maps to `-1`. fileciteturn10file0

This matches DataTables behavior: with server-side processing enabled, the table makes Ajax requests for each draw/page, and DataTables sends parameters like `draw`, `start`, `length`, `order`, `columns`, and `search`. DataTables also documents that `length = -1` means all records, though pagination by 100 is safer and easier to validate.

---

## Part 8 — Exact HTML Selectors to Use

Use this selector set.

```ts
const ALL_CREDITS_HEADING_TEXT =
  "Most-Streamed Artists on Spotify by All Credits";

const TABLE_SELECTOR = "table#table_2[data-wpdatatable_id='82']";
const TABLE_WRAPPER_SELECTOR = "#table_2_wrapper.wpDataTableID-82";
const TABLE_DESC_SELECTOR = "input#table_2_desc";
const NONCE_SELECTOR = "input#wdtNonceFrontendServerSide_82";
const LENGTH_SELECTOR = "select[name='table_2_length']";
const INFO_SELECTOR = "#table_2_info";
```

Column classes from your HTML:

```txt
.column-rank
.column-g
.column-pic
.column-artist
.column-lead-streams
.column-feat-streams
.column-all-credits-streams
.column-gender
.column-language
.column-genre
.column-country
.column-artistnamefilter
```

Header match:

```txt
#
g#
Artist
Lead Streams
Feat Streams
All-Credits Streams
```

Do not depend only on `table_2`, because that ID may change someday if ChartMasters changes page/table order. The robust matcher should require both:

```txt
Heading text = Most-Streamed Artists on Spotify by All Credits
Headers include Lead Streams, Feat Streams, All-Credits Streams
```

Current hardcoded match is still useful:

```txt
table_id = 82
html_id = table_2
```

But the fallback should detect by heading and headers.

---

## Part 9 — Why the Incremental View Breaks Naive Scraping

The static saved HTML contains:

```txt
Show 25 entries
Showing 1 to 25 of 1,000 entries
Pagination: 1 2 3 4 5 … 40
```

That means:

```txt
tbody extraction gives 25 rows only.
querySelectorAll("#table_2 tbody tr") gives 25 rows only.
Cheerio/BeautifulSoup static extraction gives 25 rows only.
```

So this is wrong for daily import:

```ts
const rows = $("table#table_2 tbody tr").toArray();
```

That only imports the visible page.

The correct daily importer should do one of these:

```txt
Best: call the server-side DataTables Ajax endpoint and page through all 1,000 rows.
Good fallback: import your full saved Markdown/top-1,000 file.
Debug fallback only: parse static HTML visible rows and reject if row count < 900.
```

---

## Part 10 — Install the Import Dependencies

Run:

```bash
npm install drizzle-orm @neondatabase/serverless zod cheerio
npm install -D drizzle-kit dotenv tsx
```

Add scripts:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "import:chartmasters:file": "tsx scripts/import-chartmasters-file.ts",
    "import:chartmasters:html": "tsx scripts/import-chartmasters-html.ts",
    "import:chartmasters:ajax": "tsx scripts/import-chartmasters-ajax.ts"
  }
}
```

---

## Part 11 — Extract Table Config From the Uploaded HTML

Create:

```txt
src/lib/chartmasters/extractAllCreditsTableConfig.ts
```

```ts
import * as cheerio from "cheerio";

export type ChartmastersAllCreditsTableConfig = {
  tableId: string;
  tableWpId: number;
  ajaxUrl: string;
  nonce: string | null;
  serverSide: boolean;
  defaultLength: number;
  orderColumn: number;
  orderDirection: "asc" | "desc";
  columnNames: string[];
};

export function extractAllCreditsTableConfig(html: string): ChartmastersAllCreditsTableConfig {
  const $ = cheerio.load(html);

  const heading = $("h2, h3")
    .filter((_, el) =>
      $(el).text().trim().includes("Most-Streamed Artists on Spotify by All Credits"),
    )
    .first();

  if (!heading.length) {
    throw new Error("All-credits heading not found");
  }

  const table = $("table")
    .filter((_, el) => {
      const headers = $(el)
        .find("thead th")
        .map((_, th) => $(th).text().trim())
        .get();

      return (
        headers.includes("Artist") &&
        headers.includes("Lead Streams") &&
        headers.includes("Feat Streams") &&
        headers.includes("All-Credits Streams")
      );
    })
    .first();

  const tableId = table.attr("id") ?? "table_2";
  const tableWpId = Number(table.attr("data-wpdatatable_id") ?? 82);

  const descInput = $(`#${tableId}_desc`);
  const fallbackDescInput = $("#table_2_desc");
  const descValue = descInput.attr("value") ?? fallbackDescInput.attr("value");

  if (!descValue) {
    throw new Error("wpDataTables description input not found");
  }

  const desc = JSON.parse(descValue);

  const nonce =
    $(`#wdtNonceFrontendServerSide_${desc.tableWpId}`).attr("value") ??
    $(`#wdtNonceFrontendServerSide_${tableWpId}`).attr("value") ??
    null;

  const params = desc.dataTableParams;

  return {
    tableId: desc.tableId,
    tableWpId: Number(desc.tableWpId),
    ajaxUrl: params.ajax.url.replaceAll("&amp;", "&"),
    nonce,
    serverSide: Boolean(params.serverSide),
    defaultLength: Number(params.iDisplayLength),
    orderColumn: Number(params.order?.[0]?.[0] ?? 6),
    orderDirection: params.order?.[0]?.[1] === "asc" ? "asc" : "desc",
    columnNames: params.columnDefs.map((column: { name: string }) => column.name),
  };
}
```

With your uploaded HTML, this should return:

```json
{
  "tableId": "table_2",
  "tableWpId": 82,
  "serverSide": true,
  "defaultLength": 25,
  "orderColumn": 6,
  "orderDirection": "desc"
}
```

---

## Part 12 — Parse the Static Visible HTML Rows

This parser is useful for local debugging and verifying the first 25 rows, but it should not update production unless it gets the full 1,000.

Create:

```txt
src/lib/chartmasters/parseAllCreditsStaticHtml.ts
```

```ts
import * as cheerio from "cheerio";

export type ParsedAllCreditsRow = {
  allCreditRank: number;
  rawGRank: number | null;
  artistName: string;
  spotifyArtistId: string | null;
  chartmastersUrl: string | null;
  imageUrl: string | null;
  leadStreams: bigint;
  nonLeadStreams: bigint;
  allCreditStreams: bigint;
  dataFreshnessLabel: string | null;
  gender?: string | null;
  language?: string | null;
  genre?: string | null;
  country?: string | null;
};

function parseBigInt(value: string): bigint {
  const cleaned = value.replace(/[^\d]/g, "");
  if (!cleaned) throw new Error(`Invalid number: ${value}`);
  return BigInt(cleaned);
}

function getSpotifyArtistId(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("artist_spotify_id");
  } catch {
    return null;
  }
}

export function parseAllCreditsStaticHtml(html: string): ParsedAllCreditsRow[] {
  const $ = cheerio.load(html);
  const rows: ParsedAllCreditsRow[] = [];

  $("#table_2 tbody tr").each((_, tr) => {
    const cells = $(tr).find("td");

    if (cells.length < 7) return;

    const rank = Number($(cells[0]).text().trim());
    const gRankText = $(cells[1]).text().trim();
    const rawGRank = gRankText ? Number(gRankText) : null;

    const imageUrl = $(cells[2]).find("img").attr("src") ?? null;

    const artistLink = $(cells[3]).find("a.styledLink").first();
    const artistName = artistLink.text().trim();
    const chartmastersUrl = artistLink.attr("href") ?? null;
    const spotifyArtistId = getSpotifyArtistId(chartmastersUrl);

    const freshness =
      $(cells[3]).find("span").text().trim() ||
      $(cells[3]).find("i").text().trim() ||
      null;

    const leadStreams = parseBigInt($(cells[4]).text());
    const nonLeadStreams = parseBigInt($(cells[5]).text());
    const allCreditStreams = parseBigInt($(cells[6]).text());

    rows.push({
      allCreditRank: rank,
      rawGRank: Number.isFinite(rawGRank) ? rawGRank : null,
      artistName,
      spotifyArtistId,
      chartmastersUrl,
      imageUrl,
      leadStreams,
      nonLeadStreams,
      allCreditStreams,
      dataFreshnessLabel: freshness,
    });
  });

  return rows;
}
```

Validation:

```ts
export function validateFullAllCreditsRows(rows: ParsedAllCreditsRow[]) {
  if (rows.length < 900) {
    throw new Error(`Expected full top 1000, got ${rows.length}`);
  }

  const ranks = new Set<number>();
  const spotifyIds = new Set<string>();

  for (const row of rows) {
    if (ranks.has(row.allCreditRank)) {
      throw new Error(`Duplicate all-credit rank: ${row.allCreditRank}`);
    }

    ranks.add(row.allCreditRank);

    if (row.spotifyArtistId) {
      if (spotifyIds.has(row.spotifyArtistId)) {
        throw new Error(`Duplicate Spotify artist ID: ${row.spotifyArtistId}`);
      }

      spotifyIds.add(row.spotifyArtistId);
    }

    if (row.leadStreams + row.nonLeadStreams !== row.allCreditStreams) {
      throw new Error(
        `Stream mismatch for ${row.artistName}: lead + non-lead != all-credit`,
      );
    }
  }
}
```

For the uploaded saved HTML, this static parser should intentionally return only 25 rows. That means the static parser should reject production import because it does not have the full dataset.

---

## Part 13 — DataTables Ajax Fetcher

This is the real daily collection method.

Create:

```txt
src/lib/chartmasters/fetchAllCreditsViaDataTables.ts
```

DataTables server-side processing sends `draw`, `start`, `length`, `search`, `order`, and `columns` parameters. The returned JSON contains `draw`, `recordsTotal`, `recordsFiltered`, and `data`.

Use paging by 100 rows:

```txt
start = 0, length = 100
start = 100, length = 100
start = 200, length = 100
...
start = 900, length = 100
```

This is better than blindly using `length = -1` because your own table config exposes `100` as a normal page size and `All` as a special option. DataTables supports `-1` for all rows, but paging by 100 is easier to validate and recover.

```ts
import * as cheerio from "cheerio";
import { extractAllCreditsTableConfig } from "./extractAllCreditsTableConfig";

type DataTablesResponse = {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  data: unknown[];
};

const CHARTMASTERS_URL =
  "https://chartmasters.org/most-streamed-artists-ever-on-spotify/";

function appendColumnParams(
  body: URLSearchParams,
  columns: string[],
) {
  columns.forEach((name, index) => {
    body.set(`columns[${index}][data]`, String(index));
    body.set(`columns[${index}][name]`, name);
    body.set(`columns[${index}][searchable]`, ["Gender", "Language", "Genre", "Country", "ArtistNameFilter"].includes(name) ? "true" : "false");
    body.set(`columns[${index}][orderable]`, ["Artist", "Lead Streams", "Feat Streams", "All-Credits Streams"].includes(name) ? "true" : "false");
    body.set(`columns[${index}][search][value]`, "");
    body.set(`columns[${index}][search][regex]`, "false");
  });
}

async function fetchPageHtml() {
  const response = await fetch(CHARTMASTERS_URL, {
    headers: {
      "user-agent": "StreamRaceImporter/1.0",
      "accept": "text/html",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ChartMasters page: ${response.status}`);
  }

  return response.text();
}

async function fetchAjaxPage(args: {
  ajaxUrl: string;
  tableWpId: number;
  nonce: string | null;
  columns: string[];
  start: number;
  length: number;
  draw: number;
}) {
  const body = new URLSearchParams();

  body.set("draw", String(args.draw));
  body.set("start", String(args.start));
  body.set("length", String(args.length));

  body.set("search[value]", "");
  body.set("search[regex]", "false");

  body.set("order[0][column]", "6");
  body.set("order[0][dir]", "desc");

  appendColumnParams(body, args.columns);

  if (args.nonce) {
    body.set(`wdtNonceFrontendServerSide_${args.tableWpId}`, args.nonce);
  }

  const response = await fetch(args.ajaxUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
      "referer": CHARTMASTERS_URL,
      "origin": "https://chartmasters.org",
      "user-agent": "StreamRaceImporter/1.0",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`ChartMasters Ajax failed: ${response.status}`);
  }

  return response.json() as Promise<DataTablesResponse>;
}

export async function fetchAllCreditsViaDataTables() {
  const html = await fetchPageHtml();
  const config = extractAllCreditsTableConfig(html);

  if (!config.serverSide) {
    throw new Error("Expected serverSide DataTables config");
  }

  const pageLength = 100;
  let start = 0;
  let draw = 1;
  let total: number | null = null;
  const rawRows: unknown[] = [];

  while (total === null || start < total) {
    const page = await fetchAjaxPage({
      ajaxUrl: config.ajaxUrl,
      tableWpId: config.tableWpId,
      nonce: config.nonce,
      columns: config.columnNames,
      start,
      length: pageLength,
      draw,
    });

    total = page.recordsFiltered;
    rawRows.push(...page.data);

    if (!page.data.length) break;

    start += pageLength;
    draw += 1;
  }

  if (rawRows.length < 900) {
    throw new Error(`Expected full top 1000, got ${rawRows.length}`);
  }

  return rawRows;
}
```

You will need one additional parser that converts `rawRows` into your normalized `ParsedAllCreditsRow[]`. The returned row format can be either arrays or objects depending on the wpDataTables response. DataTables supports both array and object formats for server-side response data.

---

## Part 14 — Parse DataTables Ajax Rows

Create:

```txt
src/lib/chartmasters/parseAllCreditsAjaxRows.ts
```

The safest parser handles both array and object row shapes.

```ts
import * as cheerio from "cheerio";
import type { ParsedAllCreditsRow } from "./parseAllCreditsStaticHtml";

function parseBigInt(value: string): bigint {
  const cleaned = value.replace(/[^\d]/g, "");
  if (!cleaned) throw new Error(`Invalid number: ${value}`);
  return BigInt(cleaned);
}

function textFromHtml(value: unknown): string {
  const raw = String(value ?? "");
  return cheerio.load(raw).text().trim();
}

function extractArtistFromHtml(value: unknown) {
  const raw = String(value ?? "");
  const $ = cheerio.load(raw);

  const link = $("a.styledLink").first().length
    ? $("a.styledLink").first()
    : $("a[href*='artist_spotify_id']").first();

  const artistName = link.text().trim() || $.text().trim();
  const chartmastersUrl = link.attr("href") ?? null;

  let spotifyArtistId: string | null = null;

  if (chartmastersUrl) {
    try {
      spotifyArtistId = new URL(chartmastersUrl).searchParams.get("artist_spotify_id");
    } catch {
      spotifyArtistId = null;
    }
  }

  const dataFreshnessLabel = $("span").text().trim() || $("i").text().trim() || null;

  return {
    artistName,
    chartmastersUrl,
    spotifyArtistId,
    dataFreshnessLabel,
  };
}

function extractImageUrl(value: unknown): string | null {
  const raw = String(value ?? "");
  const $ = cheerio.load(raw);
  return $("img").first().attr("src") ?? null;
}

function getCell(row: unknown, index: number, key: string): unknown {
  if (Array.isArray(row)) return row[index];

  if (row && typeof row === "object") {
    const objectRow = row as Record<string, unknown>;

    return (
      objectRow[key] ??
      objectRow[String(index)] ??
      objectRow[index] ??
      null
    );
  }

  return null;
}

export function parseAllCreditsAjaxRows(rawRows: unknown[]): ParsedAllCreditsRow[] {
  return rawRows.map((row) => {
    const rankValue = getCell(row, 0, "rank");
    const gRankValue = getCell(row, 1, "g#");
    const imageValue = getCell(row, 2, "Pic");
    const artistValue = getCell(row, 3, "Artist");
    const leadValue = getCell(row, 4, "Lead Streams");
    const featValue = getCell(row, 5, "Feat Streams");
    const allValue = getCell(row, 6, "All-Credits Streams");

    const genderValue = getCell(row, 7, "Gender");
    const languageValue = getCell(row, 8, "Language");
    const genreValue = getCell(row, 9, "Genre");
    const countryValue = getCell(row, 10, "Country");

    const artist = extractArtistFromHtml(artistValue);

    return {
      allCreditRank: Number(textFromHtml(rankValue)),
      rawGRank: Number.isFinite(Number(textFromHtml(gRankValue)))
        ? Number(textFromHtml(gRankValue))
        : null,
      artistName: artist.artistName,
      spotifyArtistId: artist.spotifyArtistId,
      chartmastersUrl: artist.chartmastersUrl,
      imageUrl: extractImageUrl(imageValue),
      leadStreams: parseBigInt(textFromHtml(leadValue)),
      nonLeadStreams: parseBigInt(textFromHtml(featValue)),
      allCreditStreams: parseBigInt(textFromHtml(allValue)),
      dataFreshnessLabel: artist.dataFreshnessLabel,
      gender: textFromHtml(genderValue) || null,
      language: textFromHtml(languageValue) || null,
      genre: textFromHtml(genreValue) || null,
      country: textFromHtml(countryValue) || null,
    };
  });
}
```

---

## Part 15 — Manual File Import Still Matters

Because you already have the full top 1,000 in a file, keep a manual importer.

Use this order:

```txt
1. Manual full Markdown import now.
2. DataTables Ajax importer next.
3. Cron importer last.
```

Why:

```txt
The file import lets you build the game immediately.
The Ajax importer solves daily updates.
The cron importer automates the daily update.
```

Keep both import paths:

```txt
import:chartmasters:file
import:chartmasters:ajax
```

That way, when the website structure changes, you can still import a saved file manually.

---

## Part 16 — Markdown Parser for Your Full Top-1,000 Table

Your full table rows look like:

```md
| 1 | 1 | [**Drake**](https://chartmasters.org/spotify-streaming-numbers-tool/?artist_name=&artist_spotify_id=3TVXtAsR1Inumwj472S9r4) | 102,370,768,899 | 33,730,710,889 | **136,101,479,788** |
```

Use this parser for the uploaded/full Markdown table.

```ts
export function parseMarkdownAllCredits(markdown: string): ParsedAllCreditsRow[] {
  const rows: ParsedAllCreditsRow[] = [];

  for (const line of markdown.split("
")) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("|")) continue;
    if (trimmed.includes("---")) continue;
    if (trimmed.includes("Lead Streams")) continue;

    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 6) continue;

    const [rankCell, gRankCell, artistCell, leadCell, featCell, allCreditCell] =
      cells;

    const rank = Number(rankCell);
    if (!Number.isFinite(rank)) continue;

    const artistMatch = artistCell.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const rawArtistName = artistMatch?.[1] ?? artistCell;
    const artistName = rawArtistName.replace(/\*\*/g, "").trim();
    const chartmastersUrl = artistMatch?.[2] ?? null;

    let spotifyArtistId: string | null = null;

    if (chartmastersUrl) {
      try {
        spotifyArtistId = new URL(chartmastersUrl).searchParams.get("artist_spotify_id");
      } catch {
        spotifyArtistId = null;
      }
    }

    rows.push({
      allCreditRank: rank,
      rawGRank: Number.isFinite(Number(gRankCell)) ? Number(gRankCell) : null,
      artistName,
      spotifyArtistId,
      chartmastersUrl,
      imageUrl: null,
      leadStreams: BigInt(leadCell.replace(/[^\d]/g, "")),
      nonLeadStreams: BigInt(featCell.replace(/[^\d]/g, "")),
      allCreditStreams: BigInt(allCreditCell.replace(/[^\d]/g, "")),
      dataFreshnessLabel: null,
    });
  }

  return rows;
}
```

---

## Part 17 — Compute Lead Rank From the All-Credits Dataset

The source `#` column is the all-credit rank.

For lead mode, compute `lead_rank_in_dataset` yourself by sorting the imported 1,000 rows by `lead_streams`.

```ts
export function addLeadRankInDataset(rows: ParsedAllCreditsRow[]) {
  const sorted = [...rows].sort((a, b) => {
    if (a.leadStreams === b.leadStreams) {
      return a.allCreditRank - b.allCreditRank;
    }

    return a.leadStreams > b.leadStreams ? -1 : 1;
  });

  const rankByKey = new Map<string, number>();

  sorted.forEach((row, index) => {
    const key = row.spotifyArtistId ?? row.artistName.toLowerCase();
    rankByKey.set(key, index + 1);
  });

  return rows.map((row) => {
    const key = row.spotifyArtistId ?? row.artistName.toLowerCase();

    return {
      ...row,
      leadRankInDataset: rankByKey.get(key)!,
    };
  });
}
```

Modes:

```txt
Overall mode:
  Compare all_credit_streams.
  Show all_credit_rank.

Lead mode:
  Compare lead_streams.
  Show lead_rank_in_dataset.
```

---

## Part 18 — Import Algorithm

Every import, whether from Markdown, static HTML, or DataTables Ajax, should normalize into the same row shape:

```ts
ParsedAllCreditsRow[]
```

Then use one import function:

```txt
importAllCreditsRows(rows, sourceDate, collectionMethod)
```

Algorithm:

```txt
1. Create data_ingestion_runs row with status = running.
2. Parse rows.
3. Validate row count.
4. Validate rank uniqueness.
5. Validate Spotify ID uniqueness.
6. Validate lead + non_lead = all_credit.
7. Compute lead_rank_in_dataset.
8. Upsert artists.
9. Insert daily snapshots.
10. Update artist_stream_current.
11. Detect dropouts.
12. Detect re-entries.
13. Update top-1000 periods.
14. Mark import run success.
```

Pseudo-code:

```ts
await db.transaction(async (tx) => {
  const importRun = await createImportRun(tx, {
    sourceName: "chartmasters",
    sourceTable: "spotify_artists_all_credits",
    sourceDate,
    collectionMethod,
    status: "running",
  });

  validateFullAllCreditsRows(rows);

  const rowsWithLeadRank = addLeadRankInDataset(rows);
  const todayArtistIds = new Set<string>();

  for (const row of rowsWithLeadRank) {
    const artist = await upsertArtist(tx, row);

    todayArtistIds.add(artist.id);

    const snapshot = await insertSnapshot(tx, {
      importRunId: importRun.id,
      artistId: artist.id,
      sourceDate,
      row,
    });

    await updateCurrentFromSnapshot(tx, {
      artistId: artist.id,
      snapshot,
      sourceDate,
    });

    await openOrMaintainTop1000Period(tx, {
      artistId: artist.id,
      sourceDate,
      rank: row.allCreditRank,
    });
  }

  await markDropouts(tx, {
    todayArtistIds,
    sourceDate,
  });

  await finishImportRun(tx, {
    importRunId: importRun.id,
    status: "success",
    rowsFound: rows.length,
  });
});
```

---

## Part 19 — Dropout Logic

After a full successful import:

```txt
Artists present yesterday but missing today are dropouts.
```

Do not delete them.

Update them:

```sql
UPDATE artist_stream_current
SET currently_ranked = false,
    status = 'dropped_out',
    dropped_out_on = $1,
    all_credit_rank = NULL,
    lead_rank_in_dataset = NULL,
    updated_at = now()
WHERE currently_ranked = true
  AND artist_id NOT IN (...today_artist_ids);
```

Close their open top-1,000 period:

```sql
UPDATE artist_top1000_periods
SET exited_on = $1,
    is_open = false,
    updated_at = now()
WHERE artist_id = $2
  AND is_open = true;
```

They remain available for:

```txt
historical snapshots
old game rounds
old leaderboard entries
admin history
future re-entry detection
```

They are excluded from normal gameplay.

---

## Part 20 — Re-Entry Logic

If an artist was previously `currently_ranked = false` and appears in today’s import:

```txt
Set currently_ranked = true.
Set status = active.
Set reentered_on = source date.
Open a new top-1,000 period.
Calculate gain from last known snapshot.
```

Open a period:

```sql
INSERT INTO artist_top1000_periods (
  artist_id,
  entered_on,
  entry_all_credit_rank,
  is_open
)
VALUES ($1, $2, $3, true);
```

---

## Part 21 — Rank Movement Logic

Use this formula:

```txt
rank_change = previous_rank - current_rank
```

Meaning:

```txt
+3 means climbed 3 positions.
-3 means fell 3 positions.
0 means unchanged.
```

For all-credit rank:

```txt
all_credit_rank_change = previous_all_credit_rank - current_all_credit_rank
```

For lead mode rank:

```txt
lead_rank_change_in_dataset = previous_lead_rank_in_dataset - lead_rank_in_dataset
```

For stream gains:

```txt
lead_daily_gain = current_lead_streams - previous_lead_streams
non_lead_daily_gain = current_non_lead_streams - previous_non_lead_streams
all_credit_daily_gain = current_all_credit_streams - previous_all_credit_streams
```

---

## Part 22 — Current Gameplay Query

Normal gameplay should only use currently ranked, enabled artists.

```sql
SELECT
  a.id,
  a.display_name,
  a.image_url,
  c.all_credit_rank,
  c.lead_rank_in_dataset,
  c.lead_streams,
  c.all_credit_streams
FROM artist_stream_current c
JOIN artists a ON a.id = c.artist_id
WHERE c.currently_ranked = true
  AND a.is_disabled = false
  AND c.lead_streams IS NOT NULL
  AND c.all_credit_streams IS NOT NULL;
```

Overall mode:

```txt
compare all_credit_streams
show all_credit_rank
```

Lead mode:

```txt
compare lead_streams
show lead_rank_in_dataset
```

Return stream totals as strings in JSON:

```ts
streams: artist.allCreditStreams.toString()
```

This avoids BigInt JSON serialization problems.

---

## Part 23 — Updated `/api/game/start`

Create:

```txt
src/app/api/game/start/route.ts
```

Responsibilities:

```txt
Validate mode.
Read latest successful import.
Pick left artist from current ranked pool.
Pick right artist from current ranked pool.
Create game session with dataset_source_date.
Return left artist with visible streams.
Return right artist with hidden streams.
```

Response:

```json
{
  "sessionId": "uuid",
  "mode": "overall",
  "datasetSourceDate": "2026-06-20",
  "leftArtist": {
    "id": "uuid",
    "name": "Drake",
    "imageUrl": "...",
    "streams": "136101479788",
    "rank": 1
  },
  "rightArtist": {
    "id": "uuid",
    "name": "Taylor Swift",
    "imageUrl": "...",
    "streamsHidden": true
  },
  "streak": 0
}
```

---

## Part 24 — Updated `/api/game/guess`

Create:

```txt
src/app/api/game/guess/route.ts
```

Responsibilities:

```txt
Validate request body.
Load active session.
Load left/right current stream values.
Compare based on mode.
Insert game round with frozen stream values.
Update session streak.
If correct, pick next artist.
If wrong, end session.
```

Comparison:

```ts
function getComparableStreams(
  mode: "overall" | "lead",
  artist: {
    allCreditStreams: bigint;
    leadStreams: bigint;
  },
) {
  return mode === "overall" ? artist.allCreditStreams : artist.leadStreams;
}
```

Correctness:

```ts
const leftStreams = getComparableStreams(mode, leftArtist);
const rightStreams = getComparableStreams(mode, rightArtist);

const isCorrect =
  (guess === "higher" && rightStreams > leftStreams) ||
  (guess === "lower" && rightStreams < leftStreams);
```

Freeze the result:

```txt
left_streams
right_streams
left_rank
right_rank
dataset_source_date
stream_gap
```

---

## Part 25 — Frontend Pages

Create or update:

```txt
src/app/page.tsx
src/app/play/page.tsx
src/app/play/overall/page.tsx
src/app/play/lead/page.tsx
src/app/leaderboard/page.tsx
src/app/about/page.tsx
```

Homepage copy:

```txt
StreamRace

Guess which artist has more total Spotify streams.

Not monthly listeners.
The all-time Spotify race.

Play Overall
Play Lead Streams
```

Mode descriptions:

```txt
Overall:
Lead + featured/non-lead streams.

Lead Streams:
Streams from the artist's own lead catalog only.
```

ChartMasters distinguishes lead streams from featured streams and explains that featured streams come from “Appears On” tracks.

---

## Part 26 — Admin Import Page

Create:

```txt
/admin/imports
```

Show:

```txt
Latest successful import
Latest failed/rejected import
Collection method
Rows found
Rows inserted
Rows updated
Dropouts
Re-entries
Anomalies
Source date
Current ranked artists
Playable artists
```

Example healthy state:

```txt
Status: success
Collection method: datatables_ajax
Source table: spotify_artists_all_credits
Rows found: 1000
Current ranked artists: 1000
Playable artists: 1000
Dropouts: 3
Re-entries: 2
Anomalies: 0
```

Example rejected state:

```txt
Status: rejected
Rows found: 25
Reason: STATIC_HTML_ONLY_25_ROWS
Game data was not updated.
```

---

## Part 27 — Daily Cron Endpoint

Create:

```txt
src/app/api/cron/daily-chartmasters-import/route.ts
```

Logic:

```txt
Check CRON_SECRET.
Check ENABLE_CRON.
Fetch ChartMasters page HTML.
Extract table config.
Fetch all rows via DataTables Ajax.
Parse rows.
Validate rows.
Import rows.
Return import summary.
```

Response:

```json
{
  "ok": true,
  "source": "chartmasters",
  "sourceTable": "spotify_artists_all_credits",
  "collectionMethod": "datatables_ajax",
  "sourceDate": "2026-06-20",
  "rowsFound": 1000,
  "dropouts": 3,
  "reentries": 2
}
```

In `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-chartmasters-import",
      "schedule": "0 5 * * *"
    }
  ]
}
```

Use:

```env
ENABLE_CRON=true
```

Only where you want the cron to run.

---

## Part 28 — Game Difficulty With 1,000 Real Artists

Now that you have 1,000 artists, do not use pure random forever.

Use difficulty bands:

```txt
20% easy
40% medium
25% hard
15% chaos
```

Overall mode difficulty:

```txt
all_credit_streams
all_credit_rank
```

Lead mode difficulty:

```txt
lead_streams
lead_rank_in_dataset
```

Hard mode query idea:

```sql
SELECT
  a.id,
  a.display_name,
  c.all_credit_streams,
  abs(c.all_credit_streams - $1) AS stream_gap
FROM artist_stream_current c
JOIN artists a ON a.id = c.artist_id
WHERE c.currently_ranked = true
  AND a.is_disabled = false
  AND a.id <> $2
ORDER BY stream_gap ASC
LIMIT 50;
```

Then randomly choose one from those 50. That creates close “photo finish” comparisons.

---

## Part 29 — Leaderboard With Dataset Date

Because stream values update daily, leaderboard entries should show the dataset date.

Leaderboard filters:

```txt
Overall - all time
Lead - all time
Overall - today
Lead - today
```

Rows:

```txt
Rank
Player
Score
Mode
Dataset date
Played at
```

This keeps old scores valid even after tomorrow’s ChartMasters update changes stream totals.

---

## Part 30 — Updated About Page

Explain:

```txt
Overall mode uses all-credit streams.
Lead mode uses lead streams.
Featured/non-lead streams are included only in Overall mode.
Data source is the ChartMasters all-credit Spotify artist table.
The game uses the latest successful import.
Artists can enter, leave, and re-enter the top 1,000.
Monthly listeners are a temporary reach metric; total streams are cumulative race standings.
```

ChartMasters itself explains that monthly-listener discussion often causes confusion, while most-streamed artists are based on cumulative playcounts. The page also says its daily refreshed top-1,000 list focuses on long-term streaming trends rather than short-term fluctuations.

---

## Part 31 — New Build Order

Use this order now:

| Commit | What to build |
|---:|---|
| 1 | Add Drizzle, Neon, Cheerio, Zod, and env validation |
| 2 | Add expanded database schema |
| 3 | Generate and apply migration to development |
| 4 | Add Markdown parser for your full top-1,000 file |
| 5 | Add static HTML parser and reject-if-not-full validation |
| 6 | Add HTML table config extractor for `table_2` / table ID `82` |
| 7 | Add DataTables Ajax collector |
| 8 | Add shared `importAllCreditsRows` service |
| 9 | Import the full dataset into development |
| 10 | Add `/api/health/db` with latest import status |
| 11 | Replace default homepage and metadata |
| 12 | Add `/api/game/start` |
| 13 | Add `/api/game/guess` |
| 14 | Add `/play/overall` |
| 15 | Add `/play/lead` |
| 16 | Add game-over and streak logic |
| 17 | Add leaderboard |
| 18 | Add `/admin/imports` |
| 19 | Add cron endpoint |
| 20 | Add difficulty bands |

---

## Part 32 — Immediate Checklist

Do this next:

```txt
1. Add the expanded schema.
2. Run the first migration on development.
3. Import your full top-1,000 Markdown/table file into development.
4. Confirm artist_stream_current has 1,000 currently_ranked artists.
5. Add the static HTML parser and verify it returns only 25 rows from the saved HTML.
6. Add the DataTables config extractor and verify it detects tableWpId 82, tableId table_2, serverSide true, and the Ajax URL.
7. Add the DataTables Ajax collector.
8. Verify the Ajax collector returns around 1,000 rows.
9. Add dropout/re-entry logic.
10. Build the game APIs against artist_stream_current.
11. Build the frontend game.
12. Add admin import monitoring.
13. Add cron after manual import and Ajax import both work.
```

The final data flow should be:

```txt
ChartMasters page
  ↓
Find all-credit table heading
  ↓
Extract table_2_desc config
  ↓
Read Ajax URL for table_id=82
  ↓
Fetch DataTables pages with start/length
  ↓
Parse all 1,000 rows
  ↓
Validate ranks, IDs, stream sums
  ↓
Insert snapshots
  ↓
Update current stats
  ↓
Detect dropouts/re-entries
  ↓
Game uses latest current stats
```

The final mental model stays simple:

```txt
Snapshots are history.
Current stats are gameplay.
Artists are permanent.
Top-1,000 membership is temporary.
HTML visible rows are not enough.
DataTables Ajax is the real daily source.
```

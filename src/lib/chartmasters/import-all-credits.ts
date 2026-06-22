import { createHash } from "node:crypto";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { StreamRaceDb } from "../../db/client";
import {
  artists,
  artistStreamCurrent,
  artistStreamSnapshots,
  artistTop1000Periods,
  dataIngestionRuns,
  ingestionAnomalies,
  type ArtistStreamCurrent,
  type NewArtist,
  type NewArtistStreamCurrent,
  type NewArtistStreamSnapshot,
} from "../../db/schema";
import {
  addLeadRankInDataset,
  AllCreditsValidationError,
  validateFullAllCreditsRows,
} from "./validate-all-credits";
import {
  CHARTMASTERS_ALL_CREDITS_SOURCE_TABLE,
  CHARTMASTERS_ALL_CREDITS_SOURCE_URL,
  CHARTMASTERS_SOURCE_NAME,
  type ChartmastersCollectionMethod,
  type IngestionAnomalyInput,
  type ParsedAllCreditsRow,
  type ParsedAllCreditsRowWithLeadRank,
} from "./types";

type ImportTransaction = Parameters<Parameters<StreamRaceDb["transaction"]>[0]>[0];

type ImportCounters = {
  rowsInserted: number;
  rowsUpdated: number;
  rowsDroppedOut: number;
  rowsReentered: number;
};

type RowWithArtist = {
  row: ParsedAllCreditsRowWithLeadRank;
  artistId: string;
};

export type ImportAllCreditsRowsInput = {
  db: StreamRaceDb;
  rows: ParsedAllCreditsRow[];
  sourceDate: string;
  collectionMethod: ChartmastersCollectionMethod;
  sourceUrl?: string | null;
};

export type ImportAllCreditsRowsSummary = ImportCounters & {
  importRunId: string;
  status: "success";
  sourceDate: string;
  rowsFound: number;
  anomaliesCount: number;
};

const sourceDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  (value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  },
  { message: "Source date must be a real date in YYYY-MM-DD format." },
);

export function parseSourceDate(value: string) {
  return sourceDateSchema.parse(value);
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeArtistName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function getChartmastersArtistKey(row: ParsedAllCreditsRow) {
  if (row.spotifyArtistId) {
    return `spotify:${row.spotifyArtistId}`;
  }

  if (row.chartmastersUrl) {
    return `chartmasters:${row.chartmastersUrl}`;
  }

  return `name:${normalizeArtistName(row.artistName)}`;
}

function createRowHash(row: ParsedAllCreditsRowWithLeadRank) {
  return createHash("sha256")
    .update(
      [
        row.allCreditRank,
        row.rawGRank ?? "",
        row.leadRankInDataset,
        row.artistName,
        row.spotifyArtistId ?? "",
        row.chartmastersUrl ?? "",
        row.leadStreams.toString(),
        row.nonLeadStreams.toString(),
        row.allCreditStreams.toString(),
      ].join("|"),
    )
    .digest("hex");
}

function rankChange(previousRank: number | null, currentRank: number) {
  return previousRank === null ? null : previousRank - currentRank;
}

function streamGain(previousStreams: bigint | null, currentStreams: bigint) {
  return previousStreams === null ? null : currentStreams - previousStreams;
}

function excluded(columnName: string) {
  return sql.raw(`excluded.${columnName}`);
}

async function createImportRun({
  db,
  collectionMethod,
  rowsFound,
  sourceDate,
  sourceUrl,
}: {
  db: StreamRaceDb;
  collectionMethod: ChartmastersCollectionMethod;
  rowsFound: number;
  sourceDate: string;
  sourceUrl: string | null;
}) {
  const [run] = await db
    .insert(dataIngestionRuns)
    .values({
      sourceName: CHARTMASTERS_SOURCE_NAME,
      sourceTable: CHARTMASTERS_ALL_CREDITS_SOURCE_TABLE,
      sourceUrl,
      sourceDate,
      status: "running",
      collectionMethod,
      rowsFound,
    })
    .returning();

  return run;
}

async function recordAnomalies({
  db,
  importRunId,
  anomalies,
}: {
  db: StreamRaceDb;
  importRunId: string;
  anomalies: IngestionAnomalyInput[];
}) {
  await db.insert(ingestionAnomalies).values(
    anomalies.map((anomaly) => ({
      importRunId,
      severity: anomaly.severity,
      code: anomaly.code,
      rowNumber: anomaly.rowNumber,
      artistName: anomaly.artistName,
      message: anomaly.message,
      rawValue: anomaly.rawValue,
    })),
  );
}

async function rejectImportRun({
  db,
  importRunId,
  anomalies,
}: {
  db: StreamRaceDb;
  importRunId: string;
  anomalies: IngestionAnomalyInput[];
}) {
  await recordAnomalies({ db, importRunId, anomalies });

  await db
    .update(dataIngestionRuns)
    .set({
      status: "rejected",
      anomaliesCount: anomalies.length,
      errorMessage: "ChartMasters import validation failed.",
      finishedAt: sql`now()`,
    })
    .where(eq(dataIngestionRuns.id, importRunId));
}

async function failImportRun({
  db,
  importRunId,
  error,
}: {
  db: StreamRaceDb;
  importRunId: string;
  error: unknown;
}) {
  await db
    .update(dataIngestionRuns)
    .set({
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
      finishedAt: sql`now()`,
    })
    .where(eq(dataIngestionRuns.id, importRunId));
}

function toArtistInsert(row: ParsedAllCreditsRowWithLeadRank): NewArtist {
  return {
    spotifyArtistId: row.spotifyArtistId,
    chartmastersArtistKey: getChartmastersArtistKey(row),
    displayName: row.artistName,
    chartmastersName: row.artistName,
    normalizedName: normalizeArtistName(row.artistName),
    chartmastersUrl: row.chartmastersUrl,
    imageUrl: row.imageUrl ?? null,
    gender: row.gender ?? null,
    language: row.language ?? null,
    genre: row.genre ?? null,
    country: row.country ?? null,
  };
}

async function upsertArtists(
  tx: ImportTransaction,
  rows: ParsedAllCreditsRowWithLeadRank[],
) {
  const upsertedArtists = await tx
    .insert(artists)
    .values(rows.map(toArtistInsert))
    .onConflictDoUpdate({
      target: artists.chartmastersArtistKey,
      set: {
        spotifyArtistId: excluded("spotify_artist_id"),
        chartmastersName: excluded("chartmasters_name"),
        normalizedName: excluded("normalized_name"),
        chartmastersUrl: excluded("chartmasters_url"),
        imageUrl: excluded("image_url"),
        gender: excluded("gender"),
        language: excluded("language"),
        genre: excluded("genre"),
        country: excluded("country"),
        updatedAt: sql`now()`,
      },
    })
    .returning({
      id: artists.id,
      chartmastersArtistKey: artists.chartmastersArtistKey,
    });
  const idByArtistKey = new Map(
    upsertedArtists.map((artist) => [
      artist.chartmastersArtistKey,
      artist.id,
    ]),
  );

  return rows.map((row) => {
    const artistId = idByArtistKey.get(getChartmastersArtistKey(row));

    if (!artistId) {
      throw new Error(`Could not resolve artist ID for ${row.artistName}.`);
    }

    return { row, artistId };
  });
}

function toSnapshotInsert({
  importRunId,
  artistId,
  sourceDate,
  row,
}: {
  importRunId: string;
  artistId: string;
  sourceDate: string;
  row: ParsedAllCreditsRowWithLeadRank;
}): NewArtistStreamSnapshot {
  return {
    importRunId,
    artistId,
    sourceDate,
    sourceName: CHARTMASTERS_SOURCE_NAME,
    sourceTable: CHARTMASTERS_ALL_CREDITS_SOURCE_TABLE,
    allCreditRank: row.allCreditRank,
    rawGRank: row.rawGRank,
    leadRankInDataset: row.leadRankInDataset,
    leadStreams: row.leadStreams,
    nonLeadStreams: row.nonLeadStreams,
    allCreditStreams: row.allCreditStreams,
    rawArtistName: row.artistName,
    rawArtistUrl: row.chartmastersUrl,
    rawImageUrl: row.imageUrl ?? null,
    rawDataFreshnessLabel: row.dataFreshnessLabel ?? null,
    gender: row.gender ?? null,
    language: row.language ?? null,
    genre: row.genre ?? null,
    country: row.country ?? null,
    rowHash: createRowHash(row),
  };
}

async function upsertSnapshots({
  tx,
  importRunId,
  sourceDate,
  rowsWithArtists,
}: {
  tx: ImportTransaction;
  importRunId: string;
  sourceDate: string;
  rowsWithArtists: RowWithArtist[];
}) {
  const snapshots = await tx
    .insert(artistStreamSnapshots)
    .values(
      rowsWithArtists.map(({ row, artistId }) =>
        toSnapshotInsert({ importRunId, artistId, sourceDate, row }),
      ),
    )
    .onConflictDoUpdate({
      target: [
        artistStreamSnapshots.artistId,
        artistStreamSnapshots.sourceDate,
        artistStreamSnapshots.sourceTable,
      ],
      set: {
        importRunId: excluded("import_run_id"),
        sourceName: excluded("source_name"),
        allCreditRank: excluded("all_credit_rank"),
        rawGRank: excluded("raw_g_rank"),
        leadRankInDataset: excluded("lead_rank_in_dataset"),
        leadStreams: excluded("lead_streams"),
        nonLeadStreams: excluded("non_lead_streams"),
        allCreditStreams: excluded("all_credit_streams"),
        rawArtistName: excluded("raw_artist_name"),
        rawArtistUrl: excluded("raw_artist_url"),
        rawImageUrl: excluded("raw_image_url"),
        rawDataFreshnessLabel: excluded("raw_data_freshness_label"),
        gender: excluded("gender"),
        language: excluded("language"),
        genre: excluded("genre"),
        country: excluded("country"),
        rowHash: excluded("row_hash"),
      },
    })
    .returning({
      id: artistStreamSnapshots.id,
      artistId: artistStreamSnapshots.artistId,
    });

  return new Map(
    snapshots.map((snapshot) => [snapshot.artistId, snapshot.id] as const),
  );
}

function toCurrentInsert({
  artistId,
  latestSnapshotId,
  previousCurrent,
  row,
  sourceDate,
}: {
  artistId: string;
  latestSnapshotId: string;
  previousCurrent: ArtistStreamCurrent | undefined;
  row: ParsedAllCreditsRowWithLeadRank;
  sourceDate: string;
}): NewArtistStreamCurrent {
  const previousAllCreditRank = previousCurrent?.allCreditRank ?? null;
  const previousLeadRankInDataset =
    previousCurrent?.leadRankInDataset ?? null;
  const previousRawGRank = previousCurrent?.rawGRank ?? null;
  const previousLeadStreams = previousCurrent?.leadStreams ?? null;
  const previousNonLeadStreams = previousCurrent?.nonLeadStreams ?? null;
  const previousAllCreditStreams =
    previousCurrent?.allCreditStreams ?? null;

  return {
    artistId,
    latestSnapshotId,
    sourceDate,
    currentlyRanked: true,
    status: "active",
    firstSeenOn: previousCurrent?.firstSeenOn ?? sourceDate,
    lastSeenOn: sourceDate,
    droppedOutOn: previousCurrent?.droppedOutOn ?? null,
    reenteredOn:
      previousCurrent && !previousCurrent.currentlyRanked
        ? sourceDate
        : (previousCurrent?.reenteredOn ?? null),
    allCreditRank: row.allCreditRank,
    previousAllCreditRank,
    allCreditRankChange: rankChange(previousAllCreditRank, row.allCreditRank),
    leadRankInDataset: row.leadRankInDataset,
    previousLeadRankInDataset,
    leadRankChangeInDataset: rankChange(
      previousLeadRankInDataset,
      row.leadRankInDataset,
    ),
    rawGRank: row.rawGRank,
    previousRawGRank,
    rawGRankChange:
      row.rawGRank === null ? null : rankChange(previousRawGRank, row.rawGRank),
    leadStreams: row.leadStreams,
    previousLeadStreams,
    leadDailyGain: streamGain(previousLeadStreams, row.leadStreams),
    nonLeadStreams: row.nonLeadStreams,
    previousNonLeadStreams,
    nonLeadDailyGain: streamGain(previousNonLeadStreams, row.nonLeadStreams),
    allCreditStreams: row.allCreditStreams,
    previousAllCreditStreams,
    allCreditDailyGain: streamGain(
      previousAllCreditStreams,
      row.allCreditStreams,
    ),
  };
}

function currentConflictSet() {
  return {
    latestSnapshotId: excluded("latest_snapshot_id"),
    sourceDate: excluded("source_date"),
    currentlyRanked: excluded("currently_ranked"),
    status: excluded("status"),
    firstSeenOn: excluded("first_seen_on"),
    lastSeenOn: excluded("last_seen_on"),
    droppedOutOn: excluded("dropped_out_on"),
    reenteredOn: excluded("reentered_on"),
    allCreditRank: excluded("all_credit_rank"),
    previousAllCreditRank: excluded("previous_all_credit_rank"),
    allCreditRankChange: excluded("all_credit_rank_change"),
    leadRankInDataset: excluded("lead_rank_in_dataset"),
    previousLeadRankInDataset: excluded("previous_lead_rank_in_dataset"),
    leadRankChangeInDataset: excluded("lead_rank_change_in_dataset"),
    rawGRank: excluded("raw_g_rank"),
    previousRawGRank: excluded("previous_raw_g_rank"),
    rawGRankChange: excluded("raw_g_rank_change"),
    leadStreams: excluded("lead_streams"),
    previousLeadStreams: excluded("previous_lead_streams"),
    leadDailyGain: excluded("lead_daily_gain"),
    nonLeadStreams: excluded("non_lead_streams"),
    previousNonLeadStreams: excluded("previous_non_lead_streams"),
    nonLeadDailyGain: excluded("non_lead_daily_gain"),
    allCreditStreams: excluded("all_credit_streams"),
    previousAllCreditStreams: excluded("previous_all_credit_streams"),
    allCreditDailyGain: excluded("all_credit_daily_gain"),
    updatedAt: sql`now()`,
  };
}

async function updateCurrentRows({
  tx,
  rowsWithArtists,
  snapshotIdByArtistId,
  sourceDate,
}: {
  tx: ImportTransaction;
  rowsWithArtists: RowWithArtist[];
  snapshotIdByArtistId: Map<string, string>;
  sourceDate: string;
}) {
  const artistIds = rowsWithArtists.map(({ artistId }) => artistId);
  const previousCurrents = await tx
    .select()
    .from(artistStreamCurrent)
    .where(inArray(artistStreamCurrent.artistId, artistIds));
  const previousCurrentByArtistId = new Map(
    previousCurrents.map((current) => [current.artistId, current] as const),
  );
  const currentRows = rowsWithArtists.map(({ artistId, row }) => {
    const latestSnapshotId = snapshotIdByArtistId.get(artistId);

    if (!latestSnapshotId) {
      throw new Error(`Could not resolve snapshot ID for ${row.artistName}.`);
    }

    return toCurrentInsert({
      artistId,
      latestSnapshotId,
      previousCurrent: previousCurrentByArtistId.get(artistId),
      row,
      sourceDate,
    });
  });

  await tx
    .insert(artistStreamCurrent)
    .values(currentRows)
    .onConflictDoUpdate({
      target: artistStreamCurrent.artistId,
      set: currentConflictSet(),
    });

  return previousCurrentByArtistId;
}

async function openOrMaintainTop1000Periods({
  tx,
  rowsWithArtists,
  sourceDate,
}: {
  tx: ImportTransaction;
  rowsWithArtists: RowWithArtist[];
  sourceDate: string;
}) {
  const artistIds = rowsWithArtists.map(({ artistId }) => artistId);
  const openPeriods = await tx
    .select({ artistId: artistTop1000Periods.artistId })
    .from(artistTop1000Periods)
    .where(
      and(
        inArray(artistTop1000Periods.artistId, artistIds),
        eq(artistTop1000Periods.isOpen, true),
      ),
    );
  const openArtistIds = openPeriods.map((period) => period.artistId);
  const openArtistIdSet = new Set(openArtistIds);
  const newPeriodRows = rowsWithArtists
    .filter(({ artistId }) => !openArtistIdSet.has(artistId))
    .map(({ artistId, row }) => ({
      artistId,
      enteredOn: sourceDate,
      entryAllCreditRank: row.allCreditRank,
      isOpen: true,
    }));

  if (openArtistIds.length > 0) {
    await tx
      .update(artistTop1000Periods)
      .set({ updatedAt: sql`now()` })
      .where(
        and(
          inArray(artistTop1000Periods.artistId, openArtistIds),
          eq(artistTop1000Periods.isOpen, true),
        ),
      );
  }

  if (newPeriodRows.length > 0) {
    await tx.insert(artistTop1000Periods).values(newPeriodRows);
  }
}

async function markDropouts({
  tx,
  todayArtistIds,
  sourceDate,
}: {
  tx: ImportTransaction;
  todayArtistIds: string[];
  sourceDate: string;
}) {
  if (todayArtistIds.length === 0) {
    return 0;
  }

  const dropouts = await tx
    .select({
      artistId: artistStreamCurrent.artistId,
      exitAllCreditRank: artistStreamCurrent.allCreditRank,
    })
    .from(artistStreamCurrent)
    .where(
      and(
        eq(artistStreamCurrent.currentlyRanked, true),
        notInArray(artistStreamCurrent.artistId, todayArtistIds),
      ),
    );

  if (dropouts.length === 0) {
    return 0;
  }

  const dropoutArtistIds = dropouts.map((dropout) => dropout.artistId);

  await tx
    .update(artistStreamCurrent)
    .set({
      currentlyRanked: false,
      status: "dropped_out",
      droppedOutOn: sourceDate,
      allCreditRank: null,
      leadRankInDataset: null,
      rawGRank: null,
      updatedAt: sql`now()`,
    })
    .where(inArray(artistStreamCurrent.artistId, dropoutArtistIds));

  for (const dropout of dropouts) {
    await tx
      .update(artistTop1000Periods)
      .set({
        exitedOn: sourceDate,
        exitAllCreditRank: dropout.exitAllCreditRank,
        isOpen: false,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(artistTop1000Periods.artistId, dropout.artistId),
          eq(artistTop1000Periods.isOpen, true),
        ),
      );
  }

  return dropouts.length;
}

export async function importAllCreditsRows({
  db,
  rows,
  sourceDate,
  collectionMethod,
  sourceUrl = CHARTMASTERS_ALL_CREDITS_SOURCE_URL,
}: ImportAllCreditsRowsInput): Promise<ImportAllCreditsRowsSummary> {
  const parsedSourceDate = parseSourceDate(sourceDate);
  const importRun = await createImportRun({
    db,
    collectionMethod,
    rowsFound: rows.length,
    sourceDate: parsedSourceDate,
    sourceUrl,
  });

  try {
    validateFullAllCreditsRows(rows);
  } catch (error) {
    if (error instanceof AllCreditsValidationError) {
      await rejectImportRun({
        db,
        importRunId: importRun.id,
        anomalies: error.anomalies,
      });
    }

    throw error;
  }

  const rowsWithLeadRank = addLeadRankInDataset(rows);

  try {
    return await db.transaction(async (tx) => {
      const rowsWithArtists = await upsertArtists(tx, rowsWithLeadRank);
      const snapshotIdByArtistId = await upsertSnapshots({
        tx,
        importRunId: importRun.id,
        sourceDate: parsedSourceDate,
        rowsWithArtists,
      });
      const previousCurrentByArtistId = await updateCurrentRows({
        tx,
        rowsWithArtists,
        snapshotIdByArtistId,
        sourceDate: parsedSourceDate,
      });
      const counters: ImportCounters = rowsWithArtists.reduce(
        (nextCounters, { artistId }) => {
          const previousCurrent = previousCurrentByArtistId.get(artistId);

          if (previousCurrent) {
            nextCounters.rowsUpdated += 1;
          } else {
            nextCounters.rowsInserted += 1;
          }

          if (previousCurrent && !previousCurrent.currentlyRanked) {
            nextCounters.rowsReentered += 1;
          }

          return nextCounters;
        },
        {
          rowsInserted: 0,
          rowsUpdated: 0,
          rowsDroppedOut: 0,
          rowsReentered: 0,
        },
      );

      await openOrMaintainTop1000Periods({
        tx,
        rowsWithArtists,
        sourceDate: parsedSourceDate,
      });

      counters.rowsDroppedOut = await markDropouts({
        tx,
        todayArtistIds: rowsWithArtists.map(({ artistId }) => artistId),
        sourceDate: parsedSourceDate,
      });

      await tx
        .update(dataIngestionRuns)
        .set({
          status: "success",
          rowsFound: rowsWithLeadRank.length,
          rowsInserted: counters.rowsInserted,
          rowsUpdated: counters.rowsUpdated,
          rowsDroppedOut: counters.rowsDroppedOut,
          rowsReentered: counters.rowsReentered,
          anomaliesCount: 0,
          errorMessage: null,
          finishedAt: sql`now()`,
        })
        .where(eq(dataIngestionRuns.id, importRun.id));

      return {
        importRunId: importRun.id,
        status: "success",
        sourceDate: parsedSourceDate,
        rowsFound: rowsWithLeadRank.length,
        anomaliesCount: 0,
        ...counters,
      };
    });
  } catch (error) {
    await failImportRun({ db, importRunId: importRun.id, error });
    throw error;
  }
}

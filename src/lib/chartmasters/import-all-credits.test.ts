import { describe, expect, it } from "vitest";

import type { StreamRaceDb } from "../../db/client";
import {
  artists,
  artistStreamCurrent,
  artistStreamSnapshots,
  artistTop1000Periods,
  dataIngestionRuns,
  ingestionAnomalies,
} from "../../db/schema";
import type { ParsedAllCreditsRow } from "./types";
import {
  getLocalDateString,
  importAllCreditsRows,
  parseSourceDate,
} from "./import-all-credits";
import { AllCreditsValidationError } from "./validate-all-credits";

type TableKey =
  | "artists"
  | "artistStreamCurrent"
  | "artistStreamSnapshots"
  | "artistTop1000Periods"
  | "dataIngestionRuns"
  | "ingestionAnomalies"
  | "unknown";

type InsertRecord = {
  table: TableKey;
  values: unknown;
};

type UpdateRecord = {
  table: TableKey;
  set: Record<string, unknown>;
};

type PreviousCurrent = {
  artistId: string;
  currentlyRanked: boolean;
  allCreditRank: number | null;
  leadRankInDataset: number | null;
  rawGRank: number | null;
  leadStreams: bigint | null;
  nonLeadStreams: bigint | null;
  allCreditStreams: bigint | null;
  firstSeenOn: string | null;
  droppedOutOn: string | null;
  reenteredOn: string | null;
};

function tableKey(table: unknown): TableKey {
  if (table === artists) return "artists";
  if (table === artistStreamCurrent) return "artistStreamCurrent";
  if (table === artistStreamSnapshots) return "artistStreamSnapshots";
  if (table === artistTop1000Periods) return "artistTop1000Periods";
  if (table === dataIngestionRuns) return "dataIngestionRuns";
  if (table === ingestionAnomalies) return "ingestionAnomalies";
  return "unknown";
}

function toRecords(value: unknown) {
  return (Array.isArray(value) ? value : [value]) as Record<string, unknown>[];
}

function makeRow(
  rank: number,
  overrides: Partial<ParsedAllCreditsRow> = {},
): ParsedAllCreditsRow {
  const leadStreams = BigInt(1_000_000 - rank);
  const nonLeadStreams = BigInt(rank);

  return {
    allCreditRank: rank,
    rawGRank: rank,
    artistName: `Artist ${rank}`,
    spotifyArtistId: `spotify-${rank}`,
    chartmastersUrl: `https://chartmasters.test/${rank}`,
    imageUrl: `https://images.test/${rank}.jpg`,
    leadStreams,
    nonLeadStreams,
    allCreditStreams: leadStreams + nonLeadStreams,
    dataFreshnessLabel: null,
    gender: null,
    language: null,
    genre: null,
    country: null,
    ...overrides,
  };
}

function makeRows() {
  const rows = Array.from({ length: 900 }, (_, index) => makeRow(index + 1));
  rows[0] = makeRow(1, {
    artistName: "  First   Artist  ",
    gender: "group",
    language: "English",
    genre: "Pop",
    country: "US",
    leadStreams: BigInt(2_000_000),
    nonLeadStreams: BigInt(100),
    allCreditStreams: BigInt(2_000_100),
  });
  rows[1] = makeRow(2, {
    spotifyArtistId: null,
    chartmastersUrl: "https://chartmasters.test/chartmasters-key",
  });
  rows[2] = makeRow(3, {
    rawGRank: null,
    spotifyArtistId: null,
    chartmastersUrl: null,
  });

  return rows;
}

function createFakeDb({
  previousCurrents = [],
  openPeriods = [],
  dropouts = [],
  transactionError,
  omitArtistKey,
  omitSnapshotForArtistId,
}: {
  previousCurrents?: PreviousCurrent[];
  openPeriods?: { artistId: string }[];
  dropouts?: { artistId: string; exitAllCreditRank: number | null }[];
  transactionError?: Error;
  omitArtistKey?: string;
  omitSnapshotForArtistId?: string;
} = {}) {
  const inserts: InsertRecord[] = [];
  const updates: UpdateRecord[] = [];
  let currentSelectCount = 0;

  function insert(table: unknown) {
    const key = tableKey(table);
    let storedValues: unknown;
    const builder = {
      values(values: unknown) {
        storedValues = values;
        inserts.push({ table: key, values });
        return builder;
      },
      onConflictDoUpdate() {
        return builder;
      },
      returning() {
        const records = toRecords(storedValues);

        if (key === "dataIngestionRuns") {
          return Promise.resolve([{ id: "run-1", ...records[0] }]);
        }

        if (key === "artists") {
          return Promise.resolve(
            records
              .filter((record) => record.chartmastersArtistKey !== omitArtistKey)
              .map((record, index) => ({
                id: `artist-${index + 1}`,
                chartmastersArtistKey: record.chartmastersArtistKey,
              })),
          );
        }

        if (key === "artistStreamSnapshots") {
          return Promise.resolve(
            records
              .filter((record) => record.artistId !== omitSnapshotForArtistId)
              .map((record) => ({
                id: `snapshot-${String(record.artistId)}`,
                artistId: record.artistId,
              })),
          );
        }

        return Promise.resolve([]);
      },
    };

    return builder;
  }

  function update(table: unknown) {
    const key = tableKey(table);
    const builder = {
      set(values: Record<string, unknown>) {
        updates.push({ table: key, set: values });
        return builder;
      },
      where() {
        return Promise.resolve([]);
      },
    };

    return builder;
  }

  function select() {
    let key: TableKey = "unknown";
    const builder = {
      from(table: unknown) {
        key = tableKey(table);
        return builder;
      },
      where() {
        if (key === "artistStreamCurrent") {
          currentSelectCount += 1;
          return Promise.resolve(
            currentSelectCount === 1 ? previousCurrents : dropouts,
          );
        }

        if (key === "artistTop1000Periods") {
          return Promise.resolve(openPeriods);
        }

        return Promise.resolve([]);
      },
    };

    return builder;
  }

  const tx = { insert, update, select };
  const db = {
    ...tx,
    transaction: async (callback: (transaction: typeof tx) => unknown) => {
      if (transactionError) throw transactionError;
      return callback(tx);
    },
  } as unknown as StreamRaceDb;

  return { db, inserts, updates };
}

describe("import-all-credits date helpers", () => {
  it("parses real source dates and rejects impossible dates", () => {
    expect(parseSourceDate("2026-06-22")).toBe("2026-06-22");
    expect(() => parseSourceDate("2026-02-31")).toThrow(
      "Source date must be a real date",
    );
  });

  it("formats local dates as YYYY-MM-DD", () => {
    expect(getLocalDateString(new Date(2026, 5, 2))).toBe("2026-06-02");
  });
});

describe("importAllCreditsRows", () => {
  it("imports valid rows and records insert, update, reentry, and dropout counts", async () => {
    const fake = createFakeDb({
      previousCurrents: [
        {
          artistId: "artist-1",
          currentlyRanked: true,
          allCreditRank: 5,
          leadRankInDataset: 5,
          rawGRank: 10,
          leadStreams: BigInt(1_000_000),
          nonLeadStreams: BigInt(20),
          allCreditStreams: BigInt(1_000_020),
          firstSeenOn: "2026-06-01",
          droppedOutOn: null,
          reenteredOn: null,
        },
        {
          artistId: "artist-2",
          currentlyRanked: false,
          allCreditRank: 1001,
          leadRankInDataset: 1001,
          rawGRank: null,
          leadStreams: BigInt(100),
          nonLeadStreams: BigInt(10),
          allCreditStreams: BigInt(110),
          firstSeenOn: "2026-05-01",
          droppedOutOn: "2026-06-10",
          reenteredOn: null,
        },
      ],
      openPeriods: [{ artistId: "artist-1" }],
      dropouts: [{ artistId: "dropout-1", exitAllCreditRank: 1000 }],
    });

    await expect(
      importAllCreditsRows({
        db: fake.db,
        rows: makeRows(),
        sourceDate: "2026-06-22",
        collectionMethod: "markdown",
        sourceUrl: null,
      }),
    ).resolves.toMatchObject({
      importRunId: "run-1",
      status: "success",
      sourceDate: "2026-06-22",
      rowsFound: 900,
      rowsInserted: 898,
      rowsUpdated: 2,
      rowsDroppedOut: 1,
      rowsReentered: 1,
      anomaliesCount: 0,
    });

    const artistRows = toRecords(
      fake.inserts.find((inserted) => inserted.table === "artists")?.values,
    );
    expect(artistRows[0]).toMatchObject({
      chartmastersArtistKey: "spotify:spotify-1",
      displayName: "  First   Artist  ",
      normalizedName: "first artist",
      gender: "group",
      country: "US",
    });
    expect(artistRows[1].chartmastersArtistKey).toBe(
      "chartmasters:https://chartmasters.test/chartmasters-key",
    );
    expect(artistRows[2].chartmastersArtistKey).toBe("name:artist 3");

    const snapshotRows = toRecords(
      fake.inserts.find(
        (inserted) => inserted.table === "artistStreamSnapshots",
      )?.values,
    );
    expect(snapshotRows[0]).toMatchObject({
      importRunId: "run-1",
      artistId: "artist-1",
      sourceDate: "2026-06-22",
      allCreditRank: 1,
      rawDataFreshnessLabel: null,
    });
    expect(String(snapshotRows[0].rowHash)).toHaveLength(64);

    const currentRows = toRecords(
      fake.inserts.find((inserted) => inserted.table === "artistStreamCurrent")
        ?.values,
    );
    expect(currentRows[0]).toMatchObject({
      artistId: "artist-1",
      firstSeenOn: "2026-06-01",
      allCreditRankChange: 4,
      rawGRankChange: 9,
      leadDailyGain: BigInt(1_000_000),
    });
    expect(currentRows[1]).toMatchObject({
      artistId: "artist-2",
      reenteredOn: "2026-06-22",
    });

    expect(
      fake.inserts.find((inserted) => inserted.table === "artistTop1000Periods"),
    ).toBeDefined();
    expect(
      fake.updates.filter((updated) => updated.table === "dataIngestionRuns").at(-1)
        ?.set,
    ).toMatchObject({ status: "success", rowsDroppedOut: 1 });
  });

  it("records validation anomalies and rejects bad imports", async () => {
    const fake = createFakeDb();

    await expect(
      importAllCreditsRows({
        db: fake.db,
        rows: [makeRow(1, { allCreditStreams: BigInt(1) })],
        sourceDate: "2026-06-22",
        collectionMethod: "markdown",
      }),
    ).rejects.toBeInstanceOf(AllCreditsValidationError);

    const anomalyRows = toRecords(
      fake.inserts.find((inserted) => inserted.table === "ingestionAnomalies")
        ?.values,
    );
    expect(anomalyRows.map((row) => row.code)).toEqual(
      expect.arrayContaining(["ROW_COUNT_TOO_LOW", "STREAM_SUM_MISMATCH"]),
    );
    expect(
      fake.updates.find((updated) => updated.table === "dataIngestionRuns")?.set,
    ).toMatchObject({ status: "rejected", anomaliesCount: anomalyRows.length });
  });

  it("imports valid rows when there are no previous dropouts", async () => {
    const fake = createFakeDb();

    await expect(
      importAllCreditsRows({
        db: fake.db,
        rows: makeRows(),
        sourceDate: "2026-06-22",
        collectionMethod: "static_html",
      }),
    ).resolves.toMatchObject({
      rowsDroppedOut: 0,
      rowsInserted: 900,
      rowsUpdated: 0,
      rowsReentered: 0,
    });

    expect(
      fake.updates.filter((updated) => updated.table === "dataIngestionRuns").at(-1)
        ?.set,
    ).toMatchObject({ status: "success", rowsDroppedOut: 0 });
  });

  it("fails the import when a snapshot ID cannot be resolved", async () => {
    const fake = createFakeDb({ omitSnapshotForArtistId: "artist-1" });

    await expect(
      importAllCreditsRows({
        db: fake.db,
        rows: makeRows(),
        sourceDate: "2026-06-22",
        collectionMethod: "markdown",
      }),
    ).rejects.toThrow("Could not resolve snapshot ID for");

    expect(
      fake.updates.find((updated) => updated.table === "dataIngestionRuns")?.set,
    ).toMatchObject({
      status: "failed",
      errorMessage: expect.stringContaining("Could not resolve snapshot ID"),
    });
  });

  it("fails the import when an artist ID cannot be resolved", async () => {
    const fake = createFakeDb({ omitArtistKey: "spotify:spotify-1" });

    await expect(
      importAllCreditsRows({
        db: fake.db,
        rows: makeRows(),
        sourceDate: "2026-06-22",
        collectionMethod: "markdown",
      }),
    ).rejects.toThrow("Could not resolve artist ID for");

    expect(
      fake.updates.find((updated) => updated.table === "dataIngestionRuns")?.set,
    ).toMatchObject({
      status: "failed",
      errorMessage: expect.stringContaining("Could not resolve artist ID"),
    });
  });

  it("marks the import run failed when the transaction throws", async () => {
    const fake = createFakeDb({ transactionError: new Error("boom") });

    await expect(
      importAllCreditsRows({
        db: fake.db,
        rows: makeRows(),
        sourceDate: "2026-06-22",
        collectionMethod: "datatables_ajax",
      }),
    ).rejects.toThrow("boom");

    expect(
      fake.updates.find((updated) => updated.table === "dataIngestionRuns")?.set,
    ).toMatchObject({
      status: "failed",
      errorMessage: "boom",
    });
  });
});

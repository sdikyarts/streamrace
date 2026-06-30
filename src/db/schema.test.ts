import { describe, expect, it } from "vitest";

import {
  artists,
  artistStreamCurrent,
  artistStreamSnapshots,
  artistTop1000Periods,
  dataIngestionRuns,
  gameRounds,
  gameSessions,
  ingestionAnomalies,
  leaderboardEntries,
} from "./schema";

type DrizzleSymbolRecord = Record<symbol, unknown>;
type ForeignKey = {
  reference: () => {
    columns: unknown[];
    foreignColumns: unknown[];
  };
};

function getDrizzleSymbol(table: object, name: string) {
  const symbol = Object.getOwnPropertySymbols(table).find((candidate) =>
    String(candidate).includes(name),
  );

  expect(symbol).toBeDefined();

  return symbol as symbol;
}

function runExtraConfigBuilder(table: object) {
  const record = table as DrizzleSymbolRecord;
  const builder = record[getDrizzleSymbol(table, "ExtraConfigBuilder")];
  const columns = record[getDrizzleSymbol(table, "ExtraConfigColumns")];

  if (typeof builder !== "function") {
    return [];
  }

  return (builder as (columns: unknown) => unknown[])(columns);
}

function resolveForeignKeys(table: object) {
  const record = table as DrizzleSymbolRecord;
  const keys = record[getDrizzleSymbol(table, "PgInlineForeignKeys")];

  return (Array.isArray(keys) ? keys : []).map((key) =>
    (key as ForeignKey).reference(),
  );
}

describe("database schema", () => {
  it("exports the runtime table objects used by queries", () => {
    expect(artists.displayName).toBeDefined();
    expect(dataIngestionRuns.sourceName).toBeDefined();
    expect(artistStreamSnapshots.rowHash).toBeDefined();
    expect(artistStreamCurrent.currentlyRanked).toBeDefined();
    expect(artistTop1000Periods.isOpen).toBeDefined();
    expect(ingestionAnomalies.code).toBeDefined();
    expect(gameSessions.status).toBeDefined();
    expect(gameRounds.playerGuess).toBeDefined();
    expect(leaderboardEntries.score).toBeDefined();
  });

  it("builds declared indexes, unique constraints, and foreign-key references", () => {
    expect(runExtraConfigBuilder(artists)).toHaveLength(1);
    expect(runExtraConfigBuilder(artistStreamSnapshots)).toHaveLength(3);
    expect(runExtraConfigBuilder(artistStreamCurrent)).toHaveLength(3);
    expect(runExtraConfigBuilder(artistTop1000Periods)).toHaveLength(1);

    expect(resolveForeignKeys(artistStreamSnapshots)).toHaveLength(2);
    expect(resolveForeignKeys(artistStreamCurrent)).toHaveLength(2);
    expect(resolveForeignKeys(artistTop1000Periods)).toHaveLength(1);
    expect(resolveForeignKeys(ingestionAnomalies)).toHaveLength(1);
    expect(resolveForeignKeys(gameRounds)).toHaveLength(3);
    expect(resolveForeignKeys(leaderboardEntries)).toHaveLength(1);
  });
});

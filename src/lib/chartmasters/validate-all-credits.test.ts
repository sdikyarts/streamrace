import { describe, expect, it } from "vitest";

import type { ParsedAllCreditsRow } from "./types";
import {
  addLeadRankInDataset,
  AllCreditsValidationError,
  validateFullAllCreditsRows,
} from "./validate-all-credits";

function makeRow(rank: number, overrides: Partial<ParsedAllCreditsRow> = {}) {
  const leadStreams = BigInt(10_000 - rank);
  const nonLeadStreams = BigInt(rank);

  return {
    allCreditRank: rank,
    rawGRank: rank,
    artistName: `Artist ${rank}`,
    spotifyArtistId: `spotify-${rank}`,
    chartmastersUrl: `https://chartmasters.test/${rank}`,
    leadStreams,
    nonLeadStreams,
    allCreditStreams: leadStreams + nonLeadStreams,
    ...overrides,
  } satisfies ParsedAllCreditsRow;
}

function makeRows(count = 900) {
  return Array.from({ length: count }, (_, index) => makeRow(index + 1));
}

describe("validateFullAllCreditsRows", () => {
  it("accepts a complete valid ChartMasters dataset", () => {
    expect(() => validateFullAllCreditsRows(makeRows())).not.toThrow();
  });

  it("reports row count, rank, duplicate, Spotify, and stream anomalies", () => {
    const rows = makeRows();
    rows[0] = makeRow(0, { artistName: "Invalid Rank" });
    rows[1] = makeRow(3, { artistName: "Duplicate Rank" });
    rows[2] = makeRow(3, {
      artistName: "Duplicate Spotify",
      spotifyArtistId: rows[1].spotifyArtistId,
      allCreditStreams: BigInt(1),
    });

    expect(() => validateFullAllCreditsRows(rows)).toThrow(
      AllCreditsValidationError,
    );

    try {
      validateFullAllCreditsRows(rows);
    } catch (error) {
      expect(error).toBeInstanceOf(AllCreditsValidationError);
      const codes = (error as AllCreditsValidationError).anomalies.map(
        (anomaly) => anomaly.code,
      );

      expect(codes).toEqual(
        expect.arrayContaining([
          "INVALID_RANK",
          "DUPLICATE_RANK",
          "DUPLICATE_SPOTIFY_ID",
          "STREAM_SUM_MISMATCH",
        ]),
      );
    }
  });

  it("reports datasets below the required row count", () => {
    try {
      validateFullAllCreditsRows([makeRow(1)]);
    } catch (error) {
      expect(error).toBeInstanceOf(AllCreditsValidationError);
      expect((error as AllCreditsValidationError).anomalies[0]).toMatchObject({
        code: "ROW_COUNT_TOO_LOW",
        rawValue: "1",
      });
    }
  });
});

describe("addLeadRankInDataset", () => {
  it("ranks rows by lead streams with all-credit rank as the tie breaker", () => {
    const rows = [
      makeRow(2, {
        artistName: "No Spotify",
        spotifyArtistId: null,
        leadStreams: BigInt(500),
        nonLeadStreams: BigInt(1),
        allCreditStreams: BigInt(501),
      }),
      makeRow(1, {
        leadStreams: BigInt(500),
        nonLeadStreams: BigInt(2),
        allCreditStreams: BigInt(502),
      }),
      makeRow(3, {
        leadStreams: BigInt(700),
        nonLeadStreams: BigInt(3),
        allCreditStreams: BigInt(703),
      }),
    ];

    expect(addLeadRankInDataset(rows)).toMatchObject([
      { artistName: "No Spotify", leadRankInDataset: 3 },
      { artistName: "Artist 1", leadRankInDataset: 2 },
      { artistName: "Artist 3", leadRankInDataset: 1 },
    ]);
  });
});

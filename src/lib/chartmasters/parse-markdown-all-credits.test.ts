import { describe, expect, it } from "vitest";

import { parseMarkdownAllCredits } from "./parse-markdown-all-credits";

describe("parseMarkdownAllCredits", () => {
  it("parses linked artist rows and captures freshness metadata", () => {
    const rows = parseMarkdownAllCredits(`
| Rank | G Rank | Artist | Lead Streams | Feat Streams | All Credit Streams |
| --- | --- | --- | --- | --- | --- |
| 1 | 7 | [**A\\*B**](https://chartmasters.test/artist?artist_spotify_id=spotify-1) *recent data* | 1,000 | 250 | 1,250 |
    `);

    expect(rows).toEqual([
      expect.objectContaining({
        allCreditRank: 1,
        rawGRank: 7,
        artistName: "A*B",
        spotifyArtistId: "spotify-1",
        chartmastersUrl:
          "https://chartmasters.test/artist?artist_spotify_id=spotify-1",
        imageUrl: null,
        leadStreams: BigInt(1000),
        nonLeadStreams: BigInt(250),
        allCreditStreams: BigInt(1250),
        dataFreshnessLabel: "recent data",
      }),
    ]);
  });

  it("parses plain artist cells with invalid links as local rows", () => {
    const rows = parseMarkdownAllCredits(
      "| 2 | 8 | [Plain Artist](not a url) | 10 | 5 | 15 |",
    );

    expect(rows[0]).toMatchObject({
      artistName: "Plain Artist",
      spotifyArtistId: null,
      chartmastersUrl: "not a url",
      dataFreshnessLabel: null,
    });
  });

  it("ignores non-data rows and short table fragments", () => {
    expect(
      parseMarkdownAllCredits(`
not a table
| Rank | G Rank |
| 1 | 2 |
      `),
    ).toEqual([]);
  });

  it("rejects malformed rows", () => {
    expect(() =>
      parseMarkdownAllCredits("| 1 | 2 |  | 10 | 1 | 11 |"),
    ).toThrow("Malformed ChartMasters row");
  });

  it("parses blank G Rank cells as null rawGRank", () => {
    const rows = parseMarkdownAllCredits("| 1 |  | Artist | 10 | 1 | 11 |");

    expect(rows[0]).toMatchObject({ rawGRank: null, artistName: "Artist" });
  });

  it("captures freshness label from unlinked artist cells", () => {
    const rows = parseMarkdownAllCredits(
      "| 1 | 2 | Artist Name *recent data* | 10 | 1 | 11 |",
    );

    expect(rows[0]).toMatchObject({
      artistName: "Artist Name *recent data*",
      dataFreshnessLabel: "recent data",
      chartmastersUrl: null,
    });
  });

  it("rejects invalid rank and stream cells", () => {
    expect(() =>
      parseMarkdownAllCredits("| 1-2 | 1 | Artist | 10 | 1 | 11 |"),
    ).toThrow("Invalid integer value");

    expect(() =>
      parseMarkdownAllCredits("| 1 | 1 | Artist | nope | 1 | 11 |"),
    ).toThrow("Invalid stream value");
  });

  it("rejects rows whose artist name cleans down to empty text", () => {
    expect(() =>
      parseMarkdownAllCredits("| 1 | 1 | ** | 10 | 1 | 11 |"),
    ).toThrow("Missing artist name");
  });
});

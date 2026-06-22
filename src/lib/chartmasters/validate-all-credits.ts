import type {
  IngestionAnomalyInput,
  ParsedAllCreditsRow,
  ParsedAllCreditsRowWithLeadRank,
} from "./types";

export class AllCreditsValidationError extends Error {
  constructor(readonly anomalies: IngestionAnomalyInput[]) {
    super(
      `ChartMasters all-credit validation failed with ${anomalies.length} issue(s).`,
    );
    this.name = "AllCreditsValidationError";
  }
}

function rowLabel(index: number) {
  return index + 1;
}

export function validateFullAllCreditsRows(rows: ParsedAllCreditsRow[]) {
  const anomalies: IngestionAnomalyInput[] = [];
  const ranks = new Map<number, number>();
  const spotifyArtistIds = new Map<string, number>();

  if (rows.length < 900) {
    anomalies.push({
      severity: "error",
      code: "ROW_COUNT_TOO_LOW",
      message: `Parsed ${rows.length} rows; expected at least 900.`,
      rawValue: String(rows.length),
    });
  }

  rows.forEach((row, index) => {
    const rowNumber = rowLabel(index);

    if (!Number.isInteger(row.allCreditRank) || row.allCreditRank < 1) {
      anomalies.push({
        severity: "error",
        code: "INVALID_RANK",
        rowNumber,
        artistName: row.artistName,
        message: `Invalid all-credit rank: ${row.allCreditRank}.`,
        rawValue: String(row.allCreditRank),
      });
    }

    const existingRankRow = ranks.get(row.allCreditRank);

    if (existingRankRow === undefined) {
      ranks.set(row.allCreditRank, rowNumber);
    } else {
      anomalies.push({
        severity: "error",
        code: "DUPLICATE_RANK",
        rowNumber,
        artistName: row.artistName,
        message: `Duplicate all-credit rank ${row.allCreditRank}; first seen on parsed row ${existingRankRow}.`,
        rawValue: String(row.allCreditRank),
      });
    }

    if (row.spotifyArtistId) {
      const existingSpotifyIdRow = spotifyArtistIds.get(row.spotifyArtistId);

      if (existingSpotifyIdRow === undefined) {
        spotifyArtistIds.set(row.spotifyArtistId, rowNumber);
      } else {
        anomalies.push({
          severity: "error",
          code: "DUPLICATE_SPOTIFY_ID",
          rowNumber,
          artistName: row.artistName,
          message: `Duplicate Spotify artist ID ${row.spotifyArtistId}; first seen on parsed row ${existingSpotifyIdRow}.`,
          rawValue: row.spotifyArtistId,
        });
      }
    }

    if (row.leadStreams + row.nonLeadStreams !== row.allCreditStreams) {
      anomalies.push({
        severity: "error",
        code: "STREAM_SUM_MISMATCH",
        rowNumber,
        artistName: row.artistName,
        message:
          "Lead streams plus non-lead streams does not equal all-credit streams.",
        rawValue: `${row.leadStreams.toString()} + ${row.nonLeadStreams.toString()} != ${row.allCreditStreams.toString()}`,
      });
    }
  });

  if (anomalies.length > 0) {
    throw new AllCreditsValidationError(anomalies);
  }
}

function rowIdentity(row: ParsedAllCreditsRow) {
  return row.spotifyArtistId ?? row.artistName.toLowerCase();
}

export function addLeadRankInDataset(
  rows: ParsedAllCreditsRow[],
): ParsedAllCreditsRowWithLeadRank[] {
  const sortedRows = [...rows].sort((left, right) => {
    if (left.leadStreams === right.leadStreams) {
      return left.allCreditRank - right.allCreditRank;
    }

    return left.leadStreams > right.leadStreams ? -1 : 1;
  });
  const rankByIdentity = new Map<string, number>();

  sortedRows.forEach((row, index) => {
    rankByIdentity.set(rowIdentity(row), index + 1);
  });

  return rows.map((row) => ({
    ...row,
    leadRankInDataset: rankByIdentity.get(rowIdentity(row)) ?? 0,
  }));
}

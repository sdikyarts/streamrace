import type { ParsedAllCreditsRow } from "./types";

type ParsedArtistCell = {
  rawArtistName: string;
  chartmastersUrl: string | null;
  linkEndIndex: number | null;
};

function parseIntegerCell(value: string) {
  const cleaned = value.replaceAll(/[^\d-]/g, "");
  const parsed = Number(cleaned);

  if (!Number.isInteger(parsed)) {
    throw new TypeError(`Invalid integer value: ${value}`);
  }

  return parsed;
}

function parseStreamCell(value: string) {
  const cleaned = value.replaceAll(/[^\d]/g, "");

  if (!cleaned) {
    throw new Error(`Invalid stream value: ${value}`);
  }

  return BigInt(cleaned);
}

function cleanMarkdownText(value: string) {
  return value
    .replaceAll(/\\([#|_*[\]()])/g, "$1")
    .replaceAll("**", "")
    .trim();
}

function getSpotifyArtistId(chartmastersUrl: string | null) {
  if (!chartmastersUrl) {
    return null;
  }

  try {
    return new URL(chartmastersUrl).searchParams.get("artist_spotify_id");
  } catch {
    return null;
  }
}

function getDataFreshnessLabel(artistCell: string, linkEndIndex: number | null) {
  const metadataText =
    linkEndIndex === null ? artistCell : artistCell.slice(linkEndIndex);
  const freshnessMatch = /\*([^*]*data[^*]*)\*/i.exec(metadataText);

  return freshnessMatch?.[1]?.trim() ?? null;
}

function parseArtistCell(artistCell: string): ParsedArtistCell {
  const linkTextStart = artistCell.indexOf("[");
  const linkTextEnd = artistCell.indexOf("]", linkTextStart + 1);
  const linkUrlStart =
    linkTextEnd === -1 ? -1 : artistCell.indexOf("(", linkTextEnd + 1);
  const linkUrlEnd =
    linkUrlStart === -1 ? -1 : artistCell.indexOf(")", linkUrlStart + 1);

  if (
    linkTextStart === -1 ||
    linkTextEnd === -1 ||
    linkUrlStart !== linkTextEnd + 1 ||
    linkUrlEnd === -1
  ) {
    return {
      rawArtistName: artistCell,
      chartmastersUrl: null,
      linkEndIndex: null,
    };
  }

  return {
    rawArtistName: artistCell.slice(linkTextStart + 1, linkTextEnd),
    chartmastersUrl: artistCell.slice(linkUrlStart + 1, linkUrlEnd),
    linkEndIndex: linkUrlEnd + 1,
  };
}

function isDataRowLine(trimmed: string) {
  return (
    trimmed.startsWith("|") &&
    !trimmed.includes("---") &&
    !trimmed.includes("Lead Streams")
  );
}

function getMarkdownCells(trimmed: string) {
  return trimmed
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function parseAllCreditsRow(cells: string[], lineNumber: number) {
  const [rankCell, gRankCell, artistCell, leadCell, featCell, allCreditCell] =
    cells;

  if (!rankCell || !gRankCell || !artistCell || !leadCell || !featCell) {
    throw new Error(`Malformed ChartMasters row at line ${lineNumber}.`);
  }

  const allCreditRank = parseIntegerCell(rankCell);
  const rawGRank = gRankCell.trim() ? parseIntegerCell(gRankCell) : null;
  const { rawArtistName, chartmastersUrl, linkEndIndex } =
    parseArtistCell(artistCell);
  const artistName = cleanMarkdownText(rawArtistName);
  const spotifyArtistId = getSpotifyArtistId(chartmastersUrl);

  if (!artistName) {
    throw new Error(`Missing artist name at line ${lineNumber}.`);
  }

  return {
    allCreditRank,
    rawGRank,
    artistName,
    spotifyArtistId,
    chartmastersUrl,
    imageUrl: null,
    leadStreams: parseStreamCell(leadCell),
    nonLeadStreams: parseStreamCell(featCell),
    allCreditStreams: parseStreamCell(allCreditCell ?? ""),
    dataFreshnessLabel: getDataFreshnessLabel(artistCell, linkEndIndex),
  } satisfies ParsedAllCreditsRow;
}

export function parseMarkdownAllCredits(
  markdown: string,
): ParsedAllCreditsRow[] {
  const rows: ParsedAllCreditsRow[] = [];

  for (const [lineIndex, line] of markdown.split(/\r?\n/).entries()) {
    const trimmed = line.trim();

    if (!isDataRowLine(trimmed)) continue;

    const cells = getMarkdownCells(trimmed);

    if (cells.length < 6) continue;

    rows.push(parseAllCreditsRow(cells, lineIndex + 1));
  }

  return rows;
}

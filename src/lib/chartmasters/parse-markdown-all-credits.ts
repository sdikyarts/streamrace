import type { ParsedAllCreditsRow } from "./types";

function parseIntegerCell(value: string) {
  const cleaned = value.replace(/[^\d-]/g, "");
  const parsed = Number(cleaned);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid integer value: ${value}`);
  }

  return parsed;
}

function parseStreamCell(value: string) {
  const cleaned = value.replace(/[^\d]/g, "");

  if (!cleaned) {
    throw new Error(`Invalid stream value: ${value}`);
  }

  return BigInt(cleaned);
}

function cleanMarkdownText(value: string) {
  return value
    .replace(/\\([#|_*[\]()])/g, "$1")
    .replace(/\*\*/g, "")
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
  const freshnessMatch = metadataText.match(/\*([^*]*data[^*]*)\*/i);

  return freshnessMatch?.[1]?.trim() ?? null;
}

export function parseMarkdownAllCredits(
  markdown: string,
): ParsedAllCreditsRow[] {
  const rows: ParsedAllCreditsRow[] = [];

  for (const [lineIndex, line] of markdown.split(/\r?\n/).entries()) {
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

    if (!rankCell || !gRankCell || !artistCell || !leadCell || !featCell) {
      throw new Error(`Malformed ChartMasters row at line ${lineIndex + 1}.`);
    }

    const allCreditRank = parseIntegerCell(rankCell);
    const rawGRank = gRankCell.trim()
      ? parseIntegerCell(gRankCell)
      : null;
    const artistMatch = artistCell.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const rawArtistName = artistMatch?.[1] ?? artistCell;
    const artistName = cleanMarkdownText(rawArtistName);
    const chartmastersUrl = artistMatch?.[2] ?? null;
    const spotifyArtistId = getSpotifyArtistId(chartmastersUrl);

    if (!artistName) {
      throw new Error(`Missing artist name at line ${lineIndex + 1}.`);
    }

    rows.push({
      allCreditRank,
      rawGRank,
      artistName,
      spotifyArtistId,
      chartmastersUrl,
      imageUrl: null,
      leadStreams: parseStreamCell(leadCell),
      nonLeadStreams: parseStreamCell(featCell),
      allCreditStreams: parseStreamCell(allCreditCell ?? ""),
      dataFreshnessLabel: getDataFreshnessLabel(
        artistCell,
        artistMatch && artistMatch.index !== undefined
          ? artistMatch.index + artistMatch[0].length
          : null,
      ),
    });
  }

  return rows;
}

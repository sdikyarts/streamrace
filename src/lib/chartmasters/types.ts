export const CHARTMASTERS_SOURCE_NAME = "chartmasters";
export const CHARTMASTERS_ALL_CREDITS_SOURCE_TABLE =
  "spotify_artists_all_credits";
export const CHARTMASTERS_ALL_CREDITS_SOURCE_URL =
  "https://chartmasters.org/most-streamed-artists-ever-on-spotify/";

export type ChartmastersCollectionMethod =
  | "markdown"
  | "static_html"
  | "datatables_ajax";

export type ParsedAllCreditsRow = {
  allCreditRank: number;
  rawGRank: number | null;
  artistName: string;
  spotifyArtistId: string | null;
  chartmastersUrl: string | null;
  imageUrl?: string | null;
  leadStreams: bigint;
  nonLeadStreams: bigint;
  allCreditStreams: bigint;
  dataFreshnessLabel?: string | null;
  gender?: string | null;
  language?: string | null;
  genre?: string | null;
  country?: string | null;
};

export type ParsedAllCreditsRowWithLeadRank = ParsedAllCreditsRow & {
  leadRankInDataset: number;
};

export type IngestionAnomalyInput = {
  severity: "warning" | "error";
  code: string;
  rowNumber?: number;
  artistName?: string;
  message: string;
  rawValue?: string;
};

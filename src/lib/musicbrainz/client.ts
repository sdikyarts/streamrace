import {
  createRateLimitedFetch,
  STREAMRACE_USER_AGENT,
} from "../rate-limited-fetch";

const API_BASE = "https://musicbrainz.org/ws/2";
const rateLimitedFetch = createRateLimitedFetch({
  headers: {
    "User-Agent": STREAMRACE_USER_AGENT,
    Accept: "application/json",
  },
});

export async function getMbidFromSpotifyId(spotifyArtistId: string): Promise<string | null> {
  const spotifyUrl = `https://open.spotify.com/artist/${spotifyArtistId}`;
  const url = `${API_BASE}/url?resource=${encodeURIComponent(spotifyUrl)}&inc=artist-rels&fmt=json`;

  const response = await rateLimitedFetch(url);
  if (!response.ok) return null;

  const data = await response.json() as {
    relations?: { artist?: { id: string } }[];
  };

  return data.relations?.[0]?.artist?.id ?? null;
}

export async function getArtistCountry(mbid: string): Promise<string | null> {
  const url = `${API_BASE}/artist/${mbid}?fmt=json`;

  const response = await rateLimitedFetch(url);
  if (!response.ok) return null;

  const data = await response.json() as { country?: string };

  return data.country ?? null;
}

// Last-resort fallback: search by name and return country from the top result.
// Only use when Spotify ID lookup and Wikidata both failed.
export async function searchArtistCountryByName(name: string): Promise<string | null> {
  const quotedName = `"${name}"`;
  const query = `artist:${encodeURIComponent(quotedName)}`;
  const url = `${API_BASE}/artist?query=${query}&limit=3&fmt=json`;

  const response = await rateLimitedFetch(url);
  if (!response.ok) return null;

  const data = await response.json() as {
    artists?: { name: string; country?: string; score?: number }[];
  };

  // Only trust the result if the top score is high (≥90) and name roughly matches
  const top = data.artists?.[0];
  if (!top || (top.score ?? 0) < 90) return null;

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalize(top.name) !== normalize(name)) return null;

  return top.country ?? null;
}

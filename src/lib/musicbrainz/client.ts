const API_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "streamrace/1.0 (stewieisacrown@gmail.com)";
const RATE_LIMIT_MS = 1050;

let lastRequestAt = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (response.status === 429) {
    await new Promise((r) => setTimeout(r, 5000));
    return rateLimitedFetch(url);
  }

  return response;
}

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
  const url = `${API_BASE}/artist?query=artist:${encodeURIComponent(`"${name}"`)}&limit=3&fmt=json`;

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

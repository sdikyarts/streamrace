const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
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
      Accept: "application/sparql-results+json",
    },
  });

  if (response.status === 429) {
    await new Promise((r) => setTimeout(r, 5000));
    return rateLimitedFetch(url);
  }

  return response;
}

// Looks up artist country (ISO 3166-1 alpha-2) by Spotify artist ID via Wikidata.
// Uses P1902 (Spotify artist ID) → P27 (country of citizenship) → P297 (ISO code).
export async function getCountryBySpotifyId(spotifyArtistId: string): Promise<string | null> {
  const query = `
    SELECT ?countryCode WHERE {
      ?artist wdt:P1902 "${spotifyArtistId}" .
      ?artist wdt:P27 ?country .
      ?country wdt:P297 ?countryCode .
    }
    LIMIT 1
  `;

  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
  const response = await rateLimitedFetch(url);

  if (!response.ok) return null;

  const data = await response.json() as {
    results: { bindings: { countryCode?: { value: string } }[] };
  };

  return data.results.bindings[0]?.countryCode?.value ?? null;
}

import {
  createRateLimitedFetch,
  STREAMRACE_USER_AGENT,
} from "../rate-limited-fetch";

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const rateLimitedFetch = createRateLimitedFetch({
  headers: {
    "User-Agent": STREAMRACE_USER_AGENT,
    Accept: "application/sparql-results+json",
  },
});

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

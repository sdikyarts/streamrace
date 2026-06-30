import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function loadClient(response: Response) {
  vi.resetModules();
  vi.setSystemTime(new Date("2026-06-22T12:00:00.000Z"));

  const fetchMock = vi.fn<FetchMock>().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);

  return {
    fetchMock,
    ...(await import("./client")),
  };
}

describe("Wikidata client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("looks up country code by Spotify artist ID", async () => {
    const { fetchMock, getCountryBySpotifyId } = await loadClient(
      Response.json({
        results: { bindings: [{ countryCode: { value: "US" } }] },
      }),
    );

    await expect(getCountryBySpotifyId("spotify-1")).resolves.toBe("US");

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://query.wikidata.org/sparql");
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("query")).toContain('wdt:P1902 "spotify-1"');
  });

  it("returns null for failed or empty Wikidata responses", async () => {
    let client = await loadClient(new Response("failed", { status: 503 }));
    await expect(client.getCountryBySpotifyId("spotify-1")).resolves.toBeNull();

    client = await loadClient(Response.json({ results: { bindings: [] } }));
    await expect(client.getCountryBySpotifyId("spotify-1")).resolves.toBeNull();
  });
});

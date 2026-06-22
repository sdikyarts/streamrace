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

describe("MusicBrainz client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("resolves an MBID from a Spotify artist relationship", async () => {
    const { fetchMock, getMbidFromSpotifyId } = await loadClient(
      Response.json({ relations: [{ artist: { id: "mbid-1" } }] }),
    );

    await expect(getMbidFromSpotifyId("spotify-1")).resolves.toBe("mbid-1");

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("https://musicbrainz.org/ws/2/url?");
    expect(url).toContain("resource=https%3A%2F%2Fopen.spotify.com");
    expect(url).toContain("inc=artist-rels");
    expect(url).toContain("fmt=json");
  });

  it("returns null when Spotify relationship lookup fails or has no artist", async () => {
    let client = await loadClient(new Response("missing", { status: 404 }));
    await expect(client.getMbidFromSpotifyId("spotify-1")).resolves.toBeNull();

    client = await loadClient(Response.json({ relations: [] }));
    await expect(client.getMbidFromSpotifyId("spotify-1")).resolves.toBeNull();
  });

  it("fetches artist country by MBID", async () => {
    const { fetchMock, getArtistCountry } = await loadClient(
      Response.json({ country: "ID" }),
    );

    await expect(getArtistCountry("mbid-1")).resolves.toBe("ID");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://musicbrainz.org/ws/2/artist/mbid-1?fmt=json",
    );
  });

  it("returns null when country lookup fails or has no country", async () => {
    let client = await loadClient(new Response("missing", { status: 404 }));
    await expect(client.getArtistCountry("mbid-1")).resolves.toBeNull();

    client = await loadClient(Response.json({}));
    await expect(client.getArtistCountry("mbid-1")).resolves.toBeNull();
  });

  it("trusts high-score normalized artist-name search matches", async () => {
    const { searchArtistCountryByName } = await loadClient(
      Response.json({
        artists: [{ name: "AC DC", country: "AU", score: 99 }],
      }),
    );

    await expect(searchArtistCountryByName("AC/DC")).resolves.toBe("AU");
  });

  it("rejects low-score, mismatched, empty, and failed artist-name searches", async () => {
    let client = await loadClient(
      Response.json({ artists: [{ name: "Artist", country: "US", score: 89 }] }),
    );
    await expect(client.searchArtistCountryByName("Artist")).resolves.toBeNull();

    client = await loadClient(
      Response.json({ artists: [{ name: "Other", country: "US", score: 99 }] }),
    );
    await expect(client.searchArtistCountryByName("Artist")).resolves.toBeNull();

    client = await loadClient(Response.json({ artists: [] }));
    await expect(client.searchArtistCountryByName("Artist")).resolves.toBeNull();

    client = await loadClient(
      Response.json({ artists: [{ name: "Artist", score: 99 }] }),
    );
    await expect(client.searchArtistCountryByName("Artist")).resolves.toBeNull();

    client = await loadClient(new Response("failed", { status: 500 }));
    await expect(client.searchArtistCountryByName("Artist")).resolves.toBeNull();

    client = await loadClient(
      Response.json({ artists: [{ name: "Artist", country: "US" }] }),
    );
    await expect(client.searchArtistCountryByName("Artist")).resolves.toBeNull();
  });
});

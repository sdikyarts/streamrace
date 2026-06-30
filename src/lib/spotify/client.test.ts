import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const envKeys = ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"] as const;
const originalEnv = new Map(
  envKeys.map((key) => [key, process.env[key]] as const),
);

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function restoreEnv() {
  for (const key of envKeys) {
    const value = originalEnv.get(key);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function loadClient() {
  vi.resetModules();
  process.env.SPOTIFY_CLIENT_ID = "client-id";
  process.env.SPOTIFY_CLIENT_SECRET = "client-secret";

  return import("./client");
}

describe("Spotify client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    restoreEnv();
  });

  afterAll(() => {
    restoreEnv();
  });

  it("returns early without credentials or network for empty ID batches", async () => {
    const fetchMock = vi.fn<FetchMock>();
    vi.stubGlobal("fetch", fetchMock);
    const { fetchArtistsByIds } = await loadClient();

    await expect(fetchArtistsByIds([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects batches above Spotify's 50 artist limit", async () => {
    const { fetchArtistsByIds } = await loadClient();

    await expect(
      fetchArtistsByIds(Array.from({ length: 51 }, (_, index) => `id-${index}`)),
    ).rejects.toThrow("at most 50 IDs");
  });

  it("requires Spotify credentials before requesting a token", async () => {
    vi.resetModules();
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    const { fetchArtistsByIds } = await import("./client");

    await expect(fetchArtistsByIds(["artist-1"])).rejects.toThrow(
      "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set.",
    );
  });

  it("requests a token, fetches artists, filters null entries, and reuses the token", async () => {
    const fetchMock = vi
      .fn<FetchMock>()
      .mockResolvedValueOnce(
        Response.json({ access_token: "token-1", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        Response.json({
          artists: [
            {
              id: "artist-1",
              name: "Artist One",
              images: [],
              genres: ["pop"],
              popularity: 80,
            },
            null,
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ artists: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchArtistsByIds } = await loadClient();

    await expect(fetchArtistsByIds(["artist-1", "artist-2"])).resolves.toEqual([
      {
        id: "artist-1",
        name: "Artist One",
        images: [],
        genres: ["pop"],
        popularity: 80,
      },
    ]);
    await expect(fetchArtistsByIds(["artist-3"])).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://accounts.spotify.com/api/token",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: "grant_type=client_credentials",
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.spotify.com/v1/artists?ids=artist-1,artist-2",
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: { Authorization: "Bearer token-1" },
    });
    expect(fetchMock.mock.calls[2][0]).toBe(
      "https://api.spotify.com/v1/artists?ids=artist-3",
    );
  });

  it("throws when Spotify token or artist requests fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<FetchMock>()
        .mockResolvedValue(new Response("nope", { status: 401 })),
    );
    let client = await loadClient();

    await expect(client.fetchArtistsByIds(["artist-1"])).rejects.toThrow(
      "Spotify token request failed: 401",
    );

    vi.stubGlobal(
      "fetch",
      vi
        .fn<FetchMock>()
        .mockResolvedValueOnce(
          Response.json({ access_token: "token-1", expires_in: 3600 }),
        )
        .mockResolvedValueOnce(new Response("nope", { status: 500 })),
    );
    client = await loadClient();

    await expect(client.fetchArtistsByIds(["artist-1"])).rejects.toThrow(
      "Spotify artists request failed: 500",
    );
  });
});

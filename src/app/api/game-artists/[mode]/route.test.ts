import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gameArtistMocks = vi.hoisted(() => ({
  getGameArtists: vi.fn(),
}));

vi.mock("@/lib/game-artists", () => ({
  getGameArtists: gameArtistMocks.getGameArtists,
}));

import { GET } from "./route";

function context(mode: string) {
  return { params: Promise.resolve({ mode }) };
}

describe("GET /api/game-artists/[mode]", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    gameArtistMocks.getGameArtists.mockReset();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("rejects invalid modes", async () => {
    const response = await GET(new Request("http://localhost/api/game-artists/nope"), context("nope"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid mode" });
    expect(gameArtistMocks.getGameArtists).not.toHaveBeenCalled();
  });

  it("returns artists for a valid mode", async () => {
    const artists = [
      { name: "Artist", imageUrl: "https://example.com/artist.jpg", streams: 100 },
    ];
    gameArtistMocks.getGameArtists.mockResolvedValue(artists);

    const response = await GET(
      new Request("http://localhost/api/game-artists/all-credits"),
      context("all-credits"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );
    expect(body).toEqual({ artists });
    expect(gameArtistMocks.getGameArtists).toHaveBeenCalledWith("all-credits");
  });

  it("returns a 503 response when artist loading fails", async () => {
    gameArtistMocks.getGameArtists.mockRejectedValue(new Error("database down"));

    const response = await GET(
      new Request("http://localhost/api/game-artists/lead-streams"),
      context("lead-streams"),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ artists: [], error: "Failed to load artists" });
    expect(consoleError).toHaveBeenCalledOnce();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const artistImagesMocks = vi.hoisted(() => ({
  getArtistImages: vi.fn(),
}));

vi.mock("@/lib/artist-images", () => ({
  getArtistImages: artistImagesMocks.getArtistImages,
}));

import { GET } from "./route";

describe("GET /api/artist-images", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    artistImagesMocks.getArtistImages.mockReset();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("returns artist images with cache headers", async () => {
    const artists = [{ url: "https://example.com/a.jpg", name: "Artist A" }];
    artistImagesMocks.getArtistImages.mockResolvedValue(artists);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );
    expect(body).toEqual({ artists });
  });

  it("returns 503 with an empty artist list when loading fails", async () => {
    artistImagesMocks.getArtistImages.mockRejectedValue(new Error("db down"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      artists: [],
      error: "Failed to load artist images",
    });
    expect(consoleError).toHaveBeenCalledOnce();
  });
});

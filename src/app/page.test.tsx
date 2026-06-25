import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

const { artistImages, getArtistImagesMock } = vi.hoisted(() => {
  const artistImages = [
    { url: "https://example.com/artist.jpg", name: "Example Artist" },
  ];

  return {
    artistImages,
    getArtistImagesMock: vi.fn(async () => artistImages),
  };
});

vi.mock("@/lib/artist-images", () => ({
  getArtistImages: getArtistImagesMock,
}));

vi.mock("next/server", () => ({
  connection: vi.fn(async () => undefined),
}));

import Home from "./page";
import LandingPage from "./LandingPage";

describe("Home", () => {
  it("seeds the landing page with initial artist images", async () => {
    const element = await Home();

    expect(isValidElement(element)).toBe(true);
    expect(getArtistImagesMock).toHaveBeenCalledOnce();
    expect(element.type).toBe(LandingPage);
    expect(element.props).toMatchObject({
      initialArtists: artistImages,
    });
  });
});

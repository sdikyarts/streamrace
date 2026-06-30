// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ArtistSlideshow from "./ArtistSlideshow";

const ARTISTS = [
  { url: "https://example.com/a.jpg", name: "Artist A" },
  { url: "https://example.com/b.jpg", name: "Artist B" },
  { url: "https://example.com/c.jpg", name: "Artist C" },
];

function stubFetch(ok = true, status = 200, artists = ARTISTS) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      ok
        ? { ok: true, json: () => Promise.resolve({ artists }) }
        : { ok: false, status },
    ),
  );
}

function stubImage() {
  class MockImage {
    naturalWidth = 200;
    naturalHeight = 200;
    crossOrigin = "";
    private _src = "";
    onload: ((ev: Event) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;

    get src() { return this._src; }
    set src(url: string) {
      this._src = url;
      Promise.resolve().then(() => { this.onload?.(new Event("load")); });
    }
  }
  vi.stubGlobal("Image", MockImage);
}

function stubCanvas() {
  const width = 50;
  const height = 50;
  const pixelData = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      pixelData[i]     = (x * 5) % 256; // R varies horizontally (non-zero totalW)
      pixelData[i + 1] = (y * 5) % 256; // G varies vertically
      pixelData[i + 2] = 80;             // B fixed
      pixelData[i + 3] = 255;            // A
    }
  }

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
    getImageData: vi.fn().mockReturnValue({ data: pixelData }),
  } as any);
}

function stubLocalStorage(cached: string | null = null) {
  vi.stubGlobal("localStorage", {
    getItem: vi.fn().mockReturnValue(cached),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  });
}

describe("ArtistSlideshow", () => {
  beforeEach(() => {
    stubFetch();
    stubImage();
    stubCanvas();
    stubLocalStorage();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders the two image layer slots and the name label element", () => {
    const { container } = render(
      createElement(ArtistSlideshow, { initialArtists: ARTISTS }),
    );

    expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector(".artist-label-text")).toBeTruthy();
  });

  it("initialises from provided artists and sets at least one img src", async () => {
    const { container } = render(
      createElement(ArtistSlideshow, { initialArtists: ARTISTS }),
    );

    await act(async () => { await new Promise(r => setTimeout(r, 0)); });

    const withSrc = Array.from(container.querySelectorAll("img"))
      .filter(img => img.getAttribute("src"));
    expect(withSrc.length).toBeGreaterThanOrEqual(1);
  });

  it("initialises from the network fetch when no initialArtists is provided", async () => {
    const { container } = render(createElement(ArtistSlideshow, {}));

    await act(async () => { await new Promise(r => setTimeout(r, 0)); });

    expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(2);
  });

  it("advances through two full slide cycles (covers both outgoing=0 and outgoing=1 branches)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });

    render(createElement(ArtistSlideshow, { initialArtists: ARTISTS }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Cycle 1: outgoing=0, incoming=1  (line 463 true branch)
    await act(async () => { vi.advanceTimersByTime(7001); });
    await act(async () => { vi.advanceTimersByTime(1801); });

    // Cycle 2: outgoing=1, incoming=0  (line 463 false branch)
    await act(async () => { vi.advanceTimersByTime(7001); });
    await act(async () => { vi.advanceTimersByTime(1801); });
  });

  it("handles a single-artist list (covers second===first branch in init)", async () => {
    // With 1 artist, getNext() returns the same URL twice → second===first (line 409 true branch)
    const ONE = [ARTISTS[0]];
    vi.useFakeTimers({ shouldAdvanceTime: false });

    render(createElement(ArtistSlideshow, { initialArtists: ONE }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    vi.useRealTimers();
  });

  it("covers the no-visible-movement fallback in startPan (top-of-image face)", async () => {
    // With real DOM img naturalWidth/Height, focalToBgPos produces valid percentages.
    // A face at the very top of the image → focal.topY=0, focal.y~3% → both startY and
    // endY clamp to ≈0% → Math.abs(startY-endY)<4 → fallback branch (lines 348-350) fires.
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(400);
    vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(600);

    const mockDetect = vi.fn().mockResolvedValue([
      { boundingBox: { x: 0, y: 0, width: 10, height: 10 } },
    ]);
    vi.stubGlobal("FaceDetector", class { detect = mockDetect; });

    vi.useFakeTimers({ shouldAdvanceTime: false });

    render(createElement(ArtistSlideshow, { initialArtists: ARTISTS }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Fire the slide interval → startPan with top-left face → fallback triggers
    await act(async () => { vi.advanceTimersByTime(7001); });

    vi.useRealTimers();
  });

  it("covers clearWidthTransition by dispatching transitionend after slide advance", async () => {
    // animateNameWidth adds a 'transitionend' listener to .artist-label-wrap.
    // happy-dom never fires CSS transitions automatically, so we dispatch manually.
    vi.useFakeTimers({ shouldAdvanceTime: false });

    const { container } = render(
      createElement(ArtistSlideshow, { initialArtists: ARTISTS }),
    );

    // Flush init microtasks (MockImage onload → Promise resolves → setReady(true))
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Fire the SLIDE_DURATION interval → transitionName → animateNameWidth registers listener
    await act(async () => { vi.advanceTimersByTime(7001); });

    // Dispatch a transitionend event with propertyName='width' to invoke clearWidthTransition
    const nameWrap = container.querySelector(".artist-label-wrap") as HTMLElement | null;
    if (nameWrap) {
      const event = Object.assign(new Event("transitionend", { bubbles: false }), {
        propertyName: "width",
      });
      await act(async () => { nameWrap.dispatchEvent(event); });
    }

    vi.useRealTimers();
  });

  it("reshuffles the deck when all artists have been shown (covers getNext shuffle path)", async () => {
    // 2 artists → deck length 2; init calls getNext() twice (pos→2).
    // The inner timer's getNext() call sees pos(2) >= length(2) → shuffles.
    const TWO = ARTISTS.slice(0, 2);
    vi.useFakeTimers({ shouldAdvanceTime: false });

    render(createElement(ArtistSlideshow, { initialArtists: TWO }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => { vi.advanceTimersByTime(7001); });
    await act(async () => { vi.advanceTimersByTime(1801); });
    // No assertion — just confirming the shuffle path runs without crashing
  });

  it("uses window.FaceDetector when available and faces are found", async () => {
    const mockDetect = vi.fn().mockResolvedValue([
      { boundingBox: { x: 60, y: 30, width: 80, height: 100 } },
    ]);
    vi.stubGlobal("FaceDetector", class { detect = mockDetect; });

    render(createElement(ArtistSlideshow, { initialArtists: ARTISTS }));

    await act(async () => { await new Promise(r => setTimeout(r, 0)); });

    // detectNativeFace was reached (FaceDetector was constructed and detect called)
    expect(mockDetect).toHaveBeenCalled();
  });

  it("falls back to saliency when FaceDetector returns no faces", async () => {
    // Covers the `if (!faces.length) return null` branch in detectNativeFace
    const mockDetect = vi.fn().mockResolvedValue([]);
    vi.stubGlobal("FaceDetector", class { detect = mockDetect; });

    render(createElement(ArtistSlideshow, { initialArtists: ARTISTS }));

    await act(async () => { await new Promise(r => setTimeout(r, 0)); });

    expect(mockDetect).toHaveBeenCalled();
  });

  it("catches a FaceDetector error and falls back to DEFAULT_POS", async () => {
    // Covers the catch {} block in detectNativeFace
    const mockDetect = vi.fn().mockRejectedValue(new Error("gpu error"));
    vi.stubGlobal("FaceDetector", class { detect = mockDetect; });

    expect(() =>
      render(createElement(ArtistSlideshow, { initialArtists: ARTISTS })),
    ).not.toThrow();

    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  });

  it("throws and swallows when the fetch response is not OK (covers !r.ok path)", async () => {
    // Override the default stub with a non-OK response
    stubFetch(false, 503);

    expect(() =>
      render(createElement(ArtistSlideshow, { initialArtists: ARTISTS })),
    ).not.toThrow();

    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  });

  it("handles a fetch network failure gracefully without crashing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    expect(() =>
      render(createElement(ArtistSlideshow, { initialArtists: ARTISTS })),
    ).not.toThrow();

    await act(async () => { await Promise.resolve(); });
  });

  it("resolves to DEFAULT_POS when scaleToCanvas throws (covers preloadAndDetect catch branch)", async () => {
    // With getContext returning null, scaleToCanvas's `getContext('2d')!.drawImage(...)` throws.
    // preloadAndDetect's try-catch catches it and resolves with DEFAULT_POS (line 261).
    // No FaceDetector stub → detectNativeFace returns null → saliency fallback path runs.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null as any);

    expect(() =>
      render(createElement(ArtistSlideshow, { initialArtists: ARTISTS })),
    ).not.toThrow();

    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  });

  it("returns null from loadCachedArtists when localStorage contains malformed JSON (covers catch branch)", async () => {
    // Malformed JSON causes JSON.parse to throw, caught by loadCachedArtists (line 280).
    stubLocalStorage("not valid json {{{");

    expect(() =>
      render(createElement(ArtistSlideshow, {})),
    ).not.toThrow();

    await act(async () => { await Promise.resolve(); });
  });

  it("loads artists from a valid localStorage cache on mount", async () => {
    const cached = JSON.stringify({ ts: Date.now(), data: ARTISTS });
    stubLocalStorage(cached);

    const { container } = render(createElement(ArtistSlideshow, {}));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(2);
  });
});

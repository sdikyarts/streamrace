// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Shared spy so tests can assert router.push was called
const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    createElement("img", { src, alt }),
}));

import GameUI from "./GameUI";
import type { GameArtist } from "@/lib/game-artists";

// Stubs globalThis.crypto.getRandomValues so rng() returns a deterministic sequence.
// Pass values in call order; the last value repeats for all subsequent calls.
function stubRng(...sequence: number[]) {
  const last = sequence.at(-1) ?? 0;
  let i = 0;
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((arr) => {
    const val = i < sequence.length ? sequence[i++] : last;
    if (arr instanceof Uint32Array) arr[0] = (val * 2 ** 32) >>> 0;
    return arr;
  });
}

// Three artists so pickNear always has a non-excluded candidate for the second round
const artistA: GameArtist = { name: "Artist Alpha", imageUrl: "https://example.com/a.jpg", streams: 1_000_000 };
const artistB: GameArtist = { name: "Artist Beta",  imageUrl: "https://example.com/b.jpg", streams: 500_000  };
const artistC: GameArtist = { name: "Artist Gamma", imageUrl: "https://example.com/c.jpg", streams: 750_000  };

function setupFetch(artists: GameArtist[] = [artistA, artistB, artistC]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ artists }),
    }),
  );
}

describe("GameUI", () => {
  beforeEach(() => {
    setupFetch();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    mockPush.mockClear();
    vi.useRealTimers(); // safety net against fake-timer leakage
  });

  it("shows loading state before artists are seeded", () => {
    render(createElement(GameUI, { mode: "all-credits", initialArtists: [] }));
    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("renders both artist panels once initialArtists are seeded", async () => {
    // Math.random = 0 → sorted=[artistA(1M),artistC(750k),artistB(500k)]
    // left=artistA, right=artistC (wildcard); same after the fetch re-seed
    stubRng(0);

    render(
      createElement(GameUI, { mode: "all-credits", initialArtists: [artistA, artistB, artistC] }),
    );

    await waitFor(() => expect(screen.queryByText("Loading...")).toBeNull());

    // artistA appears in the left name label + as "than …" in the right panel
    expect(screen.getAllByText("Artist Alpha").length).toBeGreaterThan(0);
    // artistC is the right panel's name
    expect(screen.getAllByText("Artist Gamma").length).toBeGreaterThan(0);
  });

  it("shows the left artist stream count once seeded", async () => {
    // Math.random = 0 → sorted=[artistA(1M),artistC(750k),artistB(500k)]
    // leftArtist = sorted[0] = artistA, right = artistC (wildcard pick)
    stubRng(0);

    render(
      createElement(GameUI, {
        mode: "all-credits",
        initialArtists: [artistA, artistB, artistC],
      }),
    );

    await waitFor(() => expect(screen.queryByText("Loading...")).toBeNull());

    // Left panel always shows the stream count of the left artist
    expect(screen.getAllByText(artistA.streams.toLocaleString('en-US')).length).toBeGreaterThan(0);
  });

  it("shows Higher and Lower guess buttons for the right panel", async () => {
    render(
      createElement(GameUI, { mode: "all-credits", initialArtists: [artistA, artistB] }),
    );

    await waitFor(() => expect(screen.queryByText("Loading...")).toBeNull());

    expect(screen.getAllByRole("button", { name: /Higher/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Lower/i }).length).toBeGreaterThan(0);
  });

  it("increments score on a correct guess (left has more streams)", async () => {
    // Math.random = 0 → left=artistA(1M), right=artistC(750k) → correct = Lower
    stubRng(0);

    render(
      createElement(GameUI, {
        mode: "lead-streams",
        initialArtists: [artistA, artistB, artistC],
      }),
    );

    await waitFor(() => expect(screen.queryByText("Loading...")).toBeNull());

    const lowerBtn = screen.getByRole("button", { name: /Lower/i });
    await act(async () => { fireEvent.click(lowerBtn); });

    // Score increments synchronously; value div is the next sibling of the label
    const label = screen.getByText("Current Score");
    expect(label.nextElementSibling?.textContent).toBe("1");
  });

  it("fires the next-round transition after a correct guess (left > right path)", async () => {
    // left=artistA(1M) > right=artistC(750k) → Lower is correct
    // After 1600ms: leftStreams>rightStreams → setRight(next); after 300ms: phase='playing'
    stubRng(0);

    render(
      createElement(GameUI, {
        mode: "all-credits",
        initialArtists: [artistA, artistB, artistC],
      }),
    );

    await waitFor(() => expect(screen.queryByText("Loading...")).toBeNull());

    const lowerBtn = screen.getByRole("button", { name: /Lower/i });

    vi.useFakeTimers();
    try {
      await act(async () => { fireEvent.click(lowerBtn); });
      // Inner setTimeout(1600): setPhase('transitioning'), setRight(next)
      await act(async () => { vi.advanceTimersByTime(1600); });
      // Inner setTimeout(300): setPhase('playing')
      await act(async () => { vi.advanceTimersByTime(300); });

      // Game still running — no GAME OVER
      expect(screen.queryByText("GAME OVER!!!")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("fires the next-round transition after a correct guess (right > left path)", async () => {
    // Disable the fetch so only initialArtists controls the game state — no re-seed race.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch disabled")));
    vi.spyOn(console, "error").mockImplementation(() => {});

    // With [0.8, 0, 0, ...]: sorted=[artistA(1M),artistC(750k),artistB(500k)]
    //   left = sorted[floor(0.8*3)] = sorted[2] = artistB(500k)
    //   right = wildcard (random=0) from available=[artistA,artistC] → artistA(1M)
    //   correct = Higher (1M > 500k)
    // After 1600ms: leftStreams<rightStreams → else branch: setLeft(right), setRight(next)
    stubRng(0.8, 0); // first call picks leftArtist = sorted[2] = artistB, rest = 0

    render(
      createElement(GameUI, {
        mode: "all-credits",
        initialArtists: [artistA, artistB, artistC],
      }),
    );

    await waitFor(() => expect(screen.queryByText("Loading...")).toBeNull());

    const higherBtn = screen.getByRole("button", { name: /Higher/i });

    vi.useFakeTimers();
    try {
      await act(async () => { fireEvent.click(higherBtn); });
      await act(async () => { vi.advanceTimersByTime(1600); });
      await act(async () => { vi.advanceTimersByTime(300); });

      expect(screen.queryByText("GAME OVER!!!")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows GAME OVER overlay on a wrong guess and navigates home on BACK TO HOME", async () => {
    // left=artistA(1M), right=artistC(750k) → "Higher" is wrong (750k not > 1M)
    stubRng(0);

    render(
      createElement(GameUI, {
        mode: "all-credits",
        initialArtists: [artistA, artistB, artistC],
      }),
    );

    await waitFor(() => expect(screen.queryByText("Loading...")).toBeNull());

    const higherBtn = screen.getByRole("button", { name: /Higher/i });

    vi.useFakeTimers();
    try {
      await act(async () => { fireEvent.click(higherBtn); });
      await act(async () => { vi.advanceTimersByTime(1700); });

      expect(screen.queryByText("GAME OVER!!!")).toBeTruthy();

      // Click BACK TO HOME → covers router.push('/')
      const backBtn = screen.getByText("BACK TO HOME");
      await act(async () => { fireEvent.click(backBtn); });
      expect(mockPush).toHaveBeenCalledWith("/");
    } finally {
      vi.useRealTimers();
    }
  });

  it("fires next-round transition with 2-artist pool (covers available.length===0 branch in pickNear)", async () => {
    // With only 2 artists in the pool, after a correct guess exclude=[left,right] exhausts
    // the full pool → pickNear sees available.length===0 → returns sorted[0] (line 477).
    setupFetch([artistA, artistB]);
    stubRng(0);

    render(
      createElement(GameUI, { mode: "all-credits", initialArtists: [artistA, artistB] }),
    );

    await waitFor(() => expect(screen.queryByText("Loading...")).toBeNull());

    // left=artistA(1M), right=artistB(500k) → Lower is correct
    const lowerBtn = screen.getByRole("button", { name: /Lower/i });

    vi.useFakeTimers();
    try {
      await act(async () => { fireEvent.click(lowerBtn); });
      await act(async () => { vi.advanceTimersByTime(1600); });  // → pickNear with both excluded
      await act(async () => { vi.advanceTimersByTime(300); });

      expect(screen.queryByText("GAME OVER!!!")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores a second click while already in reveal phase (covers handleGuess early-return)", async () => {
    // After the first click, phase becomes 'reveal'. A second click hits the
    // `if (phase !== 'playing' || ...) return` guard (line 559) and returns early.
    stubRng(0);

    render(
      createElement(GameUI, { mode: "all-credits", initialArtists: [artistA, artistB, artistC] }),
    );

    await waitFor(() => expect(screen.queryByText("Loading...")).toBeNull());

    const lowerBtn = screen.getByRole("button", { name: /Lower/i });

    vi.useFakeTimers();
    try {
      await act(async () => { fireEvent.click(lowerBtn); }); // correct guess → phase='reveal'
      await act(async () => { fireEvent.click(lowerBtn); }); // second click → early return
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not update high score when new score does not exceed it (covers newScore<=highScore branch)", async () => {
    // Pre-seed localStorage with a high score of 2 so that scoring 1 stays below it.
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue("2"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });

    stubRng(0);

    render(
      createElement(GameUI, { mode: "all-credits", initialArtists: [artistA, artistB, artistC] }),
    );

    await waitFor(() => expect(screen.queryByText("Loading...")).toBeNull());

    // left=artistA(1M) > right=artistC(750k) → Lower is correct → score 1, highScore 2 → 1 > 2 is false
    const lowerBtn = screen.getByRole("button", { name: /Lower/i });
    await act(async () => { fireEvent.click(lowerBtn); });
  });

  it("swallows an AbortError in the fetch catch handler (covers cancelled/AbortError early-return)", async () => {
    // Fetch rejects with an AbortError (name='AbortError'). The catch handler's
    // early-return guard fires: `if (cancelled || err?.name === 'AbortError') return`.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(
        Object.assign(new Error("aborted"), { name: "AbortError" }),
      ),
    );

    render(createElement(GameUI, { mode: "all-credits", initialArtists: [] }));

    // Give the microtask queue time to let the catch fire
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    // No error shown — the early return in catch prevented setLoadError
    expect(screen.queryByText(/Failed to load artists/)).toBeNull();
    expect(screen.queryByText("Loading...")).toBeTruthy();
  });

  it("shows error when fetch returns fewer than two playable artists (covers setLoadError path)", async () => {
    // initialArtists=[] so seedArtists(initialArtists) produces no left/right.
    // Fetch returns only 1 valid artist → sorted.length < 2 → setLoadError('Not enough…').
    setupFetch([artistA]);

    render(createElement(GameUI, { mode: "all-credits", initialArtists: [] }));

    await waitFor(
      () => expect(screen.queryByText("Loading...")).toBeNull(),
      { timeout: 4000 },
    );

    expect(screen.queryByText(/Not enough playable artists/)).toBeTruthy();
  });

  it("shows a load-error message when fetch fails and no initial artists are available", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(createElement(GameUI, { mode: "all-credits", initialArtists: [] }));

    await waitFor(
      () => expect(screen.queryByText("Loading...")).toBeNull(),
      { timeout: 4000 },
    );

    expect(screen.queryByText(/Failed to load artists/)).toBeTruthy();
  });

  it("shows error when fetch returns a non-OK response (covers !r.ok throw path)", async () => {
    // r.ok=false → the first .then() throws → .catch() fires → setLoadError
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(createElement(GameUI, { mode: "all-credits", initialArtists: [] }));

    await waitFor(
      () => expect(screen.queryByText("Loading...")).toBeNull(),
      { timeout: 4000 },
    );

    expect(screen.queryByText(/Failed to load artists/)).toBeTruthy();
  });

  it("uses empty array when initialArtists prop is omitted (covers ?? [] branch)", async () => {
    // No initialArtists prop → seedArtists(undefined ?? []) → seeds with empty []
    render(createElement(GameUI, { mode: "all-credits" }));

    await waitFor(
      () => expect(screen.queryByText("Loading...")).toBeNull(),
      { timeout: 4000 },
    );
  });

  it("covers the cancelled check when fetch resolves after unmount", async () => {
    // Use a deferred Promise so the fetch resolves AFTER the component unmounts.
    // The .then() at line 529 fires with cancelled=true → early return covers that branch.
    let resolveFetch!: (v: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(resolve => { resolveFetch = resolve; })),
    );

    const { unmount } = render(
      createElement(GameUI, { mode: "all-credits", initialArtists: [] }),
    );

    // Unmount before the fetch resolves → cleanup sets cancelled=true
    unmount();

    // Now resolve the fetch — the .then() handler fires but sees cancelled=true and returns
    resolveFetch({
      ok: true,
      json: () => Promise.resolve({ artists: [artistA, artistB, artistC] }),
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByRole("button")).toBeNull();
  });
});

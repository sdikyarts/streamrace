import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRateLimitedFetch,
  STREAMRACE_USER_AGENT,
} from "./rate-limited-fetch";

describe("createRateLimitedFetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-22T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends configured headers and returns successful responses", async () => {
    const response = new Response("ok");
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    const fetcher = createRateLimitedFetch({
      headers: { "User-Agent": STREAMRACE_USER_AGENT, Accept: "application/json" },
    });

    await expect(fetcher("https://api.test/data")).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledWith("https://api.test/data", {
      headers: {
        "User-Agent": STREAMRACE_USER_AGENT,
        Accept: "application/json",
      },
    });
  });

  it("waits between sequential calls", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("first"))
      .mockResolvedValueOnce(new Response("second"));
    vi.stubGlobal("fetch", fetchMock);

    const fetcher = createRateLimitedFetch({
      headers: {},
      rateLimitMs: 1050,
    });

    await fetcher("https://api.test/first");
    const secondRequest = fetcher("https://api.test/second");

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1050);
    await secondRequest;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("backs off and retries rate-limited responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    const fetcher = createRateLimitedFetch({
      headers: {},
      retryDelayMs: 5000,
    });
    const request = fetcher("https://api.test/retry");

    await vi.advanceTimersByTimeAsync(5000);

    await expect(request).resolves.toHaveProperty("ok", true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

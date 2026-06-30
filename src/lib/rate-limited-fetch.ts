export const STREAMRACE_USER_AGENT = "streamrace/1.0 (stewieisacrown@gmail.com)";

type RateLimitedFetchOptions = {
  headers: HeadersInit;
  rateLimitMs?: number;
  retryDelayMs?: number;
};

function delay(ms: number): Promise<void> {
  return ms > 0
    ? new Promise((resolve) => {
        setTimeout(resolve, ms);
      })
    : Promise.resolve();
}

export function createRateLimitedFetch({
  headers,
  rateLimitMs = 1050,
  retryDelayMs = 5000,
}: RateLimitedFetchOptions) {
  let lastRequestAt = 0;

  async function rateLimitedFetch(url: string): Promise<Response> {
    const wait = rateLimitMs - (Date.now() - lastRequestAt);
    await delay(wait);
    lastRequestAt = Date.now();

    const response = await fetch(url, { headers });

    if (response.status === 429) {
      await delay(retryDelayMs);
      return rateLimitedFetch(url);
    }

    return response;
  }

  return rateLimitedFetch;
}

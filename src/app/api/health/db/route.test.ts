import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type HealthDbOptions = {
  latestImport?: Record<string, unknown> | null;
  rankedCount?: number;
  playableCount?: number;
  undefinedCounts?: boolean;
  executeError?: Error;
};

const envKeys = ["DATABASE_URL", "NODE_ENV", "VERCEL_ENV"] as const;
const originalEnv = new Map(
  envKeys.map((key) => [key, process.env[key]] as const),
);

function mutableEnv() {
  return process.env as Record<string, string | undefined>;
}

function restoreEnv() {
  for (const key of envKeys) {
    const value = originalEnv.get(key);

    if (value === undefined) {
      delete mutableEnv()[key];
    } else {
      mutableEnv()[key] = value;
    }
  }
}

function createHealthDb({
  latestImport = {
    sourceName: "chartmasters",
    sourceTable: "spotify_artists_all_credits",
    sourceDate: "2026-06-22",
    status: "success",
  },
  rankedCount = 900,
  playableCount = 900,
  undefinedCounts = false,
  executeError,
}: HealthDbOptions = {}) {
  let selectCall = 0;

  return {
    execute: vi.fn(() =>
      executeError ? Promise.reject(executeError) : Promise.resolve(),
    ),
    select: vi.fn(() => {
      selectCall += 1;
      const callNumber = selectCall;
      const builder = {
        from() {
          return builder;
        },
        where() {
          if (callNumber === 2) {
            return Promise.resolve(undefinedCounts ? [] : [{ value: rankedCount }]);
          }

          if (callNumber === 3) {
            return Promise.resolve(undefinedCounts ? [] : [{ value: playableCount }]);
          }

          return builder;
        },
        innerJoin() {
          return builder;
        },
        orderBy() {
          return builder;
        },
        limit() {
          return Promise.resolve(latestImport ? [latestImport] : []);
        },
      };

      return builder;
    }),
  };
}

async function loadRoute(db: ReturnType<typeof createHealthDb>) {
  vi.resetModules();
  const getDatabaseClient = vi.fn(() => ({ db }));

  vi.doMock("@/db/client", () => ({ getDatabaseClient }));

  return {
    getDatabaseClient,
    ...(await import("./route")),
  };
}

describe("GET /api/health/db", () => {
  beforeEach(() => {
    restoreEnv();
  });

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/db/client");
    restoreEnv();
  });

  afterAll(() => {
    restoreEnv();
  });

  it("reports unavailable when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    mutableEnv()["NODE_ENV"] = "test";
    const { GET } = await loadRoute(createHealthDb());

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      appEnv: "test",
      database: { configured: false, connected: false },
      latestSuccessfulImport: null,
      currentRankedArtists: 0,
      playableArtists: 0,
      message: "DATABASE_URL is not configured.",
    });
  });

  it("reports a healthy database when import and playable counts are ready", async () => {
    process.env.DATABASE_URL = "postgres://runtime";
    process.env.VERCEL_ENV = "production";
    const db = createHealthDb();
    const { GET, getDatabaseClient } = await loadRoute(db);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getDatabaseClient).toHaveBeenCalledTimes(1);
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(body).toMatchObject({
      ok: true,
      appEnv: "production",
      database: { configured: true, connected: true },
      currentRankedArtists: 900,
      playableArtists: 900,
      latestSuccessfulImport: { status: "success" },
    });
  });

  it("returns 503 when the database is connected but data is not ready", async () => {
    process.env.DATABASE_URL = "postgres://runtime";
    const { GET } = await loadRoute(
      createHealthDb({
        latestImport: null,
        rankedCount: 899,
        playableCount: 898,
      }),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      latestSuccessfulImport: null,
      currentRankedArtists: 899,
      playableArtists: 898,
    });
  });

  it("reports unavailable when the database check throws", async () => {
    process.env.DATABASE_URL = "postgres://runtime";
    const { GET } = await loadRoute(
      createHealthDb({ executeError: new Error("connection failed") }),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.message).toBe("Database connectivity check failed.");
  });

  it("uses 'development' as appEnv when neither VERCEL_ENV nor NODE_ENV is set", async () => {
    delete mutableEnv()["DATABASE_URL"];
    delete mutableEnv()["VERCEL_ENV"];
    delete mutableEnv()["NODE_ENV"];
    const { GET } = await loadRoute(createHealthDb());

    const body = await (await GET()).json();

    expect(body.appEnv).toBe("development");
  });

  it("falls back to 0 when count queries return no rows", async () => {
    mutableEnv()["DATABASE_URL"] = "postgres://runtime";
    const { GET } = await loadRoute(
      createHealthDb({ undefinedCounts: true, latestImport: null }),
    );

    const response = await GET();
    const body = await response.json();

    expect(body.currentRankedArtists).toBe(0);
    expect(body.playableArtists).toBe(0);
  });
});

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const dbClientMocks = vi.hoisted(() => ({
  drizzle: vi.fn((pool: unknown, config: unknown) => ({
    pool,
    config,
    marker: "drizzle-db",
  })),
  end: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  pools: [] as { options: { connectionString: string } }[],
}));

vi.mock("@neondatabase/serverless", () => ({
  Pool: class MockPool {
    readonly options: { connectionString: string };
    readonly end = dbClientMocks.end;

    constructor(options: { connectionString: string }) {
      this.options = options;
      dbClientMocks.pools.push(this);
    }
  },
}));

vi.mock("drizzle-orm/neon-serverless", () => ({
  drizzle: dbClientMocks.drizzle,
}));

const envKeys = ["APP_ENV", "DATABASE_URL"] as const;
const originalEnv = new Map(
  envKeys.map((key) => [key, process.env[key]] as const),
);

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

describe("database client", () => {
  beforeEach(() => {
    vi.resetModules();
    dbClientMocks.drizzle.mockClear();
    dbClientMocks.end.mockClear();
    dbClientMocks.pools.length = 0;
    delete globalThis.streamRaceDatabaseClient;
    restoreEnv();
  });

  afterAll(() => {
    restoreEnv();
    delete globalThis.streamRaceDatabaseClient;
  });

  it("creates a Neon pool-backed Drizzle client", async () => {
    const { createDatabaseClient } = await import("./client");

    const client = createDatabaseClient("postgres://direct");

    expect(dbClientMocks.pools[0].options).toEqual({
      connectionString: "postgres://direct",
    });
    expect(dbClientMocks.drizzle).toHaveBeenCalledWith(
      client.pool,
      expect.objectContaining({ schema: expect.objectContaining({ artists: expect.anything() }) }),
    );

    await client.close();
    expect(dbClientMocks.end).toHaveBeenCalledTimes(1);
  });

  it("caches the runtime database client globally and exposes its db", async () => {
    process.env.APP_ENV = "production";
    process.env.DATABASE_URL = "postgres://runtime";
    const { getDatabaseClient, getDb } = await import("./client");

    const first = getDatabaseClient();
    const second = getDatabaseClient();

    expect(first).toBe(second);
    expect(getDb()).toBe(first.db);
    expect(dbClientMocks.pools).toHaveLength(1);
    expect(dbClientMocks.pools[0].options.connectionString).toBe(
      "postgres://runtime",
    );
  });
});

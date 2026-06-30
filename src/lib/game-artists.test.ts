import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  getDb: dbMocks.getDb,
}));

import {
  clearGameArtistsCacheForTests,
  getGameArtists,
  MAX_GAME_ARTISTS,
} from "./game-artists";

function createGameDb(rows: unknown[]) {
  const builder: {
    from: ReturnType<typeof vi.fn>;
    innerJoin: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  } = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };

  builder.from.mockReturnValue(builder);
  builder.innerJoin.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  builder.limit.mockResolvedValue(rows);

  const db = {
    select: vi.fn(() => builder),
  };

  return { db, builder };
}

describe("getGameArtists", () => {
  beforeEach(() => {
    clearGameArtistsCacheForTests();
    dbMocks.getDb.mockReset();
  });

  it("loads playable artists with a capped query and normalizes stream counts", async () => {
    const { db, builder } = createGameDb([
      { name: "First Artist", imageUrl: "https://example.com/1.jpg", streams: BigInt(1200) },
      { name: "No Image", imageUrl: null, streams: BigInt(900) },
      { name: "No Streams", imageUrl: "https://example.com/2.jpg", streams: null },
    ]);
    dbMocks.getDb.mockReturnValue(db);

    await expect(getGameArtists("all-credits")).resolves.toEqual([
      {
        name: "First Artist",
        imageUrl: "https://example.com/1.jpg",
        streams: 1200,
      },
    ]);

    expect(db.select).toHaveBeenCalledOnce();
    expect(builder.where).toHaveBeenCalledOnce();
    expect(builder.orderBy).toHaveBeenCalledOnce();
    expect(builder.limit).toHaveBeenCalledWith(MAX_GAME_ARTISTS);
  });

  it("reuses the in-process cache for repeated requests by mode", async () => {
    const { db } = createGameDb([
      { name: "Cached Artist", imageUrl: "https://example.com/cached.jpg", streams: BigInt(500) },
    ]);
    dbMocks.getDb.mockReturnValue(db);

    const first = await getGameArtists("lead-streams");
    const second = await getGameArtists("lead-streams");

    expect(second).toBe(first);
    expect(db.select).toHaveBeenCalledOnce();
  });

  it("deduplicates concurrent requests for the same mode via the pending promise", async () => {
    const { db } = createGameDb([
      { name: "Artist", imageUrl: "https://example.com/a.jpg", streams: BigInt(100) },
    ]);
    dbMocks.getDb.mockReturnValue(db);

    const [first, second] = await Promise.all([
      getGameArtists("lead-streams"),
      getGameArtists("lead-streams"),
    ]);

    expect(first).toBe(second);
    expect(db.select).toHaveBeenCalledOnce();
  });

  it("clears the cache and re-throws when loading fails", async () => {
    const { db, builder } = createGameDb([]);
    builder.limit.mockRejectedValue(new Error("database error"));
    dbMocks.getDb.mockReturnValue(db);

    await expect(getGameArtists("all-credits")).rejects.toThrow("database error");

    // After failure, cache is cleared — next call should re-fetch
    const { db: db2 } = createGameDb([
      { name: "Retry", imageUrl: "https://example.com/r.jpg", streams: BigInt(50) },
    ]);
    dbMocks.getDb.mockReturnValue(db2);

    const result = await getGameArtists("all-credits");
    expect(result).toHaveLength(1);
    expect(db2.select).toHaveBeenCalledOnce();
  });

  it("re-fetches after the cache TTL expires", async () => {
    vi.useFakeTimers();
    try {
      const { db: db1 } = createGameDb([
        { name: "Old", imageUrl: "https://example.com/old.jpg", streams: BigInt(100) },
      ]);
      const { db: db2 } = createGameDb([
        { name: "New", imageUrl: "https://example.com/new.jpg", streams: BigInt(200) },
      ]);
      dbMocks.getDb.mockReturnValueOnce(db1).mockReturnValueOnce(db2);

      await getGameArtists("all-credits");

      // Advance past the 5-minute TTL
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      const result = await getGameArtists("all-credits");
      expect(result[0].name).toBe("New");
      expect(db2.select).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

});

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

});

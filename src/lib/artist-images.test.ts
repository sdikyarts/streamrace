import { afterEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createDatabaseClient: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  getDb: dbMocks.getDb,
  createDatabaseClient: dbMocks.createDatabaseClient,
}));

import { getArtistImages } from "./artist-images";

function makeDb(rows: unknown[]) {
  const builder = {
    from: vi.fn(),
    where: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.where.mockResolvedValue(rows);
  return { select: vi.fn(() => builder) };
}

describe("getArtistImages", () => {
  it("maps rows to ArtistImage objects, renaming imageUrl to url", async () => {
    const db = makeDb([
      { imageUrl: "https://example.com/a.jpg", name: "Artist A" },
      { imageUrl: "https://example.com/b.jpg", name: "Artist B" },
    ]);

    await expect(getArtistImages(db as any)).resolves.toEqual([
      { url: "https://example.com/a.jpg", name: "Artist A" },
      { url: "https://example.com/b.jpg", name: "Artist B" },
    ]);
  });

  it("issues a single select query against the artists table", async () => {
    const db = makeDb([]);
    await getArtistImages(db as any);
    expect(db.select).toHaveBeenCalledOnce();
  });
});

describe("getArtistImages default db selection", () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete (globalThis as any).streamRaceArtistImageClient;
    dbMocks.getDb.mockReset();
    dbMocks.createDatabaseClient.mockReset();
  });

  it("falls back to getDb when DATABASE_URL is not set", async () => {
    delete process.env.DATABASE_URL;
    const db = makeDb([]);
    dbMocks.getDb.mockReturnValue(db);

    await getArtistImages();

    expect(dbMocks.getDb).toHaveBeenCalled();
    expect(dbMocks.createDatabaseClient).not.toHaveBeenCalled();
  });

  it("creates a production client when DATABASE_URL is set", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@prod.example/db";
    const db = makeDb([]);
    dbMocks.createDatabaseClient.mockReturnValue({ db });

    await getArtistImages();

    expect(dbMocks.createDatabaseClient).toHaveBeenCalledWith(
      "postgresql://user:pass@prod.example/db",
    );
  });

  it("reuses the cached production client on subsequent calls", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@prod.example/db";
    const db = makeDb([]);
    dbMocks.createDatabaseClient.mockReturnValue({ db });

    await getArtistImages();
    await getArtistImages();

    expect(dbMocks.createDatabaseClient).toHaveBeenCalledOnce();
  });
});

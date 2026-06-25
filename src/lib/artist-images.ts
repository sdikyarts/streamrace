import { isNotNull } from "drizzle-orm";

import {
  createDatabaseClient,
  getDb,
  type DatabaseClient,
  type StreamRaceDb,
} from "@/db/client";
import { artists } from "@/db/schema";

export type ArtistImage = {
  url: string;
  name: string;
};

declare global {
  var streamRaceArtistImageClient: DatabaseClient | undefined;
}

function getArtistImageDb(): StreamRaceDb {
  const productionUrl = process.env.DATABASE_URL;

  if (!productionUrl) return getDb();

  globalThis.streamRaceArtistImageClient ??=
    createDatabaseClient(productionUrl);

  return globalThis.streamRaceArtistImageClient.db;
}

export async function getArtistImages(
  db: StreamRaceDb = getArtistImageDb(),
): Promise<ArtistImage[]> {
  const rows = await db
    .select({ imageUrl: artists.imageUrl, name: artists.displayName })
    .from(artists)
    .where(isNotNull(artists.imageUrl));

  return rows.map((row) => ({
    url: row.imageUrl as string,
    name: row.name,
  }));
}

import { isNotNull } from "drizzle-orm";

import { createDatabaseClient } from "@/db/client";
import { artists } from "@/db/schema";

export const runtime = "nodejs";

// Always read from production so images are available in all environments,
// regardless of whether the current branch has Spotify metadata populated.
function getImageDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not configured");
  return createDatabaseClient(url).db;
}

export async function GET() {
  const db = getImageDb();

  const artistRows = await db
    .select({ imageUrl: artists.imageUrl })
    .from(artists)
    .where(isNotNull(artists.imageUrl));

  return Response.json({ images: artistRows.map((r) => r.imageUrl as string) });
}

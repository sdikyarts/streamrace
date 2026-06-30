import { createHash } from "node:crypto";

import { config } from "dotenv";
import { eq, isNotNull } from "drizzle-orm";

import { createDatabaseClient } from "../src/db/client";
import { artists } from "../src/db/schema";
import { getDirectDatabaseUrl } from "../src/lib/env";
import { fetchArtistsByIds } from "../src/lib/spotify/client";

config({ path: ".env" });

const BATCH_SIZE = 50;

async function main() {
  const client = createDatabaseClient(getDirectDatabaseUrl());

  try {
    const rows = await client.db
      .select({
        id: artists.id,
        spotifyArtistId: artists.spotifyArtistId,
        displayName: artists.displayName,
        imageUrl: artists.imageUrl,
        imageHash: artists.imageHash,
      })
      .from(artists)
      .where(isNotNull(artists.spotifyArtistId));

    console.log(`Checking ${rows.length} artists against Spotify...`);

    let updated = 0;
    let unchanged = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const spotifyIds = batch.map((r) => r.spotifyArtistId!);
      const spotifyArtists = await fetchArtistsByIds(spotifyIds);
      const byId = new Map(spotifyArtists.map((a) => [a.id, a]));

      for (const row of batch) {
        const spotify = byId.get(row.spotifyArtistId!);
        if (!spotify) continue;

        const imageUrl =
          spotify.images.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
            ?.url ?? null;
        const imageHash = imageUrl
          ? createHash("sha256").update(imageUrl).digest("hex")
          : null;
        const genre = spotify.genres[0] ?? null;
        const displayName = spotify.name;

        // Only write if something actually changed; also catches the case where
        // imageUrl was wiped to null by a re-import while imageHash was preserved
        const imageChanged = imageHash !== row.imageHash || (imageUrl !== null && row.imageUrl === null);
        const nameChanged = displayName !== row.displayName;

        if (!imageChanged && !nameChanged) {
          unchanged++;
          continue;
        }

        await client.db
          .update(artists)
          .set({
            ...(nameChanged ? { displayName } : {}),
            ...(imageChanged ? { imageUrl, imageHash } : {}),
            genre,
            updatedAt: new Date(),
          })
          .where(eq(artists.id, row.id));

        if (imageChanged) console.log(`  [image] ${row.displayName}`);
        if (nameChanged) console.log(`  [name]  ${row.displayName} → ${displayName}`);

        updated++;
      }

      if ((i + BATCH_SIZE) % 200 === 0) {
        console.log(`  ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);
      }
    }

    console.log(`\nDone. ${updated} changed, ${unchanged} unchanged.`);
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

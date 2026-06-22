import { config } from "dotenv";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { createDatabaseClient } from "../src/db/client";
import { artists } from "../src/db/schema";
import { getDirectDatabaseUrl } from "../src/lib/env";
import { getArtistCountry, getMbidFromSpotifyId, searchArtistCountryByName } from "../src/lib/musicbrainz/client";
import { getCountryBySpotifyId } from "../src/lib/wikidata/client";

config({ path: ".env" });

async function main() {
  const client = createDatabaseClient(getDirectDatabaseUrl());

  try {
    const rows = await client.db
      .select({ id: artists.id, spotifyArtistId: artists.spotifyArtistId, displayName: artists.displayName })
      .from(artists)
      .where(and(isNotNull(artists.spotifyArtistId), isNull(artists.country)));

    const needsCountry = rows.filter((r) => r.spotifyArtistId !== null);
    console.log(`Looking up country for ${needsCountry.length} artists via MusicBrainz...`);
    console.log("Estimated time: ~" + Math.ceil((needsCountry.length * 2) / 60) + " minutes\n");

    let updated = 0;
    let notFound = 0;

    for (const [i, row] of needsCountry.entries()) {
      const mbid = await getMbidFromSpotifyId(row.spotifyArtistId!);
      const mbCountry = mbid ? await getArtistCountry(mbid) : null;
      const wikidataCountry = mbCountry ?? await getCountryBySpotifyId(row.spotifyArtistId!);
      const country = wikidataCountry ?? await searchArtistCountryByName(row.displayName);

      if (country) {
        await client.db
          .update(artists)
          .set({ country, updatedAt: new Date() })
          .where(eq(artists.id, row.id));
        updated++;
      } else {
        notFound++;
      }

      if ((i + 1) % 50 === 0) {
        console.log(`  ${i + 1} / ${needsCountry.length} (${updated} updated, ${notFound} not found)`);
      }
    }

    console.log(`\nDone. Updated ${updated} artists. ${notFound} not found in MusicBrainz.`);
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

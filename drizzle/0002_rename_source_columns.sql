ALTER TABLE "artists" RENAME COLUMN "chartmasters_artist_key" TO "source_artist_key";--> statement-breakpoint
ALTER TABLE "artists" RENAME COLUMN "chartmasters_name" TO "source_artist_name";--> statement-breakpoint
ALTER TABLE "artists" RENAME COLUMN "chartmasters_url" TO "source_url";--> statement-breakpoint
ALTER TABLE "artists" RENAME CONSTRAINT "artists_chartmasters_artist_key_unique" TO "artists_source_artist_key_unique";--> statement-breakpoint
UPDATE "artists" SET "source_artist_key" = REPLACE("source_artist_key", 'chartmasters:', 'source:') WHERE "source_artist_key" LIKE 'chartmasters:%';

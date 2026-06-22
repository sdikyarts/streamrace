CREATE TABLE "artist_stream_current" (
	"artist_id" uuid PRIMARY KEY NOT NULL,
	"latest_snapshot_id" uuid,
	"source_date" date,
	"currently_ranked" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"first_seen_on" date,
	"last_seen_on" date,
	"dropped_out_on" date,
	"reentered_on" date,
	"all_credit_rank" integer,
	"previous_all_credit_rank" integer,
	"all_credit_rank_change" integer,
	"lead_rank_in_dataset" integer,
	"previous_lead_rank_in_dataset" integer,
	"lead_rank_change_in_dataset" integer,
	"raw_g_rank" integer,
	"previous_raw_g_rank" integer,
	"raw_g_rank_change" integer,
	"lead_streams" bigint,
	"previous_lead_streams" bigint,
	"lead_daily_gain" bigint,
	"non_lead_streams" bigint,
	"previous_non_lead_streams" bigint,
	"non_lead_daily_gain" bigint,
	"all_credit_streams" bigint,
	"previous_all_credit_streams" bigint,
	"all_credit_daily_gain" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_stream_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_run_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"source_date" date NOT NULL,
	"source_name" text DEFAULT 'chartmasters' NOT NULL,
	"source_table" text DEFAULT 'spotify_artists_all_credits' NOT NULL,
	"all_credit_rank" integer NOT NULL,
	"raw_g_rank" integer,
	"lead_rank_in_dataset" integer,
	"lead_streams" bigint NOT NULL,
	"non_lead_streams" bigint NOT NULL,
	"all_credit_streams" bigint NOT NULL,
	"raw_artist_name" text NOT NULL,
	"raw_artist_url" text,
	"raw_image_url" text,
	"raw_data_freshness_label" text,
	"gender" text,
	"language" text,
	"genre" text,
	"country" text,
	"row_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_stream_snapshots_artist_date_table_unique" UNIQUE("artist_id","source_date","source_table")
);
--> statement-breakpoint
CREATE TABLE "artist_top1000_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"entered_on" date NOT NULL,
	"exited_on" date,
	"entry_all_credit_rank" integer,
	"exit_all_credit_rank" integer,
	"is_open" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spotify_artist_id" text,
	"chartmasters_artist_key" text,
	"display_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"chartmasters_url" text,
	"image_url" text,
	"image_hash" text,
	"gender" text,
	"language" text,
	"genre" text,
	"country" text,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"metadata_checked_at" timestamp with time zone,
	"metadata_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artists_spotify_artist_id_unique" UNIQUE("spotify_artist_id"),
	CONSTRAINT "artists_chartmasters_artist_key_unique" UNIQUE("chartmasters_artist_key")
);
--> statement-breakpoint
CREATE TABLE "data_ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" text NOT NULL,
	"source_table" text NOT NULL,
	"source_url" text,
	"source_date" date NOT NULL,
	"status" text NOT NULL,
	"collection_method" text NOT NULL,
	"rows_found" integer DEFAULT 0 NOT NULL,
	"rows_inserted" integer DEFAULT 0 NOT NULL,
	"rows_updated" integer DEFAULT 0 NOT NULL,
	"rows_dropped_out" integer DEFAULT 0 NOT NULL,
	"rows_reentered" integer DEFAULT 0 NOT NULL,
	"anomalies_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "game_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"left_artist_id" uuid NOT NULL,
	"right_artist_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"left_streams" bigint NOT NULL,
	"right_streams" bigint NOT NULL,
	"left_rank" integer,
	"right_rank" integer,
	"player_guess" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"stream_gap" bigint NOT NULL,
	"dataset_source_date" date NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" text NOT NULL,
	"dataset_source_date" date NOT NULL,
	"dataset_source_table" text DEFAULT 'spotify_artists_all_credits' NOT NULL,
	"anonymous_id" text,
	"streak" integer DEFAULT 0 NOT NULL,
	"max_streak" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ingestion_anomalies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_run_id" uuid NOT NULL,
	"severity" text NOT NULL,
	"code" text NOT NULL,
	"row_number" integer,
	"artist_name" text,
	"message" text NOT NULL,
	"raw_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"player_name" text,
	"anonymous_id" text,
	"mode" text NOT NULL,
	"score" integer NOT NULL,
	"rounds_played" integer NOT NULL,
	"dataset_source_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artist_stream_current" ADD CONSTRAINT "artist_stream_current_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_stream_current" ADD CONSTRAINT "artist_stream_current_latest_snapshot_id_artist_stream_snapshots_id_fk" FOREIGN KEY ("latest_snapshot_id") REFERENCES "public"."artist_stream_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_stream_snapshots" ADD CONSTRAINT "artist_stream_snapshots_import_run_id_data_ingestion_runs_id_fk" FOREIGN KEY ("import_run_id") REFERENCES "public"."data_ingestion_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_stream_snapshots" ADD CONSTRAINT "artist_stream_snapshots_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_top1000_periods" ADD CONSTRAINT "artist_top1000_periods_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_left_artist_id_artists_id_fk" FOREIGN KEY ("left_artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_right_artist_id_artists_id_fk" FOREIGN KEY ("right_artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_anomalies" ADD CONSTRAINT "ingestion_anomalies_import_run_id_data_ingestion_runs_id_fk" FOREIGN KEY ("import_run_id") REFERENCES "public"."data_ingestion_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artist_stream_current_ranked_idx" ON "artist_stream_current" USING btree ("currently_ranked","all_credit_rank");--> statement-breakpoint
CREATE INDEX "artist_stream_current_all_credit_streams_idx" ON "artist_stream_current" USING btree ("all_credit_streams");--> statement-breakpoint
CREATE INDEX "artist_stream_current_lead_streams_idx" ON "artist_stream_current" USING btree ("lead_streams");--> statement-breakpoint
CREATE INDEX "artist_stream_snapshots_date_rank_idx" ON "artist_stream_snapshots" USING btree ("source_date","all_credit_rank");--> statement-breakpoint
CREATE INDEX "artist_stream_snapshots_artist_date_idx" ON "artist_stream_snapshots" USING btree ("artist_id","source_date");--> statement-breakpoint
CREATE INDEX "artist_top1000_periods_artist_open_idx" ON "artist_top1000_periods" USING btree ("artist_id","is_open");--> statement-breakpoint
CREATE INDEX "artists_normalized_name_idx" ON "artists" USING btree ("normalized_name");
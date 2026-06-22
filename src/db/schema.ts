import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const artists = pgTable(
  "artists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    spotifyArtistId: text("spotify_artist_id").unique(),
    chartmastersArtistKey: text("chartmasters_artist_key").unique(),
    displayName: text("display_name").notNull(),
    chartmastersName: text("chartmasters_name"),
    normalizedName: text("normalized_name").notNull(),
    chartmastersUrl: text("chartmasters_url"),
    imageUrl: text("image_url"),
    imageHash: text("image_hash"),
    gender: text("gender"),
    language: text("language"),
    genre: text("genre"),
    country: text("country"),
    isDisabled: boolean("is_disabled").notNull().default(false),
    metadataCheckedAt: timestamp("metadata_checked_at", { withTimezone: true }),
    metadataUpdatedAt: timestamp("metadata_updated_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("artists_normalized_name_idx").on(table.normalizedName)],
);

export const dataIngestionRuns = pgTable("data_ingestion_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceName: text("source_name").notNull(),
  sourceTable: text("source_table").notNull(),
  sourceUrl: text("source_url"),
  sourceDate: date("source_date", { mode: "string" }).notNull(),
  status: text("status").notNull(),
  collectionMethod: text("collection_method").notNull(),
  rowsFound: integer("rows_found").notNull().default(0),
  rowsInserted: integer("rows_inserted").notNull().default(0),
  rowsUpdated: integer("rows_updated").notNull().default(0),
  rowsDroppedOut: integer("rows_dropped_out").notNull().default(0),
  rowsReentered: integer("rows_reentered").notNull().default(0),
  anomaliesCount: integer("anomalies_count").notNull().default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const artistStreamSnapshots = pgTable(
  "artist_stream_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    importRunId: uuid("import_run_id")
      .notNull()
      .references(() => dataIngestionRuns.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    sourceDate: date("source_date", { mode: "string" }).notNull(),
    sourceName: text("source_name").notNull().default("chartmasters"),
    sourceTable: text("source_table")
      .notNull()
      .default("spotify_artists_all_credits"),
    allCreditRank: integer("all_credit_rank").notNull(),
    rawGRank: integer("raw_g_rank"),
    leadRankInDataset: integer("lead_rank_in_dataset"),
    leadStreams: bigint("lead_streams", { mode: "bigint" }).notNull(),
    nonLeadStreams: bigint("non_lead_streams", { mode: "bigint" }).notNull(),
    allCreditStreams: bigint("all_credit_streams", {
      mode: "bigint",
    }).notNull(),
    rawArtistName: text("raw_artist_name").notNull(),
    rawArtistUrl: text("raw_artist_url"),
    rawImageUrl: text("raw_image_url"),
    rawDataFreshnessLabel: text("raw_data_freshness_label"),
    gender: text("gender"),
    language: text("language"),
    genre: text("genre"),
    country: text("country"),
    rowHash: text("row_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("artist_stream_snapshots_artist_date_table_unique").on(
      table.artistId,
      table.sourceDate,
      table.sourceTable,
    ),
    index("artist_stream_snapshots_date_rank_idx").on(
      table.sourceDate,
      table.allCreditRank,
    ),
    index("artist_stream_snapshots_artist_date_idx").on(
      table.artistId,
      table.sourceDate,
    ),
  ],
);

export const artistStreamCurrent = pgTable(
  "artist_stream_current",
  {
    artistId: uuid("artist_id")
      .primaryKey()
      .references(() => artists.id, { onDelete: "cascade" }),
    latestSnapshotId: uuid("latest_snapshot_id").references(
      () => artistStreamSnapshots.id,
      { onDelete: "set null" },
    ),
    sourceDate: date("source_date", { mode: "string" }),
    currentlyRanked: boolean("currently_ranked").notNull().default(false),
    status: text("status").notNull().default("active"),
    firstSeenOn: date("first_seen_on", { mode: "string" }),
    lastSeenOn: date("last_seen_on", { mode: "string" }),
    droppedOutOn: date("dropped_out_on", { mode: "string" }),
    reenteredOn: date("reentered_on", { mode: "string" }),
    allCreditRank: integer("all_credit_rank"),
    previousAllCreditRank: integer("previous_all_credit_rank"),
    allCreditRankChange: integer("all_credit_rank_change"),
    leadRankInDataset: integer("lead_rank_in_dataset"),
    previousLeadRankInDataset: integer("previous_lead_rank_in_dataset"),
    leadRankChangeInDataset: integer("lead_rank_change_in_dataset"),
    rawGRank: integer("raw_g_rank"),
    previousRawGRank: integer("previous_raw_g_rank"),
    rawGRankChange: integer("raw_g_rank_change"),
    leadStreams: bigint("lead_streams", { mode: "bigint" }),
    previousLeadStreams: bigint("previous_lead_streams", { mode: "bigint" }),
    leadDailyGain: bigint("lead_daily_gain", { mode: "bigint" }),
    nonLeadStreams: bigint("non_lead_streams", { mode: "bigint" }),
    previousNonLeadStreams: bigint("previous_non_lead_streams", {
      mode: "bigint",
    }),
    nonLeadDailyGain: bigint("non_lead_daily_gain", { mode: "bigint" }),
    allCreditStreams: bigint("all_credit_streams", { mode: "bigint" }),
    previousAllCreditStreams: bigint("previous_all_credit_streams", {
      mode: "bigint",
    }),
    allCreditDailyGain: bigint("all_credit_daily_gain", { mode: "bigint" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("artist_stream_current_ranked_idx").on(
      table.currentlyRanked,
      table.allCreditRank,
    ),
    index("artist_stream_current_all_credit_streams_idx").on(
      table.allCreditStreams,
    ),
    index("artist_stream_current_lead_streams_idx").on(table.leadStreams),
  ],
);

export const artistTop1000Periods = pgTable(
  "artist_top1000_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    enteredOn: date("entered_on", { mode: "string" }).notNull(),
    exitedOn: date("exited_on", { mode: "string" }),
    entryAllCreditRank: integer("entry_all_credit_rank"),
    exitAllCreditRank: integer("exit_all_credit_rank"),
    isOpen: boolean("is_open").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("artist_top1000_periods_artist_open_idx").on(
      table.artistId,
      table.isOpen,
    ),
  ],
);

export const ingestionAnomalies = pgTable("ingestion_anomalies", {
  id: uuid("id").defaultRandom().primaryKey(),
  importRunId: uuid("import_run_id")
    .notNull()
    .references(() => dataIngestionRuns.id, { onDelete: "cascade" }),
  severity: text("severity").notNull(),
  code: text("code").notNull(),
  rowNumber: integer("row_number"),
  artistName: text("artist_name"),
  message: text("message").notNull(),
  rawValue: text("raw_value"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const gameSessions = pgTable("game_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  mode: text("mode").notNull(),
  datasetSourceDate: date("dataset_source_date", { mode: "string" }).notNull(),
  datasetSourceTable: text("dataset_source_table")
    .notNull()
    .default("spotify_artists_all_credits"),
  anonymousId: text("anonymous_id"),
  streak: integer("streak").notNull().default(0),
  maxStreak: integer("max_streak").notNull().default(0),
  status: text("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const gameRounds = pgTable("game_rounds", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => gameSessions.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  leftArtistId: uuid("left_artist_id")
    .notNull()
    .references(() => artists.id),
  rightArtistId: uuid("right_artist_id")
    .notNull()
    .references(() => artists.id),
  mode: text("mode").notNull(),
  leftStreams: bigint("left_streams", { mode: "bigint" }).notNull(),
  rightStreams: bigint("right_streams", { mode: "bigint" }).notNull(),
  leftRank: integer("left_rank"),
  rightRank: integer("right_rank"),
  playerGuess: text("player_guess").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  streamGap: bigint("stream_gap", { mode: "bigint" }).notNull(),
  datasetSourceDate: date("dataset_source_date", { mode: "string" }).notNull(),
  answeredAt: timestamp("answered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const leaderboardEntries = pgTable("leaderboard_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").references(() => gameSessions.id, {
    onDelete: "set null",
  }),
  playerName: text("player_name"),
  anonymousId: text("anonymous_id"),
  mode: text("mode").notNull(),
  score: integer("score").notNull(),
  roundsPlayed: integer("rounds_played").notNull(),
  datasetSourceDate: date("dataset_source_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Artist = typeof artists.$inferSelect;
export type NewArtist = typeof artists.$inferInsert;
export type DataIngestionRun = typeof dataIngestionRuns.$inferSelect;
export type NewDataIngestionRun = typeof dataIngestionRuns.$inferInsert;
export type ArtistStreamSnapshot = typeof artistStreamSnapshots.$inferSelect;
export type NewArtistStreamSnapshot = typeof artistStreamSnapshots.$inferInsert;
export type ArtistStreamCurrent = typeof artistStreamCurrent.$inferSelect;
export type NewArtistStreamCurrent = typeof artistStreamCurrent.$inferInsert;

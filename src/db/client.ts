import { Pool, type PoolConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import { getRuntimeDatabaseUrl } from "../lib/env";
import * as schema from "./schema";

export type StreamRaceDb = NeonDatabase<typeof schema>;

export type DatabaseClient = {
  db: StreamRaceDb;
  pool: Pool;
  close: () => Promise<void>;
};

const DATABASE_POOL_OPTIONS = {
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  query_timeout: 8_000,
  statement_timeout: 8_000,
} satisfies Pick<
  PoolConfig,
  | "max"
  | "idleTimeoutMillis"
  | "connectionTimeoutMillis"
  | "query_timeout"
  | "statement_timeout"
>;

declare global {
  var streamRaceDatabaseClient: DatabaseClient | undefined;
}

export function createDatabaseClient(connectionString: string): DatabaseClient {
  const pool = new Pool({ connectionString, ...DATABASE_POOL_OPTIONS });

  return {
    db: drizzle(pool, { schema }),
    pool,
    close: () => pool.end(),
  };
}

export function getDatabaseClient() {
  globalThis.streamRaceDatabaseClient ??= createDatabaseClient(
    getRuntimeDatabaseUrl(),
  );

  return globalThis.streamRaceDatabaseClient;
}

export function getDb() {
  return getDatabaseClient().db;
}

import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import { getRuntimeDatabaseUrl } from "../lib/env";
import * as schema from "./schema";

export type StreamRaceDb = NeonDatabase<typeof schema>;

export type DatabaseClient = {
  db: StreamRaceDb;
  pool: Pool;
  close: () => Promise<void>;
};

declare global {
  var streamRaceDatabaseClient: DatabaseClient | undefined;
}

export function createDatabaseClient(connectionString: string): DatabaseClient {
  const pool = new Pool({ connectionString });

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

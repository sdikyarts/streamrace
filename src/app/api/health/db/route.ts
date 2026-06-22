import { and, count, desc, eq, isNotNull, sql } from "drizzle-orm";

import { getDatabaseClient } from "@/db/client";
import {
  artists,
  artistStreamCurrent,
  dataIngestionRuns,
} from "@/db/schema";
import {
  CHARTMASTERS_ALL_CREDITS_SOURCE_TABLE,
  CHARTMASTERS_SOURCE_NAME,
} from "@/lib/chartmasters/types";

export const runtime = "nodejs";

function getAppEnv() {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

function unavailableResponse(message: string) {
  return Response.json(
    {
      ok: false,
      appEnv: getAppEnv(),
      database: {
        configured: Boolean(process.env.DATABASE_URL),
        connected: false,
      },
      latestSuccessfulImport: null,
      currentRankedArtists: 0,
      playableArtists: 0,
      message,
    },
    { status: 503 },
  );
}

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return unavailableResponse("DATABASE_URL is not configured.");
  }

  try {
    const { db } = getDatabaseClient();

    await db.execute(sql`select 1`);

    const [latestSuccessfulImport] = await db
      .select({
        sourceName: dataIngestionRuns.sourceName,
        sourceTable: dataIngestionRuns.sourceTable,
        sourceDate: dataIngestionRuns.sourceDate,
        rowsFound: dataIngestionRuns.rowsFound,
        rowsInserted: dataIngestionRuns.rowsInserted,
        rowsUpdated: dataIngestionRuns.rowsUpdated,
        rowsDroppedOut: dataIngestionRuns.rowsDroppedOut,
        rowsReentered: dataIngestionRuns.rowsReentered,
        anomaliesCount: dataIngestionRuns.anomaliesCount,
        status: dataIngestionRuns.status,
        collectionMethod: dataIngestionRuns.collectionMethod,
        startedAt: dataIngestionRuns.startedAt,
        finishedAt: dataIngestionRuns.finishedAt,
      })
      .from(dataIngestionRuns)
      .where(
        and(
          eq(dataIngestionRuns.sourceName, CHARTMASTERS_SOURCE_NAME),
          eq(
            dataIngestionRuns.sourceTable,
            CHARTMASTERS_ALL_CREDITS_SOURCE_TABLE,
          ),
          eq(dataIngestionRuns.status, "success"),
        ),
      )
      .orderBy(desc(dataIngestionRuns.finishedAt), desc(dataIngestionRuns.id))
      .limit(1);

    const [rankedCount] = await db
      .select({ value: count() })
      .from(artistStreamCurrent)
      .where(eq(artistStreamCurrent.currentlyRanked, true));
    const [playableCount] = await db
      .select({ value: count() })
      .from(artistStreamCurrent)
      .innerJoin(artists, eq(artists.id, artistStreamCurrent.artistId))
      .where(
        and(
          eq(artistStreamCurrent.currentlyRanked, true),
          eq(artists.isDisabled, false),
          isNotNull(artistStreamCurrent.leadStreams),
          isNotNull(artistStreamCurrent.allCreditStreams),
        ),
      );
    const currentRankedArtists = rankedCount?.value ?? 0;
    const playableArtists = playableCount?.value ?? 0;
    const ok =
      Boolean(latestSuccessfulImport) &&
      currentRankedArtists >= 900 &&
      playableArtists >= 900;

    return Response.json(
      {
        ok,
        appEnv: getAppEnv(),
        database: {
          configured: true,
          connected: true,
        },
        latestSuccessfulImport: latestSuccessfulImport ?? null,
        currentRankedArtists,
        playableArtists,
      },
      { status: ok ? 200 : 503 },
    );
  } catch {
    return unavailableResponse("Database connectivity check failed.");
  }
}

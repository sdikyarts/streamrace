import { and, eq, isNotNull } from 'drizzle-orm'

import { getDb } from '@/db/client'
import { artists, artistStreamCurrent } from '@/db/schema'

export type GameMode = 'all-credits' | 'lead-streams'

export type GameArtist = {
  name: string
  imageUrl: string
  streams: number
}

export async function getGameArtists(mode: GameMode): Promise<GameArtist[]> {
  const db = getDb()
  const streamsCol =
    mode === 'all-credits'
      ? artistStreamCurrent.allCreditStreams
      : artistStreamCurrent.leadStreams

  const rows = await db
    .select({
      name: artists.displayName,
      imageUrl: artists.imageUrl,
      streams: streamsCol,
    })
    .from(artists)
    .innerJoin(artistStreamCurrent, eq(artists.id, artistStreamCurrent.artistId))
    .where(and(isNotNull(artists.imageUrl), isNotNull(streamsCol)))

  return rows
    .filter(row => row.imageUrl != null && row.streams != null)
    .map(row => ({
      name: row.name,
      imageUrl: row.imageUrl!,
      streams: Number(row.streams),
    }))
}

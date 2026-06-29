import { and, desc, eq, isNotNull } from 'drizzle-orm'

import { getDb } from '@/db/client'
import { artists, artistStreamCurrent } from '@/db/schema'

export type GameMode = 'all-credits' | 'lead-streams'

export type GameArtist = {
  name: string
  imageUrl: string
  streams: number
}

export const MAX_GAME_ARTISTS = 1000

const GAME_ARTISTS_CACHE_TTL_MS = 5 * 60 * 1000

type CachedGameArtists = {
  artists: GameArtist[]
  expiresAt: number
  pending?: Promise<GameArtist[]>
}

const cacheByMode = new Map<GameMode, CachedGameArtists>()

export function clearGameArtistsCacheForTests() {
  cacheByMode.clear()
}

export async function getGameArtists(mode: GameMode): Promise<GameArtist[]> {
  const now = Date.now()
  const cached = cacheByMode.get(mode)

  if (cached?.artists.length && cached.expiresAt > now) {
    return cached.artists
  }

  if (cached?.pending) {
    return cached.pending
  }

  const pending = loadGameArtists(mode)
    .then(artists => {
      cacheByMode.set(mode, {
        artists,
        expiresAt: Date.now() + GAME_ARTISTS_CACHE_TTL_MS,
      })
      return artists
    })
    .catch(error => {
      cacheByMode.delete(mode)
      throw error
    })

  cacheByMode.set(mode, {
    artists: cached?.artists ?? [],
    expiresAt: cached?.expiresAt ?? 0,
    pending,
  })

  return pending
}

async function loadGameArtists(mode: GameMode): Promise<GameArtist[]> {
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
    .where(
      and(
        eq(artistStreamCurrent.currentlyRanked, true),
        eq(artists.isDisabled, false),
        isNotNull(artists.imageUrl),
        isNotNull(streamsCol),
      ),
    )
    .orderBy(desc(streamsCol))
    .limit(MAX_GAME_ARTISTS)

  return rows
    .filter(row => row.imageUrl != null && row.streams != null)
    .map(row => ({
      name: row.name,
      imageUrl: row.imageUrl!,
      streams: Number(row.streams),
    }))
}

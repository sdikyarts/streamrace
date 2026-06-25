import { connection } from 'next/server'

import GameUI from '../GameUI'
import { getGameArtists } from '@/lib/game-artists'

export const runtime = 'nodejs'

export default async function LeadStreamsPage() {
  await connection()

  let initialArtists: Awaited<ReturnType<typeof getGameArtists>> = []

  try {
    initialArtists = await getGameArtists('lead-streams')
  } catch (error) {
    console.error('Failed to load lead-streams game artists.', error)
  }

  return <GameUI mode="lead-streams" initialArtists={initialArtists} />
}

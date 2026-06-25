import { connection } from 'next/server'

import GameUI from '../GameUI'
import { getGameArtists } from '@/lib/game-artists'

export const runtime = 'nodejs'

export default async function AllCreditsPage() {
  await connection()

  let initialArtists: Awaited<ReturnType<typeof getGameArtists>> = []

  try {
    initialArtists = await getGameArtists('all-credits')
  } catch (error) {
    console.error('Failed to load all-credits game artists.', error)
  }

  return <GameUI mode="all-credits" initialArtists={initialArtists} />
}

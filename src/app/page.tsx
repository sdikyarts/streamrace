import { connection } from 'next/server'

import LandingPage from './LandingPage'
import { getArtistImages } from '@/lib/artist-images'

export const runtime = 'nodejs'

export default async function Home() {
  await connection()

  let initialArtists: Awaited<ReturnType<typeof getArtistImages>> = []

  try {
    initialArtists = await getArtistImages()
  } catch (error) {
    console.error('Failed to load initial artist slideshow images.', error)
  }

  return <LandingPage initialArtists={initialArtists} />
}

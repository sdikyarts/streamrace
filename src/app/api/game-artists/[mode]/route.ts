import { getGameArtists, type GameMode } from '@/lib/game-artists'

export const runtime = 'nodejs'

const VALID_MODES = new Set<GameMode>(['all-credits', 'lead-streams'])

function isGameMode(mode: string): mode is GameMode {
  return VALID_MODES.has(mode as GameMode)
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ mode: string }> },
) {
  const { mode } = await params
  if (!isGameMode(mode)) {
    return Response.json({ error: 'Invalid mode' }, { status: 400 })
  }

  try {
    return Response.json(
      { artists: await getGameArtists(mode) },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      },
    )
  } catch (error) {
    console.error(`Failed to load ${mode} game artists.`, error)
    return Response.json(
      { artists: [], error: 'Failed to load artists' },
      { status: 503 },
    )
  }
}

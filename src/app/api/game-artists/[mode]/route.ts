import { getGameArtists, type GameMode } from '@/lib/game-artists'

export const runtime = 'nodejs'

const VALID_MODES: GameMode[] = ['all-credits', 'lead-streams']

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ mode: string }> },
) {
  const { mode } = await params
  if (!VALID_MODES.includes(mode as GameMode)) {
    return Response.json({ error: 'Invalid mode' }, { status: 400 })
  }
  return Response.json({ artists: await getGameArtists(mode as GameMode) })
}

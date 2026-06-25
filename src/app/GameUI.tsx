'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { GameArtist, GameMode } from '@/lib/game-artists'

// ── helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function formatStreams(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return n.toLocaleString()
}

const HS_KEY = (mode: GameMode) => `sr:hs:${mode}`

// ── icons ─────────────────────────────────────────────────────────────────────

function BurstSpeedIcon({ size = '0.9em' }: { size?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 22 28"
      fill="none"
      style={{ height: size, width: 'auto', display: 'block', flexShrink: 0 }}
    >
      <path d="M13 0L0 15h8L6 28L22 11h-9L13 0Z" fill="#FFFBF7" />
    </svg>
  )
}

// Reuse the two landing-page icons exactly
function RadioWavesIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 26" fill="none" style={{ height: '0.9em', width: 'auto', display: 'block', flexShrink: 0 }}>
      <path d="M5.24959 0C3.58338 1.66156 2.26187 3.63596 1.36098 5.80978C0.460092 7.98359 -0.00242127 10.314 9.53196e-06 12.6671C9.53196e-06 17.6121 2.00668 22.0912 5.24959 25.3342L7.77584 22.8079C6.44042 21.4794 5.38216 19.8988 4.66246 18.158C3.94276 16.4172 3.57596 14.5508 3.58334 12.6671C3.58334 8.7075 5.17793 5.10625 7.77584 2.52625L5.24959 0ZM30.5838 0L28.0575 2.52625C29.3913 3.85599 30.4485 5.43676 31.1681 7.1773C31.8877 8.91784 32.2554 10.7837 32.25 12.6671C32.25 16.6446 30.6554 20.2279 28.0575 22.8079L30.5838 25.3342C32.25 23.6726 33.5715 21.6982 34.4724 19.5244C35.3733 17.3506 35.8358 15.0202 35.8333 12.6671C35.8333 7.72208 33.8267 3.24292 30.5838 0ZM10.32 5.07042C9.3199 6.06652 8.52648 7.25042 7.98533 8.5541C7.44417 9.85778 7.16596 11.2555 7.16668 12.6671C7.16668 15.6233 8.36709 18.3108 10.32 20.2637L12.8463 17.7375C12.1809 17.0714 11.6534 16.2808 11.2937 15.4108C10.934 14.5408 10.7493 13.6085 10.75 12.6671C10.75 10.6783 11.5563 8.88667 12.8463 7.59667L10.32 5.07042ZM25.5133 5.07042L22.9871 7.59667C23.6524 8.26272 24.18 9.05333 24.5396 9.92333C24.8993 10.7933 25.0841 11.7257 25.0833 12.6671C25.0833 14.6558 24.2771 16.4475 22.9871 17.7375L25.5133 20.2637C26.5134 19.2676 27.3069 18.0837 27.848 16.7801C28.3892 15.4764 28.6674 14.0786 28.6667 12.6671C28.6667 9.71083 27.4663 7.02333 25.5133 5.07042ZM17.9167 9.08375C16.9663 9.08375 16.0549 9.46128 15.3829 10.1333C14.7109 10.8053 14.3333 11.7167 14.3333 12.6671C14.3333 13.6174 14.7109 14.5289 15.3829 15.2009C16.0549 15.8729 16.9663 16.2504 17.9167 16.2504C18.867 16.2504 19.7785 15.8729 20.4505 15.2009C21.1225 14.5289 21.5 13.6174 21.5 12.6671C21.5 11.7167 21.1225 10.8053 20.4505 10.1333C19.7785 9.46128 18.867 9.08375 17.9167 9.08375Z" fill="#FFFBF7"/>
    </svg>
  )
}

function PinIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 33" fill="none" style={{ height: '0.9em', width: 'auto', display: 'block', flexShrink: 0 }}>
      <path d="M16.1525 0C9.39791 0 3.95124 5.28542 3.61082 11.9325L0.170822 16.4654C-0.259178 17.0208 0.170822 17.9167 0.923322 17.9167H3.61082V23.2917C3.61082 25.2804 5.2054 26.875 7.19415 26.875H8.98582V32.25H21.5275V23.8471C25.7737 21.8404 28.6942 17.5583 28.6942 12.5417C28.6942 5.62583 23.1042 0 16.1525 0ZM15.2029 17.9167L8.98582 11.6458L11.4942 9.11958L15.2029 12.8462L22.6025 5.375L25.1108 7.90125L15.2029 17.9167Z" fill="#FFFBF7"/>
    </svg>
  )
}

// ── types ─────────────────────────────────────────────────────────────────────

type Phase = 'playing' | 'reveal' | 'transitioning' | 'gameover'

interface ArtistState {
  artist: GameArtist
  key: number  // force remount on change
}

// ── artist panel ──────────────────────────────────────────────────────────────

function ArtistPanel({
  artist,
  position,
  streamsLabel,
  showStreams,
}: {
  artist: GameArtist
  position: 'left' | 'right'
  streamsLabel: string
  showStreams: boolean
}) {
  const [hoverName, setHoverName] = useState(false)
  const [hoverStreams, setHoverStreams] = useState(false)

  const maskStyle: React.CSSProperties =
    position === 'left'
      ? {
          maskImage: 'linear-gradient(to left, transparent 0%, rgba(0,0,0,0.05) 5%, rgba(0,0,0,0.45) 20%, black 38%)',
          WebkitMaskImage: 'linear-gradient(to left, transparent 0%, rgba(0,0,0,0.05) 5%, rgba(0,0,0,0.45) 20%, black 38%)',
        }
      : {
          maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.05) 5%, rgba(0,0,0,0.45) 20%, black 38%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.05) 5%, rgba(0,0,0,0.45) 20%, black 38%)',
        }

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Photo */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${artist.imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      />
      {/* Edge fade toward center */}
      <div className="absolute inset-0" style={maskStyle} />
      {/* Dark bottom scrim for labels */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 30%, transparent 55%)',
        }}
      />

      {/* Artist name label */}
      <div
        className="absolute z-[2]"
        style={{
          bottom: 80,
          [position === 'left' ? 'left' : 'right']: 20,
          backgroundColor: 'white',
          padding: '0.6vh 0.9vw',
          fontFamily: 'var(--font-helvetica)',
          fontWeight: 700,
          fontStyle: 'italic',
          fontSize: 'clamp(16px, 2vw, 32px)',
          userSelect: 'none',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
          transformOrigin: position === 'left' ? 'left top' : 'right top',
          transform: hoverName ? 'scale(1.06)' : 'scale(1)',
          transition: 'transform 0.2s ease',
          cursor: 'default',
        }}
        onMouseEnter={() => setHoverName(true)}
        onMouseLeave={() => setHoverName(false)}
      >
        <span
          style={{
            display: 'inline-block',
            backgroundImage: 'linear-gradient(to right, #800C81, #E71616, #BEA500, #E71616, #800C81)',
            backgroundSize: '200% 100%',
            backgroundPosition: hoverName ? '100% 0%' : '0% 0%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            transition: 'background-position 0.5s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {artist.name}
        </span>
      </div>

      {/* Stream count — only shown for Artist 1, or after reveal for Artist 2 */}
      {showStreams && (
        <div
          className="absolute z-[2] flex items-center justify-between"
          style={{
            bottom: 24,
            [position === 'left' ? 'left' : 'right']: 20,
            background: 'linear-gradient(to right, #800C81, #E71616, #BEA500, #E71616, #800C81)',
            backgroundSize: '200% 100%',
            backgroundPosition: hoverStreams ? '100% 0%' : '0% 0%',
            transition: 'background-position 0.5s ease, transform 0.2s ease',
            padding: '0.55vh 0.75vw',
            color: '#FFFBF7',
            fontFamily: 'var(--font-helvetica)',
            fontWeight: 700,
            fontStyle: 'italic',
            fontSize: 'clamp(13px, 1.5vw, 25px)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
            gap: '0.5em',
            userSelect: 'none',
            transformOrigin: 'center center',
            transform: hoverStreams ? 'scale(1.06)' : 'scale(1)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={() => setHoverStreams(true)}
          onMouseLeave={() => setHoverStreams(false)}
        >
          <span>{streamsLabel}</span>
          <BurstSpeedIcon />
        </div>
      )}
    </div>
  )
}

// ── score box ─────────────────────────────────────────────────────────────────

function ScoreBox({
  label,
  value,
  corner,
}: {
  label: string
  value: number
  corner: 'top-right' | 'top-left'
}) {
  const [hovered, setHovered] = useState(false)
  const origin = corner === 'top-right' ? 'top right' : 'top left'

  const sharedBox: React.CSSProperties = {
    fontFamily: 'var(--font-helvetica)',
    fontWeight: 700,
    fontStyle: 'italic',
    color: '#FFFBF7',
    backgroundColor: '#111111',
    boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
    padding: '0.4vh 0.75vw',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    fontSize: 'clamp(11px, 1.15vw, 18px)',
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        transformOrigin: origin,
        transform: hovered ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform 0.2s ease',
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={sharedBox}>{label}</div>
      <div style={sharedBox}>{value.toLocaleString()}</div>
    </div>
  )
}

// ── result circle ─────────────────────────────────────────────────────────────

function ResultCircle({ correct, visible }: { correct: boolean; visible: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${visible ? 1 : 0})`,
        transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        width: 160,
        height: 160,
        borderRadius: '50%',
        backgroundColor: '#0e0e0e',
        border: `5px solid ${correct ? '#22c55e' : '#ef4444'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        boxShadow: `0 0 40px ${correct ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
        pointerEvents: 'none',
      }}
    >
      {correct ? (
        <svg viewBox="0 0 52 52" fill="none" style={{ width: 72, height: 72 }}>
          <path d="M10 26L22 38L42 16" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 52 52" fill="none" style={{ width: 72, height: 72 }}>
          <path d="M16 16L36 36M36 16L16 36" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" />
        </svg>
      )}
    </div>
  )
}

// ── comparison buttons ────────────────────────────────────────────────────────

function GuessButton({
  label,
  icon,
  gradient,
  onClick,
  disabled,
}: {
  label: string
  icon: React.ReactNode
  gradient: string
  onClick: () => void
  disabled: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center justify-between w-full text-[#FFFBF7] cursor-pointer zoom-el"
      style={{
        background: gradient,
        backgroundSize: '300% 100%',
        backgroundPosition: hovered ? '65% 0%' : '0% 0%',
        transition: 'background-position 0.5s ease, transform 0.2s ease',
        fontSize: 'clamp(13px, 1.5vw, 25px)',
        padding: '0.75vh 0.75vw',
        border: 'none',
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
        fontFamily: 'var(--font-helvetica)',
        fontWeight: 700,
        fontStyle: 'italic',
        opacity: disabled ? 0.5 : 1,
        transformOrigin: 'left center',
      }}
    >
      <span className="whitespace-nowrap">{label}</span>
      {icon}
    </button>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function GameUI({
  mode,
  initialArtists,
}: {
  mode: GameMode
  initialArtists: GameArtist[]
}) {
  const router = useRouter()

  const [pool, setPool] = useState<GameArtist[]>([])
  const [left, setLeft] = useState<ArtistState | null>(null)
  const [right, setRight] = useState<ArtistState | null>(null)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [phase, setPhase] = useState<Phase>('playing')
  const [lastCorrect, setLastCorrect] = useState(true)
  const [rightRevealed, setRightRevealed] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  // track which direction the left panel slides in from
  const [leftAnim, setLeftAnim] = useState<'left' | 'right'>('left')

  const keyGen = useRef(0)
  const nextKey = () => ++keyGen.current

  // pick an artist from pool that isn't currently displayed
  const pickRandom = useCallback(
    (exclude: GameArtist[], fromPool: GameArtist[]): GameArtist => {
      const excludedNames = new Set(exclude.map(a => a.name))
      const filtered = fromPool.filter(a => !excludedNames.has(a.name))
      return filtered[Math.floor(Math.random() * filtered.length)] ?? fromPool[0]
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000)

    const seedArtists = (artists: GameArtist[]) => {
      const valid = artists.filter(a => a.streams > 0)
      const shuffled = shuffle(valid)
      setPool(shuffled)
      if (shuffled.length >= 2) {
        setLeft({ artist: shuffled[0], key: nextKey() })
        setRight({ artist: shuffled[1], key: nextKey() })
      }
    }

    setLoadError(null)
    seedArtists(initialArtists ?? [])
    setHighScore(parseInt(localStorage.getItem(HS_KEY(mode)) ?? '0', 10))

    fetch(`/api/game-artists/${mode}`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) {
          throw new Error(`Artist request failed with ${r.status}`)
        }
        return r.json()
      })
      .then(({ artists: fetched }: { artists: GameArtist[] }) => {
        if (cancelled) return
        const v = fetched.filter((a: GameArtist) => a.streams > 0)
        const shuffled = shuffle(v)
        setPool(shuffled)
        if (shuffled.length >= 2) {
          setLeft({ artist: shuffled[0], key: nextKey() })
          setRight({ artist: shuffled[1], key: nextKey() })
        } else {
          setLoadError('Not enough playable artists yet.')
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[GameUI] Failed to fetch artists:', err)
        setLoadError('Failed to load artists. Check server logs.')
      })
      .finally(() => {
        window.clearTimeout(timeoutId)
      })

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialArtists, mode])

  function handleGuess(guess: 'higher' | 'lower') {
    if (phase !== 'playing' || !left || !right) return

    const leftStreams = left.artist.streams
    const rightStreams = right.artist.streams
    const correct =
      guess === 'higher' ? rightStreams > leftStreams : rightStreams < leftStreams

    setRightRevealed(true)
    setLastCorrect(correct)
    setPhase('reveal')

    if (correct) {
      const newScore = score + 1
      setScore(newScore)
      if (newScore > highScore) {
        setHighScore(newScore)
        localStorage.setItem(HS_KEY(mode), String(newScore))
      }

      setTimeout(() => {
        setPhase('transitioning')
        const next = pickRandom([left.artist, right.artist], pool)

        if (leftStreams > rightStreams) {
          // Artist 1 stays, new Artist 2
          setRight({ artist: next, key: nextKey() })
        } else {
          // Artist 2 slides left to become Artist 1, new Artist 2
          setLeftAnim('right')
          setLeft({ artist: right.artist, key: nextKey() })
          setRight({ artist: next, key: nextKey() })
        }

        setRightRevealed(false)
        setTimeout(() => setPhase('playing'), 300)
      }, 1600)
    } else {
      setTimeout(() => {
        setPhase('gameover')
        setTimeout(() => router.push('/'), 1200)
      }, 1600)
    }
  }

  const modeLabel = mode === 'all-credits' ? 'All-Credits Streams' : 'Lead Streams'
  const busy = phase !== 'playing'

  if (!left || !right) {
    return (
      <div className="relative w-screen h-screen bg-[#0e0e0e] flex items-center justify-center">
        <span style={{ color: '#FFFBF7', fontFamily: 'var(--font-helvetica)', fontStyle: 'italic' }}>
          {loadError ?? 'Loading...'}
        </span>
      </div>
    )
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0e0e0e]">
      <style>{`
        @keyframes flyInEl {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .zoom-el {
          transform-origin: left center;
          transition: transform 0.2s ease;
        }
        .zoom-el:hover {
          transform: scale(1.06);
        }
        @keyframes panelFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideFromRight {
          from { transform: translateX(60%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideFromLeft {
          from { transform: translateX(-60%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      {/* ── Two artist panels ── */}
      <div className="absolute inset-0 flex">
        {/* LEFT — Artist 1 */}
        <div className="relative w-1/2 h-full overflow-hidden">
          {/* Animated photo + labels */}
          <div
            key={`left-${left.key}`}
            className="absolute inset-0"
            style={{ animation: `${leftAnim === 'right' ? 'slideFromRight' : 'slideFromLeft'} 0.4s ease` }}
          >
            <ArtistPanel
              artist={left.artist}
              position="left"
              streamsLabel={formatStreams(left.artist.streams)}
              showStreams
            />
          </div>

          {/* High Score — top-right of left panel (near center divide) */}
          <div
            className="absolute z-[5]"
            style={{ top: 20, right: 16 }}
          >
            <ScoreBox label="HIGH SCORE" value={highScore} corner="top-right" />
          </div>
        </div>

        {/* RIGHT — Artist 2 */}
        <div className="relative w-1/2 h-full overflow-hidden">
          {/* Animated photo + labels */}
          <div
            key={`right-${right.key}`}
            className="absolute inset-0"
            style={{ animation: 'slideFromRight 0.4s ease' }}
          >
            <ArtistPanel
              artist={right.artist}
              position="right"
              streamsLabel={formatStreams(right.artist.streams)}
              showStreams={rightRevealed}
            />
          </div>

          {/* Current Score — top-left of right panel (near center divide) */}
          <div
            className="absolute z-[5]"
            style={{ top: 20, left: 16 }}
          >
            <ScoreBox label="CURRENT SCORE" value={score} corner="top-left" />
          </div>

          {/* Guess buttons — bottom of right panel */}
          <div
            className="absolute z-[5]"
            style={{
              bottom: 24,
              left: 20,
              width: 'clamp(180px, 18.5vw, 350px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2vh',
            }}
          >
            <GuessButton
              label={`HIGHER ${modeLabel.toUpperCase()}`}
              icon={<RadioWavesIcon />}
              gradient="linear-gradient(to right, #E71616, #E71616 33%, #BEA500 100%)"
              onClick={() => handleGuess('higher')}
              disabled={busy}
            />
            <GuessButton
              label={`LOWER ${modeLabel.toUpperCase()}`}
              icon={<PinIcon />}
              gradient="linear-gradient(to right, #800C81, #800C81 33%, #E71616 100%)"
              onClick={() => handleGuess('lower')}
              disabled={busy}
            />
          </div>
        </div>
      </div>

      {/* ── Center divider line ── */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none z-[10]"
        style={{ left: '50%', transform: 'translateX(-50%)', width: 2, background: 'rgba(255,255,255,0.08)' }}
      />

      {/* ── Result circle ── */}
      <div className="absolute inset-0 pointer-events-none z-[15]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ResultCircle correct={lastCorrect} visible={phase === 'reveal' || phase === 'gameover'} />
      </div>

      {/* ── Game over overlay ── */}
      {phase === 'gameover' && (
        <div
          className="absolute inset-0 z-[25] flex flex-col items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          <p
            style={{
              fontFamily: 'var(--font-helvetica)',
              fontWeight: 700,
              fontStyle: 'italic',
              color: '#FFFBF7',
              fontSize: 'clamp(28px, 4vw, 64px)',
              textShadow: '0 2px 20px rgba(0,0,0,0.8)',
              marginBottom: '0.5em',
            }}
          >
            GAME OVER
          </p>
          <p
            style={{
              fontFamily: 'var(--font-helvetica)',
              fontStyle: 'italic',
              color: '#FFFBF7',
              fontSize: 'clamp(14px, 1.5vw, 24px)',
              opacity: 0.7,
            }}
          >
            Score: {score}
          </p>
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { GameArtist, GameMode } from '@/lib/game-artists'

// Module-level constant — same reference every render, React never patches the DOM node.
const GAME_STYLES = `
@keyframes srSlideFromRight {
  from { transform: translateX(60%); opacity: 0; }
  to   { transform: translateX(0);   opacity: 1; }
}
@keyframes srSlideFromLeft {
  from { transform: translateX(-60%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
.sr-name-box {
  overflow: visible;
  transition: transform 0.25s cubic-bezier(0.22,1,0.36,1);
  transform-origin: center;
  cursor: default;
  will-change: transform;
}
.sr-name-box:hover { transform: scale(1.06); }
.sr-name-text {
  display: block;
  text-align: center;
  background-image: linear-gradient(to right, #800C81, #E71616, #BEA500, #E71616, #800C81);
  background-size: 200% 100%;
  background-position: 0% 0%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  transition: background-position 0.5s ease;
  padding-top: 0.15em;
  padding-bottom: 0.12em;
  padding-right: 0.15em;
  padding-left: 0.15em;
}
.sr-name-box:hover .sr-name-text { background-position: 100% 0%; }
.sr-stream {
  background-position: 0% 0%;
  transition: background-position 0.5s ease, transform 0.25s cubic-bezier(0.22,1,0.36,1);
  transform-origin: center;
  cursor: default;
  will-change: transform;
}
.sr-stream:hover { background-position: 100% 0%; transform: scale(1.06); }
.sr-desc {
  transition: transform 0.25s cubic-bezier(0.22,1,0.36,1);
  transform-origin: center;
  cursor: default;
  will-change: transform;
}
.sr-desc:hover { transform: scale(1.06); }
.sr-btn {
  background-position: 0% 0%;
  transition: background-position 0.5s ease, transform 0.25s cubic-bezier(0.22,1,0.36,1);
  transform-origin: center;
  will-change: transform;
}
.sr-btn:hover:not(:disabled) { background-position: 65% 0%; transform: scale(1.06); }
.sr-score {
  transition: transform 0.25s cubic-bezier(0.22,1,0.36,1);
  cursor: default;
  will-change: transform;
}
.sr-score:hover { transform: scale(1.06); }
`

// ── helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const HS_KEY = (mode: GameMode) => `sr:hs:${mode}`

// ── chevron icons ─────────────────────────────────────────────────────────────

function ChevronUp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" style={{ height: '1.1em', width: 'auto', display: 'block', flexShrink: 0 }}>
      <path d="M6 15L12 9L18 15" stroke="#FFFBF7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" style={{ height: '1.1em', width: 'auto', display: 'block', flexShrink: 0 }}>
      <path d="M6 9L12 15L18 9" stroke="#FFFBF7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── types ─────────────────────────────────────────────────────────────────────

type Phase = 'playing' | 'reveal' | 'transitioning' | 'gameover'

interface ArtistState {
  artist: GameArtist
  key: number
}

// ── artist name label ─────────────────────────────────────────────────────────

function ArtistNameLabel({ name }: { name: string }) {
  return (
    <div
      className="sr-name-box"
      style={{
        backgroundColor: 'white',
        padding: '0.32vh 0.8vw',
        overflow: 'visible',
        fontFamily: 'var(--font-helvetica)',
        fontWeight: 700,
        fontStyle: 'italic',
        // Smaller than before — allows two-line wrap for long names
        fontSize: 'clamp(16px, 2vw, 34px)',
        userSelect: 'none',
        boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
        // Max width so long names wrap to two lines instead of overflowing
        maxWidth: 'min(40vw, 480px)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          position: 'relative',
        }}
      >
        <span className="sr-name-text">{name}</span>
      </div>
    </div>
  )
}

// ── stream count display ──────────────────────────────────────────────────────

function StreamCountDisplay({ streams }: { streams: number }) {
  return (
    <div
      className="sr-stream"
      style={{
        backgroundImage: 'linear-gradient(to right, #800C81, #E71616, #BEA500, #E71616, #800C81)',
        backgroundSize: '200% 100%',
        // Figma: outer box 454×117, inner text 414×77 → ~20px padding each side.
        // At ~88px font: 20px vertical ≈ 2.2vh at 900px viewport height.
        padding: '2vh 1.5vw',
        boxShadow: '0 2px 16px rgba(0,0,0,0.5)',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFBF7',
          fontFamily: 'var(--font-burst)',
          fontSize: 'clamp(30px, 5vw, 88px)',
          lineHeight: 0.75,
          whiteSpace: 'nowrap',
          position: 'relative',
          left: '-0.06em',
          top: '0.08em',
        }}
      >
        {streams.toLocaleString()}
      </div>
    </div>
  )
}

// ── description text ──────────────────────────────────────────────────────────

function DescText({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="sr-desc"
      style={{
        color: '#FFFBF7',
        fontFamily: 'var(--font-helvetica)',
        fontWeight: 700,
        fontStyle: 'italic',
        fontSize: 'clamp(12px, 1.5vw, 24px)',
        textShadow: '0 1px 8px rgba(0,0,0,0.8)',
        textAlign: 'center',
        lineHeight: 1.3,
        userSelect: 'none',
        margin: 0,
      }}
    >
      {children}
    </p>
  )
}

// ── guess buttons ─────────────────────────────────────────────────────────────

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
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="sr-btn"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        color: '#FFFBF7',
        // backgroundImage + backgroundSize inline; backgroundPosition in CSS
        backgroundImage: gradient,
        backgroundSize: '300% 100%',
        fontSize: 'clamp(13px, 1.5vw, 25px)',
        padding: '0.75vh 0.75vw',
        border: 'none',
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
        fontFamily: 'var(--font-helvetica)',
        fontWeight: 700,
        fontStyle: 'italic',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <span>{label}</span>
      {icon}
    </button>
  )
}

// ── score box ─────────────────────────────────────────────────────────────────
// Figma: two separate rows stacked — label row auto-width, value row auto-width.
// They differ in width because the texts differ, creating the staggered-tab shape.
// High Score aligns right (label narrower → tab on right), Current Score aligns left.

function ScoreBox({
  label,
  value,
  corner,
  bg,
}: {
  label: string
  value: number
  corner: 'top-right' | 'top-left'
  bg: string
}) {
  const isRight = corner === 'top-right'
  const rowBase: React.CSSProperties = {
    backgroundColor: bg,
    fontFamily: 'var(--font-helvetica)',
    fontWeight: 700,
    fontStyle: 'italic',
    color: '#FFFBF7',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  }
  return (
    <div
      className="sr-score"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: isRight ? 'flex-end' : 'flex-start',
        transformOrigin: isRight ? 'top right' : 'top left',
        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))',
      }}
    >
      <div style={{ ...rowBase, fontSize: 'clamp(10px, 1vw, 16px)', lineHeight: 1.2, padding: '0.25vh 0.6vw' }}>
        {label}
      </div>
      <div style={{ ...rowBase, fontSize: 'clamp(14px, 1.65vw, 28px)', lineHeight: 1.15, padding: '0.25vh 0.6vw', marginTop: '-1px' }}>
        {value.toLocaleString()}
      </div>
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
        width: 'clamp(70px, 8vw, 130px)',
        height: 'clamp(70px, 8vw, 130px)',
        borderRadius: '50%',
        backgroundColor: '#FFFBF7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        boxShadow: '0 4px 40px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
      }}
    >
      {correct ? (
        // Figma: gradient vector #800c81 → #e71616 → #bea500
        <svg viewBox="0 0 52 52" fill="none" style={{ width: 'clamp(45px, 5.5vw, 80px)', height: 'clamp(45px, 5.5vw, 80px)', flexShrink: 0 }}>
          <defs>
            <linearGradient id="tick-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#800C81" />
              <stop offset="50%" stopColor="#E71616" />
              <stop offset="100%" stopColor="#BEA500" />
            </linearGradient>
          </defs>
          <path d="M10 26L22 38L42 16" stroke="url(#tick-grad)" strokeWidth="5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        // Figma: red X fill+stroke #e71616
        <svg viewBox="0 0 52 52" fill="none" style={{ width: 'clamp(45px, 5.5vw, 80px)', height: 'clamp(45px, 5.5vw, 80px)', flexShrink: 0 }}>
          <path d="M16 16L36 36M36 16L16 36" stroke="#E71616" strokeWidth="5"
            strokeLinecap="round" />
        </svg>
      )}
    </div>
  )
}

// ── artist panel ──────────────────────────────────────────────────────────────

function ArtistPanel({
  artist,
  showStreams,
  isRight,
  modeLabel,
  artist1Name,
  onGuess,
  disabled,
}: {
  artist: GameArtist
  showStreams: boolean
  isRight: boolean
  modeLabel: string
  artist1Name?: string
  onGuess?: (g: 'higher' | 'lower') => void
  disabled: boolean
}) {
  const abs: React.CSSProperties = { position: 'absolute', inset: 0 }

  return (
    <div style={{ ...abs, overflow: 'hidden' }}>
      {/* Hidden img tag preloads the photo eagerly so it's ready before CSS bg applies */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={artist.imageUrl} alt="" aria-hidden style={{ display: 'none' }} />

      {/* Photo background */}
      <div
        style={{
          ...abs,
          backgroundImage: `url(${artist.imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      />
      {/* Dark overlay */}
      <div style={{ ...abs, background: 'rgba(0,0,0,0.45)' }} />

      {/* Centered content column */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'clamp(5px, 1vh, 18px)',
          padding: '0 3vw',
          zIndex: 2,
        }}
      >
        <ArtistNameLabel name={artist.name} />

        <DescText>has</DescText>

        {isRight && !showStreams ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(6px, 1vh, 14px)',
              // Figma: 270px wide at 960px panel = 28% of panel = 14vw
              width: 'clamp(130px, 14vw, 270px)',
            }}
          >
            <GuessButton
              label="Higher"
              icon={<ChevronUp />}
              gradient="linear-gradient(to right, #800C81, #800C81 33%, #E71616 100%)"
              onClick={() => onGuess?.('higher')}
              disabled={disabled}
            />
            <GuessButton
              label="Lower"
              icon={<ChevronDown />}
              gradient="linear-gradient(to right, #E71616, #E71616 33%, #BEA500 100%)"
              onClick={() => onGuess?.('lower')}
              disabled={disabled}
            />
          </div>
        ) : (
          <StreamCountDisplay streams={artist.streams} />
        )}

        {isRight && !showStreams ? (
          <>
            <DescText>{modeLabel} on Spotify than</DescText>
            {artist1Name && <DescText>{artist1Name}</DescText>}
          </>
        ) : (
          <DescText>{modeLabel} on Spotify</DescText>
        )}
      </div>
    </div>
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

  const keyGen = useRef(0)
  const nextKey = () => ++keyGen.current

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
    const timeoutId = window.setTimeout(() => controller.abort(), 30_000)

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
        if (!r.ok) throw new Error(`Artist request failed with ${r.status}`)
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
      .finally(() => window.clearTimeout(timeoutId))

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
          setRight({ artist: next, key: nextKey() })
        } else {
          setLeft({ artist: right.artist, key: nextKey() })
          setRight({ artist: next, key: nextKey() })
        }

        setRightRevealed(false)
        setTimeout(() => {
          setPhase('playing')
        }, 300)
      }, 1600)
    } else {
      setTimeout(() => {
        setPhase('gameover')
        setTimeout(() => router.push('/'), 1500)
      }, 1600)
    }
  }

  const modeLabel = mode === 'all-credits' ? 'all-credits streams' : 'lead streams'
  const busy = phase !== 'playing'

  if (!left || !right) {
    return (
      <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#FFFBF7', fontFamily: 'var(--font-helvetica)', fontStyle: 'italic' }}>
          {loadError ?? 'Loading...'}
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#0e0e0e',
      }}
    >
      {/* Injected directly — bypasses Tailwind/PostCSS pipeline */}
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: GAME_STYLES }} />

      {/* ── Two artist panels ── */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        {/* LEFT — Artist 1 */}
        <div style={{ position: 'relative', width: '50%', height: '100%', overflow: 'hidden' }}>
          <div
            key={`left-${left.key}`}
            style={{
              position: 'absolute', inset: 0,
              animation: 'srSlideFromLeft 0.4s ease',
            }}
          >
            <ArtistPanel
              artist={left.artist}
              showStreams
              isRight={false}
              modeLabel={modeLabel}
              disabled={busy}
            />
          </div>

          {/* High Score — top-right of left panel */}
          <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 5 }}>
            <ScoreBox label="High Score" value={highScore} corner="top-right" bg="#c59003" />
          </div>
        </div>

        {/* RIGHT — Artist 2 */}
        <div style={{ position: 'relative', width: '50%', height: '100%', overflow: 'hidden' }}>
          <div
            key={`right-${right.key}`}
            style={{ position: 'absolute', inset: 0, animation: 'srSlideFromRight 0.4s ease' }}
          >
            <ArtistPanel
              artist={right.artist}
              showStreams={rightRevealed}
              isRight
              modeLabel={modeLabel}
              artist1Name={left.artist.name}
              onGuess={handleGuess}
              disabled={busy}
            />
          </div>

          {/* Current Score — top-left of right panel */}
          <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 5 }}>
            <ScoreBox label="Current Score" value={score} corner="top-left" bg="#6d6d6d" />
          </div>
        </div>
      </div>

      {/* ── Center divider ── */}
      <div
        style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 2, background: 'rgba(255,255,255,0.08)', pointerEvents: 'none', zIndex: 10 }}
      />

      {/* ── Result circle ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ResultCircle correct={lastCorrect} visible={phase === 'reveal' || phase === 'gameover'} />
      </div>

      {/* ── Game over overlay ── */}
      {phase === 'gameover' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 25,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4em',
            background: 'rgba(0,0,0,0.6)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-helvetica)',
              fontWeight: 700,
              fontStyle: 'italic',
              color: '#FFFBF7',
              fontSize: 'clamp(28px, 4vw, 64px)',
              textShadow: '0 2px 20px rgba(0,0,0,0.8)',
              margin: 0,
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
              margin: 0,
            }}
          >
            Score: {score}
          </p>
        </div>
      )}
    </div>
  )
}

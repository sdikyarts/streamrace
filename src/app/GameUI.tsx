'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

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
@keyframes srSlideFromTop {
  from { transform: translateY(-40%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes srSlideFromBottom {
  from { transform: translateY(40%); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}
.sr-name-box {
  overflow: visible;
  transition: transform 0.45s cubic-bezier(0.22,1,0.36,1);
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
  transition: background-position 0.65s ease;
  padding-top: 0.15em;
  padding-bottom: 0;
  padding-right: 0.15em;
  padding-left: 0.15em;
}
.sr-name-box:hover .sr-name-text { background-position: 100% 0%; }
.sr-stream {
  background-position: 0% 0%;
  transition: background-position 0.65s ease, transform 0.45s cubic-bezier(0.22,1,0.36,1);
  transform-origin: center;
  cursor: default;
  will-change: transform;
}
.sr-stream:hover { background-position: 100% 0%; transform: scale(1.06); }
.sr-desc {
  transition: transform 0.45s cubic-bezier(0.22,1,0.36,1);
  transform-origin: center;
  cursor: default;
  will-change: transform;
}
.sr-desc:hover { transform: scale(1.06); }
.sr-btn {
  background-position: 0% 0%;
  transition: background-position 0.65s ease, transform 0.45s cubic-bezier(0.22,1,0.36,1);
  transform-origin: center;
  will-change: transform;
}
.sr-btn:hover:not(:disabled) { background-position: 65% 0%; transform: scale(1.06); }
.sr-score {
  transition: transform 0.45s cubic-bezier(0.22,1,0.36,1);
  cursor: default;
  will-change: transform;
}
.sr-score:hover { transform: scale(1.06); }
.sr-name-line {
  display: inline;
  background-color: white;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
.sr-go-elem {
  transition: transform 0.45s cubic-bezier(0.22,1,0.36,1);
  transform-origin: center;
  cursor: default;
  will-change: transform;
}
.sr-go-elem:hover { transform: scale(1.06); }
`

// ── helpers ───────────────────────────────────────────────────────────────────

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

const rng = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32

// ── types ─────────────────────────────────────────────────────────────────────

type Phase = 'playing' | 'reveal' | 'transitioning' | 'gameover'

interface ArtistState {
  artist: GameArtist
  key: number
}

// ── artist name label ─────────────────────────────────────────────────────────

function ArtistNameLabel({ name, compact }: Readonly<{ name: string; compact?: boolean }>) {
  if (compact) {
    // Each wrapped line gets its own white background box, center-aligned
    return (
      <div
        className="sr-name-box"
        style={{
          overflow: 'visible',
          fontFamily: 'var(--font-helvetica)',
          fontWeight: 700,
          fontStyle: 'italic',
          fontSize: 'clamp(22px, 5.5vw, 34px)',
          userSelect: 'none',
          textAlign: 'center',
          width: 'min(72vw, 480px)',
          lineHeight: 1.15,
          filter: 'drop-shadow(0 2px 16px rgba(0,0,0,0.4))',
        }}
      >
        <span className="sr-name-line" style={{ padding: '0.1vh 0.3vw' }}>
          <span className="sr-name-text" style={{ display: 'inline', padding: 0 }}>{name}</span>
        </span>
      </div>
    )
  }
  return (
    <div
      className="sr-name-box"
      style={{
        backgroundColor: 'white',
        padding: '0.4vh 1vw 0 1vw',
        overflow: 'visible',
        fontFamily: 'var(--font-helvetica)',
        fontWeight: 700,
        fontStyle: 'italic',
        fontSize: 'clamp(18px, 2.4vw, 38px)',
        userSelect: 'none',
        boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
        maxWidth: 'min(40vw, 480px)',
        textAlign: 'center',
      }}
    >
      <div style={{ position: 'relative' }}>
        <span className="sr-name-text">{name}</span>
      </div>
    </div>
  )
}

// ── stream count display ──────────────────────────────────────────────────────

function StreamCountDisplay({ streams, compact }: Readonly<{ streams: number; compact?: boolean }>) {
  return (
    <div
      className="sr-stream"
      style={{
        backgroundImage: 'linear-gradient(to right, #800C81, #E71616, #BEA500, #E71616, #800C81)',
        backgroundSize: '200% 100%',
        // Figma: outer box 454×117, inner text 414×77 → ~20px padding each side.
        // At ~88px font: 20px vertical ≈ 2.2vh at 900px viewport height.
        padding: compact ? '1.1vh 2.2vw' : '2vh 2vw',
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
          fontSize: compact ? 'clamp(38px, 10vw, 88px)' : 'clamp(34px, 5.5vw, 88px)',
          lineHeight: 0.75,
          whiteSpace: 'nowrap',
          position: 'relative',
          left: '-0.06em',
          top: '0.08em',
        }}
      >
        {streams.toLocaleString('en-US')}
      </div>
    </div>
  )
}

// ── description text ──────────────────────────────────────────────────────────

function DescText({ children, compact }: Readonly<{ children: React.ReactNode; compact?: boolean }>) {
  return (
    <p
      className="sr-desc"
      style={{
        color: '#FFFBF7',
        fontFamily: 'var(--font-helvetica)',
        fontWeight: 700,
        fontStyle: 'italic',
        fontSize: compact ? 'clamp(14px, 4.5vw, 18px)' : 'clamp(14px, 1.8vw, 28px)',
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
  compact,
}: Readonly<{
  label: string
  icon: React.ReactNode
  gradient: string
  onClick: () => void
  disabled: boolean
  compact?: boolean
}>) {
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
        fontSize: compact ? 'clamp(14px, 4.5vw, 18px)' : 'clamp(15px, 1.8vw, 28px)',
        padding: compact ? '0.75vh clamp(7px, 1.7vw, 20px)' : '0.9vh 1vw',
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
  compact,
}: Readonly<{
  label: string
  value: number
  corner: 'top-right' | 'top-left'
  bg: string
  compact?: boolean
}>) {
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
      <div style={{ ...rowBase, fontSize: compact ? 'clamp(10px, 2.3vw, 14px)' : 'clamp(11px, 1.2vw, 18px)', lineHeight: 1.2, padding: compact ? '0.25vh 1vw' : '0.3vh 0.8vw' }}>
        {label}
      </div>
      <div style={{ ...rowBase, fontSize: compact ? 'clamp(14px, 4.5vw, 18px)' : 'clamp(16px, 2vw, 32px)', lineHeight: 1.15, padding: compact ? '0.25vh 1vw' : '0.3vh 0.8vw', marginTop: '-1px' }}>
        {value.toLocaleString('en-US')}
      </div>
    </div>
  )
}

// ── result circle ─────────────────────────────────────────────────────────────

function ResultCircle({ correct, visible }: Readonly<{ correct: boolean; visible: boolean }>) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${visible ? 1 : 0})`,
        transition: 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
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
  compact,
}: Readonly<{
  artist: GameArtist
  showStreams: boolean
  isRight: boolean
  modeLabel: string
  artist1Name?: string
  onGuess?: (g: 'higher' | 'lower') => void
  disabled: boolean
  compact?: boolean
}>) {
  const abs: React.CSSProperties = { position: 'absolute', inset: 0 }

  return (
    <div style={{ ...abs, overflow: 'hidden' }}>
      {/* Photo background — next/image handles optimization, WebP, and preloading */}
      <Image
        src={artist.imageUrl}
        alt=""
        fill
        quality={100}
        sizes="50vw"
        priority
        style={{ objectFit: 'cover', objectPosition: compact ? 'center center' : 'center top' }}
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
        <ArtistNameLabel name={artist.name} compact={compact} />

        <DescText compact={compact}>has</DescText>

        {isRight && !showStreams ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(6px, 1vh, 14px)',
              // Figma: 270px wide at 960px panel = 28% of panel = 14vw
              width: 'clamp(140px, 16vw, 300px)',
            }}
          >
            <GuessButton
              label="Higher"
              icon={<ChevronUp />}
              gradient="linear-gradient(to right, #800C81, #800C81 33%, #E71616 100%)"
              onClick={() => onGuess?.('higher')}
              disabled={disabled}
              compact={compact}
            />
            <GuessButton
              label="Lower"
              icon={<ChevronDown />}
              gradient="linear-gradient(to right, #E71616, #E71616 33%, #BEA500 100%)"
              onClick={() => onGuess?.('lower')}
              disabled={disabled}
              compact={compact}
            />
          </div>
        ) : (
          <StreamCountDisplay streams={artist.streams} compact={compact} />
        )}

        {isRight && !showStreams ? (
          <>
            <DescText compact={compact}>{modeLabel} on Spotify than</DescText>
            {artist1Name && <DescText compact={compact}>{artist1Name}</DescText>}
          </>
        ) : (
          <DescText compact={compact}>{modeLabel} on Spotify</DescText>
        )}
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function GameUI({
  mode,
  initialArtists,
}: Readonly<{
  mode: GameMode
  initialArtists?: GameArtist[]
}>) {
  const router = useRouter()

  const [left, setLeft] = useState<ArtistState | null>(null)
  const [right, setRight] = useState<ArtistState | null>(null)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [phase, setPhase] = useState<Phase>('playing')
  const [lastCorrect, setLastCorrect] = useState(true)
  const [rightRevealed, setRightRevealed] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)

  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const keyGen = useRef(0)
  const nextKey = () => ++keyGen.current

  // Artists sorted descending by streams — rank 0 = most streams.
  // Kept in a ref so pickNear can read it without triggering re-renders.
  const sortedPool = useRef<GameArtist[]>([])

  // Pick the next artist from within ±windowSize ranks of `anchor`.
  // Window shrinks as score rises so comparisons get tighter and harder.
  const pickNear = useCallback(
    (anchor: GameArtist, exclude: GameArtist[], currentScore: number): GameArtist => {
      const sorted = sortedPool.current
      const excludedNames = new Set(exclude.map(a => a.name))
      const available = sorted.filter(a => !excludedNames.has(a.name))
      if (available.length === 0) return sorted[0]

      const anchorIdx = sorted.findIndex(a => a.name === anchor.name)
      if (anchorIdx === -1) return available[Math.floor(rng() * available.length)]

      // 10% wild card — picks from anywhere so all 1000 artists can appear over a session
      if (rng() < 0.1) return available[Math.floor(rng() * available.length)]

      // 150 ranks wide at score 0, narrows by 3 per point, floors at 40
      const windowSize = Math.max(40, 150 - currentScore * 3)
      const lo = Math.max(0, anchorIdx - windowSize)
      const hi = Math.min(sorted.length - 1, anchorIdx + windowSize)
      const inWindow = sorted.slice(lo, hi + 1).filter(a => !excludedNames.has(a.name))

      // Guarantee a meaningful stream count gap at low scores.
      // minRatio starts at 30% and shrinks by 1% per point, flooring at 5%.
      const minRatio = Math.max(0.05, 0.30 - currentScore * 0.01)
      const candidates = inWindow.filter(a => {
        const ratio = Math.abs(a.streams - anchor.streams) / Math.max(a.streams, anchor.streams)
        return ratio >= minRatio
      })

      // Relax ratio constraint if no candidates survive, then fall back to all available
      const from = candidates.length > 0 ? candidates : inWindow.length > 0 ? inWindow : available
      return from[Math.floor(rng() * from.length)]
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeoutId = globalThis.setTimeout(() => controller.abort(), 90_000)

    const seedArtists = (artists: GameArtist[]) => {
      const valid = artists.filter(a => a.streams > 0)
      const sorted = [...valid].sort((a, b) => b.streams - a.streams)
      sortedPool.current = sorted
      if (sorted.length >= 2) {
        // Left artist: random from the full pool (any tier)
        const leftArtist = sorted[Math.floor(rng() * sorted.length)]
        // Right artist: always near the left by rank, so the comparison is genuinely uncertain
        const rightArtist = pickNear(leftArtist, [leftArtist], 0)
        setLeft({ artist: leftArtist, key: nextKey() })
        setRight({ artist: rightArtist, key: nextKey() })
      }
    }

    Promise.resolve().then(() => {
      if (cancelled) return
      setLoadError(null)
      seedArtists(initialArtists ?? [])
      setHighScore(Number.parseInt(localStorage.getItem(HS_KEY(mode)) ?? '0', 10))
    })

    fetch(`/api/game-artists/${mode}`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error(`Artist request failed with ${r.status}`)
        return r.json()
      })
      .then(({ artists: fetched }: { artists: GameArtist[] }) => {
        if (cancelled) return
        const v = fetched.filter((a: GameArtist) => a.streams > 0)
        const sorted = [...v].sort((a, b) => b.streams - a.streams)
        sortedPool.current = sorted
        if (sorted.length >= 2) {
          const leftArtist = sorted[Math.floor(rng() * sorted.length)]
          const rightArtist = pickNear(leftArtist, [leftArtist], 0)
          setLeft({ artist: leftArtist, key: nextKey() })
          setRight({ artist: rightArtist, key: nextKey() })
        } else {
          setLoadError('Not enough playable artists yet.')
        }
      })
      .catch((err) => {
        if (cancelled || err?.name === 'AbortError') return
        console.error('[GameUI] Failed to fetch artists:', err)
        setLoadError('Failed to load artists. Check server logs.')
      })
      .finally(() => globalThis.clearTimeout(timeoutId))

    return () => {
      cancelled = true
      globalThis.clearTimeout(timeoutId)
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
        // The artist with more streams stays as the anchor; pick the next from nearby ranks
        const anchor = leftStreams >= rightStreams ? left.artist : right.artist
        const next = pickNear(anchor, [left.artist, right.artist], newScore)

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
      }, 1600)
    }
  }

  function handleReplay() {
    const sorted = sortedPool.current
    if (sorted.length >= 2) {
      const leftArtist = sorted[Math.floor(rng() * sorted.length)]
      const rightArtist = pickNear(leftArtist, [leftArtist], 0)
      setLeft({ artist: leftArtist, key: nextKey() })
      setRight({ artist: rightArtist, key: nextKey() })
    }
    setScore(0)
    setPhase('playing')
    setRightRevealed(false)
    setLastCorrect(true)
  }

  const modeLabel = mode === 'all-credits' ? 'all-credits streams' : 'lead streams'
  const busy = phase !== 'playing'

  if (!left || !right) {
    return (
      <div style={{ position: 'relative', width: '100vw', height: '100dvh', background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        height: '100dvh',
        overflow: 'hidden',
        background: '#0e0e0e',
      }}
    >
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: GAME_STYLES }} />

      {isDesktop ? (
        <>
          {/* ── DESKTOP: original horizontal layout (unchanged) ── */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            {/* LEFT — Artist 1 */}
            <div style={{ position: 'relative', width: '50%', height: '100%', overflow: 'hidden' }}>
              <div
                key={`left-${left.key}`}
                style={{ position: 'absolute', inset: 0, animation: 'srSlideFromLeft 0.75s cubic-bezier(0.22,1,0.36,1)' }}
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
                style={{ position: 'absolute', inset: 0, animation: 'srSlideFromRight 0.75s cubic-bezier(0.22,1,0.36,1)' }}
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

          {/* Center divider */}
          <div
            style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 2, background: 'rgba(255,255,255,0.08)', pointerEvents: 'none', zIndex: 10 }}
          />
        </>
      ) : (
        <>
          {/* ── MOBILE/TABLET: vertical layout with circular top panel ── */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>

            {/* TOP — Artist 1: full-bleed photo */}
            <div style={{ position: 'relative', height: '50%', flexShrink: 0, overflow: 'hidden' }}>
              <div
                key={`top-${left.key}`}
                style={{ position: 'absolute', inset: 0, animation: 'srSlideFromTop 0.75s cubic-bezier(0.22,1,0.36,1)' }}
              >
                <ArtistPanel
                  artist={left.artist}
                  showStreams
                  isRight={false}
                  modeLabel={modeLabel}
                  disabled={busy}
                  compact
                />
              </div>
            </div>

            {/* BOTTOM — Artist 2: full-bleed photo */}
            <div style={{ position: 'relative', height: '50%', flexShrink: 0, overflow: 'hidden' }}>
              <div
                key={`bottom-${right.key}`}
                style={{ position: 'absolute', inset: 0, animation: 'srSlideFromBottom 0.75s cubic-bezier(0.22,1,0.36,1)' }}
              >
                <ArtistPanel
                  artist={right.artist}
                  showStreams={rightRevealed}
                  isRight
                  modeLabel={modeLabel}
                  artist1Name={left.artist.name}
                  onGuess={handleGuess}
                  disabled={busy}
                  compact
                />
              </div>
            </div>
          </div>

          {/* Horizontal divider */}
          <div
            style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 2, background: 'rgba(255,255,255,0.08)', pointerEvents: 'none', zIndex: 10 }}
          />

          {/* Score boxes at the dividing line */}
          <div style={{ position: 'absolute', top: '50%', left: 14, zIndex: 11, transform: 'translateY(-50%)' }}>
            <ScoreBox label="High Score" value={highScore} corner="top-left" bg="#c59003" compact />
          </div>
          <div style={{ position: 'absolute', top: '50%', right: 14, zIndex: 11, transform: 'translateY(-50%)' }}>
            <ScoreBox label="Current Score" value={score} corner="top-right" bg="#6d6d6d" compact />
          </div>
        </>
      )}

      {/* ── Result circle ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ResultCircle correct={lastCorrect} visible={phase === 'reveal' || phase === 'gameover'} />
      </div>

      {/* ── Game over overlay ── */}
      {phase === 'gameover' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 25,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(18px, 4vh, 52px)',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {/* GAME OVER!!! */}
          <div
            className="sr-name-box"
            style={{
              backgroundColor: 'white',
              padding: isDesktop ? '0.6vh 1.8vw' : '0.06vh 0.8vw',
              overflow: 'visible',
              fontFamily: 'var(--font-helvetica)',
              fontWeight: 700,
              fontStyle: 'italic',
              fontSize: isDesktop ? 'clamp(30px, 3.8vw, 60px)' : 'clamp(24px, 7vw, 40px)',
              userSelect: 'none',
              boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'contents' }}>
              <span className="sr-name-text">GAME OVER!!!</span>
            </div>
          </div>

          {/* You scored + score + high score */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(10px, 2vh, 22px)' }}>
            <DescText compact={!isDesktop}>You scored:</DescText>

            <div
              className="sr-stream"
              style={{
                backgroundImage: 'linear-gradient(to right, #800C81, #E71616, #BEA500, #E71616, #800C81)',
                backgroundSize: '200% 100%',
                padding: isDesktop ? '2.5vh 3vw' : '1.1vh 2.2vw',
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
                  fontSize: isDesktop ? 'clamp(55px, 9vw, 140px)' : 'clamp(55px, 14vw, 140px)',
                  lineHeight: 0.75,
                  whiteSpace: 'nowrap',
                  position: 'relative',
                  left: '-0.06em',
                  top: '0.08em',
                }}
              >
                {score.toLocaleString('en-US')}
              </div>
            </div>

            <div
              className="sr-btn"
              style={{
                width: 'clamp(220px, 26vw, 420px)',
                color: '#FFFBF7',
                backgroundImage: 'linear-gradient(to right, #800C81, #800C81 33%, #E71616 100%)',
                backgroundSize: '300% 100%',
                fontSize: isDesktop ? 'clamp(15px, 1.8vw, 28px)' : 'clamp(14px, 4.5vw, 18px)',
                padding: isDesktop ? '0.9vh 1vw' : '0.75vh clamp(7px, 1.7vw, 20px)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                fontFamily: 'var(--font-helvetica)',
                fontWeight: 700,
                fontStyle: 'italic',
                textAlign: 'center',
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              High Score: {highScore.toLocaleString('en-US')}
            </div>
          </div>

          {/* PLAY AGAIN + BACK TO HOME — narrower gap between them */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(10px, 2vh, 22px)' }}>
            <button
              onClick={handleReplay}
              className="sr-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 'clamp(220px, 26vw, 420px)',
                color: '#FFFBF7',
                backgroundImage: 'linear-gradient(to right, #E71616, #E71616 33%, #BEA500 100%)',
                backgroundSize: '300% 100%',
                fontSize: isDesktop ? 'clamp(15px, 1.8vw, 28px)' : 'clamp(14px, 4.5vw, 18px)',
                padding: isDesktop ? '0.9vh 1vw' : '0.75vh clamp(7px, 1.7vw, 20px)',
                border: 'none',
                boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                fontFamily: 'var(--font-helvetica)',
                fontWeight: 700,
                fontStyle: 'italic',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span>PLAY AGAIN</span>
            </button>

            <button
              onClick={() => router.push('/')}
              className="sr-go-elem"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 'clamp(220px, 26vw, 420px)',
                color: '#FFFBF7',
                backgroundColor: '#6d6d6d',
                fontSize: isDesktop ? 'clamp(15px, 1.8vw, 28px)' : 'clamp(14px, 4.5vw, 18px)',
                padding: isDesktop ? '0.9vh 1vw' : '0.75vh clamp(7px, 1.7vw, 20px)',
                border: 'none',
                boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                fontFamily: 'var(--font-helvetica)',
                fontWeight: 700,
                fontStyle: 'italic',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span>BACK TO HOME</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

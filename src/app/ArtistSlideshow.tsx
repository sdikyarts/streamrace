'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const SLIDE_DURATION = 7000
const FADE_DURATION = 1800

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function preloadUrl(url: string): Promise<void> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = url
  })
}

export default function ArtistSlideshow() {
  const [ready, setReady] = useState(false)

  const deckRef = useRef<string[]>([])
  const posRef = useRef(0)
  const activeRef = useRef<0 | 1>(0)
  const layerRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)] as const

  const getNext = useCallback((): string => {
    if (posRef.current >= deckRef.current.length) {
      deckRef.current = shuffle(deckRef.current)
      posRef.current = 0
    }
    return deckRef.current[posRef.current++]
  }, [])

  // Peek at next N URLs without advancing posRef
  const peekAhead = useCallback((count: number): string[] => {
    const deck = deckRef.current
    const pos = posRef.current
    return Array.from({ length: count }, (_, i) => deck[(pos + i) % deck.length])
  }, [])

  function restartPan(el: HTMLDivElement) {
    el.style.animation = 'none'
    el.getBoundingClientRect()
    el.style.animation = `slideshowPan ${SLIDE_DURATION + FADE_DURATION}ms linear forwards`
  }

  useEffect(() => {
    fetch('/api/artist-images')
      .then(r => r.json())
      .then(async ({ images }: { images: string[] }) => {
        if (!images.length) return
        deckRef.current = shuffle(images)
        posRef.current = 0

        const first = getNext()
        const second = getNext()

        // Wait for the first image before showing, preload second in parallel
        await Promise.all([preloadUrl(first), preloadUrl(second)])
        // Kick off background preloads for the next few
        peekAhead(3).forEach(preloadUrl)

        const l0 = layerRefs[0].current!
        const l1 = layerRefs[1].current!

        l0.style.backgroundImage = `url(${first})`
        l1.style.backgroundImage = `url(${second})`
        l0.style.opacity = '1'
        restartPan(l0)

        setReady(true)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready) return

    const timer = setInterval(() => {
      const outgoing = activeRef.current
      const incoming = (outgoing === 0 ? 1 : 0) as 0 | 1

      const outEl = layerRefs[outgoing].current!
      const inEl = layerRefs[incoming].current!

      restartPan(inEl)
      inEl.style.transition = `opacity ${FADE_DURATION}ms ease`
      inEl.style.opacity = '1'

      outEl.style.transition = `opacity ${FADE_DURATION}ms ease`
      outEl.style.opacity = '0'

      activeRef.current = incoming

      setTimeout(() => {
        const next = getNext()
        outEl.style.backgroundImage = `url(${next})`
        // Preload upcoming images without consuming deck positions
        peekAhead(2).forEach(preloadUrl)
      }, FADE_DURATION)
    }, SLIDE_DURATION)

    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  return (
    <>
      <style>{`
        @keyframes slideshowPan {
          from { background-position: 60% 38%; }
          to   { background-position: 60% 62%; }
        }
      `}</style>
      <div
        className="absolute top-0 right-0 bottom-0 w-[75%]"
        style={{
          maskImage: [
            'linear-gradient(to right,',
            '  transparent 0%,',
            '  rgba(0,0,0,0.03) 6%,',
            '  rgba(0,0,0,0.10) 13%,',
            '  rgba(0,0,0,0.22) 21%,',
            '  rgba(0,0,0,0.40) 29%,',
            '  rgba(0,0,0,0.60) 37%,',
            '  rgba(0,0,0,0.78) 44%,',
            '  rgba(0,0,0,0.92) 50%,',
            '  black 55%',
            ')',
          ].join(' '),
        }}
      >
        {([0, 1] as const).map(i => (
          <div
            key={i}
            ref={layerRefs[i]}
            className="absolute inset-0"
            style={{
              backgroundSize: '120%',
              backgroundPosition: '60% 38%',
              opacity: 0,
            }}
          />
        ))}
      </div>
    </>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const SLIDESHOW_STYLES = `
@keyframes artistNameIn {
  from { opacity: 0; transform: translateY(-40px); }
  to   { opacity: 1; transform: translateY(0); }
}
.artist-label-wrap {
  visibility: hidden;
  overflow: visible;
  transform-origin: right top;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease-out;
  will-change: transform;
}
.artist-label-wrap:hover { transform: scale(1.06); }
[data-panel-open] .artist-label-wrap {
  opacity: 0 !important;
  pointer-events: none !important;
}
.artist-label-text {
  display: inline-block;
  white-space: nowrap;
  background-image: linear-gradient(to right, #800C81, #E71616, #BEA500, #E71616, #800C81);
  background-size: 200% 100%;
  background-position: 0% 0%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  transition: background-position 0.65s ease;
  padding-top: 0.15em;
  padding-bottom: 0.15em;
  padding-right: 0.15em;
  padding-left: 0.15em;
}
.artist-label-wrap:hover .artist-label-text { background-position: 100% 0%; }

@media (max-width: 1024px) {
  .slideshow-container {
    width: 100% !important;
    left: 0 !important;
    height: 68vh !important;
    bottom: auto !important;
    -webkit-mask-image: linear-gradient(to bottom,
      black 0%, black 80%,
      rgba(0,0,0,0.54) 86%, rgba(0,0,0,0.22) 91%,
      rgba(0,0,0,0.04) 96%, transparent 99%
    ) !important;
    mask-image: linear-gradient(to bottom,
      black 0%, black 80%,
      rgba(0,0,0,0.54) 86%, rgba(0,0,0,0.22) 91%,
      rgba(0,0,0,0.04) 96%, transparent 99%
    ) !important;
  }
  .artist-label-wrap {
    top: auto !important;
    right: auto !important;
    left: 50% !important;
    width: max-content !important;
    max-width: min(72vw, 240px) !important;
    margin: 0 !important;
    bottom: calc(10dvh + var(--panel-h, 180px) + 2.5dvh) !important;
    transform: translateX(-50%) !important;
    transform-origin: center center !important;
    padding: 2px 5px 1px 5px !important;
    font-size: clamp(13px, 4vw, 17px) !important;
  }
  .artist-label-text {
    white-space: normal !important;
    text-align: center !important;
  }
  .artist-label-wrap:hover { transform: translateX(-50%) scale(1.06) !important; }
}
@media (max-width: 480px) {
  .artist-label-wrap { padding: 1px 3px 0px 3px !important; }
}
@media (hover: none) {
  .artist-label-wrap:active { transform: translateX(-50%) scale(1.06) !important; }
  .artist-label-wrap:active .artist-label-text { background-position: 100% 0% !important; }
}
`

const SLIDE_DURATION = 7000
const FADE_DURATION = 1800

const rng = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Edge-color extraction for accent gradient ─────────────────────────────────

type EdgeColors = { leftColor?: string; bottomColor?: string }

function averageRGB(data: Uint8ClampedArray): string {
  let r = 0, g = 0, b = 0
  const len = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]; g += data[i + 1]; b += data[i + 2]
  }
  return `rgb(${Math.round(r / len)},${Math.round(g / len)},${Math.round(b / len)})`
}

function extractEdgeColors(url: string): Promise<EdgeColors> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const scale = 0.25
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.naturalWidth * scale)
        canvas.height = Math.round(img.naturalHeight * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const w = canvas.width, h = canvas.height
        const leftW = Math.max(1, Math.round(w * 0.08))
        const botH = Math.max(1, Math.round(h * 0.08))
        resolve({
          leftColor: averageRGB(ctx.getImageData(0, 0, leftW, h).data),
          bottomColor: averageRGB(ctx.getImageData(0, h - botH, w, botH).data),
        })
      } catch {
        resolve({})
      }
    }
    img.onerror = () => resolve({})
    img.src = url
  })
}

// ── Name width animation (module-level to avoid deep function nesting) ───────

let pendingNameSwap: { text: HTMLSpanElement; name: string } | null = null
let widthFallbackTimer: ReturnType<typeof setTimeout> | null = null

function doNameSwap(wrap: HTMLDivElement) {
  wrap.removeEventListener('transitionend', clearWidthTransition)
  wrap.style.transition = ''
  wrap.style.overflow = ''
  if (pendingNameSwap) {
    const { text, name } = pendingNameSwap
    pendingNameSwap = null
    text.textContent = name
    text.style.transition = 'opacity 0.35s ease'
    text.style.opacity = '1'
  }
  wrap.style.width = ''
}

function clearWidthTransition(e: Event) {
  if ((e as TransitionEvent).propertyName !== 'width') return
  if (widthFallbackTimer !== null) { clearTimeout(widthFallbackTimer); widthFallbackTimer = null }
  doNameSwap(e.currentTarget as HTMLDivElement)
}

function animateNameWidth(wrap: HTMLDivElement, text: HTMLSpanElement, name: string) {
  if (widthFallbackTimer !== null) { clearTimeout(widthFallbackTimer); widthFallbackTimer = null }

  // On touch devices skip the width morph — cross-fade the text.
  if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
    wrap.removeEventListener('transitionend', clearWidthTransition)
    pendingNameSwap = null
    wrap.style.width = ''
    wrap.style.overflow = ''

    text.style.transition = 'opacity 0.32s ease'
    text.style.opacity = '0'

    widthFallbackTimer = setTimeout(() => {
      widthFallbackTimer = null
      wrap.style.transition = 'none'
      text.textContent = name
      void wrap.getBoundingClientRect()
      wrap.style.transition = ''

      requestAnimationFrame(() => {
        text.style.opacity = '1'
        widthFallbackTimer = setTimeout(() => {
          widthFallbackTimer = null
          text.style.transition = ''
        }, 400)
      })
    }, 360)
    return
  }

  const prevWidth = wrap.offsetWidth
  const prevName = text.textContent ?? ''

  text.style.whiteSpace = 'nowrap'
  text.textContent = name
  wrap.style.transition = 'none'
  wrap.style.width = 'max-content'
  wrap.getBoundingClientRect()
  const nextWidth = wrap.getBoundingClientRect().width + 8
  text.textContent = prevName
  text.style.whiteSpace = ''
  wrap.style.width = `${prevWidth}px`
  wrap.getBoundingClientRect()

  wrap.style.overflow = 'hidden'
  text.style.transition = 'opacity 0.3s ease'
  text.style.opacity = '0'
  pendingNameSwap = { text, name }
  wrap.style.transition = 'width 0.55s cubic-bezier(0.22,1,0.36,1), transform 0.45s cubic-bezier(0.22,1,0.36,1)'
  wrap.style.width = `${nextWidth}px`
  wrap.removeEventListener('transitionend', clearWidthTransition)
  wrap.addEventListener('transitionend', clearWidthTransition)
  widthFallbackTimer = setTimeout(() => {
    widthFallbackTimer = null
    doNameSwap(wrap)
  }, 650)
}

// ── Artist list cache (localStorage, 1-hour TTL) ─────────────────────────────

const CACHE_KEY = 'sr:artists'
const CACHE_TTL = 3_600_000

function loadCachedArtists(): { url: string; name: string }[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw) as { ts: number; data: { url: string; name: string }[] }
    return Date.now() - ts < CACHE_TTL ? data : null
  } catch { return null }
}

function saveCachedArtists(data: { url: string; name: string }[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })) } catch { /* quota or SSR */ }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ArtistSlideshow({ initialArtists }: Readonly<{ initialArtists?: { url: string; name: string }[] }>) {
  const [ready, setReady] = useState(false)

  const deckRef = useRef<string[]>([])
  const posRef = useRef(0)
  const activeRef = useRef<0 | 1>(0)
  const layerUrls = useRef<[string, string]>(['', ''])
  const colorCacheRef = useRef<Map<string, EdgeColors>>(new Map())
  const urlToName = useRef<Map<string, string>>(new Map())
  const nameWrapRef = useRef<HTMLDivElement>(null)
  const nameTextRef = useRef<HTMLSpanElement>(null)

  const wrapper0Ref = useRef<HTMLDivElement>(null)
  const wrapper1Ref = useRef<HTMLDivElement>(null)
  const bg0Ref = useRef<HTMLImageElement>(null)
  const bg1Ref = useRef<HTMLImageElement>(null)
  const accentGradientRef = useRef<HTMLDivElement>(null)

  function getWrapperEl(slot: 0 | 1) {
    return (slot === 0 ? wrapper0Ref : wrapper1Ref).current!
  }

  function getBgEl(slot: 0 | 1) {
    return (slot === 0 ? bg0Ref : bg1Ref).current!
  }

  const getNext = useCallback((): string => {
    if (posRef.current >= deckRef.current.length) {
      deckRef.current = shuffle(deckRef.current)
      posRef.current = 0
    }
    return deckRef.current[posRef.current++]
  }, [])

  const cacheColors = useCallback((url: string): Promise<EdgeColors> => {
    if (colorCacheRef.current.has(url)) return Promise.resolve(colorCacheRef.current.get(url)!)
    return extractEdgeColors(url).then(colors => {
      colorCacheRef.current.set(url, colors)
      return colors
    })
  }, [])

  function applyAccentColor(url: string) {
    const accentEl = accentGradientRef.current
    if (!accentEl) return
    const isMobile = window.matchMedia('(max-width: 1024px)').matches
    const colors = colorCacheRef.current.get(url)
    const color = isMobile ? (colors?.bottomColor ?? 'rgb(14,14,14)') : (colors?.leftColor ?? 'rgb(14,14,14)')
    accentEl.style.background = color
  }

  function showNameFirst(url: string) {
    const wrap = nameWrapRef.current
    const text = nameTextRef.current
    if (!wrap || !text) return
    text.textContent = urlToName.current.get(url) ?? ''
    text.style.opacity = '1'
    text.style.transition = ''
    wrap.style.visibility = 'visible'
    wrap.style.animation = 'none'
    wrap.getBoundingClientRect()
    wrap.style.animation = 'artistNameIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) backwards'
    wrap.addEventListener('animationend', () => { wrap.style.animation = '' }, { once: true })
  }

  function transitionName(url: string) {
    const wrap = nameWrapRef.current
    const text = nameTextRef.current
    if (!wrap || !text) return
    animateNameWidth(wrap, text, urlToName.current.get(url) ?? '')
  }

  function fadeIn(slot: 0 | 1) {
    const el = getWrapperEl(slot)
    el.style.transition = `opacity ${FADE_DURATION}ms ease`
    el.style.opacity = '1'
  }

  function fadeOut(slot: 0 | 1) {
    const el = getWrapperEl(slot)
    el.style.transition = `opacity ${FADE_DURATION}ms ease`
    el.style.opacity = '0'
  }

  useEffect(() => {
    let started = false
    let cancelled = false
    const controller = new AbortController()
    const timeoutId = globalThis.setTimeout(() => controller.abort(), 10_000)

    async function init(data: { url: string; name: string }[]) {
      if (started || !data.length) return
      started = true
      urlToName.current = new Map(data.map(a => [a.url, a.name]))
      deckRef.current = shuffle(data.map(a => a.url))
      posRef.current = 0

      const first = getNext()
      const second = getNext()

      getBgEl(0).src = first
      getBgEl(1).src = second
      layerUrls.current = [first, second]

      // Extract colors for first image and apply accent; preload second in background
      cacheColors(first).then(colors => {
        colorCacheRef.current.set(first, colors)
        if (!cancelled) applyAccentColor(first)
      })
      cacheColors(second)

      fadeIn(0)
      showNameFirst(first)
      setReady(true)
    }

    const immediate = initialArtists?.length ? initialArtists : loadCachedArtists()
    if (immediate) init(immediate)

    fetch('/api/artist-images', { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error(`Artist image request failed with ${r.status}`)
        return r.json()
      })
      .then(({ artists }: { artists: { url: string; name: string }[] }) => {
        if (cancelled) return
        saveCachedArtists(artists)
        init(artists)
      })
      .catch(() => {})
      .finally(() => { globalThis.clearTimeout(timeoutId) })

    return () => {
      cancelled = true
      globalThis.clearTimeout(timeoutId)
      controller.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready) return

    let innerTimer: ReturnType<typeof setTimeout> | null = null

    const timer = setInterval(() => {
      const outgoing = activeRef.current
      const incoming = (outgoing === 0 ? 1 : 0) as 0 | 1
      const inUrl = layerUrls.current[incoming]

      applyAccentColor(inUrl)
      fadeIn(incoming)
      fadeOut(outgoing)
      transitionName(inUrl)
      activeRef.current = incoming

      innerTimer = setTimeout(() => {
        innerTimer = null
        const next = getNext()
        getBgEl(outgoing).src = next
        layerUrls.current[outgoing] = next
        cacheColors(next)
      }, FADE_DURATION)
    }, SLIDE_DURATION)

    return () => {
      clearInterval(timer)
      if (innerTimer !== null) clearTimeout(innerTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: SLIDESHOW_STYLES }} />

      {/* Bottommost base layer — solid accent color extracted from the photo edge.
          Sits below the image; the mask makes the image edge transparent so the
          accent color shows through, blending photo into background. */}
      <div
        ref={accentGradientRef}
        className="absolute inset-0 pointer-events-none"
        style={{ transition: `background-color ${FADE_DURATION}ms ease` }}
      />

      <div
        className="slideshow-container absolute top-0 right-0 bottom-0 w-[60%]"
        style={(() => {
          const mask = [
            'linear-gradient(to right,',
            '  transparent 0%,',
            '  rgba(0,0,0,0.08) 2%,',
            '  rgba(0,0,0,0.20) 5%,',
            '  rgba(0,0,0,0.38) 9%,',
            '  rgba(0,0,0,0.58) 12%,',
            '  rgba(0,0,0,0.78) 15%,',
            '  rgba(0,0,0,0.93) 17%,',
            '  black 18%,',
            '  black 100%',
            ')',
          ].join(' ')
          return { maskImage: mask, WebkitMaskImage: mask }
        })()}
      >
        <div
          ref={wrapper0Ref}
          className="absolute inset-0"
          style={{ opacity: 0 }}
        >
          <img
            ref={bg0Ref}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover', objectPosition: '50% 50%' }}
          />
        </div>
        <div
          ref={wrapper1Ref}
          className="absolute inset-0"
          style={{ opacity: 0 }}
        >
          <img
            ref={bg1Ref}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover', objectPosition: '50% 50%' }}
          />
        </div>
      </div>

      {/* Artist name — outside the mask so it's never partially faded */}
      {/* Hover handled purely by .artist-label-wrap CSS in SLIDESHOW_STYLES above */}
      <div
        ref={nameWrapRef}
        className="absolute z-[2] artist-label-wrap"
        style={{
          top: 36,
          right: 36,
          backgroundColor: 'white',
          padding: '0.4vh 0.4vw 0.1vh 0.4vw',
          overflow: 'visible',
          fontFamily: 'var(--font-helvetica)',
          fontWeight: 700,
          fontStyle: 'italic',
          fontSize: 'clamp(13px, 1.3vw, 20px)',
          userSelect: 'none',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'contents', position: 'relative' }}>
          <span ref={nameTextRef} className="artist-label-text" />
        </div>
      </div>
    </>
  )
}

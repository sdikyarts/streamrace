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
// Small gap above the top of the head before the pan starts (% of image height)
const HEAD_MARGIN = 3

const rng = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// x/y = focal center as % of natural image dimensions
// topY = top of head/subject as % of image height (pan starts just above here)
interface FacePos { x: number; y: number; topY: number; leftColor?: string; bottomColor?: string }
const DEFAULT_POS: FacePos = { x: 50, y: 38, topY: 15 }

function averageRGB(data: Uint8ClampedArray): string {
  let r = 0, g = 0, b = 0
  const len = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]; g += data[i + 1]; b += data[i + 2]
  }
  return `rgb(${Math.round(r / len)},${Math.round(g / len)},${Math.round(b / len)})`
}

// Convert a focal point (% of image) to CSS background-position (%) so that
// the focal point is centered in the element.
//
// CSS: offset_y = bg_pos_y/100 * (element_h - scaled_h)
// We want face_pixel_y = -offset_y + element_h/2
//   => bg_pos_y = (face_pixel_y - element_h/2) / (scaled_h - element_h) * 100
function focalToBgPos(focal: { x: number; y: number }, el: HTMLElement): { x: number; y: number } {
  const elW = el.offsetWidth
  const elH = el.offsetHeight
  // background-size: cover with square Spotify images → rendered size = max dimension
  const imgW = Math.max(elW, elH)
  const imgH = imgW

  const facePxX = (focal.x / 100) * imgW
  const facePxY = (focal.y / 100) * imgH

  const overflowX = imgW - elW
  const overflowY = imgH - elH

  const bgX = overflowX <= 0 ? 50 : Math.max(0, Math.min(100, (facePxX - elW / 2) / overflowX * 100))
  const bgY = overflowY <= 0 ? 50 : Math.max(0, Math.min(100, (facePxY - elH / 2) / overflowY * 100))

  return { x: bgX, y: bgY }
}

// Native face detection -------------------------------------------------------

type NativeDetectedFace = {
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
}

type NativeFaceDetector = {
  detect: (source: CanvasImageSource) => Promise<NativeDetectedFace[]>
}

declare global {
  // eslint-disable-next-line no-var
  var FaceDetector: ((new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => NativeFaceDetector) | undefined)
}

function scaleToCanvas(img: HTMLImageElement, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function detectNativeFace(img: HTMLImageElement): Promise<FacePos | null> {
  if (!globalThis.FaceDetector) return null

  try {
    const detector = new globalThis.FaceDetector({ fastMode: true, maxDetectedFaces: 5 })
    const faces = await detector.detect(img)
    if (!faces.length) return null

    let sumX = 0, sumY = 0, topMostY = Infinity
    for (const { boundingBox } of faces) {
      const x1 = boundingBox.x
      const y1 = boundingBox.y
      const x2 = boundingBox.x + boundingBox.width
      const y2 = boundingBox.y + boundingBox.height
      sumX += (x1 + x2) / 2
      sumY += (y1 + y2) / 2
      if (y1 < topMostY) topMostY = y1
    }

    return {
      x: Math.round((sumX / faces.length / img.naturalWidth) * 100),
      y: Math.round((sumY / faces.length / img.naturalHeight) * 100),
      topY: Math.max(0, Math.round((topMostY / img.naturalHeight) * 100)),
    }
  } catch {
    return null
  }
}

// ── Visual saliency (profiles, logos, objects, text) ─────────────────────────
// Weighted centroid of high-contrast + high-saturation regions, biased toward
// the upper-center of the frame where the subject's head almost always appears
// in portrait / artist-photo compositions.
function computeSaliencyPos(canvas: HTMLCanvasElement): FacePos {
  const ctx = canvas.getContext('2d')
  if (!ctx) return DEFAULT_POS

  const { width, height } = canvas
  const { data } = ctx.getImageData(0, 0, width, height)

  const step = Math.max(2, Math.floor(Math.min(width, height) / 64))
  let totalW = 0, wX = 0, wY = 0

  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const i = (y * width + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2]

      const gray = r * 0.299 + g * 0.587 + b * 0.114
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const sat = max === 0 ? 0 : (max - min) / max

      const ri = (y * width + Math.min(x + step, width - 1)) * 4
      const bi = (Math.min(y + step, height - 1) * width + x) * 4
      const grayR = data[ri] * 0.299 + data[ri + 1] * 0.587 + data[ri + 2] * 0.114
      const grayB = data[bi] * 0.299 + data[bi + 1] * 0.587 + data[bi + 2] * 0.114
      const grad = Math.abs(gray - grayR) + Math.abs(gray - grayB)

      // Mild horizontal center bias only. A Y bias causes wrong results when
      // the subject is in the lower portion of the frame, pulling the centroid
      // upward and making the pan start far from the actual subject.
      const dx = Math.abs(x / width - 0.5)
      const bias = 1.15 - dx * 0.3  // 1.15× at centre-x, 1.0× at edges

      const w = (grad + sat * 128) * bias
      totalW += w; wX += x * w; wY += y * w
    }
  }

  if (totalW === 0) return DEFAULT_POS

  const cx = Math.round((wX / totalW / width) * 100)
  const cy = Math.round((wY / totalW / height) * 100)
  // Estimate head top: portraits usually have ~15-20% of head height above center
  const topY = Math.max(0, cy - 18)
  return { x: cx, y: cy, topY }
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
  // We must also suppress the wrap's transform transition during the swap;
  // otherwise the translateX(-50%) centering animates when the container
  // resizes, causing a visible lateral slide while the text is invisible.
  if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
    wrap.removeEventListener('transitionend', clearWidthTransition)
    pendingNameSwap = null
    wrap.style.width = ''
    wrap.style.overflow = ''

    text.style.transition = 'opacity 0.32s ease'
    text.style.opacity = '0'

    widthFallbackTimer = setTimeout(() => {
      widthFallbackTimer = null
      // Disable wrap transitions so the width change doesn't animate translateX
      wrap.style.transition = 'none'
      text.textContent = name
      void wrap.getBoundingClientRect()  // commit new layout instantly
      wrap.style.transition = ''         // restore CSS transitions

      requestAnimationFrame(() => {
        text.style.opacity = '1'
        // Clean up the inline transition after fade-in so gradient hover works
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

  // Temporarily inject new name with nowrap to measure target width, then restore
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

  // Clip during the morph so the old (invisible) text can't visually bleed out
  wrap.style.overflow = 'hidden'
  // Fade text out (old name), morph container, then swap text and fade in
  text.style.transition = 'opacity 0.3s ease'
  text.style.opacity = '0'
  pendingNameSwap = { text, name }
  // Include transform so hover zoom stays smooth during a slide transition
  wrap.style.transition = 'width 0.55s cubic-bezier(0.22,1,0.36,1), transform 0.45s cubic-bezier(0.22,1,0.36,1)'
  wrap.style.width = `${nextWidth}px`
  wrap.removeEventListener('transitionend', clearWidthTransition)
  wrap.addEventListener('transitionend', clearWidthTransition)
  // Fallback: if transitionend doesn't fire (same-width names), swap after delay
  widthFallbackTimer = setTimeout(() => {
    widthFallbackTimer = null
    doNameSwap(wrap)
  }, 650)
}

// ── Detection entry point ────────────────────────────────────────────────────
function preloadAndDetect(url: string): Promise<FacePos> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const smallCanvas = scaleToCanvas(img, 0.25)

        // Extract edge accent colors for gradient smoothing
        let leftColor: string | undefined
        let bottomColor: string | undefined
        try {
          const ctx = smallCanvas.getContext('2d')!
          const w = smallCanvas.width, h = smallCanvas.height
          const leftW = Math.max(1, Math.round(w * 0.08))
          leftColor = averageRGB(ctx.getImageData(0, 0, leftW, h).data)
          const botH = Math.max(1, Math.round(h * 0.08))
          bottomColor = averageRGB(ctx.getImageData(0, h - botH, w, botH).data)
        } catch { /* CORS blocked — skip color extraction */ }

        const nativeFace = await detectNativeFace(img)
        if (nativeFace) return resolve({ ...nativeFace, leftColor, bottomColor })

        resolve({ ...computeSaliencyPos(smallCanvas), leftColor, bottomColor })
      } catch {
        resolve(DEFAULT_POS)
      }
    }
    img.onerror = () => resolve(DEFAULT_POS)
    img.src = url
  })
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
  const faceCache = useRef<Map<string, FacePos>>(new Map())
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

  const peekAhead = useCallback((count: number): string[] => {
    const deck = deckRef.current
    const pos = posRef.current
    return Array.from({ length: count }, (_, i) => deck[(pos + i) % deck.length])
  }, [])

  const cacheDetect = useCallback(async (url: string): Promise<FacePos> => {
    if (faceCache.current.has(url)) return faceCache.current.get(url)!
    const pos = await preloadAndDetect(url)
    faceCache.current.set(url, pos)
    return pos
  }, [])

  function startPan(slot: 0 | 1, url: string) {
    const el = getBgEl(slot)
    const isMobile = window.matchMedia('(max-width: 1024px)').matches
    const focal = faceCache.current.get(url)

    // Imperatively set accent base color (avoids React re-renders during transitions).
    // This div sits BELOW the image; the image's mask makes its edge transparent so
    // the accent color bleeds through — blending image into accent instead of into black.
    const accentEl = accentGradientRef.current
    if (accentEl) {
      const color = isMobile ? (focal?.bottomColor ?? 'rgb(14,14,14)') : (focal?.leftColor ?? 'rgb(14,14,14)')
      accentEl.style.background = color
    }

    if (isMobile) {
      el.style.transition = 'none'
      el.style.objectPosition = '50% 50%'
      return
    }

    const focalPos = focal ?? DEFAULT_POS

    // Pan starts just above the top of the head, ends at face/subject center
    // Always center horizontally; only pan vertically to the face
    const aboveHead = Math.max(0, focalPos.topY - HEAD_MARGIN)
    const startX = 50
    let startY = focalToBgPos({ x: focalPos.x, y: aboveHead }, el).y
    const endX = 50
    let endY = focalToBgPos(focalPos, el).y

    // When the focal point is in the upper quarter of the image, focalToBgPos
    // clamps both start and end to 0% — no visible movement. Fall back to a
    // gentle top-to-centre pan so there's always some motion.
    if (Math.abs(startY - endY) < 4 && Math.abs(startX - endX) < 4) {
      startY = 0
      endY = 30
    }

    el.style.transition = 'none'
    el.style.objectPosition = `${startX}% ${startY}%`
    el.getBoundingClientRect()
    el.style.transition = `object-position ${SLIDE_DURATION + FADE_DURATION}ms linear`
    el.style.objectPosition = `${endX}% ${endY}%`
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

      const firstDetection = cacheDetect(first)
      const secondDetection = second === first ? firstDetection : cacheDetect(second)
      await Promise.all([firstDetection, secondDetection])
      if (cancelled) return

      getBgEl(0).src = first
      getBgEl(1).src = second
      layerUrls.current = [first, second]

      startPan(0, first)
      fadeIn(0)
      showNameFirst(first)
      setReady(true)

      for (const url of peekAhead(2)) cacheDetect(url)
    }

    // SSR data → localStorage cache → network fetch (first-visit fallback)
    const immediate = initialArtists?.length ? initialArtists : loadCachedArtists()
    if (immediate) init(immediate)

    fetch('/api/artist-images', { signal: controller.signal })
      .then(async r => {
        if (!r.ok) {
          throw new Error(`Artist image request failed with ${r.status}`)
        }
        return r.json()
      })
      .then(({ artists }: { artists: { url: string; name: string }[] }) => {
        if (cancelled) return
        saveCachedArtists(artists)
        init(artists)  // no-op if already started
      })
      .catch(() => {
        // Keep the static hero usable even if the slideshow API is unavailable.
      })
      .finally(() => {
        globalThis.clearTimeout(timeoutId)
      })

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

      startPan(incoming, inUrl)
      fadeIn(incoming)
      fadeOut(outgoing)
      transitionName(inUrl)
      activeRef.current = incoming

      innerTimer = setTimeout(() => {
        innerTimer = null
        const next = getNext()
        getBgEl(outgoing).src = next
        layerUrls.current[outgoing] = next
        cacheDetect(next)
        for (const url of peekAhead(2)) cacheDetect(url)
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

      {/* Bottommost base layer — solid accent color that the image edge blends into.
          Must come BEFORE slideshow-container so it renders below the image (same z-auto stacking, DOM order wins).
          transition: background-color syncs color change with the 1800ms image crossfade. */}
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
            '  rgba(0,0,0,0.08) 8%,',
            '  rgba(0,0,0,0.20) 18%,',
            '  rgba(0,0,0,0.38) 28%,',
            '  rgba(0,0,0,0.58) 37%,',
            '  rgba(0,0,0,0.78) 46%,',
            '  rgba(0,0,0,0.93) 52%,',
            '  black 57%,',
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
            style={{
              objectFit: 'cover',
              objectPosition: `50% 50%`,
            }}
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
            style={{
              objectFit: 'cover',
              objectPosition: `50% 50%`,
            }}
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

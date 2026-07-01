'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import ArtistSlideshow from './ArtistSlideshow'


export default function LandingPage({ initialArtists = [] }: Readonly<{ initialArtists?: { url: string; name: string }[] }>) {
  const [expanded, setExpanded] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const [panelH, setPanelH] = useState(180)

  useEffect(() => {
    if (!expanded) return
    const panel = panelRef.current
    const close = (e: Event) => {
      if (panel && !panel.contains(e.target as Node)) setExpanded(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [expanded])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const update = () => setPanelH(panel.offsetHeight)
    update()
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update)
      ro.observe(panel)
      return () => ro.disconnect()
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#0e0e0e]"
      data-panel-open={expanded ? '' : undefined}
      style={{ '--panel-h': `${panelH}px`, height: '100dvh' } as React.CSSProperties}
    >
      <ArtistSlideshow initialArtists={initialArtists} />

      {/* Left-edge gradient: covers the image behind the UI panel */}
      <div
        className="bg-gradient-overlay absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: 'linear-gradient(to right, #0e0e0e 18%, rgba(14,14,14,0.78) 34%, rgba(14,14,14,0.3) 52%, transparent 66%)',
        }}
      />

      <style>{`
        @keyframes flyInEl {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .zoom-el {
          transform-origin: left center;
          transition: transform 0.2s ease;
        }
        .zoom-el:hover { transform: scale(1.06); }

        .start-btn {
          background-image: linear-gradient(to right, #800C81, #E71616, #BEA500, #E71616, #800C81);
          background-size: 200% 100%;
          background-position: 0% 0%;
          transition: background-position 0.5s ease, transform 0.2s ease;
        }
        .start-btn:hover { background-position: 100% 0%; }

        .credits-link {
          background-image: linear-gradient(to right, #E71616, #E71616 33%, #BEA500 100%);
          background-size: 300% 100%;
          background-position: 0% 0%;
          transition: background-position 0.5s ease, transform 0.2s ease;
        }
        .credits-link:hover { background-position: 65% 0%; }

        .leads-link {
          background-image: linear-gradient(to right, #800C81, #800C81 33%, #E71616 100%);
          background-size: 300% 100%;
          background-position: 0% 0%;
          transition: background-position 0.5s ease, transform 0.2s ease;
        }
        .leads-link:hover { background-position: 65% 0%; }

        @media (max-width: 1024px) {
          .bg-gradient-overlay {
            background: linear-gradient(to top, #0e0e0e 18%, rgba(14,14,14,0.78) 34%, rgba(14,14,14,0.3) 52%, transparent 66%) !important;
          }
          .ui-panel {
            top: auto !important;
            left: 50% !important;
            bottom: 10dvh !important;
            transform: translateX(-50%) !important;
            width: min(57vw, 230px) !important;
          }
          .zoom-el {
            transform-origin: center center !important;
          }
          .start-btn {
            padding: 8px 10px !important;
            font-size: clamp(14px, 4.5vw, 18px) !important;
          }
          .credits-link, .leads-link {
            padding: 8px 10px !important;
            font-size: clamp(14px, 4.5vw, 18px) !important;
          }
          .tagline {
            font-size: clamp(14px, 4.5vw, 18px) !important;
            text-align: center !important;
          }
        }
        @media (hover: none) {
          .zoom-el:active {
            transform: scale(1.06) !important;
            transition: transform 0.05s ease !important;
          }
          .start-btn:active {
            background-position: 100% 0% !important;
            transition: background-position 0.1s ease !important;
          }
          .credits-link:active {
            background-position: 65% 0% !important;
            transition: background-position 0.1s ease !important;
          }
          .leads-link:active {
            background-position: 65% 0% !important;
            transition: background-position 0.1s ease !important;
          }
        }
      `}</style>

      <div
        ref={panelRef}
        className="ui-panel absolute z-[2]"
        style={{
          top: '50%',
          left: '8.7vw',
          width: 'clamp(180px, 18.5vw, 350px)',
          transform: 'translateY(-50%)',
          fontFamily: 'var(--font-helvetica)',
          fontWeight: 700,
          fontStyle: 'italic',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/streamrace-logo.svg"
          alt="StreamRace"
          className="w-full h-auto block zoom-el"
          style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.55))', animation: 'flyInEl 0.55s cubic-bezier(0.22,1,0.36,1) 0s backwards' }}
        />

        <p
          className="text-[#FFFBF7] zoom-el tagline"
          style={{ fontSize: 'clamp(13px, 1.5vw, 25px)', lineHeight: 1.2, textShadow: '0 1px 8px rgba(0,0,0,0.6)', animation: 'flyInEl 0.55s cubic-bezier(0.22,1,0.36,1) 0.07s backwards' }}
        >
          <span className="block whitespace-nowrap">Not monthly listeners.</span>
          <span className="block whitespace-nowrap">The all-time stream race.</span>
        </p>

        <div className="flex flex-col" style={{ marginTop: '1.75vh', animation: 'flyInEl 0.55s cubic-bezier(0.22,1,0.36,1) 0.14s backwards' }}>
          <button
            onClick={() => setExpanded(v => !v)}
            className="start-btn flex items-center justify-between w-full text-[#FFFBF7] cursor-pointer zoom-el"
            style={{
              fontSize: 'clamp(13px, 1.5vw, 25px)',
              padding: '0.75vh 0.75vw',
              border: 'none',
              boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
            }}
          >
            <span className="whitespace-nowrap">START THE RACE</span>
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 0.35s ease',
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 27" fill="none" style={{ height: '0.75em', width: 'auto', display: 'block' }}>
                <path d="M-9.34601e-05 0V26.1336L22.5698 13.0668" fill="#FFFBF7"/>
              </svg>
            </span>
          </button>

          {/* Expandable links */}
          <div
            style={{
              overflow: expanded ? 'visible' : 'hidden',
              maxHeight: expanded ? '300px' : '0',
              marginTop: expanded ? '1.2vh' : '0',
              opacity: expanded ? 1 : 0,
              transition: 'max-height 0.35s ease, margin-top 0.35s ease, opacity 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2vh',
            }}
          >
            <Link
              href="/all-credits"
              className="credits-link flex items-center justify-between w-full text-[#FFFBF7] zoom-el"
              style={{
                fontSize: 'clamp(13px, 1.5vw, 25px)',
                padding: '0.75vh 0.75vw',
                boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
              }}
            >
              <span className="whitespace-nowrap">All-Credits Mode</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 26" fill="none" style={{ height: '0.9em', width: 'auto', display: 'block', flexShrink: 0 }}>
                <path d="M5.24959 0C3.58338 1.66156 2.26187 3.63596 1.36098 5.80978C0.460092 7.98359 -0.00242127 10.314 9.53196e-06 12.6671C9.53196e-06 17.6121 2.00668 22.0912 5.24959 25.3342L7.77584 22.8079C6.44042 21.4794 5.38216 19.8988 4.66246 18.158C3.94276 16.4172 3.57596 14.5508 3.58334 12.6671C3.58334 8.7075 5.17793 5.10625 7.77584 2.52625L5.24959 0ZM30.5838 0L28.0575 2.52625C29.3913 3.85599 30.4485 5.43676 31.1681 7.1773C31.8877 8.91784 32.2554 10.7837 32.25 12.6671C32.25 16.6446 30.6554 20.2279 28.0575 22.8079L30.5838 25.3342C32.25 23.6726 33.5715 21.6982 34.4724 19.5244C35.3733 17.3506 35.8358 15.0202 35.8333 12.6671C35.8333 7.72208 33.8267 3.24292 30.5838 0ZM10.32 5.07042C9.3199 6.06652 8.52648 7.25042 7.98533 8.5541C7.44417 9.85778 7.16596 11.2555 7.16668 12.6671C7.16668 15.6233 8.36709 18.3108 10.32 20.2637L12.8463 17.7375C12.1809 17.0714 11.6534 16.2808 11.2937 15.4108C10.934 14.5408 10.7493 13.6085 10.75 12.6671C10.75 10.6783 11.5563 8.88667 12.8463 7.59667L10.32 5.07042ZM25.5133 5.07042L22.9871 7.59667C23.6524 8.26272 24.18 9.05333 24.5396 9.92333C24.8993 10.7933 25.0841 11.7257 25.0833 12.6671C25.0833 14.6558 24.2771 16.4475 22.9871 17.7375L25.5133 20.2637C26.5134 19.2676 27.3069 18.0837 27.848 16.7801C28.3892 15.4764 28.6674 14.0786 28.6667 12.6671C28.6667 9.71083 27.4663 7.02333 25.5133 5.07042ZM17.9167 9.08375C16.9663 9.08375 16.0549 9.46128 15.3829 10.1333C14.7109 10.8053 14.3333 11.7167 14.3333 12.6671C14.3333 13.6174 14.7109 14.5289 15.3829 15.2009C16.0549 15.8729 16.9663 16.2504 17.9167 16.2504C18.867 16.2504 19.7785 15.8729 20.4505 15.2009C21.1225 14.5289 21.5 13.6174 21.5 12.6671C21.5 11.7167 21.1225 10.8053 20.4505 10.1333C19.7785 9.46128 18.867 9.08375 17.9167 9.08375Z" fill="#FFFBF7"/>
              </svg>
            </Link>

            <Link
              href="/lead-streams"
              className="leads-link flex items-center justify-between w-full text-[#FFFBF7] zoom-el"
              style={{
                fontSize: 'clamp(13px, 1.5vw, 25px)',
                padding: '0.75vh 0.75vw',
                boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
              }}
            >
              <span className="whitespace-nowrap">Lead Streams Mode</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 33" fill="none" style={{ height: '0.9em', width: 'auto', display: 'block', flexShrink: 0 }}>
                <path d="M16.1525 0C9.39791 0 3.95124 5.28542 3.61082 11.9325L0.170822 16.4654C-0.259178 17.0208 0.170822 17.9167 0.923322 17.9167H3.61082V23.2917C3.61082 25.2804 5.2054 26.875 7.19415 26.875H8.98582V32.25H21.5275V23.8471C25.7737 21.8404 28.6942 17.5583 28.6942 12.5417C28.6942 5.62583 23.1042 0 16.1525 0ZM15.2029 17.9167L8.98582 11.6458L11.4942 9.11958L15.2029 12.8462L22.6025 5.375L25.1108 7.90125L15.2029 17.9167Z" fill="#FFFBF7"/>
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function LandingPage() {
  const [expanded, setExpanded] = useState(false)
  const [btnHovered, setBtnHovered] = useState(false)
  const [creditsHovered, setCreditsHovered] = useState(false)
  const [leadsHovered, setLeadsHovered] = useState(false)

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0e0e0e]">
      {/* Background: placeholder for artist Spotify photo slideshow */}
      <div className="absolute inset-0" />

      {/* Gradient overlay: dark left → transparent right */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background:
            'linear-gradient(to right, #0e0e0e 40%, rgba(14,14,14,0.9) 55%, rgba(14,14,14,0.3) 70%, transparent 85%)',
        }}
      />

      <style>{`
        @keyframes flyInUp {
          from {
            opacity: 0;
            transform: translateY(calc(-50% + 40px));
          }
          to {
            opacity: 1;
            transform: translateY(-50%);
          }
        }
        .zoom-el {
          transform-origin: left center;
          transition: transform 0.2s ease;
        }
        .zoom-el:hover {
          transform: scale(1.06);
        }
      `}</style>

      <div
        className="absolute z-[2]"
        style={{
          top: '50%',
          left: '8.7vw',
          width: 'clamp(180px, 18.5vw, 350px)',
          transform: 'translateY(-50%)',
          fontFamily: 'var(--font-helvetica)',
          fontWeight: 700,
          fontStyle: 'italic',
          animation: 'flyInUp 0.65s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      >
        {/* Logo SVG — drop streamrace-logo.svg into /public */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/streamrace-logo.svg"
          alt="StreamRace"
          className="w-full h-auto block zoom-el"
        />

        {/* Tagline */}
        <p
          className="text-[#FFFBF7] zoom-el"
          style={{ fontSize: 'clamp(13px, 1.5vw, 25px)', lineHeight: 1.2 }}
        >
          <span className="block whitespace-nowrap">Not monthly listeners.</span>
          <span className="block whitespace-nowrap">The all-time stream race.</span>
        </p>

        {/* Button stack */}
        <div className="flex flex-col" style={{ marginTop: '1.75vh' }}>
          <button
            onClick={() => setExpanded(!expanded)}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
            className="flex items-center justify-between w-full text-[#FFFBF7] cursor-pointer zoom-el"
            style={{
              background: 'linear-gradient(to right, #800C81, #E71616, #BEA500, #E71616, #800C81)',
              backgroundSize: '200% 100%',
              backgroundPosition: btnHovered ? '100% 0%' : '0% 0%',
              transition: 'background-position 0.5s ease, transform 0.2s ease',
              fontSize: 'clamp(13px, 1.5vw, 25px)',
              padding: '0.75vh 0.75vw',
              border: 'none',
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
              onMouseEnter={() => setCreditsHovered(true)}
              onMouseLeave={() => setCreditsHovered(false)}
              className="flex items-center justify-between w-full text-[#FFFBF7] zoom-el"
              style={{
                fontSize: 'clamp(13px, 1.5vw, 25px)',
                padding: '0.75vh 0.75vw',
                backgroundImage: 'linear-gradient(to right, #E71616, #E71616 33%, #BEA500 100%)',
                backgroundSize: '300% 100%',
                backgroundPosition: creditsHovered ? '65% 0%' : '0% 0%',
                transition: 'background-position 0.5s ease, transform 0.2s ease',
              }}
            >
              <span className="whitespace-nowrap">All-Credits Mode</span>
              <span>((·))</span>
            </Link>

            <Link
              href="/lead-streams"
              onMouseEnter={() => setLeadsHovered(true)}
              onMouseLeave={() => setLeadsHovered(false)}
              className="flex items-center justify-between w-full text-[#FFFBF7] zoom-el"
              style={{
                fontSize: 'clamp(13px, 1.5vw, 25px)',
                padding: '0.75vh 0.75vw',
                backgroundImage: 'linear-gradient(to right, #800C81, #800C81 33%, #E71616 100%)',
                backgroundSize: '300% 100%',
                backgroundPosition: leadsHovered ? '65% 0%' : '0% 0%',
                transition: 'background-position 0.5s ease, transform 0.2s ease',
              }}
            >
              <span className="whitespace-nowrap">Lead Streams Mode</span>
              <span>✓</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

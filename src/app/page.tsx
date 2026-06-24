'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Home() {
  const [expanded, setExpanded] = useState(false)

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

      {/* Content */}
      <div
        className="absolute z-[2] font-inter font-bold italic"
        style={{
          top: '13.24vh',
          left: '8.7vw',
          width: '22.8vw',
        }}
      >
        {/* Logo SVG — drop streamrace-logo.svg into /public */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/streamrace-logo.svg"
          alt="StreamRace"
          className="w-full h-auto block"
        />

        {/* Tagline */}
        <p
          className="text-[#FFFBF7] leading-snug mt-0"
          style={{ fontSize: '1.87vw' }}
        >
          Not monthly listeners.
          <br />
          The all-time stream race.
        </p>

        {/* Button stack */}
        <div
          className="flex flex-col"
          style={{ marginTop: '2.5vh', gap: '1.67vh' }}
        >
          {/* START THE RACE */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-between w-full text-[#FFFBF7] cursor-pointer"
            style={{
              background:
                'linear-gradient(to right, #800C81 0%, #E71616 50.49%, #BEA500 100%)',
              fontSize: '1.87vw',
              padding: '0.88vh 0.88vw',
            }}
          >
            <span>START THE RACE</span>
            <span>{expanded ? '▼' : '▶'}</span>
          </button>

          {/* Mode buttons — visible when expanded */}
          {expanded && (
            <>
              <Link
                href="/all-credits"
                className="flex items-center justify-between w-full text-[#FFFBF7] bg-[#E71616]"
                style={{ fontSize: '1.87vw', padding: '0.88vh 0.88vw' }}
              >
                <span>All-Credits Mode</span>
                <span>((·))</span>
              </Link>

              <Link
                href="/lead-streams"
                className="flex items-center justify-between w-full text-[#FFFBF7] bg-[#800C81]"
                style={{ fontSize: '1.87vw', padding: '0.88vh 0.88vw' }}
              >
                <span>Lead Streams Mode</span>
                <span>✓</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

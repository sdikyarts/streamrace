import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const helvetica = localFont({
  src: "./fonts/HelveticaNeueBoldItalic.otf",
  variable: "--font-helvetica",
  weight: "700",
  style: "italic",
})

const burstSpeed = localFont({
  src: "./fonts/Burst Speed.ttf",
  variable: "--font-burst",
});

export const metadata: Metadata = {
  title: "StreamRace",
  description: "Not monthly listeners. The all-time stream race.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${helvetica.variable} ${burstSpeed.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}

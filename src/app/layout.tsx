import type { Metadata } from "next";
import { Caveat, Inter, Outfit } from "next/font/google";
import { themeScript } from "@/components/layout/ThemeToggle";
import { siteConfig } from "@/config/site";
import { publicEnv } from "@/config/env";
import "./globals.css";

/**
 * Type ramp for brand direction "Daylight" — see docs/branding.md.
 *
 * Two faces, no mono. Outfit is the geometric display voice used on page
 * titles, the wordmark and hero figures; Inter carries every other pixel of UI
 * text. Numbers use Inter with tabular figures (the `.tabular` class) rather
 * than a third font, so a changing score never jitters and never shifts voice.
 */
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * One handwriting face, used in exactly one place: the pinned note in the
 * landing hero. It is there because a real sticky note is the most direct way
 * to say "your own messy material goes in here" — not as a decorative script.
 */
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.appUrl),
  title: {
    default: `${siteConfig.name} — AI study companion`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${inter.variable} ${caveat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies a stored theme choice before first paint, so a dark-mode
            student never gets a flash of the light canvas. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

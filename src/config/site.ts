/**
 * Static, non-secret configuration for the Acadify app.
 * Anything that varies per environment belongs in `src/config/env.ts`.
 */
export const siteConfig = {
  name: "Acadify",
  tagline: "Don't just study more. Study what matters.",
  description:
    "An AI-powered study companion that helps students organize, understand, and master their schoolwork.",
} as const;

export type SiteConfig = typeof siteConfig;

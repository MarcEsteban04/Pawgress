import { siteConfig } from "@/config/site";

/**
 * Placeholder landing page.
 * The real marketing page is designed in Sprint 04 (wireframes) and built
 * once the design system lands in Sprint 06.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">{siteConfig.name}</h1>
      <p className="text-lg text-balance opacity-80">{siteConfig.description}</p>
      <p className="text-sm opacity-60">{siteConfig.tagline}</p>
    </main>
  );
}

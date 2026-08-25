import { ArrowRight, BrainCircuit, ClipboardCheck, TrendingUp, UploadCloud } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { buttonStyles, Card, CardBody, Donut, MasteryBar, SourceChip } from "@/components/ui";
import { HeroDecor, HeroStack } from "@/features/marketing/components/HeroDecor";
import { MarkTile } from "@/features/marketing/components/HeroObjects";
import { EVIDENCE_TOPICS } from "@/config/showcase";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Landing page — screen 1 in docs/navigation.md.
 *
 * Full-bleed: the page runs edge to edge, and the hero is a dot-textured band
 * with the product's own surfaces scattered around a centred headline.
 *
 * Width is held back on the CONTENT, never on the background. Bands span the
 * viewport; the text inside them is capped at 70rem, because a measure that
 * grows with the monitor stops being readable somewhere around 90 characters.
 *
 * Two things make the composition work rather than just look busy:
 *
 *  1. The objects are cropped by the band's edge. A card cut off by the edge
 *     reads as part of a larger surface continuing past it; a card that fits
 *     neatly inside reads as a sticker.
 *  2. Everything in them is real. The bars are `MasteryBar` with its real
 *     low-evidence rule, the citation is `SourceChip`. A hero built from mock
 *     screenshots drifts away from the product within one sprint.
 *
 * Server Component: nothing here needs state or effects.
 */

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#trust", label: "Why trust it" },
  { href: "#loop", label: "The loop" },
];

const LOOP = [
  {
    Icon: UploadCloud,
    label: "Upload",
    note: "PDF, PPTX, DOCX or notes you type yourself.",
    tone: 1,
  },
  {
    Icon: BrainCircuit,
    label: "Review",
    note: "Reviewers, key terms and flashcards, generated from your material.",
    tone: 3,
  },
  {
    Icon: ClipboardCheck,
    label: "Quiz",
    note: "Practice questions written from your own pages, not a question bank.",
    tone: 4,
  },
  {
    Icon: TrendingUp,
    label: "Track",
    note: "Every answer sharpens what Pawgress tells you to study next.",
    tone: 5,
  },
] as const;

const TONE_TILE = {
  1: "bg-cat-1-soft text-cat-1",
  3: "bg-cat-3-soft text-cat-3",
  4: "bg-cat-4-soft text-cat-4",
  5: "bg-cat-5-soft text-cat-5",
} as const;

export default function LandingPage() {
  return (
    <div className="w-full flex-1 bg-frame">
      {/* Full-bleed: the page IS the frame, so there is no radius or shadow to
          draw — both would fall off the viewport edge. Width is held back on
          the CONTENT instead, because a 2000px measure is unreadable however
          nice the background looks. */}
      <div className="w-full">
        {/* ---- Nav ---------------------------------------------------- */}
        <header className="mx-auto flex h-16 w-full max-w-[110rem] items-center gap-4 px-4 sm:h-[4.5rem] sm:px-8 lg:px-12">
          <Link href="/" aria-label="Pawgress home" className="shrink-0">
            <Logo />
          </Link>

          <nav aria-label="Primary" className="flex-1 justify-center gap-9 max-lg:hidden lg:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[0.9375rem] text-ink-muted transition-colors hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex-1 lg:hidden" />

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className="rounded-[var(--radius-pill)] px-3 py-2 text-[0.9375rem] text-ink-muted transition-colors hover:text-ink max-sm:hidden"
            >
              Sign in
            </Link>
            <Link href="/register" className={buttonStyles({ variant: "subtle", size: "sm" })}>
              Get started
            </Link>
          </div>
        </header>

        {/* ---- Hero ---------------------------------------------------- */}
        <section className="dot-grid relative overflow-hidden border-y border-rule">
          <HeroDecor />

          <div className="relative mx-auto flex min-h-[34rem] w-full max-w-[70rem] flex-col items-center justify-center gap-7 px-5 py-16 text-center sm:px-8 sm:py-20 xl:min-h-[42rem]">
            <MarkTile className="drift" />

            {/* The two-tone headline: the promise in ink, the payoff in grey. */}
            <h1
              className={cn(
                "font-display font-semibold tracking-[-0.035em] text-balance",
                "text-[clamp(2.5rem,6.4vw,5rem)] leading-[1.04]",
              )}
            >
              Upload it, understand it,
              <br />
              <span className="text-ink-subtle">know what to study next</span>
            </h1>

            <p className="max-w-[46ch] text-base leading-relaxed text-ink-muted sm:text-lg">
              Pawgress turns your own schoolwork into reviewers, flashcards and quizzes — then tells
              you which topic is actually holding you back.
            </p>

            <Link href="/register" className={buttonStyles({ variant: "accent", size: "lg" })}>
              Get started — it&rsquo;s free
              <ArrowRight />
            </Link>

            <p className="text-sm text-ink-subtle">No credit card. No app to install.</p>

            <HeroStack />
          </div>
        </section>

        {/* ---- The loop ------------------------------------------------ */}
        <section id="how" className="scroll-mt-6 px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
          <div className="mx-auto max-w-[70rem]">
            <p className="text-sm text-ink-muted">How it works</p>
            <h2 className="mt-2 font-display text-[clamp(1.875rem,3.4vw,2.75rem)] leading-tight font-semibold tracking-[-0.025em]">
              One loop, four steps
            </h2>
            <p className="mt-3 max-w-[54ch] leading-relaxed text-ink-muted">
              Every reviewer and every question comes from the material you uploaded — and every
              answer you give feeds back into what Pawgress recommends next.
            </p>

            <ol id="loop" className="mt-10 grid scroll-mt-6 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {LOOP.map(({ Icon, label, note, tone }, i) => (
                <li key={label}>
                  <Card className="h-full">
                    <CardBody className="flex h-full flex-col gap-3 pt-5">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex size-10 items-center justify-center rounded-[0.75rem]",
                            TONE_TILE[tone],
                          )}
                        >
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="tabular text-sm text-ink-subtle">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <h3 className="font-display text-xl font-semibold">{label}</h3>
                      <p className="text-sm leading-relaxed text-ink-muted">{note}</p>
                    </CardBody>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---- What it actually tells you ------------------------------ */}
        <section className="px-5 pb-16 sm:px-8 sm:pb-24 lg:px-12">
          <div className="mx-auto grid max-w-[70rem] items-center gap-8 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="text-sm text-ink-muted">What you get back</p>
              <h2 className="mt-2 font-display text-[clamp(1.875rem,3.4vw,2.75rem)] leading-tight font-semibold tracking-[-0.025em]">
                A number you can argue with
              </h2>
              <p className="mt-4 max-w-[52ch] leading-relaxed text-ink-muted">
                Every mastery percentage arrives with the number of questions it came from. Under
                ten answers, Pawgress refuses to show a percentage at all and says so — because a
                confident-looking 100% from three lucky guesses is worse than no number.
              </p>
            </div>

            <Card>
              <CardBody className="flex flex-col gap-5 pt-6">
                <Donut
                  segments={[
                    { label: "Not started", value: 4, step: "none" },
                    { label: "Weak", value: 5, step: 1 },
                    { label: "Developing", value: 7, step: 2 },
                    { label: "Strong", value: 6, step: 4 },
                  ]}
                  centerValue="68%"
                  centerLabel="ready"
                />
                <div className="flex flex-col gap-4 border-t border-rule pt-5">
                  {EVIDENCE_TOPICS.map((topic) => (
                    <MasteryBar
                      key={topic.topic}
                      label={topic.topic}
                      tone={topic.tone}
                      value={topic.value}
                      questionCount={topic.questionCount}
                    />
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </section>

        {/* ---- Trust --------------------------------------------------- */}
        <section id="trust" className="scroll-mt-6 px-5 pb-16 sm:px-8 sm:pb-24 lg:px-12">
          <div className="mx-auto grid max-w-[70rem] gap-8 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="text-sm text-ink-muted">Why you can trust it</p>
              <h2 className="mt-2 font-display text-[clamp(1.875rem,3.4vw,2.75rem)] leading-tight font-semibold tracking-[-0.025em]">
                Every answer cites your material
              </h2>
              <p className="mt-4 max-w-[52ch] leading-relaxed text-ink-muted">
                Summaries, flashcards and quiz questions all point back to the page they came from,
                so you can check them. If your material doesn&rsquo;t cover something, Pawgress says
                so instead of inventing an answer.
              </p>
            </div>

            <Card>
              <CardBody className="pt-6">
                <p className="text-[0.9375rem] leading-relaxed">
                  A Punnett square is a grid for working out which allele combinations two parents
                  can produce. Each parent&rsquo;s alleles go along one edge, and each cell is one
                  possible outcome.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SourceChip material="Lecture 4.pdf" page={6} />
                  <SourceChip material="Lecture 4.pdf" page={7} />
                </div>
              </CardBody>
            </Card>
          </div>
        </section>

        {/* ---- Close --------------------------------------------------- */}
        <section className="dot-grid border-t border-rule">
          <div className="mx-auto flex w-full max-w-[70rem] flex-col items-center gap-6 px-5 py-16 text-center sm:py-24">
            <h2 className="font-display text-[clamp(1.875rem,4vw,3rem)] leading-tight font-semibold tracking-[-0.03em] text-balance">
              Find out what to study next
            </h2>
            <p className="max-w-[46ch] leading-relaxed text-ink-muted">
              Upload one lecture and take one quiz. That is enough for Pawgress to tell you where
              your weakest topic is.
            </p>
            <Link href="/register" className={buttonStyles({ variant: "accent", size: "lg" })}>
              Get started
              <ArrowRight />
            </Link>
          </div>
        </section>

        {/* ---- Footer -------------------------------------------------- */}
        <footer className="mx-auto flex w-full max-w-[110rem] flex-col gap-2 px-5 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:px-8 lg:px-12">
          <span>
            {siteConfig.name} — {siteConfig.tagline}
          </span>
          <div className="flex-1" />
          <span>Built for students, not for grading them.</span>
        </footer>
      </div>
    </div>
  );
}

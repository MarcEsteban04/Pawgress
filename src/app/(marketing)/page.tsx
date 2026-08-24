import { ArrowRight, BrainCircuit, ClipboardCheck, TrendingUp, UploadCloud } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import {
  buttonStyles,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Donut,
  MasteryBar,
  SourceChip,
  Tag,
} from "@/components/ui";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Landing page — screen 1 in docs/navigation.md.
 *
 * One idea, shown rather than described: the hero visual is the real dashboard
 * built from the real components, not a screenshot and not a mock. If the
 * product cannot carry its own landing page, the landing page is lying.
 *
 * No feature grid, no testimonials, no pricing. The loop is the marketing, and
 * "Recursion 31% — study this" does the persuading.
 *
 * Server Component: nothing here needs state or effects.
 */

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

const TONE_CHIP = {
  1: "bg-cat-1-soft text-cat-1",
  3: "bg-cat-3-soft text-cat-3",
  4: "bg-cat-4-soft text-cat-4",
  5: "bg-cat-5-soft text-cat-5",
} as const;

export default function LandingPage() {
  return (
    <div className="mx-auto flex w-full max-w-[78rem] flex-1 flex-col px-4 sm:px-6">
      {/* Floating nav pill, matching the shell's chrome. */}
      <header className="sticky top-3 z-40 mt-3 sm:top-5 sm:mt-5">
        <div className="flex h-16 items-center gap-4 rounded-[var(--radius-pill)] border border-rule bg-paper/85 px-4 shadow-[var(--shadow-card)] backdrop-blur-md sm:px-6">
          <Link href="/" aria-label="Pawgress home">
            <Logo />
          </Link>
          <div className="flex-1" />
          <Link href="/login" className={buttonStyles({ variant: "ghost", size: "sm" })}>
            Sign in
          </Link>
          <Link href="/register" className={buttonStyles({ size: "sm" })}>
            Get started
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-rule bg-paper/80 px-3 py-1.5 text-xs font-medium text-ink-muted backdrop-blur">
              For high school and college students
            </span>

            <h1 className="mt-5 font-display text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-[3.5rem]">
              Don&rsquo;t just study more. Study what matters.
            </h1>

            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-ink-muted">
              Upload your schoolwork. Pawgress turns it into reviewers, flashcards and quizzes —
              then tells you which topic is actually holding you back, and how long to spend on it
              today.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className={buttonStyles({ size: "lg" })}>
                Get started — it&rsquo;s free
                <ArrowRight />
              </Link>
              <span className="text-sm text-ink-muted">No credit card. No app to install.</span>
            </div>

            <div className="mt-9 flex flex-wrap gap-2">
              {["PDF", "PPTX", "DOCX", "Images", "Your own notes"].map((format) => (
                <Tag key={format} className="bg-paper/80 backdrop-blur">
                  {format}
                </Tag>
              ))}
            </div>
          </div>

          {/* The product, not a picture of the product. */}
          <div className="relative">
            <div className="flex flex-col gap-4 rounded-[var(--radius-canvas)] border border-rule bg-paper/70 p-4 shadow-[var(--shadow-canvas)] backdrop-blur-sm sm:p-5">
              <Card>
                <CardHeader>
                  <CardTitle>Topic mastery</CardTitle>
                </CardHeader>
                <CardBody>
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
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>After your first quiz</CardTitle>
                </CardHeader>
                <CardBody className="flex flex-col gap-4">
                  <MasteryBar
                    dense
                    hideEvidence
                    label="Recursion"
                    value={0.31}
                    questionCount={16}
                  />
                  <MasteryBar
                    dense
                    hideEvidence
                    label="Cell structure"
                    value={0.88}
                    questionCount={22}
                  />
                  <MasteryBar
                    dense
                    hideEvidence
                    label="Photosynthesis"
                    value={1}
                    questionCount={4}
                  />

                  <div className="border-t border-rule pt-4">
                    <p className="text-[0.9375rem] leading-relaxed">
                      Recursion is holding you back. Twenty minutes of review and practice would
                      move it more than anything else today.
                    </p>
                    <div className="mt-3">
                      <SourceChip material="Lecture 9.pdf" page={4} />
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </section>

        {/* The loop */}
        <section className="py-14 sm:py-16">
          <p className="text-sm text-ink-muted">How it works</p>
          <h2 className="mt-2 font-display text-[2rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[2.5rem]">
            One loop, four steps
          </h2>
          <p className="mt-3 max-w-[54ch] leading-relaxed text-ink-muted">
            Every reviewer and every question comes from the material you uploaded — and every
            answer you give feeds back into what Pawgress recommends next.
          </p>

          <ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP.map(({ Icon, label, note, tone }, i) => (
              <li key={label}>
                <Card className="h-full">
                  <CardBody className="flex h-full flex-col gap-3 pt-5">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-10 items-center justify-center rounded-[var(--radius-control)]",
                          TONE_CHIP[tone],
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
        </section>

        {/* Honesty section — the thing that earns trust in an AI product. */}
        <section className="py-14 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="text-sm text-ink-muted">Why you can trust it</p>
              <h2 className="mt-2 font-display text-[2rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[2.5rem]">
                Every answer cites your material
              </h2>
              <p className="mt-4 max-w-[52ch] leading-relaxed text-ink-muted">
                Summaries, flashcards and quiz questions all point back to the page they came from,
                so you can check them. If your material doesn&rsquo;t cover something, Pawgress says
                so instead of inventing an answer.
              </p>
            </div>

            <Card>
              <CardBody className="pt-5">
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

        {/* Close */}
        <section className="pb-14 sm:pb-16">
          <Card className="overflow-hidden">
            <CardBody className="flex flex-col items-start gap-5 py-10 sm:items-center sm:py-14 sm:text-center">
              <h2 className="font-display text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-[2.5rem]">
                Find out what to study next
              </h2>
              <p className="max-w-[46ch] leading-relaxed text-ink-muted">
                Upload one lecture and take one quiz. That is enough for Pawgress to tell you where
                your weakest topic is.
              </p>
              <Link href="/register" className={buttonStyles({ size: "lg" })}>
                Get started
                <ArrowRight />
              </Link>
            </CardBody>
          </Card>
        </section>
      </main>

      <footer className="flex flex-col gap-2 border-t border-rule/60 py-8 text-sm text-ink-muted sm:flex-row sm:items-center">
        <span>
          {siteConfig.name} — {siteConfig.tagline}
        </span>
        <div className="flex-1" />
        <span>Built for students, not for grading them.</span>
      </footer>
    </div>
  );
}

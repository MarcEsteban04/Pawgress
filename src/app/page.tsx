import { ArrowRight, BrainCircuit, ClipboardCheck, TrendingUp, UploadCloud } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import {
  buttonStyles,
  Card,
  CardBody,
  MasteryBar,
  SectionLabel,
  SourceChip,
  StatusBadge,
} from "@/components/ui";
import { siteConfig } from "@/config/site";

/**
 * Landing page — screen 1 in docs/navigation.md.
 *
 * One screenful that explains the loop: no feature grid, no testimonials, no
 * pricing. The loop diagram is the marketing, and the live mastery card does
 * the persuading, because "Genetics 42% — study this" is the whole product.
 *
 * Server Component: nothing here needs state or effects.
 */

const LOOP = [
  { Icon: UploadCloud, label: "Upload", note: "PDF, PPTX, DOCX or your own notes" },
  { Icon: BrainCircuit, label: "Review", note: "Reviewers, key terms, flashcards" },
  { Icon: ClipboardCheck, label: "Quiz", note: "Questions from your own material" },
  { Icon: TrendingUp, label: "Track", note: "See exactly what to study next" },
];

export default function LandingPage() {
  return (
    <>
      <header className="border-b border-rule">
        <div className="mx-auto flex h-16 w-full max-w-[75rem] items-center gap-4 px-5 sm:px-8">
          <Logo />
          <div className="flex-1" />
          <Link href="/login" className={buttonStyles({ variant: "ghost", size: "sm" })}>
            Sign in
          </Link>
          <Link href="/register" className={buttonStyles({ variant: "primary", size: "sm" })}>
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[75rem] flex-1 px-5 sm:px-8">
        {/* Hero */}
        <section className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <h1 className="font-display text-[2.5rem] leading-[1.08] font-medium tracking-tight sm:text-[3.25rem]">
              Don&rsquo;t just study more.
              <br />
              Study what matters.
            </h1>

            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-ink-muted">
              Upload your schoolwork. Pawgress turns it into reviewers, flashcards and quizzes, then
              tells you which topic is actually holding you back.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className={buttonStyles({ size: "lg" })}>
                Get started — it&rsquo;s free
                <ArrowRight />
              </Link>
              <span className="font-mono text-xs text-ink-subtle">
                No credit card. No app to install.
              </span>
            </div>

            <p className="mt-10 text-sm text-ink-muted">
              Works with <strong className="font-semibold text-ink">PDF, PPTX and DOCX</strong> — or
              notes you type yourself.
            </p>
          </div>

          {/* The claim, shown rather than described. */}
          <Card className="shadow-[0_1px_0_var(--rule)]">
            <CardBody className="pt-4">
              <SectionLabel>After your first quiz</SectionLabel>

              <div className="mt-4 flex flex-col gap-5">
                <MasteryBar label="Genetics" value={0.42} questionCount={12} />
                <MasteryBar label="Cell structure" value={0.88} questionCount={16} />
                <MasteryBar label="Photosynthesis" value={1} questionCount={4} />
              </div>

              <div className="mt-5 border-t border-rule pt-4">
                <p className="text-[0.9375rem] leading-relaxed">
                  Genetics is holding you back. Twenty minutes of review and practice would move it
                  more than anything else today.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <SourceChip material="Lecture 4.pdf" page={4} />
                  <StatusBadge status="ready" />
                </div>
              </div>
            </CardBody>
          </Card>
        </section>

        {/* The loop */}
        <section className="border-t border-rule py-14 sm:py-16">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-3 font-display text-3xl font-medium tracking-tight">
            One loop, four steps
          </h2>
          <p className="mt-3 max-w-[52ch] leading-relaxed text-ink-muted">
            Every reviewer and every question comes from the material you uploaded — and every
            answer you give feeds back into what Pawgress recommends next.
          </p>

          <ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP.map(({ Icon, label, note }, i) => (
              <li key={label}>
                <Card className="h-full">
                  <CardBody className="flex h-full flex-col gap-3 pt-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                        <Icon className="size-4.5" aria-hidden />
                      </span>
                      <span className="font-mono text-xs text-ink-subtle">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="font-display text-xl font-medium">{label}</h3>
                    <p className="text-sm leading-relaxed text-ink-muted">{note}</p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* Honesty section — the thing that earns trust in an AI product. */}
        <section className="border-t border-rule py-14 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionLabel>Why you can trust it</SectionLabel>
              <h2 className="mt-3 font-display text-3xl font-medium tracking-tight">
                Every answer cites your material
              </h2>
              <p className="mt-4 leading-relaxed text-ink-muted">
                Summaries, flashcards and quiz questions all point back to the page they came from,
                so you can check them. If your material doesn&rsquo;t cover something, Pawgress says
                so instead of inventing an answer.
              </p>
            </div>

            <Card>
              <CardBody className="pt-4">
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
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-2 px-5 py-8 text-sm text-ink-subtle sm:flex-row sm:items-center sm:px-8">
          <span className="font-mono text-xs">
            {siteConfig.name} — {siteConfig.tagline}
          </span>
          <div className="flex-1" />
          <span className="font-mono text-xs">Built for students, not for grading them.</span>
        </div>
      </footer>
    </>
  );
}

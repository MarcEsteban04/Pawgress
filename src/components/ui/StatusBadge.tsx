import {
  AlertTriangle,
  Ban,
  Check,
  Clock,
  FileText,
  Gauge,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { type ComponentType } from "react";
import { cn } from "@/lib/utils";
import { type JobStatus } from "@/types";

/**
 * One vocabulary for every long job, everywhere it appears (docs/states.md §3).
 *
 * Status is never signalled by colour alone — every entry carries an icon and a
 * text label, so it survives a greyscale screen, a colour-blind reader, and a
 * cheap phone at low brightness (NFR-A3).
 */
const STATUS: Record<
  JobStatus,
  { label: string; Icon: ComponentType<{ className?: string }>; tone: string; spin?: boolean }
> = {
  queued: { label: "Waiting to start", Icon: Clock, tone: "text-ink-muted" },
  uploading: { label: "Uploading", Icon: UploadCloud, tone: "text-ink-muted" },
  extracting: { label: "Reading your file", Icon: FileText, tone: "text-ink-muted" },
  embedding: { label: "Indexing for search", Icon: Sparkles, tone: "text-ink-muted" },
  generating: { label: "Generating", Icon: Sparkles, tone: "text-ink-muted" },
  ready: { label: "Ready", Icon: Check, tone: "text-good" },
  failed: { label: "Failed", Icon: AlertTriangle, tone: "text-bad" },
  cancelled: { label: "Cancelled", Icon: Ban, tone: "text-ink-subtle" },
  over_quota: { label: "Daily limit reached", Icon: Gauge, tone: "text-warn" },
};

export type StatusBadgeProps = {
  status: JobStatus;
  /** Replaces the default label — use it to say *why* something failed. */
  detail?: string;
  className?: string;
};

export function StatusBadge({ status, detail, className }: StatusBadgeProps) {
  const { label, Icon, tone } = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", tone, className)}>
      {/* Brand icon spec: 1.7px stroke on a 24px grid (docs/branding.md). */}
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="font-mono">{detail ?? label}</span>
    </span>
  );
}

/** The student-facing label for a status, for use outside the badge. */
export function statusLabel(status: JobStatus): string {
  return STATUS[status].label;
}

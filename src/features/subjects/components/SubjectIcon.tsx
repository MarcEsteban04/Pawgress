import {
  Book,
  Calculator,
  Code,
  Dumbbell,
  FlaskConical,
  Globe,
  Leaf,
  Music,
  Palette,
  Scroll,
  type LucideIcon,
} from "lucide-react";
import { type SubjectIcon as IconKey } from "@/lib/validation/subject";

/**
 * Maps the stored icon KEY to a component.
 *
 * The database stores `"flask"`, not a component or a class name — it should
 * not know what Lucide is, and a key survives swapping icon libraries. An
 * unknown or missing key falls back to the book, so removing an option from the
 * list never leaves an existing subject unrenderable.
 */
const ICONS: Record<IconKey, LucideIcon> = {
  book: Book,
  flask: FlaskConical,
  calculator: Calculator,
  globe: Globe,
  code: Code,
  palette: Palette,
  music: Music,
  dumbbell: Dumbbell,
  scroll: Scroll,
  leaf: Leaf,
};

export function subjectIconFor(key: string | null | undefined): LucideIcon {
  if (key && key in ICONS) return ICONS[key as IconKey];
  return Book;
}

/** Subject tints and inks, keyed by the categorical slot the subject owns. */
export const SUBJECT_TONE = {
  1: { tint: "bg-cat-1-soft", ink: "text-cat-1", dot: "bg-cat-1" },
  2: { tint: "bg-cat-2-soft", ink: "text-cat-2", dot: "bg-cat-2" },
  3: { tint: "bg-cat-3-soft", ink: "text-cat-3", dot: "bg-cat-3" },
  4: { tint: "bg-cat-4-soft", ink: "text-cat-4", dot: "bg-cat-4" },
  5: { tint: "bg-cat-5-soft", ink: "text-cat-5", dot: "bg-cat-5" },
} as const;

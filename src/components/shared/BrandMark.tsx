import Image from "next/image";
import logo from "@/assets/brand/pawgress-logo.png";
import { cn } from "@/lib/utils";

/**
 * The mascot alone, square, for chrome — nav rail, top bar, auth header.
 *
 * The supplied artwork is a wide lockup: mascot, books, laptop and the
 * "Pawgress" wordmark across 1536×1024. Shrunk whole to 28px it is an
 * unreadable smudge, and the wordmark would be repeated next to itself. So this
 * shows only the dog.
 *
 * **The crop is measured, not guessed.** Decoding the PNG's alpha channel
 * row by row put the mascot at roughly x 420–980, y 100–660 — a 560px square
 * that holds the cap, face and front paws and excludes the wordmark below.
 * The percentages below are that square expressed relative to the container:
 *
 *   scale  = container / 560
 *   width  = 1536 / 560  = 274%
 *   left   = -420 / 560  = -75%
 *   top    = -100 / 560  = -17.9%
 *
 * This is a workaround for an asset that does not exist. **A square,
 * mascot-only export would delete this whole component**, and would survive the
 * artwork being redrawn — these numbers will not. Noted in docs/branding.md.
 */
const CROP = { width: "274%", left: "-75%", top: "-17.9%" } as const;

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("relative block size-8 shrink-0 overflow-hidden rounded-[0.5rem]", className)}
    >
      <Image
        src={logo}
        alt=""
        aria-hidden
        // `sizes` stays small: this never renders larger than about 48px, and
        // without it Next would serve a width picked for the full-bleed hero.
        sizes="64px"
        className="absolute max-w-none"
        style={{ width: CROP.width, height: "auto", left: CROP.left, top: CROP.top }}
      />
    </span>
  );
}

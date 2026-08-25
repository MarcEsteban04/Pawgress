import Image from "next/image";
import logo from "@/assets/brand/pawgress-logo.png";
import { cn } from "@/lib/utils";

/**
 * The full brand lockup — mascot, cap, books and the Pawgress wordmark.
 *
 * `next/image` rather than a plain `<img>`, and this is not optional: the
 * source is 1536×1024 and **1.4 MB**. Served raw it would be the single
 * heaviest thing on the page by an order of magnitude. Next resizes it to the
 * widths actually requested and serves AVIF/WebP, which takes it to a few tens
 * of kilobytes. Importing the file (rather than passing a string path) also
 * hands Next the real dimensions at build time, so the space is reserved and
 * nothing shifts as it loads.
 *
 * WHERE THIS BELONGS: large brand moments only — the landing hero, the auth
 * aside. Chrome keeps the drawn `Logo`, because a detailed illustration at 28px
 * is an unreadable smudge and a wasted download, and the SVG follows the theme
 * while a raster cannot.
 *
 * ON LIGHT SURFACES: the wordmark's "Paw" is white with a dark outline, so it
 * reads by its stroke alone on a white card. Every placement here sits on the
 * dot-grid panel or a tinted surface for that reason — do not drop it onto
 * `bg-surface`.
 */
export function BrandMascot({
  className,
  priority = false,
  sizes = "(max-width: 640px) 260px, 340px",
}: {
  className?: string;
  /** Set on the landing hero: it is the largest above-the-fold image. */
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <Image
      src={logo}
      alt="Pawgress — a dog in a graduation cap studying at a laptop"
      className={cn("h-auto w-full max-w-[21rem] object-contain", className)}
      sizes={sizes}
      priority={priority}
      // The source carries ~13% empty padding on every side. Pulling it in
      // optically centres the artwork inside whatever box it is given.
      style={{ marginBlock: "-4%" }}
    />
  );
}

import { type ReactNode } from "react";
import {
  CheckTile,
  FormatsCard,
  PlanCard,
  ReminderCard,
  StickyNote,
  Stopwatch,
} from "./HeroObjects";
import { cn } from "@/lib/utils";

/**
 * Placement for the hero objects.
 *
 * They are positioned in percentages against the hero panel and allowed to run
 * off its edges — a card cropped by the frame reads as part of a larger surface
 * continuing past the window, which is what gives the composition depth. The
 * panel's `overflow-hidden` does the cropping.
 *
 * Only rendered from 1280px. Below that the composition genuinely cannot work:
 * scattered objects around a centred headline need horizontal room that a
 * laptop, let alone a phone, does not have. Rather than shrink it into a mess,
 * the hero falls back to a single stacked object under the call to action —
 * see `HeroStack`.
 *
 * `aria-hidden` throughout: every claim these objects make is also made in real
 * text elsewhere on the page, so a screen reader is not missing anything, and
 * announcing six decorative cards before the headline would be hostile.
 */

/** One placed object: percentage position, a fixed tilt, and its own drift phase. */
function Slot({
  children,
  className,
  rotate,
  delay,
}: {
  children: ReactNode;
  className?: string;
  rotate: string;
  /** Offsets the drift cycle so no two objects rise together. */
  delay: string;
}) {
  return (
    <div className={cn("drift absolute", className)} style={{ animationDelay: delay }}>
      <div style={{ transform: `rotate(${rotate})` }}>{children}</div>
    </div>
  );
}

export function HeroDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden xl:block">
      {/* Top left — the input: a note, and the tick that says it was handled. */}
      <Slot className="top-[7%] left-[3%]" rotate="-5deg" delay="0s">
        <StickyNote />
      </Slot>
      <Slot className="top-[26%] left-[1.5%]" rotate="-7deg" delay="-3s">
        <CheckTile />
      </Slot>

      {/* Top right — the clock and what it is counting down to. */}
      <Slot className="top-[13%] right-[19%]" rotate="-6deg" delay="-5s">
        <Stopwatch />
      </Slot>
      <Slot className="top-[4%] -right-[4%]" rotate="-9deg" delay="-1.5s">
        <ReminderCard />
      </Slot>

      {/* Bottom — the output, cropped by the panel so it reads as continuing. */}
      <Slot className="-bottom-[14%] left-[2%]" rotate="2deg" delay="-6.5s">
        <PlanCard />
      </Slot>
      <Slot className="right-[4%] -bottom-[12%]" rotate="-2deg" delay="-4s">
        <FormatsCard />
      </Slot>
    </div>
  );
}

/**
 * The narrow-viewport hero visual: one object instead of six.
 *
 * The plan card is the one that carries the whole promise — a topic, a length,
 * and a number with its evidence — so it is the one that survives the cut.
 */
export function HeroStack() {
  return (
    <div className="flex justify-center xl:hidden">
      <PlanCard className="w-full max-w-[21rem]" />
    </div>
  );
}

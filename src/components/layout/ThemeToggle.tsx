"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Theme control. Students study at night, so dark mode is a first-class option
 * rather than a retrofit.
 *
 * Three states, matching the token structure in globals.css: "system" stamps
 * nothing and lets `prefers-color-scheme` decide, while "light" and "dark" stamp
 * `data-theme` so an explicit choice beats the media query in both directions.
 *
 * The `data-theme` attribute is the single source of truth, not React state.
 * The inline script in the root layout sets it before first paint, so mirroring
 * it into state would mean rendering the wrong icon and then correcting it.
 * `useSyncExternalStore` reads the DOM directly instead — no effect, no
 * cascading render, no flash.
 */

export type ThemeChoice = "system" | "light" | "dark";
const STORAGE_KEY = "pawgress-theme";
const CHANGE_EVENT = "pawgress-theme-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Keeps two tabs of the same account in step.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): ThemeChoice {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" || attr === "dark" ? attr : "system";
}

/** The server cannot know the viewer's choice, so it renders the neutral one. */
function getServerSnapshot(): ThemeChoice {
  return "system";
}

function choose(next: ThemeChoice) {
  const root = document.documentElement;
  if (next === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", next);

  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private windows and blocked site data throw here. The choice still
    // applies to this page view, it just will not be remembered.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function ThemeToggle({ className }: { className?: string }) {
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const Icon = choice === "dark" ? Moon : choice === "light" ? Sun : Monitor;

  return (
    <Menu>
      <MenuTrigger
        aria-label={`Appearance: ${choice}`}
        className={cn(
          "flex size-9 items-center justify-center rounded-[var(--radius-control)] text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink",
          className,
        )}
      >
        <Icon className="size-[1.125rem]" aria-hidden />
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>Appearance</MenuLabel>
        <MenuItem onSelect={() => choose("system")}>
          <Monitor aria-hidden />
          System
        </MenuItem>
        <MenuItem onSelect={() => choose("light")}>
          <Sun aria-hidden />
          Light
        </MenuItem>
        <MenuItem onSelect={() => choose("dark")}>
          <Moon aria-hidden />
          Dark
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/**
 * Applies the stored choice before first paint. Inlined in the root layout —
 * it must run before hydration, which is the one legitimate blocking script here.
 */
export const themeScript = `(function(){try{var c=localStorage.getItem("${STORAGE_KEY}");if(c==="light"||c==="dark"){document.documentElement.setAttribute("data-theme",c)}}catch(e){}})();`;

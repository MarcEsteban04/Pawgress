/**
 * Most routes put nothing in the top bar. `default.tsx` is what makes that a
 * deliberate empty slot rather than a 404 when the toolbar slot has no match
 * for the current route.
 */
export default function ToolbarDefault() {
  return null;
}

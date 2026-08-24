# Canvas artboard conventions

Shared authoring notes for the `.dc.html` artboards in this folder. Not an artboard itself — the
`.md` extension keeps it off the canvas.

## Widths

| Artboard | Frame | Represents |
|---|---|---|
| Desktop | 1280 × 800 | The primary design target — a laptop browser window |
| Narrow | 360 × 840 | A phone browser, the adaptation |

Pawgress is a responsive **web app**. Desktop artboards carry a persistent 240 px sidebar and a
56 px top bar. Narrow artboards carry a 52 px top bar with a `☰` drawer trigger and **no bottom tab
bar** — bottom tabs are native-app chrome.

## Shared class vocabulary

Both widths use the same names so the two layouts read as one system:

- `.ap` / `.ph` — desktop shell / narrow shell root (fixed size, matches `canvas.json`)
- `.sb` `.brand` `.nav` `.ni` `.quota` — sidebar and its items (`.ni.on` = current)
- `.top` `.crumb` `.srch` `.av` — top bar
- `.cnt` — content column, `.grid2` / `.grid3` inside it
- `.card` `.row` `.hair` `.lbl` `.meta` — content primitives
- `.btn` `.btnp` `.btns` — action, primary action, small action
- `.bar` `.bar i` — progress and mastery bars
- `.chip` `.chip.on` — chip groups
- `.cite` — a page citation
- `.opt` `.opt.sel` `.k` — quiz options

## Rules

- Greyscale only. Brand colour, mascot and icon set are Sprint 05.
- Inline SVG for every icon, stroke-based on a 20/24 px grid — never emoji or dingbats.
- Keep the `<script src="./support.js">` head line exactly as it is.
- Real copy from `docs/wireframes.md`, never lorem ipsum.
- Fixed root height must match the `h` in `canvas.json`, or the artboard clips.

## Rebuilding the canvas

```bash
node <design-skill>/seed-canvas.mjs \
  --template <design-skill>/payload.template.html \
  --out pawgress-mvp-wireframes.html \
  --title "Pawgress MVP Wireframes" \
  --artboard Main.dc.html --artboard Subjects.dc.html --artboard SubjectHub.dc.html \
  --artboard Materials.dc.html --artboard Reviewer.dc.html --artboard Results.dc.html \
  --artboard QuizAttempt.dc.html --artboard Flashcards.dc.html --artboard QuizSetup.dc.html \
  --artboard Assistant.dc.html \
  --canvas canvas.json
```

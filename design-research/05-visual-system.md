# 05 · The visual system: colour, type, shape, depth and motion

Every value below is read from the shipped code (`css/tokens.css`, `css/app.css`, `css/base.css`, `js/ui.js`) at commit `81a21d6`. Contrast ratios are WCAG 2 relative luminance, computed for this document. Where the code departs from its own stated intent, that is noted in §8.

## 1. Where the palette came from

The palette was not invented for this UI. It was deliberately **distilled** from `xo-space-architecture-chip.html`, XO Space's own architecture diagram, under the design lead's direction (2026-10-13): the chip's primary background is the canvas, XO green is the single accent, and every other colour is drawn from the distilled palette.

From the chip came the dark canvas, panel and border greys, the text and muted greys, and the status hues (warning, danger, scope, component). XO green **`#83D63A`** is the 'O' of the mark. Three refinements then shaped the palette:

1. **Darker canvas.** `#1E1E1E` → **`#141414`**. A deeper ground gives the raised layers room above it; each panel step keeps the same relative lift, so layers still read.
2. **Soft geometry, not the chip's rectangles.** A wholesale re-skin to the chip's 2–4 px radii was built and rejected: it made the interface feel rigid, where the earlier soft shapes read as smooth. The decision: the chip's palette, Geist, type scale and glyphs are kept; its ideas are borrowed, not the whole costume.
3. **Tonal layers, not one flat grey.** When every surface shared one background, the screen read as monochrome and long passages became hard to read. The converged UI separates the side, the canvas and raised reading surfaces by lightness.

Decision kept from the chip: **in-between tints are mixed from the existing hues, never new hues.**

## 2. The colour scheme

### 2.1 Meaning first: one colour, one job

The header of `css/app.css` states the whole grammar:

> "Colour carries status so words don't have to: green = done, allowed · amber = needs you · blue = working · red = destructive or stopped · violet = the coordinator's own voice (suggestions, finds). Intelligence is neutral ink only. Nothing glows."

| Colour | Means | Never used for | Why this hue |
|---|---|---|---|
| **XO green** | Action, done, allowed, progress; the brand | Warnings, "needs you" | The brand's own mark; positive, calm, "it moved". The only accent, so the primary action is unmistakable. |
| **Amber** | Needs you (the person's turn) | Errors, decoration, pulsing | Warm, "your move" without alarm. The research's grammar: theirs is quiet motion; yours is warm and still. Amber never pulses (pulsing = fake urgency). |
| **Blue** | Working (an agent's turn) | Anything that needs the person | Cool and recessive. Agent work is kept visible but quiet. |
| **Red** | Destructive, stopped, failed | General emphasis, counts | Reserved for real danger, so it keeps its force. In review, the red card produced exactly the intended hesitation. |
| **Violet** | The coordinator's own voice: suggestions, finds | Status | A distinct channel for *opinion*, so advice is never mistaken for state or for the person's own choice. |
| **Neutral ink** | Everything else, including the intelligence chip | — | Most of the screen is kept quiet, so the few colours mean something. |

State never relies on hue alone. Each state also has a **shape** (from the chip): ◆ needs you, ○ ring working, ✓ done, ■ stopped, dashed ○ resolved, outlined ◇ held. This serves colour-blind users and makes the sidebar readable in greyscale.

### 2.2 Dark theme (the default)

**Surfaces (tonal layers, darkest to lightest).** Depth is shown by lightness, not by lines.

| Token | Hex | Role |
|---|---|---|
| `--side` | `#111111` | Sidebar and body: the deepest layer, so navigation recedes |
| `--canvas` / `--bg` | `#141414` | The main canvas behind conversations and Home |
| panel | `#171717` | The global decision panel |
| `--surface` | `#1A1A1A` | Raised reading surfaces: the next-move card, Now cards, thread cards, finds |
| card | `#1D1D1D` | The decision card |
| `--bg-3` / `--bg-4` | `#252525` / `#2E2E2E` | Hover and pressed fills |
| `--line` / `--line-hover` | `#323232` / `#565656` | 1 px borders, and their hover |

**Ink (four tiers).**

| Token | Hex | On canvas | Role |
|---|---|---|---|
| `--ink` | `#E1E1E1` | 14.1:1 | Headings, titles, prose |
| `--ink-2` | `#C1C1C1` | 10.2:1 | Secondary: row names, the why-line |
| `--ink-3` | `#909090` | 5.8:1 | Muted: labels, meta, icons |
| `--ink-4` | `#878787` | 5.1:1 | Quiet: dates, counts, times (≥4.5:1 on every surface it sits on) |

Primary ink is deliberately **not** pure white: `#E1E1E1` on `#141414` keeps 14:1 without the glare and halation of white on near-black during long reading.

**Accent and states.**

| Token | Hex | On canvas | Use |
|---|---|---|---|
| `--accent` / `--accent-fill` | `#83D63A` | 10.2:1 | Green text, icons and fills: Send, primary buttons, done segments, the focus ring (75%) |
| `--accent-ink` | `#141414` | 10.2:1 on green | Text and icons on a green fill |
| `--accent-hover` | `#96DC58` | | Hover on green fills |
| `--warn` (amber) | `#F5A623` | 9.1:1 | ◆ needs you, sidebar counts, the "Decide" button |
| `--info` (blue) | `#75ADF1` | 7.9:1 | ○ working, the busy dot, "doing" segments |
| `--err` | `#D7373F` | 4.0:1 | **Fills and tints only** (the destructive hold fill), never text |
| `--err-ink` | `#E68388` | 7.0:1 | Red **text**: "Stopped", "Destructive", facts lines |
| `--violet` | `#BF8DFF` | 7.4:1 | The suggestion spark, find icons, rare finds, the Think effort dial |

Why `--err` and `--err-ink` are split: the saturated danger red the chip uses is only 4:1 on the dark canvas, which fails body-text contrast. Text uses a lighter red; fills keep the strong one.

### 2.3 Light theme (designed, not inverted)

Light mode is held to high contrast so it never looks degraded. The result is "a high-contrast light theme, not an inversion: white surfaces on a warm off-white canvas; borders do the layering; ink is near-black and status hues are darkened (the XO tokens) so every label keeps ≥ 4.5:1" (`app.css`).

| Token | Hex | Contrast on canvas | Note |
|---|---|---|---|
| `--side` | `#EEEEEB` | | Warm grey sidebar |
| `--canvas` | `#F6F6F4` | | **Warm** off-white, not pure white, to cut glare |
| `--surface` | `#FFFFFF` | | Reading surfaces are the brightest layer, the reverse of dark |
| `--line` / `--line-hover` | `#CFCFCB` / `#9E9E99` | | Borders do the layering that lightness does in dark |
| `--ink` | `#151515` | 16.9:1 | |
| `--ink-2` | `#333333` | 11.7:1 | |
| `--ink-3` | `#575757` | 6.7:1 | |
| `--ink-4` | `#666666` | 5.3:1 | Quietest ink still ≥4.5:1 (asserted by test in the concept) |
| `--accent` (text) | `#487620` | 5.0:1 | Brand green darkened **for text only**. Brand green on white is only 1.8:1. |
| `--accent-fill` | `#83D63A` | | Fills keep the brand green; text on them is near-black (9.2:1) |
| `--warn` | `#8A4B0B` | 6.3:1 | Amber deepened to a brown-amber |
| `--info` | `#0851A7` | 7.1:1 | |
| `--err` / `--err-ink` | `#C9252D` / `#B52128` | 6.0:1 (ink) | |
| `--violet` | `#6D33B8` | 6.9:1 | |

Shadows weaken to 28% (`--sha: .28`) in light, because heavy shadows on white look dirty.

### 2.4 Tints and overlays

- **Subtle state tints** are mixed, never new hues: `color-mix(in srgb, <state> 14–16%, var(--bg-2))`. A project that needs you gets an amber-mixed tile, name and label.
- **Selection** is green at 28%. **Focus** is a 2 px ring of green at 75%, offset 2 px; on the destructive hold it turns red.
- **Overlay decision** (set in the precision refinement pass, 2026-10-14): when a decision surface covers content, the content behind it is darkened and blurred slightly (1.5px). When it sits beside content, nothing changes. The blur is held very subtle: enough to direct attention to the panel, never enough to hide what is behind it; revisit the amount if daily use shows it hides content or fails to direct attention. The decision follows what the layout does, not the device:

| Surface | Desktop | Phone (≤760 px) |
|---|---|---|
| Home "Needs you" panel | Nothing (it sits beside Home) | 0.45 dim + 1.5 px blur behind the bottom sheet |
| A thread's decision card over the conversation | 0.16 dim + 1.5 px blur | same |
| All threads sheet | dark backdrop, no blur | dark backdrop + 1.5 px blur |
| Dialogs (Create XO Project) | 0.55 dim + 3 px blur | same |

### 2.5 The XO mark

The mark is two strokes: the **X** in primary ink (`--mark-x`) and the **O** in XO green (`--mark-o`, `#83D63A` in both themes). The brand reads **XO Space**: the mark, then "Space" at weight 650. The Workspace uses the mark as its icon; projects use the **cube** (`ICON.project`, a box with an inner fold). The coordinator's avatar is the mark, a thread agent's avatar is a blue thread icon, so you always know who is speaking without faces or names.

**Decided 2026-10-21 (owner).**
- **"Cowork" is dropped; the brand is "XO Space"** (sidebar, tab title). This UI is becoming the only UI of XO Space (the old Space UI is being absorbed and then retired), so it carries the product's own name. Until then it read "**Space** Cowork".
- **The cube is back wherever a project is listed or titled**: sidebar rows, the project page title, the composer's @ list, Jump and the Create XO Project dialog. The owner asked for the classic UI's project icon back. It replaces the letter tile that came in with 17 · Converged. A row's busy dot and its amber or red needs-you tint stay on the cube's tile, so state still reads at a glance. Inline mentions (the back link, "project › thread" paths, "Routed to …" receipts) stay plain text, so a line of prose isn't broken up by icons.

## 3. Typography

**One family: Geist** (and Geist Mono only for code, commands, branch names, rule sentences and ids). Variable WOFF2 served locally (SIL OFL 1.1), no CDN. Geist is used everywhere, for one consistent typography, after the first version was found to read as generic, unconsidered output; it matches the chip and XO's identity, and its variable axis allows the in-between weights below.

**One human-sized scale** (`tokens.css`): "nothing below 10.5px, sentence case".

| Token | Size | Use |
|---|---|---|
| `--fs-xs` | 11 px | counts |
| `--fs-sm` | 12 px | secondary, meta |
| `--fs-base` | 13 px | UI |
| `--fs-md` | 14 px | titles, docks; the body default |
| `--fs-lg` | 15 px | conversation prose (line height 1.68, max 66 ch) |
| `--fs-xl` | 16 px | section titles; the composer (16 px also stops iOS zoom-on-focus) |
| `--fs-2xl` | 20 px | empty-state and decision headlines |

Display sizes sit above the scale and are used sparingly, for the few things meant to be read first: Home greeting 27 px, next-move headline 22 px, project title 22 px, decision headline 20 px, Workspace title 34 px.

**Decisions.**
- **Weights 400 / 500 / 550 / 600 / 650.** The variable font makes 550 and 650 real; they give hierarchy without the heaviness of bold.
- **Negative tracking that grows with size**: −0.005 em at 16 px to −0.034 em at 34 px. Large Geist looks loose without it.
- **Tabular numerals** on every count and time that changes, so numbers don't jitter.
- **Sentence case everywhere; no uppercase transforms.** Uppercase labels read as shouting and as "dashboard".
- **Measures of ~60–70 characters** for reading (prose 66 ch, calm lines 44–52 ch). This is the round-3 "reading architecture" fix.

## 4. Shape and space

**Soft and continuous geometry.** "Radii grow with the size of the surface (a 34 px control gets 10 px, a card 14 px, the composer 22 px)."

| Radius | Used for |
|---|---|
| 5–7 px | chips, risk tags |
| 8–11 px | small buttons, icon tiles |
| 12–16 px | rows and cards (sidebar rows 13, Now cards 14, thread cards 16) |
| 18–22 px | large surfaces: decision card 20, next-move card 22, composer 22, dialogs 22 |
| 24–26 px | the global panel 26; phone bottom sheets 24 at the top |
| pill | theme track, status line, badges, filters |

Why: in review, the earlier soft shapes read as smooth and the rigid rectangles of the chip re-skin were rejected. Soft corners on large surfaces make the screen feel calm and handled; small radii on small controls keep them precise. The user's own message bubble has a tail (`20 20 6 20`), the one asymmetric shape, so "mine" is recognisable at a glance. Borders always follow the radius: a red edge that flowed out past the curve was found to look wrong.

**Layout widths.** Sidebar 264 px (248 at ≤1320). Home column 660 px, centred: one column, one reading line. Conversation column 720 px; the composer, the docked decision card and the status line all align to that same 720 px. Global panel `clamp(392px, 33vw, 452px)`, sized to its content, beside the page rather than over it.

**Space.** Generous gaps between blocks; a block set too close to the one above was found to crowd it. Home sections are separated by about 30 px so each block is read as one idea.

**Touch.** Every target is at least 36 px at a 390 px phone width; decision buttons are 46–48 px.

## 5. Depth: elevation, glass and the composer

- **Elevation by need.** The highest shadows go to the surfaces that hold a decision: the global panel and dialogs (`0 30px 90px`), then the next-move card and the docked decision card. Ordinary rows have almost none.
- **An inset top hairline** (white at 3.5–4%) on raised surfaces gives a subtle lit edge in dark mode, the "premium" detail of physical materials.
- **The composer sits on a soft fade, not a box.** The direction was a full horizontal shadow with a glass-like quality. It was first built as a full-width glass bar; on a real screen it read as a box, not a shadow. Now the conversation fades into the canvas under the composer (a transparent-to-canvas gradient), and no edge is drawn. Decision from the refinement pass: when an effect is specified, the effect is built, not a surface that carries it.
- **Frosted glass** only where something floats over live content: the status-line pill (blur 14 px), the toast (16 px), the Workspace top bar after scrolling.
- **Hidden elements cast no shadow.** Two phone bugs came from shadows of things that were off screen (the closed drawer's 80 px shadow, a composer shadow reaching the screen edge).

## 6. Motion

**Principle (tokens.css): "Feedback is fast, layout settles; nothing bounces. Every animation is gated by prefers-reduced-motion."**

| Token | Value | For |
|---|---|---|
| `--dur-fast` | 120 ms | hover, press, colour |
| `--dur-base` | 180 ms | popovers, chips, one message entering |
| sheets, drawers, panels | 260–320 ms | larger layout changes |
| `--glide` | `cubic-bezier(.16,1,.3,1)` | entrances, slides (fast out, long settle) |
| `--press` | `cubic-bezier(.2,0,.2,1)` | press-scale feedback (90 ms) |
| `--spring` / `--spring-soft` | `cubic-bezier(.34,1.56,.64,1)` / `(.34,1.22,.64,1)` | the stamp, the lock, the toast: the few moments of "game feel" |
| JS `EASE` | `cubic-bezier(.3,.6,.25,1)`, 320 ms | every height morph; "a frame never moves more than ~40 px" |

**What moves, and why.**
- **Press**: buttons compress to about 0.97 on press (response under 100 ms). The body learns that it was heard.
- **Allow and Send back feel different**: Allow stamps a drawn check and lifts the card; Send back nudges and rewinds left. Different outcomes, different motion.
- **The destructive hold**: the fill grows slowly at first (`p^1.7`), the button tenses near the end, locks with a red fill, and springs back on early release. Tension is the point: this is the one action meant to feel heavy.
- **Disclosure** ("Details", Handled, end of day): one continuous 320 ms height morph with a cross-fade, never a jump. The earlier expansion was found abrupt in review.
- **Your message lifts from the composer** into the conversation (320 ms), so you see where it went.
- **Navigation**: going deeper slides in from the right, going back from the left, so space is consistent.
- **Ambient**: only the typing indicator and an agent's avatar ring breathe, and only while real work is happening. A sidebar project gets one 2.6 s amber wash when its needs-you count rises, then stays still.

**What never moves**: the composer (no glow, never pushed by a notification), quiet rows, anything under the pointer, the header when the day is sealed.

**Reduced motion**: a global CSS clamp sets every animation to 0.01 ms, and the JS checks the same media query so timed choreography collapses to instant states, count-ups jump to their value and smooth scrolls become instant. The meaning stays; only the movement goes.

## 7. Sound

Off by default and opt-in from the `?` sheet: "Soft sounds on Allow, Send back and 'That's everything'. Off unless you turn them on." Short sine notes, never for arrivals, never escalating. Sound is an attention channel too, and the default is to spend none of it.

## 8. Where the code departs from the intent

The code inventory found these gaps between stated intent and shipped CSS/JS. They are recorded here so a designer knows what the system *means* even where the code drifted. None has been changed by this document.

1. **Two token layers.** `tokens.css` defines the XO palette; `app.css` adds a second layer (`--canvas`, `--side`, `--surface`…) and a 37-step grey ladder (`--g14…--g72`) that is the de facto neutral scale. Many `tokens.css` tokens are unused.
2. **OS light preference is ignored.** The inline theme script always sets `data-theme`, so `prefers-color-scheme: light` never applies; the app starts dark until the person picks light.
3. **Light high-contrast mode does nothing** for ink-3/ink-4/lines, because `app.css`'s light block overrides `tokens.css`'s high-contrast block.
4. **About 35 dark-theme state colours are hard-coded** (`rgb(245 166 35 / …)` etc.) and don't switch in light; `mode.css` (the Demo/Live badge) is dark-only.
5. **Dark ink-3 (`#909090`) and ink-4 (`#878787`) are almost the same** (5.8 vs 5.1:1), so the two quiet tiers barely separate.
6. **The composer's focus indicator is weak**: `outline: none`, and the border changes `#2E2E2E → #3E3E3E` (about 1.7:1 against the canvas).
7. **"Nothing bounces"** vs the overshooting `--spring` on stamps and the lock; **"nothing below 10.5px"** vs 9–10 px glyphs in the checklist.
8. ~~**The tab title reads "◆ N · Converged"**, the concept's name.~~ Fixed 2026-10-21: it reads "◆ N · XO Space".
9. **Light, not costume (2026-10-22, if1 rework).** Ideas taken, toned down, from `launchpad-demo`. The canvas behind Home and Settings has a faint atmosphere (`--atmos`: green top-left, blue top-right, at 5–9 %). A 2 px state line runs along the top of the decision card and a thread's header: amber needs you, blue working, green done, red stopped. Blue is the only line that moves, as one slow sweep, and it stops under reduced motion. Code sits on a deeper `--term-bg`, and code colours are `--code-*` tokens mixed from the palette's own hues. Counts and ids are mono with tabular digits. Still nothing glows, and colour still means status, except inside code.

See [10-open-questions.md](10-open-questions.md) for which of these are worth fixing.

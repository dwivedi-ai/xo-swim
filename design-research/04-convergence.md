# 04 · How the design converged: from 49 ideas to 17 concepts to one

The shipped UI was not drawn once. It is what survived a single directed session (2026-10-13 16:28 → 2026-10-14 00:04 UTC) of research, divergence, building, design review and cutting. The design lead set the brief and the governing principle; AI agents were used at extreme scale to carry it out: research agents, 49 concepts from three ideators, a grounding critic, 17 built concepts across four rounds, an independent reviewer, 105 automated checks and a precision refinement pass. This document records that method so a reader can see *why* each part is the way it is, and what was tried and rejected.

## 1. The method

```
 Classic chat UI  ──►  Baby principles polish  ──►  XO chip palette + Geist  ──►  soft geometry, Home
                                                                                      │
 Human-nature research (15 truths) ─┐                                                 │
 Frontier scan ─────────────────────┼─►  3 radical ideators: 49 concepts              │
                                    │        (space/body · time/senses · society/myth) │
                                    └─►  Grounding critic: Keep 9 · Merge 30 · Drop 10  │
                                              │                                        │
                                              ▼                                        │
 Round 1  7 wild finalists (01–07) ── outcome: adopt the behaviour, reject the costumes ◄┘
 Round 2  3 texting mutations (08–10) ── governing principle: attention is controlled
 Round 3  3 attention-first takes (11–13) ── near convergence
 Round 4  1 converged base × 3 hook loops (14–16) + an independent reviewer
 Final    17 · Converged ── precision refinement pass ── shipped as xo-swim (commit 81a21d6)
```

**Divergence first.** Three read-only ideator agents were briefed to be radical, bold and out of distribution, with grounding deferred to a later stage. Each had one lens: *space, place and the body* (SB1–16), *time, rhythm and the senses* (TS1–16), *society, myth and relationship* (SM1–17). A fourth agent researched human nature; a fifth scanned the frontier. The brief was explicit: the systems everyone already uses were not the target; a breakthrough was.

**Grounding second.** A critic scored all 49 concepts on: fit with the 15 human truths, a concrete win over chat, healthy pull (durable vs compulsive), trust and control, buildability on the data available, and wildness. It kept 9, merged 30, dropped 10, and chose seven finalists, five wild and two practical. Its filter: a bold idea had to improve three things (seeing what needs the person, deciding fast and safely, and feeling the work move while away); an idea that is only unusual is cut.

**Convergence as evidence.** Where ideators proposed the same thing independently, the critic treated it as signal. The strongest: **the return moment** ("since you left → yours now"), proposed seven times by all three ideators.

**Design review on a canvas.** Every concept ran live, side by side, on a Figma-like review canvas with Inspect and pinned comments. 28 pinned review notes were recorded, and each round closed with a recorded outcome per concept. Each round's brief was written from those findings.

**Measured, not eyeballed.** Every build was checked in a browser (Demo only, all `/api/**` requests aborted): word counts on Home, moving elements over 20 s, `<kbd>` on screen, frame-by-frame expansion heights, focus after each answer, phone targets, light-mode contrast. The final concept passed 105 automated checks.

## 2. Before the concepts: the classic UI

| When | Direction | What changed |
|---|---|---|
| 16:28 | Apply the empathetic design principles from the baby/ research, aiming for a result that feels premium and state of the art | The Baby principles pass: instant acknowledgement, nothing jumps, forgiving (Retry/Edit, drafts never lost), the work is the hero, honest waits |
| 16:42 | The chip's primary background as the base, XO green as the accent | The chip palette and XO green `#83D63A` |
| 16:49 | Generic polish does not read as premium in the human sense | Geist everywhere; a rigid chip re-skin |
| 17:03 | Rigidity rejected; the earlier soft shapes restored; a home page showing what needs the person | Soft geometry; **Home** as the default page; Create XO Project; fresh-start chats |
| 17:13 | Old chat history is not loaded until scrolled to | Lazy history |
| 18:10 | No framework for now | Stay vanilla (see the FAQ) |
| 18:50 | A darker background | Canvas `#141414` |

Two lessons from this stretch carried through everything after: **premium means specific craft, not glows and pills**, and **borrow a reference's system, not its costume; establish which parts already work before rebuilding.**

## 3. Round 1: seven bold metaphors (01–07)

| # | Concept | The idea | Outcome | What survived |
|---|---|---|---|---|
| 01 | **The Round** | A theatre stage: each thread steps into the spotlight, says one line in huge type; nod, answer or step in | **Rejected**: the staged scene was found visually unacceptable and added nothing to deciding | One-at-a-time sequencing ("1 of 6"); a known end |
| 02 | **Audience Desk** | A petitions desk: asks arrive in "the file" grouped by risk; one decision on the floor at a time; risk has weight | **Adopted** (strongest concept), restyled: the way asks arrive and are taken in turn was the clearest model of deciding | **The Decision Kit** (1.2 s hold, 3 s Undo, equal Send back, Teach); risk grouping; one decision at a time with evidence beside it |
| 03 | **Threshold** | First-person house at dusk: whoever needs you stands at your door; projects are lit rooms | **Rejected**: it failed for the same reason as The Round | Nothing; it confirmed the figure-free decision |
| 04 | **Terrain** | Progress raises land; what needs you is a flare that never shrinks | **Rejected**: the same failure as 01 and 03 | Nothing |
| 05 | **The Loom** | The day as woven cloth; waiting threads hang paper tags styled by risk | **One element carried forward** (the tags): the tags made it immediately clear what needs action; the cloth around them was illegible | Risk-styled, instantly legible asks |
| 06 | **Gravity** | An orrery: what needs you falls to your horizon; agent work orbits quietly | **One element carried forward** (the intent): the orrery was rejected, but making decisions look easy was kept | Equal-weight Allow / Send back; "make deciding look easy" |
| 07 | **Periphery** | No panels; the screen's edges carry the workspace by light and warmth; a central composer | **Adopted** as the strongest base, with work needed: navigation was hard and project ownership unclear, but the composer and query flow were the cleanest element tested | **The composer and texting model**, `@project` aiming, "Sent to … · waiting for a thread"; the attention principle itself |

**The lesson of round 1**: legible, direct, calm UI with bold behaviour wins; decorative or figurative metaphors that need decoding lose. The round-2 brief recorded it as a decision: **boldness lives in behaviour and flow, not in visual code.**

Two more findings here shaped the product:
- **Game feel.** The interface learns from games: how the UI responds to each action shapes how that action feels, and very subtle responses carry outsized weight.
- **The red card.** In review, the red destructive card produced hesitation, and easier asks were cleared first. A proposal to soften it was rejected: this is treated as correct behaviour and a useful data point. → The decision: destructive asks stay red and serious, but are not forced first and do not nag.

## 4. Round 2: texting with decisions (08–10)

Three Audience Desk v2 variants were begun and then halted: the desk was already adopted, and what was needed was a texting UI of Periphery's quality carrying Audience's decision section. The product's frame changed here: **texting is the heart; deciding is a section of it.**

| # | Concept | Decisions lived… | Outcome |
|---|---|---|---|
| 08 | **Messages** | Inline in the conversation, plus a pinned "needs you" bar of tags and a review sheet | **Rejected**: the bar added nothing and was removed; the risk table overwhelmed and discouraged reading; transitions between questions animated badly; threads in the list added clutter |
| 09 | **Duet** | Docked in a column beside the chat | **One element carried forward**: responsive behaviour worked, but the layout was too cluttered and overwhelming. The completion animation and subtle activity glow were carried forward. It was decided that the sidebar does not list sessions unless that is explicitly specified |
| 10 | **Glide** | In a full-screen flow entered with one key, then back to exactly where you were | **Adopted** as round 3's shell: responsive and decision behaviour worked, but it read as generic and the flow took over the whole page. The clean dock, clean thread header and checklist bar were kept |

Round 2 also set these directions: a Workspace that looks like the main session, the Create XO Project button and Home summary restored, and no keyboard shortcut chips on screen. Shortcuts are surfaced only in tooltips and the `?` sheet; on-screen key hints were found to add clutter and cheapen the interface.

### The governing principle (20:31)

From this point, one principle informs every decision:

**The product is in control of attention.** The design does not drain mental effort on what the person does not need. The interface distinguishes what needs attention from what does not, and directs the person to the action that can be taken, what should get done. Minimalism is not the goal; directed attention is. What made Periphery work was not that it was minimal, but that it controlled attention. Anything that reaches the person reaches them for a reason; continuous bombardment was ruled out.

The working frame adopted from here on: attention is a budget the product spends on the person's behalf, and it is spent as a great chief of staff would spend it. Eight ideas followed: one next move; effort labels (Glance / Decide / Think); asks arrive at breakpoints; the coordinator pre-digests but never decides; quiet windows that can be trusted; labelled glows; progressive disclosure; the pull is progress, never noise.

## 5. Round 3: attention first (11–13)

All three started from Glide's shell with XO identity, Home, a distinct Workspace, Create XO Project, threads out of the sidebar, decisions in a focused panel, labelled glows and no shortcut chips.

| # | Concept | The idea | Kept | Fixed |
|---|---|---|---|---|
| 11 | **Next** | Home is **one next move**, the cheapest ask that unblocks real work, with an effort label and one "why first" sentence; Then ≤2; "Handled · 5 threads working, nothing to watch." | Home, which immediately shows what has to be decided; the Workspace; the global panel's size and position | The composer no longer glows on every event; no textarea scrollbar; too much text to attend to; drop "main session" |
| 12 | **Breakpoints** | Asks are held while you type or read and surface at natural pauses; the coordinator bundles them and suggests an answer it never applies | The suggestion; project title on top | A tall blank grey panel |
| 13 | **Today** | Home follows the day: a morning brief like a chief of staff's note; evening "Shipped today" | How decisions are taken; the sidebar; the Create button (moved to Home) | Abrupt expansion; too much text; names in sans; no sub-lines on quiet rows; an accent colour plus ◆ when a project needs you |

Two cross-cutting findings from the round-3 review:
- **Thread strips clutter as threads grow.** → The **Now shelf** (≤3, never grows) plus "All threads (n)" in a searchable sheet.
- **Monochrome pages make reading effortful.** → **Reading architecture**: tonal layers, one idea per line, details behind "Details", ~60–70 character measures, colour carrying status.

The **engagement direction** was also set in this round (see [07-decisions-pacing-and-ethics.md](07-decisions-pacing-and-ethics.md)): hooks are wanted, tied to real work. A raw catalogue of 195 hook mechanisms in 19 families was written to choose from.

## 6. Round 4: one base, three hook loops (14–16)

One converged base was built three times, each with a different engagement loop, then audited by an independent reviewer, briefed to be rigorous, honest and unsycophantic, before design review. The reviewer found the base 85–90% converged; what remained was honesty in the hook numbers and motion polish.

| # | Concept | Hook loop | Outcome |
|---|---|---|---|
| 14 | **Overnight** | Evening: plant up to 3 ripe items with a live forecast, seal the day; morning: harvest vs forecast, the first move ready | **One element carried forward** (the day-boundary moment): visually strong, but the planting concept did not read, and a bug showed "one thing paused on you" after everything was answered. Reviewer: the most emotional loop |
| 15 | **Chain** | Every answer shows what it unlocked; rules and earned notches reduce asks over time | **Rejected**: no part of the loop earned its place; "Asks per agent-hour" could not be understood |
| 16 | **Budget** | A daily attention budget (5/10/15 asks); asks bid by what they free; leverage-gated pings; a 25-min break; Found while working; Seal the day | **Adopted** as the base: the strongest Home and UI. But a fixed budget fails heavy users such as programmers, who can receive many asks; jargon ("Five Warm contexts will cool", "0.06 usd to reload") did not read; and the agent-hour savings had no visible basis |

The overall finding: budget and overnight mechanics on screen cluttered the interface and caused confusion. A new requirement was added: while something runs, a Stop button is shown.

The synthesis became principle P2: the confusion came from mechanics leaking into the interface; Budget and Overnight are good systems but bad screens. → **Systems work invisibly; the screen shows only outcomes and the next action.** The agent-hour figures were also found to be estimated, not measured, and not flagged as such; shipped as-is, they would have presented an invented number as fact.

## 7. 17 · Converged

Built from 16's Home and UI with the eleven round-4 decisions:

1. Drop all of 15 except a plain "3rd time · make it a rule?".
2. Base = 16 · Budget's Home and UI; sealing does not shift the layout.
3. No fixed daily number: invisible pacing, "worth your time" vs "can wait" with honest reasons, bundles.
4. No jargon.
5. Agent time only as labelled estimates, never "freed".
6. Overnight only at the day boundary ("Before you go: queue tonight's work, then seal") and a morning recap; "plant" → "Queue for tonight".
7. **Stop**: while something works, Send becomes Stop.
8. Sidebar: button-like glassy rows; text only when a project needs you.
9. Composer: a full horizontal shadow.
10. Light mode: a slide toggle and a designed high-contrast theme.
11. Keep the "?" at the bottom of the sidebar.

Plus a new capability specified mid-round: **intelligence per session** (choose model and depth; sticky per conversation; presented elegantly rather than as a conventional dropdown, which grows messy at scale).

**The precision refinement pass** (23:35 → 00:04) was entirely visual and held every pixel to attention and stillness: the composer's glass box became a soft fade, because the effect is a shadow, never a container; notifications no longer raise the composer; shadows from hidden elements were removed; and the overlay decision was settled: when a decision surface covers content, the content behind it is darkened and blurred slightly (1.5px); when it sits beside content, nothing changes. The final review confirmed 17 · Converged as the design.

**Then it shipped.** Commit `81a21d6` replaced the classic UI with 17 · Converged, wired to the live backend through `world.js`'s `liveSource`, with the simulated world kept as Demo mode.

## 8. The lineage: where every part came from

| Part of the shipped UI | Came from | How it changed |
|---|---|---|
| Texting frame, hero composer, `@project`, "Sent to … · waiting for a thread" | 07 Periphery → 10 Glide | Soft-fade bar, Stop, intelligence chip, never glows |
| The Decision Kit (1.2 s hold, 300 ms arm, 3 s Undo, inline note, Teach, focus on the card) | 02 Audience → 10 Glide (`kit.js`) | Unchanged since round 3; equal-weight buttons enforced |
| Allow ≠ Send back motion, the stamp, press scale | 10 Glide (game feel) | Green only on press and stamp |
| Equal-weight Allow and Send back | 06 Gravity's intent | Both outlined |
| Risk-legible asks, destructive set apart | 05 Loom's tags | A red chip and red facts line, not literal tags |
| Home: one next move, effort label, Then ≤2, "Clear n glances together", Handled | 11 Next | Shorter; a labelled estimate replaces "why first" |
| Global panel size and place, stable frame, three layers of context | 11 Next | Sized to content; opens on the next move |
| Workspace overview | 11 Next | No "main session"; a "Can wait" stat; rules in words |
| Coordinator's suggestion (violet, confidence, never pre-selected) | 12 Breakpoints | One quiet line |
| "Can wait" with reasons and Bring in | 12 (held + Show now) → 16 (Below the line) | Inside Handled |
| Project title on top | 12 Breakpoints | Kept |
| Two ways into a decision (just this one / walk the queue) | 13 Today | Kept |
| A thread's own docked decision card | 13 Today's panel, by design-lead direction | 320 ms frame morph |
| Sidebar of projects only, accent + ◆ when needed | 11 → 13 → 16 | Glass button rows |
| Create XO Project on Home | Classic UI → 13's style | On Home |
| Now shelf (≤3) + All threads sheet | 14 / 15 | Ellipsis titles |
| Evening queue, forecast, seal, morning recap | 14 Overnight + 16 Budget | One moment; "Queue for tonight"; *estimate* tags |
| Leverage ranking, small asks wait, one-shot pings, 25-min break | 16 Budget | Invisible; no number |
| Found while working | 16 Budget | Cap 3 → 2 |
| "3rd time this week · make it a rule?" | 15 Chain (Rule Smith) | The only Chain survivor |
| Completion moment | 09 Duet | A calm labelled line, never the composer |
| Labelled activity | 09 Duet | Only rows that need you get a soft wash |
| Stop | Round-4 direction | New |
| Intelligence per session | Round-4 direction | New |
| Light theme | Round-4 direction | New |

## 9. What was rejected, and the decision it led to

Each decision below rests on the finding beside it, and can be revisited if daily use shows that finding no longer holds.

| What was rejected | Finding | The decision it led to |
|---|---|---|
| Generic polished chat | Read as generic, not premium | Premium is specific craft, not glows, pills or a hero section |
| A rigid copy of the chip | Rigid; worse than the softer original | The system is kept, not the costume |
| Round, Threshold, Terrain | Figurative scenes added nothing to deciding | Figurative scenes fail |
| Loom's cloth | Illegible | Encoded visuals fail; tags succeed |
| Periphery's edges | Unclear which project owns what | Orientation; no unlabelled light |
| Duet | Cluttered and overwhelming | Clutter is the enemy |
| Glide | Generic; the flow took the whole page | The identity is kept; decisions rise in place |
| Messages' bar and table | Added nothing; overwhelming | No tag bars, no risk tables |
| Shortcut chips | Clutter that cheapens the interface | Tooltips and the "?" sheet only |
| Composer glow on events | The composer is not a notification surface | Completion goes to a calm line |
| Abrupt expansion | Abrupt height changes break calm | Continuous height morph |
| Chain | No part earned its place | Mechanics on screen confuse |
| Fixed ask budget | Fails heavy users who receive many asks | Invisible pacing |
| "Planting", warm contexts, $0.06 | Could not be understood | Plain words; no jargon |
| Glass box under the composer | The effect is a shadow, not a container | The effect is built, not a container |
| Notification pushing the composer | The composer moved | Nothing moves the composer |
| Off-screen shadows on phone | Hidden elements left a visible shadow | Hidden elements cast no shadow |

## 10. Why this design, and not one of the others

The brief was the design that leads to the most productivity while engaging the person in an empathetic way. The converged design wins on that brief for specific reasons:

- **It spends the person's attention only where their judgement is needed.** The bold metaphors spent attention on decoding. Duet spent it on clutter. Budget spent it on arithmetic. The converged Home spends it on one next move and its reason (P1, P2).
- **It makes deciding fast and safe at once.** Routine glances clear in seconds and can be bundled; destructive asks are slowed by a hold and set apart. Equal-weight "no" keeps the person steering (P6–P9).
- **It keeps agents working.** Pacing never holds an ask whose agent is idle, and ranks by agent work unblocked per second of the person. Productivity is measured in agent work unblocked, not in time on screen.
- **It respects how people actually behave.** The person may hesitate on the destructive ask and clear the easy ones first; the design allows exactly that. They may leave; nothing shames them. They may come back; the next move is waiting, unfocused, not pre-selected.
- **It is honest, so it can be trusted.** Every number is real or labelled. A product that supervises agents lives or dies on whether its signals can be believed.
- **It stays legible as it scales.** No threads in the sidebar, a Now shelf that never grows, a panel that never takes the page, and a texting model everyone already knows.

The empathy is not in tone; it is in **timing, restraint and control**. The productivity is not in pushing more asks; it is in **unblocking more agent work per second of human attention**.

**Where it stands.** The shipped version is a usable baseline, not the finished standard. It is being refined through daily professional use (everyday work, coding, and pro AI users), with each finding held to the same attention principle and the same measured checks. It is on the path to that standard, not at it. The vision is to innovate and pioneer human–AI interaction.

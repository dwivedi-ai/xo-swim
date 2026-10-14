# 02 · Design principles: the decisions and why

Fourteen decisions. Each records the **decision**, **why** it was taken (the human evidence, and the review findings and direction behind it), **where it came from** when the source is known, **how it shows** in the shipped UI, and **what would work against it**. Where two decisions have pulled against each other, the earlier one has been given precedence.

These are decisions taken with their reasoning, not fixed rules. Each can be revisited if daily use shows that its stated reason no longer holds; the reasoning below is the starting point for that.

Evidence grades follow the research notes: **A** meta-analysis or robust replication, **B** peer-reviewed with decent N, **C** small study or preprint, **D** practitioner opinion, **J** researcher judgement. Sources are listed in [sources.md](sources.md).

---

## P1 · Control attention; do not bombard

**Decision.** Every element is designed to earn the person's attention. What waits on a person is loud; what waits on an agent is quiet.

**Why.**
- Pre-attentive channels (colour, motion, size) are a budget. Motion onset is the strongest attention cue (Treisman & Gelade 1980, A; Abrams & Christ 2003, B; T8). If everything moves, nothing is noticed.
- Nuisance alerts dull responses to real ones (FAA alerting research; ATC). A system that cries wolf once loses trust in every signal.

**Where it came from.** The governing design direction (see [01 §4](01-thesis.md)): the product is in control of the person's attention, and the person is not continuously bombarded.

**How it shows.** Home is capped at four blocks and about 120 words. Working agents produce no motion on Home (measured: 0 moving elements over 20 s). The composer never glows. Quiet sidebar rows show only a name, plus a small blue dot while something works.

**What would work against it.** Toasts for non-events, badges that count everything, glowing rows that don't need the person, decorative animation.

## P2 · Systems work invisibly; the screen shows outcomes and the next action

**Decision.** Mechanics stay under the surface. The person sees the result ("Six things are worth your time · two can wait") and what to do next, not the machinery that decided it.

**Why.** Budget and Overnight were sound as systems but confusing as screens: their surfaces added clutter and caused confusion. The diagnosis was mechanics leaking into the interface; Budget and Overnight are good systems but bad screens. A product that asks the person to do arithmetic has already failed them: a "small honest number" trigger that needs arithmetic does not work.

**Where it came from.** The round-4 review.

**How it shows.** Pacing has no visible cap, meter or count. Ranking is silent. The end-of-day moment appears only at the day boundary.

**What would work against it.** Daily ask budgets, countdowns, forecasts during the day, "asks per agent-hour" curves.

## P3 · Legibility over metaphor

**Decision.** Plain words and familiar forms. The design is bold in *behaviour*, not in visual code that needs decoding.

**Why.** Round 1 built seven bold metaphors (a theatre, a house, a terrain map, woven cloth, an orrery, a screen-edge membrane). Every figurative one was rejected in review: Round, Threshold and Terrain for their visual form, and Loom's cloth as illegible. What survived was what reads instantly: Loom's risk tags, Periphery's composer, Gravity's "make deciding look easy". The lesson recurred in round 4: "planting" failed, because a metaphor that cannot be decoded in review will not be decoded by anyone.

**Where it came from.** The round-1 reviews; set as the direction in the round-2 brief (bold belongs in behaviour and flow, not in visual code); confirmed in round 4.

**How it shows.** "Queue for tonight", not "Plant". "3 rules answered 68 asks for you", not a chart. A number appears only if it explains itself.

**What would work against it.** Glyph matrices that need a legend, jargon ("warm contexts will cool · $0.06 to reload"), icons without labels.

## P4 · Orientation: always know what belongs to what

**Decision.** At a glance, the person can tell which project something belongs to and where they are.

**Why.** Supervisors need situation awareness at three levels: perception, comprehension and projection (Endsley 1995, A). Periphery was the strongest concept of round 1, yet it failed on this: it was hard to navigate, and it was unclear which project each item belonged to.

**Where it came from.** The round-1 review of Periphery.

**How it shows.** The sidebar holds Home, Workspace and projects only. Threads live inside their project, not in the sidebar. Every thread page has a breadcrumb. Messages in the Workspace show where they were routed. The Workspace looks distinct from project chats, because it is the main session.

**What would work against it.** Threads nested in the sidebar (rejected in review; sessions are kept out of the sidebar), unlabelled edge glows, identical-looking chats.

## P5 · Position is memory: nothing reshuffles or jumps

**Decision.** Things keep their place. Nothing moves under the pointer, and nothing teleports. New items append; they do not push the item being read.

**Why.**
- Spatial stability carries memory: in Data Mountain, retrieval stayed fast even after months away (Robertson 1998; Czerwinski 1999, B; T9). The benefit is stability, not 3D (Cockburn & McKenzie 2002).
- Changes during a re-render are missed unless they happen where the person is looking (Rensink et al. 1997, A).

**Where it came from.** The research (T9), then a dedicated refinement pass that held every pixel to this principle and removed sub-pixel asymmetry and layout shifts: a composer that rose when a notification appeared, a shadow at the screen edge, a perceived 1 px gap in a control.

**How it shows.** Notifications float above the composer and never move it (measured over 14 s). Sealing the day cross-fades the page with the header fixed. Details expand with a continuous height change, never more than about 45 px per frame. A chat with history opens looking fresh, with older messages one scroll above.

**What would work against it.** Re-sorting lists by recency on every update, content that pushes the composer, abrupt expansion (found in review to feel jarring).

## P6 · Every decision is legible, cheap to verify and reversible

**Decision.** The exact thing (the command, the diff, the consequence) is shown beside the buttons, with a one-line why. Every decision waits 3 s with Undo.

**Why.**
- Explanations raise acceptance of AI advice *whether it is right or wrong* (Bansal et al. CHI 2021, B; T3). What helps is evidence that makes checking cheaper than doing (Vasconcelos et al. CSCW 2023, N=731, B). "Why" text is not a safety feature.
- Evidence and decision belong side by side; split attention adds load (Sweller, cognitive load theory, A).
- Sense of agency drops when actions have no immediate consequence (Berberian et al. 2012, B).

**How it shows.** The decision card has three layers of context: headline and one line → Details → the whole thread. Destructive asks show plain consequences ("Writes 61M rows · about 4 h · ~$38 of compute · can't pause half-way"). After deciding, one receipt line ("Allowed. It's back at work.") then the card folds away. The 3 s window is a design choice inside the cited principle and remains tunable ([03 Part 4](03-human-research.md)).

**What would work against it.** Paragraph-long justifications, tables of risk (found in review to overwhelm and discourage reading), irreversible one-click actions.

## P7 · "No" is as cheap as "yes"

**Decision.** Allow and Send back have equal weight.

**Why.**
- A small real lever raises willingness to delegate more than perfect output does; even a ±2 adjustment was enough (Dietvorst et al. 2018, B; T4).
- A filled green Allow beside an outlined Send back biases the eye.

**Where it came from.** The round-4 review; Gravity's lesson of equal weight; Baby's principle that every "no" is as easy as every "yes".

**How it shows.** Both buttons are outlined; green appears only on press and on the stamp. Send back opens an inline note.

**What would work against it.** Pre-selected "Approve", a primary-styled Allow, a hidden or tiny reject.

## P8 · Destructive asks are serious but not forced

**Decision.** Destructive asks are red, set apart and need a 1.2 s hold under the exact command, armed only after the detail has been visible for 300 ms. They are not batched, not bound to one key, not ranked first and not nagged. They carry only their cost.

**Why.** The red destructive card produced hesitation, and the easier asks were cleared first. The card itself was judged right, and the hesitation was recorded as a data point. The design supports that instinct instead of fighting it. Batch-allow invites automation bias, which "cannot be prevented by training or instructions" (Goddard et al. 2012, A).

**Where it came from.** The round-2 review; a review finding (P0) on gain chips.

**How it shows.** Early release sends nothing ("Released early. Nothing was sent."). The destructive card shows no "frees" or "idle" chips: a cost dressed as a gain, on the exact card that produced hesitation in round 2, was a P0 in review. The 1.2 s hold and 300 ms arming are design choices and remain tunable.

**What would work against it.** Batching destructive asks, a single-key allow, ranking them first, nagging, gain chips on a cost.

## P9 · The coordinator advises; the person decides

**Decision.** The coordinator offers a suggestion but does not decide. Its suggestion is not pre-selected, not focused, not sent, and no key takes it. Destructive asks get no suggestion.

**Why.** Suggestions invite rubber-stamping (automation bias: Goddard 2012; Mosier & Skitka). Cognitive forcing reduces over-reliance (Buçinca et al. 2021, B).

**Where it came from.** A review finding: a focused suggestion that one Enter would send was a P0.

**How it shows.** The suggestion is one quiet violet line with a confidence word. Focus lands on the card, not on an answer.

**What would work against it.** A suggestion that is focused, pre-selected or sent by one key; a suggestion on a destructive ask.

## P10 · Honest numbers only

**Decision.** Only what is measured, or what is clearly labelled as an estimate, is shown. Stakes, urgency and labour are not invented.

**Why.**
- One fake number poisons every real one.
- Showing real work raises perceived value (Buell & Norton 2011, B), but fabricated labour is deception.

**Where it came from.** The review of the Budget concept, whose "you freed ~4.1 agent-h" was hand-set: a made-up number dressed as a fact, and it was rejected. Also the direction on hooks: hooks, including urgency, are wanted, but not at the cost of wasted effort. Every time the person works in the system, they work on something real.

**How it shows.** "About 20 min of agent work waits on this", with a hover that says how the estimate is made. Forecasts carry an *estimate* tag. The forecast that was shown is the one that is sealed. The Live UI hides features the backend can't support yet rather than faking them.

**What would work against it.** Hand-set figures presented as measurements, unlabelled estimates, manufactured urgency.

## P11 · Reading architecture, not less information

**Decision.** When text feels like too much, the structure is fixed, not the content.

**Why.** A monochrome surface gives the eye no structure: pages sharing one colour and one background became too much to read, and cards carried too much text and were hard to attend to. Vigilance decays within tens of minutes (Warm et al. 2008, A; T13), so review is sized to the decision.

**Where it came from.** The round-3 review.

**How it shows.** Tonal layers, one idea per line, details behind "Details", strong typographic contrast, measures of about 60–70 characters, and colour carrying status so words don't have to.

**What would work against it.** One colour and one background across a page; cards that carry the whole explanation up front.

## P12 · Acknowledge instantly; wait honestly

**Decision.** Every action is acknowledged in under 100 ms. Every wait says what is really happening. Typed text is not lost.

**Why.** About 0.1 s feels instant, about 1 s keeps the flow of thought, about 10 s keeps attention (Miller 1968; Card et al. 1991). Waits beyond about 10–20 s become task switches. Silence reads as trouble (Stivers 2009, A; T7). The worst wait comes after the work is done (Maister), so the design ends at finish, with no dead tail.

**How it shows.** Your message appears at once and is replaced in place by the server's row. "Replying" follows the coordinator's real heartbeat. A thread reads "Working" only when its session is actually busy; an idle one reads "Idle". Errors have plain titles with Retry and Edit. Drafts are kept per chat and per thread.

**What would work against it.** Silent waits, a "Working" label on an idle session, a dead tail after the work is done, lost drafts.

## P13 · Calm, purposeful motion; game feel without slot machines

**Decision.** Motion only says something true: 120–320 ms, nothing bounces, every animation has a reduced-motion equivalent. Small tactile feedback is welcome; variable-reward mechanics are not used.

**Why.** How the interface responds to an action shapes how that action feels, and very subtle responses make a large difference. Medium juiciness is best, and extreme juice reduces the sense of agency (Kao 2020; Kao et al. CHI 2024, B). Autistic users and many others need predictability (Marco et al. 2011).

**Where it came from.** The design direction that interface design borrows from games, bounded by the juiciness research.

**How it shows.** Feedback is fast (120 ms), layout settles (180–260 ms). Press compresses slightly; Allow stamps, Send back rewinds; the destructive hold accelerates, locks, and springs back on early release. Completion is a calm labelled line, never confetti, never a glowing composer.

**What would work against it.** Bounce, confetti, extreme juice, variable-reward mechanics, a glowing composer.

## P14 · Absence is free; the day can end

**Decision.** Nothing decays, wilts, sulks or shames the person for being away. The product offers closure, not obligation.

**Why.** In the 66-day habit study, missing a single day did not matter (Lally et al. 2010), which undercuts streak mechanics on evidence. Loss aversion is about λ≈1.96 (Brown et al. 2024 meta-analysis); streaks exploit it. Open loops pull people back to act (Ovsiankina; resumption about 67%), so the loops the design keeps are real and cheap to close.

**Where it came from.** The SM ideator's principle: the pull is closure, not craving.

**How it shows (Demo).** "Before you go": queue up to three things for tonight, then Seal the day. Notifications stay quiet until 9:00, the sidebar drops its accents, and the morning shows one recap card, then "Your first move", unfocused. After a long absence only the first three asks light up; the rest are parked.

**What would work against it.** Streaks, decay or wilting for absence, guilt copy, manufactured open loops.

---

## What was ruled out, and why

Collected from the research charter, design direction and the reviews. The current design leaves each of these out for the reason linked; any of them can be reconsidered if evidence from use undercuts that reason.

- Keyboard shortcut chips on screen. Shortcuts are surfaced in tooltips and the `?` sheet; on-screen key hints were found to add clutter and cheapen the interface.
- A glowing composer, or any glow without a label (P1, P4).
- Threads in the sidebar (P4); a pinned needs-you tag bar; risk tables (P6).
- A decision UI that takes the whole page.
- A pre-selected, focused or auto-sent suggestion (P9).
- Fixed daily ask budgets, per-second countdowns (P2), unexplained numbers (P3), cost dressed as gain (P8).
- Agent faces, names, voices or claimed feelings. Character is derived, not invented (see [03 §2.9](03-human-research.md)).
- Fabricated progress, fabricated urgency, manufactured incompleteness (P10, P14).
- Sound by default; auto-panning or auto-opening toward events. The camera and viewport belong to the person (P5).
- Shadows from hidden elements; a box drawn where only a shadow is intended (the refinement pass in P5).
- Red badge counts to chase. "Needs you" is calm amber and a diamond, not a red number (P1).

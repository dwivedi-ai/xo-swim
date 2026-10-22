# XO Space: design research

The design record for xo-swim, XO Space's web UI (called "XO Space Cowork" until 2026-10-21, when the owner shortened the brand to "XO Space"). It sets out **what** the interface is, **how** it was arrived at and **why** every part looks and behaves the way it does, with the human research behind each choice. It is written for designers, design directors and AI agents who need to understand the design before changing it.

## How to use this knowledge base

This folder is the record of the design decisions taken for xo-swim: what was decided, why, and where it came from (which round, concept, review or refinement pass). Any agent or designer working on xo-swim reads it first and consults it before changing the design, so that a change starts from the reasoning already recorded rather than from scratch.

The entries are decisions with their reasoning, not hard rules. Each rests on stated evidence or review findings, and each is open to revision when evidence from use warrants it. When a decision is revisited, the recorded reason is the starting point, and the record is updated with what changed and why.

## The method

The design was produced by a single design lead directing AI at its extreme, under one governing principle: **the person's attention is controlled by the product, and is spent only where their judgement is needed.**

- **Research at scale.** A human-nature evidence review (15 ranked truths, graded evidence, about 30 numbers checked against primary sources) and a frontier scan of products, research prototypes and adjacent fields such as air-traffic control and mission control.
- **Divergence without limits.** Three ideator agents, each given one lens (space and the body; time and the senses; society and myth), produced 49 radical concepts.
- **Grounding.** A critic agent scored every concept against the 15 truths and kept, merged or dropped it.
- **Building in parallel.** Seventeen working prototypes were built over four rounds by parallel builder agents and reviewed running live, from round 2 on a purpose-built review canvas with inspection tools and pinned review notes.
- **Independent audit.** A reviewer agent measured the final round (word counts, motion over time, focus, frame-by-frame expansion, contrast, touch targets) before any verdict.
- **Measured convergence.** The converged design passed 105 automated checks. A precision refinement pass then held every remaining detail (overlay blur, composer stillness, shadows, alignment) to the attention principle.

Bold ideas were tested hard and cut harder. What remained is the skeleton every round kept returning to, executed with exacting craft.

## The design in five sentences

1. One person directs many AI agents across many projects; the scarce resource is that person's **attention**, and the product exists to spend it well.
2. The screen shows **what is worth the person's time and the next action**; everything that only needs an agent stays quiet and still.
3. Decisions arrive **one at a time, with their evidence beside them**, in a panel that never takes over the page; "no" costs the same as "yes"; destructive asks are serious and held, but never forced first.
4. The bold ideas live in **behaviour** (invisible pacing, ranking by agent work unblocked per second of the person, honest estimates, a day that can end), not in visual metaphors that need decoding.
5. The craft is **Geist, deep neutral greys, XO green as the only accent and four meaningful state hues**, soft geometry and calm motion, in a dark default and a designed light theme.

## Status and vision

The shipped version is a **usable baseline**. It is being refined through daily professional use (everyday work, coding, and power users of AI) toward the standard those users demand. It is on the way to that standard, not yet at it, and this record is updated as the design is refined.

The vision is to **innovate and pioneer human–AI interaction**: to move people from typing to agents to supervising them, with an interface that treats human attention as the most valuable resource in the system.

## Read in this order

| # | Document | Answers |
|---|---|---|
| 01 | [The thesis](01-thesis.md) | Who it is for, what problem it solves, the governing principle, what success means |
| 02 | [Design principles](02-principles.md) | The fourteen decisions, why each was taken, and what was ruled out |
| 03 | [The human research](03-human-research.md) | The evidence on attention, interruption, memory, trust, vigilance, care and motivation |
| 04 | [How the design converged](04-convergence.md) | The method, all 17 concepts, the review outcomes, the lineage of every part |
| 05 | [The visual system](05-visual-system.md) | **The colour scheme**, type, shape, depth, motion and sound, with exact values and contrast |
| 06 | [Every component](06-components.md) | What each component is and why it looks and behaves the way it does |
| 07 | [Decisions, pacing and ethics](07-decisions-pacing-and-ethics.md) | The Decision Kit, invisible pacing, honesty rules, and the engagement position |
| 08 | [Voice and copy](08-voice-and-copy.md) | How the product speaks, its conventions, a phrasebook |
| 09 | [FAQ](09-faq.md) | The questions a designer, director or AI will ask |
| 10 | [Open questions](10-open-questions.md) | What is unsettled, backend gaps, gaps between intent and code, what to measure |
| — | [Sources](sources.md) | Where everything came from |

**Short on time?** Read 01, then "What was ruled out, and why" at the end of 02, then the colour table in 05 §2.1.

## Conventions

- **T1–T15** are the fifteen human truths in [03](03-human-research.md); **P1–P14** are the design decisions (principles) in [02](02-principles.md).
- **Evidence grades**: A meta-analysis or robust replication · B peer-reviewed · C small study or preprint · D practitioner · J researcher judgement.
- **Live** is the real backend; **Demo** is the simulated workspace (`/?mode=demo`). Demo-only features are marked as such.
- Text in quotation marks is product copy as shown on screen, or a named principle from the research.
- Values are read from the code at commit `81a21d6`.

# 10 · Open questions, known gaps and what to measure

What is not settled. The shipped version is a usable baseline, not the finished standard: it is being refined through daily professional use (everyday work, coding, pro AI users) and is on the path to that standard, not at it. A designer or agent picking this up starts here, and with the decisions recorded in this folder, before proposing changes.

## 1. Open design decisions

From the session handoff (§11.2), still open as of 2026-10-14:

1. **Seal and overnight settings**: seal time, what may run overnight, quiet hours, morning recap on or off. The current direction is that sealing the day is governed by settings.
2. **Guilt-framed vs action-framed copy.** Hooks are used deliberately and tied to real work, with true stakes only; whether guilt framing has a place is to be decided by an A/B test (see [07](07-decisions-pacing-and-ethics.md) §4).
3. **Threads inline in the project chat**, in addition to the Now shelf and All threads? Round 3 tried both a strip and inline cards; the shipped design uses the shelf, the sheet and inline thread cards in the conversation.
4. **Intelligence picker details**: which models, the default Depth per session type, whether Sage and Jev keys get configured.
5. **Overlay consistency**: dialogs blur at 3 px and the desktop All-threads sheet has no blur; both sit outside the 1.5 px decision and have not yet been reviewed.

## 2. What the backend doesn't support yet

Live hides or degrades these (README, "The backend does not have these yet"; `requirements.md`). In the order that unlocks the most:

| # | Ask | What it unlocks in the UI |
|---|---|---|
| 1 | A per-thread state-transition log (`thread_events`) | "Since you left", measured agent time, wait time, forecasts, "the decision that moved work". Today the product has a memory of state but none of time |
| 2 | **R2** review queue: approvals with real risk (routine / notable / destructive), the exact command, scopes and rules; agents running with a permission tool instead of `--dangerously-skip-permissions` | Real Allow / Send back, real destructive treatment, rules in Live. Today every Live ask is "notable" and answered in words |
| 3 | **Stop / cancel** at a step boundary, reporting what is kept | The Stop button in Live |
| 4 | **R6** intelligence per session (`GET/PUT/DELETE …/intelligence`) | A working model chip in Live |
| 5 | **R1** resolve / reopen from the UI | Resolving a thread by the person |
| 6 | Measured agent time and per-ask unblock estimates; whether an agent can work around an ask | Real pacing in Live (today Live asks are not held) |
| 7 | Seal and overnight on the server (`sealed_until` on every channel) | The day boundary in Live |
| 8 | An unlock record; kept-vs-reverted tracking | Accepted-and-kept metrics |
| 9 | **R5** a `before` history cursor | Cheaper history paging |
| 10 | **R4** tool-progress events | "Long tasks feel alive" (a 95 s silent write was observed) |

## 3. Gaps between design intent and the shipped code

Found while documenting (full detail in [05-visual-system.md](05-visual-system.md) §8). Not changed by this document. Suggested priority in brackets.

1. **[High]** The composer's focus indicator is a border change of about 1.7:1 (`outline: none` on the textarea). The most important field should have the clearest focus.
2. **[High]** The OS light-mode preference is ignored: the inline theme script always sets `data-theme`, defaulting to dark.
3. **[Medium]** Light-mode high contrast (`prefers-contrast: more`) does nothing, because `app.css` overrides `tokens.css`.
4. **[Medium]** About 35 dark-theme state colours are hard-coded as `rgb()` literals and don't switch in light; the Demo/Live badge is dark-only.
5. ~~**[Medium]** The tab title reads "◆ N · Converged", the concept's name.~~ Fixed 2026-10-21: "◆ N · XO Space".
5a. **[Low]** On Home, two green-tiled "Create XO Project" buttons show at once (the sidebar's, added 2026-10-21 at the owner's request, and Home's own). 05 holds green as "the only accent, so the primary action is unmistakable"; two of the same action on one screen is a mild exception the owner chose. Revisit if it reads as noise in daily use.
6. **[Medium]** The Keys sheet is inaccurate for `L` (works only on Think asks), `T` (opens All threads outside a card) and `A` (uppercase means allow-all).
7. **[Low]** Two parallel token layers (`tokens.css` and `app.css`'s grey ladder); many `tokens.css` tokens unused.
8. **[Low]** Dark `--ink-3` and `--ink-4` are nearly identical (5.8 vs 5.1:1).
9. **[Low]** "Nothing bounces" vs the small overshoot of `--spring`; "nothing below 10.5px" vs 9–10 px checklist glyphs.
10. **[Low]** kit.js's breakpoint-deferred announcer (waits 2 s after typing) is unused; app.js announces immediately.
11. **[Low]** Shipped JS is about 95 kB gzip and CSS about 25 kB, above the frontend-stack research's budgets (35 / 15 kB), which were written for the classic UI.

## 4. What daily professional use is to validate

These questions, from the handoff, are what everyday professional use of the baseline is expected to answer before the next refinement:

- Does "Your next move" pick what the person would have picked?
- Does hesitation on the destructive card, with easier asks cleared first, recur, and does "can wait" feel trustworthy or like hidden work?
- Are labelled estimates useful or noise?
- Is the intelligence chip found and understood (Depth pips), and is per-session stickiness what was meant?
- Does Stop's wording ("0 of 3 steps are kept") match expectations?
- Does the end of the day feel like relief or a chore?
- Does the 1.5 px blur direct attention, or is it noticed as an effect?
- Does anything read as generic or unconsidered: text density, glows, chips?

## 5. What to measure

| Measure | Why |
|---|---|
| **Accepted-and-kept** per session (did the work survive?) | Acceptance alone overstates value (Baby: 58.6% kept) |
| **Time-to-unblock** (how long agents wait on the person) | The product's core productivity claim |
| **Needs-you noise rate** (asks dismissed without action) | Alarm fatigue: nuisance alerts dull responses |
| Destructive ask error rate | Safety of the hold and the facts line |
| Break offers taken vs dismissed | Calibrates the 25-minute value |
| **Not measured**: time in app, session length, raw acceptance, satisfaction ratings of agent replies | Each rewards the wrong thing |

## 6. Research questions nobody has answered

- How many concurrent threads one person can supervise (hypothesis 3–7).
- Whether agent-originated interruptions cost more or less than human ones.
- Whether spatial memory forms for agent threads.
- The line between helpful memory and creepiness.
- At what forecast miss rate trust is lost.
- Whether autonomy-as-reward (rules that remove asks) lowers situation awareness: Bainbridge's irony.
- How ADHD and autistic users experience supervising agents.

## 7. Tunable values

These are design choices built on cited principles, not findings. They are tunable: revisit them when evidence from use warrants it, and record the new value and the reason.

| Value | Where | Principle |
|---|---|---|
| 3 s commit window | Decision Kit | Sense of agency + forgiveness |
| 300 ms read-before-arm | Decision Kit | Cognitive forcing |
| 1.2 s destructive hold | Decision Kit | Friction proportional to risk |
| 30 agent-min "small ask" line | Pacing | Breakpoint deferral (Bailey & Konstan) |
| 60 agent-min ping line | Pacing | Interruption only when worth it |
| 25 min break offer | Pacing | Vigilance decrement (15–30 min) |
| ≤3 Now shelf, ≤2 Then, ≤2 finds, ≤4 Home blocks, ~120 words | Layout | Working memory (≈4) |
| 1.5 px overlay blur | Visual | Very subtle by direction (refinement pass) |

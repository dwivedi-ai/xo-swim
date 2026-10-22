# 01 · The thesis: what XO Space is for

> One person directs many AI agents across many projects. The scarce resource is not compute or tokens. It is that person's attention. XO Space exists to spend it well.

## 1. The person and the situation

**Who the user is.** One person who runs several projects at once (billing-api, data-pipeline, a marketing site, a mobile app…). Each project has an AI coordinator. The coordinator answers directly or starts **threads**: units of real work, each with its own agent session, branch and live checklist. A **workspace coordinator** sits above all projects and routes requests to the right one.

The person's role has changed. They are no longer the typist who does the work in a chat box. They are the one whose judgement counts: they commission work, unblock agents, decide what is risky and come back to see what moved. The research put it as a change "from typist to the one whose judgement counts" (`human-ai-interaction-frontier.md`).

The users are not uniform. Experts and novices, people with ADHD or autism, older and younger people, and people from different cultures all use the same screen (`human_nature.md` §8). The design therefore defaults to quiet, predictable and plain, and leaves density to the person.

## 2. The problem with a single chat

A single chat session is a good interface for one conversation. It is a poor one for supervising parallel work:

| What chat does | Why it hurts (evidence) |
|---|---|
| Keeps every task's state in the person's head ("which threads exist, what each is doing, what each needs") | Working memory holds about **4** chunks (Cowan 2001, grade A). Parallel work has to live outside the head. |
| Buries the moment an agent needs the person inside a stream of messages | Automation fails at the **handover**, not in steady state (Bainbridge 1983; Onnasch et al. 2014 meta-analysis of 18 experiments). |
| Turns every long wait into silence | Conversational gaps average about **200 ms**; longer silence reads as trouble (Stivers et al. 2009, ten languages). |
| Makes returning hard: the transcript shows one sentence at a time | People resume through visible cues; open loops leave "attention residue" (Iqbal & Horvitz 2007; Leroy 2009). |
| Interrupts whenever a message arrives | Interruptions mid-task cost **3–27%** more time, **twice** the errors and **31–106%** more annoyance than interruptions at a breakpoint (Bailey & Konstan 2006). |

In ideation the chat box was characterised as a keyhole: one narrow slit through which a whole building of activity has to be seen.

## 3. The answer: a supervisory home

The research's conclusion (`human-ai-interaction-frontier.md`, "Stop typing to agents; start supervising them") was that the product is not a better transcript. It is a **supervisory home** with four parts:

1. **A return moment** that is bounded and ends on "what's yours".
2. **A risk-weighted place to decide**, where destructive asks are felt and never batched, and "no" costs the same as "yes".
3. **A stable map** that never reshuffles under the eye.
4. **A quiet channel** where only the person's turn is warm and still; agent work stays quiet.

The research critic's conclusion was that these four are the product and everything else is a costume over them. Seventeen concepts were built to test costumes against that claim. Every costume was rejected in design review and the skeleton was kept (see [04-convergence.md](04-convergence.md)).

## 4. THE principle: attention control

One principle has governed every decision since round 2. It was set as the design direction on 2026-10-13:

> The product is in control of the person's attention. Mental effort is never drained on things that do not need it. The product knows what needs attention and what does not. Decisions that reach the person are not automated away: if they reached the person, they did so for a reason. But the person is never continuously bombarded with them.

Three decisions follow from it:

- **Attention is a budget the product spends on the person's behalf**, and it is spent the way a great chief of staff would spend it. This framing is adopted as the coordinator's role.
- **Decisions are not automated away.** If something reached the person, it reached them for a reason. The design shapes *when* and *how* a decision arrives, never *whether* it does.
- **Bombardment is the failure mode.** Any product can buzz. The craft is in what stays quiet.

The README of xo-swim compresses this into one line: the screen shows what is worth the person's time and the next action; everything that only needs an agent stays quiet.

## 5. Productive, and empathetic

The direction is a product with a strong, habitual pull toward productive work with AI. That direction carries a tension the design had to resolve, and the resolution is part of the thesis.

- **The pull is real work, not the app.** Every hook in the shipped design is tied to something true: a decision that unblocks real agent work, a find an agent actually made, a rule that actually answered asks. The principle carried forward from the hooks research is that the stimulus may be designed, but the stakes are real.
- **Empathy is shown through action and timing, not words.** Care comes from responsiveness, being remembered and good timing (Reis; Yin et al. 2024 PNAS). Agents don't claim feelings. The interface acknowledges at once, says plainly when something is late or wrong, never shames absence, and makes "no" as easy as "yes".
- **The person's instincts are supported, not corrected.** In the round-2 review, the red destructive card produced hesitation and the easier asks were cleared first. This is treated as correct behaviour, not a problem: destructive asks wait visibly, are never forced first, and nothing nags.

The emotional target, in short: the person should leave each visit feeling **in control, unburdened and effective**, never hunted.

## 6. How success is measured

The research and the handoff agree on what to measure and what was chosen not to measure:

| Measure | Deliberately not measured |
|---|---|
| Accepted-and-**kept** output (did the work survive?) | Time in app, session length |
| Time-to-unblock (how long agents wait on the person) | Satisfaction ratings of agent replies (sycophancy is preferred and harmful, Cheng et al. 2025/26) |
| Needs-you noise rate (asks dismissed without action) | Acceptance rate alone ("accepted is not kept": in the Baby logs 45 of 48 runs were accepted, yet only 58.6% of AI changes survived untouched) |

## 7. The design in one paragraph

Home tells the person the one next move worth their time, why, and what it costs them, then at most two more, then one calm line saying what is handled. Everything that only needs an agent stays still and quiet. A decision arrives one at a time, with its evidence beside it, in a panel that never takes over the page; "Allow" and "Send back" weigh the same; destructive asks are red, serious, set apart and held for 1.2 s, but never forced first. Projects show a title, one sentence and at most three threads that matter now. The composer is the centre of the product: text a coordinator like the best messaging app, aim it with `@project`, and see where it went. Colour is spent only on what needs the person: XO green for action and progress, amber for "yours", red for danger. Nothing jumps, glows without words or moves under the pointer. The visual craft is Geist type, deep neutral greys and soft geometry, in a dark default and a designed light theme.

The rest of this folder explains each of those choices: [02-principles.md](02-principles.md) records the decisions and why they were taken, [05-visual-system.md](05-visual-system.md) the palette and form, and [06-components.md](06-components.md) every component.

## 8. Status and vision

The shipped version is a usable baseline, not the finished standard. It is being refined through daily professional use: everyday work, coding, and the demands of professional AI users. Each refinement pass is held to the attention principle above, and the decisions recorded in this folder are revisited when that use produces evidence against them. The product is on the path to that standard, not at it.

The vision is to innovate and pioneer human–AI interaction: an interface in which one person directs many agents with full control and an attention budget that is spent well.

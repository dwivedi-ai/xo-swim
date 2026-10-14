# 09 · Questions a designer, a design director or an AI will ask

Short answers, each pointing to where the full reasoning lives.

## The idea

**What is this product, in one sentence?**
A supervisory home for one person directing many AI agents across many projects: it shows what is worth their time and the next action, and keeps everything that only needs an agent quiet. → [01-thesis.md](01-thesis.md)

**Who is it for?**
One person who runs several projects, each with an AI coordinator that starts threads of real work. Their job is judgement, not typing. They range from experts to novices and include neurodivergent people, so defaults are quiet and plain. → [01-thesis.md](01-thesis.md) §1

**Why not just a better chat?**
A single chat keeps parallel state in the head (working memory holds about four things), buries the moment an agent needs the person, turns waits into silence and makes returning hard. Chat stays as the frame for talking; deciding and supervising get their own shape. → [03-human-research.md](03-human-research.md) §2.1–2.3

**What is the one principle?**
Attention control. The product controls what reaches the person: anything that reaches them arrives for a reason, and the person is not continuously bombarded. → [02-principles.md](02-principles.md) P1

**How does it make people more productive?**
By unblocking more agent work per second of human attention: ranking asks by the work they unblock, clearing quick ones in seconds, not holding an ask whose agent is idle, and keeping the person out of anything that doesn't need them. Productivity is agent work unblocked and kept, not time on screen. → [07-decisions-pacing-and-ethics.md](07-decisions-pacing-and-ethics.md) §2

**Where is the empathy, if the copy is so plain?**
In timing, restraint and control: instant acknowledgement, honest waits, "no" as easy as "yes", destructive asks not forced first, absence not punished, a break offered after 25 minutes of deciding, and bad news said plainly with a next step. Empathy through action, not adjectives. → [01-thesis.md](01-thesis.md) §5, [08-voice-and-copy.md](08-voice-and-copy.md)

## The process

**How was this design chosen?**
Three ideator agents wrote 49 radical concepts; a critic grounded them against fifteen human-nature truths; seventeen concepts were built over four rounds and put through design review on a live canvas with 28 pinned review notes; an independent reviewer audited round 4; 17 · Converged assembled the survivors. → [04-convergence.md](04-convergence.md)

**Why did all the bold metaphors lose?**
Each needed decoding (stage, house, land, cloth, orbits, edge glows), and decoding spends the attention the product exists to save. The behaviours were adopted and the costumes rejected. The decision was that boldness lives in behaviour and flow, not in visual code. → [04-convergence.md](04-convergence.md) §3

**Which concept is the shipped UI closest to?**
16 · Budget's Home and UI, with 14 · Overnight's panels and end-of-day moment, 11 · Next's Workspace and Home origin, 13 · Today's in-thread card, 12 · Breakpoints' suggestion and one rule offer from 15 · Chain. → [04-convergence.md](04-convergence.md) §8

## The look

**What is the colour scheme?**
Deep neutral greys from XO's architecture chip (dark canvas `#141414`), XO green `#83D63A` as the only accent, and four state hues: amber (needs you), blue (working), red (destructive or stopped), violet (the coordinator's opinion). → [05-visual-system.md](05-visual-system.md) §2

**Why is dark the default?**
The palette was distilled from the dark XO chip, and every concept was built and reviewed dark; light was specified as a toggle, so dark is held as the default. On a deep canvas the few state colours stand out without heavy saturation. The light theme is designed, not inverted, for people who prefer it. *(Note: the code currently ignores the OS light preference; see [10-open-questions.md](10-open-questions.md).)*

**Why isn't the text pure white?**
`#E1E1E1` on `#141414` is 14:1 (well above AAA) without the glare of white on near-black during long reading.

**Why is the green darker in light mode?**
Brand green `#83D63A` on white is only 1.8:1. Green *text* uses `#487620` (5:1); green *fills* keep the brand colour with near-black text on them (9:1).

**Why amber for "needs you" and not red?**
Red is reserved for real danger so it keeps its force. Amber is warm and says "your turn" without alarm. "Needs you" is a calm amber diamond, not a red count to chase.

**Why violet for the coordinator's suggestion?**
Advice should not look like state or like the person's own choice, so violet was chosen as a separate channel for opinion.

**Why Geist?**
Geist is used everywhere because the first version read as generic and unconsidered; it matches XO's chip; its variable axis gives in-between weights (550, 650) for hierarchy without heavy bold. → [05-visual-system.md](05-visual-system.md) §3

**Why such soft corners?**
A square version was rejected in review as rigid. Radii grow with the surface: calm on large surfaces, precise on small controls.

**Why no keyboard shortcut chips?**
On-screen key hints were found to add clutter and cheapen the interface, so the current design does not show shortcut chips. Shortcuts live in tooltips and the "?" sheet.

**Why doesn't anything glow?**
Motion and saturated colour are the strongest attention cues, so they are spent only on what needs the person. The composer does not glow; quiet rows do not glow; every signal has words. → [02-principles.md](02-principles.md) P1, P13

**Why the 1.5 px blur?**
When a decision surface covers content, the content behind it is darkened and blurred slightly (1.5px); when it sits beside content, nothing changes. The value was set in a dedicated refinement pass to be very subtle. It points the eye at the decision without hiding the context. → [05-visual-system.md](05-visual-system.md) §2.4

## The behaviour

**Why only one next move on Home?**
Choosing what to look at is itself work. A chief of staff gives the one thing; "Then" shows at most two more. → [06-components.md](06-components.md) §2.1

**Why can't I see a count of all my asks?**
The count is shown: the panel shows "2 of 6", and Handled shows what can wait. What is not shown is a budget or a meter, because those made people do arithmetic and either idled agents or hid work. → [07-decisions-pacing-and-ethics.md](07-decisions-pacing-and-ethics.md) §2

**Why do some asks "wait"?**
A small ask (under 30 agent-minutes) whose agent can keep working costs the person an interruption for little gain. It waits, visibly, with its reason and a Bring in button. Asks whose agents are idle, destructive asks and stopped threads do not wait.

**Why are Allow and Send back the same size?**
A filled Allow next to an outlined Send back biases the eye. It was decided that saying no costs the same as saying yes; that is what keeps the person steering.

**Why is a destructive action allowed only by holding?**
So the body enforces what a button can't: it can't be done by reflex, by key-mash or in a batch. It arms only after the detail has been visible, and an early release sends nothing.

**Why is the destructive ask always last?**
Not hidden, last. In review, the destructive card produced hesitation and the easier asks were cleared first. The design makes that instinct safe: nothing is forced first, nothing nags.

**Why doesn't the suggested answer get pre-selected?**
Automation bias: a pre-selected suggestion gets rubber-stamped. It is one quiet violet line, not focused, and no key takes it.

**Why is there a 3-second delay on every decision?**
It is a commit window with Undo, so speed is safe. The consequence shows at once; the agent hears after three seconds.

**Why a break after 25 minutes?**
Vigilance decays within 15–30 minutes of monitoring (Warm et al. 2008). The offer comes at a natural pause, not mid-card, and the person can keep going.

**Why "estimate" everywhere?**
Agent time is not yet measured. A number dressed as a fact would poison trust in every real number.

**Why does Live lack Stop, rules, finds and the seal?**
The backend doesn't support them yet. Live hides or degrades them honestly instead of faking them. → [10-open-questions.md](10-open-questions.md) §2

## The build

**Why no framework or build step?**
The frontend-stack research found smooth streaming comes from technique (append, don't re-render; batch per frame; re-parse only the open block), not the framework, and vanilla is already in the fastest tier, so the build ships without a framework for now. The research's eventual path, if the app grows, is Preact + signals via `htm`, which can ship as vendored modules under the no-build decision. → `README.md`, `frontend-stack.md`

**How do I change the design without breaking it?**
Read and consult the relevant entries in this folder first: what was ruled out ([02-principles.md](02-principles.md)), the colour grammar ([05-visual-system.md](05-visual-system.md) §2.1) and the Decision Kit's values ([07](07-decisions-pacing-and-ethics.md) §1). Understand the reasoning behind each decision before changing it. If evidence from use contradicts that reasoning, revisit the decision deliberately and record the new one here. Measure what moves (words on Home, moving elements, frame-by-frame expansion), and keep tests from sending a non-GET request to the live backend.

**What was ruled out?**
Threads in the sidebar; shortcut chips; a composer that glows or moves; a decision that takes the whole page; a pre-selected suggestion; a number that isn't real or labelled; a metaphor that needs decoding; an agent with a face, name or feelings. Each was ruled out for a recorded reason. → [02-principles.md](02-principles.md), "What was ruled out, and why"

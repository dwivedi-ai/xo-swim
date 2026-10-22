# 03 · The human research: attention, cognition, trust and care

This is the evidence base under the design. It distils the research track run on 2026-10-13: a human-nature evidence review (`human_nature.md`, about 36 searches, about 30 numbers checked against primary sources), a frontier scan of products and prototypes (`frontier_scan.md`), and the final report (`human-ai-interaction-frontier.md`). The full archive is listed in [sources.md](sources.md).

**How to read the grades.** **A** meta-analysis or robust replicated finding · **B** peer-reviewed, decent N, not widely replicated · **C** single small study, preprint or contested · **D** practitioner or opinion · **J** researcher judgement. The grades are the ones the archive gives. Where the archive flags a number as unverified, so does this document.

**How to read each finding.** The claim and its source, then **→** the design consequence that was drawn from it, then **In the UI:** where it shows. The consequences are decisions resting on this evidence; they can be revisited if the evidence, or what daily use shows, changes.

---

## Part 1 · The fifteen human truths

The research ranked fifteen truths by evidence strength and by how much they should shape the product. They became the scoring rubric for every concept (T1–T15).

| # | Truth | Key evidence | Grade | Design consequence |
|---|---|---|---|---|
| T1 | Working memory holds about 4 things; parallel work has to live outside the head | Cowan 2001; multiple-object tracking (Pylyshyn & Storm 1988) | A | All thread state is shown, never remembered |
| T2 | Automation fails at the handover; the moment an agent needs the person is the design centre | Bainbridge 1983; Endsley; Onnasch et al. 2014 (18 experiments) | A | The needs-you moment is the product |
| T3 | Explanations raise acceptance of wrong answers; cheap verification calibrates trust | Bansal et al. CHI 2021; Vasconcelos et al. CSCW 2023 (N=731) | B | Show the diff and the command; keep "why" to one line |
| T4 | A small real lever beats perfect output for willingness to delegate | Dietvorst et al. 2018 | B | Every result is cheaply steerable (Send back with a note) |
| T5 | Interruptions at breakpoints cost far less; even seconds of deferral help | Bailey & Konstan 2006; Iqbal & Bailey 2006 | B | Hold small asks; let only big ones speak, once |
| T6 | People resume through visible cues; open loops leave residue | Iqbal & Horvitz 2007; Leroy 2009; Leroy & Glomb 2018 | B | "You were here" cues; loops that are cheap to close |
| T7 | Silence reads as trouble; conversation runs on ~200 ms gaps | Stivers et al. 2009; Levinson & Torreira 2015 | A | Acknowledge instantly; show what the agent understood |
| T8 | Pre-attentive channels are a budget; change outside focus is invisible | Treisman & Gelade 1980; Simons & Levin; Rensink 1997 | A | Spend motion only on "needs you"; log what changed |
| T9 | Position is memory: stable, person-controlled places; no reshuffling | Data Mountain (Robertson 1998; Czerwinski 1999) | B | Stable order; nothing moves under the pointer |
| T10 | Progress on meaningful work is the strongest daily motivator; setbacks weigh more | Amabile & Kramer (238 people, ~12,000 diary entries) | B | Home shows movement toward the person's goals |
| T11 | Sycophancy is preferred and harmful | Cheng et al. 2025/26: AI affirmed users ~49–50% more than humans | B+ | Optimise outcomes kept, not ratings |
| T12 | Care = responsiveness + being remembered + good timing; AI labels reduce felt care | Reis; Yin et al. 2024 PNAS | A/B | Show memory with provenance; act on time; claim no feelings |
| T13 | Vigilance decays within tens of minutes; review is emotional labour | Warm et al. 2008; Hülsheger & Schewe 2011 | A | Pre-check and batch; suggest a break after 25 min |
| T14 | Trust should be per capability (the jagged frontier) | Dell'Acqua et al. 2023 (758 consultants) | B | Track records by kind of task (future work) |
| T15 | People differ: experts and novices, ADHD, autism, culture, age | Kalyuga 2003; Song 2021; Brynjolfsson 2023 | A/B | Quiet, predictable defaults; density set by the person |

---

## Part 2 · The findings, by theme

### 2.1 Working memory and load

**Working memory holds about 4 ± 1 chunks** (Cowan 2001, A), a revision of Miller's 7 ± 2. People reliably track about 4 independently moving items (Pylyshyn & Storm 1988; Alvarez & Franconeri 2007, A).
→ The design externalises all thread state, so the person does not need to remember which threads exist, what each is doing or what each needs. *"Externalised, stable, glanceable state is not a nicety but a prosthesis"* (`human_nature.md` §2). It also gives a span-of-control hypothesis: one person can supervise about **3–7** actively changing threads before misses rise (untested).
**In the UI:** each thread card shows state, current step and what it needs. The Now shelf shows **at most three** threads per project. Home shows one next move and at most two more.

**Split attention adds load** (Sweller, cognitive load theory, A).
→ Evidence and the decision it supports belong side by side: *"the diff beside the Approve button, not in another tab."*
**In the UI:** the decision card carries its evidence (exact command, why, checklist, last messages, branch) behind one "Details".

**Expertise reversal** (Kalyuga et al. 2003, A): guidance that helps novices becomes noise for experts.
→ The default is terse; detail is opened, not imposed.

### 2.2 Attention, salience and change blindness

**Pre-attentive features pop out** (Treisman & Gelade 1980, A). **Motion onset is the strongest attention cue** (Abrams & Christ 2003, B).
→ *"Motion and saturated colour are a budget to spend on one class of event, a thread that needs a person."* Agent-busy states stay still or near-still.
**In the UI:** Home is measured at 0 moving elements over 20 s. The composer never glows. Only rows that need the person get colour.

**Change blindness** (Simons & Levin 1998; Simons & Chabris 1999, about half missed the gorilla; Rensink et al. 1997, A): changes during a re-render are missed unless they happen where the person is looking.
→ Nothing important is communicated by a silent in-place change; a persistent trace is left.
**In the UI:** finished work and stops go to a labelled status line; the decision gets a receipt line; "Since you left" moments summarise what moved.

**Calm technology** (Weiser & Brown 1995/96, D): information should move between the periphery and the centre. But ambient displays are easy to ignore and hard to evaluate (Mankoff et al. 2003, C).
→ Peripheral signals change rarely and carry a label. The converged grammar: *"'theirs' = quiet motion; 'yours' = warm and still."*
**In the UI:** this is why Periphery's unlabelled edge glows failed (in review it could not be told what they referred to) and why every light in the shipped UI has words.

**Presence indicators reduce disruption from proactive agents** (Pu et al. CHI '25, N=18).
→ "A quiet presence signal, not a notification." **In the UI:** a small blue dot on a busy project; a breathing ring on a working agent's avatar.

### 2.3 Interruption, breakpoints and resumption

**Interruption cost** (Bailey & Konstan 2006, N=50, B, verified): interruptions *during* a task, rather than at a boundary, produced **3–27% more time**, **twice the errors**, **31–106% more annoyance** and about twice the anxiety increase. "Deferring presentation for just a few seconds can lead to a large mitigation." Coarse breakpoints are least disruptive (Iqbal & Bailey 2006, B).
→ Agents' requests queue and arrive at natural boundaries, except for genuinely time-critical items.
**In the UI:** invisible pacing. Small asks whose agent can keep working wait under "Handled · can wait" with their reason; only a new ask worth an hour or more of agent work may speak up, once; destructive and stopped asks are never held.

**Field interruptions** (Iqbal & Horvitz 2007, B): alert-driven switches took about 10 minutes, plus 10–15 minutes more to return. Visible windows of the suspended task acted as resumption cues. *(The often-quoted "27% took over 2 h" could not be verified.)*

**Fragmented work** (Mark, González & Harris 2005, B): 57% of working spheres were interrupted. *(The famous "23 minutes 15 seconds" figure comes from interviews and press, not this paper; grade D.)* Interrupted people work *faster* but with more stress and effort (Mark, Gudith & Klocke 2008, B).

**Attention residue** (Leroy 2009, B): part of attention stays on an unfinished task. A "ready-to-resume plan" (where the person is, what is next) reduces it (Leroy & Glomb 2018, B).
→ Every thread carries a "you were here / next step" cue; loops are made cheap to close or park.
**In the UI:** the checklist bar shows ✓ done, ✱ now, ○ to do; Back restores the exact scroll and focus; a chat with history opens fresh with "earlier messages" one scroll above; "Later today" parks a Think ask.

**Task-switch cost is robust** (Rogers & Monsell 1995; Monsell 2003, A), and waits beyond about **10–20 s become task switches** (Baby research).
→ Short waits are made to feel alive and honest; long waits are made safe to leave.

### 2.4 Flow and response time

**Flow** needs balanced challenge and skill, clear goals and immediate feedback; interruptions break it (Csikszentmihalyi 1990, A/B).

**Response-time thresholds** (Miller 1968; Card et al. 1991; Nielsen): about **0.1 s** feels instant, about **1 s** keeps the flow of thought, about **10 s** keeps attention.
→ Every action is acknowledged in under 100 ms; real steps are shown; work ends decisively with no dead tail.
**In the UI:** optimistic send (your message appears at once and lifts from the composer); press feedback in 90–120 ms; Undo toast at once.

### 2.5 Time, waiting and agency

**The worst wait comes after the work is done** (Maister; Baby's logs measured a median 3.6 s closing turn that "changes nothing").
**Labour illusion** (Buell & Norton 2011, B): showing real work raises perceived value even when the wait is longer. But *fabricated labour is deception* (J).
→ Only work that is really happening is shown; progress is not staged.
**In the UI:** "Working" means the session is actually busy; an idle session says "Idle". The typing row follows the coordinator's real heartbeat, "never a timer".

**Sense of agency drops with delay and with automation** (Berberian et al. 2012, B).
→ The person's actions produce an immediate, visible consequence even when the work is slow.
**In the UI:** a decision stamps at once, shows a receipt, and waits 3 s with Undo before it reaches the agent.

**Awe expands perceived time but habituates** (Rudd, Vohs & Aaker 2012; Keltner & Haidt 2003).
→ Moments of wonder are reserved for genuine milestones. **In the UI:** a calm "That's everything." when the queue is cleared; a rare find gets a violet sheen; no confetti.

### 2.6 Memory and place

**Spatial stability carries memory** (Data Mountain: Robertson et al. 1998; Czerwinski et al. 1999, B). Retrieval stayed fast after months away. The benefit is stability, not 3D (Cockburn & McKenzie 2002).
→ Threads and projects keep stable places. *"Sorting can be a view, never the home."*
**In the UI:** the sidebar keeps project order; new asks append, never push the one being read; the global panel inserts a new ask at its ranked place but never before the current card.

**Episodic cues** (Tulving 1972; Dumais et al. 2003): people recall "what was going on when" before content.
**Prospective memory** (Einstein & McDaniel, A): "come back to this" should be an event-based reminder, not left to the head.
→ **In the UI:** "Later today" and the morning recap carry what was parked.

### 2.7 Supervisory control, automation and trust

**Trust works when it matches capability** (Lee & See 2004, A). People misuse (over-rely on) and disuse (under-rely on) automation (Parasuraman & Riley 1997, A).

**The ironies of automation** (Bainbridge 1983, A): the more automated the system, the more crucial and the less practised the human's contribution. In a meta-analysis of 18 experiments, routine performance improves with automation while failure recovery and situation awareness get worse: the "lumberjack effect" (Onnasch et al. 2014, A).
→ The person is kept in a light, continuous loop, not in silence until failure. *"The needs-you moment is the design centre."*

**Situation awareness has three levels**: perception, comprehension, projection (Endsley 1995, A).
→ Supervisors need "what will happen next", not just status. **In the UI:** labelled estimates ("About 20 min of agent work waits on this"); in Demo, the evening forecast.

**Automation bias** is common across domains and "cannot be prevented by training or instructions" (Goddard et al. 2012 systematic review, A; Mosier & Skitka, B).
→ Batch-allow is limited to routine items, with one commit window and one Undo. Suggestions are not pre-selected.
**In the UI:** "Allow all N routine" is never offered for notable or destructive asks and shows the exact commands first. The coordinator's suggestion is never focused or pre-selected and no key takes it.

**Explanations raise acceptance regardless of correctness** (Bansal et al. CHI 2021, B, verified), unless they make verification cheaper than doing the task (Vasconcelos et al. CSCW 2023, N=731, B).
→ *"'Why' text is not a safety feature."* Explanations are kept shorter than the work they justify.

**Cognitive forcing** reduces over-reliance (Buçinca et al. 2021, B), though people like it less.
→ **In the UI:** notable asks arm only after 300 ms ("A beat to read it first."); the destructive hold arms only after the detail has been visible.

**A small lever overcomes algorithm aversion** (Dietvorst et al. 2015, 2018, B): people used an imperfect algorithm much more when they could adjust it, even by ±2.
→ "Send back with a note" is made as easy as "allow".

**Management by exception works only if exceptions are reliably surfaced**; passive management by exception correlates negatively with leader effectiveness (Judge & Piccolo 2004, A).
→ *"A single missed 'needs you' breaks the whole delegation model."*
**In the UI:** a thread waiting with no ask still shows as "Open the thread to see what it needs".

**Developers already delegate supervision to other agents and turn repeated guidance into rules** ("The Work Behind Delegation", arXiv 2609.24234, 2026 preprint).
→ The coordinator as chief of staff; **In the UI (Demo):** "3rd time this week · make it a rule?", with the exact rule sentence shown first.

**Alarm fatigue** (FAA human-factors work): alerts work only when they are few; high alert rates dull responses. ATC classifies alerts by urgency × time to respond × consequence.
→ The thread state is effectively an alert class. The chosen measure is the "needs-you noise rate": the share of asks dismissed without action.

**Counter-evidence kept in view.** METR's RCT found experienced developers 19% slower with AI while believing they were about 20% faster *(note: the Baby research lists this figure as withdrawn; the primary source is worth checking before citing it)*. Parallel threads stop helping when they touch the same files (Codex). Copilot Workspace's planning ceremony was retired. Multi-agent variants degraded sequential planning by 39–70% (Kim 2025). The research's honest conclusion: the advantage of threads over chat holds *"when the needs-you channel is complete, verification is cheap, collisions are caught, and the person is kept in a light, continuous loop."*

### 2.8 Vigilance and the emotional cost of review

**Vigilance decrement sets in within about 15–30 minutes** of monitoring (Warm, Parasuraman & Matthews 2008, A).
**Emotional labour**: surface acting correlates with exhaustion at ρ ≈ .44 (Hülsheger & Schewe 2011 meta-analysis, A). Reviewing a stream of AI work that has to be politely corrected and re-checked resembles surface acting plus vigilance (J).
→ Review is batched, short, evidence-led and bounded; the system pre-checks so the person reviews exceptions.
**In the UI:** after 25 minutes of deciding, the next natural pause offers a break: "Attention dips after about 25. N left, nothing urgent; they'll hold." *(The specific 25-minute value is a design choice inside the 15–30 minute range; the archive gives no single source for it.)*

*Decision fatigue (ego depletion) is not cited in the core research; it appears only in the hooks catalogue. Vigilance decay and emotional labour are the evidence relied on here.*

### 2.9 Conversation, grounding and social cognition

**Turn-taking** (Stivers et al. 2009, ten languages, A): gaps average about 200 ms; longer gaps signal trouble or refusal (Kendrick & Torreira 2015).
→ Every turn needs an immediate acknowledgement; any wait beyond about 1 s needs a visible, honest signal.

**Grounding** (Clark & Brennan 1991, A): people work to establish mutual belief that they were understood.
→ The design shows *where a message went* and *what the agent understood*. **In the UI:** the composer's target line ("→ New work for **billing-api**"); "Sent to … · waiting for a thread"; Workspace messages show where they were routed.

**Computers as social actors** (Nass & Moon 2000; Reeves & Nass 1996, A): people apply social rules to computers, and distinct voices are treated as distinct actors (Nass & Steuer 1993).
→ Naming threads as separate characters creates separate trust ledgers and separate blame. *"No agent faces, names or voices: a 'house' is a project name plus a stable hue."*
**In the UI:** "Coordinator", "{project} coordinator", "{project} agent". No personas.

**Anthropomorphism and the uncanny valley of mind** (Epley et al. 2007; Gray & Wegner 2012, contested): machines that seem to have *feelings* unnerve people.
→ Agents are socially fluent (polite, responsive, remembering) but claim no emotions. *"Warmth through competence and attention, not emotional performance."*

**The AI-label effect** (Yin, Jia & Wakslak, PNAS 2024, B): AI replies made people feel more heard than untrained humans did, until they were told the reply was AI.

**Parasocial dependence** (Fang et al. 2025, N=981 RCT, preprint): heavy chatbot use correlated with loneliness and dependence.
→ The product does not optimise for chatting time or emotional reliance; it aims to get the person back to their life and work.

### 2.10 Empathy and care

**Perceived partner responsiveness** (Reis & Shaver 1988; Reis & Clark 2013, A): feeling understood, validated and cared for is the core of intimacy.
**Sycophancy is preferred and harmful** (Cheng et al. 2025/26, B+): across 11 models AI affirmed users about 49–50% more than humans did, even for harm; it reduced willingness to repair conflict, yet people rated it higher and trusted it more.
**Memory raises care but also creepiness when its source is unclear** (Ur et al. 2012; Shklovski et al. 2014, B).
→ Care is expressed through **action and timing**: acknowledge instantly, follow up when promised, say when something will be late, report bad news plainly ("the tests fail; my earlier fix was wrong"), show memory with provenance ("you said X on Tuesday; I kept to it").
**In the UI:** "Stopped by you. Nothing after 'Reproduce' ran; 0 of 3 steps are kept." "Didn't reach the agent: {title}. It's back in your list." "Can't reach XO… Nothing you write is lost."

The society ideator's insight about the person: they want to be *"the one whose judgement counts, not the one whose labour is needed."* Their role shifts through the day: captain, judge, editor, host, mentor.

### 2.11 Motivation, habit and pull

**Habit** (Wood, Quinn & Kashy 2002, B): about 43% of daily behaviour is repeated in the same context while thinking of something else. Habits are cued by context.
→ The design anchors to real daily cues (start of day, end of day) and aims to earn the habit by being useful every time.

**The 66-day myth** (Lally et al. 2010, C): of 96 volunteers, the curve fitted for only 39; the median was 66 days (range 18–254); and **missing a single day did not materially matter**.
→ This undercuts streak mechanics on evidence, not just values.

**Variable reward** drives compulsive checking (Ferster & Skinner; Schultz et al. 1997, A).
→ Agent results are not made unpredictable in timing or presentation to drive checking.

**Zeigarnik vs Ovsiankina** (Ghibellini & Meier 2025 meta-analysis): no memory advantage for unfinished tasks (ratio about 0.99), but a robust tendency to **resume** them (about 67% vs 50%).
→ Open loops pull people back to act. The design uses them honestly: only real pending items, each with a next action, and no manufactured incompleteness.

**The progress principle** (Amabile & Kramer 2011, 238 people, ~12,000 diary entries, B): progress on meaningful work was the most prominent event on the best days; setbacks weighed more than wins.
→ The emotional centre of the product is visible progress on the person's own goals. **In the UI:** the checklist bar flashes a finished step; "N steps done" in the morning recap; "{thread} finished" in the status line.

**Self-determination theory** (Ryan & Deci 2000, A): autonomy, competence and relatedness drive motivation. Expected tangible rewards undermine intrinsic motivation (Deci, Koestner & Ryan 1999, d ≈ −0.34).
**Ownership follows influence** (Norton et al. 2012; Liu 2026 preprint).
**Endowed progress** (Nunes & Drèze 2006, B): 34% vs 19% redemption, stronger when a reason is given.
**Loss aversion** λ ≈ 1.96 (Brown et al. 2024 meta-analysis, A). Streaks exploit it.
**Dark patterns** (Gray et al. CHI 2018; Mathur et al. CSCW 2019: on about 11% of shopping sites): nagging, obstruction, sneaking, interface interference, forced action.
**Over-consumption** (Allcott et al. 2020; 2022): self-control problems account for about 31% of social media use.
→ Success is measured by outcomes kept and time returned to the person, not by engagement or session length. See [07-decisions-pacing-and-ethics.md](07-decisions-pacing-and-ethics.md) for how the engagement direction was reconciled with this.

### 2.12 Play, feedback and aesthetics

**Juiciness** (Kao 2020, about 3,000 players; Kao et al. CHI 2024, B): medium-to-high juice gave the best experience; none or extreme juice was worse; amplified feedback can *reduce* the sense of agency. "Good juice needs legible action–outcome links and graded success."
→ Motion and sound confirm causality (I did X → Y happened) at modest intensity.

**The aesthetic-usability effect** (Kurosu & Kashimura 1995; Tractinsky et al. 2000, B): attractive interfaces are rated more usable.
→ Visual craft matters for trust in agent output, but cannot replace correctness and may raise over-trust. This is why the craft is high and the numbers are honest.

**Animated transitions improve comprehension** (Heer & Robertson 2007; Chang & Ungar 1993, B).

### 2.13 Individual differences

**ADHD**: 2.58% persistent / 6.76% symptomatic adults worldwide (Song et al. 2021, A−); distraction and time perception are harder; external structure helps.
**Autism**: predictability is often a need; about 60–90% have heightened sensory sensitivity (Marco et al. 2011, B); literal, explicit language is often preferred.
**Age**: processing speed declines; older adults prefer stable layouts and are more affected by small targets and fast transient notifications (Czaja et al. 2006, B).
**Culture** moderates trust in automation (Chien et al. 2016, B).
→ *"Predictability is a need, not a preference, for many neurodivergent users."* Nothing moves, autoplays or changes layout without user action; motion honours reduced-motion settings; agent messages are explicit and plain; interruption policy is quiet by default.

---

## Part 3 · What the frontier scan taught

**What stuck in the market**: products that attached a **durable work object** or a **delegation unit with a check** to chat (Claude Artifacts, Claude Code sessions, background-agent PRs, Linear's agents, Granola). Merge rate is becoming the industry's accepted-and-kept metric.

**What died**:
- screenless hardware for work that needs inspection (Humane Ai Pin about 10,000 sold; Rabbit; Friend);
- scope-less "do anything" agents (Project Mariner shut down May 2026);
- long silent autonomy (Devin: 3 successes in 20 tasks in Answer.AI's trial, "could not predict which tasks would succeed");
- prompt-only safety (Replit deleted a production database; OpenClaw lost an approval instruction in context compaction and deleted 200+ emails): the lesson drawn is that approvals are enforced outside the model;
- heavy planning ceremony (Copilot Workspace sunset May 2025).

**Retention in consumer AI is shallow** (ChatGPT about 50% at 12 months; vibe-coding traffic down 27–64% from peak). The durable return is event-driven ("a thread needs you") plus a reliably useful daily check, not engagement for its own sake.

**Adjacent fields**: NASA mission-control voice loops (monitor without interrupting), ATC alert classes, PagerDuty grouping (Hudson's Bay cut alerts 61%), RimWorld's "notify me later" (*"Snooze is a missing primitive in most AI agent UIs"*), HEY's Screener.

**The gap no product fills**: *a cross-project, person-centric control room where a coordinator triages, batches and explains many threads' asks.* That is what XO Space is.

---

## Part 4 · What the research still doesn't know

Stated as open questions in the report and handoff:
- How many concurrent threads one person can supervise (hypothesis 3–7).
- Whether agent-originated interruptions cost more or less than human ones. No study measures this.
- Whether spatial memory forms for ephemeral agent threads.
- Where helpful memory becomes creepy.
- Whether the AI-label penalty holds for 2026 daily users.
- At what forecast miss rate trust is lost.
- Whether autonomy-as-reward lowers situation awareness (Bainbridge's irony).
- How neurodivergent users supervise agents. No studies found.

**Thresholds that are design choices, not findings.** The 3 s commit window, 300 ms arming, 1.2 s destructive hold, 25-minute break, 30-minute "small ask" line and 60-minute ping line each rest on a cited principle, but the exact numbers are the designers' choices. They are tunable, and open to revision when evidence from use warrants it.

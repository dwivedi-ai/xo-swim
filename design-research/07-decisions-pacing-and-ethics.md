# 07 · Decisions, pacing and the ethics of engagement

The parts of the design that are **behaviour**, not layout: the decisions taken about the systems that "work invisibly" (P2). They govern what reaches the person, when, and how a decision feels. Each entry records what was decided, why, and where it came from.

## 1. The Decision Kit

Written first for 02 · Audience Desk, copied whole into every later concept, and byte-identical from round 3 to the shipped `js/kit.js`. It is the most stable part of the design.

| Decision | Value | Why |
|---|---|---|
| **Commit window**: every decision waits before it reaches the agent, with Undo | **3 s** (`COMMIT_MS`) | Sense of agency needs immediate, visible consequence (Berberian 2012); Undo makes speed safe (Baby: forgiving) |
| **Destructive hold**: allow only by pressing and holding, under the exact command | **1.2 s** (`HOLD_MS`) | The body enforces "risky items are never batched", which a button cannot (SB5 Weighted Desk) |
| **Read before arming**: notable buttons and the destructive hold arm only after the detail is visible | **300 ms** (`READ_MS`) | Anti key-mash; a cognitive forcing function (Buçinca 2021) |
| **Equal weight**: Allow and Send back are the same size and style | both outlined; green only on press and stamp | A small real lever (Dietvorst 2018); "every 'no' as easy as every 'yes'" |
| **Send back opens an inline note** | "What should it do instead? (optional)" | Steering, not just rejecting |
| **Destructive asks are kept out of batches, single keys and gestures** | `a` on a destructive ask only shows a hint | Automation bias (Goddard 2012) |
| **Destructive asks are ranked last, and do not block or nag** | always last; "Later today" | In review, the destructive card produced hesitation and easier asks were cleared first; the decision was to make that behaviour safe, not correct it |
| **Destructive asks carry only their cost** | no "frees" or "idle" chips | A gain chip dresses a cost as a gain and adds guilt to the card that already causes hesitation (P0 in review) |
| **Allow all routine** touches routine only, after a confirm that lists the commands | one window, one Undo | Batching is safe only for routine |
| **Focus lands on the card**, not on an answer or the suggestion | | A focused suggestion that one Enter would send was a P0 |
| **The hold ignores a key still held from the previous card**; blur or release cancels; a plain click does nothing | | No accidental destruction |
| **Make it a rule** shows the exact sentence before anything is sent | `Standing rule for {project}: you may run "{cmd}" without asking.` | Nothing becomes standing policy without being read |
| **A waiting thread with no ask still gets one** | "Open the thread to see what it needs" | A missed "needs you" breaks delegation (Judge & Piccolo 2004) |
| **Asks are grouped** | destructive (set apart) · notable · routine · stopped | ATC alert classes |

**What happens after a decision.** A stamp, a one-line receipt ("Allowed. It's back at work."), then the card folds away or the next one enters. The Undo toast counts down three seconds. If the call fails: "Didn't reach the agent · Retry", and the ask returns to the person's list.

## 2. Pacing: what speaks up and what waits

### 2.1 The question it answers

In round 4, 16 · Budget gave the person a visible daily budget of 5, 10 or 15 asks. Design review found the fixed cap wrong for the audience: programmers and other heavy users can legitimately receive many asks in a day, so the reasoning behind the cap was examined before anything was carried forward.

The reasoning held: scarcity forces the system to bundle, rank and turn repeats into rules. The visible number did not: a fixed number either idles agents or hides work, and a programmer may legitimately get forty asks. The decision was to keep the forcing function and drop the cap. The coordinator does not ask "how many asks can you take today?"

### 2.2 The pacing decisions (`js/pacing.js`, "applied INVISIBLY: there is no daily cap, no meter and no number")

1. **Rank** every ask by the work its answer unblocks per second of the person: *agent minutes waiting ÷ effort seconds* (Glance 5 s, Decide 60 s, Think 300 s). Sort order: destructive last → Later after the rest → effort (Glance < Decide < Think) → that ratio → first seen.
2. **Hold** a *small* ask (under **30 agent-minutes**) whose agent can keep working around it. It waits under "Handled · can wait" with the reason "Small, and its agent works around it." and a **Bring in** button.
3. **Do not hold** an ask whose agent is idle (waiting on you), a destructive ask, or a stopped thread. It was decided that pacing does not idle an agent: the round-4 review found that idling 1.6 agent-hours to protect 1 minute of the person's attention is anti-productive.
4. **Ping** only for a newly arrived ask that unblocks **at least 1 hour** of agent work, **once**, in the calm status line ("billing-api · worth a look"), and not when sealed.
5. **Suggest a break** after **25 minutes** of deciding, at the next natural pause (after an answer, not mid-card): "Attention dips after about 25. N left, nothing urgent; they'll hold." (Warm et al. 2008: vigilance decays in 15–30 minutes.) The thresholds are tunable ([10](10-open-questions.md) §7); revisit them if daily use shows they ping too often or hold the wrong asks.
6. **After an absence**, only the first three asks light up; the rest are parked (Demo). Absence is fine.

**What the person sees** is only the result: "Six things are worth your time", "Handled · 2 can wait". No arithmetic.

**Live today.** Live asks come from waiting threads, so their agents are idle and they are not held. A Live ask needs about three or more steps left in its checklist to qualify for a ping. Held asks, seeded wait times and parking are Demo behaviours until the backend provides per-ask unblock estimates and work-around status.

### 2.3 Why invisible, but not hidden

Two failure modes sit on either side:
- **Visible mechanics** (Budget's meter, Chain's unlock graph, Overnight's forecasts during the day) confuse and clutter; review found that budget and overnight machinery on screen created confusion rather than control.
- **Hidden work** would work against trust: an ask the person can't see is an ask the system decided for them.

So the chosen approach is that the *mechanics* are invisible and the *results* are always one tap away, with reasons. The coordinator works the same way: it decides **when** something reaches the person, not **whether** it does (12 · Breakpoints).

## 3. Honesty decisions

The product supervises agents. If its signals can't be believed, nothing else matters. A single fake number poisons trust in every real one, so the following were decided:

- **Show only what is measured, or label it an estimate.** "About 20 min of agent work waits on this", with a hover: "An estimate: the steps left that wait on this answer × a typical step time." Forecasts carry an *estimate* tag.
- **No "freed".** Precise savings claims were hand-set in Budget and were removed.
- **The forecast that was shown is the forecast that is sealed.**
- **The morning recap says "the decision that moved work" only when it really did**, and "has a question for you" only when one really waits.
- **No invented threads.** "Sent to billing-api · waiting for a thread" until a real thread exists.
- **No faked success.** In Live, resolving from the UI says "Resolving from the UI needs the API in requirements R1." Choosing a model says "Nothing was changed." Stop is hidden rather than pretending.
- **"Working" means the session is actually busy.** Otherwise it says "Idle".
- **No fabricated labour.** No staged progress, no theatrical delays.
- **Report bad news plainly**: "Stopped by you. Nothing after 'Reproduce' ran; 0 of 3 steps are kept."

## 4. Engagement and ethics: the product's engagement position

Engagement is designed deliberately. The position below is part of the design, not a constraint placed on it.

### 4.1 Where it started

The Baby research and the human-nature charter said: no streaks, badges, variable rewards, guilt or fake urgency. It favoured real progress made visible, competence, autonomy, honest open loops, daily cues, and wonder only at real milestones. Evidence behind it: missing a day doesn't matter for habit (Lally 2010); loss aversion λ ≈ 1.96 is what streaks exploit; sycophancy is preferred and harmful (Cheng 2025/26); people over-consume relative to their own preferences (Allcott 2020, 2022); dark patterns are common (Mathur 2019).

### 4.2 The engagement position

XO Space is a serious work product, and its engagement design serves both the business goals and the person's goals. For XO Space, the blanket "no streaks / no gamification" line is **superseded** by a narrower position:

- **Hooks are used deliberately.** Reward, momentum and open loops are legitimate tools, in the way GitHub's contribution graph and Snapchat's streaks are.
- **Every hook is tied to real work.** Each session in the product moves something real forward; engagement is not an end in itself and does not come at the cost of wasted time. The product's purpose is to get more real work done.
- **Stakes are always true.** No invented urgency and no fake stakes: a system that raises one false alarm loses trust in every signal.
- **Hooks go beyond the familiar.** Classic streaks are treated as a commodity mechanic; the hooks sought are specific to XO Space and high-impact.

**Open question: guilt-framed vs action-framed copy.** Whether guilt framing has a place is not settled and is to be decided by an A/B test. The working hypothesis is that guilt framing ("You've let 3 threads down 😔") tends to drive avoidance, while action framing ("3 threads are ready to move when you are") drives action.

### 4.3 The principles

The hook that is unique to XO Space is **agents doing real work for the person**: a tiny decision unlocks large machine work. Three named principles follow from that:

> **Power, not obligation.** Streaks say "don't lose this." These hooks say "look what you can do."
>
> **The stimulus may be designed; the stakes must be real.**
>
> **For any guilt-adjacent copy:** the stimulus can sting, the facts must be true, and the way out must be equal.

### 4.4 What survived into the shipped design

| Hook | Mechanism | In the product |
|---|---|---|
| **Your next move** | A ranked, real-leverage next action (anticipation, progress) | Home |
| **Labelled estimates** | Visible leverage, honestly ("about 20 min of agent work waits on this") | Home, decisions |
| **Found while working** | An honest variable reward: rare finds get a violet sheen; the reward is real work | Home (Demo), ≤2, no pings |
| **"3rd time this week · make it a rule?"** | Investment: the reward for engagement is needing to engage less | Decisions (Demo) |
| **Rules in words** | Competence and stored value: "3 rules answered 68 asks for you" | Workspace (Demo) |
| **Before you go → Seal → morning recap** | Anticipation, closure, permission to leave ("Overnight Engine" + "Absence Is Fine") | Day boundary only (Demo) |
| **"That's everything."** | A calm completion moment, not confetti | The panel |
| **Game feel** | Press, stamp, hold tension | Everywhere |

### 4.5 What was cut, and why

| Cut | Why |
|---|---|
| The fixed daily ask budget and its meter | Idles agents or hides work |
| The Chain's unlock meter, combos, replay, counterfactual, trust grid, notches | Review found no value in it; a glyph matrix repeats the exact failure mode of Terrain and Loom |
| "You freed ~8.5 agent-h", the agent-hours ticker | Not measured; a made-up number presented as a fact |
| Warm-cache and idle countdowns, "$0.06 to reload" | Jargon; per-second ticking on Home |
| Harvest count, the 14-dot streak strip | Unexplained numbers |
| "Planting" | Not understood |
| Overnight UI during the day | Clutter |

### 4.6 Positions held, and why

These positions were ruled in deliberately; each rests on the reason given and can be revisited if evidence from use shows that reason no longer holds.

- **No fake stakes, urgency or labour.** A single fake signal destroys the channel.
- **No pre-selected or focused suggestion.** Automation bias turns a focused suggestion into a rubber stamp.
- **No pressure on a destructive ask** (no countdown, no guilt, no "idle" chip on it).
- **No agent feelings** ("I missed you", "I'm so proud"). Character is derived, not invented.
- **No punishment for absence.** Nothing decays or wilts.
- **Success is not measured by time in app.** The chosen measures are accepted-and-kept output, time-to-unblock and the needs-you noise rate.

**Still open:** guilt-framed vs action-framed copy, to be decided by an A/B test (see [10-open-questions.md](10-open-questions.md)).

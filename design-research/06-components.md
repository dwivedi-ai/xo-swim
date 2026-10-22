# 06 · Every component, and why it looks the way it does

For each component: **what it is**, **why it is this way** (the evidence and the review findings), **the decisions** it rests on, and **Live vs Demo** where they differ. Each decision is recorded with its reason, and can be revisited if that reason stops holding in daily use. File references point to the shipped code.

**Live and Demo.** Live talks to the real XO backend. Demo is a simulated, busy workspace in the browser. The backend doesn't yet support approvals with an approve/deny route (R2), stopping an agent, resolving a thread from the UI (R1), per-chat model choice (R6) or a `before` history cursor (R5), so Live hides or degrades those features honestly instead of faking them. Demo-only: the end of day, seal and morning recap; Found while working; rules; Stop.

---

## 1. The shell

### 1.1 Layout: sidebar, canvas, one column

**What.** A 264 px sidebar (248 px at ≤1320 px) and a main canvas. Home is one centred 660 px column; conversations are one 720 px column. The composer, the docked decision card and the status line all align to that column.

**Why.** One column means one reading line and no scanning across panels. The sidebar is the deepest tone (`#111111`) so navigation recedes and the work is the hero. The aligned column means the eye never re-finds its place between reading and writing.

### 1.2 Sidebar

**What.** Top: the brand **XO Space** (the XO mark, then "Space"), and a light-mode slide switch. Under it, **Create XO Project**: a full-width button shaped like the rows, with the plus in a small green tile. Then **Home** and **Workspace**. Then "Projects" and the project rows. At the bottom, the Settings cog.

**Project rows** are button-like tiles with a subtle glass surface: the cube tile and the name.
- **Quiet project**: the name only, plus a small blue dot while something is working.
- **Needs you**: the tile, name and a short label tint amber, with a ◆ count. The label is the lead ask in a few words ("Run `npm test`"). It turns red when the lead ask is destructive or stopped.
- When the count rises, the row gets one 2.6 s amber wash, then goes still.
- **Sealed (Demo)**: every accent drops; the sidebar is calm.

**Why.**
- **Projects only, never threads.** Duet nested threads in the sidebar; this was rejected in review, because listing every session in the sidebar is not how project threads are meant to be read. Threads live inside their project (P4).
- **Text only when a project needs you.** When every row carried a description, the sidebar became text-heavy, so rows became separate button-like tiles with a subtle glass surface. A quiet project needs few words. When everything is highlighted, nothing is.
- **Accent plus ◆.** An accent colour is used and the diamond is kept. Shape plus colour, so state never depends on hue alone.
- **A calm amber count, never a red badge.** Red counts are something to chase; amber says "your turn".
- **Names in sans**, not mono.
- **The button at the bottom** ("?" in review, confirmed there) became the Settings cog on 2026-10-14 (hub #7); the shortcuts moved into Settings › Keyboard.
- **A slide switch for light mode**: a toggle that slides in, rather than a button.
- **Create XO Project is a real button under the brand** (owner, 2026-10-21: "an easy-looking way to create a new project, like it was before"). The classic UI had exactly this; 17 · Converged had reduced it to a bare 24 px "+" beside "Projects", which was too easy to miss. It is shaped like the rows (13 px radius, row surface, 42 px high) so it belongs to the sidebar, and the plus sits in a green tile, the same as Home's button, because creating a project is the primary action there. At rest it is an outline (no fill), so it never looks like the selected row below it; it fills on hover. Home keeps its own button.
- **The cube on every project** (owner, 2026-10-21): the classic UI's project icon, restored in place of the letter tile; see [05 §2.5](05-visual-system.md).

### 1.3 The phone

**What.** At ≤760 px the sidebar becomes a drawer with a scrim; a 52 px top bar holds menu, title and the Settings cog. The decision panel and the intelligence popover become bottom sheets. The Now shelf becomes a horizontal snap strip. Every target is at least 36 px.

**Why.** The round-2 brief established that this is a texting app, so mobile matters. Sheets own the bottom edge because that is where the thumb is. The drawer casts its shadow only while open; a stray shadow on the left edge in mobile mode was found and removed.

---

## 2. Home

**What.** The default page. It answers one question: *what should get done?* At most four blocks, about 120 words:

1. **Head**: the date, a greeting, and one sentence: "One thing is worth your time." / "Three things are worth your time." / "Nothing needs you." On the right, **Create XO Project**.
2. **Your next move**: one card (§2.1).
3. **Then**: at most two more rows, then "+N more", and "Clear N glances together" when two or more quick ones wait.
4. **Found while working** (Demo): at most two.
5. **One calm line**: "**Handled** · 4 working · 2 can wait", beside "End the day" / "Before you go" (Demo).

**Why.**
- Home was specified before it existed: a page showing what needs the person and what is working. Without it, the app would open on the Workspace chat.
- 11 Next's Home was carried forward because it immediately shows what has to be decided, and presents that data properly.
- **At most four blocks, ~120 words**: review found earlier versions carried too much text and were hard to attend to. Working memory holds about four things (T1).
- **"Worth your time"**, not a count of asks. The person sees the outcome of pacing, not its mechanics (P2).
- **No motion on Home while agents work** (measured: 0 moving elements over 20 s). Motion is spent only on what needs the person (T8).

### 2.1 Your next move

**What.** One raised card with a faint green gradient border (red for destructive). Inside:
- an **effort label** with a small dial: **Glance** ~5 s · **Decide** ~1 min · **Think**, needs focus;
- a "where" link: project › thread;
- the **headline**: "Run `npm test`", "Stopped at {step}", or the ask in one line;
- a **labelled estimate**: "About 20 min of agent work waits on this" (hover: how it was estimated). In Live: "N steps left in its checklist";
- the **coordinator's suggestion**: one quiet violet line, "Suggests **{answer}** · fairly sure";
- the **answers**: a quick glance can be answered right on the card (equal Allow and Send back, or the options); bigger asks get one verb ("Decide →", "Read it closely →", "Read and reply →"); Think asks can go to "Later today".
- In Demo, on the third similar allow: "**3rd time this week · make it a rule?**"

**Why.**
- **One next move, not a list.** A chief of staff tells you the one thing that matters now. Choosing what to look at is itself work.
- **Effort labels** let people match asks to the attention they have: glances are cleared in 15 seconds, Think asks are planned for later. They came from a review finding: the destructive backfill produced hesitation and the easy asks were cleared first. The design makes that instinct effortless.
- **Ranked by work unblocked per second of you** (agent minutes freed ÷ effort seconds), with destructive asks always last (never forced first) and quick ones first.
- **"About 20 min… waits on this"**, labelled and explained, replaces Budget's "you freed ~4.1 agent-h", which was found to be a made-up number dressed as a fact (P10).
- **The suggestion is violet and never pre-selected.** Violet is the coordinator's voice, distinct from status. A focused suggestion that one Enter would send was a P0 in review (P9).
- **The card stays put** until it is done; a new arrival never replaces what you are reading (P5).
- **When the same ask is open in the panel**, the card becomes a dashed "Open in the panel" line, so nothing shows twice.

### 2.2 Then, and "Clear N glances together"

**What.** Up to two rows: effort dial, title, project, chevron. Footer pills: "+N more", "Clear N glances together", "N later today · bring back".

**Why.** "Then" gives a sense of what's coming without making it a to-do list. Bundling routine glances is the one batch the research allows: routine only, one window, one Undo (automation bias, Goddard 2012).

### 2.3 Found while working (Demo)

**What.** At most two rows: something an agent noticed but didn't act on, a long-open to-do that is now easy ("ripened"), or a repeat pattern ("déjà vu"). Each: "Start" (one tap to a thread) or ×. A rare one gets a violet sheen.

**Why.** The round's "best variable reward" that is honest: the finds are real, the reward is real work, and they **never ping and never interrupt**. At most two, because more would compete with the next move.

### 2.4 Handled · can wait

**What.** One 48 px row: "**Handled** · N working · N can wait". Opened, it lists every working thread (current step, a mini progress bar) and a **Can wait** list: each held ask, its honest reason ("Small, and its agent works around it."), and **Bring in**.

**Why.**
- What waits on an agent is quiet. Working threads don't need the person, so they fold into one line.
- **Held asks are visible, with a reason, one tap away.** Pacing is invisible in its mechanics but never hidden in its results, so trust never depends on hidden behaviour (from 12 Breakpoints). A held ask that you couldn't see would be hidden work.

### 2.5 End the day, Seal, the night and the morning (Demo)

**What.**
- **Before you go** (evening): "Queue up to three things to run overnight. You'll see what got done in the morning." Up to three items → "Queue for tonight". A live forecast: "By morning **about 12–18 steps** · two likely to finish *estimate*". Optionally a true stake: "Answer two asks first and about 4 more steps can run", which opens exactly those asks.
- **Seal the day**: "Notifications stay quiet until 9:00. Asks wait safely." Home becomes one still card: "**Nothing needs you until morning.** Sealed until 9:00. Close the lid; the agents keep working." The sidebar drops its accents; the tab reads "Sealed".
- **The morning**: one recap card, on the first visit only: steps done against the forecast, what finished ("queued by you"), the decision that moved work (only when it really did, as an estimate), a question only if one really waits. Then "Your first move", unfocused. Leaving Home folds it for good.

**Why.**
- **Closure, permission to leave.** The pull is closure, not craving. Overnight's research hooks ("Permission to Leave", "Absence Is Fine") were adopted; its mechanics were moved off the daytime screen because too much budget and overnight detail was found to clutter and confuse.
- **"Queue for tonight", not "Plant"**: the planting metaphor was found not to be understood.
- **The forecast you were shown is the one that is sealed.** A forecast that changed when sealed was a P0: so it was decided that a forecast whose whole value is calibration does not move on sealing.
- **Sealing never shifts the layout.** In Budget, sealing the day pushed the UI down. Now the page cross-fades with the header fixed.
- **Can't seal when something is time-critical**: "A seal is only honest when nothing is time-critical."

### 2.6 Empty states

"**Nothing needs you.** 4 threads working. They'll ask when it's worth it." or "Start something below, or enjoy the quiet." When the backend can't be reached: "**Can't reach XO.** Retrying every few seconds. Nothing you write is lost; sending waits until it's back."

**Why.** An empty state is designed to feel like **relief**, not absence (a blank state is treated as a bug). It reassures that the agents are working and that silence is safe.

---

## 3. Decisions

### 3.1 The Needs-you panel (global)

**What.** A panel that rises **beside** the page (`clamp(392px, 33vw, 452px)`, sized to its content), not over it. Header "**Needs you**" and "2 of 6". A thin rail of ticks shows the queue (destructive ticks set apart). One decision card at a time. Footer: ‹ previous, "Allow all N routine" or the tip "*Skip freely; nothing here is forced first.*", › next. On a phone, a bottom sheet over a dimmed, 1.5 px-blurred page. It ends on "**That's everything.**" with a summary ("3 allowed · 1 sent back · 1 for later").

**Why.**
- **Beside, not over.** Glide's full-page flow worked, but it took up the whole page during decisions. 11 Next's panel size and position were confirmed in review as right for deciding globally.
- **Sized to content.** 12 Breakpoints opened a tall, mostly blank grey panel that read as broken.
- **One at a time, with a position.** Working memory (T1) and the Round's "known end": you always know how many are left and that it ends.
- **A stable frame; only contents change.** In Messages, the animation between questions was found to be poor. The card frame stays; content cross-fades; height eases.
- **"Skip freely; nothing here is forced first."** The hesitation the red card produced in review, made into policy.
- **Allow all routine** asks for confirmation and lists the exact commands, and is never offered for notable or destructive asks.
- **After 25 minutes of deciding** the next pause offers a break: "**25 minutes of deciding.** Attention dips after about 25. 4 left, nothing urgent; they'll hold." (vigilance decay, T13).

### 3.2 The decision card

**What.** One card, shared by the panel and the thread:
- top: effort label, a risk chip ("Destructive" with a lock, or "Stopped"), project › thread;
- the **headline** (20 px), then **one why-line**;
- for destructive asks, instead of a why-line, a red **facts line**: "Can't be undone · Writes 61M rows · about 4.1 h · ~$38 of compute · can't pause half-way";
- the estimate and the suggestion;
- **Details** (in place): the exact change in mono (diff lines tinted), the full why, the last two messages, the checklist and the branch;
- **answers**: equal **Allow** and **Send back** (outlined; green only on press and stamp), or the options, or **Reply in words**; destructive: **Hold to allow**; stopped: **Try again** / "Tell it what to try";
- a low row: "**Make it a rule**" toggle (Demo), "Later today";
- Send back opens an inline note: "What should it do instead? (optional)".

**Focus** lands on the card, never on an answer or the suggestion.

**Why.** This is the Decision Kit, the one part of the round-1 winner that was never criticised and passed unchanged into the final:
- **Three layers of context** (headline + one line → Details → the whole thread) give enough context for an appropriate decision, which a review note questioned, without the wall of text found earlier.
- **The exact command, not a paragraph**: the exact command or change is shown, never a paragraph, because explanations make people approve whether they are right or wrong (Bansal 2021; Vasconcelos 2023).
- **No risk table**: a table was found overwhelming and removed the interest to read.
- **Plain consequences for destructive asks**, in real units, before the choice (Baby: "costs shown in real units before the choice").
- **Red borders follow the radius**: a red left edge that flowed out past the curve was found to look wrong.
- **Equal weight** (P7) and **the hold** (P8): see [07](07-decisions-pacing-and-ethics.md).

### 3.3 The motion of deciding

**What.** On Allow, a stamp (a drawn check in an 88 px circle) pops with a slight spring and the card lifts; on Send back, a back-arrow stamp and the card rewinds left. After 190 ms the content leaves and the next card's content enters as the frame's height morphs (300 ms). The **destructive hold** fills slowly at first, tenses near the end, locks red with "Allowed", and springs back on early release ("Released early. Nothing was sent.").

**Why.** Game feel: how the UX responds makes certain actions felt. Allow and Send back are different outcomes, so they *feel* different. The hold's tension makes the one irreversible action feel heavy, which is the point. Motion confirms causality at modest intensity (Kao 2020/2024).

### 3.4 Undo toast

**What.** "**Allowed** run npm test · **Undo**" with a 3 s ring countdown, above the composer. "Undone. Nothing was sent; the ask is back." On failure: "Didn't reach the agent: {title}. It's back in your list."

**Why.** Forgiving (Baby's principle 3). Sense of agency needs immediate, visible consequence (Berberian 2012), and Undo makes speed safe.

### 3.5 A thread's own decision (docked)

**What.** Inside a thread that waits on you, its decision appears as a wide card docked above the composer, aligned to it, with Details in two columns. The conversation behind it dims (0.16) and blurs 1.5 px. After deciding, one line: "**Allowed.** It's back at work." for about two seconds, then it folds away.

**Why.**
- The docked card adapts 13's panel by direction: it is used when a thread is open and has its own decision.
- **The blur**: set in the precision refinement pass. The background is darkened and also blurred slightly, very subtle, enough to direct attention to the card. The card covers the conversation, so the conversation softens; the card and the composer stay sharp and clickable.
- **The receipt line, then gone**: a persistent trace that the decision landed (change blindness, T8), without leaving clutter.

### 3.6 Live: asks are answered in words

In Live, the backend has no approve/deny route yet (R2). A thread waiting on you is titled from its agent's last message (its first sentence, up to 140 characters), and you answer in words, as a thread reply. No options are invented; no fake "Allow" is posted for a question. A waiting thread with no message still appears: "Open the thread to see what it needs", because a single missed "needs you" breaks the whole delegation model.

---

## 4. Conversations

### 4.1 The Workspace

**What.** Your coordinator across all projects. A large XO tile with a soft green halo, "**Workspace**" in 34 px, and "Your coordinator, across all N projects." A stats strip: Working · Need you · Can wait · Finished today. A "› Next move" button. In Demo, your rules in words: "3 rules answered 68 asks for you." Then the coordinator conversation, where each message shows where it was routed ("→ Routed to **billing-api**, **mobile-app**").

**Why.**
- The Workspace chat was found identical to any project chat, with no differentiating factor, and short of the elegance the main session needs. The Workspace looks like the main session, distinct from projects.
- **No "main session" label**: the label was found unnecessary. The design says it, so the words don't have to.
- **Routing made visible**: delegation needs a receipt of *where it went* (grounding, Clark & Brennan; T7).
- **Rules in words, not a chart**: "Asks per agent-hour" was found unintelligible in review.

### 4.2 A project

**What.** The project name (22 px) on top and **one sentence**: "**2 need you** · 3 working · 5 done this week" (or "All quiet"). **All threads N** opens a searchable sheet. Below, the **Now shelf**. Then the project coordinator's conversation, with inline thread cards.

**Why.**
- **Title on top**: carried forward from 12 Breakpoints. Moving it left was assessed critically and rejected, because it duplicates the sidebar and leaves a dead band.
- **One sentence of state**, because the person needs the shape of the project, not a dashboard.

### 4.3 The Now shelf

**What.** At most **three** thread cards: needs-you first, then stopped, then working. Each: state glyph, title (ellipsis), "x/y", a segment bar, and one line (the ask in amber, the stop reason in red, or the current step). On a phone, a horizontal snap strip.

**Why.** The thread strip and "+n" in the header were found to clutter as the threads grow. The shelf **never grows**: it shows what matters now and nothing else. Three, because of working memory (T1) and the 3–7 span-of-control hypothesis.

### 4.4 All threads

**What.** A sheet: search (title or branch), filters (All · Needs you · Working · Done · Stopped, with counts), rows with glyph, title, state, mini bar and age. Finished threads fold into one line, "✓ **N done** this week ▾".

**Why.** Everything is findable, but nothing finished competes for attention. Closed loops fold away (attention residue, T6).

### 4.5 A thread

**What.** "‹ {project}" back link, the title (19 px) and a state badge (Working / Needs you / Done / Stopped / Resolved / **Idle**). The **checklist bar**: a segment bar (green done, blue doing, grey to do), "x of y", and a now-line: "✱ {current step}", "◆ Paused on you", "■ Stopped at '{step}'", "✓ All 4 steps done". A just-finished step flashes "✓ {step}" for 1.5 s. Open it for the full ✓ ✱ ○ list, parsed from the thread's `status.md`.

**Why.**
- The clean header (judged clean, with room to be cleaner still) and the checklist bar (judged good, with room for better behaviour) were carried forward from Glide.
- **The checklist is the resumption cue** (Leroy & Glomb's "ready-to-resume plan"; T6) and the progress signal (Amabile & Kramer; T10).
- **"Idle" is honest.** "Working" means the session is actually busy. An agent that has stopped moving is not dressed up as working.

### 4.6 Messages

**What.** Your messages are grey bubbles on the right with a tail; agent and coordinator messages are prose on the canvas (15 px, 66 ch), headed "**Coordinator**", "**billing-api coordinator**" or "**billing-api agent**" with branch and time. Code blocks get a language label and Copy. Inline **thread cards** show state, the current line and "Open →", with a separate amber **Decide** button when the thread needs you. Events are one quiet line: "Retry soft declines finished", "You allowed · npm test · as suggested". While the coordinator replies: "The coordinator is replying" with a shimmer and an elapsed timer that follows the real heartbeat.

**Why.**
- **Texting**: the direction is a great texting UI, in the manner of Periphery. Everyone already knows how to read a messaging app; the novelty is in the behaviour, not the reading.
- **Yours as bubbles, theirs as prose**: agents write long, structured text that reads better as a document; your messages are short.
- **Who is speaking without faces**: the XO mark for the coordinator, a blue thread icon for an agent, and plain role names. Character is derived, never invented.
- **History is lazy**: a chat with history opens looking fresh; older messages load as you scroll up (40 → 80 → 160… up to 1,000). Old chat is never loaded until the person scrolls above. New content above keeps your reading position.

---

## 5. The composer

### 5.1 The field

**What.** A 22 px-radius field on a soft fade into the canvas: the conversation fades out under it; no box, no edge. It grows to 200 px, never shows a scrollbar. Placeholders: "What should get done? Use @project to aim it" (Home), "Ask anything across your projects…" (Workspace), "Message {project}…", "Reply to the agent…" (thread). Drafts are kept per conversation. On Home, when empty and unfocused, it collapses to one row.

**Why.**
- **The composer is the heart.** Periphery's chat query was judged sleek and good; every round from 2 on starts from it.
- **A shadow, not a box**: a full-width bar read as a full horizontal box; the intended effect is a shadow, so only the fade remains.
- **It never glows and never moves.** A glowing chat box was rejected, and a notification that raised the box when it appeared was found and fixed. The place you type is the one place kept perfectly still (P5).
- **No scrollbar**: a scroll bar on the text area was found to look wrong.
- **Drafts are never lost** (Baby: "typed text never lost").
- **16 px text**, so phones don't zoom on focus.

### 5.2 The target line and @project

**What.** Above the field, one line says where your message will go: "→ To the **Workspace** coordinator · @ to aim at a project", "→ New work for **billing-api**", "Reply in **this thread**", or "× No project called **x**". Typing `@` opens a project list ("@billing-api · 2 working").

**Why.** Grounding before sending: the person knows where the work will go (T7). A wrong target is refused before sending, not after.

### 5.3 Send, and Stop (Demo)

**What.** A 36 px green circle with an up arrow; Enter sends. Your message appears at once and **lifts from the composer** into the conversation, then is replaced in place by the server's row. On failure: a dashed red border, a plain title ("Can't reach XO", "Router is off") and Retry / Edit. In Demo, while something works and the field is empty, Send becomes **Stop** (an ink circle with a square). Stopping the coordinator: "Stopped. I didn't start anything; your message is kept above if you want to send it again." Stopping a thread: "Stopped by you. Nothing after 'Reproduce' ran; 0 of 3 steps are kept." then Continue / Stop here.

**Why.**
- **Green Send is the only coloured button in the composer**, so the primary action is never in doubt.
- **Instant acknowledgement** (≤100 ms; T7, Miller 1968) and **forgiving errors** (Retry, Edit; the text is kept).
- **Stop**: a stop button is shown while something runs. A small real lever (T4); hard-to-stop agents are a dark pattern (obstruction). The copy says exactly what was and wasn't kept.
- In Live, Stop is hidden because the backend can't cancel yet.

### 5.4 The status line (the "herald")

**What.** One calm, frosted pill that floats above the composer. It is the only place world events speak: "Retry soft declines finished · Open →", "billing-api · worth a look", "Sent to billing-api · waiting for a thread", "All clear". At rest it says "◆ **3** worth your time · next is a one-minute decision" or "✓ Nothing needs you" (and nothing on Home or in an open thread). Your own outcomes are never overwritten by world events while they show.

**Why.**
- **Completion is a calm labelled line, never a glow.** Duet's completion animation worked in review, but round 3 led to the decision that the composer does not glow; the moment moved here.
- **Never an unlabelled light** (Periphery's lesson).
- **It floats**: it never pushes the composer (measured: the composer's top never moved over 14 s while a notification appeared).
- **One line, one at a time**: a budget of one interruption, not a feed of toasts.

### 5.5 The intelligence chip

**What.** Left of Send, the quietest thing in the composer, neutral ink, 12.5 px: "Auto · Sonnet ··" (the router's pick), "• Opus ···" (pinned), "Sage → Sonnet ··" (another router). Click it (or `M`, or ⌘.) for a popover (372 px, not a dropdown): "Intelligence *for this thread*" with an Auto switch; one line saying what the router chose and why; "Who routes" (Router · Sage · Jev, for the Workspace and projects; options without a key are dimmed with "Add key", never hidden); up to four model rows with a three-word trait and **Depth** pips (Quick · / Balanced ·· / Deep ···), "2 more · type to filter"; footer "Applies to this thread only." and "Back to Auto". One click on a pip pins the model and depth. Every change writes one record line with a 3 s Undo.

**Why.**
- **The specification**: the model and its effort are chosen; once a session starts on what the router decided it keeps it until the person changes it; it is presented elegantly, not as the usual dropdown, which gets messy at scale.
- **Quietest element, neutral ink, no violet or amber**: it is a setting, not a status and not the coordinator's opinion.
- **"Depth", never "effort"**: Glance / Decide / Think already name decision effort; two meanings of one word would confuse.
- **Dimmed, never hidden**: the person can see what is possible and what is missing.
- **Sticky per session, every session starts on Auto, a new thread never inherits a pin.**
- **Live**: the chip reads "Auto · Router"; the popover explains the routing in effect and says "Choosing a model here needs the backend's intelligence API (R6). Nothing is changed from this panel yet."

---

## 6. Dialogs, sheets and the rest

### 6.1 Create XO Project

**What.** A dialog: "**Create XO Project** · Its own coordinator, plan and memory." A name field ("e.g. Billing API") with a live "Saved as `~/xo-projects/{slug}`"; "What is it for? *optional*"; "Create project". It uses the XO Space API (`GET /api/config/workspace`, then `POST /api/files/mkdir` with scaffolding). Errors in plain words: "There's already a project called 'billing-api'. Pick another name."

**Why.** A "Create XO Project" button was specified for the sidebar; 13's style was adopted, and it was also placed on Home. Since 2026-10-21 the sidebar's entry is a full-width button under the brand again (§1.2). No separate folder field, because the folder is the same as the name. "A new project", not "a new folder".

### 6.2 Jump (⌘K) and Keys (?)

**What.** Jump: "Jump to Home, the Workspace, a project or a thread". Keys: a two-column sheet of every shortcut, the only place shortcuts are shown, plus the sound toggle.

**Why.** Keyboard first, but **no shortcut chips on screen**: on-screen key hints were found to add clutter and cheapen the interface. Shortcuts are surfaced only in tooltips and this sheet.

### 6.3 The Demo/Live badge

**What.** A small pill at bottom-left, "Demo" or a green "**Live**". It opens: "Live: your real workspace. Sending starts real agents." / "Demo: a simulated workspace. Nothing is sent anywhere." It hides while a sheet is open on a phone.

**Why.** "Never the hero." But the design keeps it always clear whether sending will start real agents: honesty about consequence.

### 6.4 Connection and errors

**What.** When the backend can't be reached, one persistent line: "Can't reach XO · retrying · what you see may be out of date". Sending pauses with the reason ("Sending is paused · The router is off") and the text is kept.

**Why.** Silence reads as trouble (T7); an unexplained frozen screen is worse than a calm sentence. One line, not a modal, because nothing the person did is lost.

---

## 7. Keyboard

| Key | Does |
|---|---|
| `N` | the next move (the thread's card, or the panel) |
| `H` / `W` | Home / Workspace |
| `/` | the composer |
| `⌘K` | Jump |
| `T` | All threads (in a project or thread) |
| `[` `]` | previous / next thread |
| `C` | checklist |
| `M` · `⌘.` | intelligence |
| `U` | Undo |
| `?` | Keys |
| `Esc` | close, in order; or back |
| On a decision: `a` allow · hold `Enter` (destructive) · `d` send back · `1–9` options · `r` reply · `e` Details · `t` make it a rule · `o` open the thread · `J` `K` next/previous · `L` later · `⇧A` allow all routine | |

**Why.** The keyboard map is designed so supervisors who use this all day never need the mouse. Destructive asks are never one key: pressing `a` on one only shows the hint "Destructive asks are never one key: press and hold the button."

---

## 8. The old Space UI, absorbed (decided 2026-10-21)

XO Space's old built-in UI is being retired; everything it does moves here, redesigned, not copied. The map of every
page and where it goes is `docs/space-ui-absorption.md` (local). The owner approved:

- **The sidebar gains three quiet entries: Chats, Activity, Inbox.** Chats is plain chat with one agent; Activity is what
  agents did (sessions, trends, the activity feed, merged with storm's live sessions); Inbox is notifications nothing
  waits on. "Projects" opens an overview (Map, Timeline, Tree, List). Settings holds everything Setup did.
  **Why:** one home per idea, and nothing new competes with Home for the person's attention.
- **Inbox stays separate from Needs you.** Its count is neutral ink, never amber, and it never pings. **Why:** Inbox
  items are notifications nothing waits on; Needs you is decisions an agent is blocked on. Mixing them would teach the
  person that amber can be ignored.
- **The Map and the Timeline are ported fully, and built last.** Settings comes first, because restart, update,
  connectors, secrets and jobs exist nowhere else.
- **The bar** (owner): "make sure its all very human centric and amazing".


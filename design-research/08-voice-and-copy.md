# 08 · Voice and copy

Words are part of the attention budget. Every sentence on screen costs the person something, so it was decided that each one is true, short and useful. This records how the product speaks, and why.

## 1. The voice

**A great chief of staff.** Competent, calm, specific, brief. It names the one thing that matters now, why, and what it costs the person. It doesn't flatter, doesn't fuss and doesn't perform feelings. When something goes wrong it says so plainly, with the next step.

| It is | It is not |
|---|---|
| Plain: "Run `npm test`" | Clever: "Ready to put your tests through their paces?" |
| Specific: "Writes 61M rows · about 4.1 h · ~$38 of compute" | Vague: "This may take a while and cost some money" |
| Honest: "About 20 min of agent work waits on this" (*estimate*) | Inflated: "You'll free 4.1 agent-hours!" |
| Calm: "Nothing needs you." | Hollow: "You're all caught up! 🎉" |
| Kind through action: "Nothing you write is lost; sending waits until it's back." | Kind through adjectives: "We're so sorry for the inconvenience!" |
| Direct about failure: "Didn't reach the agent. It's back in your list." | Evasive: "Something went wrong." |
| Neutral about time: "waiting 12 m" | Guilt: "They've been waiting 6 hours!" |

**Why.** Sycophancy is preferred and harmful (Cheng et al. 2025/26). Care is felt through responsiveness, memory and timing, not emotional language (Reis; Yin et al. 2024). Literal, explicit language helps neurodivergent users and everyone under load (Marco et al. 2011). Long prose explanations raise acceptance whether the AI is right or wrong (Bansal 2021).

## 2. Copy decisions

Each decision below rests on the reason given; if daily use shows the reason no longer holds, the decision is revisited and the new one recorded here.

1. **One idea per line.** Details sit behind "Details", because review found that dense text was hard to attend to.
2. **Home is kept under about 120 words, a card under about 60.** The word count is part of the attention budget.
3. **Sentence case throughout.** Title case and uppercase labels were not used; they add emphasis without information.
4. **Plain verbs were chosen over metaphors.** "Queue for tonight", not "Plant". "Make it a rule", not "Teach the house". A metaphor that fails to decode in design review is taken to fail for every user.
5. **Jargon was cut.** Not "warm contexts will cool · $0.06 to reload". A concept that needs a glossary was judged not to belong on screen.
6. **A number explains itself, is labelled an estimate, or does not appear.** A small honest number that needs arithmetic to read was found to fail.
7. **Outcomes are said as worth, not counts.** "Six things are worth your time", "two can wait". Not "6 of 10 asks used".
8. **The copy states what was and wasn't done.** "Stopped by you. Nothing after 'Reproduce' ran; 0 of 3 steps are kept." "Released early. Nothing was sent."
9. **A reason is given when something waits.** "Small, and its agent works around it."
10. **Agents are given no feelings.** No "I'm excited", "I missed you", "Great question!". Agents report facts.
11. **No "main session", no "AI-powered", no "smart".** The design is left to show what something is.
12. **Speakers are named by role.** "Coordinator", "billing-api coordinator", "billing-api agent". Persona names were ruled out.
13. **Placeholders are neutral.** "e.g. what it should try instead", not "e.g. Stop doing that wrong thing".
14. **Commands, paths, branches and rule sentences are set in mono**, exactly as they will run.
15. **Shortcut hints are kept out of body copy.** Shortcuts appear in tooltips ("Allow (A)") and the "?" sheet.

## 3. A phrasebook from the shipped UI

**Home**
- "Good morning." / "Good evening." / "Working late." / "Welcome back."
- "One thing is worth your time." / "Three things are worth your time." / "Nothing needs you."
- "Your next move" · "Then" · "Found while working" · "Handled · 4 working · 2 can wait"
- "About 1 h of agent work waits on this" · "Suggests **Allow** · fairly sure"
- "Glance ~5 s" · "Decide ~1 min" · "Think needs focus"
- "Clear 3 glances together" · "+2 more" · "2 later today · bring back"
- "**Nothing needs you.** 4 threads working. They'll ask when it's worth it."
- "Start something below, or enjoy the quiet."

**Deciding**
- "Needs you · 2 of 6"
- "Skip freely; nothing here is forced first."
- "Can't be undone · Writes 61M rows · about 4.1 h · ~$38 of compute · can't pause half-way"
- "Hold to allow" → "Keep holding…" → "Allowed"
- "A beat to read it first." · "Released early. Nothing was sent."
- "What should it do instead? (optional)"
- "3rd time this week · make it a rule?"
- "Added to your rules, word for word:"
- "**Allowed.** It's back at work." · "**Sent back.** It's taking another route."
- "Undone. Nothing was sent; the ask is back."
- "**25 minutes of deciding.** Attention dips after about 25. 4 left, nothing urgent; they'll hold."
- "**That's everything.**"

**Sending and status**
- "→ New work for **billing-api**" · "Reply in **this thread**" · "× No project called **x**"
- "Sent to billing-api · waiting for a thread"
- "The coordinator is replying"
- "Retry soft declines finished" · "billing-api · worth a look"
- "Stopped. I didn't start anything; your message is kept above if you want to send it again."

**The day boundary (Demo)**
- "Before you go" · "Queue up to three things to run overnight. You'll see what got done in the morning."
- "By morning **about 12–18 steps** · two likely to finish *estimate*"
- "Answer two asks first and about 4 more steps can run"
- "Seal the day" · "Notifications stay quiet until 9:00. Asks wait safely."
- "**Nothing needs you until morning.** Close the lid; the agents keep working."
- "Three is the most for one night. Remove one to swap it."

**When things go wrong**
- "**Can't reach XO.** Retrying every few seconds. Nothing you write is lost; sending waits until it's back."
- "Can't reach XO · retrying · what you see may be out of date"
- "Sending is paused · The router is off"
- "Didn't reach the agent: {title}. It's back in your list."
- "There's already a project called 'billing-api'. Pick another name."
- "Choosing a model here needs the backend's intelligence API (R6). Nothing is changed from this panel yet."

## 4. Copy that was cut, and why

| Cut | Why |
|---|---|
| "main session" | Found redundant; the label added words and no information |
| "Goes to the workspace coordinator, which routes it to the right project." (Home) | Found unnecessary on Home; the target line says it in context |
| "Plant" / "planting" | Not understood |
| "Five warm contexts will cool · about $0.06 to reload" | Jargon |
| "3 of 10 asks left today" | A visible budget; found to idle agents or hide work |
| "You freed ~3.9 agent-h" | Not measured |
| "Asks per agent-hour" | Not understood in review; the metric needed explanation to read at all |
| Long morning briefs and "Shipped today" lists | Too much text; works against the one-idea-per-line decision |
| "A reply reopens a resolved thread" | Untrue; corrected to "Resolved. Replies still reach its agent, but the thread stays resolved." |
| "A new folder" | "A new project" |

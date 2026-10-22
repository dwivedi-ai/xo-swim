// Storm's review items (UI-reference §2.4, §3 Item) as the Decision Kit shows them. Pure: no DOM,
// no fetch. The UI owns no decision logic: every answer, its label, its scope, its rule sentence
// and whether it needs a hold come from the item's own `options`; this module only sorts them into
// the card's places (the main answer, the "no", the rule choices) and builds the request body.

/** The decisions that say "go ahead" vs the ones that say "not this" (UI-reference §2.4). */
const YES = new Set(["allow", "approve", "done", "continue", "answer"]);
const NO = new Set(["deny", "send_back", "cant", "wait"]);

/** How the person's answer reads afterwards ("Allowed · npm test"). */
export const VERB = { allow: "Allowed", deny: "Denied", answer: "Answered", approve: "Approved", send_back: "Sent back", done: "Done", cant: "Can't do it", continue: "Continued", wait: "Waiting" };

/**
 * Sort an item's options into the card's places.
 *  primary: the main "yes" (Allow once, Approve, Done, Allow, Continue…, Seen)
 *  back:    the "no" (Deny, Send back, Can't, Wait, Dismiss), with whether it takes a note
 *  scopes:  the wider allows of a permission (this thread, rules), each with the server's sentence
 *  hold:    the primary needs a press-and-hold (a destructive item, or an option that asks for it)
 */
export function itemParts(item) {
  const opts = Array.isArray(item && item.options) ? item.options : [];
  const scopes = opts.filter((o) => o.decision === "allow" && (o.scope === "thread" || o.scope === "rule"));
  const primary = opts.find((o) => YES.has(o.decision) && !scopes.includes(o)) || null;
  const back = opts.find((o) => NO.has(o.decision)) || null;
  // a hold for any "yes" to a destructive item (allow, approve, done, answer…) and for an option that
  // asks for one (the 20-denials suggestion's "Pause it"); UI-reference §4.3 #2
  const hold = !!(primary && (primary.hold_to_confirm || (item.risk === "destructive" && YES.has(primary.decision))));
  return { primary, back, scopes, hold, why: (primary && primary.why) || null };
}

/** The hold button's words: "Hold to allow", "Hold to approve", "Hold to pause it"… */
export function holdWords(primary) {
  const d = primary && primary.decision;
  const fixed = { allow: "Hold to allow", approve: "Hold to approve", done: "Hold to confirm", continue: "Hold to continue", answer: "Hold to answer" };
  if (fixed[d] && (d !== "approve" || !primary.label || /^approve$/i.test(primary.label))) return fixed[d];
  return `Hold to ${String((primary && primary.label) || "confirm").replace(/^\w/, (c) => c.toLowerCase())}`;
}

/** A question item's questions: [{id, header, question, options: [{label, description}], multi, secret}]. */
export function questionsOf(item) {
  const q = item && item.detail && Array.isArray(item.detail.questions) ? item.detail.questions : [];
  return q.map((x, i) => ({ id: x.id || String(i), header: x.header || "", question: x.question || item.title || "", options: Array.isArray(x.options) ? x.options : [], multi: !!x.multi, secret: !!x.secret }));
}

/**
 * The request body for a decision (without the idempotency key, added when it is sent).
 * choice: "allow" | "deny" | {scope: option} | {option: label} | {answers: {id: str|[str]}} | {text} | {name}
 * note: the person's words for a "no" that takes one.
 */
export function itemBody(item, choice, note = "") {
  const { primary, back, scopes } = itemParts(item);
  note = String(note || "").trim();
  if (choice === "deny" || (choice && choice.no)) {
    if (!back) throw new Error("This item has no way to say no.");
    const body = { decision: back.decision };
    if (note && back.note) body.note = note.slice(0, 4000);
    return body;
  }
  if (choice && choice.scope) {
    const o = scopes.find((x) => x.id === choice.scope.id);
    if (!o) throw new Error("That choice isn't offered for this item.");
    if (o.scope === "thread") return { decision: "allow", scope: "thread" };
    return { decision: "allow", option: o.id, rule_sentence: o.sentence };
  }
  if (item.kind === "question") {
    if (choice && choice.answers) return { decision: "answer", answer: choice.answers };
    if (choice && choice.option != null) return { decision: "answer", option: String(choice.option).slice(0, 200) };
    if (choice && choice.text != null) return { decision: "answer", answer: String(choice.text) };
    throw new Error("Pick an answer or reply in words.");
  }
  if (item.kind === "create_project" && choice && choice.name != null) {
    const name = String(choice.name).trim();
    return name ? { decision: "allow", answer: name } : { decision: "allow" };
  }
  // only a question takes words or an option; anything else is its own "yes" or "no", never a guess
  if (choice !== "allow") throw new Error("This one is answered with its buttons, not in words.");
  if (!primary) throw new Error("This item has no answer to give.");
  return { decision: primary.decision };
}

/** Is this body a "no"? (the card's stamp and tone) */
export const isNo = (body) => NO.has(body && body.decision);

/** How much attention an item needs: glance (a few seconds), decide (about a minute), think. */
export function itemEffort(item) {
  if (item.risk === "destructive") return "think";
  if (item.kind === "integrity" || item.kind === "usage" || item.kind === "suggestion") return "glance";
  if (item.kind === "action") return "think";
  if (item.kind === "permission") return item.risk === "routine" ? "glance" : "decide";
  if (item.kind === "approval" && item.detail && item.detail.plan) return "think";
  return "decide";
}

/**
 * The exact things to show under Details, from the item's own detail (never prose of ours):
 * [{label, lang, text}] blocks plus plain facts.
 */
export function evidenceOf(item) {
  const d = (item && item.detail) || {};
  const blocks = [];
  const facts = [];
  if (d.command) blocks.push({ label: "Command", lang: "sh", text: String(d.command) });
  if (d.diff) blocks.push({ label: "Change", lang: "diff", text: String(d.diff) });
  if (Array.isArray(d.paths) && d.paths.length) blocks.push({ label: d.paths.length === 1 ? "File" : "Files", lang: "txt", text: d.paths.join("\n") });
  if (d.url) blocks.push({ label: "Address", lang: "txt", text: String(d.url) });
  if (d.mcp) blocks.push({ label: "Tool", lang: "txt", text: typeof d.mcp === "string" ? d.mcp : `${d.mcp.server || ""}/${d.mcp.tool || ""}` });
  if (d.plan) blocks.push({ label: "The plan", lang: "md", text: String(d.plan) });
  if (d.text) blocks.push({ label: "From the agent", lang: "md", text: String(d.text) });
  if (item.kind === "create_project") {
    if (d.purpose) facts.push(`For: ${d.purpose}`);
    if (d.why_new) facts.push(`Why a new project: ${d.why_new}`);
    if (d.first_task) facts.push(`First task: ${d.first_task}`);
    if (d.suggestion && d.suggestion.forward_to) facts.push(`Or send it to ${d.suggestion.forward_to} instead`);
  }
  if (item.kind === "create_job") {
    if (d.schedule) facts.push(`When: ${d.schedule}`);
    if (d.project) facts.push(`In: ${d.project}`);
    const j = d.job || {};
    if (j.agent || j.model || j.effort) facts.push(`With: ${[j.agent, j.model, j.effort].filter(Boolean).join(" · ")}`);
    if (j.prompt || d.text) blocks.push({ label: "What it will do each time", lang: "md", text: String(j.prompt || d.text) });
  }
  if (item.kind === "integrity") {
    if (d.failed) facts.push(`The check couldn't run: ${d.reason || "unknown reason"}`);
    for (const c of (d.changes || []).slice(0, 20)) blocks.push({ label: c.path || "changed file", lang: "diff", text: String(c.diff || c.summary || c.change || "") });
    if (d.more) facts.push(`${d.more} more changed`);
  }
  if (item.kind === "usage" && d.resets_at) facts.push(`Your plan resets at ${d.resets_at}`);
  if (item.risk_reasons && item.risk_reasons.length) facts.push(...item.risk_reasons.map((r) => r.charAt(0).toUpperCase() + r.slice(1)));
  if (item.parked) facts.push("Parked: the agent was told to wait; an answer wakes it");
  return { blocks, facts };
}

/** Where a review item lives when it has no thread: its chat, or the person's account (usage). */
export function hostOf(item) {
  if (item.thread_ts) return null;
  if (item.kind === "usage") return { id: `pool:${(item.detail && item.detail.pool) || "account"}`, chat: null, title: "Your agent account" };
  if (item.chat_id) return { id: `chat:${item.chat_id}`, chat: item.chat_id, title: null };
  if (item.session_id) return { id: `session:${item.session_id}`, chat: null, session: item.session_id, title: "A plain chat" };
  return { id: `item:${item.id}`, chat: null, title: "XO" };
}

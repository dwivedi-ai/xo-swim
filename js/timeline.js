// Live mode: pure helpers between the projects-chat API rows and the UI's
// message and ask shapes. No DOM, no fetch: tested from Node
// (tests/logic.test.mjs).

export const AWAIT_MAX_MS = 180000;
const WAITING = (s) => s === "needs_reply" || s === "needs_approval";

/** True while we sent something and no reply has come yet (capped at 3 min). */
export const awaitingNow = (aw, now = Date.now()) => !!aw && now - aw.at < AWAIT_MAX_MS;

/** An API message row → the UI's message: {id, at, who: you|coord|agent|system, text, fwd}. */
export function uiMsg(row) {
  const who = row.author_kind === "owner" ? "you"
    : row.author_kind === "system" ? "system"
      : row.author_id === "coordinator" ? "coord" : "agent";
  const f = row.forwarded_from;
  return {
    id: row.id,
    at: Date.parse(row.written_at || row.ts) || 0,
    who,
    text: String(row.text ?? ""),
    fwd: f && f.message_id ? { chatId: f.chat_id || null, id: f.message_id } : null,
  };
}

/**
 * Optimistic rows whose server copy is already in `rows` (the stream can beat
 * the POST). Returns Map(localId → serverId). A server row is used once, and
 * only if no other local row claimed it (`taken`).
 */
export function echoes(locals, rows, taken = new Set()) {
  const out = new Map();
  const free = rows.filter((r) => r.who === "you" && !taken.has(r.id));
  for (const m of locals) {
    if (m.merged || m.status === "failed" || m.who !== "you") continue;
    const i = free.findIndex((r) => r.text === m.text && r.at >= m.at - 60000);
    if (i < 0) continue;
    out.set(m.id, free[i].id);
    free.splice(i, 1);
  }
  return out;
}

/** Plain text for a title: no markdown marks, links keep their words. */
export function plainText(md) {
  return String(md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a message into a short title (its first sentence, ≤ max) and the rest. */
export function askText(md, max = 140) {
  const s = plainText(md);
  if (!s) return { title: "", rest: "" };
  const m = /^(.{12,}?[.?!:])(\s|$)/.exec(s);
  let title;
  if (m && m[1].length <= max) title = m[1].replace(/:$/, ".");
  else if (s.length <= max) title = s;
  else title = s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
  const used = m && m[1].length <= max ? m[1].length : title.replace(/…$/, "").length;
  return { title, rest: s.slice(used).trim() };
}

/**
 * The live ask for a thread that waits on the person. The backend's card has
 * no `needs_you` (always ""), so the ask is the thread agent's last message
 * (else the card's `happened`). It is a question with no invented options:
 * the answer is a reply in words. The id carries the card's epoch / update
 * time, so a new ask on the same thread is a new key and reappears.
 */
export function liveAsks(t, lastAgentText) {
  if (!WAITING(t.state)) return [];
  const full = String(lastAgentText || t.happened || "").trim();
  const { title, rest } = askText(full);
  const approval = t.state === "needs_approval";
  return [{
    id: `${t.id}:${t.epoch ?? t.cardAt ?? "0"}`,
    kind: approval ? "approval" : "question",
    title: title || "It's waiting for your reply",
    detail: rest.length > 220 ? rest.slice(0, 219).replace(/\s+\S*$/, "") + "…" : rest,
    full,
    risk: "notable",
    options: null,
    replyOnly: !approval,
    live: true,
  }];
}

/**
 * Where each thread's card sits in a timeline. A thread is rooted on a
 * timeline row (thread ts = row id). Its card goes under the coordinator's
 * first reply after that root (within the next few rows, before another
 * root); otherwise it stands alone right after the root.
 * Returns Map(rowId → [threadId…]) and the set of roots placed standalone.
 */
export function threadAnchors(msgs, threadIds) {
  const ids = new Set(threadIds);
  const on = new Map();
  const alone = new Set();
  msgs.forEach((m, i) => {
    if (!ids.has(m.id)) return;
    let at = null;
    for (let j = i + 1; j < Math.min(msgs.length, i + 4); j++) {
      const n = msgs[j];
      if (ids.has(n.id)) break;
      if (n.who === "coord") { at = n.id; break; }
    }
    if (at) on.set(at, [...(on.get(at) || []), m.id]);
    else alone.add(m.id);
  });
  return { on, alone };
}

/**
 * The composer's @target. Only a token that names a known project (or the
 * Workspace) is a target; anything else is left in the text and reported.
 * Returns {pid, token, unknown}.
 */
export function parseTarget(text, projects) {
  const m = /(^|\s)@([\w.-]+)/.exec(String(text || ""));
  if (!m) return { pid: null, token: null, unknown: null };
  const q = m[2].toLowerCase();
  const p = (projects || []).find((x) => x.id.toLowerCase() === q || String(x.name || "").toLowerCase() === q);
  return p ? { pid: p.id, token: m[2], unknown: null } : { pid: null, token: null, unknown: m[2] };
}

/** Remove the @token that matched (and only that one). */
export function stripTarget(text, token) {
  if (!token) return String(text || "").trim();
  const re = new RegExp(`(^|\\s)@${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.-])\\s?`);
  return String(text || "").replace(re, "$1").trim();
}

/** Classic's titles for a failed send. */
export function sendErrorTitle(err) {
  if (!err) return "Message not sent";
  if (err.code === "router_off") return "Router is off";
  if (err.status === 501) return "Not supported by this backend";
  if (err.status === 403) return "Refused by the proxy";
  if (err.status === 0 || err.status === 502) return "Can't reach XO";
  return "Message not sent";
}

/** The honest connection line, or null when all is well. */
export function connLine(status, statusError, error) {
  if (statusError || error) return { kind: "down", text: "Can't reach XO", sub: "retrying · what you see may be out of date" };
  if (!status) return null;
  if (!status.supported) return { kind: "off", text: "This backend has no projects chat", sub: `${status.agent || "the current"} agent · sending is off` };
  if (!status.enabled) return { kind: "off", text: "The router is off", sub: "XO_ROUTER_MODE=off · sending is paused" };
  return null;
}

/** Run `fn` over `items`, at most `cap` at a time. */
export async function mapLimit(items, cap, fn) {
  const list = [...items];
  const run = async () => { while (list.length) await fn(list.shift()); };
  await Promise.all(Array.from({ length: Math.min(cap, list.length) }, run));
}

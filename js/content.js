// Converged · what each ask costs you, what it frees, why it is next, and
// the evidence behind it.
//
// Every ask carries an effort label (Glance ~5 s, Decide ~1 min, Think,
// needs focus) and a leverage estimate: the agent time one answer frees.
// The coordinator ranks asks by how much work a second of you buys
// (leverage ÷ effort). Destructive asks are Think, set apart and never
// forced first. Leverage is steps-left × a typical step.
import * as Kit from "./kit.js";

export const EFFORT = {
  glance: { label: "Glance", time: "~5 s", secs: 5, long: "a 5-second glance", you: "5 s of you" },
  decide: { label: "Decide", time: "~1 min", secs: 60, long: "a one-minute decision", you: "1 min of you" },
  think: { label: "Think", time: "needs focus", secs: 300, long: "something that needs your focus", you: "a focused few minutes" },
};
const ERANK = { glance: 0, decide: 1, think: 2 };

/** How much of you an ask takes. */
export function effortOf(n) {
  if (n.group === "stopped") return "decide";
  const a = n.ask;
  if (n.risk === "destructive") return "think";
  if (a.kind === "action") return "think";
  if (Kit.isBinary(a)) return n.risk === "routine" ? "glance" : "decide";
  if (Array.isArray(a.options) && a.options.length && n.risk === "routine") return "glance";
  return "decide";
}

// ── leverage: agent time one answer frees ───────────────────────────────────
/** { min, steps } of agent work an answer frees (estimate). */
export function leverageOf(n) {
  const left = Math.max(1, n.t.checklist.total - n.t.checklist.done);
  if (n.group === "stopped") return { min: left * 24 + 20, steps: left };
  return { min: left * 21, steps: left };
}
export const fmtMin = (m) => (m < 60 ? `${Math.max(1, Math.round(m))} min` : `${(m / 60).toFixed(m < 600 ? 1 : 0).replace(/\.0$/, "")} h`);
/** A clearly labelled estimate, never a precise "freed" claim. */
export function estLine(n) {
  // No pace history yet, so no minutes or hours: only what the checklist really says.
  const left = n.t.checklist.total - n.t.checklist.done;
  if (!n.t.checklist.total || left <= 0) return "";
  return `${left} ${left === 1 ? "step" : "steps"} left in its checklist`;
}
export const fmtAgent = (m) => (m < 60 ? `~${Math.max(1, Math.round(m))} agent-min` : `~${(m / 60).toFixed(1).replace(/\.0$/, "")} agent-h`);

/** The bid: agent time bought per second of you. Higher wins a slot. */
export const bidOf = (n) => n.lev.min / EFFORT[n.effort].secs;

/** Order inside today's budget: best trade first; destructive always last; later after. */
export function rank(items) {
  return items.slice().sort((x, y) =>
    (x.risk === "destructive") - (y.risk === "destructive") ||
    (x.later ? 1 : 0) - (y.later ? 1 : 0) ||
    ERANK[x.effort] - ERANK[y.effort] ||
    bidOf(y) - bidOf(x) ||
    x.since - y.since);
}

/** A suggested answer, or null. Only the server's own words appear on a card, so none yet. */
export function suggestFor() { return null; }

/** The one line under the headline. Short, never a paragraph. */
export function whyLine(n) {
  if (n.group === "stopped") { const w = String(n.t.happened || "It stopped.").replace(/^Stopped:\s*/i, ""); return w.charAt(0).toUpperCase() + w.slice(1); }
  return n.ask.detail || "";
}

/** The evidence behind an ask: the server's own detail (js/review.js has a storm item's). */
export function evidenceFor(n) {
  const a = n.ask, t = n.t;
  return { change: null, facts: [], preview: null, why: a.full || a.detail || t.happened || "The agent is waiting on you before it continues." };
}

// Converged · what each ask costs you, what it frees, why it is next, and
// the evidence behind it.
//
// Every ask carries an effort label (Glance ~5 s, Decide ~1 min, Think,
// needs focus) and a leverage estimate: the agent time one answer frees.
// The coordinator ranks asks by how much work a second of you buys
// (leverage ÷ effort). Destructive asks are Think, set apart and never
// forced first. The demo numbers are hand-written where we know the
// thread; otherwise they're steps-left × a typical step.
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
const KNOWN = [
  { re: /p-retry/i, min: 96, steps: 3 },
  { re: /disabled text/i, min: 22, steps: 1 },
  { re: /interview recordings/i, min: 70, steps: 2 },
  { re: /backfill/i, min: 246, steps: 1 },
  { re: /^run:\s*npm test/i, min: 14, steps: 1 },
  { re: /pricing table/i, min: 18, steps: 1 },
  { re: /bloom pass/i, min: 9, steps: 1 },
];
/** { min, steps } of agent work an answer frees (estimate). */
export function leverageOf(n) {
  const k = n.ask.live ? null : KNOWN.find((x) => x.re.test(n.ask.title || ""));
  if (k) return { min: k.min, steps: k.steps };
  const left = Math.max(1, n.t.checklist.total - n.t.checklist.done);
  if (n.group === "stopped") return { min: left * 24 + 20, steps: left };
  return { min: left * 21, steps: left };
}
export const fmtMin = (m) => (m < 60 ? `${Math.max(1, Math.round(m))} min` : `${(m / 60).toFixed(m < 600 ? 1 : 0).replace(/\.0$/, "")} h`);
/** A clearly labelled estimate, never a precise "freed" claim. */
export function estLine(n) {
  // Live: no pace history yet, so no minutes or hours: only what the checklist really says.
  if (n.t.live) {
    const left = n.t.checklist.total - n.t.checklist.done;
    if (!n.t.checklist.total || left <= 0) return "";
    return `${left} ${left === 1 ? "step" : "steps"} left in its checklist`;
  }
  const m = n.lev.min;
  const amt = m < 50 ? `about ${Math.max(5, Math.round(m / 5) * 5)} min` : m < 90 ? "about 1 h" : `about ${Math.round(m / 60 * 2) / 2} h`.replace(".0 h", " h");
  if (n.group === "stopped") return `${cap(amt)} of agent work is stopped behind this`;
  return `${cap(amt)} of agent work waits on this`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
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


// ── the coordinator's suggestion (from 12 · Breakpoints): never pre-selected, never sent ──
const SUGGEST = [
  { re: /npm install p-retry/i, label: "Allow", why: "MIT, no dependencies; the alternative is ~80 lines of hand-rolled backoff.", sure: "fairly sure" },
  { re: /^Run: npm test/i, label: "Allow", why: "Read-only test run inside the project folder.", sure: "sure" },
  { re: /Disabled text/i, label: "Muted grey", why: "Keeps 4.6:1 contrast; 38% fails on two of the 42 screens.", sure: "fairly sure" },
  { re: /keep it simple or make it configurable/i, label: "Simple", why: "Simple ships today; nothing asks for configuration yet.", sure: "a judgement call" },
  { re: /pricing table/i, label: "Annual first", why: "Your other pages lead with annual; it reads as the default.", sure: "a judgement call" },
  { re: /bloom pass/i, label: "Skip it", why: "2 ms a frame is a lot on older phones; the disk reads fine without it.", sure: "fairly sure" },
];
/** Suggested answer, or null. Destructive and stopped asks never get one. */
export function suggestFor(n) {
  // Live asks never get a demo suggestion: only the server's own words appear there.
  if (n.ask.live || n.t.live || n.risk === "destructive" || n.group === "stopped") return null;
  const s = SUGGEST.find((x) => x.re.test(n.ask.title || ""));
  return s ? { label: s.label, why: s.why, sure: s.sure } : null;
}

/** The one line under the headline. Short, never a paragraph. */
export function whyLine(n) {
  if (n.group === "stopped") { const w = String(n.t.happened || "It stopped.").replace(/^Stopped:\s*/i, ""); return w.charAt(0).toUpperCase() + w.slice(1); }
  if (n.ask.live) return n.ask.detail || "";
  if (/p-retry/.test(n.ask.title)) return "One small dependency for retries with backoff.";
  if (/disabled text/i.test(n.ask.title)) return "38% matches iOS; muted grey keeps 4.6:1 contrast.";
  if (/interview recordings/i.test(n.ask.title)) return "It has 6 of 9; the themes would skew without the rest.";
  return n.ask.detail || "";
}

/** Demo evidence: the exact change, the plain consequences, a preview. The backend would supply these. */
export function evidenceFor(n) {
  const a = n.ask, t = n.t, title = a.title || "";
  const ev = { change: null, facts: [], preview: null, why: a.full || a.detail || t.happened || "The agent is waiting on you before it continues." };
  if (a.live) return ev; // live evidence is the server's own detail (js/review.js), never demo content
  if (/p-retry/.test(title)) {
    ev.change = { label: "package.json", lang: "diff", text: ` "dependencies": {\n   "stripe": "^12.0.0",\n+  "p-retry": "^6.2.0",\n   "zod": "^3.23.8"\n }` };
    ev.facts = ["1 dependency", "MIT", "0 transitive deps", "12 kB"];
    ev.why = "Soft declines need retries with exponential backoff and jitter. p-retry does that in 12 kB; the alternative is about 80 lines of retry code to maintain.";
  } else if (/^run:\s*npm test/i.test(title)) {
    ev.change = { label: "command", lang: "sh", text: `$ ${Kit.commandOf(a)}` };
    ev.facts = ["read-only", "writes nothing", "~40 s"];
    ev.why = "It wants to confirm the step it just finished before moving on. Nothing is written.";
  } else if (/backfill/i.test(title)) {
    ev.change = { label: "command", lang: "sh", text: "$ etl backfill --table events_2025 \\\n    --from 2025-01-01 --to 2025-12-31 --batch 50000" };
    ev.facts = ["Writes 61M rows", "about 4.1 h", "~$38 of compute", "can't pause half-way"];
    ev.why = "You asked to hold it until you'd seen the cost. The dry run on 2025-06-01 matched production within 0.02%; this is the full year.";
  } else if (/disabled text/i.test(title)) {
    ev.preview = [
      { label: "Dim to 38%", css: "opacity:.38", sample: "Aa" },
      { label: "Muted grey", css: "color:#878787", sample: "Aa" },
    ];
    ev.why = "38% opacity matches iOS but drops to 3.1:1 on two dark surfaces. The muted grey keeps 4.6:1 everywhere.";
  } else if (/interview recordings/i.test(title)) {
    ev.change = { label: "missing files", lang: "txt", text: "research/interviews/interview-07.m4a\nresearch/interviews/interview-08.m4a\nresearch/interviews/interview-09.m4a" };
    ev.why = "Themes from 6 of 9 interviews would skew towards the first cohort. With all 9 it can finish the brief.";
  } else if (n.group === "stopped") {
    ev.change = { label: "last output", lang: "log", text: `${String(t.happened || "").replace(/^Stopped:\s*/i, "Error: ")}\n  at step ${t.checklist.done + 1} of ${t.checklist.total}` };
    ev.why = `It stopped while working on “${(t.checklist.items.find((i) => i.state !== "done") || {}).text || t.title}”. Nothing was changed after the error.`;
  } else if (Kit.commandOf(a)) {
    ev.change = { label: "command", lang: "sh", text: `$ ${Kit.commandOf(a)}` };
  }
  return ev;
}

// ── demo: small asks the coordinator holds quietly at boot (pacing, invisible) ──
// They sit on threads that keep working around them, so nothing idles for them.
export const HELD_SEED = [
  { thread: /cent drift/i, ask: { kind: "permission", title: "Run: npm test -- billing-api", detail: "Read-only test run in the project folder.", risk: "routine" } },
  { thread: /accretion/i, ask: { kind: "question", title: "Add a bloom pass to the disk?", detail: "Looks richer; costs ~2 ms a frame on older phones.", risk: "routine", options: ["Add bloom", "Skip it"] } },
];

// ── Found value: things agents noticed while working (demo, hand-written) ──
// kind: find (graded notable | rare) · ripe (an old todo that became cheap) · deja (a cross-project pattern)
export const FINDS = [
  { id: "f-shaders", kind: "find", grade: "rare", project: "blackhole", from: "Add an accretion-disk animation",
    title: "The CDN serves the shaders uncompressed",
    line: "1.4 MB per visit; 210 KB with brotli.",
    value: "−1.2 MB per visit", ask: "Turn on brotli for the shader assets on the CDN and verify the transfer size." , at: -48 },
  { id: "f-csv", kind: "ripe", project: "billing-api", from: "Upgrade stripe SDK to v12", age: 94,
    title: "Export invoices to CSV",
    line: "94 days old; now ~4 min of work.",
    proof: "src/export/serialize.ts", value: "closes a 94-day loop", ask: "Export invoices to CSV using the new serializer in src/export/serialize.ts.", at: -20 },
  { id: "f-retry", kind: "deja", projects: ["billing-api", "mobile-app", "data-pipeline"], project: "workspace",
    title: "Retry logic, written three times",
    line: "One shared module would do.",
    value: "one module instead of three", ask: "Extract a shared retry-with-backoff module used by billing-api, mobile-app and data-pipeline.", at: null },
];

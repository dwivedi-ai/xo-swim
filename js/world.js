// The world the UI renders: projects, threads and what needs you, normalised
// from XO Space's storm API ("live", js/storm.js) or from a simulated busy
// workspace ("demo"). Views never call the API directly; they subscribe to the
// world and call world.act.*.
//
//   import { createWorld } from "./world.js";
//   const world = createWorld();          // mode from ?mode=live|demo, else localStorage, else <html data-mode> (live)
//   world.subscribe((w) => render(w));    // every change
//   world.onEvent((e) => pulse(e));       // discrete events (state change, new ask, message, done)
//   world.act.reply(threadId, "yes");     // live: posts to the thread; demo: simulated
//
// Live mode only READS on its own (GETs and the one global stream). It writes
// only when the person acts (send, reply, resolve, decide).

import { stormSource } from "./storm.js";

const DEMO_TICK_MS = 2600;

export const STATES = ["needs_approval", "needs_reply", "paused", "failed", "working", "done", "resolved"];
// paused (storm's loop breaker) waits on the person too: a reply in the thread resumes it.
export const WAITING = (s) => s === "needs_reply" || s === "needs_approval" || s === "paused";

function storeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function storeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

export function createWorld({ mode } = {}) {
  const url = new URL(location.href);
  const root = document.documentElement;
  const fallback = root.dataset.mode === "demo" ? "demo" : "live";
  mode = root.hasAttribute("data-mode-lock") ? fallback : mode || url.searchParams.get("mode") || storeGet("xo-mode") || fallback;
  if (mode !== "live" && mode !== "demo") mode = fallback;

  const subs = new Set();
  const evs = new Set();
  const state = { mode, projects: [], threads: [], activity: [], busy: {}, loaded: false, error: null, now: Date.now() };
  const emit = () => { state.now = Date.now(); for (const f of subs) f(state); };
  const event = (e) => {
    e.at = e.at || Date.now();
    state.activity.unshift(e);
    state.activity.length = Math.min(state.activity.length, 200);
    for (const f of evs) f(e, state);
  };

  const source = mode === "live" ? stormSource(state, emit, event) : demoSource(state, emit, event);

  return {
    get state() { return state; },
    mode,
    subscribe(fn) { subs.add(fn); if (state.loaded) fn(state); return () => subs.delete(fn); },
    onEvent(fn) { evs.add(fn); return () => evs.delete(fn); },
    setMode(m) { storeSet("xo-mode", m); const u = new URL(location.href); u.searchParams.set("mode", m); location.href = u.toString(); },
    act: source.act,
    thread: (id) => state.threads.find((t) => t.id === id),
    project: (id) => state.projects.find((p) => p.id === id),
    waiting: () => state.threads.filter((t) => WAITING(t.state)),
  };
}

// ── demo: a believable, busy workspace that evolves on its own ──────────────

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const DEMO_PROJECTS = [
  ["workspace", "Workspace", "workspace"],
  ["billing-api", "billing-api", "project"],
  ["mobile-app", "mobile-app", "project"],
  ["marketing-site", "marketing-site", "project"],
  ["data-pipeline", "data-pipeline", "project"],
  ["blackhole", "blackhole", "project"],
  ["research", "research", "project"],
];

const DEMO_THREADS = [
  // project, title, state, steps, needs you / ask, branch
  ["billing-api", "Retry soft declines with backoff", "needs_approval", ["Read retry.py and scheduler", "Add SoftDeclineRetry with backoff", "Tests for soft vs hard declines", "Shorten scheduler interval"], 3,
    { kind: "permission", title: "Run: npm install p-retry@6", detail: "Adds one dependency (p-retry 6.2, MIT, 0 deps) to billing-api.", risk: "notable" }, "xo/retry-soft-declines"],
  ["billing-api", "Fix cent drift in proration", "working", ["Reproduce drift", "Round once per invoice", "Update fixtures", "Run full suite"], 1, null, "xo/proration-rounding"],
  ["billing-api", "Upgrade stripe SDK to v12", "done", ["Bump SDK", "Fix 3 renamed fields", "Run full suite"], 3, null, "xo/stripe-v12"],
  ["mobile-app", "Offline mode for the inbox", "working", ["Map inbox data flows", "Cache last 200 items", "Queue writes while offline", "Conflict banner", "E2E on airplane mode"], 2, null, "xo/offline-inbox"],
  ["mobile-app", "Dark mode contrast pass", "needs_reply", ["Audit 42 screens", "Fix 11 failing pairs", "Pick a tone for disabled text"], 2,
    { kind: "question", title: "Disabled text: dim to 38% or use the muted grey?", detail: "38% matches iOS; muted grey keeps 4.6:1 contrast.", risk: "routine", options: ["Dim to 38%", "Muted grey", "Show me both"] }, "xo/dark-contrast"],
  ["marketing-site", "Launch page for xo-swim", "working", ["Draft copy", "Hero animation", "Pricing table", "SEO meta"], 1, null, "xo/launch-page"],
  ["marketing-site", "Remove 1.2 MB of unused CSS", "done", ["Find unused selectors", "Purge", "Visual diff 30 pages"], 3, null, "xo/css-diet"],
  ["data-pipeline", "Nightly job fails on DST change", "failed", ["Reproduce on 2026-03-29", "Patch cron parser"], 1,
    null, "xo/dst-fix"],
  ["data-pipeline", "Backfill 2025 events", "needs_approval", ["Estimate cost", "Dry run on 1 day", "Backfill 365 days"], 2,
    { kind: "permission", title: "Run backfill: ~4.1 h, ~$38 of compute", detail: "Writes 61M rows to events_2025. Dry run on 2025-06-01 matched within 0.02%.", risk: "destructive" }, "xo/backfill-2025"],
  ["blackhole", "Blackhole HTML page", "done", ["Check project folder", "Write blackholes.html", "Verify and report"], 3, null, null],
  ["blackhole", "Add an accretion-disk animation", "working", ["Sketch the shader", "Canvas fallback", "Reduced-motion still"], 0, null, null],
  ["research", "Summarise 12 papers on agent trust", "working", ["Collect papers", "Extract findings", "Write the brief"], 1, null, null],
  ["research", "Interview notes → themes", "needs_reply", ["Cluster 9 interviews", "Name themes", "Pick quotes"], 2,
    { kind: "action", title: "Upload the last 3 interview recordings", detail: "I only have 6 of 9. Drop them in research/interviews/.", risk: "routine", options: ["Done", "Skip them"] }, null],
  ["workspace", "Weekly digest across projects", "resolved", ["Gather", "Write"], 2, null, null],
];

const DEMO_SPAWNS = [
  ["mobile-app", "Crash on Android 15 share sheet", ["Reproduce", "Patch intent filter", "Ship hotfix build"]],
  ["billing-api", "Dunning email after 3rd failure", ["Find failure hooks", "Template", "Tests"]],
  ["marketing-site", "Compress hero video to < 2 MB", ["Re-encode AV1", "Poster frame", "Lazy-load"]],
  ["research", "Compare 5 vector DBs for memory", ["Shortlist", "Benchmark 1M vectors", "Write up"]],
  ["data-pipeline", "Alert when lag > 15 min", ["Metric", "Threshold", "Pager rule"]],
];

const DEMO_LINES = {
  working: ["Reading the code around it.", "Tests pass locally; checking edge cases.", "Found the cause; writing the fix.", "Halfway there.", "Refactoring one helper first."],
  done: ["Done. All tests pass; ready for your look.", "Finished and verified on a fresh build."],
  failed: ["Stopped: the staging database refused the connection.", "Stopped: a migration conflicts with yesterday's change."],
};

function demoSource(state, emit, event) {
  const r = rng(20261013);
  const now = Date.now();
  let n = 0;
  const id = () => `demo_${(++n).toString(36)}_${Math.floor(r() * 1e6).toString(36)}`;
  const mkList = (steps, done, doing = true) => {
    const items = steps.map((text, i) => ({ text, state: i < done ? "done" : i === done && doing ? "doing" : "todo" }));
    return { items, total: steps.length, done: Math.min(done, steps.length), doing: items.filter((i) => i.state === "doing").length };
  };

  state.projects = DEMO_PROJECTS.map(([id_, name, kind]) => ({ id: id_, name, kind }));
  state.threads = DEMO_THREADS.map(([project, title, st, steps, done, ask, branch], i) => {
    const t = {
      id: id(), project, title, state: st, headline: "", branch,
      happened: st === "done" ? DEMO_LINES.done[i % 2] : st === "failed" ? DEMO_LINES.failed[0] : DEMO_LINES.working[i % 5],
      needsYou: ask ? ask.title : "",
      createdAt: now - (60 + i * 37) * 60000,
      lastAt: now - (i * 7 + 1) * 60000,
      checklist: mkList(steps, done, st === "working" || WAITING(st)),
      messages: [
        { id: id(), at: now - (i * 7 + 30) * 60000, who: "you", text: title + "." },
        { id: id(), at: now - (i * 7 + 2) * 60000, who: "agent", text: st === "done" ? DEMO_LINES.done[0] : DEMO_LINES.working[i % 5] },
      ],
      asks: ask ? [{ id: id(), ...ask }] : [],
      _steps: steps,
    };
    if (st === "resolved" || st === "done") t.checklist = mkList(steps, steps.length, false);
    return t;
  });
  state.loaded = true;

  const touch = (t, line) => {
    t.lastAt = Date.now();
    if (line) { t.happened = line; t.messages.push({ id: id(), at: t.lastAt, who: "agent", text: line }); }
  };
  const setState = (t, s, kind = "state") => {
    t.state = s;
    event({ kind, thread: t.id, project: t.project, text: `${t.title}: ${s.replace("_", " ")}` });
  };
  const advance = (t) => {
    const c = t.checklist;
    if (c.done >= c.total) return;
    t.checklist = mkList(t._steps, c.done + 1, c.done + 1 < c.total);
    touch(t, `✓ ${t._steps[c.done]}`);
    event({ kind: "progress", thread: t.id, project: t.project, text: `${t.title}: ${t._steps[c.done]}` });
    if (t.checklist.done >= t.checklist.total) { touch(t, DEMO_LINES.done[0]); setState(t, "done", "done"); }
  };

  function tick() {
    if (document.hidden) return;
    const working = state.threads.filter((t) => t.state === "working");
    const roll = r();
    if (working.length && roll < 0.55) {
      advance(working[Math.floor(r() * working.length)]);
    } else if (working.length && roll < 0.68) {
      const t = working[Math.floor(r() * working.length)];
      const ask = r() < 0.5
        ? { id: id(), kind: "permission", title: `Run: npm test -- ${t.project}`, detail: "Read-only test run in the project folder.", risk: "routine" }
        : { id: id(), kind: "question", title: `${t._steps[Math.min(t.checklist.done, t._steps.length - 1)]}: keep it simple or make it configurable?`, detail: "Simple ships today; configurable takes ~1 h more.", risk: "routine", options: ["Simple", "Configurable"] };
      t.asks = [ask];
      t.needsYou = ask.title;
      touch(t, null);
      setState(t, ask.kind === "permission" ? "needs_approval" : "needs_reply", "ask");
    } else if (roll < 0.76 && DEMO_SPAWNS.length) {
      const [project, title, steps] = DEMO_SPAWNS.shift();
      const t = { id: id(), project, title, state: "working", headline: "", branch: `xo/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`, happened: "On it.", needsYou: "", createdAt: Date.now(), lastAt: Date.now(), checklist: mkList(steps, 0), messages: [{ id: id(), at: Date.now(), who: "agent", text: "On it." }], asks: [], _steps: steps };
      state.threads.unshift(t);
      event({ kind: "spawn", thread: t.id, project, text: `New thread: ${title}` });
    } else if (working.length) {
      const t = working[Math.floor(r() * working.length)];
      touch(t, DEMO_LINES.working[Math.floor(r() * DEMO_LINES.working.length)]);
      event({ kind: "heartbeat", thread: t.id, project: t.project, text: t.happened });
    }
    state.busy = Object.fromEntries(state.projects.map((p) => [p.id, state.threads.some((t) => t.project === p.id && t.state === "working")]));
    state.threads.sort((a, b) => b.lastAt - a.lastAt);
    emit();
  }
  const timer = setInterval(tick, DEMO_TICK_MS);
  queueMicrotask(emit);

  const resume = (t, note) => {
    t.asks = [];
    t.needsYou = "";
    touch(t, note);
    setState(t, "working", "resumed");
    setTimeout(() => { advance(t); emit(); }, 1400);
  };

  return {
    act: {
      live: false,
      reply: async (threadId, text) => {
        const t = state.threads.find((x) => x.id === threadId);
        if (!t) throw new Error("Unknown thread");
        t.messages.push({ id: id(), at: Date.now(), who: "you", text });
        event({ kind: "you", thread: t.id, project: t.project, text });
        if (WAITING(t.state)) resume(t, "Thanks, continuing.");
        else touch(t, "Got it.");
        emit();
      },
      decide: async (askId, decision, note = "") => {
        const t = state.threads.find((x) => x.asks.some((a) => a.id === askId));
        if (!t) throw new Error("Unknown request");
        const ask = t.asks.find((a) => a.id === askId);
        t.messages.push({ id: id(), at: Date.now(), who: "you", text: `${decision === "allow" ? "Approved" : "Not approved"}: ${ask.title}${note ? ` (${note})` : ""}` });
        event({ kind: "decision", thread: t.id, project: t.project, text: `${decision === "allow" ? "Approved" : "Sent back"}: ${ask.title}`, decision });
        resume(t, decision === "allow" ? "Approved, continuing." : `Understood, taking another route.${note ? " " + note : ""}`);
        emit();
      },
      ask: async (projectId, text) => {
        const project = projectId && projectId !== "workspace" ? projectId : DEMO_PROJECTS[1 + Math.floor(r() * (DEMO_PROJECTS.length - 1))][0];
        const steps = ["Understand the ask", "Do the work", "Verify", "Report back"];
        const t = { id: id(), project, title: text.length > 60 ? text.slice(0, 57) + "…" : text, state: "working", headline: "", branch: null, happened: "On it.", needsYou: "", createdAt: Date.now(), lastAt: Date.now(), checklist: mkList(steps, 0), messages: [{ id: id(), at: Date.now(), who: "you", text }, { id: id(), at: Date.now() + 1, who: "agent", text: "On it." }], asks: [], _steps: steps };
        state.threads.unshift(t);
        event({ kind: "you", thread: t.id, project, text });
        event({ kind: "spawn", thread: t.id, project, text: `New thread: ${t.title}` });
        emit();
        return t;
      },
      resolve: async (threadId) => {
        const t = state.threads.find((x) => x.id === threadId);
        if (t) { t.asks = []; t.needsYou = ""; setState(t, "resolved", "resolved"); emit(); }
      },
      refresh: async () => emit(),
      // live-only plumbing: the demo has no timelines or streams
      watch() {}, watchThread() {}, loadOlder() {}, replying: () => false, status() {},
    },
    stop: () => clearInterval(timer),
  };
}

// ── small helpers variants share ────────────────────────────────────────────

export function ago(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function esc(v) {
  return String(v ?? "").replace(/[&<>"'`]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" })[c]);
}

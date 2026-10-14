// The world every ux-test variant renders: projects, threads and what needs
// you, normalised from the XO projects-chat backend ("live") or from a
// simulated busy workspace ("demo"). Variants never call the API directly;
// they subscribe to the world and call world.act.*.
//
//   import { createWorld } from "./world.js";
//   const world = createWorld();          // mode from ?mode=live|demo, else localStorage, else <html data-mode> (live)
//   world.subscribe((w) => render(w));    // every change
//   world.onEvent((e) => pulse(e));       // discrete events (state change, new ask, message, done)
//   world.act.reply(threadId, "yes");     // live: posts to the thread; demo: simulated
//
// Live mode only READS on its own (GET polling, SSE for the open chat). It
// writes only when the person acts (reply, decide, ask), exactly like the
// main app.

import { api } from "./api.js";
import { parseChecklist, threadState, mergeMessages, lastId, hasReplyAfter, routedIndex } from "./model.js";
import { ChatStream } from "./stream.js";
import { uiMsg, liveAsks, awaitingNow, mapLimit } from "./timeline.js";

const LIVE_POLL_MS = 15000;      // every project's threads (the open chat streams)
const STATUS_POLL_MS = 20000;
const STATUS_RETRY_MS = 8000;
const DETAIL_BUSY_MS = 4000;     // an open thread whose agent is busy
const DETAIL_IDLE_MS = 15000;
const DETAIL_CAP = 6;            // parallel detail fetches
const HISTORY_FIRST = 40;
const HISTORY_MAX = 1000;
const DEMO_TICK_MS = 2600;

export const STATES = ["needs_approval", "needs_reply", "failed", "working", "done", "resolved"];
export const WAITING = (s) => s === "needs_reply" || s === "needs_approval";

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

  const source = mode === "live" ? liveSource(state, emit, event) : demoSource(state, emit, event);

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

// ── shared normalisation ────────────────────────────────────────────────────

/** A thread from the API (list row or detail), with its detail when we have it. */
function fromApi(chat, raw, d, awaiting) {
  const card = raw.card || {};
  const s = threadState(raw);
  const msgs = d ? (d.messages || []).map(uiMsg) : [];
  const agentMsgs = msgs.filter((m) => m.who === "agent");
  const lastAgent = agentMsgs[agentMsgs.length - 1] || [...msgs].reverse().find((m) => m.who !== "you") || null;
  const err = d && d.session && d.session.last_error;
  const t = {
    id: raw.ts,
    project: chat,
    title: raw.title || "Thread",
    state: s,
    headline: "",
    happened: (s === "failed" && err) || (lastAgent && lastAgent.text) || card.happened || "",
    needsYou: "",
    branch: raw.branch || null,
    createdAt: Date.parse(raw.created_at) || Date.now(),
    lastAt: Date.parse(raw.last_activity_at) || Date.now(),
    checklist: d && d.status != null ? parseChecklist(d.status) : { items: [], total: 0, done: 0, doing: 0 },
    messages: msgs,
    asks: [],
    live: true,
    loaded: !!d,
    // Working means really working: the session is busy, or we just wrote and wait for its answer.
    busy: d ? !!d.busy || awaitingNow(awaiting) : awaitingNow(awaiting) ? true : null,
    session: d ? d.session || null : null,
    epoch: card.epoch ?? null,
    cardAt: card.updated_at || null,
    resolvedAt: raw.resolved_at || null,
  };
  t.asks = liveAsks(t, lastAgent && lastAgent.text);
  t.needsYou = t.asks.length ? t.asks[0].title : "";
  return t;
}

// ── live: the real backend ──────────────────────────────────────────────────
// Reads on its own (GET): /status, the threads of every project, thread
// details, the open conversation's timeline and its SSE stream. Writes only
// when the person acts (reply, ask). Last good data is kept when a fetch fails.

function liveSource(state, emit, event) {
  Object.assign(state, {
    status: null, statusError: null, conn: null,
    timeline: {},   // chat → API rows, oldest first
    hist: {},       // chat → {all, loading, window, capped, error}
    coordBusy: {},  // chat → heartbeat coordinator_busy
    awaiting: {},   // chat → {id, at}: we wrote, no reply yet
    routed: {},     // workspace message id → [{chat, messageId}]
  });
  const lists = {};          // ts → {chat, raw, at}
  const det = {};            // ts → {…detail, messages (merged), at}
  const stamps = {};         // ts → what we last fetched the detail for
  const tAwait = {};         // ts → {id, at}
  const detInflight = new Map();
  const streams = new Map(); // chat → ChatStream (or a stub while loading)
  const projMsgs = {};
  let inflight = null, statusT = null, watched = null, watchT = null, routedBusy = null;

  const stampOf = (raw) => `${raw.last_activity_at}|${(raw.card || {}).updated_at || ""}|${raw.state}`;
  const rawOf = (ts) => {
    const L = lists[ts], D = det[ts];
    if (D && D.thread && D.at >= L.at) return { ...D.thread, card: D.card ?? L.raw.card };
    return L.raw;
  };

  /** Rebuild the thread list from what we know and announce real changes. */
  function commit() {
    const prev = new Map(state.threads.map((t) => [t.id, t]));
    const known = new Set(state.projects.map((p) => p.id));
    const next = [];
    for (const [ts, L] of Object.entries(lists)) {
      if (!known.has(L.chat)) continue;
      const t = fromApi(L.chat, rawOf(ts), det[ts], tAwait[ts]);
      const old = prev.get(ts);
      if (state.loaded) {
        if (old && old.state !== t.state) event({ kind: t.state === "done" ? "done" : WAITING(t.state) ? "ask" : "state", thread: t.id, project: t.project, text: `${t.title}: ${t.state.replace("_", " ")}` });
        if (!old) event({ kind: "spawn", thread: t.id, project: t.project, text: `New thread: ${t.title}` });
      }
      next.push(t);
    }
    state.threads = next.sort((a, b) => b.lastAt - a.lastAt);
  }
  let soonT = null;
  const soon = () => { clearTimeout(soonT); soonT = setTimeout(() => { commit(); emit(); }, 50); };

  async function fetchDetail(ts) {
    if (detInflight.has(ts)) return detInflight.get(ts);
    const p = (async () => {
      const L = lists[ts];
      if (!L) return;
      try {
        const d = await api.thread(L.chat, ts);
        const prev = det[ts];
        const msgs = mergeMessages(prev ? prev.messages : [], d.messages || []).list;
        det[ts] = { ...d, messages: msgs, at: Date.now() };
        stamps[ts] = stampOf(d.thread || L.raw);
        const aw = tAwait[ts];
        if (aw && hasReplyAfter(msgs, aw.id)) delete tAwait[ts];
      } catch (err) {
        if (err.status === 404) { delete lists[ts]; delete det[ts]; }
      }
      soon();
    })();
    detInflight.set(ts, p);
    try { await p; } finally { detInflight.delete(ts); }
  }

  /** Threads of every project. One at a time; a failed project keeps its last good threads. */
  function poll() {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const { chats } = await api.chats();
        state.projects = (chats || []).map((c) => ({ id: c.chat, name: c.chat === "workspace" ? "Workspace" : c.chat, kind: c.kind, hasChat: !!c.id }));
        state.error = null;
      } catch (err) {
        state.error = err.message;
        state.loaded = true;
        emit();
        return;
      }
      const need = [];
      await Promise.all(state.projects.map(async (p) => {
        let rows;
        try { rows = (await api.threads(p.id)).threads || []; } catch { return; /* keep the last good threads for p */ }
        const now = Date.now();
        const seen = new Set();
        for (const raw of rows) {
          seen.add(raw.ts);
          lists[raw.ts] = { chat: p.id, raw, at: now };
          const s = threadState(raw);
          if ((s !== "resolved" && stamps[raw.ts] !== stampOf(raw)) || s === "working") need.push(raw.ts);
        }
        for (const [ts, L] of Object.entries(lists)) if (L.chat === p.id && !seen.has(ts)) { delete lists[ts]; delete det[ts]; }
      }));
      commit();
      state.loaded = true;
      emit();
      // Details (checklist, messages, busy) in parallel, a few at a time; the lists already render.
      await mapLimit(need, DETAIL_CAP, fetchDetail);
      for (const c of [...streams.keys()]) if (state.hist[c]?.error) openStream(c);
    })();
    return inflight.finally(() => { inflight = null; });
  }

  async function loadStatus() {
    clearTimeout(statusT);
    const was = state.statusError;
    try { state.status = await api.status(); state.statusError = null; } catch (err) { state.statusError = err.message; }
    emit();
    if (was && !state.statusError) poll();
    statusT = setTimeout(loadStatus, state.statusError ? STATUS_RETRY_MS : STATUS_POLL_MS);
  }

  // ── timelines and streams ────────────────────────────────────────────────
  function mergeTimeline(chat, rows) {
    const { list, added } = mergeMessages(state.timeline[chat] || [], rows);
    state.timeline[chat] = list;
    const aw = state.awaiting[chat];
    if (aw && added.length && hasReplyAfter(added, aw.id)) delete state.awaiting[chat];
    return added;
  }
  function onMessages(chat, rows) {
    const aw = state.awaiting[chat];
    const added = mergeTimeline(chat, rows);
    if (!added.length) return;
    const answered = !!(aw && hasReplyAfter(added, aw.id));
    const replies = added.filter((r) => r.author_kind !== "owner");
    if (replies.length) {
      const last = replies[replies.length - 1];
      event({ kind: "message", project: chat, text: String(last.text || "").slice(0, 160), answered, author: last.author_id });
      if (chat === "workspace") { setTimeout(loadRouted, 1500); setTimeout(loadRouted, 12000); }
    }
    emit();
  }
  const detT = {};
  function onThread(chat, raw) {
    if (!raw || !raw.ts) return;
    lists[raw.ts] = { chat, raw, at: Date.now() };
    if (stamps[raw.ts] !== stampOf(raw) || watched === raw.ts) {
      clearTimeout(detT[raw.ts]);
      detT[raw.ts] = setTimeout(() => fetchDetail(raw.ts), 400);
    }
    soon();
  }
  async function loadTimeline(chat) {
    const h = state.hist[chat];
    try {
      if (h && !h.error) {
        const after = lastId(state.timeline[chat] || []);
        const d = await api.messages(chat, after ? { after } : { limit: HISTORY_FIRST });
        mergeTimeline(chat, d.messages || []);
      } else {
        state.hist[chat] = { all: false, loading: true, window: HISTORY_FIRST, capped: false, error: null };
        emit();
        const d = await api.messages(chat, { limit: HISTORY_FIRST });
        const rows = d.messages || [];
        mergeTimeline(chat, rows);
        state.hist[chat] = { all: rows.length < HISTORY_FIRST, loading: false, window: HISTORY_FIRST, capped: false, error: null };
      }
    } catch (err) {
      state.hist[chat] = { ...(state.hist[chat] || {}), loading: false, error: err.message };
    }
    emit();
  }
  /** Older messages: the API returns the newest N, so ask for a bigger window and merge by id. */
  async function loadOlder(chat) {
    const h = state.hist[chat];
    if (!h || h.all || h.loading || h.error) return;
    h.loading = true;
    emit();
    const have = (state.timeline[chat] || []).length;
    const want = Math.min(HISTORY_MAX, Math.max(h.window * 2, have + HISTORY_FIRST));
    try {
      const rows = (await api.messages(chat, { limit: want })).messages || [];
      mergeTimeline(chat, rows);
      h.window = want;
      h.all = rows.length < want || want >= HISTORY_MAX;
      h.capped = want >= HISTORY_MAX && rows.length >= HISTORY_MAX;
    } catch (err) { h.olderError = err.message; }
    h.loading = false;
    emit();
  }
  async function loadRouted() {
    if (routedBusy) return routedBusy;
    routedBusy = (async () => {
      await mapLimit(state.projects.filter((p) => p.kind === "project" && p.hasChat), DETAIL_CAP, async (p) => {
        try { projMsgs[p.id] = (await api.messages(p.id, { limit: 300 })).messages || []; } catch { /* keep what we had */ }
      });
      state.routed = routedIndex(projMsgs);
      emit();
    })();
    try { await routedBusy; } finally { routedBusy = null; }
  }
  function openStream(chat) {
    const stub = { close() { this.closed = true; } };
    streams.set(chat, stub);
    loadTimeline(chat).then(() => {
      // no stream until the timeline loads (a failed chat is retried by the next poll)
      if (stub.closed || streams.get(chat) !== stub || state.hist[chat]?.error) return;
      const s = new ChatStream(chat, {
        getAfter: () => lastId(state.timeline[chat] || []),
        onMessage: (row) => onMessages(chat, [row]),
        onThread: (t) => onThread(chat, t),
        onHeartbeat: (hb) => {
          const busy = !!hb.coordinator_busy;
          if (!!state.coordBusy[chat] !== busy) { state.coordBusy[chat] = busy; emit(); }
        },
        onMode: (m) => { state.conn = m; emit(); },
      }).start();
      streams.set(chat, s);
    });
  }
  /** Follow these chats live (the open conversation; the Workspace on Home). */
  function watch(chats) {
    const want = new Set((chats || []).filter(Boolean));
    for (const [c, s] of streams) if (!want.has(c)) { s.close(); streams.delete(c); delete state.coordBusy[c]; }
    for (const c of want) if (!streams.has(c)) openStream(c);
    if (want.has("workspace")) loadRouted();
  }
  /** An open thread: its detail now, then every 4 s while busy and every 15 s otherwise. */
  function watchThread(ts) {
    if (watched === ts) return;
    clearTimeout(watchT);
    watched = ts || null;
    if (watched) tick();
    async function tick() {
      const id = watched;
      if (!id) return;
      if (lists[id]) await fetchDetail(id);
      if (watched !== id) return;
      const t = state.threads.find((x) => x.id === id);
      const busy = t && (t.busy || t.state === "working");
      watchT = setTimeout(tick, document.hidden ? DETAIL_IDLE_MS : busy ? DETAIL_BUSY_MS : DETAIL_IDLE_MS);
    }
  }

  loadStatus();
  poll();
  setInterval(() => !document.hidden && poll(), LIVE_POLL_MS);
  addEventListener("visibilitychange", () => { if (!document.hidden) { poll(); loadStatus(); } });

  const post = async (chat, text, ts) => {
    let res;
    try { res = await api.post(chat, text, ts); } catch (err) {
      if (err.code === "router_off" || err.status === 501 || err.status === 0 || err.status === 502) loadStatus();
      throw err;
    }
    event({ kind: "you", thread: ts || null, project: chat, text });
    setTimeout(poll, 1500);
    return res;
  };

  return {
    act: {
      live: true,
      reply: async (threadId, text) => {
        const t = state.threads.find((x) => x.id === threadId);
        if (!t) throw new Error("Unknown thread");
        const res = await post(t.project, text, t.id);
        const row = res && res.message;
        if (row) {
          const d = det[t.id] || (det[t.id] = { messages: [], at: 0 });
          d.messages = mergeMessages(d.messages, [row]).list;
          tAwait[t.id] = { id: row.id, at: Date.now() };
        }
        commit(); emit();
        setTimeout(() => fetchDetail(t.id), 1500);
        return row || null;
      },
      decide: (askId, decision, note = "") => {
        // No approval API yet (R2): a real needs_approval would go to the thread as a reply. Nothing sets it today.
        const t = state.threads.find((x) => x.asks.some((a) => a.id === askId));
        if (!t) return Promise.reject(new Error("Unknown request"));
        const text = decision === "allow" ? `Approved.${note ? " " + note : ""}` : `Not approved.${note ? " " + note : ""}`;
        return post(t.project, text, t.id);
      },
      ask: async (projectId, text) => {
        const chat = projectId || "workspace";
        const res = await post(chat, text);
        const row = res && res.message;
        if (row) {
          mergeTimeline(chat, [row]);
          state.awaiting[chat] = { id: row.id, at: Date.now() };
        }
        const p = state.projects.find((x) => x.id === chat);
        if (p && !p.hasChat) p.hasChat = true;
        emit();
        return row || null;
      },
      resolve: () => Promise.reject(new Error("Resolving from the UI needs the API in requirements R1.")),
      refresh: poll,
      watch, watchThread, loadOlder,
      replying: (chat) => !!state.coordBusy[chat] || awaitingNow(state.awaiting[chat]),
      status: loadStatus,
    },
    stop: () => { for (const s of streams.values()) s.close(); },
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

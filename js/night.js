// Converged · the end of the day. ONE moment that merges 14's Overnight
// Engine with 16's Seal:
//
//   evening   End day: plant up to 3 real items from the plans (Seed Packet,
//             #101); a live Yield Forecast (#1) as a range; answering an ask
//             before you go raises it (true stakes: computed from the steps
//             that thread could move, never invented).
//   seal      Seal the day: the forecast you were shown is the one that is
//             sealed (computed before the planted threads exist, and planted
//             work counts the same before and after). Permission to Leave
//             (#182): every channel goes quiet; the sidebar drops its accents.
//   night     the agents work (the demo simulates it on "See the morning").
//   morning   the harvest against the forecast (#1), a Leverage Receipt (#129)
//             only when a decision really unlocked work, the finds that didn't
//             fit on Home, and the first move, NOT pre-selected or focused.
//   away      Absence Is Fine: three things first, the rest parked quietly.
//
// The demo world is mutated directly (demo only). The backend would supply
// pace history, the plan's ripe items and a real lid-close / last-seen cue.
import { WAITING } from "./world.js";
import * as Kit from "./kit.js";
import { setClockShift, shifted } from "./ui.js";

const HOUR = 3600000;
const CAP = 2;            // steps an existing thread is expected to move in one night
const H_PER_STEP = 1.3;   // agent-hours per step (from pace history; demo constant)
const SLOTS = 3;          // threads you can plant tonight

// Ripe items from each project's plan (the backend: todos.json / PLAN.md).
const SEEDS = [
  { id: "s1", project: "billing-api", title: "Add idempotency keys to refunds", steps: ["Find refund call sites", "Add idempotency keys", "Tests for duplicate refunds"], hours: 1.6 },
  { id: "s2", project: "mobile-app", title: "E2E tests for the offline inbox", steps: ["Write airplane-mode scenarios", "Run on three simulators", "Report flaky cases"], hours: 2.1 },
  { id: "s3", project: "research", title: "Draft the agent-trust brief", steps: ["Outline from the papers", "Write the brief", "Cite sources"], hours: 1.2 },
  { id: "s4", project: "marketing-site", title: "Lighthouse pass on the launch page", steps: ["Audit six pages", "Fix the three worst", "Re-audit"], hours: 0.9 },
  { id: "s5", project: "blackhole", title: "Reduced-motion still for the disk", steps: ["Render a still frame", "Swap on prefers-reduced-motion"], hours: 0.6 },
];

// What the night does to specific demo threads (honest variety: one surprises, one hits a question).
const NIGHT_SCRIPT = [
  { re: /Launch page/i, steps: 1, ask: { kind: "question", title: "Pricing table: annual prices first, or monthly?", detail: "Both versions are built and ready to ship.", risk: "routine", options: ["Annual first", "Monthly first"] } },
  { re: /Summarise 12 papers/i, steps: 2 },
  { re: /Offline mode/i, steps: 3 },
  { re: /accretion/i, steps: 1 },
];

const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

function mkList(steps, done, doing) {
  const items = steps.map((text, i) => ({ text, state: i < done ? "done" : i === done && doing ? "doing" : "todo" }));
  return { items, total: steps.length, done: Math.min(done, steps.length), doing: items.filter((i) => i.state === "doing").length };
}

export function createNight({ world, D, params, extra }) {
  const at = params.get("at");
  const away = Math.max(0, Math.min(14, parseInt(params.get("away") || "0", 10) || 0));
  const realH = new Date().getHours() + new Date().getMinutes() / 60;
  const N = {
    phase: "day",
    away: away >= 2 ? away : 0,
    planted: new Set(),
    sealed: null,            // { at, until, forecast, snapshot: Map(tid → done) }
    harvest: null,
    evening: [],             // decisions taken in the evening (for receipts)
    eveningStart: 0,
    history: [],             // nights, oldest first: true = real work moved, false = rest night
    hits: 11, of: 14,        // forecast calibration, published
    seen: false,             // the morning count-up plays once
  };

  // ── history: the Night Shift Run (any 5 of 7 count; rest nights bank) ────
  // 28 nights, two weekend rests a fortnight, seeded so the run reads 23.
  N.history = Array.from({ length: 28 }, (_, i) => !(i === 3 || i === 11 || i === 12 || i === 18 || i === 25));
  function run() {
    const h = N.history;
    let n = 0;
    for (let i = h.length - 1; i >= 0; i--) {
      if (h[i]) { n++; continue; }
      const win = h.slice(Math.max(0, i - 3), Math.min(h.length, i + 4));
      if (win.filter(Boolean).length < 5) break; // a rest night only breaks the run below 5 of 7
    }
    return n;
  }

  // ── the display clock for the simulated day ──────────────────────────────
  // dispH: the hour the person sees now; day: days after today. Jumping the
  // clock moves every past timestamp back by the same amount, so "last night"
  // reads as last night everywhere (messages, decisions, receipts).
  N.day = 0;
  function setDisplay(h, day = N.day) {
    const d = new Date(); const cur = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    N.dispH = h; N.day = day;
    setClockShift(Math.round((h - cur + day * 24) * HOUR));
  }
  function jumpTo(h, days = 0) {
    const delta = ((days * 24) + h - (N.dispH ?? h)) * HOUR;
    if (delta > 0) rewind(delta);
    setDisplay(h, N.day + days);
    return delta;
  }
  // ── seeds and the forecast ───────────────────────────────────────────────
  const project = (id) => world.state.projects.find((p) => p.id === id);
  function seeds() {
    return SEEDS.filter((s) => project(s.project) && !s.threadId).map((s) => ({ ...s, planted: N.planted.has(s.id) }));
  }
  function plant(id) {
    if (N.planted.has(id)) { N.planted.delete(id); return true; }
    if (N.planted.size >= SLOTS) return false;
    N.planted.add(id); return true;
  }

  const remaining = (t) => Math.max(0, t.checklist.total - t.checklist.done);
  /** What one ask is worth tonight: the steps its thread could move if you answer before you go. */
  function gainFor(n) {
    if (!n || n.risk === "destructive" || n.group === "stopped") return 0;
    return Math.min(remaining(n.t) || 1, CAP);
  }

  /** The live Yield Forecast. Only planting or unblocking real threads raises it. */
  function forecast() {
    if (N.sealed) return N.sealed.forecast;
    let e = 0;
    const ships = [];
    for (const t of world.state.threads) {
      if (t.planted && t.state !== "done" && t.state !== "resolved") {
        // planted work counts exactly as its seed did, whatever state it's in
        e += Math.min(t._steps ? t._steps.length : remaining(t), 3);
        ships.push({ title: t.title, project: t.project, word: "likely", planted: true });
        continue;
      }
      if (t.state !== "working") continue;
      const r = remaining(t);
      e += Math.min(r, CAP);
      if (r && r <= CAP) ships.push({ title: t.title, project: t.project, word: r === 1 ? "very likely" : "likely" });
    }
    for (const s of seeds().filter((x) => x.planted)) {
      e += Math.min(s.steps.length, 3);
      ships.push({ title: s.title, project: s.project, word: "likely", planted: true });
    }
    const needs = D.needItems().filter((n) => !D.queued(n.key));
    const gainAsks = needs.filter((n) => gainFor(n) > 0);
    const gain = gainAsks.reduce((a, n) => a + gainFor(n), 0);
    const lo = Math.max(0, Math.round(e * 0.75));
    const hi = Math.max(lo + 1, Math.round(e * 1.1));
    return { e, lo, hi, ships, gain, gainAsks, slotsLeft: SLOTS - N.planted.size };
  }

  // ── end the day: plant for real, seal the forecast ───────────────────────
  async function endDay() {
    if (world.mode !== "demo") return; // demo only: seeds are hand-written
    // Seal the forecast you were shown: computed BEFORE the planted threads exist.
    const f = forecast();
    const planted = SEEDS.filter((s) => N.planted.has(s.id) && !s.threadId);
    for (const s of planted) {
      const t = await world.act.ask(s.project, s.title);
      if (!t) continue;
      t.title = s.title;
      t._steps = s.steps.slice();
      t.checklist = mkList(t._steps, 0, true);
      t.planted = true;
      t.messages = [{ id: `${t.id}_p`, at: Date.now(), who: "you", text: `Planted for tonight: ${s.title}.` }, { id: `${t.id}_q`, at: Date.now() + 1, who: "agent", text: "Queued for tonight. I'll start when you leave." }];
      s.threadId = t.id;
    }
    const snapshot = new Map(world.state.threads.map((t) => [t.id, t.checklist.done]));
    N.evening = D.decisions().filter((d) => d.at >= N.eveningStart).map((d) => ({ ...d })).concat(N.evening.filter((d) => d.boot));
    N.sealed = { at: Date.now(), until: morningAt(), forecast: { ...f, ships: f.ships.slice(0, 3) }, snapshot, plantedN: planted.length };
    N.phase = "night";
    if ((N.dispH ?? 0) < 22) jumpTo(22.6);
    return N.sealed;
  }
  /** 9:00 on the next display morning. */
  function morningAt() {
    const d = new Date(shifted()); d.setHours(9, 0, 0, 0);
    if (d.getTime() <= shifted()) d.setDate(d.getDate() + 1);
    return d.getTime() - (shifted() - Date.now());
  }
  /** A seal is only honest when nothing is time-critical. */
  function canSeal(needs) {
    const critical = needs.filter((n) => n.ask && n.ask.deadline);
    return critical.length ? { ok: false, why: `${critical[0].ask.title} is time-critical.` } : { ok: true };
  }
  /** Unseal: back to the evening (planted threads stay planted; the forecast goes live again). */
  function reopen() { N.sealed = null; N.phase = "evening"; }
  const sealedForecast = () => (N.sealed ? N.sealed.forecast : null);

  // ── the night itself (demo: simulated; live: the agents just work) ───────
  function rewind(ms) {
    for (const t of world.state.threads) {
      t.createdAt -= ms; t.lastAt -= ms;
      for (const m of t.messages) m.at -= ms;
    }
    for (const d of D.decisions()) d.at -= ms;
    for (const d of N.evening) d.at -= ms;
    for (const list of (extra ? extra() : [])) for (const m of list) m.at -= ms;
    N.eveningStart -= ms;
  }

  function advance(t, k, t0, span) {
    const steps = t._steps || t.checklist.items.map((i) => i.text);
    const from = t.checklist.done;
    const to = Math.min(steps.length, from + k);
    for (let i = from; i < to; i++) {
      const at = t0 + span * ((i - from + 1) / (to - from + 1)) - (hash(t.id + i) % 40) * 60000;
      t.messages.push({ id: `${t.id}_n${i}`, at, who: "agent", text: `✓ ${steps[i]}` });
      t.lastAt = at;
    }
    t.checklist = mkList(steps, to, to < steps.length);
    return to - from;
  }

  /** Run `nights` nights over the world; build the harvest. */
  function runNight(nights = 1) {
    if (world.mode !== "demo") return;
    if (!N.sealed) { const f = forecast(); N.sealed = { at: Date.now(), until: morningAt(), forecast: { ...f, ships: f.ships.slice(0, 3) }, snapshot: new Map(world.state.threads.map((t) => [t.id, t.checklist.done])), plantedN: 0 }; }
    const NIGHT = jumpTo(8.1, nights) || 13 * HOUR;
    const now = Date.now();
    const t0 = now - NIGHT + 1.2 * HOUR, span = NIGHT - 2.4 * HOUR;
    const per = [];
    let raised = null;
    for (const t of world.state.threads.slice()) {
      if (t.state !== "working") continue;
      const script = NIGHT_SCRIPT.find((s) => s.re.test(t.title));
      let k = t.planted ? 3 : script ? script.steps : CAP - (hash(t.id) % 4 === 0 ? 1 : 0);
      if (nights > 1) k = t.planted ? 3 : k + CAP * (nights - 1);
      if (script && script.ask) k = Math.min(k, Math.max(1, remaining(t) - 1));
      const moved = advance(t, k, t0, span);
      const rec = { tid: t.id, title: t.title, project: t.project, steps: moved, planted: !!t.planted, shipped: false, paused: false };
      if (t.checklist.done >= t.checklist.total) {
        t.state = "done"; t.happened = "Finished overnight. All checks pass."; t.overnight = "shipped";
        t.messages.push({ id: `${t.id}_done`, at: t.lastAt + 60000, who: "agent", text: "Finished overnight. All checks pass; ready for your look." });
        rec.shipped = true;
      } else if (script && script.ask && !raised) {
        const ask = { id: `${t.id}_night_ask`, ...script.ask };
        t.asks = [ask]; t.needsYou = ask.title; t.state = "needs_reply"; t.overnight = "asked";
        t.messages.push({ id: `${t.id}_ask`, at: now - 1.6 * HOUR, who: "agent", text: `I've built both pricing tables. ${ask.title}` });
        t.lastAt = now - 1.6 * HOUR;
        rec.paused = true; raised = { tid: t.id, key: Kit.askKey(t, ask) };
      } else t.overnight = "moved";
      if (moved || rec.paused) per.push(rec);
    }
    // what actually moved, measured against the snapshot at the seal
    let steps = 0;
    for (const t of world.state.threads) steps += Math.max(0, t.checklist.done - (N.sealed.snapshot.get(t.id) ?? 0));
    const threadsWorked = per.filter((p) => p.steps > 0).length;
    const hours = Math.round((steps * H_PER_STEP + threadsWorked * 0.4) * 10) / 10;
    const f = N.sealed.forecast;
    const verdict = steps > f.hi ? "above" : steps < f.lo ? "below" : "in";
    if (nights === 1) { if (verdict === "in") N.hits++; N.of++; }
    for (let i = 0; i < nights; i++) N.history.push(true);
    const runBefore = run() - nights;
    const receipts = N.evening.map((d) => receiptOf(d)).filter(Boolean);
    N.harvest = {
      nights, hours, steps, forecast: f, verdict,
      shipped: per.filter((p) => p.shipped), paused: per.filter((p) => p.paused), moved: per.filter((p) => !p.shipped && !p.paused && p.steps),
      receipts, raised, runBefore, run: run(),
    };
    N.sealed = null; N.planted.clear(); N.seen = false;
    N.phase = "morning";
    return N.harvest;
  }

  /** Leverage Receipt: what a decision unlocked, computed after the fact. Only above a threshold. */
  function receiptOf(d) {
    const t = world.thread(d.tid);
    if (!t || d.choice === "deny") return null;
    const steps = Math.max(0, t.checklist.done - (d.doneAt ?? t.checklist.done));
    const shipped = t.state === "done";
    if (steps < 2 && !shipped) return null;
    return { label: d.label, said: d.said, secs: d.secs || 5, steps, hours: Math.round((steps * H_PER_STEP + 0.4) * 10) / 10, shipped, tid: t.id, title: t.title, project: t.project };
  }

  /** Permission to Leave in the day: the next likely time anything needs you. */
  function quietUntil() {
    const needs = D.needItems().filter((n) => !n.later);
    if (needs.length) return null;
    const working = world.state.threads.filter((t) => t.state === "working");
    if (!working.length) return { text: "Nothing is running.", sure: "sure" };
    const mins = working.length > 3 ? 60 : 85;
    const d = new Date(shifted() + mins * 60000);
    d.setMinutes(Math.ceil(d.getMinutes() / 10) * 10, 0, 0);
    return { at: d.getTime() - (shifted() - Date.now()), sure: "fairly sure" };
  }

  // ── boot: place the demo at a moment of the loop ─────────────────────────
  /** A decision you made last evening (demo boot only), so the morning shows its receipt. */
  function bootEveningDecision() {
    const t = world.state.threads.find((x) => /Retry soft declines/i.test(x.title) && WAITING(x.state));
    if (!t) return;
    const ask = t.asks[0];
    const at = Date.now() - 4 * 60000;
    N.evening.push({ boot: true, verb: "Allowed", choice: "allow", label: ask ? ask.title : "the ask", said: "", secs: 6, tid: t.id, doneAt: t.checklist.done, at, project: t.project, thread: t.title });
    t.asks = []; t.needsYou = ""; t.state = "working"; t.lastAt = at;
    t.messages.push({ id: `${t.id}_bootyou`, at, who: "you", text: `Approved: ${ask ? ask.title : "go ahead"}` }, { id: `${t.id}_bootok`, at: at + 2000, who: "agent", text: "Approved, continuing." });
    t.checklist = mkList(t._steps, t.checklist.done, true);
  }

  function boot() {
    let phase = at;
    if (!["day", "evening", "night", "morning"].includes(phase)) phase = realH >= 18 ? "evening" : "day";
    if (N.away) phase = "morning";
    N.eveningStart = Date.now() - HOUR;
    if (phase === "day") { N.phase = "day"; setDisplay(realH < 17 ? realH : 14.5); return "day"; }
    if (phase === "evening") { N.phase = "evening"; setDisplay(Math.max(realH, 18.7)); return "evening"; }
    N.phase = "evening";
    setDisplay(18.9);
    if (phase === "night") { N.planted.add("s1"); N.planted.add("s3"); return "night"; }
    // morning / day / away: last night already happened
    N.planted.add("s1"); N.planted.add("s3");
    if (N.away) N.planted.add("s2");
    bootEveningDecision();
    return phase;
  }

  return {
    get phase() { return N.phase; },
    set phase(v) { N.phase = v; },
    get away() { return N.away; },
    get harvest() { return N.harvest; },
    get sealed() { return N.sealed; },
    get history() { return N.history; },
    get calibration() { return { hits: N.hits, of: N.of }; },
    get seen() { return N.seen; }, set seen(v) { N.seen = v; },
    get slots() { return SLOTS; },
    get dispH() { return N.dispH; },
    set eveningStart(v) { N.eveningStart = v; },
    seeds, plant, forecast, sealedForecast, gainFor, endDay, reopen, runNight, receiptOf, quietUntil, run, boot, setDisplay, jumpTo, canSeal, morningAt,
  };
}

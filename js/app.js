// 17 · Converged. The final candidate of the round-4 research.
//
// Base: 16 · Budget's Home and UI (the owner's favourite), its sidebar,
// project page (title + one sentence + the Now shelf + All threads) and
// global panel; Today's in-thread card with smooth Details; Next's Workspace.
// Pacing is invisible: asks are ranked, small ones that block nobody wait
// quietly ("can wait", with the honest reason), destructive and stopped asks
// are never held, only high-leverage arrivals speak up, a break after ~25 min
// of deciding. One end-of-day moment ("Before you go": queue tonight's work,
// then seal) and a morning recap on the first visit. Found while working (≤2).
// A plain "3rd time · make it a rule?" inside a decision. Stop while anything
// runs. Intelligence per session in the composer. Light and dark.
import { createWorld, esc, WAITING } from "./world.js";
import { mountMode } from "./mode.js";
import { renderMarkdown, renderInline } from "./markdown.js";
import * as Kit from "./kit.js";
import * as K from "./keys.js";
import { createDecisions } from "./decide.js";
import { createPacing } from "./pacing.js";
import { createRules } from "./rules.js";
import { createFinds } from "./finds.js";
import { createNight } from "./night.js";
import { createIntel } from "./intel.js";
import { EFFORT, HELD_SEED, estLine, evidenceFor } from "./content.js";
import { ICON, XO, NEXT_GLYPH, $, $$, RM, clock, dayOf, short, elapsed, reconcile, sound, wait, dial, morph, expand, shifted } from "./ui.js";
import { uiMsg, echoes, threadAnchors, parseTarget as targetOf, stripTarget, sendErrorTitle, connLine, sendBlock, plainText, hopLine, sharedFileRoute, relayedInto } from "./timeline.js";
import { turnHtml } from "./turnview.js";
import { itemParts } from "./review.js";
import { runsStripHtml, runsListHtml, runViewHtml } from "./runsview.js";
import { createSettings } from "./settings.js";
import { createChats } from "./chats.js";
import { createViewer } from "./viewer.js";

const world = createWorld();
// Demo-only features (seeded content, the night, rules, finds, Stop) never run against the real backend.
const DEMO = world.mode === "demo";
mountMode(world);

const params = new URL(location.href).searchParams;
const T0 = Date.now();
const PROJ = (id) => (id === "workspace" ? "Workspace" : id === "@account" ? "Your account" : id === "@chats" ? "Chats" : world.project(id)?.name || id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const PHONE = matchMedia("(max-width: 760px)");
const NUM = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const num = (n) => NUM[n] || String(n);
const low = (n) => num(n).toLowerCase();
const plural = (n, w) => `${w}${n === 1 ? "" : "s"}`;
// Drafts are kept per mode, so demo text never lands in a live composer (P3-4).
const DRAFTS = DEMO ? "cv-drafts" : "cv-drafts:live";
const STOP_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2.2" fill="currentColor"/></svg>`;

// ── theme: dark by default, a slide toggle in the sidebar (#28) ────────────
const THEME = { get() { try { return localStorage.getItem("cv-theme") === "light" ? "light" : "dark"; } catch { return "dark"; } } };
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", t);
  const b = $("#theme");
  if (b) { b.setAttribute("aria-checked", String(t === "light")); b.title = t === "light" ? "Light mode is on. Switch to dark" : "Switch to light mode"; }
}
applyTheme(THEME.get());

// ── state ───────────────────────────────────────────────────────────────────
const S = {
  view: "home",            // home | ws | p:<project> | t:<thread>
  pfind: "", pfCur: 0,     // the sidebar's project filter (hub #16) and its highlighted row
  parent: {}, opener: {}, scroll: {},
  dockFold: {},
  showHops: (() => { try { return localStorage.getItem("cv-hops") === "1"; } catch { return false; } })(),
  tbOpen: {},              // storm blocks opened by the person (by block id, or row:<call id>)
  stops: new Map(),        // live Stops by session: waiting out their Undo, or on their way
  tEdit: null,             // a thread header field being edited: {tid, field: "title"|"label"}
  recording: null, keyErr: null,  // Settings › Keyboard: the action waiting for a new key, and why the last one was refused            // asks folded away in their thread so you can read it first (by ask key)
  local: {}, alias: new Map(), localThread: new Map(),
  drafts: store.get(DRAFTS, {}),
  later: new Set(),
  pin: null,
  wash: new Map(),
  herald: null,
  ckOpen: {}, ckSeen: {}, ckFresh: null,
  handledOpen: false, eodOpen: false, rulesOpen: false,
  typing: {}, desc: {}, stopped: {},
  seen: null,
  allFilter: "all", allDone: false,
  morningOpen: false,
  n: 0,
};
const waitSince = new Map();
const absorbing = new Set();
const live = $("#live");
function announce(text) { live.textContent = ""; setTimeout(() => { live.textContent = text; }, 40); }

// ── demo world seeding (demo only; live reads what's there) ────────────────
if (world.mode === "demo") {
  const th = (re) => world.state.threads.find((t) => re.test(t.title));
  const now = Date.now();
  const since = [[/dark mode contrast/i, 70 * 1000], [/retry soft declines/i, 42 * 60000], [/interview notes/i, (3 * 60 + 12) * 60000], [/nightly job/i, 2 * 3600000], [/backfill/i, 64 * 60000]];
  for (const [re, ms] of since) { const t = th(re); if (t) waitSince.set(t.id, now - ms); }
  for (const h of HELD_SEED) {
    const t = th(h.thread);
    if (t && t.state === "working") t.asks = [{ id: `held_${t.id}`, ...h.ask }];
  }
  // The third `npm test` this week: the decision offers a rule.
  const off = th(/Offline mode/i);
  if (off) {
    off.state = "needs_approval";
    off.asks = [{ id: "seed_npmtest", kind: "permission", title: "Run: npm test -- mobile-app", detail: "Read-only test run in the project folder.", risk: "routine" }];
    off.needsYou = off.asks[0].title;
    waitSince.set(off.id, now - 3 * 60000);
  }
  // ?many=1 : a project with many threads, to show the Now shelf never grows
  if (params.has("many")) {
    const mk = (title, state, steps, done, i) => ({
      id: `many_${i}`, project: "billing-api", title, state, headline: "", branch: `xo/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 22)}`,
      happened: state === "done" ? "Done. All tests pass." : "Reading the code around it.", needsYou: "",
      createdAt: now - (2 + i * 7) * 3600000, lastAt: now - (1 + i * 5) * 3600000,
      checklist: { items: steps.map((s, k) => ({ text: s, state: k < done ? "done" : k === done && state === "working" ? "doing" : "todo" })), total: steps.length, done, doing: state === "working" ? 1 : 0 },
      messages: [{ id: `m_many_${i}`, at: now - 7200000, who: "you", text: title + "." }], asks: [], _steps: steps,
    });
    const done = ["Webhook signature check", "Idempotency keys on refunds", "Coupon rounding", "Tax ID validation", "Currency display for JPY", "Invoice PDF fonts", "Proration preview endpoint", "Retry jitter tuning", "Remove legacy v1 routes", "Stripe event dedupe", "Late-fee policy flag", "Card brand icons"];
    done.forEach((d, i) => world.state.threads.push(mk(d, "done", ["Read", "Change", "Test"], 3, i)));
    world.state.threads.push(mk("Dunning email templates for failed renewals", "working", ["Draft", "Wire hooks", "Tests", "Preview"], 1, 20));
    world.state.threads.push(mk("Annual plan discounts", "working", ["Model", "Migrate", "Tests"], 2, 21));
    world.state.threads.push(mk("Refund reasons report", "working", ["Query", "Chart", "Export"], 0, 22));
  }
}

// ── the parts ───────────────────────────────────────────────────────────────
const P = createPacing({ params });
const R = createRules({
  PROJ,
  onChange: () => schedule(),
  onEvent: (e) => { if (e.kind === "rule") { heraldShow({ kind: "rule", text: "Rule added", sub: "it answers these from now on" }, 4600); setTimeout(absorbSweep, 3400); } },
});
const FV = createFinds({ world, params, onArrive: (f) => { announce(`Found while working: ${f.title}.`); schedule(); } });
const D = createDecisions({
  world, P, rules: R, PROJ, announce, waitSince, absorbing,
  render: () => schedule(),
  later: S.later,
  onOpenThread: (tid) => {
    // an item hosted by a chat (no thread) opens that conversation; one hosted by the account has no page yet
    const h = (world.state.hosts || []).find((x) => x.id === tid);
    if (h) { if (h.chatId) go(convOfChat(h.project), { keepPanel: true }); else if (h.plainSession) go("c:" + h.plainSession); else heraldShow({ kind: "calm", text: "It isn't tied to a conversation", sub: h.title }, 3600); return; }
    go("t:" + tid, { keepPanel: true });
  },
  // a decision refused after its window: the honest correction replaces "All clear"
  onNotSent: (title, why) => { setTimeout(() => heraldShow({ kind: "stopped", text: "Not sent", sub: `${String(title).replace(/`/g, "").replace(/[.?!]$/, "")} · ${why}`, force: true }, 7000), RM.matches ? 0 : 950); },
  onAllClear: (summary) => { setTimeout(() => heraldShow({ kind: "clear", text: "All clear", sub: summary }, 4600), RM.matches ? 0 : 900); },
  onUndone: (key) => { if (S.view === "home") { S.pin = key; S.pinAnim = "undo"; } },
  onBreak: (left) => heraldShow({ kind: "calm", text: "Taking a break", sub: `${left} wait safely` }, 5200),
  onSent: (part) => {
    // "Stop here" after you stopped a thread: it ends there, honestly
    if (part.ask.stopByYou && part.choice && part.choice.option === "Stop here") setTimeout(() => { world.act.resolve(part.t.id).catch(() => {}); }, 1600);
  },
});
const NIGHT = createNight({ world, D, params, extra: () => Object.values(S.local) });
const IQ = createIntel({
  world, PROJ, params,
  onChange: (o) => { chipRender(o && o.fade); },
  record: (session, rec) => recordLine(session, rec),
});

const CH = createChats({
  world, announce, heraldShow: (...a) => heraldShow(...a), go: (...a) => go(...a), schedule: () => schedule(),
  view: () => S.view,
  // a new chat that was refused: your words go back into an empty composer on the Chats page
  restore: (text, { force = false } = {}) => {
    if (force && S.view !== "chats") go("chats");
    if (S.view !== "chats") return false;
    const now = say.value.trim();
    if (now && !force) return false;
    say.value = now ? `${text}\n\n${now}` : text;
    growSay(); saveDraft(); updateComposer(); say.focus();
    return true;
  },
});
world.ui = { tbOpen: S.tbOpen }; // turn blocks open or folded, shared with the Chats view
const VW = createViewer({ announce }); // a shared file beside the conversation (if1 #2)

// ── world helpers ───────────────────────────────────────────────────────────
const projects = () => world.state.projects.filter((p) => p.id !== "workspace");
const threadsOf = (pid) => world.state.threads.filter((t) => t.project === pid && t.state !== "resolved");
const convThread = (v) => (v && v.startsWith("t:") ? world.thread(v.slice(2)) : null);
const convProject = (v) => (v === "ws" || v === "home" ? "workspace" : v.startsWith("p:") ? v.slice(2) : convThread(v)?.project);
const sessionOf = (v) => (v === "home" ? "ws" : v);
const askTitle = (n) => {
  if (n.ask.live) return renderInline(n.ask.title || "", true); // the server's words; `code` stays code
  const cmd = Kit.commandOf(n.ask);
  if (cmd) return `Run <code>${esc(cmd)}</code>`;
  if (n.group === "stopped") return esc(n.t.title);
  return esc(n.risk === "destructive" ? n.ask.title.replace(/:\s.*$/, "") : n.ask.title);
};
const askShort = (n) => {
  if (n.ask.live) return plainText(n.ask.title || "");
  const cmd = Kit.commandOf(n.ask);
  if (cmd) return `Run ${cmd}`;
  if (n.group === "stopped") return "Stopped";
  if (n.risk === "destructive") return n.ask.title.replace(/:\s.*$/, "");
  return n.ask.title;
};
const STATE_WORD = { working: "Working", needs_reply: "Needs you", needs_approval: "Needs you", paused: "Paused", done: "Done", failed: "Stopped", resolved: "Resolved" };
// Live: "Working" only while its agent really works (detail `busy`, or our reply awaits an answer).
// A working thread whose session sits idle reads "Idle" (P1-8). Demo threads have no `busy`.
const isBusy = (t) => t.busy === true || (t.state === "working" && t.busy !== false);
const glyphOf = (t) => (t.state === "working" && t.busy === false ? "idle" : t.state);
const wordOf = (t) => (glyphOf(t) === "idle" ? "Idle" : STATE_WORD[t.state]);
const SORT_STATE = { needs_approval: 0, needs_reply: 0, paused: 0, failed: 1, working: 2, done: 3, resolved: 4 };
const doneToday = () => world.state.threads.filter((t) => t.state === "done" && new Date(t.lastAt).toDateString() === new Date().toDateString());
const sealed = () => NIGHT.phase === "night";
const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;

// ── rules answer matching asks (demo acts; live would be server-side) ──────
function absorbSweep() {
  if (world.mode !== "demo") return;
  for (const t of world.state.threads) {
    for (const a of t.asks || []) {
      const key = Kit.askKey(t, a);
      if (absorbing.has(key) || D.pendingKey(key)) continue;
      const cover = R.coverFor(t, a);
      if (!cover) continue;
      absorbing.add(key);
      setTimeout(async () => {
        try {
          if (WAITING(t.state)) await world.act.decide(a.id, "allow", "");
          else { t.asks = t.asks.filter((x) => x !== a); t.needsYou = ""; }
        } catch { absorbing.delete(key); return; }
        R.absorbed(t, a, cover);
        heraldShow({ kind: "rule", text: `Your rule answered: ${Kit.commandOf(a) || a.title}`, sub: PROJ(t.project) }, 5200);
        absorbing.delete(key);
        schedule();
      }, RM.matches ? 300 : 900);
    }
  }
  schedule();
}

// ── events: a calm labelled line, never the composer, never a quiet row ────
world.onEvent((e) => {
  if (e.kind === "message") {
    // live: the coordinator answered something you asked, and you're looking elsewhere: one calm line
    const conv = e.project === "workspace" ? "ws" : "p:" + e.project;
    if (e.answered && S.view !== conv && !sealed()) heraldShow({ kind: "reply", text: e.project === "workspace" ? "The coordinator replied" : `${PROJ(e.project)} coordinator replied`, sub: short1(e.text), open: conv }, 7000);
    if (e.answered) announce(`${e.project === "workspace" ? "The coordinator" : PROJ(e.project) + " coordinator"} replied: ${e.text}`);
    schedule();
    return;
  }
  const t = e.thread ? world.thread(e.thread) : null;
  const pid = e.project;
  if (e.kind === "ask" && t && !waitSince.has(t.id)) waitSince.set(t.id, Date.now());
  if (e.kind === "resumed" && t) waitSince.delete(t.id);
  if (e.kind === "ask") setTimeout(absorbSweep, 50);
  if (!pid || pid === "workspace" || sealed()) return;
  if (e.kind === "done" && t) heraldShow({ kind: "done", text: `${t.title} finished`, sub: PROJ(pid), open: "t:" + t.id }, 5200);
  else if (e.kind === "state" && t && t.state === "failed") heraldShow({ kind: "stopped", text: `${t.title} stopped`, sub: PROJ(pid), open: "t:" + t.id }, 5200);
});

const short1 = (text) => { const s = String(text || "").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim(); return s.length > 64 ? s.slice(0, 63).replace(/\s+\S*$/, "") + "…" : s; };

/** Leverage-gated pings: only a newly arrived ask that frees ≥ 1 h of agent work may speak, once. */
function pings(needs) {
  if (!S.seen) { S.seen = new Set(needs.map((n) => n.key)); return; }
  for (const n of needs) {
    if (S.seen.has(n.key)) continue;
    S.seen.add(n.key);
    if (n.group === "stopped" || n.ask.stopByYou || !P.mayPing(n)) continue;
    heraldShow({ kind: "ping", text: `${PROJ(n.t.project)} · worth a look`, sub: askShort(n), decide: n.key }, 7000);
  }
}

// ── sidebar: button-like rows; text only when a project needs you (#27) ────
function sideRender(needs) {
  const mine = needs.filter((x) => x.admitted && !x.later);
  const quiet = sealed();
  const n = quiet ? 0 : mine.length;
  const hn = $("#home-n");
  const hnHtml = quiet ? `<span class="nr-seal">${ICON.moon}</span>` : n ? `<span class="nv-dot" aria-hidden="true"></span>${n}` : "";
  if (hn._h !== hnHtml) { hn.innerHTML = hnHtml; hn._h = hnHtml; }
  $("#nv-home").setAttribute("aria-label", quiet ? "Home, sealed for the night" : n ? `Home, ${n} need you` : "Home, nothing needs you");
  $("#nv-home").classList.toggle("is-on", S.view === "home");
  $("#nv-ws").classList.toggle("is-on", S.view === "ws");
  $("#nv-chats").classList.toggle("is-on", CH.isChats(S.view));
  for (const b of [$("#nv-home"), $("#nv-ws"), $("#nv-chats")]) b.toggleAttribute("aria-current", b.classList.contains("is-on"));
  const now = Date.now();
  // the project filter (hub #16): shown once the list is long; matches keep the ones needing you first
  const all = projects();
  const find = $("#side-find");
  find.hidden = all.length <= FIND_AT && !S.pfind;
  const q = (S.pfind || "").trim().toLowerCase();
  const needN = (p) => (quiet ? 0 : mine.filter((x) => x.t.project === p.id).length);
  const shown = q ? all.filter((p) => String(p.name || p.id).toLowerCase().includes(q)).sort((a, b) => (needN(b) > 0) - (needN(a) > 0)) : all;
  if (S.pfCur >= shown.length) S.pfCur = shown.length - 1;
  const pfn = q ? (shown.length ? `${shown.length} of ${all.length}` : "None") : "";
  if ($("#pf-n").textContent !== pfn) $("#pf-n").textContent = pfn;
  sideRender.shown = shown;
  const items = shown.map((p, pi) => {
    const on = S.view === "p:" + p.id || convThread(S.view)?.project === p.id;
    const asks = quiet ? [] : mine.filter((x) => x.t.project === p.id);
    const lead = asks.find((x) => x.group !== "stopped" && x.risk !== "destructive") || asks[0];
    const busy = threadsOf(p.id).some(isBusy);
    const needsMe = asks.length > 0;
    const label = needsMe ? askShort(lead) : "";
    const kind = needsMe ? (lead.risk === "destructive" || lead.group === "stopped" ? "red" : "amber") : "";
    const was = sideRender.needs?.get(p.id) || 0;
    if (asks.length > was && sideRender.ready && !RM.matches) S.wash.set(p.id, { n: (S.wash.get(p.id)?.n || 0) + 1, until: now + 2600 });
    const w = S.wash.get(p.id);
    const washing = w && w.until > now;
    return { key: p.id, html:
      `<button type="button" class="prow${needsMe ? ` needs k-${kind}` : ""}${on ? " is-on" : ""}${washing ? " wash" : ""}${q && pi === S.pfCur ? " is-cur" : ""}" data-go="p:${esc(p.id)}" data-w="${washing ? w.n : 0}"${on ? ' aria-current="page"' : ""} aria-label="${esc(p.name)}${needsMe ? `. ${asks.length} need${asks.length === 1 ? "s" : ""} you: ${esc(label)}` : busy ? ". Working" : ""}">` +
      `<span class="pr-ic" aria-hidden="true">${ICON.project}${busy ? `<i class="pr-busy"></i>` : ""}</span>` +
      `<span class="pr-main"><span class="pr-l1"><span class="pr-name">${esc(p.name)}</span>${needsMe ? `<span class="pr-w" aria-hidden="true"><i class="pr-d"></i>${asks.length}</span>` : ""}</span>` +
      (label ? `<span class="pr-t">${esc(label)}</span>` : "") + `</span></button>` };
  });
  sideRender.needs = new Map(projects().map((p) => [p.id, quiet ? 0 : mine.filter((x) => x.t.project === p.id).length]));
  if (q && !items.length) items.push({ key: "pf-none", html: `<p class="pf-none">No project called “${esc(S.pfind.trim())}”.</p>` });
  reconcile($("#projects"), items, { quiet: !sideRender.ready });
  sideRender.ready = true;
}
const FIND_AT = 8;
{
  const inp = $("#pf-in");
  const set = (v) => { S.pfind = v; S.pfCur = 0; sideRender(D.needItems()); };
  inp.addEventListener("input", () => set(inp.value));
  inp.addEventListener("keydown", (e) => {
    const list = sideRender.shown || [];
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (inp.value) { inp.value = ""; set(""); } else inp.blur(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!list.length || !S.pfind) return;
      S.pfCur = (Math.max(0, S.pfCur) + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length;
      sideRender(D.needItems());
      $("#projects .prow.is-cur")?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (e.key === "Enter") {
      const p = S.pfind ? list[Math.max(0, S.pfCur)] : null;
      if (p) { e.preventDefault(); inp.value = ""; S.pfind = ""; S.pfCur = 0; go("p:" + p.id); }
    }
  });
}

// ── Home ────────────────────────────────────────────────────────────────────
function greeting() {
  const h = new Date(shifted()).getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
function patch(el, html) {
  if (el._h === html) return false;
  const a = document.activeElement;
  const fid = a && el.contains(a) ? a.dataset.fid : null;
  el.innerHTML = html; el._h = html;
  if (fid) el.querySelector(`[data-fid="${CSS.escape(fid)}"]`)?.focus({ preventScroll: true });
  return true;
}
function homeParts(needs = D.needItems()) {
  const adm = needs.filter((n) => n.admitted);
  const active = adm.filter((n) => !n.later);
  const next = active.find((n) => n.key === S.pin) || active[0] || null;
  S.pin = next ? next.key : null;
  const rest = active.filter((n) => n !== next);
  return { needs, adm, active, next, then: rest.slice(0, 2), more: rest.slice(2), later: adm.filter((n) => n.later), held: needs.filter((n) => n.held), parked: needs.filter((n) => n.parked), glances: active.filter((n) => n.effort === "glance" && Kit.isBinary(n.ask) && n.group === "routine") };
}

/** An answer button; a preview, when there is one, sits in a small swatch so the button never looks disabled. */
function optHtml(o, i, ev) {
  const pv = ev && ev.preview ? ev.preview.find((p) => p.label === o) : null;
  return `<button type="button" class="b b-opt${pv ? " has-pv" : ""}" data-fid="opt${i}" data-nx-opt="${i}" title="Answer “${esc(o)}”">${pv ? `<span class="o-pv" aria-hidden="true"><span class="o-s" style="${esc(pv.css)}">${esc(pv.sample || o)}</span></span>` : ""}<span class="o-l">${esc(o)}</span></button>`;
}
function nextActHtml(n) {
  const a = n.ask;
  const binary = Kit.isBinary(a);
  const ev = evidenceFor(n);
  const reps = binary && a.kind === "permission" && n.risk !== "destructive" ? R.repeats(n) : 0;
  const rule = reps >= 2 ? `<button type="button" class="nx-link is-rule" data-fid="rule" data-rule="${esc(n.key)}" title="Allow it and add a rule, shown word for word first">${ICON.rule}${ord(reps + 1)} time this week · make it a rule?</button>` : "";
  let html = "";
  if (n.effort === "glance" && Array.isArray(a.options) && !binary) {
    html += `<div class="nx-opts" role="group" aria-label="Answers">${a.options.map((o, i) => optHtml(o, i, ev)).join("")}</div>` +
      `<div class="nx-foot"><button type="button" class="nx-link" data-fid="ev" data-decide="${esc(n.key)}">${ICON.eye}Details</button><button type="button" class="nx-link" data-fid="back" data-nx-back>${ICON.rewind}Send back</button></div>`;
  } else if (n.effort === "glance" && binary) {
    // a storm item's answers keep the server's own words (Allow once, Deny, Approve…)
    const IP = a.item ? itemParts(a.item) : null;
    const yes = IP && IP.primary ? IP.primary.label : "Allow", no = IP && IP.back ? IP.back.label : "Send back";
    html += `<div class="nx-btns"><button type="button" class="b b-allow" data-fid="allow" data-nx-allow><span class="b-l">${ICON.check}${esc(yes)}</span></button><button type="button" class="b b-back" data-fid="back" data-nx-back><span class="b-l">${ICON.rewind}${esc(no)}</span></button></div>` +
      `<div class="nx-foot"><button type="button" class="nx-link" data-fid="ev" data-decide="${esc(n.key)}">${ICON.eye}Details</button>${rule}</div>`;
  } else {
    const verb = n.group === "stopped" ? "Look and choose" : n.risk === "destructive" ? "Read it closely" : n.ask.kind === "action" ? "See what it needs" : n.ask.replyOnly ? "Read and reply" : "Decide";
    html += `<div class="nx-btns one"><button type="button" class="b b-go" data-fid="go" data-decide="${esc(n.key)}"><span class="b-l">${verb}${ICON.arrow}</span></button>` +
      (n.effort === "think" ? `<button type="button" class="b b-ghost" data-fid="later" data-later="${esc(n.key)}" title="Park it until later today"><span class="b-l">${ICON.clock}Later today</span></button>` : "") + `</div>`;
  }
  html += `<div class="c-note nx-note" hidden><label for="nx-note-in" class="c-note-l">What should it do instead? (optional)</label><textarea id="nx-note-in" rows="2" placeholder="e.g. what it should try instead"></textarea>` +
    `<div class="c-note-row"><button type="button" class="b b-sm b-go" data-nx-send>${ICON.rewind}Send back</button><button type="button" class="b b-sm b-ghost" data-nx-cancel>Cancel</button></div></div>`;
  return html;
}
function nextCardHtml(n) {
  const t = n.t, E = EFFORT[n.effort];
  const head = n.ask.live ? renderInline(n.ask.title || "", true) : Kit.commandOf(n.ask) ? `<span class="h-verb">Run</span> <code class="h-cmd">${esc(Kit.commandOf(n.ask))}</code>` : n.group === "stopped" ? `<span class="h-verb">Stopped at</span> ${esc((t.checklist.items.find((i) => i.state !== "done") || t).text || t.title)}` : esc(n.risk === "destructive" ? n.ask.title.replace(/:\s.*$/, "") : n.ask.title);
  return `<article class="next r-${n.risk} e-${n.effort}" data-key="${esc(n.key)}" data-fid="nextcard" tabindex="-1" aria-label="Your next move: ${esc(n.ask.title)}">` +
    `<div class="stamp stamp-allow" aria-hidden="true"><svg viewBox="0 0 52 52"><circle class="sc" cx="26" cy="26" r="23"/><path class="sk" d="M15 27l7.5 7.5L38 19"/></svg></div>` +
    `<div class="nx-in">` +
    `<div class="nx-meta"><span class="eff e-${n.effort}">${dial(n.effort)}<b>${E.label}</b><span>${E.time}</span></span>` +
    (n.risk === "destructive" ? `<span class="risk r-destructive">${ICON.lock}Destructive</span>` : n.group === "stopped" ? `<span class="risk r-stopped">Stopped</span>` : "") +
    (t.host ? `<button type="button" class="nx-where" data-fid="where"${t.chatId ? ` data-go="${esc(convOfChat(t.project))}"` : t.plainSession ? ` data-go="c:${esc(t.plainSession)}"` : ""} title="Where it was asked">${esc(t.title)}</button></div>` : `<button type="button" class="nx-where" data-fid="where" data-go="t:${esc(t.id)}" title="Open the thread">${esc(PROJ(t.project))}<span aria-hidden="true">›</span>${esc(t.title)}</button></div>`) +
    `<h2 class="nx-h" id="nx-h">${head}</h2>` +
    (estLine(n) ? `<p class="nx-est" title="${n.t.live ? "From its checklist: the steps not done yet." : "An estimate: the steps left that wait on this answer × a typical step time."}">${ICON.hourglass}${esc(estLine(n))}</p>` : "") +
    (n.sug ? `<p class="c-sug" title="${esc(n.sug.why)}">${ICON.spark}<span>Suggests <b>${esc(n.sug.label)}</b></span><em>${esc(n.sug.sure)}</em></p>` : "") +
    nextActHtml(n) + `</div></article>`;
}

function homeRender(needs) {
  const box = $("#home");
  if (!box._built) {
    box.innerHTML = `<div class="hm"><div id="hm-head"></div><div class="hm-body" id="hm-body"><div id="hm-moment"></div><div id="hm-next"></div><div id="hm-then"></div><div id="hm-finds"></div><div id="hm-end"></div></div></div>`;
    box._built = true;
  }
  const P0 = homeParts(needs);
  const working = world.state.threads.filter(isBusy);
  const date = new Date(shifted()).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const ph = NIGHT.phase;
  const act = P0.active.length;
  let sub;
  if (ph === "night") sub = "Sealed for the night.";
  else if (act) sub = act === 1 ? "One thing is worth your time." : `${num(act)} things are worth your time.`;
  else sub = P0.held.length ? "Nothing needs you now." : "Nothing needs you.";
  const down = !DEMO && (world.state.error || world.state.statusError) && !world.state.threads.length;
  if (down) sub = "XO can't be reached right now.";
  const hello = ph === "morning" && NIGHT.away && S.morningOpen ? "Welcome back" : ph === "night" ? "Good night" : greeting();
  patch($("#hm-head"), `<header class="hm-top"><div class="hm-hd"><p class="hm-date">${esc(date)}</p><h1 class="hm-h" id="home-h">${hello}.<span> ${sub}</span></h1></div>` +
    `<button type="button" class="create" data-create data-fid="create"><span class="create-ic">${ICON.plus}</span><span>Create XO Project</span></button></header>`);

  if (ph === "night") { homeNight(needs); return; }
  $("#home").classList.remove("is-night");

  // the morning recap: on the first visit after the night only
  patch($("#hm-moment"), ph === "morning" && S.morningOpen && NIGHT.harvest ? morningHtml(NIGHT.harvest) : "");
  const tick = $("#hm-moment .tick");
  if (tick && !NIGHT.seen) { NIGHT.seen = true; countUp(tick, +tick.dataset.to); }

  // the next move (stays put until it's done)
  const nb = $("#hm-next");
  const card0 = nb.querySelector(".next");
  const inPanel = P0.next && D.current() === P0.next.key;
  if (card0 && (card0.classList.contains("noting") || card0._busy) && P0.next && card0.dataset.key === P0.next.key) { /* don't disturb a note in progress */ }
  else if (P0.next && inPanel) {
    nb._key = null;
    patch(nb, `<p class="hm-lbl"><span class="nx-glyph">${NEXT_GLYPH}</span>${ph === "morning" ? "Your first move" : "Your next move"}</p><p class="in-panel">${ICON.arrow}<span>Open in the panel</span></p>`);
  } else if (P0.next) {
    const key = P0.next.key;
    const changed = nb._key !== key;
    const html = `<p class="hm-lbl"><span class="nx-glyph">${NEXT_GLYPH}</span>${ph === "morning" ? "Your first move" : "Your next move"}</p>` + nextCardHtml(P0.next);
    if (patch(nb, html) && changed) {
      const card = nb.querySelector(".next");
      if (nb._key && !RM.matches) card.classList.add(S.pinAnim === "undo" ? "in-undo" : "in-next");
      S.pinAnim = null;
    }
    nb._key = key;
  } else {
    nb._key = null;
    const w = working.length;
    if (down) patch(nb, `<div class="calm is-down"><div class="calm-mark">${XO}</div><h2>Can't reach XO.</h2><p>Retrying every few seconds. Nothing you write is lost; sending waits until it's back.</p></div>`);
    else patch(nb, `<div class="calm"><div class="calm-mark">${XO}</div><h2>Nothing needs you.</h2><p>${w ? `${num(w)} ${plural(w, "thread")} working. ${w === 1 ? "It'll" : "They'll"} ask when it's worth it.` : "Start something below, or enjoy the quiet."}</p></div>`);
  }

  // then… at most two more
  let then = "";
  const recap = ph === "morning" && S.morningOpen;
  if (recap && P0.then.length) {
    // on the morning's first visit the recap takes the room: the rest is one quiet line
    const k = P0.then.length + P0.more.length;
    then = `<div class="then-foot solo"><button type="button" class="hm-quiet" data-fid="more" data-open-all>+${k} more today</button></div>`;
  } else if (P0.then.length) {
    then = `<section class="then" aria-labelledby="then-h"><h2 class="hm-lbl" id="then-h">Then</h2><ol>` +
      P0.then.map((n) => `<li><button type="button" class="then-i r-${n.risk}" data-fid="then-${esc(n.key)}" data-decide="${esc(n.key)}">` +
        `<span class="eff e-${n.effort}">${dial(n.effort)}<b>${EFFORT[n.effort].label}</b></span>` +
        `<span class="ti-t">${askTitle(n)}</span>` +
        `<span class="ti-p">${n.risk === "destructive" ? `<span class="risk r-destructive">Destructive</span>` : n.group === "stopped" ? `<span class="risk r-stopped">Stopped</span>` : esc(PROJ(n.t.project))}</span>${ICON.right}</button></li>`).join("") + `</ol>`;
    const foot = [];
    if (P0.more.length) foot.push(`<button type="button" class="hm-quiet" data-fid="more" data-open-all>+${P0.more.length} more</button>`);
    if (P0.glances.length >= 2) foot.push(`<button type="button" class="hm-quiet is-glance" data-fid="glances" data-glances>${dial("glance")}Clear ${P0.glances.length} glances together</button>`);
    if (P0.later.length) foot.push(`<button type="button" class="hm-quiet is-later" data-fid="bring" data-bring>${ICON.clock}${P0.later.length} later today <span>bring back</span></button>`);
    if (foot.length) then += `<div class="then-foot">${foot.join("")}</div>`;
    then += `</section>`;
  } else if (P0.later.length) then = `<div class="then-foot solo"><button type="button" class="hm-quiet is-later" data-fid="bring" data-bring>${ICON.clock}${P0.later.length} later today <span>bring back</span></button></div>`;
  patch($("#hm-then"), then);

  // found value: never pings, at most two
  patch($("#hm-finds"), ph === "morning" && S.morningOpen ? "" : FV.shelfHtml(PROJ));

  endRender(P0, working);
}

/** The last line: Handled (with what can wait) and the end of the day. Its height never jumps. */
function endRender(P0, working) {
  const end = $("#hm-end");
  if (!end._built) {
    end.innerHTML = `<section class="handled" id="handled" aria-label="Handled"><div class="hd-row0"><div id="hd-head"></div><div id="hd-eod"></div></div><div class="hd-b" id="hd-b" hidden><div class="hd-in" id="hd-in"></div></div></section>` +
      `<section class="eod" id="eod" aria-labelledby="eod-h"><div class="eod-b" id="eod-b" hidden><div class="eod-in" id="eod-in"></div></div></section>`;
    end._built = true;
  }
  const w = working.length, held = P0.held;
  const bits = [w ? `${low(w)} working` : "nothing running", held.length ? `${low(held.length)} can wait` : ""].filter(Boolean);
  patch($("#hd-head"), `<button type="button" class="hd" data-fid="hd" data-handled aria-expanded="${S.handledOpen}" aria-controls="hd-b"><span class="hd-ic">${ICON.check}</span><span class="hd-t"><b>Handled</b> · ${bits.join(" · ")}</span>${w || held.length ? ICON.chevron : ""}</button>`);
  const evening = NIGHT.phase === "evening";
  patch($("#hd-eod"), !DEMO ? "" : `<button type="button" class="eod-btn${evening ? " is-due" : ""}" data-fid="eod" data-eod aria-expanded="${S.eodOpen}" aria-controls="eod-b" title="Queue tonight's work, then seal the day">${ICON.moon}<span>${evening ? "Before you go" : "End the day"}</span></button>`);
  if (S.handledOpen) patch($("#hd-in"), handledListHtml(P0, working));
  if (S.eodOpen) patch($("#eod-in"), eodHtml(P0));
}
function handledListHtml(P0, working) {
  const rows = working.slice().sort((a, b) => a.project.localeCompare(b.project)).map((t) => {
    const c = t.checklist, cur = c.items.find((i) => i.state === "doing");
    return `<li><button type="button" class="hd-r" data-go="t:${esc(t.id)}"><span class="hd-p">${esc(PROJ(t.project))}</span><span class="hd-tt">${t.planted ? `<span class="pl" title="Queued for tonight">${ICON.moon}</span>` : ""}${esc(t.title)}</span><span class="hd-now">${cur ? esc(cur.text) : ""}</span><span class="mini" aria-label="${c.done} of ${c.total}"><i style="--p:${c.total ? c.done / c.total : 0}"></i></span></button></li>`;
  }).join("");
  const wait = P0.held.map((n) => `<li class="cw"><span class="cw-main"><span class="cw-t">${askTitle(n)}</span><span class="cw-why">${esc(PROJ(n.t.project))} · ${esc(n.heldWhy)}</span></span><button type="button" class="cw-in" data-bring-in="${esc(n.key)}">Bring in</button></li>`).join("");
  return (rows ? `<ul class="hd-ul">${rows}</ul>` : "") + (wait ? `<h3 class="hd-k">Can wait</h3><ul class="cw-ul">${wait}</ul>` : "");
}

/** Before you go: queue tonight's work, then seal. One moment, at the day boundary. */
function eodHtml(P0) {
  const f = NIGHT.forecast();
  const seeds = NIGHT.seeds().slice(0, 3);
  const full = f.slotsLeft <= 0;
  const ships = f.ships.length;
  return `<div class="eod-card"><header class="eod-h"><span class="eod-ic">${ICON.moon}</span><div><h2 id="eod-h">Before you go</h2><p>Queue up to three things to run overnight. You'll see what got done in the morning.</p></div></header>` +
    `<ul class="seeds">${seeds.map((s) => `<li><button type="button" class="seed${s.planted ? " is-on" : ""}" data-plant="${s.id}" aria-pressed="${s.planted}"${!s.planted && full ? " disabled" : ""}>` +
      `<span class="sd-ic">${s.planted ? ICON.check : ICON.plus}</span><span class="sd-t">${esc(s.title)}</span><span class="sd-p">${esc(PROJ(s.project))}</span><span class="sd-act">${s.planted ? "Queued" : "Queue for tonight"}</span></button></li>`).join("")}</ul>` +
    `<div class="fc"><p class="fc-l"><span>By morning</span><b>${f.e ? `about ${f.lo}–${f.hi} steps` : "nothing planned"}</b>${ships ? `<span class="fc-s">· ${low(ships)} likely to finish</span>` : ""}<em>estimate</em></p>` +
    (f.gain ? `<button type="button" class="fc-gain" data-gain>${ICON.arrow}<span>Answer ${f.gainAsks.length === 1 ? "one ask" : `${low(f.gainAsks.length)} asks`} first and about ${f.gain} more steps can run</span></button>` : "") + `</div>` +
    `<footer class="eod-f"><button type="button" class="b b-seal" data-seal><span class="b-l">${ICON.moon}Seal the day</span></button><span class="eod-t">Notifications stay quiet until 9:00. Asks wait safely.</span></footer></div>`;
}

/** Night: the page goes still. The forecast you saw is the one that's sealed. */
function homeNight(needs) {
  $("#home").classList.add("is-night");
  for (const id of ["#hm-next", "#hm-then", "#hm-finds"]) { patch($(id), ""); $(id)._key = null; }
  $("#hm-end").innerHTML = ""; $("#hm-end")._built = false; $("#hm-end")._h = null;
  const sl = NIGHT.sealed;
  const f = sl.forecast;
  const working = world.state.threads.filter(isBusy).length;
  const queued = world.state.threads.filter((t) => t.planted && t.state !== "done");
  const held = needs.length;
  const until = clock(sl.until);
  patch($("#hm-moment"), `<section class="night" aria-labelledby="night-h"><div class="night-mark">${ICON.moon}</div>` +
    `<h2 id="night-h">Nothing needs you until morning.</h2><p class="night-p">Sealed until ${esc(until)}. Close the lid; the agents keep working.</p>` +
    `<dl class="night-l"><div><dt>By morning</dt><dd>about ${f.lo}–${f.hi} steps <em>estimate</em></dd></div><div><dt>Working</dt><dd>${working} ${plural(working, "agent")}</dd></div>` +
    (queued.length ? `<div><dt>Queued</dt><dd>${queued.map((t) => esc(t.title)).join(" · ")}</dd></div>` : "") +
    (held ? `<div><dt>Waiting</dt><dd>${held} ${plural(held, "ask")}, held safely</dd></div>` : "") + `</dl>` +
    `<div class="night-f"><button type="button" class="b b-sm b-back" data-morning data-fid="morning"><span class="b-l">${ICON.sun}See the morning<small>demo</small></span></button><button type="button" class="nx-link" data-unseal data-fid="unseal">Unseal</button></div></section>`);
}

/** The morning recap: what happened against what was forecast, from real state. */
function morningHtml(h) {
  const f = h.forecast;
  const verdict = h.verdict === "in" ? "in the forecast" : h.verdict === "above" ? "above the forecast" : "below the forecast";
  const lines = [];
  const sh = h.shipped.slice().sort((x, y) => (y.planted ? 1 : 0) - (x.planted ? 1 : 0));
  if (sh.length) lines.push(`<li><span class="mr-ic is-ok">${ICON.check}</span><span class="mr-t"><button type="button" class="mr-a" data-go="t:${esc(sh[0].tid)}">${esc(sh[0].title)}</button>${sh.length > 1 ? ` and ${low(sh.length - 1)} more` : ""} finished</span>${sh[0].planted ? `<span class="mr-tag">queued by you</span>` : ""}</li>`);
  const rc = h.receipts.find((r) => r.steps >= 2 || r.shipped);
  if (rc) lines.push(`<li title="An estimate: steps moved × a typical step time"><span class="mr-ic is-you">${ICON.spark}</span><span class="mr-t">Your answer on <b>${esc(rc.title)}</b> moved about ${Math.max(1, Math.round(rc.hours))} h of agent work</span></li>`);
  // only what really waits on you now
  const waiting = h.paused.filter((p) => { const t = world.thread(p.tid); return t && WAITING(t.state) && D.needItems().some((n) => n.t.id === t.id && n.admitted); });
  for (const p of waiting.slice(0, 1)) lines.push(`<li><span class="mr-ic is-ask"><i class="dia"></i></span><span class="mr-t"><b>${esc(p.title)}</b> has a question for you</span></li>`);
  const extra = FV.overflow().slice(0, 1);
  const find = extra.length ? `<ul class="fd-list mr-finds">${extra.map((x) => FV.rowHtml(x, PROJ)).join("")}</ul>` : "";
  return `<section class="morning" aria-labelledby="mr-h"><header class="mr-h"><span class="mr-sun">${ICON.sun}</span><h2 id="mr-h">${h.nights > 1 ? `While you were away · ${h.nights} nights` : "Last night"}</h2><button type="button" class="mr-x" data-morning-done aria-label="Fold the recap" title="Got it">${ICON.close}</button></header>` +
    `<div class="mr-top"><p class="mr-big"><b class="tick" data-to="${h.steps}">${h.steps}</b> steps done</p><div class="mr-vs"><p>${verdict} <span>(${f.lo}–${f.hi})</span></p>${rangeBar(f.lo, f.hi, h.steps)}</div></div>` +
    (lines.length ? `<ul class="mr-list">${lines.join("")}</ul>` : "") + find + `</section>`;
}
function rangeBar(lo, hi, actual) {
  const max = Math.max(hi, actual ?? 0, 4) * 1.25;
  const pct = (v) => `${Math.min(100, (v / max) * 100).toFixed(1)}%`;
  return `<div class="rb" aria-hidden="true"><i class="rb-band" style="left:${pct(lo)};width:calc(${pct(hi)} - ${pct(lo)})"></i>${actual != null ? `<i class="rb-mark" style="left:${pct(actual)}"></i>` : ""}</div>`;
}
function countUp(el, to) {
  if (RM.matches) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 900;
  const f = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); };
  el.textContent = "0"; requestAnimationFrame(f);
}

/** Decide straight from the Home card (Glance asks). The card stamps, then the next rises; focus lands on the new card. */
async function nextDecide(choice, note) {
  const card = $("#hm-next .next");
  if (!card || card._busy) return;
  const key = card.dataset.key;
  card._busy = true;
  card.focus({ preventScroll: true });
  if (!D.decideNow(key, choice, note)) { card._busy = false; return; }
  if (!RM.matches) { card.classList.add(choice === "deny" ? "st-back" : "st-allow"); await wait(choice === "deny" ? 260 : 300); }
  S.pin = null;
  schedule();
  requestAnimationFrame(() => requestAnimationFrame(() => { const nc = $("#hm-next .next"); if (nc && S.view === "home" && !D.isOpen()) nc.focus({ preventScroll: true }); }));
}

// ── the end of the day ──────────────────────────────────────────────────────
function toggleEod(open = !S.eodOpen) {
  S.eodOpen = open;
  const box = $("#eod");
  if (open) { S.handledOpen = false; setHandled(false); patch($("#eod-in"), eodHtml(homeParts())); }
  $("[data-eod]")?.setAttribute("aria-expanded", String(open));
  expand(box, $("#eod-b"), open);
  if (open) setTimeout(() => $("#eod")?.scrollIntoView({ block: "end", behavior: RM.matches ? "auto" : "smooth" }), 340);
}
function setHandled(open) {
  S.handledOpen = open;
  if (open) patch($("#hd-in"), handledListHtml(homeParts(), world.state.threads.filter(isBusy)));
  $("[data-handled]")?.setAttribute("aria-expanded", String(open));
  expand($("#handled"), $("#hd-b"), open);
}
function queueToggle(id) {
  const was = NIGHT.seeds().find((s) => s.id === id)?.planted;
  if (!NIGHT.plant(id)) { announce("Three is the most for one night. Remove one to swap it."); return; }
  const s = NIGHT.seeds().find((x) => x.id === id);
  announce(was ? `Removed ${s.title} from tonight.` : `Queued ${s.title} for tonight.`);
  patch($("#eod-in"), eodHtml(homeParts()));
}
async function sealDay() {
  const needs = D.needItems();
  const can = NIGHT.canSeal(needs);
  if (!can.ok) { heraldShow({ kind: "stopped", text: "Can't seal yet", sub: can.why }, 4200); return; }
  if (D.isOpen()) D.close({ restore: false });
  if (NIGHT.phase !== "evening") NIGHT.phase = "evening";
  const body = $("#hm-body");
  if (!RM.matches && body) await body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-in", fill: "forwards" }).finished;
  await NIGHT.endDay();
  P.sealed = true;
  S.eodOpen = false; S.handledOpen = false;
  sound.play("done");
  announce("Sealed until morning. Nothing will need you before then.");
  if (S.view !== "home") go("home");
  render();
  $("#home").scrollTop = 0; // while the page is faded out: the night card simply appears, nothing slides
  if (!RM.matches && body) { body.getAnimations().forEach((a) => a.cancel()); body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" }); }
  $("#home").focus({ preventScroll: true });
}
function unseal() {
  NIGHT.reopen(); P.sealed = false;
  announce("Unsealed. Asks can reach you again.");
  heraldShow({ kind: "calm", text: "Unsealed", sub: "asks can reach you again" }, 3200);
  render();
}
async function toMorning() {
  if (NIGHT.phase !== "night") return;
  const body = $("#hm-body");
  if (!RM.matches && body) await body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" }).finished;
  NIGHT.runNight(1);
  P.sealed = false;
  S.pin = null; S.morningOpen = true; NIGHT.seen = false;
  rendered = null;
  render();
  $("#home").scrollTop = 0;
  if (!RM.matches && body) { body.getAnimations().forEach((a) => a.cancel()); body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" }); }
  announce(`Good morning. ${NIGHT.harvest.steps} steps done overnight, ${NIGHT.harvest.shipped.length} finished.`);
  $("#home").focus({ preventScroll: true }); // focus stays on the page: nothing is pre-selected
}

// ── conversations ───────────────────────────────────────────────────────────
function wsSeed() {
  const y = new Date(T0 - 86400000); y.setHours(17, 42, 0, 0);
  const yd = y.getTime();
  const nightly = world.state.threads.find((t) => /nightly/i.test(t.title));
  return [
    { id: "ws1", at: yd, who: "you", text: "What shipped across projects this week?" },
    { id: "ws2", at: yd + 41000, who: "coord", text: "**This week**\n\n- **billing-api**: Stripe SDK v12 is in; the suite is green.\n- **marketing-site**: 1.2 MB of unused CSS removed.\n- **blackhole**: the HTML page is finished." },
    { id: "ws3", at: yd + 95000, who: "you", text: "Keep the backfill on hold until I've looked at the cost. And only bring me what's worth it." },
    { id: "ws4", at: yd + 120000, who: "coord", text: "Will do. I'll bring the asks that unblock the most work, bundle the small ones, and let the rest wait while their agents work around them. Destructive asks and stopped work always reach you." },
    { id: "ws5", at: T0 - 52 * 60000, who: "you", text: "Why did the nightly job fail?" },
    { id: "ws6", at: T0 - 51 * 60000, who: "coord", text: "It's the DST change. The schedule asks for 02:00 Berlin time, and on 2026-03-29 that minute didn't exist:\n\n```cron\n0 2 * * *  /opt/etl/nightly.sh --tz Europe/Berlin\n```\n\nI've routed it to **data-pipeline**.", thread: nightly?.id },
  ];
}
let WS_SEED = null;
const COORD_LINES = [
  (t) => `On it. I started a thread${t.branch ? ` on \`${t.branch}\`` : ""}.`,
  (t) => `Starting a thread${t.branch ? ` on \`${t.branch}\`` : ""}. It'll only come to you if it's worth your time.`,
  (t) => `A thread is on it${t.branch ? ` (\`${t.branch}\`)` : ""}.`,
];

/** The chat behind a conversation: "ws" → workspace, "p:x" → x (threads use their project). */
const chatOf = (conv) => (conv === "ws" || conv === "home" ? "workspace" : conv.startsWith("p:") ? conv.slice(2) : convThread(conv)?.project || null);
const convOfChat = (chat) => (chat === "workspace" ? "ws" : "p:" + chat);

/** Live: the real timeline (workspace or project) or the thread's own messages, with its root first. */
function liveMessagesOf(conv) {
  const out = [];
  const t = convThread(conv);
  const chat = chatOf(conv);
  const st = world.state;
  const h = chat ? st.hist[chat] : null;
  let rows;
  if (t) {
    const root = (st.timeline[t.project] || []).find((r) => r.id === t.id);
    rows = [...(root ? [uiMsg(root)] : []), ...t.messages];
  } else rows = (st.timeline[chat] || []).map(uiMsg);
  // optimistic rows whose server copy arrived first (the stream can beat the POST): the bubble stays, once
  const locals = S.local[conv] || [];
  for (const [lid, sid] of echoes(locals, rows, new Set(S.alias.keys()))) {
    S.alias.set(sid, lid);
    const m = locals.find((x) => x.id === lid);
    m.merged = true; m.status = "sent";
  }
  if (!t && h) {
    if (h.error && !rows.length) out.push({ key: "note", at: -Infinity, who: "note", text: `Couldn't load this conversation: ${h.error} Retrying.` });
    else if (h.loading && !rows.length) out.push({ key: "note", at: -Infinity, who: "note", text: "Loading the conversation…" });
    else if (rows.length || h.loading) out.push({ key: "hist", at: -Infinity, who: "hist", h });
  }
  const ids = t ? [] : world.state.threads.filter((x) => x.project === chat).map((x) => x.id);
  const { on, alone } = threadAnchors(rows, ids);
  for (const m of rows) {
    const key = S.alias.get(m.id) || m.id;
    const base = { key, at: m.at, seq: m.seq, text: m.text, sent: S.alias.has(m.id) };
    if (m.who === "you") {
      out.push({ ...base, who: "you", fwd: conv !== "ws" && m.fwd ? m.fwd : null, routed: conv === "ws" ? st.routed[m.id] || null : null });
      if (alone.has(m.id)) out.push({ key: `${m.id}:card`, at: m.at, who: "card", thread: m.id });
    } else if (m.who === "system") out.push({ ...base, who: "system" });
    else if (t && m.who === "agent" && /^✓\s/.test(m.text)) out.push({ key, at: m.at, who: "event", text: m.text.replace(/^✓\s*/, ""), tone: "ok" });
    else out.push({ ...base, who: m.who === "coord" ? "coord" : "agent", threads: on.get(m.id) || null });
  }
  if (conv.startsWith("p:")) {
    const pid = conv.slice(2);
    for (const x of threadsOf(pid)) {
      if (x.state === "done") out.push({ key: `${x.id}:done`, at: x.lastAt, who: "event", text: `${x.title} finished`, tone: "ok" });
      if (x.state === "failed") out.push({ key: `${x.id}:failed`, at: x.lastAt, who: "event", text: `${x.title} stopped`, tone: "stop" });
    }
    for (const d of D.decisions().filter((d) => d.project === pid)) out.push({ key: `dec:${d.id}`, at: d.at, who: "event", text: `You ${d.verb.toLowerCase()} · ${d.said || d.label}`, tone: d.choice === "deny" ? "back" : "ok" });
    for (const d of D.notSent().filter((d) => d.project === pid)) out.push({ key: `dec:${d.id}`, at: d.at, who: "event", text: `Not sent · ${d.said || d.label} · ${d.why}`, tone: "sys" });
  }
  // a thread's work: its session's turns, in place between its messages (storm's blocks)
  if (t && t.sessionId && st.turns) {
    const agentSeqs = rows.filter((m) => m.who === "agent" && m.seq != null).map((m) => m.seq);
    for (const tu of st.turns.list((x) => x.session === t.sessionId)) {
      const blocks = st.turns.blocksOf(tu);
      const said = agentSeqs.some((q) => q >= (tu.seq ?? Infinity) && q <= (tu.lastSeq || Infinity));
      out.push({ key: `turn:${tu.id}`, at: Date.parse(tu.at) || Date.now(), seq: tu.seq, who: "turn", turn: tu, blocks, hideAnswer: said });
    }
  }
  // your messages relayed into this thread by its coordinator (if1 #7): the relay hop names them, and they
  // stay on the project's timeline (storm doesn't copy them), so they're shown here in place, whatever the
  // hops setting, marked as passed on, linking back to where you wrote them
  if (t && st.hops) {
    const { shown, missing } = relayedInto(t, st.hops.values(), st.timeline[t.project] || [], new Set(rows.map((m) => m.id)));
    for (const m of shown) out.push({ key: `relay:${m.id}`, at: m.at, seq: m.seq, who: "you", text: m.text, relay: { project: t.project, id: m.id, fwd: m.fwd } });
    if (world.act.findRows) for (const x of missing) world.act.findRows(t.project, x.ids, x.seq);
  }
  // how messages travelled to and from this thread (11 §16): hidden by default, shown by choice
  if (t && S.showHops && st.hops) {
    for (const hp of st.hops.values()) {
      if (hp.thread_ts !== t.id) continue;
      const text = hopLine(hp, PROJ(t.project));
      if (text) out.push({ key: `hop:${hp.id}`, at: Date.parse(hp.at || hp.created_at) || 0, seq: hp.seq ?? null, who: "system", text });
    }
  }
  // the coordinator's turn for your message failed: say so where you'll look (GitHub #30)
  const fail = !t && chat ? st.failed && st.failed[chat] : null;
  if (fail) out.push({ key: `fail:${fail.id}`, at: fail.at, who: "event", tone: "stop", text: `The coordinator couldn't answer: ${fail.error}` });
  if (!rows.length && !locals.length && !(h && (h.loading || h.error))) {
    out.push({ key: "empty", at: -Infinity, who: "note", text: t ? "No messages in this thread yet." : conv === "ws" ? "No messages yet. Ask the coordinator anything below." : "No messages yet. Tell this project's coordinator what you'd like done." });
  }
  out.push(...locals.filter((m) => !m.merged).map((m) => ({ ...m, key: m.id })));
  // storm's seq orders what the server stored; the rest (your unsent rows, notes, events) is
  // merged in by time. Two sorted lists and one stable merge: a total order, so nothing jumps.
  const stored = out.filter((m) => m.seq != null).sort((a, b) => a.seq - b.seq);
  const rest = out.filter((m) => m.seq == null).sort((a, b) => a.at - b.at);
  const merged = [];
  let i = 0;
  for (const m of stored) {
    while (i < rest.length && rest[i].at < m.at) merged.push(rest[i++]);
    merged.push(m);
  }
  while (i < rest.length) merged.push(rest[i++]);
  return merged;
}

/** One hop as a quiet line (11 §16.2's labels). Their content stays theirs: we say who, not what. */
function messagesOf(conv, needs) {
  if (!DEMO) return liveMessagesOf(conv);
  const out = [];
  if (conv === "ws") {
    WS_SEED = WS_SEED || (DEMO ? wsSeed() : []);
    out.push(...WS_SEED.map((m) => ({ ...m, key: m.id })));
  } else if (conv.startsWith("p:")) {
    const pid = conv.slice(2);
    const ts = threadsOf(pid).filter((t) => !String(t.id).startsWith("many_")).sort((a, b) => a.createdAt - b.createdAt);
    ts.forEach((t, i) => {
      if (DEMO && S.localThread.get(t.id) !== conv) {
        const req = t.messages.find((m) => m.who === "you");
        if (req) {
          out.push({ key: `${t.id}:req`, at: t.createdAt, who: "you", text: req.text });
          out.push({ key: `${t.id}:start`, at: t.createdAt + (t.createdAt < T0 ? 20000 : 1), who: "coord", text: COORD_LINES[i % 3](t), thread: t.id });
        } else out.push({ key: `${t.id}:start`, at: t.createdAt, who: "coord", text: "I noticed something worth doing and started a thread.", thread: t.id });
      }
      if (t.state === "done") out.push({ key: `${t.id}:done`, at: t.lastAt, who: "event", text: `${t.title} finished`, tone: "ok" });
      if (t.state === "failed") out.push({ key: `${t.id}:failed`, at: t.lastAt, who: "event", text: `${t.title} stopped: ${String(t.happened || "").replace(/^Stopped:\s*/i, "")}`, tone: "stop" });
    });
    for (const d of D.decisions().filter((d) => d.project === pid)) out.push({ key: `dec:${d.id}`, at: d.at, who: "event", text: `You ${d.verb.toLowerCase()} · ${d.said || d.label}${d.fromSug ? " · as suggested" : ""}`, tone: d.choice === "deny" ? "back" : "ok" });
    for (const d of D.notSent().filter((d) => d.project === pid)) out.push({ key: `dec:${d.id}`, at: d.at, who: "event", text: `Not sent · ${d.said || d.label} · ${d.why}`, tone: "sys" });
  } else {
    const t = convThread(conv);
    if (t) {
      for (const m of t.messages) {
        const key = S.alias.get(m.id) || m.id;
        if (m.who === "agent" && /^✓\s/.test(m.text)) out.push({ key, at: m.at, who: "event", text: m.text.replace(/^✓\s*/, ""), tone: "ok" });
        else if (m.stopLine) out.push({ key, at: m.at, who: "event", text: m.text, tone: "back" });
        else out.push({ key, at: m.at, who: m.who === "you" ? "you" : "agent", text: m.text, sent: S.alias.has(m.id) });
      }
    }
  }
  out.push(...(S.local[conv] || []).filter((m) => !m.merged).map((m) => ({ ...m, key: m.id })));
  out.sort((a, b) => a.at - b.at);
  return out;
}

function threadCardHtml(tid, needs) {
  const t = world.thread(tid);
  if (!t) return "";
  const c = t.checklist;
  const n = needs.find((x) => x.t.id === t.id && x.admitted);
  const heldN = !n ? needs.find((x) => x.t.id === t.id && x.held) : null;
  const cur = c.items.find((i) => i.state === "doing") || c.items.find((i) => i.state === "todo");
  const segs = c.items.map((i) => `<i class="sg s-${i.state}"></i>`).join("");
  const st = n ? `Needs you · ${EFFORT[n.effort].time}` : isBusy(t) ? `Working${c.total ? ` · ${c.done} of ${c.total}` : ""}` : t.state === "done" ? `Done${c.total ? ` · ${c.total} of ${c.total}` : ""}` : wordOf(t);
  const now = n ? `◆ ${askTitle(n)}` : isBusy(t) && cur ? `✱ ${esc(cur.text)}` : t.state === "failed" ? esc(String(t.happened || "").replace(/^Stopped:\s*/i, "")) : t.state === "done" ? esc(t.happened || "Finished.") : "";
  return `<div class="tcard st-${n ? "needs" : t.state}">` +
    `<button type="button" class="tc-open" data-go="t:${esc(t.id)}" aria-label="Open thread: ${esc(t.title)}, ${esc(st)}">` +
    `<span class="tc-top"><i class="g g-${n ? "needs_reply" : glyphOf(t)}" aria-hidden="true"></i><b>${esc(t.title)}</b><span class="tc-st">${esc(st)}</span></span>` +
    `<span class="tc-segs" aria-hidden="true">${segs}</span>` +
    (now ? `<span class="tc-now">${now}</span>` : "") +
    `<span class="tc-foot">${t.branch ? `<code>${esc(t.branch)}</code>` : `<span>thread</span>`}${heldN ? `<span class="tc-cw">a small ask can wait</span>` : ""}<span>${short(t.lastAt) === "now" ? "just now" : short(t.lastAt) + " ago"}</span><span class="tc-go">Open ${ICON.arrow}</span></span></button>` +
    (n ? `<button type="button" class="tc-dec" data-decide="${esc(n.key)}">Decide</button>` : "") + `</div>`;
}

function nameOf(conv, who) {
  if (who === "coord") return [conv === "ws" ? "Coordinator" : `${PROJ(convProject(conv))} coordinator`, ""];
  const t = convThread(conv);
  return [t ? `${PROJ(t.project)} agent` : "Agent", t?.branch || "thread"];
}

function msgItems(conv, needs) {
  if (CH.isChats(conv)) return CH.items(conv);
  const list = messagesOf(conv, needs);
  const items = [];
  let day = "", prev = null;
  const lastYou = [...list].reverse().find((m) => m.who === "you");
  for (const m of list) {
    const d = Number.isFinite(m.at) ? dayOf(m.at) : day;
    if (d !== day) { items.push({ key: "day|" + d, html: `<div class="day" role="separator"><span>${esc(d)}</span></div>` }); day = d; prev = null; }
    const cont = prev && prev.who === m.who && m.at - prev.at < 5 * 60000 && (m.who === "you" || m.who === "coord" || m.who === "agent");
    let html = "";
    if (m.who === "you") {
      let meta = "";
      if (m.status === "sending") meta = `<div class="meta"><i class="spin" aria-hidden="true"></i>Sending</div>`;
      else if (m.status === "failed") meta = `<div class="meta is-err"><span${m.err ? ` title="${esc(m.err.text)}"` : ""}>${m.err ? esc(m.err.title) : "Not sent"}</span><button type="button" class="meta-btn" data-retry="${esc(m.id)}">${ICON.retry}Retry</button><button type="button" class="meta-btn" data-edit="${esc(m.id)}">${ICON.edit}Edit</button></div>`;
      else if (m === lastYou && (m.status === "sent" || m.sent)) meta = `<div class="meta"><time>${clock(m.at)}</time><span class="sent">Sent ${ICON.check}</span></div>`;
      let route = "";
      if (m.waiting) route = `<div class="route-row"><i class="dash" aria-hidden="true"></i>Sent to <b>${esc(m.target === "workspace" ? "the coordinator" : PROJ(m.target))}</b> · waiting for a thread</div>`;
      else if (m.relay) {
        // passed on into this thread: say from where, and go back there (to the message itself)
        const r = m.relay, P = PROJ(r.project);
        route = r.fwd
          ? `<div class="route-row">${ICON.arrow}<span>You, in the <button type="button" class="rt-go" data-go="ws" data-go-msg="${esc(r.fwd.id)}" title="Where you wrote it"><b>Workspace</b></button> · passed on by ${esc(P)}'s coordinator</span></div>`
          : `<div class="route-row">${ICON.arrow}<span>You, in <button type="button" class="rt-go" data-go="p:${esc(r.project)}" data-go-msg="${esc(r.id)}" title="Where you wrote it"><b>${esc(P)}'s chat</b></button> · passed on by the coordinator</span></div>`;
      }
      else if (m.fwd) route = `<div class="route-row">${ICON.arrow}<span>Forwarded by the <button type="button" class="rt-go" data-go="ws"><b>Workspace</b></button></span></div>`;
      else if (m.routed && m.routed.length) route = `<div class="route-row">${ICON.arrow}<span>Routed to ${[...new Set(m.routed.map((r) => r.chat))].map((c) => `<button type="button" class="rt-go" data-go="p:${esc(c)}"><b>${esc(PROJ(c))}</b></button>`).join(", ")}</span></div>`;
      html = `<div class="m m-you${cont ? " cont" : ""}${m.relay ? " is-relay" : ""}${m.status === "failed" ? " is-failed" : ""}${m.status === "sending" ? " is-pending" : ""}"><div class="bubble" title="${esc(clock(m.at))}">${esc(m.text)}</div>${meta}${route}</div>`;
    } else if (m.who === "coord" || m.who === "agent") {
      const [name, role] = nameOf(conv, m.who);
      const av = m.who === "coord" ? `<div class="av">${XO}</div>` : `<div class="av av-t">${ICON.thread}</div>`;
      const tid = m.thread || m.threadId;
      const iq = m.iq ? `<span class="m-iq" title="${m.iq.src === "pinned" ? "Pinned for this conversation" : `Chosen by the ${esc(m.iq.src)}`}">${esc(m.iq.name)} ${m.iq.pips} · ${esc(m.iq.src)}</span>` : "";
      html = `<div class="m m-them${cont ? " cont" : ""}">${cont ? `<div class="av av-gap"></div>` : av}<div class="mb">` +
        (cont ? "" : `<div class="mh"><b>${esc(name)}</b>${role ? `<span class="role">${esc(role)}</span>` : ""}<time>${clock(m.at)}</time>${iq}</div>`) +
        `<div class="prose">${renderMarkdown(m.text)}</div>${tid ? threadCardHtml(tid, needs) : ""}${(m.threads || []).map((x) => threadCardHtml(x, needs)).join("")}</div></div>`;
    } else if (m.who === "turn") {
      const inner = turnHtml(m.turn, m.blocks, { open: S.tbOpen, hideAnswer: m.hideAnswer });
      if (!inner) { prev = m; continue; }
      html = `<div class="m m-them m-turn"><div class="av av-gap"></div><div class="mb">${inner}</div></div>`;
    } else if (m.who === "card") {
      html = `<div class="m m-them m-card"><div class="av av-gap"></div><div class="mb">${threadCardHtml(m.thread, needs)}</div></div>`;
    } else if (m.who === "system") {
      html = `<div class="ev ev-sys" title="${esc(m.text)}"><span class="ev-ic">${ICON.router}</span><span class="ev-t">${esc(m.text)}</span><time>${clock(m.at)}</time></div>`;
    } else if (m.who === "note") {
      html = `<p class="m-note">${esc(m.text)}</p>`;
    } else if (m.who === "hist") {
      const h = m.h;
      html = `<div class="day hist" role="separator">${h.loading ? `<span><i class="spin" aria-hidden="true"></i>Loading earlier messages…</span>` : h.all ? `<span>${h.capped ? "Showing the latest 1,000 messages" : "Beginning of the conversation"}</span>` : `<button type="button" class="hist-more" data-older>Earlier messages</button>`}</div>`;
    } else if (m.who === "event") {
      html = `<div class="ev ev-${m.tone || "ok"}"><span class="ev-ic">${m.tone === "back" ? ICON.rewind : m.tone === "stop" ? ICON.close : m.tone === "sys" ? ICON.pause : ICON.check}</span><span class="ev-t">${esc(m.text)}</span><time>${clock(m.at)}</time></div>`;
    } else if (m.who === "rec") {
      const canUndo = m.undo && Date.now() < m.until;
      html = `<div class="ev ev-rec${m.refused ? " is-refused" : ""}"><span class="ev-ic">${m.refused ? ICON.close : ICON.router}</span><span class="ev-t">${esc(m.text)}</span>${canUndo ? `<button type="button" class="ev-undo" data-rec-undo="${esc(m.id)}">Undo</button>` : ""}<time>${clock(m.at)}</time></div>`;
    }
    items.push({ key: m.key, html });
    prev = m;
  }
  return items;
}

// ── headers: Workspace, project (title + one sentence + the Now shelf), thread (+ checklist) ──
function wsHeadRender(needs) {
  const box = $("#ws-head");
  if (S.view !== "ws") { box.hidden = true; return; }
  box.hidden = false;
  const P0 = homeParts(needs);
  const working = world.state.threads.filter(isBusy).length;
  const nd = sealed() ? 0 : P0.active.length;
  // GitHub #32: an open thread whose agent sits idle and asks nothing is "Idle", so every open thread counts once
  const asking = new Set(needs.map((n) => n.t.id));
  const idle = world.state.threads.filter((t) => t.state === "working" && !isBusy(t) && !asking.has(t.id)).length;
  const rs = R.rules();
  const html = `<div class="wsh"><div class="wsh-mark">${XO}</div><h1 class="wsh-h" id="conv-title">Workspace</h1>` +
    `<p class="wsh-p">Your coordinator, across all ${projects().length} projects.</p>` +
    `<dl class="wsh-stats"><div><dt>Working</dt><dd>${working}</dd></div><div><dt>Need you</dt><dd class="${nd ? "is-amber" : ""}">${nd}</dd></div><div><dt>Can wait</dt><dd>${P0.held.length}</dd></div>${idle ? `<div><dt>Idle</dt><dd>${idle}</dd></div>` : ""}<div><dt>Finished today</dt><dd class="is-green">${doneToday().length}</dd></div></dl>` +
    (sealed() ? `<p class="wsh-calm">${ICON.moon}Sealed until morning. Ask for anything; nothing will ask you back tonight.</p>`
      : P0.next ? `<button type="button" class="wsh-next" data-decide="${esc(P0.next.key)}"><span class="nx-glyph">${NEXT_GLYPH}</span><span class="wn-k">Next move</span><span class="wn-t">${askTitle(P0.next)}</span><span class="eff e-${P0.next.effort}">${dial(P0.next.effort)}<b>${EFFORT[P0.next.effort].label}</b></span></button>`
      : `<p class="wsh-calm">${ICON.check}Nothing needs you. Ask for anything below.</p>`) +
    (!DEMO ? "" : `<section class="rules${S.rulesOpen ? " is-open" : ""}" id="rules"><button type="button" class="rl-h" data-rules aria-expanded="${S.rulesOpen}" aria-controls="rl-b">${ICON.rule}<span><b>${rs.length} ${plural(rs.length, "rule")}</b> answered ${R.absorbedTotal()} asks for you</span>${ICON.chevron}</button>` +
    `<div class="rl-b" id="rl-b"${S.rulesOpen ? "" : " hidden"}><ul class="rl-ul">${rs.map((r) => `<li${r.fresh ? ' class="is-fresh"' : ""}><q>${esc(r.text)}</q><span>${r.absorbed} answered</span></li>`).join("")}</ul></div></section>`) + `</div>`;
  patch(box, html);
}

function topRender(needs) {
  const v = S.view;
  const t = convThread(v);
  const top = $("#top");
  top.dataset.kind = v === "ws" ? "ws" : t ? "thread" : "project";
  // a thin state line along the thread's header: amber needs you, blue working, green done, red stopped
  top.dataset.state = !t ? "" : needs.some((n) => n.t.id === t.id && n.admitted) ? "need" : t.state === "failed" ? "stop" : isBusy(t) ? "busy" : t.state === "done" || t.state === "resolved" ? "done" : "";
  const back = $("#top-back");
  back.hidden = !t;
  if (CH.isChats(v)) {
    // Chats: the list, or one chat with its way back to the list
    top.dataset.kind = v === "chats" ? "project" : "thread";
    back.hidden = v === "chats";
    if (v !== "chats") { back.innerHTML = `${ICON.back}<span>Chats</span>`; back.setAttribute("aria-label", "Back to Chats"); back.title = "Back (Esc)"; }
    patch($("#top-who"), CH.headHtml(v));
    patch($("#top-end"), "");
    nowRender(needs); checklistRender(needs);
    return;
  }
  if (t) {
    const to = S.parent[v] || "p:" + t.project;
    const name = to === "home" ? "Home" : to === "ws" ? "Workspace" : PROJ(to.slice(2));
    back.innerHTML = `${ICON.back}<span>${esc(name)}</span>`;
    back.setAttribute("aria-label", `Back to ${name}`);
    back.title = "Back (Esc)";
  }
  let who, end = "";
  if (v === "ws") who = `<span class="tw-mini">${XO}</span><span class="tw-t"><b>Workspace</b></span>`;
  else if (v.startsWith("p:")) {
    const pid = v.slice(2);
    const ts = threadsOf(pid);
    const every = world.state.threads.filter((x) => x.project === pid); // resolved ones too: findable, reopenable
    const nd = sealed() ? 0 : needs.filter((n) => n.t.project === pid && n.admitted && !n.later).length;
    const w = ts.filter(isBusy).length;
    const dn = ts.filter((x) => x.state === "done").length;
    const rs = every.length - ts.length;
    const parts = [nd && `<b class="is-amber">${nd} need${nd === 1 ? "s" : ""} you</b>`, w && `${w} working`, dn && `${dn} done this week`, rs && `${rs} resolved`].filter(Boolean);
    who = `<span class="tw-ic" aria-hidden="true">${ICON.project}</span><span class="tw-t"><h1 id="conv-title">${esc(PROJ(pid))}</h1><span class="pj-s">${parts.join(" · ") || (every.length ? "All quiet" : "No threads yet")}${S.desc[pid] ? ` · ${esc(S.desc[pid])}` : ""}</span></span>`;
    end = every.length ? `<button type="button" class="all-btn" data-all-threads aria-haspopup="dialog" title="All threads">All threads<span>${every.length}</span></button>` : "";
  } else if (t) {
    const ed = S.tEdit && S.tEdit.tid === t.id ? S.tEdit.field : null;
    const title = ed === "title"
      ? `<input class="tw-in tw-in-t" id="tw-edit" data-tedit="title" maxlength="120" value="${esc(t.title)}" aria-label="Thread name">`
      : `<h1 class="tw-h" id="conv-title">${esc(t.title)}</h1>`;
    const label = ed === "label"
      ? `<input class="tw-in tw-in-l" id="tw-edit" data-tedit="label" maxlength="32" value="${esc(t.label || "")}" placeholder="A short label" aria-label="Label">`
      : t.label ? `<span class="tw-label" title="Label">${esc(t.label)}</span>` : "";
    const resolved = t.state === "resolved";
    const acts = !DEMO && world.act.storm ? `<span class="tw-acts"><button type="button" class="tw-act" data-resolve="${esc(t.id)}" data-to="${resolved ? "open" : "resolve"}" title="${resolved ? "Reopen it: its agent can pick it up again" : "Mark it resolved: nothing more is owed"}">${resolved ? ICON.retry : ICON.check}<span>${resolved ? "Reopen" : "Resolve"}</span></button>` +
      `<button type="button" class="tw-act tw-more" data-tmenu="${esc(t.id)}" aria-haspopup="menu" aria-expanded="${S.tMenu === t.id}" title="Rename or label" aria-label="Rename or label">${ICON.edit}</button>` +
      (S.tMenu === t.id ? `<span class="tw-menu" role="menu"><button type="button" role="menuitem" data-tfield="title">Rename</button><button type="button" role="menuitem" data-tfield="label">${t.label ? "Change label" : "Add a label"}</button>${t.label ? `<button type="button" role="menuitem" data-tfield="clear-label">Remove the label</button>` : ""}</span>` : "") + `</span>` : "";
    who = `${title}${label}<span class="badge st-${t.state}"><i class="g g-${glyphOf(t)}" aria-hidden="true"></i>${wordOf(t)}</span>${acts}`;
    // a field being edited is never replaced under the person's fingers (a frame may change the badge)
    if (ed && $("#tw-edit")) who = null;
  } else who = `<span class="tw-t"><h1 id="conv-title">Thread</h1></span>`;
  if (who != null) patch($("#top-who"), who);
  patch($("#top-end"), end);
  nowRender(needs);
  checklistRender(needs);
}

/** The Now strip, in the header row: every thread in progress as one slim chip (its state, its
 *  name, its progress), needs-you first, then stopped, then working. One line high; it scrolls
 *  sideways instead of growing. What each one is waiting on is said in the conversation below. */
function nowRender(needs) {
  const wrap = $("#now-wrap");
  const v = S.view;
  const pid = v.startsWith("p:") ? v.slice(2) : null;
  if (!pid) { wrap.hidden = true; return; }
  const ts = threadsOf(pid);
  const need = (t) => (sealed() ? null : needs.find((x) => x.t.id === t.id && x.admitted && !x.later));
  const rankT = (t) => (need(t) ? 0 : t.state === "failed" ? 1 : t.state === "working" ? 2 : 9);
  const shelf = ts.filter((t) => rankT(t) < 9).sort((a, b) => rankT(a) - rankT(b) || b.lastAt - a.lastAt);
  wrap.hidden = !shelf.length;
  if (!shelf.length) return;
  const items = shelf.map((t) => {
    const c = t.checklist, n = need(t);
    const st = n ? "needs" : glyphOf(t);
    const what = n ? `needs you: ${askShort(n)}` : t.state === "failed" ? String(t.happened || "Stopped") : wordOf(t).toLowerCase();
    return `<button type="button" class="nw st-${st}" role="listitem" data-go="t:${esc(t.id)}" title="${esc(`${t.title} · ${c.done} of ${c.total} · ${what}`)}" aria-label="${esc(t.title)}, ${n ? "needs you" : wordOf(t).toLowerCase()}, ${c.done} of ${c.total}">` +
      `<i class="g g-${n ? "needs_reply" : glyphOf(t)}" aria-hidden="true"></i><b>${esc(t.title)}</b>` +
      `<span class="nw-segs" aria-hidden="true">${c.items.map((i) => `<i class="sg s-${i.state}"></i>`).join("")}</span></button>`;
  }).join("");
  patch(wrap, `<div class="now" role="list" aria-label="Now in ${esc(PROJ(pid))}">${items}</div>`);
  nowEdges();
}
/** Fade the strip's edges only where there is more to scroll to. */
function nowEdges() {
  const now = $("#now-wrap .now");
  if (!now) return;
  const more = now.scrollWidth - now.clientWidth > 2;
  now.classList.toggle("fade-l", more && now.scrollLeft > 2);
  now.classList.toggle("fade-r", more && now.scrollLeft < now.scrollWidth - now.clientWidth - 2);
}
$("#now-wrap").addEventListener("scroll", nowEdges, { passive: true, capture: true });
$("#now-wrap").addEventListener("wheel", (e) => {
  // a mouse wheel scrolls the strip sideways
  const now = e.target.closest(".now");
  if (!now || Math.abs(e.deltaX) > Math.abs(e.deltaY) || now.scrollWidth <= now.clientWidth) return;
  e.preventDefault();
  now.scrollLeft += e.deltaY;
}, { passive: false });
addEventListener("resize", () => nowEdges());

/** The checklist bar: shows the step in progress; a finished step flashes its tick, then moves on. */
function checklistRender(needs) {
  const th = $("#thead");
  const t = convThread(S.view);
  if (!t) { th.hidden = true; th._h = ""; return; }
  th.hidden = false;
  const c = t.checklist;
  const open = !!S.ckOpen[t.id];
  const seen = S.ckSeen[t.id];
  if (seen != null && c.done > seen) {
    const doneStep = c.items[c.done - 1];
    S.ckFresh = { tid: t.id, text: doneStep ? doneStep.text : "Step done", until: Date.now() + 1500 };
    setTimeout(schedule, 1560);
  }
  S.ckSeen[t.id] = c.done;
  const fresh = S.ckFresh && S.ckFresh.tid === t.id && S.ckFresh.until > Date.now() ? S.ckFresh : null;
  const n = needs.find((x) => x.t.id === t.id);
  const cur = c.items.find((i) => i.state === "doing") || c.items.find((i) => i.state === "todo");
  let mode = "working", nowHtml;
  if (fresh) { mode = "fresh"; nowHtml = `<span class="ck-m is-ok">${ICON.check}</span><span>${esc(fresh.text)}</span>`; }
  else if (n && WAITING(t.state)) { mode = "needs"; nowHtml = `<span class="ck-m is-amber">◆</span><span>Paused on you</span>`; }
  else if (t.state === "failed") { mode = "failed"; nowHtml = `<span class="ck-m is-red">■</span><span>Stopped at “${esc(cur ? cur.text : "a step")}”</span>`; }
  else if (c.done >= c.total) { mode = "done"; nowHtml = `<span class="ck-m is-ok">${ICON.check}</span><span>All ${c.total} steps done</span>`; }
  else if (t.state === "resolved") { mode = "done"; nowHtml = `<span class="ck-m">■</span><span>${DEMO ? "Stopped by you" : "Resolved"} at ${c.done} of ${c.total}</span>`; }
  else nowHtml = `<span class="ck-m is-blue">✱</span><span>${esc(cur ? cur.text : "Working")}</span>`;
  const segs = c.items.map((i, k) => `<i class="sg s-${i.state}${fresh && k === c.done - 1 ? " is-pop" : ""}"></i>`).join("");
  const list = c.items.map((i) => `<li class="ck ck-${i.state}"><span class="ck-m" aria-hidden="true">${i.state === "done" ? "✓" : i.state === "doing" ? "✱" : "○"}</span><span>${esc(i.text)}</span><span class="sr-only">, ${i.state === "doing" ? "in progress" : i.state}</span></li>`).join("");
  const html = `<div class="ckbar m-${mode}${open ? " is-open" : ""}">` +
    `<div class="ck-row"><button type="button" class="ck-tog" data-ck aria-expanded="${open}" aria-controls="ck-list" title="Checklist">` +
    `<span class="ck-segs" aria-hidden="true">${segs}</span><span class="ck-n">${c.done} of ${c.total}</span>` +
    `<span class="ck-now" data-mode="${mode}">${nowHtml}</span>${t.branch ? `<code class="ck-br">${ICON.branch}${esc(t.branch)}</code>` : ""}<span class="ck-chev">${ICON.chevron}</span></button></div>` +
    `<div class="ck-b"><ol class="ck-list" id="ck-list" aria-label="Checklist">${list}</ol></div></div>`;
  patch(th, html + runsStrip(t));
}

// ── sub-agents (U2, ch 14 §11): working now under the checklist; the list and each run in a sheet ──
const LIVE_RUN = (r) => r.state === "running" || r.state === "waiting";
const runsAsked = new Map(); // session → the working count its runs were last listed for
function runsStrip(t) {
  if (DEMO || !t.sessionId || !world.state.runs) return "";
  const mine = [...world.state.runs.values()].filter((r) => r.session === t.sessionId && !r.hidden);
  const live = mine.filter((r) => LIVE_RUN(r) && (r.depth || 1) === 1);
  // after a reload the stream hasn't named the runs still working: the thread's counts know, so list them
  const lr = (world.state.liveRuns || {})[t.sessionId];
  const working = Math.max((t.runs && (t.runs.running || 0) + (t.runs.waiting || 0)) || 0, lr ? lr.running + lr.waiting : 0, (t.session && t.session.live_runs) || 0);
  // asked once per count: if the thread's counts stay stale after a read, the read isn't repeated
  if (working > mine.filter(LIVE_RUN).length && runsAsked.get(t.sessionId) !== working) {
    runsAsked.set(t.sessionId, working);
    world.act.listRuns(t.sessionId).then(() => schedule(), () => {});
  }
  const total = Math.max((t.runs && t.runs.total) || 0, mine.length);
  return runsStripHtml(live, total);
}
const runsEl = $("#runs"), runsCard = $("#runs-card");
const RS = { gen: 0, open: false, session: null, title: "", view: "list", tree: [], counts: null, runId: null, run: null, anc: null, items: [], cursor: null, children: [], loading: false, error: null, gone: null, pollT: null, returnTo: null };
const canStopRuns = () => !!(RS.session && world.act.feature && world.act.feature(RS.session, "runs.stop"));
function runsRender() {
  if (!RS.open) return;
  const html = RS.view === "list"
    ? runsListHtml(RS.tree, RS.counts, { canStop: canStopRuns(), title: RS.title })
    : runViewHtml(RS.run || { id: RS.runId, title: "Sub-agent", state: "running" }, { anc: RS.anc, items: RS.items, children: RS.children, canStop: canStopRuns(), gone: RS.gone, error: RS.error, loading: RS.loading, open: S.tbOpen });
  if (runsCard._h !== html) {
    const body = runsCard.querySelector(".rn-body");
    const keep = body ? body.scrollTop : 0;
    runsCard.innerHTML = html; runsCard._h = html;
    for (const x of runsCard.querySelectorAll("[data-close]")) x.innerHTML = ICON.close;
    const nb = runsCard.querySelector(".rn-body");
    if (nb && RS.keepScroll) nb.scrollTop = keep;
    // a re-render must not drop focus out of the sheet (Escape, Tab stay inside it)
    if (!runsEl.contains(document.activeElement)) runsCard.focus({ preventScroll: true });
  }
}
function runsEscape() { if (RS.view === "run") { RS.gen++; RS.view = "list"; RS.runId = null; clearTimeout(RS.pollT); RS.keepScroll = false; runsRender(); } else closeRuns(); }
async function openRuns(t, runId = null) {
  if (!t || !t.sessionId) return;
  if (!RS.open) RS.returnTo = document.activeElement;
  Object.assign(RS, { open: true, session: t.sessionId, title: t.title, view: runId ? "run" : "list", runId, keepScroll: false });
  runsEl.hidden = false;
  runsRender();
  try {
    const d = await world.act.listRuns(t.sessionId);
    RS.tree = d.runs || []; RS.counts = d.counts || null;
  } catch (err) { RS.error = err.message; }
  if (runId) openRun(runId); else { runsRender(); runsCard.querySelector(".rn-open, [data-close]")?.focus(); }
}
async function openRun(id) {
  clearTimeout(RS.pollT);
  const gen = ++RS.gen; // a read for another run (or a closed sheet) never writes into this one
  Object.assign(RS, { view: "run", runId: id, run: world.state.runs.get(id) || null, anc: null, items: [], cursor: null, children: [], loading: true, error: null, gone: null, keepScroll: false });
  runsRender();
  try {
    const r = await world.act.run(id);
    if (gen !== RS.gen) return;
    RS.run = { ...(world.state.runs.get(id) || {}), ...r, title: r.title || r.agent_type || "Sub-agent" };
    RS.anc = r.ancestry || null;
    const findKids = (nodes) => { for (const n of nodes || []) { if (n.id === id) return n.children || []; const k = findKids(n.children); if (k) return k; } return null; };
    RS.children = findKids(RS.tree) || [];
  } catch (err) { if (gen !== RS.gen) return; RS.error = err.message; }
  await readTranscript(id, gen);
  if (gen === RS.gen) runsCard.querySelector(".rn-back")?.focus();
}
/** Read the transcript; while the run works, read again from the last cursor and add only new items. */
async function readTranscript(id, gen) {
  const mine = () => RS.gen === gen && RS.runId === id && RS.open;
  if (!mine()) return;
  try {
    let more = true, guard = 0;
    while (more && guard++ < 20) {
      const d = await world.act.transcript(id, RS.cursor);
      if (!mine()) return;
      const have = new Set(RS.items.map((i) => i.id));
      RS.items.push(...(d.items || []).filter((i) => !have.has(i.id)));
      if (d.next) RS.cursor = d.next;
      more = !!d.next && (d.items || []).length > 0;
      // a long transcript shows as each page arrives, not after the last one
      if (more) { RS.loading = false; RS.keepScroll = true; runsRender(); }
    }
  } catch (err) {
    if (!mine()) return;
    if (err.code === "transcript_gone") RS.gone = err.summary || err.message;
    else if (err.status === 501) RS.error = "This agent can't show a sub-agent's work.";
    else RS.error = err.message;
  }
  RS.loading = false;
  RS.keepScroll = true;
  runsRender();
  const live = world.state.runs.get(id);
  if (mine() && (!live || LIVE_RUN(live)) && !RS.gone && !RS.error) RS.pollT = setTimeout(() => readTranscript(id, gen), 2500);
}
function closeRuns() {
  if (!RS.open) return;
  clearTimeout(RS.pollT);
  RS.gen++; RS.open = false; runsEl.hidden = true; runsCard.innerHTML = ""; runsCard._h = "";
  RS.returnTo?.focus?.({ preventScroll: true });
}
/** Stop one sub-agent, or all of a session's, after a 3 s Undo. */
// Stops waiting out their Undo. One herald shows them all, so a second stop never hides the first's Undo.
const pendingStops = [];
function stopRunsUndo(what, fn) {
  const job = { what, until: Date.now() + Kit.COMMIT_MS, cancelled: false, sent: false };
  pendingStops.push(job);
  stopsHerald();
  announce(`Stopping ${what} in 3 seconds. Undo to keep it.`);
  setTimeout(async () => {
    const i = pendingStops.indexOf(job);
    if (i >= 0) pendingStops.splice(i, 1);
    if (job.cancelled) return;
    job.sent = true;
    stopsHerald(); // its Undo is over: the line keeps only the stops still waiting

    try {
      const r = await fn();
      // 202: a stop was sent (its run.finished confirms it); 200 with nothing to stop: it had ended
      const none = r && (r.stopping === false || (Array.isArray(r.stopping) && !r.stopping.length));
      const n = r && Array.isArray(r.stopping) ? r.stopping.length : 0;
      heraldShow({ kind: "halt", text: none ? "It had already finished" : "Stopping", sub: none ? what : n > 1 ? `${n} sub-agents · what they did is kept` : `${what} · what it did is kept` }, 3600);
      announce(none ? `${what} had already finished.` : `Stopping ${what}. What it did is kept.`);
    } catch (err) {
      if (err.code === "run_not_live") heraldShow({ kind: "halt", text: "It had already finished", sub: what }, 3600);
      else heraldShow({ kind: "stopped", text: "Couldn't stop it", sub: err.status === 501 ? "this agent can't stop a sub-agent; stop the thread instead" : err.message }, 6000);
    }
    if (RS.open && RS.session) { try { const d = await world.act.listRuns(RS.session); RS.tree = d.runs || []; RS.counts = d.counts || null; } catch { /* the stream says it too */ } runsRender(); }
  }, Kit.COMMIT_MS);
}
runsEl.addEventListener("click", (e) => {
  if (e.target === runsEl || e.target.closest("[data-close]")) { closeRuns(); return; }
  const tb = e.target.closest("[data-tb]");
  if (tb) { S.tbOpen[tb.dataset.tb] = !S.tbOpen[tb.dataset.tb]; RS.keepScroll = true; runsRender(); return; }
  if (e.target.closest("[data-runs-back]")) { RS.gen++; clearTimeout(RS.pollT); RS.view = "list"; RS.runId = null; RS.keepScroll = false; runsRender(); return; }
  const st = e.target.closest("[data-run-stop]");
  if (st) { const r = world.state.runs.get(st.dataset.runStop) || { title: "this sub-agent" }; stopRunsUndo(r.title, () => world.act.stopRun(st.dataset.runStop)); return; }
  if (e.target.closest("[data-runs-stop]")) { const sid = RS.session; stopRunsUndo("every sub-agent of this thread", () => world.act.stopRuns(sid)); return; }
  const op = e.target.closest("[data-run]");
  if (op) openRun(op.dataset.run);
});
runsEl.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); runsEscape(); } });

// ── the thread's own decision: docked above the composer (Today's card, #20) ──
const tdock = $("#tdock");
const TD = { key: null, busy: false };
const keepBottom = () => { if (stuck && rendered && rendered !== "home") toBottom(false); };
function dockRender(needs) {
  // a chat: its "send now" question first, else its own open decision (the chat's host), as a thread docks one
  const hc = CH.isChats(S.view) ? CH.confirmHtml(S.view) : "";
  if (hc) { if (tdock._ch !== hc) { tdock.innerHTML = hc; tdock._ch = hc; TD.key = null; } return; }
  if (tdock._ch) { tdock._ch = ""; tdock.innerHTML = ""; TD.key = null; }
  if (S.view === "chats") { if (TD.key) { TD.key = null; tdock.innerHTML = ""; } return; }
  const t = convThread(S.view) || (S.view.startsWith("c:") ? (world.state.hosts || []).find((h) => h.id === `session:${S.view.slice(2)}`) : null);
  const n = t && !D.isOpen() && !sealed() ? needs.find((x) => x.t.id === t.id && !x.later && (x.admitted || x.held)) : null;
  // Folded: the person chose to read the thread first. The ask waits as one slim line, and the
  // conversation isn't dimmed. A new ask on this thread docks open again.
  const folded = !!(n && S.dockFold[n.key]);
  const key = n ? n.key + (folded ? "|fold" : "") : null;
  if (TD.busy || key === TD.key) return;
  const prev = TD.key;
  TD.key = key;
  if (!n) {
    if (!prev) { tdock.innerHTML = ""; return; }
    morph(tdock, () => { tdock.innerHTML = ""; }, { duration: 300 });
    return;
  }
  const head = (() => { const tp = document.createElement("template"); tp.innerHTML = D.cardHtml(n, "dock").trim(); return tp.content.querySelector(".c-h")?.textContent.trim() || askShort(n); })();
  if (folded) {
    const E = EFFORT[n.effort];
    const bar = document.createElement("button");
    bar.type = "button";
    bar.className = `dock-fold r-${n.risk}`;
    bar.dataset.unfold = n.key;
    bar.title = "Open the decision";
    bar.innerHTML = `<i class="g g-${n.group === "stopped" ? "failed" : "needs_reply"}" aria-hidden="true"></i><span class="df-t">${esc(head)}</span><span class="df-e">${esc(E.label)} ${esc(E.time)}</span><span class="df-go">Open ${ICON.chevron}</span>`;
    morph(tdock, () => { tdock.innerHTML = ""; tdock.appendChild(bar); }, { duration: 300 });
    return;
  }
  const frame = document.createElement("article");
  frame.className = `card is-dock r-${n.risk} e-${n.effort}`;
  frame.tabIndex = -1;
  frame.setAttribute("aria-roledescription", "decision");
  frame.innerHTML = `<div class="stamp stamp-allow" aria-hidden="true"><svg viewBox="0 0 52 52"><circle class="sc" cx="26" cy="26" r="23"/><path class="sk" d="M15 27l7.5 7.5L38 19"/></svg></div><div class="stamp stamp-back" aria-hidden="true"><svg viewBox="0 0 52 52"><circle class="sc" cx="26" cy="26" r="23"/><path class="sk" d="M21 30l-6-6 6-6M15 24h14a7 7 0 0 1 0 14h-4"/></svg></div>`;
  const tpl = document.createElement("template");
  tpl.innerHTML = D.cardHtml(n, "dock").trim();
  const inner = tpl.content.firstElementChild;
  frame.appendChild(inner);
  frame.setAttribute("aria-labelledby", inner.querySelector(".c-h").id);
  const what = t.host ? "chat" : "thread";
  // it sits in the card's own top row, on the effort label's line (hub #27), not floating over it
  (inner.querySelector(".c-top") || frame).insertAdjacentHTML("beforeend", `<button type="button" class="dock-hide" data-fold="${esc(n.key)}" title="Fold it away and read the ${what} first">${ICON.chevron}<span>Read the ${what} first</span></button>`);
  morph(tdock, () => { tdock.innerHTML = ""; tdock.appendChild(frame); }, { duration: prev ? 300 : 360, fade: frame });
  D.wireCard(frame, inner, n, {
    surface: "dock",
    onStep: keepBottom,
    after: async (how) => {
      TD.busy = true;
      if (!RM.matches && how !== "later") { frame.classList.add(`st-${how}`); await wait(380); }
      if (how !== "later") {
        // one calm line in place of the card, then it folds away
        const e = D.decisions()[0];
        const verb = e && e.verb === "Answered" ? `Answered “${e.said}”` : e ? e.verb : "Done";
        morph(frame, () => { frame.className = "card is-dock r-done"; frame.innerHTML = `<p class="tp-done${how === "back" ? " is-back" : ""}" role="status"><span class="tp-done-ic">${how === "back" ? ICON.rewind : ICON.check}</span><span><b>${esc(verb)}.</b> ${how === "back" ? "It's taking another route." : "It's back at work."}</span><button type="button" class="tp-done-u" data-dock-undo>Undo</button></p>`; }, { duration: 300 });
        await wait(2200);
      }
      TD.busy = false;
      TD.key = "__settling";
      morph(tdock, () => { tdock.innerHTML = ""; }, { duration: 320 });
      TD.key = null;
      schedule();
    },
  });
}
tdock.addEventListener("click", (e) => {
  const f = e.target.closest("[data-fold]");
  if (f) { S.dockFold[f.dataset.fold] = true; dockRender(D.needItems()); scroller.focus({ preventScroll: true }); return; }
  const u = e.target.closest("[data-unfold]");
  if (u) { delete S.dockFold[u.dataset.unfold]; dockRender(D.needItems()); requestAnimationFrame(() => tdock.querySelector(".card")?.focus({ preventScroll: true })); return; }
  if (e.target.closest("[data-dock-undo]")) D.undo();
});
tdock.addEventListener("keydown", (e) => {
  const card = tdock.querySelector(".card");
  if (!card) return;
  D.cardKeys(e, card, {});
});

// ── typing ──────────────────────────────────────────────────────────────────
function typingRender() {
  const box = $("#typing");
  const t = convThread(S.view);
  let html = "";
  const chat = !DEMO && !t && S.view !== "home" ? chatOf(S.view) : null;
  if (chat && world.act.replying(chat)) {
    // live: the coordinator's session really works, or our message still waits for its answer (never a timer)
    const aw = world.state.awaiting[chat];
    const who = S.view === "ws" ? "The coordinator" : `${esc(PROJ(chat))} coordinator`;
    const doing = world.act.doing ? world.act.doing(chat) : null;
    html = `<div class="typing" role="status"><div class="av av-w">${XO}</div><div class="ty-b"><span class="shimmer">${who} is ${aw ? "replying" : "working"}${doing ? ` · ${esc(doing.replace(/`/g, ""))}` : ""}</span><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>${aw ? `<span class="elapsed" data-since="${aw.at}"></span>` : ""}</div></div>`;
  } else if (!DEMO && S.view.startsWith("c:")) {
    const sid = S.view.slice(2), tu = world.state.turns && world.state.turns.running(sid);
    if (CH.working(S.view) && !(tu && world.state.turns.blocksOf(tu).length)) html = `<div class="typing" role="status"><div class="av av-t av-w">${ICON.thread}</div><div class="ty-b"><span class="shimmer">Working</span><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></div></div>`;
  } else if (!DEMO && t && t.sessionId && world.state.turns && world.state.turns.running(t.sessionId) && world.state.turns.blocksOf(world.state.turns.running(t.sessionId)).length) {
    html = ""; // its running turn shows the work itself
  } else if (S.typing[S.view]) {
    html = `<div class="typing" role="status"><div class="av av-w">${XO}</div><div class="ty-b"><span class="shimmer">${S.view === "ws" ? "The coordinator" : `${esc(PROJ(convProject(S.view)))} coordinator`} is replying</span><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></div></div>`;
  } else if (t && isBusy(t)) {
    const cur = t.checklist.items.find((i) => i.state === "doing");
    html = `<div class="typing" role="status"><div class="av av-t av-w">${ICON.thread}</div><div class="ty-b"><span class="shimmer">Working${cur ? ` · ${esc(cur.text)}` : ""}</span><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="elapsed" data-since="${t.lastAt}"></span></div></div>`;
  }
  const changed = box._h !== html;
  if (changed) { box.innerHTML = html; box._h = html; }
  tickElapsed();
  return changed;
}
function tickElapsed() { for (const el of $$(".elapsed[data-since]")) el.textContent = elapsed(Math.max(0, Math.floor((Date.now() - +el.dataset.since) / 1000))); }
setInterval(tickElapsed, 1000);

// ── the dock line: one calm labelled line (no glow on the composer, ever) ───
const OWN = new Set(["sent", "started", "ready", "clear", "rec", "rule", "halt"]);
// Lines waiting for an Undo on screen to end: an Undo is never pushed out of reach by a newer line.
const HQ = [];
function heraldShow(h, ms = 4200) {
  const now = Date.now();
  const cur = S.herald && S.herald.until > now ? S.herald : null;
  const stops = h.tag === "stops";
  if (cur && cur.undo && !(stops && cur.tag === "stops")) {
    if (stops) {
      // a Stop's own Undo shows at once (its 3 s are already running); the line it covers comes back after
      HQ.unshift({ h: cur, ms: Math.max(3000, cur.until - now) });
    } else if (h.undo || h.force || OWN.has(h.kind)) { HQ.push({ h, ms }); return; }
    else return; // a passing notice yields to an Undo
  }
  if (!h.force && !h.undo && !stops && cur && OWN.has(cur.kind) && !OWN.has(h.kind)) return;
  heraldPut(h, ms);
}
function heraldPut(h, ms) {
  S.herald = { ...h, until: Date.now() + ms, n: (S.herald?.n || 0) + 1 };
  clearTimeout(heraldShow.t);
  heraldShow.t = setTimeout(heraldNext, ms + 40);
  schedule();
}
/** The line on screen ended (or was cleared): the next waiting line, Undo lines first, in order; of those
 *  without one only the newest shows (each was already announced). */
function heraldNext() {
  if (S.herald && S.herald.until > Date.now() && S.herald.undo) return;
  const iu = HQ.findIndex((x) => x.h.undo);
  let next = null;
  if (iu >= 0) next = HQ.splice(iu, 1)[0];
  else if (HQ.length) { next = HQ[HQ.length - 1]; HQ.length = 0; }
  if (!next) { schedule(); return; }
  let { h, ms } = next;
  // a line whose Undo has a deadline (h.undoUntil) comes back only for what is left of it, or without its Undo
  if (h.undo && h.undoUntil) {
    const left = h.undoUntil - Date.now();
    if (left < 600) { h = { ...h, undo: null, undoUntil: 0 }; ms = Math.min(ms, 2400); } else ms = Math.min(ms, left);
  }
  heraldPut(h, ms);
}
function heraldRender(needs) {
  const box = $("#herald");
  const h = S.herald && S.herald.until > Date.now() ? S.herald : null;
  let html;
  if (h) {
    const ic = h.kind === "stopped" ? `<span class="hr-ic k-stopped">${ICON.close}</span>` : h.kind === "sent" ? `<i class="dash" aria-hidden="true"></i>` : h.kind === "ping" ? `<span class="hr-ic k-ping"><i class="hr-dot"></i></span>` : h.kind === "calm" || h.kind === "halt" ? `<span class="hr-ic k-calm">${h.kind === "halt" ? STOP_ICON : ICON.pause}</span>` : h.kind === "rule" ? `<span class="hr-ic k-ok">${ICON.rule}</span>` : h.kind === "rec" ? `<span class="hr-ic k-calm">${ICON.router}</span>` : `<span class="hr-ic k-ok">${ICON.check}</span>`;
    const inner = `${ic}<span class="hr-t">${esc(h.text)}</span>${h.sub ? `<span class="hr-s">${esc(h.sub)}</span>` : ""}${h.open ? `<span class="hr-go">Open ${ICON.arrow}</span>` : h.decide ? `<span class="hr-go">Look ${ICON.arrow}</span>` : ""}`;
    html = h.open ? `<button type="button" class="hr hr-ev k-${h.kind}" data-go="${esc(h.open)}" data-hn="${h.n}">${inner}</button>`
      : h.decide ? `<button type="button" class="hr hr-ev k-${h.kind}" data-decide="${esc(h.decide)}" data-hn="${h.n}">${inner}</button>`
      : h.undo ? `<div class="hr hr-ev has-undo k-${h.kind}" data-hn="${h.n}">${inner}<button type="button" class="hr-undo" data-herald-undo>${esc(h.undoLabel || "Undo")}</button></div>`
      : `<div class="hr hr-ev k-${h.kind}" data-hn="${h.n}">${inner}</div>`;
  } else if (!DEMO && connLine(world.state)) {
    // live: an honest, persistent line when XO can't be reached, can't run, or waits on a limit (P0-8)
    const c = connLine(world.state);
    html = `<div class="hr hr-conn k-${c.kind}" role="status"><span class="hr-ic ${c.kind === "down" ? "k-stopped" : "k-calm"}">${c.kind === "down" ? ICON.retry : ICON.pause}</span><span class="hr-t">${esc(c.text)}</span><span class="hr-s">${esc(c.sub)}</span></div>`;
  } else if (S.view === "home" || convThread(S.view) || sealed()) html = "";
  else {
    // Only when something is worth your time. The quiet states ("Nothing needs you", "Sealed")
    // are already said by the sidebar's Home row and by Home, so no line sits here for them.
    const P0 = homeParts(needs);
    const nd = P0.active.length;
    html = nd && P0.next
      ? `<button type="button" class="hr hr-need" data-next title="Take the next move"><i class="hr-dot" aria-hidden="true"></i><span class="hr-t"><b>${nd}</b> worth your time</span><span class="hr-s">next is ${EFFORT[P0.next.effort].long}</span>${ICON.right}</button>`
      : "";
  }
  const was = box._h;
  if (patch(box, html) && was != null && html) box.firstElementChild?.classList.add("is-in");
}

// ── intelligence: the record line and the chip ─────────────────────────────
function recordLine(session, rec) {
  const conv = session;
  const m = { id: `rec${++S.n}`, who: "rec", at: Date.now(), text: rec.text, refused: !!rec.refused, undo: rec.undo || null, until: Date.now() + 3000 };
  (S.local[conv] = S.local[conv] || []).push(m);
  if (rec.undo) setTimeout(schedule, 3050);
  if (S.view === "home" || (S.view !== conv)) heraldShow({ kind: "rec", text: rec.text, undo: rec.undo ? m.id : null, undoUntil: rec.undo ? m.until : 0 }, rec.undo ? 3200 : 4200);
  announce(rec.text);
  schedule();
}
function undoRecord(id) {
  for (const list of Object.values(S.local)) {
    const m = list.find((x) => x.id === id);
    if (m && m.undo && Date.now() < m.until) {
      m.undo(); m.undo = null;
      m.text = `${m.text} · undone`;
      announce("Undone.");
      if (S.herald && S.herald.undo === id) { S.herald.until = 0; heraldNext(); }
      schedule();
      return;
    }
  }
}
function chipRender(fade = false) {
  const chip = $("#iq");
  // a chat's agent, model and mode are set in the line above the composer, not by the router
  chip.hidden = CH.isChats(S.view);
  if (chip.hidden) return;
  const s = sessionOf(S.view);
  const html = IQ.chipHtml(s, PHONE.matches);
  chip.title = IQ.chipTitle(s);
  chip.setAttribute("aria-label", `Intelligence: ${IQ.chipTitle(s).replace(/ \([^)]*\)$/, "")}`);
  chip.classList.toggle("is-pinned", IQ.current(s).pinned);
  if (chip._h === html) return;
  const swap = () => { chip.innerHTML = html; chip._h = html; };
  if (fade && chip._h && !RM.matches) {
    chip.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 80, fill: "forwards" }).finished.then(() => { swap(); chip.getAnimations().forEach((a) => a.cancel()); chip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 80 }); });
  } else swap();
}

// ── the composer: send, or Stop while something runs ───────────────────────
const say = $("#say"), atList = $("#at-list");
function parseTarget(text) {
  const m = text.match(/(^|\s)@([\w.-]+)/);
  if (!m) return null;
  const q = m[2].toLowerCase();
  const p = world.state.projects.find((x) => x.id.toLowerCase() === q || x.name.toLowerCase() === q);
  return p ? p.id : null;
}
function growSay() {
  say.style.height = "auto";
  const h = say.scrollHeight;
  say.style.height = Math.min(h, 200) + "px";
  say.classList.toggle("is-capped", h > 200);
}
/** What would Stop stop here? The coordinator replying, or this thread's agent working. */
function running() {
  if (!DEMO) {
    // live: a thread whose session works, or the coordinator of this chat while it works
    // nothing more to stop where a Stop waits out its Undo or is on its way, or the session is stopping
    const live = (run) => (run && !S.stops.has(run.session) && world.act.sessionState(run.session) !== "stopping" ? run : null);
    const t = convThread(S.view);
    if (t) return t.busy && t.sessionId ? live({ kind: "thread", t, session: t.sessionId }) : null;
    if (S.view.startsWith("c:")) return CH.busy(S.view) ? live({ kind: "chat", session: S.view.slice(2) }) : null;
    if (S.view === "chats") return null;
    const chat = chatOf(S.view);
    const sid = chat && world.act.coordinatorBusy ? world.act.coordinatorBusy(chat) : null;
    return sid ? live({ kind: "coord", conv: S.view, session: sid }) : null;
  }
  if (S.typing[S.view]) return { kind: "coord", conv: S.view };
  const t = convThread(S.view);
  if (t && t.state === "working") return { kind: "thread", t };
  return null;
}
function sendRender() {
  const btn = $("#send");
  const empty = !say.value.replace(/(^|\s)@[\w.-]+/, "").trim();
  const run = empty ? running() : null;
  const mode = run ? "stop" : "send";
  if (btn.dataset.mode !== mode) {
    btn.dataset.mode = mode;
    btn.innerHTML = run ? STOP_ICON : ICON.send;
    btn.classList.toggle("is-stop", !!run);
  }
  btn.disabled = !run && (empty || !!liveBlock());
  btn.setAttribute("aria-label", run ? (run.kind === "coord" ? "Stop the reply" : "Stop this run") : "Send");
  btn.title = run ? (run.kind === "coord" ? "Stop the coordinator" : "Stop the agent (it keeps what's done)") : "Send (Enter)";
}
/** A chat's line above the composer and its Send now toggle, which follow the chat's own state. */
function chatTargetRender() {
  sendNowRender();
  if (!CH.isChats(S.view)) return false;
  // an ended chat says so in its own words; "paused" would promise it comes back
  const html = CH.blocked(S.view) ? CH.targetHtml(S.view) : liveBlock() ? `<span class="tg-warn">${ICON.pause}</span><span>Sending is paused · ${esc(liveBlock())}</span>` : CH.targetHtml(S.view);
  if ($("#target")._h !== html) { $("#target").innerHTML = html; $("#target")._h = html; }
  return true;
}
function updateComposer() {
  if (chatTargetRender()) {
    syncPlaceholder();
    $("#composer").classList.toggle("has-text", !!say.value);
    sendRender(); growSay(); atList.hidden = true;
    return;
  }
  const tg = DEMO ? null : targetOf(say.value, world.state.projects);
  const pid = DEMO ? parseTarget(say.value) : tg.pid;
  const t = convThread(S.view);
  const block = liveBlock();
  let html;
  if (block) html = `<span class="tg-warn">${ICON.pause}</span><span>Sending is paused · ${esc(block)}</span>`;
  else if (tg && tg.unknown && !/(^|\s)@[\w.-]*$/.test(say.value.slice(0, say.selectionStart))) html = `<span class="tg-warn">${ICON.close}</span><span>No project called <b>${esc(tg.unknown)}</b></span>`;
  else if (pid === "workspace") html = `${ICON.arrow}<span>To the <b>Workspace</b> coordinator</span>`;
  else if (pid) html = `${ICON.arrow}<span>New work for <b>${esc(PROJ(pid))}</b></span>`;
  else if (t) html = `<span class="tg-t">${ICON.thread}</span><span>Reply in <b>this thread</b></span>`;
  else if (S.view === "ws" || S.view === "home") html = `${ICON.arrow}<span>To the <b>Workspace</b> coordinator</span><span class="muted">· @ to aim at a project</span>`;
  else html = `${ICON.arrow}<span>To the <b>${esc(PROJ(convProject(S.view)))}</b> coordinator</span>`;
  if ($("#target")._h !== html) { $("#target").innerHTML = html; $("#target")._h = html; }
  syncPlaceholder();
  $("#composer").classList.toggle("has-text", !!say.value);
  sendRender();
  growSay();
  const before = say.value.slice(0, say.selectionStart);
  const m = before.match(/(^|\s)@([\w.-]*)$/);
  if (!m) { atList.hidden = true; say.setAttribute("aria-expanded", "false"); say.removeAttribute("aria-activedescendant"); return; }
  const q = m[2].toLowerCase();
  const opts = projects().filter((p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  if (!opts.length) { atList.hidden = true; return; }
  atList._sel = Math.min(atList._sel || 0, opts.length - 1);
  atList.innerHTML = opts.map((p, i) => {
    const w = world.state.threads.filter((x) => x.project === p.id && isBusy(x)).length;
    return `<li role="option" id="at-${i}" data-pid="${esc(p.id)}" aria-selected="${i === atList._sel}"><span class="at-ic" aria-hidden="true">${ICON.project}</span>@${esc(p.id)}<span class="at-s">${w ? `${w} working` : "quiet"}</span></li>`;
  }).join("");
  atList.hidden = false;
  say.setAttribute("aria-expanded", "true");
  say.setAttribute("aria-activedescendant", `at-${atList._sel}`);
}
/** The composer's placeholder follows the view, and a resolved thread says a reply reopens it. */
function syncPlaceholder() {
  if (CH.isChats(S.view)) { const ph = CH.placeholder(S.view); if (say.placeholder !== ph) { say.placeholder = ph; $("#say-label").textContent = ph; } return; }
  const t = convThread(S.view);
  const ph = t ? (t.state === "resolved" ? "Reply to reopen it…" : "Reply to the agent…") : S.view === "home" ? (PHONE.matches ? "What should get done?" : "What should get done? Use @project to aim it") : S.view === "ws" ? "Ask anything across your projects…" : `Message ${PROJ(convProject(S.view))}…`;
  if (say.placeholder !== ph) { say.placeholder = ph; $("#say-label").textContent = ph; }
}
function pickAt(pid) {
  const pos = say.selectionStart;
  const before = say.value.slice(0, pos).replace(/(^|\s)@([\w.-]*)$/, `$1@${pid} `);
  say.value = before + say.value.slice(pos);
  say.setSelectionRange(before.length, before.length);
  atList.hidden = true; atList._sel = 0;
  updateComposer(); say.focus();
}
function saveDraft() { if (say.value) S.drafts[S.view] = say.value; else delete S.drafts[S.view]; store.set(DRAFTS, S.drafts); }
function loadDraft() { say.value = S.drafts[S.view] || ""; atList._sel = 0; updateComposer(); }

say.addEventListener("input", () => { atList._sel = 0; updateComposer(); saveDraft(); });
say.addEventListener("click", updateComposer);
say.addEventListener("keydown", (e) => {
  if (!atList.hidden) {
    const n = atList.children.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); atList._sel = (atList._sel + (e.key === "ArrowDown" ? 1 : n - 1)) % n; updateComposer(); return; }
    if (e.key === "Enter" || e.key === "Tab") {
      const pid = atList.children[atList._sel].dataset.pid;
      const tok = (say.value.slice(0, say.selectionStart).match(/@([\w.-]*)$/) || [])[1] || "";
      if (tok.toLowerCase() !== pid.toLowerCase()) { e.preventDefault(); pickAt(pid); return; }
      atList.hidden = true;
      if (e.key === "Tab") { e.preventDefault(); return; }
    }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); atList.hidden = true; return; }
  }
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); say.blur(); }
});
atList.addEventListener("mousedown", (e) => { const li = e.target.closest("li"); if (li) { e.preventDefault(); pickAt(li.dataset.pid); } });
// On Home an empty composer shrinks when it loses focus, which drops the dock (and the herald just above it)
// 45 px under the pointer, so the click lands on nothing. Keep its shape from the press until the click.
{
  const comp = $("#composer");
  let timer = 0;
  const release = (ms) => { clearTimeout(timer); timer = setTimeout(() => comp.classList.remove("held"), ms); };
  document.addEventListener("pointerdown", (e) => {
    if (!comp.contains(document.activeElement) || comp.contains(e.target)) return;
    clearTimeout(timer);
    comp.classList.add("held");
  }, true);
  // a touch's click can come a moment after the finger lifts, so wait for it (or give up shortly after)
  document.addEventListener("pointerup", () => { if (comp.classList.contains("held")) release(600); }, true);
  document.addEventListener("pointercancel", () => { if (comp.classList.contains("held")) release(0); }, true);
  document.addEventListener("click", () => { if (comp.classList.contains("held")) release(0); }, true);
}
$("#composer").addEventListener("submit", (e) => { e.preventDefault(); if ($("#send").dataset.mode === "stop") stopRun(); else send(); });
$("#target").addEventListener("click", () => {
  if (S.view === "chats") { CH.openSetup($("#target")); return; }
  if (S.view.startsWith("c:")) { say.focus(); return; }
  if (!/(^|\s)@/.test(say.value)) say.value = "@" + (say.value ? " " + say.value : "");
  say.focus(); say.setSelectionRange(1, 1); updateComposer();
});
/** "Send now": its own toggle, shown in a chat whose turn is running where the agent can be interrupted. */
function sendNowRender() {
  const b = $("#send-now");
  const st = !DEMO && CH.isChats(S.view) && !liveBlock() ? CH.nowState(S.view) : null;
  b.hidden = !st;
  if (st) { b.setAttribute("aria-pressed", String(st.on)); b.classList.toggle("is-on", st.on); }
}
$("#send-now").addEventListener("click", () => { CH.toggleNow(S.view); updateComposer(); say.focus(); });
$("#iq").addEventListener("click", () => { if (IQ.isOpen) IQ.close(); else IQ.open(sessionOf(S.view), $("#iq")); });

/**
 * Live Stop: nothing is sent for 3 s (Undo), then the session's turn and its sub-agents stop at once
 * (POST /api/chat/abort). The turn's own record then says what ran: "Stopped after …".
 */
function stopLive(run) {
  const what = run.kind === "thread" ? run.t.title : run.kind === "chat" ? "This chat" : run.conv === "ws" ? "The coordinator" : `${PROJ(chatOf(run.conv))} coordinator`;
  // the turn you chose to stop: if it ends inside the window and another starts, that one is left alone
  const token = { session: run.session, turn: world.act.turnOf(run.session), what, until: Date.now() + Kit.COMMIT_MS, cancelled: false, sent: false };
  S.stops.set(run.session, token);
  stopsHerald();
  announce(`Stopping ${what} in 3 seconds. Undo to keep it working.`);
  sound.play("back");
  schedule();
  setTimeout(async () => {
    if (token.cancelled) return;
    token.sent = true;
    stopsHerald();
    const now = world.act.turnOf(token.session);
    if (token.turn && now !== token.turn) {
      S.stops.delete(token.session);
      heraldShow({ kind: "halt", text: "It had already finished", sub: now ? `${what} · its next turn goes on` : what }, 4200);
      announce(now ? "It had already finished that turn. The next one goes on; Stop again to end it." : "It had already finished.");
      schedule();
      return;
    }
    try {
      const r = await world.act.stop(token.session);
      heraldShow({ kind: "halt", text: r && r.stopped === false ? "It had already finished" : "Stopped", sub: r && r.stopped === false ? what : `${what} · what it did is kept` }, 4200);
      announce(r && r.stopped === false ? "It had already finished." : `Stopped ${what}. What it did is kept.`);
    } catch (err) {
      // Retry stops the same session, wherever you are when you press it
      heraldShow({ kind: "stopped", text: "Couldn't stop it", sub: `${what} · ${err.message}`, undo: () => stopLive(run), undoLabel: "Retry" }, 7000);
    } finally {
      if (S.stops.get(token.session) === token) S.stops.delete(token.session);
      schedule();
    }
  }, Kit.COMMIT_MS);
}
/**
 * One line for every stop still in its Undo window, a turn's (S.stops) or a sub-agent's (pendingStops),
 * with one Undo for all: a second stop never hides the first one's Undo.
 */
function stopsHerald() {
  const turns = [...S.stops.values()].filter((x) => !x.cancelled && !x.sent);
  const runs = pendingStops.filter((j) => !j.cancelled && !j.sent);
  const all = [...turns, ...runs];
  if (!all.length) { if (S.herald && S.herald.tag === "stops") { S.herald.until = 0; heraldNext(); } return; }
  const last = Math.max(...all.map((x) => x.until));
  heraldShow({ kind: "halt", tag: "stops", text: "Stopping", sub: all.map((x) => x.what).join(", "), undo: () => {
    for (const x of turns) { x.cancelled = true; if (S.stops.get(x.session) === x) S.stops.delete(x.session); }
    for (const j of runs) { j.cancelled = true; const i = pendingStops.indexOf(j); if (i >= 0) pendingStops.splice(i, 1); }
    announce(all.length > 1 ? "Not stopped. They keep working." : "Not stopped. It keeps working.");
    schedule();
  } }, Math.max(300, last - Date.now()));
}

/** Stop: the run halts honestly; what's done is kept and said so. */
function stopRun() {
  const run = running();
  if (!run) return;
  if (!DEMO) { stopLive(run); return; }
  if (run.kind === "coord") {
    S.stopped[run.conv] = true;
    delete S.typing[run.conv];
    heraldShow({ kind: "halt", text: "Stopped", sub: "nothing was started" }, 3600);
    announce("Stopped. The coordinator didn't start anything.");
  } else {
    const t = run.t;
    const cur = t.checklist.items.find((i) => i.state === "doing") || t.checklist.items.find((i) => i.state === "todo");
    const at = Date.now();
    t.state = "needs_reply";
    t.asks = [{ id: `stop_${t.id}_${at}`, kind: "question", title: `You stopped it at “${cur ? cur.text : "this step"}”. Continue, or end here?`, detail: `${t.checklist.done} of ${t.checklist.total} steps are done and kept.`, risk: "routine", options: ["Continue", "Stop here"], stopByYou: true }];
    t.needsYou = t.asks[0].title;
    t.checklist = { ...t.checklist, items: t.checklist.items.map((i) => (i.state === "doing" ? { ...i, state: "todo" } : i)), doing: 0 };
    t.messages.push({ id: `stopm_${at}`, at, who: "agent", text: `Stopped by you. Nothing after “${cur ? cur.text : "the last step"}” ran; ${t.checklist.done} of ${t.checklist.total} steps are kept.`, stopLine: true });
    t.lastAt = at;
    waitSince.set(t.id, at);
    heraldShow({ kind: "halt", text: "Stopped", sub: `${t.checklist.done} of ${t.checklist.total} steps kept` }, 3600);
    announce(`Stopped. ${t.checklist.done} of ${t.checklist.total} steps are kept. Continue or end it below.`);
  }
  sound.play("back");
  schedule();
}

function lift(el, from) {
  const b = el && el.querySelector(".bubble");
  if (!b || !from || RM.matches) return;
  const to = b.getBoundingClientRect();
  b.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(.98)`, opacity: 0.55 }, { transform: "none", opacity: 1 }], { duration: 320, easing: "cubic-bezier(.2,.9,.25,1.06)" });
}

/** Live: why sending is paused right now, or "" (classic composerBlock, in plain words). */
function liveBlock() {
  if (DEMO) return CH.isChats(S.view) ? "Chats run in Live" : "";
  if (CH.isChats(S.view)) return CH.blocked(S.view) || sendBlock(world.state, { timeline: false });
  const t = convThread(S.view);
  const toThread = !!t && !/(^|\s)@[\w.-]+/.test(say.value);
  return sendBlock(world.state, { timeline: !toThread });
}

function sendLive(raw) {
  const block = liveBlock();
  if (block) { announce(`Not sent: ${block}. Your text is kept.`); return; }
  const tg = targetOf(raw, world.state.projects);
  if (tg.unknown) { heraldShow({ kind: "stopped", text: `No project called “${tg.unknown}”`, sub: "pick one from the @ list" }, 4600); announce(`There's no project called ${tg.unknown}. Nothing was sent.`); return; }
  const text = stripTarget(raw, tg.token);
  if (!text) return;
  const t = convThread(S.view);
  const thread = t && !tg.pid ? t : null;
  const chat = thread ? t.project : tg.pid || chatOf(S.view) || "workspace";
  const conv = thread ? S.view : convOfChat(chat);
  const here = conv === S.view;
  const from = say.getBoundingClientRect();
  // client_id: a retry of this exact message is the same request, so the server stores it once (UI-reference §0.7)
  const m = { id: `l${++S.n}_${Date.now().toString(36)}`, conv, at: Date.now(), who: "you", text, status: "sending", target: thread ? null : chat, cid: `ui_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}` };
  (S.local[conv] = S.local[conv] || []).push(m);
  say.value = ""; saveDraft(); updateComposer();
  const btn = $("#send"); btn.classList.remove("fired"); void btn.offsetWidth; btn.classList.add("fired");
  sound.play("send");
  if (!here) heraldShow({ kind: "sent", text: `Sent to ${chat === "workspace" ? "the coordinator" : PROJ(chat)}`, sub: "open to follow the reply", open: conv }, 9000);
  else { render(); toBottom(false); lift(msgsEl.querySelector(`[data-k="${m.id}"]`), from); }
  deliverLive(m, thread);
}

/** Live: the server's row replaces the optimistic one (same bubble, never twice); errors keep the text. */
async function deliverLive(m, thread) {
  m.status = "sending"; delete m.err;
  try {
    const row = thread ? await world.act.reply(thread.id, m.text, { clientId: m.cid }) : await world.act.ask(m.target || "workspace", m.text, { clientId: m.cid });
    if (row && row.id) { S.alias.set(row.id, m.id); m.merged = true; }
    m.status = "sent";
    announce(thread ? "Sent to the thread." : `Sent to ${m.target === "workspace" ? "the coordinator" : PROJ(m.target)}.`);
  } catch (err) {
    m.status = "failed";
    m.err = { title: sendErrorTitle(err), text: err.message || "" };
    announce(`${m.err.title}. ${m.err.text} Your message is kept; retry or edit it.`);
    if (S.view !== m.conv) heraldShow({ kind: "stopped", text: m.err.title, sub: "open the conversation to retry", open: m.conv }, 6000);
  }
  schedule();
}

function send() {
  const raw = say.value;
  if (CH.isChats(S.view)) {
    const text = raw.trim();
    if (!text || liveBlock()) return;
    say.value = ""; saveDraft(); updateComposer();
    sound.play("send");
    CH.send(S.view, text);
    return;
  }
  if (!DEMO) { sendLive(raw); return; }
  const pid = parseTarget(raw);
  const text = raw.replace(/(^|\s)@[\w.-]+\s?/, "$1").trim();
  if (!text) return;
  const fromHome = S.view === "home";
  const conv = fromHome ? (pid ? "p:" + pid : "ws") : S.view;
  const t = convThread(conv);
  const from = say.getBoundingClientRect();
  const m = { id: `l${++S.n}_${Date.now().toString(36)}`, conv, at: Date.now(), who: "you", text, status: "sending", target: pid || (t ? null : convProject(conv)) };
  (S.local[conv] = S.local[conv] || []).push(m);
  say.value = ""; saveDraft(); updateComposer();
  const btn = $("#send"); btn.classList.remove("fired"); void btn.offsetWidth; btn.classList.add("fired");
  sound.play("send");
  if (fromHome) heraldShow({ kind: "sent", text: `Sent to ${m.target === "workspace" ? "the coordinator" : PROJ(m.target)}`, sub: "waiting for a thread" }, 9000);
  else { render(); toBottom(false); lift(msgsEl.querySelector(`[data-k="${m.id}"]`), from); }
  deliver(m, t && !pid ? t : null, fromHome);
}

async function deliver(m, thread, fromHome) {
  if (!DEMO) return deliverLive(m, thread);
  const conv = m.conv;
  if (DEMO) await wait(360);
  if (DEMO && /#fail\b/i.test(m.text)) { m.status = "failed"; schedule(); announce("Message not sent. Retry or edit."); if (fromHome) heraldShow({ kind: "stopped", text: "Not sent", sub: "open the conversation to retry", open: conv }, 6000); return; }
  if (thread) {
    try {
      await world.act.reply(thread.id, m.text);
      const mine = [...thread.messages].reverse().find((x) => x.who === "you" && x.text === m.text);
      if (mine) { S.alias.set(mine.id, m.id); m.merged = true; }
      m.status = "sent";
    } catch { m.status = "failed"; }
    schedule();
    return;
  }
  m.status = "sent"; m.waiting = true; S.typing[conv] = Date.now(); delete S.stopped[conv];
  const setup = IQ.routed(conv, m.text);
  schedule();
  announce(`Sent to ${m.target === "workspace" ? "the coordinator" : PROJ(m.target)}. Waiting for a thread.`);
  if (DEMO) await wait(2600);
  if (S.stopped[conv]) {
    m.waiting = false; delete S.stopped[conv];
    (S.local[conv] = S.local[conv] || []).push({ id: `l${++S.n}_x`, conv, at: Date.now(), who: "coord", text: "Stopped. I didn't start anything; your message is kept above if you want to send it again.", iq: setup });
    schedule();
    return;
  }
  try {
    const nt = await world.act.ask(m.target || "workspace", m.text);
    m.waiting = false; delete S.typing[conv];
    if (nt && nt.id) {
      m.threadId = nt.id;
      S.localThread.set(nt.id, conv);
      const here = conv === "p:" + nt.project;
      const spawn = IQ.spawnSetup(nt.id);
      (S.local[conv] = S.local[conv] || []).push({ id: `l${++S.n}_r`, conv, at: Date.now(), who: "coord", text: (here ? "On it. I started a thread for this." : `Routed to **${PROJ(nt.project)}**. A thread is on it.`) + ` The router chose ${spawn.name} ${spawn.pips} for it.`, threadId: nt.id, iq: setup });
      announce(`Started a thread in ${PROJ(nt.project)}: ${nt.title}`);
      if (fromHome || S.view !== conv) heraldShow({ kind: "started", text: `Thread started: ${nt.title}`, sub: PROJ(nt.project), open: "t:" + nt.id }, 7000);
    }
  } catch { m.waiting = false; delete S.typing[conv]; m.status = "failed"; }
  schedule();
}
function retry(id) {
  for (const list of Object.values(S.local)) {
    const m = list.find((x) => x.id === id);
    if (m) {
      if (!DEMO && liveBlock()) { announce(`Not sent: ${liveBlock()}.`); return; }
      m.status = "sending"; if (DEMO) m.text = m.text.replace(/\s*#fail\b/i, ""); schedule(); deliver(m, convThread(m.conv) && !m.target ? convThread(m.conv) : null); return;
    }
  }
}
function editFailed(id) {
  const list = S.local[S.view] || [];
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [m] = list.splice(i, 1);
  say.value = (m.target && m.target !== convProject(S.view) ? `@${m.target} ` : "") + m.text;
  updateComposer(); render(); say.focus();
}

// ── render ──────────────────────────────────────────────────────────────────
const scroller = $("#scroller"), msgsEl = $("#msgs");
let rendered = null, raf = 0;
function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
const nearBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
function toBottom(smooth) { scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth && !RM.matches ? "smooth" : "auto" }); }

function render() {
  if (!world.state.loaded || S.booting) return;
  const needs = D.needItems();
  pings(needs);
  const v = S.view;
  const isHome = v === "home";
  $("#app").dataset.view = isHome ? "home" : v === "ws" ? "ws" : v.startsWith("t:") || v.startsWith("c:") ? "thread" : "project";
  document.body.classList.toggle("sealed", sealed());
  $("#home").hidden = !isHome;
  $("#conv").hidden = isHome;
  const pbt = isHome ? "Home" : "";
  if ($("#pb-t")._h !== pbt + v) { $("#pb-t").innerHTML = pbt ? esc(pbt) : XO; $("#pb-t")._h = pbt + v; }
  sideRender(needs);
  if (isHome) { homeRender(needs); rendered = "home"; }
  else {
    topRender(needs);
    wsHeadRender(needs);
    let switching = rendered !== v;
    if (!DEMO) {
      // live: the first real fill of a conversation lands quietly and in place, like a view switch
      const ready = liveReady(v);
      if (!switching && ready && S.filled !== v) switching = true;
      S.filled = ready ? v : null;
    }
    const atBottom = switching || nearBottom();
    const first0 = msgsEl.querySelector("[data-k]:not([data-k=hist]):not([data-k=note])")?.dataset.k;
    const h0 = scroller.scrollHeight, top0 = scroller.scrollTop;
    const added = reconcile(msgsEl, msgItems(v, needs), { quiet: switching });
    if (!DEMO && !switching && !atBottom && first0 && msgsEl.querySelector("[data-k]:not([data-k=hist]):not([data-k=note])")?.dataset.k !== first0) {
      // older messages arrived above: keep what you were reading exactly where it was
      scroller.scrollTop = top0 + (scroller.scrollHeight - h0);
    }
    if (!DEMO) ensureRoot();
    const typed = typingRender();
    if (switching) {
      rendered = v;
      stuck = true;
      const pos = S.scroll[v];
      if (v === "ws" && pos == null) { scroller.scrollTop = 0; stuck = false; }
      else if (pos == null || pos === "bottom") toBottom(false); else scroller.scrollTop = pos;
      $("#new-below").hidden = true;
    } else if (added.length || typed) {
      if (atBottom) toBottom(true); else if (added.length) $("#new-below").hidden = false;
    }
  }
  dockRender(needs);
  heraldRender(needs);
  chatTargetRender();
  syncPlaceholder();
  sendRender();
  chipRender();
  D.sync();
  const nd = sealed() ? 0 : needs.filter((n) => n.admitted && !n.later).length;
  document.title = sealed() ? "Sealed · XO Space" : Kit.titleFor(nd, "XO Space");
}
scroller.addEventListener("scroll", () => {
  // live: reaching the top loads earlier messages (the API's newest-N window grows: 40, 80, 160…)
  if (!DEMO && scroller.scrollTop < 80 && rendered === S.view && !convThread(S.view)) { const c = chatOf(S.view); const h = c && world.state.hist[c]; if (h && !h.all && !h.loading && !h.error) world.act.loadOlder(c); }
  if (nearBottom()) $("#new-below").hidden = true;
  $("#top").classList.toggle("is-scrolled", scroller.scrollTop > 120);
}, { passive: true });
$("#new-below").addEventListener("click", () => { toBottom(true); $("#new-below").hidden = true; });
let stuck = true;
scroller.addEventListener("scroll", () => { stuck = nearBottom(); }, { passive: true });
new ResizeObserver(() => {
  $("#app").style.setProperty("--dock-h", `${$("#dock").offsetHeight}px`);
  if (stuck && rendered && rendered !== "home") requestAnimationFrame(() => toBottom(false));
}).observe($("#dock"));

// ── navigation: back always returns exactly where you were ─────────────────
function saveScroll() {
  if (S.view === "home") S.scroll.home = $("#home").scrollTop;
  else if (rendered === S.view) S.scroll[S.view] = nearBottom() ? "bottom" : scroller.scrollTop;
}
function go(v, { from, focus = false } = {}) {
  if (!v) return;
  // an edit or menu in a thread's header belongs to that visit
  S.tEdit = null; S.tMenu = null;
  // the file viewer belongs to the conversation it was opened from
  if (v !== S.view) VW.close({ restore: false });
  closeSettings({ restore: false });
  setDrawer(false);
  IQ.close({ restore: false });
  if (v === S.view) { if (focus) say.focus(); return; }
  // the morning recap is for the first visit: leaving Home folds it
  if (S.view === "home" && S.morningOpen) { S.morningOpen = false; if (NIGHT.phase === "morning") NIGHT.phase = "day"; }
  const a = document.activeElement;
  const opener = a && a.closest?.("[data-k], .nw");
  if (opener && (opener.closest("#msgs") || opener.closest("#now-wrap"))) S.opener[S.view] = opener.dataset.k || opener.dataset.go;
  saveScroll(); saveDraft();
  const deeper = v.startsWith("t:") && !S.view.startsWith("t:");
  if (v.startsWith("t:")) S.parent[v] = from || (S.view.startsWith("t:") ? S.parent[S.view] : S.view);
  const back = from && from.startsWith("t:");
  S.view = v;
  follow();
  TD.key = null; tdock.innerHTML = ""; tdock._ch = "";
  const el = v === "home" ? $("#home") : $("#column");
  el.classList.remove("enter-r", "enter-l", "enter");
  void el.offsetWidth;
  el.classList.add(deeper ? "enter-r" : back ? "enter-l" : "enter");
  loadDraft();
  render();
  if (v === "home") $("#home").scrollTop = S.scroll.home || 0;
  const k = S.opener[v];
  const target = k ? ($("#msgs").querySelector(`[data-k="${CSS.escape(k)}"] [data-go]`) || $("#now-wrap").querySelector(`[data-go="${CSS.escape(k)}"]`)) : null;
  if (focus) say.focus({ preventScroll: true });
  else if (back && target) target.focus({ preventScroll: true });
  else if (!$("#panel").contains(document.activeElement)) (v === "home" ? $("#home") : scroller).focus({ preventScroll: true });
}
/** Live: has this conversation's real content arrived (timeline or thread detail)? */
function liveReady(v) {
  const t = convThread(v);
  if (t) return t.loaded;
  const h = world.state.hist[chatOf(v)];
  return !!h && !(h.loading && !(world.state.timeline[chatOf(v)] || []).length);
}
/** Live: stream the open conversation (the Workspace on Home); poll an open thread's detail. */
function follow() {
  if (DEMO) return;
  const v = S.view, t = convThread(v);
  if (CH.isChats(v)) { world.act.watch([]); world.act.watchThread(null); world.act.watchSession?.(v.startsWith("c:") ? v.slice(2) : null); CH.open(v); return; }
  world.act.watchSession?.(null);
  // a thread's hops are always read: a message relayed into it shows in place (if1 #7); their lines stay by choice
  if (t && world.act.loadHops) world.act.loadHops(t.id);
  world.act.watch(v === "home" || v === "ws" ? ["workspace"] : v.startsWith("p:") ? [v.slice(2)] : t ? [t.project] : []);
  world.act.watchThread(t ? t.id : null);
}
/** Live: an open thread's root request lives on the project timeline; page back until it's there. */
function ensureRoot() {
  const t = convThread(S.view);
  if (DEMO || !t) return;
  const h = world.state.hist[t.project], tl = world.state.timeline[t.project];
  if (!h || !tl || h.loading || h.all || h.error || tl.some((r) => r.id === t.id)) return;
  S.rootTries = S.rootTries || {};
  if ((S.rootTries[t.id] = (S.rootTries[t.id] || 0) + 1) > 6) return;
  world.act.loadOlder(t.project);
}
function back() {
  const v = S.view;
  if (v.startsWith("c:")) { go("chats", { from: "t:" }); return; }
  if (v.startsWith("t:")) go(S.parent[v] || "p:" + convThread(v)?.project, { from: v });
}
$("#top-back").addEventListener("click", back);

/** Open a decision: in a thread, its own card; elsewhere the panel. */
function decideKey(key, opts) {
  const t = convThread(S.view);
  const n = D.needItems().find((x) => x.key === key);
  if (t && n && n.t.id === t.id && !D.isOpen() && !opts) {
    if (n.later) S.later.delete(key);
    if (n.held) D.bringIn(key);
    schedule();
    requestAnimationFrame(() => requestAnimationFrame(() => tdock.querySelector(".card")?.focus({ preventScroll: true })));
    return;
  }
  D.open(key, opts);
}

/** After going to a conversation, bring one message into view and mark it for a moment (if it's loaded). */
function showMsg(id) {
  let tries = 0;
  const look = () => {
    const el = msgsEl.querySelector(`[data-k="${CSS.escape(S.alias.get(id) || id)}"]`);
    if (!el) { if (++tries < 20) setTimeout(look, 100); return; }
    el.scrollIntoView({ block: "center", behavior: RM.matches ? "auto" : "smooth" });
    el.classList.remove("is-flash"); void el.offsetWidth; el.classList.add("is-flash");
    setTimeout(() => el.classList.remove("is-flash"), 1800);
  };
  setTimeout(look, 120); // after the conversation has drawn and restored its scroll
}

// ── shared files: open in the viewer beside the conversation (if1 #2) ──
function openSharedFile(btn) {
  const f = { path: btn.dataset.file, name: btn.dataset.fileName, type: btn.dataset.fileType, bytes: btn.dataset.fileBytes === "" ? null : Number(btn.dataset.fileBytes) };
  const t = convThread(S.view);
  // only a thread's own folder maps to a project route; a plain chat's files have none yet
  const route = DEMO ? { why: "Files open from live threads. Demo threads don't have real files." } : sharedFileRoute(t, f.path);
  VW.open({ ...f, ...route }, btn);
}

// ── a thread's own header (live): resolve and reopen with Undo (R1), rename, label ──
async function resolveThread(tid, resolved, { undo = true } = {}) {
  const t = world.thread(tid);
  if (!t) return;
  const name = t.title;
  try {
    await world.act.resolve(tid, resolved);
    announce(resolved ? `Resolved ${name}.` : `Reopened ${name}.`);
    // Undo is the same call the other way (the route is idempotent); it never starts or stops a turn
    if (undo) heraldShow({ kind: "done", text: resolved ? "Resolved" : "Reopened", sub: name, undo: () => resolveThread(tid, !resolved, { undo: false }) }, 6000);
  } catch (err) {
    heraldShow({ kind: "stopped", text: resolved ? "Couldn't resolve it" : "Couldn't reopen it", sub: err.message, undo: () => resolveThread(tid, resolved, { undo }), undoLabel: "Retry" }, 8000);
  }
}
function startThreadEdit(tid, field) {
  S.tEdit = { tid, field };
  $("#top-who")._h = null;
  render();
  const inp = $("#tw-edit");
  if (inp) { inp.focus(); inp.select(); }
}
async function saveThreadField(tid, field, value) {
  S.tEdit = null;
  $("#top-who")._h = null;
  const t = world.thread(tid);
  if (!t) { render(); return; }
  const v = String(value || "").trim();
  if (field === "title" && (!v || v === t.title)) { render(); return; }
  if (field === "label" && v === (t.label || "")) { render(); return; }
  render();
  try {
    await world.act.editThread(tid, field === "title" ? { title: v.slice(0, 120) } : { label: v ? v.slice(0, 32) : null });
    announce(field === "title" ? `Renamed to ${v}.` : v ? `Labelled ${v}.` : "Label removed.");
  } catch (err) {
    heraldShow({ kind: "stopped", text: field === "title" ? "Couldn't rename it" : "Couldn't change the label", sub: err.message }, 6000);
  }
}
$("#top").addEventListener("keydown", (e) => {
  const inp = e.target.closest?.("[data-tedit]");
  if (inp) {
    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); saveThreadField(S.tEdit?.tid, inp.dataset.tedit, inp.value); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); S.tEdit = null; $("#top-who")._h = null; render(); $("#conv-title")?.focus?.(); }
    return;
  }
  if (e.key === "Escape" && S.tMenu) { e.preventDefault(); e.stopPropagation(); S.tMenu = null; $("#top-who")._h = null; render(); $("[data-tmenu]")?.focus(); }
});
$("#top").addEventListener("focusout", (e) => {
  const inp = e.target.closest?.("[data-tedit]");
  if (inp && S.tEdit) setTimeout(() => { if (S.tEdit && inp.isConnected && document.activeElement !== inp) saveThreadField(S.tEdit.tid, inp.dataset.tedit, inp.value); }, 0);
});

// ── clicks ──────────────────────────────────────────────────────────────────
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest(".uxc") || t.closest("#iq-pop")) return;
  const g = t.closest("[data-go]");
  if (g && !t.closest("#all")) { e.preventDefault(); go(g.dataset.go); if (g.dataset.goMsg) showMsg(g.dataset.goMsg); return; }
  const tl = t.closest("a[data-thread]");
  if (tl) { e.preventDefault(); if (world.thread(tl.dataset.thread)) go("t:" + tl.dataset.thread); else heraldShow({ kind: "calm", text: "That thread isn't loaded", sub: "it may be in another project" }, 3200); return; }
  if (t.closest("[data-older]")) { const c = chatOf(S.view); if (c) world.act.loadOlder(c); return; }
  const rl = t.closest("[data-rule]");
  if (rl) { decideKey(rl.dataset.rule, { teach: "prefix" }); return; }
  const d = t.closest("[data-decide]");
  if (d) { decideKey(d.dataset.decide); return; }
  if (t.closest("[data-next]")) { openNext(); return; }
  if (t.closest("[data-create]")) { openCreate(); return; }
  if (t.closest("[data-all-threads]")) { openAll(); return; }
  if (t.closest("[data-open-all]")) { D.open(homeParts().next?.key); return; }
  if (t.closest("[data-glances]")) { D.open(null, { only: "glance" }); return; }
  const l = t.closest("[data-later]");
  if (l) { D.laterNow(l.dataset.later); S.pin = null; return; }
  if (t.closest("[data-bring]")) { S.later.clear(); announce("Brought back. They're in today's list again."); schedule(); return; }
  if (t.closest("[data-handled]")) { setHandled(!S.handledOpen); return; }
  if (t.closest("[data-eod]")) { toggleEod(); return; }
  const pl = t.closest("[data-plant]");
  if (pl) { queueToggle(pl.dataset.plant); return; }
  if (t.closest("[data-gain]")) { const f = NIGHT.forecast(); D.open(f.gainAsks[0]?.key, { only: f.gainAsks.map((n) => n.key) }); return; }
  if (t.closest("[data-seal]")) { sealDay(); return; }
  if (t.closest("[data-unseal]")) { unseal(); return; }
  if (t.closest("[data-morning]")) { toMorning(); return; }
  if (t.closest("[data-morning-done]")) { const box = $("#hm-moment"); morph($("#hm-body"), () => { S.morningOpen = false; NIGHT.phase = "day"; render(); }, { duration: 320 }); box && announce("Folded the morning recap."); return; }
  if (t.closest("[data-rules]")) { S.rulesOpen = !S.rulesOpen; const sec = $("#rules"); sec.querySelector(".rl-h").setAttribute("aria-expanded", String(S.rulesOpen)); expand(sec, $("#rl-b"), S.rulesOpen); $("#ws-head")._h = null; return; }
  const bi = t.closest("[data-bring-in]");
  if (bi) { D.bringIn(bi.dataset.bringIn); return; }
  const fd = t.closest("[data-find]");
  if (fd) { commissionFind(fd.dataset.find); return; }
  const fx = t.closest("[data-find-x]");
  if (fx) { FV.dismiss(fx.dataset.findX); announce("Put aside. It won't come back today."); schedule(); return; }
  const ru = t.closest("[data-rec-undo]");
  if (ru) { undoRecord(ru.dataset.recUndo); return; }
  if (t.closest("[data-herald-undo]")) { const u = S.herald?.undo; if (typeof u === "function") { S.herald.until = 0; u(); heraldNext(); } else if (u) undoRecord(u); return; }
  // Chats: "send now" would stop background tasks; a failed prompt
  const chc = t.closest("[data-chc]");
  if (chc) { CH.resolveConfirm(S.view, chc.dataset.chc); return; }
  const chr = t.closest("[data-chat-retry]");
  if (chr) { CH.retry(chr.dataset.chatRetry); return; }
  const che = t.closest("[data-chat-edit]");
  if (che) { const text = CH.edit(che.dataset.chatEdit); if (text != null) { say.value = say.value.trim() ? `${text}\n\n${say.value}` : text; growSay(); saveDraft(); updateComposer(); say.focus(); } return; }
  if (e.target.closest("[data-chat-stop]")) { stopRun(); return; }
  // sub-agents: the strip under the checklist, the log, a sub-agent's row in a turn
  const rc = t.closest("[data-run-call]");
  if (rc) { const th = convThread(S.view); const r = [...(world.state.runs?.values() || [])].find((x) => x.spawn === rc.dataset.runCall); openRuns(th, r ? r.id : null); return; }
  const ro = t.closest("#thead [data-run]");
  if (ro) { openRuns(convThread(S.view), ro.dataset.run); return; }
  if (t.closest("#thead [data-runs]")) { openRuns(convThread(S.view)); return; }
  // storm blocks: open or fold a block or a row (thinking steps, an activity group, a command's output)
  const tb = t.closest("[data-tb]");
  if (tb) { const k = tb.dataset.tb; S.tbOpen[k] = !S.tbOpen[k]; schedule(); return; }
  // a thread's own header: resolve or reopen (R1), rename, label
  const rs = t.closest("[data-resolve]");
  if (rs) { resolveThread(rs.dataset.resolve, rs.dataset.to === "resolve"); return; }
  const tm = t.closest("[data-tmenu]");
  if (tm) { S.tMenu = S.tMenu === tm.dataset.tmenu ? null : tm.dataset.tmenu; $("#top-who")._h = null; schedule(); if (S.tMenu) requestAnimationFrame(() => $(".tw-menu button")?.focus()); return; }
  const tf = t.closest("[data-tfield]");
  if (tf) { const tid = S.tMenu; S.tMenu = null; if (tf.dataset.tfield === "clear-label") saveThreadField(tid, "label", ""); else startThreadEdit(tid, tf.dataset.tfield); return; }
  if (S.tMenu && !t.closest(".tw-menu")) { S.tMenu = null; $("#top-who")._h = null; schedule(); }
  if (t.closest("[data-ck]")) { const th = convThread(S.view); if (th) { S.ckOpen[th.id] = !S.ckOpen[th.id]; checklistRender(D.needItems()); } return; }
  const o = t.closest("[data-nx-opt]");
  if (o) { const n = homeParts().next; if (n) { o.classList.add("pressed"); nextDecide({ option: n.ask.options[+o.dataset.nxOpt] }); } return; }
  if (t.closest("[data-nx-allow]")) { nextDecide("allow"); return; }
  if (t.closest("[data-nx-back]")) { const card = $("#hm-next .next"); morph(card, () => { card.classList.add("noting"); card.querySelector(".nx-note").hidden = false; }, { duration: 280, fade: card.querySelector(".nx-note") }); card.querySelector("#nx-note-in").focus({ preventScroll: true }); return; }
  if (t.closest("[data-nx-send]")) { nextDecide("deny", $("#nx-note-in").value); return; }
  if (t.closest("[data-nx-cancel]")) { const card = $("#hm-next .next"); morph(card, () => { card.classList.remove("noting"); card.querySelector(".nx-note").hidden = true; }, { duration: 260 }); card.focus({ preventScroll: true }); return; }
  const r = t.closest("[data-retry]");
  if (r) { retry(r.dataset.retry); return; }
  const ed = t.closest("[data-edit]");
  if (ed) { editFailed(ed.dataset.edit); return; }
  const fb = t.closest("[data-file]");
  if (fb) { openSharedFile(fb); return; }
  const cp = t.closest("[data-copy]");
  if (cp) { navigator.clipboard?.writeText(cp.closest(".md-code")?.querySelector("code")?.textContent || "").catch(() => {}); cp.textContent = "Copied"; setTimeout(() => { cp.textContent = "Copy"; }, 1400); }
});
$("#home").addEventListener("keydown", (e) => {
  if (e.target.id === "nx-note-in") {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); nextDecide("deny", e.target.value); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); $("[data-nx-cancel]").click(); }
    return;
  }
  // on the focused Home card: 1–9 answer, A allows a routine glance, D sends back, E details
  const card = e.target.closest?.(".next");
  if (!card || e.target !== card || e.metaKey || e.ctrlKey || e.altKey) return;
  const n = homeParts().next;
  if (!n || n.key !== card.dataset.key) return;
  if (/^[1-9]$/.test(e.key) && Array.isArray(n.ask.options) && !Kit.isBinary(n.ask) && n.effort === "glance") { const o = n.ask.options[+e.key - 1]; if (o != null) { e.preventDefault(); e.stopPropagation(); nextDecide({ option: o }); } }
  else if (K.is(e, "allow") && Kit.isBinary(n.ask) && n.effort === "glance") { e.preventDefault(); e.stopPropagation(); nextDecide("allow"); }
  else if (K.is(e, "back") && n.effort === "glance") { e.preventDefault(); e.stopPropagation(); card.querySelector("[data-nx-back]")?.click(); }
  else if (K.is(e, "details") || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); decideKey(n.key); }
});
function openNext() {
  const P0 = homeParts();
  if (!P0.next || sealed()) { heraldShow({ kind: "calm", text: sealed() ? "Sealed until morning" : "Nothing needs you right now" }, 2400); return; }
  decideKey(P0.next.key);
}

async function commissionFind(id) {
  const p = FV.commission(id);
  schedule();
  const t = await p;
  const f = FV.S.list.find((x) => x.id === id);
  if (t) { announce(`Thread started in ${PROJ(t.project)}: ${f.title}`); heraldShow({ kind: "started", text: `Thread started: ${f.title}`, sub: PROJ(t.project), open: "t:" + t.id }, 6000); }
  schedule();
}

// ── All threads: searchable, filtered; finished ones fold into one line ────
const allEl = $("#all");
let allReturn = null;
function allRender() {
  const pid = convProject(S.view);
  const q = $("#all-q").value.trim().toLowerCase();
  const needs = D.needItems();
  const ts = world.state.threads.filter((t) => t.project === pid);
  const cat = (t) => (needs.some((n) => n.t.id === t.id && n.admitted && n.group !== "stopped") ? "needs" : t.state === "failed" ? "stopped" : t.state === "working" || WAITING(t.state) ? "working" : t.state === "done" || t.state === "resolved" ? "done" : "other");
  const counts = { all: ts.length, needs: 0, working: 0, done: 0, stopped: 0 };
  for (const t of ts) { const c = cat(t); if (counts[c] != null) counts[c]++; }
  const F = [["all", "All"], ["needs", "Needs you"], ["working", "Working"], ["done", "Done"], ["stopped", "Stopped"]];
  $("#all-f").innerHTML = F.map(([k, w]) => `<button type="button" role="radio" data-af="${k}" aria-checked="${S.allFilter === k}"${!counts[k] && k !== "all" ? " disabled" : ""}>${w}<span>${counts[k]}</span></button>`).join("");
  $("#all-h").textContent = `All threads · ${PROJ(pid)}`;
  let list = ts.filter((t) => !q || t.title.toLowerCase().includes(q) || (t.branch || "").toLowerCase().includes(q));
  if (S.allFilter !== "all") list = list.filter((t) => cat(t) === S.allFilter);
  const order = { needs: 0, stopped: 1, working: 2, done: 3, other: 4 };
  list.sort((a, b) => order[cat(a)] - order[cat(b)] || b.lastAt - a.lastAt);
  const row = (t) => {
    const c = t.checklist;
    const k = cat(t);
    return `<li><button type="button" class="ar st-${k}" data-go="t:${esc(t.id)}"><i class="g g-${k === "needs" ? "needs_reply" : glyphOf(t)}" aria-hidden="true"></i><span class="ar-t">${esc(t.title)}</span>${t.label ? `<span class="ar-l">${esc(t.label)}</span>` : ""}<span class="ar-s">${k === "needs" ? "Needs you" : wordOf(t)}</span><span class="mini" aria-label="${c.done} of ${c.total}"><i style="--p:${c.total ? c.done / c.total : 0}"></i></span><span class="ar-a">${esc(short(t.lastAt))}</span></button></li>`;
  };
  const fold = S.allFilter === "all" && !q;
  const liveL = fold ? list.filter((t) => cat(t) !== "done") : list;
  const done = fold ? list.filter((t) => cat(t) === "done") : [];
  let html = liveL.length ? `<ul class="ar-list">${liveL.map(row).join("")}</ul>` : "";
  if (done.length) html += `<div class="ar-done${S.allDone ? " is-open" : ""}"><button type="button" class="ar-fold" data-all-done aria-expanded="${S.allDone}">${ICON.check}<span><b>${done.length} done</b>${done.some((t) => t.state === "resolved") ? " or resolved" : ""}</span>${ICON.chevron}</button><div class="ar-db"${S.allDone ? "" : " hidden"}><div class="ar-di"><ul class="ar-list">${done.map(row).join("")}</ul></div></div></div>`;
  if (!html) html = `<p class="ar-none">Nothing matches “${esc(q)}”.</p>`;
  $("#all-list").innerHTML = html;
}
function openAll() {
  if (!convProject(S.view) || convProject(S.view) === "workspace") return;
  allReturn = document.activeElement;
  S.allFilter = "all"; S.allDone = false;
  $("#all-q").value = "";
  allRender();
  allEl.hidden = false;
  $("#all-q").focus();
}
function closeAll() { if (allEl.hidden) return; allEl.hidden = true; allReturn?.focus?.({ preventScroll: true }); }
$("#all-q").addEventListener("input", allRender);
allEl.addEventListener("click", (e) => {
  if (e.target === allEl || e.target.closest("[data-close]")) { closeAll(); return; }
  const f = e.target.closest("[data-af]");
  if (f) { S.allFilter = f.dataset.af; allRender(); return; }
  if (e.target.closest("[data-all-done]")) {
    const box = $(".ar-done");
    S.allDone = !S.allDone;
    box.querySelector(".ar-fold").setAttribute("aria-expanded", String(S.allDone));
    expand(box, box.querySelector(".ar-db"), S.allDone);
    return;
  }
  const g = e.target.closest("[data-go]");
  if (g) { allEl.hidden = true; go(g.dataset.go); }
});

// ── Create XO Project ───────────────────────────────────────────────────────
const dlg = $("#create-dlg");
let projectsRoot = world.mode === "live" ? null : "~/xo-projects";
const slugify = (name) => String(name || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
function renderWhere() {
  const id = slugify($("#cp-name").value);
  const root = projectsRoot ? projectsRoot.replace(/^\/home\/[^/]+/, "~") : "your projects folder";
  const el = $("#cp-where");
  el.innerHTML = id ? `${ICON.folder}<span>Saved as <code>${esc(root)}/${esc(id)}</code></span>` : "";
  el.hidden = !id;
}
function createError(text) { $("#cp-err").textContent = text; $("#cp-err").hidden = !text; }
async function openCreate() {
  setDrawer(false);
  $("#create-form").reset();
  createError("");
  $("#cp-submit").disabled = false;
  $("#cp-submit").textContent = "Create project";
  renderWhere();
  dlg.showModal();
  $("#cp-name").focus();
  if (world.mode === "live" && !projectsRoot) {
    try {
      const { api } = await import("./api.js");
      const cfg = await api.workspaceConfig();
      projectsRoot = cfg.roots?.[cfg.default] || null;
      renderWhere();
    } catch (err) { createError(`Can't read where projects live: ${err.message}`); }
  }
}
function closeCreate() {
  if (!dlg.open) return;
  // On a phone the sidebar button that opened it is inside the closed drawer: return to the menu.
  if (PHONE.matches) setTimeout(() => $("#pb-menu").focus({ preventScroll: true }), RM.matches ? 0 : 170);
  if (RM.matches) { dlg.close(); return; }
  dlg.classList.add("is-closing");
  setTimeout(() => { dlg.classList.remove("is-closing"); dlg.close(); }, 160);
}
async function submitCreate() {
  const name = $("#cp-name").value.trim();
  const id = slugify(name);
  const description = $("#cp-desc").value.trim();
  if (!name) { createError("Give the project a name."); $("#cp-name").focus(); return; }
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(id)) { createError("Use at least one letter or number in the name."); $("#cp-name").focus(); return; }
  if (world.state.projects.some((p) => p.id === id)) { createError(`There's already a project called “${id}”. Pick another name.`); $("#cp-name").focus(); return; }
  if (!projectsRoot) { createError("Can't create yet: the projects folder is unknown. Is the XO API running?"); return; }
  createError("");
  const btn = $("#cp-submit");
  btn.disabled = true;
  btn.innerHTML = `<i class="spin" aria-hidden="true"></i>Creating…`;
  try {
    if (world.mode === "live") {
      const { api } = await import("./api.js");
      await api.createProject({ path: `${projectsRoot}/${id}`, displayName: name, description });
      await world.act.refresh();
    } else {
      // Demo: simulated locally. Live calls GET /api/config/workspace, then POST /api/files/mkdir {path, scaffold:true, display_name, description}.
      await wait(650);
      world.state.projects.push({ id, name, kind: "project" });
      await world.act.refresh();
    }
    if (description) S.desc[id] = description;
    if (!DEMO) S.local["p:" + id] = [{ id: `l${++S.n}_hello`, conv: "p:" + id, at: Date.now(), who: "event", tone: "ok", text: `${name} created · folder, plan and memory scaffolded${description ? ` · ${description.replace(/[.\s]+$/, "")}` : ""}` }];
    else S.local["p:" + id] = [{ id: `l${++S.n}_hello`, conv: "p:" + id, at: Date.now(), who: "coord", text: `**${name}** is ready: its folder, plan and memory are scaffolded${description ? `, and I've noted what it's for: _${description.replace(/[.\s]+$/, "")}_` : ""}.\n\nTell me the first thing you'd like done.` }];
    closeCreate();
    go("p:" + id, { focus: true });
    heraldShow({ kind: "ready", text: `${name} is ready`, sub: `${projectsRoot}/${id}` }, 5200);
    announce(`${name} is ready.`);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Create project";
    createError(err.status === 409 ? `There's already a project called “${id}”. Pick another name.` : err.message);
  }
}
$("#side-add").addEventListener("click", openCreate);
$("#cp-name").addEventListener("input", () => { renderWhere(); createError(""); });
$("#cp-cancel").addEventListener("click", closeCreate);
$("#create-form").addEventListener("submit", (e) => { e.preventDefault(); submitCreate(); });
dlg.addEventListener("cancel", (e) => { e.preventDefault(); closeCreate(); });

// ── phone drawer ────────────────────────────────────────────────────────────
function setDrawer(open) {
  if (!PHONE.matches && open) return;
  $("#app").classList.toggle("drawer", !!open);
  $("#side-scrim").hidden = !open;
  $("#pb-menu").setAttribute("aria-expanded", String(!!open));
  if (open) $("#nv-home").focus();
}
$("#pb-menu").addEventListener("click", () => setDrawer(true));
$("#side-x").addEventListener("click", () => setDrawer(false));
$("#side-scrim").addEventListener("click", () => setDrawer(false));

// ── jump (⌘K) ───────────────────────────────────────────────────────────────
const jump = $("#jump"), jq = $("#jump-q"), jl = $("#jump-list");
let jsel = 0, jitems = [];
function jumpRender() {
  const q = jq.value.trim().toLowerCase();
  const all = [{ v: "home", name: "Home", sub: "Your next move", icon: ICON.home }, { v: "ws", name: "Workspace", sub: "The coordinator", icon: XO }, { v: "chats", name: "Chats", sub: "One agent, one folder", icon: ICON.thread }];
  for (const p of projects()) {
    all.push({ v: "p:" + p.id, name: p.name, sub: "Project", icon: ICON.project });
    for (const t of threadsOf(p.id)) all.push({ v: "t:" + t.id, name: t.title, sub: `${p.name} · ${wordOf(t).toLowerCase()}`, icon: `<i class="g g-${glyphOf(t)}"></i>`, t: true });
  }
  jitems = all.filter((x) => !q || (x.name + " " + x.sub).toLowerCase().includes(q));
  jsel = Math.min(jsel, Math.max(0, jitems.length - 1));
  jl.innerHTML = jitems.map((x, i) => `<li role="option" id="j-${i}" aria-selected="${i === jsel}" data-i="${i}" class="${x.t ? "is-t" : ""}"><span class="j-ic">${x.icon}</span><span class="j-n">${esc(x.name)}</span><span class="j-s">${esc(x.sub)}</span></li>`).join("") || `<li class="j-none">Nothing matches “${esc(q)}”.</li>`;
  jq.setAttribute("aria-activedescendant", jitems.length ? `j-${jsel}` : "");
  jl.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
}
function openJump() { jump.hidden = false; jq.value = ""; jsel = 0; jumpRender(); jq.focus(); }
function closeJump() { jump.hidden = true; }
jq.addEventListener("input", () => { jsel = 0; jumpRender(); });
jq.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); jsel = (jsel + (e.key === "ArrowDown" ? 1 : jitems.length - 1)) % Math.max(1, jitems.length); jumpRender(); }
  if (e.key === "Enter") { e.preventDefault(); const x = jitems[jsel]; closeJump(); if (x) go(x.v); }
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeJump(); }
});
jl.addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) { const x = jitems[+li.dataset.i]; closeJump(); go(x.v); } });
jump.addEventListener("mousedown", (e) => { if (e.target === jump) closeJump(); });

// ── keys sheet ──────────────────────────────────────────────────────────────
const keys = $("#keys");
function soundRender() { $("#sound-tog").setAttribute("aria-checked", String(sound.on)); }
$("#sound-tog").addEventListener("click", () => { sound.on = !sound.on; soundRender(); sound.play("allow"); });
function hopsRender() { const b = $("#hops-tog"); b.setAttribute("aria-checked", String(!!S.showHops)); if (!b.querySelector(".th-knob svg")) b.querySelector(".th-knob").innerHTML = ICON.router; }
$("#hops-tog").addEventListener("click", () => {
  S.showHops = !S.showHops;
  try { localStorage.setItem("cv-hops", S.showHops ? "1" : "0"); } catch { /* private */ }
  hopsRender();
  const t = convThread(S.view);
  if (S.showHops && t && world.act.loadHops) world.act.loadHops(t.id);
  announce(S.showHops ? "Showing how messages travel." : "Hiding how messages travel.");
  schedule();
});
hopsRender();
keys.addEventListener("click", (e) => { if (e.target === keys || e.target.closest("[data-close]")) closeKeys(); });
let keysReturn = null;
function openKeys() { keysSheetRender(); keysReturn = document.activeElement; keys.hidden = false; keys.querySelector("[data-close]").focus(); }
function closeKeys() { keys.hidden = true; keysReturn?.focus?.({ preventScroll: true }); }

// ── settings: a page over the main area; closing it returns exactly where you were ──
const setEl = $("#settings");
let setReturn = null;
const SETS = createSettings({ world, announce, PROJ, onChange: () => schedule() });
function setPage(id) {
  for (const b of $$("[data-set]")) b.setAttribute("aria-selected", String(b.dataset.set === id));
  for (const p of $$("[data-page]")) p.hidden = p.dataset.page !== id;
  SETS.open(id);
}
function openSettings() {
  if (!setEl.hidden) return;
  setReturn = document.activeElement;
  setDrawer(false);
  if (D.isOpen()) D.close();
  IQ.close({ restore: false });
  setEl.hidden = false;
  $("#set-side").classList.add("is-on");
  $("#set-side").setAttribute("aria-expanded", "true");
  setEl.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
}
function closeSettings({ restore = true } = {}) {
  if (setEl.hidden) return;
  if (S.recording) { S.recording = null; keysPageRender(); }
  setEl.hidden = true;
  $("#set-side").classList.remove("is-on");
  $("#set-side").setAttribute("aria-expanded", "false");
  // back where you were; an opener that's gone or hidden (Jump's box) gives way to the composer
  if (restore) (setReturn && setReturn.isConnected && setReturn.offsetParent ? setReturn : say)?.focus?.({ preventScroll: true });
}
$("#set-side").addEventListener("click", () => (setEl.hidden ? openSettings() : closeSettings()));
$("#set-phone").addEventListener("click", openSettings);
$("#set-x").addEventListener("click", () => closeSettings());
for (const b of $$("[data-set]")) b.addEventListener("click", () => setPage(b.dataset.set));

// ── shortcuts: one list (keys.js) drives the handlers, the tooltips, the sheet and this page ──
function keysSheetRender() {
  const col = (ids) => `<dl class="keys">${ids.map((g) => `<dt class="kh">${esc(K.GROUPS.find((x) => x.id === g).name)}</dt><dd></dd>` +
    K.ACTIONS.filter((a) => a.scope === g).map((a) => `<dt><kbd>${esc(K.label(a.id))}</kbd></dt><dd>${esc(a.label)}</dd>`).join("")).join("")}</dl>`;
  $("#keys-cols").innerHTML = col(["global"]) + col(["decision", "intel"]);
}
function keysPageRender() {
  const box = $("#set-keys-list");
  const rec = S.recording, err = S.keyErr;
  box.innerHTML = `<p class="kp-t">Click a key to change it. Keys that work anywhere need ⌘ or Ctrl, or a symbol like / or ?, so typing never sets them off. Your keys are kept in this browser.</p>` +
    K.GROUPS.map((g) => `<section class="kg" aria-labelledby="kg-${g.id}"><h3 id="kg-${g.id}">${esc(g.name)}</h3><div class="kl">` +
      K.ACTIONS.filter((a) => a.scope === g.id).map((a) => {
        const key = a.fixed
          ? `<span class="kr-k is-fixed" title="This one is fixed"><kbd>${esc(a.fixed)}</kbd></span>`
          : `<button type="button" class="kr-k${rec === a.id ? " is-rec" : ""}" data-rebind="${a.id}" aria-label="${esc(a.label)}: ${esc(K.label(a.id))}. ${rec === a.id ? "Press the new key, or Esc to cancel" : "Change it"}">${rec === a.id ? `<span class="kr-rec">Press a key…</span>` : `<kbd>${esc(K.label(a.id))}</kbd>`}</button>`;
        const reset = !a.fixed && K.changed(a.id) ? `<button type="button" class="kr-r" data-kreset="${a.id}" title="Back to ${esc(K.show(a.def))}" aria-label="Reset ${esc(a.label)} to ${esc(K.show(a.def))}">${ICON.retry}</button>` : `<span class="kr-r" aria-hidden="true"></span>`;
        return `<div class="kr${K.changed(a.id) ? " is-changed" : ""}${a.fixed ? " is-fixed" : ""}"><span class="kr-l">${esc(a.label)}</span>${key}${reset}</div>` +
          (err && err.id === a.id ? `<p class="kr-err" role="alert">${esc(err.msg)}</p>` : "");
      }).join("") + `</div></section>`).join("") +
    `<div class="kp-f"><button type="button" class="btn" id="keys-reset-all"${K.anyChanged() ? "" : " disabled"}>${ICON.retry}Reset all to defaults</button></div>`;
  if (rec) box.querySelector(`[data-rebind="${rec}"]`)?.focus({ preventScroll: true });
}
$("#set-keys-list").addEventListener("click", (e) => {
  const rb = e.target.closest("[data-rebind]");
  if (rb) { S.keyErr = null; S.recording = S.recording === rb.dataset.rebind ? null : rb.dataset.rebind; keysPageRender(); return; }
  const rs = e.target.closest("[data-kreset]");
  if (rs) { S.keyErr = null; K.reset(rs.dataset.kreset); return; }
  if (e.target.closest("#keys-reset-all")) { S.keyErr = null; S.recording = null; K.resetAll(); }
});
document.addEventListener("pointerdown", (e) => {
  // a click anywhere but a key chip cancels a recording
  if (S.recording && !e.target.closest?.("[data-rebind]")) { S.recording = null; S.keyErr = null; keysPageRender(); }
}, true);
addEventListener("keydown", (e) => {
  if (!S.recording) return;
  e.preventDefault(); e.stopPropagation();
  if (e.key === "Escape" && !e.metaKey && !e.ctrlKey) { S.recording = null; S.keyErr = null; keysPageRender(); return; }
  const combo = K.fromEvent(e);
  if (!combo) return; // a modifier on its own: keep listening
  const id = S.recording;
  const r = K.set(id, combo);
  S.recording = null;
  S.keyErr = r.error ? { id, msg: r.error } : null;
  keysPageRender();
  $(`[data-rebind="${id}"]`)?.focus({ preventScroll: true });
  if (r.ok) announce(`${K.ACTIONS.find((a) => a.id === id).label}: ${K.label(id)}`);
}, true);
K.onChange(() => { keysPageRender(); if (!keys.hidden) keysSheetRender(); schedule(); });
keysPageRender();
setEl.querySelector(".set-nav").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  e.preventDefault();
  const tabs = $$("[data-set]");
  const i = tabs.indexOf(document.activeElement);
  const nx = tabs[(i + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
  nx.focus(); setPage(nx.dataset.set);
});

// ── theme toggle ────────────────────────────────────────────────────────────
$("#theme").addEventListener("click", () => {
  const t = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  try { localStorage.setItem("cv-theme", t); } catch { /* private */ }
  applyTheme(t);
  announce(t === "light" ? "Light mode" : "Dark mode");
});

// ── global keys ─────────────────────────────────────────────────────────────
const GLOBAL = {
  jump: () => (jump.hidden ? openJump() : closeJump()),
  intel: () => (IQ.isOpen ? IQ.close() : IQ.open(sessionOf(S.view), $("#iq"))),
  write: () => say.focus(),
  keys: () => openKeys(),
};
addEventListener("keydown", (e) => {
  if (S.recording) return; // Settings › Keyboard is listening for a new key
  // ⌘/Ctrl keys work everywhere, even while typing
  for (const id of ["jump", "intel"]) if (K.hasMod(id) && K.is(e, id)) { e.preventDefault(); GLOBAL[id](); return; }
  if (!jump.hidden || dlg.open || IQ.isOpen) return;
  if (e.key === "Escape") {
    if (RS.open) { runsEscape(); return; }
    if (VW.isOpen) { VW.close(); return; }
    if (!keys.hidden) { closeKeys(); return; }
    if (!setEl.hidden) { closeSettings(); return; }
    if (!allEl.hidden) { closeAll(); return; }
    if ($("#app").classList.contains("drawer")) { setDrawer(false); return; }
    if (D.isOpen()) { D.close(); return; }
    if (CH.setupOpen) { CH.closeSetup(); return; }
    if (S.view.startsWith("t:")) back();
    else if (S.view.startsWith("c:")) go("chats");
    return;
  }
  if (e.target.matches?.("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (!keys.hidden || !allEl.hidden) return;
  // Only keys that can't be hit by accident: no single letters (a stray keystroke must never
  // navigate or open something). Decision keys live on a focused decision card only.
  for (const id of Object.keys(GLOBAL)) if (K.is(e, id)) { e.preventDefault(); GLOBAL[id](); return; }
});

// ── boot ────────────────────────────────────────────────────────────────────
$("#brand-mark").innerHTML = XO;
$("#sc-ic").innerHTML = ICON.plus;
$("#dlg-ic").innerHTML = ICON.project;
$("#ic-home").innerHTML = ICON.home;
$("#ic-ws").innerHTML = XO;
$("#ic-chats").innerHTML = ICON.thread;
// a new chat's setup: folder, agent, model, effort, what it may do (all from the runtime's feature list)
{
  const cs = $("#cs-pop");
  cs.addEventListener("change", (e) => { const f = e.target.closest("[data-cs]"); if (f) { CH.setPref(f.dataset.cs, f.value); CH.renderSetup(); updateComposer(); } });
  cs.addEventListener("click", (e) => {
    const m = e.target.closest("[data-csmode]");
    if (m) { CH.setPref("mode", m.dataset.csmode); CH.renderSetup(); updateComposer(); return; }
    if (e.target.closest("[data-cs-done]")) { CH.closeSetup(); updateComposer(); }
  });
  cs.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); CH.closeSetup(); } });
  document.addEventListener("pointerdown", (e) => { if (CH.setupOpen && !cs.contains(e.target) && !e.target.closest("#target")) CH.closeSetup(); });
}
$("#pb-menu").innerHTML = ICON.menu;
$("#side-x").innerHTML = ICON.close;
$("#pn-x").innerHTML = ICON.close;
$("#set-x").innerHTML = ICON.close;
$("#set-side-ic").innerHTML = ICON.gear;
// Settings' rail: each section with its icon (hub #18/#19)
{
  const IC = { general: ICON.sliders, appearance: ICON.sun, routing: ICON.router, rules: ICON.rule, worktrees: ICON.branch, night: ICON.moon, sounds: ICON.sound, keys: ICON.key };
  for (const b of $$("[data-set]")) b.innerHTML = `<span class="sn-ic" aria-hidden="true">${IC[b.dataset.set] || ""}</span><span class="sn-t">${esc(b.textContent)}</span>`;
}
$("#sf-ic").innerHTML = ICON.search;
$("#set-phone").innerHTML = ICON.gear;
$("#sound-tog .th-knob").innerHTML = ICON.sound;
for (const x of $$(".sheet [data-close]")) x.innerHTML = ICON.close;
$("#jump-ic").innerHTML = ICON.search;
$("#all-ic").innerHTML = ICON.search;
$("#send").innerHTML = ICON.send; $("#send").dataset.mode = "send";
$("#nb-ic").innerHTML = ICON.down;
$("#theme").innerHTML = `<span class="th-track" aria-hidden="true"><span class="th-knob">${ICON.sun}${ICON.moon}</span></span>`;
applyTheme(THEME.get());
soundRender();
PHONE.addEventListener("change", () => { setDrawer(false); render(); });

(async () => {
  // Place the demo at a moment of the day: day, evening, night, the morning, or back after days away.
  S.booting = true;
  try {
  const phase = DEMO ? NIGHT.boot() : "day";
  if (phase === "night") { await NIGHT.endDay(); P.sealed = true; }
  else if (phase === "morning") {
    await NIGHT.endDay();
    NIGHT.runNight(NIGHT.away || 1);
    S.morningOpen = true;
    if (NIGHT.away) { const adm = D.needItems().filter((n) => n.admitted && !n.bypass); P.park(adm.slice(3).map((n) => n.key)); }
  }
  } finally { S.booting = false; }
  world.subscribe(() => schedule());
  follow();
  loadDraft();
  render();
  absorbSweep();
  if (world.mode === "demo") window.__cv = { world, S, P, D, R, FV, NIGHT, IQ, go, render, heraldShow, waitSince, sealDay, toMorning };
})();

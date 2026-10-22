// Converged · intelligence per session (requirements R6).
//
// Every session (the Workspace chat, a project chat, a thread) starts on what
// the router decides, and keeps it until the person changes it; from then on
// it keeps the person's choice ("sticky per session"). Workspace and project
// sessions can also choose WHO routes: the agent backend (Router) or a
// decision model (Sage, Jev). The level is called Depth (Quick · Balanced ·
// Deep), never "effort": Glance / Decide / Think already name decision effort.
//
//   the chip      the quietest thing in the composer: "Auto · Sonnet ··", or
//                 "• Opus ···" when pinned. Neutral ink only, never glows; a
//                 160 ms cross-fade when the router's choice changes.
//   the popover   anchored above the chip (a bottom sheet on a phone), sized
//                 to its content: routing (workspace/project only; options
//                 without a key are dimmed with "Add key", never hidden),
//                 at most four model rows with their Depth pips, type to
//                 filter the rest, Back to Auto. One click on a pip pins
//                 model + depth. No Apply.
//   the record    every change writes one quiet line in the conversation
//                 ("You set Opus ··· for this thread · Undo", 3 s). In Auto a
//                 per-message pick shows in that message's meta, not the chip.
//
// Demo mode simulates the router's picks and the pin store client-side (no
// writes). Live mode is js/intel-live.js, on storm's chats and threads.
import * as K from "./keys.js";
import { esc } from "./world.js";
import { ICON, RM } from "./ui.js";
import { createLiveIntel } from "./intel-live.js";

export const DEPTH = {
  1: { name: "Quick", pips: "·", effort: "low" },
  2: { name: "Balanced", pips: "··", effort: "medium" },
  3: { name: "Deep", pips: "···", effort: "high" },
};
// From config/agents/<backend>/capabilities.json ∩ configured keys (demo copy).
export const MODELS = [
  { id: "sonnet", name: "Sonnet", trait: "balanced, fast", depths: [1, 2, 3] },
  { id: "opus", name: "Opus", trait: "hardest problems", depths: [1, 2, 3] },
  { id: "haiku", name: "Haiku", trait: "quick edits", depths: [1, 2] },
  { id: "sonnet-1m", name: "Sonnet 1M", trait: "whole-repo context", depths: [2, 3] },
  { id: "opus-plan", name: "Opus Plan", trait: "long, careful plans", depths: [3] },
  { id: "local", name: "Local", trait: "offline, private", depths: [1], runtime: true },
];
export const ROUTING = [
  { id: "agent", name: "Router", line: "The agent backend picks a model for each message." },
  { id: "sage", name: "Sage", line: "Levanto Sage, a decision model, routes each message." },
  { id: "jev", name: "Jev", line: "TypeSafe Jev, a decision model, routes each message." },
];
const VISIBLE = 4;
const model = (id) => MODELS.find((m) => m.id === id) || MODELS[0];
const pips = (d) => DEPTH[d]?.pips || "··";

export function createIntel({ world, PROJ, params, onChange, record }) {
  if (world.mode !== "demo") return createLiveIntel({ world, PROJ, onChange, record });
  // Pins are kept per mode: a demo pin never shows up in live (P3-4).
  const KEY = world.mode === "demo" ? "cv-iq" : "cv-iq:live";
  const keys = new Set(["agent", ...(params.get("keys") || "").split(",").map((s) => s.trim()).filter(Boolean)]);
  const store = { get() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private */ } } };
  const pins = store.get();           // session → { routing, model, depth }
  const auto = {};                    // session → the router's last pick { model, depth, why }
  const routing = {};                 // session → routing when not pinned
  const P = { open: false, session: null, cur: 0, depth: 2, q: "", anchor: null, returnTo: null };

  const kindOf = (s) => (s === "ws" ? "workspace" : s.startsWith("p:") ? "project" : "thread");
  const nameOf = (s) => (s === "ws" ? "the Workspace" : s.startsWith("p:") ? PROJ(s.slice(2)) : "this thread");
  const scopeWord = (s) => (s === "ws" ? "the Workspace" : s.startsWith("p:") ? "this project" : "this thread");

  /** The demo router: a believable pick from what the session is about (live: the stream's `setup`). */
  function routerPick(session, text = "") {
    const by = routing[session] && routing[session] !== "agent" ? ROUTING.find((r) => r.id === routing[session]).name : "Router";
    if (text) {
      if (/\b(why|debug|design|architect|plan|trade-?off|root cause)\b/i.test(text)) return { model: "opus", depth: 3, why: "you asked why; deeper reasoning helps", by };
      if (text.length < 48) return { model: "haiku", depth: 1, why: "a short, simple ask", by };
      return { model: "sonnet", depth: 2, why: "a normal-sized task", by };
    }
    if (session === "ws") return { model: "sonnet", depth: 2, why: "questions across projects, no code changes", by };
    if (session.startsWith("p:")) {
      const pid = session.slice(2);
      if (pid === "data-pipeline") return { model: "opus", depth: 3, why: "a failing job with timezone logic", by };
      if (pid === "research") return { model: "sonnet-1m", depth: 2, why: "long papers in context", by };
      return { model: "sonnet", depth: 2, why: "planning and routing work", by };
    }
    const t = world.thread(session.slice(2));
    if (!t) return { model: "sonnet", depth: 2, why: "code changes with tests", by };
    if (t.state === "failed") return { model: "opus", depth: 3, why: "it stopped on an error", by };
    if (/contrast|copy|css|video|docs?|readme/i.test(t.title)) return { model: "haiku", depth: 1, why: "small, visual edits", by };
    if (/backfill|migrat|offline|retry|proration/i.test(t.title)) return { model: "opus", depth: 2, why: "data correctness matters here", by };
    return { model: "sonnet", depth: 2, why: "code changes with tests", by };
  }

  function current(session) {
    const pin = pins[session];
    if (pin) return { ...pin, pinned: true, source: "user", routing: pin.routing || "agent" };
    auto[session] = auto[session] || routerPick(session);
    return { ...auto[session], pinned: false, source: "router", routing: routing[session] || "agent" };
  }

  function chipLabel(session) {
    const c = current(session);
    const m = model(c.model);
    const route = kindOf(session) !== "thread" && c.routing !== "agent" ? `${ROUTING.find((r) => r.id === c.routing).name} → ` : "";
    return { c, m, route };
  }

  function chipHtml(session, phone = false) {
    const { c, m, route } = chipLabel(session);
    if (phone) return `<span class="iq-g" aria-hidden="true">${c.pinned ? `<i class="iq-dot"></i>` : "◇"}</span><span class="iq-p">${pips(c.depth)}</span>`;
    return c.pinned
      ? `<i class="iq-dot" aria-hidden="true"></i><span class="iq-t">${esc(route)}${esc(m.name)}</span><span class="iq-p">${pips(c.depth)}</span>`
      : `<span class="iq-t"><span class="iq-a">Auto</span> · ${esc(route)}${esc(m.name)}</span><span class="iq-p">${pips(c.depth)}</span>`;
  }
  function chipTitle(session) {
    const { c, m } = chipLabel(session);
    return c.pinned
      ? `Pinned for ${scopeWord(session)}: ${m.name} · ${DEPTH[c.depth].name}. Click to change${K.hint("intel")}`
      : `${c.by || "Router"} chose ${m.name} · ${DEPTH[c.depth].name}: ${c.why}. Click to choose${K.hint("intel")}`;
  }

  // ── changes: one record line each, with a 3 s Undo ───────────────────────
  async function set(session, value, { quiet = false } = {}) {
    const before = pins[session] ? { ...pins[session] } : null;
    const m = value ? model(value.model) : null;
    // the backend refuses what it can't run; the chip reverts to Auto and the record says why
    if (m && m.runtime && world.mode !== "live") {
      delete pins[session]; store.set(pins); onChange();
      record(session, { text: `${m.name} isn't running on this machine, so ${scopeWord(session)} stays on Auto.`, refused: true });
      return;
    }
    if (value) pins[session] = { routing: value.routing || current(session).routing || "agent", model: value.model, depth: value.depth };
    else delete pins[session];
    store.set(pins);
    onChange();
    if (quiet) return;
    const now = current(session);
    const text = value
      ? `You set ${model(now.model).name} ${pips(now.depth)} for ${scopeWord(session)}`
      : `Back to Auto for ${scopeWord(session)} · the router decides`;
    record(session, { text, undo: () => { if (before) pins[session] = before; else delete pins[session]; store.set(pins); onChange(); } });
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function setRouting(session, r) {
    if (!keys.has(r)) return;
    const before = routing[session] || "agent";
    if (before === r) return;
    if (pins[session]) { pins[session].routing = r; store.set(pins); }
    routing[session] = r;
    auto[session] = routerPick(session);
    onChange();
    const name = ROUTING.find((x) => x.id === r).name;
    record(session, { text: `${name} now routes ${scopeWord(session)}`, undo: () => { routing[session] = before; if (pins[session]) pins[session].routing = before; auto[session] = routerPick(session); store.set(pins); onChange(); } });
  }

  /** In Auto, the router may pick per message. Returns the setup for that message's meta. */
  function routed(session, text) {
    const c = current(session);
    if (c.pinned) return { name: model(c.model).name, pips: pips(c.depth), src: "pinned" };
    const pick = routerPick(session, text);
    const changed = !auto[session] || auto[session].model !== pick.model || auto[session].depth !== pick.depth;
    auto[session] = pick;
    if (changed) onChange({ fade: true });
    return { name: model(pick.model).name, pips: pips(pick.depth), src: (pick.by || "Router").toLowerCase() };
  }
  /** The setup a new thread starts with (never inherits a pin). */
  const spawnSetup = (tid) => {
    const p = routerPick("t:" + tid); auto["t:" + tid] = p; return { name: model(p.model).name, pips: pips(p.depth) }; };

  // ── the popover ───────────────────────────────────────────────────────────
  const pop = document.getElementById("iq-pop");
  function rows() {
    const s = P.session, c = current(s);
    const q = P.q.trim().toLowerCase();
    let list = MODELS.slice();
    // the router's recent pick first, then the rest in their usual order
    const lead = model(c.model);
    list = [lead, ...list.filter((m) => m !== lead)];
    if (q) list = list.filter((m) => (m.name + " " + m.trait).toLowerCase().includes(q));
    return { shown: list.slice(0, VISIBLE), more: q ? 0 : Math.max(0, list.length - VISIBLE), total: list.length };
  }
  function popRender() {
    if (!P.open) return;
    const s = P.session, c = current(s);
    const kind = kindOf(s);
    const { shown, more } = rows();
    P.cur = Math.min(P.cur, Math.max(0, shown.length - 1));
    const r = c.routing || "agent";
    const routeHtml = kind === "thread" ? "" :
      `<div class="iq-sec"><div class="iq-route" role="radiogroup" aria-label="Who routes">${ROUTING.map((x) => {
        const has = keys.has(x.id);
        return `<button type="button" role="radio" data-route="${x.id}" aria-checked="${r === x.id}"${has ? "" : ` aria-disabled="true" title="${esc(x.name)} needs an API key"`} class="${has ? "" : "no-key"}">${x.id === "agent" ? ICON.router : ""}${esc(x.name)}${has ? "" : `<small>Add key</small>`}</button>`;
      }).join("")}</div><p class="iq-rl">${esc(ROUTING.find((x) => x.id === r).line)}</p></div>`;
    const now = c.pinned
      ? `<p class="iq-now"><i class="iq-dot"></i>Pinned: <b>${esc(model(c.model).name)} ${pips(c.depth)}</b> until you change it.</p>`
      : `<p class="iq-now"><b>${esc(c.by || "Router")}</b> chose <b>${esc(model(c.model).name)} ${pips(c.depth)}</b>: ${esc(c.why)}.</p>`;
    const list = shown.map((m, i) => {
      const sel = c.pinned && m.id === c.model;
      const on = i === P.cur;
      const dep = [1, 2, 3].map((d) => {
        const ok = m.depths.includes(d);
        const isSel = sel && d === c.depth;
        return `<button type="button" class="iq-pip${isSel ? " is-sel" : ""}${on && d === P.depth ? " is-cur" : ""}" data-pin="${m.id}|${d}"${ok ? "" : " disabled"} tabindex="-1" aria-label="${esc(m.name)}, ${DEPTH[d].name}${ok ? "" : " (not available)"}" title="${DEPTH[d].name}${ok ? "" : ": not available for this model"}"><span class="pd">${"<i></i>".repeat(d)}</span></button>`;
      }).join("");
      return `<div class="iq-row${on ? " is-cur" : ""}${sel ? " is-sel" : ""}" role="option" id="iq-o${i}" aria-selected="${on}" data-row="${i}" data-model="${m.id}">` +
        `<span class="iq-mk" aria-hidden="true">${sel ? `<i class="iq-dot"></i>` : ""}</span><span class="iq-n">${esc(m.name)}</span><span class="iq-tr">${esc(m.trait)}</span><span class="iq-d">${dep}</span></div>`;
    }).join("") || `<p class="iq-none">No model matches “${esc(P.q)}”.</p>`;
    pop.innerHTML =
      `<header class="iq-h"><h2 id="iq-hh">Intelligence <span>for ${esc(nameOf(s))}</span></h2>` +
      `<button type="button" class="iq-auto" role="switch" aria-checked="${!c.pinned}" data-auto title="Back to Auto${K.hint("auto")}">Auto<span class="sw" aria-hidden="true"></span></button></header>` +
      now + routeHtml +
      `<div class="iq-sec"><div class="iq-lh"><span>Model</span><span>Depth</span></div><div class="iq-list" role="listbox" aria-label="Models" aria-activedescendant="iq-o${P.cur}">${list}</div>` +
      `<label class="iq-q">${ICON.search}<input id="iq-q" value="${esc(P.q)}" placeholder="${more ? `${more} more · type to filter` : "Type to filter"}" autocomplete="off" aria-label="Filter models"></label></div>` +
      `<footer class="iq-f"><span>Applies to ${esc(scopeWord(s))} only.</span>${c.pinned ? `<button type="button" class="iq-back" data-auto>Back to Auto</button>` : ""}</footer>`;
    place();
  }
  function place() {
    if (!P.anchor) return;
    if (matchMedia("(max-width: 760px)").matches) { pop.style.left = pop.style.top = pop.style.width = ""; pop.classList.add("is-sheet"); return; }
    pop.classList.remove("is-sheet");
    const r = P.anchor.getBoundingClientRect();
    const w = Math.min(372, innerWidth - 24);
    pop.style.width = `${w}px`;
    pop.style.left = `${Math.max(12, Math.min(r.right - w + 10, innerWidth - w - 12))}px`;
    const h = pop.offsetHeight;
    pop.style.top = `${Math.max(12, r.top - h - 10)}px`;
  }
  function open(session, anchor) {
    P.open = true; P.session = session; P.anchor = anchor; P.q = ""; P.returnTo = document.activeElement;
    const c = current(session);
    P.cur = 0; P.depth = c.depth;
    pop.hidden = false;
    pop.classList.remove("is-out");
    popRender();
    anchor?.setAttribute("aria-expanded", "true");
    pop.querySelector(".iq-list")?.focus?.();
    pop.focus({ preventScroll: true });
  }
  function close({ restore = true } = {}) {
    if (!P.open) return;
    P.open = false;
    P.anchor?.setAttribute("aria-expanded", "false");
    if (RM.matches) pop.hidden = true;
    else { pop.classList.add("is-out"); setTimeout(() => { if (!P.open) { pop.hidden = true; pop.classList.remove("is-out"); } }, 140); }
    if (restore) (P.returnTo && P.returnTo.isConnected ? P.returnTo : P.anchor)?.focus?.({ preventScroll: true });
  }
  const pinAt = (mid, d) => { const s = P.session; close(); set(s, { model: mid, depth: d }); };
  const toAuto = () => { const s = P.session; close(); if (pins[s]) set(s, null); };

  pop.addEventListener("click", (e) => {
    const pin = e.target.closest("[data-pin]");
    if (pin && !pin.disabled) { const [m, d] = pin.dataset.pin.split("|"); pinAt(m, +d); return; }
    if (e.target.closest("[data-auto]")) { toAuto(); return; }
    const rt = e.target.closest("[data-route]");
    if (rt) { if (rt.getAttribute("aria-disabled") === "true") { record(P.session, { text: `${rt.textContent.replace("Add key", "").trim()} needs an API key: add it in Settings › Keys.`, refused: true, keep: true }); return; } setRouting(P.session, rt.dataset.route); popRender(); return; }
    const row = e.target.closest("[data-row]");
    if (row) {
      const m = model(row.dataset.model);
      const d = m.depths.includes(P.depth) ? P.depth : m.depths.includes(2) ? 2 : m.depths[m.depths.length - 1];
      pinAt(m.id, d);
    }
  });
  pop.addEventListener("input", (e) => { if (e.target.id === "iq-q") { P.q = e.target.value; P.cur = 0; const pos = e.target.selectionStart; popRender(); const q = pop.querySelector("#iq-q"); q.focus(); q.setSelectionRange(pos, pos); } });
  pop.addEventListener("keydown", (e) => {
    const inQ = e.target.id === "iq-q";
    const { shown } = rows();
    const m = shown[P.cur];
    const own = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === "Escape") { own(); if (inQ && P.q) { P.q = ""; popRender(); pop.focus(); return; } close(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { own(); P.cur = (P.cur + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % Math.max(1, shown.length); popRender(); if (inQ) pop.querySelector("#iq-q").focus(); return; }
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !inQ && m) {
      own();
      const ds = m.depths;
      let d = P.depth + (e.key === "ArrowRight" ? 1 : -1);
      d = Math.max(1, Math.min(3, d));
      if (!ds.includes(d)) d = e.key === "ArrowRight" ? ds.find((x) => x > P.depth) ?? ds[ds.length - 1] : [...ds].reverse().find((x) => x < P.depth) ?? ds[0];
      P.depth = d; popRender(); return;
    }
    if (e.key === "Enter" && m) { own(); const d = m.depths.includes(P.depth) ? P.depth : m.depths.includes(2) ? 2 : m.depths[m.depths.length - 1]; pinAt(m.id, d); return; }
    if (!inQ && K.is(e, "auto")) { own(); toAuto(); return; }
    if (!inQ && e.key.length === 1 && /\S/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) { const q = pop.querySelector("#iq-q"); q.focus(); }
  });
  document.addEventListener("pointerdown", (e) => { if (P.open && !pop.contains(e.target) && !e.target.closest("#iq")) close({ restore: false }); });
  addEventListener("resize", () => { if (P.open) place(); });

  return {
    current, chipHtml, chipTitle, routed, spawnSetup, open, close, set, setRouting,
    get isOpen() { return P.open; },
    get session() { return P.session; },
    kindOf, scopeWord, DEPTH, MODELS, model,
  };
}

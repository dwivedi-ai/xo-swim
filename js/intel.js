// Intelligence per session (R6), on storm. The chip says what a conversation runs on; the
// popover changes it. Everything comes from the server: the models and efforts from the runtime's
// catalog (GET /api/chat/runtimes/{name}/models: family, description, takes_effort), the routing from
// the Space setting and the chat's own override, the thread's model from its session. A change is a
// PATCH (the chat: routing, model, effort; a thread: intelligence) applied from the next turn, said
// back as one record line with a 3 s Undo. A thread never takes its chat's pin (§0.103).
//
//   Workspace, a project   who routes (the Space's, the coordinator, a connected decision model, off)
//                          and the coordinator's own model and effort
//   a thread               its agent's model and effort (the router chose them; you can pin)

import * as K from "./keys.js";
import { esc } from "./world.js";
import { ICON, RM } from "./ui.js";
import { api } from "./api.js";

const EFFORT_WORD = { low: "Quick", medium: "Balanced", high: "Deep", xhigh: "Deeper", max: "Deepest" };
const PIPS = { low: 1, medium: 2, high: 3, xhigh: 4, max: 5 };
const dots = (e) => (e ? "·".repeat(Math.min(3, PIPS[e] || 2)) + (PIPS[e] > 3 ? "+" : "") : "");

export function createIntel({ world, PROJ, onChange, record }) {
  const P = { open: false, session: null, anchor: null, returnTo: null, models: null, err: null, busy: false };
  const catalogs = new Map(); // runtime → models
  const pop = document.getElementById("iq-pop");

  const kindOf = (s) => (s === "ws" ? "workspace" : s.startsWith("p:") ? "project" : "thread");
  const scopeWord = (s) => (s === "ws" ? "the Workspace" : s.startsWith("p:") ? `${PROJ(s.slice(2))}'s coordinator` : "this thread");
  const chatOfSession = (s) => world.project(s === "ws" ? "workspace" : s.slice(2));
  const threadOf = (s) => (s.startsWith("t:") ? world.thread(s.slice(2)) : null);
  const runtimeOf = (s) => {
    const t = threadOf(s);
    const c = t ? null : chatOfSession(s) || {};
    // a thread: its session's agent; a chat: its pin, else its coordinator's own session
    const agent = t ? (t.session && t.session.agent) : c.pin?.agent || (world.act.coordinatorAgent ? world.act.coordinatorAgent(c.chatId) : null);
    const rts = world.state.runtimes || [];
    return (rts.find((r) => r.name === agent) || rts[0] || {}).name || null;
  };
  /** A runtime's models, read fresh each time the popover opens (the chip uses the last read). */
  async function catalog(name, { fresh = false } = {}) {
    if (!name) return [];
    if (catalogs.has(name) && !fresh) return catalogs.get(name);
    const d = await api.models(name);
    catalogs.set(name, d.models || []);
    return catalogs.get(name);
  }
  // the chip names models before the popover was ever opened: read the catalog once, quietly
  const reading = new Set();
  const warm = (s) => {
    const name = runtimeOf(s);
    if (!name || catalogs.has(name) || reading.has(name)) return;
    reading.add(name);
    catalog(name).then(() => onChange(), () => {}).finally(() => reading.delete(name));
  };
  /** The efforts a model takes: its own list, else the runtime's feature list (UI-reference §2.7). */
  const effortsOf = (m, s) => {
    if (!m || !m.takes_effort) return [];
    if (m.efforts && m.efforts.length) return m.efforts;
    const rt = (world.state.runtimes || []).find((r) => r.name === runtimeOf(s));
    const f = rt && rt.features && rt.features.features && rt.features.features.effort;
    return f && f.support !== "unsupported" && Array.isArray(f.values) ? f.values : [];
  };
  const modelOf = (id) => (P.models || []).find((x) => x.id === id) || null;
  const nameOf = (id) => { for (const list of catalogs.values()) { const m = list.find((x) => x.id === id); if (m) return m.name; } return id; };

  /** What a conversation runs on now: {pinned, model, effort, routing, by}. */
  function current(s) {
    const t = threadOf(s);
    if (t) {
      const pin = t.pin || {};
      const se = t.session || {};
      return { pinned: !!(pin.model || pin.effort), model: pin.model || se.model || null, effort: pin.effort || se.effort || null, routing: null, by: "the router" };
    }
    const c = chatOfSession(s) || {};
    const pin = c.pin || {};
    const space = world.state.router || { mode: "agent" };
    const own = c.routing && c.routing.mode ? c.routing : null;
    const r = own || space;
    return { pinned: !!(pin.model || pin.effort), model: pin.model || null, effort: pin.effort || null, routing: r, ownRouting: !!own, by: r.mode === "decision" ? r.decision_model : "coordinator" };
  }

  function chipHtml(s, phone) {
    warm(s);
    const c = current(s);
    if (phone) return `<span class="iq-g" aria-hidden="true">${c.pinned ? `<i class="iq-dot"></i>` : "◇"}</span><span class="iq-p">${esc(dots(c.effort))}</span>`;
    if (kindOf(s) === "thread") {
      const m = c.model ? nameOf(c.model) : "Default";
      return `${c.pinned ? `<i class="iq-dot" aria-hidden="true"></i>` : `<span class="iq-a">Auto</span> · `}<span class="iq-t">${esc(m)}</span>${c.effort ? `<span class="iq-p">${esc(dots(c.effort))}</span>` : ""}`;
    }
    const who = c.routing && c.routing.mode === "decision" ? cap(c.routing.decision_model || "decision") : c.routing && c.routing.mode === "off" ? "Off" : "Router";
    return c.pinned
      ? `<i class="iq-dot" aria-hidden="true"></i><span class="iq-t">${esc(nameOf(c.model) || "Pinned")}</span>${c.effort ? `<span class="iq-p">${esc(dots(c.effort))}</span>` : ""}`
      : `<span class="iq-t"><span class="iq-a">Auto</span> · ${esc(who)}</span>`;
  }
  function chipTitle(s) {
    const c = current(s);
    if (kindOf(s) === "thread") return `${c.pinned ? "Pinned" : "Chosen by the router"}: ${c.model ? nameOf(c.model) : "the default model"}${c.effort ? ` · ${EFFORT_WORD[c.effort] || c.effort}` : ""}. Click to change${K.hint("intel")}`;
    const r = c.routing || {};
    return `${r.mode === "off" ? "Routing is off" : r.mode === "decision" ? `${cap(r.decision_model)} routes new messages` : "The coordinator routes new messages"}${c.pinned ? ` · its coordinator runs ${nameOf(c.model)}` : ""}. Click to change${K.hint("intel")}`;
  }
  const cap = (x) => String(x || "").replace(/^\w/, (m) => m.toUpperCase());

  // ── the popover ───────────────────────────────────────────────────────────
  function render() {
    if (!P.open) return;
    const s = P.session, kind = kindOf(s), c = current(s);
    const models = P.models;
    let html = `<header class="iq-h"><h2 id="iq-hh">Intelligence <span>for ${esc(scopeWord(s))}</span></h2></header>`;
    if (kind !== "thread") {
      const space = world.state.router || { mode: "agent" };
      const dms = (P.dms || []).filter((m) => m.connected);
      const opts = [
        { id: "space", label: "The Space's", on: !c.ownRouting, line: space.mode === "decision" ? `${cap(space.decision_model)} routes, as set in Settings.` : space.mode === "off" ? "Routing is off for the whole Space." : "The coordinator routes, as set in Settings." },
        { id: "agent", label: "Coordinator", on: c.ownRouting && c.routing.mode === "agent", line: "This chat's coordinator reads each message and decides." },
        ...dms.map((m) => ({ id: `dm:${m.id}`, label: m.label.replace(/^\S+ /, ""), on: c.ownRouting && c.routing.mode === "decision" && c.routing.decision_model === m.id, line: `${m.label} routes this chat's messages; the coordinator decides when it isn't sure.` })),
        { id: "off", label: "Off", on: c.ownRouting && c.routing.mode === "off", line: "New messages to this chat are refused. Its threads still take your replies." },
      ];
      const on = opts.find((o) => o.on) || opts[0];
      html += `<div class="iq-sec"><p class="iq-lab">Who routes a new message</p><div class="iq-route" role="radiogroup" aria-label="Who routes">${opts.map((o) => `<button type="button" role="radio" data-lroute="${esc(o.id)}" aria-checked="${o.on}">${o.id === "agent" ? ICON.router : ""}${esc(o.label)}</button>`).join("")}</div><p class="iq-rl">${esc(on.line)}</p>` +
        (!dms.length ? `<p class="iq-rl">Connect a decision model in Settings › Routing to let one route.</p>` : "") + `</div>`;
    }
    const lead = kind === "thread"
      ? `<p class="iq-now">${c.pinned ? `<i class="iq-dot"></i>Pinned: <b>${esc(nameOf(c.model) || "the default")}${c.effort ? ` · ${esc(EFFORT_WORD[c.effort] || c.effort)}` : ""}</b>.` : `The router chose <b>${esc(c.model ? nameOf(c.model) : "the default model")}${c.effort ? ` · ${esc(EFFORT_WORD[c.effort] || c.effort)}` : ""}</b> for it.`}</p>`
      : `<p class="iq-now">${c.pinned ? `<i class="iq-dot"></i>Its coordinator runs <b>${esc(nameOf(c.model) || "the default")}${c.effort ? ` · ${esc(EFFORT_WORD[c.effort] || c.effort)}` : ""}</b>.` : "Its coordinator runs on its default."} New threads still get their own choice from the router.</p>`;
    html += `<div class="iq-sec">${lead}`;
    if (P.err) html += `<p class="iq-err">${esc(P.err)}</p>`;
    else if (!models) html += `<p class="iq-rl"><i class="spin" aria-hidden="true"></i> Reading the models…</p>`;
    else {
      // one row per family's default (claude: opus, fable, sonnet, haiku), then models in no family
      const fam = models.filter((m) => !m.is_default && (m.family_default || !m.family));
      const curId = c.model;
      html += `<div class="iq-list" role="listbox" aria-label="Models">${fam.map((m) => {
        const sel = c.pinned && curId === m.id;
        const efforts = effortsOf(m, s);
        return `<div class="iq-row lv${sel ? " is-sel" : ""}" role="option" aria-selected="${sel}" data-lmodel="${esc(m.id)}">` +
          `<span class="iq-mk" aria-hidden="true">${sel ? `<i class="iq-dot"></i>` : ""}</span><span class="iq-n">${esc(m.name)}</span><span class="iq-tr" title="${esc(m.description || "")}">${esc(m.description || "")}</span>` +
          `<span class="iq-d">${efforts.length ? efforts.filter((e) => PIPS[e]).map((e) => `<button type="button" class="iq-pip${sel && c.effort === e ? " is-sel" : ""}" data-lpin="${esc(m.id)}|${esc(e)}" aria-label="${esc(m.name)}, ${esc(EFFORT_WORD[e] || e)}" title="${esc(EFFORT_WORD[e] || e)}"><span class="pd">${"<i></i>".repeat(PIPS[e])}</span></button>`).join("") : `<button type="button" class="iq-pip is-flat" data-lpin="${esc(m.id)}|" title="This model has no effort setting">Pick</button>`}</span></div>`;
      }).join("")}</div>`;
    }
    html += `</div><footer class="iq-f"><span>Applies to ${esc(scopeWord(s))} from its next turn.</span>${c.pinned ? `<button type="button" class="iq-back" data-lauto>Back to ${kind === "thread" ? "the CLI's default" : "Auto"}</button>` : ""}</footer>`;
    pop.innerHTML = html;
    place();
  }
  function place() {
    if (!P.anchor) return;
    if (matchMedia("(max-width: 760px)").matches) { pop.style.left = pop.style.top = pop.style.width = ""; pop.classList.add("is-sheet"); return; }
    pop.classList.remove("is-sheet");
    const r = P.anchor.getBoundingClientRect();
    const w = Math.min(420, innerWidth - 24);
    pop.style.width = `${w}px`;
    pop.style.left = `${Math.max(12, Math.min(r.right - w + 10, innerWidth - w - 12))}px`;
    pop.style.top = `${Math.max(12, r.top - pop.offsetHeight - 10)}px`;
  }
  async function open(s, anchor) {
    P.open = true; P.session = s; P.anchor = anchor; P.returnTo = document.activeElement; P.err = null; P.models = null;
    pop.hidden = false; pop.classList.remove("is-out");
    render();
    anchor?.setAttribute("aria-expanded", "true");
    pop.focus({ preventScroll: true });
    try {
      const name = runtimeOf(s);
      if (catalogs.has(name)) { P.models = catalogs.get(name); render(); }
      const [models, dms] = await Promise.all([catalog(name, { fresh: true }), kindOf(s) === "thread" ? null : api.routerModels().then((d) => d.models || []).catch(() => [])]);
      if (!P.open || P.session !== s) return;
      P.models = models; if (dms) P.dms = dms;
    } catch (err) { P.err = err.status === 503 ? "The models can't be read right now." : err.message; }
    render();
  }
  function close({ restore = true } = {}) {
    if (!P.open) return;
    P.open = false;
    P.anchor?.setAttribute("aria-expanded", "false");
    if (RM.matches) pop.hidden = true;
    else { pop.classList.add("is-out"); setTimeout(() => { if (!P.open) { pop.hidden = true; pop.classList.remove("is-out"); } }, 140); }
    if (restore) (P.returnTo && P.returnTo.isConnected ? P.returnTo : P.anchor)?.focus?.({ preventScroll: true });
  }

  // ── changes: a PATCH, one record line, a 3 s Undo (the same PATCH back) ─────
  async function patch(s, body) {
    const t = threadOf(s);
    if (t) return api.patchThread(t.chatId, t.id, { intelligence: body });
    const c = chatOfSession(s);
    return api.patchChat(c.chatId, body);
  }
  async function change(s, body, undoBody, text) {
    try {
      await patch(s, body);
      await world.act.refresh?.();
      onChange();
      record(s, { text, undo: undoBody ? async () => { try { await patch(s, undoBody); await world.act.refresh?.(); onChange(); } catch (err) { record(s, { text: `Couldn't undo: ${err.message}`, refused: true }); } } : null });
    } catch (err) {
      record(s, { text: `Nothing changed: ${err.message}`, refused: true });
    }
  }
  // The catalog's "no override" model. Storm stores and runs it as no override, and unlike null it
  // reaches a live session (a null pin is stored but skipped until the session restarts).
  const defaultId = () => { const m = (P.models || []).find((x) => x.is_default); return m ? m.id : "default"; };
  /** What to send to put a conversation back exactly as it ran before a change. */
  function restoreBody(s, before) {
    if (kindOf(s) === "thread") {
      // a thread's pin can't be cleared (backend gap): Undo pins what it ran on, the router's choice
      return { model: before.model || defaultId(), ...(before.effort ? { effort: before.effort } : {}) };
    }
    return before.pinned ? { model: before.model || defaultId(), effort: before.effort || null } : { model: defaultId(), effort: null };
  }
  function pin(s, model, effort) {
    const before = current(s);
    const kind = kindOf(s);
    const body = kind === "thread" ? { model, ...(effort ? { effort } : {}) } : { model, effort: effort || null };
    change(s, body, restoreBody(s, before), `${kind === "thread" ? "This thread" : cap(scopeWord(s))} now runs ${nameOf(model)}${effort ? ` · ${EFFORT_WORD[effort] || effort}` : ""}, from its next turn`);
  }
  function toAuto(s) {
    const before = current(s);
    if (kindOf(s) === "thread") {
      // the closest a thread can come to "no pin": the CLI's own model at its own effort
      const d = modelOf(defaultId());
      const ef = d && d.takes_effort ? d.default_effort || null : null;
      change(s, { model: defaultId(), ...(ef ? { effort: ef } : {}) }, restoreBody(s, before), "This thread is back on the CLI's default model");
    } else change(s, { model: defaultId(), effort: null }, restoreBody(s, before), `${cap(scopeWord(s))} is back on its default`);
  }
  function route(s, id) {
    const c = chatOfSession(s);
    const before = c && c.routing ? c.routing : null;
    const body = id === "space" ? { routing: null } : id === "agent" ? { routing: { mode: "agent" } } : id === "off" ? { routing: { mode: "off" } } : { routing: { mode: "decision", decision_model: id.slice(3) } };
    const label = id === "space" ? "uses the Space's routing" : id === "agent" ? "is routed by its coordinator" : id === "off" ? "refuses new messages: routing is off" : `is routed by ${cap(id.slice(3))}`;
    change(s, body, { routing: before }, `${s === "ws" ? "The Workspace" : PROJ(s.slice(2))} ${label}`);
  }

  pop.addEventListener("click", (e) => {
    const r = e.target.closest("[data-lroute]");
    if (r) { const s = P.session; close(); route(s, r.dataset.lroute); return; }
    const p = e.target.closest("[data-lpin]");
    if (p) { const [m, ef] = p.dataset.lpin.split("|"); const s = P.session; close(); pin(s, m, ef || null); return; }
    if (e.target.closest("[data-lauto]")) { const s = P.session; close(); toAuto(s); return; }
    const row = e.target.closest("[data-lmodel]");
    if (row) {
      const m = (P.models || []).find((x) => x.id === row.dataset.lmodel);
      const s = P.session; close();
      // the model's own default effort, or the effort it runs at now when the model takes it
      const efs = effortsOf(m, s), now = current(s).effort;
      pin(s, row.dataset.lmodel, !efs.length ? null : m.default_effort && efs.includes(m.default_effort) ? m.default_effort : efs.includes(now) ? now : efs[Math.floor((efs.length - 1) / 2)]);
    }
  });
  pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } });
  document.addEventListener("pointerdown", (e) => { if (P.open && !pop.contains(e.target) && !e.target.closest("#iq")) close({ restore: false }); });
  addEventListener("resize", () => { if (P.open) place(); });

  return {
    current, chipHtml, chipTitle, open, close,
    routed: () => null, spawnSetup: () => null, set: () => {}, setRouting: () => {},
    get isOpen() { return P.open; },
    get session() { return P.session; },
    kindOf, scopeWord,
  };
}

// Settings pages for storm (U2): Routing (R6's "who routes", decision models), Rules (R2: what agents may
// do without asking), Worktrees (a thread's checkout, removed only after saying what would be lost).
// Every value shown is the server's; every change is the person's own click, said back plainly.
// Live only: Demo shows a calm note. Reads on open; the stream keeps the router setting current.

import { api } from "./api.js";
import { esc } from "./world.js";
import { ICON } from "./ui.js";
import { renderInline } from "./markdown.js";
import { holdToConfirm } from "./kit.js";

const PCT = [0.5, 0.6, 0.7, 0.8, 0.9];
/** The confidence choices, always including the server's own value (set elsewhere, e.g. 0.75). */
const pcts = (v) => (PCT.some((p) => Math.abs(p - v) < 0.001) || !(v >= 0 && v <= 1) ? PCT : [...PCT, v].sort((a, b) => a - b));
const when = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };

export function createSettings({ world, announce, PROJ, onChange }) {
  const live = world.mode !== "demo";
  const R = { router: null, models: [], rules: null, defaults: [], trees: null, reported: [], busy: new Set(), err: {}, form: null, confirm: null, keyHint: {} };

  const box = (id) => document.querySelector(`[data-page="${id}"] .set-live`);
  /** Re-draw a page and put keyboard focus back on the same control (by its data-* key), never on <body>. */
  function keepFocus(id, draw) {
    const el = box(id), a = document.activeElement;
    let sel = null;
    if (el && a && el.contains(a)) {
      const d = [...a.attributes].find((x) => x.name.startsWith("data-"));
      sel = d ? `[${d.name}="${CSS.escape(d.value)}"]` : a.name ? `[name="${CSS.escape(a.name)}"]` : null;
    }
    draw();
    if (sel) { const b = el.querySelector(sel); if (b) b.focus({ preventScroll: true }); else el.closest("[data-page]")?.querySelector("h2")?.focus?.(); }
  }
  const demoNote = (what) => `<p class="set-empty"><b>Live only.</b> ${what} come from your XO Space; Demo has none.</p>`;

  // ── Routing ─────────────────────────────────────────────────────────────
  async function loadRouting() {
    try { const [r, m] = await Promise.all([api.router(), api.routerModels()]); R.router = r; R.models = m.models || []; R.err.routing = null; }
    catch (err) { R.err.routing = err.message; }
    renderRouting();
  }
  const renderRouting = () => keepFocus("routing", drawRouting);
  function drawRouting() {
    const el = box("routing");
    if (!el) return;
    routeSig = routingSig();
    if (!live) { el.innerHTML = demoNote("Routing and decision models"); return; }
    if (R.err.routing && !R.router) { el.innerHTML = `<p class="set-empty"><b>Couldn't read the routing.</b> ${esc(R.err.routing)}</p>`; return; }
    if (!R.router) { el.innerHTML = `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>`; return; }
    const r = world.state.router || R.router;
    const connected = R.models.filter((m) => m.connected);
    const opt = (mode, dm, title, sub, disabled = false) => {
      const on = r.mode === mode && (mode !== "decision" || r.decision_model === dm);
      return `<button type="button" class="set-choice${on ? " is-on" : ""}" role="radio" aria-checked="${on}" data-route="${mode}"${dm ? ` data-dm="${esc(dm)}"` : ""}${disabled ? " disabled" : ""}><span class="sc-dot" aria-hidden="true"></span><span class="sc-b"><b>${esc(title)}</b><span>${esc(sub)}</span></span></button>`;
    };
    const overrides = world.state.projects.filter((p) => p.routing && p.routing.mode);
    el.innerHTML =
      `<section class="set-sec" aria-labelledby="rt-h"><h3 id="rt-h">Who routes a new message</h3>` +
      `<p class="set-lead">When you write to the Workspace or a project, this decides where it goes. A reply inside a thread always goes straight to its agent.</p>` +
      `<div class="set-choices" role="radiogroup" aria-labelledby="rt-h">` +
      opt("agent", null, "The coordinator", "Reads your message and decides itself: answer, forward, or start a thread.") +
      R.models.map((m) => opt("decision", m.id, m.label, m.connected ? `A decision model routes it; when it isn't sure, the coordinator decides.` : "Connect it below to use it.", !m.connected)).join("") +
      opt("off", null, "Off", "New messages to the Workspace and projects are refused. Threads still take your replies.") +
      `</div>` +
      (r.mode === "decision" ? `<div class="set-row is-sub"><div class="set-l"><b>When it isn't sure</b><span>Below this confidence, the coordinator decides instead.</span></div><select class="set-sel" data-abstain aria-label="Confidence needed">${pcts(r.abstain_below ?? 0.5).map((p) => `<option value="${p}"${Math.abs((r.abstain_below ?? 0.5) - p) < 0.001 ? " selected" : ""}>${Math.round(p * 100)}% sure</option>`).join("")}</select></div>` : "") +
      (R.err.route ? `<p class="set-err" role="alert">${esc(R.err.route)}</p>` : "") + `</section>` +
      `<section class="set-sec" aria-labelledby="dm-h"><h3 id="dm-h">Decision models</h3>` +
      `<p class="set-lead">A small model that routes quickly. Its key is saved on this machine and never shown again.</p>` +
      R.models.map((m) => {
        const f = R.form === m.id;
        return `<div class="set-row dm${m.connected ? " is-on" : ""}"><div class="set-l"><b>${esc(m.label)}</b><span>${m.connected ? `Connected · model ${esc(m.model)}` : "Not connected"}${m.docs_url ? ` · <a href="${esc(m.docs_url)}" target="_blank" rel="noopener noreferrer">about it</a>` : ""}</span></div>` +
          (m.connected ? `<button type="button" class="btn" data-dm-off="${esc(m.id)}">Disconnect</button>` : f ? "" : `<button type="button" class="btn btn-pri" data-dm-on="${esc(m.id)}">Connect</button>`) + `</div>` +
          (f ? `<form class="set-form" data-dm-form="${esc(m.id)}" autocomplete="off"><label class="field"><span>API key</span><input type="password" name="key" required autocomplete="new-password" spellcheck="false" placeholder="Paste the key"></label>` +
            `<label class="field"><span>Model <em>optional</em></span><input name="model" placeholder="${esc(m.model || "")}" spellcheck="false"></label>` +
            `<p class="set-err" role="alert"${R.err.dm ? "" : " hidden"}>${esc(R.err.dm || "")}</p>` +
            `<div class="set-fa"><button type="button" class="btn" data-dm-cancel>Cancel</button><button type="submit" class="btn btn-pri">Connect</button></div></form>` : "") +
          (R.confirm && R.confirm.dm === m.id ? `<div class="set-confirm" role="alertdialog" aria-labelledby="dmc-${esc(m.id)}"><p id="dmc-${esc(m.id)}"><b>Disconnect ${esc(m.label)}?</b> Its key is removed from this machine.${r.mode === "decision" && r.decision_model === m.id ? " Routing goes back to the coordinator." : ""}${R.confirm.chats.length ? ` ${R.confirm.chats.length} ${R.confirm.chats.length === 1 ? "chat routes" : "chats route"} with it (${R.confirm.chats.map((c) => esc(PROJ(c))).join(", ")}); they go back to the Space's routing too.` : ""}</p><div class="set-fa"><button type="button" class="btn" data-dm-no>Keep it</button><button type="button" class="btn btn-danger" data-dm-yes="${esc(m.id)}">Disconnect</button></div></div>` : "");
      }).join("") + `</section>` +
      (overrides.length ? `<section class="set-sec" aria-labelledby="ov-h"><h3 id="ov-h">Chats with their own routing</h3>` +
        overrides.map((p) => `<div class="set-row"><div class="set-l"><b>${esc(p.name)}</b><span>${p.routing.mode === "decision" ? `Routed by ${esc((R.models.find((m) => m.id === p.routing.decision_model) || {}).label || p.routing.decision_model)}` : p.routing.mode === "agent" ? "Routed by its coordinator" : "Routing off"}</span></div><button type="button" class="btn" data-ov-clear="${esc(p.chatId)}">Use the Space's</button></div>`).join("") + `</section>` : "");
  }
  // what the Routing page shows, so a change from the stream (another tab, a chat's own routing) re-renders it
  let routeSig = "";
  const routingSig = () => JSON.stringify([world.state.router, world.state.projects.map((p) => [p.id, p.routing])]);
  async function setRoute(mode, dm, abstain) {
    const r = world.state.router || R.router || {};
    // choosing what is already chosen changes nothing (the PUT is a full replace)
    if (abstain == null && r.mode === mode && (mode !== "decision" || r.decision_model === dm)) return;
    R.err.route = null;
    try {
      // a full replace: abstain_below is sent every time, or it resets (UI-reference §2.3)
      R.router = await api.setRouter({ mode, ...(mode === "decision" ? { decision_model: dm } : {}), abstain_below: abstain ?? r.abstain_below ?? 0.5 });
      world.state.router = R.router;
      announce(mode === "off" ? "Routing is off." : mode === "agent" ? "The coordinator routes new messages." : `${(R.models.find((m) => m.id === dm) || {}).label || dm} routes new messages.`);
      onChange();
    } catch (err) { R.err.route = err.message; }
    renderRouting();
  }

  // ── Rules (R2) ──────────────────────────────────────────────────────────
  async function loadRules() {
    try {
      let after = 0; const rules = []; let defaults = [];
      for (let i = 0; i < 10; i++) {
        const d = await api.rules({ after_seq: after, limit: 500 });
        rules.push(...(d.rules || [])); defaults = d.defaults || defaults;
        if (!d.next_after_seq) break;
        after = d.next_after_seq;
      }
      R.rules = rules; R.defaults = defaults; R.err.rules = null;
    } catch (err) { R.err.rules = err.message; }
    renderRules();
  }
  const renderRules = () => keepFocus("rules", drawRules);
  function drawRules() {
    const el = box("rules");
    if (!el) return;
    if (!live) { el.innerHTML = demoNote("Your rules"); return; }
    if (R.err.rules && !R.rules) { el.innerHTML = `<p class="set-empty"><b>Couldn't read your rules.</b> ${esc(R.err.rules)}</p>`; return; }
    if (!R.rules) { el.innerHTML = `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>`; return; }
    const scopeWord = (r) => {
      if (r.scope === "thread") { const t = r.thread_ts && world.thread(r.thread_ts); return t ? `Only in “${t.title}”` : "Only in one thread"; }
      return r.scope === "project" ? (r.project_pid ? PROJ(projectOfPid(r.project_pid)) : "A project") : "Every project";
    };
    const row = (r, def) => `<li class="rl-row${r.effect === "deny" ? " is-deny" : ""}"><div class="rl-main"><q class="rl-s">${renderInline(r.sentence || "", true)}</q>` +
      `<span class="rl-m">${def ? "XO's default" : `${esc(scopeWord(r))}${r.tier ? ` · ${esc(r.tier)}` : ""}${r.uses ? ` · answered ${r.uses} ${r.uses === 1 ? "ask" : "asks"}` : ""}${r.created_at ? ` · since ${esc(when(r.created_at))}` : ""}`}</span></div>` +
      (R.confirm && R.confirm.rule === r.id
        ? `<span class="rl-c"><span>${def ? "A default can't be brought back." : "Agents will ask again."}</span><button type="button" class="btn" data-rule-no>Keep</button><button type="button" class="btn btn-danger" data-rule-yes="${esc(r.id)}">Revoke</button></span>`
        : `<button type="button" class="btn" data-rule-off="${esc(r.id)}"${R.busy.has(r.id) ? " disabled" : ""}>Revoke</button>`) + `</li>`;
    const mine = R.rules.filter((r) => !r.revoked_at);
    const defs = R.defaults.filter((d) => !d.revoked_at);
    const gone = R.defaults.filter((d) => d.revoked_at);
    el.innerHTML = `<p class="set-lead">What agents may do without asking you. A rule is only ever made by you: from a decision ("Make it a rule"), word for word. Revoke one and agents ask again.</p>` +
      (R.err.rule ? `<p class="set-err" role="alert">${esc(R.err.rule)}</p>` : "") +
      `<section class="set-sec" aria-labelledby="rl-mine"><h3 id="rl-mine">Your rules <span>${mine.length}</span></h3>${mine.length ? `<ul class="rl-list">${mine.map((r) => row(r, false)).join("")}</ul>` : `<p class="set-note">None yet. When you allow something with "Make it a rule", it appears here.</p>`}</section>` +
      `<section class="set-sec" aria-labelledby="rl-def"><h3 id="rl-def">XO's defaults <span>${defs.length}</span></h3><p class="set-lead">Safe, routine things: reading inside the project, read-only git, XO's own tools.</p><ul class="rl-list">${defs.map((d) => row(d, true)).join("")}</ul>` +
        (gone.length ? `<h4 class="rl-gone-h">Revoked</h4><ul class="rl-list is-gone">${gone.map((d) => `<li class="rl-row is-revoked"><div class="rl-main"><q class="rl-s">${renderInline(d.sentence || "", true)}</q><span class="rl-m">Revoked${d.revoked_at ? ` ${esc(when(d.revoked_at))}` : ""} · agents ask for this</span></div></li>`).join("")}</ul>` : "") + `</section>`;
  }
  const projectOfPid = (pid) => (world.state.projects.find((p) => p.id === pid || p.pid === pid) || {}).id || pid;

  // ── Worktrees ───────────────────────────────────────────────────────────
  async function loadTrees() {
    try { const d = await api.worktrees(); R.trees = d.worktrees || []; R.reported = d.reported || []; R.err.trees = null; }
    catch (err) { R.err.trees = err.message; }
    renderTrees();
  }
  function lossHtml(l) {
    if (!l) return "";
    const files = [...(l.changed && l.changed.paths || []).map((p) => `changed · ${p}`), ...(l.untracked && l.untracked.paths || []).map((p) => `new · ${p}`)];
    return `<div class="wt-loss"><p><b>${esc(l.summary || "Work that isn't kept anywhere else")}</b></p>` +
      (l.commits ? `<p>${l.commits} commit${l.commits === 1 ? "" : "s"} only on ${esc(l.branch || "its branch")}</p>` : "") +
      (files.length ? `<pre class="tb-out">${esc(files.slice(0, 30).join("\n"))}${files.length > 30 ? `\n… ${files.length - 30} more` : ""}</pre>` : "") + `</div>`;
  }
  const renderTrees = () => keepFocus("worktrees", drawTrees);
  function drawTrees() {
    const el = box("worktrees");
    if (!el) return;
    if (!live) { el.innerHTML = demoNote("Worktrees"); return; }
    if (R.err.trees && !R.trees) { el.innerHTML = `<p class="set-empty"><b>Couldn't read the worktrees.</b> ${esc(R.err.trees)}</p>`; return; }
    if (!R.trees) { el.innerHTML = `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>`; return; }
    const title = (w) => { const t = world.thread(w.thread_ts); return t ? t.title : "A thread"; };
    const by = new Map();
    for (const w of R.trees) { const p = world.act.projectOf ? world.act.projectOf(w.chat_id) : w.chat_id; (by.get(p) || by.set(p, []).get(p)).push(w); }
    el.innerHTML = `<p class="set-lead">Each thread works in its own checkout of the project. XO removes one by itself only when nothing would be lost; here you can remove one sooner.</p>` +
      (R.trees.length ? [...by].map(([p, list]) => `<section class="set-sec"><h3>${esc(PROJ(p))}</h3><ul class="wt-list">${list.map((w) => {
        const key = `${w.chat_id}/${w.thread_ts}`;
        const c = R.confirm && R.confirm.wt === key ? R.confirm : null;
        const busy = !!(w.session_state && w.session_state !== "cold");
        const state = w.error ? `Can't be read: ${w.error}` : w.exists === false ? "The checkout is already gone" : w.xo === false ? "XO didn't make this checkout, so it won't remove it" : busy ? "Its agent is still using it" : w.would_lose ? "Has work not kept anywhere else" : "Nothing would be lost";
        // offered where the server says it can go, or where it would lose work (shown first, then held)
        const can = !!(w.removable || (w.would_lose && w.xo !== false && !w.error));
        return `<li class="wt-row"><div class="wt-main"><b>${esc(title(w))}</b><code>${esc(w.branch || w.path)}</code><span class="wt-s${w.would_lose ? " is-warn" : ""}">${esc(state)}${w.thread_state ? ` · thread ${esc(String(w.thread_state).replace("_", " "))}` : ""}</span></div>` +
          (c || !(can || busy) ? "" : `<button type="button" class="btn" data-wt="${esc(key)}"${R.busy.has(key) || busy ? " disabled" : ""}>Remove</button>`) +
          (c ? `<div class="wt-confirm" role="alertdialog" aria-label="Remove this worktree">${c.lose ? lossHtml(c.lose) + `<p class="wt-q">Removing it deletes that work. It can't be undone.</p><div class="set-fa"><button type="button" class="btn" data-wt-no>Keep it</button><button type="button" class="b b-hold wt-hold" data-wt-hold="${esc(key)}"><span class="hold-fill" aria-hidden="true"></span><span class="b-l"><span class="hold-ic">${ICON.lock}</span><span class="hold-txt">Hold to remove</span></span></button></div>` : `<p class="wt-q">Remove this checkout? Nothing would be lost.</p><div class="set-fa"><button type="button" class="btn" data-wt-no>Keep it</button><button type="button" class="btn btn-danger" data-wt-yes="${esc(key)}">Remove</button></div>`}</div>` : "") + `</li>`;
      }).join("")}</ul></section>`).join("") : `<p class="set-note">No worktrees right now.</p>`) +
      (R.reported.length ? `<section class="set-sec"><h3>Made by an agent's own tool</h3><p class="set-lead">XO didn't create these, so it never removes them.</p><ul class="wt-list">${R.reported.map((w) => `<li class="wt-row"><div class="wt-main"><code>${esc(w.path)}</code><span class="wt-s">reported ${esc(when(w.reported_at))}</span></div></li>`).join("")}</ul></section>` : "") +
      (R.err.wt ? `<p class="set-err" role="alert">${esc(R.err.wt)}</p>` : "");
    const hb = el.querySelector("[data-wt-hold]");
    if (hb) {
      const fill = hb.querySelector(".hold-fill");
      holdToConfirm(hb, {
        ready: () => true,
        onProgress: (p) => { fill.style.transition = "none"; fill.style.transform = `scaleX(${Math.pow(p, 1.7)})`; hb.querySelector(".hold-txt").textContent = p > 0 ? "Keep holding…" : "Hold to remove"; },
        onConfirm: () => removeTree(hb.dataset.wtHold, R.confirm && R.confirm.token),
        onRelease: () => { fill.style.transition = "transform .42s cubic-bezier(.34,1.56,.64,1)"; fill.style.transform = "scaleX(0)"; },
      });
    }
  }
  async function removeTree(key, confirm) {
    const [chat, ts] = key.split("/");
    R.busy.add(key); R.err.wt = null;
    try {
      const r = await api.removeWorktree(chat, ts, confirm);
      R.confirm = null;
      announce(r && r.forced ? "Removed. The work in it is gone." : "Removed. Nothing was lost.");
      await loadTrees();
    } catch (err) {
      if (err.code === "would_lose_work") { R.confirm = { wt: key, lose: err.what, token: err.confirm }; }
      else if (err.code === "session_busy") { R.confirm = null; R.err.wt = "Its agent is still using it. Stop the thread, or try again once it has gone quiet."; }
      else { R.confirm = null; R.err.wt = err.message; }
      renderTrees();
    } finally { R.busy.delete(key); }
  }

  // while the Routing page is open, show what the stream changed (never mid-form or mid-question)
  if (live && world.subscribe) world.subscribe(() => {
    const page = box("routing")?.closest("[data-page]");
    if (!R.router || R.form || (R.confirm && R.confirm.dm) || !page || page.hidden || document.querySelector("#settings").hidden) return;
    const sig = routingSig();
    if (sig !== routeSig) { routeSig = sig; renderRouting(); }
  });

  // ── events ──────────────────────────────────────────────────────────────
  document.querySelector("#settings").addEventListener("click", async (e) => {
    const t = e.target;
    const rt = t.closest("[data-route]");
    if (rt && !rt.disabled) { setRoute(rt.dataset.route, rt.dataset.dm || null); return; }
    const on = t.closest("[data-dm-on]");
    if (on) { R.form = on.dataset.dmOn; R.err.dm = null; renderRouting(); box("routing").querySelector(`[data-dm-form] input[name="key"]`)?.focus(); return; }
    if (t.closest("[data-dm-cancel]")) { R.form = null; renderRouting(); return; }
    const off = t.closest("[data-dm-off]");
    if (off) { R.confirm = { dm: off.dataset.dmOff, chats: world.state.projects.filter((p) => p.routing && p.routing.decision_model === off.dataset.dmOff).map((p) => p.id) }; renderRouting(); return; }
    if (t.closest("[data-dm-no]")) { R.confirm = null; renderRouting(); return; }
    const yes = t.closest("[data-dm-yes]");
    if (yes) {
      const id = yes.dataset.dmYes, chats = R.confirm ? R.confirm.chats : [];
      try {
        R.models = (await api.disconnectRouterModel(id)).models || R.models;
        // the server resets only the Space setting; chats that named it are cleared here (UI-reference §4.8)
        for (const c of chats) { const p = world.project(c); if (p) await api.patchChat(p.chatId, { routing: null }); }
        R.router = await api.router(); world.state.router = R.router;
        announce("Disconnected. Its key is removed.");
      } catch (err) { R.err.route = err.message; }
      R.confirm = null; renderRouting(); onChange(); return;
    }
    const ov = t.closest("[data-ov-clear]");
    if (ov) {
      try {
        const c = await api.patchChat(ov.dataset.ovClear, { routing: null });
        const p = world.state.projects.find((x) => x.chatId === ov.dataset.ovClear);
        if (p) p.routing = (c && c.routing) || null;
        announce("It uses the Space's routing again.");
        onChange();
      } catch (err) { R.err.route = err.message; }
      renderRouting(); return;
    }
    const ro = t.closest("[data-rule-off]");
    if (ro) { R.confirm = { rule: ro.dataset.ruleOff }; renderRules(); return; }
    if (t.closest("[data-rule-no]")) { R.confirm = null; renderRules(); return; }
    const ry = t.closest("[data-rule-yes]");
    if (ry) {
      const id = ry.dataset.ruleYes;
      R.busy.add(id); R.confirm = null; R.err.rule = null;
      try { await api.revokeRule(id); announce("Revoked. Agents will ask again."); } catch (err) { R.err.rule = err.message; }
      R.busy.delete(id); await loadRules(); return;
    }
    const wt = t.closest("[data-wt]");
    if (wt) {
      const w = (R.trees || []).find((x) => `${x.chat_id}/${x.thread_ts}` === wt.dataset.wt);
      // nothing to lose: one question first; work to lose: the server says exactly what, then a hold
      if (w && !w.would_lose) { R.confirm = { wt: wt.dataset.wt }; renderTrees(); box("worktrees").querySelector("[data-wt-no]")?.focus(); return; }
      R.confirm = null; removeTree(wt.dataset.wt); return;
    }
    if (t.closest("[data-wt-no]")) { R.confirm = null; renderTrees(); return; }
    const wy = t.closest("[data-wt-yes]");
    if (wy) { removeTree(wy.dataset.wtYes); return; }
  });
  document.querySelector("#settings").addEventListener("change", (e) => {
    const a = e.target.closest("[data-abstain]");
    if (a) { const r = world.state.router || R.router; setRoute(r.mode, r.decision_model, +a.value); }
  });
  document.querySelector("#settings").addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-dm-form]");
    if (!f) return;
    e.preventDefault();
    const key = f.key.value.trim(), model = f.model.value.trim();
    if (!key) { R.err.dm = "Paste the key first."; renderRouting(); return; }
    try {
      R.models = (await api.connectRouterModel({ provider: f.dataset.dmForm, ...(model ? { model } : {}), api_key: key })).models || R.models;
      R.form = null; R.err.dm = null;
      announce("Connected. Its key is saved and won't be shown again.");
    } catch (err) { R.err.dm = err.code === "invalid_key" ? "That doesn't look like a key: no spaces, not blank." : err.message; }
    f.key.value = ""; // the key never stays on the page
    renderRouting(); onChange();
  });

  return {
    /** A page was opened: read what it shows. */
    open(id) {
      if (!live) { renderRouting(); renderRules(); renderTrees(); return; }
      if (id === "routing") loadRouting();
      else if (id === "rules") loadRules();
      else if (id === "worktrees") loadTrees();
    },
  };
}

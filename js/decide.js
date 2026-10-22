// Converged · decisions. One card builder, two surfaces:
//
//  • the global panel (from Home, the dock line, N): Next's size and place
//    beside the conversation (#21), sized to its content (never a tall blank
//    panel), with little text (#15): headline, one line of why, a labelled
//    estimate of the work waiting, the suggestion, the answers. Details fold.
//  • the thread's own decision (inside an opened thread): Today's wide card
//    (#20) docked above the composer. Details open with a continuous height
//    change (~320 ms) and a content cross-fade; nothing jumps.
//
// Decision Kit rules hold everywhere: destructive is red, set apart, never
// forced first, 1.2 s hold; 3 s Undo; inline Send-back note; Teach shows the
// exact sentence. Allow and Send back carry equal weight. The coordinator's
// suggestion is a quiet line: never pre-selected, never focused, never sent,
// no key takes it. Focus lands on the card itself, never on an answer.
import { esc, WAITING } from "./world.js";
import * as Kit from "./kit.js";
import * as K from "./keys.js";
import { EFFORT, effortOf, rank, evidenceFor, leverageOf, suggestFor, whyLine, estLine } from "./content.js";
import { ICON, $, RM, clock, sound, dial, wait, morph, expand } from "./ui.js";
import { renderMarkdown, renderInline, excerptMarkdown } from "./markdown.js";
import { highlight } from "./highlight.js";
import { itemParts, itemBody, questionsOf, evidenceOf, itemEffort, isNo, VERB, holdWords as holdWordsOf } from "./review.js";
import { clientId as newKey } from "./api.js";

export const riskLabel = (r) => ({ destructive: "Destructive", notable: "Notable", routine: "Routine", stopped: "Stopped" })[r] || "Notable";
const BIG_CHECK = `<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="sc" cx="26" cy="26" r="23"/><path class="sk" d="M15 27l7.5 7.5L38 19"/></svg>`;
const BIG_BACK = `<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="sc" cx="26" cy="26" r="23"/><path class="sk" d="M21 30l-6-6 6-6M15 24h14a7 7 0 0 1 0 14h-4"/></svg>`;
const MARK = (s) => (s === "done" ? "✓" : s === "doing" ? "✱" : "○");
// capitalise a plain lowercase sentence ("the agent asks…"), never a name or a path ("perm-test.txt")
// a sentence starting with a command ("git push…", "npm install…") stays as written
const COMMANDS = new Set(["git", "npm", "npx", "pnpm", "yarn", "bun", "deno", "node", "python", "python3", "pip", "pip3", "uv", "rm", "mv", "cp", "ls", "cd", "cat", "curl", "wget", "docker", "kubectl", "cargo", "rustc", "sudo", "chmod", "chown", "mkdir", "touch", "sed", "awk", "grep", "ssh", "scp", "tar", "brew", "apt", "gh", "terraform"]);
const cap = (s) => { const t = String(s || "").trim(); const w = (t.match(/^[a-z]+(?= |$)/) || [])[0]; return w && !COMMANDS.has(w) ? t.charAt(0).toUpperCase() + t.slice(1) : t; };
const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;

export function createDecisions({ world, P, rules, PROJ, announce, render, later, waitSince, absorbing, onOpenThread, onAllClear, onUndone, onBreak, onSent, onNotSent }) {
  const panel = $("#panel"), stage = $("#pn-stage");
  const firstSeen = new Map();
  let seq = 0;
  const sentKeys = new Map();
  const stoppedDone = new Set();
  const log = [];
  const teach = new Map();
  const noSecret = new Set(); // items XO wouldn't carry a secret answer to (secret_needs_a_call)
  let logN = 0, cardN = 0;
  /** The Allow button's words: the item's own label, or the reach chosen (its sentence shows below). */
  const scopeWords = (P, id) => {
    const o = id && P.scopes.find((x) => x.id === id);
    return !o ? (P.primary ? P.primary.label : "Allow") : o.scope === "thread" ? "Allow for this thread" : "Allow + rule";
  };

  // ── the needs-you list: every ask, with effort, leverage, idleness, suggestion ──
  function needItems() {
    const out = [];
    for (const t of [...world.state.threads, ...(world.state.hosts || [])]) {
      // a thread that stopped, was answered and later stops again must come back (P1-7)
      if (t.state !== "failed") stoppedDone.delete(t.id);
      if (t.state === "failed") {
        const key = `stop|${t.id}`;
        if (stoppedDone.has(t.id) || queue.has(key)) continue;
        out.push({ key, t, ask: { kind: "stopped", title: t.title, detail: String(t.happened || "").replace(/^Stopped:\s*/i, "Stopped: "), risk: "stopped" }, group: "stopped", risk: "stopped" });
        // its open review items (an integrity report, a schedule to approve) still need their own answer
        for (const a of Kit.asksOf(t)) {
          if (!a.item) continue;
          const k = Kit.askKey(t, a);
          if (queue.has(k) || sentKeys.has(k) || absorbing.has(k)) continue;
          out.push({ key: k, t, ask: a, group: Kit.groupOf(t, a), risk: Kit.riskOf(a) });
        }
        continue;
      }
      // a finished thread can still hold an open item (an integrity report arrives after its turn)
      if ((t.state === "done" || t.state === "resolved") && !(t.asks || []).some((a) => a.item)) continue;
      for (const a of Kit.asksOf(t)) {
        const key = Kit.askKey(t, a);
        if (queue.has(key) || sentKeys.has(key) || absorbing.has(key)) continue;
        out.push({ key, t, ask: a, group: Kit.groupOf(t, a), risk: Kit.riskOf(a) });
      }
    }
    const now = Date.now();
    for (const n of out) {
      if (!firstSeen.has(n.key)) firstSeen.set(n.key, { seq: ++seq, at: now });
      n.since = firstSeen.get(n.key).seq;
      n.waitSince = waitSince.get(n.key) ?? waitSince.get(n.t.id) ?? firstSeen.get(n.key).at;
      n.effort = n.ask.item ? itemEffort(n.ask.item) : effortOf(n);
      n.lev = leverageOf(n);
      // idle: its agent isn't working, so nothing moves until you answer. Live threads say so by their
      // session (a "working" thread whose session sits warm is idle); an item with no thread is idle.
      n.idle = WAITING(n.t.state) || n.group === "stopped" || !!n.t.host || (n.t.live && n.t.busy === false);
      n.sug = suggestFor(n);
      n.later = later.has(n.key);
    }
    P.classify(out);
    return rank(out);
  }

  /** Was the item decided by this very request (same idempotency key)? */
  const ownDecision = (part, err) => {
    const k = part.choice && part.choice.body && part.choice.body.idempotency_key;
    return !!k && !!(err.item && err.item.decision && err.item.decision.idempotency_key === k);
  };
  /** A title as a sentence: one full stop, never "token?." */
  const stop = (t) => { t = String(t || "").trim(); return /[.?!…]$/.test(t) ? t : `${t}.`; };
  /** Why a decision wasn't sent: the item had already left the list (decided, withdrawn, expired). */
  function goneWhy(err) {
    const d = err.item && err.item.decision && err.item.decision.decision;
    if (err.gone === "already_decided" || err.gone === "decided") return `It was already decided elsewhere${d && VERB[d] ? ` (${VERB[d].toLowerCase()})` : ""}.`;
    if (err.gone === "withdrawn") return "It was withdrawn before your answer arrived.";
    if (err.gone === "expired") return "It had expired, and the agent was told.";
    return "It's no longer waiting for you.";
  }
  /** The same, short, for the herald. */
  function failShort(err) {
    if (err && err.code === "secret_needs_a_call") return "XO can't carry a secret here. Give it outside XO, then tell the thread.";
    if (err && err.code === "rule_sentence_mismatch") return "The rule's wording changed. It's back in your list.";
    if (err && err.status >= 400 && err.status < 500 && err.message) return `${stop(err.message)} It's back in your list.`;
    return "It didn't reach the agent. It's back in your list.";
  }
  /** A decision XO refused: the server's reason, and whether it can simply be tried again. */
  function failLine(part, err) {
    const t = stop(part.ask.title);
    if (err && err.code === "secret_needs_a_call") return `Not sent: ${t} XO can't pass a secret to this question. Don't paste it into the thread: give it to the agent outside XO, then tell the thread it's done.`;
    if (err && err.code === "rule_sentence_mismatch") return `Not sent: ${t} The rule's wording has changed; read it again and decide. It's back in your list.`;
    if (err && err.status >= 400 && err.status < 500 && err.message) return `Not sent: ${t} ${stop(err.message)} It's back in your list.`;
    return `Didn't reach the agent: ${t} It's back in your list.`;
  }

  // ── commit window (3 s, Undo) ─────────────────────────────────────────────
  const queue = Kit.createCommitQueue({
    exec: (p) => Promise.resolve(p.choice && p.choice.resolve ? world.act.resolve(p.t.id, true) : p.stopped ? world.act.reply(p.t.id, p.choice.text) : p.choice && p.choice.storm ? world.act.decideItem(p.ask.item.id, p.choice.body) : Kit.answer(world, p.t, p.ask, p.choice, p.note)).then(() => {
      // a held ask on a thread that kept working: the answer closes it
      if (p.t.state === "working" && p.t.asks.length) { p.t.asks = []; p.t.needsYou = ""; }
    }),
    onChange(type, item, results) {
      if (type === "undone") {
        for (const p of item.parts) { const i = log.indexOf(p.entry); if (i >= 0) log.splice(i, 1); F.status.delete(p.key); }
        announce("Undone. Nothing was sent; the ask is back.");
        if (F.open) {
          const p = item.parts[0];
          clearTimeout(F.autoT);
          F.done = false; F.cur = p.key; F.items.set(p.key, p.n);
          if (!F.order.includes(p.key)) F.order.unshift(p.key);
          show(F.cur, "undo");
        }
        onUndone && onUndone(item.parts[0].key);
      }
      if (type === "sending") for (const p of item.parts) p.entry.status = "sending";
      if (type === "settled") {
        for (const { part, ok, err } of results) {
          if (ok) {
            part.entry.status = "sent";
            if (part.stopped) stoppedDone.add(part.t.id); else sentKeys.set(part.key, Date.now());
            onSent && onSent(part);
          } else if (err && err.gone && ownDecision(part, err)) {
            // it was this very decision (sent before an error said otherwise): it counts as sent
            part.entry.status = "sent";
            sentKeys.set(part.key, Date.now());
            onSent && onSent(part);
          } else if (err && err.gone) {
            // refused because the item had already left: never counted as made (UI-reference §4.3 #7)
            part.entry.status = "gone";
            part.entry.why = goneWhy(err);
            sentKeys.set(part.key, Date.now());
            announce(`Not sent: ${stop(part.ask.title)} ${part.entry.why}`);
            onNotSent && onNotSent(part.ask.title, part.entry.why);
          } else {
            part.entry.status = "failed";
            F.status.delete(part.key);
            if (err && err.code === "secret_needs_a_call" && part.ask.item) noSecret.add(part.ask.item.id);
            if (part.choice && part.choice.resolve) {
              // Done that didn't land: the thread stays open and its card comes back
              announce(`Couldn't resolve ${part.t.title}: ${err && err.message ? stop(err.message) : "XO didn't answer."} It's back in your list.`);
              onNotSent && onNotSent(`Couldn't resolve ${part.t.title}`, `${err && err.message ? stop(err.message) : "XO didn't answer."} It's back in your list.`);
              continue;
            }
            announce(failLine(part, err));
            onNotSent && onNotSent(part.ask.title, failShort(err));
          }
        }
      }
      toastRender();
      render();
    },
  });

  // ── panel state ───────────────────────────────────────────────────────────
  const F = { open: false, order: [], items: new Map(), status: new Map(), cur: null, done: false, hold: null, mode: "all", returnTo: null, swap: 0, open0: {}, vig: false };
  const api = {
    needItems,
    decisions: () => log.filter((d) => d.status !== "failed" && d.status !== "gone"),
    /** Decisions XO refused because the item had already left, with why (for the conversation). */
    notSent: () => log.filter((d) => d.status === "gone"),
    isOpen: () => F.open,
    current: () => (F.open && !F.done && !F.vig ? F.cur : null),
    open, close, sync, undo, decide, decideNow, laterNow, bringIn,
    cardHtml, wireCard,
    queued: (key) => queue.has(key),
    pendingKey: (key) => queue.has(key),
  };

  function open(startKey, { only = null, teach: teachScope = null } = {}) {
    let needs = needItems();
    const start = startKey && needs.find((n) => n.key === startKey);
    if (start && (start.held || start.parked)) { P.bringIn(start.key); needs = needItems(); }
    needs = needs.filter((n) => n.admitted);
    if (only === "glance") needs = needs.filter((n) => n.effort === "glance" && !n.later);
    else if (Array.isArray(only)) needs = needs.filter((n) => only.includes(n.key));
    if (!needs.length) return false;
    if (!F.open) F.returnTo = document.activeElement;
    F.mode = only === "glance" ? "glance" : Array.isArray(only) ? "set" : "all";
    F.order = needs.map((n) => n.key);
    F.items = new Map(needs.map((n) => [n.key, n]));
    F.status = new Map();
    F.cur = startKey && F.order.includes(startKey) ? startKey : (needs.find((n) => !n.later) || needs[0]).key;
    if (teachScope && startKey) teach.set(startKey, teachScope);
    F.done = false; F.vig = false;
    const was = F.open;
    F.open = true;
    P.reviewStart();
    panel.hidden = false;
    document.body.classList.add("panel-open");
    if (!was) { panel.classList.remove("is-in"); void panel.offsetWidth; panel.classList.add("is-in"); }
    $("#pn-h").textContent = F.mode === "glance" ? "Quick glances" : F.mode === "set" ? "Before you go" : "Needs you";
    show(F.cur, was ? "skip-fwd" : "enter");
    announce(`${$("#pn-h").textContent}: ${F.order.length}.`);
    render();
    return true;
  }

  function close({ restore = true } = {}) {
    if (!F.open) return;
    F.hold && F.hold.cancel();
    clearTimeout(F.autoT);
    F.open = false;
    P.reviewStop();
    panel.classList.remove("is-in");
    panel.classList.add("is-out");
    document.body.classList.remove("panel-open");
    setTimeout(() => { if (!F.open) { panel.hidden = true; panel.classList.remove("is-out"); stage.innerHTML = ""; } }, RM.matches ? 0 : 240);
    const r = F.returnTo;
    F.returnTo = null;
    if (restore && r && r.isConnected && r !== document.body) r.focus({ preventScroll: true });
    toastRender();
    render();
  }

  /** On every app render: fold newly admitted asks in, mark vanished ones. Held asks never join by themselves. */
  function sync() {
    if (!F.open) return;
    if (F.mode === "set") { for (const k of F.order) if (!F.status.has(k) && !queue.has(k) && !needItems().some((n) => n.key === k)) F.status.set(k, "gone"); return; }
    let needs = needItems().filter((n) => n.admitted);
    if (F.mode === "glance") needs = needs.filter((n) => n.effort === "glance");
    const live = new Set(needs.map((n) => n.key));
    let changed = false;
    for (const n of needs) {
      F.items.set(n.key, n);
      if (!F.order.includes(n.key) && !F.done) {
        const order = rank(F.order.map((k) => F.items.get(k)).filter(Boolean).concat(n)).map((x) => x.key);
        const at = Math.max(order.indexOf(n.key), F.order.indexOf(F.cur) + 1);
        F.order.splice(at, 0, n.key);
        changed = true;
      }
      if (F.status.get(n.key) === "gone") { F.status.delete(n.key); changed = true; }
    }
    for (const k of F.order) {
      if (!F.status.has(k) && !live.has(k) && !queue.has(k)) { F.status.set(k, "gone"); changed = true; if (k === F.cur && !F.done && !F.vig) advance("skip-fwd"); }
    }
    if (changed) chrome();
  }

  const pending = (k) => !F.status.has(k);
  function nextPending(from, dir = 1) {
    const n = F.order.length, i0 = F.order.indexOf(from);
    for (let s = 1; s <= n; s++) {
      const k = F.order[(i0 + dir * s + n * 2) % n];
      if (pending(k) && k !== from) return k;
    }
    return null;
  }
  function advance(how) {
    const nx = nextPending(F.cur, how === "skip-back" ? -1 : 1);
    if (!nx) { finish(how); return; }
    // the vigilance cap: at a natural break (between asks), never mid-card
    if (P.tired() && (how === "allow" || how === "back")) { F.cur = nx; vigilance(how); return; }
    F.cur = nx;
    show(nx, how);
  }

  // ── deciding ──────────────────────────────────────────────────────────────
  function decide(n, choice, note = "", { secs = null } = {}) {
    note = String(note || "").trim();
    // one decision per ask: a second press (a double-click, a key during the card's exit) does nothing
    if (queue.has(n.key) || sentKeys.has(n.key) || (F.open && /^(allow|back)$/.test(F.status.get(n.key) || ""))) return null;
    if (n.ask.item) return decideItem(n, choice, note, secs);
    let taught = false, scope = null;
    if (choice === "allow" && teach.get(n.key)) {
      const cmd = Kit.commandOf(n.ask);
      scope = teach.get(n.key);
      const sentence = Kit.teachSentence(PROJ(n.t.project), scope === "prefix" ? Kit.prefixOf(cmd) : cmd);
      note = note ? `${note} ${sentence}` : sentence;
      taught = true;
    }
    const stopped = n.group === "stopped";
    const done = !!(choice && choice.resolve);
    const verb = done ? "Done" : choice === "allow" ? "Allowed" : choice === "deny" ? "Sent back" : stopped ? "Asked to retry" : "Answered";
    const said = typeof choice === "object" && !done ? choice.option || choice.text : "";
    const fromSug = !!(n.sug && said && said === n.sug.label) || (choice === "allow" && n.sug && n.sug.label === "Allow");
    const entry = { id: ++logN, key: n.key, verb, choice: choice === "allow" || choice === "deny" ? choice : "answer", label: n.ask.title, said, note, taught, fromSug, project: n.t.project, thread: n.t.title, tid: n.t.id, at: Date.now(), status: "queued", risk: n.risk, lev: n.lev, doneAt: n.t.checklist.done, secs: secs ?? (n.effort === "glance" ? 5 : 40) };
    log.unshift(entry);
    teach.delete(n.key);
    if (choice === "allow" && n.ask.kind === "permission") rules.noteAllowed(n, taught, scope);
    if (F.open) F.status.set(n.key, choice === "deny" ? "back" : "allow");
    queue.push([{ key: n.key, n, t: n.t, ask: n.ask, choice, note, stopped, entry }], { verb, label: done ? n.t.title : said ? `${said}` : n.ask.title, deny: choice === "deny" });
    sound.play(choice === "deny" ? "back" : "allow");
    announce(done ? `Done: ${n.t.title} will be resolved. Undo for 3 seconds.` : `${verb}${said ? `: ${said}` : ""}. Undo for 3 seconds.`);
    toastRender();
    render();
    return entry;
  }

  /** A storm item: the request body is built now (so a bad choice is refused before the window). */
  function decideItem(n, choice, note, secs) {
    const it = n.ask.item;
    const P = itemParts(it);
    if (choice === "allow" && teach.get(n.key)) choice = { scope: P.scopes.find((o) => o.id === teach.get(n.key)) };
    let body;
    try { body = itemBody(it, choice, note); } catch (err) { announce(err.message); return null; }
    // one key per decision, so a resend of this same decision is the same request
    body.idempotency_key = newKey();
    const no = isNo(body);
    const opt = body.scope === "thread" ? P.scopes.find((o) => o.scope === "thread") : body.option ? P.scopes.find((o) => o.id === body.option) : null;
    const said = typeof choice === "object" && choice ? (choice.option || choice.text || choice.name || (choice.answers ? "your answers" : "") || (opt ? opt.label : "")) : "";
    const verb = opt ? (opt.scope === "thread" ? "Allowed for this thread" : "Allowed, with a rule") : VERB[body.decision] || "Answered";
    const entry = { id: ++logN, key: n.key, verb, choice: no ? "deny" : body.decision === "answer" ? "answer" : "allow", label: it.title, said, note, taught: !!opt && opt.scope === "rule", fromSug: false, project: n.t.project, thread: n.t.title, tid: n.t.id, at: Date.now(), status: "queued", risk: n.risk, lev: n.lev, doneAt: n.t.checklist.done, secs: secs ?? (n.effort === "glance" ? 5 : 40) };
    log.unshift(entry);
    teach.delete(n.key);
    if (F.open) F.status.set(n.key, no ? "back" : "allow");
    queue.push([{ key: n.key, n, t: n.t, ask: n.ask, choice: { storm: true, body }, note: "", stopped: false, entry }], { verb, label: said || it.title, deny: no });
    sound.play(no ? "back" : "allow");
    announce(done ? `Done: ${n.t.title} will be resolved. Undo for 3 seconds.` : `${verb}${said ? `: ${said}` : ""}. Undo for 3 seconds.`);
    toastRender();
    render();
    return entry;
  }

  /** For Home and the thread's own card: decide one ask without the panel. */
  function decideNow(key, choice, note) {
    const n = needItems().find((x) => x.key === key);
    if (!n) return false;
    if (n.risk === "destructive" && choice === "allow") return false; // only ever via the hold
    return !!decide(n, choice, note);
  }
  function laterNow(key) { later.add(key); announce("Planned for later today. It won't come up as your next move until then."); render(); }
  function bringIn(key) { P.bringIn(key); announce("Brought in. It's in today's list now."); render(); }

  function allowAllRoutine() {
    const batch = F.order.filter(pending).map((k) => F.items.get(k)).filter((n) => n && n.group === "routine" && Kit.isBinary(n.ask));
    if (!batch.length) return;
    const parts = batch.map((n) => {
      const entry = { id: ++logN, key: n.key, verb: "Allowed", choice: "allow", label: n.ask.title, project: n.t.project, thread: n.t.title, tid: n.t.id, at: Date.now(), status: "queued", risk: n.risk, batch: true, lev: n.lev, doneAt: n.t.checklist.done, secs: 3 };
      log.unshift(entry);
      F.status.set(n.key, "allow");
      rules.noteAllowed(n, false, null);
      return { key: n.key, n, t: n.t, ask: n.ask, choice: "allow", note: "", entry };
    });
    queue.push(parts, { verb: "Allowed", label: `${batch.length} routine asks` });
    sound.play("allow");
    announce(`Allowed ${batch.length} routine asks. Undo for 3 seconds.`);
    toastRender(); render();
    if (!pending(F.cur)) advance("allow"); else show(F.cur, "enter");
  }

  function setLater() {
    const k = F.cur;
    later.add(k);
    F.status.set(k, "later");
    announce("Planned for later today. Nothing else changes.");
    render();
    advance("skip-fwd");
  }

  function undo() { return !!queue.undo(); }

  // ── the card (shared by the panel and the thread's own decision) ─────────
  function headline(n) {
    if (n.ask.item) return renderInline(n.ask.title || "", true); // the server's words; `code` stays code
    const cmd = Kit.commandOf(n.ask);
    if (cmd) return `<span class="h-verb">Run</span> <code class="h-cmd">${esc(cmd)}</code>`;
    if (n.group === "stopped") { const c = n.t.checklist.items.find((i) => i.state !== "done"); return `<span class="h-verb">Stopped at</span> ${esc(c ? c.text : n.t.title)}`; }
    if (n.risk === "destructive") return esc(n.ask.title.replace(/:\s.*$/, ""));
    return esc(n.ask.title);
  }

  function changeBlock(c) {
    if (!c) return "";
    const hl = c.lang !== "diff" ? highlight(c.text, c.lang) : null;
    if (hl != null) return `<figure class="chg"><figcaption>${ICON.doc}<span>${esc(c.label)}</span></figcaption><pre><code class="hl">${hl}</code></pre></figure>`;
    const lines = esc(c.text).split("\n").map((l) => {
      const cls = c.lang === "diff" ? (l.startsWith("+") ? "dl-add" : l.startsWith("-") ? "dl-del" : "") : "";
      return `<span class="${cls}">${l || " "}</span>`;
    }).join("\n");
    return `<figure class="chg"><figcaption>${ICON.doc}<span>${esc(c.label)}</span></figcaption><pre><code>${lines}</code></pre></figure>`;
  }

  function detailsHtml(n, ev) {
    const t = n.t;
    const msgs = t.messages.slice(-2);
    const ck = t.checklist.items.map((i) => `<li class="ck ck-${i.state}"><span class="ck-m" aria-hidden="true">${MARK(i.state)}</span><span>${esc(i.text)}</span></li>`).join("");
    return `<div class="dt">` +
      `<div class="dt-main">${changeBlock(ev.change)}` +
      `<p class="dt-why">${esc(ev.why)}</p>` +
      (n.sug ? `<p class="dt-sug"><b>Why ${esc(n.sug.label)}:</b> ${esc(n.sug.why)}</p>` : "") +
      `<ol class="ev-msgs">${msgs.map((m) => `<li><b>${m.who === "you" ? "You" : "Agent"}</b><span>${esc(m.text)}</span><time>${clock(m.at)}</time></li>`).join("")}</ol></div>` +
      `<div class="dt-side"><h4>Checklist <span>${t.checklist.done} of ${t.checklist.total}</span></h4><ol class="ck-list">${ck}</ol>` +
      (t.branch ? `<p class="ev-br">${ICON.branch}<code>${esc(t.branch)}</code></p>` : "") + `</div></div>`;
  }

  /**
   * A live thread waiting on you (if1 #5): what it needs as a short, formatted excerpt (the whole
   * reply is in the thread, one press away), and its checklist with what's left first. No messages
   * repeated: the card is a summary, the thread is the record.
   */
  function waitingDetailsHtml(n) {
    const t = n.t, a = n.ask;
    const { md, more } = excerptMarkdown(a.full || a.detail || "", 600);
    const items = [...t.checklist.items].sort((x, y) => (x.state === "done") - (y.state === "done"));
    const ck = items.map((i) => `<li class="ck ck-${esc(i.state)}"><span class="ck-m" aria-hidden="true">${MARK(i.state)}</span><span>${renderInline(i.text || "", true)}</span></li>`).join("");
    const main = md ? `<div class="prose dt-ex${more ? " is-more" : ""}">${renderMarkdown(md)}</div>${more ? `<button type="button" class="dt-more" data-act="thread" title="Open the thread${K.hint("open")}">The rest is in the thread ${ICON.chevron}</button>` : ""}` : `<p class="dt-why">Open the thread to see what it needs.</p>`;
    return `<div class="dt"><div class="dt-main">${main}</div>` +
      (items.length ? `<div class="dt-side"><h4>Checklist <span>${t.checklist.done} of ${t.checklist.total}</span></h4><ol class="ck-list">${ck}</ol>${t.branch ? `<p class="ev-br">${ICON.branch}<code>${esc(t.branch)}</code></p>` : ""}</div>` : "") + `</div>`;
  }

  /** An answer button. A preview, when there is one, sits in a small swatch so the button never looks disabled. */
  function optHtml(o, i, ev) {
    const pv = ev.preview ? ev.preview.find((p) => p.label === o) : null;
    return `<button type="button" class="b b-opt${pv ? " has-pv" : ""}" data-opt="${i}" title="Answer “${esc(o)}” (${i + 1})">${pv ? `<span class="o-pv" aria-hidden="true"><span class="o-s" style="${esc(pv.css)}">${esc(pv.sample || o)}</span></span>` : ""}<span class="o-l">${esc(o)}</span></button>`;
  }

  /** A storm item's evidence: the exact detail the server sent, never our prose. */
  function itemDetailsHtml(n) {
    const it = n.ask.item;
    const ev = evidenceOf(it);
    const blocks = ev.blocks.map((b) => b.lang === "md"
      ? `<figure class="chg is-md"><figcaption>${ICON.doc}<span>${esc(b.label)}</span></figcaption><div class="prose chg-md">${renderMarkdown(b.text)}</div></figure>`
      : changeBlock({ label: b.label, lang: b.lang, text: b.text })).join("");
    const notes = (it.annotations || []).map((a) => `<p class="dt-sug"><b>${a.by === "coordinator" ? "The coordinator" : "The agent"}:</b> ${esc(a.note)}</p>`).join("");
    const facts = ev.facts.length ? `<ul class="dt-facts">${ev.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : "";
    // the why is the card's own line; Details repeats it only where the line shows facts instead
    const why = it.why && n.risk === "destructive" ? `<p class="dt-why">${esc(cap(it.why))}</p>` : "";
    const t = n.t;
    const ck = t.checklist.items.map((i) => `<li class="ck ck-${esc(i.state)}"><span class="ck-m" aria-hidden="true">${MARK(i.state)}</span><span>${esc(i.text)}</span></li>`).join("");
    return `<div class="dt"><div class="dt-main">${blocks}${why}${facts}${notes}</div>` +
      (t.host ? "" : `<div class="dt-side"><h4>Checklist <span>${t.checklist.done} of ${t.checklist.total}</span></h4><ol class="ck-list">${ck}</ol>${t.branch ? `<p class="ev-br">${ICON.branch}<code>${esc(t.branch)}</code></p>` : ""}</div>`) + `</div>`;
  }

  /** A storm item's answers, all from its own options (labels, scopes, sentences, hold). */
  /** The hold button for an item's "yes" (its words from the server's label). */
  const holdBtn = (it, P) => {
    const words = holdWordsOf(P.primary);
    return `<button type="button" class="b b-hold" data-act="hold" title="Press and hold for 1.2 s (hold Enter)" aria-label="${esc(words)}: ${esc(it.title)}. Press and hold for 1.2 seconds."><span class="hold-fill" aria-hidden="true"></span><span class="b-l"><span class="hold-ic">${ICON.lock}</span><span class="hold-txt" data-label="${esc(words)}">${esc(words)}</span></span></button>`;
  };

  function itemActsHtml(n, id) {
    const it = n.ask.item, P = itemParts(it), qs = questionsOf(it);
    const scope = teach.get(n.key);
    let act = "";
    if (it.kind === "question" && noSecret.has(it.id) && qs.some((q) => q.secret)) {
      // XO refused to carry a secret to this question (secret_needs_a_call): it can't be answered here
      return `<p class="c-iwhy">${ICON.lock}<span>XO can't pass a secret to this question. Don't paste it into the thread: XO keeps what's written there. Give it to the agent outside XO (for example in its environment), then tell the thread it's done; your reply replaces this question.</span></p>` +
        `<div class="c-btns one"><button type="button" class="b b-reply" data-act="thread"><span class="b-l">${ICON.arrow}Open the thread</span></button></div>`;
    }
    if (it.kind === "question") {
      // one plain choice is one press, unless it's destructive: then it's picked, then held
      const one = qs.length === 1 && !qs[0].multi && !qs[0].secret && qs[0].options.length && !P.hold;
      if (one) {
        act += `<div class="c-opts n${Math.min(qs[0].options.length, 3)}" role="group" aria-label="Answers">${qs[0].options.map((o, i) => `<button type="button" class="b b-opt" data-iopt="${i}" title="Answer “${esc(o.label)}” (${i + 1})"><span class="o-l">${esc(o.label)}</span>${o.description ? `<span class="o-d">${esc(o.description)}</span>` : ""}</button>`).join("")}</div>`;
        act += `<div class="c-btns one"><button type="button" class="b b-reply" data-act="reply" title="Answer in your words${K.hint("reply")}"><span class="b-l">${ICON.edit}Answer in words</span></button></div>`;
      } else {
        act += `<form class="c-qs" data-qform novalidate>${qs.map((q, qi) => {
          const name = `q${id}-${qi}`;
          // a lone question that is the card's own title isn't said twice (its label stays for screen readers)
          const same = qs.length === 1 && !q.header && q.question === it.title;
          const head = same ? `<legend class="sr-only">${esc(q.question)}</legend>` : `<legend>${esc(q.header || q.question)}</legend>${q.header && q.question ? `<p class="c-q-q">${esc(q.question)}</p>` : ""}`;
          if (q.secret) return `<fieldset class="c-q">${head}<input type="password" class="c-q-in" name="${name}" data-qid="${esc(q.id)}" autocomplete="off" aria-label="${esc(q.question)}"><p class="c-q-s">Goes to the agent only; XO keeps it as [secret].</p></fieldset>`;
          if (!q.options.length) return `<fieldset class="c-q">${head}<input class="c-q-in" name="${name}" data-qid="${esc(q.id)}" autocomplete="off" aria-label="${esc(q.question)}"></fieldset>`;
          return `<fieldset class="c-q">${head}<div class="c-q-opts">${q.options.map((o) => `<label class="c-q-o"><input type="${q.multi ? "checkbox" : "radio"}" name="${name}" data-qid="${esc(q.id)}" value="${esc(o.label)}"><span><b>${esc(o.label)}</b>${o.description ? `<em>${esc(o.description)}</em>` : ""}</span></label>`).join("")}</div></fieldset>`;
        }).join("")}<div class="c-btns one">${P.hold ? holdBtn(it, P) : `<button type="submit" class="b b-allow"><span class="b-l">${ICON.check}Send ${qs.length > 1 ? "answers" : "answer"}</span></button>`}</div></form>`;
      }
      return act;
    }
    if (it.kind === "create_project" && P.primary && P.primary.answer === "name") {
      act += `<label class="c-name"><span>Project name</span><input class="c-name-in" data-name value="${esc((it.detail && it.detail.name) || "")}" maxlength="80" autocomplete="off"></label>`;
    }
    const label = (o, fallback) => esc((o && o.label) || fallback);
    const primary = !P.primary ? "" : P.hold ? holdBtn(it, P)
      : `<button type="button" class="b b-allow${n.risk === "notable" ? " arming" : ""}" data-act="allow" title="${label(P.primary)}${K.hint("allow")}" aria-keyshortcuts="${K.label("allow")}"><span class="b-l">${ICON.check}<span class="al-t">${esc(scopeWords(P, scope))}</span></span></button>`;
    const back = !P.back ? "" : `<button type="button" class="b b-back" data-act="${P.back.note ? "back" : "back-now"}" title="${label(P.back)}${K.hint("back")}" aria-keyshortcuts="${K.label("back")}"><span class="b-l">${ICON.rewind}${label(P.back)}</span></button>`;
    act += `<div class="c-btns${primary && back ? "" : " one"}">${primary}${back}</div>`;
    if (P.why) act += `<p class="c-iwhy">${ICON.lock}<span>${esc(P.why)}</span></p>`;
    if (P.scopes.length) {
      act += `<div class="c-low"><button type="button" class="teach-tog" data-act="teach" aria-pressed="${!!scope}" title="Allow more than once${K.hint("rule")}"><span class="sw" aria-hidden="true"></span>${P.scopes.some((o) => o.scope === "rule") ? "Make it a rule" : "Allow for this thread"}</button></div>`;
      const cur = P.scopes.find((o) => o.id === scope) || P.scopes[0];
      act += `<div class="teach-body"${scope ? "" : " hidden"}><div class="teach-in"><div class="teach-scope is-list" role="radiogroup" aria-label="How far it reaches">${P.scopes.map((o) => `<button type="button" role="radio" data-iscope="${esc(o.id)}" aria-checked="${o.id === (scope || cur.id)}">${esc(o.scope === "thread" ? o.label : (o.sentence || o.label))}</button>`).join("")}</div>` +
        `<p class="teach-q"><span>${cur.scope === "rule" ? "Added to your rules, word for word:" : "For this thread only:"}</span><q>${esc(cur.sentence || cur.label)}</q></p></div></div>`;
    }
    return act;
  }

  /** surface: "panel" | "dock" */
  function cardHtml(n, surface = "panel") {
    const id = ++cardN;
    const a = n.ask, r = n.risk, t = n.t;
    const stopped = n.group === "stopped";
    const destructive = r === "destructive";
    const binary = Kit.isBinary(a);
    const cmd = Kit.commandOf(a);
    const ev = evidenceFor(n);
    const opts = !binary && !stopped && Array.isArray(a.options) && a.options.length ? a.options : null;
    const teachable = a.kind === "permission" && !destructive && !!cmd;
    const reps = teachable ? rules.repeats(n) : 0;
    const E = EFFORT[n.effort];
    const openEv = !!F.open0[n.key]?.ev && surface === "panel";
    const scope = teach.get(n.key);

    let act = "";
    const storm = !!a.item;
    if (storm) {
      act += itemActsHtml(n, id);
      // a big one can wait for a calmer moment, like any other card
      if (destructive || n.effort === "think") act += `<div class="c-low"><button type="button" class="b-later" data-act="later" title="Plan for later today${K.hint("later")}">${ICON.clock}Later today</button>${destructive ? `<span class="c-low-t">or skip to the easier ones</span>` : ""}</div>`;
    } else {
    if (opts) act += `<div class="c-opts n${Math.min(opts.length, 3)}" role="group" aria-label="Answers">${opts.map((o, i) => optHtml(o, i, ev)).join("")}</div>`;
    let primary;
    if (destructive) primary = `<button type="button" class="b b-hold" data-act="hold" title="Press and hold for 1.2 s (hold Enter)" aria-label="Hold to allow: ${esc(a.title)}. Press and hold for 1.2 seconds."><span class="hold-fill" aria-hidden="true"></span><span class="b-l"><span class="hold-ic">${ICON.lock}</span><span class="hold-txt">Hold to allow</span></span></button>`;
    else if (stopped) primary = `<button type="button" class="b b-allow" data-act="retry" title="Try again${K.hint("allow")}"><span class="b-l">${ICON.retry}Try again</span></button>`;
    else if (binary) primary = `<button type="button" class="b b-allow${r === "notable" ? " arming" : ""}" data-act="allow" title="Allow${K.hint("allow")}" aria-keyshortcuts="${K.label("allow")}"><span class="b-l">${ICON.check}<span class="al-t">${scope ? "Allow + rule" : "Allow"}</span></span></button>`;
    else primary = `<button type="button" class="b b-reply" data-act="reply" title="Reply in your words${K.hint("reply")}"><span class="b-l">${ICON.edit}Reply in words</span></button>`;
    const secondary = stopped
      ? `<button type="button" class="b b-back" data-act="note-reply" title="Tell it what to try${K.hint("reply")}"><span class="b-l">${ICON.edit}Tell it what to try</span></button>`
      : `<button type="button" class="b b-back" data-act="back" title="Send back with a note${K.hint("back")}" aria-keyshortcuts="${K.label("back")}"><span class="b-l">${ICON.rewind}Send back</span></button>`;
    // Live questions are answered in words: no "Send back" that would post a non-answer (P1-6). A thread
    // that replied and waits (needs_reply) is often finished work: Done resolves it, after the 3 s Undo (if1 #4).
    const canDone = !!(a.replyOnly && a.live && !a.paused && !a.pending && world.act.resolve);
    const doneBtn = `<button type="button" class="b b-done" data-act="done" title="It's finished: resolve the thread${K.hint("done")}" aria-keyshortcuts="${K.label("done")}"><span class="b-l">${ICON.check}Done</span></button>`;
    act += canDone ? `<div class="c-btns">${primary}${doneBtn}</div>` : a.stopByYou || a.replyOnly ? `<div class="c-btns one">${primary}</div>` : `<div class="c-btns">${primary}${secondary}</div>`;
    const low = [];
    // a live waiting thread: the way to read all of it is the thread itself (if1 #5)
    if (a.live && a.replyOnly && !a.pending && surface === "panel" && !t.host) low.push(`<button type="button" class="b-later b-open" data-act="thread" title="Open the thread beside the panel${K.hint("open")}">${ICON.arrow}Open the thread</button>`);
    if (teachable) low.push(`<button type="button" class="teach-tog" data-act="teach" aria-pressed="${!!scope}" title="Make it a rule${K.hint("rule")}"><span class="sw" aria-hidden="true"></span>${reps >= 2 ? `<span class="rep">${ord(reps + 1)} time this week</span> · ` : ""}Make it a rule</button>`);
    if (destructive) low.push(`<button type="button" class="b-later" data-act="later" title="Plan for later today${K.hint("later")}">${ICON.clock}Later today</button><span class="c-low-t">or skip to the easier ones</span>`);
    else if (n.effort === "think") low.push(`<button type="button" class="b-later" data-act="later" title="Plan for later today${K.hint("later")}">${ICON.clock}Later today</button>`);
    if (low.length) act += `<div class="c-low">${low.join("")}</div>`;
    if (teachable) act += `<div class="teach-body"${scope ? "" : " hidden"}><div class="teach-in"><div class="teach-scope" role="radiogroup" aria-label="Rule scope"><button type="button" role="radio" data-scope="exact" aria-checked="${scope !== "prefix"}">Exactly this command</button><button type="button" role="radio" data-scope="prefix" aria-checked="${scope === "prefix"}">Any “${esc(Kit.prefixOf(cmd))}”</button></div><p class="teach-q"><span>Added to your rules, word for word:</span><q>${esc(Kit.teachSentence(PROJ(t.project), scope === "prefix" ? Kit.prefixOf(cmd) : cmd))}</q></p></div></div>`;
    }
    act += `<div class="c-note" hidden><label for="c-note-${id}" class="c-note-l"></label><textarea id="c-note-${id}" class="c-note-in" rows="2"></textarea>` +
      `<div class="c-note-row"><button type="button" class="b b-sm b-go" data-act="note-send"></button><button type="button" class="b b-sm b-ghost" data-act="note-cancel" title="Cancel (Esc)">Cancel</button></div></div>`;

    const line = destructive && !storm ? "" : storm ? (destructive ? "" : cap(a.item.why || "")) : whyLine(n);
    const facts = destructive ? `<p class="c-facts">${ICON.lock}<span>${(storm ? (a.riskReasons || []).map((r) => r.charAt(0).toUpperCase() + r.slice(1)) : ["Can't be undone", ...ev.facts]).map((f) => esc(f)).join(" · ") || "Destructive"}</span></p>` : "";
    const estT = estLine(n);
    const est = !destructive && !a.stopByYou && estT ? `<p class="c-est" title="${t.live ? "From its checklist: the steps not done yet." : "An estimate: the steps left that wait on this answer × a typical step time."}">${ICON.hourglass}<span>${esc(estT)}</span></p>` : "";
    const sug = n.sug ? `<p class="c-sug" title="${esc(n.sug.why)}">${ICON.spark}<span>Suggests <b>${esc(n.sug.label)}</b></span><em>${esc(n.sug.sure)}</em></p>` : "";

    return `<div class="card-in" data-key="${esc(n.key)}">` +
      `<div class="c-body">` +
      `<div class="c-top"><span class="eff e-${n.effort}">${dial(n.effort)}<b>${E.label}</b><span>${E.time}</span></span>` +
      (destructive ? `<span class="risk r-destructive">${ICON.lock}Destructive</span>` : stopped ? `<span class="risk r-stopped">Stopped</span>` : "") +
      (t.host ? `<button type="button" class="c-where" data-act="thread" title="Open where it was asked">${esc(t.title)}</button></div>` : `<button type="button" class="c-where" data-act="thread" title="${surface === "dock" ? "Open the thread" : `Open the thread beside this${K.hint("open")}`}">${esc(PROJ(t.project))}<span aria-hidden="true">›</span><b>${esc(t.title)}</b></button></div>`) +
      `<h3 class="c-h" id="card-h-${id}">${headline(n)}</h3>` +
      (line ? `<p class="c-line" id="card-why-${id}">${esc(line)}</p>` : "") + facts + est + sug +
      `<div class="dis${openEv ? " is-open" : ""}" data-dis="ev"><button type="button" class="dis-h" aria-expanded="${openEv}" aria-controls="dt-${id}" title="Details${K.hint("details")}">${ICON.chevron}<span>Details</span></button>` +
      `<div class="dis-b" id="dt-${id}"${openEv ? "" : " hidden"}><div class="dis-in">${storm ? itemDetailsHtml(n) : a.live ? waitingDetailsHtml(n) : detailsHtml(n, ev)}</div></div></div>` +
      `</div>` +
      `<div class="c-act">${act}<p class="c-hint" aria-live="polite"></p></div></div>`;
  }

  /** The panel's frame stays; its contents change. how: enter | allow | back | skip-fwd | skip-back | undo */
  async function show(key, how) {
    const n = F.items.get(key);
    if (!n) return;
    F.vig = false;
    const my = ++F.swap;
    clearTimeout(F.autoT);
    F.hold && F.hold.cancel();
    let frame = $("#card");
    if (!frame) {
      stage.innerHTML = `<article class="card" id="card" tabindex="-1" aria-roledescription="decision"><div class="stamp stamp-allow" aria-hidden="true">${BIG_CHECK}</div><div class="stamp stamp-back" aria-hidden="true">${BIG_BACK}</div></article>`;
      frame = $("#card");
    }
    const old = frame.querySelector(".card-in");
    F.busy = true;
    if (old && !RM.matches) {
      if (how === "allow" || how === "back") { frame.classList.add(`st-${how}`); await wait(190); }
      old.classList.add(`out-${how}`);
      await wait(how === "allow" || how === "back" ? 150 : 120);
      frame.classList.remove("st-allow", "st-back");
    }
    if (my !== F.swap) return;
    const fresh = needItems().find((x) => x.key === key) || n;
    const tpl = document.createElement("template");
    tpl.innerHTML = cardHtml(fresh, "panel").trim();
    const inner = tpl.content.firstElementChild;
    inner.classList.add(`in-${how}`);
    morph(frame, () => {
      old && old.remove();
      frame.className = `card r-${fresh.risk} e-${fresh.effort}`;
      frame.appendChild(inner);
    }, { duration: 300 });
    frame.setAttribute("aria-labelledby", inner.querySelector(".c-h").id);
    const why = inner.querySelector(".c-line");
    if (why) frame.setAttribute("aria-describedby", why.id); else frame.removeAttribute("aria-describedby");
    wireCard(frame, inner, fresh, { surface: "panel", after: (h) => advance(h) });
    F.busy = false;
    // focus the card itself: never an answer, never the suggestion
    frame.focus({ preventScroll: true });
    chrome();
  }

  function hint(el, text) {
    const h = el.querySelector(".c-hint");
    h.textContent = text;
    h.classList.remove("show"); void h.offsetWidth; h.classList.add("show");
  }

  /** Details: a continuous height change with a cross-fade (expand()). */
  function toggleDis(inner, which, n, onStep) {
    const d = inner.querySelector(`[data-dis="${which}"]`);
    if (!d) return;
    const on = !d.classList.contains("is-open");
    d.querySelector(".dis-h").setAttribute("aria-expanded", String(on));
    const dock = d.closest(".card.is-dock");
    expand(d, d.querySelector(".dis-b"), on, { onStep, frame: dock || null });
    if (which === "ev") F.open0[n.key] = { ...(F.open0[n.key] || {}), ev: on };
    if (on && !d.closest(".is-dock")) setTimeout(() => d.scrollIntoView({ block: "nearest", behavior: RM.matches ? "auto" : "smooth" }), 340);
  }

  /** Wire one card. ctx.after(how) runs after a decision (panel: advance; dock: settle). */
  function wireCard(frame, el, n, ctx) {
    const q = (s) => el.querySelector(s);
    const note = q(".c-note"), noteIn = q(".c-note-in");
    const shownAt = performance.now();
    const ready = () => performance.now() - shownAt >= Kit.READ_MS;
    const secs = () => Math.max(2, Math.round((performance.now() - shownAt) / 1000));
    // decide, then move on: only when a decision was queued (a repeat press or a refused choice stays put)
    const go = (choice, how, note = "") => { const entry = decide(n, choice, note, { secs: secs() }); if (entry) ctx.after(how); return entry; };
    let noteMode = null;
    const body = frame;
    const step = ctx.onStep || null;
    const openNote = (mode) => {
      noteMode = mode;
      q(".c-note-l").textContent = mode === "reply" ? (n.group === "stopped" ? "What should it try?" : "Your answer, in your words") : "What should it do instead? (optional)";
      const no = n.ask.item ? itemParts(n.ask.item).back : null;
      q('[data-act="note-send"]').innerHTML = mode === "reply" ? "Send" : `${ICON.rewind}${esc((no && no.label) || "Send back")}`;
      noteIn.placeholder = mode === "reply" ? (n.group === "stopped" ? "e.g. use the read replica for this step" : "Type your answer") : "e.g. what it should try instead";
      morph(body, () => { note.hidden = false; el.classList.add("noting"); }, { duration: 280, fade: note });
      if (step) step();
      noteIn.focus({ preventScroll: true });
    };
    const closeNote = () => { morph(body, () => { note.hidden = true; noteMode = null; el.classList.remove("noting"); }, { duration: 260 }); frame.focus({ preventScroll: true }); };
    const sendNote = () => {
      const v = noteIn.value.trim();
      if (noteMode === "reply") { if (!v) { noteIn.focus(); return; } go({ text: v }, "allow"); }
      else { go("deny", "back", v); }
    };
    noteIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.stopPropagation(); sendNote(); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeNote(); }
    });
    frame._openNote = openNote; frame._closeNote = closeNote; frame._noting = () => !note.hidden;

    const tryAllow = () => {
      if (n.risk === "destructive") { hint(el, "Destructive asks are never one key: press and hold the button."); return; }
      if (n.group === "stopped") { go({ text: "Please try again from the failing step." }, "allow"); return; }
      if (n.ask.item) {
        if (n.ask.item.kind === "question") { hint(el, "Pick an answer, or answer in words."); return; }
        if (n.risk === "notable" && !ready()) { hint(el, "A beat to read it first."); return; }
        if (itemParts(n.ask.item).hold) { hint(el, "This one needs a press and hold."); return; }
        el.querySelector('[data-act="allow"]')?.classList.add("pressed");
        const nameIn = el.querySelector("[data-name]");
        go(nameIn ? { name: nameIn.value } : "allow", "allow");
        return;
      }
      if (!Kit.isBinary(n.ask)) { hint(el, "Pick an answer, reply in words, or send it back."); return; }
      if (n.risk === "notable" && !ready()) { hint(el, "A beat to read it first."); return; }
      el.querySelector('[data-act="allow"]')?.classList.add("pressed");
      go("allow", "allow");
    };
    frame._allow = tryAllow;
    frame._hint = (text) => hint(el, text);
    // a pause carries over to the card that takes this one's place: words still being typed must never land on
    // it as keys (an item withdrawn or decided elsewhere mid-sentence); the new card says why its keys are paused
    const carried = !!frame._quiet;
    frame._quiet = false;
    // the card's letter keys paused (see cardKeys): the reason stays on the card until they are back
    frame._quietOn = (text) => {
      frame._quiet = true;
      const h = el.querySelector(".c-hint");
      h.textContent = `${text} Its keys are paused while you type: press Esc or click the card to use them again.`;
      h.classList.remove("show"); h.classList.add("stay");
    };
    frame._quietOff = () => {
      if (!frame._quiet) return false;
      frame._quiet = false;
      const h = el.querySelector(".c-hint");
      h.classList.remove("stay"); h.textContent = "";
      return true;
    };
    if (!frame._quietWired) {
      // once per frame (it outlives its cards): each call reaches the current card's _quietOff
      frame._quietWired = true;
      frame.addEventListener("pointerdown", () => frame._quietOff && frame._quietOff());
      frame.addEventListener("focusout", (e) => { if (!frame.contains(e.relatedTarget) && frame._quietOff) frame._quietOff(); });
    }
    if (carried) frame._quietOn("A new ask took this one's place.");
    frame._n = n;

    const qform = el.querySelector("[data-qform]");
    /** The form's answers as a choice, or null (and, unless quiet, says what's missing). */
    const formChoice = (quiet = false) => {
      const qs = questionsOf(n.ask.item);
      const answers = {};
      for (const q of qs) {
        const ins = [...qform.querySelectorAll(`[data-qid="${CSS.escape(q.id)}"]`)];
        let v;
        if (q.options.length && !q.secret) { const on = ins.filter((x) => x.checked).map((x) => x.value); v = q.multi ? on : on[0]; }
        else v = (ins[0] && ins[0].value.trim()) || "";
        if (!v || (Array.isArray(v) && !v.length)) { if (!quiet) { hint(el, "Answer every question first."); (ins[0] || qform).focus(); } return null; }
        answers[q.id] = v;
      }
      return qs.length === 1 && !qs[0].multi && !qs[0].secret && !qs[0].options.length ? { text: answers[qs[0].id] } : qs.length === 1 && !qs[0].multi && !qs[0].secret ? { option: answers[qs[0].id] } : { answers };
    };
    if (qform) qform.addEventListener("submit", (e) => {
      e.preventDefault();
      if (qform.querySelector('[data-act="hold"]')) { hint(el, "This one needs a press and hold."); return; }
      const c = formChoice();
      if (c) go(c, "allow");
    });
    el.addEventListener("click", (e) => {
      const io = e.target.closest("[data-iopt]");
      if (io) { io.classList.add("pressed"); go({ option: questionsOf(n.ask.item)[0].options[+io.dataset.iopt].label }, "allow"); return; }
      const isc = e.target.closest("[data-iscope]");
      if (isc) { teach.set(n.key, isc.dataset.iscope); paintItemScope(); return; }
      const b = e.target.closest("[data-act],[data-opt],[data-scope],.dis-h");
      if (!b) return;
      if (b.classList.contains("dis-h")) { toggleDis(el, b.parentElement.dataset.dis, n, step); return; }
      if (b.dataset.opt != null) { b.classList.add("pressed"); go({ option: n.ask.options[+b.dataset.opt] }, "allow"); return; }
      if (b.dataset.scope) { teach.set(n.key, b.dataset.scope); paintTeach(); return; }
      const act = b.dataset.act;
      if (act === "allow") tryAllow();
      else if (act === "back") openNote("back");
      else if (act === "back-now") { go("deny", "back"); }
      else if (act === "reply" || act === "note-reply") openNote("reply");
      else if (act === "note-send") sendNote();
      else if (act === "note-cancel") closeNote();
      else if (act === "retry") { go({ text: "Please try again from the failing step." }, "allow"); }
      else if (act === "thread") onOpenThread && onOpenThread(n.t.id, ctx.surface);
      else if (act === "done") { b.classList.add("pressed"); go({ resolve: true }, "allow"); }
      else if (act === "teach") toggleTeach();
      else if (act === "later") { if (ctx.surface === "panel") setLater(); else { laterNow(n.key); ctx.after("later"); } }
    });

    const paintTeach = () => {
      const tog = q('[data-act="teach"]');
      if (!tog) return;
      const scope = teach.get(n.key);
      tog.setAttribute("aria-pressed", String(!!scope));
      const tb = q(".teach-body");
      if (tb.hidden === !!scope) expand(tb, tb, !!scope, { onStep: step, frame: frame.classList.contains("is-dock") ? frame : null });
      const cmd = Kit.commandOf(n.ask);
      for (const r of el.querySelectorAll("[data-scope]")) r.setAttribute("aria-checked", String(r.dataset.scope === (scope || "exact")));
      q(".teach-q q").textContent = Kit.teachSentence(PROJ(n.t.project), scope === "prefix" ? Kit.prefixOf(cmd) : cmd);
      const al = q('[data-act="allow"] .al-t');
      if (al) al.textContent = scope ? "Allow + rule" : "Allow";
    };
    // a storm item's scopes: this thread, or a rule in the server's own words
    const paintItemScope = () => {
      const P = itemParts(n.ask.item);
      const id = teach.get(n.key);
      const tog = q('[data-act="teach"]');
      if (tog) tog.setAttribute("aria-pressed", String(!!id));
      const tb = q(".teach-body");
      if (tb && tb.hidden === !!id) expand(tb, tb, !!id, { onStep: step, frame: frame.classList.contains("is-dock") ? frame : null });
      const cur = P.scopes.find((o) => o.id === id) || P.scopes[0];
      for (const r of el.querySelectorAll("[data-iscope]")) r.setAttribute("aria-checked", String(r.dataset.iscope === (id || cur.id)));
      const qq = q(".teach-q");
      if (qq && cur) { qq.querySelector("span").textContent = cur.scope === "rule" ? "Added to your rules, word for word:" : "For this thread only:"; qq.querySelector("q").textContent = cur.sentence || cur.label; }
      const al = q('[data-act="allow"] .al-t');
      if (al) al.textContent = scopeWords(P, id);
    };
    const toggleTeach = () => {
      if (!q('[data-act="teach"]')) return;
      if (n.ask.item) { const P = itemParts(n.ask.item); if (teach.get(n.key)) teach.delete(n.key); else teach.set(n.key, (P.scopes[0] || {}).id); paintItemScope(); return; }
      if (teach.get(n.key)) teach.delete(n.key); else teach.set(n.key, "exact"); paintTeach();
    };
    frame._teach = toggleTeach;
    frame._dis = (which) => toggleDis(el, which, n, step);

    const hold = q('[data-act="hold"]');
    let holder = null;
    if (hold) {
      const fill = hold.querySelector(".hold-fill");
      holder = Kit.holdToConfirm(hold, {
        ready: () => (!ready() ? "Read it first: the hold starts after a moment." : qform && !formChoice(true) ? "Answer every question first." : true),
        onProgress: (p) => {
          fill.style.transition = "none";
          fill.style.transform = `scaleX(${Math.pow(p, 1.7)})`;
          hold.classList.toggle("tense", p > 0.72 && p < 1);
          const ht = hold.querySelector(".hold-txt");
          ht.textContent = p > 0 ? "Keep holding…" : ht.dataset.label || "Hold to allow";
        },
        onConfirm: () => {
          hold.classList.remove("tense");
          hold.classList.add("locked");
          hold.querySelector(".hold-txt").textContent = n.ask.item ? (VERB[(itemParts(n.ask.item).primary || {}).decision] || "Done") : "Allowed";
          sound.play("lock");
          const nameIn = el.querySelector("[data-name]");
          const c = qform ? formChoice() : nameIn ? { name: nameIn.value } : "allow";
          setTimeout(() => { if (c) go(c, "allow"); }, RM.matches ? 0 : 220);
        },
        onRefuse: (why) => { hint(el, why); hold.classList.remove("nope"); void hold.offsetWidth; hold.classList.add("nope"); },
        onRelease: () => {
          fill.style.transition = "transform .42s cubic-bezier(.34,1.56,.64,1)";
          fill.style.transform = "scaleX(0)";
          hint(el, "Released early. Nothing was sent.");
        },
      });
    }
    if (ctx.surface === "panel") F.hold = holder;
    frame._hold = holder;
  }

  // ── the vigilance cap: a break at a natural pause, the queue held ────────
  async function vigilance(how) {
    F.vig = true;
    const frame = $("#card");
    const old = frame && frame.querySelector(".card-in");
    if (old && !RM.matches) {
      frame.classList.add(`st-${how}`); await wait(190);
      old.classList.add(`out-${how}`); await wait(150);
      frame.classList.remove("st-allow", "st-back");
    }
    const left = F.order.filter(pending).length;
    const m = Math.round(P.reviewMin());
    const inner = document.createElement("div");
    inner.className = "card-in in-enter vig";
    inner.innerHTML = `<div class="c-body"><div class="vig-ic">${ICON.pause}</div>` +
      `<h3 class="c-h" id="vig-h">${m} minutes of deciding.</h3>` +
      `<p class="c-line">Attention dips after about 25. ${left} left, nothing urgent; they'll hold.</p></div>` +
      `<div class="c-act"><div class="c-btns"><button type="button" class="b b-back" data-vig="rest"><span class="b-l">${ICON.pause}Take a break</span></button><button type="button" class="b b-back" data-vig="go"><span class="b-l">Keep going</span></button></div></div>`;
    morph(frame, () => { old && old.remove(); frame.className = "card r-vig"; frame.appendChild(inner); }, { duration: 280 });
    frame.setAttribute("aria-labelledby", "vig-h");
    frame.focus({ preventScroll: true });
    announce(`${m} minutes of deciding. A break is a good idea; the rest will hold.`);
    inner.addEventListener("click", (e) => {
      const b = e.target.closest("[data-vig]");
      if (!b) return;
      if (b.dataset.vig === "go") { P.keepGoing(); show(F.cur, "enter"); }
      else { P.rested(); close(); onBreak && onBreak(left); }
    });
    chrome();
  }

  // ── that's everything ─────────────────────────────────────────────────────
  async function finish(how) {
    F.done = true;
    const my = ++F.swap;
    const frame = $("#card");
    const old = frame && frame.querySelector(".card-in");
    if (old && !RM.matches) {
      if (how === "allow" || how === "back") { frame.classList.add(`st-${how}`); await wait(190); }
      old.classList.add(`out-${how}`);
      await wait(150);
      frame.classList.remove("st-allow", "st-back");
    }
    if (my !== F.swap || !frame) return;
    const runLog = log.filter((d) => F.order.includes(d.key));
    const c = (k) => runLog.filter((d) => d.choice === k).length;
    const laterN = F.order.filter((k) => F.status.get(k) === "later").length;
    const skipped = F.order.filter((k) => !F.status.has(k)).length;
    const freed = 0;
    const parts = [c("allow") && `${c("allow")} allowed`, c("answer") && `${c("answer")} answered`, c("deny") && `${c("deny")} sent back`, laterN && `${laterN} for later`].filter(Boolean);
    const inner = document.createElement("div");
    inner.className = "card-in in-enter done";
    inner.setAttribute("role", "status");
    inner.innerHTML = `<div class="done-ring">${BIG_CHECK}</div><h3>${F.mode === "glance" ? "Glances cleared." : "That's everything."}</h3><p>${parts.join(" · ") || "Nothing decided"}${skipped ? ` · ${skipped} still waiting` : ""}</p>` +
      "";
    morph(frame, () => { old && old.remove(); frame.className = "card r-done"; frame.appendChild(inner); }, { duration: 300 });
    frame.focus({ preventScroll: true });
    chrome();
    sound.play("done");
    announce(`${F.mode === "glance" ? "Glances cleared" : "That's everything"}. ${parts.join(", ")}.`);
    onAllClear && onAllClear(parts.join(" · "), freed);
    F.autoT = setTimeout(() => { if (F.open && F.done) close(); }, RM.matches ? 1400 : 2000);
  }

  // ── rail, count, footer ───────────────────────────────────────────────────
  function chrome() {
    const rail = $("#pn-rail");
    let html = "", apart = null;
    F.order.forEach((k) => {
      const n = F.items.get(k);
      const d = n && n.risk === "destructive";
      if (apart !== null && apart !== d) html += `<i class="rail-gap"></i>`;
      apart = d;
      const st = F.status.get(k);
      html += `<i class="rs r-${n ? n.risk : "notable"}${k === F.cur && !F.done && !F.vig ? " is-cur" : ""}${st ? " s-" + st : ""}"></i>`;
    });
    rail.innerHTML = html;
    const i = F.order.indexOf(F.cur) + 1, total = F.order.length;
    const left = F.order.filter(pending).length;
    $("#pn-count").innerHTML = F.done ? `All ${total} seen` : F.vig ? `${left} held` : `<b>${i}</b> of ${total}`;
    const routine = F.order.filter(pending).map((k) => F.items.get(k)).filter((n) => n && n.group === "routine" && Kit.isBinary(n.ask));
    const foot = $("#pn-foot");
    foot.innerHTML = F.done || F.vig ? "" :
      `<button type="button" class="pn-nav" data-nav="-1" title="Previous${K.hint("prev")}" aria-label="Previous ask"${total < 2 ? " disabled" : ""}>${ICON.back}</button>` +
      (routine.length >= 2 ? `<button type="button" class="pn-all" data-all>Allow all ${routine.length} routine</button>` : `<span class="pn-tip">Skip freely; nothing here is forced first.</span>`) +
      `<button type="button" class="pn-nav" data-nav="1" title="Skip ahead${K.hint("next")}" aria-label="Skip to the next ask"${total < 2 ? " disabled" : ""}>${ICON.right}</button>`;
    render();
  }

  function skip(dir) {
    if (F.busy || F.done || F.vig) return;
    const nx = nextPending(F.cur, dir);
    if (!nx) return;
    // moving on is the person's own act: the next card's keys are on (a pause carries over only when an
    // item leaves under them)
    const fr = $("#card");
    if (fr && fr._quietOff) fr._quietOff();
    F.cur = nx; show(nx, dir > 0 ? "skip-fwd" : "skip-back");
  }

  function confirmAll() {
    const batch = F.order.filter(pending).map((k) => F.items.get(k)).filter((n) => n && n.group === "routine" && Kit.isBinary(n.ask));
    if (!batch.length || F.done || stage.querySelector(".confirm")) return;
    const el = document.createElement("div");
    el.className = "confirm";
    el.setAttribute("role", "alertdialog");
    el.setAttribute("aria-labelledby", "cf-h");
    el.innerHTML = `<h3 id="cf-h" tabindex="-1">Allow all ${batch.length} routine asks?</h3><p>Read-only or reversible. Never includes notable or destructive asks.</p>` +
      `<ul>${batch.map((n) => `<li><span class="cf-p">${esc(PROJ(n.t.project))}</span><code>${esc(Kit.commandOf(n.ask) || n.ask.title)}</code></li>`).join("")}</ul>` +
      `<div class="c-btns"><button type="button" class="b b-allow" data-cf="yes"><span class="b-l">${ICON.check}Allow ${batch.length}</span></button><button type="button" class="b b-back" data-cf="no" title="Cancel (Esc)"><span class="b-l">Cancel</span></button></div>`;
    stage.appendChild(el);
    el.querySelector("h3").focus();
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cf]");
      if (!b) return;
      el.remove();
      if (b.dataset.cf === "yes") allowAllRoutine(); else $("#card")?.focus();
    });
  }

  $("#pn-foot").addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) skip(+nav.dataset.nav);
    if (e.target.closest("[data-all]")) confirmAll();
  });
  $("#pn-x").addEventListener("click", () => close());

  // ── undo toast ────────────────────────────────────────────────────────────
  const toast = $("#toast");
  let toastItem = null;
  function toastRender() {
    const it = queue.queued[queue.queued.length - 1];
    if (!it) {
      if (toastItem) { toast.classList.add("bye"); setTimeout(() => { if (!queue.queued.length) { toast.hidden = true; toast.classList.remove("bye"); } }, 200); }
      toastItem = null;
      return;
    }
    if (toastItem === it) return;
    toastItem = it;
    const deny = !!it.meta.deny;
    const left = Math.max(0, it.due - Date.now());
    toast.className = `toast t-${deny ? "back" : "allow"}`;
    toast.hidden = false;
    toast.innerHTML = `<span class="t-ic">${deny ? ICON.rewind : ICON.check}</span><span class="t-m"><b>${esc(it.meta.verb)}</b> <span>${esc(it.meta.label)}</span></span>` +
      `<button type="button" class="t-undo" title="Undo"><svg class="t-ring" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" style="animation-duration:${left}ms"/></svg>Undo</button>`;
    toast.querySelector(".t-undo").addEventListener("click", () => queue.undo(it.id));
  }

  // ── keys on a card (panel or dock) ────────────────────────────────────────
  function cardKeys(e, card, { onEsc, inPanel }) {
    const inField = e.target.matches?.("textarea, input");
    if (e.key === "Escape") {
      if (card && card._quietOff && card._quietOff()) { e.preventDefault(); e.stopPropagation(); return true; }
      if (card && card._noting && card._noting()) { e.preventDefault(); e.stopPropagation(); card._closeNote(); return true; }
      if (onEsc) { e.preventDefault(); e.stopPropagation(); onEsc(); return true; }
      return false;
    }
    if (inField || e.metaKey || e.ctrlKey || e.altKey) return false;
    if (e.target.closest?.(".b-hold") && (e.key === "Enter" || e.key === " ")) return false;
    const n = card && card._n;
    if (!n) return false;
    const k = e.key;
    const own = () => { e.preventDefault(); e.stopPropagation(); };
    // after a refused key (someone starting to type where no text box opened), the card's letter keys
    // stay off until a deliberate reset (Esc, a click on the card, or leaving it), so typed words can
    // never land as a decision, however long the pause between them
    if (card._quiet && k.length === 1) { own(); return true; }
    const refuse = (text) => card._quietOn(text);
    const it = n.ask.item;
    if (K.is(e, "allow")) { own(); card._allow(); }
    else if (K.is(e, "back")) {
      own();
      // a storm item says "no" only through its own "no" option (Deny, Send back, Can't, Wait…)
      if (it) { const b = card.querySelector('[data-act="back"], [data-act="back-now"]'); if (b) b.click(); else refuse("This one has no way to say no."); }
      else if (n.group === "stopped" || n.ask.replyOnly) card._openNote("reply"); else card._openNote("back");
    }
    else if (K.is(e, "reply")) {
      // words answer only a question; anything else is answered with its buttons
      if (it ? it.kind === "question" && card.querySelector('[data-act="reply"]') : !Kit.isBinary(n.ask)) { own(); card._openNote("reply"); }
      else if (it) { own(); const P = itemParts(it); refuse(`This one is answered with its buttons${P.primary ? `: ${[P.primary.label, P.back && P.back.label].filter(Boolean).join(" or ")}` : ""}.`); }
    }
    else if (K.is(e, "done")) {
      own();
      const b = card.querySelector('[data-act="done"]');
      if (b) b.click(); else refuse("Done is for a thread that replied and waits; this one is answered with its buttons.");
    }
    else if (K.is(e, "details")) { own(); card._dis("ev"); }
    else if (K.is(e, "rule")) { own(); card._teach(); }
    else if (K.is(e, "undo")) { own(); undo(); }
    else if (inPanel && K.is(e, "open")) { own(); onOpenThread && onOpenThread(n.t.id, "panel"); }
    else if (/^[1-9]$/.test(k) && it && it.kind === "question") {
      // a storm question: the k-th answer button, or (in a form) the k-th choice of a lone question
      const b = card.querySelector(`[data-iopt="${+k - 1}"]`);
      const r = !b && card.querySelectorAll("[data-qform] .c-q").length === 1 ? card.querySelectorAll("[data-qform] .c-q-o input")[+k - 1] : null;
      if (b) { own(); b.click(); } else if (r) { own(); r.checked = r.type === "checkbox" ? !r.checked : true; r.focus(); } else return false;
    }
    else if (/^[1-9]$/.test(k) && Array.isArray(n.ask.options) && !Kit.isBinary(n.ask)) {
      const o = n.ask.options[+k - 1];
      if (o != null) { own(); card.querySelector(`[data-opt="${+k - 1}"]`)?.click(); }
    } else return false;
    return true;
  }
  api.cardKeys = cardKeys;

  panel.addEventListener("keydown", (e) => {
    if (!F.open) return;
    const card = $("#card");
    if (e.key === "Escape") {
      const cf = stage.querySelector(".confirm");
      if (cf) { e.preventDefault(); e.stopPropagation(); cf.remove(); card?.focus(); return; }
      if (cardKeys(e, card, {})) return;
      e.preventDefault(); e.stopPropagation(); close(); return;
    }
    if (e.target.matches?.("textarea, input") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (F.done || F.busy || F.vig || stage.querySelector(".confirm")) return;
    const n = F.items.get(F.cur);
    if (!card || !n) return;
    const k = e.key;
    const own = () => { e.preventDefault(); e.stopPropagation(); };
    if (card._quiet && k.length === 1) { own(); return; }
    if (K.is(e, "allowAll")) { own(); confirmAll(); return; }
    if (K.is(e, "later") && n.effort === "think") { own(); setLater(); return; }
    if (K.is(e, "next") || k === "ArrowRight") { own(); skip(1); return; }
    if (K.is(e, "prev") || k === "ArrowLeft") { own(); skip(-1); return; }
    cardKeys(e, card, { inPanel: true });
  });

  return api;
}

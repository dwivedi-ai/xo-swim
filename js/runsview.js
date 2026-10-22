// Sub-agents (ch 14 §11): what a thread's agent handed off, shown the way Claude Code shows it. While a
// sub-agent works it is listed; opened, it reads like a thread of its own, built from its transcript;
// when it finishes it leaves a log row. Messaging a sub-agent isn't offered (no route, §0.82).
// Pure HTML builders: the data comes from storm (runs, ancestry, transcript items).

import { esc } from "./world.js";
import { ICON } from "./ui.js";
import { renderMarkdown, renderInline } from "./markdown.js";

const LIVE = new Set(["running", "waiting"]);
const STATE_WORD = { running: "Working", waiting: "Waiting on you", finished: "Done", failed: "Failed", stopped: "Stopped", lost: "Lost" };
const KIND_WORD = { subagent: "Sub-agent", worker: "Worker", teammate: "Teammate", workflow_agent: "Workflow agent", remote_agent: "Remote agent", background_command: "Background command", monitor: "Monitor", review: "Review", internal: "Internal", other: "Other" };
const num = (n) => (n == null ? "" : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
const dur = (a, b) => {
  const ms = (Date.parse(b || "") || Date.now()) - (Date.parse(a || "") || Date.now());
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const t = Math.round(ms / 1000);
  return t < 60 ? `${t}s` : t < 3600 ? `${Math.floor(t / 60)}m ${t % 60}s` : `${Math.floor(t / 3600)}h ${Math.floor((t % 3600) / 60)}m`;
};
const glyph = (st) => (st === "running" ? "working" : st === "waiting" ? "needs_reply" : st === "finished" ? "done" : st === "failed" || st === "lost" ? "failed" : "resolved");

/** The thread's own line about its sub-agents: the ones working now, else the log count. */
export function runsStripHtml(live, total) {
  if (live.length) {
    return `<div class="rn-strip" role="list" aria-label="Sub-agents working now">${live.map((r) =>
      `<button type="button" class="rn-chip st-${esc(r.state)}" role="listitem" data-run="${esc(r.id)}" title="Open: ${esc(r.title)}"><i class="g g-${glyph(r.state)}" aria-hidden="true"></i><span>${esc(r.title)}</span>${r.state === "waiting" ? `<em>waiting on you</em>` : ""}</button>`).join("")}</div>`;
  }
  return total ? `<button type="button" class="rn-log" data-runs title="What its sub-agents did">${ICON.list}<span>${total} sub-agent${total === 1 ? "" : "s"} ran</span></button>` : "";
}

/** One row of the list (recursive for children). */
function rowHtml(r, { canStop, depth = 0 }) {
  const meta = [KIND_WORD[r.kind] || "", r.tool_calls ? `${r.tool_calls} step${r.tool_calls === 1 ? "" : "s"}` : "", r.tokens ? `${num(r.tokens)} tokens` : "", dur(r.started_at, LIVE.has(r.state) ? null : r.ended_at)].filter(Boolean).join(" · ");
  const stop = canStop && LIVE.has(r.state) && r.can_stop !== false
    ? `<button type="button" class="rn-stop" data-run-stop="${esc(r.id)}" title="Stop this sub-agent (Undo for 3 s)">${ICON.stop}<span>Stop</span></button>` : "";
  return `<li class="rn-row st-${esc(r.state)}${depth ? " is-child" : ""}" style="--d:${depth}">` +
    `<button type="button" class="rn-open" data-run="${esc(r.id)}"><i class="g g-${glyph(r.state)}" aria-hidden="true"></i>` +
    `<span class="rn-main"><span class="rn-t">${esc(r.title)}</span><span class="rn-m">${esc(STATE_WORD[r.state] || r.state)}${meta ? ` · ${esc(meta)}` : ""}</span>` +
    (r.summary && !LIVE.has(r.state) ? `<span class="rn-s">${esc(r.summary)}</span>` : "") + `</span>${ICON.right}</button>${stop}</li>` +
    (r.children || []).map((c) => rowHtml(c, { canStop, depth: depth + 1 })).join("");
}

/** The list: working now first, then the log. */
export function runsListHtml(tree, counts, { canStop, title }) {
  const live = tree.filter((r) => LIVE.has(r.state));
  const done = tree.filter((r) => !LIVE.has(r.state));
  const c = counts || {};
  const sum = [c.running && `${c.running} working`, c.waiting && `${c.waiting} waiting on you`, c.done && `${c.done} done`, c.failed && `${c.failed} failed`, c.stopped && `${c.stopped} stopped`].filter(Boolean).join(" · ");
  return `<header class="rn-h"><div><h2 id="runs-h">Sub-agents</h2><p>${esc(title)}${sum ? ` · ${esc(sum)}` : ""}</p></div>` +
    (canStop && live.length > 1 ? `<button type="button" class="rn-stopall" data-runs-stop title="Stop every sub-agent; the thread's own agent keeps working">Stop all ${live.length}</button>` : "") +
    `<button type="button" class="x" data-close aria-label="Close"></button></header>` +
    `<div class="rn-body">` +
    (live.length ? `<h3 class="rn-k">Working now</h3><ul class="rn-list">${live.map((r) => rowHtml(r, { canStop })).join("")}</ul>` : "") +
    (done.length ? `<h3 class="rn-k">${live.length ? "Earlier" : "What they did"}</h3><ul class="rn-list">${done.map((r) => rowHtml(r, { canStop })).join("")}</ul>` : "") +
    (!tree.length ? `<p class="rn-none">No sub-agents yet.</p>` : "") + `</div>`;
}

/** Workspace › Project › Thread › Sub-agent, from the run's ancestry. */
export function pathHtml(anc, run) {
  const parts = [];
  if (anc && anc.chat) parts.push(anc.chat.kind === "workspace" ? "Workspace" : anc.chat.name || anc.chat.project_pid || "Project");
  if (anc && anc.thread) parts.push(anc.thread.title || "Thread");
  for (const r of (anc && anc.runs) || []) if (r.id !== run.id) parts.push(r.title || "Sub-agent");
  return `<p class="rn-path">${parts.map((p) => `<span>${esc(p)}</span>`).join(`<i aria-hidden="true">›</i>`)}${parts.length ? `<i aria-hidden="true">›</i>` : ""}<b>${esc(run.title || "Sub-agent")}</b></p>`;
}

/** A run's transcript as a conversation (input, text, thinking, tool calls with their results, errors). */
export function transcriptHtml(items, { open = {} } = {}) {
  const results = new Map(items.filter((i) => i.type === "tool_result").map((i) => [i.call_id, i]));
  const out = [];
  for (const it of items) {
    if (it.type === "input") out.push(`<div class="rt-in"><span class="rt-k">Its task</span><div class="prose">${renderMarkdown(it.text || "")}</div></div>`);
    else if (it.type === "text") out.push(`<div class="prose rt-text">${renderMarkdown(it.text || "")}</div>`);
    else if (it.type === "thinking") {
      const key = `rt:${it.id}`;
      const steps = it.steps && it.steps.length ? it.steps : it.text ? [it.text] : [];
      out.push(`<div class="tb tb-think"><button type="button" class="tb-h" data-tb="${esc(key)}" aria-expanded="${!!open[key]}"${steps.length ? "" : " disabled"}><span class="tb-hi">${ICON.clock}</span><span class="tb-ht">${it.duration_ms ? `Thought for ${Math.max(1, Math.round(it.duration_ms / 1000))}s` : "Thought"}</span>${steps.length ? `<span class="tb-chev">${ICON.chevron}</span>` : ""}</button>` +
        (open[key] && steps.length ? `<ol class="tb-steps">${steps.map((s) => `<li>${renderInline(s, true)}</li>`).join("")}</ol>` : "") + `</div>`);
    } else if (it.type === "tool_call") {
      const res = results.get(it.call_id);
      const key = `rt:${it.id}`;
      const st = res ? res.status || "ok" : "running";
      const mark = st === "running" ? `<i class="spin tb-spin" aria-hidden="true"></i>` : st === "error" ? `<span class="tb-m is-err">${ICON.close}</span>` : st === "denied" ? `<span class="tb-m is-den">${ICON.lock}</span>` : `<span class="tb-m is-ok">${ICON.check}</span>`;
      const plan = it.plan && it.plan.length ? `<ol class="tb-plan-l">${it.plan.map((p) => `<li class="ck ck-${esc(p.state)}"><span class="ck-m" aria-hidden="true">${p.state === "done" ? "✓" : p.state === "doing" ? "✱" : "○"}</span><span>${renderInline(p.text || "", true)}</span></li>`).join("")}</ol>` : "";
      const body = res && res.text ? `<pre class="tb-out">${esc(res.text)}${res.truncated ? `\n… ${res.bytes ? `${num(res.bytes)} bytes in all` : "cut"}` : ""}</pre>` : "";
      const label = it.title || [it.tool, it.target].filter(Boolean).join(" ");
      out.push(`<div class="rt-call s-${esc(st)}"><button type="button" class="tb-rh is-btn" data-tb="${esc(key)}" aria-expanded="${!!open[key]}"><span class="tb-ri">${ICON.list}</span><span class="tb-rl">${renderInline(label || "A step", true)}</span>${mark}</button>${open[key] ? `<div class="tb-rb">${it.target && it.target !== label ? `<code class="tb-cmd">${esc(it.target)}</code>` : ""}${plan}${body}</div>` : ""}</div>`);
    } else if (it.type === "error") out.push(`<p class="tb-end is-err">${ICON.close}<span>${esc(it.text || "An error")}</span></p>`);
    else if (it.type === "other" && it.text) out.push(`<p class="tb-end">${esc(it.text)}</p>`);
  }
  return out.join("");
}

/** The whole run view: path, state, Stop, its transcript, its own sub-agents. */
export function runViewHtml(run, { anc, items, children = [], canStop, gone = null, error = null, loading = false, open = {} }) {
  const live = LIVE.has(run.state);
  const head = `<header class="rn-h is-run"><button type="button" class="rn-back" data-runs-back title="Back to the list">${ICON.back}<span>Sub-agents</span></button>` +
    `<button type="button" class="x" data-close aria-label="Close"></button></header>` +
    `<div class="rn-top">${pathHtml(anc, run)}<div class="rn-st"><span class="badge st-${esc(glyph(run.state))}"><i class="g g-${glyph(run.state)}" aria-hidden="true"></i>${esc(STATE_WORD[run.state] || run.state)}</span>` +
    (canStop && live && run.can_stop !== false ? `<button type="button" class="rn-stop" data-run-stop="${esc(run.id)}">${ICON.stop}<span>Stop</span></button>` : "") + `</div></div>`;
  let body;
  if (gone) body = `<p class="rn-none">Its transcript is gone. ${esc(gone)}</p>`;
  else if (error) body = `<p class="rn-none">Couldn't read its work: ${esc(error)}</p>`;
  else if (loading && !items.length) body = `<p class="rn-none"><i class="spin" aria-hidden="true"></i> Reading its work…</p>`;
  else body = transcriptHtml(items, { open }) || `<p class="rn-none">Nothing recorded yet.</p>`;
  const kids = children.length ? `<h3 class="rn-k">Its sub-agents</h3><ul class="rn-list">${children.map((c) => rowHtml(c, { canStop })).join("")}</ul>` : "";
  const summary = run.summary && !live ? `<p class="rn-sum">${esc(run.summary)}</p>` : "";
  return `${head}<div class="rn-body rn-run">${summary}${body}${kids}<p class="rn-foot">Messaging a sub-agent isn't possible; talk to its thread instead.</p></div>`;
}

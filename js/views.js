// HTML builders. Every function returns a string in which all data has been
// escaped (esc) or rendered by the safe markdown renderer. No DOM access, so
// they can be exercised from Node.

import { renderMarkdown } from "./markdown.js";
import {
  STATE_LABEL, authorLabel, chatNameForId, groupThreads, parseChecklist, suggestions, threadState,
} from "./model.js";
import { WORKSPACE, chatLabel, clockTime, dayLabel, esc, fullTime, plural, relTime } from "./util.js";

// ── icons (inline SVG, currentColor) ────────────────────────────────────────

const I = (d, extra = "") =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;

export const ICON = {
  hash: I('<path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18"/>'),
  /** A project: a box with its own contents (distinct from the workspace globe). */
  project: I('<path d="M20.5 7.6 12 3 3.5 7.6v8.8L12 21l8.5-4.6z"/><path d="M3.5 7.6 12 12.2l8.5-4.6M12 12.2V21"/>'),
  globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  send: I('<path d="M12 19V5M5 12l7-7 7 7"/>', ' stroke-width="2.2"'),
  thread: I('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
  branch: I('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 5-6 4-12 8"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  back: I('<path d="M15 18l-6-6 6-6"/>'),
  arrow: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  down: I('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  copy: I('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
  forward: I('<path d="M15 5l6 6-6 6"/><path d="M21 11H9a6 6 0 0 0-6 6v2"/>'),
  route: I('<path d="M3 12h14M12 6l6 6-6 6"/><path d="M21 5v14"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: I('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  sidebar: I('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16"/>'),
  panel: I('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M15 4v16"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  sparkle: I('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
  alert: I('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>', ' stroke-width="2.2"'),
  retry: I('<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>'),
  edit: I('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
  chevron: I('<path d="M6 9l6 6 6-6"/>'),
  hand: I('<path d="M12 8v4l2.5 2.5"/><circle cx="12" cy="12" r="9"/>'),
  home: I('<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>', ' stroke-width="1.9"'),
  folder: I('<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5V17A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z"/>'),
  up: I('<path d="M12 19V5M6 11l6-6 6 6"/>'),
};

/** The XO mark from Space's top bar, recoloured through CSS. */
export const XO_MARK =
  '<svg class="xo-mark" viewBox="20 155 460 190" aria-hidden="true">' +
  '<polyline class="x" stroke-width="30" fill="none" stroke-miterlimit="10" points="36.99 165.84 118.47 247.31 31.16 334.61"/>' +
  '<polyline class="x" stroke-width="30" fill="none" stroke-miterlimit="10" points="244.91 165.84 163.44 247.31 250.74 334.61"/>' +
  '<polyline class="o" stroke-width="30" fill="none" stroke-miterlimit="10" points="328.12 165.06 246.65 246.53 333.95 333.84"/>' +
  '<polyline class="o" stroke-width="30" fill="none" stroke-miterlimit="10" points="380.51 165.06 461.99 246.53 374.68 333.84"/></svg>';

// ── state glyphs: shape + colour, readable without colour (from the chip) ──

/** What waits on a person is loud (diamond); what waits on the agent is quiet. */
const GLYPH = {
  working: "info", needs_reply: "review", needs_approval: "review",
  done: "ok", failed: "error", resolved: "none",
};
export function glyph(state, extra = "") {
  return `<i class="sv sv-${GLYPH[state] || "info"}${extra}" aria-hidden="true"></i>`;
}

// ── left dock: chats ──────────────────────────────────────────────────────

export function chatListHtml(chats, active, filter = "") {
  const q = filter.trim().toLowerCase();
  const match = (c) => !q || chatLabel(c.chat).toLowerCase().includes(q);
  const ws = (chats || []).filter((c) => c.kind === "workspace" && match(c));
  const projects = (chats || []).filter((c) => c.kind !== "workspace" && match(c));
  const item = (c) => {
    const on = c.chat === active;
    const count = c.open_threads
      ? `<span class="n" title="${esc(plural(c.open_threads, "open thread"))}">${c.open_threads}</span>`
      : "";
    return (
      `<button type="button" class="chan${on ? " is-on" : ""}" data-chat="${esc(c.chat)}"` +
      `${on ? ' aria-current="page"' : ""}>` +
      `<span class="chan-ic">${c.kind === "workspace" ? ICON.globe : ICON.project}</span>` +
      `<span class="chan-name">${esc(chatLabel(c.chat))}</span>${count}</button>`
    );
  };
  let html = ws.map(item).join("");
  if (projects.length) html += `<div class="side-label">Projects<small>${projects.length}</small></div>` + projects.map(item).join("");
  if (!ws.length && !projects.length) html = `<div class="side-empty">No chat matches “${esc(filter)}”.</div>`;
  return html;
}

// ── status bar ─────────────────────────────────────────────────────────────

/**
 * The connection in one word. Quiet when healthy; colour and words only when
 * something needs attention (the work is the hero).
 */
export function statusSummary(status, error, live) {
  if (error) return { tone: "err", label: "Offline", detail: "Can't reach the XO API. Retrying." };
  if (!status) return { tone: "idle", label: "Connecting", detail: "Connecting to the XO API…" };
  if (!status.supported) return { tone: "warn", label: "Unsupported", detail: `The ${status.agent} backend has no projects chat.` };
  if (!status.enabled) return { tone: "warn", label: "Router off", detail: "The router is off, so messages can't be sent." };
  if (live === "reconnecting") return { tone: "warn", label: "Reconnecting", detail: "The live stream dropped. Reconnecting…" };
  if (live === "polling") return { tone: "warn", label: "Polling", detail: "The live stream is unavailable. Checking every 4 s." };
  return { tone: "ok", label: "Live", detail: "Replies stream in as they are written." };
}

const TONE_GLYPH = { ok: "ok", warn: "warn", err: "error", idle: "none" };

/** One quiet status pill; details in a popover. */
export function statusHtml(status, error, live, open = false) {
  const s = statusSummary(status, error, live);
  const row = (k, v) => `<div class="spop-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
  let rows = "";
  if (status && !error) {
    rows =
      row("Router", status.enabled ? "On" : "Off") +
      row("Agent", status.agent) +
      row("Workspace mode", status.modes?.workspace ?? "?") +
      row("Project mode", status.modes?.project ?? "?") +
      row("Decision model", status.decision_model ?? "—");
  } else if (error) rows = `<p class="spop-err">${esc(error)}</p>`;
  return (
    `<button type="button" class="spill is-${s.tone}" id="status-btn" aria-expanded="${open}" aria-controls="status-pop" ` +
    `title="${esc(s.detail)}"><i class="dot"></i><span class="spill-label">${esc(s.label)}</span>${ICON.chevron}</button>` +
    `<div class="spop" id="status-pop" role="dialog" aria-label="Connection details"${open ? "" : " hidden"}>` +
    `<p class="spop-lead is-${s.tone}"><i class="sv sv-${TONE_GLYPH[s.tone]}" aria-hidden="true"></i>${esc(s.detail)}</p>${rows}</div>`
  );
}

// ── messages ───────────────────────────────────────────────────────────────

/**
 * One message row.
 * ctx: {chat, chats, threadsByTs, routed (workspace index), inThread, highlight}
 */
export function messageHtml(msg, ctx = {}) {
  const who = authorLabel(msg, ctx.chat);
  const time = `<time datetime="${esc(msg.written_at)}" title="${esc(fullTime(msg.written_at))}">${esc(clockTime(msg.written_at))}</time>`;
  const hl = ctx.highlight === msg.id ? " is-hl" : "";
  const idAttr = `data-mid="${esc(msg.id)}" id="m-${esc(msg.id)}"`;

  if (msg.author_kind === "system") {
    return `<div class="msg msg-system${hl}" ${idAttr}><div class="sys">${renderMarkdown(msg.text)}</div>${time}</div>`;
  }

  let notes = "";
  const f = msg.forwarded_from;
  if (f) {
    const from = chatNameForId(ctx.chats, f.chat_id);
    notes += `<button type="button" class="fwd" data-goto-chat="${esc(from || "")}" data-goto-msg="${esc(f.message_id || "")}" title="Open the original message">${ICON.forward}Forwarded from ${esc(chatLabel(from) || f.chat_id)}</button>`;
  }

  if (msg.author_kind === "owner") {
    let after = "";
    const thread = !ctx.inThread && ctx.threadsByTs ? ctx.threadsByTs[msg.id] : null;
    if (thread) after += threadChipHtml(thread);
    const routes = ctx.routed && ctx.routed[msg.id];
    if (routes && routes.length) {
      after +=
        `<div class="routed"><span>${ICON.route}Routed to</span>` +
        routes
          .map((r) => `<button type="button" class="route" data-goto-chat="${esc(r.chat)}" data-goto-msg="${esc(r.messageId)}">${ICON.project}${esc(r.chat)}</button>`)
          .join("") +
        `</div>`;
    }
    let meta = `${time}${copyBtn()}`;
    let state = "";
    if (msg._pending) {
      state = " is-pending";
      meta = `<span class="sending"><i class="spin"></i>Sending</span>`;
    } else if (msg._failed) {
      state = " is-failed";
      meta =
        `<span class="not-sent"><i class="sv sv-error" aria-hidden="true"></i>Not sent</span>` +
        `<button type="button" class="meta-btn" data-retry="${esc(msg.id)}">${ICON.retry}Retry</button>` +
        `<button type="button" class="meta-btn" data-edit="${esc(msg.id)}">${ICON.edit}Edit</button>`;
    }
    return (
      `<div class="msg msg-owner${hl}${state}" ${idAttr}>` +
      (notes ? `<div class="msg-notes">${notes}</div>` : "") +
      `<div class="bubble">${esc(msg.text)}</div>` +
      `<div class="msg-meta">${meta}</div>` +
      after +
      `</div>`
    );
  }

  const avatarCls = msg.author_id === "thread" ? "av av-thread" : "av";
  return (
    `<div class="msg msg-agent${hl}" ${idAttr}>` +
    `<div class="${avatarCls}" aria-hidden="true">${msg.author_id === "thread" ? ICON.thread : XO_MARK}</div>` +
    `<div class="msg-body"><div class="msg-head"><span class="who">${esc(who)}</span>${time}${copyBtn()}</div>` +
    (notes ? `<div class="msg-notes">${notes}</div>` : "") +
    `<div class="prose">${renderMarkdown(msg.text)}</div></div></div>`
  );
}

function copyBtn() {
  return `<button type="button" class="icon-btn copy-btn" data-copy-msg title="Copy message" aria-label="Copy message">${ICON.copy}${ICON.check}</button>`;
}

export function threadChipHtml(thread) {
  const s = threadState(thread);
  return (
    `<button type="button" class="tchip st-${esc(s)}" data-thread="${esc(thread.ts)}">` +
    `${ICON.thread}<span class="tchip-label">Thread</span><span class="tchip-title">${esc(thread.title)}</span>` +
    `<span class="tchip-state">${glyph(s)}${esc(STATE_LABEL[s] || s)}</span>${ICON.arrow}</button>`
  );
}

/** A timeline: messages with day separators. `lastDay` lets callers append. */
export function timelineHtml(messages, ctx, lastDay = "") {
  let html = "";
  for (const m of messages) {
    const day = dayLabel(m.written_at);
    if (day && day !== lastDay) {
      html += `<div class="day"><span>${esc(day)}</span></div>`;
      lastDay = day;
    }
    html += messageHtml(m, ctx);
  }
  return html;
}

/** Empty chat: an invitation; the person's move first. Nothing sends by itself. */
export function emptyStateHtml(chat) {
  const isWs = chat === WORKSPACE;
  const blurb = isWs
    ? "Ask across all your projects. The workspace coordinator splits a request and routes each part to the right project."
    : `Ask the ${esc(chat)} coordinator anything. It answers directly, or starts a thread with its own agent and branch for real work.`;
  return (
    `<div class="empty"><div class="empty-mark">${XO_MARK}</div>` +
    `<h1>${isWs ? "Workspace" : esc(chat)}</h1><p>${blurb}</p>` +
    `<div class="sugg" aria-label="Starting points">${suggestions(chat)
      .map((s, i) => `<button type="button" class="sugg-btn" style="--i:${i}" data-suggest="${esc(s)}" title="Put this in the composer"><span>${esc(s)}</span>${ICON.arrow}</button>`)
      .join("")}</div>` +
    `<p class="empty-foot">Picking one fills the composer. Nothing is sent until you press Enter.</p></div>`
  );
}

/**
 * The fresh start shown when a chat with history is (re)opened: a calm page,
 * history one scroll above. ChatGPT / Claude-style: the past is there when you
 * want it, not in your face.
 */
export function freshHtml(chat, earlier, lastAt) {
  const isWs = chat === WORKSPACE;
  return (
    `<div class="fresh-inner">` +
    `<button type="button" class="fresh-up" data-scroll-earlier>${ICON.up}<span>${earlier != null ? esc(plural(earlier, "earlier message")) : "Earlier messages"}` +
    (lastAt ? ` · last ${esc(relTime(lastAt))}` : "") + `</span></button>` +
    `<div class="fresh-main"><div class="empty-mark">${XO_MARK}</div>` +
    `<h2>${isWs ? "Workspace" : esc(chat)}</h2>` +
    `<p>${isWs ? "Pick up where you left off, or ask something new across your projects." : `Pick up where you left off with the ${esc(chat)} coordinator, or start something new.`}</p>` +
    `<div class="fresh-sugg">${suggestions(chat).slice(0, 3)
      .map((s, i) => `<button type="button" class="chip-btn" style="--i:${i}" data-suggest="${esc(s)}">${esc(s)}</button>`)
      .join("")}</div></div></div>`
  );
}

/**
 * The working indicator. Honest about time: shows how long it has been, and
 * after a while says it is fine to look away (replies arrive live).
 */
export function typingHtml(label, since = null, now = Date.now()) {
  const secs = since ? Math.max(0, Math.floor((now - since) / 1000)) : null;
  const long = secs != null && secs >= 15;
  return (
    `<div class="typing${long ? " is-long" : ""}" role="status"><div class="av av-working" aria-hidden="true">${XO_MARK}</div>` +
    `<div class="typing-body"><div class="typing-line"><span class="shimmer">${esc(label)}</span>` +
    `<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>` +
    (secs != null ? `<span class="elapsed"${secs < 1 ? " hidden" : ""}>${esc(elapsed(secs))}</span>` : "") +
    `</div>` +
    (long ? `<div class="typing-hint">You can keep working. The reply will appear here when it's ready.</div>` : "") +
    `</div></div>`
  );
}

export function elapsed(secs) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  return `${m}m ${String(secs % 60).padStart(2, "0")}s`;
}

/** "Waiting on you" strip above the composer: the way back in. */
export function waitingStripHtml(threads) {
  const waiting = (threads || [])
    .filter((t) => ["needs_reply", "needs_approval"].includes(threadState(t)))
    .sort((a, b) => String(b.last_activity_at || "").localeCompare(String(a.last_activity_at || "")));
  if (!waiting.length) return "";
  const first = waiting[0];
  const more = waiting.length - 1;
  return (
    `<button type="button" class="wstrip" data-thread="${esc(first.ts)}">` +
    `${glyph(threadState(first))}<span class="wstrip-k">${esc(STATE_LABEL[threadState(first)])}</span>` +
    `<span class="wstrip-t">${esc(first.title)}</span>` +
    (more ? `<span class="wstrip-more">+${more} more</span>` : "") +
    `<span class="wstrip-go">Open${ICON.arrow}</span></button>` +
    `<button type="button" class="icon-btn wstrip-x" data-dismiss-stand title="Hide until something changes" aria-label="Hide">${ICON.close}</button>`
  );
}

// ── right dock: threads ────────────────────────────────────────────────────

export function progressHtml(check) {
  if (!check || !check.total) return "";
  const pct = Math.round((check.done / check.total) * 100);
  return (
    `<div class="prog" title="${check.done} of ${check.total} done"><div class="prog-bar"><i style="width:${pct}%"></i></div>` +
    `<span>${check.done}/${check.total}</span></div>`
  );
}

export function threadCardHtml(thread, statusText, activeTs, { chat = null, i = 0 } = {}) {
  const s = threadState(thread);
  const card = thread.card || {};
  const check = statusText != null ? parseChecklist(statusText) : null;
  const sub = card.needs_you || card.happened || "";
  const prog = progressHtml(check);
  return (
    `<button type="button" class="tcard st-${esc(s)}${activeTs === thread.ts ? " is-on" : ""}" style="--i:${i}" data-thread="${esc(thread.ts)}">` +
    `<span class="tcard-top"><span class="badge st-${esc(s)}">${glyph(s)}${esc(STATE_LABEL[s] || s)}</span>` +
    (chat ? `<span class="tcard-chat">${chat === WORKSPACE ? ICON.globe : ICON.project}${esc(chatLabel(chat))}</span>` : "") +
    `<time title="${esc(fullTime(thread.last_activity_at))}">${esc(relTime(thread.last_activity_at))}</time></span>` +
    `<span class="tcard-title">${esc(thread.title)}</span>` +
    (card.headline && card.headline !== thread.title ? `<span class="tcard-head">${esc(card.headline)}</span>` : "") +
    (sub ? `<span class="tcard-sub${card.needs_you ? " is-needs" : ""}">${card.needs_you ? "<b>Needs you · </b>" : ""}${esc(sub)}</span>` : "") +
    (prog || thread.branch
      ? `<span class="tcard-foot">${thread.branch ? `<span class="branch">${ICON.branch}${esc(thread.branch)}</span>` : ""}${prog}</span>`
      : "") +
    `</button>`
  );
}

export function threadListHtml(threads, statuses = {}, activeTs = null) {
  const groups = groupThreads(threads);
  if (!groups.length) {
    return (
      `<div class="panel-empty">${ICON.thread}<p>No threads yet.</p>` +
      `<small>When the coordinator takes on real work it starts a thread here, with its own agent, branch and checklist.</small></div>`
    );
  }
  let i = 0;
  return groups
    .map(
      (g) =>
        `<section class="tgroup g-${g.key}"><h3>${esc(g.label)}<small>${g.threads.length}</small></h3>` +
        g.threads.map((t) => threadCardHtml(t, statuses[t.ts], activeTs, { i: i++ })).join("") +
        `</section>`,
    )
    .join("");
}

export function checklistHtml(statusText) {
  const check = parseChecklist(statusText);
  if (!check.items.length) return "";
  const mark = { done: "ok", doing: "info", todo: "none" };
  const label = { done: "done", doing: "in progress", todo: "to do" };
  return (
    `<div class="check"><div class="check-head"><span>Checklist</span>${progressHtml(check)}</div><ul>` +
    check.items
      .map((it) =>
        it.state === "note"
          ? `<li class="ck-note">${renderMarkdown(it.text).replace(/^<p>|<\/p>$/g, "")}</li>`
          : `<li class="ck-${it.state}"><span class="ck-mark" role="img" aria-label="${label[it.state]}"><i class="sv sv-${mark[it.state]}${it.state === "doing" ? " is-busy" : ""}"></i></span>` +
            `<span class="ck-text">${renderMarkdown(it.text).replace(/^<p>|<\/p>$/g, "")}</span></li>`,
      )
      .join("") +
    `</ul></div>`
  );
}

/** Header + summary part of the thread view (messages are rendered separately). */
export function threadDetailHeadHtml(detail) {
  const t = detail.thread || {};
  const card = detail.card || t.card || null;
  const s = threadState({ ...t, card });
  const sess = detail.session || {};
  const facts = [];
  if (t.branch) facts.push(`<span class="branch" title="${esc(t.worktree_path || "")}">${ICON.branch}${esc(t.branch)}</span>`);
  if (sess.turns != null) facts.push(`<span class="fact">${esc(plural(sess.turns, "turn"))}</span>`);
  if (sess.status) facts.push(`<span class="fact">session ${esc(sess.status)}</span>`);
  facts.push(`<span class="fact" title="${esc(fullTime(t.created_at))}">started ${esc(relTime(t.created_at))}</span>`);
  let html =
    `<div class="td-title"><span class="badge st-${esc(s)}">${glyph(s)}${esc(STATE_LABEL[s] || s)}</span>` +
    `<h2>${esc(t.title || "Thread")}</h2><div class="facts">${facts.join("")}</div></div>`;
  if (sess.last_error) {
    html += `<div class="callout is-err">${ICON.alert}<div><b>Last error</b><p>${esc(sess.last_error)}</p></div></div>`;
  }
  if (card && card.needs_you) {
    html += `<div class="callout is-needs">${ICON.alert}<div><b>Needs you</b><div class="prose">${renderMarkdown(card.needs_you)}</div></div></div>`;
  }
  if (card && card.happened) {
    html += `<div class="summary"><div class="summary-label">Latest update${card.updated_at ? ` · <time title="${esc(fullTime(card.updated_at))}">${esc(relTime(card.updated_at))}</time>` : ""}</div><div class="prose">${renderMarkdown(card.happened)}</div></div>`;
  }
  html += checklistHtml(detail.status);
  return html;
}

// ── home: what needs me, what is working, what is ready ──────────────────

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/**
 * The home page. `items` is [{chat, thread, status}] across every chat.
 * Order follows the research: what waits on a person first and loud; what
 * waits on an agent after and quiet; nothing gamified.
 */
export function homeHtml({ chats = [], items = [], loading = false, now = Date.now() } = {}) {
  const st = (it) => threadState(it.thread);
  const recent = (a, b) => String(b.thread.last_activity_at || "").localeCompare(String(a.thread.last_activity_at || ""));
  const needs = items.filter((it) => ["needs_reply", "needs_approval"].includes(st(it))).sort(recent);
  const failed = items.filter((it) => st(it) === "failed").sort(recent);
  const working = items.filter((it) => st(it) === "working").sort(recent);
  const ready = items.filter((it) => st(it) === "done").sort(recent);
  let i = 0;
  const cards = (list) => list.map((it) => threadCardHtml(it.thread, it.status, null, { chat: it.chat, i: i++ })).join("");
  const section = (key, title, hint, list, empty) =>
    `<section class="hsec h-${key}"><header><h2>${esc(title)}${list.length ? `<small>${list.length}</small>` : ""}</h2>` +
    (hint ? `<p>${esc(hint)}</p>` : "") + `</header>` +
    (list.length ? `<div class="hgrid">${cards(list)}</div>` : `<div class="hempty">${esc(empty)}</div>`) + `</section>`;

  const parts = [];
  if (needs.length) parts.push(`${needs.length} need${needs.length === 1 ? "s" : ""} you`);
  if (working.length) parts.push(`${working.length} working`);
  if (ready.length) parts.push(`${ready.length} ready for review`);
  const summary = loading && !items.length ? "Checking your projects…" : parts.length ? parts.join(" · ") : "Nothing is waiting on you.";

  const projects = chats.filter((c) => c.kind !== "workspace");
  const projectCard = (c) => {
    const mine = items.filter((it) => it.chat === c.chat && st(it) !== "resolved");
    const wait = mine.filter((it) => ["needs_reply", "needs_approval"].includes(st(it))).length;
    const last = mine.map((it) => it.thread.last_activity_at).sort().pop();
    return (
      `<button type="button" class="pcard" style="--i:${i++}" data-chat="${esc(c.chat)}">` +
      `<span class="pcard-ic">${ICON.project}</span><span class="pcard-name">${esc(c.chat)}</span>` +
      `<span class="pcard-meta">${wait ? `<span class="pcard-wait">${glyph("needs_reply")}${wait} waiting</span>` : ""}` +
      `<span>${mine.length ? esc(plural(mine.length, "open thread")) : "No open threads"}</span>` +
      (last ? `<span>· ${esc(relTime(last, now))}</span>` : "") + `</span></button>`
    );
  };

  return (
    `<div class="home-head"><div class="home-kicker">${esc(new Date(now).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }))}</div>` +
    `<h1>${esc(greeting(new Date(now)))}</h1><p class="home-sum">${esc(summary)}</p></div>` +
    section("needs", "Needs you", "Questions and approvals from your agents. Nothing moves until you answer.", needs, "You're all caught up.") +
    (failed.length ? section("failed", "Failed", "These stopped with an error.", failed, "") : "") +
    section("working", "Working", "Agents are on these now. You don't need to watch; they'll ask if they need you.", working, "No agent is working right now.") +
    section("ready", "Ready for review", "Finished work waiting for your look.", ready, "Nothing to review.") +
    `<section class="hsec h-projects"><header><h2>Projects<small>${projects.length}</small></h2></header>` +
    `<div class="pgrid"><button type="button" class="pcard pcard-ws" style="--i:${i++}" data-chat="${WORKSPACE}"><span class="pcard-ic">${ICON.globe}</span>` +
    `<span class="pcard-name">Workspace</span><span class="pcard-meta"><span>Ask across every project</span></span></button>` +
    projects.map(projectCard).join("") +
    `<button type="button" class="pcard pcard-new" style="--i:${i++}" data-create-project><span class="pcard-ic">${ICON.plus}</span>` +
    `<span class="pcard-name">Create XO Project</span><span class="pcard-meta"><span>A new project with its own coordinator</span></span></button>` +
    `</div></section>`
  );
}

/** Folder name for a new project: lowercase, dashes, safe for a path. */
export function slugify(name) {
  return String(name || "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

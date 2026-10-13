// Data logic for the projects chat: ordering and merging messages, thread
// state and grouping, checklist parsing, suggestions. Pure functions only.

import { WORKSPACE, WORKSPACE_ID, toMs } from "./util.js";

// ── messages ────────────────────────────────────────────────────────────────

function msgKey(m) {
  return `${m.written_at || m.ts || ""}|${m.id || ""}`;
}

/** Merge `incoming` rows into `list` (deduped by id, oldest first). Returns {list, added}. */
export function mergeMessages(list, incoming) {
  const byId = new Map(list.map((m) => [m.id, m]));
  const added = [];
  for (const row of incoming || []) {
    if (!row || !row.id) continue;
    if (!byId.has(row.id)) added.push(row);
    byId.set(row.id, row);
  }
  if (!added.length) return { list, added };
  const merged = [...byId.values()].sort((a, b) => (msgKey(a) < msgKey(b) ? -1 : msgKey(a) > msgKey(b) ? 1 : 0));
  return { list: merged, added };
}

/** Ids of messages that exist only in this tab (optimistic sends). */
export const LOCAL_PREFIX = "local_";
export const isLocal = (m) => String(m?.id || "").startsWith(LOCAL_PREFIX);

/** The largest server message id (ids sort by creation), for `?after=`. */
export function lastId(list) {
  let best = "";
  for (const m of list) if (!isLocal(m) && (m.id || "") > best) best = m.id;
  return best || null;
}

export function authorLabel(msg, chat) {
  if (msg.author_kind === "owner") return "You";
  if (msg.author_kind === "system") return "System";
  if (msg.author_id === "thread") return "Thread agent";
  if (msg.author_id === "coordinator") return chat === WORKSPACE ? "Workspace coordinator" : "Coordinator";
  return String(msg.author_id || "Agent");
}

/** True once an agent/system reply newer than `sinceId` is in `list`. */
export function hasReplyAfter(list, sinceId) {
  if (!sinceId) return false;
  return list.some((m) => m.author_kind !== "owner" && (m.id || "") > sinceId);
}

/** Chat name for a chat id, using the /chats list. */
export function chatNameForId(chats, id) {
  if (id === WORKSPACE_ID) return WORKSPACE;
  const hit = (chats || []).find((c) => c.id === id);
  if (hit) return hit.chat;
  return id && id.startsWith("chat_") ? id.slice(5) : null;
}

/**
 * Where workspace messages went: {workspaceMessageId: [{chat, messageId}]},
 * built from project messages carrying forwarded_from.
 */
export function routedIndex(projectMessages) {
  const index = {};
  for (const [chat, rows] of Object.entries(projectMessages || {})) {
    for (const m of rows || []) {
      const f = m.forwarded_from;
      if (!f || f.chat_id !== WORKSPACE_ID || !f.message_id) continue;
      (index[f.message_id] ||= []).push({ chat, messageId: m.id });
    }
  }
  return index;
}

// ── threads ─────────────────────────────────────────────────────────────────

export const STATE_LABEL = {
  working: "Working",
  needs_reply: "Needs reply",
  needs_approval: "Needs approval",
  done: "Ready for review",
  failed: "Failed",
  resolved: "Resolved",
};

/** The state to show: resolved wins, then an explicit thread state, then the card. */
export function threadState(thread) {
  if (!thread) return "working";
  if (thread.state === "resolved") return "resolved";
  const card = thread.card || null;
  if (thread.state && thread.state !== "working") return thread.state;
  return (card && card.state) || thread.state || "working";
}

export const GROUPS = [
  { key: "waiting", label: "Waiting on you" },
  { key: "working", label: "Working" },
  { key: "done", label: "Ready for review" },
  { key: "failed", label: "Failed" },
  { key: "resolved", label: "Resolved" },
];

export function groupKey(thread) {
  const s = threadState(thread);
  if (s === "resolved") return "resolved";
  if (s === "needs_reply" || s === "needs_approval") return "waiting";
  if (s === "done") return "done";
  if (s === "failed") return "failed";
  return "working";
}

/** Threads in display groups (empty groups dropped), newest activity first. */
export function groupThreads(threads) {
  const sorted = [...(threads || [])].sort(
    (a, b) => (toMs(b.last_activity_at) || 0) - (toMs(a.last_activity_at) || 0),
  );
  return GROUPS.map((g) => ({ ...g, threads: sorted.filter((t) => groupKey(t) === g.key) })).filter(
    (g) => g.threads.length,
  );
}

export function openThreadCount(threads) {
  return (threads || []).filter((t) => t.state !== "resolved").length;
}

// ── checklist (status.md) ───────────────────────────────────────────────────

const MARKS = { "✱": "doing", "○": "todo", "◯": "todo", "✓": "done", "✔": "done" };

/**
 * Parse a thread's status markdown into items.
 * Lines starting with ✱ (in progress), ○ (to do) or ✓ (done), optionally
 * after a "- " bullet, are checklist items; other non-empty lines are notes.
 */
export function parseChecklist(status) {
  const items = [];
  for (const raw of String(status ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim().replace(/^[-+]\s+/, "");
    if (!line) continue;
    const mark = line[0];
    const state = MARKS[mark];
    if (state) items.push({ state, text: line.slice(1).trim() });
    else items.push({ state: "note", text: line.replace(/^#+\s*/, "") });
  }
  const tasks = items.filter((i) => i.state !== "note");
  return {
    items,
    total: tasks.length,
    done: tasks.filter((i) => i.state === "done").length,
    doing: tasks.filter((i) => i.state === "doing").length,
  };
}

// ── suggestions ─────────────────────────────────────────────────────────────

export function suggestions(chat) {
  if (chat === WORKSPACE) {
    return [
      "Which projects do I have, and what is each one for?",
      "What is in progress across my projects right now?",
      "Add a short CONTRIBUTING note to every project.",
    ];
  }
  return [
    `In one paragraph, what is ${chat} and how is it laid out?`,
    "List every rule we have agreed for this project.",
    "What are the open threads here waiting on?",
    `Suggest three small improvements to ${chat}.`,
  ];
}

/** Why the composer is disabled, or "" when it can send. */
export function composerBlock(status, statusError) {
  if (statusError) return "Can't reach the XO API — retrying…";
  if (!status) return "Connecting…";
  if (!status.supported) return `The ${status.agent || "current"} backend has no projects chat.`;
  if (!status.enabled) return "The router is off (XO_ROUTER_MODE=off).";
  return "";
}

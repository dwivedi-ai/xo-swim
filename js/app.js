// XO projects chat UI: state, wiring and rendering into the page.

import { api } from "./api.js";
import { ChatStream } from "./stream.js";
import {
  LOCAL_PREFIX, authorLabel, composerBlock, hasReplyAfter, isLocal, lastId, mergeMessages, openThreadCount,
  routedIndex, threadState,
} from "./model.js";
import {
  ICON, XO_MARK, chatListHtml, elapsed, emptyStateHtml, freshHtml, homeHtml, messageHtml, slugify, statusHtml,
  threadDetailHeadHtml, threadListHtml, timelineHtml, typingHtml, waitingStripHtml,
} from "./views.js";
import { dayLabel } from "./util.js";
import { WORKSPACE, chatLabel, esc } from "./util.js";

const $ = (id) => document.getElementById(id);
const mqPhone = matchMedia("(max-width:760px)");
const mqNarrow = matchMedia("(max-width:1000px)");
const AWAIT_MAX_MS = 180000;
const THREAD_POLL_MS = 4000;
const HISTORY_FIRST = 40;   // first page of history, fetched only when scrolled to
const HISTORY_MAX = 1000;   // the API's limit cap

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const S = {
  status: null,
  statusError: null,
  chats: [],
  chat: null,
  messages: {},          // chat -> rows
  threads: {},           // chat -> {ts: thread}
  statuses: {},          // chat -> {ts: status markdown}
  projectMsgs: {},       // project -> rows (for "routed to" in the workspace)
  busy: false,           // coordinator_busy from heartbeat
  awaiting: {},          // chat -> {id, at}
  stream: null,
  live: null,
  loading: false,
  panelOpen: false,
  detail: null,          // {chat, ts, data, messages, awaiting, timer}
  highlight: null,
  newWhileAway: 0,
  filterIndex: -1,
  standHidden: {},       // chat -> signature of the "where things stand" the person dismissed
  busySince: {},         // chat -> ms when the coordinator was first seen busy
  rendered: { chat: null, ids: [], lastDay: "" }, // what #timeline shows, for append-only updates
  unseen: 0,             // replies that arrived while the tab was hidden
  view: null,            // "home" | "chat"
  statusOpen: false,
  freshFrom: {},         // chat -> last message id when first opened this page session (history is above it)
  latestAt: {},          // chat -> time of that message (for "last 11m ago")
  hist: {},              // chat -> {all, loading, window, capped}: history is loaded on demand
  lastUserScroll: 0,     // the person scrolled (wheel, touch, keys): history loads only on intent
  homeLoading: false,
  homeTimer: null,
  projectsRoot: null,
};

/**
 * Entrance animations play once, when a view opens; after that the view is
 * "settled" and later re-renders (live updates) appear in place, still.
 */
const settleTimers = new WeakMap();
function settle(el) {
  el.classList.remove("is-settled");
  clearTimeout(settleTimers.get(el));
  settleTimers.set(el, setTimeout(() => el.classList.add("is-settled"), 900));
}

/** Replay a short entrance animation on an element (chat switch, home). */
function enter(el) {
  if (reduceMotion()) return;
  el.classList.remove("is-entering");
  void el.offsetWidth;
  el.classList.add("is-entering");
}

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── drafts: typed text is never lost (chat switches, reloads, failed sends) ──

const draftKey = (chat, ts) => `xo-chat-draft:${chat}${ts ? ":" + ts : ""}`;
function saveDraft(chat, ts, text) {
  if (!chat) return;
  try {
    if (text.trim()) localStorage.setItem(draftKey(chat, ts), text);
    else localStorage.removeItem(draftKey(chat, ts));
  } catch { /* private mode */ }
}
function restoreDraft(ta, chat, ts) {
  const text = store.get(draftKey(chat, ts)) || "";
  ta.value = text;
  autogrow(ta);
  return !!text;
}

// ── boot ────────────────────────────────────────────────────────────────

function paintIcons() {
  $("brand-mark").innerHTML = XO_MARK;
  $("sidebar-close").innerHTML = ICON.sidebar;
  $("sidebar-open").innerHTML = ICON.sidebar;
  $("search-ic").innerHTML = ICON.search;
  $("threads-ic").innerHTML = ICON.panel;
  $("panel-close").innerHTML = ICON.close;
  $("detail-close").innerHTML = ICON.close;
  $("detail-back").innerHTML = ICON.back;
  $("jump-ic").innerHTML = ICON.down;
  $("home-ic").innerHTML = ICON.home;
  $("create-ic").innerHTML = ICON.plus;
  $("dlg-ic").innerHTML = ICON.folder;
  for (const id of ["send", "thread-send", "home-send"]) $(id).innerHTML = ICON.send;

  $("kbd-hint").textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";
  paintThemeIcon();
}

function currentTheme() {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function paintThemeIcon() {
  const light = currentTheme() === "light";
  $("theme-toggle").innerHTML = light ? ICON.moon : ICON.sun;
  $("theme-toggle").title = light ? "Switch to dark theme" : "Switch to light theme";
}

async function boot() {
  paintIcons();
  if (mqPhone.matches || store.get("xo-chat-sidebar") === "closed") $("app").classList.add("sb-collapsed");
  wire();
  loadStatus();
  setInterval(loadStatus, 30000);
  await loadChats();
  setInterval(loadChats, 20000);
  setInterval(tickRelative, 30000);
  setInterval(tickWorking, 1000);
  route();
}

// ── status and chats ─────────────────────────────────────────────────

async function loadStatus() {
  try {
    S.status = await api.status();
    S.statusError = null;
  } catch (err) {
    S.statusError = err.message;
    setTimeout(loadStatus, 8000);
  }
  renderStatus();
  renderComposer();
}

function renderStatus() {
  $("status").innerHTML = statusHtml(S.status, S.statusError, S.view === "home" ? (S.status ? "live" : null) : S.live, S.statusOpen);
}

function setStatusOpen(open) {
  if (S.statusOpen === open) return;
  S.statusOpen = open;
  renderStatus();
}

async function loadChats() {
  try {
    const data = await api.chats();
    S.chats = data.chats || [];
  } catch (err) {
    if (!S.chats.length) S.chats = [{ chat: WORKSPACE, id: "chat_workspace", kind: "workspace" }];
  }
  renderChats();
}

function renderChats() {
  // Keep the open chat's count in step with the threads we already hold.
  const list = S.chats.map((c) =>
    c.chat === S.chat && c.kind === "project" && S.threads[c.chat]
      ? { ...c, open_threads: openThreadCount(Object.values(S.threads[c.chat])) }
      : c,
  );
  $("chat-list").innerHTML = chatListHtml(list, S.view === "chat" ? S.chat : null, $("chat-filter").value);
  $("nav-home").classList.toggle("is-on", S.view === "home");
  $("nav-home").toggleAttribute("aria-current", S.view === "home");
  S.filterIndex = -1;
}

// ── routing (#/c/<chat>[/t/<ts>]) ────────────────────────────────────

function parseHash() {
  const m = /^#\/c\/([^/]+)(?:\/t\/(cmsg_[A-Za-z0-9_-]+))?/.exec(location.hash);
  return m ? { chat: decodeURIComponent(m[1]), ts: m[2] || null } : { chat: null, ts: null };
}

function setHash(chat, ts) {
  const h = chat ? `#/c/${encodeURIComponent(chat)}${ts ? `/t/${ts}` : ""}` : "#/home";
  if (location.hash !== h) history.replaceState(null, "", h);
}

/** Home is the front door; a chat opens only when the link names one. */
async function route() {
  const { chat, ts } = parseHash();
  const known = chat && S.chats.some((c) => c.chat === chat);
  if (!known) return openHome();
  await openChat(chat);
  if (ts) openThread(ts);
}

// ── home ─────────────────────────────────────────────────────────────

function showView(view) {
  const changed = S.view !== view;
  S.view = view;
  $("home").hidden = view !== "home";
  $("chatview").hidden = view !== "chat";
  $("threads-toggle").hidden = view === "home";
  if (changed) enter($(view === "home" ? "home" : "chatview"));
}

function openHome() {
  if (S.chat) saveDraft(S.chat, null, $("input").value);
  S.stream?.close();
  S.stream = null;
  S.chat = null;
  S.busy = false;
  closeDetail(true);
  setPanel(false);
  showView("home");
  settle($("home"));
  S.homeHtml = null;
  setHash(null);
  renderHeader();
  renderChats();
  renderStatus();
  if (mqPhone.matches) setSidebar(false);
  restoreDraft($("home-input"), "home", null);
  renderHomeComposer();
  renderHome();
  loadAllThreads();
  clearInterval(S.homeTimer);
  S.homeTimer = setInterval(() => S.view === "home" && !document.hidden && loadAllThreads(), 20000);
  if (!mqPhone.matches) $("home-input").focus({ preventScroll: true });
}

function homeItems() {
  const items = [];
  for (const [chat, map] of Object.entries(S.threads)) {
    if (!S.chats.some((c) => c.chat === chat)) continue;
    for (const t of Object.values(map)) items.push({ chat, thread: t, status: S.statuses[chat]?.[t.ts] });
  }
  return items;
}

/**
 * Render home only when something actually changed: background refreshes must
 * be invisible (no re-render, no replayed entrance animations).
 */
function renderHome() {
  if (S.view !== "home") return;
  renderHomeBadge();
  const html = homeHtml({ chats: S.chats, items: homeItems(), loading: S.homeLoading });
  if (html === S.homeHtml) return;
  S.homeHtml = html;
  const sc = $("home-scroll");
  const top = sc.scrollTop;
  $("home-body").innerHTML = html;
  sc.scrollTop = top;
}

/** Total waiting on you, on the sidebar's Home item (status, not a streak). */
function renderHomeBadge() {
  const n = homeItems().filter((it) => ["needs_reply", "needs_approval"].includes(threadState(it.thread))).length;
  $("home-count").hidden = !n;
  $("home-count").textContent = n;
  $("home-count").title = n ? `${n} waiting on you` : "";
}

let homeLoad = null;
async function loadAllThreads() {
  if (homeLoad) return homeLoad;
  S.homeLoading = true;
  homeLoad = (async () => {
    await Promise.all(S.chats.map(async (c) => {
      try {
        const d = await api.threads(c.chat);
        S.threads[c.chat] = Object.fromEntries((d.threads || []).map((x) => [x.ts, x]));
      } catch { /* that project simply shows nothing */ }
    }));
    S.homeLoading = false;
    renderHome();
    // Progress bars for open threads, a few at a time.
    const open = homeItems().filter((it) => threadState(it.thread) !== "resolved" && it.status == null).slice(0, 30);
    await Promise.all(open.map((it) => loadChecklist(it.chat, it.thread.ts)));
    renderHome();
  })();
  try { await homeLoad; } finally { homeLoad = null; }
}

function renderHomeComposer() {
  const block = composerBlock(S.status, S.statusError);
  const ta = $("home-input");
  ta.disabled = !!block;
  $("home-send").disabled = !!block || !ta.value.trim();
  $("home-note").textContent = block;
  $("home-note").classList.toggle("is-warn", !!block);
}

/** Ask from home: open the workspace chat and send there (optimistic, as always). */
async function sendFromHome() {
  const ta = $("home-input");
  const text = ta.value.trim();
  if (!text || composerBlock(S.status, S.statusError)) return;
  ta.value = "";
  autogrow(ta);
  saveDraft("home", null, "");
  renderHomeComposer();
  await openChat(WORKSPACE);
  deliver(WORKSPACE, localRow(text));
}

// ── chat ─────────────────────────────────────────────────────────────

async function openChat(chat, { focusMsg } = {}) {
  if (S.view === "chat" && S.chat === chat && !focusMsg) return;
  if (S.view !== "chat" || S.chat !== chat) {
    clearInterval(S.homeTimer);
    const fromHome = S.view !== "chat";
    showView("chat");
    if (!fromHome) enter($("chatview"));
    S.stream?.close();
    S.stream = null;
    saveDraft(S.chat, null, $("input").value);
    S.chat = chat;
    const restored = restoreDraft($("input"), chat, null);
    flashDraftNote(restored ? "Draft restored" : "");
    renderComposer();
    S.busy = false;
    S.newWhileAway = 0;
    S.highlight = null;
    closeDetail(true);
    S.panelHtml = null;
    setHash(chat, null);
    renderHeader();
    renderChats();
    if (mqPhone.matches) setSidebar(false);

    const seen = S.messages[chat];
    if (!seen) {
      S.loading = true;
      S.rendered = { chat: null, ids: [], lastDay: "" };
      $("timeline").innerHTML = skeletonHtml();
      $("typing").hidden = true;
    } else renderTimeline({ toBottom: true, full: true });

    try {
      // First visit: ask only for the newest message (the live cursor and the
      // fresh-start marker). History is fetched when the person scrolls to it.
      // Later visits: only what arrived since.
      const known = chat in S.freshFrom;
      const since = known ? lastId(S.messages[chat] || []) || S.freshFrom[chat] : null;
      const [m, t] = await Promise.all([
        since ? api.messages(chat, { after: since }) : api.messages(chat, { limit: 1 }),
        api.threads(chat),
      ]);
      if (S.chat !== chat) return;
      S.threads[chat] = Object.fromEntries((t.threads || []).map((x) => [x.ts, x]));
      if (!known) {
        const latest = (m.messages || [])[0] || null;
        S.freshFrom[chat] = latest ? latest.id : null;
        S.latestAt[chat] = latest ? latest.written_at : null;
        S.hist[chat] = { all: !latest, loading: false, window: 0, capped: false };
        S.messages[chat] ||= [];
      } else if (since) {
        S.messages[chat] = mergeMessages(S.messages[chat] || [], m.messages || []).list;
      }
    } catch (err) {
      if (S.chat !== chat) return;
      toast("Could not load the chat", err.message);
      S.messages[chat] ||= [];
      S.threads[chat] ||= {};
    }
    S.loading = false;
    renderTimeline({ toBottom: true, full: true });
    renderPanel();
    if (!mqPhone.matches && !document.activeElement?.matches("input,textarea")) $("input").focus({ preventScroll: true });
    renderChats();
    loadChecklists(chat);
    startStream(chat);

    const pref = store.get("xo-chat-panel");
    const hasThreads = Object.keys(S.threads[chat] || {}).length > 0;
    if (!mqNarrow.matches) setPanel(pref === "open" || (pref !== "closed" && hasThreads));
    else setPanel(false);
  }
  if (focusMsg) focusMessage(focusMsg);
}

function renderHeader() {
  if (S.view === "home") {
    $("chat-title").textContent = "Home";
    $("title-ic").innerHTML = ICON.home;
    document.title = `${S.unseen ? `(${S.unseen}) ` : ""}Home · XO Space Cowork`;
    return;
  }
  const ws = S.chat === WORKSPACE;
  $("chat-title").textContent = chatLabel(S.chat);
  $("title-ic").innerHTML = ws ? ICON.globe : ICON.project;
  document.title = `${S.unseen ? `(${S.unseen}) ` : ""}${chatLabel(S.chat)} · XO Space Cowork`;
  $("input").placeholder = ws ? "Message the workspace coordinator…" : `Message the ${S.chat} coordinator…`;
}

function startStream(chat) {
  S.stream = new ChatStream(chat, {
    getAfter: () => lastId(S.messages[chat] || []) || S.freshFrom[chat] || null,
    onMessage: (row) => onMessages(chat, [row]),
    onThread: (t) => onThread(chat, t),
    onHeartbeat: (hb) => {
      if (S.chat !== chat) return;
      const busy = !!hb.coordinator_busy;
      if (busy && !S.busySince[chat]) S.busySince[chat] = Date.now();
      if (!busy) delete S.busySince[chat];
      if (busy !== S.busy) {
        S.busy = busy;
        renderTyping();
      }
    },
    onMode: (mode) => {
      S.live = mode;
      renderStatus();
    },
  }).start();
}

/** Drop optimistic rows whose server copy has arrived (the stream can beat the POST). */
function dropEchoed(list, added) {
  const echoes = added.filter((m) => m.author_kind === "owner" && !isLocal(m)).map((m) => m.text);
  if (!echoes.length) return list;
  return list.filter((m) => {
    if (!isLocal(m) || !m._pending) return true;
    const i = echoes.indexOf(m.text);
    if (i < 0) return true;
    echoes.splice(i, 1);
    return false;
  });
}

function onMessages(chat, rows) {
  const before = S.messages[chat] || [];
  const { list, added } = mergeMessages(before, rows);
  if (!added.length) return;
  S.messages[chat] = dropEchoed(list, added);
  const aw = S.awaiting[chat];
  if (aw && hasReplyAfter(added, aw.id)) delete S.awaiting[chat];
  if (chat !== S.chat) return;
  const replies = added.filter((m) => m.author_kind !== "owner");
  if (replies.length) {
    const last = replies[replies.length - 1];
    announce(`${authorLabel(last, chat)}: ${String(last.text || "").slice(0, 160)}`);
    if (document.hidden) {
      S.unseen += replies.length;
      renderHeader();
    }
  }
  const nearBottom = isNearBottom();
  if (!nearBottom) S.newWhileAway += replies.length;
  renderTimeline({ toBottom: nearBottom, smooth: true });
  if (chat === WORKSPACE && added.some((m) => m.author_kind !== "owner")) {
    setTimeout(loadRouted, 1500);
    setTimeout(loadRouted, 12000);
  }
}

const chkTimers = {};
function onThread(chat, t) {
  const map = (S.threads[chat] ||= {});
  const prev = map[t.ts];
  map[t.ts] = t;
  renderHomeBadge();
  if (chat !== S.chat) return;
  renderPanel();
  if (!prev || prev.title !== t.title || threadState(prev) !== threadState(t)) {
    patchMessage(t.ts);
    renderChats();
  }
  // Refresh this thread's checklist (debounced) and the open thread view.
  clearTimeout(chkTimers[t.ts]);
  chkTimers[t.ts] = setTimeout(() => loadChecklist(chat, t.ts), 400);
  if (S.detail && S.detail.chat === chat && S.detail.ts === t.ts) refreshDetail();
}

async function loadChecklists(chat) {
  const list = Object.values(S.threads[chat] || {}).slice(0, 40);
  await Promise.all(list.map((t) => loadChecklist(chat, t.ts)));
}

let homeRenderTimer = null;
function scheduleHomeRender() {
  clearTimeout(homeRenderTimer);
  homeRenderTimer = setTimeout(renderHome, 120);
}

async function loadChecklist(chat, ts) {
  try {
    const d = await api.thread(chat, ts);
    (S.statuses[chat] ||= {})[ts] = d.status || "";
    if (d.thread) (S.threads[chat] ||= {})[ts] = { ...d.thread, card: d.card ?? d.thread.card ?? null };
    if (chat === S.chat) renderPanel();
  } catch { /* the card simply shows no progress */ }
  if (S.view === "home") scheduleHomeRender();
}

async function loadRouted() {
  const projects = S.chats.filter((c) => c.kind === "project");
  await Promise.all(
    projects.map(async (c) => {
      try {
        const d = await api.messages(c.chat, { limit: 300 });
        S.projectMsgs[c.chat] = d.messages || [];
      } catch { /* skip */ }
    }),
  );
  if (S.chat !== WORKSPACE) return;
  for (const id of Object.keys(routedIndex(S.projectMsgs))) patchMessage(id);
}

// ── timeline rendering and scrolling ────────────────────────────────────

function isNearBottom(el = $("scroller")) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 140;
}

function timelineCtx(chat) {
  return {
    chat,
    chats: S.chats,
    threadsByTs: S.threads[chat] || {},
    routed: chat === WORKSPACE ? routedIndex(S.projectMsgs) : null,
    highlight: S.highlight,
  };
}

/**
 * Render the conversation. When the only change is new rows at the end, they
 * are appended so what the person is reading or selecting never re-renders.
 */
function renderTimeline({ toBottom = false, smooth = false, keep = false, full = false, prepend = false } = {}) {
  if (S.loading) return;
  const el = $("timeline");
  const sc = $("scroller");
  const rows = S.messages[S.chat] || [];
  const wasNear = isNearBottom();
  const prevTop = sc.scrollTop;
  const fromBottom = sc.scrollHeight - sc.scrollTop;
  const r = S.rendered;
  const canAppend =
    !full && r.chat === S.chat && r.ids.length && rows.length > r.ids.length &&
    r.ids.every((id, i) => rows[i].id === id && !isLocal(rows[i]));
  if (canAppend) {
    const fresh = rows.slice(r.ids.length);
    el.insertAdjacentHTML("beforeend", timelineHtml(fresh, timelineCtx(S.chat), r.lastDay));
    if (!reduceMotion()) {
      for (const m of fresh) document.getElementById(`m-${m.id}`)?.classList.add("is-new");
    }
  } else {
    el.innerHTML = rows.length ? timelineHtml(rows, timelineCtx(S.chat)) : S.freshFrom[S.chat] ? "" : emptyStateHtml(S.chat);
  }
  S.rendered = { chat: S.chat, ids: rows.map((m) => m.id), lastDay: rows.length ? dayLabel(rows[rows.length - 1].written_at) : "" };
  renderTyping(false);
  updateFresh();
  renderHistoryTop();
  if (prepend) sc.scrollTop = sc.scrollHeight - fromBottom; // older rows above; the view stays put
  else if (toBottom || (keep && wasNear)) scrollToBottom(smooth);
  else sc.scrollTop = prevTop;
  updateJump();
}

/**
 * The fresh start. On (re)opening a chat with history, the page below the
 * history is a full screen of calm, so the chat looks new until you scroll up.
 * Once this session has messages, the spacer shrinks so the newest exchange
 * sits at the top of the view with room for the reply (no jump as it grows).
 */
function updateFresh() {
  const fr = $("fresh");
  const sc = $("scroller");
  const rows = S.messages[S.chat] || [];
  const from = S.freshFrom[S.chat];
  if (S.loading || !from) {
    fr.hidden = true;
    fr.style.minHeight = "";
    return;
  }
  fr.hidden = false;
  const cs = getComputedStyle(sc);
  const avail = sc.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const first = rows.find((m) => (m.id || "") > from);
  if (!first) {
    const h = S.hist[S.chat];
    const earlier = h?.all && !h.capped ? rows.filter((m) => m.author_kind !== "system").length : null;
    const sig = `${S.chat}|${earlier}`;
    if (fr.dataset.sig !== sig) {
      fr.innerHTML = freshHtml(S.chat, earlier, S.latestAt[S.chat] || rows[rows.length - 1]?.written_at);
      fr.dataset.sig = sig;
      fr.classList.add("is-idle");
    }
    // A little more than a screen, so no sliver of history peeks in.
    fr.style.minHeight = `${Math.max(240, avail + 32)}px`;
    return;
  }
  if (fr.dataset.sig) {
    fr.innerHTML = "";
    fr.dataset.sig = "";
    fr.classList.remove("is-idle");
  }
  const node = document.getElementById(`m-${first.id}`);
  if (!node) return;
  const typing = $("typing");
  const end = Math.max(
    $("timeline").offsetTop + $("timeline").offsetHeight,
    typing.hidden ? 0 : typing.offsetTop + typing.offsetHeight,
  );
  const used = end - (node.offsetTop - 12);
  fr.style.minHeight = `${Math.max(0, avail - used)}px`;
}

// ── history on demand ────────────────────────────────────────────────

/** Rows written this page session (after the fresh-start marker). */
function sessionCount(chat) {
  const from = S.freshFrom[chat];
  return from ? (S.messages[chat] || []).filter((m) => (m.id || "") > from).length : 0;
}

/**
 * Load older messages above what is shown. The API returns the newest N, so
 * each page asks for a bigger window (40, 80, 160 …) and merges by id.
 */
async function loadOlder(chat = S.chat) {
  const h = S.hist[chat];
  if (!h || h.all || h.loading || !S.freshFrom[chat]) return;
  h.loading = true;
  if (chat === S.chat) renderHistoryTop();
  const want = Math.min(HISTORY_MAX, Math.max(HISTORY_FIRST, h.window * 2) + sessionCount(chat));
  try {
    const d = await api.messages(chat, { limit: want });
    const rows = d.messages || [];
    S.messages[chat] = mergeMessages(S.messages[chat] || [], rows).list;
    h.window = want;
    h.all = rows.length < want || want >= HISTORY_MAX;
    h.capped = want >= HISTORY_MAX && rows.length >= HISTORY_MAX;
    h.loading = false;
    if (chat === S.chat) renderTimeline({ full: true, prepend: true });
    if (chat === WORKSPACE) loadRouted();
  } catch (err) {
    h.loading = false;
    toast("Could not load earlier messages", err.message);
  }
  if (chat === S.chat) renderHistoryTop();
}

/** The strip above the timeline: a loader, a hint, or the beginning. */
function renderHistoryTop() {
  const el = $("history-top");
  const h = S.hist[S.chat];
  if (S.loading || !h || !S.freshFrom[S.chat]) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const html = h.loading
    ? `<span class="ht-loading"><i class="spin"></i>Loading earlier messages…</span>`
    : h.all
      ? `<span class="ht-start">${h.capped ? "Showing the latest 1,000 messages" : "Beginning of the conversation"}</span>`
      : `<button type="button" class="ht-more" data-load-earlier>${ICON.up}Earlier messages</button>`;
  if (el.innerHTML !== html) el.innerHTML = html;
}

/** Make sure a message is loaded (for "go to message" links), paging back as needed. */
async function ensureLoaded(chat, id) {
  for (let i = 0; i < 6; i++) {
    if ((S.messages[chat] || []).some((m) => m.id === id)) return true;
    const h = S.hist[chat];
    if (!h || h.all) return false;
    await loadOlder(chat);
  }
  return (S.messages[chat] || []).some((m) => m.id === id);
}

/** Re-render one message in place (thread chip or routing changed). */
function patchMessage(id) {
  const node = document.getElementById(`m-${id}`);
  const msg = (S.messages[S.chat] || []).find((m) => m.id === id);
  if (!node || !msg || !$("timeline").contains(node)) return;
  node.outerHTML = messageHtml(msg, timelineCtx(S.chat));
}

function skeletonHtml() {
  const line = (w) => `<i style="width:${w}%"></i>`;
  return (
    `<div class="skeleton" aria-busy="true" aria-label="Loading messages">` +
    `<div class="sk-row sk-owner">${line(46)}</div>` +
    `<div class="sk-row sk-agent"><b></b><div>${line(92)}${line(84)}${line(58)}</div></div>` +
    `<div class="sk-row sk-owner">${line(34)}</div>` +
    `<div class="sk-row sk-agent"><b></b><div>${line(88)}${line(66)}</div></div></div>`
  );
}

function scrollToBottom(smooth) {
  const sc = $("scroller");
  if (smooth && !reduceMotion()) sc.scrollTo({ top: sc.scrollHeight, behavior: "smooth" });
  else sc.scrollTop = sc.scrollHeight;
  S.newWhileAway = 0;
}

function updateJump() {
  const near = isNearBottom();
  if (near) S.newWhileAway = 0;
  const j = $("jump");
  j.hidden = near;
  $("fresh").classList.toggle("is-away", !near);
  j.classList.toggle("has-new", S.newWhileAway > 0);
  $("jump-label").textContent = S.newWhileAway > 0
    ? `${S.newWhileAway} new message${S.newWhileAway === 1 ? "" : "s"}` : "Jump to latest";
}

function awaitingNow(aw) {
  return aw && Date.now() - aw.at < AWAIT_MAX_MS;
}

function workingSince(chat) {
  const aw = S.awaiting[chat];
  if (awaitingNow(aw)) return aw.at;
  return S.busySince[chat] || null;
}

function renderTyping(scroll = true) {
  const show = (S.busy || awaitingNow(S.awaiting[S.chat])) && !S.loading;
  const el = $("typing");
  const was = !el.hidden;
  const near = isNearBottom();
  if (show) {
    el.innerHTML = typingHtml(S.chat === WORKSPACE ? "Workspace coordinator is working" : "Coordinator is working", workingSince(S.chat));
    el.hidden = false;
    updateFresh();
    if (!was && scroll && near) scrollToBottom(true);
  } else {
    el.hidden = true;
    updateFresh();
  }
}

/** Once a second: advance the elapsed counters without restarting animations. */
function tickWorking() {
  const tick = (el, since, rerender) => {
    if (el.hidden || !since) return;
    const secs = Math.floor((Date.now() - since) / 1000);
    const out = el.querySelector(".elapsed");
    if (out) {
      out.textContent = elapsed(secs);
      out.hidden = secs < 1;
    }
    if (secs >= 15 && !el.querySelector(".typing.is-long")) rerender();
  };
  tick($("typing"), workingSince(S.chat), () => renderTyping(false));
  const d = S.detail;
  if (d) tick($("detail-typing"), detailSince(d), () => renderDetailTyping());
}

async function focusMessage(id) {
  await ensureLoaded(S.chat, id);
  S.highlight = id;
  renderTimeline({ keep: false });
  const node = document.getElementById(`m-${id}`);
  if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
  setTimeout(() => {
    if (S.highlight === id) {
      S.highlight = null;
      document.getElementById(`m-${id}`)?.classList.remove("is-hl");
    }
  }, 2600);
  updateJump();
}

function tickRelative() {
  renderPanel();
  if (S.detail?.data) renderDetail({ keepScroll: true });
}

// ── composer ────────────────────────────────────────────────────────────

function autogrow(ta) {
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, parseFloat(getComputedStyle(ta).maxHeight) || 240) + "px";
}

let draftTimer = null;
function flashDraftNote(text) {
  const n = $("draft-note");
  n.textContent = text;
  clearTimeout(draftTimer);
  if (text) draftTimer = setTimeout(() => (n.textContent = ""), 2400);
}

function renderComposer() {
  const block = composerBlock(S.status, S.statusError);
  const ta = $("input");
  const note = $("composer-note");
  ta.disabled = !!block;
  const empty = !ta.value.trim();
  $("send").disabled = !!block || empty;
  note.textContent = block;
  note.classList.toggle("is-warn", !!block);
  $("send").title = block || (empty ? "Type a message" : "Send (Enter)");

  const tta = $("thread-input");
  const tnote = $("thread-note");
  const resolved = S.detail?.data?.thread?.state === "resolved";
  tta.disabled = !!block;
  $("thread-send").disabled = !!block || !tta.value.trim();
  tnote.textContent = block || (resolved ? "Resolved. Replies still reach its agent, but the thread stays resolved." : "");
  tnote.classList.toggle("is-warn", !!block);
  renderHomeComposer();
}

/**
 * Optimistic send: the message appears in the same frame, the composer clears,
 * and a failure leaves the text in place with Retry and Edit (never lost).
 */
function localRow(text) {
  return {
    id: `${LOCAL_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    written_at: new Date().toISOString(),
    author_kind: "owner",
    author_id: "owner",
    text,
    _pending: true,
  };
}

function send() {
  const ta = $("input");
  const text = ta.value.trim();
  if (!text || composerBlock(S.status, S.statusError)) return;
  ta.value = "";
  autogrow(ta);
  saveDraft(S.chat, null, "");
  renderComposer();
  deliver(S.chat, localRow(text));
}

async function deliver(chat, row) {
  row._pending = true;
  row._failed = false;
  S.messages[chat] = mergeMessages(S.messages[chat] || [], [row]).list;
  if (chat === S.chat) {
    renderTimeline({ full: true, toBottom: true, smooth: true });
  }
  try {
    const res = await api.post(chat, row.text);
    S.messages[chat] = (S.messages[chat] || []).filter((m) => m.id !== row.id);
    S.awaiting[chat] = { id: res.message.id, at: Date.now() };
    S.messages[chat] = mergeMessages(S.messages[chat], [res.message]).list;
    if (chat === S.chat) {
      renderTimeline({ full: true, toBottom: true, smooth: true });
      announce("Sent.");
    }
    setTimeout(() => S.chat === chat && renderTyping(), AWAIT_MAX_MS + 100);
  } catch (err) {
    row._pending = false;
    row._failed = true;
    row._error = err.message;
    if (chat === S.chat) renderTimeline({ full: true, keep: true });
    toast(sendErrorTitle(err), `${err.message} Your message is kept; retry or edit it.`);
    if (err.code === "router_off" || err.status === 501) loadStatus();
  }
}

/** Retry or edit a failed message (in the chat or the open thread). */
function retryFailed(id, edit) {
  const inThread = S.detail?.messages.find((m) => m.id === id);
  const row = inThread || (S.messages[S.chat] || []).find((m) => m.id === id);
  if (!row || !row._failed) return;
  if (inThread) {
    S.detail.messages = S.detail.messages.filter((m) => m.id !== id);
    if (edit) return putBack($("thread-input"), row.text, () => renderDetail({ keepScroll: true }));
    return deliverThread(S.detail, row);
  }
  S.messages[S.chat] = S.messages[S.chat].filter((m) => m.id !== id);
  if (edit) return putBack($("input"), row.text, () => renderTimeline({ full: true, keep: true }));
  deliver(S.chat, row);
}

function putBack(ta, text, rerender) {
  const cur = ta.value.trim();
  ta.value = cur ? `${text}\n\n${cur}` : text;
  autogrow(ta);
  rerender();
  renderComposer();
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

function sendErrorTitle(err) {
  if (err.code === "router_off") return "Router is off";
  if (err.status === 501) return "Not supported by this backend";
  if (err.status === 403) return "Refused by the proxy";
  return "Message not sent";
}

// ── threads panel ───────────────────────────────────────────────────────

let panelTimer = null;
function setPanel(open, { remember = false } = {}) {
  const was = S.panelOpen;
  S.panelOpen = open;
  const panel = $("panel");
  clearTimeout(panelTimer);
  if (open) {
    panel.classList.remove("is-closing");
    if (panel.hidden) settle(panel);
    panel.hidden = false;
  } else if (was && !reduceMotion() && !panel.hidden) {
    // Slide out, then hide: nothing teleports.
    panel.classList.add("is-closing");
    panelTimer = setTimeout(() => { panel.hidden = true; panel.classList.remove("is-closing"); }, 200);
  } else panel.hidden = true;
  $("panel-scrim").hidden = !(open && mqNarrow.matches);
  $("threads-toggle").setAttribute("aria-expanded", String(open));
  if (remember && !mqNarrow.matches) store.set("xo-chat-panel", open ? "open" : "closed");
  if (!open) closeDetail(true);
  renderWaitingStrip();
}

function renderPanel() {
  const threads = Object.values(S.threads[S.chat] || {});
  const list = threadListHtml(threads, S.statuses[S.chat] || {}, S.detail?.ts);
  if (list !== S.panelHtml) {
    S.panelHtml = list;
    $("thread-list").innerHTML = list;
  }
  const open = openThreadCount(threads);
  $("threads-count").hidden = !open;
  $("threads-count").textContent = open;
  const waiting = threads.filter((t) => ["needs_reply", "needs_approval"].includes(threadState(t))).length;
  $("threads-toggle").title = `${threads.length} thread${threads.length === 1 ? "" : "s"}${waiting ? `, ${waiting} waiting on you` : ""}`;
  $("threads-toggle").classList.toggle("has-waiting", waiting > 0);
  $("threads-total").textContent = threads.length || "";
  renderWaitingStrip(threads);
}

/** What the strip shows; a dismissal holds until this changes. */
function standSignature(threads = Object.values(S.threads[S.chat] || {})) {
  return threads.filter((t) => threadState(t) !== "resolved").map((t) => `${t.ts}:${threadState(t)}`).sort().join("|");
}

/** "Where things stand" over the conversation (only when the Threads dock is closed). */
function renderWaitingStrip(threads = Object.values(S.threads[S.chat] || {})) {
  const dismissed = S.standHidden[S.chat] && S.standHidden[S.chat] === standSignature(threads);
  const html = S.panelOpen || dismissed ? "" : waitingStripHtml(threads);
  const el = $("waiting-strip");
  if (el.innerHTML !== html) el.innerHTML = html;
  el.hidden = !html;
}

async function findThreadChat(ts) {
  if (S.threads[S.chat]?.[ts]) return S.chat;
  for (const [ch, map] of Object.entries(S.threads)) if (map[ts]) return ch;
  for (const c of S.chats) {
    if (S.threads[c.chat]) continue;
    try {
      const d = await api.threads(c.chat);
      S.threads[c.chat] = Object.fromEntries((d.threads || []).map((x) => [x.ts, x]));
      if (S.threads[c.chat][ts]) return c.chat;
    } catch { /* skip */ }
  }
  return null;
}

async function openThread(ts) {
  const chat = await findThreadChat(ts);
  if (!chat) {
    toast("Thread not found", "That link points to a thread this server does not know.");
    return;
  }
  if (chat !== S.chat) await openChat(chat);
  if (S.detail?.ts === ts) {
    setPanel(true);
    return;
  }
  stopDetailTimer();
  S.detail = { chat, ts, data: null, messages: [], awaiting: null, timer: null };
  setPanel(true);
  $("panel").classList.add("is-detail");
  $("panel-list").hidden = true;
  $("panel-detail").hidden = false;
  const t = S.threads[chat]?.[ts];
  $("detail-crumb").textContent = `${chatLabel(chat)} / ${t?.title || "Thread"}`;
  $("detail-head").innerHTML = `<div class="loading">Loading thread…</div>`;
  $("detail-msgs").innerHTML = "";
  restoreDraft($("thread-input"), chat, ts);
  setHash(chat, ts);
  renderPanel();
  // Open at the top: the state and what it needs from you come first.
  await refreshDetail();
  $("detail-scroll").scrollTop = 0;
  if (!mqPhone.matches) $("thread-input").focus({ preventScroll: true });
}

function closeDetail(silent = false) {
  stopDetailTimer();
  if (!S.detail) return;
  saveDraft(S.detail.chat, S.detail.ts, $("thread-input").value);
  S.detail = null;
  $("panel").classList.remove("is-detail");
  $("panel-list").hidden = false;
  $("panel-detail").hidden = true;
  if (S.chat) setHash(S.chat, null);
  if (!silent) renderPanel();
  renderComposer();
}

function stopDetailTimer() {
  if (S.detail?.timer) clearTimeout(S.detail.timer);
  if (S.detail) S.detail.timer = null;
}

let detailInflight = null;
async function refreshDetail({ toBottom = false } = {}) {
  const d = S.detail;
  if (!d) return;
  if (detailInflight) return detailInflight;
  detailInflight = (async () => {
    try {
      const data = await api.thread(d.chat, d.ts);
      if (S.detail !== d) return;
      const before = d.messages.length;
      d.data = data;
      const merged = mergeMessages(d.messages, data.messages || []);
      d.messages = dropEchoed(merged.list, merged.added);
      if (d.awaiting) d.busySince ||= d.awaiting.at;
      if (d.awaiting && hasReplyAfter(d.messages, d.awaiting.id)) d.awaiting = null;
      (S.statuses[d.chat] ||= {})[d.ts] = data.status || "";
      if (data.thread) S.threads[d.chat][d.ts] = { ...data.thread, card: data.card ?? null };
      renderDetail({ toBottom: toBottom || d.messages.length > before });
      renderPanel();
    } catch (err) {
      if (S.detail === d && !d.data) $("detail-head").innerHTML = `<div class="callout is-err">${ICON.alert}<div><b>Could not load the thread</b><p>${esc(err.message)}</p></div></div>`;
    } finally {
      detailInflight = null;
      scheduleDetailPoll();
    }
  })();
  return detailInflight;
}

function scheduleDetailPoll() {
  const d = S.detail;
  if (!d) return;
  stopDetailTimer();
  const busy = d.data?.busy || awaitingNow(d.awaiting) || threadState(d.data?.thread) === "working";
  // Poll every 4s while the thread's agent is busy; slower otherwise (the
  // stream's "thread" events also trigger refreshes).
  d.timer = setTimeout(() => refreshDetail(), busy ? THREAD_POLL_MS : 15000);
}

function renderDetail({ toBottom = false, keepScroll = false } = {}) {
  const d = S.detail;
  if (!d || !d.data) return;
  const sc = $("detail-scroll");
  const near = isNearBottom(sc);
  const top = sc.scrollTop;
  const data = { ...d.data, card: d.data.card ?? d.data.thread?.card ?? null };
  $("detail-crumb").textContent = `${chatLabel(d.chat)} / ${data.thread?.title || "Thread"}`;
  $("detail-head").innerHTML = threadDetailHeadHtml(data);

  const root = (S.messages[d.chat] || []).find((m) => m.id === d.ts);
  const ctx = { chat: d.chat, chats: S.chats, inThread: true };
  let html = "";
  if (root) html += `<div class="td-root-label">Started from</div>` + messageHtml(root, ctx);
  html += d.messages.map((m) => messageHtml(m, ctx)).join("");
  if (!html) html = `<div class="fact">No messages in this thread yet.</div>`;
  $("detail-msgs").innerHTML = html;

  renderDetailTyping();
  renderComposer();
  if (toBottom || (!keepScroll && near)) sc.scrollTop = sc.scrollHeight;
  else sc.scrollTop = top;
}

function detailSince(d) {
  if (awaitingNow(d.awaiting)) return d.awaiting.at;
  if (d.data?.busy) return (d.busySince ||= Date.now());
  d.busySince = null;
  return null;
}

function renderDetailTyping() {
  const d = S.detail;
  if (!d || !d.data) return;
  const busy = d.data.busy || awaitingNow(d.awaiting);
  $("detail-typing").hidden = !busy;
  if (busy) $("detail-typing").innerHTML = typingHtml("Thread agent is working", detailSince(d));
}

function sendThread() {
  const d = S.detail;
  const ta = $("thread-input");
  const text = ta.value.trim();
  if (!d || !text || composerBlock(S.status, S.statusError)) return;
  ta.value = "";
  autogrow(ta);
  saveDraft(d.chat, d.ts, "");
  renderComposer();
  deliverThread(d, localRow(text));
}

async function deliverThread(d, row) {
  row._pending = true;
  row._failed = false;
  d.messages = mergeMessages(d.messages, [row]).list;
  if (S.detail === d) renderDetail({ toBottom: true });
  try {
    const res = await api.post(d.chat, row.text, d.ts);
    d.messages = d.messages.filter((m) => m.id !== row.id);
    d.awaiting = { id: res.message.id, at: Date.now() };
    d.messages = mergeMessages(d.messages, [res.message]).list;
    if (S.detail === d) {
      renderDetail({ toBottom: true });
      scheduleDetailPoll();
    }
  } catch (err) {
    row._pending = false;
    row._failed = true;
    if (S.detail === d) renderDetail({ keepScroll: true });
    toast(sendErrorTitle(err), `${err.message} Your message is kept; retry or edit it.`);
  }
}

// ── sidebar ─────────────────────────────────────────────────────────────

function setSidebar(open) {
  $("app").classList.toggle("sb-collapsed", !open);
  if (open) enter($("sidebar"));
  $("side-scrim").hidden = !(open && mqPhone.matches);
  if (!mqPhone.matches) store.set("xo-chat-sidebar", open ? "open" : "closed");
}

function moveFilter(delta) {
  const items = [...$("chat-list").querySelectorAll(".chan")];
  if (!items.length) return;
  items.forEach((b) => b.classList.remove("is-kbd"));
  S.filterIndex = (S.filterIndex + delta + items.length) % items.length;
  items[S.filterIndex].classList.add("is-kbd");
  items[S.filterIndex].scrollIntoView({ block: "nearest" });
}

// ── create an XO project (xo-cowork-api: config/workspace + files/mkdir) ──

/** The folder is the name, made path-safe; shown quietly under the name. */
function renderWhere() {
  const id = slugify($("cp-name").value);
  const root = S.projectsRoot ? S.projectsRoot.replace(/^\/home\/[^/]+/, "~") : "your projects folder";
  $("cp-where").textContent = id ? `Saved as ${root}/${id}` : "";
}

async function openCreate() {
  const dlg = $("create-dlg");
  $("create-form").reset();
  $("cp-err").hidden = true;
  $("cp-submit").disabled = false;
  $("cp-submit").textContent = "Create project";
  renderWhere();
  if (mqPhone.matches) setSidebar(false);
  dlg.showModal();
  $("cp-name").focus();
  if (!S.projectsRoot) {
    try {
      const cfg = await api.workspaceConfig();
      S.projectsRoot = cfg.roots?.[cfg.default] || null;
      renderWhere();
    } catch (err) {
      createError(`Can't read where projects live: ${err.message}`);
    }
  }
}

function createError(text) {
  $("cp-err").textContent = text;
  $("cp-err").hidden = !text;
}

function closeCreate() {
  const dlg = $("create-dlg");
  if (!dlg.open) return;
  if (reduceMotion()) return dlg.close();
  dlg.classList.add("is-closing");
  setTimeout(() => { dlg.classList.remove("is-closing"); dlg.close(); }, 160);
}

async function submitCreate() {
  const name = $("cp-name").value.trim();
  const id = slugify(name);
  const description = $("cp-desc").value.trim();
  if (!name) return createError("Give the project a name."), $("cp-name").focus();
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(id)) return createError("Use at least one letter or number in the name."), $("cp-name").focus();
  if (!S.projectsRoot) return createError("Can't create yet: the projects folder is unknown. Is the XO API running?");
  createError("");
  const btn = $("cp-submit");
  btn.disabled = true;
  btn.innerHTML = `<i class="spin"></i>Creating…`;
  try {
    await api.createProject({ path: `${S.projectsRoot}/${id}`, displayName: name, description });
    closeCreate();
    toast(`${name} is ready`, "Its folder, plan and memory were scaffolded. The coordinator fills in the brief on first use.", "ok");
    await loadChats();
    if (S.chats.some((c) => c.chat === id)) openChat(id);
    else if (S.view === "home") loadAllThreads();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Create project";
    createError(err.status === 409 ? `There's already a project called “${id}”. Pick another name.` : err.message);
  }
}

// ── toasts and clipboard ────────────────────────────────────────────────

function toast(title, message, kind = "err") {
  const el = document.createElement("div");
  el.className = `toast is-${kind}`;
  el.innerHTML = `${kind === "err" ? ICON.alert : ICON.sparkle}<div><b>${esc(title)}</b><span>${esc(message || "")}</span></div>`;
  $("toasts").appendChild(el);
  const close = () => {
    el.classList.add("is-out");
    setTimeout(() => el.remove(), reduceMotion() ? 0 : 180);
  };
  let timer = setTimeout(close, kind === "err" ? 8000 : 2200);
  // Hovering a toast holds it: nobody should have to race a timer to read.
  el.addEventListener("mouseenter", () => clearTimeout(timer));
  el.addEventListener("mouseleave", () => (timer = setTimeout(close, 2500)));
  el.addEventListener("click", close);
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove();
  }
  // Feedback where the eye already is; no toast for a non-event.
  if (btn && btn.classList.contains("md-copy")) {
    btn.textContent = "Copied";
    setTimeout(() => (btn.textContent = "Copy"), 1400);
  } else if (btn) {
    btn.classList.add("is-copied");
    btn.title = "Copied";
    setTimeout(() => { btn.classList.remove("is-copied"); btn.title = "Copy message"; }, 1400);
  }
  announce("Copied to the clipboard.");
}

let announceTimer = null;
function announce(text) {
  const el = $("announcer");
  el.textContent = "";
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => (el.textContent = text), 60);
}

function findMessage(id) {
  const lists = [S.messages[S.chat] || [], S.detail?.messages || []];
  for (const l of lists) for (const m of l) if (m.id === id) return m;
  return null;
}

// ── events ──────────────────────────────────────────────────────────────

function wire() {
  // Delegated clicks: thread links, chips, cards, chat buttons, copy, suggestions.
  document.addEventListener("click", (e) => {
    const t = e.target;
    const sb = t.closest("#status-btn");
    if (sb) return setStatusOpen(!S.statusOpen);
    if (S.statusOpen && !t.closest("#status-pop")) setStatusOpen(false);
    if (t.closest("[data-home]")) return openHome();
    if (t.closest("[data-create-project]")) return openCreate();
    if (t.closest("[data-load-earlier]")) return loadOlder();
    if (t.closest("[data-scroll-earlier]")) {
      loadOlder().then(() => {
        $("scroller").scrollBy({ top: -$("scroller").clientHeight * 0.6, behavior: reduceMotion() ? "auto" : "smooth" });
      });
      return;
    }
    const chan = t.closest("[data-chat]");
    if (chan) {
      openChat(chan.dataset.chat);
      return;
    }
    const thread = t.closest("[data-thread]");
    if (thread) {
      e.preventDefault();
      openThread(thread.dataset.thread);
      return;
    }
    const go = t.closest("[data-goto-chat]");
    if (go && go.dataset.gotoChat) {
      setPanel(mqNarrow.matches ? false : S.panelOpen);
      openChat(go.dataset.gotoChat, { focusMsg: go.dataset.gotoMsg || null });
      return;
    }
    const copy = t.closest("[data-copy]");
    if (copy) {
      copyText(copy.closest(".md-code")?.querySelector("pre")?.textContent || "", copy);
      return;
    }
    const cm = t.closest("[data-copy-msg]");
    if (cm) {
      const m = findMessage(cm.closest("[data-mid]")?.dataset.mid);
      if (m) copyText(m.text, cm);
      return;
    }
    if (t.closest("[data-open-threads]")) {
      setPanel(true, { remember: true });
      return;
    }
    if (t.closest("[data-dismiss-stand]")) {
      S.standHidden[S.chat] = standSignature();
      renderWaitingStrip();
      return;
    }
    const retry = t.closest("[data-retry]");
    if (retry) return retryFailed(retry.dataset.retry, false);
    const edit = t.closest("[data-edit]");
    if (edit) return retryFailed(edit.dataset.edit, true);
    const sug = t.closest("[data-suggest]");
    if (sug) {
      const ta = $("input");
      ta.value = sug.dataset.suggest;
      autogrow(ta);
      renderComposer();
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      saveDraft(S.chat, null, ta.value);
    }
  });

  // Composers
  for (const [taId, formId, fn] of [["input", "composer", send], ["thread-input", "thread-composer", sendThread], ["home-input", "home-composer", sendFromHome]]) {
    const ta = $(taId);
    ta.addEventListener("input", () => {
      autogrow(ta);
      renderComposer();
      if (taId === "input") saveDraft(S.chat, null, ta.value);
      else if (taId === "home-input") saveDraft("home", null, ta.value);
      else if (S.detail) saveDraft(S.detail.chat, S.detail.ts, ta.value);
    });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        fn();
      }
    });
    $(formId).addEventListener("submit", (e) => { e.preventDefault(); fn(); });
  }

  // Scrolling; the fresh spacer follows the viewport size. History loads only
  // when the person scrolls up to it (wheel, touch or keys), never on its own.
  const sc = $("scroller");
  const intent = () => (S.lastUserScroll = Date.now());
  sc.addEventListener("wheel", (e) => e.deltaY < 0 && intent(), { passive: true });
  sc.addEventListener("touchmove", intent, { passive: true });
  sc.addEventListener("keydown", (e) => ["ArrowUp", "PageUp", "Home"].includes(e.key) && intent());
  sc.addEventListener("pointerdown", (e) => e.target === sc && intent()); // scrollbar drag
  sc.addEventListener("scroll", () => {
    updateJump();
    if (S.view === "chat" && sc.scrollTop < 200 && Date.now() - S.lastUserScroll < 1500) loadOlder();
  }, { passive: true });
  new ResizeObserver(() => S.view === "chat" && updateFresh()).observe($("scroller"));

  // Create project dialog
  $("cp-name").addEventListener("input", renderWhere);
  $("cp-cancel").addEventListener("click", closeCreate);
  $("create-form").addEventListener("submit", (e) => { e.preventDefault(); submitCreate(); });
  $("create-dlg").addEventListener("cancel", (e) => { e.preventDefault(); closeCreate(); });
  $("create-dlg").addEventListener("click", (e) => { if (e.target === $("create-dlg")) closeCreate(); });
  $("jump").addEventListener("click", () => scrollToBottom(true));

  // Sidebar
  $("sidebar-close").addEventListener("click", () => setSidebar(false));
  $("sidebar-open").addEventListener("click", () => setSidebar($("app").classList.contains("sb-collapsed")));
  $("side-scrim").addEventListener("click", () => setSidebar(false));
  const filter = $("chat-filter");
  filter.addEventListener("input", renderChats);
  filter.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moveFilter(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveFilter(-1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const items = [...$("chat-list").querySelectorAll(".chan")];
      const pick = items[Math.max(0, S.filterIndex)];
      if (pick) {
        filter.value = "";
        openChat(pick.dataset.chat);
        renderChats();
        $("input").focus();
      }
    } else if (e.key === "Escape") {
      e.stopPropagation();
      filter.value = "";
      renderChats();
      filter.blur();
      if (mqPhone.matches) setSidebar(false);
    }
  });

  // Panel
  $("threads-toggle").addEventListener("click", () => setPanel(!S.panelOpen, { remember: true }));
  $("panel-close").addEventListener("click", () => setPanel(false, { remember: true }));
  $("detail-close").addEventListener("click", () => setPanel(false, { remember: true }));
  $("detail-back").addEventListener("click", () => closeDetail());
  $("panel-scrim").addEventListener("click", () => setPanel(false));

  // Theme
  $("theme-toggle").addEventListener("click", () => {
    const next = currentTheme() === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    store.set("xo-chat-theme", next);
    paintThemeIcon();
  });
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", paintThemeIcon);

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setSidebar(true);
      filter.focus();
      filter.select();
      return;
    }
    if (e.key === "Escape") {
      if ($("create-dlg").open) return;
      if (S.statusOpen) {
        setStatusOpen(false);
        $("status-btn")?.focus();
        return;
      }
      if (mqPhone.matches && !$("app").classList.contains("sb-collapsed")) setSidebar(false);
      else if (S.panelOpen) setPanel(false, { remember: !mqNarrow.matches });
    }
  });

  // Layout changes
  mqNarrow.addEventListener("change", () => setPanel(mqNarrow.matches ? false : S.panelOpen));
  mqPhone.addEventListener("change", () => {
    $("side-scrim").hidden = true;
    if (mqPhone.matches) $("app").classList.add("sb-collapsed");
  });
  window.addEventListener("hashchange", () => {
    const { chat, ts } = parseHash();
    if (!chat) { if (S.view !== "home") openHome(); return; }
    if (chat !== S.chat || S.view !== "chat") openChat(chat).then(() => ts && openThread(ts));
    else if (ts && ts !== S.detail?.ts) openThread(ts);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (S.unseen) {
      S.unseen = 0;
      renderHeader();
    }
    if (S.detail) refreshDetail();
    if (S.view === "home") loadAllThreads();
  });
  window.addEventListener("pagehide", () => {
    saveDraft(S.chat, null, $("input").value);
    if (S.detail) saveDraft(S.detail.chat, S.detail.ts, $("thread-input").value);
  });
}

boot();

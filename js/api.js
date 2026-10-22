// Thin client for XO Space's storm API (`/api/chat/*`, the one reference is
// /home/coder/sedc/handoffs/UI-reference.md), plus the project-creation routes.
// Same origin: serve.py proxies /api. Paths are relative to the page, so the UI
// also works under a path prefix (a hub frame).
//
// The UI owns no decision logic: risk, allowed scopes, rule sentences, routing
// and permission answers come from the server; this client only carries them.

const BASE = "api";

// Inside a Coder workspace, the app is opened at `?coder_session_token=…`
// (xo-swarm does this). Coder accepts that for the page load, but the cookie
// it sets lasts a minute, after which every request here is redirected to
// Coder's sign-in on another origin and fails CORS. So the token is kept for
// this tab, taken out of the address bar, and sent on every request.
const TOKEN_PARAM = "coder_session_token";
const TOKEN_KEY = "xo-coder-token";
const coderToken = (() => {
  let token = null;
  try {
    const url = new URL(location.href);
    token = url.searchParams.get(TOKEN_PARAM);
    if (token) {
      url.searchParams.delete(TOKEN_PARAM);
      history.replaceState(history.state, "", url);
    }
  } catch { /* not in a browser */ }
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else token = sessionStorage.getItem(TOKEN_KEY);
  } catch { /* storage blocked: this page load still has the token */ }
  return token;
})();

/** Headers that keep Coder's app proxy signing requests in. */
export const coderHeaders = () => (coderToken ? { "Coder-Session-Token": coderToken } : {});

export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra); // storm extras: feature, count, sentence, what, confirm, summary
  }
}

/** The storm codes that mean "storm can't be used in this server right now" (UI-reference §0.3). */
export const STORM_DOWN = new Set(["engine_not_running", "engine_elsewhere", "engine_failed", "store_refused", "store_failed", "stream_not_running"]);

// How long a request may go unanswered before it gives up (if1 #6). A write that never settles
// would stay "Sending" with no Retry; a read that never settles would stall its poll for good.
export const WRITE_MS = 20000;
export const READ_MS = 30000;

/** One signal that aborts on the caller's signal or after `ms`; `timedOut()` says which. */
function deadline(signal, ms) {
  const ctl = new AbortController();
  let late = false;
  const t = setTimeout(() => { late = true; ctl.abort(); }, ms);
  const onAbort = () => ctl.abort();
  if (signal) {
    if (signal.aborted) ctl.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: ctl.signal,
    timedOut: () => late,
    done: () => { clearTimeout(t); if (signal) signal.removeEventListener("abort", onAbort); },
  };
}

export async function request(path, { method = "GET", body, signal, query, timeout } = {}) {
  let url = BASE + path;
  if (query) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v != null && v !== "") q.set(k, String(v));
    const qs = q.toString();
    if (qs) url += "?" + qs;
  }
  const ms = timeout ?? (method === "GET" ? READ_MS : WRITE_MS);
  const dl = deadline(signal, ms);
  try {
    return await exchange(url, method, body, dl.signal);
  } catch (err) {
    if (err && err.name === "AbortError" && dl.timedOut()) {
      throw new ApiError(0, "timeout", `XO didn't answer in ${Math.round(ms / 1000)} s.`);
    }
    throw err;
  } finally {
    dl.done();
  }
}

async function exchange(url, method, body, signal) {
  let res;
  try {
    res = await fetch(url, {
      method,
      signal,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...coderHeaders() },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      // A redirect here is Coder sending us to sign in, which fetch can't follow.
      redirect: "manual",
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(0, "network", "Can't reach the UI server. Is serve.py running?");
  }
  if (res.type === "opaqueredirect") {
    throw new ApiError(401, "signed_out", "Signed out of the workspace. Reopen this app from XO.");
  }
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    // Four error shapes (UI-reference §0.2): storm's {detail: {code, message, …extras}}, FastAPI's
    // 422 list, a plain-string detail, and serve.py's own.
    const d = data && data.detail;
    const code = (d && d.code) || (data && data.error) || `http_${res.status}`;
    let message = (d && d.message) || (typeof d === "string" ? d : "");
    if (Array.isArray(d)) message = d.map((e) => `${(e.loc || []).slice(1).join(".")}: ${e.msg}`).join("; ");
    if (!message) message = `${res.status} ${res.statusText || "error"}`;
    const extra = {};
    if (d && typeof d === "object" && !Array.isArray(d)) for (const k of ["feature", "count", "sentence", "what", "confirm", "summary"]) if (k in d) extra[k] = d[k];
    throw new ApiError(res.status, code, message, extra);
  }
  return data;
}

const enc = encodeURIComponent;
const get = (path, query) => request(path, { query });
const send = (method, path, body, query) => request(path, { method, body, query });

/** A fresh id for a write that must never happen twice (UI-reference §0.7). */
export const clientId = () => `ui_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

/** The largest seq: "the newest page" is the page just before it. */
export const NEWEST = 9007199254740991;

export const api = {
  // ── the engine, the runtimes, the router (U1 status, U2 settings) ─────────
  status: () => get("/chat/status"),
  runtimes: () => get("/chat/runtimes"),
  models: (runtime) => get(`/chat/runtimes/${enc(runtime)}/models`),
  router: () => get("/chat/router"),
  setRouter: (body) => send("PUT", "/chat/router", body),
  routerModels: () => get("/chat/router/models"),
  connectRouterModel: (body) => send("POST", "/chat/router/models", body),
  disconnectRouterModel: (provider) => send("DELETE", `/chat/router/models/${enc(provider)}`),

  // ── chats, messages, threads, hops, memory ────────────────────────────────
  chats: () => get("/chat/chats"),
  chat: (id) => get(`/chat/chats/${enc(id)}`),
  patchChat: (id, body) => send("PATCH", `/chat/chats/${enc(id)}`, body),
  /** {thread?, after_seq?, before_seq?, limit?} → {messages, next_after_seq, next_before_seq?} */
  messages: (chat, query = {}) => get(`/chat/chats/${enc(chat)}/messages`, query),
  post: (chat, { text, threadTs, clientId: cid }) =>
    send("POST", `/chat/chats/${enc(chat)}/messages`, { text, client_id: cid, ...(threadTs ? { thread_ts: threadTs } : {}) }),
  threads: (chat) => get(`/chat/chats/${enc(chat)}/threads`),
  thread: (chat, ts) => get(`/chat/chats/${enc(chat)}/threads/${enc(ts)}`),
  /** {resolved?, paused?: false, title?, label?, intelligence?} */
  patchThread: (chat, ts, body) => send("PATCH", `/chat/chats/${enc(chat)}/threads/${enc(ts)}`, body),
  hops: (chat, query = {}) => get(`/chat/chats/${enc(chat)}/hops`, query),
  memory: (chat) => get(`/chat/chats/${enc(chat)}/memory`),
  memoryFile: (chat, path) => get(`/chat/chats/${enc(chat)}/memory/${enc(path)}`),

  // ── sessions, turns, history ──────────────────────────────────────────────
  sessions: (query = {}) => get("/chat/sessions", query),
  session: (id) => get(`/chat/sessions/${enc(id)}`),
  patchSession: (id, body) => send("PATCH", `/chat/sessions/${enc(id)}`, body),
  active: () => get("/chat/active"),
  /** Stored frames, for history and resumes beyond the stream's reach. */
  events: (query = {}) => get("/chat/events", query),

  // ── plain chat and control ────────────────────────────────────────────────
  /** A plain chat's history lives in its CLI transcript, read by observation (UI-reference §2.1). */
  observedMessages: (nativeId, query = {}) => get(`/messages/${enc(nativeId)}`, query),
  prompt: (body) => send("POST", "/chat/prompt", body),
  abort: (sessionId) => send("POST", "/chat/abort", { session_id: sessionId }),

  // ── review and rules (U2) ─────────────────────────────────────────────────
  review: (query = {}) => get("/chat/review", query),
  reviewItem: (id) => get(`/chat/review/${enc(id)}`),
  decide: (id, body) => send("POST", `/chat/review/${enc(id)}/decision`, body),
  rules: (query = {}) => get("/chat/rules", query),
  addRule: (body) => send("POST", "/chat/rules", body),
  revokeRule: (id) => send("DELETE", `/chat/rules/${enc(id)}`),

  // ── sub-agent runs (U2) ───────────────────────────────────────────────────
  runs: (session, query = {}) => get(`/chat/sessions/${enc(session)}/runs`, query),
  run: (id) => get(`/chat/runs/${enc(id)}`),
  transcript: (id, query = {}) => get(`/chat/runs/${enc(id)}/transcript`, query),
  stopRun: (id) => send("POST", `/chat/runs/${enc(id)}/stop`),
  stopRuns: (session) => send("POST", `/chat/sessions/${enc(session)}/runs/stop`),

  // ── worktrees (U2) ────────────────────────────────────────────────────────
  worktrees: (chat) => get("/chat/worktrees", chat ? { chat } : undefined),
  removeWorktree: (chat, ts, confirm) => send("DELETE", `/chat/worktrees/${enc(chat)}/${enc(ts)}`, undefined, confirm ? { confirm } : undefined),

  // ── jobs ─────────────────────────────────────────────────────────────────
  schedules: () => get("/schedules"),
  schedule: (id) => get(`/schedules/${enc(id)}`),
  scheduleRuns: (id, query = {}) => get(`/schedules/${enc(id)}/runs`, query),

  // ── projects ──────────────────────────────────────────────────────────────
  /** A text file inside a project, for the file viewer: {name, kind, size_bytes, truncated, content, …}. */
  projectFile: (project, relativePath) => get(`/xo-projects/${enc(project)}/file`, { relative_path: relativePath }),
  /** Where xo-projects live: {roots: {...}, default}. Never hard-code the root. */
  workspaceConfig: () => get("/config/workspace"),
  /** Scaffold a new xo-project (xo-cowork-api). 409 when the folder exists. */
  createProject: ({ path, displayName, description }) =>
    send("POST", "/files/mkdir", { path, scaffold: true, display_name: displayName, ...(description ? { description } : {}) }),

  // ── the one global stream ─────────────────────────────────────────────────
  streamUrl: () => `${BASE}/chat/stream`,
};

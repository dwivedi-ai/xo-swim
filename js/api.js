// Thin client for the projects-chat API (same origin; serve.py proxies /api).

const BASE = "/api/projects-chat";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = "GET", body, signal, base = BASE } = {}) {
  let res;
  try {
    res = await fetch(base + path, {
      method,
      signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(0, "network", "Can't reach the UI server. Is serve.py running?");
  }
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const d = data && data.detail;
    const code = (d && d.code) || `http_${res.status}`;
    let message = (d && d.message) || (typeof d === "string" ? d : "");
    if (Array.isArray(d)) message = d.map((e) => e.msg).join("; ");
    if (!message) message = `${res.status} ${res.statusText || "error"}`;
    throw new ApiError(res.status, code, message);
  }
  return data;
}

const enc = encodeURIComponent;

export const api = {
  status: () => request("/status"),
  chats: () => request("/chats"),
  messages: (chat, { thread, after, limit } = {}) => {
    const q = new URLSearchParams();
    if (thread) q.set("thread", thread);
    if (after) q.set("after", after);
    if (limit) q.set("limit", String(limit));
    const qs = q.toString();
    return request(`/chats/${enc(chat)}/messages${qs ? "?" + qs : ""}`);
  },
  post: (chat, text, threadTs) =>
    request(`/chats/${enc(chat)}/messages`, {
      method: "POST",
      body: threadTs ? { text, thread_ts: threadTs } : { text },
    }),
  threads: (chat) => request(`/chats/${enc(chat)}/threads`),
  thread: (chat, ts) => request(`/chats/${enc(chat)}/threads/${enc(ts)}`),
  /** Where xo-projects live: {roots: {...}, default}. Never hard-code the root. */
  workspaceConfig: () => request("/api/config/workspace", { base: "" }),
  /** Scaffold a new xo-project (xo-cowork-api). 409 when the folder exists. */
  createProject: ({ path, displayName, description }) =>
    request("/api/files/mkdir", {
      base: "",
      method: "POST",
      body: { path, scaffold: true, display_name: displayName, ...(description ? { description } : {}) },
    }),
  streamUrl: (chat, after) =>
    `${BASE}/chats/${enc(chat)}/stream${after ? "?after=" + enc(after) : ""}`,
};

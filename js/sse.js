// One Server-Sent Events connection, read with fetch so it can send headers (the Coder session
// token, Last-Event-ID) and resume exactly where it left off.
//
// Storm's global stream (UI-reference §1): every frame has an `event:` name and a JSON envelope
// in `data:`. A frame from a stored event carries an `id:` ("N", or "N:k" for frame k of seq N);
// sending the last one back as Last-Event-ID resumes after it, losing nothing. Live-only frames
// (deltas, heartbeats, snapshots) carry no id.

/** A pure, incremental SSE parser (the WHATWG rules we need). feed(text) → frames. */
export function createParser() {
  let buf = "";
  let event = "", data = [], id = null, sawData = false;
  let lastId = null;
  const out = [];
  function line(l) {
    if (l === "") {
      if (sawData) out.push({ event: event || "message", data: data.join("\n"), id, lastId });
      event = ""; data = []; id = null; sawData = false;
      return;
    }
    if (l[0] === ":") return; // a comment
    const i = l.indexOf(":");
    const field = i < 0 ? l : l.slice(0, i);
    let value = i < 0 ? "" : l.slice(i + 1);
    if (value[0] === " ") value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") { data.push(value); sawData = true; }
    else if (field === "id" && !value.includes("\0")) { id = value; lastId = value; }
  }
  return {
    feed(text) {
      buf += text;
      let start = 0;
      for (let i = 0; i < buf.length; i++) {
        const c = buf[i];
        if (c === "\n" || c === "\r") {
          // a \r at the very end may be the first half of \r\n: wait for the next chunk
          if (c === "\r" && i === buf.length - 1) break;
          line(buf.slice(start, i));
          if (c === "\r" && buf[i + 1] === "\n") i++;
          start = i + 1;
        }
      }
      buf = buf.slice(start);
      return out.splice(0);
    },
    get lastId() { return lastId; },
  };
}

const RETRY_MAX_MS = 15000;
const WATCHDOG_MS = 45000; // the server sends a heartbeat after 15 s of silence
const STALE_MS = 25000;    // after a sleep: no byte for this long means the connection is gone
const DOWN_AFTER = 3;      // failed attempts in a row before we say the stream is down

/**
 * A resilient stream. One connection at a time: a new attempt aborts the old one, and frames from
 * a superseded attempt are dropped.
 *   new SSEStream(url, { headers, lastId, onFrame(frame), onState(state, info), onReset(reset) })
 * frame = { type, id, envelope }   (envelope = the parsed `data`: {type, id, seq, ts, chat_id, …, data})
 * state = "connecting" | "live" | "reconnecting" | "down" | "closed"
 * onReset({reason, from_seq}) is awaited for `retention` and `ahead`: reload state there, then the
 * stream resumes from `from_seq`. A `slow` reset just reconnects from the last frame received.
 * Before any stored frame has an id, the snapshot's `seq` is the resume point, so a drop in a quiet
 * Space still resumes exactly where the server was.
 */
export class SSEStream {
  constructor(url, { headers = () => ({}), lastId = null, onFrame, onState, onReset, fetchImpl } = {}) {
    this.url = url;
    this.headers = headers;
    this.lastId = lastId;
    this.onFrame = onFrame || (() => {});
    this.onState = onState || (() => {});
    this.onReset = onReset || (async () => {});
    this.fetch = fetchImpl || ((...a) => globalThis.fetch(...a));
    this.state = null;
    this.fails = 0;
    this.closed = false;
    this.ctl = null;
    this.gen = 0;
    this.timer = null;
    this.watch = null;
    this.lastChunk = 0;
  }

  start() { this.connect(); return this; }

  setState(s, info) { if (s !== this.state || info) { this.state = s; this.onState(s, info || null); } }

  async connect() {
    if (this.closed) return;
    clearTimeout(this.timer); this.timer = null;
    clearTimeout(this.watch);
    if (this.ctl) this.ctl.abort(); // never two connections
    const gen = ++this.gen;
    const ctl = new AbortController();
    this.ctl = ctl;
    const current = () => !this.closed && this.gen === gen;
    // the watchdog runs from the start: a connect that never answers is retried too
    const kick = () => { clearTimeout(this.watch); this.watch = setTimeout(() => ctl.abort(), WATCHDOG_MS); };
    kick();
    this.setState(this.fails ? "reconnecting" : "connecting");
    let res;
    try {
      const h = { Accept: "text/event-stream", ...this.headers() };
      if (this.lastId) h["Last-Event-ID"] = this.lastId;
      res = await this.fetch(this.url, { headers: h, signal: ctl.signal, cache: "no-store", redirect: "manual" });
    } catch {
      if (!current()) return;
      return this.retry({ code: "network", message: "Can't reach the UI server." });
    }
    if (!current()) return;
    if (res.type === "opaqueredirect") return this.retry({ code: "signed_out", message: "Signed out of the workspace. Reopen this app from XO." });
    if (!res.ok) {
      let detail = null;
      try { detail = (await res.json()).detail; } catch { /* not JSON */ }
      if (!current()) return;
      const code = (detail && detail.code) || `http_${res.status}`;
      const message = (detail && detail.message) || (typeof detail === "string" ? detail : `${res.status}`);
      // A resume point the server can't read: start again from now, never retry it as is.
      if (res.status === 400 && code === "bad_last_event_id") { this.lastId = null; return this.retry({ code, message }, 0); }
      return this.retry({ code, message, status: res.status });
    }
    const parser = createParser();
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let healthy = false, reset = null;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (!current()) { try { reader.cancel(); } catch { /* gone */ } return; }
        if (done) break;
        kick();
        this.lastChunk = Date.now();
        for (const f of parser.feed(dec.decode(value, { stream: true }))) {
          if (!healthy) { healthy = true; this.fails = 0; this.setState("live"); }
          let env = null;
          try { env = JSON.parse(f.data); } catch { continue; }
          if (f.id) this.lastId = f.id;
          if (f.event === "reset") { reset = (env && env.data) || {}; continue; }
          if (f.event === "snapshot" && !this.lastId && env && env.data && env.data.seq != null) this.lastId = String(env.data.seq);
          this.onFrame({ type: f.event, id: f.id, envelope: env });
          if (!current()) return;
        }
      }
    } catch { /* aborted by the watchdog, by nudge() or close(), or the connection broke */ }
    if (!current()) return;
    clearTimeout(this.watch);
    if (reset) {
      if (reset.reason === "retention" || reset.reason === "ahead") {
        this.setState("reconnecting", { reset: reset.reason });
        try { await this.onReset(reset); } catch { /* reload failed; resume anyway */ }
        if (!current()) return;
        this.lastId = reset.from_seq != null ? String(reset.from_seq) : null;
      } else if (reset.from_seq != null) {
        this.lastId = String(reset.from_seq);
      }
      return this.retry(null, 0);
    }
    // The server ended the stream (it restarted, or a proxy closed it): resume from the last id.
    this.retry(healthy ? null : { code: "ended", message: "The stream ended." }, healthy ? 300 : undefined);
  }

  retry(err, delay) {
    if (this.closed) return;
    if (err) this.fails += 1;
    const wait = delay ?? Math.min(RETRY_MAX_MS, 1000 * 2 ** Math.max(0, this.fails - 1)) + Math.random() * 400;
    this.setState(this.fails >= DOWN_AFTER ? "down" : "reconnecting", err);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this.connect(); }, wait);
  }

  /**
   * The page became visible or the network came back: retry now instead of waiting out the backoff,
   * and drop a connection that went silent while the machine slept. A healthy connection is kept.
   */
  nudge() {
    if (this.closed) return;
    if (this.timer) { this.connect(); return; }
    if (this.state === "live" && Date.now() - this.lastChunk > STALE_MS) this.connect();
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    clearTimeout(this.watch);
    if (this.ctl) this.ctl.abort();
    this.setState("closed");
  }
}

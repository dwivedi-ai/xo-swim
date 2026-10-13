// Live updates for one chat: Server-Sent Events with reconnect/backoff,
// falling back to polling every 4s after repeated failures (and trying SSE
// again every 30s while polling).

import { api } from "./api.js";

const POLL_MS = 4000;
const RETRY_SSE_MS = 30000;
const FAILS_BEFORE_POLL = 3;

export class ChatStream {
  /**
   * @param {string} chat
   * @param {object} h handlers: getAfter() -> last message id, onMessage(row),
   *   onThread(thread), onHeartbeat({coordinator_busy}), onMode("live"|"reconnecting"|"polling")
   */
  constructor(chat, h) {
    this.chat = chat;
    this.h = h;
    this.es = null;
    this.fails = 0;
    this.closed = false;
    this.timer = null;
    this.pollTimer = null;
    this.mode = null;
  }

  start() {
    this.connect();
    return this;
  }

  setMode(mode) {
    if (mode !== this.mode) {
      this.mode = mode;
      this.h.onMode?.(mode);
    }
  }

  connect() {
    if (this.closed) return;
    this.clearTimers();
    const es = new EventSource(api.streamUrl(this.chat, this.h.getAfter()));
    this.es = es;
    let healthy = false;
    const ok = () => {
      if (!healthy) {
        healthy = true;
        this.fails = 0;
        this.stopPolling();
        this.setMode("live");
      }
    };
    es.onopen = ok;
    es.addEventListener("message", (ev) => {
      ok();
      const row = parse(ev.data);
      if (row) this.h.onMessage?.(row);
    });
    es.addEventListener("thread", (ev) => {
      ok();
      const t = parse(ev.data);
      if (t) this.h.onThread?.(t);
    });
    es.addEventListener("heartbeat", (ev) => {
      ok();
      const hb = parse(ev.data);
      if (hb) this.h.onHeartbeat?.(hb);
    });
    es.onerror = () => {
      if (this.closed || this.es !== es) return;
      es.close();
      this.es = null;
      this.fails += 1;
      if (this.fails >= FAILS_BEFORE_POLL) {
        this.startPolling();
        this.timer = setTimeout(() => this.connect(), RETRY_SSE_MS);
      } else {
        this.setMode("reconnecting");
        const delay = Math.min(15000, 1000 * 2 ** (this.fails - 1)) + Math.random() * 400;
        this.timer = setTimeout(() => this.connect(), delay);
      }
    };
  }

  startPolling() {
    this.setMode("polling");
    if (this.pollTimer) return;
    const tick = async () => {
      if (this.closed) return;
      try {
        const [m, t] = await Promise.all([
          api.messages(this.chat, { after: this.h.getAfter() }),
          api.threads(this.chat),
        ]);
        for (const row of m.messages || []) this.h.onMessage?.(row);
        for (const th of t.threads || []) this.h.onThread?.(th, { polled: true });
      } catch {
        /* keep polling */
      }
    };
    tick();
    this.pollTimer = setInterval(tick, POLL_MS);
  }

  stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  clearTimers() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  close() {
    this.closed = true;
    this.clearTimers();
    this.stopPolling();
    if (this.es) this.es.close();
    this.es = null;
  }
}

function parse(data) {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

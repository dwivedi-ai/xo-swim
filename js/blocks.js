// Storm's turns and their blocks, as the server sends them (UI-reference §1.8). The server builds
// every block (grouping, headers, row wording); this store only applies frames, so a turn looks
// the same whether it was watched live or loaded from history. Pure: no DOM, no network.
//
// The client rules (PR 8 "For the UI"):
//   1. block.started creates the block; a second one for the same id only adds its index.
//   2. block.updated applies: text `append` and row `output_append` are appended; the rest replaces.
//   3. block.finished replaces the block with its final form.
//   4. snapshot replaces each listed turn's open blocks.
//   5. turn.finished drops that turn's blocks that never finished (they only streamed).
//   6. A turn that ends without turn.finished drops its open blocks too: a `session` frame for its
//      session with status cold or parked, or a new turn.started in the same session.
//   7. (the stream) keeps the last SSE id and sends it back as Last-Event-ID.

const ENDED = new Set(["cold", "parked"]);

/**
 * A row patch is the whole row (the server sends `_row_view` minus output), so it REPLACES the row:
 * live-only keys (waiting, streams, progress, pending) must not outlive the state that had them.
 * Only the command output carries over: `output_append` is appended to it, `output` replaces it.
 */
function patchRow(old, p) {
  const row = { ...p };
  delete row.output_append;
  if (p.output != null) row.output = p.output;
  else if (p.output_append != null) row.output = (old && old.output ? old.output : "") + p.output_append;
  else if (old && old.output != null) row.output = old.output;
  return row;
}

export function createTurns() {
  const turns = new Map(); // turn id → Turn

  function turnOf(env) {
    const id = env.turn_id;
    if (!id) return null;
    let t = turns.get(id);
    if (!t) {
      t = { id, session: env.session_id || null, chat: env.chat_id || null, thread: env.thread_ts || null,
        seq: env.seq ?? null, at: env.ts || null, origin: null, wakes: [], status: "running", end: null,
        blocks: new Map(), lastSeq: env.seq ?? 0 };
      turns.set(id, t);
    }
    if (env.session_id && !t.session) t.session = env.session_id;
    if (env.chat_id && !t.chat) t.chat = env.chat_id;
    if (env.thread_ts && !t.thread) t.thread = env.thread_ts;
    if (env.seq != null) {
      if (t.seq == null || env.seq < t.seq) { t.seq = env.seq; t.at = env.ts || t.at; }
      if (env.seq > t.lastSeq) t.lastSeq = env.seq;
    }
    return t;
  }

  /** Drop a turn's open (never finished) blocks. */
  function dropOpen(t) {
    for (const [id, b] of t.blocks) if (!b.done) t.blocks.delete(id);
  }

  function apply(frame) {
    const env = frame.envelope || frame;
    const type = frame.type || env.type;
    const d = env.data || {};
    switch (type) {
      case "turn.started": {
        const t = turnOf(env);
        if (!t) return null;
        t.origin = d.origin || t.origin;
        if (Array.isArray(d.wakes)) t.wakes = [...new Set([...t.wakes, ...d.wakes])];
        // rule 6: an earlier turn of this session that never finished has ended
        for (const o of turns.values()) {
          if (o !== t && o.session && o.session === t.session && o.status === "running" && (o.lastSeq || 0) < (env.seq ?? Infinity)) {
            o.status = "ended"; dropOpen(o);
          }
        }
        return t.id;
      }
      case "turn.finished": {
        const t = turnOf(env);
        if (!t) return null;
        t.status = d.status || "finished";
        t.end = d;
        if (Array.isArray(d.wakes)) t.wakes = [...new Set([...t.wakes, ...d.wakes])];
        dropOpen(t); // rule 5
        return t.id;
      }
      case "turn.stopped": {
        const t = turnOf(env);
        if (!t) return null;
        t.stopped = d;
        return t.id;
      }
      case "session": {
        // rule 6: the session's process ended; its running turn is over. Only a turn older than this
        // frame: history applied after live frames carries old "cold" rows that must not end a turn
        // running now.
        if (!ENDED.has(d.status) || !env.session_id || env.seq == null) return null;
        let changed = null;
        for (const t of turns.values()) {
          if (t.session === env.session_id && t.status === "running" && (t.seq ?? Infinity) < env.seq) { t.status = "ended"; dropOpen(t); changed = t.id; }
        }
        return changed;
      }
      case "block.started": {
        const t = turnOf(env);
        const b = d.block;
        if (!t || !b || !b.id) return null;
        const old = t.blocks.get(b.id);
        if (old) {
          // rule 1: only its index; a finished block is never reopened by an older frame
          if (b.index != null) old.index = b.index;
        } else if (t.status === "running" || env.seq != null) {
          t.blocks.set(b.id, { ...b, rows: b.rows ? b.rows.map((r) => ({ ...r })) : b.rows, done: false, n: t.blocks.size });
        }
        return t.id;
      }
      case "block.updated": {
        const t = turnOf(env);
        if (!t || !d.block_id) return null;
        let b = t.blocks.get(d.block_id);
        if (!b) {
          if (t.status !== "running") return null;
          b = { id: d.block_id, type: d.type, index: null, done: false, n: t.blocks.size };
          t.blocks.set(b.id, b);
        }
        if (b.done) return null; // nothing updates a finished block
        if (d.append != null) b.text = (b.text || "") + d.append;
        if (d.header != null) b.header = d.header;
        if (d.steps) b.steps = d.steps;
        if (d.items) b.items = d.items;
        if (d.rows) {
          const rows = b.rows ? [...b.rows] : [];
          for (const p of d.rows) {
            const i = rows.findIndex((r) => r.call_id === p.call_id);
            if (i < 0) rows.push(patchRow(null, p)); else rows[i] = patchRow(rows[i], p);
          }
          b.rows = rows;
        }
        return t.id;
      }
      case "block.finished": {
        const t = turnOf(env);
        const b = d.block;
        if (!t || !b || !b.id) return null;
        const old = t.blocks.get(b.id);
        // a row's live command output is kept when the final form has none (claude: output only at the end)
        const rows = b.rows ? b.rows.map((r) => {
          const o = old && old.rows ? old.rows.find((x) => x.call_id === r.call_id) : null;
          return o && o.output && r.output == null ? { ...r, output: o.output } : { ...r };
        }) : b.rows;
        t.blocks.set(b.id, { ...b, rows, done: true, n: old ? old.n : t.blocks.size }); // rule 3
        return t.id;
      }
      case "snapshot": {
        // rule 4: each listed turn's open blocks are replaced by the snapshot's
        const changed = [];
        for (const s of d.turns || []) {
          const t = turnOf({ turn_id: s.turn_id, session_id: s.session_id, chat_id: s.chat_id, thread_ts: s.thread_ts, seq: s.seq });
          if (!t) continue;
          t.status = "running";
          t.held = s.held || [];
          dropOpen(t);
          for (const b of s.blocks || []) {
            const old = t.blocks.get(b.id);
            if (old && old.done) continue;
            t.blocks.set(b.id, { ...b, rows: b.rows ? b.rows.map((r) => ({ ...r })) : b.rows, done: false, n: old ? old.n : t.blocks.size });
          }
          changed.push(t.id);
        }
        return changed.length ? changed : null;
      }
      default:
        return null;
    }
  }

  /** A turn's blocks in order: by index, then (still streaming, no index) in arrival order. */
  function blocksOf(t) {
    return [...t.blocks.values()].sort((a, b) => (a.index ?? 1e9) - (b.index ?? 1e9) || a.n - b.n);
  }

  return {
    apply,
    get: (id) => turns.get(id) || null,
    blocksOf,
    /** Turns matching a filter, oldest first (by the seq of their first frame). */
    list(pred = () => true) {
      return [...turns.values()].filter(pred).sort((a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity));
    },
    /** The running turn of a session, if any. */
    running(session) {
      for (const t of turns.values()) if (t.session === session && t.status === "running") return t;
      return null;
    },
    /**
     * Keep memory bounded: drop finished turns of sessions not in `keep`, beyond the newest `perSession`
     * of each, and never more than `max` finished turns in all. Running turns always stay. Returns
     * the sessions that lost turns.
     */
    prune(keep = new Set(), { perSession = 2, max = 300 } = {}) {
      const done = [...turns.values()].filter((t) => t.status !== "running").sort((a, b) => (b.lastSeq || 0) - (a.lastSeq || 0));
      const seen = new Map();
      const trimmed = new Set();
      let kept = 0;
      for (const t of done) {
        const n = (seen.get(t.session) || 0) + 1;
        seen.set(t.session, n);
        if ((keep.has(t.session) || n <= perSession) && kept < max) { kept++; continue; }
        turns.delete(t.id);
        trimmed.add(t.session);
      }
      return trimmed; // the sessions that lost turns: read them again when shown
    },
    /** Whether any turn of this session is held (for reloading its history after a prune). */
    hasSession: (session) => [...turns.values()].some((t) => t.session === session),
    /** The turn that took a wake (e.g. `msg:<cmsg>` or `msg:prompt:<client_id>`). */
    byWake(wake) {
      for (const t of turns.values()) if (t.wakes.includes(wake)) return t;
      return null;
    },
    size: () => turns.size,
  };
}

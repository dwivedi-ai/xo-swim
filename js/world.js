// The world the UI renders: projects, threads and what needs you, normalised
// from XO Space's storm API (js/storm.js). Views never call the API directly;
// they subscribe to the world and call world.act.*.
//
//   import { createWorld } from "./world.js";
//   const world = createWorld();
//   world.subscribe((w) => render(w));    // every change
//   world.onEvent((e) => pulse(e));       // discrete events (state change, new ask, message, done)
//   world.act.reply(threadId, "yes");     // posts to the thread
//
// The world only READS on its own (GETs and the one global stream). It writes
// only when the person acts (send, reply, resolve, decide).

import { stormSource } from "./storm.js";

export const STATES = ["needs_approval", "needs_reply", "paused", "failed", "working", "done", "resolved"];
// paused (storm's loop breaker) waits on the person too: a reply in the thread resumes it.
export const WAITING = (s) => s === "needs_reply" || s === "needs_approval" || s === "paused";

export function createWorld() {
  const subs = new Set();
  const evs = new Set();
  const state = { projects: [], threads: [], activity: [], busy: {}, loaded: false, error: null, now: Date.now() };
  const emit = () => { state.now = Date.now(); for (const f of subs) f(state); };
  const event = (e) => {
    e.at = e.at || Date.now();
    state.activity.unshift(e);
    state.activity.length = Math.min(state.activity.length, 200);
    for (const f of evs) f(e, state);
  };

  const source = stormSource(state, emit, event);

  return {
    get state() { return state; },
    subscribe(fn) { subs.add(fn); if (state.loaded) fn(state); return () => subs.delete(fn); },
    onEvent(fn) { evs.add(fn); return () => evs.delete(fn); },
    act: source.act,
    thread: (id) => state.threads.find((t) => t.id === id),
    project: (id) => state.projects.find((p) => p.id === id),
    waiting: () => state.threads.filter((t) => WAITING(t.state)),
  };
}

export function ago(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function esc(v) {
  return String(v ?? "").replace(/[&<>"'`]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" })[c]);
}

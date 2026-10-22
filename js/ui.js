// Converged · small shared helpers: icons, a keyed DOM reconciler, time words, smooth disclosure,
// reduced motion and the optional soft sounds (off by default).
import { esc } from "./world.js";

const I = (d, extra = "") =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;

export const ICON = {
  project: I('<path d="M20.5 7.6 12 3 3.5 7.6v8.8L12 21l8.5-4.6z"/><path d="M3.5 7.6 12 12.2l8.5-4.6M12 12.2V21"/>'),
  globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  send: I('<path d="M12 19V5M5 12l7-7 7 7"/>', ' stroke-width="2.2"'),
  thread: I('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
  branch: I('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 5-6 4-12 8"/>'),
  back: I('<path d="M15 18l-6-6 6-6"/>', ' stroke-width="2"'),
  arrow: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  down: I('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  check: I('<path class="tk" d="M5 12.5l4.5 4.5L19 7.5"/>', ' stroke-width="2.2"'),
  rewind: I('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  copy: I('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
  retry: I('<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/>'),
  edit: I('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/>'),
  chevron: I('<path d="M6 9l6 6 6-6"/>'),
  list: I('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  lock: I('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  stop: I('<rect x="7" y="7" width="10" height="10" rx="2.2" fill="currentColor" stroke="none"/>'),
  play: I('<path d="M7 5v14l11-7z"/>'),
  sound: I('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9a4 4 0 0 1 0 6"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>', ' stroke-width="2"'),
  home: I('<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>'),
  right: I('<path d="M9 6l6 6-6 6"/>', ' stroke-width="2"'),
  clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  menu: I('<path d="M4 7h16M4 12h16M4 17h10"/>'),
  eye: I('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>'),
  clip: I('<path d="M20.5 11.5 12.6 19.4a5 5 0 0 1-7.1-7.1l8.2-8.2a3.3 3.3 0 0 1 4.7 4.7l-8.2 8.2a1.7 1.7 0 0 1-2.4-2.4l7.5-7.5"/>'),
  doc: I('<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4M9.5 12h6M9.5 15.5h6"/>'),
  image: I('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 15.5-4.8-4.8L6.5 19.5"/>'),
  folder: I('<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8A1.5 1.5 0 0 1 20.5 9v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z"/>'),
  moon: I('<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>'),
  spark: I('<path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.6 2.6M15.4 15.4 18 18M18 6l-2.6 2.6M8.6 15.4 6 18"/>'),
  bolt: I('<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z"/>'),
  warm: I('<path d="M12 21a6 6 0 0 0 6-6c0-3.5-2.5-5.5-3.5-8.5-.6 2-1.8 3-3 3.5C10 8 9.5 6 10 3.5 7.5 5.5 6 9 6 15a6 6 0 0 0 6 6z"/>'),
  gear: I('<path d="M10.4 3.6h3.2l.5 2.4 1.7 1 2.3-.8 1.6 2.8-1.8 1.6v2l1.8 1.6-1.6 2.8-2.3-.8-1.7 1-.5 2.4h-3.2l-.5-2.4-1.7-1-2.3.8-1.6-2.8L6.1 13v-2L4.3 9.4l1.6-2.8 2.3.8 1.7-1z"/><circle cx="12" cy="12" r="2.6"/>'),
  sliders: I('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  gem: I('<path d="M6.5 4h11l3.5 5-9 11L3 9z"/><path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5"/>'),
  ripe: I('<path d="M12 7c-4 0-7 2.8-7 7s3 7 7 7 7-2.8 7-7-3-7-7-7z"/><path d="M12 7c0-2 1-3.5 3-4"/>'),
  loop: I('<path d="M4 12a5 5 0 0 1 5-5h9M15 4l3 3-3 3"/><path d="M20 12a5 5 0 0 1-5 5H6M9 20l-3-3 3-3"/>'),
  pause: I('<path d="M9 6v12M15 6v12"/>', ' stroke-width="2"'),
  hourglass: I('<path d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 5 8 8.5s-8 3.5-8 8.5M16 3.5c0 2.5-2 4-4 5"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.8 12h2M19.2 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  replay: I('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/><path d="M10.5 9.2v5.6l4.6-2.8z" fill="currentColor" stroke="none"/>'),
  rule: I('<path d="M5 5h14M5 10h14M5 15h8"/><path d="M16 15.5l1.8 1.8L21 14"/>'),
  shield: I('<path d="M12 3.5 19 6v5.6c0 4.2-2.9 7.5-7 8.9-4.1-1.4-7-4.7-7-8.9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>'),
  key: I('<circle cx="8" cy="15" r="3.5"/><path d="M10.5 12.5 19 4M16 7l2.5 2.5M14 9l2 2"/>'),
  router: I('<circle cx="5.5" cy="12" r="2"/><circle cx="18.5" cy="6" r="2"/><circle cx="18.5" cy="18" r="2"/><path d="M7.5 12h4l5-5M11.5 12l5 5"/>'),
};

/** The "next" glyph: the X's chevron from the XO mark, as a single stroke. */
export const NEXT_GLYPH =
  '<svg class="nx-g" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 4.5 15.5 12 8 19.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="butt" stroke-linejoin="miter"/></svg>';

/** Effort dial: how much of you an ask takes. A pie, not a spinner: Glance a sliver, Decide half, Think whole. */
export function dial(effort) {
  const f = { glance: 0.2, decide: 0.5, think: 1 }[effort] ?? 0.5;
  const r = 5, cx = 8, cy = 8;
  let pie;
  if (f >= 1) pie = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor"/>`;
  else {
    const a = f * 2 * Math.PI - Math.PI / 2;
    const x = (cx + r * Math.cos(a)).toFixed(2), y = (cy + r * Math.sin(a)).toFixed(2);
    pie = `<path d="M${cx} ${cy}V${cy - r}A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y}Z" fill="currentColor"/>`;
  }
  return `<svg class="dial d-${effort}" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">` +
    `<circle cx="${cx}" cy="${cy}" r="7" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1.3"/>${pie}</svg>`;
}


export const XO =
  '<svg class="xo-mark" viewBox="20 155 460 190" aria-hidden="true">' +
  '<polyline class="x" stroke-width="34" fill="none" points="36.99 165.84 118.47 247.31 31.16 334.61"/>' +
  '<polyline class="x" stroke-width="34" fill="none" points="244.91 165.84 163.44 247.31 250.74 334.61"/>' +
  '<polyline class="o" stroke-width="34" fill="none" points="328.12 165.06 246.65 246.53 333.95 333.84"/>' +
  '<polyline class="o" stroke-width="34" fill="none" points="380.51 165.06 461.99 246.53 374.68 333.84"/></svg>';

/**
 * Smooth height change: measure, mutate, measure, animate the height
 * continuously while the new content cross-fades in. No jumps.
 */
export function morph(el, mutate, { duration = 320, fade = null } = {}) {
  if (!el) { mutate(); return; }
  const h0 = el.getBoundingClientRect().height;
  mutate();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const h1 = el.getBoundingClientRect().height;
  if (Math.abs(h1 - h0) > 1) {
    el.getAnimations?.().forEach((a) => a.id === "morph" && a.cancel());
    const a = el.animate([{ height: `${h0}px`, overflow: "hidden" }, { height: `${h1}px`, overflow: "hidden" }], { duration, easing: EASE });
    a.id = "morph";
  }
  if (fade) fade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.round(duration * 0.8), easing: "ease-out", delay: Math.round(duration * 0.15), fill: "backwards" });
}

/** One easing for every size change: continuous, no front-loaded jump (a frame never moves more than ~40 px). */
export const EASE = "cubic-bezier(.3,.6,.25,1)";
export const EXPAND_MS = 320;

/**
 * Smooth disclosure (#20): the body's height animates continuously from its old
 * to its new size over ~320 ms while its contents cross-fade. Opening renders the
 * contents first (so they can be measured); closing animates, then removes them
 * from layout (so folded text is never counted, read or tabbed to).
 * box: the element that carries .is-open; body: the element whose height moves.
 */
export function expand(box, body, open, { onStep = null, frame = null } = {}) {
  if (!box || !body) return;
  if (frame) { expandFrame(box, body, open, frame, onStep); return; }
  const was = box.classList.contains("is-open");
  if (was === open && !body._closing) return;
  const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  body.getAnimations?.().forEach((a) => a.cancel());
  const inner = body.firstElementChild;
  const h0 = was && !body.hidden ? body.getBoundingClientRect().height : 0;
  body._closing = false;
  if (open) {
    body.hidden = false;
    box.classList.add("is-open");
    if (rm) return;
    const h1 = body.getBoundingClientRect().height;
    const a = body.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: EXPAND_MS, easing: EASE });
    body.style.overflow = "hidden";
    a.onfinish = a.oncancel = () => { body.style.overflow = ""; };
    if (inner) inner.animate([{ opacity: 0, transform: "translateY(-3px)" }, { opacity: 1, transform: "none" }], { duration: 220, delay: 60, easing: "ease-out", fill: "backwards" });
  } else {
    box.classList.remove("is-open");
    if (rm || !h0) { body.hidden = true; return; }
    body._closing = true;
    body.style.overflow = "hidden";
    if (inner) inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-in", fill: "forwards" });
    const a = body.animate([{ height: `${h0}px` }, { height: "0px" }], { duration: EXPAND_MS - 40, easing: EASE });
    a.onfinish = () => { if (body._closing) { body.hidden = true; body._closing = false; } body.style.overflow = ""; inner?.getAnimations?.().forEach((x) => x.cancel()); };
  }
  if (onStep) { const t0 = performance.now(); const f = () => { onStep(); if (performance.now() - t0 < EXPAND_MS + 40) requestAnimationFrame(f); }; requestAnimationFrame(f); }
}

/**
 * The same, for a card with a capped height (the thread's own card): the card's
 * frame animates from its old to its new height, so the motion stays continuous
 * even when the card hits its cap and its body starts to scroll.
 */
function expandFrame(box, body, open, frame, onStep) {
  const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  frame.getAnimations?.().forEach((a) => a.id === "xf" && a.cancel());
  const inner = body.firstElementChild;
  const h0 = frame.getBoundingClientRect().height;
  if (open) { body.hidden = false; box.classList.add("is-open"); }
  else { box.classList.remove("is-open"); body.hidden = true; }
  if (rm) return;
  const h1 = frame.getBoundingClientRect().height;
  if (!open) { body.hidden = false; }
  frame.style.overflow = "hidden";
  const a = frame.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: EXPAND_MS, easing: EASE });
  a.id = "xf";
  if (open && inner) inner.animate([{ opacity: 0, transform: "translateY(-3px)" }, { opacity: 1, transform: "none" }], { duration: 220, delay: 60, easing: "ease-out", fill: "backwards" });
  if (!open && inner) inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
  a.onfinish = a.oncancel = () => { frame.style.overflow = ""; if (!box.classList.contains("is-open")) body.hidden = true; inner?.getAnimations?.().forEach((x) => x.cancel()); };
  if (onStep) { const t0 = performance.now(); const f = () => { onStep(); if (performance.now() - t0 < EXPAND_MS + 40) requestAnimationFrame(f); }; requestAnimationFrame(f); }
}

/** mm:ss for a countdown. */
export const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
/** "3 h 12 m" / "42 m" for how long something has waited. */
export function waited(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const RM = matchMedia("(prefers-reduced-motion: reduce)");
export const wait = (ms) => new Promise((r) => setTimeout(r, RM.matches ? 0 : ms));

export function clock(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
export function dayOf(ms, now = Date.now()) {
  const d = new Date(ms), t = new Date(now), y = new Date(now - 86400000);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
export function short(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(ms).toLocaleDateString(undefined, { weekday: "short" });
}
export function elapsed(secs) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ${String(secs % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
export const plain = (md) => String(md || "").replace(/```[\s\S]*?```/g, "[code]").replace(/[*_`#>]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();

/**
 * Keyed reconcile: items [{key, html}] → children of `box`. Unchanged items
 * keep their element (so animations, focus and selection survive a tick);
 * new ones get `is-new` unless `quiet`. Returns the list of new elements.
 */
export function reconcile(box, items, { quiet = false } = {}) {
  const old = new Map();
  for (const el of box.children) if (el.dataset.k) old.set(el.dataset.k, el);
  const added = [];
  const tpl = document.createElement("template");
  items.forEach((it, i) => {
    let el = old.get(it.key);
    if (el && el._h !== it.html) {
      tpl.innerHTML = it.html.trim();
      const fresh = tpl.content.firstElementChild;
      fresh.dataset.k = it.key; fresh._h = it.html;
      const had = el === document.activeElement;
      el.replaceWith(fresh); el = fresh;
      if (had && fresh.tabIndex >= 0) fresh.focus({ preventScroll: true });
    } else if (!el) {
      tpl.innerHTML = it.html.trim();
      el = tpl.content.firstElementChild;
      el.dataset.k = it.key; el._h = it.html;
      if (!quiet) { el.classList.add("is-new"); added.push(el); }
    }
    old.delete(it.key);
    const at = box.children[i];
    if (at !== el) box.insertBefore(el, at || null);
  });
  for (const el of old.values()) el.remove();
  return added;
}

// ── optional soft sounds (OFF by default; the person turns them on) ─────────
let actx = null;
export const sound = {
  get on() { try { return localStorage.getItem("cv-sound") === "on"; } catch { return false; } },
  set on(v) { try { localStorage.setItem("cv-sound", v ? "on" : "off"); } catch { /* private mode */ } },
  play(kind) {
    if (!this.on) return;
    try {
      actx = actx || new AudioContext();
      const notes = { allow: [660, 990], back: [520, 390], done: [523, 659, 784], lock: [880], send: [740] }[kind] || [660];
      notes.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = "sine"; o.frequency.value = f;
        const t = actx.currentTime + i * 0.07;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.25);
      });
    } catch { /* no audio */ }
  },
};

export { esc };

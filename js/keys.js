// The one list of keyboard shortcuts. Every handler asks it (`is`), every tooltip and the keys
// sheet read it (`label`, `hint`), and Settings › Keyboard edits it. Custom keys are kept per
// browser (localStorage `cv-keys`, only what differs from the defaults).
//
// Rules, so a shortcut never gets in the way (owner feedback, 2026-10-14):
//  · keys that work anywhere need ⌘/Ctrl, or a symbol (/ ?): typing can never trigger them;
//  · decision keys only work on a focused decision card, so single letters are fine there;
//  · no two actions that can fire in the same place share a key; the browser's own keys are left alone.

const STORE = "cv-keys";
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform || navigator.platform || "");

/** Groups in the order they're shown. `scope` decides where a key fires (and so what can clash). */
export const GROUPS = [
  { id: "global", name: "Anywhere" },
  { id: "decision", name: "On a decision" },
  { id: "intel", name: "In the intelligence popover" },
];

/** Every action. `fixed` rows are shown for reference but can't be changed. */
export const ACTIONS = [
  { id: "jump", scope: "global", label: "Jump to any project or thread", def: "mod+k" },
  { id: "intel", scope: "global", label: "Intelligence for this conversation", def: "mod+." },
  { id: "write", scope: "global", label: "Write (@ aims it at a project)", def: "/" },
  { id: "keys", scope: "global", label: "All shortcuts, on one sheet", def: "?" },
  { id: "esc", scope: "global", label: "Back, exactly where you were", fixed: "Esc" },
  { id: "allow", scope: "decision", label: "Allow (routine, notable)", def: "a" },
  { id: "hold", scope: "decision", label: "Allow a destructive ask (hold 1.2 s)", fixed: "hold ↵" },
  { id: "back", scope: "decision", label: "Send back, with a note", def: "d" },
  { id: "pick", scope: "decision", label: "Pick an answer", fixed: "1–9" },
  { id: "reply", scope: "decision", label: "Reply in words", def: "r" },
  { id: "done", scope: "decision", label: "Done: resolve a thread that replied and waits", def: "c" },
  { id: "details", scope: "decision", label: "Details, in place", def: "e" },
  { id: "open", scope: "decision", label: "Open the thread beside the panel", def: "o" },
  { id: "next", scope: "decision", label: "Skip ahead (nothing is forced first)", def: "j" },
  { id: "prev", scope: "decision", label: "Skip back", def: "k" },
  { id: "later", scope: "decision", label: "Later today", def: "l" },
  { id: "rule", scope: "decision", label: "Make it a rule", def: "t" },
  { id: "undo", scope: "decision", label: "Undo the last decision (3 s)", def: "u" },
  { id: "allowAll", scope: "decision", label: "Allow all routine together", def: "shift+a" },
  { id: "auto", scope: "intel", label: "Back to Auto", def: "a" },
  { id: "intelNav", scope: "intel", label: "Model · depth · pin it", fixed: "↑ ↓ · ← → · ↵" },
];
const BY = new Map(ACTIONS.map((a) => [a.id, a]));

// Keys the browser or the UI itself keeps.
const RESERVED_MOD = new Set(["w", "t", "n", "q", "r", "l", "tab", "h", "m", "p", "s", "f", "c", "v", "x", "z", "a", "y", "0", "-", "="]);
const NAMED = new Set(["escape", "enter", "tab", " ", "arrowup", "arrowdown", "arrowleft", "arrowright", "backspace", "delete"]);

function load() { try { return JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch { return {}; } }
function save(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* private mode */ } }

let custom = load();
const subs = new Set();
const emit = () => { for (const f of subs) f(); };

/** "mod+shift+k" ⇄ { mod, shift, alt, key } */
function parse(s) {
  const parts = String(s).split("+");
  const key = parts.pop() || "+";
  return { mod: parts.includes("mod"), shift: parts.includes("shift"), alt: parts.includes("alt"), key: key.toLowerCase() };
}
function str(c) { return [c.mod && "mod", c.alt && "alt", c.shift && "shift", c.key].filter(Boolean).join("+"); }
const isLetter = (k) => /^[a-z]$/.test(k);
const isDigit = (k) => /^[0-9]$/.test(k);

/** The combo a keydown makes, or null for a bare modifier. */
export function fromEvent(e) {
  if (["Shift", "Control", "Meta", "Alt", "CapsLock", "Dead"].includes(e.key)) return null;
  let key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  // ⇧ on a symbol is part of the symbol (? is ⇧/); only letters keep an explicit shift.
  const shift = e.shiftKey && isLetter(key);
  if (e.code?.startsWith("Key") && (e.altKey || e.metaKey || e.ctrlKey)) key = e.code.slice(3).toLowerCase(); // ⌥ makes odd glyphs on a Mac
  return str({ mod: e.metaKey || e.ctrlKey, alt: e.altKey, shift, key });
}

export const binding = (id) => custom[id] ?? BY.get(id)?.def ?? null;
export const changed = (id) => custom[id] != null && custom[id] !== BY.get(id)?.def;

/** Does this keydown trigger the action? */
export function is(e, id) {
  const b = binding(id);
  if (!b) return false;
  const c = parse(b);
  const mod = e.metaKey || e.ctrlKey;
  if (c.mod !== mod || c.alt !== e.altKey) return false;
  const k = e.key.toLowerCase();
  if (isLetter(c.key)) {
    const code = e.code?.startsWith("Key") ? e.code.slice(3).toLowerCase() : k;
    return (k === c.key || code === c.key) && c.shift === e.shiftKey;
  }
  return k === c.key;
}
export const hasMod = (id) => parse(binding(id) || "").mod;

/** How a key reads on screen: ⌘K on a Mac, Ctrl K elsewhere; letters in capitals. */
export function show(s) {
  if (!s) return "";
  const c = parse(s);
  const key = c.key === " " ? "Space" : c.key.length === 1 ? c.key.toUpperCase() : c.key[0].toUpperCase() + c.key.slice(1);
  const bits = [];
  if (c.mod) bits.push(IS_MAC ? "⌘" : "Ctrl ");
  if (c.alt) bits.push(IS_MAC ? "⌥" : "Alt ");
  if (c.shift) bits.push("⇧");
  return bits.join("") + key;
}
export const label = (id) => { const a = BY.get(id); return a?.fixed || show(binding(id)); };
/** For tooltips: " (A)", or nothing when the action has no key. */
export const hint = (id) => (binding(id) || BY.get(id)?.fixed ? ` (${label(id)})` : "");

/** Where two actions could fire at the same moment. */
const overlaps = (a, b) => a === b || a === "global" || b === "global";

/** Try a new key for an action: { ok } or { error } in plain words. */
export function set(id, combo) {
  const a = BY.get(id);
  if (!a || a.fixed) return { error: "This one can't be changed." };
  const c = parse(combo);
  if (NAMED.has(c.key) && !c.mod) return { error: `${show(combo)} is kept for moving around. Pick another key.` };
  if (c.mod && RESERVED_MOD.has(c.key)) return { error: `Your browser keeps ${show(combo)}. Pick another key.` };
  if (a.scope === "global" && !c.mod && (isLetter(c.key) || isDigit(c.key)))
    return { error: "Keys that work anywhere need ⌘ or Ctrl, or a symbol like / or ?, so typing never sets them off." };
  if (a.scope !== "global" && (c.mod || c.alt)) return { error: "Decision keys are single keys (⇧ is fine). ⌘ and Ctrl stay with the browser." };
  if (a.scope === "decision" && isDigit(c.key)) return { error: "1–9 pick an answer. Pick another key." };
  const clash = ACTIONS.find((x) => x.id !== id && !x.fixed && overlaps(x.scope, a.scope) && binding(x.id) === str(c));
  if (clash) return { error: `${show(combo)} is already “${clash.label}”. Change that one first, or pick another key.` };
  if (str(c) === a.def) delete custom[id]; else custom[id] = str(c);
  save(custom);
  emit();
  return { ok: true };
}
export function reset(id) { delete custom[id]; save(custom); emit(); }
export function resetAll() { custom = {}; save(custom); emit(); }
export const anyChanged = () => ACTIONS.some((a) => changed(a.id));
export function onChange(fn) { subs.add(fn); return () => subs.delete(fn); }

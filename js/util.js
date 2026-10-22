// Small pure helpers shared by every module. No DOM access here, so the
// functions can be imported and tested from Node.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };

/** Escape text for HTML element content AND quoted attribute values. */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"'`]/g, (c) => ESC[c]);
}

export const WORKSPACE = "workspace";
export const WORKSPACE_ID = "chat_workspace";

export function chatLabel(chat) {
  return chat === WORKSPACE ? "Workspace" : String(chat || "");
}

/** Parse an ISO time ("…Z") into epoch ms, or NaN. */
export function toMs(iso) {
  if (!iso) return NaN;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : NaN;
}

/** "just now", "3m ago", "2h ago", "yesterday", "Oct 4". */
export function relTime(iso, now = Date.now()) {
  const ms = toMs(iso);
  if (!Number.isFinite(ms)) return "";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "14:03" for today, "Oct 4, 14:03" otherwise. */
export function clockTime(iso, now = Date.now()) {
  const ms = toMs(iso);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return time;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

export function fullTime(iso) {
  const ms = toMs(iso);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : "";
}

/** Day label used for timeline separators: "Today", "Yesterday", "Mon, Oct 4". */
export function dayLabel(iso, now = Date.now()) {
  const ms = toMs(iso);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const t = new Date(now);
  const y = new Date(now - 86400000);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function plural(n, one, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}

/** Image types the file viewer shows, by suffix (the server's /image route takes the same ones). */
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg)$/i;
export const isImagePath = (path) => IMAGE_EXT.test(String(path || ""));

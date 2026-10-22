// The file viewer (if1 #2): a shared file opens in a panel beside the conversation, like a canvas.
// Markdown renders (markdown.js), other text is coloured code with line numbers (highlight.js), and
// HTML shows in a sandboxed frame with no scripts and no same-origin (Source shows its text). It
// reads the project-scoped `/api/xo-projects/<project>/file` route only, never `/api/files/*`.
// Esc closes it; on phones it takes the whole screen. Focus goes in, and back to the file card.

import { esc } from "./util.js";
import { ICON, $ } from "./ui.js";
import { renderMarkdown } from "./markdown.js";
import { highlight, langOf } from "./highlight.js";
import { api } from "./api.js";

const size = (n) => (n == null ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const bytes = (s) => new TextEncoder().encode(s).length;
const extOf = (name) => (/\.([\w-]+)$/.exec(String(name || "")) || [])[1] || "";
const KIND_WORD = { markdown: "Markdown", html: "HTML", text: "Text", code: "Code", json: "JSON" };

export function createViewer({ announce, onChange }) {
  const el = $("#viewer");
  const V = { open: false, file: null, data: null, error: null, loading: false, mode: "preview", returnTo: null, gen: 0, copied: false };

  function head() {
    const f = V.file, d = V.data;
    const kind = d ? KIND_WORD[d.kind] || (extOf(f.name).toUpperCase() || "Text") : String(f.type || "").split("/").pop() || "";
    const meta = [kind, size(d ? d.size_bytes : f.bytes)].filter(Boolean);
    const canCopy = !!(d && typeof d.content === "string");
    const toggle = d && d.kind === "html"
      ? `<div class="vw-seg" role="group" aria-label="Show"><button type="button" data-vw-mode="preview" aria-pressed="${V.mode === "preview"}">Preview</button><button type="button" data-vw-mode="source" aria-pressed="${V.mode === "source"}">Source</button></div>`
      : "";
    return `<header class="vw-top"><span class="vw-ic" aria-hidden="true">${ICON.doc}</span>` +
      `<div class="vw-t"><h2 id="vw-h">${esc(f.name || f.path)}</h2><p class="vw-sub"><code title="${esc(f.where || f.path)}">${esc(f.where || f.path)}</code>${meta.map((m) => `<span>${esc(m)}</span>`).join("")}</p></div>` +
      `<div class="vw-acts">${toggle}` +
      (canCopy ? `<button type="button" class="vw-btn" data-vw-copy title="Copy the contents">${ICON.copy}<span>${V.copied ? "Copied" : "Copy"}</span></button>` : "") +
      `<button type="button" class="vw-x" data-vw-close aria-label="Close the file" title="Close (Esc)">${ICON.close}</button></div></header>`;
  }

  function codeHtml(text, lang) {
    const hl = highlight(text, lang);
    const n = text.split("\n").length;
    const nums = Array.from({ length: n }, (_, i) => i + 1).join("\n");
    return `<div class="vw-code"><pre class="vw-ln" aria-hidden="true">${nums}</pre><pre class="vw-src"><code${hl != null ? ' class="hl"' : ""}>${hl ?? esc(text)}</code></pre></div>`;
  }

  function body() {
    if (V.why) return `<div class="vw-empty"><p>${esc(V.why)}</p><p class="vw-path"><code>${esc(V.file.path)}</code><button type="button" class="vw-btn" data-vw-copy-path>${ICON.copy}<span>${V.copied ? "Copied" : "Copy the path"}</span></button></p></div>`;
    if (V.loading) return `<p class="vw-empty"><i class="spin" aria-hidden="true"></i> Reading the file…</p>`;
    if (V.error) return `<div class="vw-empty"><p>${esc(V.error)}</p></div>`;
    const d = V.data;
    const text = String(d.content ?? "");
    const cut = d.truncated ? `<p class="vw-cut">${ICON.clock}<span>Showing the first ${esc(size(bytes(text)))} of ${esc(size(d.size_bytes))}. The rest isn't previewed.</span></p>` : "";
    let main;
    if (d.kind === "markdown") main = `<article class="prose vw-md">${renderMarkdown(text)}</article>`;
    else if (d.kind === "html" && V.mode === "preview") main = `<iframe class="vw-frame" sandbox="" referrerpolicy="no-referrer" title="${esc(V.file.name || "HTML preview")}" srcdoc="${esc(text)}"></iframe>`;
    else main = codeHtml(text, d.kind === "html" ? "html" : langOf(extOf(d.name || V.file.name)));
    return cut + main;
  }

  function render() {
    if (!V.open) return;
    const keep = el.querySelector(".vw-body")?.scrollTop || 0;
    el.innerHTML = head() + `<div class="vw-body${V.data && V.data.kind === "html" && V.mode === "preview" ? " is-frame" : ""}" tabindex="0">${body()}</div>`;
    if (V.keepScroll) el.querySelector(".vw-body").scrollTop = keep;
    V.keepScroll = false;
  }

  async function load() {
    const my = ++V.gen;
    V.loading = true; V.error = null; V.data = null;
    render();
    try {
      const d = await api.projectFile(V.file.project, V.file.rel);
      if (my !== V.gen) return;
      V.data = d;
      if (typeof d.content !== "string") V.error = "XO sent this file without its text.";
    } catch (err) {
      if (my !== V.gen) return;
      V.error = err.status === 404 ? "This file isn't there any more." : err.message || "Couldn't read this file.";
    }
    V.loading = false;
    render();
  }

  /** f: {name, path, type, bytes, project?, rel?, why?}; from: the element to return focus to. */
  function open(f, from) {
    const was = V.open;
    Object.assign(V, { open: true, file: { ...f, where: f.rel || f.path }, data: null, error: null, why: f.why || null, mode: "preview", copied: false, returnTo: from || (was ? V.returnTo : document.activeElement) });
    el.hidden = false;
    document.body.classList.add("viewer-open");
    if (!was) { el.classList.remove("is-in"); void el.offsetWidth; el.classList.add("is-in"); }
    if (V.why) render(); else load();
    el.focus({ preventScroll: true });
    announce(`${f.name || f.path} is open beside the conversation. Esc closes it.`);
    onChange && onChange();
  }

  function close({ restore = true } = {}) {
    if (!V.open) return;
    V.open = false; V.gen++;
    el.hidden = true; el.innerHTML = "";
    document.body.classList.remove("viewer-open");
    const back = V.returnTo;
    V.returnTo = null;
    if (restore && back && back.isConnected) back.focus({ preventScroll: true });
    onChange && onChange();
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); V.copied = true; } catch { announce("Couldn't copy: the browser refused."); return; }
    V.keepScroll = true; render();
    announce("Copied.");
    setTimeout(() => { if (V.copied) { V.copied = false; V.keepScroll = true; render(); } }, 1400);
  }

  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-vw-close]")) { close(); return; }
    const m = e.target.closest("[data-vw-mode]");
    if (m) { V.mode = m.dataset.vwMode; render(); return; }
    if (e.target.closest("[data-vw-copy]")) { copy(String(V.data.content)); return; }
    if (e.target.closest("[data-vw-copy-path]")) copy(V.file.path);
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  });

  return { open, close, get isOpen() { return V.open; }, get file() { return V.file; } };
}

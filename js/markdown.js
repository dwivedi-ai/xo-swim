// A small, safe Markdown renderer for chat messages.
//
// Supported: paragraphs (soft line breaks kept), headings, bullet and numbered
// lists (one level of nesting by indent), blockquotes, horizontal rules, tables,
// fenced code blocks (with a copy button and colours, js/highlight.js), inline code, **bold**, *italic*,
// _italic_, ~~strike~~, [links](…) and bare http(s) URLs.
//
// Safety: the input is never interpreted as HTML. Every piece of text goes
// through esc(); the only tags in the output are the ones built here. Links
// are allowed only to http(s) URLs (opened in a new tab) and to in-app
// "#cmsg_…" thread anchors (data-thread, handled by the app). Anything else
// renders as its plain text.

import { esc } from "./util.js";
import { highlight } from "./highlight.js";

const THREAD_HREF = /^#(cmsg_[A-Za-z0-9_-]{1,128})$/;
const HTTP_HREF = /^https?:\/\/[^\s<>"'`]+$/i;

/** Render a link target, or null when it is not allowed. */
function linkAttrs(href) {
  const h = String(href || "").trim();
  const t = THREAD_HREF.exec(h);
  if (t) return `href="#${esc(t[1])}" class="md-tlink" data-thread="${esc(t[1])}"`;
  if (HTTP_HREF.test(h)) return `href="${esc(h)}" target="_blank" rel="noopener noreferrer nofollow" class="md-link"`;
  return null;
}

// Inline patterns, tried at each position; the earliest match wins.
const INLINE = [
  { name: "code", re: /(`+)([\s\S]*?[^`])\1(?!`)/ },
  { name: "link", re: /\[([^\]\n]{1,500})\]\(([^()\s]{1,2000})\)/ },
  { name: "url", re: /\bhttps?:\/\/[^\s<>()"'`]+[^\s<>()"'`.,;:!?]/i },
  { name: "bold", re: /\*\*(?=\S)([\s\S]*?\S)\*\*|__(?=\S)([\s\S]*?\S)__/ },
  { name: "strike", re: /~~(?=\S)([\s\S]*?\S)~~/ },
  { name: "em", re: /\*(?=[^\s*])([^*\n]*?[^\s*])\*|(?<![A-Za-z0-9_])_(?=[^\s_])([^_\n]*?[^\s_])_(?![A-Za-z0-9_])/ },
];

/** Render inline markdown. `noLinks` disables links (used inside link text). */
export function renderInline(text, noLinks = false) {
  let out = "";
  let rest = String(text ?? "");
  let guard = 0;
  while (rest && guard++ < 10000) {
    let best = null;
    for (const p of INLINE) {
      if (noLinks && (p.name === "link" || p.name === "url")) continue;
      const m = p.re.exec(rest);
      if (m && (best === null || m.index < best.m.index)) best = { p, m };
    }
    if (!best) {
      out += esc(rest);
      break;
    }
    const { p, m } = best;
    out += esc(rest.slice(0, m.index));
    switch (p.name) {
      case "code":
        out += `<code>${esc(m[2].replace(/^ (.*) $/, "$1"))}</code>`;
        break;
      case "link": {
        const attrs = linkAttrs(m[2]);
        const label = renderInline(m[1], true);
        out += attrs ? `<a ${attrs}>${label}</a>` : label;
        break;
      }
      case "url": {
        const attrs = linkAttrs(m[0]);
        out += attrs ? `<a ${attrs}>${esc(m[0])}</a>` : esc(m[0]);
        break;
      }
      case "bold":
        out += `<strong>${renderInline(m[1] ?? m[2], noLinks)}</strong>`;
        break;
      case "strike":
        out += `<del>${renderInline(m[1], noLinks)}</del>`;
        break;
      case "em":
        out += `<em>${renderInline(m[1] ?? m[2], noLinks)}</em>`;
        break;
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

const FENCE = /^\s{0,3}(```+|~~~+)\s*([\w+#.-]*)\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;

function codeBlock(lang, code) {
  const label = lang ? esc(lang) : "code";
  // colours only split the escaped text into spans (js/highlight.js): code never becomes HTML
  const hl = highlight(code, lang);
  return (
    `<div class="md-code"><div class="md-code-head"><span>${label}</span>` +
    `<button type="button" class="md-copy" data-copy aria-label="Copy code">Copy</button></div>` +
    `<pre><code${hl != null ? ' class="hl"' : ""}>${hl ?? esc(code)}</code></pre></div>`
  );
}

/** A table row's cells: split on "|" outside `code`, with the outer pipes dropped. */
function cells(line) {
  const out = [];
  let cur = "", tick = false;
  const t = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "\\" && t[i + 1] === "|") { cur += "|"; i++; continue; }
    if (c === "`") tick = !tick;
    if (c === "|" && !tick) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}
function renderTable(head, sep, rows) {
  const align = cells(sep).map((c) => (/^:-+:$/.test(c) ? "center" : /-+:$/.test(c) ? "right" : ""));
  const td = (tag, c, i) => `<${tag}${align[i] ? ` style="text-align:${align[i]}"` : ""}>${renderInline(c)}</${tag}>`;
  const h = cells(head);
  return `<div class="md-table"><table><thead><tr>${h.map((c, i) => td("th", c, i)).join("")}</tr></thead>` +
    `<tbody>${rows.map((r) => { const rc = cells(r); return `<tr>${h.map((_, i) => td("td", rc[i] ?? "", i)).join("")}</tr>`; }).join("")}</tbody></table></div>`;
}

function renderList(lines) {
  // lines: [{indent, ordered, start, text}]
  let html = "";
  let i = 0;
  const walk = (baseIndent) => {
    const first = lines[i];
    const tag = first.ordered ? "ol" : "ul";
    const start = first.ordered && first.start !== 1 ? ` start="${first.start}"` : "";
    let out = `<${tag}${start}>`;
    while (i < lines.length && lines[i].indent >= baseIndent) {
      const item = lines[i];
      if (item.indent > baseIndent) {
        // a nested list belongs to the previous <li>
        out = out.replace(/<\/li>$/, "") + walk(item.indent) + "</li>";
        continue;
      }
      if (item.ordered !== first.ordered) break;
      out += `<li>${renderInline(item.text)}</li>`;
      i++;
    }
    return out + `</${tag}>`;
  };
  while (i < lines.length) html += walk(lines[i].indent);
  return html;
}

/** Render a message's markdown to an HTML string (safe to assign to innerHTML). */
export function renderMarkdown(src) {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${para.map((l) => renderInline(l)).join("<br>")}</p>`);
    para = [];
  };

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];

    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const marker = fence[1];
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) body.push(lines[i++]);
      i++; // closing fence (or end of input)
      out.push(codeBlock(fence[2], body.join("\n")));
      continue;
    }
    if (!line.trim()) {
      flush();
      i++;
      continue;
    }
    if (RULE.test(line)) {
      flush();
      out.push("<hr>");
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      flush();
      const head = line, sep = lines[i + 1];
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) rows.push(lines[i++]);
      out.push(renderTable(head, sep, rows));
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      flush();
      const level = Math.min(6, h[1].length + 2); // keep headings modest inside chat
      out.push(`<h${level} class="md-h">${renderInline(h[2])}</h${level}>`);
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      flush();
      const body = [];
      while (i < lines.length && QUOTE.test(lines[i])) body.push(QUOTE.exec(lines[i++])[1]);
      out.push(`<blockquote>${renderMarkdown(body.join("\n"))}</blockquote>`);
      continue;
    }
    if (BULLET.test(line) || ORDERED.test(line)) {
      flush();
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        const b = BULLET.exec(l);
        const o = ORDERED.exec(l);
        if (b) items.push({ indent: b[1].replace(/\t/g, "  ").length, ordered: false, text: b[2] });
        else if (o) items.push({ indent: o[1].replace(/\t/g, "  ").length, ordered: true, start: +o[2], text: o[3] });
        else if (l.trim() && /^\s{2,}/.test(l) && items.length) items[items.length - 1].text += " " + l.trim();
        else break;
        i++;
      }
      out.push(renderList(items));
      continue;
    }
    para.push(line);
    i++;
  }
  flush();
  return out.join("");
}

/**
 * The start of a long message, for a short excerpt (if1 #5): whole blocks up to about `max`
 * characters, cut only at a blank line outside a code fence. A first block longer than that is cut
 * at a word (and an open fence closed). Returns {md, more}.
 */
export function excerptMarkdown(src, max = 600) {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").trim().split("\n");
  let fence = null, len = 0, cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const f = FENCE.exec(lines[i]);
    if (f && !fence) fence = f[1];
    else if (fence && lines[i].trim().startsWith(fence)) fence = null;
    if (!fence && !lines[i].trim() && len >= max * 0.5) {
      if (len >= max) { cut = i; break; }
      // the next block would run far past the limit: stop before it
      let next = 0;
      for (let j = i + 1; j < lines.length && lines[j].trim(); j++) next += lines[j].length + 1;
      if (len + next > max * 1.4) { cut = i; break; }
    }
    len += lines[i].length + 1;
  }
  let md = lines.slice(0, cut).join("\n").trim();
  let more = cut < lines.length && lines.slice(cut).some((l) => l.trim());
  if (md.length > max * 1.5) {
    md = md.slice(0, max).replace(/\s+\S*$/, "") + "…";
    more = true;
    const open = md.split("\n").filter((l) => FENCE.test(l)).length % 2 === 1;
    if (open) md += "\n```";
  }
  return { md, more };
}

/** Every "#cmsg_…" thread id linked from a message, in order. */
export function threadLinks(src) {
  const ids = [];
  const re = /\]\(#(cmsg_[A-Za-z0-9_-]{1,128})\)/g;
  let m;
  while ((m = re.exec(String(src ?? "")))) if (!ids.includes(m[1])) ids.push(m[1]);
  return ids;
}

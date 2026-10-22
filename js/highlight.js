// Code colours for fenced blocks (if1 #3): a small tokenizer, not a grammar engine.
//
// Safe by construction: it only splits the text into (kind, text) pieces and every piece goes
// through esc(), so code never becomes HTML (markdown.js stays escape-first). Synchronous and
// linear, so a fence still streaming can be coloured again on every chunk. Colours are theme
// tokens (--code-*, css/app.css), so light and dark both work.
//
// Kinds: com (comment) · str · num · kw (keyword) · bi (builtin, type, constant) · fn (a call or a
// definition) · prop (key, property, attribute) · tag · pun (operators, brackets) · var ($VAR) ·
// add / del / hunk / meta (diff) · head / em (markdown).
//
// Why not Shiki: it's well over 100 kB with grammars, needs vendoring (no npm or CDN here), and
// returns HTML we'd have to trust. If full fidelity is ever wanted, it can replace highlight()
// behind the same signature.

import { esc } from "./util.js";

const MAX = 200000; // above this a block stays plain

const words = (s) => new Set(s.split(" "));
const IDENT = /[A-Za-z_$][\w$]*/y;

// ── languages: each is a list of sticky rules tried in order at every position, plus word sets ──
const JS_KW = words("async await break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof let new of return set static super switch this throw try typeof var void while with yield as type interface enum implements declare namespace keyof readonly satisfies abstract private protected public");
const JS_BI = words("true false null undefined NaN Infinity console window document globalThis Math JSON Object Array String Number Boolean Promise Map Set Symbol Error RegExp Date fetch require module process string number boolean any unknown never void bigint");
const PY_KW = words("and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case");
const PY_BI = words("True False None self cls print len range str int float bool list dict set tuple open isinstance super type object Exception enumerate zip map filter sorted min max sum any all");
const SH_KW = words("if then else elif fi for while until do done case esac in function return local export readonly declare unset shift break continue exit source alias set");
const SH_BI = words("echo cd ls cat grep sed awk curl wget git npm npx node python python3 pip make docker kubectl sudo rm mv cp mkdir touch chmod chown find xargs tar ssh scp printf read test true false kill ps head tail sort uniq wc tee env which brew apt yarn pnpm uv cargo go");
const SQL_KW = words("select from where and or not insert into values update set delete create table drop alter add column index primary key foreign references join left right inner outer full on as group by order having limit offset distinct union all case when then else end is null like in between exists returning with begin commit rollback transaction view default unique constraint check if asc desc cascade");
const SQL_BI = words("count sum avg min max coalesce now cast integer int bigint text varchar char boolean bool date timestamp timestamptz serial uuid json jsonb real float numeric true false");
const CSS_KW = words("important");

const C_COMMENT = [["com", /\/\/[^\n]*/y], ["com", /\/\*[\s\S]*?(?:\*\/|$)/y]];
const NUM = ["num", /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?n?)(?![\w$])/y];
const PUN = ["pun", /[{}()[\];,.:?!=<>+\-*/%&|^~@]+/y];
const STR2 = ["str", /"(?:[^"\\\n]|\\.)*"?/y];
const STR1 = ["str", /'(?:[^'\\\n]|\\.)*'?/y];

const LANGS = {
  js: {
    rules: [...C_COMMENT, ["str", /`(?:[^`\\]|\\[\s\S])*`?/y], STR2, STR1, NUM, ["word"], PUN],
    kw: JS_KW, bi: JS_BI, call: true, prop: /\./,
  },
  py: {
    rules: [["com", /#[^\n]*/y], ["str", /[rRbBuUfF]{0,2}"""[\s\S]*?(?:"""|$)/y], ["str", /[rRbBuUfF]{0,2}'''[\s\S]*?(?:'''|$)/y],
      ["str", /[rRbBuUfF]{0,2}"(?:[^"\\\n]|\\.)*"?/y], ["str", /[rRbBuUfF]{0,2}'(?:[^'\\\n]|\\.)*'?/y],
      ["fn", /@[\w.]+/y], NUM, ["word"], PUN],
    kw: PY_KW, bi: PY_BI, call: true, def: /\b(?:def|class)\s+$/,
  },
  sh: {
    rules: [["com", /(?:^|(?<=\s))#[^\n]*/my], STR2, ["str", /'[^']*'?/y], ["var", /\$(?:\{[^}\n]*\}?|\w+|[@#?$!*0-9-])/y],
      ["prop", /(?<=\s)--?[\w-]+=?/y], ["num", /\b\d+\b/y], ["word", /[A-Za-z_][\w.-]*/y], ["pun", /[|&;<>(){}[\]=\\]+/y]],
    kw: SH_KW, bi: SH_BI, cmd: true,
  },
  json: {
    rules: [["prop", /"(?:[^"\\\n]|\\.)*"(?=\s*:)/y], STR2, NUM, ["kw", /\b(?:true|false|null)\b/y], ["com", /\/\/[^\n]*/y], ["pun", /[{}[\],:]/y]],
  },
  yaml: {
    rules: [["com", /(?:^|(?<=\s))#[^\n]*/my], ["prop", /(?<=^[ \t]*(?:-[ \t]+)?)[\w./][\w.\-/ ]*?(?=:(?:\s|$))/my], STR2, STR1,
      ["kw", /\b(?:true|false|null|yes|no|on|off|~)\b/y], ["var", /[&*][\w-]+/y], NUM, ["pun", /[:\-[\]{},|>]/y]],
  },
  html: {
    rules: [["com", /<!--[\s\S]*?(?:-->|$)/y], ["kw", /<!DOCTYPE[^>]*>/iy], ["tag", /<\/?[A-Za-z][\w:-]*/y], ["pun", /\/?>/y],
      ["prop", /(?<=<[^>]*\s)[\w:@.-]+(?=\s*=|\s|\/?>)/y], STR2, STR1, ["var", /&[#\w]+;/y]],
  },
  css: {
    rules: [["com", /\/\*[\s\S]*?(?:\*\/|$)/y], STR2, STR1, ["kw", /@[\w-]+/y], ["prop", /(?<=[{;\s])(?:--)?[A-Za-z-][\w-]*(?=\s*:)(?![^{};]*\{)/y],
      ["num", /#[\da-fA-F]{3,8}\b/y], ["num", /-?(?:\d+\.?\d*|\.\d+)(?:%|[a-z]+)?/y], ["bi", /!important/y], ["fn", /[\w-]+(?=\()/y],
      ["tag", /(?<=^|[}\s,>+~])[.#]?[A-Za-z_][\w-]*(?=[^{};]*\{)/my], ["pun", /[{}();:,>+~*=[\]]/y]],
  },
  sql: {
    rules: [["com", /--[^\n]*/y], ["com", /\/\*[\s\S]*?(?:\*\/|$)/y], STR1, ["prop", /"(?:[^"\n])*"?/y], NUM, ["word"], ["pun", /[(),;.*=<>!+\-/%]+/y]],
    kw: SQL_KW, bi: SQL_BI, nocase: true,
  },
  md: {
    rules: [["head", /^#{1,6}[^\n]*/my], ["com", /^>[^\n]*/my], ["pun", /^\s*(?:[-*+]|\d+[.)])(?=\s)/my], ["str", /`[^`\n]*`/y],
      ["em", /\*\*[^*\n]+\*\*|__[^_\n]+__/y], ["em", /\*[^*\n]+\*|_[^_\n]+_/y], ["fn", /\[[^\]\n]*\]\([^)\n]*\)/y]],
  },
};
const ALIAS = {
  javascript: "js", jsx: "js", mjs: "js", cjs: "js", ts: "js", tsx: "js", typescript: "js", node: "js",
  python: "py", py3: "py", python3: "py",
  bash: "sh", shell: "sh", zsh: "sh", console: "sh", shellscript: "sh", sh: "sh",
  jsonc: "json", json5: "json",
  yml: "yaml", html: "html", htm: "html", xml: "html", svg: "html", vue: "html",
  scss: "css", less: "css", postgres: "sql", postgresql: "sql", sqlite: "sql", mysql: "sql",
  markdown: "md", diff: "diff", patch: "diff",
};

/** The language a fence's tag names, or null when there's none we colour. */
export function langOf(tag) {
  const t = String(tag || "").toLowerCase().replace(/^\./, "");
  if (!t) return null;
  if (LANGS[t] || t === "diff") return t;
  return ALIAS[t] || null;
}

const span = (k, text) => (k ? `<span class="tk-${k}">${esc(text)}</span>` : esc(text));

function diffHtml(code) {
  return code.split("\n").map((l) => {
    const k = /^(?:diff |index |--- |\+\+\+ )/.test(l) ? "meta" : l.startsWith("@@") ? "hunk" : l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : null;
    return span(k, l);
  }).join("\n");
}

function tokens(code, L) {
  let out = "", plain = "", i = 0;
  const push = (k, t) => { if (!k) { plain += t; return; } if (plain) { out += esc(plain); plain = ""; } out += span(k, t); };
  while (i < code.length) {
    let hit = null;
    for (const [k, re0] of L.rules) {
      const re = re0 || IDENT;
      re.lastIndex = i;
      const m = re.exec(code);
      if (!m || !m[0]) continue;
      hit = { k, t: m[0] };
      break;
    }
    if (!hit) { push(null, code[i]); i++; continue; }
    let { k, t } = hit;
    if (k === "word") {
      const w = L.nocase ? t.toLowerCase() : t;
      const before = code.slice(Math.max(0, i - 24), i);
      const next = code.slice(i + t.length).match(/^\s*(\(|=>|:)?/)[1];
      if (L.kw && L.kw.has(w)) k = "kw";
      else if (L.bi && L.bi.has(w)) k = "bi";
      else if (L.def && L.def.test(before)) k = "fn";
      else if (L.cmd) k = /(?:^|[|;&(]|\$\()\s*$/.test(code.slice(Math.max(0, i - 40), i).split("\n").pop()) ? "fn" : null;
      else if (L.call && next === "(") k = "fn";
      else if (L.prop && /\.\s*$/.test(before)) k = "prop";
      else k = null;
    }
    push(k, t);
    i += t.length;
  }
  if (plain) out += esc(plain);
  return out;
}

/** Coloured HTML for `code` (escaped, only spans added), or null when the language isn't one we colour. */
export function highlight(code, tag) {
  const lang = langOf(tag);
  const src = String(code ?? "");
  if (!lang || src.length > MAX) return null;
  if (lang === "diff") return diffHtml(src);
  return tokens(src, LANGS[lang]);
}

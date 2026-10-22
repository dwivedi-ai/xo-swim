// Files on a message (hub #30). A file is uploaded to a chat as soon as it's added (the paperclip, a
// drop, a paste) and shows as a chip; a message names its files by id. A large paste becomes a file.
// The server has the final word on size and type (it reads the bytes); the checks here only spare the
// person a wait for an answer that's known already. The pure part has no DOM: tests/logic.test.mjs.

export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 10;
/** Above either, a paste becomes a file (`pasted-text-N.md`). */
export const PASTE_CHARS = 4000;
export const PASTE_LINES = 80;

// Kinds the server never takes, known from the name or the browser's type alone. Anything else may
// be text (code has every extension under the sun), so it's left to the server.
const REFUSED_EXT = new Set([
  "zip", "gz", "tgz", "bz2", "xz", "7z", "rar", "tar", "jar", "war", "whl", "exe", "dll", "so", "dylib", "bin", "dmg", "iso", "pkg", "deb", "rpm", "msi", "apk", "app",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "pages", "numbers", "key", "rtf",
  "mp3", "wav", "flac", "aac", "ogg", "m4a", "mp4", "mov", "avi", "mkv", "webm", "wmv",
  "heic", "heif", "tif", "tiff", "bmp", "ico", "psd", "ai", "sketch", "fig", "raw", "cr2", "nef",
  "sqlite", "db", "pyc", "class", "o", "a", "wasm", "ttf", "otf", "woff", "woff2", "eot",
]);
const REFUSED_TYPE = /^(audio|video|font)\/|^application\/(zip|x-zip|gzip|x-gzip|x-tar|x-7z|x-rar|vnd\.rar|x-msdownload|x-apple-diskimage|vnd\.ms-|vnd\.openxmlformats|msword|vnd\.oasis)/;

export const extOf = (name) => ((/\.([\w-]+)$/.exec(String(name || "")) || [])[1] || "").toLowerCase();

export const fmtSize = (n) => (n == null || !Number.isFinite(+n) ? "" : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1).replace(/\.0$/, "")} MB`);

/** Why this file can't be sent, from what the browser knows, or "" to let the server decide. */
export function refusal(file) {
  if (!file) return "Not a file.";
  if (!file.size) return "This file is empty.";
  if (file.size > MAX_BYTES) return `Over the ${MAX_BYTES / 1048576} MB limit (${fmtSize(file.size)}).`;
  if (REFUSED_EXT.has(extOf(file.name)) || REFUSED_TYPE.test(String(file.type || ""))) return "Only text, images (PNG, JPEG, GIF, WebP) and PDFs can be attached.";
  return "";
}

/**
 * Sort added files into those to upload and those refused at once, given `have` chips already on the
 * message. Returns {take: [file], refused: [{name, why}]}.
 */
export function sortFiles(files, have = 0) {
  const take = [], refused = [];
  for (const f of files || []) {
    const why = refusal(f);
    if (why) refused.push({ name: f && f.name || "file", why });
    else if (have + take.length >= MAX_FILES) refused.push({ name: f.name, why: `A message takes at most ${MAX_FILES} files.` });
    else take.push(f);
  }
  return { take, refused };
}

const linesOf = (text) => String(text || "").split("\n").length;

/** A paste long enough to send as a file rather than as words in the message. */
export const isLargePaste = (text) => String(text || "").length > PASTE_CHARS || linesOf(text) > PASTE_LINES;

/**
 * The extension a pasted text is saved under: the code's own when it's clearly code, else `md`.
 * Conservative: prose that merely mentions code stays markdown.
 */
export function pasteExt(text) {
  const s = String(text || "").trim();
  if (/^[[{]/.test(s)) { try { JSON.parse(s); return "json"; } catch { /* not JSON */ } }
  if (/^#!.*\b(ba|z)?sh\b/.test(s)) return "sh";
  if (/^#!.*\bpython/.test(s)) return "py";
  if (/^<!doctype html|^<html[\s>]/i.test(s)) return "html";
  if (/^```/.test(s) || /^#{1,6}\s/m.test(s.slice(0, 400))) return "md"; // already markdown
  const lines = s.split("\n").slice(0, 60);
  const share = (re) => lines.filter((l) => re.test(l)).length / Math.max(1, lines.filter((l) => l.trim()).length);
  if (share(/^\s*(def \w+\(|class \w+[(:]|import [\w.]+(\s+as \w+)?$|from [\w.]+ import |if __name__|elif |except\b)/) > 0.15) return "py";
  if (share(/^\s*(import .+ from |export |const |let |function |async |interface |type \w+ =|\}\)?;?$)/) > 0.2) return /:\s*(string|number|boolean)\b|^\s*interface /m.test(s) ? "ts" : "js";
  if (share(/^\s*(fn |let mut |use \w+::|impl |pub )/) > 0.15) return "rs";
  if (share(/^\s*(func |package \w+$|import \(|\w+ := )/) > 0.15) return "go";
  if (share(/^\s*(SELECT |INSERT |UPDATE |DELETE |CREATE |ALTER |FROM |WHERE |JOIN )/i) > 0.3) return "sql";
  if (share(/^\s*[.#]?[\w-]+(\s*[,>+~]\s*[.#]?[\w-]+)*\s*\{|^\s*[\w-]+\s*:\s*[^;]+;\s*$/) > 0.4) return "css";
  return "md";
}

/** `pasted-text-N.<ext>` */
export const pasteName = (text, n) => `pasted-text-${n}.${pasteExt(text)}`;

/** The chip's words for a paste: `Pasted text · 312 lines · 14 KB`. */
export function pasteLabel(text) {
  const n = linesOf(text);
  return `Pasted text · ${n.toLocaleString("en")} line${n === 1 ? "" : "s"} · ${fmtSize(new TextEncoder().encode(String(text || "")).length)}`;
}

/** A stored message's files: extra.attachments, each {id, name, type, bytes}. */
export function attachmentsOf(row) {
  const list = row && row.extra && row.extra.attachments;
  return Array.isArray(list) ? list.filter((a) => a && a.id).map((a) => ({ id: String(a.id), name: String(a.name || "file"), type: String(a.type || ""), bytes: a.bytes ?? null })) : [];
}

/** image | pdf | text, from the server's type (which it sniffed from the bytes). */
export const kindOf = (type) => (/^image\//.test(type) ? "image" : type === "application/pdf" ? "pdf" : "text");

/** A short word for a type, for a chip: PNG, PDF, Markdown, Text. */
export function typeWord(type, name) {
  if (type === "application/pdf") return "PDF";
  if (/^image\//.test(type)) return type.slice(6).toUpperCase().replace("JPEG", "JPG");
  if (type === "text/markdown") return "Markdown";
  const ext = extOf(name);
  return ext && ext !== "txt" ? ext.toUpperCase() : "Text";
}

/** What a failed upload says on its chip: short, plain, from the server's code. */
export function uploadErrorText(err) {
  if (!err) return "Upload failed";
  switch (err.code) {
    case "too_large": return `Over ${MAX_BYTES / 1048576} MB`;
    case "unsupported_type": return "Not text, an image or a PDF";
    case "empty_file": return "Empty file";
    case "too_many_unsent": return "Too many unsent files here";
    case "unsafe_attachments_folder": return "The project's .xo folder needs fixing";
    case "chat_retired": return "This project was removed";
    case "chat_not_found": return "This chat is gone";
    case "timeout": return "No answer from XO";
    case "network": return "Can't reach XO";
    case "cross_origin": return "Refused by the proxy";
    default: return err.status === 413 ? "Too large" : "Upload failed";
  }
}

/** Codes where uploading the same bytes again can't help: the chip offers Remove, not Retry. */
export const FINAL = new Set(["too_large", "unsupported_type", "empty_file", "chat_retired", "chat_not_found"]);

/**
 * The files on each conversation's unsent message. `upload(chat, blob, name, {onProgress})` →
 * {promise, abort} (api.uploadAttachment); `onChange()` after every move, to redraw.
 *
 * A chip: {lid, name, size, blob, chat, id, type, bytes, state: uploading|done|failed, sent, err,
 * paste?: text}. The blob is kept, so a failed upload, an expired id or a message aimed at another
 * chat (@project) can upload the same bytes again.
 */
export function createTray({ upload, onChange = () => {} }) {
  const trays = new Map(); // conv → [chip]
  let n = 0, pastes = 0;
  const list = (conv) => trays.get(conv) || [];
  const find = (conv, lid) => list(conv).find((c) => c.lid === lid) || null;

  function start(c, chat) {
    c.chat = chat; c.state = "uploading"; c.sent = 0; c.err = null; c.id = null;
    const job = upload(chat, c.blob, c.name, { onProgress: (sent) => { c.sent = sent; onChange(); } });
    c.job = job;
    const mine = job.promise.then((a) => {
      if (c.job !== job) return c;
      Object.assign(c, { id: a.id, name: a.name || c.name, type: a.type, bytes: a.bytes, state: "done", sent: c.size, job: null });
      onChange();
      return c;
    }, (err) => {
      if (c.job !== job) return c;
      c.job = null;
      if (err && err.name === "AbortError") return c;
      c.state = "failed"; c.err = err;
      onChange();
      return c;
    });
    c.done = mine;
    onChange();
    return mine;
  }

  function put(conv, c) {
    const l = list(conv);
    l.push(c);
    trays.set(conv, l);
  }

  return {
    list,
    /** Add files picked, dropped or pasted. Returns the refused ones ({name, why}) to say so. */
    add(conv, chat, files) {
      const { take, refused } = sortFiles(files, list(conv).length);
      for (const f of take) {
        const c = { lid: `a${++n}`, name: f.name || "file", size: f.size, blob: f, state: "uploading" };
        put(conv, c);
        start(c, chat);
      }
      return refused;
    },
    /** A large paste as a file of its own. Returns false when the message already holds MAX_FILES. */
    addPaste(conv, chat, text) {
      if (list(conv).length >= MAX_FILES) return false;
      const name = pasteName(text, ++pastes);
      const blob = new Blob([text], { type: /\.md$/.test(name) ? "text/markdown" : "text/plain" });
      const c = { lid: `a${++n}`, name, size: blob.size, blob, paste: text, state: "uploading" };
      put(conv, c);
      start(c, chat);
      return true;
    },
    /** Put sent-but-failed files back on the composer (Edit on a failed message). */
    restore(conv, chips) {
      for (const c of chips) put(conv, { ...c, lid: `a${++n}`, job: null });
      onChange();
    },
    remove(conv, lid) {
      const l = list(conv), i = l.findIndex((c) => c.lid === lid);
      if (i < 0) return null;
      const [c] = l.splice(i, 1);
      if (c.job) { const j = c.job; c.job = null; j.abort(); }
      onChange();
      return c;
    },
    retry(conv, lid) {
      const c = find(conv, lid);
      if (c && c.state === "failed") start(c, c.chat);
    },
    /** {count, busy, failed}: Send waits while busy and stays off while one has failed. */
    status(conv) {
      const l = list(conv);
      return { count: l.length, busy: l.some((c) => c.state === "uploading"), failed: l.some((c) => c.state === "failed") };
    },
    /** Take the conversation's files off the composer for a message (each a plain copy). */
    take(conv) {
      const l = list(conv);
      trays.delete(conv);
      onChange();
      return l.map(({ job, done, ...c }) => c);
    },
    /**
     * Make sure every file of a message is uploaded to `chat` (the chat the message goes to, which
     * @project can change, or a fresh upload when `again`: the server forgot the id). Resolves to the
     * ids in order; rejects with the first upload's error.
     */
    async ensure(chips, chat, { again = false } = {}) {
      const ids = [];
      for (const c of chips) {
        if (again || c.chat !== chat || !c.id) {
          const job = upload(chat, c.blob, c.name, {});
          const a = await job.promise;
          Object.assign(c, { id: a.id, chat, name: a.name || c.name, type: a.type, bytes: a.bytes, state: "done" });
        }
        ids.push(c.id);
      }
      return ids;
    },
  };
}

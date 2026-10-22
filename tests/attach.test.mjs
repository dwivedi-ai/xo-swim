// Files on a message (hub #30) and the cross-project hop line: the pure parts, no network.
//   node tests/attach.test.mjs
import assert from "node:assert/strict";
import { refusal, sortFiles, isLargePaste, pasteExt, pasteName, pasteLabel, attachmentsOf, kindOf, typeWord, fmtSize, uploadErrorText, createTray, MAX_BYTES, MAX_FILES, FINAL } from "../js/attach.js";
import { uiMsg, echoes, hopLine } from "../js/timeline.js";

let passed = 0;
const pending = [];
const t = (name, fn) => {
  pending.push((async () => {
    try { await fn(); passed++; console.log("  ok  " + name); }
    catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
  })());
};
const file = (name, size, type = "") => ({ name, size, type });

// ── what's refused before uploading ───────────────────────────────────────
t("refusal: size, emptiness and obvious wrong kinds; the rest goes to the server", () => {
  assert.equal(refusal(file("a.png", 10, "image/png")), "");
  assert.equal(refusal(file("notes", 10)), ""); // no extension: may well be text
  assert.equal(refusal(file("main.zig", 10)), ""); // code with any extension is text
  assert.match(refusal(file("a.txt", 0)), /empty/);
  assert.match(refusal(file("big.pdf", MAX_BYTES + 1, "application/pdf")), /25 MB/);
  assert.equal(refusal(file("max.pdf", MAX_BYTES, "application/pdf")), "");
  assert.match(refusal(file("a.zip", 10, "application/zip")), /Only text, images/);
  assert.match(refusal(file("setup.EXE", 10)), /Only text/);
  assert.match(refusal(file("clip", 10, "video/mp4")), /Only text/);
  assert.match(refusal(file("deck.pptx", 10)), /Only text/);
});
t("sortFiles: at most 10 per message, counting the chips already there", () => {
  const ten = Array.from({ length: 12 }, (_, i) => file(`f${i}.txt`, 5));
  const a = sortFiles(ten, 0);
  assert.equal(a.take.length, MAX_FILES);
  assert.equal(a.refused.length, 2);
  assert.match(a.refused[0].why, /at most 10/);
  const b = sortFiles([file("x.txt", 5), file("y.zip", 5), file("z.txt", 5)], 9);
  assert.deepEqual(b.take.map((f) => f.name), ["x.txt"]);
  assert.deepEqual(b.refused.map((r) => r.name), ["y.zip", "z.txt"]);
});

// ── a large paste becomes a file ──────────────────────────────────────────
t("isLargePaste: over 4,000 characters or 80 lines", () => {
  assert.equal(isLargePaste("x".repeat(4000)), false);
  assert.equal(isLargePaste("x".repeat(4001)), true);
  assert.equal(isLargePaste(Array(80).fill("a").join("\n")), false);
  assert.equal(isLargePaste(Array(81).fill("a").join("\n")), true);
  assert.equal(isLargePaste(""), false);
});
t("pasteExt: the code's own extension only when it's clearly code", () => {
  assert.equal(pasteExt('{"a": [1, 2], "b": {"c": null}}'), "json");
  assert.equal(pasteExt("#!/usr/bin/env bash\nset -e\necho hi"), "sh");
  assert.equal(pasteExt("import os\nfrom x import y\n\ndef main():\n    return 1\n\nif __name__ == '__main__':\n    main()"), "py");
  assert.equal(pasteExt("import { a } from './a.js';\nexport function f() {\n  const x = 1;\n  return x;\n}\n"), "js");
  assert.equal(pasteExt("interface A { b: string }\nexport const f = (x: number) => x;\nconst y: boolean = true;\n"), "ts");
  assert.equal(pasteExt("SELECT a, b\nFROM t\nWHERE a = 1\nJOIN u ON u.id = t.id"), "sql");
  assert.equal(pasteExt("<!doctype html>\n<html><body>hi</body></html>"), "html");
  assert.equal(pasteExt("The meeting went well. We agreed to ship on Friday.\n\nNext steps: write the import notes."), "md");
  assert.equal(pasteExt("# Title\n\n```js\nconst a = 1\n```"), "md");
  assert.equal(pasteExt("{not json"), "md");
});
t("pasteName and pasteLabel: pasted-text-N, lines and size", () => {
  assert.equal(pasteName("plain words", 3), "pasted-text-3.md");
  const text = Array(312).fill("x".repeat(45)).join("\n");
  assert.equal(pasteLabel(text), "Pasted text · 312 lines · 14 KB");
  assert.equal(pasteLabel("one"), "Pasted text · 1 line · 3 B");
});

// ── stored messages and their files ───────────────────────────────────────
t("attachmentsOf and uiMsg: extra.attachments, read through the row's own chat", () => {
  const row = { id: "cmsg_1", chat_id: "chat_p", author_kind: "owner", text: "", created_at: "2026-10-22T10:00:00Z", seq: 5,
    extra: { attachments: [{ id: "att_1", name: "shot.png", type: "image/png", bytes: 48213 }, { name: "no id" }], forwarded_from: { chat_id: "chat_a", message_id: "cmsg_0", via: ["sys", "workspace"] } } };
  assert.deepEqual(attachmentsOf(row), [{ id: "att_1", name: "shot.png", type: "image/png", bytes: 48213 }]);
  const m = uiMsg(row);
  assert.equal(m.chatId, "chat_p");
  assert.equal(m.files.length, 1);
  assert.deepEqual(m.fwd, { chatId: "chat_a", id: "cmsg_0", via: ["sys", "workspace"] });
  assert.deepEqual(uiMsg({ id: "x", author_kind: "owner", text: "hi" }).files, []);
});
t("uiMsg: XO's passed-on line links to the copy", () => {
  const m = uiMsg({ id: "cmsg_9", author_kind: "system", author_id: "xo", text: "Passed to xc through the Workspace.",
    extra: { passed_on: { project: "xc", ask_hop_id: "hop_1", forward_hop_id: "hop_2", forwarded_message_ids: ["cmsg_c1", "cmsg_c2"] } } });
  assert.equal(m.who, "system");
  assert.deepEqual(m.passedOn, { project: "xc", to: "cmsg_c1" });
  assert.deepEqual(uiMsg({ id: "s", author_kind: "system", extra: { passed_on: { project: "xc" } } }).passedOn, { project: "xc", to: null });
  assert.equal(uiMsg({ id: "s", author_kind: "system", text: "x" }).passedOn, null);
});
t("echoes: a files-only message matches its server copy by its file count too", () => {
  const at = Date.now();
  const locals = [{ id: "l1", who: "you", text: "", at, files: [{ name: "a" }] }];
  const rows = [{ id: "s0", who: "you", text: "", at, files: [] }, { id: "s1", who: "you", text: "", at, files: [{ id: "att" }] }];
  assert.deepEqual([...echoes(locals, rows)], [["l1", "s1"]]);
});
t("kindOf, typeWord, fmtSize, uploadErrorText", () => {
  assert.equal(kindOf("image/webp"), "image");
  assert.equal(kindOf("application/pdf"), "pdf");
  assert.equal(kindOf("text/plain"), "text");
  assert.equal(typeWord("image/jpeg", "a.jpg"), "JPG");
  assert.equal(typeWord("text/markdown", "a.md"), "Markdown");
  assert.equal(typeWord("text/plain", "main.py"), "PY");
  assert.equal(typeWord("text/plain", "a.txt"), "Text");
  assert.equal(fmtSize(512), "512 B");
  assert.equal(fmtSize(48213), "47 KB");
  assert.equal(fmtSize(25 * 1048576), "25 MB");
  assert.equal(uploadErrorText({ code: "unsupported_type" }), "Not text, an image or a PDF");
  assert.equal(uploadErrorText({ code: "x", status: 413 }), "Too large");
  assert.ok(FINAL.has("too_large") && !FINAL.has("network"));
});

// ── the hop line: work handed on to another project ───────────────────────
t("hopLine: a forward that went on to another project says where", () => {
  const fwd = { kind: "forward", via: ["project", "workspace"], state: "delivered", from_role: "workspace-coordinator", to_role: "project-coordinator" };
  assert.equal(hopLine(fwd, "sys", "xc"), "Passed to xc through the Workspace");
  assert.equal(hopLine({ ...fwd, state: "sent" }, "sys", "xc"), "Passed to xc through the Workspace · not taken up yet");
  assert.equal(hopLine({ ...fwd, via: ["workspace"] }, "xc", "xc"), "Forwarded by the Workspace");
  assert.equal(hopLine(fwd, "xc"), "Forwarded by the Workspace");
  assert.equal(hopLine({ kind: "answer", from_role: "workspace-coordinator", to_role: "project-coordinator" }, "sys"), "The Workspace answered the sys coordinator");
});

// ── the tray: upload as added, Send waits, retry, re-upload elsewhere ─────
function fakeUpload() {
  const calls = [];
  const upload = (chat, blob, name, { onProgress } = {}) => {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    const call = { chat, name, blob, onProgress, aborted: false, resolve: (id) => resolve({ id, name, type: "text/plain", bytes: blob.size }), reject };
    calls.push(call);
    return { promise, abort: () => { call.aborted = true; reject(Object.assign(new Error("abort"), { name: "AbortError" })); } };
  };
  return { upload, calls };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

t("tray: busy while uploading, done after; take empties it", async () => {
  const { upload, calls } = fakeUpload();
  let changes = 0;
  const tray = createTray({ upload, onChange: () => changes++ });
  const refused = tray.add("ws", "chat_w", [file("a.txt", 3), file("b.zip", 3)]);
  assert.equal(refused.length, 1);
  assert.deepEqual(tray.status("ws"), { count: 1, busy: true, failed: false });
  calls[0].onProgress(2, 3);
  assert.equal(tray.list("ws")[0].sent, 2);
  calls[0].resolve("att_a");
  await tick();
  assert.deepEqual(tray.status("ws"), { count: 1, busy: false, failed: false });
  assert.equal(tray.list("ws")[0].id, "att_a");
  const taken = tray.take("ws");
  assert.equal(taken.length, 1);
  assert.equal(taken[0].chat, "chat_w");
  assert.ok(!("job" in taken[0]));
  assert.equal(tray.status("ws").count, 0);
  assert.ok(changes > 2);
});
t("tray: a failure keeps Send off until Retry succeeds or the chip goes", async () => {
  const { upload, calls } = fakeUpload();
  const tray = createTray({ upload });
  tray.add("p:x", "chat_x", [file("a.txt", 3)]);
  calls[0].reject(Object.assign(new Error("XO is down"), { code: "network", status: 0 }));
  await tick();
  assert.deepEqual(tray.status("p:x"), { count: 1, busy: false, failed: true });
  tray.retry("p:x", tray.list("p:x")[0].lid);
  assert.equal(calls.length, 2);
  assert.equal(tray.status("p:x").busy, true);
  calls[1].resolve("att_2");
  await tick();
  assert.deepEqual(tray.status("p:x"), { count: 1, busy: false, failed: false });
});
t("tray: removing an uploading chip aborts it and leaves no failure behind", async () => {
  const { upload, calls } = fakeUpload();
  const tray = createTray({ upload });
  tray.add("ws", "chat_w", [file("a.txt", 3)]);
  tray.remove("ws", tray.list("ws")[0].lid);
  await tick();
  assert.equal(calls[0].aborted, true);
  assert.deepEqual(tray.status("ws"), { count: 0, busy: false, failed: false });
});
t("tray: a paste becomes pasted-text-N.md; a full message refuses it", async () => {
  const { upload, calls } = fakeUpload();
  const tray = createTray({ upload });
  assert.equal(tray.addPaste("ws", "chat_w", "x".repeat(5000)), true);
  assert.equal(calls[0].name, "pasted-text-1.md");
  assert.equal(calls[0].blob.type, "text/markdown");
  assert.equal(tray.list("ws")[0].paste.length, 5000);
  tray.add("ws", "chat_w", Array.from({ length: 9 }, (_, i) => file(`f${i}.txt`, 1)));
  assert.equal(tray.addPaste("ws", "chat_w", "y".repeat(5000)), false);
});
t("tray.ensure: files go up again to the chat a message is aimed at, or when the server forgot them", async () => {
  const { upload, calls } = fakeUpload();
  const tray = createTray({ upload });
  const chips = [{ lid: "a1", name: "a.txt", blob: { size: 3 }, chat: "chat_w", id: "att_w" }];
  // same chat: nothing to do
  assert.deepEqual(await tray.ensure(chips, "chat_w"), ["att_w"]);
  assert.equal(calls.length, 0);
  // @project: the same bytes to that project's chat
  const p = tray.ensure(chips, "chat_p");
  await tick();
  assert.equal(calls[0].chat, "chat_p");
  calls[0].resolve("att_p");
  assert.deepEqual(await p, ["att_p"]);
  assert.equal(chips[0].chat, "chat_p");
  // unknown_attachment: once more, same chat
  const q = tray.ensure(chips, "chat_p", { again: true });
  await tick();
  calls[1].resolve("att_p2");
  assert.deepEqual(await q, ["att_p2"]);
});

await Promise.all(pending);
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);

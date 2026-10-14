// Exercises the UI's pure modules (markdown, model, timeline) against fixed
// cases and against live data from the proxy (GET only: nothing is written).
//   node tests/logic.test.mjs            (UI server on 127.0.0.1:5180)
//   XO_UI=http://127.0.0.1:5180 node tests/logic.test.mjs
import assert from "node:assert/strict";
import { renderMarkdown, renderInline, threadLinks } from "../js/markdown.js";
import { groupThreads, mergeMessages, parseChecklist, routedIndex, threadState, lastId, composerBlock } from "../js/model.js";
import { uiMsg, echoes, askText, liveAsks, threadAnchors, parseTarget, stripTarget, sendErrorTitle, connLine, awaitingNow, mapLimit, plainText } from "../js/timeline.js";

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};

// ── markdown safety and features ─────────────────────────────────────────
t("escapes raw html", () => {
  const out = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>');
  assert.ok(!out.includes("<script") && !out.includes("<img"));
  assert.ok(out.includes("&lt;script&gt;"));
});
t("javascript: links are not links", () => {
  const out = renderMarkdown("[click](javascript:alert(1)) and [x](data:text/html,hi)");
  assert.ok(!out.includes("<a"), out);
  assert.ok(out.includes("click"));
});
t("attribute breakout in http link is escaped", () => {
  const out = renderInline('[a](https://x.y/"onmouseover="alert(1))');
  assert.ok(!/href="[^"]*"onmouseover/.test(out), out);
});
t("thread links become in-app anchors", () => {
  const out = renderMarkdown("Sent to [Power operator + tests](#cmsg_0mv6m0vxl000834eada7).");
  assert.match(out, /<a href="#cmsg_0mv6m0vxl000834eada7" class="md-tlink" data-thread="cmsg_0mv6m0vxl000834eada7">Power operator \+ tests<\/a>/);
  assert.deepEqual(threadLinks("[a](#cmsg_abc) [b](#cmsg_def) [a](#cmsg_abc)"), ["cmsg_abc", "cmsg_def"]);
});
t("http links open in new tab", () => {
  const out = renderMarkdown("see https://example.com/a?b=1, and [docs](https://x.dev)");
  assert.match(out, /href="https:\/\/example.com\/a\?b=1" target="_blank" rel="noopener noreferrer nofollow"/);
  assert.match(out, /href="https:\/\/x.dev"/);
});
t("bold, italic, code, lists, fences", () => {
  const out = renderMarkdown("**bold** *it* _it2_ `a<b`\n\n- one\n- two\n  - nested\n\n1. x\n2. y\n\n```py\nprint('<hi>')\n```");
  assert.ok(out.includes("<strong>bold</strong>") && out.includes("<em>it</em>") && out.includes("<em>it2</em>"));
  assert.ok(out.includes("<code>a&lt;b</code>"));
  assert.ok(out.includes("<ul><li>one</li><li>two<ul><li>nested</li></ul></li></ul>"), out);
  assert.ok(out.includes("<ol><li>x</li><li>y</li></ol>"));
  assert.ok(out.includes('<div class="md-code"><div class="md-code-head"><span>py</span>'));
  assert.ok(out.includes("print(&#39;&lt;hi&gt;&#39;)"));
});
t("snake_case is not italic", () => {
  assert.ok(!renderInline("thread_budget_usd and XO_ROUTER_MODE").includes("<em>"));
});

// ── checklist, grouping ──────────────────────────────────────────────────
t("checklist parse", () => {
  const c = parseChecklist("✓ Added ^\n✱ Fixing tests\n○ Waiting on owner\n- ✓ bullet done\nNote line");
  assert.equal(c.total, 4);
  assert.equal(c.done, 2);
  assert.equal(c.doing, 1);
  assert.equal(c.items.at(-1).state, "note");
});
t("grouping order and empties hidden", () => {
  const th = [
    { ts: "a", state: "working", card: { state: "needs_reply" }, last_activity_at: "2026-01-01T00:00:00Z" },
    { ts: "b", state: "resolved", card: { state: "done" }, last_activity_at: "2026-01-02T00:00:00Z" },
    { ts: "c", state: "working", card: null, last_activity_at: "2026-01-03T00:00:00Z" },
    { ts: "d", state: "done", card: { state: "working" }, last_activity_at: "2026-01-04T00:00:00Z" },
    { ts: "e", state: "failed", card: null, last_activity_at: "2026-01-05T00:00:00Z" },
  ];
  assert.deepEqual(groupThreads(th).map((g) => [g.key, g.threads.map((x) => x.ts)]), [
    ["waiting", ["a"]], ["working", ["c"]], ["done", ["d"]], ["failed", ["e"]], ["resolved", ["b"]],
  ]);
  assert.deepEqual(groupThreads([th[2]]).map((g) => g.key), ["working"]);
});
t("merge dedupes and sorts", () => {
  const a = { id: "cmsg_2", written_at: "2026-01-01T00:00:02Z" };
  const b = { id: "cmsg_1", written_at: "2026-01-01T00:00:01Z" };
  let r = mergeMessages([a], [b, a]);
  assert.deepEqual(r.list.map((m) => m.id), ["cmsg_1", "cmsg_2"]);
  assert.equal(r.added.length, 1);
  r = mergeMessages(r.list, [a]);
  assert.equal(r.added.length, 0);
  assert.equal(lastId(r.list), "cmsg_2");
});
t("composer block reasons", () => {
  assert.match(composerBlock({ enabled: false, supported: true }), /router is off/i);
  assert.match(composerBlock({ enabled: true, supported: false, agent: "x" }), /no projects chat/);
  assert.equal(composerBlock({ enabled: true, supported: true }), "");
});

// ── optimistic rows and the live timeline (js/timeline.js) ──────────────
t("optimistic rows never become the stream cursor", () => {
  const list = [{ id: "cmsg_5" }, { id: "local_zz" }];
  assert.equal(lastId(list), "cmsg_5");
});
t("API rows map to the UI's authors", () => {
  const base = { id: "cmsg_1", written_at: "2026-01-01T00:00:00Z", text: "hi" };
  assert.equal(uiMsg({ ...base, author_kind: "owner", author_id: "owner" }).who, "you");
  assert.equal(uiMsg({ ...base, author_kind: "agent", author_id: "coordinator" }).who, "coord");
  assert.equal(uiMsg({ ...base, author_kind: "agent", author_id: "thread" }).who, "agent");
  assert.equal(uiMsg({ ...base, author_kind: "system", author_id: "system" }).who, "system");
  const f = uiMsg({ ...base, author_kind: "owner", forwarded_from: { chat_id: "chat_workspace", message_id: "cmsg_0" } });
  assert.deepEqual(f.fwd, { chatId: "chat_workspace", id: "cmsg_0" });
  assert.equal(f.at, Date.parse(base.written_at));
});
t("an optimistic row is matched to its server echo once", () => {
  const now = Date.parse("2026-01-01T00:00:10Z");
  const locals = [{ id: "l1", who: "you", text: "go", at: now, status: "sending" }, { id: "l2", who: "you", text: "go", at: now + 1, status: "sending" }, { id: "l3", who: "you", text: "x", at: now, status: "failed" }];
  const rows = [{ id: "cmsg_a", who: "you", text: "go", at: now + 400 }, { id: "cmsg_b", who: "coord", text: "go", at: now + 500 }, { id: "cmsg_c", who: "you", text: "x", at: now + 10 }];
  const m = echoes(locals, rows);
  assert.deepEqual([...m], [["l1", "cmsg_a"]]);
  assert.equal(echoes(locals, rows, new Set(["cmsg_a"])).size, 0);
  // an old identical message is not an echo
  assert.equal(echoes([locals[0]], [{ id: "cmsg_old", who: "you", text: "go", at: now - 3600000 }]).size, 0);
});
t("ask titles come from the first sentence, plain text", () => {
  assert.deepEqual(askText("I need **some** answers first. The repo has no [retry](#cmsg_1) handling."), { title: "I need some answers first.", rest: "The repo has no retry handling." });
  const long = askText("x".repeat(300));
  assert.ok(long.title.length <= 140 && long.title.endsWith("…"));
  assert.equal(plainText("```js\ncode\n```\n# Head"), "Head");
});
t("live asks: question, no options, reply only, keyed by card epoch", () => {
  const th = { id: "cmsg_t", state: "needs_reply", epoch: 3, happened: "card text" };
  const [a] = liveAsks(th, "Which provider should I use? SendGrid or SES.");
  assert.equal(a.kind, "question");
  assert.equal(a.options, null);
  assert.equal(a.replyOnly, true);
  assert.equal(a.title, "Which provider should I use?");
  assert.equal(a.id, "cmsg_t:3");
  assert.notEqual(liveAsks({ ...th, epoch: 4 }, "Which provider should I use?")[0].id, a.id);
  assert.equal(liveAsks({ ...th, epoch: null, cardAt: "2026-01-01" }, "")[0].title, "card text");
  assert.deepEqual(liveAsks({ ...th, state: "working" }, "x"), []);
  assert.equal(liveAsks({ ...th, state: "needs_approval" }, "Run it?")[0].replyOnly, false);
});
t("thread cards sit under the coordinator's reply to the root, else alone", () => {
  const rows = [{ id: "r1", who: "you" }, { id: "c1", who: "coord" }, { id: "r2", who: "you" }, { id: "r3", who: "you" }, { id: "x", who: "you" }];
  const { on, alone } = threadAnchors(rows, ["r1", "r2", "r3"]);
  assert.deepEqual([...on], [["c1", ["r1"]]]);
  assert.deepEqual([...alone].sort(), ["r2", "r3"]);
});
t("@project targets: only a known project is stripped", () => {
  const ps = [{ id: "workspace", name: "Workspace" }, { id: "billing-api", name: "billing-api" }];
  assert.deepEqual(parseTarget("@billing-api add tests", ps), { pid: "billing-api", token: "billing-api", unknown: null });
  assert.equal(parseTarget("@Workspace hi", ps).pid, "workspace");
  assert.deepEqual(parseTarget("ask @nope about it", ps), { pid: null, token: null, unknown: "nope" });
  assert.equal(parseTarget("mail me at a@b.c", ps).unknown, null);
  assert.equal(stripTarget("add @billing-api tests", "billing-api"), "add tests");
  assert.equal(stripTarget("@billing-api.x keep", "billing-api"), "@billing-api.x keep");
  assert.equal(stripTarget("no token", null), "no token");
});
t("send errors and connection lines are honest", () => {
  assert.equal(sendErrorTitle({ code: "router_off", status: 409 }), "Router is off");
  assert.equal(sendErrorTitle({ status: 501 }), "Not supported by this backend");
  assert.equal(sendErrorTitle({ status: 403 }), "Refused by the proxy");
  assert.equal(sendErrorTitle({ status: 502 }), "Can't reach XO");
  assert.equal(sendErrorTitle({ status: 400 }), "Message not sent");
  const ok = { enabled: true, supported: true, agent: "a" };
  assert.equal(connLine(ok, null, null), null);
  assert.equal(connLine(null, "down", null).kind, "down");
  assert.equal(connLine(ok, null, "chats failed").kind, "down");
  assert.match(connLine({ ...ok, enabled: false }).text, /router is off/i);
  assert.match(connLine({ ...ok, supported: false }).text, /no projects chat/);
});
t("awaiting expires after 3 minutes", () => {
  assert.equal(awaitingNow({ at: 1000 }, 1000 + 60000), true);
  assert.equal(awaitingNow({ at: 1000 }, 1000 + 181000), false);
  assert.equal(awaitingNow(null), false);
});
await (async () => {
  let peak = 0, now = 0;
  await mapLimit([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, async () => { now++; peak = Math.max(peak, now); await new Promise((r) => setTimeout(r, 5)); now--; });
  t("mapLimit caps parallel fetches", () => assert.equal(peak, 3));
})();

// ── live data (GET only) ────────────────────────────────────────────────
const BASE = (process.env.XO_UI || "http://127.0.0.1:5180") + "/api/projects-chat";
const get = async (p) => {
  const r = await fetch(BASE + p); // GET only: this suite never writes
  if (!r.ok) throw new Error(`${p}: ${r.status}`);
  return r.json();
};

try {
  const status = await get("/status");
  const { chats } = await get("/chats");
  t("status gates the composer like classic", () => {
    assert.equal(composerBlock(status, null), status.enabled && status.supported ? "" : composerBlock(status, null));
    assert.ok(chats[0].chat === "workspace");
  });
  const projectMsgs = {};
  for (const c of chats) {
    const { messages } = await get(`/chats/${c.chat}/messages?limit=40`);
    const { threads } = await get(`/chats/${c.chat}/threads`);
    if (c.kind === "project") projectMsgs[c.chat] = (await get(`/chats/${c.chat}/messages?limit=300`)).messages;
    const rows = messages.map(uiMsg);
    t(`${c.chat}: timeline maps (${messages.length} msgs, ${threads.length} threads)`, () => {
      for (const m of rows) assert.ok(["you", "coord", "agent", "system"].includes(m.who) && Number.isFinite(m.at) && m.id);
      const { on, alone } = threadAnchors(rows, threads.map((x) => x.ts));
      const placed = new Set([...alone, ...[...on.values()].flat()]);
      for (const th of threads) if (messages.some((m) => m.id === th.ts)) assert.ok(placed.has(th.ts), `thread ${th.ts} has a card`);
    });
    for (const th of threads) {
      const d = await get(`/chats/${c.chat}/threads/${th.ts}`);
      t(`${c.chat}: thread ${th.ts} detail`, () => {
        const c2 = parseChecklist(d.status);
        if ((d.status || "").includes("✓")) assert.ok(c2.done > 0);
        assert.equal(typeof d.busy, "boolean");
        const msgs = d.messages.map(uiMsg);
        assert.ok(msgs.every((m) => m.who !== "you" || m.text));
        const st = threadState({ ...d.thread, card: d.card });
        const asks = liveAsks({ id: th.ts, state: st, epoch: d.card?.epoch, happened: d.card?.happened }, [...msgs].reverse().find((m) => m.who === "agent")?.text);
        if (st === "needs_reply") assert.ok(asks.length === 1 && asks[0].title && !/Open the thread/.test(asks[0].title));
        else assert.equal(asks.length, 0);
      });
    }
  }
  const ws = (await get("/chats/workspace/messages")).messages;
  t("workspace: routed index points at real workspace messages", () => {
    const idx = routedIndex(projectMsgs);
    const found = Object.keys(idx).filter((id) => ws.some((m) => m.id === id));
    for (const id of found) for (const r of idx[id]) assert.ok(projectMsgs[r.chat].some((m) => m.id === r.messageId));
    console.log(`      routed index: ${Object.values(idx).flat().length} forwarded copies, ${found.length} in the workspace timeline`);
  });
} catch (e) {
  console.error("live data unavailable:", e.message);
  process.exitCode = 1;
}
console.log(`${passed} passed${process.exitCode ? ", with failures" : ""}`);

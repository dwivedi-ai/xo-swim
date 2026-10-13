// Exercises the UI's pure modules (markdown, model, views) against fixed
// cases and against live data from the proxy.
//   node tests/logic.test.mjs            (UI server on 127.0.0.1:5180)
//   XO_UI=http://127.0.0.1:5180 node tests/logic.test.mjs
import assert from "node:assert/strict";
import { renderMarkdown, renderInline, threadLinks } from "../js/markdown.js";
import { groupThreads, mergeMessages, parseChecklist, routedIndex, threadState, lastId, composerBlock } from "../js/model.js";
import { messageHtml, threadListHtml, threadDetailHeadHtml, timelineHtml, chatListHtml, statusHtml, statusSummary, waitingStripHtml, elapsed, typingHtml, homeHtml, freshHtml, slugify } from "../js/views.js";

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

// ── human-centred states (optimistic send, quiet status, honest waits) ──
t("optimistic rows never become the stream cursor", () => {
  const list = [{ id: "cmsg_5" }, { id: "local_zz" }];
  assert.equal(lastId(list), "cmsg_5");
});
t("pending and failed owner messages", () => {
  const base = { id: "local_1", written_at: "2026-01-01T00:00:00Z", author_kind: "owner", text: "hi <b>" };
  assert.match(messageHtml({ ...base, _pending: true }), /is-pending[\s\S]*Sending/);
  const failed = messageHtml({ ...base, _failed: true });
  assert.ok(failed.includes('data-retry="local_1"') && failed.includes('data-edit="local_1"'));
  assert.ok(failed.includes("hi &lt;b&gt;"));
});
t("status is quiet when healthy, loud when not", () => {
  const ok = { enabled: true, supported: true, agent: "a", modes: {} };
  assert.equal(statusSummary(ok, null, "live").tone, "ok");
  assert.equal(statusSummary(ok, null, "polling").tone, "warn");
  assert.equal(statusSummary(null, "boom").tone, "err");
  assert.equal(statusSummary({ ...ok, enabled: false }).label, "Router off");
  const pill = statusHtml({ ...ok, decision_model: "sage" }, null, "live", false);
  assert.ok(pill.includes("spill is-ok") && pill.includes("<b>sage</b>"));
  assert.ok(pill.includes('id="status-pop" role="dialog" aria-label="Connection details" hidden'));
  assert.ok(!statusHtml(ok, null, "live", true).includes('"Connection details" hidden'));
});
t("waiting strip lists threads that need the person", () => {
  assert.equal(waitingStripHtml([{ ts: "a", state: "working" }]), "");
  const html = waitingStripHtml([
    { ts: "a", title: "A", state: "needs_reply", last_activity_at: "2026-01-01T00:00:00Z" },
    { ts: "b", title: "B <x>", state: "needs_approval", last_activity_at: "2026-01-02T00:00:00Z" },
  ]);
  assert.ok(html.includes('data-thread="b"') && html.includes("B &lt;x&gt;") && html.includes("+1 more"));
  assert.ok(html.includes("data-dismiss-stand"));
});
t("waits are honest about time", () => {
  assert.equal(elapsed(7), "7s");
  assert.equal(elapsed(75), "1m 15s");
  assert.ok(!typingHtml("Working", 1000, 5000).includes("typing-hint"));
  assert.ok(typingHtml("Working", 1000, 20000).includes("You can keep working"));
});

t("home puts what needs you first, then working, then ready", () => {
  const th = (ts, state, title) => ({ ts, state, title, card: { state }, last_activity_at: "2026-01-01T00:00:00Z" });
  const html = homeHtml({
    chats: [{ chat: "workspace", kind: "workspace" }, { chat: "api", kind: "project" }],
    items: [
      { chat: "api", thread: th("w", "working", "W <x>") },
      { chat: "api", thread: th("n", "needs_approval", "N") },
      { chat: "api", thread: th("d", "done", "D") },
      { chat: "api", thread: th("r", "resolved", "R") },
    ],
  });
  const at = (k) => html.indexOf(k);
  assert.ok(at('data-thread="n"') < at('data-thread="w"') && at('data-thread="w"') < at('data-thread="d"'));
  assert.ok(!html.includes('data-thread="r"'));
  assert.ok(html.includes("W &lt;x&gt;") && html.includes("data-create-project") && html.includes('data-chat="api"'));
  assert.match(html, /1 needs you · 1 working · 1 ready for review/);
});
t("fresh start and project folder names", () => {
  assert.match(freshHtml("api", 12, null), /12 earlier messages/);
  assert.equal(slugify("  Héllo World! App "), "hello-world-app");
  assert.equal(slugify("../../etc"), "etc");
});

// ── live data ────────────────────────────────────────────────────────────
const BASE = (process.env.XO_UI || "http://127.0.0.1:5180") + "/api/projects-chat";
const get = async (p) => {
  const r = await fetch(BASE + p);
  if (!r.ok) throw new Error(`${p}: ${r.status}`);
  return r.json();
};

try {
  const status = await get("/status");
  const { chats } = await get("/chats");
  t("status + chat list render", () => {
    assert.ok(statusHtml(status, null, "live").includes(status.agent));
    const html = chatListHtml(chats, "workspace");
    assert.ok(html.indexOf("Workspace") < html.indexOf("Projects"));
  });
  const projectMsgs = {};
  for (const c of chats) {
    const { messages } = await get(`/chats/${c.chat}/messages`);
    const { threads } = await get(`/chats/${c.chat}/threads`);
    if (c.kind === "project") projectMsgs[c.chat] = messages;
    const threadsByTs = Object.fromEntries(threads.map((x) => [x.ts, x]));
    const statuses = {};
    for (const th of threads) {
      const d = await get(`/chats/${c.chat}/threads/${th.ts}`);
      statuses[th.ts] = d.status || "";
      t(`${c.chat}: thread view ${th.ts} renders`, () => {
        const head = threadDetailHeadHtml(d);
        assert.ok(head.includes("td-title"));
        if ((d.status || "").includes("✓")) assert.ok(head.includes("ck-done"));
        for (const m of d.messages) assert.ok(messageHtml(m, { chat: c.chat, inThread: true }).includes(`data-mid="${m.id}"`));
      });
    }
    t(`${c.chat}: timeline (${messages.length} msgs, ${threads.length} threads)`, () => {
      const html = timelineHtml(messages, { chat: c.chat, chats, threadsByTs });
      for (const m of messages) assert.ok(html.includes(`data-mid="${m.id}"`));
      // Every owner message that roots a thread shows the chip.
      for (const th of threads) if (messages.some((m) => m.id === th.ts)) assert.ok(html.includes(`class="tchip st-${threadState(th)}" data-thread="${th.ts}"`));
      // Every coordinator #cmsg link renders as an in-app thread link.
      for (const m of messages) for (const id of threadLinks(m.text)) assert.ok(html.includes(`data-thread="${id}"`));
      // Forwarded messages say where they came from.
      for (const m of messages) if (m.forwarded_from) assert.ok(html.includes("Forwarded from Workspace"));
      assert.ok(!/<script/i.test(html));
      const list = threadListHtml(threads, statuses);
      if (threads.length) assert.ok(list.includes("tgroup"));
    });
  }
  const ws = (await get("/chats/workspace/messages")).messages;
  t("workspace shows where routed messages went", () => {
    const idx = routedIndex(projectMsgs);
    const html = timelineHtml(ws, { chat: "workspace", chats, routed: idx, threadsByTs: {} });
    for (const [id, routes] of Object.entries(idx)) {
      if (!ws.some((m) => m.id === id)) continue;
      for (const r of routes) assert.ok(html.includes(`data-goto-chat="${r.chat}" data-goto-msg="${r.messageId}"`));
    }
    console.log(`      routed index: ${Object.values(idx).flat().length} forwarded copies`);
  });
} catch (e) {
  console.error("live data unavailable:", e.message);
  process.exitCode = 1;
}
console.log(`${passed} passed${process.exitCode ? ", with failures" : ""}`);

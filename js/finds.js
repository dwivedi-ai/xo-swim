// Converged · Found value (16's). Things agents noticed while doing real work.
//
//   #2 Found While Working  incidental discoveries, graded by the coordinator;
//                           only notable and rare ones surface
//   #5 Ripened Todo         an old todo that other work made cheap
//   #6 Déjà Vu              a pattern across projects
//
// Every find is one tap from becoming a thread. It never pings and never
// interrupts: at most two wait on Home until you have a minute; the rest
// arrive with the morning card. The demo's finds are hand-written.
import { esc } from "./world.js";
import { FINDS } from "./content.js";
import { ICON } from "./ui.js";

const CAP = 2;
const KIND = {
  find: { word: "Noticed", icon: "gem" },
  ripe: { word: "Ripened todo", icon: "ripe" },
  deja: { word: "Déjà vu", icon: "loop" },
};

export function createFinds({ world, params, onArrive }) {
  const now = Date.now();
  const S = {
    // demo only: these finds are hand-written; live shows none until the backend reports real ones
    list: world.mode !== "demo" ? [] : FINDS.map((f) => ({ ...f, state: f.at == null ? "pending" : "shown", shownAt: f.at == null ? null : now + f.at * 60000, tid: null })),
    // the week so far (demo history): finds that became shipped, kept work
    kept: world.mode !== "demo" ? [] : [{ title: "Unused 1.2 MB of CSS", value: "−1.2 MB" }],
  };
  // variable timing: the déjà vu arrives a little while after you open the app (real patterns surface when they surface)
  const pend = S.list.find((f) => f.state === "pending");
  if (pend) {
    const delay = params.has("finds") ? 0 : 38000 + Math.floor(Math.random() * 30000);
    setTimeout(() => { pend.state = "shown"; pend.shownAt = Date.now(); pend.fresh = true; onArrive && onArrive(pend); }, delay);
  }

  // rare first, then oldest (a row never jumps away for a newer one); at most two on Home
  const live = () => S.list.filter((f) => f.state !== "pending" && f.state !== "dismissed" && f.state !== "shipped")
    .sort((a, b) => (b.grade === "rare") - (a.grade === "rare") || (a.shownAt || 0) - (b.shownAt || 0));
  const visible = () => live().slice(0, CAP);
  const overflow = () => live().slice(CAP);

  async function commission(id) {
    const f = S.list.find((x) => x.id === id);
    if (!f || f.state !== "shown") return null;
    f.state = "starting";
    const project = f.project === "workspace" ? (f.projects && f.projects[0]) || "workspace" : f.project;
    const t = await world.act.ask(project, f.ask);
    f.state = "started";
    f.tid = t && t.id;
    f.startedAt = Date.now();
    return t;
  }
  function dismiss(id) { const f = S.list.find((x) => x.id === id); if (f) f.state = "dismissed"; }
  function restore(id) { const f = S.list.find((x) => x.id === id); if (f) f.state = "shown"; }

  /** Becomes "kept" value only when its thread finishes. */
  function settle() {
    for (const f of S.list) {
      if (f.state === "started" && f.tid) {
        const t = world.thread(f.tid);
        if (t && t.state === "done") { f.state = "shipped"; S.kept.push({ title: f.title, value: f.value }); }
      }
    }
  }

  function rowHtml(f, PROJ) {
    const k = KIND[f.kind];
    const where = f.kind === "deja" ? `${f.projects.length} projects` : esc(PROJ(f.project));
    let act;
    if (f.state === "shown") act = `<button type="button" class="fd-go" data-find="${esc(f.id)}" title="${f.kind === "ripe" ? "Do it now" : "Start a thread for it"}">${f.kind === "ripe" ? "Do it" : "Start"}</button>` +
      `<button type="button" class="fd-x" data-find-x="${esc(f.id)}" aria-label="Not now: ${esc(f.title)}" title="Not now">${ICON.close}</button>`;
    else if (f.state === "starting") act = `<span class="fd-st"><i class="spin" aria-hidden="true"></i>Starting</span>`;
    else if (f.state === "started") act = `<button type="button" class="fd-open" data-go="t:${esc(f.tid)}">${ICON.check}Started</button>`;
    else act = `<span class="fd-st is-ok">${ICON.check}Shipped</span>`;
    return `<li class="fd k-${f.kind}${f.grade === "rare" ? " is-rare" : ""}${f.fresh ? " is-fresh" : ""}${f.state !== "shown" ? " is-taken" : ""}" title="${esc(k.word)}${f.grade === "rare" ? " · rare" : ""}">` +
      `<span class="fd-ic" aria-hidden="true">${ICON[k.icon]}</span>` +
      `<span class="fd-b" title="${esc(k.word)} · ${where}"><span class="fd-t">${esc(f.title)}</span><span class="fd-l">${esc(f.line)}</span></span>` +
      `<span class="fd-a">${act}</span></li>`;
  }

  /** The Home block: at most two rows, no chrome beyond a label. */
  function shelfHtml(PROJ) {
    settle();
    const v = visible();
    if (!v.length) return "";
    for (const f of v) setTimeout(() => { f.fresh = false; }, 2400);
    return `<section class="finds" aria-labelledby="fd-h"><h2 class="hm-lbl" id="fd-h">${ICON.spark}Found while working</h2>` +
      `<ul class="fd-list">${v.map((f) => rowHtml(f, PROJ)).join("")}</ul></section>`;
  }

  return { S, visible, overflow, live, commission, dismiss, restore, shelfHtml, rowHtml, settle };
}

// Converged · the rules ledger (Rule Smith, #36). No DOM here.
//
// The only piece kept from 15 · Chain: when you allow the same kind of ask a
// third time, the decision offers "3rd time this week · make it a rule?".
// The rule is shown word for word before anything is sent; from then on it
// answers matching asks (never destructive ones) and counts what it absorbed.
import * as Kit from "./kit.js";

const DOCS = (a) => /docs?|readme|copy/i.test(a.title || "");

export function createRules({ PROJ, onEvent = () => {}, onChange = () => {} }) {
  const T0 = Date.now();
  const sessionAbsorbed = [];
  const day = 86400000;
  const rules = [
    { id: "r1", text: "Docs edits in any project: go ahead, tell me after.", cap: "docs", project: null, absorbed: 41, regretted: 0, since: T0 - 41 * day },
    { id: "r2", text: 'Standing rule for billing-api: you may run "npm run lint" without asking.', cap: null, prefix: "npm run lint", project: "billing-api", absorbed: 18, regretted: 0, since: T0 - 24 * day },
    { id: "r3", text: "mobile-app: screenshot diffs under 0.5% are fine without asking.", cap: null, project: "mobile-app", absorbed: 9, regretted: 1, since: T0 - 13 * day },
  ];
  const history = new Map([["npm test", { n: 2, projects: new Set(["billing-api", "marketing-site"]) }]]);
  const prefixOfAsk = (a) => { const c = Kit.commandOf(a); return c ? Kit.prefixOf(c) : null; };
  /** How often you've allowed this kind of ask before (Rule Smith offers at the 3rd). */
  function repeats(n) {
    const p = prefixOfAsk(n.ask);
    if (!p || n.risk === "destructive" || n.ask.kind !== "permission") return 0;
    return history.get(p)?.n || 0;
  }
  function noteAllowed(n, taught, scope) {
    const p = prefixOfAsk(n.ask);
    if (!p) return null;
    const h = history.get(p) || { n: 0, projects: new Set() };
    h.n += 1; h.projects.add(n.t.project); history.set(p, h);
    if (!taught) return null;
    const cmd = Kit.commandOf(n.ask);
    const r = { id: `r${rules.length + 1}_${Date.now().toString(36)}`, text: Kit.teachSentence(PROJ(n.t.project), scope === "prefix" ? p : cmd), cap: null, prefix: scope === "prefix" ? p : null, exact: scope === "prefix" ? null : cmd, project: n.t.project, absorbed: 0, regretted: 0, since: Date.now(), fresh: true };
    rules.unshift(r);
    onEvent({ kind: "rule", rule: r });
    onChange();
    return r;
  }
  /** Which rule would absorb this ask (never destructive, never production data). */
  function coverFor(t, a) {
    if (!a || Kit.riskOf(a) === "destructive" || a.kind === "question" || a.kind === "action") return null;
    const cmd = Kit.commandOf(a);
    for (const r of rules) {
      if (r.project && r.project !== t.project) continue;
      if (r.exact && cmd === r.exact) return { rule: r };
      if (r.prefix && cmd && Kit.prefixOf(cmd) === r.prefix) return { rule: r };
      if (r.cap) { if (r.cap === "docs" && DOCS(a)) return { rule: r }; }
    }
    return null;
  }
  function absorbed(t, a, cover) {
    if (cover.rule) cover.rule.absorbed += 1;
    sessionAbsorbed.push({ at: Date.now(), project: t.project, title: a.title, by: cover.rule ? "rule" : "notch" });
    onChange();
  }

  return {
    rules: () => rules, repeats, noteAllowed, coverFor, absorbed, sessionAbsorbed: () => sessionAbsorbed.slice(),
    absorbedTotal: () => rules.reduce((s, r) => s + r.absorbed, 0),
  };
}

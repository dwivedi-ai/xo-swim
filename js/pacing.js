// Converged · pacing. 16's attention rules, applied INVISIBLY: there is no
// daily cap, no meter and no number to do arithmetic with. What the person
// sees is only the result: fewer, better asks.
//
//   hold     a small ask (frees < 30 agent-min) on a thread that keeps
//            working around it waits quietly. It never idles an agent: an ask
//            whose agent is waiting on you is always admitted.
//   bypass   destructive asks and stopped threads are never held, whatever
//            their size.
//   ping     only a newly arrived ask that frees ≥ the threshold (1 agent-h)
//            may speak up, once, in the calm line above the composer.
//   break    after ~25 minutes inside the decision panel, the next natural
//            pause suggests a break (the queue holds safely).
//   seal     the end of the day holds every channel until morning, but only
//            when nothing is time-critical (see night.js).

export const SMALL_MIN = 30;   // below this, an ask that isn't blocking anyone can wait
export const PING_MIN = 60;    // only asks that free at least this much may speak up

export function createPacing({ params }) {
  const S = {
    pingMin: PING_MIN,
    vigilMin: 25,
    reviewMs: (+params.get("review") || 0) * 60000,
    reviewFrom: 0,
    vigilAckAt: -1,
    brought: new Set(),   // held asks the person brought in
    parked: new Set(),    // away: asks parked behind the first three
    pinged: new Set(),
    sealed: false,
  };
  const bypass = (n) => n.risk === "destructive" || n.group === "stopped";

  /** Mark each need: admitted | held (+ why). */
  function classify(needs) {
    for (const n of needs) {
      n.bypass = bypass(n);
      n.held = false; n.heldWhy = "";
      if (!n.bypass && !S.brought.has(n.key) && !n.idle && n.lev.min < SMALL_MIN) {
        n.held = true;
        n.heldWhy = "Small, and its agent works around it.";
      }
      n.parked = !n.held && !n.bypass && S.parked.has(n.key);
      n.admitted = !n.held && !n.parked;
    }
    return needs;
  }

  return {
    S,
    classify,
    isBypass: bypass,
    bringIn(key) { S.brought.add(key); S.parked.delete(key); },
    park(keys) { for (const k of keys) S.parked.add(k); },
    unpark() { S.parked.clear(); },
    /** Leverage-gated: may this newly arrived ask speak up (once)? */
    mayPing(n) {
      if (S.sealed || S.pinged.has(n.key) || n.held || n.lev.min < S.pingMin) return false;
      S.pinged.add(n.key);
      return true;
    },
    set sealed(v) { S.sealed = !!v; },
    get sealed() { return S.sealed; },

    // ── the vigilance cap: time spent deciding ───────────────────────────────
    reviewStart() { if (!S.reviewFrom) S.reviewFrom = Date.now(); },
    reviewStop() { if (S.reviewFrom) { S.reviewMs += Date.now() - S.reviewFrom; S.reviewFrom = 0; } },
    reviewMin() { return (S.reviewMs + (S.reviewFrom ? Date.now() - S.reviewFrom : 0)) / 60000; },
    tired() {
      const m = this.reviewMin();
      return m >= S.vigilMin && (S.vigilAckAt < 0 || m - S.vigilAckAt >= 15);
    },
    keepGoing() { S.vigilAckAt = this.reviewMin(); },
    rested() { this.reviewStop(); S.reviewMs = 0; S.vigilAckAt = -1; },
  };
}

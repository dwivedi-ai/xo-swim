// The Demo / Live badge: bottom-left, small, never the hero. Demo runs a
// simulated workspace in the browser (no backend writes); Live reads and
// writes the real XO projects-chat API through serve.py. A build can lock
// the mode with <html data-mode-lock> (the standalone demo does).
import { esc } from "./world.js";

export function mountMode(world) {
  const locked = document.documentElement.hasAttribute("data-mode-lock");
  const el = document.createElement("div");
  el.className = "uxc";
  el.innerHTML =
    `<button class="uxc-me" aria-expanded="false"${locked ? " disabled" : ""}>` +
    `<span class="uxc-mode is-${world.mode}">${world.mode === "live" ? "Live" : "Demo"}</span></button>` +
    (locked ? "" :
      `<div class="uxc-pop" hidden><div class="uxc-row"><span>Data</span><div class="uxc-seg">` +
      `<button data-mode="demo" aria-pressed="${world.mode === "demo"}">Demo world</button>` +
      `<button data-mode="live" aria-pressed="${world.mode === "live"}">Live backend</button></div></div>` +
      `<p class="uxc-tag">${esc(world.mode === "live" ? "Live: your real workspace. Sending starts real agents." : "Demo: a simulated workspace. Nothing is sent anywhere.")}</p></div>`);
  document.body.appendChild(el);
  if (locked) return;
  const btn = el.querySelector(".uxc-me");
  const pop = el.querySelector(".uxc-pop");
  btn.addEventListener("click", () => { pop.hidden = !pop.hidden; btn.setAttribute("aria-expanded", String(!pop.hidden)); });
  el.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => world.setMode(b.dataset.mode)));
  addEventListener("keydown", (e) => { if (e.key === "Escape") pop.hidden = true; });
  addEventListener("click", (e) => { if (!el.contains(e.target)) pop.hidden = true; });
}

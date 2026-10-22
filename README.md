# xo-coworker

**XO Space's web UI.** Codename xo-swim: Smart Work & Ideas Management.

A web UI for the XO Space **projects chat** backend (`/api/projects-chat/*`). It is built around one idea: protect the person's attention. The screen shows what is worth your time and the next action. Everything that only needs an agent stays quiet.

- **Home**: what is worth your time across every project, ranked. Small asks that block nobody wait quietly and say why. Then "Handled": what is running and what can wait.
- **Needs you** panel: one decision at a time, with what it unblocks, the evidence and Details. On phones it is a bottom sheet.
- **Workspace**: your coordinator across all projects. Messages show where they were routed.
- **Projects**: a title, one sentence, the Now shelf of threads in progress, and All threads (searchable, finished ones folded).
- **Threads**: each has its own agent, branch and checklist. The thread's own decision sits above the composer.
- **Composer**: `@project` aims a message at a project. The model chip shows the routing in effect.
- Light and dark themes. Geist type and the XO palette, with XO green as the accent. Motion honours reduced-motion settings.

Plain HTML, CSS and vanilla ES modules: no build step, no npm, no CDN.

## Start

```sh
python3 serve.py                 # foreground, http://127.0.0.1:5180
./start.sh --background          # detached (pid in .server.pid, log in .server.log)
./start.sh --status | --stop
```

| var      | default                 | meaning                       |
|----------|-------------------------|-------------------------------|
| `PORT`   | `5180`                  | port to listen on             |
| `XO_API` | `http://127.0.0.1:5002` | the XO Space API to proxy to  |
| `HOST`   | `127.0.0.1`             | bind address                  |

`serve.py` (standard library only) serves the files and reverse-proxies `/api/*` to `XO_API`:
- It answers only pages it served: a request from any other page, read or write, gets a 403.
- It never forwards the backend routes this UI doesn't use that expose secret values, raw files or file writes
  under `$HOME`, however they are spelled, and refuses a path with `#` or dot segments.
- It drops the browser's `Origin`, `Referer` and `Sec-Fetch-*` headers before forwarding.
- It relays Server-Sent Events unbuffered.

## Live and Demo

| Mode | How | What it does |
|---|---|---|
| **Live** (default) | `/` | Reads and writes your real XO workspace. **Sending a message starts real agents.** |
| **Demo** | `/?mode=demo`, or the badge at bottom-left | A simulated, busy workspace that runs in the browser. Nothing is sent anywhere. |

The choice is remembered per browser (`localStorage` `xo-mode`). Demo-only features never run in Live: the end-of-day seal and morning recap, "Found while working", rules, and the Stop button. Demo also accepts `?at=day|evening|night|morning` and `?away=N` to place the story at a moment of the day.

A standalone copy locked to Demo, with no backend at all, lives at `/home/coder/xo-swim-demo` (`python3 serve_demo.py`, port 5210).

### How Live talks to the backend

- **Status:** `GET /status` at boot, every 20 s, and every 8 s while failing. An unreachable backend, the router being off or an unsupported backend shows as one calm line, and Send is disabled with the reason.
- **Threads:** every project's threads every 15 s, one poll at a time. A project that fails keeps its last good data. Thread details load in parallel, six at a time.
- **Conversations:** `GET /chats/{chat}/messages?limit=40`, plus an SSE `ChatStream` for the open chat (the Workspace while on Home). `message`, `thread` and `heartbeat` events are handled, with backoff and a polling fallback. Scrolling up grows history 40 → 80 → 160… (up to 1,000).
- **Sending:** `POST /chats/{chat}/messages {text, thread_ts?}`. Your message appears at once and is replaced in place by the server's row. "Replying" follows the coordinator's real heartbeat. Errors use plain titles, with Retry and Edit.
- **Open thread:** polled every 4 s while its agent is busy and every 15 s otherwise. "Working" means the session is actually busy. An idle one reads "Idle".
- **Asks:** a thread waiting on you is titled from its agent's last message. You answer in words, as a thread reply.

**The backend does not have these yet**, so the UI hides or degrades them (see `docs/requirements.md`):
- approvals with an approve/deny route (R2);
- stopping a running agent;
- resolving a thread from the UI (R1);
- per-chat model choice (R6; the chip is read-only);
- a `before` history cursor (R5).

## Code

| File | Role |
|---|---|
| `index.html` | the shell: sidebar, Home, conversation, dock, panel, sheets |
| `css/tokens.css` | palette, type scale, Geist faces |
| `css/base.css`, `css/app.css`, `css/mode.css` | reset, the UI, and the Demo/Live badge |
| `js/app.js` | views, rendering, navigation, composer, sending |
| `js/world.js` | the data source: `liveSource` (real API) and `demoSource` (simulated) |
| `js/api.js`, `js/stream.js` | HTTP client and SSE `ChatStream` |
| `js/model.js`, `js/timeline.js`, `js/markdown.js`, `js/util.js` | pure helpers: thread state, checklists, message rows and dedupe, asks, `@target`, safe markdown |
| `js/decide.js`, `js/kit.js`, `js/pacing.js` | decisions, the decision kit and commit window, and pacing (what speaks up and what waits) |
| `js/intel.js` | the model and depth chip |
| `js/night.js`, `js/finds.js`, `js/rules.js`, `js/content.js` | demo-only stories and their content |
| `js/ui.js`, `js/mode.js` | icons and motion helpers, and the Demo/Live badge |

## Tests

```sh
node tests/logic.test.mjs        # pure modules; the live-data part only sends GETs through :5180
```

The browser suites (Playwright) live outside the repo:
- a 105-check suite for Demo;
- a 59-check suite for Live, which mocks or blocks every non-GET request;
- a no-writes-on-load check.

**Never let a test send a non-GET request to a live backend.**

## History

- The classic UI this replaced is tagged `classic-ui` in git.
- The design research, the 17 concepts this UI converged from and the full session handoff are kept locally, outside git:
  - `docs/` (start with `docs/README.md`);
  - `/home/coder/xo-archive/2026-10-14/`.

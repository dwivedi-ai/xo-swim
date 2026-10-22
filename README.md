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

## The backend

The UI reads and writes your real XO workspace. **Sending a message starts real agents.**

- **Status:** `GET /status` at boot, every 20 s, and every 8 s while failing. An unreachable backend, the router being off or an unsupported backend shows as one calm line, and Send is disabled with the reason.
- **Threads:** every project's threads every 15 s, one poll at a time. A project that fails keeps its last good data. Thread details load in parallel, six at a time.
- **Conversations:** `GET /chats/{chat}/messages?limit=40`, plus an SSE `ChatStream` for the open chat (the Workspace while on Home). `message`, `thread` and `heartbeat` events are handled, with backoff and a polling fallback. Scrolling up grows history 40 → 80 → 160… (up to 1,000).
- **Files (hub #30):** the paperclip, a drop or a paste adds text, images or PDFs (25 MB each, 10 per message). Each uploads at once to the chat (`POST /chats/{chat}/attachments`) as a chip with progress, Retry and Remove; Send waits for them. A paste over 4,000 characters or 80 lines becomes `pasted-text-N.md`. Sent files open in the viewer through their message's own chat.
- **Sending:** `POST /chats/{chat}/messages {text, thread_ts?, attachments?}`. Your message appears at once and is replaced in place by the server's row. "Replying" follows the coordinator's real heartbeat. Errors use plain titles, with Retry and Edit.
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
| `css/base.css`, `css/app.css` | reset and the UI |
| `js/app.js` | views, rendering, navigation, composer, sending |
| `js/world.js`, `js/storm.js` | the world the views render, from the real API |
| `js/api.js`, `js/stream.js` | HTTP client and SSE `ChatStream` |
| `js/attach.js` | files on a message: checks before upload, a large paste as a file, the composer's upload tray |
| `js/model.js`, `js/timeline.js`, `js/markdown.js`, `js/util.js` | pure helpers: thread state, checklists, message rows and dedupe, asks, `@target`, safe markdown |
| `js/decide.js`, `js/kit.js`, `js/pacing.js` | decisions, the decision kit and commit window, and pacing (what speaks up and what waits) |
| `js/intel.js` | the model and depth chip |
| `js/content.js` | what an ask costs you, what it frees, and its evidence |
| `js/ui.js` | icons and motion helpers |

## Tests

```sh
node tests/logic.test.mjs        # pure modules; the live-data part only sends GETs through :5180
node tests/attach.test.mjs       # files on a message and the hop line; no network
```

The browser suites (Playwright) live outside the repo:
- a 59-check suite for Live, which mocks or blocks every non-GET request;
- a no-writes-on-load check.

**Never let a test send a non-GET request to a live backend.**

## History

- The classic UI this replaced is tagged `classic-ui` in git.
- The design research, the 17 concepts this UI converged from and the full session handoff are kept locally, outside git:
  - `docs/` (start with `docs/README.md`);
  - `/home/coder/xo-archive/2026-10-14/`.

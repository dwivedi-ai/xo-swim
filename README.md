# xo-swim

**Codename for XO Space Cowork: Smart Work & Ideas Management.**

A web UI for the XO Space **projects chat** backend (`/api/projects-chat/*`):
a home page of what needs you across every project, the workspace and project
coordinators, their threads (each with its own agent, branch and checklist),
and live updates.

Plain HTML, CSS and vanilla JS ES modules: no build step, no npm, no CDN.
Type is Geist (Geist Mono for code); colours follow XO Space's palette with
XO green as the accent. Interaction follows a few rules: every wait is
acknowledged at once, nothing jumps, typed text is never lost, and what waits
on a person is loud while what waits on an agent is quiet.

## Start

```sh
python3 serve.py                 # foreground, http://127.0.0.1:5180
./start.sh                       # same
./start.sh --background          # detached (pid in .server.pid, log in .server.log)
./start.sh --status
./start.sh --stop
```

Environment:

| var      | default                  | meaning                         |
|----------|--------------------------|---------------------------------|
| `PORT`   | `5180`                   | port to listen on (127.0.0.1)   |
| `XO_API` | `http://127.0.0.1:5002`  | the XO Space API to proxy to    |
| `HOST`   | `127.0.0.1`              | bind address                    |

Then open <http://127.0.0.1:5180/> (or your editor's forwarded URL for port 5180).

### Why a server

The XO API refuses cross-origin browser writes, so the page must not call it
directly. `serve.py` (Python standard library only) serves the static files
**and** reverse-proxies `/api/*` to `XO_API`:

- forwards method, body and content type; drops the browser's `Origin`,
  `Referer` and `Sec-Fetch-*` headers (it acts as a server-side proxy);
- applies its own same-origin check to writes first, so another website
  cannot use the proxy to post on your behalf (cross-site writes get 403);
- relays Server-Sent Events unbuffered (flush per chunk, `TCP_NODELAY`);
- threaded, binds 127.0.0.1.

## What the UI does

- **Home** (the default, `#/home`): what needs you (questions and approvals,
  loud), what is failing, what agents are working on (quiet), what is ready
  for review, across every project. Below that, your projects, and a box to
  ask the workspace (it sends to the workspace chat).
- **Create XO Project** (sidebar and home): name, folder and an optional
  description. It reads the projects root from `GET /api/config/workspace`
  and scaffolds with `POST /api/files/mkdir` (`scaffold: true`). A taken
  folder (409) is explained inline.
- **Fresh start**: a chat with history opens looking new; history is one
  scroll above ("N earlier messages"). When you send, your message settles at
  the top of the view with room for the reply, so nothing jumps as it grows.

- **Sidebar** (collapsible; a drawer on phones): Workspace first, then each
  project with its open-thread count. `Ctrl/⌘ K` focuses the chat
  switcher (arrow keys + Enter to pick).
- **Title bar**: breadcrumb (Projects chat / chat) with a kind tag, the
  Threads toggle (count turns amber when something waits on you) and the
  theme toggle (follows the OS until you pick one).
- **Status bar** (bottom): connection (Live / Reconnecting / Polling /
  Offline, by shape and colour), router, agent, modes, model, and the keys.
  Quiet when healthy; it only takes colour when something is wrong.
- **Conversation**: owner messages as right-aligned bubbles, coordinator
  replies as unboxed prose with an avatar, day separators, copy buttons.
  "Forwarded from Workspace" on forwarded messages; in the Workspace, owner
  messages that were routed show **Routed to → project** chips (click to jump
  to the forwarded copy). An owner message that rooted a thread shows a
  **Thread: title · state →** chip.
- **Sending is instant and forgiving**: your message appears in the same frame
  (*Sending*), the composer clears, and a failure keeps the message in place
  with **Retry** and **Edit**. Drafts are saved per chat and per thread
  (localStorage), so switching chats or reloading never loses typed text.
- **Live replies are appended**, never re-rendered: text you are reading or
  selecting stays put. New replies are announced to screen readers, and the
  tab title counts replies that arrived while the tab was hidden.
- **Honest waits**: the working indicator shows elapsed time, and after 15 s
  says you can keep working (replies arrive live).
- **Where things stand**: when the Threads dock is closed, a strip over the
  conversation shows what waits on you first (diamond), then what agents are
  doing. Dismissing it holds until something changes.
- **Composer**: auto-growing, Enter to send, Shift+Enter for a newline,
  disabled with the reason when the router is off / the backend is
  unsupported / the API is unreachable. A "Coordinator is working…" indicator
  shows while the heartbeat says busy, and right after sending until a reply
  arrives. Smooth autoscroll with a "jump to latest / N new messages" pill.
  Empty chats show suggested prompts (clicking one fills the composer; it
  never sends by itself).
- **Threads panel** (right; a bottom sheet on narrow screens; `Esc` closes):
  cards grouped *Waiting on you*, *Working*, *Ready for review*, *Failed*,
  *Resolved* (empty groups hidden), each with title, checklist progress
  (✓ done / total), headline / latest update or what it needs from you,
  branch and relative time.
- **Thread view**: opened from a card, a thread chip, or a coordinator link
  like `[Title](#cmsg_…)`. Title, state badge, branch, turns, last error,
  "needs you" callout, latest card update, the live checklist (✱ in progress,
  ○ to do, ✓ done), the root message and the thread's messages, and its own
  composer (posts with `thread_ts`, straight to the thread's agent).
  The URL hash (`#/c/<chat>/t/<ts>`) links to a chat or thread.
- **Design principles** (from the Baby research): the work is the hero and
  status stays quiet; every wait is acknowledged at once; nothing jumps;
  typed text is never lost; feedback appears where the eye already is (copy
  shows a check, not a toast); motion is short and honours reduced motion.
- **Markdown**: safe subset (paragraphs, headings, lists, quotes, bold/italic,
  inline code, fenced code with a copy button, links). Message text is never
  inserted as HTML; links are allowed only to `http(s)` (new tab) and in-app
  `#cmsg_…` thread anchors.
- **Live updates**: one `EventSource` per open chat (`message`, `thread`,
  `heartbeat` events), deduped by message id, reconnecting with backoff and
  falling back to polling every 4s after repeated errors (retrying SSE every
  30s). The open thread refreshes on its `thread` events and polls every 4s
  while its agent is busy.

## Files

```
serve.py            static server + /api reverse proxy (stdlib)
start.sh            start / --background / --stop / --status
index.html          page shell
css/tokens.css      XO Space tokens, fonts, light/dark
css/app.css         layout and components
js/app.js           state, events, rendering into the page
js/api.js           fetch client for /api/projects-chat
js/stream.js        SSE with backoff and polling fallback
js/views.js         HTML builders (escaped)
js/markdown.js      safe markdown renderer
js/model.js         merging, thread grouping, checklist parsing
js/util.js          escaping and time helpers
fonts/geist/        Geist, Geist Mono variable (SIL OFL 1.1)
tests/logic.test.mjs  node tests: markdown safety, grouping, checklist,
                      and rendering of the live chats (needs the server)
```

Run the tests with `node tests/logic.test.mjs` while the server is up.

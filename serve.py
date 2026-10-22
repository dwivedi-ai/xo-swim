#!/usr/bin/env python3
"""Static server + reverse proxy for the XO projects-chat test UI.

    python3 serve.py              # http://127.0.0.1:5180
    PORT=5181 XO_API=http://127.0.0.1:5002 python3 serve.py

Serves the files in this folder and forwards every /api/* request to the
XO Space backend (XO_API, default http://127.0.0.1:5002). Server-Sent Event
responses are relayed chunk by chunk with no buffering.

Why a proxy: the backend refuses browser writes whose Origin it does not
recognise. This server is the browser's origin, so it applies its own
same-origin check and then forwards WITHOUT the browser's
Origin/Referer/Sec-Fetch-* headers (as a server-side proxy would).

What it refuses, whatever the page asks:
- any request, read or write, from a page it didn't serve (several backend
  GETs write or call out);
- the routes this UI never uses that expose secret values, raw files or
  file writes anywhere under $HOME (NEVER_FORWARD), in every spelling;
- a request path with "#" or "." / ".." segments, raw or encoded;
- a body over 1 MiB, except an attachment upload (up to 25 MiB).

Standard library only.
"""

from __future__ import annotations

import http.client
import os
import re
import socket
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "5180"))
XO_API = os.environ.get("XO_API", "http://127.0.0.1:5002").rstrip("/")
_UP = urlsplit(XO_API)
if _UP.scheme not in ("http", "https") or not _UP.hostname:
    sys.exit(f"XO_API must be an http(s) URL, got {XO_API!r}")

# Request headers never forwarded upstream: hop-by-hop ones, and the browser
# labels the backend's write guard reads (we enforce same-origin ourselves).
DROP_REQUEST = {
    "host", "connection", "keep-alive", "proxy-connection", "te", "trailer",
    "transfer-encoding", "upgrade", "origin", "referer", "accept-encoding",
    "content-length", "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest",
    "sec-fetch-user",
    # The Coder token the UI sends so Coder's app proxy lets it through; the
    # backend has no use for it.
    "coder-session-token",
}
# The same token in a query string (EventSource can't send headers).
TOKEN_PARAM = "coder_session_token"


def strip_token(path: str) -> str:
    """`path` without the Coder token in its query, for forwarding and logs."""
    base, sep, query = path.partition("?")
    if not sep:
        return path
    kept = [p for p in query.split("&") if p.split("=", 1)[0] != TOKEN_PARAM]
    return base + ("?" + "&".join(kept) if kept else "")
DROP_RESPONSE = {
    "connection", "keep-alive", "transfer-encoding", "content-length", "server", "date",
    "access-control-allow-origin", "access-control-allow-credentials",
}
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
# Backend routes this UI never uses and that expose too much: raw secret values or bulk secret writes, and
# raw reads or writes of any file under $HOME. They are never forwarded, whatever the page asks (the hub reuses this
# handler, so the same holds there).
NEVER_FORWARD = [
    ("GET", re.compile(r"^/api/secrets/env$")),
    ("GET", re.compile(r"^/api/secrets/.+/reveal$")),
    ("PUT", re.compile(r"^/api/secrets/env$")),
    ("PUT", re.compile(r"^/api/secrets$")),
    ("POST", re.compile(r"^/api/files/content$")),
    ("POST", re.compile(r"^/api/files/content-binary$")),
    ("POST", re.compile(r"^/api/files/list-directory$")),
    # writes anywhere under $HOME; this UI creates folders only with /api/files/mkdir
    ("POST", re.compile(r"^/api/files/save$")),
    ("POST", re.compile(r"^/api/files/upload$")),
    # An agent profile's secrets file, unmasked (Hermes), and its whole-file replace: every method.
    ("*", re.compile(r"^/api/agents/[^/]+/[^/]+/secrets$")),
]


def never_forward(method: str, path: str) -> bool:
    """True for a route this proxy refuses: the path cut at "?" or "#", decoded (twice, for double
    encoding), slashes collapsed and any trailing slash dropped, so no spelling of it slips through."""
    p = unquote(unquote(re.split(r"[?#]", path, maxsplit=1)[0]))
    p = re.sub(r"/+", "/", p).rstrip("/") or "/"
    return any(m in (method, "*") and rx.match(p) for m, rx in NEVER_FORWARD)


def odd_path(path: str) -> bool:
    """True for a path no page of this UI sends: a "#", raw or encoded, or a "." or ".." segment, raw or
    encoded. The backend doesn't resolve them today; refusing them keeps the checked path the routed one."""
    p = unquote(unquote(path.split("?", 1)[0]))
    return "#" in path or "#" in p or any(seg in (".", "..") for seg in p.split("/"))


MAX_BODY = 1 << 20  # 1 MiB is plenty for a chat message
# A file attached to a message (hub #30): the backend takes up to 25 MiB; a little more lets its own
# 413 answer (with the limit in words) rather than ours.
UPLOAD = re.compile(r"^/api/chat/chats/[^/]+/attachments$")
MAX_UPLOAD = 25 * (1 << 20) + (64 << 10)


def max_body(method: str, path: str) -> int:
    """The largest request body forwarded for this route: MAX_UPLOAD for an attachment upload, else MAX_BODY."""
    return MAX_UPLOAD if method == "POST" and UPLOAD.match(path.split("?", 1)[0]) else MAX_BODY


class Handler(SimpleHTTPRequestHandler):
    server_version = "xo-chat-ui"
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # ── routing ──────────────────────────────────────────────────────────────
    def do_GET(self):
        if self._is_api():
            return self._proxy()
        return super().do_GET()

    def do_HEAD(self):
        if self._is_api():
            return self._proxy()
        return super().do_HEAD()

    def do_POST(self):
        return self._proxy() if self._is_api() else self.send_error(405)

    do_PUT = do_PATCH = do_DELETE = do_POST

    def _is_api(self) -> bool:
        path = self.path.split("?", 1)[0]
        return path == "/api" or path.startswith("/api/")

    def end_headers(self):
        if not self._is_api():
            # Always revalidate static files so edits show up on reload.
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def list_directory(self, path):  # no directory listings
        self.send_error(404)
        return None

    def log_message(self, fmt, *args):
        if "/stream" in self.path and os.environ.get("XO_UI_QUIET_STREAM", "1") == "1":
            return
        line = (fmt % args).replace(self.path, strip_token(self.path))
        sys.stderr.write("%s - %s\n" % (self.log_date_time_string(), line))

    # ── same-origin check for writes ─────────────────────────────────────────
    def _write_allowed(self) -> bool:
        site = self.headers.get("Sec-Fetch-Site")
        if site is not None:
            # Browsers set this and pages cannot forge it.
            return site in ("same-origin", "none")
        origin = self.headers.get("Origin")
        if origin is None:
            return True  # curl, scripts: not a browser page
        try:
            ohost = urlsplit(origin).netloc.lower()
        except ValueError:
            return False
        allowed = {h.strip().lower() for h in
                   (self.headers.get("Host", ""), self.headers.get("X-Forwarded-Host", "")) if h}
        return ohost in allowed

    def _json_error(self, status: int, code: str, message: str):
        body = ('{"detail":{"code":"%s","message":"%s"}}' % (code, message.replace('"', "'"))).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ── proxy ────────────────────────────────────────────────────────────────
    def _proxy(self):
        method = self.command
        # Browsers never send a fragment or dot segments. The backend drops a fragment before routing, so
        # these could only be an attempt to make the path checked below differ from the path it routes.
        if odd_path(self.path):
            return self._json_error(400, "bad_target", "This UI never sends a request path like this.")
        if never_forward("GET" if method == "HEAD" else method, self.path):
            return self._json_error(403, "not_forwarded", "This UI never uses this route: it exposes secret values or raw files.")
        # Every forwarded request answers only pages served by this UI (or no page: curl, the address bar).
        # Reads too: several backend GETs write or call out, and a page from another site, or a sandboxed
        # preview of an HTML file, must not reach them.
        if not self._write_allowed():
            msg = "Cross-origin writes are refused by the UI proxy." if method in WRITE_METHODS else "This is only answered for pages served by this UI."
            return self._json_error(403, "cross_origin", msg)

        length = int(self.headers.get("Content-Length") or 0)
        cap = max_body(method, self.path)
        if length > cap:
            # the browser may still be sending: don't read it, and don't keep the connection
            self.close_connection = True
            return self._json_error(413, "too_large", "A file may be at most 25 MB." if cap == MAX_UPLOAD else "Request body is too large.")
        body = self.rfile.read(length) if length else None

        headers = {k: v for k, v in self.headers.items() if k.lower() not in DROP_REQUEST}
        headers["Host"] = _UP.netloc
        headers["Accept-Encoding"] = "identity"
        if body is not None:
            headers["Content-Length"] = str(len(body))
        target = (_UP.path.rstrip("/") or "") + strip_token(self.path)
        is_stream = "/stream" in self.path.split("?", 1)[0]

        conn_cls = http.client.HTTPSConnection if _UP.scheme == "https" else http.client.HTTPConnection
        conn = conn_cls(_UP.hostname, _UP.port, timeout=None if is_stream else 120)
        try:
            conn.request(method, target, body=body, headers=headers)
            resp = conn.getresponse()
        except (OSError, http.client.HTTPException) as exc:
            conn.close()
            return self._json_error(502, "upstream_unreachable",
                                    f"Could not reach the XO API at {XO_API} ({type(exc).__name__}).")

        try:
            ctype = resp.getheader("Content-Type", "")
            if ctype.startswith("text/event-stream"):
                self._relay_stream(resp)
            else:
                data = resp.read()
                self.send_response(resp.status, resp.reason)
                for k, v in resp.getheaders():
                    if k.lower() not in DROP_RESPONSE:
                        self.send_header(k, v)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                if method != "HEAD":
                    self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError, socket.timeout):
            pass  # the browser went away
        finally:
            conn.close()

    def _relay_stream(self, resp):
        """Forward an SSE body as it arrives: no buffering, flush every chunk."""
        self.close_connection = True
        self.send_response(resp.status, resp.reason)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.flush()
        try:
            self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except OSError:
            pass
        while True:
            chunk = resp.read1(65536)
            if not chunk:
                break
            self.wfile.write(chunk)
            self.wfile.flush()


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    httpd = Server((HOST, PORT), Handler)
    print(f"XO chat UI on http://{HOST}:{PORT}  ->  proxying /api/* to {XO_API}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()

#!/usr/bin/env sh
# XO projects chat UI: static files + /api proxy (serve.py, stdlib only).
#
#   ./start.sh               run in the foreground (Ctrl+C to stop)
#   ./start.sh --background  run detached; pid in .server.pid, log in .server.log
#   ./start.sh --stop        stop the detached server
#   ./start.sh --status      is the detached server running?
#
# Environment: PORT (default 5180), XO_API (default http://127.0.0.1:5002).
cd "$(dirname "$0")" || exit 1
PIDFILE=.server.pid
running() { [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }

case "${1:-}" in
  --background|-d)
    if running; then echo "already running (pid $(cat "$PIDFILE"))"; exit 0; fi
    nohup python3 serve.py >> .server.log 2>&1 &
    echo $! > "$PIDFILE"
    sleep 0.5
    if running; then echo "started (pid $(cat "$PIDFILE")) on http://127.0.0.1:${PORT:-5180}/"; else echo "failed to start; see .server.log"; exit 1; fi ;;
  --stop)
    if running; then kill "$(cat "$PIDFILE")" && rm -f "$PIDFILE" && echo "stopped"; else echo "not running"; rm -f "$PIDFILE"; fi ;;
  --status)
    if running; then echo "running (pid $(cat "$PIDFILE"))"; else echo "not running"; exit 1; fi ;;
  "")
    exec python3 serve.py ;;
  *)
    echo "usage: $0 [--background|--stop|--status]"; exit 2 ;;
esac

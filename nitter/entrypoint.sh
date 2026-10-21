#!/bin/sh
# Starts Nitter and restarts it whenever the sessions file written by the
# X Monitor admin panel changes (Nitter only reads it at startup).
SESSIONS="${NITTER_SESSIONS_FILE:-/sessions/sessions.jsonl}"
export NITTER_SESSIONS_FILE="$SESSIONS"
export NITTER_CONF_FILE=/tmp/nitter.conf
sed "s/__HMAC_KEY__/${NITTER_HMAC_KEY:-change-me}/" /config/nitter.conf > "$NITTER_CONF_FILE"

cd /src || exit 1
echo "[nitter-wrapper] waiting for $SESSIONS ..."
while [ ! -f "$SESSIONS" ]; do sleep 3; done

sig() { cksum "$SESSIONS" 2>/dev/null; }

while true; do
  # No account sessions yet: Nitter would exit immediately, so just wait for them.
  if [ ! -s "$SESSIONS" ]; then
    echo "[nitter-wrapper] sessions file is empty, add an X account in the admin panel"
    last=$(sig)
    while [ "$(sig)" = "$last" ]; do sleep 5; done
    continue
  fi
  last=$(sig)
  ./nitter &
  pid=$!
  while kill -0 "$pid" 2>/dev/null && [ "$(sig)" = "$last" ]; do sleep 5; done
  kill "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
  sleep 2
done

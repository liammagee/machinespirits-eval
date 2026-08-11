#!/bin/bash
# Follow the newest codex session log, switching automatically when a
# fresh driver session starts. Shows the agent's own messages and the
# commands it runs; drop the grep for the full firehose.
DIR="$HOME/.codex/sessions"
CUR=""
TP=""
trap '[ -n "$TP" ] && kill "$TP" 2>/dev/null; exit 0' INT TERM
while true; do
  NEW=$(ls -t "$DIR"/*/*/*/rollout-*.jsonl 2>/dev/null | head -1)
  if [ -n "$NEW" ] && [ "$NEW" != "$CUR" ]; then
    [ -n "$TP" ] && kill "$TP" 2>/dev/null
    CUR="$NEW"
    echo ""
    echo "=== following $(basename "$CUR") ==="
    tail -n 30 -f "$CUR" \
      | grep --line-buffered -E '"agent_message"|"command"' \
      | cut -c1-400 &
    TP=$!
  fi
  sleep 15
done

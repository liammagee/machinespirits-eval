#!/bin/bash
# Follow the newest codex session log, switching automatically when a
# fresh driver session starts. Shows the agent's own messages and the
# commands it runs; drop the grep for the full firehose.
DIR="$HOME/.codex/sessions"
CUR=""
TP=""
trap '[ -n "$TP" ] && kill "$TP" 2>/dev/null; exit 0' INT TERM
newest() {
  find "$DIR" -name 'rollout-*.jsonl' -mmin -720 2>/dev/null \
    -exec stat -f '%m %N' {} + | sort -rn | head -1 | cut -d' ' -f2-
}
while true; do
  NEW=$(newest)
  if [ -n "$NEW" ] && [ "$NEW" != "$CUR" ]; then
    [ -n "$TP" ] && kill "$TP" 2>/dev/null
    CUR="$NEW"
    echo ""
    echo "=== following $(basename "$CUR") ==="
    tail -n 100 -f "$CUR" \
      | grep --line-buffered -E '"agent_message"|"exec_command_begin"' \
      | sed -u -E 's/.*"message":"([^"]*).*/MSG: \1/; s/.*"command":\[([^]]*)\].*/CMD: \1/' \
      | cut -c1-300 &
    TP=$!
  fi
  sleep 15
done

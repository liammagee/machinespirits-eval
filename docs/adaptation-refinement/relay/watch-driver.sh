#!/bin/bash
# Follow the newest codex session log with full, untruncated messages.
# Switches automatically when a fresh driver session starts. Ctrl-C to stop.
exec python3 - <<'PY'
import glob, json, os, textwrap, time

DIR = os.path.expanduser("~/.codex/sessions")

def newest():
    files = glob.glob(os.path.join(DIR, "**", "rollout-*.jsonl"), recursive=True)
    return max(files, key=os.path.getmtime) if files else None

cur, fh = None, None
try:
    while True:
        n = newest()
        if n and n != cur:
            if fh: fh.close()
            cur, fh = n, open(n, "r", errors="replace")
            print(f"\n=== following {os.path.basename(n)} ===", flush=True)
            fh.seek(0, 2)                       # start at end; history via less <file>
        if fh:
            line = fh.readline()
            if not line:
                time.sleep(2); continue
            try:
                ev = json.loads(line)
            except json.JSONDecodeError:
                continue
            p = ev.get("payload", {})
            t = p.get("type")
            if t == "agent_message":
                msg = p.get("message", "")
                print("\n--- MESSAGE " + ev.get("timestamp", "")[11:19] + " ---", flush=True)
                print(textwrap.fill(msg, width=100), flush=True)
            elif t == "exec_command_begin":
                cmd = p.get("command", [])
                cmd = " ".join(cmd) if isinstance(cmd, list) else str(cmd)
                print("CMD> " + cmd[:2000], flush=True)
            elif t == "agent_reasoning_section_break":
                pass
        else:
            time.sleep(5)
except KeyboardInterrupt:
    pass
PY

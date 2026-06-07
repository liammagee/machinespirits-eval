#!/bin/bash
runs=(
"eval-2026-02-14-e0e3a622"
"eval-2026-02-14-49b33fdd"
"eval-2026-02-14-6c033830"
"eval-2026-02-14-a2b2717c"
"eval-2026-02-20-0fbca69e"
"eval-2026-02-07-b6d75e87"
"eval-2026-02-11-a54235ea"
"eval-2026-02-13-8d40e086"
)

for run in "${runs[@]}"; do
  echo "Backfilling $run..."
  node scripts/eval-cli.js evaluate $run --force --multiturn-only --parallelism 5 --judge claude-opus-4.6
done

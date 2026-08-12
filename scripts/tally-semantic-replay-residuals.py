#!/usr/bin/env python3
"""Tally validator-rule residuals in a zero-call semantic counterfactual replay.

Usage:
  python3 scripts/tally-semantic-replay-residuals.py <replay.json> [--relax RULE ...]

Reads the replay artifact written by the counterfactual replayer
(rows[] with trace, turn, status, error_code, residual_issues) and prints:
  1. status counts (survives / discarded);
  2. discard concentration per learner profile (parsed from the trace path);
  3. profile x validator-rule table;
  4. if --relax rules are given: how many discarded turns would survive
     when every cited rule on that turn belongs to the relaxed set
     (a zero-call what-if — it changes nothing, it only counts).

Rules are matched on the final colon-separated token of each residual
issue, e.g. 'events[1].target.target_id:required' -> 'required'.

Zero provider calls. Read-only. Reviewer diagnostic, first used on the
seed-509 halt (relay 029/030, 12 Aug 2026).
"""
import json, re, sys, collections

def main():
    args = sys.argv[1:]
    if not args or args[0] in ('-h', '--help'):
        print(__doc__); return 0
    path = args[0]
    relax = set()
    if '--relax' in args:
        relax = set(args[args.index('--relax') + 1:])
    data = json.load(open(path))
    rows = data['rows']
    disc = [r for r in rows if r['status'] == 'discarded']
    print(f"rows: {len(rows)}  status: {dict(collections.Counter(r['status'] for r in rows))}")

    def prof(r):
        m = re.search(r'jobs/[^-]+-(.+?)-(instrumented|intervening)', r.get('trace', ''))
        return m.group(1) if m else '?'

    prof_tot = collections.Counter(prof(r) for r in disc)
    print(f"discards per profile: {dict(prof_tot)}")

    tab = collections.Counter()
    for r in disc:
        for i in r['residual_issues']:
            tab[(prof(r), i.split(':')[-1])] += 1
    print("profile x rule:")
    for (p, rule), n in sorted(tab.items()):
        print(f"  {p:24s} {rule:48s} {n}")

    if relax:
        def rules(r):
            return set(i.split(':')[-1] for i in r['residual_issues'])
        saved = [r for r in disc if rules(r) and rules(r) <= relax]
        print(f"\nwhat-if --relax {sorted(relax)}:")
        print(f"  discarded turns whose every cited rule is relaxed: {len(saved)}/{len(disc)}")
        left = collections.Counter()
        for r in disc:
            if r not in saved:
                for i in r['residual_issues']:
                    left[i.split(':')[-1]] += 1
        print(f"  rules on still-discarded turns: {dict(left)}")
    return 0

if __name__ == '__main__':
    sys.exit(main())

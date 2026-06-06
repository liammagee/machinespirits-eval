#!/usr/bin/env node
/**
 * A18.37 convergence-rate aggregator (zero-API).
 *
 * Reads the per-family local-screen verdicts emitted by
 * run-a18-family-local-screen.js (one JSONL line each) and folds in the
 * relational_betweenness n=1 prior (read from its preserved a18.8 transfer
 * reports, classified by the SAME rules — no special-casing), then reports a
 * TWO-LEVEL convergence rate:
 *
 *   elicitation rate = survivors / families            (did attempt-1 make the move?)
 *   headroom rate    = converges  / survivors          (does policy memory help a
 *                                                        held-out sibling?)
 *
 * Why two levels: a family that fails attempt-1 never reaches the headroom test,
 * so "does policy memory transfer" is only defined over elicitation survivors.
 * Collapsing the two into a single rate conflates a design-elicitation failure
 * with a genuine no-headroom result.
 *
 * Classification (fixed rules, audit-friendly):
 *   - stage attempt1_no_survivor                       -> elicitation_fail
 *   - stage ablated  & family_local_headroom_relaxed   -> converges
 *   - stage ablated  & !family_local_headroom_relaxed  -> headroom_fail
 *   - stage error, message mentions "ablation"         -> survivor, headroom PENDING
 *       (it reached the ablation step => it survived attempt-1; the A18.37
 *        inner-max-chars config bug, fixed in b4c3f8e, only mis-named the report)
 *   - stage error, otherwise                           -> pending (unclassified)
 *   - stage attempt1_survivor_ablation_skipped         -> survivor, headroom PENDING
 *
 * Zero-API: reads existing verdict + report JSON only.
 *
 * Usage:
 *   node scripts/summarize-a18-convergence-rate.js \
 *     --results exports/recursive-tutor-learning/a18.37-replication-fanout/results.jsonl \
 *     [--relational-dir exports/recursive-tutor-learning/a18.35-relational-betweenness-local] \
 *     [--out exports/recursive-tutor-learning/a18.37-replication-fanout/convergence-rate.json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

const RELATIONAL_DEFAULT = 'exports/recursive-tutor-learning/a18.35-relational-betweenness-local';

function parseArgs(argv = process.argv.slice(2)) {
  const args = { results: null, relationalDir: RELATIONAL_DEFAULT, out: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--results') args.results = path.resolve(argv[++i]);
    else if (token === '--relational-dir') args.relationalDir = argv[++i];
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else throw new Error(`unknown arg: ${token}`);
  }
  return args;
}

function readJsonl(p) {
  return fs
    .readFileSync(p, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// Resolve the CANONICAL family_id. Successful verdicts carry it directly. Error
// verdicts carry only chain_dir, so read the family_id from that chain's plan —
// otherwise an error row ("overlay-registration") and its corrected re-run row
// ("overlay_registration_priority") would key differently and BOTH survive the
// per-family de-dup, double-counting the family.
function familyNameFromVerdict(v) {
  if (v.family_id) return v.family_id;
  const cd = String(v.chain_dir || '');
  if (cd) {
    const planPath = path.resolve(ROOT, cd, 'attempt-chain-plan.json');
    if (fs.existsSync(planPath)) {
      try {
        const fam = JSON.parse(fs.readFileSync(planPath, 'utf8')).families?.[0]?.family_id;
        if (fam) return fam;
      } catch {
        /* fall through to slug */
      }
    }
  }
  const m = cd.match(/a18\.35-(.+?)-local/);
  return m ? m[1] : cd || 'unknown';
}

// Fixed-rule classification of one verdict -> { family, elicitation, headroom, klass }.
// elicitation: 'survivor' | 'fail' | 'unknown'
// headroom:    'converges' | 'no_headroom' | 'pending' | 'na'
function classifyVerdict(v) {
  const family = familyNameFromVerdict(v);
  const stage = v.stage;
  if (stage === 'attempt1_no_survivor') {
    return { family, elicitation: 'fail', headroom: 'na', klass: 'elicitation_fail' };
  }
  if (stage === 'ablated') {
    return v.family_local_headroom_relaxed
      ? { family, elicitation: 'survivor', headroom: 'converges', klass: 'converges' }
      : { family, elicitation: 'survivor', headroom: 'no_headroom', klass: 'headroom_fail' };
  }
  if (stage === 'attempt1_survivor_ablation_skipped') {
    return { family, elicitation: 'survivor', headroom: 'pending', klass: 'ablation_skipped' };
  }
  if (stage === 'error') {
    // An error raised DURING the ablation step means attempt-1 already survived.
    if (/ablation \(/i.test(String(v.error || ''))) {
      return { family, elicitation: 'survivor', headroom: 'pending', klass: 'survivor_error_rerun' };
    }
    return { family, elicitation: 'unknown', headroom: 'pending', klass: 'error_unclassified' };
  }
  return { family, elicitation: 'unknown', headroom: 'pending', klass: stage || 'unknown' };
}

// Build a synthetic "ablated" verdict for the relational prior from its two
// preserved a18.8 transfer reports, then classify it with the same rules.
function relationalPrior(relationalDir) {
  const abs = path.resolve(ROOT, relationalDir);
  if (!fs.existsSync(abs)) return null;
  const reports = fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('a18.6-policy-ablation.'))
    .map((e) => path.join(abs, e.name, 'a18.8-s0-hard-bounded-transfer-report.json'))
    .filter((p) => fs.existsSync(p));
  if (!reports.length) return null;
  const siblings = reports.map((p) => {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    return {
      family_id: d.family_id,
      local_verdict: d.local_verdict,
      policy_contrast_verdict: (d.policy_contrast_gate || {}).verdict,
      distinctiveness: (d.policy_contrast_gate || {}).distinctiveness,
    };
  });
  // Relational converged via gate + distinctiveness + direct reading + (now) the
  // A18.36 relaxed correctness rescore. Headroom holds iff BOTH siblings are
  // policy_distinct with a policy-memory local advantage.
  const headroom = siblings.every(
    (s) => s.policy_contrast_verdict === 'policy_distinct' && s.local_verdict === 'policy_memory_local_advantage',
  );
  return {
    family_id: siblings[0]?.family_id || 'relational_betweenness_priority',
    stage: 'ablated',
    family_local_headroom_relaxed: headroom,
    source: 'prior (A18.36), preserved a18.8 reports',
    siblings,
  };
}

function pct(n, d) {
  return d ? `${((100 * n) / d).toFixed(0)}%` : 'n/a';
}

function summarize(args) {
  const verdicts = args.results && fs.existsSync(args.results) ? readJsonl(args.results) : [];
  // De-dup by family: a later verdict (e.g. a corrected re-run) supersedes an
  // earlier one (e.g. the survivor_error stage). Last write wins.
  const byFamily = new Map();
  for (const v of verdicts) byFamily.set(familyNameFromVerdict(v), v);

  const prior = relationalPrior(args.relationalDir);
  if (prior && !byFamily.has(prior.family_id)) byFamily.set(prior.family_id, prior);

  const rows = [...byFamily.values()].map((v) => {
    const c = classifyVerdict(v);
    return { ...c, stage: v.stage, source: v.source || 'fanout', attempt1_status: v.attempt1_status || null };
  });
  rows.sort((a, b) => a.family.localeCompare(b.family));

  const total = rows.length;
  const survivors = rows.filter((r) => r.elicitation === 'survivor').length;
  const elicitationFail = rows.filter((r) => r.elicitation === 'fail').length;
  const converges = rows.filter((r) => r.headroom === 'converges').length;
  const noHeadroom = rows.filter((r) => r.headroom === 'no_headroom').length;
  const pending = rows.filter((r) => r.headroom === 'pending').length;
  const resolvedSurvivors = converges + noHeadroom; // survivors with a final headroom verdict

  return {
    kind: 'a18_convergence_rate_summary',
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    counts: {
      families: total,
      elicitation_survivors: survivors,
      elicitation_failures: elicitationFail,
      converges,
      no_headroom: noHeadroom,
      headroom_pending: pending,
    },
    rates: {
      elicitation_rate: pct(survivors, total),
      // headroom rate is computed over RESOLVED survivors only (excludes pending
      // re-runs) so it is never inflated/deflated by un-scored rows.
      headroom_rate_over_resolved_survivors: pct(converges, resolvedSurvivors),
      headroom_resolved_survivors: resolvedSurvivors,
    },
    note:
      pending > 0
        ? `${pending} survivor(s) pending headroom re-run under the corrected ablation config; rates over resolved survivors only.`
        : 'all survivors resolved.',
    rows,
  };
}

function renderTable(summary) {
  const lines = [];
  lines.push('| family | elicitation | headroom | class |');
  lines.push('|---|---|---|---|');
  for (const r of summary.rows) {
    lines.push(`| ${r.family} | ${r.elicitation} | ${r.headroom} | ${r.klass} |`);
  }
  const c = summary.counts;
  const r = summary.rates;
  lines.push('');
  lines.push(
    `families=${c.families}  elicitation_survivors=${c.elicitation_survivors} (${r.elicitation_rate})  ` +
      `converges=${c.converges}/${r.headroom_resolved_survivors} resolved survivors (${r.headroom_rate_over_resolved_survivors})  ` +
      `pending=${c.headroom_pending}`,
  );
  return lines.join('\n');
}

function main() {
  const args = parseArgs();
  if (args.help || !args.results) {
    console.log(
      'Usage: node scripts/summarize-a18-convergence-rate.js --results <results.jsonl> [--relational-dir <dir>] [--out <json>]',
    );
    return;
  }
  const summary = summarize(args);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  }
  console.log(renderTable(summary));
  console.log('');
  console.log(JSON.stringify(summary.counts), JSON.stringify(summary.rates));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}

export { summarize, classifyVerdict, relationalPrior };

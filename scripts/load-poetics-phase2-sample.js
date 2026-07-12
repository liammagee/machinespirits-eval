#!/usr/bin/env node
/**
 * Phase-2 transcript loader / neutralizer / sampler.
 *
 * Draws a seeded, stratified (recognition vs base) sample of MULTI-TURN
 * dynamic-learner (ego_superego) tutoring transcripts, strips identity, and
 * emits neutral TUTOR:/LEARNER: transcripts plus a held-out key — joined to
 * scores only after labelling+scoring, exactly like config/poetics-calibration/
 * key.yaml (PHASE2-DESIGN.md §4.1, §4.2, §5).
 *
 * Blinding is load-bearing. We emit ONLY external turns (tutor/learner
 * final_output, reconstructed from conversationHistory). The internal
 * ego/superego deliberation, model/provider metadata, api payloads, and the
 * suggestion-tool scaffold (type/priority/title) are dropped — they never reach
 * the critic or the human labeller. That is the design's "no concealed-interior
 * signal" rule (§1, §5): the unit of analysis is the transcript-as-drama, not an
 * agent's interior.
 *
 * Role labels (TUTOR/LEARNER) are preserved deliberately: recohering is defined
 * on the *learner's* re-reading of the learner's OWN earlier turns, so the critic
 * must know which turns are the learner's. Role is structural genre-form, present
 * in every cell — it leaks nothing about base-vs-recognition or model. Identity
 * (model/provider brand names) IS scrubbed; dialogue substance/register is NOT
 * (the recognition register is part of the form being judged — see §4.2).
 *
 * Inputs (real eval data) live in the MAIN repo and resolve from cwd; outputs
 * live in this worktree and resolve from the script location.
 *
 * Usage:
 *   node scripts/load-poetics-phase2-sample.js [--seed 20260520] [--per-stratum 18]
 *        [--dry-run] [--force]
 *        [--out-dir config/poetics-calibration/phase2-sample]
 *        [--key     config/poetics-calibration/phase2-key.yaml]
 *
 *   --dry-run  draw + neutralize in memory, print the manifest and ONE full
 *              neutralized transcript for leak inspection; write nothing.
 *   --force    overwrite an existing sample dir (guards a labelling-in-progress).
 *
 * Run from the main repo (so data/evaluations.db and logs/tutor-dialogues
 * resolve), or set EVAL_DB_PATH / EVAL_LOGS_DIR.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { openEvaluationDbReadonly } from '../services/evaluationDbReadonly.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKTREE_ROOT = path.resolve(__dirname, '..');

// Inputs: real eval data (main repo). Resolve from cwd; allow env override.
const LOGS_DIR = process.env.EVAL_LOGS_DIR
  ? path.join(process.env.EVAL_LOGS_DIR, 'tutor-dialogues')
  : path.join(process.cwd(), 'logs', 'tutor-dialogues');

// Outputs: poetics artifacts (this worktree).
const DEFAULT_OUT_DIR = path.join(WORKTREE_ROOT, 'config', 'poetics-calibration', 'phase2-sample');
const DEFAULT_KEY = path.join(WORKTREE_ROOT, 'config', 'poetics-calibration', 'phase2-key.yaml');

// Strata (the paper's central factor), as confirmed in evaluations-db: the
// multi-turn dynamic-learner supply is the messages-mode 80–92 family.
//   base        → learner_architecture 'ego_superego'             (cells 81, 83)
//   recognition → learner_architecture 'ego_superego_recognition' (cells 85, 87, 88, 89, 92)
const STRATA = {
  base: { learner_architecture: 'ego_superego' },
  recognition: { learner_architecture: 'ego_superego_recognition' },
};

// ── args ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const a = {
    seed: 20260520,
    perStratum: 18,
    dryRun: false,
    force: false,
    outDir: DEFAULT_OUT_DIR,
    keyPath: DEFAULT_KEY,
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--dry-run') a.dryRun = true;
    else if (t === '--force') a.force = true;
    else if (t === '--seed') a.seed = parseInt(argv[++i], 10);
    else if (t === '--per-stratum') a.perStratum = parseInt(argv[++i], 10);
    else if (t === '--out-dir') a.outDir = path.resolve(argv[++i]);
    else if (t === '--key') a.keyPath = path.resolve(argv[++i]);
    else throw new Error(`unknown arg: ${t}`);
  }
  if (!Number.isInteger(a.seed)) throw new Error('--seed must be an integer');
  if (!Number.isInteger(a.perStratum) || a.perStratum < 1) throw new Error('--per-stratum must be a positive integer');
  return a;
}

// ── seeded PRNG (mulberry32) + Fisher–Yates ──────────────────────────────────

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── DB: candidate dialogues per stratum ──────────────────────────────────────

function candidates(db, learnerArch) {
  return db
    .prepare(
      `SELECT dialogue_id,
              MIN(profile_name) AS profile_name,
              MIN(run_id)       AS run_id,
              MIN(model)        AS model
         FROM evaluation_results
        WHERE learner_architecture = ?
          AND conversation_mode = 'messages'
          AND dialogue_rounds >= 3
          AND dialogue_id IS NOT NULL
          AND (success IS NULL OR success = 1)
        GROUP BY dialogue_id
        ORDER BY dialogue_id`,
    )
    .all(learnerArch);
}

// ── log → external turns ─────────────────────────────────────────────────────

function loadLog(dialogueId) {
  const p = path.join(LOGS_DIR, `${dialogueId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

// The tutor's spoken turn is suggestion.message (the type/priority/title scaffold
// is the suggestion-tool envelope, not spoken dialogue, so it is dropped).
function tutorText(suggestion) {
  if (suggestion == null) return '';
  if (typeof suggestion === 'string') return suggestion.trim();
  const items = Array.isArray(suggestion) ? suggestion : [suggestion];
  return items
    .map((it) => (typeof it === 'string' ? it : (it && (it.message || it.text || it.content)) || ''))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

// External drama only: tutor (suggestion.message) ↔ learner (learnerMessage), in
// order. Requires conversationHistory (the paired external chain); internal
// deliberation in dialogueTrace is never read here.
function externalTurns(log) {
  const ch = log && log.conversationHistory;
  if (!Array.isArray(ch) || ch.length === 0) return null;
  const turns = [];
  for (const e of ch) {
    const t = tutorText(e.suggestion);
    if (t) turns.push({ role: 'TUTOR', text: t });
    const l = typeof e.learnerMessage === 'string' ? e.learnerMessage.trim() : '';
    if (l) turns.push({ role: 'LEARNER', text: l });
  }
  return turns;
}

// A learner turn is "truncated" (generation-time max_tokens clip) if it does not
// end in sentence-final punctuation. Such a fragment cannot be judged for
// recohering (you cannot tell whether a clipped clause re-reads earlier turns),
// so any dialogue containing one is excluded — a pre-registered data-quality
// filter set BEFORE scoring (PHASE2-DESIGN §4.1). It removes a stratum confound:
// truncation runs 37% of base vs 14% of recognition dialogues, clustered in
// specific runs, so leaving it in would depress base recon for a corruption
// reason unrelated to the prompt factor. Run on RAW text, before neutralization.
function isTruncated(text) {
  return !/[.?!…"')\]]$/.test(text.trim());
}

// ── neutralization: strip identity, preserve substance/register ──────────────

const IDENTITY_PATTERNS = [
  [/\b(anthropic|openai|google\s+deepmind|deepmind|openrouter)\b/gi, '[provider]'],
  [/\b(claude|chatgpt|gpt-?\d(?:\.\d)?|gemini(?:\s*flash)?|gemflash|nemotron|llama|mistral)\b/gi, '[model]'],
  [/\b(haiku|sonnet|opus)\b/gi, '[model]'],
  [/\bas an? (?:ai|large )?language model\b/gi, 'as a tutor'],
];

function neutralize(text) {
  let out = text;
  for (const [re, rep] of IDENTITY_PATTERNS) out = out.replace(re, rep);
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderTranscript(turns) {
  return turns.map((t) => `${t.role}: ${neutralize(t.text)}`).join('\n\n') + '\n';
}

// ── main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { db, dbPath: DB_PATH, reason } = openEvaluationDbReadonly(process.cwd());
  if (!db) throw new Error(`DB not available: ${DB_PATH} (${reason})\n  → run from the main repo, or set EVAL_DB_PATH`);
  if (!fs.existsSync(LOGS_DIR))
    throw new Error(`dialogue logs not found: ${LOGS_DIR}\n  → run from the main repo, or set EVAL_LOGS_DIR`);

  const rng = mulberry32(args.seed);

  const drawn = [];
  const report = {};
  for (const [stratum, sel] of Object.entries(STRATA)) {
    const cands = candidates(db, sel.learner_architecture);
    const order = shuffled(cands, rng);
    const picked = [];
    const skips = [];
    for (const c of order) {
      if (picked.length >= args.perStratum) break;
      const log = loadLog(c.dialogue_id);
      if (!log) {
        skips.push(`${c.dialogue_id}:no-log`);
        continue;
      }
      const turns = externalTurns(log);
      if (!turns) {
        skips.push(`${c.dialogue_id}:no-conversationHistory`);
        continue;
      }
      const nLearner = turns.filter((t) => t.role === 'LEARNER').length;
      if (nLearner < 2) {
        skips.push(`${c.dialogue_id}:learner-turns=${nLearner}`);
        continue;
      }
      const truncated = turns.filter((t) => t.role === 'LEARNER' && isTruncated(t.text)).length;
      if (truncated > 0) {
        skips.push(`${c.dialogue_id}:truncated=${truncated}`);
        continue;
      }
      picked.push({
        stratum,
        dialogue_id: c.dialogue_id,
        profile_name: c.profile_name,
        run_id: c.run_id,
        model: c.model,
        turns,
        n_tutor_turns: turns.filter((t) => t.role === 'TUTOR').length,
        n_learner_turns: nLearner,
      });
    }
    report[stratum] = {
      candidates: cands.length,
      picked: picked.length,
      skipped: skips.length,
      excluded_truncated: skips.filter((s) => s.includes(':truncated=')).length,
    };
    drawn.push(...picked);
    if (picked.length < args.perStratum)
      console.error(
        `WARN: stratum ${stratum} only filled ${picked.length}/${args.perStratum} ` +
          `(first skips: ${skips.slice(0, 5).join(', ')}${skips.length > 5 ? ' …' : ''})`,
      );
  }
  db.close();

  // Reshuffle across strata so the neutral sample id encodes neither stratum nor draw order.
  const presentation = shuffled(drawn, rng);
  const width = Math.max(2, String(presentation.length).length);
  presentation.forEach((d, i) => {
    d.sampleId = `T${String(i + 1).padStart(width, '0')}`;
  });

  // Held-out key (joined only after scoring).
  const keyObj = {
    _comment:
      'HELD OUT — do not read while labelling. Joins to instrument scores + human labels only AFTER both are produced (like key.yaml).',
    generated: new Date().toISOString(),
    seed: args.seed,
    per_stratum: args.perStratum,
    n: presentation.length,
    inputs: {
      db: path.relative(process.cwd(), DB_PATH),
      logs: path.relative(process.cwd(), LOGS_DIR),
    },
    sampling_rule:
      'random within strata (seeded Fisher–Yates over dialogue_id-sorted candidates); take the first N per stratum with >=2 external learner turns; presentation order reshuffled with the same seed stream',
    data_quality_filter:
      'exclude any dialogue with >=1 truncated learner turn (last non-space char not in .?!…"\')]). Truncation is a generation-time max_tokens clip clustered in specific runs; a clipped fragment cannot be judged for recohering, and it ran 37% of base vs 14% of recognition candidates — a stratum confound. Pre-registered before scoring (no scores existed at draw time) and orthogonal to stated-insight, so it does not bias toward "aha" turns. Per-stratum excluded counts in strata.*.excluded_truncated.',
    neutralization:
      'external turns only (tutor suggestion.message ↔ learner learnerMessage via conversationHistory); suggestion scaffold (type/priority/title) dropped; model/provider identity scrubbed; ego/superego deliberation, api payloads and metrics never emitted; dialogue substance and recognition register preserved (§4.2)',
    strata: report,
    items: {},
  };
  for (const d of presentation) {
    keyObj.items[d.sampleId] = {
      dialogue_id: d.dialogue_id,
      stratum: d.stratum,
      profile_name: d.profile_name,
      run_id: d.run_id,
      model: d.model,
      n_tutor_turns: d.n_tutor_turns,
      n_learner_turns: d.n_learner_turns,
    };
  }

  console.log(`\n══ Phase-2 sample draw — seed=${args.seed}, per-stratum=${args.perStratum} ══`);
  for (const [s, r] of Object.entries(report))
    console.log(
      `  ${s}: drew ${r.picked}/${args.perStratum} from ${r.candidates} candidates ` +
        `(${r.skipped} skipped, ${r.excluded_truncated} of them truncation-excluded)`,
    );
  console.log(`  total drawn: ${presentation.length}`);

  if (args.dryRun) {
    // Proof the data-quality filter worked: the drawn sample must hold ZERO
    // truncated learner turns in BOTH strata (the 37%/14% asymmetry is gone by
    // construction).
    for (const stratum of Object.keys(STRATA)) {
      const trunc = presentation
        .filter((d) => d.stratum === stratum)
        .reduce((n, d) => n + d.turns.filter((t) => t.role === 'LEARNER' && isTruncated(t.text)).length, 0);
      console.log(`  post-filter check — ${stratum}: ${trunc} truncated learner turns in drawn sample (expect 0)`);
    }
    // One example per stratum for the §4.2 identity-leak inspection.
    for (const stratum of Object.keys(STRATA)) {
      const ex = presentation.find((d) => d.stratum === stratum);
      if (!ex) continue;
      console.log(
        `\n── DRY RUN — nothing written. Sample ${ex.sampleId} ` +
          `(stratum=${ex.stratum}, ${ex.n_tutor_turns} tutor / ${ex.n_learner_turns} learner turns): ──\n`,
      );
      console.log(renderTranscript(ex.turns));
    }
    console.log(
      '── leak check: can you guess base vs recognition from any IDENTITY tell? ' +
        '(substance/register is preserved by design — see §4.2) ──',
    );
    return;
  }

  if (fs.existsSync(args.outDir) && fs.readdirSync(args.outDir).some((f) => f.endsWith('.txt')) && !args.force)
    throw new Error(
      `out-dir already has .txt files: ${args.outDir}\n  → refusing to clobber a labelling set (use --force)`,
    );

  fs.mkdirSync(args.outDir, { recursive: true });
  for (const d of presentation)
    fs.writeFileSync(path.join(args.outDir, `${d.sampleId}.txt`), renderTranscript(d.turns), 'utf8');
  fs.writeFileSync(args.keyPath, yaml.stringify(keyObj), 'utf8');
  console.log(`\nwrote ${presentation.length} transcripts → ${path.relative(process.cwd(), args.outDir)}`);
  console.log(`wrote held-out key      → ${path.relative(process.cwd(), args.keyPath)}`);
  console.log('(do not open the key until labelling + scoring are done)');
}

main();

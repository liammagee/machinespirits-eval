#!/usr/bin/env node
/**
 * Omniscient-critic scorer (Oedipus / guided-discovery, spec
 * notes/poetics/2026-05-29-oedipus-guided-discovery-spec.md §6).
 *
 * The audience knows the hidden truth; the learner does not. This scorer gives a
 * critic panel the withheld fact S (disclosed) and the PUBLIC transcript (the
 * learner-visible text), with the ARM LABEL withheld, and asks three things:
 *   - discovered    -- did the LEARNER publicly arrive at THIS SPECIFIC S?
 *   - by_reasoning  -- did it reach S by integrating supplied evidence (Meno),
 *                      rather than being TOLD and echoing it?
 *   - tutor_revealed-- did the TUTOR baldly STATE the conclusion S (disqualifier)?
 *
 * The reveal-detector is belt-and-suspenders: a DETERMINISTIC token-overlap pass
 * over the tutor's spoken turns (against the `fact` ONLY -- releasing premises as
 * clues is the legitimate Socratic channel) OR'd with the panel's reveal votes.
 *
 * Discovery-pass (per item) = discovered AND by_reasoning AND NOT tutor_revealed.
 *
 * Lift (paired by shared_prefix_hash across arms, spec §8):
 *   - if `none` reaches S  -> pair INVALIDATED (underivability failed in practice)
 *   - else lift = discovery-pass(`socratic`) in {0, 1}
 *   - `reveal` is reported as a CEILING, outside the lift.
 *
 * Usage:
 *   node scripts/critic-poetics-omniscient.js --sample-root DIR --spec SPEC.yaml
 *       [--arms none,socratic,reveal] [--panel m1,m2,...] [--consensus N]
 *       [--concurrency 4] [--out FILE] [--mock]
 *
 * Layout under --sample-root: `sample/<arm>/<tid>.txt` + `key-<arm>.yaml`
 * (exactly what generate-pedagogical-dramas.js writes for --paired-adaptation-arms).
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { callModel, parseJsonResponse, runWithConcurrency, withScorerRetry } from './score-poetics-calibration.js';
import { secretLeakIn } from './lib/secret-tokens.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_PANEL = ['qwen/qwen3.7-max', 'google/gemini-3.5-flash', 'deepseek/deepseek-v4-pro', 'gpt'];

function parseArgs(argv) {
  const a = {
    sampleRoot: null,
    spec: null,
    arms: ['none', 'socratic', 'reveal'],
    panel: [...DEFAULT_PANEL],
    consensus: null,
    concurrency: 4,
    out: null,
    mock: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--sample-root') a.sampleRoot = path.resolve(argv[++i]);
    else if (t === '--spec') a.spec = path.resolve(argv[++i]);
    else if (t === '--arms')
      a.arms = String(argv[++i])
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (t === '--panel')
      a.panel = String(argv[++i])
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (t === '--consensus') a.consensus = parseInt(argv[++i], 10);
    else if (t === '--concurrency') a.concurrency = parseInt(argv[++i], 10);
    else if (t === '--out') a.out = path.resolve(argv[++i]);
    else if (t === '--mock') a.mock = true;
    else if (t === '--help' || t === '-h') {
      console.log(`Usage:
  node scripts/critic-poetics-omniscient.js --sample-root DIR --spec SPEC.yaml
      [--arms none,socratic,reveal] [--panel m1,m2,...] [--consensus N]
      [--concurrency N] [--out FILE] [--mock]`);
      process.exit(0);
    } else throw new Error(`unknown arg: ${t}`);
  }
  if (!a.sampleRoot) throw new Error('--sample-root is required');
  if (!a.spec) throw new Error('--spec is required');
  if (!fs.existsSync(a.sampleRoot)) throw new Error(`--sample-root not found: ${a.sampleRoot}`);
  if (!fs.existsSync(a.spec)) throw new Error(`--spec not found: ${a.spec}`);
  if (!a.panel.length) throw new Error('--panel must have >= 1 model');
  // Default consensus ~ 3-of-4 (ceil(0.6 * panel)); overridable.
  if (a.consensus == null) a.consensus = Math.max(1, Math.ceil(a.panel.length * 0.6));
  if (!Number.isInteger(a.consensus) || a.consensus < 1) throw new Error('--consensus must be a positive integer');
  if (!Number.isInteger(a.concurrency) || a.concurrency < 1)
    throw new Error('--concurrency must be a positive integer');
  return a;
}

// drama_id -> secret ({ fact, premise_ledger }), from the pre-registered spec.
function loadSecretMap(specPath) {
  const doc = yaml.parse(fs.readFileSync(specPath, 'utf8')) || {};
  const map = {};
  for (const d of Array.isArray(doc.dramas) ? doc.dramas : []) {
    if (d && d.id && d.secret && d.secret.fact) map[d.id] = d.secret;
  }
  return map;
}

// Minimal STAGE/TUTOR/LEARNER splitter (self-contained; no analyzer import).
function parseTurns(raw) {
  const turns = [];
  const counts = { STAGE: 0, TUTOR: 0, LEARNER: 0 };
  for (const block of String(raw || '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)) {
    const m = block.match(/^(STAGE|TUTOR|LEARNER):\s*([\s\S]*)$/);
    if (!m) {
      if (turns.length) turns[turns.length - 1].text += `\n\n${block}`;
      continue;
    }
    counts[m[1]] += 1;
    turns.push({ role: m[1], turnNumber: counts[m[1]], text: m[2].trim() });
  }
  return turns;
}

// Deterministic reveal-detector: did any TUTOR turn state the conclusion S
// (fact only -- premise-release is the legitimate Socratic channel)?
function detectBaldReveal(transcript, secret) {
  const tutorTurns = parseTurns(transcript).filter((t) => t.role === 'TUTOR');
  for (const turn of tutorTurns) {
    const leak = secretLeakIn(secret, turn.text, { factOnly: true });
    if (leak) return { hit: true, turnNumber: turn.turnNumber, mode: leak.mode };
  }
  return { hit: false, turnNumber: null, mode: null };
}

function loadArmItems(args, secretMap) {
  const items = [];
  for (const arm of args.arms) {
    const keyPath = path.join(args.sampleRoot, `key-${arm}.yaml`);
    const sampleDir = path.join(args.sampleRoot, 'sample', arm);
    if (!fs.existsSync(keyPath)) throw new Error(`missing key for arm '${arm}': ${keyPath}`);
    const key = yaml.parse(fs.readFileSync(keyPath, 'utf8')) || {};
    for (const [tid, item] of Object.entries(key.items || {})) {
      const filePath = path.join(sampleDir, `${tid}.txt`);
      if (!fs.existsSync(filePath)) continue;
      const dramaId = item.drama_id;
      const secret = secretMap[dramaId];
      if (!secret) throw new Error(`no secret in spec for drama_id '${dramaId}' (arm ${arm}, ${tid})`);
      items.push({
        arm,
        tid,
        dramaId,
        sharedPrefixHash: item.paired_continuation?.shared_prefix_hash || null,
        policy: item.tutor_adaptation_policy || null,
        transcript: fs.readFileSync(filePath, 'utf8'),
        secret,
        sampleFile: path.relative(ROOT, filePath),
      });
    }
  }
  return items;
}

function buildOmniscientPrompt(transcript, fact) {
  return `You are the AUDIENCE at a drama. Unlike the characters, you KNOW the hidden truth.

THE HIDDEN TRUTH (S) -- known to you, NOT to the learner:
"${fact}"

The LEARNER never has S in their context; they can come to know it ONLY through what the TUTOR
says on stage. Here is the public transcript:

---
${transcript}
---

Judge ONLY what is on the page (do not assume which "version" of the scene this is):

1. discovered -- Did the LEARNER publicly arrive at THIS SPECIFIC hidden truth S by the end:
   state it, name the actual mechanism, or clearly act on it? A vague gesture, or merely echoing
   the topic, does NOT count -- the learner must land the substance of S.
2. by_reasoning -- IF discovered: did the learner REASON to S by integrating facts/evidence the
   tutor surfaced, rather than simply being TOLD S and repeating it? (If not discovered: false.)
3. tutor_revealed -- Did the TUTOR baldly STATE the conclusion S to the learner, rather than only
   supplying premises and questions and letting the learner infer it?

Recognition is a CHANGE from ignorance to knowledge that the dialogue enacts -- never the mere
vocabulary of insight ("I see it now"). A learner who only repeats the tutor's stated conclusion
has NOT reasoned to S.

Return ONLY JSON:
{
  "discovered": true|false,
  "by_reasoning": true|false,
  "tutor_revealed": true|false,
  "learner_evidence": "<verbatim learner quote where they land S, or empty string>",
  "notes": "<one concise sentence>"
}`;
}

function coerceVote(parsed) {
  return {
    discovered: Boolean(parsed.discovered),
    by_reasoning: Boolean(parsed.by_reasoning) && Boolean(parsed.discovered),
    tutor_revealed: Boolean(parsed.tutor_revealed),
    learner_evidence: typeof parsed.learner_evidence === 'string' ? parsed.learner_evidence : '',
    notes: typeof parsed.notes === 'string' ? parsed.notes : '',
  };
}

// Deterministic mock vote keyed by arm -- exercises the full lift plumbing:
// socratic = guided discovery; none = stays ignorant; reveal = told (ceiling).
function mockVote(arm) {
  if (arm === 'socratic') return coerceVote({ discovered: true, by_reasoning: true, tutor_revealed: false });
  if (arm === 'reveal') return coerceVote({ discovered: true, by_reasoning: false, tutor_revealed: true });
  return coerceVote({ discovered: false, by_reasoning: false, tutor_revealed: false });
}

async function panelVotes(item, args) {
  if (args.mock) return args.panel.map((model) => ({ model, vote: mockVote(item.arm) }));
  const prompt = buildOmniscientPrompt(item.transcript, item.secret.fact);
  const results = await runWithConcurrency(
    args.panel.map((model) => async () => {
      try {
        const { value } = await withScorerRetry(async () => parseJsonResponse(await callModel(prompt, model)));
        return { model, vote: coerceVote(value) };
      } catch (err) {
        return { model, error: err.message };
      }
    }),
    args.panel.length,
  );
  return results;
}

function consensify(votes, deterministicReveal, consensus) {
  const valid = votes.filter((v) => v.vote && !v.error);
  const n = valid.length;
  const discoveredVotes = valid.filter((v) => v.vote.discovered).length;
  const byReasoningVotes = valid.filter((v) => v.vote.by_reasoning).length;
  const revealVotes = valid.filter((v) => v.vote.tutor_revealed).length;
  const discovered = discoveredVotes >= consensus;
  const byReasoning = byReasoningVotes >= consensus;
  const modelReveal = revealVotes >= consensus;
  const tutorRevealed = deterministicReveal.hit || modelReveal;
  return {
    totalCritics: n,
    discoveredVotes,
    byReasoningVotes,
    revealVotes,
    discovered,
    byReasoning,
    modelReveal,
    deterministicReveal: deterministicReveal.hit,
    tutorRevealed,
    discoveryPass: discovered && byReasoning && !tutorRevealed,
  };
}

// Wilson score interval (z=1.96 -> 95%) for k/n. Inlined to avoid importing the
// DB-backed aggregator's heavy module chain.
function wilson(k, n, z = 1.96) {
  if (!n) return { low: 0, high: 0 };
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { low: Math.max(0, (centre - spread) / denom), high: Math.min(1, (centre + spread) / denom) };
}

// Pair arms by shared_prefix_hash (preferred) else drama_id, and classify the
// socratic - none lift per spec §8.
function buildPairs(scored, minCritics) {
  const byKey = {};
  for (const s of scored) {
    const key = s.sharedPrefixHash || s.dramaId;
    (byKey[key] ||= { key, dramaId: s.dramaId, arms: {} }).arms[s.arm] = s;
  }
  const pairs = [];
  for (const group of Object.values(byKey)) {
    const none = group.arms.none;
    const socratic = group.arms.socratic;
    const reveal = group.arms.reveal;
    let status;
    let lift = null;
    let reason;
    if (!socratic || !none) {
      status = 'invalid_coverage';
      reason = !socratic ? 'no socratic arm' : 'no none arm';
    } else if ((none.consensus.totalCritics ?? 0) < minCritics || (socratic.consensus.totalCritics ?? 0) < minCritics) {
      status = 'invalid_coverage';
      reason = 'insufficient critics on a paired arm';
    } else if (none.consensus.discovered) {
      status = 'invalid_control_leak';
      reason = 'none control reached S (underivability failed in practice)';
    } else {
      lift = socratic.consensus.discoveryPass ? 1 : 0;
      status = lift ? 'positive' : 'null';
      reason = lift
        ? 'socratic discovery by reasoning, no bald reveal; none did not reach S'
        : `socratic did not pass: ${socratic.consensus.tutorRevealed ? 'tutor revealed' : !socratic.consensus.discovered ? 'not discovered' : 'not by reasoning'}`;
    }
    pairs.push({
      key: group.key,
      dramaId: group.dramaId,
      status,
      lift,
      reason,
      socratic: socratic ? summarizeArm(socratic) : null,
      none: none ? summarizeArm(none) : null,
      revealCeiling: reveal ? reveal.consensus.discovered : null,
    });
  }
  return pairs;
}

function summarizeArm(s) {
  return {
    tid: s.tid,
    discovered: s.consensus.discovered,
    byReasoning: s.consensus.byReasoning,
    tutorRevealed: s.consensus.tutorRevealed,
    discoveryPass: s.consensus.discoveryPass,
    votes: `${s.consensus.discoveredVotes}/${s.consensus.totalCritics}`,
  };
}

async function run(args) {
  const secretMap = loadSecretMap(args.spec);
  const items = loadArmItems(args, secretMap);
  if (!items.length) throw new Error('no transcripts found under --sample-root for the given --arms');

  const scored = await runWithConcurrency(
    items.map((item) => async () => {
      const deterministicReveal = detectBaldReveal(item.transcript, item.secret);
      const votes = await panelVotes(item, args);
      const consensus = consensify(votes, deterministicReveal, args.consensus);
      return {
        arm: item.arm,
        tid: item.tid,
        dramaId: item.dramaId,
        sharedPrefixHash: item.sharedPrefixHash,
        policy: item.policy,
        sampleFile: item.sampleFile,
        deterministicReveal,
        consensus,
        votes: votes.map((v) => ({ model: v.model, ...(v.error ? { error: v.error } : v.vote) })),
      };
    }),
    args.mock ? 1 : args.concurrency,
  );

  // Minimum critics required for a pair to be interpretable = the consensus cut.
  const minCritics = args.consensus;
  const pairs = buildPairs(scored, minCritics);
  const valid = pairs.filter((p) => p.lift !== null);
  const nValid = valid.length;
  const nPositive = valid.filter((p) => p.lift === 1).length;
  const meanLift = nValid ? nPositive / nValid : null;
  const ci = wilson(nPositive, nValid);
  const positiveDramas = [...new Set(valid.filter((p) => p.lift === 1).map((p) => p.dramaId))];

  let verdict;
  if (nValid === 0) verdict = 'no_interpretable_evidence';
  else if (nPositive === 0) verdict = 'null';
  else if (ci.low > 0 && positiveDramas.length >= 2) verdict = 'positive_small_n';
  else verdict = 'weak_positive_or_maybe';

  const summary = {
    arms: args.arms,
    panel: args.panel,
    consensus: args.consensus,
    pairsTotal: pairs.length,
    validPairs: nValid,
    positive: nPositive,
    null: valid.filter((p) => p.lift === 0).length,
    invalidCoverage: pairs.filter((p) => p.status === 'invalid_coverage').length,
    invalidControlLeak: pairs.filter((p) => p.status === 'invalid_control_leak').length,
    discoveryLift: meanLift,
    wilson95: ci,
    positiveDramas,
    revealCeiling: pairs.map((p) => p.revealCeiling).filter((v) => v != null),
  };
  let _gitRev = 'unknown';
  try {
    _gitRev = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    /* not a git checkout */
  }
  const artifact = {
    generated: new Date().toISOString(),
    scorer: 'omniscient-critic',
    // Explicit provenance: critic panel runs via callModel (OpenRouter slugs below);
    // distinct from the GENERATOR model recorded in each run's gen.log + key.
    critic_source: args.mock ? 'mock' : 'api/openrouter',
    git_commit: _gitRev,
    node: process.version,
    sampleRoot: path.relative(ROOT, args.sampleRoot),
    spec: path.relative(ROOT, args.spec),
    panel: args.mock ? args.panel.map((m) => `${m}-mock`) : args.panel,
    summary,
    pairs,
    scored,
    verdict,
  };
  const outPath =
    args.out ||
    path.join(ROOT, 'exports', `omniscient-critic-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  console.log(
    `\n== Omniscient critic (panel=${args.mock ? 'mock' : args.panel.join(',')}, consensus ${args.consensus}) ==`,
  );
  for (const p of pairs) {
    const soc = p.socratic || {};
    console.log(
      `  ${String(p.dramaId).padEnd(8)} ${String(p.status).padEnd(20)} lift=${p.lift ?? '-'} ` +
        `· socratic disc=${soc.discovered ?? '-'} reason=${soc.byReasoning ?? '-'} reveal=${soc.tutorRevealed ?? '-'} ` +
        `(${soc.votes ?? '-'}) · none disc=${p.none?.discovered ?? '-'} · reveal-ceiling=${p.revealCeiling ?? '-'}`,
    );
    if (p.reason) console.log(`           ${p.reason}`);
  }
  console.log(
    `\n  valid pairs: ${nValid} (positive ${nPositive}) · invalidated: coverage ${summary.invalidCoverage}, control-leak ${summary.invalidControlLeak}`,
  );
  console.log(
    `  discovery_lift = ${meanLift === null ? 'n/a' : meanLift.toFixed(3)} (Wilson95 [${ci.low.toFixed(3)}, ${ci.high.toFixed(3)}]) · positive dramas: ${positiveDramas.join(', ') || 'none'}`,
  );
  console.log(`\n  VERDICT: ${verdict}`);
  console.log(`  wrote ${path.relative(ROOT, outPath)}\n`);
  return artifact;
}

if (path.resolve(process.argv[1] || '') === __filename) {
  run(parseArgs(process.argv.slice(2))).catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}

export {
  parseArgs,
  loadSecretMap,
  parseTurns,
  detectBaldReveal,
  loadArmItems,
  buildOmniscientPrompt,
  coerceVote,
  consensify,
  buildPairs,
  wilson,
  run,
};

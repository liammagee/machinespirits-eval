#!/usr/bin/env node
/**
 * S-underivability screen (Oedipus / guided-discovery, spec
 * notes/poetics/2026-05-29-oedipus-guided-discovery-spec.md §5).
 *
 * THE load-bearing pre-registered screen. The `none` arm is a clean negative
 * control ONLY IF the withheld fact S is not recoverable from the learner-visible
 * context K_L alone. So, before any (paid) generation: run a strong model on K_L
 * with "discover the hidden fact", then judge whether its best guesses MATCH the
 * reference S. If S is derivable, the scenario is REJECTED -- a `none` learner
 * could reach S without the tutor, so a later "none did not discover" would be
 * uninterpretable. This is the derivability analogue of the §6.3 clean-anchor
 * screen.
 *
 * K_L is assembled from the scenario spec and DELIBERATELY excludes everything on
 * the director/tutor side: the `secret`, `dramatic_shape`, `intended_*`, and the
 * tutor voice/character (those telegraph S). It contains only what the learner
 * actor sees: discipline, topic, scene name, its own start-state and voice.
 *
 * Reported alongside the binary verdict: a genre-guess diagnostic (was S among
 * the model's candidates, at what rank / mass) per §5's no-genre-guess screen.
 *
 * Usage:
 *   node scripts/screen-s-underivability.js --spec config/poetics-calibration/oedipus-pilot-v1.yaml
 *       [--model gpt|sonnet|gemini-pro|...] [--only D_OED1,D_OED2] [--candidates 4]
 *       [--concurrency 2] [--out exports/s-underivability-<ts>.json]
 *       [--fail-on-derivable] [--mock]
 *
 * --mock returns deterministic non-matching candidates (clean) to smoke the
 * plumbing with no API calls.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { callModel, parseJsonResponse, runWithConcurrency, withScorerRetry } from './score-poetics-calibration.js';
import { secretLeakIn } from './lib/secret-tokens.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function parseArgs(argv) {
  const a = {
    spec: null,
    model: 'gpt',
    only: null,
    candidates: 4,
    concurrency: 2,
    out: null,
    failOnDerivable: false,
    mock: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--spec') a.spec = path.resolve(argv[++i]);
    else if (t === '--model') a.model = argv[++i];
    else if (t === '--only')
      a.only = String(argv[++i])
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (t === '--candidates') a.candidates = parseInt(argv[++i], 10);
    else if (t === '--concurrency') a.concurrency = parseInt(argv[++i], 10);
    else if (t === '--out') a.out = path.resolve(argv[++i]);
    else if (t === '--fail-on-derivable') a.failOnDerivable = true;
    else if (t === '--mock') a.mock = true;
    else if (t === '--help' || t === '-h') {
      console.log(`Usage:
  node scripts/screen-s-underivability.js --spec SPEC.yaml
      [--model gpt|sonnet|gemini-pro|...] [--only D1,D2] [--candidates N]
      [--concurrency N] [--out FILE] [--fail-on-derivable] [--mock]`);
      process.exit(0);
    } else throw new Error(`unknown arg: ${t}`);
  }
  if (!a.spec) throw new Error('--spec is required');
  if (!fs.existsSync(a.spec)) throw new Error(`--spec not found: ${a.spec}`);
  if (!Number.isInteger(a.candidates) || a.candidates < 1) throw new Error('--candidates must be a positive integer');
  if (!Number.isInteger(a.concurrency) || a.concurrency < 1)
    throw new Error('--concurrency must be a positive integer');
  return a;
}

// Load the Oedipus dramas from a scenario spec. Only dramas carrying a `secret`
// (a withheld fact + premise ledger) are screenable.
function loadDramas(spec, only) {
  const doc = yaml.parse(fs.readFileSync(spec, 'utf8')) || {};
  const dramas = Array.isArray(doc.dramas) ? doc.dramas : [];
  return dramas
    .filter((d) => d && d.secret && d.secret.fact)
    .filter((d) => !only || only.includes(d.id))
    .map((d) => ({
      id: d.id,
      secret: d.secret,
      // K_L: learner-visible context ONLY. No secret, no dramatic_shape, no
      // intended_*, no tutor voice -- those sit on the director/tutor side.
      kL: {
        discipline: d.discipline || null,
        topic: d.topic || null,
        scene: d.scenario_name || null,
        learner_start_state: d.learner_start_state || null,
        learner_voice: d.learner_voice_constraint || null,
      },
    }));
}

function buildDiscoveryPrompt(kL, n) {
  return `You are a sharp investigator. You are given a person's SITUATION and nothing else.
Unknown to them, there is a single hidden FACT that actually explains their situation.

Use ONLY the information below. Do NOT lean on how stories "usually go" or genre tropes.
If the situation genuinely under-determines the hidden fact (many explanations are equally
plausible), say so and keep your probabilities low and flat.

SITUATION (everything the person themselves knows):
${yaml.stringify(kL).trim()}

Give your top ${n} most likely SPECIFIC hidden facts. Each must be a concrete, one-sentence
explanation of what is really going on -- not a restatement of the situation. Rank them and
attach a rough probability (0.0-1.0) to each.

Return ONLY JSON:
{
  "candidates": [ { "fact": "<one concrete sentence>", "probability": <0..1> } ],
  "underdetermined": <true|false>,
  "reasoning": "<one sentence>"
}`;
}

function buildJudgePrompt(referenceFact, candidates) {
  return `You are checking whether anyone GUESSED a hidden fact.

REFERENCE hidden fact S (the ground truth):
"${referenceFact}"

CANDIDATE guesses (ranked):
${candidates.map((c, i) => `${i + 1}. ${c.fact}`).join('\n')}

Does ANY candidate assert essentially the SAME hidden fact as S -- the same core mechanism
or explanation, not merely the same topic or domain? A candidate that names the right culprit
or mechanism counts as a match even if worded differently; a candidate that is merely "about
the same subject" does NOT.

Return ONLY JSON:
{ "match": <true|false>, "matched_rank": <1-based index of the best matching candidate, or null>, "rationale": "<one sentence>" }`;
}

// Deterministic cross-check: does any candidate share enough distinctive tokens
// with S (fact only) to count as recovering it, independent of the LLM judge?
function deterministicMatch(secret, candidates) {
  for (let i = 0; i < candidates.length; i++) {
    const leak = secretLeakIn(secret, candidates[i].fact, { factOnly: true });
    if (leak) return { hit: true, rank: i + 1, mode: leak.mode };
  }
  return { hit: false, rank: null, mode: null };
}

function mockDiscovery(drama, n) {
  // A plausible-but-wrong guess set that stays clear of S's distinctive tokens,
  // so the deterministic check + a (mock) judge both read CLEAN.
  const candidates = Array.from({ length: n }, (_, i) => ({
    fact: `Mock conjecture ${i + 1}: an unrelated external factor better explains the ${drama.kL.discipline || 'situation'}.`,
    probability: Math.max(0.05, 0.3 - i * 0.05),
  }));
  return { candidates, underdetermined: true, reasoning: 'mock: situation under-determines the hidden fact' };
}

async function callJson(prompt, model) {
  const { value } = await withScorerRetry(async () => parseJsonResponse(await callModel(prompt, model)));
  return value;
}

async function screenDrama(drama, args) {
  const discovery = args.mock
    ? mockDiscovery(drama, args.candidates)
    : await callJson(buildDiscoveryPrompt(drama.kL, args.candidates), args.model);
  const candidates = Array.isArray(discovery.candidates) ? discovery.candidates.slice(0, args.candidates) : [];

  const det = deterministicMatch(drama.secret, candidates);
  let judge = { match: false, matched_rank: null, rationale: 'mock: no candidate matches S' };
  if (!args.mock && candidates.length) {
    judge = await callJson(buildJudgePrompt(drama.secret.fact, candidates), args.model);
  }

  const derivable = Boolean(judge.match) || det.hit;
  const matchedRank = judge.matched_rank ?? det.rank ?? null;
  return {
    dramaId: drama.id,
    verdict: derivable ? 'derivable' : 'clean',
    derivable,
    matchedRank,
    judgeMatch: Boolean(judge.match),
    deterministicMatch: det.hit,
    deterministicMode: det.mode,
    underdetermined: Boolean(discovery.underdetermined),
    candidates,
    judgeRationale: judge.rationale || null,
    discoveryReasoning: discovery.reasoning || null,
  };
}

async function run(args) {
  const dramas = loadDramas(args.spec, args.only);
  if (!dramas.length) throw new Error('no screenable dramas (need a `secret` block) matched the spec/--only filter');

  const results = await runWithConcurrency(
    dramas.map((d) => async () => {
      try {
        return await screenDrama(d, args);
      } catch (err) {
        return { dramaId: d.id, verdict: 'error', error: err.message };
      }
    }),
    args.concurrency,
  );

  const clean = results.filter((r) => r.verdict === 'clean').map((r) => r.dramaId);
  const derivable = results.filter((r) => r.verdict === 'derivable').map((r) => r.dramaId);
  const errored = results.filter((r) => r.verdict === 'error').map((r) => r.dramaId);
  const summary = {
    total: results.length,
    clean: clean.length,
    derivable: derivable.length,
    errored: errored.length,
    rejected: derivable,
    cleanDramas: clean,
  };

  const artifact = {
    generated: new Date().toISOString(),
    screen: 's-underivability',
    spec: path.relative(ROOT, args.spec),
    model: args.mock ? 'mock' : args.model,
    candidatesPerDrama: args.candidates,
    summary,
    results,
  };
  const outPath =
    args.out ||
    path.join(ROOT, 'exports', `s-underivability-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  console.log(`\n== S-underivability screen (model=${args.mock ? 'mock' : args.model}) ==`);
  for (const r of results) {
    if (r.verdict === 'error') {
      console.log(`  ${r.dramaId.padEnd(8)} ERROR   ${r.error}`);
      continue;
    }
    const tag = r.verdict === 'clean' ? 'CLEAN   ' : 'DERIVABLE';
    const how = r.derivable
      ? ` (matched rank ${r.matchedRank}${r.judgeMatch ? ', judge' : ''}${r.deterministicMatch ? `, tokens:${r.deterministicMode}` : ''})`
      : `${r.underdetermined ? ' (model: under-determined)' : ''}`;
    console.log(`  ${r.dramaId.padEnd(8)} ${tag}${how}`);
  }
  console.log(
    `\n  ${summary.clean}/${summary.total} clean; ${summary.derivable} derivable (REJECT)` +
      (errored.length ? `; ${errored.length} errored` : ''),
  );
  console.log(`  wrote ${path.relative(ROOT, outPath)}\n`);

  if (args.failOnDerivable && (derivable.length || errored.length)) process.exitCode = 1;
  return artifact;
}

if (path.resolve(process.argv[1] || '') === __filename) {
  run(parseArgs(process.argv.slice(2))).catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}

export { parseArgs, loadDramas, buildDiscoveryPrompt, buildJudgePrompt, deterministicMatch, screenDrama, run };

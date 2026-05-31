#!/usr/bin/env node
/**
 * S-FORCEDNESS screen — the mirror of scripts/screen-s-underivability.js.
 *
 * Underivability asks: given only the LEARNER-VISIBLE setup, can a strong reader recover
 * S? (Must be NO, else the no-help control isn't clean.) Forcedness asks the opposite:
 * given the FULL premise ledger (the facts the tutor holds and meters), is S the UNIQUELY
 * FORCED conclusion? (Must be YES, else a learner reaching S is leaping past the evidence
 * and "raising the discovery rate" manufactures a false aha -- the closed-loop trap the
 * under-determination gate exposed: the original causal S was forced only ~1/4.)
 *
 * A scenario is honest only if it passes BOTH: underivable from K_L AND forced from the ledger.
 *
 *   node scripts/screen-s-forcedness.js --spec config/poetics-calibration/oedipus-pilot-v2.yaml \
 *        [--only D_OED1,D_OED3] [--panel gpt,deepseek/deepseek-v4-pro,...] [--consensus 3]
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { callModel, parseJsonResponse, withScorerRetry } from './score-poetics-calibration.js';

function parseArgs(argv) {
  const a = {
    spec: null,
    only: null,
    panel: ['gpt', 'deepseek/deepseek-v4-pro', 'qwen/qwen3.7-max', 'google/gemini-3.5-flash'],
    consensus: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--spec') a.spec = path.resolve(argv[++i]);
    else if (t === '--only')
      a.only = String(argv[++i])
        .split(',')
        .map((s) => s.trim());
    else if (t === '--panel')
      a.panel = String(argv[++i])
        .split(',')
        .map((s) => s.trim());
    else if (t === '--consensus') a.consensus = parseInt(argv[++i], 10);
  }
  if (!a.spec) throw new Error('--spec required');
  if (a.consensus == null) a.consensus = Math.max(1, Math.ceil(a.panel.length * 0.75));
  return a;
}

// K_L: the learner-visible situation, assembled exactly as the underivability
// screen does (no secret/dramatic_shape/intended_*/tutor voice). Underivability
// proves K_L ALONE does not yield S; forcedness proves K_L + the metered ledger
// DOES. The two screens partition the fact-space: the ledger is precisely the
// missing increment. Hence we judge S against K_L + ledger, not the ledger alone.
const kLof = (d) => ({
  discipline: d.discipline || null,
  topic: d.topic || null,
  scene: d.scenario_name || null,
  learner_start_state: d.learner_start_state || null,
  learner_voice: d.learner_voice_constraint || null,
});

const buildPrompt = (kL, ledger, s) => `A reasoner is in this SITUATION (everything they themselves already know):
${yaml.stringify(kL).trim()}

A mentor then establishes, one record at a time, these ADDITIONAL FACTS, which the reasoner accepts as GIVEN and true:
${ledger.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}

CANDIDATE CONCLUSION S: "${s}"

QUESTION: Combining the situation with the established facts, is S the UNIQUELY FORCED conclusion -- do they logically ENTAIL S so that no alternative conclusion is equally warranted? Or do they UNDER-DETERMINE S (some other conclusion remains equally consistent with the same facts)?
Be strict: "consistent with S" is NOT "forces S". S is forced only if denying S would contradict the given facts.
Reply ONLY JSON: {"s_forced": true|false, "gap": "<if not forced: the equally-warranted alternative or the missing fact; else 'none'>"}`;

async function run() {
  const args = parseArgs(process.argv);
  const spec = yaml.parse(fs.readFileSync(args.spec, 'utf8'));
  const dramas = (spec.dramas || []).filter(
    (d) => d.secret && d.secret.fact && (!args.only || args.only.includes(d.id)),
  );
  console.log(
    `== S-forcedness screen (panel=${args.panel.join(',')}, consensus ${args.consensus}/${args.panel.length}) ==`,
  );
  let allClean = true;
  for (const d of dramas) {
    const kL = kLof(d);
    const votes = [];
    const gaps = [];
    for (const m of args.panel) {
      try {
        const { value: v } = await withScorerRetry(async () =>
          parseJsonResponse(await callModel(buildPrompt(kL, d.secret.premise_ledger, d.secret.fact), m)),
        );
        votes.push(v.s_forced === true);
        if (v.gap && v.gap !== 'none') gaps.push(v.gap);
      } catch {
        votes.push(null);
      }
    }
    const forced = votes.filter((v) => v === true).length;
    const valid = votes.filter((v) => v !== null).length;
    const clean = forced >= args.consensus;
    allClean = allClean && clean;
    console.log(`  ${d.id}   ${clean ? 'FORCED   (clean)' : 'UNDER-DETERMINED (REJECT)'}  ${forced}/${valid}`);
    if (!clean && gaps.length) console.log(`     gap: ${gaps[0].slice(0, 180)}`);
  }
  console.log(
    `\n  ${allClean ? 'ALL FORCED — ledgers entail S' : 'SOME UNDER-DETERMINED — rewrite the ledger so S is forced'}`,
  );
  process.exit(allClean ? 0 : 1);
}
run().catch((e) => {
  console.error(e.message);
  process.exit(2);
});

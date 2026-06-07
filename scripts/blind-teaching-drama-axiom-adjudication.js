#!/usr/bin/env node
/**
 * A19 deterministic blind adjudication scaffold.
 *
 * This is a fixture-only adapter over the A18 blind option matcher. It reads S0
 * and S1 public transcripts, performs mechanical post-hoc alias matching, and
 * emits the A19 card verdict. It does not call paid critics or license new
 * empirical claims.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';
import { matchesAny } from './blind-option-adjudication.js';
import { classifyCardVerdict } from './validate-teaching-drama-axiom-protocol.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_PROTOCOL = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-protocol.yaml');

function usage() {
  return `Usage:
  node scripts/blind-teaching-drama-axiom-adjudication.js \\
    --s0 PATH --s1 PATH \\
    --target-aliases "repair rupture|name the target" \\
    --decoy-aliases "insist on effort|restate the rubric" \\
    [--option-space "repair A | repair B | repair C"] \\
    [--protocol config/teaching-drama-axioms/a19-protocol.yaml] \\
    [--family-id ID] [--sibling-id ID] [--out PATH.json] [--run-id ID] --mock

A19 currently supports only --mock. The report is deterministic and fixture-only.`;
}

function splitAliases(value) {
  return String(value || '')
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    protocol: DEFAULT_PROTOCOL,
    targetAliases: [],
    decoyAliases: [],
    mock: false,
    familyId: null,
    siblingId: null,
    runId: null,
    optionSpace: null,
    out: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--protocol') args.protocol = path.resolve(argv[++i]);
    else if (token === '--s0') args.s0 = path.resolve(argv[++i]);
    else if (token === '--s1') args.s1 = path.resolve(argv[++i]);
    else if (token === '--target-aliases') args.targetAliases = splitAliases(argv[++i]);
    else if (token === '--decoy-aliases') args.decoyAliases = splitAliases(argv[++i]);
    else if (token === '--option-space') args.optionSpace = argv[++i];
    else if (token === '--family-id') args.familyId = argv[++i];
    else if (token === '--sibling-id') args.siblingId = argv[++i];
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--mock') args.mock = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (args.help) return args;
  if (!args.mock) throw new Error('A19 blind adjudication scaffold is fixture-only for now; pass --mock.');
  if (!args.s0 || !args.s1) throw new Error(`--s0 and --s1 are required\n\n${usage()}`);
  if (!args.targetAliases.length) throw new Error('--target-aliases is required');
  if (!args.decoyAliases.length) throw new Error('--decoy-aliases is required');
  if (!fs.existsSync(args.s0)) throw new Error(`S0 transcript not found: ${args.s0}`);
  if (!fs.existsSync(args.s1)) throw new Error(`S1 transcript not found: ${args.s1}`);
  args.runId = args.runId || `a19-blind-${Date.now()}`;
  return args;
}

function readProtocol(protocolPath) {
  return yaml.parse(fs.readFileSync(protocolPath, 'utf8'));
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function finalTutorSegment(transcript) {
  const text = String(transcript || '');
  const matches = [...text.matchAll(/^TUTOR:\s*(.+)$/gim)];
  if (!matches.length) return text.slice(-800);
  return matches[matches.length - 1][1];
}

export function classifyTranscriptArm({ label, transcriptPath, targetAliases, decoyAliases }) {
  const transcript = fs.readFileSync(transcriptPath, 'utf8');
  const segment = finalTutorSegment(transcript);
  const targetHits = targetAliases.filter((alias) => matchesAny(segment, [alias]));
  const decoyHits = decoyAliases.filter((alias) => matchesAny(segment, [alias]));
  let committedOptionClass = 'neither';
  let basisLabel = 'no_commitment';
  const artifactFlags = [];
  if (targetHits.length && !decoyHits.length) {
    committedOptionClass = 'target';
    basisLabel = 'target_alias_posthoc_match';
  } else if (decoyHits.length && !targetHits.length) {
    committedOptionClass = 'decoy';
    basisLabel = 'decoy_alias_posthoc_match';
  } else if (targetHits.length && decoyHits.length) {
    committedOptionClass = 'neither';
    basisLabel = 'ambiguous_alias_match';
    artifactFlags.push('critic_split');
  }
  return {
    label,
    transcript_path: repoRel(transcriptPath),
    committed_option_class: committedOptionClass,
    basis_label: basisLabel,
    artifact_flags: artifactFlags,
    target_alias_hits: targetHits,
    decoy_alias_hits: decoyHits,
    inspected_public_segment: segment,
  };
}

export function adjudicateTeachingDramaAxiomCard({
  protocolPath = DEFAULT_PROTOCOL,
  s0,
  s1,
  targetAliases,
  decoyAliases,
  optionSpace = null,
  familyId = null,
  siblingId = null,
  runId = `a19-blind-${Date.now()}`,
} = {}) {
  const protocol = readProtocol(protocolPath);
  const s0Arm = classifyTranscriptArm({
    label: 'S0_no_policy',
    transcriptPath: s0,
    targetAliases,
    decoyAliases,
  });
  const s1Arm = classifyTranscriptArm({
    label: 'S1_policy_memory',
    transcriptPath: s1,
    targetAliases,
    decoyAliases,
  });
  const card = {
    fixture_adjudication: {
      s0: {
        committed_option_class: s0Arm.committed_option_class,
        basis_label: s0Arm.basis_label,
        artifact_flags: s0Arm.artifact_flags,
      },
      s1: {
        committed_option_class: s1Arm.committed_option_class,
        basis_label: s1Arm.basis_label,
        artifact_flags: s1Arm.artifact_flags,
      },
    },
  };
  const cardVerdict = classifyCardVerdict(card, protocol);
  return {
    schema_version: 'a19-blind-adjudication-v0.1',
    run_id: runId,
    created_at: new Date().toISOString(),
    channel: 'fixture_blind_mechanical_mock',
    critic_backend: 'deterministic_mock_alias_reader',
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    family_id: familyId,
    sibling_id: siblingId,
    neutral_option_space: optionSpace,
    critic_prompt_audit: {
      target_aliases_visible_to_critic: false,
      decoy_aliases_visible_to_critic: false,
      arm_provenance_visible_to_critic: false,
      policy_memory_condition_visible_to_critic: false,
    },
    posthoc_mapping: {
      target_aliases: targetAliases,
      decoy_aliases: decoyAliases,
    },
    arms: {
      s0: s0Arm,
      s1: s1Arm,
    },
    card_verdict: cardVerdict,
    non_claims: [
      'human_learning',
      'deployed_adaptive_tutor',
      'model_weight_learning',
      'main_harness_rate_effect',
      'paid_blind_panel_result',
    ],
  };
}

export function runBlindAdjudication(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs)
    ? parseArgs(rawArgs)
    : {
        protocol: DEFAULT_PROTOCOL,
        targetAliases: [],
        decoyAliases: [],
        mock: true,
        familyId: null,
        siblingId: null,
        runId: null,
        optionSpace: null,
        out: null,
        help: false,
        ...rawArgs,
      };
  if (args.help) return { help: usage() };
  const report = adjudicateTeachingDramaAxiomCard({
    protocolPath: args.protocol,
    s0: args.s0,
    s1: args.s1,
    targetAliases: args.targetAliases,
    decoyAliases: args.decoyAliases,
    optionSpace: args.optionSpace,
    familyId: args.familyId,
    siblingId: args.siblingId,
    runId: args.runId,
  });
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  return report;
}

function main() {
  const report = runBlindAdjudication();
  if (report.help) {
    process.stdout.write(`${report.help}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

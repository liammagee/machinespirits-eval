#!/usr/bin/env node
/**
 * A19 generalization loop planner.
 *
 * Reads the three-track A19 generalization config and emits the next lawful
 * action for each track. This is an offline planning/status tool: it does not
 * generate, judge, retrieve, train, or update Paper 2.0.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-generalization-loops.yaml');
const VALID_TRACK_TYPES = new Set(['repair_family_design', 'adjudication_infrastructure', 'baseline_condition_design']);
const TERMINAL_STATUSES = new Set([
  'distinct_result_known',
  'infrastructure_ready',
  'blocked_external_human',
  'stable_positive',
  'stable_negative',
  'exhausted',
]);

function usage() {
  return `Usage:
  node scripts/run-a19-generalization-loop.js \\
    [--config config/teaching-drama-axioms/a19-generalization-loops.yaml] \\
    [--track non_collapsing_repair_family] [--out exports/a19/reports/generalization-loop.md] [--json]

Offline only. Reports next lawful A19 generalization actions by track.`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    config: DEFAULT_CONFIG,
    track: null,
    out: null,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--config') args.config = path.resolve(argv[++i]);
    else if (token === '--track') args.track = argv[++i];
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--json') args.json = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  return args;
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function firstPendingAction(track) {
  const queue = asArray(track.next_actions);
  return queue.length ? queue[0] : null;
}

function artifactStatus(requiredArtifacts = []) {
  return asArray(requiredArtifacts).map((artifact) => {
    const fullPath = path.join(ROOT, artifact);
    return {
      path: artifact,
      exists: fs.existsSync(fullPath),
    };
  });
}

function summarizeCandidate(candidate) {
  return {
    candidate_id: candidate.candidate_id || candidate.condition_id,
    status: candidate.status || 'unspecified',
    proposed_repair_type: candidate.proposed_repair_type || null,
    claim_status: candidate.claim_status || null,
    next_action:
      candidate.status === 'planned'
        ? 'preregister_before_generation'
        : candidate.status === 'already_registered_protocol_screen_only'
          ? 'eligible_for_protocol_screen_only'
          : null,
  };
}

function summarizeTrack(track) {
  const artifactChecks = artifactStatus(track.required_artifacts);
  const missingArtifacts = artifactChecks.filter((artifact) => !artifact.exists);
  const known = track.known_result || {};
  const distinctKnown = known.distinct_result_known === true || TERMINAL_STATUSES.has(track.status);
  const declaredNextAction = firstPendingAction(track);
  const candidates = [
    ...asArray(track.candidate_queue).map(summarizeCandidate),
    ...asArray(track.candidate_conditions).map(summarizeCandidate),
  ];
  const nextAction =
    missingArtifacts.length > 0
      ? `create_required_artifact:${missingArtifacts[0].path}`
      : declaredNextAction
        ? declaredNextAction
        : distinctKnown
          ? 'hold_boundary_until_next_preregistered_unit'
          : candidates.find((candidate) => candidate.next_action)?.next_action || 'no_next_action';

  return {
    track_id: track.track_id,
    title: track.title,
    track_type: track.track_type,
    status: track.status,
    distinct_result_known: distinctKnown,
    result_label: known.result_label || null,
    current_boundary: known.current_boundary || null,
    next_action: nextAction,
    artifact_checks: artifactChecks,
    success_condition: asArray(track.success_condition),
    failure_conditions: asArray(track.failure_conditions),
    loop_steps: asArray(track.loop_steps),
    candidates,
  };
}

export function validateGeneralizationLoopConfig(config) {
  const issues = [];
  const push = (severity, pathName, message) => issues.push({ severity, path: pathName, message });
  if (config?.meta?.protocol_id !== 'A19') push('error', 'meta.protocol_id', 'must be A19');
  if (!hasText(config?.meta?.schema_version)) push('error', 'meta.schema_version', 'is required');
  if (!hasText(config?.meta?.claim_boundary)) push('error', 'meta.claim_boundary', 'is required');
  if (!asArray(config?.global_stop_rules).length) push('error', 'global_stop_rules', 'must not be empty');
  const tracks = asArray(config?.tracks);
  if (tracks.length !== 3) push('error', 'tracks', 'must define exactly the three A19 generalization tracks');
  const seen = new Set();
  tracks.forEach((track, index) => {
    const base = `tracks[${index}]`;
    if (!hasText(track.track_id)) push('error', `${base}.track_id`, 'is required');
    if (seen.has(track.track_id)) push('error', `${base}.track_id`, 'must be unique');
    seen.add(track.track_id);
    if (!VALID_TRACK_TYPES.has(track.track_type)) {
      push('error', `${base}.track_type`, `must be one of ${[...VALID_TRACK_TYPES].join(', ')}`);
    }
    if (!asArray(track.loop_steps).length) push('error', `${base}.loop_steps`, 'must list loop steps');
    if (!asArray(track.success_condition).length)
      push('error', `${base}.success_condition`, 'must list success conditions');
    if (!asArray(track.failure_conditions).length)
      push('error', `${base}.failure_conditions`, 'must list failure conditions');
    if (!hasText(track.known_result?.current_boundary)) {
      push('error', `${base}.known_result.current_boundary`, 'must state the current boundary');
    }
  });
  return {
    status: issues.some((issue) => issue.severity === 'error') ? 'fail' : 'pass',
    issues,
  };
}

export function summarizeGeneralizationLoops(config, { configPath = DEFAULT_CONFIG, trackId = null } = {}) {
  const validation = validateGeneralizationLoopConfig(config);
  const selectedTracks = asArray(config.tracks).filter((track) => !trackId || track.track_id === trackId);
  if (trackId && !selectedTracks.length) {
    return {
      status: 'fail',
      issues: [{ severity: 'error', path: 'track', message: `track not found: ${trackId}` }],
      tracks: [],
    };
  }
  const tracks = selectedTracks.map(summarizeTrack);
  return {
    schema_version: 'a19-generalization-loop-summary-v0.1',
    status: validation.status,
    created_at: new Date().toISOString(),
    config_path: repoRel(configPath),
    loop_version: config.meta?.loop_version || null,
    claim_boundary: config.meta?.claim_boundary || null,
    non_claims: asArray(config.meta?.does_not_claim),
    global_stop_rules: asArray(config.global_stop_rules),
    issues: validation.issues,
    tracks,
  };
}

export function renderMarkdown(summary) {
  const lines = [
    '# A19 Generalization Loop Status',
    '',
    `Status: \`${summary.status}\`.`,
    `Created: ${summary.created_at}.`,
    `Config: \`${summary.config_path}\`.`,
    '',
    '## Boundary',
    '',
    `Claim boundary: \`${summary.claim_boundary}\`.`,
    '',
    'Claims not licensed:',
    ...summary.non_claims.map((claim) => `- ${claim}`),
    '',
    '## Tracks',
    '',
  ];
  for (const track of summary.tracks) {
    lines.push(
      `### ${track.track_id}`,
      '',
      `- Type: \`${track.track_type}\`.`,
      `- Status: \`${track.status}\`.`,
      `- Distinct result known: \`${track.distinct_result_known}\`.`,
      `- Result label: \`${track.result_label || 'n/a'}\`.`,
      `- Current boundary: ${track.current_boundary || 'n/a'}`,
      `- Next action: \`${track.next_action}\`.`,
      '',
    );
    if (track.artifact_checks.length) {
      lines.push('| required artifact | exists |', '| --- | --- |');
      for (const artifact of track.artifact_checks) {
        lines.push(`| \`${artifact.path}\` | ${artifact.exists ? 'yes' : 'no'} |`);
      }
      lines.push('');
    }
    if (track.candidates.length) {
      lines.push('| candidate | status | next action |', '| --- | --- | --- |');
      for (const candidate of track.candidates) {
        lines.push(
          `| \`${candidate.candidate_id}\` | \`${candidate.status}\` | \`${candidate.next_action || 'n/a'}\` |`,
        );
      }
      lines.push('');
    }
  }
  if (summary.issues.length) {
    lines.push('## Issues', '');
    for (const issue of summary.issues) lines.push(`- [${issue.severity}] ${issue.path}: ${issue.message}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const config = yaml.parse(fs.readFileSync(args.config, 'utf8'));
  const summary = summarizeGeneralizationLoops(config, { configPath: args.config, trackId: args.track });
  const output = args.json ? `${JSON.stringify(summary, null, 2)}\n` : renderMarkdown(summary);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, output, 'utf8');
  } else {
    process.stdout.write(output);
  }
  if (summary.status !== 'pass') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

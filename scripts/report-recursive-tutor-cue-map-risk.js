#!/usr/bin/env node
/**
 * A18.31 zero-API cue-map risk reporter for recursive tutor-learning families.
 *
 * The normal family fixture says what to generate. The cue-map sidecar says why
 * the fixture should have S0/S1 headroom. This reporter checks that design
 * story before replay spending.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'recursive-tutor-learning', 'a18.28-fresh-family-non-inverse.yaml');
const DEFAULT_CUE_MAP = path.join(ROOT, 'config', 'recursive-tutor-learning', 'a18-post-v2-cue-maps.yaml');

function usage() {
  return `Usage:
  node scripts/report-recursive-tutor-cue-map-risk.js
    [--config config/recursive-tutor-learning/a18.28-fresh-family-non-inverse.yaml]
    [--cue-map config/recursive-tutor-learning/a18-post-v2-cue-maps.yaml]
    [--family family_id]

This is zero-API. It classifies family-design risks before replay.`;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    config: DEFAULT_CONFIG,
    cueMap: DEFAULT_CUE_MAP,
    familyId: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--config') args.config = path.resolve(argv[++i]);
    else if (token === '--cue-map') args.cueMap = path.resolve(argv[++i]);
    else if (token === '--family') args.familyId = argv[++i];
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  return args;
}

function readYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function rel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function publicFields(family) {
  const rows = [];
  const cases = [family.training_seed, ...asArray(family.heldout_siblings)];
  for (const item of cases) {
    if (!item) continue;
    const caseId = item.seed_id || item.sibling_id || 'unknown_case';
    for (const field of ['public_setup', 'learner_resistance', 'baseline_tutor_attempt', 'learner_followup']) {
      rows.push({ family_id: family.family_id, case_id: caseId, field, text: String(item[field] || '') });
    }
  }
  return rows;
}

function selectedRepairMarkers(family) {
  const markers = new Set();
  for (const sibling of asArray(family.heldout_siblings)) {
    for (const marker of asArray(sibling.policy_correctness?.selected_repair_markers)) {
      if (clean(marker)) markers.add(clean(marker));
    }
  }
  return markers;
}

function markerPublicHits(family, markers) {
  const hits = [];
  for (const row of publicFields(family)) {
    const text = clean(row.text);
    for (const marker of markers) {
      if (marker && text.includes(marker)) hits.push({ ...row, marker });
    }
  }
  return hits;
}

function cueMapByFamily(cueMapConfig) {
  return new Map(asArray(cueMapConfig.cue_maps).map((entry) => [entry.family_id, entry]));
}

function issue(severity, code, message, evidence = {}) {
  return { severity, code, message, evidence };
}

export function classifyCueMapRisk({ family, cueMap }) {
  const issues = [];
  if (!cueMap) {
    return {
      family_id: family.family_id,
      status: 'fail',
      issues: [issue('error', 'missing_cue_map', 'No cue-map sidecar entry for family.')],
    };
  }

  const relationType = clean(cueMap.selected_relation_type);
  const counterexamplePresent = cueMap.counterexample?.present === true;
  const selectedVisibility = clean(cueMap.selected_cue?.public_visibility);
  const selectedGeometry = clean(cueMap.selected_cue?.geometry);
  const empiricalStatus = clean(cueMap.empirical_status);
  const requiresConstructedDevice = cueMap.requires_constructed_device === true;
  const salience = cueMap.target_salience || {};
  const competingAgainst = Number(salience.max_competing_cues_against_selected || 0);
  const supportingSelected = Number(salience.selected_target_supporting_cues || 0);
  const markers = selectedRepairMarkers(family);
  const naturalAliases = new Set(asArray(cueMap.marker_natural_aliases).map(clean).filter(Boolean));
  const missingNaturalAliases = [...naturalAliases].filter((alias) => !markers.has(alias));
  const publicMarkerHits = markerPublicHits(family, markers);

  if (['inverse_completion', 'inverse', 'opposite', 'mirror'].includes(relationType) && !counterexamplePresent) {
    issues.push(
      issue(
        'error',
        'inverse_rule_instability_risk',
        'Inverse/opposite selected relations need a public counterexample that makes the ordinary match rule fail.',
        { selected_relation_type: cueMap.selected_relation_type, counterexample_present: counterexamplePresent },
      ),
    );
  }

  if (selectedVisibility === 'high' && !counterexamplePresent) {
    issues.push(
      issue(
        'error',
        'public_self_solving_risk',
        'Highly visible selected cues are likely to be discovered by S0 unless a counterexample blocks the obvious reading.',
        { public_visibility: cueMap.selected_cue?.public_visibility, counterexample_present: counterexamplePresent },
      ),
    );
  }

  if (
    ['selector_authority', 'visible_marker_authority', 'direct_visible_governance'].includes(relationType) &&
    selectedGeometry === 'adjacent_marker' &&
    !requiresConstructedDevice &&
    empiricalStatus !== 'prior_panel_pass'
  ) {
    issues.push(
      issue(
        'error',
        'selector_like_public_governance_self_solving',
        'A visible marker adjacent to the selected target can be read by S0 as a public pointer unless a constructed device or prior empirical positive status blocks that risk.',
        {
          selected_relation_type: cueMap.selected_relation_type,
          selected_geometry: cueMap.selected_cue?.geometry,
          requires_constructed_device: requiresConstructedDevice,
          empirical_status: cueMap.empirical_status || null,
        },
      ),
    );
  }

  if (competingAgainst >= 2 && supportingSelected <= 1) {
    issues.push(
      issue(
        'warning',
        'target_salience_overload',
        'The selected target fights multiple high-salience cues while receiving little public support.',
        { max_competing_cues_against_selected: competingAgainst, selected_target_supporting_cues: supportingSelected },
      ),
    );
  }

  if (missingNaturalAliases.length) {
    issues.push(
      issue(
        'warning',
        'marker_too_narrow',
        'Natural generated aliases are absent from selected_repair_markers; correctness may false-negative S1.',
        { missing_natural_aliases: missingNaturalAliases },
      ),
    );
  }

  if (publicMarkerHits.length) {
    issues.push(
      issue(
        'error',
        'marker_too_broad',
        'Registered selected-repair markers appear in public seed fields; S0 may receive the policy lexically.',
        { hits: publicMarkerHits },
      ),
    );
  }

  if (!counterexamplePresent) {
    issues.push(
      issue(
        'warning',
        'counterexample_missing',
        'Cue map does not identify a public counterexample that blocks the learner old check.',
        { old_check: cueMap.counterexample?.old_check || null },
      ),
    );
  }

  const errors = issues.filter((row) => row.severity === 'error').length;
  return {
    family_id: family.family_id,
    status: errors ? 'fail' : issues.length ? 'warn' : 'pass',
    selected_relation_type: cueMap.selected_relation_type || null,
    public_visibility: cueMap.selected_cue?.public_visibility || null,
    selected_geometry: cueMap.selected_cue?.geometry || null,
    empirical_status: cueMap.empirical_status || null,
    requires_constructed_device: requiresConstructedDevice,
    counterexample_present: counterexamplePresent,
    selected_repair_markers: [...markers].sort(),
    issues,
  };
}

export function reportCueMapRisk({ configPath = DEFAULT_CONFIG, cueMapPath = DEFAULT_CUE_MAP, familyId = null } = {}) {
  const config = readYaml(configPath);
  const cueMapConfig = readYaml(cueMapPath);
  const maps = cueMapByFamily(cueMapConfig);
  const families = asArray(config.families).filter((family) => !familyId || family.family_id === familyId);
  const rows = families.map((family) => classifyCueMapRisk({ family, cueMap: maps.get(family.family_id) }));
  if (familyId && !rows.length) {
    rows.push({
      family_id: familyId,
      status: 'fail',
      issues: [issue('error', 'family_not_found', `Family not found in config: ${familyId}`)],
    });
  }
  return {
    kind: 'a18_31_recursive_tutor_cue_map_risk_report',
    config: rel(configPath),
    cue_map: rel(cueMapPath),
    family_filter: familyId,
    status: rows.length > 0 && rows.every((row) => row.status === 'pass') ? 'pass' : 'fail',
    status_counts: rows.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {}),
    rows,
  };
}

async function main() {
  try {
    const args = parseArgs();
    if (args.help) {
      console.log(usage());
      return;
    }
    const report = reportCueMapRisk({
      configPath: args.config,
      cueMapPath: args.cueMap,
      familyId: args.familyId,
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== 'pass') process.exitCode = 1;
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main();
}

#!/usr/bin/env node
/**
 * Render a diagnostic A19 human boundary-adjudication report from merged coder
 * files. This does not create a Paper 2.0, atlas, sidecar, or transfer claim.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return `Usage:
  node scripts/report-a19-human-boundary-adjudication.js \\
    --merged exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.coders.json \\
    [--out-json exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-boundary-report.json] \\
    [--out-md exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-boundary-report.md] [--json]

Offline only. Reports human construct-boundary diagnostics and preserves the
A19 non-claim boundary.`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    merged: null,
    outJson: null,
    outMd: null,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--merged') args.merged = path.resolve(argv[++i]);
    else if (token === '--out-json') args.outJson = path.resolve(argv[++i]);
    else if (token === '--out-md') args.outMd = path.resolve(argv[++i]);
    else if (token === '--json') args.json = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (args.help) return args;
  if (!args.merged) throw new Error(`--merged is required\n\n${usage()}`);
  if (!fs.existsSync(args.merged)) throw new Error(`merged report not found: ${args.merged}`);
  const base = path.basename(args.merged, '.json').replace(/\.coders$/u, '');
  args.outJson =
    args.outJson || path.join(ROOT, 'exports', 'a19', 'adjudication-reports', `${base}.human-boundary-report.json`);
  args.outMd =
    args.outMd || path.join(ROOT, 'exports', 'a19', 'adjudication-reports', `${base}.human-boundary-report.md`);
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function percentAgreement(values) {
  const clean = values.filter((value) => value !== null && value !== undefined && value !== '');
  if (!clean.length) return null;
  const counts = new Map();
  for (const value of clean) counts.set(value, (counts.get(value) || 0) + 1);
  const top = Math.max(...counts.values());
  return top / clean.length;
}

function average(values) {
  const clean = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function pairwiseKappaForCoders(coders, arms, field) {
  if (coders.length < 2 || arms.length < 2) return null;
  const byArmCoder = new Map();
  for (const [armLabel, arm] of arms) {
    for (const code of asArray(arm.raw_codes)) byArmCoder.set(`${armLabel}:${code.coder_id}`, code[field] || 'unclear');
  }
  const kappas = [];
  for (let i = 0; i < coders.length; i += 1) {
    for (let j = i + 1; j < coders.length; j += 1) {
      const a = coders[i].coder_id;
      const b = coders[j].coder_id;
      const pairs = arms
        .map(([armLabel]) => [byArmCoder.get(`${armLabel}:${a}`), byArmCoder.get(`${armLabel}:${b}`)])
        .filter(([left, right]) => left && right);
      if (!pairs.length) continue;
      const observed = pairs.filter(([left, right]) => left === right).length / pairs.length;
      const labels = [...new Set(pairs.flat())];
      const expected = labels.reduce((sum, label) => {
        const leftRate = pairs.filter(([left]) => left === label).length / pairs.length;
        const rightRate = pairs.filter(([, right]) => right === label).length / pairs.length;
        return sum + leftRate * rightRate;
      }, 0);
      kappas.push(expected >= 1 ? 1 : (observed - expected) / (1 - expected));
    }
  }
  return average(kappas);
}

function nominalAlpha(arms, field) {
  const units = arms.map(([, arm]) => asArray(arm.raw_codes).map((code) => code[field] || 'unclear'));
  const labels = units.flat();
  if (labels.length < 2) return null;
  let observedDisagreements = 0;
  let observedPairs = 0;
  for (const unit of units) {
    for (let i = 0; i < unit.length; i += 1) {
      for (let j = i + 1; j < unit.length; j += 1) {
        observedPairs += 1;
        if (unit[i] !== unit[j]) observedDisagreements += 1;
      }
    }
  }
  if (!observedPairs) return null;
  const counts = new Map();
  for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
  let expectedDisagreements = 0;
  const total = labels.length;
  for (const [labelA, countA] of counts) {
    for (const [labelB, countB] of counts) {
      if (labelA !== labelB) expectedDisagreements += countA * countB;
    }
  }
  expectedDisagreements /= total * (total - 1);
  if (expectedDisagreements === 0) return observedDisagreements === 0 ? 1 : 0;
  return 1 - observedDisagreements / observedPairs / expectedDisagreements;
}

function obligationAgreement(arms) {
  const rows = [];
  for (const [armLabel, arm] of arms) {
    const obligationIds = [
      ...new Set(asArray(arm.raw_codes).flatMap((code) => Object.keys(code.obligations || {}))),
    ].sort();
    for (const obligationId of obligationIds) {
      rows.push({
        arm_label: armLabel,
        obligation_id: obligationId,
        percent_agreement: percentAgreement(asArray(arm.raw_codes).map((code) => code.obligations?.[obligationId])),
      });
    }
  }
  return rows;
}

function provenanceForArm(merged, armLabel) {
  return merged.private_mapping_applied_after_raw_codes?.[armLabel]?.private_packet_mapping?.provenance || null;
}

function statusFromDiagnostics({ merged, arms, pairwisePreferenceAgreement, aliasLeakageConsensus }) {
  if (merged.status === 'no_coder_files') return 'no_coder_files';
  if (merged.status === 'single_coder_diagnostic_only') return 'single_coder_diagnostic_only';
  if (merged.status === 'fail') return 'fail';
  if (aliasLeakageConsensus === 'decisive_contamination') return 'leakage_blocked';
  const primaryAgreement = average(
    arms.map(([, arm]) => percentAgreement(asArray(arm.raw_codes).map((code) => code.repair_type))),
  );
  if (primaryAgreement !== null && primaryAgreement < 0.67) return 'construct_boundary_unstable';
  if (pairwisePreferenceAgreement !== null && pairwisePreferenceAgreement < 0.67) return 'construct_boundary_unstable';
  const s0 = arms.find(([armLabel]) => provenanceForArm(merged, armLabel) === 'S0_no_policy');
  const s1 = arms.find(([armLabel]) => provenanceForArm(merged, armLabel) === 'S1_policy_memory');
  const s0Codes = s0 ? asArray(s0[1].raw_codes) : [];
  const s1Codes = s1 ? asArray(s1[1].raw_codes) : [];
  const s0AllTarget = s0Codes.length > 0 && s0Codes.every((code) => code.target_status === 'target');
  const s1AllTarget = s1Codes.length > 0 && s1Codes.every((code) => code.target_status === 'target');
  if (s0AllTarget && s1AllTarget) return 'human_supported_ceiling';
  if (s0AllTarget) return 'human_supported_s0_ceiling';
  if (s1AllTarget && pairwisePreferenceAgreement === 1) return 'human_supported_local_headroom';
  return 'boundary_diagnostic_complete';
}

export function summarizeHumanBoundaryAdjudication({ mergedPath }) {
  const merged = readJson(mergedPath);
  const arms = Object.entries(merged.arms || {});
  const coders = asArray(merged.coders);
  const primaryLabelAgreementByArm = arms.map(([armLabel, arm]) => ({
    arm_label: armLabel,
    percent_agreement: percentAgreement(asArray(arm.raw_codes).map((code) => code.repair_type)),
  }));
  const targetStatusAgreementByArm = arms.map(([armLabel, arm]) => ({
    arm_label: armLabel,
    percent_agreement: percentAgreement(
      asArray(arm.raw_codes).map((code) => code.target_status || code.committed_option_class),
    ),
  }));
  const riskAgreementByArm = arms.map(([armLabel, arm]) => ({
    arm_label: armLabel,
    percent_agreement: percentAgreement(asArray(arm.raw_codes).map((code) => String(code.target_granularity_risk))),
  }));
  const betterArmValues = coders.map((coder) => coder.pairwise_judgment?.better_arm_public_id).filter(Boolean);
  const pairwisePreferenceAgreement = percentAgreement(betterArmValues);
  const aliasLeakageValues = coders.map((coder) => coder.pairwise_judgment?.alias_leakage_assessment).filter(Boolean);
  const aliasLeakageConsensus =
    aliasLeakageValues.length && percentAgreement(aliasLeakageValues) === 1 ? aliasLeakageValues[0] : 'no_consensus';
  const agreement = {
    primary_label_percent_agreement: average(primaryLabelAgreementByArm.map((entry) => entry.percent_agreement)),
    primary_label_percent_agreement_by_arm: primaryLabelAgreementByArm,
    primary_label_cohens_kappa_pairwise_mean: pairwiseKappaForCoders(coders, arms, 'repair_type'),
    target_status_percent_agreement: average(targetStatusAgreementByArm.map((entry) => entry.percent_agreement)),
    target_status_percent_agreement_by_arm: targetStatusAgreementByArm,
    target_granularity_risk_percent_agreement: average(riskAgreementByArm.map((entry) => entry.percent_agreement)),
    target_granularity_risk_percent_agreement_by_arm: riskAgreementByArm,
    krippendorff_alpha_nominal: nominalAlpha(arms, 'repair_type'),
    obligation_level_agreement: obligationAgreement(arms),
    pairwise_preference_agreement: pairwisePreferenceAgreement,
    alias_leakage_consensus: aliasLeakageConsensus,
  };
  const status = statusFromDiagnostics({ merged, arms, pairwisePreferenceAgreement, aliasLeakageConsensus });
  return {
    report_version: 'a19-human-boundary-report-v01',
    status,
    created_at: new Date().toISOString(),
    merged_path: repoRel(mergedPath),
    packet_id: merged.packet_id,
    packet_sha256: merged.coder_packet_sha256,
    codebook_id: merged.codebook_id,
    coder_count: merged.coder_count,
    raw_coder_files_preserved: coders.every((coder) => Boolean(coder.source_path)),
    merge_status: merged.status,
    agreement,
    visible_alias_audit: {
      total_hits: asArray(merged.visible_alias_hits_in_public_transcripts).length,
      hits: asArray(merged.visible_alias_hits_in_public_transcripts),
    },
    construct_findings: {
      humans_distinguish_target_from_claim_address:
        status === 'human_supported_local_headroom'
          ? 'supported_locally'
          : status === 'construct_boundary_unstable'
            ? 'unstable'
            : 'not_established',
      alias_leakage_consensus: aliasLeakageConsensus,
      s1_better_for_target_reason:
        pairwisePreferenceAgreement === 1 &&
        coders.every((coder) => coder.pairwise_judgment?.better_for_target_reason === true)
          ? 'coder_supported'
          : 'not_claim_eligible',
    },
    claim_boundary: {
      licenses_a19_transfer_claim: false,
      licenses_codebook_revision: status !== 'fail',
      licenses_v09_family_design: status !== 'fail',
      licenses_paper_or_atlas_claim: false,
    },
    non_claims: [
      'human_learning',
      'deployed_adaptive_tutor',
      'model_weight_learning',
      'main_harness_rate_effect',
      'a19_transfer_claim_without_preregistered_thresholds',
      'paper_or_atlas_claim_without_canonical_prose',
    ],
  };
}

export function renderHumanBoundaryMarkdown(report) {
  const lines = [
    '# A19 Human Boundary Adjudication Report',
    '',
    `Status: \`${report.status}\`.`,
    `Merged report: \`${report.merged_path}\`.`,
    `Packet: \`${report.packet_id}\`.`,
    `Coders: ${report.coder_count}.`,
    '',
    '## Agreement',
    '',
    '| metric | value |',
    '| --- | ---: |',
    `| primary label percent agreement | ${report.agreement.primary_label_percent_agreement ?? 'n/a'} |`,
    `| target status percent agreement | ${report.agreement.target_status_percent_agreement ?? 'n/a'} |`,
    `| target-granularity-risk percent agreement | ${
      report.agreement.target_granularity_risk_percent_agreement ?? 'n/a'
    } |`,
    `| pairwise preference agreement | ${report.agreement.pairwise_preference_agreement ?? 'n/a'} |`,
    `| pairwise mean Cohen kappa | ${report.agreement.primary_label_cohens_kappa_pairwise_mean ?? 'n/a'} |`,
    `| nominal Krippendorff alpha | ${report.agreement.krippendorff_alpha_nominal ?? 'n/a'} |`,
    '',
    '## Visible Alias Audit',
    '',
    `Visible public-transcript alias hits: ${report.visible_alias_audit.total_hits}.`,
    '',
    '## Construct Findings',
    '',
    `- Humans distinguish target from claim-address: \`${report.construct_findings.humans_distinguish_target_from_claim_address}\`.`,
    `- Alias leakage consensus: \`${report.construct_findings.alias_leakage_consensus}\`.`,
    `- S1 better for target reason: \`${report.construct_findings.s1_better_for_target_reason}\`.`,
    '',
    '## Claim Boundary',
    '',
    `- Licenses A19 transfer claim: \`${report.claim_boundary.licenses_a19_transfer_claim}\`.`,
    `- Licenses Paper/atlas claim: \`${report.claim_boundary.licenses_paper_or_atlas_claim}\`.`,
    `- Licenses codebook revision: \`${report.claim_boundary.licenses_codebook_revision}\`.`,
    `- Licenses v0.9 family design: \`${report.claim_boundary.licenses_v09_family_design}\`.`,
    '',
    '## Claims Not Licensed',
    '',
    ...report.non_claims.map((claim) => `- ${claim}`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = summarizeHumanBoundaryAdjudication({ mergedPath: args.merged });
  fs.mkdirSync(path.dirname(args.outJson), { recursive: true });
  fs.writeFileSync(args.outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(args.outMd), { recursive: true });
  fs.writeFileSync(args.outMd, renderHumanBoundaryMarkdown(report), 'utf8');
  if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(renderHumanBoundaryMarkdown(report));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULTS = {
  outMd: path.join(ROOT, 'exports', 'yoked-contingency-main-claim-readiness.md'),
  paperPath: path.join(ROOT, 'docs', 'research', 'paper-full-2.0.md'),
};

const ARTIFACTS = [
  ['g0_visible_affect', 'exports/yoked-contingency-g0-visible-affect.json'],
  ['g1_smoke', 'exports/yoked-contingency-g1-paid-smoke.json'],
  ['g1_scaled', 'exports/yoked-contingency-g1-scaled.json'],
  ['g2_standard_smoke', 'exports/yoked-contingency-g2-independent-outcome-smoke.json'],
  ['g2_standard_scaled', 'exports/yoked-contingency-g2-independent-outcome-scaled.json'],
  ['g2_calibrated_smoke', 'exports/yoked-contingency-g2-calibrated-novice-smoke.json'],
  ['g2_calibrated_scaled', 'exports/yoked-contingency-g2-calibrated-novice-scaled.json'],
  ['g2_hard_transfer_smoke', 'exports/yoked-contingency-g2-hard-transfer-smoke.json'],
  ['g2_hard_transfer_scaled', 'exports/yoked-contingency-g2-hard-transfer-scaled.json'],
  ['g2_rule_transfer_smoke', 'exports/yoked-contingency-g2-rule-transfer-smoke.json'],
  ['g2_rule_transfer_scaled', 'exports/yoked-contingency-g2-rule-transfer-scaled.json'],
];

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out-md') args.outMd = argv[++i];
    else if (a === '--paper') args.paperPath = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log(`Usage: node scripts/report-yoked-contingency-claim-readiness.js [--out-md path] [--paper path]`);
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${a}`);
    }
  }
  return args;
}

function loadArtifacts(root = ROOT) {
  return Object.fromEntries(
    ARTIFACTS.map(([key, rel]) => {
      const file = path.join(root, rel);
      if (!fs.existsSync(file)) return [key, null];
      return [key, JSON.parse(fs.readFileSync(file, 'utf8'))];
    }),
  );
}

function statusOf(result) {
  if (!result) return 'missing';
  return String(result.status || 'unknown');
}

function isPass(result) {
  return /^pass_/.test(statusOf(result));
}

export function evaluateClaimReadiness(artifacts) {
  const gates = [
    {
      gate: 'G0 state opacity',
      status: isPass(artifacts.g0_visible_affect) ? 'pass' : 'fail',
      evidence: statusOf(artifacts.g0_visible_affect),
    },
    {
      gate: 'G1 deterministic yoking smoke',
      status: isPass(artifacts.g1_smoke) ? 'pass' : 'fail',
      evidence: statusOf(artifacts.g1_smoke),
    },
    {
      gate: 'G1 deterministic yoking scaled',
      status: isPass(artifacts.g1_scaled) ? 'pass' : 'fail',
      evidence: statusOf(artifacts.g1_scaled),
    },
    {
      gate: 'G2 independent outcome smoke',
      status:
        isPass(artifacts.g2_standard_smoke) ||
        isPass(artifacts.g2_calibrated_smoke) ||
        isPass(artifacts.g2_hard_transfer_smoke) ||
        isPass(artifacts.g2_rule_transfer_smoke)
          ? 'pass'
          : 'fail',
      evidence: [
        `standard=${statusOf(artifacts.g2_standard_smoke)}`,
        `calibrated=${statusOf(artifacts.g2_calibrated_smoke)}`,
        `hard-transfer=${statusOf(artifacts.g2_hard_transfer_smoke)}`,
        `rule-transfer=${statusOf(artifacts.g2_rule_transfer_smoke)}`,
      ].join('; '),
    },
    {
      gate: 'G2 independent outcome scaled',
      status:
        isPass(artifacts.g2_standard_scaled) ||
        isPass(artifacts.g2_calibrated_scaled) ||
        isPass(artifacts.g2_hard_transfer_scaled) ||
        isPass(artifacts.g2_rule_transfer_scaled)
          ? 'pass'
          : 'fail',
      evidence: [
        summarizeG2Scaled('standard', artifacts.g2_standard_scaled),
        summarizeG2Scaled('calibrated', artifacts.g2_calibrated_scaled),
        summarizeG2Scaled('hard-transfer', artifacts.g2_hard_transfer_scaled),
        summarizeG2Scaled('rule-transfer', artifacts.g2_rule_transfer_scaled),
      ].join('; '),
    },
  ];
  const ready = gates.every((gate) => gate.status === 'pass');
  return {
    ready,
    status: ready ? 'ready_for_main_paper_claim' : 'not_ready_for_main_paper_claim',
    gates,
  };
}

export function evaluatePaperIntegration(paperPath = DEFAULTS.paperPath) {
  if (!fs.existsSync(paperPath)) {
    return {
      integrated: false,
      evidence: `missing paper: ${paperPath}`,
    };
  }
  const text = fs.readFileSync(paperPath, 'utf8');
  const checks = [
    ['section', /### 6\.12\.5 Yoked-contingency Probe/],
    ['claim', /same-state yoked tutor plans produce larger independent simulated hard-transfer gains/i],
    ['effect', /\\Delta_2 = 0\.344/],
    ['sign-test', /p = 0\.0020/],
    ['boundary', /not.*human learning/i],
  ];
  const failed = checks.filter(([, pattern]) => !pattern.test(text)).map(([name]) => name);
  return {
    integrated: failed.length === 0,
    evidence: failed.length === 0 ? 'canonical paper contains §6.12.5 claim and boundaries' : `missing: ${failed.join(', ')}`,
  };
}

function summarizeG2Scaled(label, result) {
  if (!result) return `${label}=missing`;
  const summary = result.summary || {};
  return `${label}=${statusOf(result)} Δ2=${fmt(summary.delta2_diagnosis)} same>${summary.sameGreaterSessionCount ?? 'n/a'}/${
    summary.sessionCount ?? 'n/a'
  } p=${fmt(summary.signTestOneSidedP, 4)}`;
}

function fmt(x, digits = 3) {
  const n = Number(x);
  return Number.isFinite(n) ? n.toFixed(digits) : 'n/a';
}

export function renderClaimReadinessReport(readiness) {
  const lines = [];
  lines.push('# Yoked-contingency main-claim readiness');
  lines.push('');
  lines.push(`Status: ${readiness.status}`);
  lines.push('');
  lines.push('| Gate | Status | Evidence |');
  lines.push('|---|---|---|');
  for (const gate of readiness.gates) {
    lines.push(`| ${gate.gate} | ${gate.status} | ${gate.evidence} |`);
  }
  if (readiness.paperIntegration) {
    lines.push(
      `| Paper integration audit | ${readiness.paperIntegration.integrated ? 'pass' : 'fail'} | ${
        readiness.paperIntegration.evidence
      } |`,
    );
  }
  lines.push('');
  lines.push('## Read');
  lines.push('');
  if (readiness.ready) {
    if (readiness.paperIntegration?.integrated) {
      lines.push('The artifact gates and canonical paper integration audit both pass. This is now a cautious main-paper claim.');
    } else {
      lines.push('The artifact gates support drafting a cautious main-paper claim, pending paper-integration audit.');
    }
  } else {
    lines.push(
      'Do not add a main-paper outcome claim yet. The next required gate is a scaled independent-outcome run that avoids posttest ceiling and passes the session-level consistency rule.',
    );
  }
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const readiness = evaluateClaimReadiness(loadArtifacts());
  readiness.paperIntegration = evaluatePaperIntegration(path.resolve(args.paperPath));
  fs.mkdirSync(path.dirname(path.resolve(args.outMd)), { recursive: true });
  fs.writeFileSync(path.resolve(args.outMd), renderClaimReadinessReport(readiness));
  console.log(`${readiness.status}: wrote ${args.outMd}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}

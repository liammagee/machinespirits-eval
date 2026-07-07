#!/usr/bin/env node
/**
 * Non-leak boundary audit for derivation arms (dry reader over committed
 * artifacts — no LLM calls, no verdict changes).
 *
 * The acts-mode tutor is blind to the learner's interior: the engine redacts
 * learnerAbox / corruption / trajectory / inference from its view
 * (engine.js omniscientView), and the proof-debt guard (E5) hands the tutor
 * only `tutorProofDebtView` — {premiseId, surface, sinceTurn} — never the
 * derivation arithmetic (dNow / dIfRestored / deltaD / closesProof) the
 * harness computes to SELECT the debt. The full arithmetic lives only in the
 * separate audit ledger (result.proofDebt), never on an input to the tutor.
 *
 * This script verifies the DYNAMIC half of that boundary against a run's
 * stored transcript + audit ledger. The STATIC half (the view-stripping and
 * the path separation) is a code property, verified by reading
 * proofDebt.js / engine.js / llmRoles.js, not recoverable from an artifact.
 *
 * Checks (per arm):
 *  - tutor_arithmetic_silence : no proof-distance arithmetic in tutor dialogue
 *  - tutor_no_formal_secret   : the formal secret predicate never spoken by the tutor
 *  - secret_grounded_by_learner: the secret fact is grounded on a LEARNER assertion
 *  - proofdebt_view_narrow    : the tutor's per-turn self-audit exposes no arithmetic (guard arms)
 * Positive control (informational, non-gating):
 *  - audit_ledger_carries_arithmetic: the harness ledger DOES carry dNow/deltaD (paths are distinct)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const DEFAULT_ARMS = [
  'lantern-e5-proof-debt-real-r1',
  'lantern-e2-real-r2',
  'lantern-e2-real-r3',
  'lantern-e2-real-r4',
  'lantern-p3-repair-on',
  'lantern-p4-hygiene-on',
];

// Proof-distance arithmetic must never reach the tutor. These are the report
// fields tutorProofDebtView strips, plus the prose forms a model might use if
// it had them.
const ARITH_RE =
  /\b(deltaD|dNow|dIfRestored|closesProof|derivation[- ]distance|distance to (?:the )?(?:proof|secret|goal)|proof[- ]state distance|D ?= ?-?\d|\d+ steps? (?:from|to) (?:the )?(?:proof|secret|close))\b/i;
const ARITH_KEYS = ['dNow', 'dIfRestored', 'deltaD', 'closesProof'];

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const loopDir = flag('loop-dir', 'exports/dramatic-derivation/loop');
const outDir = flag('out', 'exports/dramatic-derivation/boundary');
const armList = (flag('arms', DEFAULT_ARMS.join(',')) || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

const factEq = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => String(x) === String(b[i]));

function auditArm(arm) {
  const dir = path.join(loopDir, arm);
  const resultPath = path.join(dir, 'result.json');
  const diagnosisPath = path.join(dir, 'diagnosis.json');
  if (!existsSync(resultPath) || !existsSync(diagnosisPath)) {
    return { arm, missing: true, reason: `missing result or diagnosis in ${dir}` };
  }
  const result = readJson(resultPath);
  const diagnosis = readJson(diagnosisPath);
  const world = loadWorld(diagnosis.worldPath || `config/drama-derivation/${diagnosis.worldId}.yaml`);
  const secretFact = world.secret.fact;
  const secretPredicate = secretFact.join(' ');

  const transcript = Array.isArray(result.transcript) ? result.transcript : [];
  const tutorLines = transcript.filter((t) => t.role === 'tutor');
  const learnerLines = transcript.filter((t) => t.role === 'learner');
  const guardArm = Array.isArray(result.proofDebt) && result.proofDebt.length > 0;

  // 1. No proof-distance arithmetic in any tutor line.
  const arithHits = tutorLines.filter((t) => ARITH_RE.test(t.text || ''));

  // 2. The formal secret predicate is never voiced by the tutor (the tutor
  //    speaks prose and stages the recognition; the learner asserts the form).
  const formalSecretHits = tutorLines.filter((t) => (t.text || '').includes(secretPredicate));

  // 3. The secret is grounded on a LEARNER assertion (the derivation is the
  //    learner's, not handed over).
  const groundingLine = learnerLines.find((t) => {
    const asserts = (t.meta && (t.meta.assert || t.meta.derive || t.meta.claim)) || [];
    return Array.isArray(asserts) && asserts.some((a) => factEq(a, secretFact));
  });

  // 4. (guard arms) The tutor's per-turn self-audit (its own output, written to
  //    meta.proofDebt) carries no arithmetic key — corroborating it never
  //    received the arithmetic on input.
  const selfAuditLeaks = guardArm
    ? tutorLines
        .filter((t) => t.meta && t.meta.proofDebt)
        .filter((t) => ARITH_KEYS.some((k) => k in t.meta.proofDebt))
        .map((t) => t.turn)
    : [];

  // Positive control: the harness ledger DOES carry the arithmetic the tutor
  // never sees — the two paths are distinct, not the same object reused.
  const ledgerCarriesArithmetic = guardArm
    ? result.proofDebt.some((row) => (row.debts || []).some((d) => ARITH_KEYS.some((k) => k in d)))
    : null;

  const checks = {
    tutor_arithmetic_silence: arithHits.length === 0,
    tutor_no_formal_secret: formalSecretHits.length === 0,
    secret_grounded_by_learner: Boolean(groundingLine),
    ...(guardArm ? { proofdebt_view_narrow: selfAuditLeaks.length === 0 } : {}),
  };
  const pass = Object.values(checks).every(Boolean);

  return {
    arm,
    verdict: result.verdict,
    turnsPlayed: result.turnsPlayed,
    guardArm,
    pass,
    checks,
    evidence: {
      arithHitTurns: arithHits.map((t) => t.turn),
      formalSecretHitTurns: formalSecretHits.map((t) => t.turn),
      groundingTurn: groundingLine ? groundingLine.turn : null,
      selfAuditLeakTurns: selfAuditLeaks,
      ledgerCarriesArithmetic,
    },
  };
}

function renderMarkdown(rows) {
  const lines = [];
  lines.push('# Non-leak boundary audit (derivation arms)');
  lines.push('');
  lines.push(
    'Dry reader over committed artifacts. Verifies the DYNAMIC half of the acts-mode non-leak boundary: the tutor never received proof-distance arithmetic and never voiced the secret; the learner did the grounding. The STATIC half (view-stripping in proofDebt.js / engine.js / llmRoles.js) is a code property, not recoverable from an artifact — see the file header.',
  );
  lines.push('');
  lines.push(
    '| arm | verdict | guard | result | grounded by | tutor arith | tutor secret | self-audit | ledger ctrl |',
  );
  lines.push('|---|---|:--:|:--:|---|:--:|:--:|:--:|:--:|');
  for (const r of rows) {
    if (r.missing) {
      lines.push(`| \`${r.arm}\` | missing | — | — | — | — | — | — | — | `);
      continue;
    }
    const yn = (b) => (b ? 'ok' : '**LEAK**');
    const grounded = r.evidence.groundingTurn ? `learner t${r.evidence.groundingTurn}` : '**none**';
    const selfAudit = r.guardArm ? yn(r.checks.proofdebt_view_narrow) : 'n/a';
    const ledger =
      r.evidence.ledgerCarriesArithmetic === null ? 'n/a' : r.evidence.ledgerCarriesArithmetic ? 'present' : 'absent';
    lines.push(
      `| \`${r.arm}\` | ${r.verdict} t${r.turnsPlayed} | ${r.guardArm ? 'yes' : 'no'} | ${r.pass ? 'PASS' : '**FAIL**'} | ${grounded} | ${yn(r.checks.tutor_arithmetic_silence)} | ${yn(r.checks.tutor_no_formal_secret)} | ${selfAudit} | ${ledger} |`,
    );
  }
  lines.push('');
  lines.push('## What each column proves');
  lines.push('');
  lines.push(
    '- **tutor arith** — no proof-distance arithmetic (`dNow`/`deltaD`/`closesProof`/"derivation distance") in any tutor line.',
  );
  lines.push(
    '- **tutor secret** — the formal secret predicate is never spoken by the tutor (it stages the recognition; the learner asserts the form).',
  );
  lines.push(
    "- **grounded by** — the turn the secret fact enters a *learner* assertion (the derivation is the learner's).",
  );
  lines.push(
    "- **self-audit** — on guard arms, the tutor's own per-turn proof-debt self-report carries no arithmetic key (corroborates it never received the arithmetic).",
  );
  lines.push(
    '- **ledger ctrl** — positive control: the harness audit ledger (`result.proofDebt`) DOES carry the arithmetic the tutor never sees, confirming the two paths are distinct.',
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}

const rows = armList.map(auditArm);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'leak-audit-report.json'), `${JSON.stringify({ arms: rows }, null, 2)}\n`);
writeFileSync(path.join(outDir, 'leak-audit-report.md'), renderMarkdown(rows));

console.log(`leak audit written: ${path.join(outDir, 'leak-audit-report.md')}`);
let anyFail = false;
for (const r of rows) {
  if (r.missing) {
    console.log(`MISS  ${r.arm} — ${r.reason}`);
    continue;
  }
  if (!r.pass) anyFail = true;
  const tag = r.pass ? 'PASS' : 'FAIL';
  console.log(
    `${tag}  ${r.arm} · ${r.verdict}@t${r.turnsPlayed} · grounded ${
      r.evidence.groundingTurn ? `learner t${r.evidence.groundingTurn}` : 'NONE'
    }${r.guardArm ? ` · guard self-audit ${r.checks.proofdebt_view_narrow ? 'clean' : 'LEAK'}` : ''}`,
  );
}
process.exitCode = anyFail ? 1 : 0;

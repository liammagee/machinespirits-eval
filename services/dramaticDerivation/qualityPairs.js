import { deriveObjectOwnershipState } from './objectOwnership.js';
import { deriveUptakeNegotiationState } from './uptakeNegotiation.js';
import { auditPublicOnlyInput, cleanPublicText } from './publicEvidence.js';

export const QUALITY_PAIR_SCHEMA = 'dramatic-derivation.quality-pair.v0';
export const QUALITY_PAIR_REPORT_SCHEMA = 'dramatic-derivation.quality-pair-report.v0';

function learner(turn, text) {
  return { role: 'learner', turn, text };
}

function tutor(turn, text) {
  return { role: 'tutor', turn, text };
}

function transcriptText(transcript = [], role = null) {
  return (Array.isArray(transcript) ? transcript : [])
    .filter((line) => !role || line.role === role)
    .map((line) => cleanPublicText(line.text, 800))
    .filter(Boolean)
    .join('\n');
}

function proofRun({ transcript, releaseTurns = [4], finalD = 0, assertionStatus = 'grounded' }) {
  return {
    worldId: 'quality-pair-world',
    learnerModel: 'mock-learner-v0',
    proofActionSequence: ['release_next_evidence', 'repair_dependency', 'invite_final_assertion'],
    releaseTurns,
    finalD,
    assertionStatus,
    transcript,
  };
}

export const QUALITY_PAIR_CASES = Object.freeze([
  {
    id: 'minimal-presence-preserves-learner-reasoning',
    expectedDecision: 's1_quality_win',
    objectSurface: 'The bond line and cause line must stay separate.',
    scaffoldOffered: 'minimal_presence',
    s0: proofRun({
      transcript: [
        tutor(5, 'Let me explain the whole distinction again before you try. The bond line is legal liability...'),
        learner(5, 'Okay, got it.'),
      ],
    }),
    s1: proofRun({
      transcript: [
        tutor(5, 'Keep going with that line.'),
        learner(
          5,
          'I would say the bond line answers who pays, so the cause line still has to answer what brought the arch down.',
        ),
      ],
    }),
  },
  {
    id: 'purpose-bridge-produces-accepted-uptake',
    expectedDecision: 's1_quality_win',
    objectSurface: 'The crowsfoot mark ties the beam to the north yard.',
    scaffoldOffered: 'purpose_bridge',
    s0: proofRun({
      transcript: [
        tutor(4, 'The crowsfoot mark ties the beam to the north yard.'),
        learner(4, 'As you said, crowsfoot mark and north yard.'),
      ],
    }),
    s1: proofRun({
      transcript: [
        tutor(4, 'Use that mark only for what it proves.'),
        learner(4, 'The mark matters because it proves source first, so the cause line has somewhere to start.'),
      ],
    }),
  },
  {
    id: 'warmer-prose-without-use-is-not-a-quality-win',
    expectedDecision: 'no_qualifying_gain',
    objectSurface: 'The ash line dates the fire after the crossing.',
    scaffoldOffered: 'recognition_repair',
    s0: proofRun({
      transcript: [tutor(4, 'The ash line dates the fire after the crossing.'), learner(4, 'Understood.')],
    }),
    s1: proofRun({
      transcript: [
        tutor(4, 'I hear you; this is a tricky part, and you are doing fine.'),
        learner(4, 'Thanks. I feel better about it.'),
      ],
    }),
  },
  {
    id: 'proof-mismatch-disqualifies-quality-claim',
    expectedDecision: 'not_proof_matched',
    objectSurface: 'The blue wax puts the letter before dawn.',
    scaffoldOffered: 'contrast_case',
    s0: proofRun({
      releaseTurns: [4],
      transcript: [tutor(4, 'The blue wax puts the letter before dawn.'), learner(4, 'I see.')],
    }),
    s1: proofRun({
      releaseTurns: [5],
      transcript: [
        tutor(5, 'The blue wax puts the letter before dawn.'),
        learner(5, 'The wax matters because it fixes time before dawn.'),
      ],
    }),
  },
]);

function arrayEqual(a = [], b = []) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function proofMatched(pair) {
  const s0 = pair.s0;
  const s1 = pair.s1;
  const reasons = [];
  if (s0.worldId !== s1.worldId) reasons.push('world');
  if (s0.learnerModel !== s1.learnerModel) reasons.push('learner_model');
  if (!arrayEqual(s0.proofActionSequence, s1.proofActionSequence)) reasons.push('proof_action_sequence');
  if (!arrayEqual(s0.releaseTurns, s1.releaseTurns)) reasons.push('release_timing');
  if (s0.finalD !== s1.finalD) reasons.push('finalD');
  if (s0.assertionStatus !== s1.assertionStatus) reasons.push('assertion_status');
  return { ok: reasons.length === 0, reasons };
}

function hiddenLeakAudit(run) {
  const keyAudit = auditPublicOnlyInput({ transcript: run.transcript });
  const text = transcriptText(run.transcript);
  const textLeaks = /\b(secret|hidden proof|proof path|raw board|d=|final d|corruption ledger)\b/iu.test(text)
    ? ['hidden-proof-language']
    : [];
  return { ok: keyAudit.ok && textLeaks.length === 0, keyAudit, textLeaks };
}

function levelScore(level) {
  return { absent: 0, echo_only: 0.05, emerging: 0.45, durable: 0.85, unknown: 0 }[level] || 0;
}

function countPatterns(text, patterns = []) {
  const lowered = text.toLowerCase();
  return patterns.reduce((count, pattern) => count + (pattern.test(lowered) ? 1 : 0), 0);
}

function scoreRun(run, pair) {
  const learnerText = transcriptText(run.transcript, 'learner');
  const tutorText = transcriptText(run.transcript, 'tutor');
  const ownership = deriveObjectOwnershipState({
    currentObject: pair.objectSurface,
    objectKeywords: pair.objectSurface.split(/\s+/u).filter((token) => token.length > 3),
    transcript: run.transcript,
  });
  const uptake = deriveUptakeNegotiationState({
    scaffoldOffered: pair.scaffoldOffered,
    learnerResponse: learnerText,
  });
  const dialogueQuality = Math.min(
    1,
    0.15 +
      countPatterns(learnerText, [/\bbecause\b/u, /\bso\b/u, /\bmatters\b/u, /\bnot .* but\b/u]) * 0.12 +
      countPatterns(tutorText, [/\bkeep going\b/u, /\buse that\b/u, /\bwhat it proves\b/u]) * 0.08,
  );
  const didacticClarity = countPatterns(learnerText, [/\bbecause\b/u, /\bproves\b/u, /\bsource\b/u, /\bcause\b/u]) / 4;
  const uptakeScore =
    uptake.status === 'accepted_scaffold' ? 0.75 : uptake.status === 'complied_verbally_only' ? 0.15 : 0;
  const minimalPresence =
    pair.scaffoldOffered === 'minimal_presence'
      ? tutorText.length <= 80 && /\b(i would say|so|because)\b/iu.test(learnerText)
        ? 0.8
        : 0
      : 0.35;
  const dramaticForm = countPatterns(learnerText, [/\bline\b/u, /\broute\b/u, /\bfirst\b/u, /\bsecond\b/u]) * 0.1;
  const score =
    levelScore(ownership.ownershipLevel) +
    dialogueQuality +
    didacticClarity +
    uptakeScore +
    minimalPresence +
    Math.min(0.4, dramaticForm);
  return {
    score: +score.toFixed(3),
    dialogueQuality: +dialogueQuality.toFixed(3),
    ownershipLevel: ownership.ownershipLevel,
    ownershipScore: +levelScore(ownership.ownershipLevel).toFixed(3),
    uptakeStatus: uptake.status,
    uptakeScore,
    didacticClarity: +didacticClarity.toFixed(3),
    minimalPresence: +minimalPresence.toFixed(3),
    dramaticForm: +Math.min(0.4, dramaticForm).toFixed(3),
  };
}

export function evaluateQualityPair(pair) {
  const proof = proofMatched(pair);
  const leak0 = hiddenLeakAudit(pair.s0);
  const leak1 = hiddenLeakAudit(pair.s1);
  if (!proof.ok || !leak0.ok || !leak1.ok) {
    const decision = !proof.ok ? 'not_proof_matched' : 'hidden_leak_disqualified';
    return {
      schema: QUALITY_PAIR_SCHEMA,
      id: pair.id,
      expectedDecision: pair.expectedDecision,
      decision,
      passed: decision === pair.expectedDecision,
      proofMatched: proof.ok,
      proofMismatchReasons: proof.reasons,
      nonLeakAudit: { s0: leak0, s1: leak1 },
    };
  }
  const s0 = scoreRun(pair.s0, pair);
  const s1 = scoreRun(pair.s1, pair);
  const delta = +(s1.score - s0.score).toFixed(3);
  const decision = delta >= 0.4 ? 's1_quality_win' : 'no_qualifying_gain';
  return {
    schema: QUALITY_PAIR_SCHEMA,
    id: pair.id,
    expectedDecision: pair.expectedDecision,
    decision,
    passed: decision === pair.expectedDecision,
    proofMatched: true,
    proofMismatchReasons: [],
    nonLeakAudit: { s0: leak0, s1: leak1 },
    s0,
    s1,
    delta,
  };
}

export function evaluateQualityPairs(cases = QUALITY_PAIR_CASES) {
  const rows = cases.map(evaluateQualityPair);
  const summary = {
    schema: QUALITY_PAIR_REPORT_SCHEMA,
    count: rows.length,
    pass: rows.filter((row) => row.passed).length,
    fail: rows.filter((row) => !row.passed).length,
  };
  summary.allPassed = summary.fail === 0;
  return { schema: QUALITY_PAIR_REPORT_SCHEMA, summary, rows };
}

export function renderQualityPairMarkdown(report) {
  const lines = [
    '# Derivation Proof-Matched Quality Pair Report',
    '',
    `Schema: \`${report.schema}\``,
    `Pairs: ${report.summary.count}`,
    `Passed: ${report.summary.pass}`,
    `Failed: ${report.summary.fail}`,
    `Decision: ${report.summary.allPassed ? 'pass' : 'fail'}`,
    '',
    '| Pair | Expected | Decision | Delta | Proof matched | Pass |',
    '|---|---|---|---:|---|---|',
  ];
  for (const row of report.rows) {
    lines.push(
      `| ${row.id} | ${row.expectedDecision} | ${row.decision} | ${row.delta ?? ''} | ${
        row.proofMatched ? 'yes' : 'no'
      } | ${row.passed ? 'yes' : 'no'} |`,
    );
  }
  lines.push(
    '',
    'Mandatory boundary: this is transcript-quality evidence, not proof-control adaptation and not human-learning evidence.',
  );
  return `${lines.join('\n')}\n`;
}

import { deriveObjectOwnershipState, summarizeOwnershipStates } from './objectOwnership.js';

export const OWNERSHIP_BENCHMARK_SCHEMA = 'dramatic-derivation.ownership-benchmark.v0';

const DEFAULT_VERDICT = 'grounded';
const DEFAULT_FINAL_D = 0;
const DEFAULT_PREMISE_ID = 'p_object';
const DEFAULT_OBJECT_SURFACE = 'The crown joint fixes the bridge failure point.';

function learner(turn, text) {
  return { role: 'learner', turn, text };
}

function tutor(turn, text) {
  return { role: 'tutor', turn, text };
}

function runFixture({
  verdict = DEFAULT_VERDICT,
  finalD = DEFAULT_FINAL_D,
  releaseTurn = 4,
  premiseId = DEFAULT_PREMISE_ID,
  transcript = [],
} = {}) {
  return {
    verdict,
    trajectory: [
      { turn: 1, D: 4 },
      { turn: 2, D: 3 },
      { turn: 3, D: 2 },
      { turn: 4, D: finalD },
    ],
    ledger: [{ premiseId, turn: releaseTurn }],
    transcript,
  };
}

function pair({
  id,
  controlType,
  objectSurface = DEFAULT_OBJECT_SURFACE,
  premiseId = DEFAULT_PREMISE_ID,
  expectedDecision,
  s0,
  s1,
}) {
  return {
    id,
    controlType,
    premise: { id: premiseId, surface: objectSurface },
    expectedDecision,
    s0,
    s1,
  };
}

export const OWNERSHIP_BENCHMARK_CASES = Object.freeze([
  pair({
    id: 'positive-own-words-use',
    controlType: 'positive',
    expectedDecision: 'eligible_for_replay_gate',
    s0: runFixture({
      transcript: [
        tutor(4, 'The crown joint fixes the bridge failure point. Keep that object public.'),
        learner(4, 'As you said, the crown joint is the phrase to keep.'),
      ],
    }),
    s1: runFixture({
      transcript: [
        tutor(4, 'The crown joint fixes the bridge failure point. Keep that object public.'),
        learner(
          4,
          'I would say the crown joint fixes where the bridge failed, so the cause has to answer for that point.',
        ),
      ],
    }),
  }),
  pair({
    id: 'positive-purpose-link',
    controlType: 'positive',
    objectSurface: 'The crowsfoot mark ties the beam to the north yard.',
    expectedDecision: 'eligible_for_replay_gate',
    s0: runFixture({
      transcript: [
        tutor(4, 'The crowsfoot mark ties the beam to the north yard.'),
        learner(4, 'I can repeat that: crowsfoot mark, north yard.'),
      ],
    }),
    s1: runFixture({
      transcript: [
        tutor(4, 'The crowsfoot mark ties the beam to the north yard.'),
        learner(4, 'I read the crowsfoot mark as the yard trace, because it proves where the beam came from.'),
      ],
    }),
  }),
  pair({
    id: 'positive-contrast-case',
    controlType: 'positive',
    objectSurface: 'The sealed pass names the witness, not the porter.',
    expectedDecision: 'eligible_for_replay_gate',
    s0: runFixture({
      transcript: [
        tutor(4, 'The sealed pass names the witness, not the porter.'),
        learner(4, 'You said the sealed pass names the witness.'),
      ],
    }),
    s1: runFixture({
      transcript: [
        tutor(4, 'The sealed pass names the witness, not the porter.'),
        learner(4, 'I would say the sealed pass is not about the porter but the witness, so the signed name matters.'),
      ],
    }),
  }),
  pair({
    id: 'positive-recovery-transfer',
    controlType: 'positive',
    objectSurface: 'The red notch marks the earlier repair.',
    expectedDecision: 'eligible_for_replay_gate',
    s0: runFixture({
      transcript: [
        tutor(4, 'The red notch marks the earlier repair.'),
        learner(4, 'As you said, red notch, earlier repair.'),
        learner(6, 'I am not sure where that leaves us.'),
      ],
    }),
    s1: runFixture({
      transcript: [
        tutor(4, 'The red notch marks the earlier repair.'),
        learner(4, 'I take it the red notch is the repair trace, so it lets me place the old work first.'),
        learner(6, 'Back to the red notch: like the crown joint, the same pattern turns a mark into a step.'),
      ],
    }),
  }),
  pair({
    id: 'negative-warmer-echo',
    controlType: 'negative',
    objectSurface: 'The lintel crack fixes the first break.',
    expectedDecision: 'matched_reliability_no_ownership_gain',
    s0: runFixture({
      transcript: [
        tutor(4, 'The lintel crack fixes the first break.'),
        learner(4, 'As you said, the lintel crack fixes the first break.'),
      ],
    }),
    s1: runFixture({
      transcript: [
        tutor(4, 'The lintel crack fixes the first break.'),
        learner(4, 'Yes, that helps. As you said, the lintel crack fixes the first break.'),
      ],
    }),
  }),
  pair({
    id: 'negative-phatic-only',
    controlType: 'negative',
    objectSurface: 'The blue wax puts the letter before dawn.',
    expectedDecision: 'matched_reliability_no_ownership_gain',
    s0: runFixture({
      transcript: [tutor(4, 'The blue wax puts the letter before dawn.'), learner(4, 'I see.')],
    }),
    s1: runFixture({
      transcript: [
        tutor(4, 'The blue wax puts the letter before dawn.'),
        learner(4, 'Yes. I am with you for the moment. Please go on.'),
      ],
    }),
  }),
  pair({
    id: 'negative-fluent-paraphrase-no-use',
    controlType: 'negative',
    objectSurface: 'The broken hinge identifies the east gate.',
    expectedDecision: 'matched_reliability_no_ownership_gain',
    s0: runFixture({
      transcript: [
        tutor(4, 'The broken hinge identifies the east gate.'),
        learner(4, 'The broken hinge is about the east gate.'),
      ],
    }),
    s1: runFixture({
      transcript: [
        tutor(4, 'The broken hinge identifies the east gate.'),
        learner(4, 'The broken hinge and the east gate belong together in the account.'),
      ],
    }),
  }),
  pair({
    id: 'negative-dramatic-texture',
    controlType: 'negative',
    objectSurface: 'The ash line dates the fire after the crossing.',
    expectedDecision: 'matched_reliability_no_ownership_gain',
    s0: runFixture({
      transcript: [tutor(4, 'The ash line dates the fire after the crossing.'), learner(4, 'Understood.')],
    }),
    s1: runFixture({
      transcript: [
        tutor(4, 'The ash line dates the fire after the crossing.'),
        learner(4, 'I pause there. That sounds weighty, but I do not yet know what to do with it.'),
      ],
    }),
  }),
  pair({
    id: 'disqualify-release-shift',
    controlType: 'disqualification',
    objectSurface: 'The bell rope proves the tower was reachable.',
    expectedDecision: 'not_matched_reliability',
    s0: runFixture({
      releaseTurn: 4,
      transcript: [
        tutor(4, 'The bell rope proves the tower was reachable.'),
        learner(4, 'As you said, the bell rope proves reachability.'),
      ],
    }),
    s1: runFixture({
      releaseTurn: 5,
      transcript: [
        tutor(5, 'The bell rope proves the tower was reachable.'),
        learner(
          5,
          'I would say the bell rope matters because it proves the tower was reachable, so the route is open.',
        ),
      ],
    }),
  }),
  pair({
    id: 'disqualify-final-d-regression',
    controlType: 'disqualification',
    objectSurface: 'The south tally fixes the missing cart.',
    expectedDecision: 'not_matched_reliability',
    s0: runFixture({
      finalD: 0,
      transcript: [
        tutor(4, 'The south tally fixes the missing cart.'),
        learner(4, 'As you said, the south tally fixes the cart.'),
      ],
    }),
    s1: runFixture({
      finalD: 2,
      transcript: [
        tutor(4, 'The south tally fixes the missing cart.'),
        learner(4, 'I read the south tally as the cart trace, because it proves which cart is missing.'),
      ],
    }),
  }),
  pair({
    id: 'disqualify-verdict-regression',
    controlType: 'disqualification',
    objectSurface: 'The torn receipt connects the buyer to the stall.',
    expectedDecision: 'not_matched_reliability',
    s0: runFixture({
      verdict: 'grounded',
      transcript: [
        tutor(4, 'The torn receipt connects the buyer to the stall.'),
        learner(4, 'As you said, torn receipt and stall.'),
      ],
    }),
    s1: runFixture({
      verdict: 'aporia',
      transcript: [
        tutor(4, 'The torn receipt connects the buyer to the stall.'),
        learner(4, 'I would say the torn receipt matters because it proves the buyer reached the stall.'),
      ],
    }),
  }),
  pair({
    id: 'disqualify-added-release',
    controlType: 'disqualification',
    objectSurface: 'The glass token identifies the third clerk.',
    expectedDecision: 'not_matched_reliability',
    s0: runFixture({
      transcript: [
        tutor(4, 'The glass token identifies the third clerk.'),
        learner(4, 'As you said, glass token, third clerk.'),
      ],
    }),
    s1: {
      ...runFixture({
        transcript: [
          tutor(4, 'The glass token identifies the third clerk.'),
          learner(4, 'I take it the glass token identifies the third clerk, so that clerk becomes the next witness.'),
        ],
      }),
      ledger: [
        { premiseId: DEFAULT_PREMISE_ID, turn: 4 },
        { premiseId: 'p_extra', turn: 5 },
      ],
    },
  }),
]);

function cleanText(text, limit = 220) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function finalD(run) {
  const last = Array.isArray(run?.trajectory) ? run.trajectory[run.trajectory.length - 1] : null;
  return Number.isFinite(last?.D) ? last.D : null;
}

function releaseSignature(run) {
  return (Array.isArray(run?.ledger) ? run.ledger : []).map((entry) => `${entry.premiseId}@t${entry.turn}`).join('|');
}

function publicTranscriptLines(run) {
  return (Array.isArray(run?.transcript) ? run.transcript : [])
    .filter((line) => ['tutor', 'learner', 'stage', 'director'].includes(line?.role))
    .map((line) => ({
      turn: line.turn,
      role: line.role === 'director' ? 'stage' : line.role,
      text: cleanText(line.text, 600),
    }))
    .filter((line) => line.text);
}

function objectWindow(lines, releaseTurn, nextReleaseTurn = null) {
  const end = Number.isFinite(nextReleaseTurn) ? nextReleaseTurn : releaseTurn + 6;
  return lines.filter((line) => line.role === 'learner' && line.turn >= releaseTurn && line.turn <= end);
}

function scoreRun(run, premise) {
  const lines = publicTranscriptLines(run);
  const ledger = (Array.isArray(run?.ledger) ? run.ledger : []).filter((entry) => entry.premiseId === premise.id);
  const ownership = ledger.map((entry, index) => {
    const nextReleaseTurn = ledger[index + 1]?.turn || null;
    const transcript = objectWindow(lines, entry.turn, nextReleaseTurn);
    const state = deriveObjectOwnershipState({
      currentObject: `${premise.id}: ${premise.surface}`,
      objectSurface: premise.surface,
      transcript,
      recoveryProbe: transcript.some((line) => line.turn > entry.turn + 1),
    });
    return {
      premiseId: premise.id,
      releaseTurn: entry.turn,
      learnerTurns: transcript.map((line) => line.turn),
      ownershipLevel: state.ownershipLevel,
      score: state.score,
      maxScore: state.maxScore,
      gaps: state.gaps,
      echoOnly: state.echoOnly,
      auditClean: state.inputAudit?.ok === true && state.nonLeakAudit?.ok === true,
      evidence: state.evidence,
      probes: state.probes,
    };
  });
  return {
    verdict: run.verdict,
    finalD: finalD(run),
    releaseSignature: releaseSignature(run),
    ownership,
    ownershipSummary: summarizeOwnershipStates(ownership),
  };
}

function compareCase(testCase) {
  const s0 = scoreRun(testCase.s0, testCase.premise);
  const s1 = scoreRun(testCase.s1, testCase.premise);
  const reliabilityMatched =
    s0.verdict === s1.verdict && s0.finalD === s1.finalD && s0.releaseSignature === s1.releaseSignature;
  const meanOwnershipDelta = s1.ownershipSummary.meanScore - s0.ownershipSummary.meanScore;
  const decision = !reliabilityMatched
    ? 'not_matched_reliability'
    : meanOwnershipDelta >= 0.5
      ? 'eligible_for_replay_gate'
      : 'matched_reliability_no_ownership_gain';
  return {
    id: testCase.id,
    controlType: testCase.controlType,
    expectedDecision: testCase.expectedDecision,
    decision,
    pass: decision === testCase.expectedDecision,
    comparison: {
      reliabilityMatched,
      sameVerdict: s0.verdict === s1.verdict,
      sameFinalD: s0.finalD === s1.finalD,
      sameReleaseSignature: s0.releaseSignature === s1.releaseSignature,
      meanOwnershipDelta,
    },
    s0,
    s1,
  };
}

export function evaluateOwnershipBenchmark(cases = OWNERSHIP_BENCHMARK_CASES) {
  const rows = cases.map(compareCase);
  const byControlType = {};
  for (const row of rows) {
    const bucket = byControlType[row.controlType] || { count: 0, pass: 0, fail: 0 };
    bucket.count += 1;
    if (row.pass) bucket.pass += 1;
    else bucket.fail += 1;
    byControlType[row.controlType] = bucket;
  }
  return {
    schema: OWNERSHIP_BENCHMARK_SCHEMA,
    generatedAt: new Date().toISOString(),
    cases: rows,
    summary: {
      count: rows.length,
      pass: rows.filter((row) => row.pass).length,
      fail: rows.filter((row) => !row.pass).length,
      byControlType,
      allPassed: rows.every((row) => row.pass),
    },
  };
}

function formatDelta(row) {
  return row.comparison.meanOwnershipDelta.toFixed(2);
}

function renderRow(row) {
  return `| ${row.id} | ${row.controlType} | ${row.expectedDecision} | ${row.decision} | ${row.comparison.reliabilityMatched ? 'yes' : 'no'} | ${formatDelta(row)} | ${row.pass ? 'pass' : 'fail'} |`;
}

export function renderOwnershipBenchmarkMarkdown(report) {
  const lines = [
    '# Ownership Benchmark Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Boundary',
    '',
    '- Zero-paid synthetic controls only.',
    '- Positive and negative controls keep proof status, final D, and release signature fixed.',
    '- Disqualification controls deliberately move proof/release state and must be rejected.',
    '- This validates the evaluator before it is used to mine new artifacts; it does not promote any runtime policy.',
    '',
    '## Summary',
    '',
    `- Cases: ${report.summary.count}`,
    `- Passed: ${report.summary.pass}`,
    `- Failed: ${report.summary.fail}`,
    `- All passed: ${report.summary.allPassed ? 'yes' : 'no'}`,
    '',
    '| Case | Control | Expected | Actual | Reliability matched | Ownership delta | Result |',
    '|---|---|---|---|---|---:|---|',
    ...report.cases.map(renderRow),
    '',
    '## Interpretation',
    '',
  ];
  if (report.summary.allPassed) {
    lines.push(
      'The ownership evaluator passes the declared proof-matched benchmark controls. It can distinguish direct ownership gains from prose-only changes and reject confounded proof/release changes.',
    );
  } else {
    lines.push(
      'The ownership evaluator does not yet pass the declared controls. Do not use it to justify mined-artifact claims or paid validation until these failures are resolved.',
    );
  }
  return `${lines.join('\n')}\n`;
}

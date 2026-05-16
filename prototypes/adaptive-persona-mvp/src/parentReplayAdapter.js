import { initializeMastery, updateMasteryForEvidence } from './knowledgeTracing.js';
import { extractEvidence, selectPolicy, transitionRelationState } from './stateMachine.js';
import {
  initialChallengeState,
  updateChallengeState,
} from './challengeState.js';

const DEFAULT_PARENT_KC = 'parent_adaptive_trap';

const PARENT_TO_PROTOTYPE_ACCEPTABLE = Object.freeze({
  ask_diagnostic_question: ['diagnostic_probe', 'teach_back', 'contrastive_probe'],
  mirror_and_extend: ['minimal_hint', 'contrastive_probe', 'transfer_challenge'],
  scope_test: ['contrastive_probe', 'minimal_hint', 'transfer_challenge'],
  repair_misrecognition: ['repair_misrecognition'],
  give_worked_example: ['faded_example'],
  lower_cognitive_load: ['affective_repair', 'minimal_hint', 'faded_example'],
  provide_hint: ['minimal_hint', 'faded_example'],
  request_elaboration: ['diagnostic_probe', 'teach_back', 'contrastive_probe'],
  acknowledge_and_redirect: ['affective_repair', 'minimal_hint'],
  name_the_disagreement: ['contrastive_probe', 'minimal_hint'],
  withhold_answer: ['productive_struggle_hold', 'diagnostic_probe', 'teach_back'],
  summarize_and_check: ['summarize_and_check', 'productive_struggle_hold'],
  pose_counterexample: ['contrastive_probe', 'minimal_hint'],
  invite_objection: ['diagnostic_probe', 'contrastive_probe'],
});

const PARENT_POLICY_FAMILY = Object.freeze({
  ask_diagnostic_question: 'diagnostic',
  request_elaboration: 'diagnostic',
  invite_objection: 'diagnostic',
  mirror_and_extend: 'substantive',
  scope_test: 'substantive',
  name_the_disagreement: 'substantive',
  pose_counterexample: 'substantive',
  repair_misrecognition: 'repair',
  acknowledge_and_redirect: 'repair',
  lower_cognitive_load: 'scaffold',
  provide_hint: 'scaffold',
  give_worked_example: 'scaffold',
  withhold_answer: 'productive_struggle',
  summarize_and_check: 'consolidate',
});

const PROTOTYPE_POLICY_FAMILY = Object.freeze({
  diagnostic_probe: 'diagnostic',
  teach_back: 'diagnostic',
  contrastive_probe: 'substantive',
  minimal_hint: 'scaffold',
  faded_example: 'scaffold',
  repair_misrecognition: 'repair',
  affective_repair: 'repair',
  misconception_repair: 'repair',
  transfer_challenge: 'transfer',
  summarize_and_check: 'consolidate',
  productive_struggle_hold: 'productive_struggle',
});

export function replayParentTrace({
  trace,
  row = {},
  source = '',
} = {}) {
  if (!trace || typeof trace !== 'object') {
    throw new Error('replayParentTrace requires a parsed parent dialogue trace.');
  }
  const scenario = buildReplayScenario({ trace, row });
  const original = replayBranch({
    branchName: 'original',
    branch: trace.original || trace,
    scenario,
    parentScenario: trace.scenario || {},
  });
  const counterfactual = trace.counterfactual
    ? replayBranch({
        branchName: 'counterfactual',
        branch: trace.counterfactual,
        scenario,
        parentScenario: trace.scenario || {},
      })
    : null;

  return {
    source,
    row: compactRow(row),
    profileName: trace.profileName || row.profileName || row.profile_name || null,
    llmMode: trace.llmMode || null,
    scenario,
    parentExpectedStrategyShift: trace.scenario?.expectedStrategyShift ?? null,
    original,
    counterfactual,
    summary: summarizeReplay({ original, counterfactual }),
  };
}

export function buildParentReplayReport({
  replays,
  inputDescription = '',
} = {}) {
  const rows = replays || [];
  const branchSummaries = rows.flatMap((replay) => [
    replay.original,
    replay.counterfactual,
  ].filter(Boolean).map((branch) => ({
    replay,
    branch,
  })));
  const triggerRows = branchSummaries
    .map(({ branch }) => branch.triggerAlignment)
    .filter(Boolean);
  const familyAgreementRows = branchSummaries
    .flatMap(({ branch }) => branch.stateTrace)
    .filter((turn) => turn.parentPolicyAction);
  const challengeTurns = branchSummaries
    .flatMap(({ branch }) => branch.stateTrace)
    .filter((turn) => turn.challengeState?.level && turn.challengeState.level !== 'none');

  return {
    generatedAt: new Date().toISOString(),
    inputDescription,
    replayCount: rows.length,
    branchCount: branchSummaries.length,
    triggerAlignment: {
      count: triggerRows.length,
      parentExactRate: rate(triggerRows, (row) => row.parentExactMatch),
      prototypeAcceptableRate: rate(triggerRows, (row) => row.prototypeAcceptableMatch),
      bothAlignedRate: rate(triggerRows, (row) => row.parentExactMatch && row.prototypeAcceptableMatch),
    },
    familyAgreement: {
      count: familyAgreementRows.length,
      rate: rate(familyAgreementRows, (row) => row.policyFamilyAgreement),
    },
    challengeState: {
      challengeTurnCount: challengeTurns.length,
      activeOrEscalatedRate: branchSummaries.length === 0
        ? 0
        : Number((challengeTurns.length / branchSummaries.reduce((sum, { branch }) => sum + branch.stateTrace.length, 0)).toFixed(3)),
      escalatedBranches: branchSummaries.filter(({ branch }) =>
        branch.stateTrace.some((turn) => turn.challengeState?.level === 'escalated')).length,
      resolvedBranches: branchSummaries.filter(({ branch }) =>
        branch.stateTrace.some((turn) => turn.challengeState?.level === 'resolved')).length,
    },
    replays: rows,
  };
}

export function renderParentReplayMarkdown(report) {
  const lines = [
    '# Parent Stack Replay Adapter',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Inputs: ${report.inputDescription || 'unspecified'}`,
    '',
    `Replays: ${report.replayCount}; branches: ${report.branchCount}.`,
    '',
    '| Check | Count | Rate |',
    '|---|---:|---:|',
    `| Parent exact trigger match | ${report.triggerAlignment.count} | ${formatRate(report.triggerAlignment.parentExactRate)} |`,
    `| Prototype acceptable trigger match | ${report.triggerAlignment.count} | ${formatRate(report.triggerAlignment.prototypeAcceptableRate)} |`,
    `| Parent/prototype family agreement | ${report.familyAgreement.count} | ${formatRate(report.familyAgreement.rate)} |`,
    `| Challenge turns | ${report.challengeState.challengeTurnCount} | ${formatRate(report.challengeState.activeOrEscalatedRate)} |`,
    '',
    '## Replay Rows',
    '',
    '| Scenario | Branch | Expected | Parent Action | Prototype Policy | Match | Challenge Levels |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const replay of report.replays) {
    for (const branch of [replay.original, replay.counterfactual].filter(Boolean)) {
      const align = branch.triggerAlignment || {};
      lines.push(`| ${escapePipe(replay.scenario.id)} | ${branch.branchName} | ${escapePipe(formatExpected(align.expected))} | ${escapePipe(align.parentPolicyAction || '')} | ${escapePipe(align.prototypePolicy || '')} | ${align.prototypeAcceptableMatch ? 'prototype' : align.parentExactMatch ? 'parent-only' : 'no'} | ${escapePipe(branch.challengeLevels.join(' -> '))} |`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function renderParentReplayHtml(report) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Parent Stack Replay Adapter</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fa; color: #17202a; line-height: 1.45; }
    header { padding: 28px 34px 18px; background: #fff; border-bottom: 1px solid #d9e0e7; }
    main { padding: 24px 34px 44px; max-width: 1500px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 28px 0 12px; font-size: 20px; }
    .meta { color: #5e6b78; display: flex; flex-wrap: wrap; gap: 16px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9e0e7; border-radius: 8px; overflow: hidden; margin-bottom: 22px; }
    th, td { text-align: left; vertical-align: top; border-bottom: 1px solid #d9e0e7; padding: 9px 10px; font-size: 13px; }
    th { background: #eef3f7; font-weight: 650; }
    tr:last-child td { border-bottom: 0; }
    code { background: #eef3f7; padding: 1px 4px; border-radius: 4px; }
    .good { color: #087443; font-weight: 700; }
    .bad { color: #b42318; font-weight: 700; }
    .muted { color: #5e6b78; }
  </style>
</head>
<body>
  <header>
    <h1>Parent Stack Replay Adapter</h1>
    <div class="meta">
      <span>Generated: ${escapeHtml(report.generatedAt)}</span>
      <span>Replays: <code>${report.replayCount}</code></span>
      <span>Branches: <code>${report.branchCount}</code></span>
      <span>Inputs: <code>${escapeHtml(report.inputDescription || 'unspecified')}</code></span>
    </div>
  </header>
  <main>
    <h2>Aggregate Checks</h2>
    <table>
      <thead><tr><th>Check</th><th>Count</th><th>Rate</th></tr></thead>
      <tbody>
        <tr><td>Parent exact trigger match</td><td>${report.triggerAlignment.count}</td><td>${formatRate(report.triggerAlignment.parentExactRate)}</td></tr>
        <tr><td>Prototype acceptable trigger match</td><td>${report.triggerAlignment.count}</td><td>${formatRate(report.triggerAlignment.prototypeAcceptableRate)}</td></tr>
        <tr><td>Both aligned at trigger</td><td>${report.triggerAlignment.count}</td><td>${formatRate(report.triggerAlignment.bothAlignedRate)}</td></tr>
        <tr><td>Parent/prototype family agreement</td><td>${report.familyAgreement.count}</td><td>${formatRate(report.familyAgreement.rate)}</td></tr>
        <tr><td>Challenge turn density</td><td>${report.challengeState.challengeTurnCount}</td><td>${formatRate(report.challengeState.activeOrEscalatedRate)}</td></tr>
      </tbody>
    </table>

    <h2>Branch Replay</h2>
    <table>
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Profile</th>
          <th>Branch</th>
          <th>Expected</th>
          <th>Parent Trigger Action</th>
          <th>Prototype Trigger Policy</th>
          <th>Alignment</th>
          <th>Challenge Levels</th>
        </tr>
      </thead>
      <tbody>
        ${report.replays.flatMap((replay) => [replay.original, replay.counterfactual].filter(Boolean).map((branch) => {
          const align = branch.triggerAlignment || {};
          return `<tr>
            <td><code>${escapeHtml(replay.scenario.id)}</code></td>
            <td><code>${escapeHtml(replay.profileName || '')}</code></td>
            <td>${escapeHtml(branch.branchName)}</td>
            <td>${escapeHtml(formatExpected(align.expected))}</td>
            <td><code>${escapeHtml(align.parentPolicyAction || '')}</code></td>
            <td><code>${escapeHtml(align.prototypePolicy || '')}</code></td>
            <td class="${align.prototypeAcceptableMatch ? 'good' : 'bad'}">${align.prototypeAcceptableMatch ? 'prototype match' : align.parentExactMatch ? 'parent only' : 'no match'}</td>
            <td>${escapeHtml(branch.challengeLevels.join(' -> '))}</td>
          </tr>`;
        })).join('')}
      </tbody>
    </table>
  </main>
</body>
</html>`;
}

function replayBranch({ branchName, branch, scenario, parentScenario }) {
  const dialogue = normalizeDialogue(branch?.dialogue || []);
  const parentTurns = Array.isArray(branch?.perTurn) ? branch.perTurn : [];
  let mastery = initializeMastery(scenario.kcs);
  let challengeState = initialChallengeState(scenario);
  const stateTrace = [];
  let learnerTurnIndex = 0;
  for (let transcriptIndex = 0; transcriptIndex < dialogue.length; transcriptIndex++) {
    const message = dialogue[transcriptIndex];
    if (message.role !== 'learner') continue;
    const parentTurn = parentTurns.find((turn) => turn.turn === learnerTurnIndex) || parentTurns[learnerTurnIndex] || null;
    const event = inferLearnerEvent({
      message,
      turnIndex: learnerTurnIndex,
      kc: DEFAULT_PARENT_KC,
      parentTurn,
    });
    const before = structuredClone(mastery);
    const evidence = extractEvidence(event);
    mastery = updateMasteryForEvidence(mastery, evidence);
    challengeState = updateChallengeState({
      scenario,
      previous: challengeState,
      evidence,
      turnIndex: learnerTurnIndex,
    });
    const relation = transitionRelationState({ evidence, mastery, challengeState });
    const policy = selectPolicy({
      evidence,
      mastery,
      ...relation,
      challengeState,
    });
    const parentPolicyAction = parentTurn?.tutorInternal?.policyAction || '';
    stateTrace.push({
      turnIndex: learnerTurnIndex,
      transcriptIndex,
      learner: message.content,
      event,
      evidence,
      relation,
      policy,
      challengeState: structuredClone(challengeState),
      masteryBefore: before,
      masteryAfter: structuredClone(mastery),
      parentPolicyAction,
      parentLearnerProfile: parentTurn?.learnerProfile || null,
      policyFamilyAgreement: policyFamilyAgreement(parentPolicyAction, policy.selectedPolicy),
    });
    learnerTurnIndex += 1;
  }
  const triggerTurn = Number.isInteger(parentScenario.hidden?.triggerTurn)
    ? parentScenario.hidden.triggerTurn
    : Number.isInteger(parentScenario.hidden?.trigger_turn)
      ? parentScenario.hidden.trigger_turn
      : null;
  const triggerTrace = triggerTurn == null
    ? null
    : stateTrace.find((turn) => turn.turnIndex === triggerTurn) || null;
  const triggerAlignment = triggerTrace ? {
    triggerTurn,
    expected: parentScenario.expectedStrategyShift ?? null,
    parentPolicyAction: triggerTrace.parentPolicyAction || null,
    prototypePolicy: triggerTrace.policy.selectedPolicy,
    parentExactMatch: expectedParentMatch(triggerTrace.parentPolicyAction, parentScenario.expectedStrategyShift),
    prototypeAcceptableMatch: expectedPrototypeMatch(triggerTrace.policy.selectedPolicy, parentScenario.expectedStrategyShift),
  } : null;
  return {
    branchName,
    dialogue,
    stateTrace,
    triggerAlignment,
    prototypePolicies: stateTrace.map((turn) => turn.policy.selectedPolicy),
    parentPolicies: stateTrace.map((turn) => turn.parentPolicyAction).filter(Boolean),
    challengeLevels: stateTrace.map((turn) => turn.challengeState?.level || 'none'),
  };
}

function buildReplayScenario({ trace, row }) {
  const parentScenario = trace.scenario || {};
  const scenarioType = row.scenarioType || row.scenario_type || parentScenario.scenarioType || parentScenario.scenario_type || 'adaptive_trap';
  return {
    id: row.scenarioId || row.scenario_id || parentScenario.id || 'parent_dialogue',
    name: row.scenarioName || row.scenario_name || parentScenario.id || 'Parent dialogue replay',
    discipline: 'parent_adaptive_trap',
    objective: `Replay parent adaptive trap dialogue (${scenarioType}) through the prototype state machine.`,
    challenge_profile: {
      mode: 'hard',
      source: 'parent_stack_replay',
      scenario_type: scenarioType,
      stressors: stressorsForScenarioType(scenarioType),
      scoring_note: 'Read-only replay of existing parent transcript; labels are heuristic and do not modify parent scoring.',
    },
    kcs: {
      [DEFAULT_PARENT_KC]: { prior: 0.45 },
    },
  };
}

function inferLearnerEvent({ message, turnIndex, kc, parentTurn }) {
  const text = String(message.content || '');
  const lower = text.toLowerCase();
  const confidence = parentTurn?.learnerProfile?.confidence;
  const outcome = inferOutcome(lower, confidence);
  return {
    id: `parent_l${turnIndex}`,
    learner: text,
    kc,
    outcome,
    affect: inferAffect(lower),
    stance: inferStance(lower, confidence),
    expected_policy: null,
  };
}

function inferOutcome(lower, confidence) {
  if (typeof confidence === 'number' && confidence >= 0.72) return 'correct';
  if (/\byes\b|makes sense|thank you|ok(ay)?[,. ]/i.test(lower) && lower.length < 120) return 'unobserved';
  if (/just tell|memorise|can't do this|wasting your time|not cut out|don't get any|completely stuck/.test(lower)) return 'incorrect';
  if (/not what i was asking|what am i missing|i don't really follow|i keep losing|not clicking|lost the thread/.test(lower)) return 'partial';
  if (typeof confidence === 'number' && confidence <= 0.28) return 'incorrect';
  if (typeof confidence === 'number' && confidence >= 0.58) return 'correct';
  return 'partial';
}

function inferAffect(lower) {
  if (/can't do this|wasting your time|not cut out|lost the thread|not clicking/.test(lower)) return 'discouraged';
  if (/just tell|no,|not what|why|but that|i don't see|i'm not buying/.test(lower)) return 'frustrated';
  if (/curious|push back|what i'm asking|right|actually/.test(lower)) return 'engaged';
  return 'neutral';
}

function inferStance(lower, confidence) {
  if (/no,|not what i was asking|that's not/.test(lower)) return 'corrective';
  if (/just tell|can you just|walk me through|give me the answer/.test(lower)) return 'dependent';
  if (/\byes\b|makes sense|thank you|ok(ay)?/.test(lower) && lower.length < 140) return 'compliant';
  if (lower.includes('?')) return 'questioning';
  if (typeof confidence === 'number' && confidence >= 0.62) return 'collaborative';
  return 'claim';
}

function normalizeDialogue(dialogue) {
  return dialogue
    .map((message) => ({
      role: normalizeRole(message.role || message._getType?.()),
      content: String(message.content || message.text || ''),
      meta: message.meta || undefined,
    }))
    .filter((message) => message.role === 'learner' || message.role === 'tutor')
    .filter((message) => message.content.trim().length > 0);
}

function normalizeRole(role) {
  if (role === 'human') return 'learner';
  if (role === 'ai' || role === 'assistant') return 'tutor';
  return role;
}

function stressorsForScenarioType(scenarioType) {
  const text = String(scenarioType || '').toLowerCase();
  const stressors = ['parent_replay'];
  if (text.includes('false') || text.includes('mastery')) stressors.push('false_mastery');
  if (text.includes('shutdown') || text.includes('overload')) stressors.push('affect_or_load');
  if (text.includes('avoidance') || text.includes('answer')) stressors.push('answer_seeking');
  if (text.includes('misrecognition') || text.includes('repair')) stressors.push('misrecognition');
  if (text.includes('resistance') || text.includes('deadlock')) stressors.push('substantive_resistance');
  return [...new Set(stressors)];
}

function expectedParentMatch(parentPolicyAction, expected) {
  const expectedList = normalizeExpected(expected);
  return Boolean(parentPolicyAction) && expectedList.includes(parentPolicyAction);
}

function expectedPrototypeMatch(prototypePolicy, expected) {
  const expectedList = normalizeExpected(expected);
  if (!prototypePolicy || expectedList.length === 0) return false;
  return expectedList.some((parentExpected) =>
    (PARENT_TO_PROTOTYPE_ACCEPTABLE[parentExpected] || []).includes(prototypePolicy));
}

function normalizeExpected(expected) {
  if (!expected) return [];
  if (Array.isArray(expected)) return expected.flatMap(normalizeExpected);
  if (typeof expected === 'string') return [expected];
  if (typeof expected === 'object') {
    return Object.values(expected).flatMap(normalizeExpected);
  }
  return [];
}

function policyFamilyAgreement(parentPolicyAction, prototypePolicy) {
  if (!parentPolicyAction || !prototypePolicy) return false;
  const parentFamily = PARENT_POLICY_FAMILY[parentPolicyAction] || parentPolicyAction;
  const prototypeFamily = PROTOTYPE_POLICY_FAMILY[prototypePolicy] || prototypePolicy;
  if (parentFamily === prototypeFamily) return true;
  const acceptable = PARENT_TO_PROTOTYPE_ACCEPTABLE[parentPolicyAction] || [];
  return acceptable.includes(prototypePolicy);
}

function summarizeReplay({ original, counterfactual }) {
  const branches = [original, counterfactual].filter(Boolean);
  const turns = branches.flatMap((branch) => branch.stateTrace);
  return {
    branches: branches.length,
    turns: turns.length,
    challengeTurns: turns.filter((turn) => turn.challengeState?.level !== 'none').length,
    familyAgreementRate: rate(turns.filter((turn) => turn.parentPolicyAction), (turn) => turn.policyFamilyAgreement),
    triggerPrototypeMatches: branches.filter((branch) => branch.triggerAlignment?.prototypeAcceptableMatch).length,
  };
}

function rate(rows, predicate) {
  if (!rows.length) return 0;
  return Number((rows.filter(predicate).length / rows.length).toFixed(3));
}

function compactRow(row) {
  return {
    runId: row.runId || row.run_id || null,
    scenarioId: row.scenarioId || row.scenario_id || null,
    scenarioType: row.scenarioType || row.scenario_type || null,
    profileName: row.profileName || row.profile_name || null,
    dialogueId: row.dialogueId || row.dialogue_id || null,
  };
}

function formatRate(value) {
  return `${((value || 0) * 100).toFixed(1)}%`;
}

function formatExpected(expected) {
  return normalizeExpected(expected).join(', ') || '';
}

function escapePipe(value) {
  return String(value ?? '').replaceAll('|', '/');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

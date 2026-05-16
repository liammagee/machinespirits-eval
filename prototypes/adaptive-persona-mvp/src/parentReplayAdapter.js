import { initializeMastery, updateMasteryForEvidence } from './knowledgeTracing.js';
import { extractEvidence, selectPolicy, transitionRelationState } from './stateMachine.js';
import {
  initialChallengeState,
  updateChallengeState,
} from './challengeState.js';
import {
  expectedParentActionMatch,
  expectedPrototypePolicyMatch,
  mapPrototypeTurnToParentAction,
  normalizeExpected,
  parentActionFamilyAgreement,
  prototypePolicyFamilyAgreement,
} from './parentActionMapping.js';
import {
  applyParentActionTransitionModel,
  transitionFamily,
} from './parentTransitionModel.js';

const DEFAULT_PARENT_KC = 'parent_adaptive_trap';

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
  const labelledTurnRows = branchSummaries
    .flatMap(({ replay, branch }) => branch.stateTrace.map((turn) => ({
      replay,
      branch,
      turn,
    })))
    .filter(({ turn }) => turn.parentPolicyAction);
  const familyAgreementRows = labelledTurnRows.map(({ turn }) => turn);
  const mappedFamilyAgreementRows = familyAgreementRows
    .filter((turn) => turn.parentCompatibleAction?.action);
  const mappedFamilyAgreementTurnRows = labelledTurnRows
    .filter(({ turn }) => turn.parentCompatibleAction?.action);
  const transitionFamilyAgreementRows = familyAgreementRows
    .filter((turn) => turn.parentTransitionAction?.action);
  const transitionFamilyAgreementTurnRows = labelledTurnRows
    .filter(({ turn }) => turn.parentTransitionAction?.action);
  const nonTriggerFamilyAgreementTurnRows = labelledTurnRows
    .filter(({ branch, turn }) => branch.triggerAlignment?.triggerTurn !== turn.turnIndex);
  const nonTriggerMappedFamilyAgreementTurnRows = mappedFamilyAgreementTurnRows
    .filter(({ branch, turn }) => branch.triggerAlignment?.triggerTurn !== turn.turnIndex);
  const nonTriggerTransitionFamilyAgreementTurnRows = transitionFamilyAgreementTurnRows
    .filter(({ branch, turn }) => branch.triggerAlignment?.triggerTurn !== turn.turnIndex);
  const challengeTurns = branchSummaries
    .flatMap(({ branch }) => branch.stateTrace)
    .filter((turn) => turn.challengeState?.level && turn.challengeState.level !== 'none');
  const actionTransitions = summarizeActionTransitions(branchSummaries);

  return {
    generatedAt: new Date().toISOString(),
    inputDescription,
    replayCount: rows.length,
    branchCount: branchSummaries.length,
    triggerAlignment: {
      count: triggerRows.length,
      parentExactRate: rate(triggerRows, (row) => row.parentExactMatch),
      prototypeAcceptableRate: rate(triggerRows, (row) => row.prototypeAcceptableMatch),
      parentCompatibleRate: rate(triggerRows, (row) => row.parentCompatibleExpectedMatch),
      bothAlignedRate: rate(triggerRows, (row) => row.parentExactMatch && row.prototypeAcceptableMatch),
    },
    familyAgreement: {
      count: familyAgreementRows.length,
      nonTriggerCount: nonTriggerFamilyAgreementTurnRows.length,
      prototypeRate: rate(familyAgreementRows, (row) => row.policyFamilyAgreement),
      parentCompatibleRate: rate(mappedFamilyAgreementRows, (row) => row.parentCompatibleFamilyAgreement),
      transitionAwareRate: rate(transitionFamilyAgreementRows, (row) => row.parentTransitionFamilyAgreement),
      nonTriggerPrototypeRate: rate(
        nonTriggerFamilyAgreementTurnRows,
        ({ turn }) => turn.policyFamilyAgreement,
      ),
      nonTriggerParentCompatibleRate: rate(
        nonTriggerMappedFamilyAgreementTurnRows,
        ({ turn }) => turn.parentCompatibleFamilyAgreement,
      ),
      nonTriggerTransitionAwareRate: rate(
        nonTriggerTransitionFamilyAgreementTurnRows,
        ({ turn }) => turn.parentTransitionFamilyAgreement,
      ),
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
    actionTransitions,
    mismatchSummary: {
      triggerMismatches: summarizeTriggerMismatches(branchSummaries),
      parentCompatibleFamilyMismatches: summarizeActionPairMismatches(mappedFamilyAgreementTurnRows),
      transitionFamilyMismatches: summarizeTransitionActionMismatches(transitionFamilyAgreementTurnRows),
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
    `| Parent-compatible trigger match | ${report.triggerAlignment.count} | ${formatRate(report.triggerAlignment.parentCompatibleRate)} |`,
    `| Raw prototype/parent family agreement | ${report.familyAgreement.count} | ${formatRate(report.familyAgreement.prototypeRate ?? report.familyAgreement.rate)} |`,
    `| Parent-compatible family agreement | ${report.familyAgreement.count} | ${formatRate(report.familyAgreement.parentCompatibleRate)} |`,
    `| Transition-aware family agreement | ${report.familyAgreement.count} | ${formatRate(report.familyAgreement.transitionAwareRate)} |`,
    `| Raw non-trigger family agreement | ${report.familyAgreement.nonTriggerCount} | ${formatRate(report.familyAgreement.nonTriggerPrototypeRate)} |`,
    `| Parent-compatible non-trigger family agreement | ${report.familyAgreement.nonTriggerCount} | ${formatRate(report.familyAgreement.nonTriggerParentCompatibleRate)} |`,
    `| Transition-aware non-trigger family agreement | ${report.familyAgreement.nonTriggerCount} | ${formatRate(report.familyAgreement.nonTriggerTransitionAwareRate)} |`,
    `| Parent-compatible family transition agreement | ${report.actionTransitions.count} | ${formatRate(report.actionTransitions.parentCompatibleRate)} |`,
    `| Transition-aware family transition agreement | ${report.actionTransitions.count} | ${formatRate(report.actionTransitions.transitionAwareRate)} |`,
    `| Challenge turns | ${report.challengeState.challengeTurnCount} | ${formatRate(report.challengeState.activeOrEscalatedRate)} |`,
    '',
    '## Replay Rows',
    '',
    '| Scenario | Branch | Expected | Parent Action | Prototype Policy | Mapped Action | Transition Action | Match | Challenge Levels |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  for (const replay of report.replays) {
    for (const branch of [replay.original, replay.counterfactual].filter(Boolean)) {
      const align = branch.triggerAlignment || {};
      const match = align.parentCompatibleExpectedMatch
        ? 'mapped'
        : align.prototypeAcceptableMatch
          ? 'prototype'
          : align.parentExactMatch
            ? 'parent-only'
            : 'no';
      lines.push(`| ${escapePipe(replay.scenario.id)} | ${branch.branchName} | ${escapePipe(formatExpected(align.expected))} | ${escapePipe(align.parentPolicyAction || '')} | ${escapePipe(align.prototypePolicy || '')} | ${escapePipe(align.parentCompatibleAction || '')} | ${escapePipe(align.parentTransitionAction || '')} | ${match} | ${escapePipe(branch.challengeLevels.join(' -> '))} |`);
    }
  }
  lines.push('');
  lines.push('## Parent-Compatible Family Mismatches');
  lines.push('');
  lines.push('| Parent Action | Mapped Action | Count | Example |');
  lines.push('|---|---|---:|---|');
  for (const mismatch of report.mismatchSummary.parentCompatibleFamilyMismatches) {
    const example = mismatch.examples[0];
    lines.push(`| ${escapePipe(mismatch.parentAction)} | ${escapePipe(mismatch.mappedAction)} | ${mismatch.count} | ${escapePipe(formatMismatchExample(example))} |`);
  }
  if (report.mismatchSummary.parentCompatibleFamilyMismatches.length === 0) {
    lines.push('| none | none | 0 |  |');
  }
  lines.push('');
  lines.push('## Trigger Mismatches');
  lines.push('');
  lines.push('| Expected | Mapped Action | Count | Example |');
  lines.push('|---|---|---:|---|');
  for (const mismatch of report.mismatchSummary.triggerMismatches) {
    const example = mismatch.examples[0];
    lines.push(`| ${escapePipe(formatExpected(mismatch.expected))} | ${escapePipe(mismatch.mappedAction)} | ${mismatch.count} | ${escapePipe(formatMismatchExample(example))} |`);
  }
  if (report.mismatchSummary.triggerMismatches.length === 0) {
    lines.push('| none | none | 0 |  |');
  }
  lines.push('');
  lines.push('## Transition-Aware Family Mismatches');
  lines.push('');
  lines.push('| Parent Action | Transition Action | Count | Example |');
  lines.push('|---|---|---:|---|');
  for (const mismatch of report.mismatchSummary.transitionFamilyMismatches) {
    const example = mismatch.examples[0];
    lines.push(`| ${escapePipe(mismatch.parentAction)} | ${escapePipe(mismatch.transitionAction)} | ${mismatch.count} | ${escapePipe(formatMismatchExample(example))} |`);
  }
  if (report.mismatchSummary.transitionFamilyMismatches.length === 0) {
    lines.push('| none | none | 0 |  |');
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
        <tr><td>Parent-compatible trigger match</td><td>${report.triggerAlignment.count}</td><td>${formatRate(report.triggerAlignment.parentCompatibleRate)}</td></tr>
        <tr><td>Both aligned at trigger</td><td>${report.triggerAlignment.count}</td><td>${formatRate(report.triggerAlignment.bothAlignedRate)}</td></tr>
        <tr><td>Raw prototype/parent family agreement</td><td>${report.familyAgreement.count}</td><td>${formatRate(report.familyAgreement.prototypeRate ?? report.familyAgreement.rate)}</td></tr>
        <tr><td>Parent-compatible family agreement</td><td>${report.familyAgreement.count}</td><td>${formatRate(report.familyAgreement.parentCompatibleRate)}</td></tr>
        <tr><td>Transition-aware family agreement</td><td>${report.familyAgreement.count}</td><td>${formatRate(report.familyAgreement.transitionAwareRate)}</td></tr>
        <tr><td>Raw non-trigger family agreement</td><td>${report.familyAgreement.nonTriggerCount}</td><td>${formatRate(report.familyAgreement.nonTriggerPrototypeRate)}</td></tr>
        <tr><td>Parent-compatible non-trigger family agreement</td><td>${report.familyAgreement.nonTriggerCount}</td><td>${formatRate(report.familyAgreement.nonTriggerParentCompatibleRate)}</td></tr>
        <tr><td>Transition-aware non-trigger family agreement</td><td>${report.familyAgreement.nonTriggerCount}</td><td>${formatRate(report.familyAgreement.nonTriggerTransitionAwareRate)}</td></tr>
        <tr><td>Parent-compatible family transition agreement</td><td>${report.actionTransitions.count}</td><td>${formatRate(report.actionTransitions.parentCompatibleRate)}</td></tr>
        <tr><td>Transition-aware family transition agreement</td><td>${report.actionTransitions.count}</td><td>${formatRate(report.actionTransitions.transitionAwareRate)}</td></tr>
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
          <th>Parent-Compatible Action</th>
          <th>Transition-Aware Action</th>
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
            <td><code>${escapeHtml(align.parentCompatibleAction || '')}</code></td>
            <td><code>${escapeHtml(align.parentTransitionAction || '')}</code></td>
            <td class="${align.parentCompatibleExpectedMatch ? 'good' : 'bad'}">${align.parentCompatibleExpectedMatch ? 'mapped match' : align.prototypeAcceptableMatch ? 'prototype match' : align.parentExactMatch ? 'parent only' : 'no match'}</td>
            <td>${escapeHtml(branch.challengeLevels.join(' -> '))}</td>
          </tr>`;
        })).join('')}
      </tbody>
    </table>

    <h2>Parent-Compatible Family Mismatches</h2>
    <table>
      <thead><tr><th>Parent Action</th><th>Mapped Action</th><th>Count</th><th>Example</th></tr></thead>
      <tbody>
        ${renderMismatchRows(report.mismatchSummary.parentCompatibleFamilyMismatches, (mismatch) => `
          <td><code>${escapeHtml(mismatch.parentAction)}</code></td>
          <td><code>${escapeHtml(mismatch.mappedAction)}</code></td>
          <td>${mismatch.count}</td>
          <td>${escapeHtml(formatMismatchExample(mismatch.examples[0]))}</td>
        `)}
      </tbody>
    </table>

    <h2>Trigger Mismatches</h2>
    <table>
      <thead><tr><th>Expected</th><th>Mapped Action</th><th>Count</th><th>Example</th></tr></thead>
      <tbody>
        ${renderMismatchRows(report.mismatchSummary.triggerMismatches, (mismatch) => `
          <td><code>${escapeHtml(formatExpected(mismatch.expected))}</code></td>
          <td><code>${escapeHtml(mismatch.mappedAction)}</code></td>
          <td>${mismatch.count}</td>
          <td>${escapeHtml(formatMismatchExample(mismatch.examples[0]))}</td>
        `)}
      </tbody>
    </table>

    <h2>Transition-Aware Family Mismatches</h2>
    <table>
      <thead><tr><th>Parent Action</th><th>Transition Action</th><th>Count</th><th>Example</th></tr></thead>
      <tbody>
        ${renderMismatchRows(report.mismatchSummary.transitionFamilyMismatches, (mismatch) => `
          <td><code>${escapeHtml(mismatch.parentAction)}</code></td>
          <td><code>${escapeHtml(mismatch.transitionAction)}</code></td>
          <td>${mismatch.count}</td>
          <td>${escapeHtml(formatMismatchExample(mismatch.examples[0]))}</td>
        `)}
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
  let stateTrace = [];
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
    const stateTurn = {
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
      policyFamilyAgreement: prototypePolicyFamilyAgreement(parentPolicyAction, policy.selectedPolicy),
    };
    const parentCompatibleAction = mapPrototypeTurnToParentAction({
      turn: stateTurn,
      scenario,
    });
    stateTrace.push({
      ...stateTurn,
      parentCompatibleAction,
      parentCompatibleFamilyAgreement: parentActionFamilyAgreement(
        parentPolicyAction,
        parentCompatibleAction.action,
      ),
    });
    learnerTurnIndex += 1;
  }
  stateTrace = applyParentActionTransitionModel({ stateTrace, scenario });
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
    parentCompatibleAction: triggerTrace.parentCompatibleAction?.action || null,
    parentCompatibleReason: triggerTrace.parentCompatibleAction?.reason || '',
    parentTransitionAction: triggerTrace.parentTransitionAction?.action || null,
    parentTransitionReason: triggerTrace.parentTransitionAction?.reason || '',
    parentExactMatch: expectedParentActionMatch(triggerTrace.parentPolicyAction, parentScenario.expectedStrategyShift),
    prototypeAcceptableMatch: expectedPrototypePolicyMatch(triggerTrace.policy.selectedPolicy, parentScenario.expectedStrategyShift),
    parentCompatibleExpectedMatch: expectedParentActionMatch(
      triggerTrace.parentCompatibleAction?.action,
      parentScenario.expectedStrategyShift,
    ),
    parentTransitionExpectedMatch: expectedParentActionMatch(
      triggerTrace.parentTransitionAction?.action,
      parentScenario.expectedStrategyShift,
    ),
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
  const parentTriggerTurn = Number.isInteger(parentScenario.hidden?.triggerTurn)
    ? parentScenario.hidden.triggerTurn
    : Number.isInteger(parentScenario.hidden?.trigger_turn)
      ? parentScenario.hidden.trigger_turn
      : null;
  return {
    id: row.scenarioId || row.scenario_id || parentScenario.id || 'parent_dialogue',
    name: row.scenarioName || row.scenario_name || parentScenario.id || 'Parent dialogue replay',
    discipline: 'parent_adaptive_trap',
    objective: `Replay parent adaptive trap dialogue (${scenarioType}) through the prototype state machine.`,
    challenge_profile: {
      mode: 'hard',
      source: 'parent_stack_replay',
      scenario_type: scenarioType,
      parent_trigger_turn: parentTriggerTurn,
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

function summarizeActionTransitions(branchSummaries) {
  const transitions = [];
  for (const { replay, branch } of branchSummaries) {
    const labelledTurns = branch.stateTrace
      .filter((turn) => turn.parentPolicyAction && turn.parentCompatibleAction?.action);
    for (let index = 1; index < labelledTurns.length; index += 1) {
      const previous = labelledTurns[index - 1];
      const current = labelledTurns[index];
      const parentTransition = [
        transitionFamily(previous.parentPolicyAction),
        transitionFamily(current.parentPolicyAction),
      ];
      const mappedTransition = [
        previous.parentCompatibleAction.family,
        current.parentCompatibleAction.family,
      ];
      const transitionAwareTransition = [
        previous.parentTransitionAction.family,
        current.parentTransitionAction.family,
      ];
      transitions.push({
        scenario: replay.scenario.id,
        branch: branch.branchName,
        turnIndex: current.turnIndex,
        parentTransition,
        mappedTransition,
        transitionAwareTransition,
        parentCompatibleMatch: parentTransition[0] === mappedTransition[0]
          && parentTransition[1] === mappedTransition[1],
        transitionAwareMatch: parentTransition[0] === transitionAwareTransition[0]
          && parentTransition[1] === transitionAwareTransition[1],
      });
    }
  }
  return {
    count: transitions.length,
    parentCompatibleRate: rate(transitions, (transition) => transition.parentCompatibleMatch),
    transitionAwareRate: rate(transitions, (transition) => transition.transitionAwareMatch),
    mismatches: transitions
      .filter((transition) => !transition.parentCompatibleMatch)
      .slice(0, 10),
    transitionAwareMismatches: transitions
      .filter((transition) => !transition.transitionAwareMatch)
      .slice(0, 10),
  };
}

function summarizeReplay({ original, counterfactual }) {
  const branches = [original, counterfactual].filter(Boolean);
  const turns = branches.flatMap((branch) => branch.stateTrace);
  return {
    branches: branches.length,
    turns: turns.length,
    challengeTurns: turns.filter((turn) => turn.challengeState?.level !== 'none').length,
    familyAgreementRate: rate(turns.filter((turn) => turn.parentPolicyAction), (turn) => turn.policyFamilyAgreement),
    parentCompatibleFamilyAgreementRate: rate(
      turns.filter((turn) => turn.parentPolicyAction && turn.parentCompatibleAction?.action),
      (turn) => turn.parentCompatibleFamilyAgreement,
    ),
    triggerPrototypeMatches: branches.filter((branch) => branch.triggerAlignment?.prototypeAcceptableMatch).length,
    triggerParentCompatibleMatches: branches.filter((branch) =>
      branch.triggerAlignment?.parentCompatibleExpectedMatch).length,
  };
}

function summarizeActionPairMismatches(rows) {
  const mismatches = rows.filter(({ turn }) => !turn.parentCompatibleFamilyAgreement);
  const grouped = new Map();
  for (const { replay, branch, turn } of mismatches) {
    const parentAction = turn.parentPolicyAction || 'none';
    const mappedAction = turn.parentCompatibleAction?.action || 'none';
    const key = `${parentAction}\u0000${mappedAction}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        parentAction,
        mappedAction,
        count: 0,
        examples: [],
      });
    }
    const row = grouped.get(key);
    row.count += 1;
    pushExample(row, {
      scenario: replay.scenario.id,
      branch: branch.branchName,
      turnIndex: turn.turnIndex,
      prototypePolicy: turn.policy.selectedPolicy,
      learner: turn.learner,
      reason: turn.parentCompatibleAction?.reason || '',
    });
  }
  return [...grouped.values()]
    .sort((a, b) => b.count - a.count || a.parentAction.localeCompare(b.parentAction))
    .slice(0, 10);
}

function summarizeTransitionActionMismatches(rows) {
  const mismatches = rows.filter(({ turn }) => !turn.parentTransitionFamilyAgreement);
  const grouped = new Map();
  for (const { replay, branch, turn } of mismatches) {
    const parentAction = turn.parentPolicyAction || 'none';
    const transitionAction = turn.parentTransitionAction?.action || 'none';
    const key = `${parentAction}\u0000${transitionAction}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        parentAction,
        transitionAction,
        count: 0,
        examples: [],
      });
    }
    const row = grouped.get(key);
    row.count += 1;
    pushExample(row, {
      scenario: replay.scenario.id,
      branch: branch.branchName,
      turnIndex: turn.turnIndex,
      prototypePolicy: turn.policy.selectedPolicy,
      learner: turn.learner,
      reason: turn.parentTransitionAction?.reason || '',
    });
  }
  return [...grouped.values()]
    .sort((a, b) => b.count - a.count || a.parentAction.localeCompare(b.parentAction))
    .slice(0, 10);
}

function summarizeTriggerMismatches(branchSummaries) {
  const grouped = new Map();
  for (const { replay, branch } of branchSummaries) {
    const align = branch.triggerAlignment;
    if (!align || align.parentCompatibleExpectedMatch) continue;
    const expected = normalizeExpected(align.expected);
    const mappedAction = align.parentCompatibleAction || 'none';
    const key = `${expected.join(',')}\u0000${mappedAction}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        expected,
        mappedAction,
        count: 0,
        examples: [],
      });
    }
    const row = grouped.get(key);
    row.count += 1;
    pushExample(row, {
      scenario: replay.scenario.id,
      branch: branch.branchName,
      turnIndex: align.triggerTurn,
      prototypePolicy: align.prototypePolicy,
      learner: findLearnerAtTurn(branch, align.triggerTurn),
      reason: align.parentCompatibleReason || '',
    });
  }
  return [...grouped.values()]
    .sort((a, b) => b.count - a.count || formatExpected(a.expected).localeCompare(formatExpected(b.expected)))
    .slice(0, 10);
}

function pushExample(row, example) {
  if (row.examples.length >= 3) return;
  row.examples.push({
    ...example,
    learner: clip(example.learner, 120),
  });
}

function findLearnerAtTurn(branch, turnIndex) {
  return branch.stateTrace.find((turn) => turn.turnIndex === turnIndex)?.learner || '';
}

function formatMismatchExample(example = {}) {
  const bits = [
    example.scenario,
    example.branch,
    Number.isInteger(example.turnIndex) ? `t${example.turnIndex}` : '',
    example.prototypePolicy ? `prototype=${example.prototypePolicy}` : '',
    example.reason ? `reason=${example.reason}` : '',
    example.learner ? `learner="${example.learner}"` : '',
  ].filter(Boolean);
  return bits.join('; ');
}

function renderMismatchRows(rows, renderCells) {
  if (!rows.length) {
    return '<tr><td><code>none</code></td><td><code>none</code></td><td>0</td><td></td></tr>';
  }
  return rows.map((row) => `<tr>${renderCells(row)}</tr>`).join('');
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

function clip(value, maxLength) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

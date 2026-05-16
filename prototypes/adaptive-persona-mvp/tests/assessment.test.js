import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runRealAssessment } from '../src/assessmentHarness.js';
import { validateOutcomeTask } from '../src/dynamicLearner.js';
import {
  detectTransferObservation,
  initialTransferState,
  recordTransferPrompt,
  selectPolicy,
} from '../src/stateMachine.js';
import {
  renderRubricComparisonHtml,
  runRubricComparison,
} from '../src/rubricComparison.js';

test('real assessment dry-run creates static and controller conditions', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'recognition_false_mastery_closed_loop',
    dryRun: true,
  });
  assert.ok(result.conditions.static_codex);
  assert.ok(result.conditions.controller_codex);
  assert.equal(result.conditions.controller_codex.counterfactualComparison.sameInitialLearnerTurn, true);
  assert.equal(result.conditions.controller_codex.counterfactualComparison.policyDiverged, true);
});

test('blind judge prompt excludes internal controller labels', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'recognition_false_mastery_closed_loop',
    conditions: ['controller_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const prompt = result.conditions.controller_codex.original.blindJudgePrompt;
  assert.ok(prompt.includes('You are intentionally not given policy labels'));
  assert.doesNotMatch(prompt, /selectedPolicy/);
  assert.doesNotMatch(prompt, /masteryDelta/);
  assert.doesNotMatch(prompt, /expectedPolicy/);
});

test('outcome tasks are attached and scored in dry-run assessment', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'structural_asymmetry_closed_loop',
    dryRun: true,
  });
  const branch = result.conditions.controller_codex.original;
  assert.equal(branch.outcomeTask.prompt.includes('asymmetry'), true);
  assert.equal(typeof branch.outcomeTask.success, 'boolean');
  assert.equal(typeof branch.blindJudge.weighted_score, 'number');
});

test('codex learner proxy mode keeps rule learner available and records learner prompts', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'recognition_false_mastery_closed_loop',
    conditions: ['controller_codex'],
    learnerMode: 'codex',
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_codex.original;
  assert.equal(branch.learnerMode, 'codex');
  assert.ok(branch.learnerTrace.length >= 1);
  assert.ok(branch.learnerTrace[0].prompt.includes('Hidden learner persona'));
  assert.ok(branch.outcomeTask.learnerOutcomePrompt.includes('same LLM learner proxy'));
});

test('rubric comparison dry-run applies MVP and parent dialogue rubrics', async () => {
  const report = await runRubricComparison({
    scenarioId: 'fractions_denominator_size_closed_loop',
    dryRun: true,
  });
  const [result] = report.results;
  const branch = result.conditions.controller_codex.original;
  assert.equal(typeof branch.blindJudge.weighted_score, 'number');
  assert.equal(typeof branch.parentDialogueJudge.weighted_score, 'number');
  assert.equal(typeof result.comparisons.rubrics.mvpDelta, 'number');
  assert.equal(typeof result.comparisons.rubrics.parentDelta, 'number');

  const html = renderRubricComparisonHtml(report);
  assert.match(html, /MVP Adaptation Rubric/);
  assert.match(html, /Parent Dialogue Rubric/);
  assert.match(html, /Condition Comparison/);
  assert.match(html, /static_codex/);
  assert.match(html, /controller_codex/);
});

test('rubric comparison can target three non-philosophy curricula', async () => {
  const report = await runRubricComparison({
    scenarioIds: [
      'fractions_denominator_size_closed_loop',
      'ai_bias_single_cause_closed_loop',
      'stats_confounding_closed_loop',
    ],
    dryRun: true,
  });
  assert.deepEqual(report.results.map((r) => r.discipline), [
    'mathematics',
    'ai_literacy',
    'statistics',
  ]);
  assert.equal(report.results.length, 3);
});

test('disciplinary misconceptions trigger repair policy before transfer', async () => {
  for (const scenarioId of [
    'fractions_denominator_size_closed_loop',
    'ai_bias_single_cause_closed_loop',
    'stats_confounding_closed_loop',
  ]) {
    const [result] = await runRealAssessment({
      scenarioId,
      conditions: ['controller_codex'],
      dryRun: true,
    });
    const branch = result.conditions.controller_codex.original;
    assert.equal(branch.stateTrace[0].policy.selectedPolicy, 'misconception_repair');
    assert.equal(branch.stateTrace[0].policy.outcomeGate.status, 'repair_required');
    assert.ok(branch.stateTrace[0].policy.actionTemplate.mustDo.length > 0);
    assert.equal(branch.stateTrace[1].policy.selectedPolicy, 'transfer_challenge');
    assert.equal(branch.outcomeTask.success, true);
  }
});

test('hard-mode learner can persist, forget, and require repeated repair', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'hard_ai_bias_resistant_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_reflexive_psychodynamic_codex.original;
  assert.equal(result.challengeProfile.mode, 'hard');
  assert.equal(branch.challengeProfile.mode, 'hard');
  assert.equal(branch.stateTrace.length, 3);
  assert.equal(branch.stateTrace[0].policy.selectedPolicy, 'misconception_repair');
  assert.equal(branch.stateTrace[1].policy.selectedPolicy, 'misconception_repair');
  assert.equal(branch.stateTrace[2].policy.selectedPolicy, 'transfer_challenge');
  assert.match(branch.transcript.map((turn) => turn.content).join('\n'), /not convinced|abstract|gender/i);
  assert.match(branch.blindJudgePrompt, /Hard-mode scoring addendum/);
});

test('hard statistics challenge state escalates into concrete confounder repair', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'hard_stats_confounding_skeptical_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_reflexive_psychodynamic_codex.original;
  assert.equal(branch.stateTrace[0].challengeState.level, 'active');
  assert.equal(branch.stateTrace[1].challengeState.level, 'escalated');
  assert.equal(branch.stateTrace[1].policy.selectedPolicy, 'misconception_repair');
  assert.match(branch.stateTrace[1].policy.challengeDirective, /confounder|third variable/i);
  assert.match(branch.stateTrace[1].policy.challengeDirective, /matched|controlled/i);
  assert.match(branch.stateTrace[1].tutorMessage, /confounder|third variable/i);
  assert.notEqual(branch.stateTrace[0].tutorMessage, branch.stateTrace[1].tutorMessage);
  assert.equal(branch.outcomeTask.success, true);
});

test('held-out hard curricula have domain repair contracts', async () => {
  for (const [scenarioId, expectedPattern] of [
    ['heldout_argument_warrant_resistant_closed_loop', /warrant|counterargument|stronger evidence/i],
    ['heldout_science_variable_control_resistant_closed_loop', /one variable|controlled|fair test/i],
    ['heldout_programming_debugging_resistant_closed_loop', /reproduce|root cause|regression/i],
    ['heldout_social_measurement_resistant_closed_loop', /construct|valid|reliability|comparison/i],
  ]) {
    const [result] = await runRealAssessment({
      scenarioId,
      conditions: ['controller_reflexive_psychodynamic_codex'],
      dryRun: true,
      keepPrompts: true,
    });
    const branch = result.conditions.controller_reflexive_psychodynamic_codex.original;
    assert.equal(branch.challengeProfile.mode, 'hard');
    assert.equal(branch.stateTrace[0].policy.selectedPolicy, 'misconception_repair');
    assert.match(branch.stateTrace[0].policy.actionTemplate.messageFrame, expectedPattern);
    assert.match(branch.stateTrace[0].policy.challengeDirective, expectedPattern);
  }
});

test('hidden-state trap curricula probe before repair and de-escalate ready branches', async () => {
  const staticOriginalOutcomeSuccesses = [];
  for (const [scenarioId, expectedPattern] of [
    ['trap_argument_warrant_false_mastery_closed_loop', /warrant|counterargument|stronger evidence/i],
    ['trap_science_variable_control_false_mastery_closed_loop', /one variable|controlled|fair test/i],
    ['trap_programming_debugging_false_mastery_closed_loop', /reproduce|root cause|regression/i],
    ['trap_social_measurement_false_mastery_closed_loop', /construct|validity|reliability|comparison/i],
  ]) {
    const [result] = await runRealAssessment({
      scenarioId,
      conditions: ['static_codex', 'controller_reflexive_psychodynamic_codex'],
      dryRun: true,
      keepPrompts: true,
    });
    const staticOriginal = result.conditions.static_codex.original;
    const original = result.conditions.controller_reflexive_psychodynamic_codex.original;
    const counterfactual = result.conditions.controller_reflexive_psychodynamic_codex.counterfactual;
    assert.equal(result.challengeProfile.hidden_state_trap, true);
    assert.equal(original.stateTrace[0].policy.selectedPolicy, 'teach_back');
    assert.equal(original.stateTrace[0].evidence.domainDiagnosis.repairNeeded, false);
    assert.equal(original.stateTrace[1].policy.selectedPolicy, 'misconception_repair');
    assert.match(original.stateTrace[1].policy.actionTemplate.messageFrame, expectedPattern);
    assert.equal(counterfactual.stateTrace[0].policy.selectedPolicy, 'teach_back');
    assert.ok(counterfactual.stateTrace.some((turn) => turn.policy.selectedPolicy === 'productive_struggle_hold'));
    assert.equal(original.outcomeTask.validation.applicable, true);
    assert.equal(original.outcomeTask.success, true);
    staticOriginalOutcomeSuccesses.push(staticOriginal.outcomeTask.success);
    assert.equal(counterfactual.outcomeTask.success, true);
  }
  assert.ok(staticOriginalOutcomeSuccesses.includes(false), 'hard trap outcomes should no longer let static original false-mastery branches pass at ceiling');
});

test('science trap validator requires learner-owned transfer, not only tutor prompt', () => {
  const scenario = {
    id: 'trap_science_variable_control_false_mastery_closed_loop',
    challenge_profile: { hidden_state_trap: true },
  };
  const tutorOnlyTransfer = validateOutcomeTask({
    scenario,
    transcript: [
      {
        role: 'learner',
        content: 'The control group has no fertilizer, and the treatment group gets fertilizer with the same water and light.',
      },
      {
        role: 'tutor',
        content: 'Now test the same idea on a new case with larger pots.',
      },
    ],
    outcome: {
      success: true,
      learner_answer: 'I would change only fertilizer, keep water and light fixed, compare otherwise similar plants with and without fertilizer, reject the near-miss because water or light also changed, and use the same fair-test rule in the next experiment.',
    },
  });
  assert.equal(tutorOnlyTransfer.success, false);
  assert.equal(tutorOnlyTransfer.checks.transcriptTransfer, false);

  const deniedTransfer = validateOutcomeTask({
    scenario,
    transcript: [
      {
        role: 'learner',
        content: 'The independent variable should just be fertilizer, and a different soil in the fertilizer group would make the setup flawed.',
      },
    ],
    outcome: {
      success: true,
      learner_answer: 'I would change only fertilizer, keep water and light fixed, compare otherwise similar plants, reject the near-miss, but I am not sure how to transfer this beyond repeating the same setup.',
    },
  });
  assert.equal(deniedTransfer.success, false);
  assert.equal(deniedTransfer.checks.transfer, false);

  const learnerTransfer = validateOutcomeTask({
    scenario,
    transcript: [
      {
        role: 'learner',
        content: 'The independent variable should just be whether the plants get fertilizer, not extra water too. They should keep water amount, light, soil, and starting size the same, then compare plants with fertilizer against plants without fertilizer under otherwise similar conditions.',
      },
    ],
    outcome: {
      success: true,
      learner_answer: 'I would change only whether the plants get fertilizer while keeping water, light, soil, and starting size fixed. Extra water and extra light also changed in the near-miss, so it cannot isolate fertilizer. For a next experiment, I would change only water and keep the other conditions fixed.',
    },
  });
  assert.equal(learnerTransfer.success, true);
  assert.equal(learnerTransfer.checks.transcriptTransfer, true);
});

test('trap validators use semantic delayed-transfer evidence over raw LLM self-success', () => {
  const argumentScenario = {
    id: 'trap_argument_warrant_false_mastery_closed_loop',
    challenge_profile: { hidden_state_trap: true },
  };
  const argumentValidation = validateOutcomeTask({
    scenario: argumentScenario,
    transcript: [
      {
        role: 'learner',
        content: 'For the school-uniform single quote, the warrant is that less outfit worry could reduce stress, but one quote cannot prove learning improved for everyone. Stronger evidence would check broader focus or performance data.',
      },
    ],
    outcome: {
      success: false,
      learner_answer: 'The quote can support reduced stress, but it is not direct proof of learning gains; broader focus and performance evidence would be needed.',
    },
  });
  assert.equal(argumentValidation.checks.parsedSuccess, false);
  assert.equal(argumentValidation.success, true);

  const scienceScenario = {
    id: 'trap_science_variable_control_false_mastery_closed_loop',
    challenge_profile: { hidden_state_trap: true },
  };
  const scienceValidation = validateOutcomeTask({
    scenario: scienceScenario,
    transcript: [
      {
        role: 'learner',
        content: 'The independent variable is fertilizer. If the fertilizer group also had different soil, that flawed setup could not show fertilizer caused the growth difference.',
      },
    ],
    outcome: {
      success: false,
      learner_answer: 'I would change only fertilizer, keep water, light, soil, plant type, and starting size fixed, compare otherwise similar groups, reject the near-miss, and next test a different watering schedule by changing only water.',
    },
  });
  assert.equal(scienceValidation.checks.parsedSuccess, false);
  assert.equal(scienceValidation.success, true);

  const debuggingScenario = {
    id: 'trap_programming_debugging_false_mastery_closed_loop',
    challenge_profile: { hidden_state_trap: true },
  };
  const debuggingValidation = validateOutcomeTask({
    scenario: debuggingScenario,
    transcript: [
      {
        role: 'learner',
        content: 'For a function returning NaN for a total, I would reproduce it with an amount list like [12, undefined, 5], trace the first invalid intermediate at the accumulation step, reject a final NaN-to-0 mask, and add regression tests that separate valid zero from invalid data.',
      },
    ],
    outcome: {
      success: false,
      learner_answer: 'The minimal fix is to validate or reject invalid amounts before adding them, not coerce NaN to 0, and transfer the same trace-first rule to future numeric bugs.',
    },
  });
  assert.equal(debuggingValidation.checks.parsedSuccess, false);
  assert.equal(debuggingValidation.success, true);
});

test('programming transfer gate rejects average/rate repeats and valid-zero confusions', () => {
  const scenario = {
    id: 'trap_programming_debugging_false_mastery_closed_loop',
    challenge_profile: { hidden_state_trap: true },
  };
  const kc = 'debugging_root_cause_trace';
  const averageRepeat = validateOutcomeTask({
    scenario,
    transcript: [
      {
        role: 'learner',
        content: 'For calculateAverageScore([]), the first invalid intermediate is sum / scores.length with length 0, then I would add a regression test.',
      },
    ],
    outcome: {
      success: true,
      learner_answer: 'The same rule transfers to the average case, but I have not used a genuinely different bad-total field case.',
    },
  });
  assert.equal(averageRepeat.success, false);
  assert.equal(averageRepeat.checks.transcriptTransfer, false);

  const validZeroConfusion = validateOutcomeTask({
    scenario,
    transcript: [
      {
        role: 'learner',
        content: 'For a percent-of-total calculation, amounts [5, -5] give total = 0, so total = 0 is the first invalid intermediate.',
      },
    ],
    outcome: {
      success: true,
      learner_answer: 'I would mask NaN at the end unless the regression catches the zero total.',
    },
  });
  assert.equal(validZeroConfusion.success, false);
  assert.equal(validZeroConfusion.checks.transcriptTransfer, false);

  const validBadTotal = detectTransferObservation({
    scenario,
    previous: {
      ...initialTransferState(scenario),
      lastPromptTurnIndex: 1,
      lastPromptPolicy: 'transfer_repair',
    },
    turnIndex: 2,
    evidence: {
      quote: 'For an invoice total, the smallest failing input is [{ amount: undefined }]. The first invalid step is Number(amount) becoming NaN before total += value, so I would reject invalid amounts before adding and keep a regression distinct from valid zero.',
      outcome: 'correct',
      stance: 'collaborative',
      kcCandidates: [kc],
    },
  });
  assert.equal(validBadTotal.observed, true);
});

test('programming trap elicits transfer before the final consolidation turn', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'trap_programming_debugging_false_mastery_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_reflexive_psychodynamic_codex.original;
  const transferTurn = branch.stateTrace.findIndex((turn) =>
    ['transfer_challenge', 'transfer_repair'].includes(turn.policy.selectedPolicy));
  const finalTurn = branch.stateTrace.length - 1;
  assert.ok(transferTurn >= 0 && transferTurn < finalTurn);
  assert.equal(branch.stateTrace[transferTurn].policy.transferGate.status, 'needs_learner_transfer');
  assert.equal(branch.stateTrace[finalTurn].policy.transferGate.status, 'observed');
  assert.equal(branch.outcomeTask.success, true);
});

test('transfer repair follows failed or delayed learner-owned transfer evidence', () => {
  const scenario = {
    id: 'trap_argument_warrant_false_mastery_closed_loop',
    challenge_profile: { hidden_state_trap: true },
  };
  const mastery = {
    argument_evidence_warrant: {
      pMastery: 0.72,
      observations: 3,
      lastOutcome: 'correct',
    },
  };
  const evidence = {
    obsId: 'l3',
    quote: 'I have the warrant and the stronger evidence check, but I am still staying inside the same paragraph.',
    kcCandidates: ['argument_evidence_warrant'],
    outcome: 'correct',
    affect: 'engaged',
    stance: 'collaborative',
    domainDiagnosis: {
      repairNeeded: false,
      repaired: true,
      successMarkers: ['warrant', 'stronger evidence'],
    },
  };
  const afterBroadTransfer = recordTransferPrompt({
    previous: initialTransferState(scenario),
    policy: 'transfer_challenge',
    turnIndex: 1,
  });
  const repairPolicy = selectPolicy({
    scenario,
    evidence,
    mastery,
    relationState: 'transfer',
    validationNeed: 'none',
    transferState: afterBroadTransfer,
    turnIndex: 2,
    maxTutorTurns: 4,
  });
  assert.equal(repairPolicy.selectedPolicy, 'transfer_repair');
  assert.match(repairPolicy.reason, /prior transfer prompt/i);

  const partialEvidence = {
    ...evidence,
    obsId: 'l2',
    quote: 'I can name the construct and one check, and I know a comparison matters, but I have not moved to a new case.',
    outcome: 'partial',
    domainDiagnosis: {
      repairNeeded: false,
      repaired: false,
      successMarkers: ['construct', 'comparison'],
    },
  };
  const lastChancePolicy = selectPolicy({
    scenario,
    evidence: partialEvidence,
    mastery,
    relationState: 'scaffolded_practice',
    validationNeed: 'none',
    transferState: initialTransferState(scenario),
    turnIndex: 2,
    maxTutorTurns: 4,
  });
  assert.equal(lastChancePolicy.selectedPolicy, 'transfer_repair');
  assert.match(lastChancePolicy.reason, /last tutor turn/i);
});

test('hard AI transfer requires explicit rejection of gender removal sufficiency', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'hard_ai_bias_resistant_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_reflexive_psychodynamic_codex.counterfactual;
  const transcript = branch.transcript.map((turn) => turn.content).join('\n');
  assert.equal(branch.stateTrace[1].policy.selectedPolicy, 'transfer_challenge');
  assert.match(branch.stateTrace[1].policy.actionTemplate.messageFrame, /gender removal is not enough/i);
  assert.match(transcript, /removing gender is not enough/i);
  assert.equal(branch.outcomeTask.success, true);
});

test('resolved hard-mode repair consolidates instead of repeating transfer', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'hard_ai_bias_resistant_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_reflexive_psychodynamic_codex.counterfactual;
  assert.equal(branch.stateTrace[2].policy.selectedPolicy, 'summarize_and_check');
  assert.equal(branch.stateTrace[2].challengeState.resolvedTurns, 2);
  assert.match(branch.stateTrace[2].policy.actionTemplate.messageFrame, /Do not repeat the same resume-screener transfer/i);
});

test('challenge-state ablation removes hard-mode directives', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'hard_stats_confounding_skeptical_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_no_challenge_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_reflexive_psychodynamic_no_challenge_codex.original;
  assert.equal(branch.stateTrace[0].challengeState, null);
  assert.equal(branch.stateTrace[0].policy.challengeDirective, '');
  assert.doesNotMatch(branch.stateTrace[0].policy.actionTemplate.messageFrame, /Hard-mode repair/i);
});

test('outcome-gate ablation stops forced misconception repair policy', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'hard_ai_bias_resistant_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_no_outcome_gate_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_reflexive_psychodynamic_no_outcome_gate_codex.original;
  assert.equal(branch.stateTrace[0].policy.outcomeGate.status, 'disabled');
  assert.notEqual(branch.stateTrace[0].policy.selectedPolicy, 'misconception_repair');
});

test('ego-only and memoryless ablations are traceable', async () => {
  const [egoOnly] = await runRealAssessment({
    scenarioId: 'fractions_denominator_size_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_ego_only_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const egoBranch = egoOnly.conditions.controller_reflexive_psychodynamic_ego_only_codex.original;
  assert.equal(egoBranch.stateTrace[0].reflexiveTrace.superegoCritique.adaptation_risk, 'superego_disabled');
  assert.equal(egoBranch.stateTrace[0].reflexiveTrace.prompts.superegoPrompt, null);

  const [memoryless] = await runRealAssessment({
    scenarioId: 'hard_ai_bias_resistant_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_no_memory_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const memorylessBranch = memoryless.conditions.controller_reflexive_psychodynamic_no_memory_codex.original;
  assert.equal(memorylessBranch.stateTrace[1].reflexiveMemory.priorCritiques.length, 0);
  assert.equal(memorylessBranch.stateTrace[1].reflexiveMemory.repairDebts.length, 0);
});

test('reflexive controller records ego-superego revision trace', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'stats_confounding_closed_loop',
    conditions: ['controller_reflexive_codex'],
    dryRun: true,
  });
  const branch = result.conditions.controller_reflexive_codex.original;
  assert.equal(branch.stateTrace[0].policy.selectedPolicy, 'misconception_repair');
  assert.ok(branch.stateTrace[0].reflexiveTrace.egoDraft.draft_message);
  assert.ok(branch.stateTrace[0].reflexiveTrace.superegoCritique.required_revision);
  assert.ok(branch.stateTrace[0].reflexiveTrace.egoRevision.tutor_message);
  assert.match(branch.stateTrace[0].reflexiveMemory.currentFocus, /repair|transfer|evidence/i);
});

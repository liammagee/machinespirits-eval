import { projectTutorStubDagSnapshotLines } from './tutorStubDagSnapshotPresentation.js';
import { tutorStubPlainList, tutorStubResponseCheckTriggerAreas } from './tutorStubResponseDetails.js';
import { describeTutorStubFieldShift, summarizeTutorStubFieldShift } from './tutorStubFieldPresentation.js';
import { scoreValue, topNumericEntries } from './tutorStubRegisterPolicy.js';

function presentationColors(colors = {}) {
  return {
    cyan: colors.cyan || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

function oneLine(value, { max = 220 } = {}) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function factText(fact) {
  if (!Array.isArray(fact) || fact.length === 0) return String(fact || '');
  const [relation, ...args] = fact;
  return `${relation}(${args.join(', ')})`;
}

function compactFactRow(row) {
  if (!row) return '';
  if (typeof row === 'string') return row;
  if (row.surface) return row.surface;
  if (row.text) return row.text;
  if (row.fact) return factText(row.fact);
  if (row.premise) return row.premise;
  return JSON.stringify(row);
}

function appendAnalysisLine(lines, colors, label, value, { max = 220 } = {}) {
  const text = oneLine(value, { max });
  if (!text) return;
  lines.push(`${colors.dim}  ${label}: ${text}${colors.reset}`);
}

function appendAnalysisList(lines, colors, label, rows, { limit = 5 } = {}) {
  const visible = Array.isArray(rows) ? rows.map(compactFactRow).filter(Boolean).slice(-limit) : [];
  if (!visible.length) return;
  lines.push(`${colors.dim}  ${label}:${colors.reset}`);
  for (const row of visible) lines.push(`${colors.dim}    - ${oneLine(row)}${colors.reset}`);
}

export function projectTutorStubTechnicalAnalysisLines({
  turn = null,
  turnIdentifier = null,
  registerSelection = null,
  previousEfficacy = null,
  distribution = '',
  tracePath = '',
  field = null,
  classifierEnabled = false,
  learnerDagEnabled = false,
  registerEnabled = false,
  registerTemperature = null,
  tutorDagEnabled = false,
  colors = {},
} = {}) {
  const C = presentationColors(colors);
  if (!turn) {
    return Object.freeze([
      `${C.cyan}analysis >${C.reset} no completed turns yet`,
      `${C.dim}  enter a learner turn first, then use /analysis to inspect the stored classifier, learner-DAG, register, and tutor-DAG data${C.reset}\n`,
    ]);
  }

  const lines = [
    `${C.cyan}analysis technical >${C.reset} current completed turn ${turn.turn}; id ${turnIdentifier || turn.turnId || 'unknown'}`,
  ];
  const classification = turn.classification || null;
  const turnAnalysis = classification?.turn || {};
  const overall = classification?.overall || {};
  const conceptual = scoreValue(turnAnalysis.scores?.conceptual_engagement);
  const readiness = scoreValue(turnAnalysis.scores?.epistemic_readiness);
  const learnerDagModel = turn.tutorLearnerDagModel || null;
  const metrics = learnerDagModel?.metrics || {};
  const assessment = learnerDagModel?.assessment || {};
  const learnerRecord = learnerDagModel?.learnerRecord || {};
  const update = turn.tutorLearnerDagUpdate || null;
  const dagPreflight = update?.preflight || null;
  const accepted = update?.accepted || {};
  const rejected = update?.rejected || [];
  const extractor = update?.extractor || {};
  const selectedEfficacy = registerSelection?.efficacy || null;
  const comprehension = turn.comprehension?.beforeTutor || null;
  const dagFactDropout = turn.dagFactDropout || null;
  const learnerAdvance = turn.learnerAdvance || update?.advance || learnerDagModel?.learnerAdvance || null;
  const fieldRow = field?.rows?.at(-1) || null;
  const previousFieldRow = field?.rows?.at(-2) || null;
  const firstFieldRow = field?.rows?.[0] || null;

  appendAnalysisLine(lines, C, 'learner', turn.learner);
  if (comprehension?.features) {
    appendAnalysisLine(
      lines,
      C,
      'comprehension side-state',
      `pressure=${comprehension.features.pressure}; unresolved=${
        comprehension.features.unresolvedTerms?.join(',') || 'none'
      }; explained=${comprehension.features.explainedTerms?.join(',') || 'none'}; advancesDAG=false`,
    );
  }
  if (dagFactDropout) {
    appendAnalysisLine(
      lines,
      C,
      'DAG fact dropout',
      `rate=${dagFactDropout.configuredRate}; seed=${dagFactDropout.seed}; eligible=${dagFactDropout.eligibleCount}; droppedNow=${
        dagFactDropout.droppedNow?.map((row) => row.premiseId).join(',') || 'none'
      }; repairedNow=${dagFactDropout.repairedNow?.map((row) => row.premiseId).join(',') || 'none'}; active=${
        dagFactDropout.activeDropped?.map((row) => row.premiseId).join(',') || 'none'
      }; visibility=conduct`,
    );
  }

  if (classification) {
    appendAnalysisLine(lines, C, 'did this turn', turnAnalysis.summary || 'No turn summary.');
    appendAnalysisLine(lines, C, 'did overall', overall.summary || 'No overall summary.');
    appendAnalysisLine(lines, C, 'logical request type', turnAnalysis.request_type || 'unknown_request');
    appendAnalysisLine(
      lines,
      C,
      'rubric',
      `move=${turnAnalysis.discourse_move || 'unknown'}; stance=${turnAnalysis.epistemic_stance || 'unknown'}; evidence=${
        turnAnalysis.evidence_use || 'unknown'
      }; agency=${turnAnalysis.agency || 'unknown'}; conceptual=${conceptual}/5; readiness=${readiness}/5`,
    );
    appendAnalysisLine(
      lines,
      C,
      'reasoning pace',
      `${turnAnalysis.learning_pace || 'steady'}; span=${turnAnalysis.reasoning_span || 'unknown'}`,
    );
    appendAnalysisLine(lines, C, 'trajectory', overall.trajectory);
    appendAnalysisLine(lines, C, 'current state', overall.current_state);
    appendAnalysisLine(lines, C, 'next tutor move', overall.next_best_tutor_move || turnAnalysis.pedagogical_need);
    if (classification.error || classification.parseError) {
      appendAnalysisLine(lines, C, 'classifier warning', classification.error || classification.parseError);
    }
  } else {
    appendAnalysisLine(lines, C, 'classifier', classifierEnabled ? 'no classifier output stored for this turn' : 'off');
  }

  if (learnerDagModel) {
    if (dagPreflight) {
      appendAnalysisLine(
        lines,
        C,
        'DAG preflight',
        `beforeModel=${dagPreflight.computedBeforeModelCall === true}; publicPremises=${
          dagPreflight.eligiblePublicPremiseIds?.length || 0
        }; candidateDerivations=${dagPreflight.possibleNextDerivations?.length || 0}; commitsProgress=${
          dagPreflight.authority?.commitsProgress === true
        }; hash=${dagPreflight.contentSha256 || 'n/a'}`,
      );
    }
    appendAnalysisLine(
      lines,
      C,
      'learner-DAG',
      `coverage=${assessment.bestPathCoverage ?? 'n/a'}; bottleneck=${assessment.bottleneck || 'unknown'}; grounded=${
        metrics.groundedCount || 0
      }; voiced=${metrics.voicedDerivedCount || 0}; hypotheses=${metrics.hypothesisCount || 0}; missing=${
        metrics.missingPremiseCount || 0
      }`,
    );
    if (update) {
      appendAnalysisLine(
        lines,
        C,
        'learner-record update',
        `adopted=${accepted.adopt?.length || 0}; derived=${accepted.derive?.length || 0}; retracted=${
          accepted.retract?.length || 0
        }; hypothesis=${accepted.hypothesis ? 'yes' : 'no'}; assertedAnswer=${accepted.assertAnswer || 'none'}`,
      );
      if (learnerAdvance) {
        appendAnalysisLine(
          lines,
          C,
          'learner advance',
          `pace=${learnerAdvance.pace}; supportedMoves=${learnerAdvance.supportedMoveCount}; multiPremise=${
            learnerAdvance.multiPremise
          }; multiStep=${learnerAdvance.multiStep}; strength=${learnerAdvance.strength}`,
        );
      }
      if (rejected.length) {
        appendAnalysisLine(lines, C, 'learner-record rejected', `${rejected.length} extractor item(s) rejected`);
      }
      if (extractor.error || extractor.parseError) {
        appendAnalysisLine(lines, C, 'learner-record warning', extractor.error || extractor.parseError);
      }
    }
    appendAnalysisList(lines, C, 'grounded public record', learnerRecord.grounded);
    appendAnalysisList(lines, C, 'learner hypotheses', learnerRecord.hypotheses);
    appendAnalysisList(lines, C, 'answer candidates', learnerRecord.answerCandidates);
  } else {
    appendAnalysisLine(
      lines,
      C,
      'learner-DAG',
      learnerDagEnabled ? 'no learner-DAG model stored for this turn' : 'off',
    );
  }

  if (registerSelection) {
    const confidence =
      registerSelection.confidence === null || registerSelection.confidence === undefined
        ? ''
        : `; confidence=${registerSelection.confidence}`;
    appendAnalysisLine(
      lines,
      C,
      'engagement stance',
      `${registerSelection.engagement_stance || registerSelection.selected_register}${confidence}`,
    );
    appendAnalysisLine(
      lines,
      C,
      'stance temperature',
      `${registerSelection.temperature ?? registerTemperature ?? 'n/a'} (engagement stance and actorial part; lower sharper, higher broader)`,
    );
    appendAnalysisLine(
      lines,
      C,
      'logical request type',
      registerSelection.request_type || registerSelection.learner_signal || 'unknown',
    );
    appendAnalysisLine(lines, C, 'action family', registerSelection.action_family || 'none');
    appendAnalysisLine(lines, C, 'audience register', registerSelection.audience_register || 'unknown');
    appendAnalysisLine(lines, C, 'lexical accessibility', registerSelection.lexical_accessibility || 'unknown');
    appendAnalysisLine(lines, C, 'scene immersion', registerSelection.scene_immersion || 'unknown');
    appendAnalysisLine(
      lines,
      C,
      'actorial part',
      `${registerSelection.actorial_part || 'unknown'} (${registerSelection.actorial_part_label || 'no public label'})`,
    );
    if (registerSelection.actorial_performance) {
      appendAnalysisLine(
        lines,
        C,
        'actorial performance',
        `${registerSelection.actorial_performance.id || 'unknown'} (${registerSelection.actorial_performance.label || 'no public label'}): ${registerSelection.actorial_performance.contract || 'no contract stored'}`,
      );
    }
    if (registerSelection.actorial_part_selection?.distribution) {
      appendAnalysisLine(
        lines,
        C,
        'actorial-part distribution',
        registerSelection.actorial_part_selection.distribution
          .map((row) => `${row.part}:${Math.round(Number(row.probability || 0) * 100)}%`)
          .join(', '),
      );
      appendAnalysisLine(lines, C, 'actorial-part drivers', registerSelection.actorial_part_selection.reason || 'none');
      appendAnalysisLine(
        lines,
        C,
        'actorial-part selection',
        `${registerSelection.actorial_part_selection.selection_method || 'argmax'}; selected probability ${
          registerSelection.actorial_part_selection.probability ?? 'n/a'
        }${
          Number.isFinite(Number(registerSelection.actorial_part_selection.random?.decision?.draw))
            ? `; seeded draw ${registerSelection.actorial_part_selection.random.decision.draw}`
            : ''
        }`,
      );
    }
    if (registerSelection.legacy_selected_register) {
      appendAnalysisLine(lines, C, 'legacy register alias', registerSelection.legacy_selected_register);
    }
    appendAnalysisLine(lines, C, 'reviewer signal', registerSelection.reviewer_signal || 'unknown');
    appendAnalysisLine(lines, C, 'register reason', registerSelection.register_reason);
    if (registerSelection.policy_composition) {
      const composition = registerSelection.policy_composition;
      appendAnalysisLine(
        lines,
        C,
        'policy composition',
        `stack=${composition.policy_stack}; threshold=${composition.overlay_threshold}; activated=${
          composition.activated_overlay || 'primary'
        }`,
      );
      for (const overlay of composition.overlay_evaluations || []) {
        appendAnalysisLine(
          lines,
          C,
          `${overlay.policy} overlay`,
          `strength=${overlay.signal_strength}; candidate=${overlay.selected_register || 'none'}; thresholdMet=${
            overlay.threshold_met
          }; differs=${overlay.differs_from_primary}; ${overlay.reasons?.join('; ') || ''}`,
        );
      }
    }
    appendAnalysisLine(lines, C, 'expected DAG move', registerSelection.expected_dag_move);
    appendAnalysisLine(
      lines,
      C,
      (registerSelection.activated_policy || registerSelection.primary_policy || registerSelection.policy) === 'state'
        ? 'expected state move'
        : 'expected field move',
      registerSelection.expected_field_move,
    );
    appendAnalysisLine(lines, C, 'expected progress marker', registerSelection.expected_progress_marker);
    if (distribution) appendAnalysisLine(lines, C, 'engagement-stance distribution', distribution);
    if (registerSelection.field_policy?.features) {
      const features = registerSelection.field_policy.features;
      appendAnalysisLine(
        lines,
        C,
        'field policy',
        `relation=${features.field?.relation || 'unknown'}; fieldDelta=${
          features.field?.delta ?? 'n/a'
        }; dagScore=${features.dag?.progressScore ?? 'n/a'}; bottleneck=${features.dag?.bottleneck || 'unknown'}`,
      );
    }
    if (registerSelection.trajectory_policy?.trajectory) {
      const trajectory = registerSelection.trajectory_policy.trajectory;
      const flags = Object.entries(trajectory.flags || {})
        .filter(([, value]) => value)
        .map(([key]) => key)
        .join(',');
      appendAnalysisLine(
        lines,
        C,
        'trajectory policy',
        `fieldSlope=${trajectory.field?.slope ?? 'n/a'}; dagSlope=${trajectory.dag?.slope ?? 'n/a'}; riskSlope=${
          trajectory.risk?.slope ?? 'n/a'
        }; flags=${flags || 'none'}`,
      );
    }
    if (registerSelection.dynamical_system_policy?.state_vector) {
      const policy = registerSelection.dynamical_system_policy;
      const vector = topNumericEntries(policy.state_vector, { limit: 4 }).join(', ');
      const attractors = topNumericEntries(policy.attractors, { limit: 3 }).join(', ');
      appendAnalysisLine(
        lines,
        C,
        'dynamical policy',
        `vector=${vector || 'none'}; attractors=${attractors || 'none'}`,
      );
      if (policy.corpus_empirical?.enabled) {
        const corrections = topNumericEntries(policy.corpus_empirical.corrections, { limit: 4, abs: true }).join(', ');
        appendAnalysisLine(lines, C, 'corpus prior', `corrections=${corrections || 'none'}`);
      } else if (policy.corpus_empirical?.reason) {
        appendAnalysisLine(lines, C, 'corpus prior', policy.corpus_empirical.reason);
      }
    }
    if (registerSelection.state_policy?.features) {
      const features = registerSelection.state_policy.features;
      appendAnalysisLine(
        lines,
        C,
        'state policy',
        `bottleneck=${features.dag?.bottleneck || 'unknown'}; coverage=${
          features.dag?.bestPathCoverage ?? 'n/a'
        }; missing=${features.dag?.missingPremiseCount ?? 'n/a'}; surface=${features.scores?.learnerSurface ?? 'n/a'}`,
      );
    }
    if (selectedEfficacy) {
      appendAnalysisLine(
        lines,
        C,
        'selected register efficacy',
        `${selectedEfficacy.label}; score=${selectedEfficacy.progressScore}; ${
          selectedEfficacy.mismatch || 'field-state unknown'
        }; fieldDelta=${selectedEfficacy.field?.delta ?? 'n/a'}; ${selectedEfficacy.summary}`,
      );
    } else {
      appendAnalysisLine(lines, C, 'selected register efficacy', 'pending the next learner turn');
    }
  } else {
    appendAnalysisLine(lines, C, 'selected register', registerEnabled ? 'none stored for this turn' : 'off');
  }
  if (turn.responseConfigurationAudit) {
    const audit = turn.responseConfigurationAudit;
    appendAnalysisLine(
      lines,
      C,
      'configuration realization',
      `${audit.visible_axis_count}/${audit.axis_count}; rate=${audit.realization_rate}; transcriptVisible=${audit.transcript_visible}`,
    );
    appendAnalysisLine(
      lines,
      C,
      'visible axes',
      Object.entries(audit.axes || {})
        .map(([axis, value]) => `${axis}=${value.visible ? 'yes' : 'no'}`)
        .join('; '),
    );
  }
  if (previousEfficacy) {
    appendAnalysisLine(
      lines,
      C,
      'previous register efficacy',
      `${previousEfficacy.selected_register}: ${previousEfficacy.label}; score=${previousEfficacy.progressScore}; ${
        previousEfficacy.mismatch || 'field-state unknown'
      }; fieldDelta=${previousEfficacy.field?.delta ?? 'n/a'}; ${previousEfficacy.summary}`,
    );
  }

  if (fieldRow) {
    appendAnalysisLine(
      lines,
      C,
      'field state',
      `mastery=${fieldRow.learnerMastery}; risk=${fieldRow.learnerRisk}; alignment=${fieldRow.tutorAlignment}; momentum=${fieldRow.jointMomentum}; speed=${fieldRow.speed}`,
    );
    appendAnalysisLine(
      lines,
      C,
      'field shift',
      summarizeTutorStubFieldShift(fieldRow, previousFieldRow, firstFieldRow),
    );
    appendAnalysisLine(
      lines,
      C,
      'field reading',
      describeTutorStubFieldShift(fieldRow, previousFieldRow, field.summary),
    );
  }

  if (turn.tutorLeakAudit) {
    const leaks = turn.tutorLeakAudit.leaks || [];
    appendAnalysisLine(
      lines,
      C,
      'answer-secrecy check',
      turn.tutorLeakAudit.ok ? 'passed' : `${leaks.length} issue(s) remained after revision and recheck`,
    );
    for (const leak of leaks.slice(0, 3)) {
      appendAnalysisLine(lines, C, `answer-secrecy issue ${leak.type || 'unknown'}`, leak.reason);
    }
  }
  const responseCheckAreas = tutorStubResponseCheckTriggerAreas(turn);
  if (turn.tutorResponseRepaired) {
    appendAnalysisLine(
      lines,
      C,
      'response revision',
      `${turn.tutorDeterministicFallback ? 'safe fallback' : 'model rewrite'}; triggered by ${
        responseCheckAreas.length ? tutorStubPlainList(responseCheckAreas) : 'an unsuccessful response check'
      }`,
    );
  }

  if (turn.tutorDag) {
    lines.push(...projectTutorStubDagSnapshotLines({ snapshot: turn.tutorDag, colors: C }));
  } else {
    appendAnalysisLine(lines, C, 'tutor DAG', tutorDagEnabled ? 'no snapshot stored for this turn' : 'off');
  }

  if (turn.humanDiscourseFrame) {
    const frame = turn.humanDiscourseFrame;
    const scaffold = frame.scaffoldState || {};
    const proofDebt = frame.proofDebt || {};
    const audit = frame.warrantPremiseAudit || {};
    const generousInference = frame.generousInference || {};
    const questionSupport = frame.questionSupport || {};
    appendAnalysisLine(
      lines,
      C,
      'human scaffold',
      `${frame.mode}; branch=${scaffold.branch?.label || scaffold.branch?.id || 'none'}; sideArc=${
        frame.sideArc?.detected ? frame.sideArc.type : 'none'
      }; proofDebt=${proofDebt.status || 'unknown'}`,
    );
    appendAnalysisLine(lines, C, 'local question', scaffold.localQuestion);
    appendAnalysisLine(
      lines,
      C,
      'generous inference',
      generousInference.applied
        ? `applied; kind=${generousInference.kind}; confidence=${generousInference.confidence}; ${generousInference.reason}`
        : `not applied; ${generousInference.reason || 'no contextual resolution recorded'}`,
    );
    if (generousInference.applied) {
      appendAnalysisLine(lines, C, 'resolved meaning', generousInference.resolvedMeaning);
      appendAnalysisLine(lines, C, 'spoken-turn override', generousInference.tutorInstruction);
    }
    if (proofDebt.elision?.applied) {
      appendAnalysisLine(
        lines,
        C,
        'proof-debt elision',
        `applied=${proofDebt.elision.applied}; elided=${proofDebt.elision.count}; open=${proofDebt.counts?.open || 0}; ${proofDebt.elision.reason}`,
      );
    }
    if (questionSupport.schema) {
      appendAnalysisLine(
        lines,
        C,
        'question support',
        `answerability=${questionSupport.answerability}; modality=${questionSupport.modality}; adaptiveChoice=${
          questionSupport.adaptiveMultipleChoice
        }; cooldown=${questionSupport.adaptiveChoiceCoolingDown}; ${questionSupport.reason}`,
      );
      if (turn.tutorQuestionSupportAudit) {
        appendAnalysisLine(
          lines,
          C,
          'question-answerability check',
          turn.tutorQuestionSupportAudit.ok
            ? 'ok'
            : `${turn.tutorQuestionSupportAudit.issues?.length || 0} issue(s) remained`,
        );
      }
    }
    if (turn.tutorHumanScaffoldAudit) {
      appendAnalysisLine(
        lines,
        C,
        'answered-question check',
        turn.tutorHumanScaffoldAudit.ok
          ? `ok; semantic re-question similarity=${turn.tutorHumanScaffoldAudit.similarity ?? 0}`
          : `${turn.tutorHumanScaffoldAudit.issues?.length || 0} issue(s) remained`,
      );
    }
    if (audit.counts) {
      appendAnalysisLine(
        lines,
        C,
        'warrant stocktake',
        `explicit=${audit.counts.explicitWarrants || 0}; implied=${audit.counts.impliedWarrants || 0}; missing=${
          audit.counts.missingWarrants || 0
        }; suppressed=${audit.counts.suppressedPremises || 0}; commonsense=${audit.counts.commonSenseBridges || 0}`,
      );
    }
  }

  if (turn.dialogueClosure) {
    const closure = turn.dialogueClosure;
    appendAnalysisLine(
      lines,
      C,
      'dialogue closure',
      `frame=${closure.frame?.phase || 'open'}; basis=${closure.frame?.basis || closure.lifecycle?.basis || 'none'}; lifecycle=${
        closure.lifecycle?.phase || 'open'
      }; strictGrounded=${closure.frame?.strictGrounded === true}; authoredDagSatisfied=${
        closure.frame?.authoredDagSatisfied === true
      }`,
    );
    if (closure.audit) {
      appendAnalysisLine(
        lines,
        C,
        'ending check',
        `ok=${closure.audit.ok}; closes=${closure.audit.closesDialogue}; checkIn=${closure.audit.invitesCheckIn}; issues=${
          closure.audit.issues?.length || 0
        }`,
      );
    }
  }

  appendAnalysisLine(lines, C, 'trace', tracePath);
  lines.push('');
  return Object.freeze(lines);
}

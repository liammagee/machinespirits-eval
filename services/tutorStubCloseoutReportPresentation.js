import {
  compactTutorStubCloseoutCounts,
  tutorStubPlainCloseoutReason,
  tutorStubPlainCloseoutStatus,
} from './tutorStubCloseoutProjection.js';
import { tutorStubDisplayDiagnosticLabel } from './tutorStubResponseDetails.js';
import { tutorStubTrainingReuseLabel } from './tutorStubTrainingReuse.js';

function presentationColors(colors = {}) {
  return {
    cyan: colors.cyan || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

function oneLine(value, { max = 220 } = {}) {
  const text = String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function projectProgressLines(payload, registerCounts, colors) {
  const final = payload.field.final;
  const delta = payload.field.fieldDelta;
  const visibility = payload.responseConfigurationVisibility;
  const lines = [
    `${colors.dim}  reasoning progress: ${
      Number.isFinite(Number(payload.finalAssessment.bestPathCoverage))
        ? `${Math.round(Number(payload.finalAssessment.bestPathCoverage) * 100)}%`
        : 'not available'
    } of the strongest proof path; ${
      payload.finalAssessment.missingPremiseCount
    } evidence step(s) still missing; current sticking point ${tutorStubDisplayDiagnosticLabel(
      payload.finalAssessment.bottleneck || 'unknown',
    )}; answer-secrecy check ${
      payload.finalTurn.leakOk === null ? 'not available' : payload.finalTurn.leakOk ? 'passed' : 'failed'
    }${colors.reset}`,
    `${colors.dim}  interaction measures: learner progress ${final.learnerMastery}, pressure ${
      final.learnerRisk
    }, tutor alignment ${final.tutorAlignment}, momentum ${final.jointMomentum}; progress change ${
      delta.learnerMastery >= 0 ? '+' : ''
    }${delta.learnerMastery}, pressure change ${delta.learnerRisk >= 0 ? '+' : ''}${delta.learnerRisk}${colors.reset}`,
    `${colors.dim}  tutor styles used: ${registerCounts}${colors.reset}`,
  ];

  if (payload.learning.progress?.acceleratedTurnCount) {
    lines.push(
      `${colors.dim}  learner pace: accelerated on ${
        payload.learning.progress.acceleratedTurnCount
      } turn(s); longest supported leap ${payload.learning.progress.maxSupportedMoves} moves${colors.reset}`,
    );
  }
  if (payload.releasePacing) {
    lines.push(
      `${colors.dim}  clue pace: ${payload.releasePacing.baseSpeed}x base; ${
        payload.releasePacing.counts.accelerationSignals
      } faster request(s), ${payload.releasePacing.counts.decelerationSignals} slower request(s); ${
        payload.releasePacing.counts.early
      } clue(s) released early${colors.reset}`,
    );
  }
  if (visibility.turns) {
    lines.push(
      `${colors.dim}  intended tutor style visible in wording: ${Math.round(
        visibility.mean_realization_rate * 100,
      )}%; visible difference between styles ${
        visibility.pairwise_visible_difference_rate === null
          ? 'n/a'
          : `${Math.round(visibility.pairwise_visible_difference_rate * 100)}%`
      } across ${visibility.distinct_configuration_count} configuration(s)${colors.reset}`,
    );
  }
  return lines;
}

function projectAuditLines(payload, bottleneckCounts, colors) {
  const guard = payload.guardAccounting;
  const lines = [
    `${colors.dim}  response checks: first drafts accepted ${guard.originalCandidateAcceptedTurns}/${
      guard.accountedTurns
    }; mechanical repairs ${guard.mechanicalRepairTurns}; model rewrites ${
      guard.modelRepairTurns
    }; safe fallbacks ${guard.deterministicFallbackTurns}; final check failures ${
      guard.finalDeliveryAuditFailures
    }; mean tutor generation ${Math.round(guard.meanTutorGenerationLatencyMs || 0)}ms${colors.reset}`,
    `${colors.dim}  sticking points seen: ${bottleneckCounts}${colors.reset}`,
  ];

  if (payload.humanDiscourse.config?.scaffoldActive) {
    lines.push(
      `${colors.dim}  human-friendly reasoning: ${payload.humanDiscourse.finalStatus || 'unknown'}; deferred proof steps ${
        payload.humanDiscourse.proofDebtStatus || 'unknown'
      }; side questions ${payload.humanDiscourse.sideArcCount}; open deferred steps ${
        payload.humanDiscourse.openProofDebtCount
      }; obvious steps carried forward ${payload.humanDiscourse.elidedBridgeCount}; question support ${compactTutorStubCloseoutCounts(
        Object.entries(payload.humanDiscourse.questionSupportModes),
      )}${colors.reset}`,
    );
  }
  if (payload.comprehension.features.unresolvedTerms.length || payload.comprehension.features.explainedTerms.length) {
    lines.push(
      `${colors.dim}  language help: still unclear ${
        payload.comprehension.features.unresolvedTerms.join(', ') || 'none'
      }; explained ${payload.comprehension.features.explainedTerms.join(', ') || 'none'}; difficulty ${
        payload.comprehension.features.languageOpacity
      }${colors.reset}`,
    );
  }
  return lines;
}

export function projectTutorStubCloseoutReportLines({
  reason = 'report',
  tracePath = null,
  payload = null,
  lastTurn = null,
  registerCounts = 'none',
  bottleneckCounts = 'none',
  colors = {},
} = {}) {
  const C = presentationColors(colors);
  if (!payload) {
    const lines = [
      `${C.cyan}session summary >${C.reset} ${tutorStubPlainCloseoutReason(reason)}; no completed tutor turns`,
    ];
    if (tracePath) lines.push(`${C.dim}  technical trace: ${tracePath}${C.reset}`);
    lines.push(
      `${C.dim}  start with the tutor opening prompt, then enter one learner turn to build a report${C.reset}\n`,
    );
    return Object.freeze(lines);
  }

  const lines = [
    `${C.cyan}session summary >${C.reset} ${tutorStubPlainCloseoutReason(reason)}; ${
      payload.turnCount
    } completed turn(s)`,
  ];
  if (tracePath) lines.push(`${C.dim}  technical trace: ${tracePath}${C.reset}`);
  lines.push(
    `${C.dim}  training reuse: ${tutorStubTrainingReuseLabel(payload.trainingReuse)}; requested ${
      payload.trainingReuse?.requested || 'off'
    }; ${tutorStubDisplayDiagnosticLabel(payload.trainingReuse?.humanSubjectClass || 'unknown')}${C.reset}`,
    `${C.dim}  outcome: ${tutorStubPlainCloseoutStatus(lastTurn)}${C.reset}`,
    ...projectProgressLines(payload, registerCounts, C),
    ...projectAuditLines(payload, bottleneckCounts, C),
    `${C.dim}  technical turn id: ${payload.finalTurn.turnId}${C.reset}`,
    `${C.dim}  last learner: ${oneLine(payload.finalTurn.learner, { max: 180 })}${C.reset}`,
    `${C.dim}  last tutor: ${oneLine(payload.finalTurn.tutor, { max: 220 })}${C.reset}\n`,
  );
  return Object.freeze(lines);
}

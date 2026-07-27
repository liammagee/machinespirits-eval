function tutorPromptSurfaceKey(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function oneLine(value, { max = 220 } = {}) {
  const text = String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function compactAuditRows(rows = [], limit = 3) {
  const visible = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      if (typeof row === 'string') return row.trim();
      const bits = [row?.surface, row?.warrantNeeded, row?.reason]
        .filter(Boolean)
        .map((value) => oneLine(value, { max: 120 }));
      return bits.join(' — ');
    })
    .filter(Boolean)
    .slice(0, limit);
  return visible.length ? visible.map((row) => `- ${row}`).join('\n') : '- none';
}

export function projectTutorStubLearnerClassifierContext(classification) {
  if (!classification) return '';
  return [
    '[Tutor-only learner classifier]',
    `This turn: ${classification.turn?.summary || 'No turn summary.'}`,
    `Overall: ${classification.overall?.summary || 'No overall summary.'}`,
    `Discourse move: ${classification.turn?.discourse_move || 'unknown'}`,
    `Evidence use: ${classification.turn?.evidence_use || 'unknown'}`,
    `Epistemic stance: ${classification.turn?.epistemic_stance || 'unknown'}`,
    `Immediate pedagogical need: ${
      classification.turn?.pedagogical_need || classification.overall?.next_best_tutor_move || 'unknown'
    }`,
    'Use this as advisory context. Do not mention classifier labels, scores, rubrics, or hidden analysis to the learner.',
    '[End tutor-only learner classifier]',
  ].join('\n');
}

export function projectTutorStubLearnerDagModelContext(result, { releasedEvidence = [] } = {}) {
  const model = result?.model || result;
  if (!model) return '';
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const record = model.learnerRecord || {};
  const memoryReliability = model.memoryReliability || null;
  const groundedRows = Array.isArray(record.grounded) ? record.grounded : [];
  const groundedSurfaceKeys = new Set(groundedRows.map((row) => tutorPromptSurfaceKey(row?.surface)).filter(Boolean));
  const groundedReleasedCount = (Array.isArray(releasedEvidence) ? releasedEvidence : []).filter((row) =>
    groundedSurfaceKeys.has(tutorPromptSurfaceKey(row?.surface)),
  ).length;
  const groundedOtherCount = Math.max(0, groundedRows.length - groundedReleasedCount);
  const groundingStatus = [
    groundedReleasedCount
      ? `- ${groundedReleasedCount} released public evidence item${groundedReleasedCount === 1 ? '' : 's'} currently learner-grounded; exact item labels appear in the public evidence window.`
      : '- no released public evidence is currently learner-grounded',
    groundedOtherCount
      ? `- ${groundedOtherCount} additional public or derived fact${groundedOtherCount === 1 ? '' : 's'} currently grounded`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
  const hypotheses = (record.hypotheses || []).map((row) => `- ${row.text}`).join('\n') || '- none';
  const candidates = (record.answerCandidates || []).map((row) => `- ${row.surface}`).join('\n') || '- none';
  return [
    '[Tutor-only redacted learner-DAG model]',
    `Best-path coverage: ${assessment.bestPathCoverage ?? 'unavailable'}`,
    `Bottleneck: ${assessment.bottleneck || 'unavailable'}`,
    `Counts: grounded=${metrics.groundedCount || 0}, voiced=${metrics.voicedDerivedCount || 0}, hypotheses=${
      metrics.hypothesisCount || 0
    }, answerCandidates=${metrics.answerCandidateCount || 0}, missing=${metrics.missingPremiseCount || 0}`,
    memoryReliability?.activeDroppedCount
      ? `Memory reliability: ${memoryReliability.activeDroppedCount} previously accumulated public evidence item(s) are no longer active in the redacted record. Re-anchor gently from public evidence; do not announce forgetting, dropout, or an internal memory test.`
      : null,
    'Grounding status:',
    groundingStatus,
    'Learner hypotheses:',
    hypotheses,
    'Answer candidates derivable from the tutor model of the learner record:',
    candidates,
    'Use this as advisory context only. Do not mention DAGs, coverage, missing counts, hidden paths, or internal state.',
    '[End tutor-only redacted learner-DAG model]',
  ].join('\n');
}

export function projectTutorStubHumanDiscourseContext(
  frame,
  { includeQuestionSupport = true, includeDefaultResponseShape = true } = {},
) {
  if (!frame || frame.mode === 'strict_dag') return '';
  const scaffold = frame.scaffoldState || {};
  const branch = scaffold.branch || {};
  const sideArc = frame.sideArc || {};
  const discoursePlane = frame.discoursePlane || null;
  const proofDebt = frame.proofDebt || {};
  const audit = frame.warrantPremiseAudit || {};
  const compression = frame.stepCompression || {};
  const generousInference = frame.generousInference || null;
  const conversationalCompletion = frame.conversationalCompletion || null;
  const questionSupport = frame.questionSupport || null;
  const due = discoursePlane?.freeze_clue_release ? [] : scaffold.releaseState?.dueNow || [];
  const latest = scaffold.releaseState?.latestReleased || null;
  const promptRule =
    frame.mode === 'defeasible_human_scaffold'
      ? 'Treat plausible learner leaps as compressed human reasoning. Keep obvious omitted bridges as internal proof debt, and surface a warrant gap only when the leap is unsafe, conflicting, or would close the case.'
      : 'Frame one local warrant in ordinary language while preserving the strict proof audit; do not expand the whole proof chain or license the final answer early.';
  if (discoursePlane?.plane === 'instructional_meta') {
    return [
      '[Tutor-only human discourse scaffold]',
      `Mode: ${frame.mode}; strict DAG remains the audit, but the learner-facing scaffold is active.`,
      'Discourse plane: instructional repair. The learner is asking about the explanation itself, not contributing a proposition to the inquiry. Keep the learner-DAG and clue release frozen for this turn.',
      sideArc.detected
        ? `Side arc: ${sideArc.type}. Repair the explanation completely before any later return to the inquiry.`
        : 'Repair the explanation completely before any later return to the inquiry.',
      'The public inquiry question remains paused. Do not quote it, restate it, or ask any other question in this turn.',
      includeDefaultResponseShape
        ? 'Response shape: directly acknowledge the wording problem, restate the immediately preceding tutor point in plain words, and optionally end with one declarative invitation to unpack another phrase.'
        : null,
      'Never mention scaffold state, proof debt, side arcs, DAGs, premise ids, rule ids, hidden facts, or release schedules.',
      '[End tutor-only human discourse scaffold]',
    ]
      .filter(Boolean)
      .join('\n');
  }
  return [
    '[Tutor-only human discourse scaffold]',
    `Mode: ${frame.mode}; strict DAG remains the audit, but the learner-facing scaffold is active.`,
    discoursePlane?.plane === 'instructional_meta'
      ? 'Discourse plane: instructional repair. The learner is asking about the explanation itself, not contributing a proposition to the inquiry. Keep the learner-DAG and clue release frozen for this turn.'
      : null,
    compression.enabled
      ? `Step compression: on; ${compression.policy || 'accept obvious public bridges as implied'}; max explicit demands per turn ${compression.maxExplicitDemandsPerTurn ?? 1}.`
      : null,
    `Current branch: ${branch.label || branch.id || 'open scaffold'}.`,
    scaffold.localQuestion ? `Local question: ${scaffold.localQuestion}` : null,
    scaffold.warrantFrame ? `Warrant frame: ${scaffold.warrantFrame}` : null,
    scaffold.joinReminder ? `Join reminder: ${scaffold.joinReminder}` : null,
    due.length
      ? `Evidence available now: ${due
          .map(
            (row) =>
              `${row.via === 'director' ? 'scene evidence' : 'tutor exhibit'}: ${oneLine(row.surface, { max: 120 })}`,
          )
          .join(' | ')}`
      : latest
        ? `Latest public evidence: ${oneLine(latest.surface, { max: 140 })}`
        : null,
    generousInference.applied ? 'Contextual answer resolution: APPLIED with high confidence.' : null,
    generousInference.applied ? `Resolved learner move: ${generousInference.resolvedMeaning}` : null,
    generousInference.applied ? `Authoritative next-turn rule: ${generousInference.tutorInstruction}` : null,
    conversationalCompletion?.resolved
      ? `Conversational completion: ${conversationalCompletion.status}. The immediately preceding local question is closed in learner-facing discourse.`
      : null,
    conversationalCompletion?.resolved
      ? `Accepted learner meaning: ${conversationalCompletion.acceptedMeaning || conversationalCompletion.learnerSurface}`
      : null,
    conversationalCompletion?.instruction
      ? `Authoritative completion rule: ${conversationalCompletion.instruction}`
      : null,
    sideArc.detected
      ? discoursePlane?.plane === 'instructional_meta'
        ? `Side arc: ${sideArc.type}. Repair the explanation completely in this turn. Do not return to the local evidence question until a later learner turn.`
        : `Side arc: ${sideArc.type}. Answer the learner's clarification/trust/affect need briefly, then ${sideArc.returnTarget?.afterSideArc || 'return to the local evidence question'}.`
      : 'Side arc: none detected; stay on the local warrant.',
    `Proof debt status: ${proofDebt.status || 'unknown'}; open=${proofDebt.counts?.open ?? 0}; harmful=${proofDebt.counts?.harmful ?? 0}.`,
    proofDebt.open?.length ? `Open proof debt:\n${compactAuditRows(proofDebt.open)}` : null,
    proofDebt.elision?.applied
      ? `Compressed bridge accepted: ${proofDebt.elision.count} ordinary warrant row(s) are elided from learner-facing demands.`
      : null,
    proofDebt.elision?.tutorInstruction || null,
    // proofDebt.open already contains every non-elided missing warrant. Rendering
    // audit.warrants.missing again duplicated learner-derived context and made the
    // prompt audit mistake repeated bookkeeping for repeated instructions.
    audit.premises?.suppressedOrPrivate?.length || audit.premises?.illicitHidden?.length
      ? `Hidden/private premise risk:\n${compactAuditRows([
          ...(audit.premises?.suppressedOrPrivate || []),
          ...(audit.premises?.illicitHidden || []),
        ])}`
      : null,
    promptRule,
    includeQuestionSupport && questionSupport
      ? `Question support: ${questionSupport.answerability}; modality ${questionSupport.modality}. ${questionSupport.reason}`
      : null,
    includeQuestionSupport && questionSupport?.tutorInstruction
      ? `Authoritative question rule: ${questionSupport.tutorInstruction}`
      : null,
    "Learner-facing behavior: use plain public evidence language, answer side clarifications briefly, and usually move with the learner's compressed inference rather than forcing them to spell out every link.",
    'When the learner skips an obvious public bridge, do not quiz them on it. Carry the bridge internally as implied proof debt and continue to the next useful pressure.',
    includeQuestionSupport && questionSupport?.answerability === 'direction_only_until_evidence_is_public'
      ? 'This epistemic-affordance rule overrides the local question, response action, and expected DAG move if any of them would ask the learner to supply unseen information.'
      : null,
    generousInference.applied
      ? 'The immediately preceding local question is closed for learner-facing purposes. Do not paraphrase it into another question, ask for a name, ask what it licenses, or request a public-record restatement. The strict learner-DAG may remain incomplete as an audit; that incompleteness must not control this spoken turn.'
      : null,
    'Ask for an explicit warrant only if the learner is about to name/confirm a suspect, contradicts public evidence, relies on unstaged evidence, or reaches a conclusion that would be false without the missing bridge.',
    includeDefaultResponseShape && discoursePlane?.plane === 'instructional_meta'
      ? 'Response shape: acknowledge the comprehension problem, restate the latest tutor point in plain words, and end without a proof question or new clue.'
      : includeDefaultResponseShape
        ? 'Default response shape: one short acknowledgement, one sentence naming the live evidence pressure, one light question. Avoid lists of routes, ledgers, or multiple required subclaims.'
        : null,
    'Never mention scaffold state, proof debt, side arcs, DAGs, premise ids, rule ids, hidden facts, or release schedules.',
    '[End tutor-only human discourse scaffold]',
  ]
    .filter(Boolean)
    .join('\n');
}

export function projectTutorStubDialogueClosureContext(frame) {
  if (!frame?.enabled || (!frame.mandatory && !frame.available)) return '';
  if (frame.phase === 'final_checkin_response') {
    return [
      '[Tutor-only dialogue closure]',
      'Phase: one final learner check-in after the case reached closure.',
      'Answer only the learner’s check-in from the public transcript. Do not introduce new evidence or restart the proof sequence.',
      'End with an explicit statement that the case, book, or inquiry is closed and complete.',
      'Do not ask any further question. This is the terminal tutor turn.',
      '[End tutor-only dialogue closure]',
    ].join('\n');
  }
  if (frame.mandatory) {
    return [
      '[Tutor-only dialogue closure]',
      `Closure basis: ${frame.basis}. The final conclusion is grounded and asserted; the dialogue must now wind down.`,
      'Briefly acknowledge the learner’s result and name the decisive public chain in ordinary language.',
      'Explicitly say that the case, book, or inquiry is closed. Do not ask another proof question.',
      frame.allowCheckIn
        ? 'You may end with one optional check-in about whether the learner wants one link revisited. If you ask it, it must be the only question.'
        : 'Do not ask a follow-up question; end the dialogue now.',
      '[End tutor-only dialogue closure]',
    ].join('\n');
  }
  return [
    '[Tutor-only dialogue closure]',
    'The authored proof DAG is now fully public, so conversational closure is available even if the strict learner-record audit remains incomplete.',
    'Do not announce the final verdict unless the learner’s current public move genuinely settles the public question.',
    'If you do state or confirm the final verdict, explicitly close the case instead of returning to another proof prompt.',
    frame.allowCheckIn
      ? 'After closing, you may ask one optional final check-in about a link to revisit; it must be the only question.'
      : 'If you close, do not ask a follow-up question.',
    'If the learner has not settled the public question, continue normally without pretending the dialogue is closed.',
    '[End tutor-only dialogue closure]',
  ].join('\n');
}

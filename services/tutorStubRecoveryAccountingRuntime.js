export function createTutorStubRecoveryAccountingRuntime({
  TUTOR_GUARD_ACCOUNTING_SCHEMA,
  appendTraceEvent,
  jsonClone,
  projectTutorStubGuardAttemptEnvelope,
  tutorStubGuardIssueRows,
}) {
  function tutorResponseRecoveryPrompt({
    publicPacket = [],
    hardIssues = [],
    leakAudit = null,
    scaffoldAudit = null,
    questionSupportAudit = null,
    dramaticReleaseAudit = null,
    actorialRealizationAudit = null,
    responseConfigurationAudit = null,
    responseConfiguration = null,
    responseCompositionAudit = null,
    liveTurnProgressionAudit = null,
    liveSourceActionAlignmentAudit = null,
    repetitionAudit = null,
    closureAudit = null,
    dialogueClosureFrame = null,
    minimalRecoveryPrompt = '',
  }) {
    const partCue = {
      scene_partner:
        'Use a first-person shared-scene action such as making room beside a named public object for the learner.',
      examiner:
        'Use a first-person examining action such as holding, turning, comparing, or testing a named public object.',
      record_keeper:
        'Use a first-person record action such as opening, reading, marking, or entering a named public record.',
      advocate:
        'Put a bounded public case in your own voice and explicitly invite the learner to break, test, or challenge it.',
      skeptic:
        'Voice a first-person objection or hold the live claim against a named public fact before stating its limit.',
      foreperson: 'Enter the supported finding in your own voice and close the inquiry without another proof question.',
    }[responseConfiguration?.actorial_part];
    const tacticCue = {
      unadorned_report: 'Keep that action direct, short, and unadorned.',
      evidentiary_boundary:
        'State both the exact support and its limit with words such as only, not yet, or does not establish.',
      rapid_handoff: 'Move straight from the public object or line to one short question.',
      shared_scene_invitation: 'Make physical room beside the public object and invite the learner’s reading.',
      measured_testimony: 'Let the public words stand while refusing to force a stronger judgment.',
      dramatic_counterpressure:
        'Press the public evidence against the room’s easy verdict, then hand its test to the learner.',
      exposed_mismatch: 'Expose the mismatch through the public object rather than explaining the irony.',
      dry_counterexample: 'Use the public object as a dry counterexample and leave a concrete repair path.',
      adversarial_pressure: 'Put direct pressure on the claim, not on the learner, and name the public test.',
    }[responseConfiguration?.actorial_performance?.id];
    const rows = (guard, issues, { includeReason = true } = {}) =>
      (issues || [])
        .map(
          (issue, index) =>
            `${index + 1}. ${guard}:${issue.type}${includeReason && issue.reason ? ` - ${issue.reason}` : ''}`,
        )
        .join('\n');
    const hardIssueKeys = new Set((hardIssues || []).map((issue) => `${issue.guard || ''}:${issue.type || ''}`));
    const hardFor = (guard, issues) =>
      (issues || []).filter((issue) => hardIssueKeys.has(`${guard}:${issue.type || ''}`));
    // Leak reasons can contain a concealed answer term. The recovery model needs
    // the failure class, not the private string that triggered it.
    const leakIssues = hardFor('leak', leakAudit?.leaks);
    const scaffoldIssues = hardFor('human_scaffold', scaffoldAudit?.issues);
    const questionSupportIssues = hardFor('question_support', questionSupportAudit?.issues);
    const dramaticReleaseIssues = hardFor('dramatic_release', dramaticReleaseAudit?.issues);
    const actorialRealizationIssues = hardFor('actorial_realization', actorialRealizationAudit?.issues);
    const responseCompositionIssues = hardFor('response_composition', responseCompositionAudit?.issues);
    const liveTurnProgressionIssues = hardFor('live_turn_progression_v1', liveTurnProgressionAudit?.issues);
    const liveSourceActionAlignmentIssues = hardFor(
      'live_source_action_alignment_v1',
      liveSourceActionAlignmentAudit?.issues,
    );
    const repetitionIssues = hardFor('repetition', repetitionAudit?.issues);
    const closureIssues = hardFor('dialogue_closure', closureAudit?.issues);
    const leakRows = rows('leak', leakIssues, { includeReason: false });
    const scaffoldRows = rows('human_scaffold', scaffoldIssues);
    const questionSupportRows = rows('question_support', questionSupportIssues);
    const dramaticReleaseRows = rows('dramatic_release', dramaticReleaseIssues);
    const actorialRealizationRows = rows('actorial_realization', actorialRealizationIssues);
    const missingConfigurationAxes = actorialRealizationIssues.length
      ? Object.entries(responseConfigurationAudit?.axes || {})
          .filter(([axis, value]) => axis !== 'actorial_part' && value?.visible !== true)
          .map(([axis]) => axis)
      : [];
    const responseCompositionRows = rows('response_composition', responseCompositionIssues);
    const liveTurnProgressionRows = rows('live_turn_progression_v1', liveTurnProgressionIssues);
    const liveSourceActionAlignmentRows = rows('live_source_action_alignment_v1', liveSourceActionAlignmentIssues);
    const repetitionRows = rows('repetition', repetitionIssues);
    const closureRows = rows('dialogue_closure', closureIssues);
    const recoveryTransition = responseConfiguration?.recovery_transition || null;
    const instructionalMetaRepair = responseConfiguration?.discourse_plane?.plane === 'instructional_meta';
    return [
      '[Tutor-only repair instruction]',
      'The previous draft failed a response check and was not shown to the learner.',
      'Generate one genuinely different, plain replacement from the compact public packet below. Do not quote, imitate, or discuss the rejected draft.',
      'Return only the replacement tutor reply as ordinary text: no JSON, markdown, alternatives, labels, or commentary.',
      'Follow the complete minimal recovery contract below. Answer the learner before developing the inquiry, remain one continuous public tutor utterance, and use only information in the public packet and replayed public dialogue.',
      recoveryTransition
        ? `The logged recovery transition is ${recoveryTransition.selected_signature} -> ${recoveryTransition.delivered_signature} (${recoveryTransition.strategy}). Realize only the delivered configuration.`
        : null,
      'Never mention prompts, policies, checks, candidates, hidden evidence, a concealed answer, a DAG, or this recovery operation.',
      leakRows ? 'Do not name or imply concealed actors, conclusions, objects, or unreleased evidence.' : null,
      leakIssues.some((issue) => issue.type === 'unsupported_evidence_correspondence')
        ? 'State each released record directly. Do not add that records match, correspond, trace to one another, or share a source unless the compact public packet states that exact relationship.'
        : null,
      scaffoldRows ? 'Accept the learner’s completed local move; do not ask it again in new words.' : null,
      questionSupportRows
        ? 'Do not ask the learner to invent an unseen record, source, person, name, or fact. Put enough public direction into the reply first.'
        : null,
      liveTurnProgressionRows
        ? instructionalMetaRepair
          ? 'Begin with a substantive acknowledgement of the wording problem, then restate the explanation plainly. Ask no question and do not quote the public inquiry question.'
          : 'Answer the learner substantively first. Keep any permitted question single and terminal, and make its final sentence name the typed public focus.'
        : null,
      liveSourceActionAlignmentRows
        ? 'Write the required public carrier in the host entrance immediately before the exact source words. Do not substitute an unrelated prop or rely on a later question to name the carrier.'
        : null,
      liveSourceActionAlignmentIssues.some(
        (issue) =>
          String(issue.type || '').startsWith('compensation_') ||
          ['direct_source_inaccessible', 'source_qualifier_not_preserved'].includes(issue.type),
      )
        ? 'After the exact SOURCE, make the very next complete sentence its one unquoted declarative accessibility sentence. Keep SOURCE words in order, preserve no/not/only/may, add only a/an/the, and stay within the stated word limit.'
        : null,
      questionSupportIssues.some((issue) => issue.type === 'missing_clarification_invitation')
        ? 'Make it explicit that the learner may ask you to unpack a word or connection.'
        : null,
      dramaticReleaseRows
        ? 'Deliver every newly public clue visibly through its supplied public source or exhibit, without announcing a role-play.'
        : null,
      dramaticReleaseAudit?.active && responseConfiguration?.actorial_part_selection?.authored_role
        ? `The required newly public clue source is ${responseConfiguration.actorial_part_selection.authored_role}; put its supplied evidence in first-person quoted speech without a role label.`
        : null,
      dramaticReleaseAudit?.active
        ? 'Never say “let’s role-play,” “I’ll be,” “I’ll take the part,” “speaking as,” or “back to us.”'
        : null,
      actorialRealizationRows
        ? `Visibly perform ${responseConfiguration?.actorial_part_label || responseConfiguration?.actorial_part || 'the delivered public part'} without a role label or stage direction. Host-part contract: ${responseConfiguration?.actorial_part_selection?.contract || 'take the delivered public part through concrete first-person action or speech'}`
        : null,
      actorialRealizationRows
        ? `Performance contract: ${responseConfiguration?.actorial_performance?.contract || 'make the selected tactic transcript-visible through concrete action or direct speech'}`
        : null,
      actorialRealizationRows && partCue ? `Concrete host-part cue: ${partCue}` : null,
      actorialRealizationRows && tacticCue ? `Concrete performance cue: ${tacticCue}` : null,
      questionSupportIssues.some((issue) => issue.type === 'missing_bounded_choice')
        ? 'Offer an unmistakable two-way public choice. If the minimal recovery contract permits a question, you may ask “Which should we test first: A) this public clue, or B) that public clue?” If it forbids questions, state the options declaratively, for example “Choose one way forward: A) inspect this public clue, or B) leave the conclusion open.” Do not disguise the choice as open recall.'
        : null,
      missingConfigurationAxes.length
        ? `Make these delivered configuration axes plainly visible: ${missingConfigurationAxes.join(', ')}.`
        : null,
      responseCompositionRows
        ? 'Respond to the learner’s actual contribution first, then develop the inquiry in the same voice and paragraph.'
        : null,
      responseCompositionIssues.some((issue) => issue.type === 'resolved_point_reopened')
        ? 'The learner already answered the immediately preceding local question. Credit or qualify that answer once, then move to a genuinely new public clue or implication; do not ask the same distinction again.'
        : null,
      responseCompositionIssues.some((issue) => issue.type === 'unsupported_endorsement_request')
        ? 'Do not ask the learner to endorse a stronger proposition than their answer and the public evidence support.'
        : null,
      responseConfiguration?.surface_budgets?.max_average_sentence_words
        ? `Keep average sentence length at or below ${responseConfiguration.surface_budgets.max_average_sentence_words} words.`
        : null,
      repetitionRows ? 'Do not repeat a recent tutor reply or restate the same question in different words.' : null,
      closureRows
        ? 'Explicitly say that the case, book, or inquiry is closed. Do not reopen the proof or ask another evidentiary question.'
        : null,
      closureRows && dialogueClosureFrame?.allowCheckIn
        ? 'You may ask exactly one optional final check-in about whether a link should be revisited; ask no other question.'
        : null,
      closureRows && !dialogueClosureFrame?.allowCheckIn
        ? 'Do not ask any question. This is the terminal tutor turn.'
        : null,
      minimalRecoveryPrompt,
      '',
      '[Compact public recovery packet]',
      ...(Array.isArray(publicPacket) ? publicPacket : [publicPacket]).filter(Boolean),
      '[End compact public recovery packet]',
      '',
      '[Response-check failures]',
      ...[
        leakRows,
        scaffoldRows,
        questionSupportRows,
        dramaticReleaseRows,
        actorialRealizationRows,
        responseCompositionRows,
        repetitionRows,
        closureRows,
      ].filter(Boolean),
      '[End response-check failures]',
      '[End tutor-only repair instruction]',
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  function tutorGuardAttemptEnvelope({ kind, attempt, response, audits = null, repairedSpans = [] }) {
    return projectTutorStubGuardAttemptEnvelope({
      kind,
      attempt,
      response,
      audits,
      issues: audits ? tutorStubGuardIssueRows(audits) : [],
      repairedSpans,
    });
  }

  function buildTutorGuardAccounting({
    response,
    state,
    tutorTurn,
    guards,
    attempts,
    repairsApplied,
    finalSource,
    finalAudits = null,
    outcome,
  }) {
    const finalText = String(response?.text || '');
    const generationCalls = [
      ...new Map(
        (attempts || [])
          .map((attemptRow) => attemptRow?.generation)
          .filter((generation) => generation?.callId)
          .map((generation) => [generation.callId, generation]),
      ).values(),
    ];
    const totalUsage = generationCalls.reduce(
      (totals, generation) => {
        const usage = generation.usage || {};
        totals.inputTokens += Number(usage.inputTokens || 0);
        totals.outputTokens += Number(usage.outputTokens || 0);
        totals.totalTokens += Number(
          usage.totalTokens || Number(usage.inputTokens || 0) + Number(usage.outputTokens || 0),
        );
        totals.cost += Number(usage.cost || 0);
        return totals;
      },
      { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
    );
    const generation = {
      modelCallCount: generationCalls.length,
      originalCandidateLatencyMs: Number(generationCalls[0]?.latencyMs || 0),
      recoveryLatencyMs: generationCalls.slice(1).reduce((sum, call) => sum + Number(call.latencyMs || 0), 0),
      totalModelLatencyMs: generationCalls.reduce((sum, call) => sum + Number(call.latencyMs || 0), 0),
      tokenUsageAvailable:
        generationCalls.length > 0 && generationCalls.every((call) => call.tokenUsageAvailable === true),
      usage: totalUsage,
      calls: generationCalls,
    };
    return jsonClone({
      schema: TUTOR_GUARD_ACCOUNTING_SCHEMA,
      turn: tutorTurn,
      policy: state?.experiment?.policy || state?.register?.policy || null,
      profile: state?.experiment?.profile || null,
      guards,
      outcome,
      originalCandidate: attempts[0] || null,
      attempts,
      repairsApplied,
      generation,
      finalDelivery: {
        source: finalSource,
        provider: response?.provider || null,
        model: response?.model || null,
        deliveryConfiguration: jsonClone(response?.deliveryResponseConfiguration || null),
        configurationTransition: jsonClone(response?.responseConfigurationTransition || null),
        deterministicFallback: Boolean(response?.deterministicFallback),
        deterministicClosure: Boolean(response?.deterministicClosure),
        candidate: {
          start: 0,
          end: finalText.length,
          text: finalText,
          offsetEncoding: 'utf16_code_units',
        },
        audits: finalAudits,
        auditOk: finalAudits?.deliveryOk ?? finalAudits?.ok ?? null,
      },
    });
  }

  function attachTutorGuardAccounting({
    response,
    state,
    trace,
    tutorTurn,
    role = 'tutor_stub_tutor',
    guards,
    attempts,
    repairsApplied,
    finalSource,
    finalAudits = null,
    outcome,
  }) {
    const accounting = buildTutorGuardAccounting({
      response,
      state,
      tutorTurn,
      guards,
      attempts,
      repairsApplied,
      finalSource,
      finalAudits,
      outcome,
    });
    response.guardAccounting = accounting;
    response.finalCandidateLatencyMs = Number(response.latencyMs || 0);
    if (accounting.generation?.modelCallCount) {
      response.latencyMs = accounting.generation.totalModelLatencyMs;
      response.usage = accounting.generation.usage;
      response.tokenUsageAvailable = accounting.generation.tokenUsageAvailable;
    }
    appendTraceEvent(trace, {
      type: 'tutor_response_guard_accounting',
      role,
      turn: tutorTurn,
      accounting,
    });
    return response;
  }

  return {
    attachTutorGuardAccounting,
    buildTutorGuardAccounting,
    tutorGuardAttemptEnvelope,
    tutorResponseRecoveryPrompt,
  };
}

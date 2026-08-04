export function createTutorStubLearnerEvidenceRuntime({
  HUMAN_DISCOURSE_FRAME_SCHEMA,
  HUMAN_DISCOURSE_PHASE,
  appendTraceEvent,
  buildSideArcState,
  buildStrictDagAuditState,
  buildTutorStubProofDebtState,
  buildTutorStubQuestionSupport,
  buildTutorStubWorldScaffold,
  buildTutorStubLearnerDagPreflight,
  factSurface,
  latestTutorMessage,
  normalizeDiscourseRows,
  normalizeHumanDiscourseExtraction,
  oneLine,
  projectTutorStubCommittedReleaseRows,
  projectTutorStubCurrentReleaseRows,
  projectTutorStubLearnerPublicEvidenceState,
  projectTutorStubNextReleaseRow,
  projectTutorStubPublicReleaseLedger,
  projectTutorStubPublicStocktakeRows,
  projectTutorStubScaffoldState,
  projectTutorStubSpeakerPublicPremise,
  projectTutorStubWarrantPremiseAudit,
  resolveTutorStubConversationalCompletion,
  resolveTutorStubDiscoursePlane,
  resolveTutorStubGenerousInference,
  stagedEvidenceRows,
}) {
  function currentReleaseRows(state, tutorTurn) {
    return projectTutorStubCurrentReleaseRows(state?.releasePacing, state?.world, tutorTurn, {
      pointOfAction: state?.pointOfAction?.current || null,
      projectPremise: projectTutorStubSpeakerPublicPremise,
    });
  }

  function committedReleaseRows(state, throughTurn = Number.POSITIVE_INFINITY) {
    return projectTutorStubCommittedReleaseRows(state?.releasePacing, state?.world, throughTurn, {
      fallbackRows: stagedEvidenceRows,
      projectPremise: projectTutorStubSpeakerPublicPremise,
    });
  }

  function publicReleaseLedger(state, throughTurn = Number.POSITIVE_INFINITY) {
    return projectTutorStubPublicReleaseLedger(committedReleaseRows(state, throughTurn));
  }

  function learnerPublicEvidenceState(state, tutorTurn) {
    return projectTutorStubLearnerPublicEvidenceState(committedReleaseRows(state, tutorTurn));
  }

  function learnerDagPreflightForTurn(state, tutorTurn, { traceSource = null } = {}) {
    if (!state?.learnerDag?.enabled || !state.world) return null;
    const publicEvidence = learnerPublicEvidenceState(state, tutorTurn);
    const preflight = buildTutorStubLearnerDagPreflight({
      world: state.world,
      record: state.learnerDag.record,
      tutorTurn,
      publicStagedEvidence: publicEvidence.publicStagedEvidence,
    });
    if (traceSource) {
      appendTraceEvent(state.trace, {
        type: 'learner_dag_preflight',
        turn: tutorTurn,
        source: traceSource,
        timing: 'before_model_call',
        preflight,
      });
    }
    return preflight;
  }

  function nextReleaseRow(state) {
    return projectTutorStubNextReleaseRow(state?.releasePacing, state?.world);
  }

  function activeDramaturgyAct(world, tutorTurn) {
    const acts = world?.dramaturgy?.acts;
    if (!Array.isArray(acts)) return null;
    const turn = Number(tutorTurn);
    if (!Number.isFinite(turn)) return null;
    const act = acts.find((entry) => {
      const [start, end] = Array.isArray(entry?.turns) ? entry.turns.map(Number) : [];
      return Number.isFinite(start) && Number.isFinite(end) && turn >= start && turn <= end;
    });
    if (!act) return null;
    return {
      act: act.act || null,
      title: String(act.title || '').trim() || null,
      intent: String(act.intent || '').trim() || null,
      turns: Array.isArray(act.turns) ? act.turns : null,
    };
  }

  function branchTemplateForEvidence(row = {}, world = null, { conclusionReady = false } = {}) {
    return buildTutorStubWorldScaffold({ world, evidence: row, conclusionReady });
  }

  function scaffoldBranchForTurn({ state, world, tutorTurn, tutorLearnerDag }) {
    if (!world) return branchTemplateForEvidence({}, world);
    const dueNow = currentReleaseRows(state, tutorTurn);
    if (dueNow.length) return branchTemplateForEvidence(dueNow[0], world);
    const latestReleased = committedReleaseRows(state, tutorTurn).at(-1);
    const assessment = tutorLearnerDag?.model?.assessment || tutorLearnerDag?.assessment || {};
    if (assessment.finalSecretEntailed || assessment.bottleneck === 'assertion_gap') {
      return branchTemplateForEvidence(latestReleased || {}, world, { conclusionReady: true });
    }
    if (latestReleased) return branchTemplateForEvidence(latestReleased, world);
    return branchTemplateForEvidence({}, world);
  }

  function buildScaffoldState({ state, tutorTurn, dagMode, tutorLearnerDag }) {
    const world = state?.world || null;
    return projectTutorStubScaffoldState({
      dagMode,
      tutorTurn,
      activeAct: activeDramaturgyAct(world, tutorTurn),
      branch: scaffoldBranchForTurn({ state, world, tutorTurn, tutorLearnerDag }),
      dueNow: currentReleaseRows(state, tutorTurn),
      released: committedReleaseRows(state, tutorTurn),
      nextRelease: nextReleaseRow(state),
    });
  }

  function buildWarrantPremiseAudit({
    dagMode,
    tutorLearnerDag,
    classification = null,
    learnerText = '',
    world = null,
  }) {
    const model = tutorLearnerDag?.model || tutorLearnerDag || null;
    const record = model?.learnerRecord || {};
    const explicitWarrants = projectTutorStubPublicStocktakeRows(record.voicedDerived, 'voiced_derived_public_claim');
    const explicitPublicPremises = projectTutorStubPublicStocktakeRows(record.grounded, 'grounded_public_record');
    const extraction = normalizeHumanDiscourseExtraction(
      tutorLearnerDag?.accepted?.humanDiscourse || tutorLearnerDag?.extractor?.humanDiscourse,
    );
    const turn = classification?.turn || {};
    const overleap = /overleaps_evidence|distorts_public_evidence|overconfident|answer_seeking/iu.test(
      [turn.evidence_use, turn.epistemic_stance, turn.discourse_move].filter(Boolean).join(' '),
    );
    const heuristicMissingWarrants =
      overleap && explicitWarrants.length === 0
        ? [
            {
              surface: oneLine(learnerText, { max: 180 }),
              reason: 'classifier marked overreach or answer-seeking before an explicit public warrant was stored',
              source: 'heuristic_overleap',
            },
          ].filter((row) => row.surface)
        : [];
    const rejectedDebt = normalizeDiscourseRows(
      (tutorLearnerDag?.rejected || [])
        .filter((row) => row?.type === 'derive' || row?.type === 'assert' || row?.reason === 'not staged')
        .map((row) => ({
          surface: Array.isArray(row.value) ? factSurface(world, row.value) : String(row.value || ''),
          reason: row.reason || 'rejected by strict learner-DAG update',
        })),
      'strict_dag_rejection',
    );
    const strictProofAdoptions = [
      ...(tutorLearnerDag?.accepted?.adopt || []).map((premise) => ({
        surface: premise,
        source: 'strict_adopted_premise',
      })),
      ...(tutorLearnerDag?.accepted?.derive || []).map((fact) => ({
        surface: factSurface(world, fact),
        source: 'strict_derived_public_claim',
      })),
    ].filter((row) => row.surface);
    return projectTutorStubWarrantPremiseAudit({
      dagMode,
      model,
      extraction,
      explicitWarrants,
      explicitPublicPremises,
      heuristicMissingWarrants,
      rejectedDebt,
      strictProofAdoptions,
    });
  }

  function buildHumanDiscourseFrame({ state, tutorTurn, tutorLearnerDag, classification = null, learnerText = '' }) {
    const dagMode = state?.dagMode || 'strict_dag';
    const scaffoldState = buildScaffoldState({ state, tutorTurn, dagMode, tutorLearnerDag });
    const generousInference = resolveTutorStubGenerousInference({
      mode: dagMode,
      learnerText,
      previousTutorText: latestTutorMessage(state),
      branchId: scaffoldState.branch?.id || null,
      classification,
    });
    const conversationalCompletion = resolveTutorStubConversationalCompletion({
      mode: dagMode,
      learnerText,
      previousTutorText: latestTutorMessage(state),
      classification,
      tutorLearnerDag,
      generousInference,
    });
    if (tutorLearnerDag) tutorLearnerDag.conversationalCompletion = conversationalCompletion;
    const sideArc = buildSideArcState({
      dagMode,
      classification,
      learnerText,
      scaffoldState,
      generousInference,
    });
    const discoursePlane = resolveTutorStubDiscoursePlane({ learnerText, classification, sideArc });
    const warrantPremiseAudit = buildWarrantPremiseAudit({
      dagMode,
      tutorLearnerDag,
      classification,
      learnerText,
      world: state?.world || null,
    });
    const strictDag = buildStrictDagAuditState(tutorLearnerDag);
    const proofDebt = buildTutorStubProofDebtState({
      dagMode,
      warrantPremiseAudit,
      strictDag,
      classification,
      generousInference,
    });
    const questionSupport =
      dagMode === 'strict_dag' || discoursePlane.freeze_clue_release
        ? null
        : buildTutorStubQuestionSupport({
            tutorTurn,
            scaffoldState,
            assessment: tutorLearnerDag?.model?.assessment || tutorLearnerDag?.assessment || null,
            classification,
            learnerText,
            recentTurns: state?.turns || [],
            multipleChoice: Boolean(state?.multipleChoice),
          });
    return {
      schema: HUMAN_DISCOURSE_FRAME_SCHEMA,
      mode: dagMode,
      phase: HUMAN_DISCOURSE_PHASE,
      scaffoldActive: dagMode !== 'strict_dag',
      stepCompression: state?.humanDiscourse?.stepCompression || null,
      turn: tutorTurn,
      strictDag,
      scaffoldState,
      sideArc,
      discoursePlane,
      proofDebt,
      questionSupport,
      warrantPremiseAudit,
      generousInference,
      conversationalCompletion,
    };
  }

  return {
    buildHumanDiscourseFrame,
    committedReleaseRows,
    currentReleaseRows,
    learnerDagPreflightForTurn,
    learnerPublicEvidenceState,
    nextReleaseRow,
    publicReleaseLedger,
  };
}

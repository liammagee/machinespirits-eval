export function createTutorStubTutorDeliveryRuntime(dependencies = {}) {
  const {
    appendTraceEvent,
    auditTutorResponseLeak,
    auditTutorStubDramaticReleaseResponse,
    auditTutorStubReleaseDelivery,
    auditTutorStubRepetitionResponse,
    auditTutorStubResponseComposition,
    composeTutorStubFallbackWithUptake,
    corruptReliefTurn,
    formatTutorStubResponseComposition,
    tutorStubGuardDeliveryDecision,
    tutorStubGuardIssueRows,
  } = dependencies;

  return function bindTutorStubTutorDeliveryRuntime({
    boundaryPolicy,
    dramaticReleaseFrame,
    firstDraftContract,
    leakGuardEnabled,
    learnerText,
    recentTutorTexts,
    responseCompositionFrame,
    speakerPublicPremiseIds,
    state,
    trace,
    tutorTurn,
    world,
  }) {
    function preservableTutorUptake(audits) {
      if (
        (audits?.liveTurnProgressionAudit?.issues || []).some((issue) => issue.type === 'learner_uptake_not_realized')
      ) {
        return '';
      }
      if (
        (audits?.responseCompositionAudit?.issues || []).some((issue) =>
          ['missing_learner_uptake', 'generic_learner_uptake', 'verbatim_learner_echo'].includes(issue.type),
        )
      ) {
        return '';
      }
      const uptake = String(audits?.responseCompositionAudit?.segments?.uptake || '').trim();
      if (!uptake) return '';
      if (
        /\?/u.test(uptake) ||
        /^(?:what|which|who|whose|where|when|why|how|can|could|do|does|did|is|are|was|were|have|has|had|may|might|shall|should|will|would)\b/iu.test(
          uptake,
        )
      ) {
        return '';
      }
      if (/^(?:correct|exactly(?: so)?|fair|good|just so|right|yes)[.!]?$/iu.test(uptake)) return '';
      // A safe opening is not worth preserving when it is the very repetition
      // that caused this draft to be rejected. Let the deterministic uptake
      // selector choose a fresh acknowledgement for the repair/fallback.
      if (!auditTutorStubRepetitionResponse({ text: uptake, recentTutorTexts }).ok) return '';
      if (dramaticReleaseFrame?.active) {
        const duePremiseIds = dramaticReleaseFrame.entries.map((entry) => entry?.premise).filter(Boolean);
        const uptakeDeliveryAudit = auditTutorStubReleaseDelivery({
          text: uptake,
          world,
          premiseIds: duePremiseIds,
        });
        if (uptakeDeliveryAudit.deliveredPremises.length) return '';
        const uptakeReleaseAudit = auditTutorStubDramaticReleaseResponse({ text: uptake, frame: dramaticReleaseFrame });
        if (
          uptakeReleaseAudit.entranceVisible ||
          uptakeReleaseAudit.enactmentVisible ||
          uptakeReleaseAudit.exhibitHandoffVisible
        ) {
          return '';
        }
      }
      if (!leakGuardEnabled) return uptake;
      const uptakeLeakAudit = auditTutorResponseLeak({
        text: uptake,
        world,
        tutorTurn,
        learnerText,
        state,
        publicPremiseIds: speakerPublicPremiseIds,
      });
      return uptakeLeakAudit.ok ? uptake : '';
    }

    function ensureFallbackComposition(text, uptake) {
      const candidate = composeTutorStubFallbackWithUptake({ text, uptake });
      const baseAudit = auditTutorStubResponseComposition({
        text: candidate,
        frame: responseCompositionFrame,
        learnerText,
        firstDraftContract,
      });
      return baseAudit.ok ? formatTutorStubResponseComposition(baseAudit) || candidate : candidate;
    }

    function withTutorDeliveryDecision(
      audits,
      { allowActorialAdvisory = false, advisoryReason = null, role, attempt, terminalFallback = false } = {},
    ) {
      const deliveryDecision = tutorStubGuardDeliveryDecision(tutorStubGuardIssueRows(audits), {
        allowActorialAdvisory,
        boundaryPolicy,
        terminalFallback,
      });
      // Q3 corrupt relief: at a deliberately-corrupted learner turn the
      // experiment needs the MODEL's repair, not the composer's template —
      // so every remaining hard issue is demoted to advisory for this one
      // turn. Issues (including leaks) stay fully traced, just not blocked.
      const corruptRelief =
        !deliveryDecision.ok && typeof corruptReliefTurn === 'function' && corruptReliefTurn(tutorTurn);
      if (corruptRelief) {
        appendTraceEvent(trace, {
          type: 'tutor_corrupt_relief',
          role,
          turn: tutorTurn,
          attempt,
          demotedHardIssues: deliveryDecision.hardIssues || [],
        });
      }
      const result = {
        ...audits,
        deliveryOk: corruptRelief ? true : deliveryDecision.ok,
        deliveryDecision: corruptRelief
          ? {
              ...deliveryDecision,
              ok: true,
              corruptRelief: true,
              advisoryIssues: [...(deliveryDecision.advisoryIssues || []), ...(deliveryDecision.hardIssues || [])],
              hardIssues: [],
            }
          : deliveryDecision,
      };
      if (deliveryDecision.ok && deliveryDecision.advisoryIssues.length) {
        appendTraceEvent(trace, {
          type: 'tutor_response_delivery_advisory',
          role,
          turn: tutorTurn,
          attempt,
          accepted: true,
          advisoryIssues: deliveryDecision.advisoryIssues,
          reason: advisoryReason || 'optional actorial realization did not outweigh the passing hard response checks',
        });
      }
      return result;
    }

    function attachTutorDraftAudits(response, audits) {
      response.leakAudit = audits.leakAudit;
      response.scaffoldAudit = audits.scaffoldAudit;
      response.questionSupportAudit = audits.questionSupportAudit;
      response.dramaticReleaseAudit = audits.dramaticReleaseAudit;
      response.releaseDeliveryAudit = audits.releaseDeliveryAudit;
      response.actorialRealizationAudit = audits.actorialRealizationAudit;
      response.liveTurnProgressionAudit = audits.liveTurnProgressionAudit;
      response.liveSourceActionAlignmentAudit = audits.liveSourceActionAlignmentAudit;
      response.repetitionAudit = audits.repetitionAudit;
      response.closureAudit = audits.closureAudit;
      response.deliveryDecision = audits.deliveryDecision || null;
      return response;
    }

    function tutorResponseFromSimplifiedRecovery(recoveryResponse, text, candidateKind) {
      return {
        ...recoveryResponse,
        text,
        recoveryCandidateKind: candidateKind,
        recoveryStrategy: {
          schema: 'machinespirits.tutor-stub.guard-recovery.v1',
          parseMode: 'single_plain_text',
          parsed: Boolean(String(text || '').trim()),
          error: String(text || '').trim() ? null : 'empty simplified recovery candidate',
        },
      };
    }

    return {
      attachTutorDraftAudits,
      ensureFallbackComposition,
      preservableTutorUptake,
      tutorResponseFromSimplifiedRecovery,
      withTutorDeliveryDecision,
    };
  };
}

/**
 * Run the tutor-side adaptation work scheduled between dialogue turns.
 */
export function createEvaluationBetweenTurnAdaptationRuntime({ promptRewriter }) {
  async function advanceBetweenTurnAdaptation(state) {
    let {
      behavioralOverrides,
      learnerProfileOfTutor,
      sessionEvolution,
      strategyPlan,
      superegoEvolution,
      tutorProfileOfLearner,
    } = state;
    const {
      consolidatedTrace,
      conversationHistory,
      intersubjectiveEnabled,
      log,
      otherEgoBidirectional,
      otherEgoProfilingEnabled,
      priorSuperegoAssessments,
      promptRewritingEnabled,
      promptRewritingStrategy,
      quantitativeDispositionEnabled,
      rawProfile,
      strategyPlanningEnabled,
      superegoDispositionRewriting,
      totalTurnCount,
      turnIdx,
      turnResults,
    } = state;

    // ── Between-turn processing ──────────────────────────────────────────
    // Parallelized into groups by dependency:
    //   Group 1 (independent): ego self-refl, superego self-refl, tutor profile, learner profile
    //   Group 2 (depends on group 1): intersubjective, quantitative parse, strategy plan
    //   Group 3 (depends on group 2): learner generation
    // This collapses ~6-8 sequential LLM calls into ~3 parallel rounds.

    if (turnIdx < totalTurnCount - 1) {
      const betweenTurnStart = Date.now();

      // ── Group 1: Independent LLM calls in parallel ──────────────────
      const group1Promises = [];
      const group1Labels = [];

      // Ego self-reflection / prompt rewriting
      if (promptRewritingEnabled) {
        if (promptRewritingStrategy === 'self_reflection') {
          group1Promises.push(
            promptRewriter
              .synthesizeEgoSelfReflection({
                turnResults,
                consolidatedTrace,
                conversationHistory,
                config: rawProfile,
              })
              .catch((error) => {
                log(
                  `[evaluationRunner] Ego self-reflection failed, will fall back to template: ${error.message}`,
                  'warn',
                );
                return null;
              }),
          );
          group1Labels.push('ego_self_reflection');
        } else if (promptRewritingStrategy === 'llm') {
          group1Promises.push(
            promptRewriter
              .synthesizeDirectivesLLM({
                turnResults,
                consolidatedTrace,
                conversationHistory,
                config: rawProfile,
              })
              .catch((error) => {
                log(`[evaluationRunner] LLM rewriter failed, will fall back to template: ${error.message}`, 'warn');
                return null;
              }),
          );
          group1Labels.push('llm_rewrite');
        }
      }

      // Superego self-reflection / disposition rewriting
      if (superegoDispositionRewriting) {
        if (promptRewritingStrategy === 'self_reflection') {
          group1Promises.push(
            promptRewriter
              .synthesizeSupergoSelfReflection({
                turnResults,
                consolidatedTrace,
                conversationHistory,
                priorSuperegoAssessments,
                config: rawProfile,
              })
              .catch((error) => {
                log(`[evaluationRunner] Superego self-reflection failed: ${error.message}`, 'warn');
                return null;
              }),
          );
          group1Labels.push('superego_self_reflection');
        } else {
          group1Promises.push(
            promptRewriter
              .synthesizeSuperegoDisposition({
                turnResults,
                consolidatedTrace,
                conversationHistory,
                priorSuperegoAssessments,
                config: rawProfile,
              })
              .catch((error) => {
                log(`[evaluationRunner] Superego disposition rewriting failed: ${error.message}`, 'warn');
                return null;
              }),
          );
          group1Labels.push('superego_disposition');
        }
      }

      // Tutor profiles learner (Theory of Mind)
      if (otherEgoProfilingEnabled) {
        group1Promises.push(
          promptRewriter
            .synthesizeTutorProfileOfLearner({
              turnResults,
              consolidatedTrace,
              conversationHistory,
              priorProfile: tutorProfileOfLearner,
              config: rawProfile,
            })
            .catch((error) => {
              log(`[evaluationRunner] Tutor profile of learner failed: ${error.message}`, 'warn');
              return null;
            }),
        );
        group1Labels.push('tutor_profile');
      }

      // Learner profiles tutor (bidirectional Theory of Mind)
      if (otherEgoProfilingEnabled && otherEgoBidirectional) {
        group1Promises.push(
          promptRewriter
            .synthesizeLearnerProfileOfTutor({
              turnResults,
              consolidatedTrace,
              conversationHistory,
              priorProfile: learnerProfileOfTutor,
              config: rawProfile,
            })
            .catch((error) => {
              log(`[evaluationRunner] Learner profile of tutor failed: ${error.message}`, 'warn');
              return null;
            }),
        );
        group1Labels.push('learner_profile');
      }

      // Fire all group 1 calls in parallel
      const group1Results = await Promise.all(group1Promises);
      const group1Map = {};
      group1Labels.forEach((label, i) => {
        group1Map[label] = group1Results[i];
      });

      // ── Process group 1 results ─────────────────────────────────────

      // Ego self-reflection / prompt rewriting result
      if (promptRewritingEnabled) {
        if (promptRewritingStrategy === 'self_reflection') {
          const egoReflResult = group1Map['ego_self_reflection'];
          sessionEvolution = egoReflResult?.text ?? null;
          if (sessionEvolution) {
            log(`[evaluationRunner] Ego self-reflection generated for turn ${turnIdx + 1}`, 'info');
            consolidatedTrace.push({
              agent: 'ego_self_reflection',
              action: 'rewrite',
              turnIndex: turnIdx,
              contextSummary: `Ego self-reflection generated for turn ${turnIdx + 1}`,
              detail: sessionEvolution,
              metrics: egoReflResult?.metrics ?? null,
              timestamp: new Date().toISOString(),
            });
          } else {
            log(
              `[evaluationRunner] Ego self-reflection returned empty, falling back to template for turn ${turnIdx + 1}`,
              'warn',
            );
            sessionEvolution = promptRewriter.synthesizeDirectives({
              turnResults,
              consolidatedTrace,
              conversationHistory,
            });
          }
        } else if (promptRewritingStrategy === 'llm') {
          const llmResult = group1Map['llm_rewrite'];
          sessionEvolution = llmResult?.text ?? null;
          if (sessionEvolution) {
            log(`[evaluationRunner] LLM rewriter generated directives for turn ${turnIdx + 1}`, 'info');
          } else {
            log(
              `[evaluationRunner] LLM rewriter returned empty, falling back to template for turn ${turnIdx + 1}`,
              'warn',
            );
            sessionEvolution = promptRewriter.synthesizeDirectives({
              turnResults,
              consolidatedTrace,
              conversationHistory,
            });
          }
        } else {
          // Template-based directive synthesis (deterministic, no LLM call)
          sessionEvolution = promptRewriter.synthesizeDirectives({
            turnResults,
            consolidatedTrace,
            conversationHistory,
          });
        }
        if (sessionEvolution) {
          log(
            `[evaluationRunner] Prompt rewriter (${promptRewritingStrategy}) generated ${sessionEvolution.split('\n').length - 2} directives for turn ${turnIdx + 1}`,
            'info',
          );
        }
      }

      // Superego self-reflection / disposition result
      if (superegoDispositionRewriting) {
        if (promptRewritingStrategy === 'self_reflection') {
          const seReflResult = group1Map['superego_self_reflection'];
          superegoEvolution = seReflResult?.text ?? null;
          if (superegoEvolution) {
            log(`[evaluationRunner] Superego self-reflection generated for turn ${turnIdx + 1}`, 'info');
            consolidatedTrace.push({
              agent: 'superego_self_reflection',
              action: 'rewrite',
              turnIndex: turnIdx,
              contextSummary: `Superego self-reflection generated for turn ${turnIdx + 1}`,
              detail: superegoEvolution,
              metrics: seReflResult?.metrics ?? null,
              timestamp: new Date().toISOString(),
            });
          } else {
            // Self-reflection returned empty — fall back to LLM disposition rewriting
            log(
              `[evaluationRunner] Superego self-reflection returned empty, falling back to LLM disposition for turn ${turnIdx + 1}`,
              'warn',
            );
            try {
              const dispFallback = await promptRewriter.synthesizeSuperegoDisposition({
                turnResults,
                consolidatedTrace,
                conversationHistory,
                priorSuperegoAssessments,
                config: rawProfile,
              });
              superegoEvolution = dispFallback?.text ?? null;
            } catch (error) {
              log(`[evaluationRunner] Superego disposition fallback also failed: ${error.message}`, 'warn');
            }
          }
        } else {
          const dispResult = group1Map['superego_disposition'];
          superegoEvolution = dispResult?.text ?? null;
          if (superegoEvolution) {
            log(`[evaluationRunner] Superego disposition rewriter generated evolution for turn ${turnIdx + 1}`, 'info');
            consolidatedTrace.push({
              agent: 'superego_disposition',
              action: 'rewrite',
              turnIndex: turnIdx,
              contextSummary: `Disposition evolution generated for turn ${turnIdx + 1}`,
              detail: superegoEvolution,
              metrics: dispResult?.metrics ?? null,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      // Tutor profile of learner result
      if (otherEgoProfilingEnabled) {
        const tutorProfResult = group1Map['tutor_profile'];
        if (tutorProfResult?.text) {
          tutorProfileOfLearner = tutorProfResult.text;
          log(`[evaluationRunner] Tutor profile of learner generated for turn ${turnIdx + 1}`, 'info');
          consolidatedTrace.push({
            agent: 'tutor_other_ego',
            action: 'profile_learner',
            turnIndex: turnIdx,
            contextSummary: `Tutor built mental model of learner after turn ${turnIdx + 1}`,
            detail: tutorProfileOfLearner,
            metrics: tutorProfResult.metrics ?? null,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Learner profile of tutor result
      if (otherEgoProfilingEnabled && otherEgoBidirectional) {
        const learnerProfResult = group1Map['learner_profile'];
        if (learnerProfResult?.text) {
          learnerProfileOfTutor = learnerProfResult.text;
          log(`[evaluationRunner] Learner profile of tutor generated for turn ${turnIdx + 1}`, 'info');
          consolidatedTrace.push({
            agent: 'learner_other_ego',
            action: 'profile_tutor',
            turnIndex: turnIdx,
            contextSummary: `Learner built mental model of tutor after turn ${turnIdx + 1}`,
            detail: learnerProfileOfTutor,
            metrics: learnerProfResult.metrics ?? null,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // ── Group 2: Dependent on group 1 results ──────────────────────
      const group2Promises = [];
      const group2Labels = [];

      // Parse quantitative behavioral parameters (sync — no LLM call)
      if (quantitativeDispositionEnabled && superegoEvolution) {
        const parsed = promptRewriter.parseBehavioralParameters(superegoEvolution);
        if (parsed) {
          behavioralOverrides = parsed;
          log(
            `[evaluationRunner] Behavioral overrides parsed: threshold=${parsed.rejection_threshold}, max_rejections=${parsed.max_rejections}, priority=[${parsed.priority_criteria.join(',')}], deprioritized=[${parsed.deprioritized_criteria.join(',')}]`,
            'info',
          );
          consolidatedTrace.push({
            agent: 'behavioral_overrides',
            action: 'parse',
            turnIndex: turnIdx,
            contextSummary: `Quantitative behavioral params: threshold=${parsed.rejection_threshold}, max=${parsed.max_rejections}`,
            detail: JSON.stringify(parsed),
            timestamp: new Date().toISOString(),
          });
        } else {
          log(
            `[evaluationRunner] No behavioral parameters found in superego reflection for turn ${turnIdx + 1} (quantitative_disposition enabled but no <behavioral_parameters> block)`,
            'warn',
          );
        }
      }

      // Intersubjective recognition (depends on ego + superego self-reflections)
      if (intersubjectiveEnabled && superegoEvolution) {
        group2Promises.push(
          promptRewriter
            .synthesizeEgoResponseToSuperego({
              superegoReflection: superegoEvolution,
              egoReflection: sessionEvolution,
              turnResults,
              conversationHistory,
              config: rawProfile,
            })
            .catch((error) => {
              log(`[evaluationRunner] Intersubjective ego response failed: ${error.message}`, 'warn');
              return null;
            }),
        );
        group2Labels.push('intersubjective');
      }

      // Strategy planning (depends on tutor profile)
      if (strategyPlanningEnabled && tutorProfileOfLearner) {
        group2Promises.push(
          promptRewriter
            .synthesizeStrategyPlan({
              learnerProfile: tutorProfileOfLearner,
              turnResults,
              conversationHistory,
              config: rawProfile,
            })
            .catch((error) => {
              log(`[evaluationRunner] Strategy plan failed: ${error.message}`, 'warn');
              return null;
            }),
        );
        group2Labels.push('strategy');
      }

      // Fire group 2 in parallel (intersubjective + strategy are independent of each other)
      if (group2Promises.length > 0) {
        const group2Results = await Promise.all(group2Promises);
        const group2Map = {};
        group2Labels.forEach((label, i) => {
          group2Map[label] = group2Results[i];
        });

        // Process intersubjective result
        if (group2Map['intersubjective']) {
          const egoResponseText = group2Map['intersubjective']?.text ?? null;
          if (egoResponseText) {
            sessionEvolution = sessionEvolution ? sessionEvolution + '\n\n' + egoResponseText : egoResponseText;
            log(
              `[evaluationRunner] Intersubjective ego response to superego generated for turn ${turnIdx + 1}`,
              'info',
            );
            consolidatedTrace.push({
              agent: 'ego_intersubjective',
              action: 'respond_to_critic',
              turnIndex: turnIdx,
              contextSummary: `Ego responded to superego's self-reflection for turn ${turnIdx + 1}`,
              detail: egoResponseText,
              metrics: group2Map['intersubjective']?.metrics ?? null,
              timestamp: new Date().toISOString(),
            });
          }
        }

        // Process strategy plan result
        if (group2Map['strategy']) {
          strategyPlan = group2Map['strategy']?.text ?? null;
          if (strategyPlan) {
            log(`[evaluationRunner] Strategy plan generated for turn ${turnIdx + 1}`, 'info');
            consolidatedTrace.push({
              agent: 'ego_strategy',
              action: 'plan',
              turnIndex: turnIdx,
              contextSummary: `Ego formulated strategy plan for turn ${turnIdx + 1}`,
              detail: strategyPlan,
              metrics: group2Map['strategy']?.metrics ?? null,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      const betweenTurnMs = Date.now() - betweenTurnStart;
      log(
        `[evaluationRunner] Between-turn processing completed in ${(betweenTurnMs / 1000).toFixed(1)}s (${group1Labels.length} parallel group-1, ${group2Labels.length} parallel group-2)`,
        'info',
      );
    }

    return {
      behavioralOverrides,
      learnerProfileOfTutor,
      sessionEvolution,
      strategyPlan,
      superegoEvolution,
      tutorProfileOfLearner,
    };
  }

  return { advanceBetweenTurnAdaptation };
}

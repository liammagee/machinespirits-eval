import {
  tutorStubStressHoldVerdictTraceEvent,
  parseTutorStubStressHoldVerdict,
  tutorStubStressHoldSpeechCheckPrompt,
  parseTutorStubStressHoldSpeechCheck,
  tutorStubStressHoldSpeechFeedback,
  tutorStubStressHoldSpeechCheckTraceEvent,
} from './tutorStubStressSchedule.js';

const SPEECH_CHECK_SYSTEM_PROMPT = 'You read one line of learner speech and answer with one JSON object. No prose.';

// One learner turn with the stress hold applied. `buildPrompt(feedback)` builds the
// learner prompt and `generate(prompt)` makes a draft; the prompt that made the spoken
// draft is returned. On a held turn the private first-line verdict
// (HOLD: kept / released "<quote>") is stripped and recorded as a trace event. With
// `speechCheck` set, a second model call reads the spoken line against the planted
// state (never the release text); if the words drop the state, the sim gets its
// draft back once and the second draft is spoken. Recorded, never enforced.
export async function generateTutorStubLearnerTurnWithStressHold({
  buildPrompt,
  generate,
  heldPlant,
  schedule,
  state,
  turnNumber,
  tutorReplyText,
  speechCheck = null,
  cleanReply,
  appendTraceEvent,
}) {
  let prompt = buildPrompt();
  const first = await generate(prompt);
  const learnerDeliberation = first.metadata;
  if (!(heldPlant?.held > 0))
    return { raw: first.raw, spokenRaw: first.raw.text, prompt, learnerDeliberation, stressHold: {} };
  let current = first.raw;
  let parsed = parseTutorStubStressHoldVerdict(current.text, tutorReplyText);
  let stressHoldSpeechCheck = null;
  if (speechCheck) {
    const { callPromptModel, resolved, cliEffort = null, signal = null } = speechCheck;
    const readDraft = async (draft) => {
      if (draft.verdict === 'released') return null;
      const response = await callPromptModel({
        prompt: tutorStubStressHoldSpeechCheckPrompt({
          plant: heldPlant,
          speech: cleanReply(draft.text),
          tutorReplyText,
        }),
        messageHistory: [],
        resolved,
        systemPrompt: SPEECH_CHECK_SYSTEM_PROMPT,
        role: 'tutor_stub_stress_hold_speech_check',
        maxTokens: 300,
        trace: state.trace,
        stream: { enabled: false, interim: state.interim },
        cliEffort,
        turn: turnNumber,
        signal,
      });
      return parseTutorStubStressHoldSpeechCheck(response.text);
    };
    const drafts = [{ ...parsed, reading: await readDraft(parsed) }];
    let retried = false;
    if (drafts[0].reading?.holds === false) {
      retried = true;
      const feedback = tutorStubStressHoldSpeechFeedback({
        plant: heldPlant,
        verdict: parsed.verdict,
        speech: cleanReply(parsed.text),
        reason: drafts[0].reading.reason,
      });
      prompt = buildPrompt(feedback);
      current = (await generate(prompt)).raw;
      parsed = parseTutorStubStressHoldVerdict(current.text, tutorReplyText);
      drafts.push({ ...parsed, reading: await readDraft(parsed) });
    }
    stressHoldSpeechCheck = tutorStubStressHoldSpeechCheckTraceEvent(schedule, heldPlant, turnNumber, {
      drafts,
      retried,
      final: drafts[drafts.length - 1],
    });
    if (state?.trace) appendTraceEvent(state.trace, stressHoldSpeechCheck);
  }
  const stressHoldVerdict = tutorStubStressHoldVerdictTraceEvent(schedule, heldPlant, turnNumber, parsed);
  if (state?.trace) appendTraceEvent(state.trace, stressHoldVerdict);
  return {
    raw: current,
    spokenRaw: parsed.text,
    prompt,
    learnerDeliberation,
    stressHold: { stressHoldVerdict, ...(stressHoldSpeechCheck ? { stressHoldSpeechCheck } : {}) },
  };
}

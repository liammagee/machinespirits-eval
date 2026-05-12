/**
 * adaptiveGraderPrompt.js — shared prompt construction for the bespoke
 * 4-dimension graded rubric used on adaptive-cell dialogues.
 *
 * Consumed by:
 *   - scripts/grade-adaptive-dialogue.js          (judge 1: codex CLI → DB columns)
 *   - scripts/rejudge-adaptive-inter-rater.js     (judge 2: claude/gemini CLI → JSON file)
 *
 * Both judges MUST see an identical prompt for the inter-rater comparison to
 * mean anything, so the prompt text lives here, not duplicated in each script.
 * If the rubric changes, bump GRADER_VERSION (and re-grade with --overwrite).
 */

export const GRADER_VERSION = '1.0';

/** Build the grader prompt from a tutor-dialogue trace object. */
export function buildPrompt(trace) {
  const scenario = trace.scenario || {};
  const hidden = scenario.hidden || {};
  const dialogue = trace.original?.dialogue || [];
  const perTurn = trace.original?.perTurn || [];

  const turns = dialogue.map((t, i) => {
    const role = t.role === 'tutor' ? 'TUTOR' : 'LEARNER';
    return `[turn ${Math.floor(i / 2)}] ${role}: ${t.content}`;
  }).join('\n\n');

  const policyTrace = perTurn
    .filter((pt) => pt.tutorInternal?.policyAction)
    .map((pt) => `  turn ${pt.turn}: ${pt.tutorInternal.policyAction}`)
    .join('\n');

  const scenarioJson = JSON.stringify({
    id: scenario.id,
    scenarioType: scenario.scenarioType,
    expectedStrategyShift: scenario.expectedStrategyShift,
    triggerTurn: hidden.triggerTurn,
    triggerSignal: hidden.triggerSignal,
    actualMisconception: hidden.actualMisconception,
    actualSophistication: hidden.actualSophistication,
    maxTurns: scenario.maxTurns,
  }, null, 2);

  return `You are evaluating an adaptive tutor's performance on a single "trap scenario" — a dialogue designed to test whether the tutor recognises a hidden trigger and shifts strategy accordingly.

# Scenario context (latent — the tutor does not see this)
${scenarioJson}

# Tutor's selected policy actions (one per turn, for context)
${policyTrace || '  (none recorded)'}

# Transcript
${turns}

# Your task

Score the tutor on the four dimensions below using a 1-5 integer scale. Be strict: 3 = adequate, 4 = strong, 5 = exemplary. Reserve 5 for executions that handle the trap cleanly *and* extend it productively.

1. **trigger_recognition** — Did the tutor identify the trap signal at or near the expected trigger turn (\`triggerTurn\`)? Look for: a shift in framing, a probe that targets the hidden phenomenon (\`actualMisconception\` / hidden state), or an explicit naming of the pattern. Score 1 if the tutor proceeded as though nothing was different; 5 if the recognition was precise and timely.

2. **strategy_execution** — Was the tutor's actual response *after* the trigger turn aligned with \`expectedStrategyShift\`? Strategy families: diagnostic, mirror_and_extend, name_the_disagreement, substantive_engagement, scope_test, slow_down, reframe. Score 1 if the family was wrong; 5 if the family matched and the timing was right (within 1-2 turns of trigger).

3. **strategy_quality** — *Given that an action was taken*, how well-crafted was it? Look for: specificity to the learner's actual move (not generic), calibration to inferred sophistication, no policy-label leakage, no profile-data leakage, no lecturing. Score 1 if the response was generic/leaky/off-tone; 5 if it was surgically tailored.

4. **pedagogical_coherence** — Does the whole dialogue trajectory cohere as a piece of teaching? Score 1 if the turns felt disconnected or contradictory; 5 if each turn built productively on the prior one, and the closing turn leaves the learner in a stronger position than the opening.

Respond with a JSON object only (no prose outside the JSON, no markdown fences required but tolerated):

{
  "scores": {
    "trigger_recognition": <1-5>,
    "strategy_execution": <1-5>,
    "strategy_quality": <1-5>,
    "pedagogical_coherence": <1-5>
  },
  "reasoning": {
    "trigger_recognition": "<1-2 sentence justification>",
    "strategy_execution": "<1-2 sentence justification>",
    "strategy_quality": "<1-2 sentence justification>",
    "pedagogical_coherence": "<1-2 sentence justification>"
  },
  "summary": "<one-sentence overall judgement>"
}`;
}

/**
 * Extract a JSON envelope from a CLI judge's raw stdout. Tolerates a ```json
 * fence; otherwise falls back to the outermost { ... } span. Throws if the
 * extracted slice is not valid JSON (caller decides how to handle).
 */
export function extractJsonEnvelope(stdout) {
  let jsonStr = String(stdout).trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  } else {
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }
  }
  return JSON.parse(jsonStr);
}

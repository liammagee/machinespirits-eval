// Program-2 Phase 5d — zero-paid machinery smoke
// (PROGRAM-2-PHASE5D-DELIVERY-INTEGRITY-PREREGISTRATION.md §8, launch gate 2).
//
// Three gates, no paid model calls:
//   A. plan gate — buildPhase5dLivePilotPlan + validatePhase5dLivePilotPlan
//      (zero-model; 18 jobs; committee-v3 flags on committee arms only)
//   B. dry committee moment — applyCommitteeDeliveryGuard on the real 5b
//      staged-turn texture, re-audited with the frozen detector, plus the
//      full skip taxonomy and committeeSpanCarriesCue
//   C. mini probe — one temp-0 and one temp-0.35 generation against the
//      local ollama mini (free); fails if ollama is unreachable (rerun at
//      launch with the serving stack up), or skip with --skip-mini
//
// Usage: node scripts/run-program2-phase5d-smoke.js [--skip-mini]

import {
  PROGRAM2_COMMITTEE_DEFAULTS,
  applyCommitteeDeliveryGuard,
  committeeMiniGenerate,
  committeeQuestionSentences,
  committeeSpanCarriesCue,
} from '../services/program2CommitteeEngine.js';
import { auditTutorStubPointOfActionCompliance } from '../services/tutorStubPointOfActionCoaching.js';
import { buildPhase5dLivePilotPlan, validatePhase5dLivePilotPlan } from './run-program2-live-pilot.js';

const SKIP_MINI = process.argv.includes('--skip-mini');
const results = [];
function gate(name, ok, detail) {
  results.push({ name, ok });
  console.log(`[phase5d-smoke] ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

// ---- Gate A: zero-model plan gate ----
const plan = buildPhase5dLivePilotPlan();
const validation = validatePhase5dLivePilotPlan(plan);
gate('plan_gate', validation.ok, `${plan.jobs.length} jobs; errors: ${validation.errors.join('; ') || 'none'}`);
const committeeJob = plan.jobs.find((job) => job.arm === 'committee');
const controlJob = plan.jobs.find((job) => job.arm === 'silent_control');
gate(
  'plan_flags',
  committeeJob.command.includes('--committee-span-cue') &&
    committeeJob.command.includes('--committee-delivery-guard') &&
    !controlJob.command.includes('--committee-span-cue') &&
    !controlJob.command.includes('--committee-delivery-guard'),
  'committee-v3 flags on committee arms only',
);

// ---- Gate B: dry committee moment (real 5b staged texture) ----
const SPAN =
  'What have you examined yet — mark, tool, or record — that would tell whose hand cut the die for these shillings?';
const APPROVED =
  "That's the bridge you needed: one hand alone drew the weir crucible, so the blank in these shillings was cast by that hand — Edony's. The casting side of the proof is now closed.\n\n" +
  SPAN;
const STAGED =
  'Here is the concrete clue: The leat-keeper’s book is exact.\n\nSince the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony, the founder’s widow, who stayed on in the forge cottage when the fires went out. In plain terms: A blank is the work of the hand that cast it. What does this clue show on its own?';

const swap = applyCommitteeDeliveryGuard({
  finalText: STAGED,
  approvedText: APPROVED,
  span: SPAN,
  releasedNowCount: 0,
});
const swappedQuestions = committeeQuestionSentences(swap.text);
gate(
  'guard_swap_applies',
  swap.applied === true &&
    swap.text.includes(SPAN) &&
    !swap.text.includes('What does this clue show on its own?') &&
    swap.text.includes('Here is the concrete clue') &&
    swappedQuestions.length === 1,
  `replaced "${swap.record.replacedQuestion}"`,
);
const recheck = auditTutorStubPointOfActionCompliance({
  turn: { assigned_trigger: 'warrant_skip' },
  tutorText: swap.text,
  releasedPremiseCount: 0,
  realizedActionFamily: null,
  guardsPassed: true,
});
gate(
  'guard_swap_compliant',
  recheck.compliant === true && recheck.components.warrant_cue === true && recheck.components.exactly_one_question === true,
  `frozen detector on swapped text: ${JSON.stringify(recheck.components)}`,
);
const skipRelease = applyCommitteeDeliveryGuard({
  finalText: STAGED,
  approvedText: APPROVED,
  span: SPAN,
  releasedNowCount: 1,
});
gate('guard_skips_premise_release', !skipRelease.applied && skipRelease.record.reason === 'premise_release_turn');
const skipSame = applyCommitteeDeliveryGuard({
  finalText: APPROVED,
  approvedText: APPROVED,
  span: SPAN,
  releasedNowCount: 0,
});
gate('guard_skips_shipped_as_approved', !skipSame.applied && skipSame.record.reason === 'shipped_as_approved');
const skipPresent = applyCommitteeDeliveryGuard({
  finalText: `${STAGED.replace('What does this clue show on its own?', '')}\n\n${SPAN}`,
  approvedText: APPROVED,
  span: SPAN,
  releasedNowCount: 0,
});
gate('guard_skips_span_present', !skipPresent.applied && skipPresent.record.reason === 'span_already_present');
const skipNoQuestion = applyCommitteeDeliveryGuard({
  finalText: 'Here is the concrete clue: the book is exact. The hand is known.',
  approvedText: APPROVED,
  span: SPAN,
  releasedNowCount: 0,
});
gate('guard_skips_no_question', !skipNoQuestion.applied && skipNoQuestion.record.reason === 'no_question_sentence');
gate(
  'span_cue_predicate',
  committeeSpanCarriesCue([SPAN]) === true &&
    committeeSpanCarriesCue(['What would the coin itself need to show before you could say this?']) === false,
  'frozen six-word regex on span sentences',
);

// ---- Gate C: local mini probe (free; the spanCue resample shape) ----
if (SKIP_MINI) {
  console.log('[phase5d-smoke] SKIP mini_probe (--skip-mini)');
} else {
  try {
    const probePrompt = {
      systemPrompt: 'You are a terse assistant. Answer in one short sentence.',
      messages: [{ role: 'user', content: 'Ask one question about what the record shows.' }],
      maxTokens: 64,
    };
    const greedy = await committeeMiniGenerate({ ...probePrompt, temperature: 0 });
    const sampled = await committeeMiniGenerate({ ...probePrompt, temperature: 0.35 });
    gate(
      'mini_probe',
      Boolean(String(greedy.text || '').trim()) && Boolean(String(sampled.text || '').trim()),
      `${PROGRAM2_COMMITTEE_DEFAULTS.miniModel} greedy ${greedy.latencyMs}ms / sampled ${sampled.latencyMs}ms`,
    );
  } catch (error) {
    gate('mini_probe', false, `ollama unreachable: ${String(error.message || error).slice(0, 120)}`);
  }
}

const failed = results.filter((entry) => !entry.ok);
console.log(
  `[phase5d-smoke] ${failed.length === 0 ? 'ALL GATES PASS' : `${failed.length} gate(s) FAILED: ${failed.map((entry) => entry.name).join(', ')}`} (${results.length} checks, 0 paid calls)`,
);
process.exit(failed.length === 0 ? 0 : 1);

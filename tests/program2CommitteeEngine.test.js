import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROGRAM2_COMMITTEE_DEFAULTS,
  committeeFallbackBatteryPass,
  trimCommitteeFallback,
  buildCommitteeCompositionBlock,
  committeeQuestionSentences,
  normalizeCommitteeWhitespace,
  runCommitteeBattery,
} from '../services/program2CommitteeEngine.js';

test('frozen committee defaults match the Phase 2 serving pin', () => {
  assert.equal(PROGRAM2_COMMITTEE_DEFAULTS.miniModel, 'program2-sft-instruct-v2');
  assert.equal(PROGRAM2_COMMITTEE_DEFAULTS.numCtx, 16384);
  assert.equal(PROGRAM2_COMMITTEE_DEFAULTS.timeoutMs, 600_000);
});

test('question-span extraction is probe-identical', () => {
  assert.deepEqual(
    committeeQuestionSentences('The assay ledger sits open. Which entry connects your claim to the cupel test?'),
    ['Which entry connects your claim to the cupel test?'],
  );
  // Short questions (≤ 8 chars) are filtered, exactly as in the probe.
  assert.deepEqual(committeeQuestionSentences('Why? A longer question stands here, does it not?'), [
    'A longer question stands here, does it not?',
  ]);
  assert.deepEqual(committeeQuestionSentences('No questions at all. Only statements.'), []);
  assert.deepEqual(
    committeeQuestionSentences('First, which record shows the weight? And second, what rule binds it?'),
    ['First, which record shows the weight?', 'And second, what rule binds it?'],
  );
});

test('battery: pass requires non-empty, verbatim containment, exactly one question', () => {
  const span = 'Which entry connects your claim to the cupel test?';
  const pass = runCommitteeBattery({
    composedText: `The ledger waits, quill poised.  Which entry connects   your claim to the cupel test? Show me there.`,
    span,
  });
  assert.equal(pass.pass, true);
  assert.deepEqual(pass.checks, { non_empty: true, span_contained: true, exactly_one_question: true });

  const lost = runCommitteeBattery({ composedText: 'The ledger waits. Show me the entry now?', span });
  assert.equal(lost.pass, false);
  assert.equal(lost.failedCheck, 'span_contained');

  const multi = runCommitteeBattery({
    composedText: `Which entry connects your claim to the cupel test? And what of the seal?`,
    span,
  });
  assert.equal(multi.pass, false);
  assert.equal(multi.failedCheck, 'exactly_one_question');

  const empty = runCommitteeBattery({ composedText: '   ', span });
  assert.equal(empty.pass, false);
  assert.equal(empty.failedCheck, 'non_empty');
});

test('whitespace normalization collapses runs and trims, probe-identical', () => {
  assert.equal(normalizeCommitteeWhitespace('  a\n\n b\t c  '), 'a b c');
});

test('composition block carries the span verbatim and all four frozen requirements', () => {
  const span = 'Which record shows the weight?';
  const block = buildCommitteeCompositionBlock(span);
  assert.equal(block.includes(`"${span}"`), true);
  assert.equal(block.includes('VERBATIM'), true);
  assert.equal(block.includes('Ask no other question anywhere in the turn.'), true);
  assert.equal(block.includes('Introduce no new case facts, clues, or evidence'), true);
  assert.equal(block.includes('Keep the scene voice and address the learner directly.'), true);
  assert.equal(block.startsWith('--- Composition task (harness instruction) ---'), true);
});

test('fallback battery: one question plus frozen cue required', () => {
  assert.equal(committeeFallbackBatteryPass('Look here. Which record shows the weight?'), true);
  assert.equal(committeeFallbackBatteryPass('Which mark shows the weight?'), false); // no cue word
  assert.equal(committeeFallbackBatteryPass('Which record shows it? And which rule binds it?'), false); // two questions
  assert.equal(committeeFallbackBatteryPass('The record is plain.'), false); // no question
});

test('trim keeps the cue-bearing question — the Phase 5 turn-8 fixture', () => {
  // Verbatim delivered fallback from p5-05 turn 8 (Phase 5 §9): two
  // questions, the cue in the second. v1 shipped both and failed
  // exactly_one_question; the v2 trim must keep the "evidence" question.
  const turn8 = [
    "You have made that licensed distinction: the alloy now says its source is the weir-forge crucible, and nothing else in Marrick has ever cast from it — so those blanks are not Verrell's work at all. The town's verdict has lost its metal proof; a coin cannot be moneyer-work when its own blank denies the moneyer.",
    '',
    "But an assay never ends with only one route: once the source of the false coin is settled, we must ask what changed for the public question — whose hand struck them now that their blanks are not Verrell's? What evidence has entered the trial-book to answer that?",
  ].join('\n');
  const trimmed = trimCommitteeFallback(turn8);
  assert.equal(trimmed.changed, true);
  assert.equal(trimmed.keptQuestion.includes('What evidence has entered the trial-book'), true);
  assert.equal((trimmed.text.match(/\?/gu) || []).length, 1);
  assert.equal(committeeFallbackBatteryPass(trimmed.text), true);
});

test('trim falls back to the first question when no question carries a cue', () => {
  const text = 'First point. Which mark names the hand? And which stroke shows the slip?';
  const trimmed = trimCommitteeFallback(text);
  assert.equal(trimmed.changed, true);
  assert.equal(trimmed.keptQuestion, 'Which mark names the hand?');
  assert.equal((trimmed.text.match(/\?/gu) || []).length, 1);
  assert.equal(committeeFallbackBatteryPass(trimmed.text), false); // still no cue — recorded, shipped
});

test('trim leaves single-question replies unchanged', () => {
  const text = 'Steady. Which record shows the weight?';
  const trimmed = trimCommitteeFallback(text);
  assert.equal(trimmed.changed, false);
  assert.equal(trimmed.text, text);
});

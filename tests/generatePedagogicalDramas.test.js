import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { qualityWarningsFor, withPairedDirectorRevisitCue } from '../scripts/generate-pedagogical-dramas.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

describe('generate-pedagogical-dramas', () => {
  it('flags a revoice cue when the next learner line does not visibly reuse the anchor', () => {
    const warnings = qualityWarningsFor({
      tid: 'T99',
      dramaId: 'D99',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I kept treating the decimal as the proof, not a clue." ' +
            'The learner must revoice that wording first, then say what changes.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'If the numerator is even, the denominator is going to be under pressure too.',
        },
      ],
    });

    const warning = warnings.find((entry) => entry.code === 'revoice_cue_not_revoiced');
    assert.equal(warning?.severity, 'warning');
    assert.equal(warning?.failures[0].reason, 'low_anchor_overlap');
  });

  it('accepts a visible revoice paraphrase without treating it as a recognition verdict', () => {
    const warnings = qualityWarningsFor({
      tid: 'T98',
      dramaId: 'D98',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I rushed to sad before naming the image in the first line." ' +
            'The learner must revoice that wording first, then say what changes.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I did rush to sad before naming the first-line image. That keeps the feeling, but misses the word on the page.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'revoice_cue_not_revoiced'),
      false,
    );
  });

  it('accepts a quoted revoice opening that contains an ellipsis', () => {
    const warnings = qualityWarningsFor({
      tid: 'T981',
      dramaId: 'D981',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "Sad, maybe... or just thin and still at first. On the clipboard, line one seems sharp." ' +
            'The learner must revoice that wording first, then say what changes.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            '“Sad, maybe... or just thin and still at first.” That keeps line one as a thin, still image, but misses the exact words.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'revoice_cue_not_revoiced'),
      false,
    );
  });

  it('does not accept later overlap after the learner skips the opening revoice', () => {
    const warnings = qualityWarningsFor({
      tid: 'T97',
      dramaId: 'D97',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My decimal check was not enough; the even-square step is the one I need to justify." ' +
            'The learner must revoice that wording first, then say what changes.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'If an odd integer is squared, it stays odd. That means the even-square step works, and the decimal check was not enough after all.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'revoice_cue_not_revoiced'),
      true,
    );
  });

  it('flags a reframe cue when the learner echoes the anchor without exposing the consequence', () => {
    const warnings = qualityWarningsFor({
      tid: 'T96',
      dramaId: 'D96',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I kept treating sad as the whole close reading." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I kept treating sad as the whole close reading. The image is still there on the page.',
        },
      ],
    });

    const warning = warnings.find((entry) => entry.code === 'reframe_cue_not_reframed');
    assert.equal(warning?.severity, 'warning');
    assert.deepEqual(warning?.failures[0].missing, ['framing_problem', 'replacement_framing']);
    assert.equal(
      warnings.some((entry) => entry.code === 'revoice_cue_not_revoiced'),
      false,
    );
  });

  it('accepts a public reframe sequence when it revoices, names the problem, and replaces it', () => {
    const warnings = qualityWarningsFor({
      tid: 'T95',
      dramaId: 'D95',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I rushed to sad before naming the image in the first line." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'I rushed to sad before naming the first-line image. The framing problem is that I skipped the word on the page. Instead I would read the image first and let the feeling answer to it.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts an object-led replacement framing after the problem is named', () => {
    const warnings = qualityWarningsFor({
      tid: 'T94',
      dramaId: 'D94',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I called it sad first, and that skipped the image." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'I called it sad first, and that skipped the image. That was the framing problem: mood before the word. The line starts with a visible image first.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts an object-led replacement that tests the assumption instead', () => {
    const warnings = qualityWarningsFor({
      tid: 'T941',
      dramaId: 'D941',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "The decimal trail felt like evidence." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'The decimal trail felt like evidence, but that was the trouble. That earlier framing made checked cases stand in for proof; this line on the worksheet tests the assumption instead.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a stronger starting point as a replacement framing', () => {
    const warnings = qualityWarningsFor({
      tid: 'T942',
      dramaId: 'D942',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My first instinct is that the decimal just keeps going." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'My first instinct is that the decimal just keeps going, but that was the wrong frame for a contradiction. The stronger start is the fraction assumption in lowest terms.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('does not flag a complete quoted learner turn ending in a curly quote as truncated', () => {
    const warnings = qualityWarningsFor({
      tid: 'T90',
      dramaId: 'D90',
      turns: [
        {
          role: 'LEARNER',
          turnNumber: 1,
          text: 'The popular phrasing has me saying, “Entropy is just messiness.”',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'possibly_truncated_learner_turn'),
      false,
    );
  });

  it('accepts a contrastive replacement after the learner says it framed the issue badly', () => {
    const warnings = qualityWarningsFor({
      tid: 'T89',
      dramaId: 'D89',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "Oh, I get why the shove matters, but that feels too convenient." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'Oh, I get why the shove matters, but that feels too convenient. I framed that badly: the pressure is not just shove versus freedom, but whether reasons-guided action differs from being moved like furniture.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts an earlier-framing correction that names the problem in ordinary speech', () => {
    const warnings = qualityWarningsFor({
      tid: 'T93',
      dramaId: 'D93',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "The decimal check was only evidence." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'The decimal check was only evidence. The earlier framing made it sound as though checked cases could settle it; read from the reduced-fraction assumption instead.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a self-correction that says the earlier wording made the claim sound wrong', () => {
    const warnings = qualityWarningsFor({
      tid: 'T92',
      dramaId: 'D92',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "The stretching part stays with one giraffe." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'The stretching part stays with one giraffe, but I was still making it sound like stretching starts the neck change. Looking back at the diagram, maybe it means the young giraffes already have small differences first.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a terse mood-first correction with an object-led replacement', () => {
    const warnings = qualityWarningsFor({
      tid: 'T91',
      dramaId: 'D91',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "Sorry, I went straight to the stark feeling again." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'Sorry, I went straight to the stark feeling again. That was mood first; this line is the image on the page first.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a reframe that names the earlier line as only a check, not a proof', () => {
    const warnings = qualityWarningsFor({
      tid: 'T911',
      dramaId: 'D911',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My first instinct is that the decimal never settles." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'My first instinct is that the decimal never settles was only a check on how it looks, not a proof against every fraction. The better framing is the lowest-terms assumption.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a reframe that says the old scrap was framed as proof when it is only a check', () => {
    const warnings = qualityWarningsFor({
      tid: 'T852',
      dramaId: 'D852',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "This scrap of decimals settles it." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'This scrap of decimals settles it. That frames the scrap as proof when it is only a check, so the claim has to be tested against any fraction that might equal square root of two.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a reframe that calls the earlier line sloppiness before checking a rule', () => {
    const warnings = qualityWarningsFor({
      tid: 'T853',
      dramaId: 'D853',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought the home form was sloppy." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'I thought the home form was sloppy. The problem there is that I called it sloppiness before checking the speaker rule; the earlier line reads as part of a pattern instead of a broken sentence.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts significance standing in for importance when the claim is replaced by a benchmark', () => {
    const warnings = qualityWarningsFor({
      tid: 'T854',
      dramaId: 'D854',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought the small p-value made the result important." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'I thought the small p-value made the result important, but that made significance stand in for importance. The claim depends on the estimate and a meaningful benchmark.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts reading language that mixes up proof and event framing', () => {
    const warnings = qualityWarningsFor({
      tid: 'T855',
      dramaId: 'D855',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought presumed innocent said what happened." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'I thought presumed innocent said what happened. That way of reading it mixes up the event with what the evidence has proved. Now the claim is about what proof can place on the verdict form.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts clear meaning not-visible rather than absent as a replacement frame', () => {
    const warnings = qualityWarningsFor({
      tid: 'T856',
      dramaId: 'D856',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My first instinct is that clear water means the salt is gone." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'My first instinct is that clear water means the salt is gone. I was letting clarity decide too much; clear may mean not visible, not absent.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts corrections counting as rules before replacing a dialect pattern frame', () => {
    const warnings = qualityWarningsFor({
      tid: 'T857',
      dramaId: 'D857',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought she be working late was outside the rules because people correct it." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'I thought she be working late was outside the rules because people correct it. I made the corrections count as the rules there. Maybe in that line be is the pattern because it marks what happens regularly.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts sudden-event-first language before the learner replaces the canyon frame', () => {
    const warnings = qualityWarningsFor({
      tid: 'T858',
      dramaId: 'D858',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought the label should say a canyon came from one huge flood." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'I thought the label should say a canyon came from one huge flood, but that puts the sudden event first. Maybe it should start with the river wearing and carrying by repeated small changes over long time.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a fact-like legal frame before a proof-rule replacement', () => {
    const warnings = qualityWarningsFor({
      tid: 'T859',
      dramaId: 'D859',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought presumed innocent meant the court said the accused did not do it." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'I thought presumed innocent meant the court said the accused did not do it. That was framing it like a fact about what happened. Maybe it should read more as a rule that the prosecution has to prove guilt enough for conviction.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts an ecology frame that stops at deer counts before naming the coupled replacement', () => {
    const warnings = qualityWarningsFor({
      tid: 'T860',
      dramaId: 'D860',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I assumed fewer predators would simply help the deer population." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'I assumed fewer predators would simply help the deer population. That first framing stops at deer counts; with browse lines up and winter food tightening, more deer may mean the habitat is no longer keeping the herd healthy.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts an eye-led visibility frame before the balance replacement', () => {
    const warnings = qualityWarningsFor({
      tid: 'T861',
      dramaId: 'D861',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My first instinct was that once the beaker looks clear the salt has gone." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'My first instinct was that once the beaker looks clear the salt has gone. That was me going by what the eye can still pick out. With the beaker and salt on the balance before and after, the reading stays put.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts an effect-size replacement after a significance claim is called too quick', () => {
    const warnings = qualityWarningsFor({
      tid: 'T862',
      dramaId: 'D862',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought significance was enough to call it an important improvement." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'I thought significance was enough to call it an important improvement; that was too quick. The effect size with its interval has to show whether the shift matters or is still tiny.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a reframe that treats the old line as if it were proof before replacing it', () => {
    const warnings = qualityWarningsFor({
      tid: 'T912',
      dramaId: 'D912',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My first instinct is that the decimal just keeps going." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'My first instinct is that the decimal just keeps going, but that was treating a pattern as if it were already a proof. Better to suppose a fraction in lowest terms and follow what the equation forces.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a reframe that says the old frame asks the wrong evidence to do the work', () => {
    const warnings = qualityWarningsFor({
      tid: 'T913',
      dramaId: 'D913',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My first instinct is that the decimal just keeps going." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'My first instinct is that the decimal just keeps going. That framing asks the decimal check to do the proof work; the new framing is a lowest-terms fraction tested until it fails.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a reframe that says the old case does too much and names a sharper test', () => {
    const warnings = qualityWarningsFor({
      tid: 'T914',
      dramaId: 'D914',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "The clock can trap both cases." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text:
            'The clock can trap both cases. I was making the clock do too much there, as if any cause already counts as control; the sharper test is whether judgement carries the act or gets bypassed.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('flags a requested reframe cue that the anchor gate downgraded', () => {
    const warnings = qualityWarningsFor({
      tid: 'T90',
      dramaId: 'D90',
      turns: [
        { role: 'LEARNER', turnNumber: 1, text: 'I am not sure the first framing still stands.' },
        { role: 'LEARNER', turnNumber: 2, text: 'The later line keeps the exchange long enough to score.' },
      ],
      traceTurns: [
        {
          phase: 'director',
          turnNumber: 2,
          directorCue: {
            requestedRevisitPolicy: 'reframe',
            revisitPolicy: 'reconsider',
            revisitAnchor: 'misframing-candidate',
            reframeAnchorGate: 'downgraded_to_reconsider_ineligible_anchor',
          },
        },
      ],
    });

    const warning = warnings.find((entry) => entry.code === 'reframe_cue_downgraded');
    assert.equal(warning.count, 1);
    assert.equal(warning.failures[0].requested_policy, 'reframe');
    assert.equal(warning.failures[0].applied_policy, 'reconsider');
    assert.equal(warning.turn_numbers[0], 2);
  });

  it('routes tutor and learner roles to different backends and persists held-out role transcripts', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-gen-test-'));
    const sampleDir = path.join(tmp, 'sample');
    const delibDir = path.join(tmp, 'delib');
    const transcriptsDir = path.join(tmp, 'transcripts');
    const keyPath = path.join(tmp, 'key.yaml');

    execFileSync(
      process.execPath,
      [
        'scripts/generate-pedagogical-dramas.js',
        '--mock',
        '--max-turns',
        '2',
        '--spec',
        'config/poetics-calibration/phase2-dramas-v3.yaml',
        '--tid-start',
        '6',
        '--only',
        'D8',
        '--role-map',
        'tutor=claude,learner=codex',
        '--director-revisit-cue',
        '--out-dir',
        sampleDir,
        '--delib-dir',
        delibDir,
        '--transcripts-dir',
        transcriptsDir,
        '--key',
        keyPath,
        '--force',
      ],
      { cwd: ROOT, stdio: 'pipe', env: { ...process.env, GEN_DRAMAS_CLI_TRACE: '0' } },
    );

    const traceFile = fs.readdirSync(delibDir).find((f) => /^T\d+\.json$/.test(f));
    assert.ok(traceFile, 'expected a held-out trace file');
    const trace = JSON.parse(fs.readFileSync(path.join(delibDir, traceFile), 'utf8'));

    assert.equal(trace.run.generator, 'mixed');
    assert.deepEqual(trace.run.role_map, { tutor: 'claude', learner: 'codex' });
    assert.equal(trace.run.director_revisit_cue, true);
    assert.equal(trace.run.director_revisit_policy, 'anchor');
    assert.equal(trace.run.director_revisit_anchor, 'latest');
    assert.equal(trace.directorPlan.revisit_cue, 'learner_revisit_earlier_wording');
    assert.equal(trace.directorPlan.revisit_cue_policy, 'anchor');
    assert.equal(trace.directorPlan.revisit_cue_anchor, 'latest');
    assert.equal(trace.run.writing_pad.mode, 'isolated');
    assert.ok(['ok', 'review_before_scoring'].includes(trace.quality_status));
    assert.ok(Array.isArray(trace.quality_warnings), 'quality warnings should always be machine-readable');

    const tutorEntries = trace.turns
      .filter((turn) => turn.phase === 'tutor')
      .flatMap((turn) => turn.internalDeliberation || []);
    const learnerEntries = trace.turns
      .filter((turn) => turn.phase === 'learner')
      .flatMap((turn) => turn.internalDeliberation || []);

    assert.ok(tutorEntries.length > 0, 'expected tutor deliberation entries');
    assert.ok(learnerEntries.length > 0, 'expected learner deliberation entries');
    assert.ok(
      tutorEntries.every((entry) => entry.provenance?.backend === 'claude'),
      'all tutor role calls should be routed to claude',
    );
    assert.ok(
      learnerEntries.every((entry) => entry.provenance?.backend === 'codex'),
      'all learner role calls should be routed to codex',
    );
    assert.ok(
      [...tutorEntries, ...learnerEntries].every((entry) => entry.provenance?.promptHashes?.combined),
      'every role call should persist a prompt hash',
    );
    assert.ok(
      learnerEntries.filter((entry) => entry.role === 'ego').every((entry) => entry.provenance?.agentRole === 'learner_ego'),
      'learner ego should be one stable routed role across initial and adjudication stages',
    );
    assert.ok(
      tutorEntries.filter((entry) => entry.role === 'ego').every((entry) => entry.provenance?.agentRole === 'tutor_ego'),
      'tutor ego should be one stable routed role across initial and adjudication stages',
    );
    assert.ok(
      learnerEntries.some((entry) => entry.role === 'ego' && entry.stage === 'adjudication'),
      'expected learner ego adjudication stage',
    );
    assert.ok(
      tutorEntries.some((entry) => entry.role === 'ego' && entry.stage === 'adjudication'),
      'expected tutor ego adjudication stage',
    );
    assert.ok(
      learnerEntries.every((entry) => entry.role !== 'ego_initial' && entry.role !== 'ego_revision'),
      'initial/revision should be stages, not separate learner ego roles',
    );

    const tid = traceFile.replace(/\.json$/, '');
    for (const suffix of ['public.txt', 'full.md', 'stage.md', 'tutor.md', 'learner.md']) {
      assert.ok(fs.existsSync(path.join(transcriptsDir, `${tid}.${suffix}`)), `missing ${suffix} transcript`);
    }
    const publicSample = fs.readFileSync(path.join(sampleDir, `${tid}.txt`), 'utf8');
    assert.match(publicSample, /^STAGE:/m, 'public drama sample should expose visible stage directions');
    assert.match(publicSample, /prior learner line is played back: "/i, 'public sample should quote a revisit anchor');
    const fullTranscript = fs.readFileSync(path.join(transcriptsDir, `${tid}.full.md`), 'utf8');
    assert.match(fullTranscript, /Director Scene Card/);
    assert.match(fullTranscript, /Tutor Ego \(adjudication\/final authority\)/);
    assert.match(fullTranscript, /Learner Ego \(adjudication\/final authority\)/);
    const tutorTranscript = fs.readFileSync(path.join(transcriptsDir, `${tid}.tutor.md`), 'utf8');
    const learnerTranscript = fs.readFileSync(path.join(transcriptsDir, `${tid}.learner.md`), 'utf8');
    assert.match(tutorTranscript, /backend=claude/);
    assert.match(learnerTranscript, /backend=codex/);

    const key = yaml.parse(fs.readFileSync(keyPath, 'utf8'));
    assert.equal(key.writing_pad.mode, 'isolated');
    assert.equal(key.director_revisit_cue, true);
    assert.equal(key.director_revisit_policy, 'anchor');
    assert.equal(key.director_revisit_anchor, 'latest');
    assert.equal(key.transcripts_dir, path.relative(ROOT, transcriptsDir));
    assert.equal(key.items[tid].quality_status, trace.quality_status);
    assert.equal(key.items[tid].director_revisit_cue, true);
    assert.equal(key.items[tid].director_revisit_policy, 'anchor');
    assert.equal(key.items[tid].director_revisit_anchor, 'latest');
    assert.equal(key.quality_warning_count, key.items[tid].quality_warnings.length);

    const scorePath = path.join(tmp, 'score.json');
    execFileSync(
      process.execPath,
      ['scripts/score-poetics-phase2.js', '--mock', '--sample-dir', sampleDir, '--key', keyPath, '--out', scorePath],
      { cwd: ROOT, stdio: 'pipe' },
    );
    const score = JSON.parse(fs.readFileSync(scorePath, 'utf8'));
    assert.equal(score.scored[0].id, tid);
    assert.deepEqual(score.qualityPolicy.skipped, []);
  });

  it('lets a drama spec override the CLI revisit policy for mixed editorial runs', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-gen-mixed-policy-'));
    const sourceSpec = yaml.parse(
      fs.readFileSync(path.join(ROOT, 'config', 'poetics-calibration', 'phase2-dramas-v2.yaml'), 'utf8'),
    );
    const specPath = path.join(tmp, 'mixed-policy.yaml');
    const sampleDir = path.join(tmp, 'sample');
    const delibDir = path.join(tmp, 'delib');
    const transcriptsDir = path.join(tmp, 'transcripts');
    const keyPath = path.join(tmp, 'key.yaml');
    fs.writeFileSync(
      specPath,
      yaml.stringify({
        ...sourceSpec,
        dramas: [
          {
            ...sourceSpec.dramas.find((drama) => drama.id === 'D3'),
            director_revisit_policy: 'reconsider',
            director_revisit_anchor: 'opening',
          },
        ],
      }),
      'utf8',
    );

    execFileSync(
      process.execPath,
      [
        'scripts/generate-pedagogical-dramas.js',
        '--mock',
        '--spec',
        specPath,
        '--max-turns',
        '2',
        '--director-revisit-policy',
        'none',
        '--out-dir',
        sampleDir,
        '--delib-dir',
        delibDir,
        '--transcripts-dir',
        transcriptsDir,
        '--key',
        keyPath,
        '--force',
      ],
      { cwd: ROOT, stdio: 'pipe', env: { ...process.env, GEN_DRAMAS_CLI_TRACE: '0' } },
    );

    const traceFile = fs.readdirSync(delibDir).find((file) => /^T\d+\.json$/.test(file));
    const trace = JSON.parse(fs.readFileSync(path.join(delibDir, traceFile), 'utf8'));
    const key = yaml.parse(fs.readFileSync(keyPath, 'utf8'));
    const tid = traceFile.replace(/\.json$/, '');

    assert.equal(trace.run.director_revisit_policy, 'reconsider');
    assert.equal(trace.run.director_revisit_anchor, 'opening');
    assert.equal(key.director_revisit_policy, 'reconsider');
    assert.equal(key.director_revisit_anchor, 'opening');
    assert.equal(key.items[tid].director_revisit_policy, 'reconsider');
    assert.equal(key.items[tid].director_revisit_anchor, 'opening');
  });

  it('preserves explicit drama opening and learner voice constraints in the director plan', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-gen-director-override-'));
    const sampleDir = path.join(tmp, 'sample');
    const delibDir = path.join(tmp, 'delib');
    const transcriptsDir = path.join(tmp, 'transcripts');
    const keyPath = path.join(tmp, 'key.yaml');

    execFileSync(
      process.execPath,
      [
        'scripts/generate-pedagogical-dramas.js',
        '--mock',
        '--spec',
        'config/poetics-calibration/phase2-dramas-v2.yaml',
        '--only',
        'D1',
        '--max-turns',
        '2',
        '--out-dir',
        sampleDir,
        '--delib-dir',
        delibDir,
        '--transcripts-dir',
        transcriptsDir,
        '--key',
        keyPath,
        '--force',
      ],
      { cwd: ROOT, stdio: 'pipe', env: { ...process.env, GEN_DRAMAS_CLI_TRACE: '0' } },
    );

    const traceFile = fs.readdirSync(delibDir).find((file) => /^T\d+\.json$/.test(file));
    const trace = JSON.parse(fs.readFileSync(path.join(delibDir, traceFile), 'utf8'));

    assert.equal(trace.directorPlan.opening_speaker, 'learner');
    assert.match(trace.directorPlan.side_constraints.learner, /opening public line must own the decimal-check misconception/i);
  });

  it('replaces shared revisit cues with the paired branch policy', () => {
    const sharedPlan = {
      revisit_cue: 'learner_revisit_earlier_wording',
      revisit_cue_policy: 'reconsider',
      revisit_cue_anchor: 'opening',
      interventions: [
        {
          after_turn: 2,
          timing: 'before_learner',
          instruction: 'A prior learner line is played back.',
          cue_kind: 'learner_revisit_earlier_wording',
          revisit_policy: 'reconsider',
          revisit_anchor: 'opening',
        },
        {
          after_turn: 2,
          timing: 'before_tutor',
          instruction: 'Keep the tutor brief.',
          cue_kind: 'tutor_stage_pressure',
        },
      ],
    };

    const nonePlan = withPairedDirectorRevisitCue(sharedPlan, 'none', 'misframing-candidate');
    assert.equal(nonePlan.revisit_cue, undefined);
    assert.equal(
      nonePlan.interventions.some((cue) => cue.cue_kind === 'learner_revisit_earlier_wording'),
      false,
    );
    assert.equal(nonePlan.interventions[0].cue_kind, 'tutor_stage_pressure');

    const reframePlan = withPairedDirectorRevisitCue(sharedPlan, 'reframe', 'misframing-candidate');
    const revisitCues = reframePlan.interventions.filter((cue) => cue.cue_kind === 'learner_revisit_earlier_wording');
    assert.equal(revisitCues.length, 1);
    assert.equal(revisitCues[0].revisit_policy, 'reframe');
    assert.equal(revisitCues[0].revisit_anchor, 'misframing-candidate');
  });

  it('forks paired continuation arms from one fixed prefix', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-gen-paired-continuation-'));
    const sourceSpec = yaml.parse(
      fs.readFileSync(path.join(ROOT, 'config', 'poetics-calibration', 'phase2-dramas-v2.yaml'), 'utf8'),
    );
    const specPath = path.join(tmp, 'paired-continuation.yaml');
    const sampleDir = path.join(tmp, 'sample');
    const delibDir = path.join(tmp, 'delib');
    const transcriptsDir = path.join(tmp, 'transcripts');
    const keyPath = path.join(tmp, 'key.yaml');
    fs.writeFileSync(
      specPath,
      yaml.stringify({
        ...sourceSpec,
        dramas: [sourceSpec.dramas.find((drama) => drama.id === 'D3')],
      }),
      'utf8',
    );

    execFileSync(
      process.execPath,
      [
        'scripts/generate-pedagogical-dramas.js',
        '--mock',
        '--spec',
        specPath,
        '--max-turns',
        '3',
        '--paired-continuation-policies',
        'none,reframe',
        '--director-revisit-anchor',
        'opening',
        '--out-dir',
        sampleDir,
        '--delib-dir',
        delibDir,
        '--transcripts-dir',
        transcriptsDir,
        '--key',
        keyPath,
        '--force',
      ],
      { cwd: ROOT, stdio: 'pipe', env: { ...process.env, GEN_DRAMAS_CLI_TRACE: '0' } },
    );

    const noneTraceFile = fs.readdirSync(path.join(delibDir, 'none')).find((file) => /^T\d+\.json$/.test(file));
    const reframeTraceFile = fs
      .readdirSync(path.join(delibDir, 'reframe'))
      .find((file) => /^T\d+\.json$/.test(file));
    const noneTrace = JSON.parse(fs.readFileSync(path.join(delibDir, 'none', noneTraceFile), 'utf8'));
    const reframeTrace = JSON.parse(fs.readFileSync(path.join(delibDir, 'reframe', reframeTraceFile), 'utf8'));
    const prefixTurns = (trace) => {
      const turns = [];
      for (const turn of trace.turns) {
        turns.push({
          phase: turn.phase,
          turnNumber: turn.turnNumber,
          externalMessage: turn.externalMessage,
        });
        if (turn.phase === 'tutor' && turn.turnNumber === 2) break;
      }
      return turns;
    };

    assert.equal(noneTraceFile, reframeTraceFile);
    assert.deepEqual(prefixTurns(noneTrace), prefixTurns(reframeTrace));
    assert.equal(noneTrace.run.paired_continuation.shared_prefix_hash, reframeTrace.run.paired_continuation.shared_prefix_hash);
    assert.equal(noneTrace.run.paired_continuation.branch_policy, 'none');
    assert.equal(reframeTrace.run.paired_continuation.branch_policy, 'reframe');
    assert.equal(noneTrace.run.director_revisit_policy, 'none');
    assert.equal(reframeTrace.run.director_revisit_policy, 'reframe');

    const tid = noneTraceFile.replace(/\.json$/, '');
    const noneSample = fs.readFileSync(path.join(sampleDir, 'none', `${tid}.txt`), 'utf8');
    const reframeSample = fs.readFileSync(path.join(sampleDir, 'reframe', `${tid}.txt`), 'utf8');
    assert.doesNotMatch(noneSample, /prior learner line is played back:/i);
    assert.match(reframeSample, /prior learner line is played back:/i);

    const noneKey = yaml.parse(fs.readFileSync(path.join(tmp, 'key-none.yaml'), 'utf8'));
    const reframeKey = yaml.parse(fs.readFileSync(path.join(tmp, 'key-reframe.yaml'), 'utf8'));
    assert.equal(noneKey.paired_continuation.mode, 'fixed_prefix_continuation');
    assert.deepEqual(reframeKey.paired_continuation.branch_policies, ['none', 'reframe']);
    assert.equal(noneKey.items[tid].paired_continuation.shared_prefix_hash, reframeKey.items[tid].paired_continuation.shared_prefix_hash);
  });
});

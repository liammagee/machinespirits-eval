import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

import { matchAuthoredRecognitionClaim } from '../services/dramaticDerivation/answerSurface.js';
import { tutorStubAssertedClaimText } from '../services/tutorStubConclusionAssertion.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function secretOf(worldFile) {
  const doc = YAML.parse(fs.readFileSync(path.join(ROOT, 'config', 'drama-derivation', worldFile), 'utf8'));
  return doc.secret;
}

function claims(text, secret) {
  return matchAuthoredRecognitionClaim(tutorStubAssertedClaimText(text), {
    surfaces: secret.recognition_surfaces,
    patterns: secret.recognition_patterns,
  });
}

/**
 * The three sentences below are verbatim learner turns from the 2026-07-30
 * pilot (exports/tutor-stub-outcome/pilot-1) that the closure detector
 * scored as never asserting the conclusion. Each is the case verdict stated
 * plainly; the hand-audit that caught them is logged on
 * workplan/items/tutor-contract-outcome-prereg.md.
 */
test('the pilot-missed Greyfen verdicts now match the authored claim patterns', () => {
  const secret = secretOf('world-023-greyfen-lab.yaml');
  const missed = [
    'The Corvat line was ruined by G17 contamination acquired during its overnight placement in the Larkin incubator.',
    'The Corvat line was ruined when it acquired Larkin’s recorded G17 contamination during its overnight placement in that incubator.',
    'G17 contamination from the breached Larkin incubator ruined the Corvat line after the flasks were parked there overnight.',
  ];
  for (const sentence of missed) {
    assert.ok(claims(sentence, secret), `should match: ${sentence}`);
  }
});

test('the pilot-missed Rowan Flat verdict now matches, in both wordings', () => {
  const secret = secretOf('world-030-rowan-flat.yaml');
  const missed = [
    'The split hose leak caused the kitchen ceiling mark: it opened during the pressure test, and its dye followed the pipe chase to the mark.',
    'The split hose leak caused the kitchen ceiling mark: it opened during the pressure test, and its dye followed the basin pipe chase to the mark.',
  ];
  for (const sentence of missed) {
    assert.ok(claims(sentence, secret), `should match: ${sentence}`);
  }
});

test('Nocturne and Tallow carry patterns for the verdicts their pilots never reached', () => {
  assert.ok(
    claims(
      'Liane composed the nocturne; the flood-winter dating and the Vara copybooks support it.',
      secretOf('world-001-nocturne.yaml'),
    ),
  );
  assert.ok(
    claims('Grebe-9 browns out Tallow Street every Thursday evening.', secretOf('world-025-tallow-street.yaml')),
  );
});

test('a question carrying every claim token asserts nothing', () => {
  const rowan = secretOf('world-030-rowan-flat.yaml');
  assert.equal(claims('Could the split hose leak have caused the kitchen ceiling mark?', rowan), null);
  // Only the question goes; a verdict standing beside it still lands.
  assert.ok(claims('Could it be the pump? No — the hose caused the kitchen ceiling mark.', rowan));
});

test('a denial carrying every claim token asserts nothing', () => {
  assert.equal(
    claims(
      'The evidence so far does not show that the Larkin incubator ruined the Corvat line.',
      secretOf('world-023-greyfen-lab.yaml'),
    ),
    null,
  );
  assert.equal(
    claims('It still does not show that Liane composed the nocturne.', secretOf('world-001-nocturne.yaml')),
    null,
  );
});

test('the mirror verdict does not match the secret pattern', () => {
  assert.equal(claims('Vess composed the nocturne, surely.', secretOf('world-001-nocturne.yaml')), null);
});

/**
 * The three tests below are verbatim learner turns from the same pilot that the
 * first version of these patterns closed a dialogue on. None states a verdict:
 * one concedes what is still owed, one names the claim only as what the record
 * points at, one denies it outright in the rejected half of a contrast. They are
 * why the matcher reads only the asserted part of a turn, and they are the
 * direction a widened matcher fails in — the failure the response-leak audit
 * was built to catch.
 */
test('a hedged route is not a verdict', () => {
  assert.equal(
    claims(
      'The log now places Corvat overnight in the Larkin unit, so its unstable conditions and the resident G17 strain become a plausible exposure route, though we still need evidence that G17 was what contaminated the flasks.',
      secretOf('world-023-greyfen-lab.yaml'),
    ),
    null,
  );
});

/**
 * The two final turns below decided whether Greyfen counted as a saturated
 * world (5/5, unusable) or a workable one (3/5). Both name the verdict only as
 * the thing the record points at, so both are read as short of it — the same
 * call the engine's own extractor made when it left these dialogues open.
 */
test('a verdict named only as what the evidence supports is not a verdict', () => {
  const greyfen = secretOf('world-023-greyfen-lab.yaml');
  assert.equal(
    claims(
      'The G17 sequence in the ruined flasks matches the strain documented in Larkin, so the overnight placement there supports G17 contamination as what ruined the Corvat line.',
      greyfen,
    ),
    null,
  );
  assert.equal(
    claims(
      'The flask swab is G17, matching the Larkin unit; together with the overnight placement in its breached chamber, that supports the Larkin incubator as the source that ruined the Corvat line.',
      greyfen,
    ),
    null,
  );
});

test('a claim named only to be denied is not a verdict', () => {
  assert.equal(
    claims(
      'We can carry forward that G17 was identified in the Larkin incubator’s quarantine record and swab, but not that it exposed or ruined the Corvat flasks.',
      secretOf('world-023-greyfen-lab.yaml'),
    ),
    null,
  );
});

// FREEZE: the course-479 Tutor Lab profile set (4 prompt stances x 3 critic
// settings) in tutor-core's bundled config. The lab's switches are pure
// profile selection, so each profile must load, name an existing prompt
// file, carry the right stance text, and configure the critic it claims.
// Course transcripts cite these profiles — a silent change breaks provenance.
// Background: TUTOR-CORE-SEAM-CHECK.md and COURSE-479-PLAN.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORE_ROOT = path.join(REPO_ROOT, 'tutor-core');

const STANCES = {
  recognition: { egoPrompt: 'tutor-ego-recognition.md', marker: /genuine recognition/i },
  placebo: { egoPrompt: 'tutor-ego-placebo.md', marker: /treat each learner as an individual and adapt/i },
  enhanced: { egoPrompt: 'tutor-ego-enhanced.md', marker: /deep understanding of the learner/i },
  naive: { egoPrompt: 'tutor-ego-naive.md', marker: /you are a helpful tutor/i },
};
const CRITICS = {
  off: { superegoPrompt: null },
  advisory: { superegoPrompt: 'tutor-superego-advocate.md', marker: /Learner Advocate/ },
  adversarial: { superegoPrompt: 'tutor-superego-adversary.md', marker: /Pedagogical Contrarian/ },
};

const config = parseYaml(fs.readFileSync(path.join(CORE_ROOT, 'config', 'tutor-agents.yaml'), 'utf8'));

test('all 12 course479 profiles exist with the right stance and critic wiring', () => {
  for (const [stance, stanceSpec] of Object.entries(STANCES)) {
    for (const [critic, criticSpec] of Object.entries(CRITICS)) {
      const name = `course479_${stance}_${critic}`;
      const profile = config.profiles?.[name];
      assert.ok(profile, `profile ${name} missing from tutor-core/config/tutor-agents.yaml`);

      assert.equal(profile.ego?.prompt_file, stanceSpec.egoPrompt, `${name}: wrong ego prompt file`);
      const egoPromptPath = path.join(CORE_ROOT, 'prompts', profile.ego.prompt_file);
      assert.ok(fs.existsSync(egoPromptPath), `${name}: ego prompt file missing on disk`);
      assert.match(
        fs.readFileSync(egoPromptPath, 'utf8'),
        stanceSpec.marker,
        `${name}: ego prompt lost its stance marker text`,
      );

      if (critic === 'off') {
        assert.equal(profile.superego, null, `${name}: critic off must mean no superego`);
        assert.equal(profile.dialogue?.enabled, false, `${name}: critic off must disable the dialogue loop`);
      } else {
        assert.equal(profile.superego?.prompt_file, criticSpec.superegoPrompt, `${name}: wrong critic prompt file`);
        assert.equal(profile.dialogue?.enabled, true, `${name}: critic ${critic} needs the dialogue loop on`);
        const superegoPromptPath = path.join(CORE_ROOT, 'prompts', profile.superego.prompt_file);
        assert.ok(fs.existsSync(superegoPromptPath), `${name}: critic prompt file missing on disk`);
        assert.match(
          fs.readFileSync(superegoPromptPath, 'utf8'),
          criticSpec.marker,
          `${name}: critic prompt lost its character marker text`,
        );
      }

      const provider = profile.ego?.provider;
      assert.ok(
        provider !== 'openrouter' || !/nemotron|kimi/.test(profile.ego?.model || ''),
        `${name}: nemotron/kimi must never be a course profile's model`,
      );
    }
  }
});

test('course479 stance prompts match the eval repo authoritative copies', () => {
  // prompts/ in the eval repo is the authoritative prompt source; the
  // bundled tutor-core copies the lab actually loads must not drift.
  const files = [
    ...Object.values(STANCES).map((s) => s.egoPrompt),
    'tutor-superego-advocate.md',
    'tutor-superego-adversary.md',
  ];
  for (const file of files) {
    const evalCopy = path.join(REPO_ROOT, 'prompts', file);
    const coreCopy = path.join(CORE_ROOT, 'prompts', file);
    if (!fs.existsSync(evalCopy)) continue; // stance prompt only bundled in core
    assert.equal(
      fs.readFileSync(coreCopy, 'utf8'),
      fs.readFileSync(evalCopy, 'utf8'),
      `${file}: tutor-core bundled copy drifted from the authoritative prompts/ copy`,
    );
  }
});

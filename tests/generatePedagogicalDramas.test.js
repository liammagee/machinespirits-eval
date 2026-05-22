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

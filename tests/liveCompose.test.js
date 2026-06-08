import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  ROLES,
  DEFAULT_MAX_TURNS,
  MAX_TURNS_CEILING,
  LIVE_VOCAB,
  tutorCellFor,
  startSession,
  humanTurn,
  viewSession,
  saveSession,
  listCourses,
  proposeSpec,
  buildMockDeps,
  buildMockGuideDeps,
  _resetSessionsForTest,
} from '../services/poetics/liveCompose.js';
import { loadCurriculumContext } from '../routes/chatRoutes.js';

// Every case runs on mock deps so no LLM is ever called and spend stays zero —
// the whole point of buildMockDeps(). The store is process-global, so reset it
// between cases.
const mock = buildMockDeps();
const savedFiles = [];

beforeEach(() => _resetSessionsForTest());

after(() => {
  // Clean up any artifacts saveSession wrote to exports/live-compose/.
  for (const rel of savedFiles) {
    try {
      fs.rmSync(path.resolve(process.cwd(), rel));
    } catch {
      /* already gone */
    }
  }
});

describe('liveCompose · tutorCellFor', () => {
  it('maps prompt_type × architecture to the four registered cells', () => {
    assert.equal(tutorCellFor('recognition', 'ego_superego'), 'cell_7_recog_multi_unified');
    assert.equal(tutorCellFor('recognition', 'ego_only'), 'cell_5_recog_single_unified');
    assert.equal(tutorCellFor('base', 'ego_superego'), 'cell_3_base_multi_unified');
    assert.equal(tutorCellFor('base', 'ego_only'), 'cell_1_base_single_unified');
  });

  it('defaults unknown values to recognition / ego_only', () => {
    assert.equal(tutorCellFor(undefined, undefined), 'cell_5_recog_single_unified');
    assert.equal(tutorCellFor('nonsense', 'nonsense'), 'cell_5_recog_single_unified');
  });
});

describe('liveCompose · human-as-learner (AI tutor opens)', () => {
  it('greets the human with an AI tutor line, then trades turns at zero spend', async () => {
    const { session, openingTurn } = await startSession(
      { humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR, topic: 'logarithms' },
      mock,
    );
    // AI holds the tutor seat and speaks first, so the human arrives to a line.
    assert.equal(session.humanRole, ROLES.LEARNER);
    assert.equal(session.aiRole, ROLES.TUTOR);
    assert.ok(openingTurn, 'opening AI turn should exist');
    assert.equal(openingTurn.role, ROLES.TUTOR);
    assert.equal(openingTurn.by, 'ai');
    assert.equal(session.nextSpeaker, ROLES.LEARNER, 'after the tutor opens, it is the human learner’s turn');

    const { humanTurn: h, aiTurn: a } = await humanTurn(session.id, 'I just want the rule', mock);
    assert.equal(h.role, ROLES.LEARNER);
    assert.equal(h.by, 'human');
    assert.equal(a.role, ROLES.TUTOR);
    assert.equal(a.by, 'ai');

    // Mock deps report zero usage, so no spend should accrue.
    const v = viewSession(session.id);
    assert.equal(v.spend.inputTokens, 0);
    assert.equal(v.spend.outputTokens, 0);
    assert.equal(v.turnCount, 3); // tutor-open, human, tutor-reply
  });

  it('never leaks AI deliberation onto the live wire view', async () => {
    const { openingTurn } = await startSession({ humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR }, mock);
    assert.ok(!('deliberation' in openingTurn), 'public turn must omit deliberation');
  });
});

describe('liveCompose · human-as-tutor (AI learner replies)', () => {
  it('lets the human open as tutor and the AI answer as learner', async () => {
    const { session, openingTurn } = await startSession({ humanRole: ROLES.TUTOR, openingSpeaker: ROLES.TUTOR }, mock);
    assert.equal(session.humanRole, ROLES.TUTOR);
    assert.equal(session.aiRole, ROLES.LEARNER);
    assert.equal(openingTurn, null, 'human opens, so there is no opening AI turn');
    assert.equal(session.nextSpeaker, ROLES.TUTOR);

    const { humanTurn: h, aiTurn: a } = await humanTurn(session.id, 'What is log base 2 of 8 asking, in words?', mock);
    assert.equal(h.role, ROLES.TUTOR);
    assert.equal(h.by, 'human');
    assert.equal(a.role, ROLES.LEARNER);
    assert.equal(a.by, 'ai');
  });
});

describe('liveCompose · turn-order + input guards', () => {
  it('rejects a second human turn while the AI turn is still resolving', async () => {
    const { session } = await startSession({ humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR }, mock);
    // p1 runs synchronously up to its first await, flipping nextSpeaker to the
    // AI seat; p2's guard then sees it is no longer the human's turn.
    const p1 = humanTurn(session.id, 'first', mock);
    await assert.rejects(humanTurn(session.id, 'second', mock), (e) => e.code === 'LIVE_NOT_YOUR_TURN');
    await p1;
  });

  it('rejects an empty human turn', async () => {
    const { session } = await startSession({ humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR }, mock);
    await assert.rejects(humanTurn(session.id, '   ', mock), (e) => e.code === 'LIVE_EMPTY_TURN');
  });

  it('throws a 404-coded error for an unknown session', () => {
    assert.throws(
      () => viewSession('live_does_not_exist'),
      (e) => e.code === 'LIVE_SESSION_NOT_FOUND',
    );
  });
});

describe('liveCompose · turn cap', () => {
  it('closes the session once maxTurns is reached and returns a null aiTurn', async () => {
    // maxTurns=2: AI tutor opens (1), human learner replies (2) → done, no AI reply.
    const { session } = await startSession(
      { humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR, maxTurns: 2 },
      mock,
    );
    const { aiTurn } = await humanTurn(session.id, 'a reply that hits the cap', mock);
    assert.equal(aiTurn, null, 'no AI reply once the cap is hit');
    const v = viewSession(session.id);
    assert.equal(v.status, 'done');
    assert.equal(v.turnCount, 2);
  });

  it('clamps maxTurns into [2, ceiling]', async () => {
    const { session: lo } = await startSession({ maxTurns: 1 }, mock);
    assert.equal(lo.maxTurns, 2);
    const { session: hi } = await startSession({ maxTurns: 9999 }, mock);
    assert.equal(hi.maxTurns, MAX_TURNS_CEILING);
    const { session: def } = await startSession({}, mock);
    assert.equal(def.maxTurns, DEFAULT_MAX_TURNS);
  });
});

describe('liveCompose · saveSession', () => {
  it('writes a self-describing transcript artifact with deliberation retained', async () => {
    const { session } = await startSession(
      { humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR, topic: 'save-test logarithms' },
      mock,
    );
    await humanTurn(session.id, 'a learner line for the artifact', mock);
    const { path: rel, bytes } = saveSession(session.id, { filename: 'livecompose-unit-test-artifact' });
    savedFiles.push(rel);

    assert.ok(bytes > 0);
    const abs = path.resolve(process.cwd(), rel);
    assert.ok(fs.existsSync(abs), 'artifact file should be on disk');
    const body = fs.readFileSync(abs, 'utf8');
    assert.match(body, /kind: live-compose-transcript/);
    assert.match(body, /tutor_cell: cell_5_recog_single_unified/);
    // Deliberation is stripped from the wire view but retained in the artifact.
    assert.match(body, /deliberation:/);
  });
});

describe('liveCompose · lecture binding (content-poetics-rhetoric)', () => {
  it('stores a spec lectureRef on the session and surfaces it in the view', async () => {
    // Human opens as learner → no opening AI turn, so this stays pure state (no LLM).
    const { session } = await startSession(
      { humanRole: ROLES.LEARNER, openingSpeaker: ROLES.LEARNER, lectureRef: '1001-lecture-1' },
      mock,
    );
    assert.equal(session.lectureRef, '1001-lecture-1');
    assert.equal(viewSession(session.id).lectureRef, '1001-lecture-1');
  });

  it('also accepts the scenario-style currentContent, and defaults to null', async () => {
    const { session: a } = await startSession({ currentContent: '1001-lecture-2' }, mock);
    assert.equal(a.lectureRef, '1001-lecture-2');
    const { session: b } = await startSession({}, mock);
    assert.equal(b.lectureRef, null);
  });

  it('resolves a poetics-rhetoric lecture now the package is registered', () => {
    // Proves CONTENT_PACKAGES carries content-poetics-rhetoric (course 1001), so a
    // sit-in tutor bound to "1001-lecture-1" teaches from the real lecture text.
    const ctx = loadCurriculumContext('1001-lecture-1');
    assert.ok(ctx, 'course 1001 must resolve via loadCurriculumContext');
    assert.equal(ctx.courseId, '1001');
    assert.equal(ctx.lectureRef, '1001-lecture-1');
    assert.ok(ctx.text && ctx.text.length > 500, 'lecture text should be loaded');
  });
});

describe('liveCompose · listCourses + LIVE_VOCAB', () => {
  it('returns the content catalog with course 1001 and a stable lecture shape', () => {
    const courses = listCourses();
    assert.ok(Array.isArray(courses) && courses.length > 0, 'a populated content tree should yield courses');

    // Every course carries the exact shape the web form, the CLI, and the guide
    // catalog all read — drift here breaks all three at once.
    for (const c of courses) {
      assert.equal(typeof c.courseId, 'string');
      assert.equal(typeof c.courseTitle, 'string');
      assert.equal(typeof c.courseSubtitle, 'string');
      assert.equal(typeof c.isFixture, 'boolean');
      assert.ok(Array.isArray(c.lectures) && c.lectures.length > 0, `${c.courseId} should carry lectures`);
      for (const l of c.lectures) {
        assert.equal(typeof l.ref, 'string');
        assert.equal(typeof l.num, 'number');
        assert.equal(typeof l.title, 'string');
        assert.match(l.ref, /^\d+-lecture-\d+$/);
      }
    }

    // Course 1001 is the poetics-rhetoric package the lecture-binding suite relies on.
    const c1001 = courses.find((c) => c.courseId === '1001');
    assert.ok(c1001, 'course 1001 (poetics-rhetoric) must be present');
    assert.ok(
      c1001.lectures.some((l) => l.ref === '1001-lecture-1'),
      'course 1001 must expose 1001-lecture-1',
    );

    // Subject courses sort before eval fixtures (content-test-*), so a hand player
    // sees real curricula first.
    const firstFixture = courses.findIndex((c) => c.isFixture);
    if (firstFixture !== -1) {
      const lastSubject = courses.map((c) => c.isFixture).lastIndexOf(false);
      assert.ok(firstFixture > lastSubject, 'fixtures must sort after all subject courses');
    }
  });

  it('exposes a frozen, self-consistent vocabulary the clamp enforces', () => {
    assert.deepEqual([...LIVE_VOCAB.promptTypes], ['recognition', 'base']);
    assert.deepEqual([...LIVE_VOCAB.tutorArchs], ['ego_only', 'ego_superego']);
    assert.ok(LIVE_VOCAB.personas.includes('struggling_anxious'));
    assert.ok(LIVE_VOCAB.learnerArch.includes('ego_superego_recognition_authentic'));
    // Frozen so the web form, the CLI, and the guide catalog can share one source
    // of truth without any of them mutating it out from under the others.
    assert.ok(Object.isFrozen(LIVE_VOCAB));
    assert.ok(Object.isFrozen(LIVE_VOCAB.promptTypes));
    assert.ok(Object.isFrozen(LIVE_VOCAB.tutorArchs));
    assert.ok(Object.isFrozen(LIVE_VOCAB.personas));
    assert.ok(Object.isFrozen(LIVE_VOCAB.learnerArch));
  });
});

describe('liveCompose · proposeSpec (the setup guide)', () => {
  // The guide is one metered LLM call; inject a chatFn so every case is zero-cost.
  // The signature mirrors the real openRouterChat: (model, system, messages, opts)
  // → { content, usage, model }.
  const guideWith = (content, { usage, model } = {}) => ({
    chatFn: async () => ({
      content,
      usage: usage || { inputTokens: 0, outputTokens: 0 },
      model: model || 'stub-guide-model',
    }),
  });
  // The same catalog the route/CLI assemble: live courses + the shared vocab.
  const catalog = () => ({
    courses: listCourses(),
    personas: LIVE_VOCAB.personas,
    learnerArch: LIVE_VOCAB.learnerArch,
  });

  it('clamps a well-formed proposal and passes rationale/notes/usage/model through', async () => {
    const content = JSON.stringify({
      spec: {
        humanRole: 'tutor',
        topic: 'the chain rule',
        hamartia: 'differentiates the outer function only',
        lectureRef: '',
        promptType: 'base',
        tutorArchitecture: 'ego_only',
        persona: 'eager_explorer',
        learnerArchitecture: 'ego_superego',
        openingSpeaker: 'learner',
        maxTurns: 8,
      },
      rationale: 'You teach; the AI plays a student who only differentiates the outer function.',
      notes: 'bump maxTurns if you want a longer scene',
    });
    const out = await proposeSpec(
      { description: 'I want to play teacher on the chain rule', catalog: catalog() },
      guideWith(content, { usage: { inputTokens: 11, outputTokens: 22 }, model: 'stub-guide-model' }),
    );
    assert.equal(out.spec.humanRole, 'tutor');
    assert.equal(out.spec.topic, 'the chain rule');
    assert.equal(out.spec.promptType, 'base');
    assert.equal(out.spec.tutorArchitecture, 'ego_only');
    assert.equal(out.spec.persona, 'eager_explorer');
    assert.equal(out.spec.learnerArchitecture, 'ego_superego');
    assert.equal(out.spec.openingSpeaker, 'learner');
    assert.equal(out.spec.maxTurns, 8);
    assert.match(out.rationale, /plays a student/);
    assert.match(out.notes, /bump maxTurns/);
    assert.deepEqual(out.usage, { inputTokens: 11, outputTokens: 22 });
    assert.equal(out.model, 'stub-guide-model');
  });

  it('coerces every out-of-vocabulary field to a safe default', async () => {
    const content = JSON.stringify({
      spec: {
        humanRole: 'spectator',
        topic: '',
        hamartia: '',
        lectureRef: '9999-lecture-7',
        promptType: 'wild',
        tutorArchitecture: 'triple',
        persona: 'nonexistent_persona',
        learnerArchitecture: 'nope',
        openingSpeaker: 'nobody',
        maxTurns: 9999,
      },
    });
    const out = await proposeSpec({ description: 'garbage in', catalog: catalog() }, guideWith(content));
    assert.equal(out.spec.humanRole, 'learner'); // unknown role → default learner
    assert.ok(out.spec.topic.length > 0, 'empty topic falls back to a default'); // never empty
    assert.equal(out.spec.lectureRef, ''); // unknown ref dropped entirely
    assert.equal(out.spec.promptType, 'recognition');
    assert.equal(out.spec.tutorArchitecture, 'ego_superego');
    assert.equal(out.spec.persona, LIVE_VOCAB.personas[0]);
    assert.equal(out.spec.learnerArchitecture, LIVE_VOCAB.learnerArch[0]);
    assert.equal(out.spec.openingSpeaker, 'tutor');
    assert.equal(out.spec.maxTurns, MAX_TURNS_CEILING); // 9999 clamped down to the ceiling
  });

  it('floors maxTurns and recovers from a non-numeric maxTurns', async () => {
    const lo = await proposeSpec(
      { description: 'x', catalog: catalog() },
      guideWith(JSON.stringify({ spec: { maxTurns: 1 } })),
    );
    assert.equal(lo.spec.maxTurns, 2);
    const nan = await proposeSpec(
      { description: 'x', catalog: catalog() },
      guideWith(JSON.stringify({ spec: { maxTurns: 'lots' } })),
    );
    assert.equal(nan.spec.maxTurns, DEFAULT_MAX_TURNS);
  });

  it('keeps a lectureRef that exists in the live catalog', async () => {
    const content = JSON.stringify({ spec: { topic: 'figures of speech', lectureRef: '1001-lecture-1' } });
    const out = await proposeSpec(
      { description: 'teach me from the rhetoric lecture', catalog: catalog() },
      guideWith(content),
    );
    assert.equal(out.spec.lectureRef, '1001-lecture-1');
  });

  it('extracts a JSON object from inside a ```json fence wrapped in prose', async () => {
    const content = `Sure — here is a scene for you:\n\n\`\`\`json\n${JSON.stringify({
      spec: { topic: 'osmosis', promptType: 'recognition' },
    })}\n\`\`\`\n\nToggle the dials if you like.`;
    const out = await proposeSpec({ description: 'osmosis please', catalog: catalog() }, guideWith(content));
    assert.equal(out.spec.topic, 'osmosis');
    assert.equal(out.spec.promptType, 'recognition');
  });

  it('rejects an empty description before any LLM call (LIVE_GUIDE_EMPTY)', async () => {
    // The empty-description guard runs first, so even with a chatFn injected the
    // guide never calls it — describe-then-build can't be skipped.
    await assert.rejects(
      proposeSpec({ description: '   ', catalog: catalog() }, guideWith('{}')),
      (e) => e.code === 'LIVE_GUIDE_EMPTY' && e.statusCode === 400,
    );
  });

  it('rejects an unparseable guide reply (LIVE_GUIDE_PARSE)', async () => {
    await assert.rejects(
      proposeSpec({ description: 'something', catalog: catalog() }, guideWith('I cannot help with that request.')),
      (e) => e.code === 'LIVE_GUIDE_PARSE' && e.statusCode === 502,
    );
  });

  it('buildMockGuideDeps yields a valid, applyable free-preview spec at zero usage', async () => {
    const out = await proposeSpec({ description: 'anything at all', catalog: catalog() }, buildMockGuideDeps());
    assert.equal(out.spec.humanRole, 'learner');
    assert.match(out.spec.topic, /logarithms/);
    assert.equal(out.spec.openingSpeaker, 'tutor');
    assert.equal(out.usage.inputTokens, 0);
    assert.equal(out.usage.outputTokens, 0);
    assert.equal(out.model, 'mock');

    // "Applyable" = startSession accepts the spec verbatim. openingSpeaker=tutor with
    // the human as learner means the AI tutor opens — run it on mock turn deps so the
    // round-trip stays zero-cost.
    const { session, openingTurn } = await startSession(out.spec, mock);
    assert.equal(session.humanRole, ROLES.LEARNER);
    assert.equal(session.aiRole, ROLES.TUTOR);
    assert.ok(openingTurn && openingTurn.role === ROLES.TUTOR, 'the mock AI tutor should open');
  });
});

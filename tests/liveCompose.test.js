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
  endSession,
  scoreSession,
  listCourses,
  getLectureContent,
  proposeSpec,
  buildMockDeps,
  buildMockGuideDeps,
  _resetSessionsForTest,
} from '../services/poetics/liveCompose.js';
import { loadCurriculumContext } from '../services/legacyChatEngine.js';

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

describe('liveCompose · getLectureContent', () => {
  // Backs the /api/compose/live/lecture/:ref route that surfaces "the reading" —
  // the lecture the tutor teaches from — to the human learner in the sit-in rail.
  it('returns the full lecture for a known ref', () => {
    const c = getLectureContent('1001-lecture-1');
    assert.ok(c, '1001-lecture-1 must resolve');
    assert.equal(c.courseId, '1001');
    assert.equal(c.courseTitle, 'Poiesis and Rhetoric');
    assert.equal(c.lectureNum, 1);
    assert.equal(c.lectureRef, '1001-lecture-1');
    assert.equal(typeof c.title, 'string');
    assert.ok(c.title.length > 0, 'a lecture title should be derivable from the markdown');
    assert.ok(typeof c.text === 'string' && c.text.length > 0, 'lecture body text must be present');
  });

  it('returns null for an unknown or empty ref (route maps this to 404)', () => {
    assert.equal(getLectureContent('9999-lecture-99'), null);
    assert.equal(getLectureContent(''), null);
    assert.equal(getLectureContent(null), null);
    assert.equal(getLectureContent(undefined), null);
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

describe('liveCompose · per-turn meta (always on the wire)', () => {
  it('stamps at/latencyMs/tokens on the AI opening turn and on the human+AI turns', async () => {
    const { session, openingTurn } = await startSession(
      { humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR, topic: 'meta probe' },
      mock,
    );
    // AI opening (an ego_only tutor cell here): arrival time stamped, generation
    // latency summed from the one ego step (280ms in the mock), token counts
    // present (0 in free preview). Meta is NOT the AI's interior, so it ships even
    // with the deliberation console off.
    assert.equal(typeof openingTurn.at, 'number');
    assert.equal(openingTurn.latencyMs, 280);
    assert.equal(openingTurn.inputTokens, 0);
    assert.equal(openingTurn.outputTokens, 0);
    assert.ok(!('deliberation' in openingTurn), 'meta ships without leaking deliberation');

    const { humanTurn: h, aiTurn: a } = await humanTurn(session.id, 'a learner line', mock);
    // Human turn: arrival time stamped, but no generation latency (a person typed
    // it, not a model) and zero tokens.
    assert.equal(typeof h.at, 'number');
    assert.equal(h.latencyMs, null);
    assert.equal(h.inputTokens, 0);
    assert.equal(h.outputTokens, 0);
    // AI reply: time + latency + tokens all present.
    assert.equal(typeof a.at, 'number');
    assert.equal(a.latencyMs, 280);
    assert.equal(a.inputTokens, 0);
    assert.equal(a.outputTokens, 0);
  });

  it('sums ego+superego latency for an ego_superego tutor', async () => {
    const { openingTurn } = await startSession(
      { humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR, tutorArchitecture: 'ego_superego' },
      mock,
    );
    // ego (280) + superego (190); the ego_revision step carries no latency (it is
    // not its own LLM call) so it does not add to the sum.
    assert.equal(openingTurn.latencyMs, 470);
  });
});

describe('liveCompose · aiModels capture', () => {
  it('backfills the AI tutor model from its first turn deliberation', async () => {
    const { session } = await startSession({ humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR }, mock);
    // The tutor seat is an ego_only cell here, so only the ego model is known.
    assert.equal(session.aiModels.ego, 'mock/tutor-ego');
    assert.ok(!('superego' in session.aiModels), 'an ego_only tutor exposes no superego model');
  });

  it('captures both AI learner models once the learner has spoken', async () => {
    const { session } = await startSession({ humanRole: ROLES.TUTOR, openingSpeaker: ROLES.TUTOR }, mock);
    // Human opens as tutor, so the AI learner has not spoken yet — no models known.
    assert.deepEqual(session.aiModels, {});
    const { session: after } = await humanTurn(session.id, 'a tutor prompt for the AI learner', mock);
    assert.equal(after.aiModels.ego, 'mock/learner-ego');
    assert.equal(after.aiModels.superego, 'mock/learner-superego');
  });
});

describe('liveCompose · deliberation gating (opt-in console)', () => {
  it('ships a normalized deliberation array when showDeliberation is set', async () => {
    const { openingTurn } = await startSession(
      {
        humanRole: ROLES.LEARNER,
        openingSpeaker: ROLES.TUTOR,
        showDeliberation: true,
        tutorArchitecture: 'ego_superego',
      },
      mock,
    );
    assert.ok(Array.isArray(openingTurn.deliberation));
    assert.deepEqual(
      openingTurn.deliberation.map((d) => d.role),
      ['ego', 'superego', 'ego_revision'],
    );
    // Normalized wire shape: role/model/content/latency only — never the raw
    // apiPayload / inputMessages the engines carry internally.
    const ego = openingTurn.deliberation[0];
    assert.equal(ego.model, 'mock/tutor-ego');
    assert.equal(ego.latencyMs, 280);
    assert.equal(typeof ego.content, 'string');
    assert.ok(!('apiPayload' in ego));
    assert.ok(!('inputMessages' in ego));
  });

  it('viewSession(debug) re-ships deliberation; the default view strips it', async () => {
    const { session } = await startSession(
      { humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR, showDeliberation: true },
      mock,
    );
    const dbg = viewSession(session.id, { debug: true });
    assert.equal(dbg.debug, true);
    assert.ok('deliberation' in dbg.transcript[0], 'debug view carries deliberation');
    const plain = viewSession(session.id); // no debug → interior stripped
    assert.equal(plain.debug, false);
    assert.ok(!('deliberation' in plain.transcript[0]), 'default view omits deliberation');
  });
});

describe('liveCompose · timestamped default filename', () => {
  it('surfaces a stable suggestedFilename and uses it when save gets no filename', async () => {
    const { session } = await startSession(
      { humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR, topic: 'naming probe' },
      mock,
    );
    const v = viewSession(session.id);
    // live-<topic-slug>-<utc-stamp>, e.g. live-naming-probe-20260607T120000Z.
    assert.match(v.suggestedFilename, /^live-naming-probe-\d{8}T\d{6}Z$/);
    // Stable across reads (keyed on createdAt), so the pre-filled save box and a
    // no-filename save resolve to the same artifact name.
    assert.equal(viewSession(session.id).suggestedFilename, v.suggestedFilename);

    const { path: rel } = saveSession(session.id); // no filename → falls back to the default
    savedFiles.push(rel);
    assert.ok(
      rel.endsWith(`${v.suggestedFilename}.yaml`),
      `expected save path to end with the default name, got ${rel}`,
    );
  });
});

describe('liveCompose · concise seam (live-only brevity)', () => {
  // The brevity directive lives entirely on the live path: startSession sets
  // session.concise, and defaultTutorTurn reads it to decide whether to pass the
  // one-question-per-turn styleDirective + token cap to runTutorTurn. A recording
  // tutorTurnFn stands in for defaultTutorTurn and confirms it receives that flag,
  // so the scored batch eval path is provably never touched.
  const recordingDeps = (sink) => ({
    tutorTurnFn: async ({ session }) => {
      sink.concise = session.concise;
      return { text: 'mock tutor line', deliberation: [], usage: { inputTokens: 0, outputTokens: 0 } };
    },
  });

  it('defaults concise on and threads the flag through to the tutor turn', async () => {
    const sink = {};
    const { session } = await startSession(
      { humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR },
      recordingDeps(sink),
    );
    assert.equal(session.concise, true, 'the view exposes concise=true by default');
    assert.equal(sink.concise, true, 'the tutor turn receives session.concise');
  });

  it('spec.concise=false restores the full instrument behavior', async () => {
    const sink = {};
    const { session } = await startSession(
      { humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR, concise: false },
      recordingDeps(sink),
    );
    assert.equal(session.concise, false);
    assert.equal(sink.concise, false);
  });
});

describe('liveCompose · empty-AI-turn safety net', () => {
  // A reasoning model can emit only internal content and return a blank external
  // line. Rather than land a silent empty bubble, the engine raises a clear,
  // model-naming error and does NOT advance the turn — the human retries or switches.
  const emptyTutor = {
    tutorTurnFn: async () => ({ text: '   ', deliberation: [], usage: { inputTokens: 0, outputTokens: 0 } }),
  };
  const emptyLearner = {
    learnerTurnFn: async () => ({ text: '', deliberation: [], usage: { inputTokens: 0, outputTokens: 0 } }),
  };

  it('rejects an empty AI tutor opening and names the tutor seat', async () => {
    await assert.rejects(
      startSession({ humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR, topic: 'x' }, emptyTutor),
      (e) => e.code === 'LIVE_EMPTY_AI_TURN' && e.statusCode === 502 && /AI tutor/.test(e.message),
    );
  });

  it('rejects an empty AI learner reply, names the default model, and does not advance the turn', async () => {
    // Human opens as tutor → no opening AI turn, so startSession stays pure state.
    const { session } = await startSession({ humanRole: ROLES.TUTOR, openingSpeaker: ROLES.TUTOR }, emptyLearner);
    await assert.rejects(
      humanTurn(session.id, 'a tutor prompt the AI learner will fail to answer', emptyLearner),
      (e) => e.code === 'LIVE_EMPTY_AI_TURN' && /kimi-k2\.5/.test(e.message),
    );
    // The human line landed, but the failed AI turn must not have appended a blank.
    const v = viewSession(session.id);
    assert.equal(v.turnCount, 1, 'only the human turn is recorded; the empty AI turn is rejected');
    assert.equal(v.transcript[0].by, 'human');
  });
});

describe('liveCompose · learner-model override (live-only)', () => {
  // A live-only pick that forces ALL AI-learner agents onto one model — the escape
  // hatch when the configured default (kimi-k2.5) returns a blank turn. The scored
  // eval path never sets it.
  const recordingLearner = (sink) => ({
    learnerTurnFn: async ({ session }) => {
      sink.learnerModel = session.learnerModel;
      return { text: '(mock learner) I think I see…', deliberation: [], usage: { inputTokens: 0, outputTokens: 0 } };
    },
  });

  it('stores the override on the session and surfaces it in the view', async () => {
    const { session } = await startSession(
      { humanRole: ROLES.TUTOR, openingSpeaker: ROLES.TUTOR, learnerModel: 'openai/gpt-5-mini' },
      mock,
    );
    assert.equal(session.learnerModel, 'openai/gpt-5-mini');
    assert.equal(viewSession(session.id).learnerModel, 'openai/gpt-5-mini');
  });

  it('defaults to null when no override is given', async () => {
    const { session } = await startSession({ humanRole: ROLES.TUTOR, openingSpeaker: ROLES.TUTOR }, mock);
    assert.equal(session.learnerModel, null);
    assert.equal(viewSession(session.id).learnerModel, null);
  });

  it('threads the override into the AI-learner turn', async () => {
    const sink = {};
    const { session } = await startSession(
      { humanRole: ROLES.TUTOR, openingSpeaker: ROLES.TUTOR, learnerModel: 'z-ai/glm-4.7' },
      recordingLearner(sink),
    );
    await humanTurn(session.id, 'a tutor prompt for the AI learner', recordingLearner(sink));
    assert.equal(sink.learnerModel, 'z-ai/glm-4.7', 'the learner turn sees session.learnerModel');
  });
});

describe('liveCompose · endSession (terminate early)', () => {
  it('freezes a live scene to done and refuses further turns', async () => {
    const { session } = await startSession({ humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR }, mock);
    const ended = endSession(session.id, 'user_ended');
    assert.equal(ended.status, 'done');
    assert.equal(ended.stoppedReason, 'user_ended');
    // No more turns once ended.
    await assert.rejects(
      humanTurn(session.id, 'too late', mock),
      (e) => e.code === 'LIVE_SESSION_CLOSED' && e.statusCode === 409,
    );
  });

  it('is idempotent: a second end never overwrites the first stop reason', async () => {
    const { session } = await startSession({ humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR }, mock);
    endSession(session.id, 'user_ended');
    const again = endSession(session.id, 'something_else');
    assert.equal(again.status, 'done');
    assert.equal(again.stoppedReason, 'user_ended', 'only the live→done transition sets the reason');
  });
});

describe('liveCompose · scoreSession (poetics rubric, mock critic)', () => {
  it('scores the transcript-so-far on dramatic form at zero spend', async () => {
    const { session } = await startSession(
      { humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR, topic: 'logarithms' },
      mock,
    );
    await humanTurn(session.id, 'I just add the two logs, right?', mock);
    const { score, session: view } = await scoreSession(session.id, mock);

    // Six poetics dimensions, each clamped into the 1–5 scale with a cited moment.
    assert.equal(score.dimensions.length, 6);
    for (const d of score.dimensions) {
      assert.ok(typeof d.id === 'string' && d.name, `dimension ${d.id} carries an id + name`);
      assert.ok(d.score >= 1 && d.score <= 5, `dimension ${d.id} score in range`);
    }
    assert.ok(score.overall >= 1 && score.overall <= 5);
    assert.ok(score.headline.length > 0);
    assert.equal(score.model, 'mock/critic');
    assert.ok(score.rubricVersion, 'the verdict records the rubric version it used');
    assert.equal(score.scoredAtTurn, view.turnCount, 'the verdict records how far the scene had played');

    // Mock critic reports zero usage, so scoring accrues no spend.
    assert.equal(view.spend.inputTokens, 0);
    assert.equal(view.spend.outputTokens, 0);
    // The verdict is stashed on the session, so later views (and the saved artifact) carry it.
    assert.ok(viewSession(session.id).score, 'the score persists on the session view');
  });

  it('can score a finished scene (scoring does not require a live session)', async () => {
    const { session } = await startSession({ humanRole: ROLES.LEARNER, openingSpeaker: ROLES.TUTOR }, mock);
    await humanTurn(session.id, 'a line so there is something to score', mock);
    endSession(session.id);
    const { score } = await scoreSession(session.id, mock);
    assert.equal(score.dimensions.length, 6);
  });

  it('refuses to score an empty transcript (LIVE_NOTHING_TO_SCORE)', async () => {
    // Human opens as tutor → no turns played yet, so there is nothing to score.
    const { session } = await startSession({ humanRole: ROLES.TUTOR, openingSpeaker: ROLES.TUTOR }, mock);
    await assert.rejects(
      scoreSession(session.id, mock),
      (e) => e.code === 'LIVE_NOTHING_TO_SCORE' && e.statusCode === 400,
    );
  });
});

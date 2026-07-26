import {
  assert,
  fs,
  os,
  path,
  test,
  FIRST_TURN_CLUE_ARGS,
  readTutorStubTraceEvents,
  runInteractive,
} from './helpers/tutorStubInteractiveHarness.js';

test('coach mode keeps guidance private and incorporates it into the next tutor prompt', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-coach-mode-'));
  try {
    const guidance = 'Use a concrete analogy before asking one question.';
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        ...FIRST_TURN_CLUE_ARGS,
        '--no-classifier',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: `/coach ${guidance}\n/mode learner\nThe assay still confuses me.\n`,
      stopWhen: (plain) => plain.includes('1 new clue'),
    });

    assert.match(result.plain, /coach queued > Use a concrete analogy/u);
    assert.match(result.plain, /private; applies to tutor turn 1/u);
    assert.match(result.plain, /LEARNER mode/u);
    assert.match(fs.readFileSync(result.logPath, 'utf8'), /\[Private coach guidance for this tutor turn\]/u);
    assert.match(fs.readFileSync(result.logPath, 'utf8'), /Use a concrete analogy before asking one question\./u);

    const trace = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const completed = trace.find((event) => event.type === 'turn_complete');
    assert.equal(completed.turnRecord.learner, 'The assay still confuses me.');
    assert.equal(completed.turnRecord.coachGuidance[0].text, guidance);
    assert.ok(!completed.turnRecord.learner.includes(guidance));
    assert.ok(trace.some((event) => event.type === 'coach_guidance_applied'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/meta directs a persistent tutor change without creating a public learner turn', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-director-guidance-'));
  try {
    const direction = 'Use shorter replies with less world-specific jargon.';
    const learner = 'The assay still confuses me.';
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        ...FIRST_TURN_CLUE_ARGS,
        '--no-classifier',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: `/meta ${direction}\n${learner}\n`,
      stopWhen: (plain) => plain.includes('1 new clue'),
    });

    assert.match(result.plain, /director request > Use shorter replies with less world-specific jargon\./u);
    assert.match(result.plain, /private control, not learner speech · applies from tutor turn 1/u);
    const modelInput = fs.readFileSync(result.logPath, 'utf8');
    assert.match(modelInput, /\[Private learner-to-director tutor-change request\]/u);
    assert.match(modelInput, /Use shorter replies with less world-specific jargon\./u);
    assert.match(modelInput, new RegExp(`Learner says:\\n${learner.replace('.', '\\.')}`, 'u'));

    const trace = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const completed = trace.find((event) => event.type === 'turn_complete');
    assert.equal(completed.turnRecord.learner, learner);
    assert.equal(completed.turnRecord.directorGuidance.text, direction);
    assert.equal(completed.turnRecord.directorGuidance.publicTranscriptChanged, false);
    assert.ok(!completed.turnRecord.learner.includes(direction));
    assert.equal(trace.find((event) => event.type === 'director_guidance_set').publicTranscriptChanged, false);
    assert.equal(trace.find((event) => event.type === 'director_guidance_applied').turn, 1);

    const sourceTrace = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => path.join(tmp, name))
      .find((filePath) => fs.readFileSync(filePath, 'utf8').includes('director_guidance_set'));
    assert.ok(sourceTrace);
    const sourceTutorText = fs
      .readFileSync(sourceTrace, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .find((event) => event.type === 'turn_complete')?.turnRecord?.tutor;
    const expectedResumeQuestion = sourceTutorText
      ?.match(/[^.!?]+(?:[.!?]+["'’”)]*|$)/gu)
      ?.map((sentence) => sentence.trim())
      .filter((sentence) => sentence.includes('?'))
      .at(-1);
    assert.ok(expectedResumeQuestion);
    const resumed = await runInteractive({
      tmp,
      args: [
        '--resume',
        sourceTrace,
        '--no-opening',
        '--no-classifier',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '',
      followupInputs: [
        {
          afterPlainIncludes: 'Welcome back.',
          text: 'I still need to connect the assay mark to one crucible.\n',
        },
      ],
      stopWhen: (plain) => (plain.match(/tutor >/gu) || []).length >= 2,
    });
    assert.match(resumed.plain, /resume: loaded 1 turn/u);
    assert.match(resumed.plain, /director request: Use shorter replies with less world-specific jargon\./u);
    assert.match(resumed.plain, /tutor > Welcome back\./u);
    assert.match(resumed.plain, /We were working on this question:/u);
    assert.match(resumed.plain, /You had just put this on the table: “The assay still confuses me\.”/u);
    assert.ok(resumed.plain.includes(`We paused at this question: ${expectedResumeQuestion}`));
    const resumedModelInput = fs.readFileSync(resumed.logPath, 'utf8');
    assert.match(resumedModelInput, /Welcome back\./u);
    assert.match(resumedModelInput, /I still need to connect the assay mark to one crucible\./u);
    const resumedEvents = readTutorStubTraceEvents(tmp).filter((event) => event.type === 'tutor_resume_handoff');
    assert.equal(resumedEvents.length, 1);
    assert.equal(resumedEvents[0].sourceTurn, 1);
    assert.equal(resumedEvents[0].repriseKind, 'question');
    assert.equal(resumedEvents[0].repriseText, expectedResumeQuestion);
    assert.equal(resumedEvents[0].publicTranscriptChanged, true);
    assert.equal(resumedEvents[0].proofStateChanged, false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/director ask answers from application context and returns without creating a public learner turn', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-cli-director-'));
  try {
    const question = 'How do I set up an adversarial teacher with a difficult learner in mixed mode?';
    const result = await runInteractive({
      tmp,
      args: [
        '--mixed-learner',
        '--dag',
        '--tutor-learner-dag',
        '--dag-fact-dropout',
        '0',
        '--no-classifier',
        '--register-policy',
        'dynamic',
        '--register-temperature',
        '0.15',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-remember-settings',
        '--auto-learner-profile',
        'affective_resistant',
        '--release-speed',
        '1',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: `/director ask ${question}\n`,
      stopWhen: (plain) => plain.includes('private app help · no setting changed'),
    });

    assert.match(result.plain, /director > Use \/tutor adversarial_teacher/u);
    assert.match(result.plain, /\/learner affective_resistant/u);
    assert.match(result.plain, /private app help · no setting changed · returning to the tutor interaction/u);
    assert.match(result.plain, /tutor ↻ >/u);
    assert.match(result.plain, /session status > MIXED/u);

    const modelInput = fs.readFileSync(result.logPath, 'utf8');
    const directorInput = modelInput.split('\n---CALL---\n').find((call) => call.includes('# CLI director question'));
    assert.ok(directorInput);
    assert.match(directorInput, new RegExp(question.replace(/[?]/gu, '\\?'), 'u'));
    assert.match(directorInput, /"sessionMode":"mixed"/u);
    assert.match(directorInput, /"aliases":\["\/learner","\/tutor"\]|"aliases":\["\/tutor","\/learner"\]/u);
    assert.match(directorInput, /"adversarial_teacher"/u);
    assert.match(directorInput, /"affective_resistant"/u);
    assert.doesNotMatch(directorInput, /Concealed answer|Hidden premise ledger|Authored proof path/u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const answer = events.find((event) => event.type === 'cli_director_answer');
    assert.equal(answer.question, question);
    assert.equal(answer.publicTranscriptChanged, false);
    assert.equal(answer.context.authority.scope, 'application_interface_only');
    assert.ok(!events.some((event) => event.type === 'learner_input_routed'));
    assert.ok(!events.some((event) => event.type === 'director_guidance_set'));
    assert.ok(!events.some((event) => event.type === 'turn_complete'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/meta ask is an application-help alias rather than persistent tutor direction', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-meta-cli-director-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--mixed-learner',
        '--no-classifier',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-remember-settings',
        '--auto-learner-profile',
        'affective_resistant',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/meta ask Which command changes the tutor character?\n',
      stopWhen: (plain) => plain.includes('private app help · no setting changed'),
    });

    assert.match(result.plain, /director > Use \/tutor adversarial_teacher/u);
    assert.match(result.plain, /private app help · no setting changed/u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const answer = events.find((event) => event.type === 'cli_director_answer');
    assert.equal(answer.source, '/meta ask');
    assert.ok(!events.some((event) => event.type === 'director_guidance_set'));
    assert.ok(!events.some((event) => event.type === 'learner_input_routed'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/director request survives reset while /notes remains view-only', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-director-reset-'));
  try {
    const direction = 'Keep the tutor literal and concise.';
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--no-classifier',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: `/director ${direction}\n/reset\n/notes Replace the active request.\n/status\n`,
      stopWhen: (plain) => plain.includes(`director request: ${direction}`),
    });

    assert.match(result.plain, /private control, not learner speech/u);
    assert.match(result.plain, /previous turns discarded · learner profile, settings, and director request kept/u);
    assert.match(result.plain, /\/notes takes no argument; use \/meta <request>/u);
    assert.match(result.plain, /director request: Keep the tutor literal and concise\./u);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const reset = events.find((event) => event.type === 'interactive_dialogue_reset');
    assert.equal(reset.directorGuidance.active.text, direction);
    assert.ok(reset.preserved.includes('director_guidance'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('unsafe coach guidance is sanitized and the tutor continues from a public-only rebuilt prompt', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-coach-boundary-recovery-'));
  try {
    const futureClue =
      "The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years.";
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        ...FIRST_TURN_CLUE_ARGS,
        '--no-classifier',
        '--no-register-selection',
        '--dag',
        '--tutor-learner-dag',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: `/coach ${futureClue}\n/mode learner\nThe assay still confuses me.\n`,
      stopWhen: (plain) => plain.includes('1 new clue'),
    });

    assert.doesNotMatch(result.plain, /Speaking-tutor prompt crossed the private-planner boundary/u);
    const trace = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const blocked = trace.find((event) => event.type === 'tutor_speaker_privilege_audit');
    assert.ok(blocked, 'expected the rebuilt prompt to retain a fail-closed privilege audit');
    assert.equal(blocked.audit?.ok, true);
    const recovery = trace.find((event) => event.type === 'tutor_speaker_privilege_recovery');
    if (recovery) {
      assert.equal(recovery.applied, true);
      assert.equal(recovery.speakerPrivilegeAudit?.ok, true);
      assert.equal(recovery.promptAudit?.ok, true);
    }
    const tutorCall = trace.find((event) => event.type === 'model_call' && event.role === 'tutor_stub_tutor');
    assert.ok(tutorCall, 'expected the tutor model call to proceed after safe recovery');
    assert.equal(tutorCall.request.config.speakerPrivilegeAudit.ok, true);
    const tutorPrompt = tutorCall.request.messages.at(-1)?.content || '';
    assert.doesNotMatch(tutorPrompt, /worn burin with the sprung heel/u);
    assert.match(tutorPrompt, /Private coach guidance/u);
    assert.ok(trace.some((event) => event.type === 'turn_complete'));
    assert.equal(
      trace.some((event) => event.type === 'model_call_error'),
      false,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('unsafe director guidance cannot place future evidence in the tutor prompt', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-director-boundary-'));
  try {
    const futureClue =
      "The old founder's tools were never sold off. The inventory of his estate, sworn and unredeemed, leaves his graving-irons to his widow alone — among them the worn burin with the sprung heel, kept in Edony's keeping these ten years.";
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        ...FIRST_TURN_CLUE_ARGS,
        '--no-classifier',
        '--no-register-selection',
        '--dag',
        '--tutor-learner-dag',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: `/meta ${futureClue}\nThe assay still confuses me.\n`,
      stopWhen: (plain) => plain.includes('1 new clue'),
    });

    assert.doesNotMatch(result.plain, /Speaking-tutor prompt crossed the private-planner boundary/u);
    const trace = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const tutorCall = trace.find((event) => event.type === 'model_call' && event.role === 'tutor_stub_tutor');
    assert.ok(tutorCall);
    assert.equal(tutorCall.request.config.speakerPrivilegeAudit.ok, true);
    const tutorPrompt = tutorCall.request.messages.at(-1)?.content || '';
    assert.match(tutorPrompt, /Private learner-to-director tutor-change request/u);
    assert.doesNotMatch(tutorPrompt, /worn burin with the sprung heel/u);
    assert.equal(trace.find((event) => event.type === 'director_guidance_applied').guidance.text, futureClue);
    assert.equal(
      trace.some((event) => event.type === 'model_call_error'),
      false,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('auto mode plays both roles from the current transcript and returns after a bounded handoff', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-live-auto-mode-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        ...FIRST_TURN_CLUE_ARGS,
        '--no-classifier',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-trace',
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/auto 1\n',
      stopWhen: (plain) => plain.includes('automation paused > auto turn cap'),
    });

    assert.match(result.plain, /AUTO mode · 1 turn · profile diligent/u);
    assert.match(result.plain, /A Diligent Learner \(auto\) > I would compare the metal residues first\./u);
    assert.match(result.plain, /Verrell alone draws the mint-yard crucible/u);
    assert.match(result.plain, /automation paused > auto turn cap/u);
    assert.match(result.plain, /session status > LEARNER · turn 2/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('mid-turn /auto queues a handoff and /mode auto replaces it before automation starts', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-deferred-auto-mode-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--no-classifier',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: 'I want to inspect the residue before deciding.\n',
      followupInputs: [
        { delayMs: 100, text: '/auto 3\n' },
        { delayMs: 200, text: '/mode auto 1\n' },
      ],
      stopWhen: (plain) => plain.includes('automation paused > auto turn cap'),
      timeoutMs: 12_000,
      env: {
        FAKE_CODEX_DELAY_MS: '700',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /auto queued > starts after tutor turn 1 · 3 turns/u);
    assert.match(result.plain, /auto queued > starts after tutor turn 1 · 1 turn/u);
    assert.match(result.plain, /replaced the earlier queued auto request/u);
    assert.match(result.plain, /A Diligent Learner \(auto\) > I would compare the metal residues first\./u);
    assert.match(result.plain, /automation paused > auto turn cap/u);

    const queuedIndex = result.plain.indexOf('auto queued > starts after tutor turn 1 · 1 turn');
    const firstTutorIndex = result.plain.indexOf('tutor >', queuedIndex);
    const autoLearnerIndex = result.plain.indexOf('A Diligent Learner (auto) >', queuedIndex);
    assert.ok(queuedIndex >= 0 && firstTutorIndex > queuedIndex, result.plain);
    assert.ok(autoLearnerIndex > firstTutorIndex, result.plain);

    const events = readTutorStubTraceEvents(tmp);
    const queued = events.filter((event) => event.type === 'interactive_auto_queued');
    assert.equal(queued.length, 2);
    assert.equal(queued[0].requestedTurns, 3);
    assert.equal(queued[0].replacedRequestId, null);
    assert.equal(queued[1].requestedTurns, 1);
    assert.equal(queued[1].source, '/mode');
    assert.equal(queued[1].replacedRequestId, queued[0].requestId);
    const started = events.find((event) => event.type === 'interactive_auto_queue_started');
    assert.equal(started?.requestId, queued[1].requestId);
    assert.equal(started?.afterTurn, 1);
    const handoff = events.find((event) => event.type === 'interactive_auto_handoff');
    assert.equal(handoff?.queuedRequestId, queued[1].requestId);
    assert.equal(handoff?.maxTurns, 1);
    assert.ok(started.seq < handoff.seq);
    assert.equal(events.filter((event) => event.type === 'turn_complete').length, 2);
    assert.equal(
      events.some((event) => event.type === 'interactive_auto_queue_discarded'),
      false,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('other mid-turn slash commands execute or reject explicitly without entering learner speech', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-mid-turn-command-contracts-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--no-classifier',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: 'Keep this as the only public learner message.\n',
      followupInputs: [
        { delayMs: 100, text: '/status\n' },
        { delayMs: 200, text: '/demo 1\n' },
        { delayMs: 300, text: '/scenario\n' },
        { delayMs: 400, text: '/board\n' },
        { delayMs: 500, text: '/settings dropout 0.2\n' },
        { delayMs: 600, text: '/auto zero\n' },
      ],
      stopWhen: (plain) => plain.includes('tutor >') && plain.includes('auto mode error:'),
      timeoutMs: 12_000,
      env: {
        FAKE_CODEX_DELAY_MS: '1000',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /session status > LEARNER · turn 1/u);
    assert.match(result.plain, /auto handoff: none · \/auto/u);
    assert.match(
      result.plain,
      /demonstration not started; run \/demo again after the current tutor response completes/u,
    );
    assert.match(
      result.plain,
      /scenario change not started; run \/scenario again after the current tutor response completes/u,
    );
    assert.match(
      result.plain,
      /board change not started; run \/board again after the current tutor response completes/u,
    );
    assert.match(result.plain, /dialogue settings cannot be changed while the tutor is responding/u);
    assert.match(result.plain, /auto mode error: auto expects a positive turn count or until-grounded/u);

    const events = readTutorStubTraceEvents(tmp);
    const completed = events.filter((event) => event.type === 'turn_complete');
    assert.equal(completed.length, 1);
    assert.equal(completed[0].turnRecord.learner, 'Keep this as the only public learner message.');
    assert.equal(
      events.some((event) => event.type === 'interactive_auto_queued'),
      false,
    );
    assert.equal(
      events.some((event) => event.type === 'interactive_auto_handoff'),
      false,
    );
    for (const commandId of ['status', 'demo', 'scenario', 'board', 'settings', 'auto']) {
      assert.ok(
        events.some((event) => event.runtimeEvent === 'command_started' && event.details?.commandId === commandId),
        `missing command_started trace for ${commandId}`,
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

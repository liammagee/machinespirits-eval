import {
  assert,
  spawnSync,
  fs,
  os,
  path,
  pty,
  test,
  ROOT,
  plainTerminalText,
  readTutorStubTraceEvents,
  installFakeCodex,
  runInteractive,
} from './helpers/tutorStubInteractiveHarness.js';

test('technical explanatory debug mode prints exact field calculations and the register consequence', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-explanatory-debug-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--no-classifier',
        '--register-policy',
        'random',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/debug on technical\nThe assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('debug explain > turn 1'),
    });

    assert.match(result.plain, /debug > on · technical details/u);
    assert.match(result.plain, /A · learner analysis/u);
    assert.match(result.plain, /B · calculations and field update/u);
    assert.match(result.plain, /mastery calculation: 0\.34×/u);
    assert.match(result.plain, /risk calculation: 0\.45×/u);
    assert.match(result.plain, /alignment calculation: 0\.30×/u);
    assert.match(result.plain, /momentum calculation: 0\.42×/u);
    assert.match(result.plain, /field updated for next turn: mastery=/u);
    assert.match(result.plain, /C · resulting register decision/u);
    assert.match(result.plain, /register change: initial choice →/u);
    assert.match(result.plain, /policy path: stack=random; activated=random/u);
    assert.match(result.plain, /explanations: on \(technical details\)/u);

    const traces = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.ok(
      traces.some(
        (event) => event.type === 'explanatory_debug_mode_changed' && event.enabled && event.format === 'technical',
      ),
    );
    assert.ok(
      traces.some(
        (event) => event.type === 'explanatory_debug_output' && event.turn === 1 && event.format === 'technical',
      ),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/random samples the full non-simulated style and host-character range independently', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-random-performance-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamic',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/random on\nThe assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('optional tutor feedback >'),
      env: {
        FAKE_CODEX_VALID_ANALYSIS: '1',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /random performance > on/u);
    assert.match(result.plain, /style and host character will change randomly without learner-assessment influence/u);
    assert.match(result.plain, /random performance: on — assessment-independent style \+ character/u);
    assert.match(result.plain, /, random performance,/u);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const modeChange = events.find((event) => event.type === 'random_performance_mode_changed');
    const turn = events.find((event) => event.type === 'turn_complete')?.turnRecord;
    const selection = turn?.registerSelection;
    assert.equal(modeChange?.enabled, true);
    assert.equal(modeChange?.assessmentInfluence.engagementStance, false);
    assert.equal(selection?.primary_policy, 'dynamic');
    assert.equal(selection?.activated_policy, 'random_performance');
    assert.equal(selection?.source, 'random_performance_mode');
    assert.equal(selection?.random_performance.assessment_influence.engagement_stance, false);
    assert.equal(selection?.random_performance.assessment_influence.actorial_part, false);
    assert.equal(selection?.random_performance.assessment_influence.action_family, true);
    assert.equal(selection?.temperature_applied, false);
    assert.match(selection?.temperature_scope || '', /bypassed_for_random/u);
    assert.ok(
      ['plain', 'precise', 'brisk', 'warm', 'witnessing', 'charismatic', 'ironic', 'sarcastic'].includes(
        selection?.selected_register,
      ),
    );
    assert.ok(
      [
        'scene_partner',
        'examiner',
        'record_keeper',
        'advocate',
        'skeptic',
        'satirist',
        'adversarial_teacher',
        'exacting_schoolmaster',
      ].includes(selection?.actorial_part),
    );
    assert.equal(selection?.actorial_part_selection.selection_method, 'random_performance_seeded_uniform');
    assert.equal(selection?.random?.decision?.material?.policy, 'random_performance');
    assert.equal(selection?.actorial_part_selection.random?.decision?.material?.policy, 'random_performance');
    assert.deepEqual(selection?.random_performance.hard_constraints_preserved, [
      'dialogue_closure',
      'evidence_release',
      'response_safety',
    ]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('light adaptation forces a replayable style and character shift after continued learner difficulty', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-light-adaptation-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamic',
        '--light-adaptation',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/debug on technical\n/light off\n/light on\nThe assay still confuses me.\n',
      followupInputs: [
        {
          afterPlainIncludes: 'optional tutor feedback >',
          text: '/up\nI am frustrated and still uncertain about the residue comparison.\n',
        },
      ],
      // Stop once the second register selection is observable; response composition is covered separately.
      stopWhen: (plain) => plain.includes('light adaptation: continued confusion/frustration streak 2'),
      timeoutMs: 15_000,
      env: {
        FAKE_CODEX_VALID_ANALYSIS: '1',
        FAKE_CODEX_LIGHT_RESPONSE: '1',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /light adaptation > on/u);
    assert.match(result.plain, /light adaptation: on — seeded style \+ character shift after 2/u);
    assert.match(result.plain, /source light_stochastic_adaptation/u);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const turns = events
      .filter((event) => event.type === 'turn_complete')
      .map((event) => event.turnRecord)
      .sort((left, right) => left.turn - right.turn);
    const modeChanges = events.filter((event) => event.type === 'light_adaptation_mode_changed');
    assert.deepEqual(
      modeChanges.map((event) => event.enabled),
      [false, true],
    );
    assert.ok(modeChanges.every((event) => event.threshold === 2));
    assert.equal(turns.length, 1);
    const first = turns[0].registerSelection;
    assert.equal(first.light_adaptation.streak, 1);
    assert.equal(first.light_adaptation.triggered, false);
    const stanceMatches = [...result.plain.matchAll(/engagement stance > ([a-z_]+)/gu)];
    const partMatches = [...result.plain.matchAll(/audience: [^\n]+; part: ([^\n]+)/gu)];
    assert.ok(stanceMatches.length >= 2, result.plain);
    assert.ok(partMatches.length >= 2, result.plain);
    assert.notEqual(stanceMatches.at(-1)[1], first.engagement_stance);
    assert.notEqual(partMatches.at(-1)[1].trim(), first.actorial_part_label);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test('/register and /character explicitly direct their own performance axes and outrank /random', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-explicit-performance-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamic',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/random on\n/register warm\n/character advocate\nThe assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('optional tutor feedback >'),
      env: {
        FAKE_CODEX_VALID_ANALYSIS: '1',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /teaching style direction > warm/u);
    assert.match(result.plain, /tutor character > Advocate for the live case/u);
    assert.match(result.plain, /directed performance: style warm · character advocate/u);
    assert.match(result.plain, /style warm/u);
    assert.match(result.plain, /character advocate for the live case/u);
    assert.match(result.plain, /style directed, character directed/u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const changes = events.filter((event) => event.type === 'explicit_performance_directive_changed');
    const selection = events.find((event) => event.type === 'turn_complete')?.turnRecord?.registerSelection;
    assert.deepEqual(
      changes.map((event) => [event.axis, event.value]),
      [
        ['engagement_stance', 'warm'],
        ['actorial_part', 'advocate'],
      ],
    );
    assert.equal(selection?.primary_policy, 'dynamic');
    assert.equal(selection?.activated_policy, 'explicit_register_directive');
    assert.equal(selection?.source, 'explicit_register_directive');
    assert.equal(selection?.selected_register, 'warm');
    assert.equal(selection?.actorial_part, 'advocate');
    assert.equal(selection?.actorial_part_selection.selection_method, 'explicit_character_directive');
    assert.equal(selection?.performance_directives.register.assessment_influence, false);
    assert.equal(selection?.performance_directives.character.assessment_influence, false);
    assert.equal(selection?.performance_directives.character.applied, true);
    assert.equal(selection?.random_performance.configured, true);
    assert.equal(selection?.random_performance.enabled, false);
    assert.deepEqual(selection?.random_performance.active_axes, []);
    assert.deepEqual(selection?.random_performance.explicitly_directed_axes, ['engagement_stance', 'actorial_part']);
    assert.deepEqual(selection?.performance_directives.hard_constraints_preserved, [
      'dialogue_closure',
      'authored_evidence_source',
      'evidence_release',
      'response_safety',
    ]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/character configures learner and tutor characters while preserving legacy forms', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--mixed-learner',
      '--dag',
      '--tutor-learner-dag',
      '--no-opening',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--no-trace',
      '--world',
      'world_005_marrick',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, TUTOR_STUB_REMEMBER_SETTINGS: '0' },
      input:
        '/character\n/tutor\n/tutor adversarial_teacher\n/learner\n/learner counterexample_hunter\n/character\n/character opposing_counsel\n/quit\n',
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /character controls >/u);
  assert.match(result.stdout, /learner character > diligent/u);
  assert.match(result.stdout, /tutor character > auto/u);
  assert.match(result.stdout, /adversarial_teacher\s+adversarial teacher/u);
  assert.match(result.stdout, /exacting_schoolmaster\s+exacting schoolmaster/u);
  assert.match(result.stdout, /satirist\s+wry satirist/u);
  assert.match(result.stdout, /tutor character > Adversarial teacher/u);
  assert.match(
    result.stdout,
    /Tutor replies will actively test your ideas with subject-based counterexamples or alternatives\./u,
  );
  assert.match(result.stdout, /Clue-givers and the closing scene may temporarily use another character\./u);
  assert.match(result.stdout, /Choose Tutor → Auto, or type \/tutor auto/u);
  assert.match(result.stdout, /switched to counterexample_hunter: Counterexample hunter/u);
  assert.match(result.stdout, /learner character > counterexample_hunter/u);
  assert.match(result.stdout, /tutor character > adversarial_teacher/u);
  assert.match(result.stdout, /tutor character > Exacting schoolmaster/u);
});

test('the satirist character defaults to irony while an explicit register remains independent', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-satirist-default-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'field',
        '--register-palette',
        'non-simulated',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/tutor satirist\nThe residue comparison still confuses me.\n',
      stopWhen: (plain) => plain.includes('optional tutor feedback >'),
      env: {
        FAKE_CODEX_VALID_ANALYSIS: '1',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /tutor character > Wry satirist/u);
    assert.match(result.plain, /defaults to ironic/u);
    const events = readTutorStubTraceEvents(tmp);
    const selection = events.find((event) => event.type === 'turn_complete')?.turnRecord?.registerSelection;
    assert.equal(selection?.selected_register, 'ironic');
    assert.equal(selection?.source, 'explicit_character_default_engagement_stance');
    assert.equal(selection?.actorial_part, 'satirist');
    assert.equal(selection?.actorial_part_selection.selection_method, 'explicit_character_directive');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('changing the tutor character publicly restates the latest intent and replaces the cached reprise', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-character-restatement-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamic',
        '--no-turn-feedback',
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
          afterPlainIncludes: 'tutor >',
          text: '/character tutor adversarial_teacher\n',
        },
      ],
      stopWhen: (plain) => plain.includes('tutor ↻ > Let me rephrase that.'),
      env: {
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /tutor character > Adversarial teacher/u);
    assert.match(
      result.plain,
      /tutor ↻ > Let me rephrase that\. Challenge the town’s first answer within the assay itself:/u,
    );
    assert.ok(
      (result.plain.match(/Challenge the town’s first answer within the assay itself/gu) || []).length >= 2,
      result.plain,
    );

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const completed = events.find((event) => event.type === 'tutor_character_restatement_completed');
    assert.equal(completed?.characterId, 'adversarial_teacher');
    assert.equal(completed?.target?.targetKind, 'opening');
    assert.equal(completed?.transcriptOperation, 'replace_latest_tutor_utterance');
    assert.equal(completed?.publicTranscriptChanged, true);
    assert.equal(completed?.deterministicFallback, false);
    assert.equal(completed?.audit?.ok, true);
    assert.equal(
      events.some((event) => event.type === 'tutor_utterance_reprise' && event.command === '/character'),
      false,
    );
    const modelInput = fs.readFileSync(result.logPath, 'utf8');
    assert.match(modelInput, /# Character restatement task/u);
    assert.match(modelInput, /Current character id: adversarial_teacher/u);
    assert.match(modelInput, /Previous tutor utterance/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test(
  'bare /character chooses learner or tutor before opening the axis-specific keyboard selector',
  { skip: process.platform === 'win32', timeout: 12_000 },
  async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-character-selectors-'));
    installFakeCodex(tmp);
    let terminalOutput = '';
    let openedCharacterForTutor = false;
    let selectedTutorTarget = false;
    let selectedTutor = false;
    let openedCharacterForLearner = false;
    let selectedLearnerTarget = false;
    let selectedLearner = false;
    let requestedExit = false;
    const terminal = pty.spawn(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--mixed-learner',
        '--dag',
        '--tutor-learner-dag',
        '--no-opening',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-trace',
        '--world',
        'world_005_marrick',
      ],
      {
        cwd: ROOT,
        cols: 110,
        rows: 28,
        name: 'xterm-color',
        env: {
          ...process.env,
          PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
          TERM: 'xterm-color',
          TUTOR_STUB_REMEMBER_SETTINGS: '0',
        },
      },
    );
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          terminal.kill();
          reject(new Error(`TTY character selectors timed out\n${plainTerminalText(terminalOutput)}`));
        }, 10_000);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          const targetMenuCount = (plain.match(/Character · choose learner or tutor/gu) || []).length;
          if (!openedCharacterForTutor && plain.includes('A Diligent Learner >')) {
            openedCharacterForTutor = true;
            terminal.write('/character\r');
          } else if (
            !selectedTutorTarget &&
            targetMenuCount >= 1 &&
            plain.includes('about > Choose the visible learner behavior profile')
          ) {
            selectedTutorTarget = true;
            terminal.write('\x1b[B\r');
          } else if (!selectedTutor && plain.includes('does > Return character choice to light adaptation')) {
            selectedTutor = true;
            terminal.write('\x1b[B\r');
          } else if (!openedCharacterForLearner && plain.includes('tutor character > Fellow investigator')) {
            openedCharacterForLearner = true;
            terminal.write('/character\r');
          } else if (
            !selectedLearnerTarget &&
            targetMenuCount >= 2 &&
            (plain.match(/about > Choose the visible learner behavior profile/gu) || []).length >= 2
          ) {
            selectedLearnerTarget = true;
            terminal.write('\r');
          } else if (!selectedLearner && plain.includes('pattern >')) {
            selectedLearner = true;
            terminal.write('\x1b[F\r');
          } else if (!requestedExit && /learner profile > switched to [a-z_]+:/u.test(plain)) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`TTY character selectors exited ${exitCode} (${signal})\n${terminalOutput}`));
        });
      });

      const plain = plainTerminalText(terminalOutput);
      assert.ok((plain.match(/Character · choose learner or tutor/gu) || []).length >= 2, plain);
      assert.match(plain, /Learner\s+diligent/u);
      assert.match(plain, /Tutor\s+auto/u);
      assert.match(plain, /Tutor character · choose with ↑\/↓ and Enter/u);
      assert.match(plain, /scene_partner.*full-range/u);
      assert.match(plain, /tutor character > Fellow investigator/u);
      assert.match(plain, /Learner character · choose with ↑\/↓ and Enter/u);
      assert.match(plain, /pattern >/u);
      assert.match(plain, /learner profile > switched to [a-z_]+:/u);
    } finally {
      terminal.kill();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test(
  'bare /register exposes full-range sarcasm even when automatic routing is safe-only',
  { skip: process.platform === 'win32' },
  async () => {
    const terminal = pty.spawn(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--mixed-learner',
        '--dag',
        '--tutor-learner-dag',
        '--no-opening',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-trace',
        '--safe-registers',
        '--world',
        'world_005_marrick',
      ],
      {
        cwd: ROOT,
        cols: 110,
        rows: 28,
        name: 'xterm-color',
        env: { ...process.env, TERM: 'xterm-color', TUTOR_STUB_REMEMBER_SETTINGS: '0' },
      },
    );
    let terminalOutput = '';
    let opened = false;
    let selected = false;
    let requestedExit = false;
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          terminal.kill();
          reject(new Error(`TTY register selector timed out\n${plainTerminalText(terminalOutput)}`));
        }, 10_000);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          if (!opened && plain.includes('A Diligent Learner >')) {
            opened = true;
            terminal.write('/register\r');
          } else if (!selected && plain.includes('sounds > The conversation chooses how the tutor sounds')) {
            selected = true;
            terminal.write('\x1b[F\r');
          } else if (!requestedExit && plain.includes('teaching style direction > sarcastic')) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`TTY register selector exited ${exitCode} (${signal})\n${terminalOutput}`));
        });
      });

      const plain = plainTerminalText(terminalOutput);
      assert.match(plain, /Tutor register · choose how the voice sounds with ↑\/↓ and Enter/u);
      assert.match(plain, /sarcastic.*full-range/u);
      assert.match(plain, /sounds >/u);
      assert.match(plain, /register changes voice; tutor character changes the repeated public action/u);
      assert.match(plain, /teaching style direction > sarcastic/u);
      assert.match(plain, /full-range negative register/u);
    } finally {
      terminal.kill();
    }
  },
);

test('interactive register control rejects the simulated-only face-threat condition', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--mixed-learner',
      '--dag',
      '--tutor-learner-dag',
      '--no-opening',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--no-trace',
      '--world',
      'world_005_marrick',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, TUTOR_STUB_REMEMBER_SETTINGS: '0' },
      input: '/register face_threat\n/quit\n',
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /face_threat is a simulated-only evaluation condition/iu);
  assert.doesNotMatch(result.stdout, /teaching style direction > face_threat/iu);
});

test('--learner-character and --tutor-character set symmetric launch-time character controls', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--mixed-learner',
      '--dag',
      '--tutor-learner-dag',
      '--learner-character',
      'goalpost_shifter',
      '--tutor-character',
      'opposing_counsel',
      '--no-opening',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--no-trace',
      '--world',
      'world_005_marrick',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, TUTOR_STUB_REMEMBER_SETTINGS: '0' },
      input: '/character\n/quit\n',
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /learner character > goalpost_shifter/u);
  assert.match(result.stdout, /tutor character > exacting_schoolmaster/u);
});

test('/register leaves the undirected character axis available to /random', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-explicit-register-random-character-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamic',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/random on\n/register warm\nThe assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('optional tutor feedback >'),
      env: {
        FAKE_CODEX_VALID_ANALYSIS: '1',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /random performance: on — assessment-independent character/u);
    assert.match(result.plain, /directed performance: style warm · character auto/u);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const selection = events.find((event) => event.type === 'turn_complete')?.turnRecord?.registerSelection;
    assert.equal(selection?.selected_register, 'warm');
    assert.equal(selection?.actorial_part_selection.selection_method, 'random_performance_seeded_uniform');
    assert.equal(selection?.random_performance.enabled, true);
    assert.deepEqual(selection?.random_performance.active_axes, ['actorial_part']);
    assert.deepEqual(selection?.random_performance.explicitly_directed_axes, ['engagement_stance']);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/register auto and /character auto clear only their session locks', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-explicit-performance-clear-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamic',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/register warm\n/character advocate\n/register auto\n/character auto\n/status\n',
      stopWhen: (plain) => plain.includes('directed performance: style auto · character auto'),
      env: {
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /teaching style direction > auto/u);
    assert.match(result.plain, /tutor character > Automatic/u);
    assert.match(result.plain, /directed performance: style auto · character auto/u);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const changes = events.filter((event) => event.type === 'explicit_performance_directive_changed');
    assert.deepEqual(
      changes.map((event) => [event.axis, event.value]),
      [
        ['engagement_stance', 'warm'],
        ['actorial_part', 'advocate'],
        ['engagement_stance', null],
        ['actorial_part', null],
      ],
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('debug off keeps compact response details before tutor speech', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-debug-off-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--no-classifier',
        '--register-policy',
        'random',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/debug on technical\n/debug off\nThe assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('optional tutor feedback >'),
    });

    assert.match(result.plain, /debug > off/u);
    assert.match(result.plain, /automatic explanations stopped/u);
    assert.doesNotMatch(result.plain, /turn id >/u);
    assert.doesNotMatch(result.plain, /learner classifier >/u);
    assert.doesNotMatch(result.plain, /tutor learner-DAG model >/u);
    assert.doesNotMatch(result.plain, /engagement stance >/u);
    assert.doesNotMatch(result.plain, /tutor DAG >/u);
    assert.doesNotMatch(result.plain, /debug explain > turn 1/u);
    assert.match(result.plain, /tokens unavailable, effort medium, style [a-z ]+, move [a-z ]+, character [^,\n]+/u);
    const responseDetailsIndex = result.plain.search(/codex\/gpt-5\.6-terra, \d+ms, tokens unavailable/u);
    const timingIndex = result.plain.search(
      /time > wait (?:<0\.1s|\d+\.\d+s) · analysis (?:<0\.1s|\d+\.\d+s) · tutor (?:<0\.1s|\d+\.\d+s)/u,
    );
    const tutorSpeechIndex = result.plain.lastIndexOf('tutor >');
    assert.ok(
      responseDetailsIndex >= 0 && timingIndex > responseDetailsIndex && timingIndex < tutorSpeechIndex,
      result.plain,
    );
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const timingEvent = events.find((event) => event.type === 'turn_timing_breakdown' && event.turn === 1);
    assert.equal(timingEvent.timing.schema, 'machinespirits.tutor-stub.turn-timing.v1');
    assert.ok(timingEvent.timing.foreground.totalMs >= timingEvent.timing.foreground.tutorMs);
    assert.equal(
      events.find((event) => event.type === 'turn_complete' && event.turn === 1)?.turnRecord?.turnTiming?.schema,
      'machinespirits.tutor-stub.turn-timing.v1',
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/details off hides compact response details without changing tutor speech', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-response-details-off-'));
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
        'none',
      ],
      initialInput: '/details off\nFirst learner message.\n',
      stopWhen: (plain) => plain.includes('optional tutor feedback >'),
    });

    assert.match(result.plain, /response details > off/u);
    assert.match(result.plain, /tutor >/u);
    assert.doesNotMatch(result.plain, /codex\/gpt-5\.6-terra, \d+ms, tokens unavailable/u);
    assert.doesNotMatch(result.plain, /time > wait/u);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.ok(
      events.some(
        (event) =>
          event.type === 'terminal_response_details_changed' &&
          event.enabled === false &&
          event.publicTranscriptChanged === false,
      ),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('explanatory debug defaults to concise LLM-written prose', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-explanatory-debug-prose-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--no-classifier',
        '--register-policy',
        'random',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: '/debug on\nThe assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('debug > turn 1 · prose'),
    });

    assert.match(result.plain, /debug > on · plain explanation/u);
    assert.match(result.plain, /debug > turn 1 · prose/u);
    assert.match(result.plain, /The learner is asking for orientation/u);
    assert.match(result.plain, /You held a warm, re-anchoring stance/u);
    assert.doesNotMatch(result.plain, /A · learner analysis/u);
    assert.doesNotMatch(result.plain, /mastery calculation/u);
    assert.match(result.plain, /technical evidence: \/debug technical/u);
    assert.match(result.plain, /explanations: on \(plain\)/u);
    assert.match(fs.readFileSync(result.logPath, 'utf8'), /# Explanatory debug task/u);

    const traces = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.ok(traces.some((event) => event.type === 'model_call' && event.role === 'tutor_stub_explanatory_debug'));
    assert.ok(
      traces.some(
        (event) =>
          event.type === 'explanatory_debug_output' &&
          event.turn === 1 &&
          event.format === 'prose' &&
          event.generated === true,
      ),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

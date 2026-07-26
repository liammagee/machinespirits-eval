import {
  assert,
  fs,
  os,
  path,
  pty,
  test,
  ROOT,
  FIRST_TURN_CLUE_ARGS,
  plainTerminalText,
  installFakeCodex,
  runInteractive,
  runInteractiveModelSwitchSequence,
} from './helpers/tutorStubInteractiveHarness.js';

test('ordinary tutor turns replay the full public user/assistant history without a model change', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-default-context-replay-'));
  try {
    const result = await runInteractiveModelSwitchSequence({ tmp, changeModel: false });
    const calls = fs.readFileSync(result.logPath, 'utf8').split('\n---CALL---\n').filter(Boolean);

    assert.ok(calls.length >= 2);
    assert.doesNotMatch(calls[0], /Conversation so far:/u);
    assert.match(calls[1], /Conversation so far:\nuser: First learner message\./u);
    assert.match(
      calls[1],
      /assistant: I see the point you are putting on the table\.[\s\S]*Take the crucible as a fingerprint/u,
    );
    assert.match(calls[1], /Latest message:\nSecond learner message\./u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ordinary invalid tutor drafts recover through a progression-safe deterministic fallback', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-ordinary-progression-fallback-'));
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
        '--no-turn-feedback',
        '--trace-dir',
        tmp,
        '--world',
        'none',
      ],
      initialInput: 'First learner message.\n',
      stopWhen: (plain) => plain.includes('What does that let us carry forward about “First learner message”?'),
      timeoutMs: 15_000,
    });

    assert.match(result.plain, /I keep your point about “First learner message” in view/iu);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const accounting = events.find((event) => event.type === 'tutor_response_guard_accounting')?.accounting;
    assert.ok(accounting);
    assert.equal(accounting.outcome, 'guarded_deterministic_fallback');
    // Both drafts fail live progression and nothing else, so the self-correction
    // pass is offered before the safety text. Here it fails too, and the ladder
    // falls through to exactly the fallback it always produced.
    assert.deepEqual(
      accounting.attempts.map((attempt) => attempt.kind),
      ['original_candidate', 'plain_recovery_candidate', 'self_correction_candidate', 'deterministic_fallback'],
    );
    assert.equal(accounting.attempts[0].audits.liveTurnProgressionAudit.ok, false);
    assert.equal(accounting.attempts[1].audits.liveTurnProgressionAudit.ok, false);
    assert.equal(accounting.finalDelivery.source, 'deterministic_fallback');
    assert.equal(accounting.finalDelivery.auditOk, true);
    const fallbackAttempt = accounting.attempts.at(-1);
    assert.equal(fallbackAttempt.kind, 'deterministic_fallback');
    assert.equal(fallbackAttempt.audits.liveTurnProgressionAudit.ok, true);
    assert.equal(fallbackAttempt.audits.liveTurnProgressionAudit.observed.question_count, 1);
    assert.deepEqual(fallbackAttempt.audits.liveTurnProgressionAudit.issues, []);
    const failureEvents = events.filter((event) => event.type === 'turn_failure_recorded');
    assert.ok(failureEvents.some((event) => event.phase === 'incremental' && event.turn === 1));
    const sealedFailure = failureEvents.find((event) => event.phase === 'sealed' && event.turn === 1);
    assert.ok(sealedFailure);
    assert.equal(sealedFailure.record.run.sealed, true);
    assert.equal(sealedFailure.record.training.trainingLicensed, false);
    assert.ok(sealedFailure.failureModes.some((mode) => mode.startsWith('guard.live_turn_progression_v1.')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('a tutor that says it nearly went the wrong way publishes its own turn instead of the safety text', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-self-correction-disclosed-'));
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
        '--no-turn-feedback',
        '--trace-dir',
        tmp,
        '--world',
        'none',
      ],
      initialInput: 'First learner message.\n',
      stopWhen: (plain) => plain.includes('What does that let us carry forward about “First learner message”?'),
      timeoutMs: 15_000,
      env: { FAKE_CODEX_FIXTURE_MODE: 'self_correction' },
    });

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const accounting = events.find((event) => event.type === 'tutor_response_guard_accounting')?.accounting;
    assert.ok(accounting);
    // Same two failing drafts as the fallback case above. The difference is only
    // that the model takes the offered pass, so the learner hears the tutor
    // change course rather than a replacement written by the harness.
    assert.deepEqual(
      accounting.attempts.map((attempt) => attempt.kind),
      ['original_candidate', 'plain_recovery_candidate', 'self_correction_candidate'],
    );
    assert.equal(accounting.outcome, 'guarded_self_correction_disclosed');
    assert.equal(accounting.finalDelivery.source, 'self_correction_candidate');
    assert.equal(accounting.finalDelivery.auditOk, true);
    assert.match(result.plain, /I was about to answer a different question/u);

    const pass = events.find((event) => event.type === 'tutor_response_self_correction_pass');
    assert.ok(pass);
    assert.equal(pass.disclosed, true);
    assert.equal(pass.accepted, true);
    assert.deepEqual(pass.disclosureIssues, []);
    assert.deepEqual(
      pass.waivedFindings.map((finding) => finding.type),
      ['learner_uptake_not_realized', 'handoff_loses_turn_focus'],
    );
    // The preface is not scored as the uptake: the sentence that answers the
    // learner is, so the pass is not a way around the guard that opened it.
    const delivered = accounting.attempts.at(-1);
    assert.equal(delivered.audits.responseCompositionAudit.segments.method, 'self_correction_preface');
    assert.equal(delivered.audits.liveTurnProgressionAudit.ok, true);
    assert.deepEqual(delivered.audits.liveTurnProgressionAudit.issues, []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('consecutive ordinary deterministic recoveries vary without weakening progression or repetition guards', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-consecutive-progression-fallback-'));
  try {
    const result = await runInteractiveModelSwitchSequence({
      tmp,
      changeModel: false,
      passthrough: false,
      timeoutMs: 15_000,
    });
    assert.equal((result.plain.match(/safe fallback used/gu) || []).length, 2);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const accountings = events
      .filter((event) => event.type === 'tutor_response_guard_accounting')
      .map((event) => event.accounting);
    assert.equal(accountings.length, 2);
    assert.notEqual(accountings[0].finalDelivery.candidate.text, accountings[1].finalDelivery.candidate.text);
    for (const accounting of accountings) {
      assert.equal(accounting.outcome, 'guarded_deterministic_fallback');
      assert.equal(accounting.finalDelivery.auditOk, true);
      assert.equal(accounting.finalDelivery.audits.liveTurnProgressionAudit.ok, true);
      assert.equal(accounting.finalDelivery.audits.repetitionAudit.ok, true);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('learner messages sent before the tutor replies form one restart-safe compound turn', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-compound-learner-turn-'));
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
      initialInput: 'The first clue is unclear.\n',
      followupInputs: [{ delayMs: 200, text: 'I mean the residue comparison specifically.\n' }],
      stopWhen: (plain) => plain.includes('safe fallback used'),
      timeoutMs: 30_000,
      env: {
        FAKE_CODEX_DELAY_MS: '800',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /learner turn updated > added message 2; restarting the tutor with all 2 messages/u);
    assert.doesNotMatch(result.plain, /queued learner turn/u);
    assert.equal((result.plain.match(/tutor >/gu) || []).length, 1);

    const completedCalls = fs.readFileSync(result.logPath, 'utf8').split('\n---CALL---\n').filter(Boolean);
    // A cancelled external CLI process may finish logging during the restart;
    // the last completed call must be the compound turn that is shown.
    assert.ok(completedCalls.length >= 1);
    const completedCompoundCall = completedCalls.at(-1);
    assert.match(
      completedCompoundCall,
      /Learner says in 2 consecutive messages before your reply \(treat them as one compound turn\):[\s\S]*The first clue is unclear\.[\s\S]*I mean the residue comparison specifically\./u,
    );

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const fragments = events.filter((event) => event.type === 'learner_turn_fragment_received');
    assert.equal(fragments.length, 2);
    assert.equal(fragments[0].compoundTurnId, fragments[1].compoundTurnId);
    assert.deepEqual(
      fragments.map((event) => event.text),
      ['The first clue is unclear.', 'I mean the residue comparison specifically.'],
    );
    assert.ok(events.some((event) => event.type === 'learner_turn_attempt_superseded' && event.revision === 2));
    assert.ok(
      events.some((event) => event.type === 'learner_turn_attempt_discarded' && event.replacedByRevision === 2),
    );

    const completedTurns = events.filter((event) => event.type === 'turn_complete');
    assert.equal(completedTurns.length, 1);
    assert.equal(
      completedTurns[0].turnRecord.learner,
      'The first clue is unclear.\nI mean the residue comparison specifically.',
    );
    assert.equal(completedTurns[0].turnRecord.learnerInput.messageCount, 2);
    assert.deepEqual(
      completedTurns[0].turnRecord.learnerMessages.map((message) => message.text),
      ['The first clue is unclear.', 'I mean the residue comparison specifically.'],
    );
    assert.equal(completedTurns[0].turnRecord.learnerResponseProvenance.authorship, 'human');
    assert.deepEqual(
      completedTurns[0].turnRecord.learnerMessages.map((message) => message.provenance.authorship),
      ['human', 'human'],
    );
    assert.ok(
      events.some(
        (event) => event.type === 'learner_response_provenance_recorded' && event.provenance.authorship === 'human',
      ),
    );
    assert.ok(
      events.some(
        (event) => event.type === 'learner_turn_compound_committed' && event.revision === 2 && event.messageCount === 2,
      ),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/use records an unchanged mixed learner suggestion as AI-authored with human acceptance', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-mixed-learner-provenance-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--mixed-learner',
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
      initialInput: '\n\n',
      followupInputs: [{ afterPlainIncludes: 'learner suggestion ready >', text: '/use\n' }],
      stopWhen: (plain) => (plain.match(/optional tutor feedback >/gu) || []).length >= 2,
      timeoutMs: 15_000,
      env: {
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const turn = events.find((event) => event.type === 'turn_complete')?.turnRecord;
    assert.ok(turn, result.plain);
    assert.equal(turn.learnerResponseProvenance.authorship, 'ai');
    assert.equal(turn.learnerResponseProvenance.origin, 'mixed_suggestion_accepted');
    assert.equal(turn.learnerResponseProvenance.inputMethod, 'slash_use');
    assert.equal(turn.learnerResponseProvenance.humanInLoop, true);
    assert.equal(turn.learnerMessages[0].provenance.aiGenerated, true);
    assert.ok(
      events.some(
        (event) =>
          event.type === 'mixed_learner_suggestion_accepted' && event.learnerResponseProvenance.authorship === 'ai',
      ),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test(
  'editing a Tab-inserted mixed learner suggestion records hybrid authorship',
  { skip: process.platform === 'win32', timeout: 15_000 },
  async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-edited-mixed-provenance-'));
    try {
      installFakeCodex(tmp);
      let terminalOutput = '';
      let submitted = false;
      let submissionScheduled = false;
      let requestedExit = false;
      const terminal = pty.spawn(
        process.execPath,
        [
          'scripts/tutor-stub.js',
          '--mixed-learner',
          '--auto-learner-profile',
          'diligent',
          '--release-speed',
          '1',
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
        {
          cwd: ROOT,
          cols: 140,
          rows: 30,
          name: 'xterm-color',
          env: {
            ...process.env,
            PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
            CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
            TUTOR_STUB_OPENING_REALIZER: 'deterministic',
            TUTOR_STUB_SUMMARY_OPEN: '0',
            TUTOR_STUB_REMEMBER_SETTINGS: '0',
          },
        },
      );

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          terminal.kill();
          reject(new Error(`edited mixed provenance terminal timed out\n${plainTerminalText(terminalOutput)}`));
        }, 12_000);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          const feedbackCount = (plain.match(/optional tutor feedback >/gu) || []).length;
          if (
            !submissionScheduled &&
            plain.includes('learner suggestion ready >') &&
            plain.includes('A Diligent Learner >') &&
            feedbackCount >= 1
          ) {
            submissionScheduled = true;
            setTimeout(() => {
              if (requestedExit) return;
              terminal.write('\t');
              setTimeout(() => {
                if (requestedExit) return;
                submitted = true;
                terminal.write(' carefully\r');
              }, 100);
            }, 100);
          } else if (submitted && !requestedExit && feedbackCount >= 2) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`edited mixed provenance terminal exited ${exitCode} (${signal})\n${terminalOutput}`));
        });
      });

      const events = fs
        .readdirSync(tmp)
        .filter((name) => name.endsWith('.jsonl'))
        .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const turn = events.find((event) => event.type === 'turn_complete')?.turnRecord;
      assert.ok(turn, plainTerminalText(terminalOutput));
      assert.match(turn.learner, /carefully$/u);
      assert.equal(turn.learnerResponseProvenance.authorship, 'hybrid');
      assert.equal(turn.learnerResponseProvenance.origin, 'mixed_suggestion_edited');
      assert.equal(turn.learnerResponseProvenance.inputMethod, 'tab_completion_then_edit');
      assert.equal(turn.learnerResponseProvenance.humanGenerated, true);
      assert.equal(turn.learnerResponseProvenance.aiGenerated, true);
      assert.ok(events.some((event) => event.type === 'mixed_learner_suggestion_inserted'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test('optional thumbs feedback is attached to the next human learner message and guides the tutor privately', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-turn-feedback-'));
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
      initialInput: 'First learner message.\n',
      followupInputs: [
        {
          afterPlainIncludes: 'optional tutor feedback >',
          text: '/down\nSecond learner message.\n',
        },
      ],
      stopWhen: (plain) => (plain.match(/optional tutor feedback >/gu) || []).length >= 2,
      timeoutMs: 12_000,
    });

    assert.match(result.plain, /tutor feedback > 👎 not helpful · private/u);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) =>
        fs
          .readFileSync(path.join(tmp, name), 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
      );
    const secondTurn = events.find((event) => event.type === 'turn_complete' && event.turn === 2)?.turnRecord;
    assert.equal(secondTurn.learnerInput.tutorFeedback.rating, 'down');
    assert.equal(secondTurn.learnerInput.tutorFeedback.supplied, true);
    assert.equal(secondTurn.learnerMessages[0].tutorFeedback.rating, 'down');
    assert.equal(secondTurn.learner, 'Second learner message.');
    assert.equal(secondTurn.feedbackAdaptationPlan.rating, 'down');
    assert.equal(secondTurn.feedbackAdaptationPlan.requiresRealizationChange, true);
    assert.equal(secondTurn.feedbackObservation.feedback.helpfulness, -1);
    assert.equal(secondTurn.feedbackObservation.outcomes.subjectiveHelpfulness, -1);
    assert.ok(events.some((event) => event.type === 'tutor_feedback_observation' && event.turn === 2));
    assert.ok(
      events.some(
        (event) =>
          event.type === 'tutor_feedback_rating_recorded' &&
          event.turn === 1 &&
          event.record?.feedback?.helpfulness === -1,
      ),
    );

    const calls = fs.readFileSync(result.logPath, 'utf8').split('\n---CALL---\n').filter(Boolean);
    assert.match(calls.at(-1), /The learner marked your previous public response unhelpful/u);
    assert.match(calls.at(-1), /Private one-turn response adaptation contract/u);
    assert.match(calls.at(-1), /This contract expires after this tutor response/u);
    assert.match(calls.at(-1), /Do not mention the rating/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test(
  'empty-prompt arrow keys rate the tutor immediately without taking over cursor movement',
  { skip: process.platform === 'win32', timeout: 15_000 },
  async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-arrow-feedback-'));
    try {
      installFakeCodex(tmp);
      let terminalOutput = '';
      let firstTurnSent = false;
      let arrowPressed = false;
      let secondTurnSent = false;
      let requestedExit = false;
      const terminal = pty.spawn(
        process.execPath,
        [
          'scripts/tutor-stub.js',
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
        {
          cwd: ROOT,
          cols: 120,
          rows: 24,
          name: 'xterm-color',
          env: {
            ...process.env,
            PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
            TERM: 'xterm-color',
            CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
            TUTOR_STUB_SUMMARY_OPEN: '0',
            TUTOR_STUB_REMEMBER_SETTINGS: '0',
          },
        },
      );

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          terminal.kill();
          reject(new Error(`arrow-feedback terminal timed out\n${plainTerminalText(terminalOutput)}`));
        }, 12_000);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          const feedbackRequests = plain.match(/optional tutor feedback >/gu) || [];
          if (!firstTurnSent && plain.includes('learner >')) {
            firstTurnSent = true;
            terminal.write('First learner message.\r');
          } else if (!arrowPressed && feedbackRequests.length >= 1) {
            arrowPressed = true;
            terminal.write('\x1b[C');
          } else if (!secondTurnSent && plain.includes('tutor feedback > 👍 helpful · private')) {
            secondTurnSent = true;
            terminal.write('Second learner message.\r');
          } else if (!requestedExit && feedbackRequests.length >= 2) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`arrow-feedback terminal exited ${exitCode} (${signal})\n${terminalOutput}`));
        });
      });

      const plain = plainTerminalText(terminalOutput);
      assert.match(plain, /← 👎 not helpful · 👍 helpful → · empty prompt; no Enter/u);
      assert.match(plain, /tutor feedback > 👍 helpful · private/u);
      const events = fs
        .readdirSync(tmp)
        .filter((name) => name.endsWith('.jsonl'))
        .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const selection = events.find(
        (event) => event.type === 'tutor_turn_feedback_selected' && event.inputSource === 'empty_prompt_right_arrow',
      );
      assert.equal(selection.rating, 'up');
      const secondTurn = events.find((event) => event.type === 'turn_complete' && event.turn === 2)?.turnRecord;
      assert.equal(secondTurn.learner, 'Second learner message.');
      assert.equal(secondTurn.learnerInput.tutorFeedback.rating, 'up');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test(
  'Escape on an empty prompt hides optional tutor feedback for the session',
  { skip: process.platform === 'win32', timeout: 15_000 },
  async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-escape-feedback-'));
    try {
      installFakeCodex(tmp);
      let terminalOutput = '';
      let firstTurnSent = false;
      let escapePressed = false;
      let requestedStatus = false;
      let secondTurnSent = false;
      let requestedExit = false;
      const terminal = pty.spawn(
        process.execPath,
        [
          'scripts/tutor-stub.js',
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
        {
          cwd: ROOT,
          cols: 140,
          rows: 24,
          name: 'xterm-color',
          env: {
            ...process.env,
            PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
            TERM: 'xterm-color',
            CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
            TUTOR_STUB_SUMMARY_OPEN: '0',
            TUTOR_STUB_REMEMBER_SETTINGS: '0',
          },
        },
      );

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          terminal.kill();
          reject(new Error(`escape-feedback terminal timed out\n${plainTerminalText(terminalOutput)}`));
        }, 12_000);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          if (!firstTurnSent && plain.includes('learner >')) {
            firstTurnSent = true;
            terminal.write('First learner message.\r');
          } else if (!escapePressed && plain.includes('optional tutor feedback >')) {
            escapePressed = true;
            setTimeout(() => terminal.write('\x1b'), 100);
          } else if (!requestedStatus && plain.includes('tutor feedback > off')) {
            requestedStatus = true;
            terminal.write('/status\r');
          } else if (!secondTurnSent && /tutor ratings: off · optional and private/u.test(plain)) {
            secondTurnSent = true;
            terminal.write('Second learner message.\r');
          } else if (!requestedExit && secondTurnSent && (plain.match(/tutor >/gu) || []).length >= 2) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`escape-feedback terminal exited ${exitCode} (${signal})\n${terminalOutput}`));
        });
      });

      const plain = plainTerminalText(terminalOutput);
      assert.match(plain, /Esc hides for session/u);
      assert.match(plain, /tutor feedback > off/u);
      assert.match(plain, /tutor ratings: off · optional and private/u);
      assert.equal((plain.match(/optional tutor feedback >/gu) || []).length, 1);
      const events = fs
        .readdirSync(tmp)
        .filter((name) => name.endsWith('.jsonl'))
        .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      assert.ok(
        events.some(
          (event) =>
            event.type === 'tutor_turn_feedback_setting_changed' &&
            event.enabled === false &&
            event.source === 'empty_prompt_escape' &&
            event.publicTranscriptChanged === false,
        ),
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test('/reset cancels an in-flight tutor turn and reopens the same scenario without stale output', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-dialogue-reset-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
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
      initialInput: 'I think this sequence has gone wrong.\n',
      followupInputs: [{ delayMs: 150, text: '/auto 1\n/reset\n' }],
      stopWhen: (plain) => plain.includes('dialogue reset > unfinished work cancelled; starting this scenario again'),
      timeoutMs: 12_000,
      env: {
        FAKE_CODEX_DELAY_MS: '2500',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /dialogue reset > unfinished work cancelled; starting this scenario again/u);
    assert.match(result.plain, /previous turns discarded · learner profile, settings, and director request kept/u);
    assert.doesNotMatch(result.plain, /tutor > Take the crucible as a fingerprint/u);
    assert.doesNotMatch(result.plain, /A Diligent Learner \(auto\) >/u);
    assert.doesNotMatch(result.plain, /error: learner turn attempt was superseded/u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.equal(events.filter((event) => event.type === 'tutor_opening').length, 2);
    assert.equal(events.filter((event) => event.type === 'turn_complete').length, 0);
    assert.ok(
      events.some(
        (event) =>
          event.type === 'interactive_dialogue_reset' &&
          event.command === '/reset' &&
          event.interrupted === true &&
          event.interruptedLearnerTurn?.turn === 1,
      ),
    );
    assert.ok(
      events.some(
        (event) => event.type === 'history_clear' && event.reason === 'dialogue_reset' && event.interrupted === true,
      ),
    );
    assert.ok(
      events.some((event) => event.type === 'learner_turn_attempt_discarded' && event.reason === 'dialogue_reset'),
    );
    const queuedAuto = events.find((event) => event.type === 'interactive_auto_queued');
    assert.equal(queuedAuto?.requestedTurns, 1);
    assert.ok(
      events.some(
        (event) =>
          event.type === 'interactive_auto_queue_discarded' &&
          event.requestId === queuedAuto?.requestId &&
          event.reason === 'dialogue_reset',
      ),
    );
    assert.equal(
      events.some((event) => event.type === 'interactive_auto_queue_started'),
      false,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/reset escapes an in-flight automated sequence and returns control to learner mode', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-auto-reset-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
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
      initialInput: '/auto 2\n',
      followupInputs: [{ delayMs: 150, text: '/reset\n' }],
      stopWhen: (plain) => plain.includes('dialogue reset > unfinished work cancelled; starting this scenario again'),
      timeoutMs: 12_000,
      env: {
        FAKE_CODEX_DELAY_MS: '2500',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /dialogue reset > unfinished work cancelled; starting this scenario again/u);
    assert.doesNotMatch(result.plain, /A Diligent Learner \(auto\) >/u);
    assert.doesNotMatch(result.plain, /auto mode error:/u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const reset = events.find((event) => event.type === 'interactive_dialogue_reset');
    assert.equal(reset?.command, '/reset');
    assert.match(reset?.interruptedAutoRunId || '', /:auto:/u);
    assert.equal(events.filter((event) => event.type === 'turn_complete').length, 0);
    assert.ok(events.some((event) => event.type === 'interactive_auto_discarded' && event.reason === 'dialogue_reset'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/demo runs a bounded live tour, writes inspectable evidence, and returns control', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-guided-demo-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
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
      initialInput: '/demo 1\n',
      stopWhen: (plain) => plain.includes('demonstration complete >'),
      timeoutMs: 15_000,
      env: {
        TUTOR_STUB_TRANSCRIPT_OPEN: '0',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    assert.match(result.plain, /guided harness demonstration · 1 live turn/u);
    assert.match(
      result.plain,
      /limited tour: learner interpretation, reasoning-map tracking, adaptive teaching style, authored evidence DAG are off/u,
    );
    assert.match(result.plain, /A Diligent Learner \(auto\) >/u);
    assert.match(result.plain, /demo readout · learner interpretation/u);
    assert.match(result.plain, /demo readout · inspectable evidence/u);
    assert.match(result.plain, /transcript HTML >/u);
    assert.match(result.plain, /demonstration complete > 1 new turn · control returned/u);
    assert.match(result.plain, /session status > LEARNER/u);

    const transcriptFiles = fs.readdirSync(tmp).filter((name) => name.endsWith('-transcript.html'));
    assert.equal(transcriptFiles.length, 1);
    const transcriptHtml = fs.readFileSync(path.join(tmp, transcriptFiles[0]), 'utf8');
    assert.match(transcriptHtml, /Replay JS/u);
    assert.match(transcriptHtml, /I would compare the metal residues first\./u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const started = events.find((event) => event.type === 'interactive_harness_demo_started');
    const completed = events.find((event) => event.type === 'interactive_harness_demo_completed');
    assert.equal(started?.requestedTurns, 1);
    assert.equal(started?.publicTranscriptChanged, false);
    assert.equal(completed?.completedTurns, 1);
    assert.match(completed?.transcript || '', /-transcript\.html$/u);
    assert.equal(completed?.publicTranscriptChanged, false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('a late learner fragment discards already-computed analysis state before regenerating every assessment', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-compound-analysis-restart-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--dag',
        '--tutor-learner-dag',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
      ],
      initialInput: 'I do not follow the comparison.\n',
      followupInputs: [
        {
          afterLogIncludes: '# Current learner turn',
          text: 'Specifically, explain how the residue distinguishes a hand.\n',
        },
      ],
      stopWhen: (plain) => plain.includes('safe fallback used'),
      timeoutMs: 20_000,
      env: {
        FAKE_CODEX_VALID_ANALYSIS: '1',
        FAKE_CODEX_ANALYSIS_DELAY_MS: '50',
        FAKE_CODEX_DELAY_MS: '2200',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });

    const completedCalls = fs.readFileSync(result.logPath, 'utf8').split('\n---CALL---\n').filter(Boolean);
    const analysisCalls = completedCalls.filter((call) => call.includes('# Current learner turn'));
    const tutorCalls = completedCalls.filter(
      (call) => call.includes('Learner says') && !call.includes('[Tutor-only repair instruction]'),
    );
    assert.equal(analysisCalls.length, 2);
    assert.match(analysisCalls[0], /# Current learner turn[\s\S]*I do not follow the comparison\./u);
    assert.doesNotMatch(analysisCalls[0], /Specifically, explain how the residue/u);
    assert.match(
      analysisCalls[1],
      /# Current learner turn[\s\S]*I do not follow the comparison\.[\s\S]*Specifically, explain how the residue distinguishes a hand\./u,
    );
    assert.equal(tutorCalls.length, 1);
    assert.match(
      tutorCalls[0],
      /Learner says in 2 consecutive messages before your reply[\s\S]*Specifically, explain how the residue distinguishes a hand\./u,
    );

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const completedTurns = events.filter((event) => event.type === 'turn_complete');
    assert.equal(completedTurns.length, 1);
    assert.equal(completedTurns[0].turnRecord.learnerMessages.length, 2);
    assert.equal(
      completedTurns[0].turnRecord.classification.turn.summary,
      'The learner adds a specific clarification to the same turn.',
    );
    assert.equal(completedTurns[0].turnRecord.tutorLearnerDagModel.turn, 1);
    assert.deepEqual(completedTurns[0].turnRecord.tutorLearnerDagUpdate.accepted.adopt, []);
    assert.ok(
      events.some(
        (event) =>
          event.type === 'learner_turn_attempt_discarded' && event.revision === 1 && event.replacedByRevision === 2,
      ),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('/quit writes a learner-centred HTML summary after a completed turn', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-learning-summary-exit-'));
  try {
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
      initialInput: 'The assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('1 new clue'),
    });

    assert.match(result.plain, /learning summary >/u);
    const summaryFiles = fs.readdirSync(tmp).filter((name) => name.endsWith('-learning-summary.html'));
    assert.equal(summaryFiles.length, 1);
    const html = fs.readFileSync(path.join(tmp, summaryFiles[0]), 'utf8');
    assert.match(html, /Tutor stub · what we learned/u);
    assert.match(html, /The Light Shillings/u);
    assert.match(html, /Whose hand struck the false shillings/u);
    assert.match(html, /You chose to end the session here/u);
    assert.match(html, /The assay still confuses me/u);
    assert.match(html, /Verrell alone draws the mint-yard crucible/u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.ok(
      events.some(
        (event) =>
          event.type === 'learning_summary_html' &&
          event.reason === 'exit' &&
          event.turns === 1 &&
          event.natural === false &&
          event.launched === false,
      ),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('a live tutor-model change replays the full public user/assistant history on every later tutor call', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-model-context-replay-'));
  try {
    const result = await runInteractiveModelSwitchSequence({ tmp });
    const calls = fs.readFileSync(result.logPath, 'utf8').split('\n---CALL---\n').filter(Boolean);

    assert.ok(calls.length >= 2);
    assert.doesNotMatch(calls[0], /Conversation so far:/u);
    assert.match(calls[1], /Conversation so far:\nuser: First learner message\./u);
    assert.match(
      calls[1],
      /assistant: I see the point you are putting on the table\.[\s\S]*Take the crucible as a fingerprint/u,
    );
    assert.match(calls[1], /Latest message:\nSecond learner message\./u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const modelChange = events.find((event) => event.type === 'tutor_model_changed' && event.changed === true);
    assert.equal(modelChange.contextReplay.historyMode, 'full_public_replay');
    assert.equal(modelChange.contextReplay.alreadyActive, true);
    assert.equal(modelChange.contextReplay.publicMessageCount, 2);
    const laterTutorCall = events.find(
      (event) =>
        event.type === 'model_call' &&
        event.role === 'tutor_stub_passthrough' &&
        event.request?.config?.messageHistoryMode === 'full_public_replay' &&
        event.request?.config?.replayedMessageCount === 2,
    );
    assert.equal(laterTutorCall.request.config.replayedMessageCount, 2);
    assert.equal(laterTutorCall.request.config.replayedUserMessageCount, 1);
    assert.equal(laterTutorCall.request.config.replayedAssistantMessageCount, 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

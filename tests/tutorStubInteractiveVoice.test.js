import {
  assert,
  spawn,
  fs,
  os,
  path,
  test,
  ROOT,
  plainTerminalText,
  installFakeCodex,
  runInteractive,
} from './helpers/tutorStubInteractiveHarness.js';

test('/voice starts a local companion without calling a tutor model and reports the separate voice role', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-voice-command-'));
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
      initialInput: '/voice\n',
      stopWhen: (plain) => plain.includes('voice > ready'),
      env: {
        OPENAI_API_KEY: 'test-key-not-sent-without-webrtc',
        TUTOR_STUB_VOICE_OPEN: '0',
      },
    });

    assert.match(result.plain, /voice > ready · gpt-realtime-2\.1-mini · marin/u);
    assert.match(result.plain, /microphone speech joins the normal learner turn/u);
    assert.match(result.plain, /voice: on · gpt-realtime-2\.1-mini · marin · separate renderer/u);
    assert.equal(fs.existsSync(result.logPath), false);

    const traces = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.ok(
      traces.some(
        (event) =>
          event.type === 'voice_runtime_enabled' &&
          event.voice.model === 'gpt-realtime-2.1-mini' &&
          event.voice.automaticRealtimeResponses === false,
      ),
    );
    assert.ok(traces.every((event) => !JSON.stringify(event).includes('test-key-not-sent-without-webrtc')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('two voice transcripts before the tutor reply become one compound learner turn', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-voice-compound-'));
  installFakeCodex(tmp);
  const child = spawn(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--no-opening',
      '--no-classifier',
      '--no-register-selection',
      '--no-closeout-report',
      '--no-turn-feedback',
      '--no-interim-animation',
      '--no-stream',
      '--trace-dir',
      tmp,
      '--world',
      'none',
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
        OPENAI_API_KEY: 'test-key-not-sent-without-webrtc',
        TUTOR_STUB_VOICE_OPEN: '0',
        TUTOR_STUB_OPENING_REALIZER: 'deterministic',
        FAKE_CODEX_DELAY_MS: '450',
        CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  let stdout = '';
  let stderr = '';
  let submitted = false;
  let completed = false;
  const timer = setTimeout(() => child.kill('SIGKILL'), 10_000);
  try {
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const done = new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`voice compound test exited ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
      });
    });
    child.stdout.on('data', async (chunk) => {
      stdout += chunk;
      const plain = plainTerminalText(stdout);
      if (!submitted) {
        const match = plain.match(/(http:\/\/127\.0\.0\.1:\d+\/voice\?token=[^\s]+)/u);
        if (match) {
          submitted = true;
          const learnerUrl = new URL(match[1]);
          learnerUrl.pathname = '/api/learner';
          await fetch(learnerUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: 'I think the mark identifies the tool.', itemId: 'voice_1' }),
          });
          setTimeout(async () => {
            await fetch(learnerUrl, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ text: 'But it does not identify the person.', itemId: 'voice_2' }),
            });
          }, 80);
        }
      }
      if (!completed && /tutor >/u.test(plain)) {
        completed = true;
        child.stdin.end('/quit\n');
      }
    });
    child.stdin.write('/voice\n');
    await done;

    assert.match(plainTerminalText(stdout), /learner turn updated > added message 2/u);
    const traces = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.equal(traces.filter((event) => event.type === 'voice_learner_transcript').length, 2);
    assert.ok(
      traces.some(
        (event) =>
          event.type === 'learner_turn_compound_committed' &&
          event.messageCount === 2 &&
          event.combinedText.includes('mark identifies the tool') &&
          event.combinedText.includes('does not identify the person'),
      ),
    );
    assert.ok(
      traces.some(
        (event) =>
          event.type === 'learner_turn_attempt_discarded' &&
          event.reason === 'additional_learner_message_before_tutor_reply',
      ),
    );
  } finally {
    clearTimeout(timer);
    if (!child.killed && child.exitCode === null) child.kill('SIGKILL');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

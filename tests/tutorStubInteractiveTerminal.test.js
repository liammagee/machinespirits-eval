import {
  assert,
  spawnSync,
  fs,
  os,
  path,
  pty,
  test,
  ROOT,
  RUN_CONCURRENT_PTY_IN_CI,
  CONCURRENT_PTY_TIMEOUT_MS,
  CONCURRENT_PTY_TEST_TIMEOUT_MS,
  plainTerminalText,
  installFakeCodex,
} from './helpers/tutorStubInteractiveHarness.js';

test(
  'auto mode keeps a separate editable command line while model output is generated',
  // The parallel root matrix keeps this timing-sensitive case in the explicit
  // skip ledger. A dedicated Linux PTY lane opts it back in, runs this file in
  // isolation without forced exit, and gives shared runners a bounded budget.
  {
    skip: process.platform === 'win32' || (Boolean(process.env.CI) && !RUN_CONCURRENT_PTY_IN_CI),
    timeout: CONCURRENT_PTY_TEST_TIMEOUT_MS,
  },
  async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-concurrent-auto-terminal-'));
    try {
      installFakeCodex(tmp);
      let terminalOutput = '';
      let autoStarted = false;
      let partialCommandEntered = false;
      let commandCompleted = false;
      let requestedExit = false;
      const terminal = pty.spawn(
        process.execPath,
        [
          'scripts/tutor-stub.js',
          '--no-opening',
          '--no-classifier',
          '--no-register-selection',
          '--no-closeout-report',
          '--no-stream',
          '--trace-dir',
          tmp,
          '--world',
          'world_005_marrick',
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
            FAKE_CODEX_DELAY_MS: '800',
            CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
            TUTOR_STUB_SUMMARY_OPEN: '0',
            TUTOR_STUB_REMEMBER_SETTINGS: '0',
          },
        },
      );

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          terminal.kill();
          reject(new Error(`concurrent auto terminal timed out\n${plainTerminalText(terminalOutput)}`));
        }, CONCURRENT_PTY_TIMEOUT_MS);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          if (!autoStarted && plain.includes('learner >')) {
            autoStarted = true;
            terminal.write('/auto 1\r');
          } else if (
            !partialCommandEntered &&
            plain.includes('tutor and learner now continue from the public transcript') &&
            plain.endsWith('auto > ')
          ) {
            partialCommandEntered = true;
            terminal.write('/sta');
          } else if (!commandCompleted && plain.includes('A Diligent Learner (auto) >')) {
            commandCompleted = true;
            terminal.write('tus\r');
          } else if (!requestedExit && plain.includes('session status > AUTO')) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`concurrent auto terminal exited ${exitCode} (${signal})\n${terminalOutput}`));
        });
      });

      const plain = plainTerminalText(terminalOutput);
      assert.match(plain, /auto > \/sta/u);
      assert.match(plain, /A Diligent Learner \(auto\) >/u);
      assert.match(plain, /session status > AUTO/u);
      assert.match(plain, /learning summary: automatic HTML on conclusion/u);
      assert.doesNotMatch(plain, /unknown command/u);
      assert.ok(plain.indexOf('auto > /sta') < plain.indexOf('A Diligent Learner (auto) >'), plain);
      assert.ok(plain.indexOf('A Diligent Learner (auto) >') < plain.indexOf('session status > AUTO'), plain);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test(
  'typing slash opens a filtered command palette and Tab completes the selection',
  { skip: process.platform === 'win32', timeout: 15_000 },
  async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-slash-palette-'));
    try {
      installFakeCodex(tmp);
      let terminalOutput = '';
      let slashEntered = false;
      let filterEntered = false;
      let tabPressed = false;
      let statusSubmitted = false;
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
          'world_005_marrick',
        ],
        {
          cwd: ROOT,
          cols: 120,
          rows: 30,
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
          reject(new Error(`slash palette terminal timed out\n${plainTerminalText(terminalOutput)}`));
        }, 12_000);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          if (!slashEntered && plain.includes('learner >')) {
            slashEntered = true;
            terminal.write('/');
          } else if (!filterEntered && plain.includes('slash commands ·') && plain.includes('available')) {
            filterEntered = true;
            terminal.write('sta');
          } else if (!tabPressed && plain.includes('1 match for /sta')) {
            tabPressed = true;
            terminal.write('\t');
          } else if (!statusSubmitted && plain.includes('learner > /status')) {
            statusSubmitted = true;
            terminal.write('\r');
          } else if (!requestedExit && plain.includes('session status > LEARNER')) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`slash palette terminal exited ${exitCode} (${signal})\n${terminalOutput}`));
        });
      });

      const plain = plainTerminalText(terminalOutput);
      assert.match(plain, /slash commands · \d+ available/u);
      assert.match(plain, /1 match for \/sta/u);
      assert.match(plain, /\/status\s+show the current role, models, modes, and session state/u);
      assert.match(plain, /learner > \/status/u);
      assert.match(plain, /session status > LEARNER/u);
      assert.doesNotMatch(plain, /unknown command/u);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test(
  'free-form /meta input keeps its command summary visible in the slash palette',
  { skip: process.platform === 'win32', timeout: 15_000 },
  async () => {
    let terminalOutput = '';
    let requestEntered = false;
    let requestSubmitted = false;
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
        '--no-trace',
        '--no-remember-settings',
        '--world',
        'world_005_marrick',
      ],
      {
        cwd: ROOT,
        cols: 120,
        rows: 30,
        name: 'xterm-color',
        env: {
          ...process.env,
          TERM: 'xterm-color',
          TUTOR_STUB_SUMMARY_OPEN: '0',
        },
      },
    );

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        terminal.kill();
        reject(new Error(`meta palette terminal timed out\n${plainTerminalText(terminalOutput)}`));
      }, 12_000);
      terminal.onData((chunk) => {
        terminalOutput += chunk;
        const plain = plainTerminalText(terminalOutput);
        if (!requestEntered && plain.includes('learner >')) {
          requestEntered = true;
          terminal.write('/meta Please use plain words');
        } else if (
          !requestSubmitted &&
          plain.includes('ask about the CLI or privately direct a tutor change outside learner speech')
        ) {
          requestSubmitted = true;
          terminal.write('\r');
        } else if (!requestedExit && plain.includes('director request > Please use plain words')) {
          requestedExit = true;
          terminal.write('/quit\r');
        }
      });
      terminal.onExit(({ exitCode, signal }) => {
        clearTimeout(timer);
        if (exitCode === 0) resolve();
        else reject(new Error(`meta palette terminal exited ${exitCode} (${signal})\n${terminalOutput}`));
      });
    });

    const plain = plainTerminalText(terminalOutput);
    assert.match(plain, /1 match for \/meta Please use plain words/u);
    assert.match(plain, /ask about the CLI or privately direct a tutor change outside learner speech/u);
    assert.match(plain, /director request > Please use plain words/u);
  },
);

test(
  'profile palette completes the documented stress-list command',
  { skip: process.platform === 'win32', timeout: 15_000 },
  async () => {
    let terminalOutput = '';
    let filterEntered = false;
    let tabPressed = false;
    let commandSubmitted = false;
    let requestedExit = false;
    const terminal = pty.spawn(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--mixed-learner',
        '--no-opening',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-trace',
        '--no-remember-settings',
        '--world',
        'world_005_marrick',
      ],
      {
        cwd: ROOT,
        cols: 120,
        rows: 30,
        name: 'xterm-color',
        env: {
          ...process.env,
          TERM: 'xterm-color',
          TUTOR_STUB_SUMMARY_OPEN: '0',
          TUTOR_STUB_REMEMBER_SETTINGS: '0',
        },
      },
    );

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        terminal.kill();
        reject(new Error(`profile palette terminal timed out\n${plainTerminalText(terminalOutput)}`));
      }, 12_000);
      terminal.onData((chunk) => {
        terminalOutput += chunk;
        const plain = plainTerminalText(terminalOutput);
        if (!filterEntered && plain.includes('A Diligent Learner >')) {
          filterEntered = true;
          terminal.write('/profile list s');
        } else if (!tabPressed && plain.includes('1 match for /profile list s')) {
          tabPressed = true;
          terminal.write('\t');
        } else if (!commandSubmitted && plain.includes('A Diligent Learner > /profile list stress')) {
          commandSubmitted = true;
          terminal.write('\r');
        } else if (!requestedExit && plain.includes('learner profiles > specialist failure modes (10)')) {
          requestedExit = true;
          terminal.write('/quit\r');
        }
      });
      terminal.onExit(({ exitCode, signal }) => {
        clearTimeout(timer);
        if (exitCode === 0) resolve();
        else reject(new Error(`profile palette terminal exited ${exitCode} (${signal})\n${terminalOutput}`));
      });
    });

    const plain = plainTerminalText(terminalOutput);
    assert.match(plain, /1 match for \/profile list s/u);
    assert.match(plain, /A Diligent Learner > \/profile list stress/u);
    assert.match(plain, /learner profiles > specialist failure modes \(10\)/u);
    assert.doesNotMatch(plain, /unknown learner profile/u);
  },
);

test(
  'prompt shortcuts select and replace words and whole lines',
  { skip: process.platform === 'win32', timeout: 15_000 },
  async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-line-selection-'));
    try {
      let terminalOutput = '';
      let coachSelected = false;
      let wordSubmitted = false;
      let lineSubmitted = false;
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
          '--no-trace',
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
            TERM: 'xterm-color',
            TUTOR_STUB_SUMMARY_OPEN: '0',
            TUTOR_STUB_REMEMBER_SETTINGS: '0',
          },
        },
      );

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          terminal.kill();
          reject(new Error(`line-selection terminal timed out\n${plainTerminalText(terminalOutput)}`));
        }, 12_000);
        terminal.onData((chunk) => {
          terminalOutput += chunk;
          const plain = plainTerminalText(terminalOutput);
          if (!coachSelected && plain.includes('learner >')) {
            coachSelected = true;
            terminal.write('/coach\r');
          } else if (!wordSubmitted && plain.includes('coach >')) {
            wordSubmitted = true;
            terminal.write('alpha beta gamma\x1b[1;4Ddelta\r');
          } else if (!lineSubmitted && plain.includes('coach queued > alpha beta delta')) {
            lineSubmitted = true;
            terminal.write('discard this\x1b[1;2Hreplacement\r');
          } else if (!requestedExit && plain.includes('coach queued > replacement')) {
            requestedExit = true;
            terminal.write('/quit\r');
          }
        });
        terminal.onExit(({ exitCode, signal }) => {
          clearTimeout(timer);
          if (exitCode === 0) resolve();
          else reject(new Error(`line-selection terminal exited ${exitCode} (${signal})\n${terminalOutput}`));
        });
      });

      const plain = plainTerminalText(terminalOutput);
      assert.match(plain, /coach queued > alpha beta delta/u);
      assert.match(plain, /coach queued > replacement/u);
      assert.doesNotMatch(plain, /coach queued > alpha beta deltagamma/u);
      assert.doesNotMatch(plain, /coach queued > replacementdiscard this/u);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },
);

test('a non-interactive single run also writes its learning summary', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-learning-summary-once-'));
  try {
    installFakeCodex(tmp);
    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--once',
        'I would compare the metal residues first.',
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
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
          CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
        },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(plainTerminalText(result.stdout), /learning summary >/u);
    const summaryFiles = fs.readdirSync(tmp).filter((name) => name.endsWith('-learning-summary.html'));
    assert.equal(summaryFiles.length, 1);
    const html = fs.readFileSync(path.join(tmp, summaryFiles[0]), 'utf8');
    assert.match(html, /I would compare the metal residues first/u);
    assert.match(html, /The requested single turn is complete/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

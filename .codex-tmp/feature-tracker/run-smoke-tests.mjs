import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = '/Users/lmagee/Dev/machinespirits/machinespirits-eval-derivation';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3811';
const ADMIN_TOKEN = process.env.PILOT_ADMIN_TOKEN || 'codex-smoke';
const outDir = path.join(ROOT, 'outputs', 'feature-user-story-tracker');
const outPath = path.join(outDir, 'test-results-2026-06-22.json');
const today = '2026-06-22';
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const results = [];
const artifacts = [];

function summarize(value, limit = 600) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

async function request(route, { method = 'GET', body, headers = {} } = {}) {
  return fetchPayload(`${BASE_URL}${route}`, { method, body, headers });
}

async function requestUrl(url, { method = 'GET', body, headers = {} } = {}) {
  return fetchPayload(url, { method, body, headers, includeHeaders: true });
}

async function fetchPayload(url, { method = 'GET', body, headers = {}, includeHeaders = false } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await res.json() : await res.text();
      const result = { status: res.status, ok: res.ok, payload };
      if (includeHeaders) result.headers = Object.fromEntries(res.headers.entries());
      return result;
    } catch (err) {
      lastError = err;
      if (attempt < 2) await sleep(250 * (attempt + 1));
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnServer({ port, env }) {
  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      STANDALONE: 'true',
      OPENROUTER_API_KEY: '',
      EVAL_DB_PATH: path.join(ROOT, '.codex-tmp', 'feature-tracker', 'smoke-data', `auth-${port}.db`),
      EVAL_LOGS_DIR: path.join(ROOT, '.codex-tmp', 'feature-tracker', 'smoke-data', `auth-${port}-logs`),
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
  return { child, getOutput: () => output };
}

function spawnPoeticsServer({ port, dbPath }) {
  const child = spawn(
    'node',
    ['scripts/browse-poetics-scripts.js', '--port', String(port), '--host', '127.0.0.1', '--no-open', '--db', dbPath],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        OPENROUTER_API_KEY: '',
        LEMONFOX_API_KEY: '',
        POETICS_AUTH_USER: '',
        POETICS_AUTH_PASS: '',
        MS_AUTH_USER: '',
        MS_AUTH_PASS: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
  return { child, getOutput: () => output };
}

async function seedPoeticsSmokeDb(dbPath) {
  for (const suffix of ['', '-wal', '-shm']) await fs.rm(`${dbPath}${suffix}`, { force: true });
  const fixtureDir = path.join(ROOT, '.codex-tmp', 'feature-tracker', 'poetics-fixture');
  await fs.rm(fixtureDir, { recursive: true, force: true });
  await fs.mkdir(fixtureDir, { recursive: true });
  const samplePath = path.join(fixtureDir, 'sample-transcript.txt');
  const fullPath = path.join(fixtureDir, 'full-transcript.txt');
  const transcript = [
    'TUTOR: Start with what changed in your own words.',
    'LEARNER: I thought the rule was just memorized, but now I can say what it undoes.',
  ].join('\n');
  await fs.writeFile(samplePath, `${transcript}\n`, 'utf8');
  await fs.writeFile(fullPath, `${transcript}\nTUTOR: That is the recognition move.\n`, 'utf8');

  const seed = spawnSync(
    'node',
    [
      '--input-type=module',
      '-e',
      `
        import { openPoeticsStore, upsertPoeticsRun, upsertPoeticsItem } from './services/poeticsStore.js';
        const db = openPoeticsStore(process.env.POETICS_SMOKE_DB);
        try {
          upsertPoeticsRun(db, {
            id: 'poetics-smoke-run',
            sourceRoot: process.env.POETICS_SMOKE_FIXTURE_DIR,
            batchId: 'codex-smoke',
            generator: 'mock',
            generatorModel: 'mock',
            specPath: null,
            keyPath: null,
            gitCommit: 'codex-smoke',
            metadata: { fixture: true },
          });
          upsertPoeticsItem(db, {
            id: 'poetics-smoke-item',
            runId: 'poetics-smoke-run',
            unitId: 'target-smoke',
            repeat: '0',
            arm: 'target',
            tid: 'smoke-tid',
            dramaId: 'smoke-drama',
            discipline: 'math',
            condition: 'smoke condition',
            intendedLean: 'recognition',
            controlFamily: 'codex-smoke',
            controlRole: 'target',
            samplePath: process.env.POETICS_SMOKE_SAMPLE_PATH,
            fullTranscriptPath: process.env.POETICS_SMOKE_FULL_PATH,
            keyPath: null,
            qualityStatus: 'ok',
            qualityWarnings: [],
            contentHash: 'codex-smoke',
            metadata: { fixture: true },
          });
        } finally {
          db.close();
        }
      `,
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        POETICS_SMOKE_DB: dbPath,
        POETICS_SMOKE_FIXTURE_DIR: path.relative(ROOT, fixtureDir),
        POETICS_SMOKE_SAMPLE_PATH: path.relative(ROOT, samplePath),
        POETICS_SMOKE_FULL_PATH: path.relative(ROOT, fullPath),
      },
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    },
  );
  if (seed.status !== 0) {
    throw new Error(`failed to seed poetics smoke DB\nSTDOUT:\n${seed.stdout}\nSTDERR:\n${seed.stderr}`);
  }
  return { runId: 'poetics-smoke-run', itemId: 'poetics-smoke-item', fixtureDir };
}

async function screenshotPage(url, filename, expectedText = '') {
  const launchOptions = { headless: true };
  try {
    await fs.access(chromePath);
    launchOptions.executablePath = chromePath;
  } catch {}
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const issues = [];
    page.on('pageerror', (err) => issues.push({ type: 'pageerror', text: err.message }));
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(800);
    const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const screenshotPath = path.join(outDir, filename);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    artifacts.push(screenshotPath);
    await page.close();
    assert(response?.status() === 200, `${url}: expected 200, got ${response?.status()}`);
    assert(text.trim().length > 0, `${url}: empty body text`);
    if (expectedText) {
      assert(text.includes(expectedText), `${url}: expected page text ${expectedText}`);
    }
    assert(!issues.some((issue) => issue.type === 'pageerror'), `${url}: page errors ${summarize(issues)}`);
    return { status: response?.status(), bodyChars: text.length, screenshotPath };
  } finally {
    await browser.close();
  }
}

function basic(user, pass) {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

function runCommand(command, args, { timeout = 20000 } = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: { ...process.env, OPENROUTER_API_KEY: '' },
    encoding: 'utf8',
    timeout,
    maxBuffer: 8 * 1024 * 1024,
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  if (result.error) {
    throw new Error(`${command} ${args.join(' ')} failed to start: ${result.error.message}\n${stderr}`.trim());
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} exited ${result.status}\nSTDOUT:\n${stdout.slice(-2000)}\nSTDERR:\n${stderr.slice(-2000)}`,
    );
  }
  return { stdout, stderr };
}

async function waitForExit(child, timeoutMs) {
  return await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function waitForServer(url, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status) return res.status;
    } catch (err) {
      lastError = err;
    }
    await sleep(150);
  }
  throw new Error(`server did not respond at ${url}: ${lastError?.message || 'timeout'}`);
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function validJudgment(armPublicId, overrides = {}) {
  return {
    arm_public_id: armPublicId,
    primary_label: 'learner_standing_repair',
    target_status: 'target',
    target_granularity_risk: false,
    obligations: {
      names_boundary_conversion: 'present',
      restores_boundary_authorship: 'present',
      separates_accountability_from_reassurance: 'present',
      offers_non_content_continuation: 'present',
    },
    excluded_moves_present: ['none'],
    evidence_spans: [{ quote: 'You can decide what remains in scope.', supports: 'primary_label' }],
    rationale: 'This restores the learner boundary. It separates the repair from reassurance.',
    confidence: 0.8,
    ...overrides,
  };
}

async function createA19Fixture() {
  const fixtureDir = path.join(ROOT, '.codex-tmp', 'feature-tracker', 'a19-fixture');
  await fs.rm(fixtureDir, { recursive: true, force: true });
  const assignmentPath = path.join(fixtureDir, 'assignments', 'a19-smoke.assignment.json');
  const codebookPath = path.join(fixtureDir, 'codebooks', 'learner-standing-v01.codebook.json');
  const submissionsRoot = path.join(fixtureDir, 'submissions');
  const rosterPath = path.join(fixtureDir, 'roster.json');
  const assignment = {
    schema_version: 'a19-human-assignment-v01',
    assignment_id: 'a19-smoke-assignment',
    packet_id: 'a19-smoke-packet',
    packet_sha256: 'a19-smoke-packet-sha',
    codebook_id: 'learner-standing-smoke',
    codebook_path: path.relative(ROOT, codebookPath),
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    arms: [
      {
        arm_public_id: 'arm_alpha',
        transcript: 'LEARNER: I need the boundary back.\nTUTOR: You can decide what remains in scope.',
        visible_alias_audit: { hit_count: 0, instruction: 'Judge only public transcript text.' },
      },
      {
        arm_public_id: 'arm_beta',
        transcript: 'LEARNER: I need the boundary back.\nTUTOR: You meant well.',
        visible_alias_audit: { hit_count: 0, instruction: 'Judge only public transcript text.' },
      },
    ],
    non_claims: ['a19_transfer_claim'],
  };
  const codebook = {
    schema_version: 'a19-human-codebook-v01',
    codebook_id: 'learner-standing-smoke',
    target_label: 'learner_standing_repair',
    target_definition: 'Restores the learner as author of whether the disclosure remains in scope.',
    near_miss_labels: ['moral_flattery', 'unclear'],
    target_status_values: ['target', 'near_target', 'non_target', 'unclear'],
    obligation_values: ['present', 'partial', 'absent', 'unclear'],
    required_obligations: [
      { id: 'names_boundary_conversion', description: 'Names boundary conversion.' },
      { id: 'restores_boundary_authorship', description: 'Restores authorship.' },
      { id: 'separates_accountability_from_reassurance', description: 'Separates accountability.' },
      { id: 'offers_non_content_continuation', description: 'Offers a non-content continuation.' },
    ],
    excluded_moves: ['uses_moral_flattery_without_boundary_control'],
    near_miss_guidance: {
      moral_flattery: 'Reassures character without repairing boundary control.',
    },
    pairwise_better_arm_values: ['arm_alpha', 'arm_beta', 'neither', 'unclear'],
    alias_leakage_assessment_values: ['none_observed', 'harmless_generic_wording', 'possible_hint'],
  };
  const roster = {
    schema_version: 'a19-adjudication-roster-v01',
    coders: [
      {
        coder_id: 'coder_smoke',
        coder_role: 'expert_or_semi_expert',
        access_key: 'codex-smoke-key-0001',
        assignments: ['a19-smoke'],
      },
    ],
  };
  await writeJson(assignmentPath, assignment);
  await writeJson(codebookPath, codebook);
  await writeJson(rosterPath, roster);
  return { fixtureDir, assignmentPath, codebookPath, submissionsRoot, rosterPath, slug: 'a19-smoke' };
}

let nextFixturePort = 3814;

async function withA19FixtureServer({ keyed = false, auth = false } = {}, fn) {
  const fixture = await createA19Fixture();
  const port = nextFixturePort++;
  const env = {
    A19_ADJUDICATION_ASSIGNMENT: fixture.assignmentPath,
    A19_ADJUDICATION_ASSIGNMENTS_DIR: path.dirname(fixture.assignmentPath),
    A19_ADJUDICATION_CODEBOOK: fixture.codebookPath,
    A19_ADJUDICATION_SUBMISSIONS_ROOT: fixture.submissionsRoot,
    A19_ADJUDICATION_OUT_DIR: path.join(fixture.submissionsRoot, fixture.slug),
    A19_ADJUDICATION_ROSTER: keyed ? fixture.rosterPath : path.join(fixture.fixtureDir, 'no-roster.json'),
  };
  if (auth) {
    Object.assign(env, {
      EVAL_AUTH_USER: 'admin',
      EVAL_AUTH_PASS: 'secret',
      EVAL_PARTICIPANT_USER: 'coder',
      EVAL_PARTICIPANT_PASS: 'secret',
    });
  }
  const server = spawnServer({ port, env });
  const base = `http://127.0.0.1:${port}`;
  try {
    await waitForServer(`${base}/health`);
    return await fn({ base, fixture });
  } finally {
    server.child.kill('SIGTERM');
    await waitForExit(server.child, 1500);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function record(storyId, feature, testMethod, fn) {
  const started = Date.now();
  try {
    const details = await fn();
    results.push({
      storyId,
      feature,
      testStatus: 'Passed',
      currentStatus: 'Verified in smoke test',
      lastTested: today,
      testMethod,
      defects: '',
      notes: summarize(details || 'ok'),
      durationMs: Date.now() - started,
    });
  } catch (err) {
    results.push({
      storyId,
      feature,
      testStatus: err.blocked ? 'Blocked' : 'Failed',
      currentStatus: err.blocked ? 'Implemented - blocked by external dependency' : 'Implemented - defect observed',
      lastTested: today,
      testMethod,
      defects: err.message,
      notes: err.details ? summarize(err.details) : '',
      durationMs: Date.now() - started,
    });
  }
}

function blocked(message, details = '') {
  const err = new Error(message);
  err.blocked = true;
  err.details = details;
  return err;
}

let pilotSessionId = null;
let pilotItems = [];
let llmSessionId = null;

await fs.mkdir(outDir, { recursive: true });

await record('US-003', 'Basic auth perimeter', 'Spawn public-bind servers with and without credentials', async () => {
  const noCreds = spawnServer({
    port: 3812,
    env: {
      HOST: '0.0.0.0',
      EVAL_AUTH_USER: '',
      EVAL_AUTH_PASS: '',
      MS_AUTH_USER: '',
      MS_AUTH_PASS: '',
      EVAL_PARTICIPANT_USER: '',
      EVAL_PARTICIPANT_PASS: '',
      MS_PARTICIPANT_USER: '',
      MS_PARTICIPANT_PASS: '',
    },
  });
  const refusedCode = await waitForExit(noCreds.child, 3500);
  if (refusedCode === null) {
    noCreds.child.kill('SIGTERM');
    throw new Error(`public bind without credentials stayed running: ${noCreds.getOutput()}`);
  }
  assert(refusedCode !== 0, `public bind without credentials exited successfully: ${noCreds.getOutput()}`);
  assert(
    /Refusing to bind non-local host/.test(noCreds.getOutput()),
    `refusal output missing basic-auth message: ${noCreds.getOutput()}`,
  );

  const withCreds = spawnServer({
    port: 3813,
    env: {
      HOST: '0.0.0.0',
      EVAL_AUTH_USER: 'codex',
      EVAL_AUTH_PASS: 'secret',
      MS_AUTH_USER: '',
      MS_AUTH_PASS: '',
    },
  });
  try {
    await waitForServer('http://127.0.0.1:3813/health');
    const rejected = await requestUrl('http://127.0.0.1:3813/health');
    assert(rejected.status === 401, `unauthenticated public bind expected 401, got ${rejected.status}`);
    assert(rejected.headers['www-authenticate'], 'missing WWW-Authenticate challenge');
    const auth = Buffer.from('codex:secret').toString('base64');
    const accepted = await requestUrl('http://127.0.0.1:3813/health', {
      headers: { Authorization: `Basic ${auth}` },
    });
    assert(accepted.status === 200, `authenticated public bind expected 200, got ${accepted.status}`);
    assert(accepted.payload.status === 'ok', `unexpected health payload: ${summarize(accepted.payload)}`);
    return { refusedCode, rejected: rejected.status, accepted: accepted.payload.status };
  } finally {
    withCreds.child.kill('SIGTERM');
    await waitForExit(withCreds.child, 1500);
  }
});

await record('US-002', 'Health endpoint', 'HTTP GET /health validates JSON fields', async () => {
  const { status, payload } = await request('/health');
  assert(status === 200, `expected 200, got ${status}`);
  assert(payload.status === 'ok', `expected status ok, got ${payload.status}`);
  assert(payload.package === '@machinespirits/eval', `unexpected package ${payload.package}`);
  assert(payload.mode === 'standalone', `unexpected mode ${payload.mode}`);
  return payload;
});

await record('US-001', 'Standalone landing page', 'HTTP GET / validates navigation links', async () => {
  const { status, payload } = await request('/');
  assert(status === 200, `expected 200, got ${status}`);
  for (const token of ['/chat', '/pilot', '/adjudication', '/pilot-admin', '/health', '/api/eval']) {
    assert(payload.includes(token), `landing page missing ${token}`);
  }
  return 'landing page includes primary surfaces and API links';
});

await record('US-004', 'Shared eval surface mounter', 'HTTP route smoke for shared API/static mounts', async () => {
  const checks = [
    ['/components/techne.css', 200],
    ['/chat', 200],
    ['/pilot', 200],
    ['/pilot-admin', 200],
    ['/adjudication', 200],
    ['/api/eval/scenarios', 200],
    ['/api/chat/cells', 200],
    ['/api/pilot/config', 200],
    ['/api/a19/adjudication/me?coder_id=codex_smoke', 200],
  ];
  const seen = [];
  for (const [route, expected] of checks) {
    const { status } = await request(route);
    seen.push({ route, status });
    assert(status === expected, `${route}: expected ${expected}, got ${status}`);
  }
  return seen;
});

await record('US-005', 'Chat cell catalog loading', 'GET /api/chat/cells returns sorted cell catalog', async () => {
  const { status, payload } = await request('/api/chat/cells');
  assert(status === 200, `expected 200, got ${status}`);
  assert(Array.isArray(payload.cells), 'cells is not an array');
  assert(payload.cells.length >= 100, `expected broad cell catalog, got ${payload.cells.length}`);
  assert(payload.cells[0]?.name?.startsWith('cell_'), 'first cell does not have canonical name');
  return { count: payload.cells.length, first: payload.cells[0]?.name };
});

await record('US-006', 'Persona and curriculum loading', 'GET /api/chat/personas and /api/chat/curricula populate controls', async () => {
  const personas = await request('/api/chat/personas');
  const curricula = await request('/api/chat/curricula');
  assert(personas.status === 200, `personas expected 200, got ${personas.status}`);
  assert(curricula.status === 200, `curricula expected 200, got ${curricula.status}`);
  assert(Array.isArray(personas.payload.personas), 'personas payload missing personas array');
  assert(personas.payload.personas.length > 0, 'personas array is empty');
  assert(Array.isArray(curricula.payload.packages), 'curricula payload missing packages array');
  assert(curricula.payload.packages.length > 0, 'curriculum packages array is empty');
  return { personas: personas.payload.personas.length, packages: curricula.payload.packages.length };
});

await record('US-007', 'Cell resolution panel', 'POST /api/chat/resolve maps human-readable features to a cell', async () => {
  const { status, payload } = await request('/api/chat/resolve', {
    method: 'POST',
    body: { approach: 'recognition', critic: 'pedagogical', learnerModel: 'surface' },
  });
  assert(status === 200, `expected 200, got ${status}`);
  assert(payload.resolved?.name, 'missing resolved cell name');
  assert(Array.isArray(payload.resolved.matches), 'missing match explanations');
  return { matchQuality: payload.matchQuality, resolved: payload.resolved.name, score: payload.resolved.score };
});

await record('US-008', 'Human learner turn submission', 'POST /api/chat/turn dryRun returns tutor output and deliberation trace without model spend', async () => {
  const { status, payload } = await request('/api/chat/turn', {
    method: 'POST',
    body: {
      cellName: 'cell_7_recog_multi_unified',
      learnerMessage: 'I think the denominator tells me how many pieces, but I keep treating it like a multiplier.',
      topic: 'fractions',
      history: [{ role: 'tutor', content: 'What does the denominator count?' }],
      dryRun: true,
    },
  });
  assert(status === 200, `chat turn dryRun expected 200, got ${status}: ${summarize(payload)}`);
  assert(payload.dryRun === true, 'chat turn dryRun flag missing');
  assert(typeof payload.finalMessage === 'string' && payload.finalMessage.includes('(dry run)'), 'dryRun final message missing');
  assert(payload.architecture?.hasSuperego === true, 'multi-agent dryRun should expose superego architecture');
  assert(Array.isArray(payload.deliberation), 'chat turn dryRun missing deliberation array');
  assert(payload.deliberation.some((entry) => entry.role === 'ego'), 'chat turn dryRun missing ego entry');
  assert(payload.deliberation.some((entry) => entry.role === 'superego'), 'chat turn dryRun missing superego entry');
  assert(payload.deliberation.some((entry) => entry.role === 'ego_revision'), 'chat turn dryRun missing revision entry');
  assert(payload.totals?.inputTokens === 0 && payload.totals?.outputTokens === 0, 'chat turn dryRun should use zero tokens');
  return { finalMessage: payload.finalMessage, roles: payload.deliberation.map((entry) => entry.role), totals: payload.totals };
});

await record('US-009', 'Synthetic learner turn generation', 'POST /api/chat/learner-turn dryRun returns learner ego/superego/revision trace without model spend', async () => {
  const { status, payload } = await request('/api/chat/learner-turn', {
    method: 'POST',
    body: {
      cellName: 'cell_2_base_single_psycho',
      topic: 'fractions',
      history: [{ role: 'tutor', content: 'What does one half mean?' }],
      personaId: 'eager_novice',
      dryRun: true,
    },
  });
  assert(status === 200, `learner turn dryRun expected 200, got ${status}: ${summarize(payload)}`);
  assert(payload.dryRun === true, 'learner turn dryRun flag missing');
  assert(typeof payload.message === 'string' && payload.message.includes('(dry run)'), 'dryRun learner message missing');
  assert(payload.learnerProfile === 'ego_superego', `expected ego_superego learner, got ${payload.learnerProfile}`);
  assert(Array.isArray(payload.deliberation), 'learner turn dryRun missing deliberation array');
  assert(payload.deliberation.some((entry) => entry.role === 'ego'), 'learner turn dryRun missing ego entry');
  assert(payload.deliberation.some((entry) => entry.role === 'superego'), 'learner turn dryRun missing superego entry');
  assert(payload.deliberation.some((entry) => entry.role === 'ego_revision'), 'learner turn dryRun missing revision entry');
  assert(payload.totals?.inputTokens === 0 && payload.totals?.outputTokens === 0, 'learner turn dryRun should use zero tokens');
  return { message: payload.message, roles: payload.deliberation.map((entry) => entry.role), totals: payload.totals };
});

await record('US-011', 'Pilot enrollment', 'POST /api/pilot/enroll creates a blinded pid-less smoke session', async () => {
  const { status, payload } = await request('/api/pilot/enroll', {
    method: 'POST',
    body: {},
  });
  assert(status === 200, `expected 200, got ${status}: ${summarize(payload)}`);
  assert(payload.session?.id, 'missing session id');
  assert(!Object.hasOwn(payload.session, 'condition_cell'), 'blinded session leaked condition_cell');
  pilotSessionId = payload.session.id;
  return { sessionId: pilotSessionId, status: payload.session.status, resumed: payload.resumed };
});

await record('US-010', 'Pilot session resume', 'GET /api/pilot/session/:id returns active blinded session', async () => {
  assert(pilotSessionId, 'pilot enrollment did not produce a session id');
  const { status, payload } = await request(`/api/pilot/session/${pilotSessionId}`);
  assert(status === 200, `expected 200, got ${status}: ${summarize(payload)}`);
  assert(payload.session?.id === pilotSessionId, 'lookup returned wrong session id');
  assert(!Object.hasOwn(payload.session, 'condition_cell'), 'resume leaked condition_cell');
  return { sessionId: payload.session.id, status: payload.session.status };
});

await record('US-012', 'Consent gate', 'POST consent rejects missing consent and accepts consented true', async () => {
  assert(pilotSessionId, 'pilot enrollment did not produce a session id');
  const rejected = await request(`/api/pilot/session/${pilotSessionId}/consent`, { method: 'POST', body: {} });
  assert(rejected.status === 400, `missing consent expected 400, got ${rejected.status}`);
  const accepted = await request(`/api/pilot/session/${pilotSessionId}/consent`, {
    method: 'POST',
    body: { consented: true },
  });
  assert(accepted.status === 200, `consented true expected 200, got ${accepted.status}: ${summarize(accepted.payload)}`);
  assert(accepted.payload.session?.status === 'consented', `unexpected status ${accepted.payload.session?.status}`);
  return { rejected: rejected.status, accepted: accepted.payload.session.status };
});

await record('US-013', 'Intake capture', 'POST intake stores payload and advances phase', async () => {
  const { status, payload } = await request(`/api/pilot/session/${pilotSessionId}/intake`, {
    method: 'POST',
    body: { math_confidence: 'medium', notes: 'codex smoke' },
  });
  assert(status === 200, `expected 200, got ${status}: ${summarize(payload)}`);
  assert(payload.session?.status === 'intake_done', `unexpected status ${payload.session?.status}`);
  return { status: payload.session.status };
});

await record('US-014', 'Pretest item delivery and scoring', 'Start pretest, fetch items, submit server-scored responses', async () => {
  const started = await request(`/api/pilot/session/${pilotSessionId}/pretest/start`, { method: 'POST', body: {} });
  assert(started.status === 200, `start expected 200, got ${started.status}: ${summarize(started.payload)}`);
  const items = await request(`/api/pilot/session/${pilotSessionId}/items?phase=pretest`);
  assert(items.status === 200, `items expected 200, got ${items.status}: ${summarize(items.payload)}`);
  assert(Array.isArray(items.payload.items), 'items missing array');
  assert(items.payload.items.length > 0, 'pretest item list is empty');
  assert(!Object.hasOwn(items.payload.items[0], 'correct'), 'participant item leaked correct answer');
  pilotItems = items.payload.items;
  const responses = pilotItems.map((item, idx) => ({
    item_id: item.id,
    item_position: idx,
    response_value: 'smoke',
    response_ms: 1,
  }));
  const submitted = await request(`/api/pilot/session/${pilotSessionId}/pretest/submit`, {
    method: 'POST',
    body: { responses },
  });
  assert(submitted.status === 200, `submit expected 200, got ${submitted.status}: ${summarize(submitted.payload)}`);
  assert(submitted.payload.scored === responses.length, `expected ${responses.length} scored, got ${submitted.payload.scored}`);
  assert(submitted.payload.session?.status === 'pretest_done', `unexpected status ${submitted.payload.session?.status}`);
  return { form: items.payload.form, count: pilotItems.length, status: submitted.payload.session.status };
});

await record('US-015', 'Timed tutoring phase', 'POST tutoring start/complete exposes cap and advances status', async () => {
  const started = await request(`/api/pilot/session/${pilotSessionId}/tutoring/start`, { method: 'POST', body: {} });
  assert(started.status === 200, `start expected 200, got ${started.status}: ${summarize(started.payload)}`);
  assert(started.payload.tutoringCapMs > 0, 'missing positive tutoring cap');
  assert(started.payload.session?.status === 'tutoring', `unexpected status ${started.payload.session?.status}`);
  const completed = await request(`/api/pilot/session/${pilotSessionId}/tutoring/complete`, {
    method: 'POST',
    body: { reason: 'completed' },
  });
  assert(completed.status === 200, `complete expected 200, got ${completed.status}: ${summarize(completed.payload)}`);
  assert(completed.payload.session?.status === 'tutoring_done', `unexpected status ${completed.payload.session?.status}`);
  return { capMs: started.payload.tutoringCapMs, status: completed.payload.session.status };
});

await record('US-016', 'Posttest and exit survey', 'Start/submit posttest and record exit survey', async () => {
  const started = await request(`/api/pilot/session/${pilotSessionId}/posttest/start`, { method: 'POST', body: {} });
  assert(started.status === 200, `posttest start expected 200, got ${started.status}: ${summarize(started.payload)}`);
  const items = await request(`/api/pilot/session/${pilotSessionId}/items?phase=posttest`);
  assert(items.status === 200, `posttest items expected 200, got ${items.status}: ${summarize(items.payload)}`);
  const responses = items.payload.items.map((item, idx) => ({
    item_id: item.id,
    item_position: idx,
    response_value: 'smoke',
    response_ms: 1,
  }));
  const submitted = await request(`/api/pilot/session/${pilotSessionId}/posttest/submit`, {
    method: 'POST',
    body: { responses },
  });
  assert(submitted.status === 200, `posttest submit expected 200, got ${submitted.status}: ${summarize(submitted.payload)}`);
  const exit = await request(`/api/pilot/session/${pilotSessionId}/exit`, {
    method: 'POST',
    body: { engagement_likert: '3', open_ended: 'codex smoke' },
  });
  assert(exit.status === 200, `exit expected 200, got ${exit.status}: ${summarize(exit.payload)}`);
  assert(exit.payload.session?.status === 'completed', `unexpected status ${exit.payload.session?.status}`);
  return { posttestScored: submitted.payload.scored, status: exit.payload.session.status };
});

await record('US-017', 'Pilot admin token gate and dashboard', 'Admin counts rejects missing token and accepts configured token', async () => {
  const rejected = await request('/api/pilot/admin/counts');
  assert(rejected.status === 401, `missing token expected 401, got ${rejected.status}: ${summarize(rejected.payload)}`);
  const accepted = await request('/api/pilot/admin/counts', { headers: { 'x-pilot-admin-token': ADMIN_TOKEN } });
  assert(accepted.status === 200, `admin counts expected 200, got ${accepted.status}: ${summarize(accepted.payload)}`);
  assert(accepted.payload.counts, 'missing counts object');
  return { rejected: rejected.status, recruitmentEnabled: accepted.payload.recruitmentEnabled };
});

await record('US-019', 'Synthetic LLM pilot enrollment', 'Admin enroll-llm creates unblinded synthetic session', async () => {
  const { status, payload } = await request('/api/pilot/admin/enroll-llm', {
    method: 'POST',
    headers: { 'x-pilot-admin-token': ADMIN_TOKEN },
    body: { condition: 'cell_1_base_single_unified' },
  });
  assert(status === 200, `expected 200, got ${status}: ${summarize(payload)}`);
  assert(payload.session?.id, 'missing synthetic session id');
  assert(payload.session?.learner_source === 'llm', `unexpected learner_source ${payload.session?.learner_source}`);
  assert(payload.session?.condition_cell === 'cell_1_base_single_unified', 'admin synthetic session did not expose/force condition');
  llmSessionId = payload.session.id;
  return { sessionId: llmSessionId, condition: payload.session.condition_cell };
});

await record('US-019', 'Mock pilot autoplay', 'Admin autoplay with mock=true runs without paid model calls', async () => {
  assert(llmSessionId, 'synthetic enrollment did not produce a session id');
  const { status, payload } = await request(`/api/pilot/admin/session/${llmSessionId}/autoplay`, {
    method: 'POST',
    headers: { 'x-pilot-admin-token': ADMIN_TOKEN },
    body: { mock: true, max_turn_pairs: 1, topic: 'fractions' },
  });
  assert(status === 200, `expected 200, got ${status}: ${summarize(payload)}`);
  assert(payload.autoplay, 'missing autoplay result');
  return payload.autoplay;
});

await record('US-018', 'Pilot admin session inspection', 'Admin session detail returns session, turns, and tests', async () => {
  const sessions = await request('/api/pilot/admin/sessions?limit=200', {
    headers: { 'x-pilot-admin-token': ADMIN_TOKEN },
  });
  assert(sessions.status === 200, `admin sessions expected 200, got ${sessions.status}: ${summarize(sessions.payload)}`);
  assert(Array.isArray(sessions.payload.sessions), 'admin sessions missing sessions array');
  const { status, payload } = await request(`/api/pilot/admin/session/${pilotSessionId}`, {
    headers: { 'x-pilot-admin-token': ADMIN_TOKEN },
  });
  assert(status === 200, `expected 200, got ${status}: ${summarize(payload)}`);
  assert(payload.session?.id === pilotSessionId, 'wrong admin session id');
  assert(Array.isArray(payload.turns), 'turns missing array');
  assert(Array.isArray(payload.tests), 'tests missing array');
  assert(payload.tests.length >= pilotItems.length, 'admin detail did not include test responses');
  return { sessions: sessions.payload.sessions.length, tests: payload.tests.length, turns: payload.turns.length };
});

await record('US-020', 'A19 coder identity and worklist', 'GET /api/a19/adjudication/me in open mode resolves coder/worklist', async () => {
  const { status, payload } = await request('/api/a19/adjudication/me?coder_id=codex_smoke');
  assert(status === 200, `expected 200, got ${status}: ${summarize(payload)}`);
  assert(payload.success === true, 'success flag missing');
  assert(payload.mode === 'open', `expected open mode, got ${payload.mode}`);
  assert(payload.coder?.coder_id === 'codex_smoke', 'coder id did not round-trip safely');
  assert(Array.isArray(payload.worklist), 'worklist missing array');
  return { mode: payload.mode, worklist: payload.worklist.length };
});

await record('US-021', 'A19 assignment retrieval', 'Fixture server returns sanitized assignment and codebook', async () => {
  return await withA19FixtureServer({}, async ({ base, fixture }) => {
    const legacy = await requestUrl(`${base}/api/a19/adjudication/assignment`);
    assert(legacy.status === 200, `legacy assignment expected 200, got ${legacy.status}: ${summarize(legacy.payload)}`);
    assert(legacy.payload.success === true, 'legacy success flag missing');
    assert(legacy.payload.assignment?.assignment_id === 'a19-smoke-assignment', 'legacy assignment id mismatch');
    assert(legacy.payload.codebook?.codebook_id === 'learner-standing-smoke', 'legacy codebook id mismatch');
    const slugged = await requestUrl(`${base}/api/a19/adjudication/assignments/${fixture.slug}?coder_id=coder_smoke`);
    assert(slugged.status === 200, `slug assignment expected 200, got ${slugged.status}: ${summarize(slugged.payload)}`);
    assert(slugged.payload.success === true, 'slug success flag missing');
    assert(slugged.payload.assignment?.arms?.length === 2, 'assignment arms missing');
    return { legacyNextCoder: legacy.payload.next_coder_id, slug: fixture.slug, mode: slugged.payload.mode };
  });
});

await record('US-022', 'A19 draft autosave', 'PUT/GET/DELETE assignment draft round-trip on fixture server', async () => {
  return await withA19FixtureServer({}, async ({ base, fixture }) => {
    const draftPayload = { arm_judgments: [{ arm_public_id: 'arm_alpha', note: 'partial draft' }] };
    const put = await requestUrl(`${base}/api/a19/adjudication/assignments/${fixture.slug}/draft`, {
      method: 'PUT',
      body: { coder_id: 'coder_smoke', payload: draftPayload },
    });
    assert(put.status === 200, `draft put expected 200, got ${put.status}: ${summarize(put.payload)}`);
    assert(put.payload.draft?.coder_id === 'coder_smoke', 'draft put did not return coder id');
    const got = await requestUrl(`${base}/api/a19/adjudication/assignments/${fixture.slug}/draft?coder_id=coder_smoke`);
    assert(got.status === 200, `draft get expected 200, got ${got.status}: ${summarize(got.payload)}`);
    assert(got.payload.draft?.payload?.arm_judgments?.[0]?.note === 'partial draft', 'draft payload did not round-trip');
    const del = await requestUrl(`${base}/api/a19/adjudication/assignments/${fixture.slug}/draft?coder_id=coder_smoke`, {
      method: 'DELETE',
    });
    assert(del.status === 200, `draft delete expected 200, got ${del.status}: ${summarize(del.payload)}`);
    const after = await requestUrl(`${base}/api/a19/adjudication/assignments/${fixture.slug}/draft?coder_id=coder_smoke`);
    assert(after.status === 200, `draft get after delete expected 200, got ${after.status}: ${summarize(after.payload)}`);
    assert(after.payload.draft === null, 'draft was not deleted');
    return { put: put.payload.draft, deleted: after.payload.draft === null };
  });
});

await record('US-023', 'A19 submission and overwrite policy', 'POST submission rejects duplicate unless overwrite is explicit', async () => {
  return await withA19FixtureServer({}, async ({ base, fixture }) => {
    const submission = {
      coder_id: 'coder_smoke',
      coder_role: 'expert_or_semi_expert',
      arm_judgments: [
        validJudgment('arm_alpha'),
        validJudgment('arm_beta', {
          primary_label: 'moral_flattery',
          target_status: 'non_target',
          obligations: {
            names_boundary_conversion: 'absent',
            restores_boundary_authorship: 'absent',
            separates_accountability_from_reassurance: 'absent',
            offers_non_content_continuation: 'absent',
          },
          excluded_moves_present: ['uses_moral_flattery_without_boundary_control'],
          evidence_spans: [{ quote: 'You meant well.', supports: 'primary_label' }],
          rationale: 'This reassures character. It does not restore boundary authorship.',
        }),
      ],
      pairwise_judgment: {
        better_arm_public_id: 'arm_alpha',
        better_for_target_reason: true,
        reason: 'arm_alpha better restores learner standing.',
        alias_leakage_assessment: 'none_observed',
      },
      codebook_feedback: { ambiguous_terms: [], suggested_revision: '' },
    };
    const first = await requestUrl(`${base}/api/a19/adjudication/assignments/${fixture.slug}/submissions`, {
      method: 'POST',
      body: submission,
    });
    assert(first.status === 201, `first submit expected 201, got ${first.status}: ${summarize(first.payload)}`);
    assert(first.payload.validation?.status === 'pass', 'first submission did not validate');
    const duplicate = await requestUrl(`${base}/api/a19/adjudication/assignments/${fixture.slug}/submissions`, {
      method: 'POST',
      body: submission,
    });
    assert(duplicate.status === 409, `duplicate submit expected 409, got ${duplicate.status}: ${summarize(duplicate.payload)}`);
    const overwrite = await requestUrl(`${base}/api/a19/adjudication/assignments/${fixture.slug}/submissions`, {
      method: 'POST',
      body: { ...submission, overwrite: true },
    });
    assert(overwrite.status === 201, `overwrite submit expected 201, got ${overwrite.status}: ${summarize(overwrite.payload)}`);
    assert(overwrite.payload.validation?.status === 'pass', 'overwrite submission did not validate');
    return { first: first.status, duplicate: duplicate.status, overwrite: overwrite.status };
  });
});

await record('US-024', 'A19 admin panel matrix', 'Role-gated panel returns fixture assignment completeness matrix', async () => {
  return await withA19FixtureServer({ keyed: true, auth: true }, async ({ base }) => {
    const participant = await requestUrl(`${base}/api/a19/adjudication/panel`, {
      headers: { Authorization: basic('coder', 'secret') },
    });
    assert(
      participant.status === 403,
      `participant panel expected 403, got ${participant.status}: ${summarize(participant.payload)}`,
    );
    const admin = await requestUrl(`${base}/api/a19/adjudication/panel`, {
      headers: { Authorization: basic('admin', 'secret') },
    });
    assert(admin.status === 200, `admin panel expected 200, got ${admin.status}: ${summarize(admin.payload)}`);
    assert(admin.payload.success === true, 'admin panel success flag missing');
    assert(admin.payload.mode === 'keyed', `expected keyed panel, got ${admin.payload.mode}`);
    assert(Array.isArray(admin.payload.assignments), 'panel assignments missing');
    assert(admin.payload.assignments[0]?.coders?.[0]?.coder_id === 'coder_smoke', 'roster coder missing from panel');
    return { participant: participant.status, mode: admin.payload.mode, assignments: admin.payload.assignments.length };
  });
});

await record('US-025', 'Eval API discovery endpoints', 'GET eval scenarios/profiles/learner-profiles/configurations/docs', async () => {
  const routes = ['/api/eval/scenarios', '/api/eval/profiles', '/api/eval/learner-profiles', '/api/eval/configurations', '/api/eval/docs'];
  const seen = [];
  for (const route of routes) {
    const { status, payload } = await request(route);
    seen.push({ route, status, keys: typeof payload === 'object' ? Object.keys(payload).slice(0, 8) : [] });
    assert(status === 200, `${route}: expected 200, got ${status}: ${summarize(payload)}`);
  }
  return seen;
});

await record('US-026', 'Eval API quick evaluation', 'POST /api/eval/quick supports no-spend dryRun', async () => {
  const { status, payload } = await request('/api/eval/quick', {
    method: 'POST',
    body: {
      profile: 'budget',
      scenario: 'new_user_first_visit',
      dryRun: true,
      skipRubric: false,
    },
  });
  assert(status === 200, `quick dryRun expected 200, got ${status}: ${summarize(payload)}`);
  assert(payload.success === true, 'quick dryRun success flag missing');
  assert(payload.runId, 'quick dryRun missing runId');
  assert(payload.result?.scenarioId === 'new_user_first_visit', 'quick dryRun scenario mismatch');
  return { runId: payload.runId, scenarioId: payload.result.scenarioId, score: payload.result.tutorFirstTurnScore };
});

await record('US-027', 'Eval API run/compare/matrix evaluation', 'POST run/compare/matrix support no-spend dryRun', async () => {
  const profiles = await request('/api/eval/profiles');
  assert(profiles.status === 200, `profiles expected 200, got ${profiles.status}: ${summarize(profiles.payload)}`);
  const available = profiles.payload.profiles?.map((p) => p.name).filter(Boolean) || [];
  const profileA = available.includes('budget') ? 'budget' : available[0];
  const profileB = available.find((p) => p !== profileA) || profileA;
  assert(profileA, 'no profile available for dryRun');
  const run = await request('/api/eval/run', {
    method: 'POST',
    body: {
      profiles: [profileA],
      scenarios: ['new_user_first_visit'],
      runsPerConfig: 1,
      dryRun: true,
      skipRubric: false,
      description: 'codex smoke dryRun',
    },
  });
  assert(run.status === 200, `run dryRun expected 200, got ${run.status}: ${summarize(run.payload)}`);
  assert(run.payload.success === true, 'run dryRun success flag missing');
  const compare = await request('/api/eval/compare', {
    method: 'POST',
    body: {
      profiles: [profileA, profileB],
      scenarios: ['new_user_first_visit'],
      runsPerConfig: 1,
      dryRun: true,
    },
  });
  assert(compare.status === 200, `compare dryRun expected 200, got ${compare.status}: ${summarize(compare.payload)}`);
  assert(compare.payload.success === true, 'compare dryRun success flag missing');
  const matrix = await request('/api/eval/matrix', {
    method: 'POST',
    body: {
      profiles: [profileA],
      scenarios: ['new_user_first_visit'],
      dryRun: true,
      skipRubric: false,
    },
  });
  assert(matrix.status === 200, `matrix dryRun expected 200, got ${matrix.status}: ${summarize(matrix.payload)}`);
  assert(matrix.payload.success === true, 'matrix dryRun success flag missing');
  return {
    runId: run.payload.runId,
    compareRunId: compare.payload.runId,
    matrixRunId: matrix.payload.runId,
    profiles: [profileA, profileB],
  };
});

await record('US-028', 'Eval run history/report surfaces', 'GET run history endpoints and missing run fail safely', async () => {
  const runs = await request('/api/eval/runs?limit=5');
  assert(runs.status === 200, `runs expected 200, got ${runs.status}: ${summarize(runs.payload)}`);
  assert(runs.payload.success === true, 'runs success flag missing');
  assert(Array.isArray(runs.payload.runs), 'runs missing array');
  const incomplete = await request('/api/eval/runs-incomplete?olderThanMinutes=1');
  assert(
    incomplete.status === 200,
    `runs-incomplete expected 200, got ${incomplete.status}: ${summarize(incomplete.payload)}`,
  );
  assert(incomplete.payload.success === true, 'runs-incomplete success flag missing');
  const missing = await request('/api/eval/runs/codex-smoke-missing-run');
  assert(missing.status === 404, `missing run expected 404, got ${missing.status}: ${summarize(missing.payload)}`);
  return { runs: runs.payload.runs.length, incomplete: incomplete.payload.found, missingStatus: missing.status };
});

await record('US-029', 'Eval dialogue log browsing', 'GET dialogue log list/stats and missing dialogue fail safely', async () => {
  const dates = await request('/api/eval/logs/dates');
  assert(dates.status === 200, `logs/dates expected 200, got ${dates.status}: ${summarize(dates.payload)}`);
  assert(dates.payload.success === true, 'logs/dates success flag missing');
  assert(Array.isArray(dates.payload.dates), 'logs/dates payload missing dates array');

  const stats = await request('/api/eval/logs-stats');
  assert(stats.status === 200, `logs-stats expected 200, got ${stats.status}: ${summarize(stats.payload)}`);
  assert(stats.payload.success === true, 'logs-stats success flag missing');

  const dateToInspect = dates.payload.dates[0] || '2099-01-01';
  const list = await request(`/api/eval/logs/${dateToInspect}?limit=1&offset=0`);
  assert(list.status === 200, `logs/:date expected 200, got ${list.status}: ${summarize(list.payload)}`);
  assert(list.payload.success === true, 'logs/:date success flag missing');
  assert(Array.isArray(list.payload.dialogues), 'logs/:date payload missing dialogues array');

  const missingById = await request('/api/eval/logs/dialogue/codex-smoke-missing-dialogue');
  assert(
    missingById.status === 404,
    `missing dialogue id expected 404, got ${missingById.status}: ${summarize(missingById.payload)}`,
  );
  const missingByIndex = await request(`/api/eval/logs/${dateToInspect}/999999`);
  assert(
    missingByIndex.status === 404,
    `missing dialogue index expected 404, got ${missingByIndex.status}: ${summarize(missingByIndex.payload)}`,
  );

  return {
    dates: dates.payload.dates.length,
    dialogues: list.payload.dialogues.length,
    statsKeys: Object.keys(stats.payload).sort(),
    missing: [missingById.status, missingByIndex.status],
  };
});

await record('US-031', 'Eval monitoring endpoints', 'GET monitor summary/sessions/alerts and missing ack fail safely', async () => {
  const summary = await request('/api/eval/monitor/summary');
  assert(summary.status === 200, `monitor summary expected 200, got ${summary.status}: ${summarize(summary.payload)}`);
  assert(summary.payload.success === true, 'monitor summary success flag missing');

  const sessions = await request('/api/eval/monitor/sessions');
  assert(sessions.status === 200, `monitor sessions expected 200, got ${sessions.status}: ${summarize(sessions.payload)}`);
  assert(sessions.payload.success === true, 'monitor sessions success flag missing');
  assert(Array.isArray(sessions.payload.sessions), 'monitor sessions missing sessions array');
  assert(sessions.payload.aggregate && typeof sessions.payload.aggregate === 'object', 'monitor sessions missing aggregate');

  const sessionIds = sessions.payload.sessions.map((session) => session.sessionId || session.id).filter(Boolean);
  let sessionDetail = null;
  if (sessionIds[0]) {
    sessionDetail = await request(`/api/eval/monitor/sessions/${encodeURIComponent(sessionIds[0])}`);
    assert(
      sessionDetail.status === 200,
      `monitor session detail expected 200, got ${sessionDetail.status}: ${summarize(sessionDetail.payload)}`,
    );
    assert(sessionDetail.payload.success === true, 'monitor session detail success flag missing');
  }

  const missingSession = await request('/api/eval/monitor/sessions/codex-smoke-missing-session');
  assert(
    missingSession.status === 404,
    `missing monitor session expected 404, got ${missingSession.status}: ${summarize(missingSession.payload)}`,
  );

  const alerts = await request('/api/eval/monitor/alerts?limit=5');
  assert(alerts.status === 200, `monitor alerts expected 200, got ${alerts.status}: ${summarize(alerts.payload)}`);
  assert(alerts.payload.success === true, 'monitor alerts success flag missing');
  assert(Array.isArray(alerts.payload.alerts), 'monitor alerts missing alerts array');

  const missingAck = await request('/api/eval/monitor/alerts/codex-smoke-missing-alert/acknowledge', { method: 'POST' });
  assert(
    missingAck.status === 404,
    `missing alert acknowledge expected 404, got ${missingAck.status}: ${summarize(missingAck.payload)}`,
  );

  return {
    activeSessions: sessions.payload.sessions.length,
    checkedSessionDetail: !!sessionDetail,
    alerts: alerts.payload.alerts.length,
    missing: [missingSession.status, missingAck.status],
  };
});

await record('US-030', 'Eval API prompt browsing and recommendation', 'GET prompt catalog/content and POST dry-run prompt recommendations', async () => {
  const prompts = await request('/api/eval/prompts');
  assert(prompts.status === 200, `prompts expected 200, got ${prompts.status}: ${summarize(prompts.payload)}`);
  assert(prompts.payload.success === true, 'prompts success flag missing');
  assert(Array.isArray(prompts.payload.prompts), 'prompts missing prompts array');
  assert(prompts.payload.prompts.length > 0, 'prompt catalog should not be empty');

  const firstPrompt = prompts.payload.prompts[0];
  const detail = await request(`/api/eval/prompts/${encodeURIComponent(firstPrompt.name)}`);
  assert(detail.status === 200, `prompt detail expected 200, got ${detail.status}: ${summarize(detail.payload)}`);
  assert(detail.payload.success === true, 'prompt detail success flag missing');
  assert(String(detail.payload.prompt?.content || '').trim().length > 0, 'prompt detail missing content');

  const recommendation = await request('/api/eval/prompts/recommend', {
    method: 'POST',
    body: {
      profile: 'budget',
      scenarios: ['new_user_first_visit'],
      dryRun: true,
    },
  });
  assert(
    recommendation.status === 200,
    `prompt dryRun recommendation expected 200, got ${recommendation.status}: ${summarize(recommendation.payload)}`,
  );
  assert(recommendation.payload.success === true, 'prompt dryRun success flag missing');
  assert(recommendation.payload.readOnly === true, 'prompt dryRun should be explicitly read-only');
  assert(recommendation.payload.dryRun === true, 'prompt dryRun flag missing');
  assert(recommendation.payload.recommenderModel === 'dry-run', 'prompt dryRun should not call a model');
  assert(recommendation.payload.usage?.inputTokens === 0, 'prompt dryRun should report zero input tokens');
  return { prompts: prompts.payload.prompts.length, firstPrompt: firstPrompt.filename, recommenderModel: recommendation.payload.recommenderModel };
});

await record('US-032', 'Eval API interaction trace inspection', 'GET interactions list and missing trace/diagram/transcript fail safely', async () => {
  const list = await request('/api/eval/interactions?limit=1');
  assert(list.status === 200, `interactions expected 200, got ${list.status}: ${summarize(list.payload)}`);
  assert(list.payload.success === true, 'interactions success flag missing');
  assert(Array.isArray(list.payload.evals), 'interactions missing evals array');
  assert(typeof list.payload.count === 'number', 'interactions missing count');

  const missing = await request('/api/eval/interactions/codex-smoke-missing');
  assert(missing.status === 404, `missing interaction expected 404, got ${missing.status}: ${summarize(missing.payload)}`);
  const missingDiagram = await request('/api/eval/interactions/codex-smoke-missing/diagram');
  assert(
    missingDiagram.status === 404,
    `missing interaction diagram expected 404, got ${missingDiagram.status}: ${summarize(missingDiagram.payload)}`,
  );
  const missingTranscript = await request('/api/eval/interactions/codex-smoke-missing/transcript');
  assert(
    missingTranscript.status === 404,
    `missing interaction transcript expected 404, got ${missingTranscript.status}: ${summarize(missingTranscript.payload)}`,
  );
  return { count: list.payload.count, missing: [missing.status, missingDiagram.status, missingTranscript.status] };
});

await record('US-033', 'Eval API Codex session bridge', 'Create/poll/list/get/delete a harmless codex --help session', async () => {
  const before = await request('/api/eval/codex/sessions');
  assert(before.status === 200, `codex session list expected 200, got ${before.status}: ${summarize(before.payload)}`);
  assert(before.payload.success === true, 'codex session list success flag missing');

  const created = await request('/api/eval/codex/sessions', {
    method: 'POST',
    body: { args: ['--help'], cwd: ROOT, noColor: true },
  });
  if (created.status === 400 && /ENOENT|not found|spawn codex/i.test(JSON.stringify(created.payload))) {
    throw blocked('Codex CLI is not available to the server process', created.payload);
  }
  assert(created.status === 201, `codex session create expected 201, got ${created.status}: ${summarize(created.payload)}`);
  const sessionId = created.payload.session?.id;
  assert(sessionId, 'created codex session missing id');

  let poll = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    poll = await request(`/api/eval/codex/sessions/${encodeURIComponent(sessionId)}/poll?cursor=-1`);
    assert(poll.status === 200, `codex poll expected 200, got ${poll.status}: ${summarize(poll.payload)}`);
    if (poll.payload.session?.status === 'exited' || poll.payload.events?.length > 0) break;
    await sleep(350);
  }

  const detail = await request(`/api/eval/codex/sessions/${encodeURIComponent(sessionId)}`);
  assert(detail.status === 200, `codex session detail expected 200, got ${detail.status}: ${summarize(detail.payload)}`);
  assert(detail.payload.success === true, 'codex session detail success flag missing');

  const deleted = await request(`/api/eval/codex/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  assert(deleted.status === 200, `codex session delete expected 200, got ${deleted.status}: ${summarize(deleted.payload)}`);
  assert(deleted.payload.success === true, 'codex session delete success flag missing');
  return {
    sessionId,
    events: poll?.payload?.events?.length || 0,
    finalStatus: poll?.payload?.session?.status || detail.payload.session.status,
    before: before.payload.sessions.length,
  };
});

const poeticsPort = 3468;
const poeticsBase = `http://127.0.0.1:${poeticsPort}`;
const poeticsDbPath = path.join(ROOT, '.codex-tmp', 'feature-tracker', 'poetics-smoke.db');
const poeticsFixture = await seedPoeticsSmokeDb(poeticsDbPath);
const poeticsServer = spawnPoeticsServer({ port: poeticsPort, dbPath: poeticsDbPath });
try {
  await waitForServer(`${poeticsBase}/healthz`, 8000);
  const poetics = (route, options) => requestUrl(`${poeticsBase}${route}`, options);

  await record('US-034', 'Poetics transcript browser corpus navigation', 'Poetics /browse page and corpus APIs render seeded item', async () => {
    const health = await poetics('/healthz');
    assert(health.status === 200 && String(health.payload).trim() === 'ok', `healthz failed: ${summarize(health)}`);
    const stats = await poetics('/api/stats');
    assert(stats.status === 200, `poetics stats expected 200, got ${stats.status}: ${summarize(stats.payload)}`);
    assert(stats.payload.scripts >= 1, `poetics stats should see seeded script: ${summarize(stats.payload)}`);
    const runs = await poetics('/api/runs');
    assert(runs.status === 200, `poetics runs expected 200, got ${runs.status}: ${summarize(runs.payload)}`);
    assert(runs.payload.runs.some((run) => run.id === poeticsFixture.runId), 'seeded poetics run missing');
    const items = await poetics(`/api/items?runId=${encodeURIComponent(poeticsFixture.runId)}`);
    assert(items.status === 200, `poetics items expected 200, got ${items.status}: ${summarize(items.payload)}`);
    assert(items.payload.items.some((item) => item.id === poeticsFixture.itemId), 'seeded poetics item missing');
    const detail = await poetics(`/api/item?id=${encodeURIComponent(poeticsFixture.itemId)}`);
    assert(detail.status === 200, `poetics item expected 200, got ${detail.status}: ${summarize(detail.payload)}`);
    assert(detail.payload.sampleText.includes('TUTOR:'), 'poetics item sample transcript missing');
    const page = await screenshotPage(`${poeticsBase}/browse`, 'smoke-poetics-browse.png', 'sidecar browser');
    return { runs: runs.payload.runs.length, items: items.payload.items.length, page };
  });

  await record('US-035', 'Poetics labels and review flags', 'Save/read browser label and review flag on seeded sidecar item', async () => {
    const label = await poetics('/api/labels', {
      method: 'POST',
      body: {
        itemId: poeticsFixture.itemId,
        labellerId: 'codex-smoke',
        formClass: 'recognition',
        pivotLearnerTurn: 1,
        rationale: 'Smoke label for browser workflow.',
      },
    });
    assert(label.status === 200, `label save expected 200, got ${label.status}: ${summarize(label.payload)}`);
    assert(label.payload.ok === true, 'label save ok flag missing');
    assert(label.payload.detail.label?.form_class === 'recognition', 'saved label not returned in blind detail');

    const flag = await poetics('/api/review-flags', {
      method: 'POST',
      body: {
        itemId: poeticsFixture.itemId,
        flaggerId: 'codex-smoke',
        flagType: 'human_review',
        priority: 'high',
        reason: 'Smoke review flag.',
      },
    });
    assert(flag.status === 200, `review flag expected 200, got ${flag.status}: ${summarize(flag.payload)}`);
    assert(flag.payload.ok === true, 'review flag ok flag missing');
    assert(flag.payload.detail.reviewFlags.some((entry) => entry.flagger_id === 'codex-smoke'), 'saved flag missing');

    const detail = await poetics(`/api/item?id=${encodeURIComponent(poeticsFixture.itemId)}&blind=1&labeller=codex-smoke`);
    assert(detail.status === 200, `blind item expected 200, got ${detail.status}: ${summarize(detail.payload)}`);
    assert(detail.payload.label?.form_class === 'recognition', 'blind item did not return own label');
    return { label: detail.payload.label.form_class, reviewFlags: flag.payload.detail.reviewFlags.length };
  });

  await record('US-036', 'Poetics transcript TTS', 'POST /api/tts fails safely with blank server-side Lemon Fox key', async () => {
    const tts = await poetics('/api/tts', {
      method: 'POST',
      body: { text: 'Read this smoke fragment.', role: 'tutor' },
    });
    assert(tts.status === 503, `TTS without key expected 503, got ${tts.status}: ${summarize(tts.payload)}`);
    assert(tts.payload.error === 'LEMONFOX_API_KEY is not configured', 'TTS missing-key error changed');
    assert(!/sk-|key-|secret/i.test(tts.payload.error), 'TTS error appears to expose secret-like material');
    return { status: tts.status, error: tts.payload.error };
  });

  await record('US-037', 'Poetics compose spec workflow', 'Validate, suggest, and write a drama spec without model calls', async () => {
    const spec = {
      drama: {
        id: 'codex-smoke-compose',
        targets: ['peripeteia'],
        topic: 'fractions',
        tutor: { prompt_type: 'recognition', architecture: 'ego_superego' },
        learner: { persona: 'struggling_anxious', architecture: 'ego_superego_recognition_authentic' },
        max_turns: 2,
      },
      cast: { director: 'mock', tutor: 'mock', learner: 'mock', critic: 'mock', default_backend: 'mock' },
      audience: { panel: ['mock'], consensus: '1-of-1', grading: 'binary', blinding: 'arm-blind', rubric: 'poetics-v1' },
      turn_plan: [{ at: { turn: 1 }, role: 'tutor', target: 'peripeteia', moves: ['stock_take'] }],
    };
    const validation = await poetics('/api/compose/validate', { method: 'POST', body: { spec } });
    assert(validation.status === 200, `compose validate expected 200, got ${validation.status}: ${summarize(validation.payload)}`);
    assert(validation.payload.ok === true && validation.payload.validation.ok === true, 'compose validation failed');

    const suggestion = await poetics('/api/compose/suggest', {
      method: 'POST',
      body: { targets: ['peripeteia'], role: 'tutor', architecture: 'ego_superego', seed: 'codex-smoke' },
    });
    assert(suggestion.status === 200, `compose suggest expected 200, got ${suggestion.status}: ${summarize(suggestion.payload)}`);
    assert(Array.isArray(suggestion.payload.turn?.moves), 'compose suggestion missing moves');

    const written = await poetics('/api/compose/write', {
      method: 'POST',
      body: { spec, filename: 'codex-smoke-compose', force: false },
    });
    assert(written.status === 200, `compose write expected 200, got ${written.status}: ${summarize(written.payload)}`);
    assert(written.payload.ok === true, 'compose write ok flag missing');
    assert(written.payload.path.endsWith('codex-smoke-compose.drama.yaml'), 'compose write path mismatch');
    await fs.rm(path.join(ROOT, written.payload.path), { force: true });

    const page = await screenshotPage(`${poeticsBase}/compose`, 'smoke-poetics-compose.png', 'drama composer');
    return { validation: validation.payload.validation.turns, suggestedMoves: suggestion.payload.turn.moves, path: written.payload.path, page };
  });

  await record('US-038', 'Poetics live guided drama session', 'Mock live compose start/advance/score/end flow works without API calls', async () => {
    const start = await poetics('/api/compose/live/start', {
      method: 'POST',
      body: {
        mock: true,
        spec: {
          topic: 'fractions',
          humanRole: 'watch',
          openingSpeaker: 'tutor',
          maxTurns: 2,
          promptType: 'recognition',
          tutorArchitecture: 'ego_superego',
        },
      },
    });
    assert(start.status === 201, `live start expected 201, got ${start.status}: ${summarize(start.payload)}`);
    const sessionId = start.payload.session?.id;
    assert(sessionId, 'live start missing session id');
    assert(start.payload.session.spend.estimatedCostUsd === 0, 'mock live start should report zero spend');

    const advance = await poetics(`/api/compose/live/${encodeURIComponent(sessionId)}/advance`, {
      method: 'POST',
      body: { mock: true },
    });
    assert(advance.status === 200, `live advance expected 200, got ${advance.status}: ${summarize(advance.payload)}`);
    assert(advance.payload.session.turnCount >= 2, 'live advance did not append a turn');

    const score = await poetics(`/api/compose/live/${encodeURIComponent(sessionId)}/score`, {
      method: 'POST',
      body: { mock: true },
    });
    assert(score.status === 200, `live score expected 200, got ${score.status}: ${summarize(score.payload)}`);
    assert(
      score.payload.ok === true && String(score.payload.score?.model || '').startsWith('mock'),
      'live mock score missing',
    );

    const end = await poetics(`/api/compose/live/${encodeURIComponent(sessionId)}/end`, {
      method: 'POST',
      body: { reason: 'smoke' },
    });
    assert(end.status === 200, `live end expected 200, got ${end.status}: ${summarize(end.payload)}`);
    const page = await screenshotPage(`${poeticsBase}/compose/live`, 'smoke-poetics-live-compose.png', 'sit-in');
    return { sessionId, turnCount: end.payload.session.turnCount, score: score.payload.score.weightedOverall, page };
  });

  await record('US-039', 'Poetics reference pages', 'Ontology, rubric, curriculum, and guide pages/APIs render safely', async () => {
    const pages = ['/ontology', '/rubric', '/curriculum', '/curriculum/guide'];
    const apiRoutes = ['/api/ontology', '/api/curriculum'];
    const pageResults = [];
    for (const route of pages) {
      const result = await poetics(route);
      assert(result.status === 200, `${route} expected 200, got ${result.status}: ${summarize(result.payload)}`);
      assert(String(result.payload).trim().length > 0, `${route} returned empty body`);
      pageResults.push({ route, chars: String(result.payload).length });
    }
    for (const route of apiRoutes) {
      const result = await poetics(route);
      assert(result.status === 200, `${route} expected 200, got ${result.status}: ${summarize(result.payload)}`);
      assert(result.payload && typeof result.payload === 'object', `${route} expected JSON object`);
    }
    const ontologyPage = await screenshotPage(`${poeticsBase}/ontology`, 'smoke-poetics-ontology.png');
    const curriculumPage = await screenshotPage(`${poeticsBase}/curriculum`, 'smoke-poetics-curriculum.png');
    return { pages: pageResults, apiRoutes, ontologyPage, curriculumPage };
  });

  await record('US-040', 'Poetics replay bundle browser', 'Replay index/API and missing replay item fail safely', async () => {
    const pageResult = await poetics('/replays');
    assert(pageResult.status === 200, `/replays expected 200, got ${pageResult.status}: ${summarize(pageResult.payload)}`);
    assert(String(pageResult.payload).includes('Replay') || String(pageResult.payload).includes('replay'), '/replays missing replay text');

    const api = await poetics('/api/replays');
    assert(api.status === 200, `/api/replays expected 200, got ${api.status}: ${summarize(api.payload)}`);
    assert(api.payload && typeof api.payload === 'object', '/api/replays expected JSON object');

    const missing = await poetics('/api/replays/codex-smoke-missing');
    assert(missing.status === 404, `missing replay expected 404, got ${missing.status}: ${summarize(missing.payload)}`);
    const page = await screenshotPage(`${poeticsBase}/replays`, 'smoke-poetics-replays.png', 'replay');
    return { apiKeys: Object.keys(api.payload).sort(), missing: missing.status, page };
  });

  await record('US-041', 'Poetics job planning and control', 'Plan, launch, list, get, and stop a free derivation job', async () => {
    const label = `codex-smoke-${Date.now()}`;
    const body = {
      kind: 'derivation',
      params: {
        world: 'world-000-smoke.yaml',
        script: 'nocturne-v002.md',
        label,
        recognition: '1',
        charisma: '1',
      },
    };
    const kinds = await poetics('/api/jobs/kinds');
    assert(kinds.status === 200, `job kinds expected 200, got ${kinds.status}: ${summarize(kinds.payload)}`);
    assert(kinds.payload.kinds.some((kind) => kind.kind === 'derivation'), 'derivation job kind missing');

    const plan = await poetics('/api/jobs/plan', { method: 'POST', body });
    assert(plan.status === 200, `job plan expected 200, got ${plan.status}: ${summarize(plan.payload)}`);
    assert(plan.payload.plan.costClass === 'free', 'derivation mock plan should be free');

    const launched = await poetics('/api/jobs', { method: 'POST', body });
    assert(launched.status === 201, `job launch expected 201, got ${launched.status}: ${summarize(launched.payload)}`);
    const jobId = launched.payload.job?.id;
    assert(jobId, 'launched job missing id');

    const listed = await poetics('/api/jobs');
    assert(listed.status === 200, `job list expected 200, got ${listed.status}: ${summarize(listed.payload)}`);
    assert(listed.payload.jobs.some((job) => job.id === jobId), 'launched job missing from list');

    const detail = await poetics(`/api/jobs/${encodeURIComponent(jobId)}`);
    assert(detail.status === 200, `job detail expected 200, got ${detail.status}: ${summarize(detail.payload)}`);

    const stopped = await poetics(`/api/jobs/${encodeURIComponent(jobId)}/stop`, { method: 'POST' });
    assert(stopped.status === 200, `job stop expected 200, got ${stopped.status}: ${summarize(stopped.payload)}`);
    assert(['stopped', 'done', 'failed'].includes(stopped.payload.job.status), `unexpected stopped status ${stopped.payload.job.status}`);
    if (stopped.payload.job.logFile) await fs.rm(stopped.payload.job.logFile, { force: true });
    await fs.rm(path.join(ROOT, 'exports', 'dramatic-derivation', 'loop', label), { recursive: true, force: true });

    const page = await screenshotPage(`${poeticsBase}/runs`, 'smoke-poetics-runs.png', 'run launcher');
    return { jobId, costClass: plan.payload.plan.costClass, status: stopped.payload.job.status, page };
  });

  await record('US-042', 'Poetics document pages', 'Summary, arc, story, repertoire, and board docs render from techne pages', async () => {
    const routes = ['/summary', '/arc', '/story', '/story-doc', '/repertoire', '/repertoire-doc', '/board', '/board-doc'];
    const checked = [];
    for (const route of routes) {
      const result = await poetics(route);
      assert(result.status === 200, `${route} expected 200, got ${result.status}: ${summarize(result.payload)}`);
      assert(String(result.payload).trim().length > 0, `${route} returned empty body`);
      checked.push({ route, chars: String(result.payload).length });
    }
    const summaryPage = await screenshotPage(`${poeticsBase}/summary`, 'smoke-poetics-summary.png', 'summary');
    const storyPage = await screenshotPage(`${poeticsBase}/story`, 'smoke-poetics-story.png', 'story');
    const boardPage = await screenshotPage(`${poeticsBase}/board`, 'smoke-poetics-board.png', 'board');
    return { checked, summaryPage, storyPage, boardPage };
  });

  await record('US-043', 'Poetics derivation run browser', 'Derivation index/live pages and APIs render safely', async () => {
    const live = await poetics('/api/derivation/live');
    assert(live.status === 200, `derivation live expected 200, got ${live.status}: ${summarize(live.payload)}`);
    assert(Array.isArray(live.payload.runs), 'derivation live payload missing runs array');
    const missing = await poetics('/api/derivation/live/codex-smoke-missing-run');
    assert(missing.status === 404, `missing derivation live expected 404, got ${missing.status}: ${summarize(missing.payload)}`);
    const indexPage = await screenshotPage(`${poeticsBase}/derivation`, 'smoke-poetics-derivation.png', 'proof runs');
    const livePage = await screenshotPage(`${poeticsBase}/derivation/live`, 'smoke-poetics-derivation-live.png', 'live proof runs');
    return { liveRuns: live.payload.runs.length, missing: missing.status, indexPage, livePage };
  });
} finally {
  poeticsServer.child.kill('SIGTERM');
  await waitForExit(poeticsServer.child, 1500);
}

await record('US-044', 'Static explainer comic', 'Load Geist explained pages and exercise comic lightbox', async () => {
  const pages = [
    '/eval/geist-explained.html',
    '/eval/geist-explained-with-comics.html',
    '/eval/geist-explained-with-distributed-comics.html',
  ];
  const responses = [];
  for (const route of pages) {
    const result = await requestUrl(`${BASE_URL}${route}`);
    assert(result.status === 200, `${route} expected 200, got ${result.status}: ${summarize(result.payload)}`);
    assert(String(result.payload).includes('Geist'), `${route} missing Geist page text`);
    responses.push({ route, chars: String(result.payload).length });
  }

  const basePage = await screenshotPage(`${BASE_URL}/eval/geist-explained.html`, 'smoke-geist-explained.png', 'Geist');
  const launchOptions = { headless: true };
  try {
    await fs.access(chromePath);
    launchOptions.executablePath = chromePath;
  } catch {}
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const issues = [];
    page.on('pageerror', (err) => issues.push({ type: 'pageerror', text: err.message }));
    const response = await page.goto(`${BASE_URL}/eval/geist-explained.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    assert(response?.status() === 200, `comic page expected 200, got ${response?.status()}`);
    await page.locator('.comic[data-open-panel]').first().click({ timeout: 5000 });
    await page.waitForSelector('.lightbox.is-open', { timeout: 5000 });
    const caption = await page.locator('#lightboxCaption').innerText({ timeout: 5000 });
    const screenshotPath = path.join(outDir, 'smoke-geist-explained-lightbox.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    artifacts.push(screenshotPath);
    assert(caption.trim().length > 0, 'lightbox caption should be populated');
    assert(!issues.some((issue) => issue.type === 'pageerror'), `comic page errors ${summarize(issues)}`);
    return { responses, basePage, lightboxCaptionChars: caption.length, lightboxScreenshot: screenshotPath };
  } finally {
    await browser.close();
  }
});

await record('US-045', 'Static interactive explainer', 'Load Geist in the Machine and exercise interactive controls', async () => {
  const basePage = await screenshotPage(`${BASE_URL}/eval/geist-in-the-machine.html`, 'smoke-geist-in-the-machine.png', 'Geist');
  const launchOptions = { headless: true };
  try {
    await fs.access(chromePath);
    launchOptions.executablePath = chromePath;
  } catch {}
  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      permissions: ['clipboard-write'],
    });
    const page = await context.newPage();
    const issues = [];
    page.on('pageerror', (err) => issues.push({ type: 'pageerror', text: err.message }));
    const response = await page.goto(`${BASE_URL}/eval/geist-in-the-machine.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    assert(response?.status() === 200, `interactive page expected 200, got ${response?.status()}`);

    const within = page.locator('.simpson__toggle button[data-mode="within"]');
    await within.click({ timeout: 5000 });
    assert((await within.getAttribute('aria-pressed')) === 'true', 'within-cell Simpson toggle did not become active');

    await page.locator('.analyser__sample[data-sample="recog"]').click({ timeout: 5000 });
    const analyserValue = await page.locator('#analyserInput').inputValue({ timeout: 5000 });
    assert(analyserValue.includes('intuition'), 'analyser recognition sample did not populate textarea');
    const questionRate = await page.locator('#featVal-qrate').innerText({ timeout: 5000 });
    assert(questionRate !== '—' && questionRate !== '0', 'analyser output did not update');

    const copyButtons = page.locator('.cite-block__copy');
    const copyCount = await copyButtons.count();
    assert(copyCount >= 3, `expected at least 3 citation copy buttons, got ${copyCount}`);
    await copyButtons.first().click({ timeout: 5000 });
    await page.waitForTimeout(150);
    const copied = await copyButtons.first().evaluate((button) => button.classList.contains('copied'));
    const selectedText = await page.evaluate(() => String(window.getSelection()?.toString() || ''));
    assert(copied || selectedText.includes('@unpublished'), 'citation copy fallback did not write or select citation text');

    const screenshotPath = path.join(outDir, 'smoke-geist-in-the-machine-interactions.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    artifacts.push(screenshotPath);
    assert(!issues.some((issue) => issue.type === 'pageerror'), `interactive page errors ${summarize(issues)}`);
    await context.close();
    return { basePage, copyCount, questionRate, interactionScreenshot: screenshotPath };
  } finally {
    await browser.close();
  }
});

await record('US-046', 'Evaluation CLI', 'eval-cli --help/list command exits and prints configured cells/scenarios', async () => {
  const { stdout } = runCommand('node', ['scripts/eval-cli.js', '--help'], { timeout: 15000 });
  assert(stdout.includes('Scenarios:'), 'eval-cli output missing Scenarios section');
  assert(stdout.includes('cell_1_base_single_unified'), 'eval-cli output missing known cell');
  return { stdoutChars: stdout.length, includesCell1: true };
});

await record('US-047', 'Analysis script suite', 'analyze-eval-results --help exits and prints options', async () => {
  const { stdout } = runCommand('node', ['scripts/analyze-eval-results.js', '--help'], { timeout: 10000 });
  assert(stdout.includes('Statistical Analysis for Evaluation Results'), 'analysis help missing title');
  assert(stdout.includes('--run-id'), 'analysis help missing run-id option');
  return { stdoutChars: stdout.length, command: 'node scripts/analyze-eval-results.js --help' };
});

await record('US-048', 'Paper validation and build tooling', 'paper:provable-discourse:smoke passes without full PDF build', async () => {
  const { stdout } = runCommand('npm', ['run', 'paper:provable-discourse:smoke'], { timeout: 30000 });
  assert(stdout.includes('Summary:'), 'paper smoke output missing summary');
  assert(stdout.includes('0 fail'), 'paper smoke did not report zero failures');
  return { command: 'npm run paper:provable-discourse:smoke', summarySeen: true };
});

await record('US-049', 'Dramatic derivation CLI tools', 'derivation:test passes bounded mock/fixture suite', async () => {
  const { stdout } = runCommand('npm', ['run', 'derivation:test'], { timeout: 30000 });
  assert(stdout.includes('# pass 66'), 'derivation:test did not report 66 passing tests');
  assert(stdout.includes('# fail 0'), 'derivation:test did not report zero failures');
  return { command: 'npm run derivation:test', passCount: 66 };
});

await record('US-050', 'Poetics CLI tools', 'poetics report and browser help run without paid calls', async () => {
  const reportJson = path.join(ROOT, '.codex-tmp', 'feature-tracker', 'poetics-report.json');
  const report = runCommand(
    'node',
    [
      'scripts/report-poetics-sidecar.js',
      '--db',
      '.codex-tmp/feature-tracker/smoke-data/evaluations.db',
      '--no-markdown',
      '--no-csv',
      '--json',
      reportJson,
    ],
    { timeout: 15000 },
  );
  assert(report.stdout.includes('poetics report:'), 'poetics report output missing summary');
  const reportPayload = JSON.parse(await fs.readFile(reportJson, 'utf8'));
  assert(Array.isArray(reportPayload.runs), 'poetics report JSON missing runs array');
  assert(Array.isArray(reportPayload.rows), 'poetics report JSON missing rows array');

  const browserHelp = runCommand('node', ['scripts/browse-poetics-scripts.js', '--help'], { timeout: 10000 });
  assert(browserHelp.stdout.includes('Usage:'), 'poetics browser help missing Usage');
  assert(browserHelp.stdout.includes('--no-open'), 'poetics browser help missing --no-open');
  return {
    reportRuns: reportPayload.runs.length,
    reportRows: reportPayload.rows.length,
    browserHelp: true,
  };
});

await record('US-051', 'A19/A19R adjudication tooling', 'A19/A19R validators and human-coder CLI help run offline', async () => {
  const a19 = runCommand('node', ['scripts/validate-teaching-drama-axiom-protocol.js', '--json'], { timeout: 15000 });
  const a19Payload = JSON.parse(a19.stdout);
  assert(a19Payload.status === 'pass', `A19 validator expected pass, got ${a19Payload.status}`);
  assert(a19Payload.provenance?.zero_api === true, 'A19 validator should report zero_api provenance');

  const a19r = runCommand('node', ['scripts/a19r-mini-drama.js', 'codebook-validate', '--json'], { timeout: 15000 });
  const a19rPayload = JSON.parse(a19r.stdout);
  assert(a19rPayload.status === 'pass', `A19R codebook expected pass, got ${a19rPayload.status}`);

  const humanCoderHelp = runCommand('node', ['scripts/validate-a19-human-coder-file.js', '--help'], { timeout: 10000 });
  assert(humanCoderHelp.stdout.includes('Offline only'), 'human coder validator help missing offline-only note');
  return {
    a19Families: a19Payload.summary?.families,
    a19rCodebook: a19rPayload.codebook_id,
    humanCoderHelp: true,
  };
});

await record('US-052', 'Content validation', 'content package and scenario references validate', async () => {
  const content = runCommand('npm', ['run', 'content:validate'], { timeout: 15000 });
  assert(content.stdout.includes('Validation PASSED'), 'content package validation did not pass');
  const scenarios = runCommand('node', ['scripts/validate-content.js', '--scenarios'], { timeout: 15000 });
  assert(scenarios.stdout.includes('0 failed'), 'scenario content refs did not all resolve');
  return { packageValidation: true, scenarioRefs: '0 failed' };
});

await record('US-054', 'Shared design system assets', 'GET /components/techne.css contains tokenized stylesheet', async () => {
  const { status, payload } = await request('/components/techne.css');
  assert(status === 200, `expected 200, got ${status}`);
  assert(String(payload).includes('--paper') || String(payload).includes('--ink'), 'stylesheet missing expected design tokens');
  return 'techne.css served with design tokens';
});

await record('US-054', 'Browser pages render without top-level page errors', 'Playwright loads core pages and captures console/page errors', async () => {
  const launchOptions = { headless: true };
  try {
    await fs.access(chromePath);
    launchOptions.executablePath = chromePath;
  } catch {}
  const browser = await chromium.launch(launchOptions);
  const pageResults = [];
  try {
    for (const route of ['/', '/chat', '/pilot', '/pilot-admin', '/adjudication']) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
      const issues = [];
      page.on('pageerror', (err) => issues.push({ type: 'pageerror', text: err.message }));
      page.on('console', (msg) => {
        if (['error', 'warning'].includes(msg.type())) {
          issues.push({ type: msg.type(), text: msg.text() });
        }
      });
      const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(route === '/chat' ? 3000 : 1000);
      const title = await page.title();
      const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      const screenshotPath = path.join(outDir, `smoke-${route === '/' ? 'root' : route.slice(1)}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      artifacts.push(screenshotPath);
      pageResults.push({ route, status: response?.status(), title, bodyChars: text.length, issues });
      assert(response?.status() === 200, `${route}: expected 200, got ${response?.status()}`);
      assert(text.trim().length > 0, `${route}: empty body text`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  const pageErrors = pageResults.flatMap((p) =>
    p.issues.filter((i) => i.type === 'pageerror').map((i) => `${p.route}: ${i.text}`),
  );
  assert(pageErrors.length === 0, `page errors observed: ${pageErrors.join('; ')}`);
  return pageResults;
});

await record('US-053', 'Hermetic test suite', 'npm run test:hermetic passes against isolated DB/log paths', async () => {
  const { stdout } = runCommand('npm', ['run', 'test:hermetic'], { timeout: 60000 });
  const passMatch = stdout.match(/^# pass (\d+)/m);
  assert(passMatch, 'hermetic test output did not report a pass count');
  assert(stdout.includes('# fail 0'), 'hermetic test output did not report zero failures');
  return { command: 'npm run test:hermetic', passCount: Number(passMatch[1]), failCount: 0 };
});

const summary = {
  baseUrl: BASE_URL,
  generatedAt: new Date().toISOString(),
  total: results.length,
  passed: results.filter((r) => r.testStatus === 'Passed').length,
  failed: results.filter((r) => r.testStatus === 'Failed').length,
  blocked: results.filter((r) => r.testStatus === 'Blocked').length,
  artifacts,
};

await fs.writeFile(outPath, JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (summary.failed > 0) process.exitCode = 1;

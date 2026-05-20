/**
 * Browser-level user-flow smoke for public/chat/index.html.
 *
 * This intentionally serves the static chat UI against a tiny mocked
 * /api/chat surface instead of importing server.js. Importing server.js also
 * imports pilotStore, which depends on better-sqlite3 and can fail before UI
 * assertions run when node_modules was built for a different Node ABI.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  const fromPath = spawnSync(
    'sh',
    ['-lc', 'command -v google-chrome || command -v chromium || command -v chromium-browser || true'],
    { encoding: 'utf8' },
  ).stdout.trim();
  return fromPath || null;
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function text(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type });
  res.end(body);
}

function mockCell(features = {}) {
  const recognition = features.approach === 'recognition';
  const reflective = features.learnerModel === 'reflective';
  const hasSuperego = features.critic && features.critic !== 'none';
  return {
    name: recognition ? 'cell_5_recog_single_unified' : 'cell_1_base_single_unified',
    description: recognition ? 'Recognition mock cell' : 'Base mock cell',
    promptType: recognition ? 'recognition' : 'base',
    multiAgentTutor: hasSuperego,
    multiAgentLearner: reflective,
    learnerArchitecture: reflective ? 'ego_superego_unified' : 'unified',
    recognitionMode: recognition,
    dialogueEnabled: hasSuperego,
    maxRounds: hasSuperego ? 2 : 0,
    idDirector: false,
    charismaTarget: false,
    witnessExemplars: false,
    registerClassifier: false,
    idTuning: null,
    charismaProfile: null,
    ego: { provider: 'mock', model: 'ego', promptFile: 'tutor-ego.md' },
    superego: hasSuperego ? { provider: 'mock', model: 'superego', promptFile: 'tutor-superego.md' } : null,
    orientation: {
      promptType: recognition ? 'recognition' : 'base',
      family: recognition ? 'intersubjective' : 'transmission',
      subfamily: recognition ? 'hegelian_recognition' : 'generic_pedagogy',
      effectiveFamily: recognition ? 'intersubjective' : 'transmission',
      effectiveSubfamily: recognition ? 'hegelian_recognition' : 'generic_pedagogy',
      shortLabel: recognition ? 'Recognition' : 'Base',
      lineage: recognition ? 'recognition' : 'base',
      viewOfLearner: recognition ? 'Co-author of meaning' : 'Information recipient',
      roleOfTutor: recognition ? 'Stage mutual recognition' : 'Provide clear instruction',
      keyMechanism: recognition ? 'Reciprocal acknowledgement' : 'Content delivery',
      vocabulary: recognition ? ['recognition', 'mutuality'] : ['clarity', 'instruction'],
      approxLengthWords: 100,
      effectVsBase: recognition ? 0.72 : 0,
      note: null,
    },
    score: 11,
    matches: [],
  };
}

async function startMockChatServer() {
  const indexHtml = await readFile(path.join(repoRoot, 'public/chat/index.html'), 'utf8');
  const helperJs = await readFile(path.join(repoRoot, 'public/chat/orientation-helpers.js'), 'utf8');
  const resolveBodies = [];
  const cells = [
    mockCell({ approach: 'standard', critic: 'none', learnerModel: 'surface' }),
    mockCell({ approach: 'recognition', critic: 'none', learnerModel: 'surface' }),
  ];

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && (url.pathname === '/chat/' || url.pathname === '/chat/index.html')) {
      text(res, 200, indexHtml, 'text/html; charset=utf-8');
      return;
    }
    if (req.method === 'GET' && url.pathname === '/chat/orientation-helpers.js') {
      text(res, 200, helperJs, 'text/javascript; charset=utf-8');
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/chat/cells') {
      json(res, 200, { count: cells.length, cells, orientations: {} });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/chat/personas') {
      json(res, 200, { personas: [{ id: 'eager_novice', name: 'Eager novice', hint: 'curious' }] });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/chat/curricula') {
      json(res, 200, { packages: [] });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/chat/resolve') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        const parsed = body ? JSON.parse(body) : {};
        resolveBodies.push(parsed);
        const resolved = mockCell(parsed);
        json(res, 200, {
          features: parsed,
          target: {},
          maxScore: 11,
          matchQuality: 'exact',
          resolved,
          alternatives: [],
        });
      });
      return;
    }
    text(res, 404, 'not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    resolveBodies,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function waitForJson(url, init, tries = 80) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return await res.json();
    } catch {
      // Retry until the browser debugging endpoint is up.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function openChrome(chromePath) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/ms-chat-ui-user-flow-${process.pid}-${Date.now()}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const version = await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const target = await waitForJson(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }, 20);
  const ws = new WebSocket(target.webSocketDebuggerUrl || version.webSocketDebuggerUrl);
  await once(ws, 'open');

  let id = 0;
  const pending = new Map();
  const runtimeProblems = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      runtimeProblems.push(msg.params.exceptionDetails.text || 'runtime exception');
    }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      runtimeProblems.push((msg.params.args || []).map((a) => a.value || a.description).join(' '));
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result || {});
    }
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  return {
    proc,
    runtimeProblems,
    send,
    close() {
      ws.close();
      proc.kill('SIGTERM');
      setTimeout(() => proc.kill('SIGKILL'), 1000).unref();
    },
  };
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

async function waitFor(send, expression, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await evaluate(send, expression);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return null;
}

async function waitUntil(predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

async function click(send, selector) {
  const ok = await evaluate(send, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.click();
    return true;
  })()`);
  assert.equal(ok, true, `missing clickable selector: ${selector}`);
}

test('chat guided setup supports a wizard-like user flow on mobile', async (t) => {
  const chromePath = findChrome();
  if (!chromePath) {
    t.skip('Chrome/Chromium not available for browser user-flow test');
    return;
  }

  const server = await startMockChatServer();
  const browser = await openChrome(chromePath);

  try {
    await browser.send('Page.enable');
    await browser.send('Runtime.enable');
    await browser.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await browser.send('Page.navigate', { url: `${server.baseUrl}/chat/` });

    const ready = await waitFor(browser.send, `!!document.querySelector('[data-testid="guided-setup"]')`);
    if (!ready) {
      const alpineMissing = await evaluate(browser.send, `typeof window.Alpine === 'undefined'`);
      if (alpineMissing) {
        t.skip('Alpine CDN unavailable; skipping browser user-flow test');
        return;
      }
      assert.ok(ready, 'guided setup should render');
    }

    await click(browser.send, '[data-testid="wizard-step-tutor"]');
    await click(browser.send, '[data-testid="wizard-choice-approach-recognition"]');
    await waitFor(browser.send, `document.querySelector('.manifest__name')?.textContent.includes('cell_5_recog')`);

    await click(browser.send, '[data-testid="wizard-step-critic"]');
    await click(browser.send, '[data-testid="wizard-choice-critic-dialectical"]');
    const stanceVisible = await waitFor(browser.send, `(() => {
      const el = document.querySelector('[data-testid="wizard-stance-options"]');
      return el && getComputedStyle(el).display !== 'none';
    })()`);
    assert.ok(stanceVisible, 'dialectical critic should reveal stance choices');
    await click(browser.send, '[data-testid="wizard-choice-stance-advocate"]');

    await click(browser.send, '[data-testid="wizard-step-seat"]');
    await click(browser.send, '[data-testid="wizard-choice-mode-auto"]');
    await click(browser.send, '[data-testid="wizard-choice-mode-human"]');
    await click(browser.send, '[data-testid="wizard-choice-learner-reflective"]');
    const resolvedReflective = await waitUntil(() => {
      const last = server.resolveBodies.at(-1);
      return last?.stance === 'advocate' && last?.learnerModel === 'reflective';
    });
    assert.ok(resolvedReflective, 'wizard choices should resolve after stance and learner changes');
    await click(browser.send, '[data-testid="wizard-finish"]');

    await click(browser.send, '.starter-prompts button');
    const state = await evaluate(browser.send, `(() => ({
      input: document.querySelector('.composer textarea')?.value || '',
      activeTag: document.activeElement?.tagName || '',
      step: document.querySelector('[data-testid="guided-setup"]')?.dataset.step || '',
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      innerWidth,
    }))()`);

    assert.match(state.input, /recognition/i);
    assert.equal(state.activeTag, 'TEXTAREA');
    assert.equal(state.step, 'seat');
    assert.ok(
      state.docScrollWidth <= state.docClientWidth + 1,
      `document should not horizontally overflow: ${state.docScrollWidth} > ${state.docClientWidth}`,
    );
    assert.ok(
      state.bodyScrollWidth <= state.innerWidth + 12,
      `body overflow should stay within decorative tolerance: ${state.bodyScrollWidth} > ${state.innerWidth}`,
    );
    assert.deepEqual(
      server.resolveBodies.at(-1),
      {
        approach: 'recognition',
        critic: 'dialectical',
        stance: 'advocate',
        learnerModel: 'reflective',
        charismaVariant: 'generalist',
      },
    );
    assert.deepEqual(browser.runtimeProblems, []);
  } finally {
    browser.close();
    await server.close();
  }
});

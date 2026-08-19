import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright-core';

import {
  TUTOR_STUB_SURFACE_ACCEPTANCE_SCHEMA,
  assertTutorStubSurfaceAcceptanceContract,
} from '../services/tutorStubSurfaceAcceptanceContract.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const COMPLETED_REPLY = 'Acceptance tutor reply: compare the two public marks.';
const DELAY_MARKER = 'ACCEPTANCE_DELAY';
const DELAYED_REPLY = 'ACCEPTANCE_DELAYED_TUTOR_RESULT';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function evaluate(page, expression) {
  return page.evaluate(expression);
}

async function waitFor(page, expression, label, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(page, expression)) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`${label} did not become true${lastError ? `: ${lastError.message}` : ''}`);
}

async function waitForFileText(filePath, expectedText, label, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8').includes(expectedText)) return;
    await sleep(50);
  }
  throw new Error(`${label} did not appear in ${path.basename(filePath)}`);
}

async function dispatchKey(page, { key, modifiers = 0 }) {
  await page.keyboard.press(modifiers === 2 ? `Control+${key}` : key);
}

async function keyboardActivate(page, id) {
  const selector = JSON.stringify(`#${id}`);
  const focused = await evaluate(
    page,
    `(() => { const control = document.querySelector(${selector}); if (!control) throw new Error('missing ${id}'); control.focus(); return document.activeElement === control; })()`,
  );
  if (!focused) throw new Error(`could not keyboard-focus ${id}`);
  await dispatchKey(page, { key: 'Enter' });
}

async function keyboardSendMessage(page, text) {
  const value = JSON.stringify(text);
  const focused = await evaluate(
    page,
    `(() => {
      const input = document.querySelector('#message-input');
      input.value = ${value};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      return document.activeElement === input;
    })()`,
  );
  if (!focused) throw new Error('could not keyboard-focus message input');
  await dispatchKey(page, { key: 'Enter', modifiers: 2 });
}

async function keyboardEscape(page) {
  await dispatchKey(page, { key: 'Escape' });
}

async function selectSafeFixture(page, { resume = '' } = {}) {
  const resumeValue = JSON.stringify(resume);
  await evaluate(
    page,
    `(() => {
      const set = (id, value) => {
        const control = document.querySelector('#' + id);
        if (!control || !Array.from(control.options || []).some((option) => option.value === value && !option.disabled)) {
          throw new Error('fixture option unavailable: ' + id + '=' + value);
        }
        control.value = value;
        control.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('lab-select', 'pure_chat');
      set('world-select', 'none');
      set('model-select', 'codex.gpt-5.6-terra');
      document.querySelector('#resume-input').value = ${resumeValue};
      return true;
    })()`,
  );
}

function latestTraceRunId(traceRootPath) {
  if (!fs.existsSync(traceRootPath)) return null;
  const candidates = [];
  for (const entry of fs.readdirSync(traceRootPath, { withFileTypes: true })) {
    const directory = path.join(traceRootPath, entry.name);
    if (!entry.isDirectory()) continue;
    for (const file of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.jsonl')) continue;
      const filePath = path.join(directory, file.name);
      candidates.push({ runId: path.basename(file.name, '.jsonl'), mtimeMs: fs.statSync(filePath).mtimeMs });
    }
  }
  return candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.runId || null;
}

async function waitForTraceRunId(traceRootPath, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const runId = latestTraceRunId(traceRootPath);
    if (runId) return runId;
    await sleep(50);
  }
  throw new Error('finalized tutor session did not produce a resumable trace');
}

async function requestJson(baseUrl, pathname, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(new URL(pathname, baseUrl), {
    method,
    headers: {
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, payload, headers: Object.fromEntries(response.headers) };
}

function downloadTo(page, targetPath) {
  return withTimeout(
    page.waitForEvent('download').then(async (download) => {
      await download.saveAs(targetPath);
      return targetPath;
    }),
    DEFAULT_TIMEOUT_MS,
    'public trace download',
  );
}

async function writeScreenshot(page, filePath) {
  if (!page || page.isClosed()) return;
  await page.screenshot({ path: filePath, fullPage: true });
}

export async function runTutorStubSurfaceAcceptance({
  baseUrl,
  hostKind,
  artifactDir,
  expectedContract,
  httpHeaders = {},
  authRequired = false,
  credentialCanary,
  privatePromptCanary,
  providerEventPath,
  traceRootPath,
} = {}) {
  if (!baseUrl) throw new Error('tutor-stub surface acceptance requires baseUrl');
  if (!providerEventPath) throw new Error('tutor-stub surface acceptance requires providerEventPath');
  if (!traceRootPath) throw new Error('tutor-stub surface acceptance requires traceRootPath');
  if (hostKind !== 'web') {
    throw new Error(`unsupported tutor-stub surface acceptance host: ${hostKind || 'missing'}`);
  }
  fs.mkdirSync(artifactDir, { recursive: true });
  const trace = [];
  const record = (action, details = {}) => trace.push({ at: new Date().toISOString(), action, ...details });
  const consoleEvents = [];
  const launchOptions = process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : { channel: process.env.PLAYWRIGHT_CHROME_CHANNEL || 'chrome' };
  const browser = await chromium.launch({ ...launchOptions, headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.on('console', (message) => consoleEvents.push(message.text()));
  page.on('requestfailed', (request) => {
    record('request-failed', { url: request.url(), error: request.failure()?.errorText || 'unknown' });
  });

  try {
    const tutorUrl = new URL('/tutor', baseUrl).toString();
    await withTimeout(
      page.goto(tutorUrl, { waitUntil: 'domcontentloaded' }),
      DEFAULT_TIMEOUT_MS,
      'load shared tutor surface',
    );
    await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
    record('media-emulation-ready');
    await waitFor(
      page,
      `document.querySelector('#app-status')?.textContent.includes('Ready.')`,
      'tutor catalogue readiness',
    );
    record('surface-ready', { url: tutorUrl });

    const accessibility = await evaluate(
      page,
      `(() => {
        const status = document.querySelector('#app-status');
        const transcript = document.querySelector('#transcript');
        const message = document.querySelector('#message-input');
        const label = document.querySelector('label[for="message-input"]');
        return {
          title: document.title,
          path: location.pathname,
          sharedShell: Boolean(document.querySelector('script[src="./app.js"]') && document.querySelector('link[href="/components/techne.css"]')),
          statusRole: status?.getAttribute('role') || '',
          statusLive: status?.getAttribute('aria-live') || '',
          transcriptRole: transcript?.getAttribute('role') || '',
          transcriptLabel: transcript?.getAttribute('aria-label') || '',
          messageInputName: (label?.textContent || '').trim(),
          keyboardHint: /Enter sends/u.test(document.querySelector('.keyboard-hint')?.textContent || ''),
          textFallback: /Text input is ready/u.test(document.querySelector('#mic-status')?.textContent || '') && document.querySelector('#talk-button')?.disabled === true,
          reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          forcedColors: matchMedia('(forced-colors: active)').matches,
        };
      })()`,
    );

    const rendererCsp = await evaluate(
      page,
      `fetch(location.href).then((response) => response.headers.get('content-security-policy') || '')`,
    );
    const authenticatedPage = await fetch(tutorUrl, { headers: httpHeaders });
    const csp = rendererCsp || authenticatedPage.headers.get('content-security-policy') || '';
    await authenticatedPage.arrayBuffer();
    const unauthenticated = await fetch(new URL('/api/tutor-stub/sessions', baseUrl));
    await unauthenticated.arrayBuffer();
    const foreign = await requestJson(baseUrl, '/api/tutor-stub/sessions', {
      method: 'POST',
      headers: { ...httpHeaders, origin: 'https://foreign.example' },
      body: { id: 'cross-origin-must-not-start' },
    });
    record('boundaries-checked', {
      cspPresent: Boolean(csp),
      unauthenticatedStatus: unauthenticated.status,
      crossOriginStatus: foreign.status,
    });

    await selectSafeFixture(page);
    await keyboardActivate(page, 'start-button');
    await waitFor(page, `document.querySelector('#session-panel')?.hidden === false`, 'session creation');
    const firstSessionId = await evaluate(
      page,
      `document.querySelector('#session-meta').textContent.split(' · ')[0].trim()`,
    );
    const created = await requestJson(baseUrl, `/api/tutor-stub/sessions/${encodeURIComponent(firstSessionId)}`, {
      headers: httpHeaders,
    });
    if (created.status !== 200 || created.payload?.session?.capabilitySnapshot?.mode !== 'passthrough') {
      throw new Error(`unexpected created session projection: ${JSON.stringify(created.payload)}`);
    }
    record('session-created', { sessionId: firstSessionId });

    await keyboardSendMessage(page, 'Can we compare the public assay marks?');
    await waitFor(
      page,
      `document.querySelector('#app-status')?.textContent === 'Tutor response complete.' && document.querySelector('#transcript')?.textContent.includes(${JSON.stringify(COMPLETED_REPLY)})`,
      'keyboard learner turn',
    );
    const afterTurn = await requestJson(baseUrl, `/api/tutor-stub/sessions/${encodeURIComponent(firstSessionId)}`, {
      headers: httpHeaders,
    });
    if (
      afterTurn.payload?.session?.state?.turnCount !== 1 ||
      afterTurn.payload?.session?.state?.publicMessageCount !== 2
    ) {
      throw new Error(`unexpected completed turn projection: ${JSON.stringify(afterTurn.payload)}`);
    }
    record('learner-turn-completed');

    await withTimeout(page.reload(), DEFAULT_TIMEOUT_MS, 'reload tutor surface');
    await waitFor(
      page,
      `document.querySelector('#app-status')?.textContent === 'Session reconnected from its public projection.'`,
      'session reconnection',
    );
    const reconnectedId = await evaluate(
      page,
      `document.querySelector('#session-meta').textContent.split(' · ')[0].trim()`,
    );
    if (reconnectedId !== firstSessionId) throw new Error('page reload reconnected to a different session');
    record('session-reconnected');

    await keyboardSendMessage(page, '/status');
    await waitFor(
      page,
      `document.querySelector('#app-status')?.textContent === '/status complete.' && document.querySelector('#transcript')?.textContent.includes('session status >') && document.querySelector('#transcript')?.textContent.includes('speaker model:')`,
      'HTTP status command',
    );
    const statusCommandOutput = await evaluate(page, `document.querySelector('#transcript')?.textContent || ''`);
    const statusCommandPlain = !statusCommandOutput.includes('\u001b') && !statusCommandOutput.includes('\r');
    record('status-command-completed', { plainText: statusCommandPlain });

    await keyboardSendMessage(page, '/help');
    await waitFor(
      page,
      `document.querySelector('#app-status')?.textContent === '/help complete.' && document.querySelector('#transcript')?.textContent.includes('passthrough commands')`,
      'HTTP help command',
    );
    const helpCommandOutput = await evaluate(page, `document.querySelector('#transcript')?.textContent || ''`);
    const helpCommandPlain = !helpCommandOutput.includes('\u001b') && !helpCommandOutput.includes('\r');
    record('help-command-completed', { plainText: helpCommandPlain });

    await keyboardSendMessage(page, '/settings');
    await waitFor(
      page,
      `document.querySelector('#app-status')?.textContent.startsWith('Command failed:')`,
      'terminal-only command rejection',
    );
    const terminalCommand = await requestJson(
      baseUrl,
      `/api/tutor-stub/sessions/${encodeURIComponent(firstSessionId)}/steps`,
      {
        method: 'POST',
        headers: httpHeaders,
        body: { input: '/settings', kind: 'command', context: { source: 'acceptance_probe' } },
      },
    );
    record('terminal-command-rejected', {
      status: terminalCommand.status,
      code: terminalCommand.payload?.error?.code || null,
    });

    const publicExportPath = path.join(artifactDir, 'public-session.json');
    const publicDownload = downloadTo(page, publicExportPath);
    await keyboardActivate(page, 'export-button');
    await publicDownload;
    const publicExportText = fs.readFileSync(publicExportPath, 'utf8');
    const publicExport = JSON.parse(publicExportText);
    record('public-trace-exported', { file: path.basename(publicExportPath) });

    await keyboardActivate(page, 'end-button');
    await waitFor(
      page,
      `document.querySelector('#app-status')?.textContent === 'Session ended. You can start another safe lab.'`,
      'source session finalization',
    );
    const resumeRunId = await waitForTraceRunId(traceRootPath);
    await selectSafeFixture(page, { resume: resumeRunId });
    await keyboardActivate(page, 'start-button');
    await waitFor(page, `document.querySelector('#session-panel')?.hidden === false`, 'saved trace resume');
    const resumedSessionId = await evaluate(
      page,
      `document.querySelector('#session-meta').textContent.split(' · ')[0].trim()`,
    );
    const resumed = await requestJson(baseUrl, `/api/tutor-stub/sessions/${encodeURIComponent(resumedSessionId)}`, {
      headers: httpHeaders,
    });
    if (
      resumedSessionId === firstSessionId ||
      resumed.payload?.session?.state?.turnCount !== 1 ||
      !JSON.stringify(resumed.payload?.session?.state?.publicMessages || []).includes(COMPLETED_REPLY)
    ) {
      throw new Error(`unexpected saved trace resume projection: ${JSON.stringify(resumed.payload)}`);
    }
    record('saved-trace-resumed', { runId: resumeRunId });

    await keyboardActivate(page, 'reset-button');
    await waitFor(
      page,
      `document.querySelector('#app-status')?.textContent === 'Dialogue reset. The same lab and session controls remain active.'`,
      'dialogue reset',
    );
    const reset = await requestJson(baseUrl, `/api/tutor-stub/sessions/${encodeURIComponent(resumedSessionId)}`, {
      headers: httpHeaders,
    });
    if (
      reset.payload?.session?.state?.turnCount !== 0 ||
      reset.payload?.session?.state?.publicMessageCount !== 0 ||
      reset.payload?.session?.counters?.resets !== 1
    ) {
      throw new Error(`unexpected reset projection: ${JSON.stringify(reset.payload)}`);
    }
    record('dialogue-reset');

    await keyboardSendMessage(page, `${DELAY_MARKER} hold this reply until interrupted.`);
    await waitFor(page, `document.querySelector('#stop-button')?.disabled === false`, 'interrupt control');
    await waitForFileText(providerEventPath, '"requestId":"delayed-turn"', 'delayed provider request');
    await keyboardEscape(page);
    await waitFor(
      page,
      `document.querySelector('#setup-panel')?.hidden === false && document.querySelector('#app-status')?.textContent.startsWith('Session stopped.')`,
      'keyboard interruption',
    );
    await sleep(1_250);
    const afterInterrupt = await requestJson(baseUrl, '/api/tutor-stub/sessions', { headers: httpHeaders });
    const lateResultAbsent = await evaluate(
      page,
      `!document.documentElement.textContent.includes(${JSON.stringify(DELAYED_REPLY)})`,
    );
    if (afterInterrupt.payload?.count !== 0 || !lateResultAbsent) {
      throw new Error('interrupted session remained live or rendered a late tutor result');
    }
    record('session-interrupted');

    await selectSafeFixture(page);
    await keyboardActivate(page, 'start-button');
    await waitFor(page, `document.querySelector('#session-panel')?.hidden === false`, 'fresh session creation');
    const freshSessionId = await evaluate(
      page,
      `document.querySelector('#session-meta').textContent.split(' · ')[0].trim()`,
    );
    if (!freshSessionId || [firstSessionId, resumedSessionId].includes(freshSessionId)) {
      throw new Error('fresh session id was not fresh');
    }
    await keyboardActivate(page, 'end-button');
    await waitFor(
      page,
      `document.querySelector('#app-status')?.textContent === 'Session ended. You can start another safe lab.'`,
      'fresh session finalization',
    );
    const afterFinalize = await requestJson(baseUrl, '/api/tutor-stub/sessions', { headers: httpHeaders });
    if (afterFinalize.payload?.count !== 0) throw new Error('finalized session remained in the host registry');
    record('fresh-session-finalized');

    const browserText = await evaluate(
      page,
      `JSON.stringify({ html: document.documentElement.outerHTML, localStorage: { ...localStorage }, sessionStorage: { ...sessionStorage } })`,
    );
    const credentialCanaryAbsent =
      !browserText.includes(credentialCanary) && !publicExportText.includes(credentialCanary);
    const privatePromptCanaryAbsent =
      !browserText.includes(privatePromptCanary) && !publicExportText.includes(privatePromptCanary);
    const privacy = publicExport.privacy || {};

    const contract = {
      surface: {
        path: accessibility.path.replace(/\/$/u, '') || '/',
        title: accessibility.title,
        sharedShell: accessibility.sharedShell,
        sessionMode: created.payload.session.capabilitySnapshot.mode,
      },
      lifecycle: {
        created: created.status === 200,
        reconnected: reconnectedId === firstSessionId,
        savedTraceResumed: resumed.payload.session.state.turnCount === 1,
        learnerTurnCompleted: afterTurn.payload.session.state.turnCount === 1,
        statusCommandCompleted:
          statusCommandOutput.includes('session status >') && statusCommandOutput.includes('speaker model:'),
        helpCommandCompleted: helpCommandOutput.includes('passthrough commands'),
        terminalCommandRejected: terminalCommand.status === 409,
        publicTraceExported: fs.existsSync(publicExportPath),
        reset: reset.payload.session.counters.resets === 1,
        interrupted: afterInterrupt.payload.count === 0,
        lateResultSuppressed: lateResultAbsent,
        freshSessionFinalized: afterFinalize.payload.count === 0,
      },
      accessibility: {
        statusRole: accessibility.statusRole,
        statusLive: accessibility.statusLive,
        transcriptRole: accessibility.transcriptRole,
        transcriptLabel: accessibility.transcriptLabel,
        messageInputName: accessibility.messageInputName,
        keyboardHint: accessibility.keyboardHint,
        textFallback: accessibility.textFallback,
        reducedMotion: accessibility.reducedMotion,
        forcedColors: accessibility.forcedColors,
      },
      privacy: {
        publicExportSchema: publicExport.schema,
        rawAudioIncluded: privacy.rawAudioIncluded,
        credentialsIncluded: privacy.credentialsIncluded,
        privateModelTraceIncluded: privacy.privateModelTraceIncluded,
        credentialCanaryAbsent,
        privatePromptCanaryAbsent,
        commandOutputAnsiAbsent: statusCommandPlain && helpCommandPlain,
        ansiAbsent: !publicExportText.includes('\u001b['),
      },
      boundaries: {
        crossOriginMutationStatus: foreign.status,
        crossOriginMutationCode: foreign.payload?.error?.code || null,
        terminalCommandStatus: terminalCommand.status,
        terminalCommandCode: terminalCommand.payload?.error?.code || null,
      },
    };
    const result = {
      schema: TUTOR_STUB_SURFACE_ACCEPTANCE_SCHEMA,
      host: {
        kind: hostKind,
        chromium: browser.version(),
        authRequired,
        unauthenticatedStatus: unauthenticated.status,
        cspPresent: Boolean(csp),
      },
      contract,
      artifacts: {
        publicExport: path.basename(publicExportPath),
        browserTrace: 'browser-trace.json',
        screenshot: 'final.png',
      },
    };
    assertTutorStubSurfaceAcceptanceContract(result, expectedContract);
    await writeScreenshot(page, path.join(artifactDir, 'final.png'));
    fs.writeFileSync(
      path.join(artifactDir, 'browser-trace.json'),
      `${JSON.stringify({ trace, console: consoleEvents }, null, 2)}\n`,
    );
    return result;
  } catch (error) {
    record('acceptance-failed', { message: error?.message || String(error) });
    try {
      await writeScreenshot(page, path.join(artifactDir, 'failure.png'));
    } catch {
      // The structured failure below remains available if capture itself fails.
    }
    fs.writeFileSync(
      path.join(artifactDir, 'browser-trace.json'),
      `${JSON.stringify({ trace, console: consoleEvents, error: error?.stack || String(error) }, null, 2)}\n`,
    );
    throw error;
  } finally {
    await browser.close();
  }
}

export default runTutorStubSurfaceAcceptance;

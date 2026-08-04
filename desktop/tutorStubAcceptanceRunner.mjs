import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

import { runTutorStubSurfaceAcceptance } from './tutorStubAcceptanceScenario.mjs';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const userData = process.env.TUTOR_STUB_ACCEPTANCE_USER_DATA;
  if (userData) {
    fs.mkdirSync(userData, { recursive: true });
    app.setPath('userData', userData);
  }
  await app.whenReady();
  const artifactDir = requiredEnv('TUTOR_STUB_ACCEPTANCE_ARTIFACT_DIR');
  const resultPath = requiredEnv('TUTOR_STUB_ACCEPTANCE_RESULT');
  const expectedContract = JSON.parse(fs.readFileSync(requiredEnv('TUTOR_STUB_ACCEPTANCE_EXPECTED_CONTRACT'), 'utf8'));
  try {
    const result = await runTutorStubSurfaceAcceptance({
      baseUrl: requiredEnv('TUTOR_STUB_ACCEPTANCE_BASE_URL'),
      hostKind: 'web',
      artifactDir,
      expectedContract,
      httpHeaders: {},
      authRequired: false,
      credentialCanary: requiredEnv('ACCEPTANCE_CREDENTIAL_CANARY'),
      privatePromptCanary: requiredEnv('ACCEPTANCE_PRIVATE_PROMPT_CANARY'),
      providerEventPath: requiredEnv('FAKE_CODEX_LOG'),
      traceRootPath: requiredEnv('TUTOR_STUB_TRACE_DIR'),
    });
    fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    app.exit(0);
  } catch (error) {
    fs.writeFileSync(
      path.join(artifactDir, 'renderer-failure.json'),
      `${JSON.stringify({ error: error?.stack || String(error) }, null, 2)}\n`,
      'utf8',
    );
    console.error(error?.stack || String(error));
    app.exit(1);
  }
}

void main();

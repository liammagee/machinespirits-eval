#!/usr/bin/env node

import fs from 'node:fs';

const DELAY_MARKER = 'ACCEPTANCE_DELAY';
const DELAYED_REPLY = 'ACCEPTANCE_DELAYED_TUTOR_RESULT';
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
let input = '';

if (args.includes('--version')) {
  process.stdout.write('codex-cli 0.0.0-acceptance\n');
  process.exit(0);
}

function appendEvent(event) {
  if (!process.env.FAKE_CODEX_LOG) return;
  fs.appendFileSync(process.env.FAKE_CODEX_LOG, `${JSON.stringify(event)}\n`, 'utf8');
}

function finish(response, requestId) {
  if (outputPath) fs.writeFileSync(outputPath, response, 'utf8');
  process.stdout.write(
    `${JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } })}\n`,
  );
  appendEvent({ event: 'request_completed', requestId, response });
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  const delayed = input.includes(DELAY_MARKER);
  const requestId = delayed ? 'delayed-turn' : 'completed-turn';
  appendEvent({
    event: 'request_started',
    requestId,
    delayed,
    privateCanary: process.env.ACCEPTANCE_PRIVATE_PROMPT_CANARY || '',
    credentialCanaryObserved: process.env.OPENAI_API_KEY === process.env.ACCEPTANCE_CREDENTIAL_CANARY,
    input,
  });
  if (delayed) {
    setTimeout(() => finish(DELAYED_REPLY, requestId), 15_000);
    return;
  }
  finish('Acceptance tutor reply: compare the two public marks.', requestId);
});

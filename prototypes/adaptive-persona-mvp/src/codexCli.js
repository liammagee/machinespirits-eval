import { spawn } from 'node:child_process';
import { jsonrepair } from 'jsonrepair';

export function extractJsonEnvelope(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Codex returned empty output');

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : sliceFirstJsonObject(raw);
  try {
    return JSON.parse(candidate);
  } catch (_) {
    return JSON.parse(jsonrepair(candidate));
  }
}

function sliceFirstJsonObject(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in Codex output: ${raw.slice(0, 300)}`);
  }
  return raw.slice(start, end + 1);
}

export async function callCodexJson(prompt, {
  model = null,
  timeoutMs = 360_000,
  label = 'codex-call',
} = {}) {
  const stdout = await callCodexText(prompt, { model, timeoutMs, label });
  return {
    parsed: extractJsonEnvelope(stdout),
    rawStdout: stdout,
  };
}

export async function callCodexText(prompt, {
  model = null,
  timeoutMs = 360_000,
  label = 'codex-call',
} = {}) {
  const args = ['exec', '-'];
  if (model) args.push('-m', model);

  return await new Promise((resolve, reject) => {
    const child = spawn('codex', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch (_) {
        // Process already exited.
      }
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(err.trim() || out.trim() || `${label} exited with code ${code}`));
      } else {
        resolve(out);
      }
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

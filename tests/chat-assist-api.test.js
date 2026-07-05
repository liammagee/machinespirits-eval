import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../server.js';

function request(baseUrl, path, { method = 'GET', body = null } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      `${baseUrl}${path}`,
      {
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : undefined,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('admin chat assist API', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(() => resolve()));
  });

  it('exposes keyless health without requiring OpenRouter', async () => {
    const { status, body } = await request(baseUrl, '/api/chat/assist/health');
    assert.equal(status, 200);
    assert.ok(['openrouter', 'none'].includes(body.provider));
    assert.equal(typeof body.model, 'string');
  });

  it('returns a deterministic dry-run proposal with resolver preview', async () => {
    const { status, body } = await request(baseUrl, '/api/chat/assist', {
      method: 'POST',
      body: {
        dryRun: true,
        messages: [
          {
            role: 'user',
            content:
              'stage a drama about the master-slave dialectic with a charismatic tutor and an anxious learner, AI plays both sides',
          },
        ],
        currentConfig: {
          features: { approach: 'standard', critic: 'none', stance: 'suspicious', learnerModel: 'surface' },
          topic: 'Hegel recognition',
          mode: 'human',
        },
      },
    });

    assert.equal(status, 200);
    assert.equal(body.proposal.features.approach, 'charismatic');
    assert.equal(body.proposal.topic, 'the master-slave dialectic');
    assert.equal(body.proposal.personaId, 'struggling_anxious');
    assert.equal(body.proposal.mode, 'auto');
    assert.equal(body.proposal.action, 'start_scene');
    assert.ok(body.resolved.name.startsWith('cell_'));
    assert.ok(['exact', 'closest'].includes(body.resolved.matchQuality));
  });

  it('caps history server-side by using the latest message in dry-run mode', async () => {
    const messages = Array.from({ length: 14 }, (_, i) => ({
      role: 'user',
      content: i === 13 ? 'stage a drama about proportional reasoning with an anxious learner' : `old request ${i}`,
    }));
    const { status, body } = await request(baseUrl, '/api/chat/assist', {
      method: 'POST',
      body: {
        dryRun: true,
        messages,
        currentConfig: { features: { approach: 'standard' }, topic: 'old topic' },
      },
    });

    assert.equal(status, 200);
    assert.match(body.proposal.topic, /proportional reasoning/i);
    assert.equal(body.proposal.personaId, 'struggling_anxious');
  });
});

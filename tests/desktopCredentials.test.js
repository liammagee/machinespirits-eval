// tests/desktopCredentials.test.js — pure, runs under plain `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createCredentialStore, parseEnvFile, credentialTemplate } from '../desktop/credentials.js';

// Fake keychain: reversible, but base64-of-ciphertext hides the plaintext.
const fakeSafe = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from('ENC|' + s, 'utf8'),
  decryptString: (b) => b.toString('utf8').replace(/^ENC\|/, ''),
};

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ms-creds-'));

test('parseEnvFile handles comments, blanks, and quotes', () => {
  const got = parseEnvFile('# c\n\nOPENROUTER_API_KEY=sk-1\nANTHROPIC_API_KEY="sk-2"\nX=\n');
  assert.equal(got.OPENROUTER_API_KEY, 'sk-1');
  assert.equal(got.ANTHROPIC_API_KEY, 'sk-2');
  assert.equal(got.X, '');
});

test('set/get roundtrips and does not persist plaintext', () => {
  const dir = tmp();
  const store = createCredentialStore({ safeStorage: fakeSafe, dir });
  store.set('OPENROUTER_API_KEY', 'sk-secret-123');
  assert.equal(store.get().OPENROUTER_API_KEY, 'sk-secret-123');
  const raw = fs.readFileSync(path.join(dir, 'credentials.enc'), 'utf8');
  assert.ok(!raw.includes('sk-secret-123'), 'plaintext key must not appear in the stored file');
});

test('imports keys.env then deletes the plaintext', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'keys.env'), 'OPENROUTER_API_KEY=sk-imported\nANTHROPIC_API_KEY="sk-ant"\n');
  const store = createCredentialStore({ safeStorage: fakeSafe, dir });
  const got = store.get();
  assert.equal(got.OPENROUTER_API_KEY, 'sk-imported');
  assert.equal(got.ANTHROPIC_API_KEY, 'sk-ant');
  assert.ok(!fs.existsSync(path.join(dir, 'keys.env')), 'plaintext keys.env must be removed after import');
});

test('ensureTemplate writes a template once, clear removes stored creds', () => {
  const dir = tmp();
  const store = createCredentialStore({ safeStorage: fakeSafe, dir });
  const p = store.ensureTemplate();
  assert.ok(fs.existsSync(p));
  assert.match(fs.readFileSync(p, 'utf8'), /OPENROUTER_API_KEY/);
  store.set('OPENAI_API_KEY', 'x');
  store.clear();
  assert.deepEqual(store.get(), {});
});

test('falls back to obfuscated storage when keychain is unavailable', () => {
  const dir = tmp();
  const store = createCredentialStore({ safeStorage: { isEncryptionAvailable: () => false }, dir });
  store.set('OPENROUTER_API_KEY', 'V');
  assert.equal(store.get().OPENROUTER_API_KEY, 'V');
});

test('credentialTemplate lists recognized providers', () => {
  assert.match(credentialTemplate(), /ANTHROPIC_API_KEY/);
});

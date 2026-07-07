// desktop/credentials.js
//
// Provider API keys at rest, encrypted via the OS keychain (Electron safeStorage)
// — a genuine improvement the desktop form enables over a plaintext .env.
//
// Flow (no desktop HTML needed): the "Set Up API Keys…" menu item writes a
// `keys.env` template into userData and opens it in the user's editor; on the
// next launch get() imports those keys, encrypts them into `credentials.enc`, and
// deletes the plaintext file. main injects the decrypted keys into the server
// child's env (without overriding any key already present in the shell env).
//
// Pure logic with injected deps (safeStorage, fs) so it unit-tests under plain
// node with a fake keychain.

import fsDefault from 'node:fs';
import path from 'node:path';

export const RECOGNIZED_KEYS = Object.freeze([
  'OPENROUTER_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_API_KEY',
  'LEMONFOX_API_KEY',
]);

export function parseEnvFile(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

export function credentialTemplate() {
  return [
    '# Machine Spirits — API keys',
    '# Add your provider keys below as KEY=value, save this file, then restart the app.',
    '# On restart the keys are encrypted into your OS keychain and this plaintext file',
    '# is deleted.',
    '',
    ...RECOGNIZED_KEYS.map((k) => `# ${k}=`),
    '',
  ].join('\n');
}

export function createCredentialStore({ safeStorage, dir, fs = fsDefault } = {}) {
  const encPath = path.join(dir, 'credentials.enc');
  const plainPath = path.join(dir, 'keys.env');

  function readEnc() {
    try {
      const wrap = JSON.parse(fs.readFileSync(encPath, 'utf8'));
      const buf = Buffer.from(wrap.data, 'base64');
      const json = wrap.encrypted ? safeStorage.decryptString(buf) : buf.toString('utf8');
      return JSON.parse(json) || {};
    } catch {
      return {};
    }
  }

  function writeEnc(obj) {
    const json = JSON.stringify(obj);
    const wrap = safeStorage?.isEncryptionAvailable?.()
      ? { encrypted: true, data: safeStorage.encryptString(json).toString('base64') }
      : { encrypted: false, data: Buffer.from(json).toString('base64') };
    fs.writeFileSync(encPath, JSON.stringify(wrap));
  }

  function importPlainIfPresent() {
    if (!fs.existsSync(plainPath)) return false;
    const plain = parseEnvFile(fs.readFileSync(plainPath, 'utf8'));
    writeEnc({ ...readEnc(), ...plain });
    try {
      fs.unlinkSync(plainPath);
    } catch {
      /* ignore */
    }
    return true;
  }

  return {
    encPath,
    plainPath,
    get() {
      importPlainIfPresent();
      return readEnc();
    },
    set(key, value) {
      const o = readEnc();
      o[key] = value;
      writeEnc(o);
    },
    clear() {
      for (const p of [encPath, plainPath]) {
        try {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch {
          /* ignore */
        }
      }
    },
    ensureTemplate() {
      if (!fs.existsSync(plainPath)) fs.writeFileSync(plainPath, credentialTemplate());
      return plainPath;
    },
  };
}

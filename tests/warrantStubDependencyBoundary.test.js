/**
 * Warrant/tutor-stub dependency boundary ratchet.
 *
 * Rule (docs/warrant-stub-dependency-rule.md): warrant modules
 * (services/adaptiveWarrant*.js) must not import tutor-stub files
 * (services/tutorStub*.js). Tutor-stub may import warrant modules.
 *
 * Today's back-imports are frozen in ALLOWED_BACK_IMPORTS. The list may
 * only shrink: a new edge fails, and a stale allowlist entry fails.
 * Removing the listed edges waits for the live warrant validation line
 * (card adaptive-warrant-public-obligation-ledger-and-inquiry-termin)
 * to close, because that line fingerprints these files.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVICES = path.join(ROOT, 'services');

/**
 * Frozen 2026-08-16. Shrink only; never add.
 * Keyed by warrant module, listing the tutor-stub specifiers it imports.
 */
const ALLOWED_BACK_IMPORTS = Object.freeze({
  'adaptiveWarrantDeliveryContract.js': Object.freeze([
    './tutorStubGuardRecovery.js',
    './tutorStubPerformanceObligationContract.js',
  ]),
});

// Real dependency edges only: static import/export-from and dynamic
// import(). Comments and plain path strings do not count.
const STATIC_EDGE = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"](\.\/tutorStub[^'"]+)['"]/gu;
const DYNAMIC_EDGE = /import\(\s*['"](\.\/tutorStub[^'"]+)['"]\s*\)/gu;

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
}

function backImportsOf(file) {
  const source = stripComments(fs.readFileSync(path.join(SERVICES, file), 'utf8'));
  const found = new Set();
  for (const pattern of [STATIC_EDGE, DYNAMIC_EDGE]) {
    for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return [...found].sort();
}

function warrantModules() {
  return fs
    .readdirSync(SERVICES)
    .filter((name) => name.startsWith('adaptiveWarrant') && name.endsWith('.js'))
    .sort();
}

describe('warrant/tutor-stub dependency boundary', () => {
  const modules = warrantModules();

  it('finds the warrant modules it protects', () => {
    assert.ok(modules.length >= 10, `expected the warrant module family, found ${modules.length}`);
  });

  it('admits no back-import outside the frozen allowlist', () => {
    const violations = [];
    for (const file of modules) {
      const allowed = new Set(ALLOWED_BACK_IMPORTS[file] || []);
      for (const specifier of backImportsOf(file)) {
        if (!allowed.has(specifier)) violations.push(`${file} imports ${specifier}`);
      }
    }
    assert.deepEqual(
      violations,
      [],
      `New warrant back-imports into tutor-stub are not allowed ` +
        `(docs/warrant-stub-dependency-rule.md). The allowlist may only shrink.\n` +
        violations.join('\n'),
    );
  });

  it('keeps the allowlist free of stale entries', () => {
    const stale = [];
    for (const [file, specifiers] of Object.entries(ALLOWED_BACK_IMPORTS)) {
      if (!modules.includes(file)) {
        stale.push(`${file} no longer exists`);
        continue;
      }
      const present = new Set(backImportsOf(file));
      for (const specifier of specifiers) {
        if (!present.has(specifier)) stale.push(`${file} no longer imports ${specifier}`);
      }
    }
    assert.deepEqual(
      stale,
      [],
      `Allowlist entries were removed from the code; delete them here too so the ratchet only shrinks.\n` +
        stale.join('\n'),
    );
  });

  it('resolves every allowlisted target to a real tutor-stub file', () => {
    for (const specifiers of Object.values(ALLOWED_BACK_IMPORTS)) {
      for (const specifier of specifiers) {
        const target = path.join(SERVICES, specifier);
        assert.ok(fs.existsSync(target), `allowlisted target missing: ${specifier}`);
      }
    }
  });
});

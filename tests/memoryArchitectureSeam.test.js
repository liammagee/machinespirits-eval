// tests/memoryArchitectureSeam.test.js
//
// Guards the memory-architecture seam documented in MEMORY-ARCHITECTURE.md (Shape B):
// the eval-layer memory stores (services/memory/**) and tutor-core's in-dialogue pad
// (tutor-core/services/writingPadService.js) are two separate systems that must stay
// on their own sides of the in-housing boundary.
//
//   1. tutor-core/** must NOT import services/memory/**  (protects re-extractability:
//      tutor-core can be spun back out into a package, so it cannot reach the eval layer).
//   2. services/memory/** must NOT import tutor-core/**   (the eval-layer pads stay
//      standalone; they do not couple to tutor-core's pad).
//
// Pure static analysis — reads source files only, touches no DB. If a future change
// deliberately unifies the stores (Shape A or C), update MEMORY-ARCHITECTURE.md and
// this test together.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Recursively collect *.js / *.mjs files under dir, skipping node_modules.
function collectSources(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSources(full));
    else if (/\.(js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Extract every import/require/dynamic-import specifier string from a source file.
function importSpecifiers(file) {
  const src = fs.readFileSync(file, 'utf8');
  const re = /(?:\bfrom|\brequire|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g;
  const specs = [];
  let m;
  while ((m = re.exec(src)) !== null) specs.push(m[1]);
  return specs;
}

test('tutor-core/ does not import the eval-layer memory stores (re-extractability)', () => {
  const offenders = [];
  for (const file of collectSources(path.join(ROOT, 'tutor-core'))) {
    for (const spec of importSpecifiers(file)) {
      if (/services\/memory\//.test(spec)) {
        offenders.push(`${path.relative(ROOT, file)} -> ${spec}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `tutor-core must not import services/memory/** (it must stay re-extractable). ` +
      `Offending imports:\n  ${offenders.join('\n  ')}\nSee MEMORY-ARCHITECTURE.md §2/§5.`,
  );
});

test('services/memory/ stores do not import tutor-core/ (eval pads stay standalone)', () => {
  const offenders = [];
  for (const file of collectSources(path.join(ROOT, 'services', 'memory'))) {
    for (const spec of importSpecifiers(file)) {
      if (/tutor-core/.test(spec)) {
        offenders.push(`${path.relative(ROOT, file)} -> ${spec}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `services/memory/** must not import tutor-core/** (keep the two memory systems ` +
      `on their own sides of the seam). Offending imports:\n  ${offenders.join('\n  ')}\n` +
      `See MEMORY-ARCHITECTURE.md §2/§5.`,
  );
});

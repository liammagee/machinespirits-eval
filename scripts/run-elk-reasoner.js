#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const VERSION = '0.4.3';
const JAR_PATH = path.join(ROOT_DIR, 'vendor', 'reasoners', 'elk', `elk-standalone-${VERSION}.jar`);

function argValue(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : fallback;
}

const inputArg = argValue('--input', path.join(ROOT_DIR, 'config', 'ontology', 'reasoning-core.ofn'));
const output = argValue('--output', path.join(ROOT_DIR, 'exports', 'ontology', 'elk-classification.owl'));
const requestedJava = argValue('--java', process.env.JAVA_BIN || null);

function findJavaBinary() {
  const candidates = [
    requestedJava,
    'java',
    '/opt/homebrew/opt/openjdk/bin/java',
    '/usr/local/opt/openjdk/bin/java',
    '/opt/homebrew/opt/openjdk@21/bin/java',
    '/usr/local/opt/openjdk@21/bin/java',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes('/') && !fs.existsSync(candidate)) continue;
    const check = spawnSync(candidate, ['-version'], { encoding: 'utf8' });
    if (check.status === 0) return candidate;
  }
  return null;
}

if (!fs.existsSync(JAR_PATH)) {
  console.error(`Missing ELK jar: ${path.relative(ROOT_DIR, JAR_PATH)}`);
  console.error('Download it with: npm run ontology:download-elk');
  process.exit(1);
}

function resolveInput(inputPath) {
  const absoluteInput = path.resolve(ROOT_DIR, inputPath);
  if (absoluteInput.endsWith('.ttl')) {
    const functionalMirror = absoluteInput.replace(/\.ttl$/, '.ofn');
    if (fs.existsSync(functionalMirror)) {
      console.log(`ELK standalone expects OWL functional syntax; using ${path.relative(ROOT_DIR, functionalMirror)}.`);
      return functionalMirror;
    }
  }
  return absoluteInput;
}

const input = resolveInput(inputArg);
fs.mkdirSync(path.dirname(output), { recursive: true });

const javaBin = findJavaBinary();
if (!javaBin) {
  console.error('Java runtime is not available. Install Java before running ELK.');
  console.error('On macOS/Homebrew: brew install openjdk');
  process.exit(1);
}

const result = spawnSync(javaBin, ['-jar', JAR_PATH, '-i', input, '-c', '-o', output], {
  cwd: ROOT_DIR,
  encoding: 'utf8',
});

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

if (result.stdout.trim()) console.log(result.stdout.trim());
console.log(`ELK classification written to ${path.relative(ROOT_DIR, output)}`);

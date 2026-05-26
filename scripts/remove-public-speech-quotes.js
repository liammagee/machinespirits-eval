#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

const ROLE_BLOCK_RE = /(^|\n)((?:TUTOR|LEARNER|Tutor|Learner):)([\s\S]*?)(?=\n(?:TUTOR|LEARNER|Tutor|Learner):|$)/g;
const DEFAULT_EXTENSIONS = new Set(['.txt', '.md']);
const QUOTE_PAIRS = [
  ['"', '"'],
  ["'", "'"],
  ['\u201c', '\u201d'],
  ['\u2018', '\u2019'],
];

function splitOuterWhitespace(text) {
  const value = String(text || '');
  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  return {
    leading,
    core: value.slice(leading.length, value.length - trailing.length),
    trailing,
  };
}

function stripTerminalEllipsis(text) {
  return String(text || '').replace(/[ \t]*(?:\.{3}|\u2026)[ \t]*$/u, '');
}

function stripWrappingQuotePair(text, { stripEllipsis = false } = {}) {
  const { leading, core, trailing } = splitOuterWhitespace(text);
  const pair = QUOTE_PAIRS.find(([open, close]) => core.startsWith(open) && core.endsWith(close));
  if (!pair || core.length < 2) return text;
  let inner = core.slice(pair[0].length, core.length - pair[1].length).trim();
  if (stripEllipsis) inner = stripTerminalEllipsis(inner);
  return `${leading}${inner}${trailing}`;
}

function stripRoleSpeechQuotes(content, options = {}) {
  const { leading, core, trailing } = splitOuterWhitespace(content);
  const asideMatch = core.match(/^((?:\[[^\]\n]+\][ \t]*(?:\n[ \t]*)*)+)([\s\S]*)$/);
  if (!asideMatch) {
    return `${leading}${stripWrappingQuotePair(core, options)}${trailing}`;
  }
  const [, asides, speech] = asideMatch;
  return `${leading}${asides}${stripWrappingQuotePair(speech, options)}${trailing}`;
}

function removePublicSpeechQuotes(text, options = {}) {
  return String(text || '').replace(ROLE_BLOCK_RE, (match, prefix, label, content) => {
    return `${prefix}${label}${stripRoleSpeechQuotes(content, options)}`;
  });
}

function parseArgs(argv) {
  const args = {
    write: false,
    check: false,
    stripEllipsis: false,
    extensions: new Set(DEFAULT_EXTENSIONS),
    paths: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--write') args.write = true;
    else if (token === '--check') args.check = true;
    else if (token === '--strip-terminal-ellipsis') args.stripEllipsis = true;
    else if (token === '--ext') {
      args.extensions = new Set(
        String(argv[++i] || '')
          .split(',')
          .map((ext) => ext.trim())
          .filter(Boolean)
          .map((ext) => (ext.startsWith('.') ? ext : `.${ext}`)),
      );
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else if (token.startsWith('-')) {
      throw new Error(`unknown arg: ${token}`);
    } else {
      args.paths.push(token);
    }
  }
  if (args.write && args.check) throw new Error('use --write or --check, not both');
  return args;
}

function usage() {
  return `Usage:
  node scripts/remove-public-speech-quotes.js [--write|--check] [--strip-terminal-ellipsis] [--ext txt,md] <file-or-dir...>
  cat transcript.txt | node scripts/remove-public-speech-quotes.js

Removes wrapping quote marks from role-labelled public speech, preserving square-bracket action asides.
Without --write, one file or stdin is printed to stdout. Multiple files without --write report changed paths.`;
}

function walkTargets(targets, extensions) {
  const files = [];
  for (const target of targets) {
    const resolved = path.resolve(target);
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
        files.push(...walkTargets([path.join(resolved, entry.name)], extensions));
      }
    } else if (stat.isFile() && extensions.has(path.extname(resolved))) {
      files.push(resolved);
    }
  }
  return files;
}

function normalizeFile(filePath, args) {
  const before = fs.readFileSync(filePath, 'utf8');
  const after = removePublicSpeechQuotes(before, { stripEllipsis: args.stripEllipsis });
  const changed = before !== after;
  if (changed && args.write) fs.writeFileSync(filePath, after, 'utf8');
  return { filePath, changed, after };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.paths.length) {
    const input = fs.readFileSync(0, 'utf8');
    process.stdout.write(removePublicSpeechQuotes(input, { stripEllipsis: args.stripEllipsis }));
    return;
  }
  const files = walkTargets(args.paths, args.extensions);
  const results = files.map((filePath) => normalizeFile(filePath, args));
  const changed = results.filter((result) => result.changed);
  if (args.check) {
    for (const result of changed) console.log(result.filePath);
    if (changed.length) process.exitCode = 1;
    return;
  }
  if (args.write) {
    console.log(`processed ${files.length} file(s); changed ${changed.length}`);
    return;
  }
  if (files.length === 1) {
    process.stdout.write(results[0].after);
    return;
  }
  for (const result of changed) console.log(result.filePath);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}

export { removePublicSpeechQuotes, stripRoleSpeechQuotes, stripWrappingQuotePair };

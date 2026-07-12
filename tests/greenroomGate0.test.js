import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseModelRef,
  parseArgs,
  collectTranscriptFiles,
  selectSessions,
  extractTranscriptText,
  truncateTranscript,
  parseStructuredTail,
} from '../scripts/greenroom-gate0.js';

test('parseModelRef splits dot notation', () => {
  assert.deepEqual(parseModelRef('codex.sol', '--coach'), { provider: 'codex', model: 'sol' });
  assert.deepEqual(parseModelRef('claude-code.sonnet', '--actor'), { provider: 'claude-code', model: 'sonnet' });
  assert.throws(() => parseModelRef('codex', '--coach'), /dot notation/);
  assert.throws(() => parseModelRef('codex.', '--coach'), /dot notation/);
});

test('parseArgs defaults match the P0 pins (re-pinned 2026-07-12, plan §0.1.4)', () => {
  const args = parseArgs(['--transcripts', 'a.json', 'b.json']);
  assert.equal(args.coach, 'claude-code.claude-opus-4-8');
  assert.equal(args.actor, 'claude-code.claude-sonnet-5');
  assert.equal(args.sessions, 5);
  assert.equal(args.dryRun, false);
  assert.deepEqual(args.transcripts, ['a.json', 'b.json']);
});

test('parseArgs rejects bad values', () => {
  assert.throws(() => parseArgs(['--sessions', '0']), /positive integer/);
  assert.throws(() => parseArgs(['--max-transcript-chars', '10']), />= 1000/);
  assert.throws(() => parseArgs(['--bogus']), /Unknown option/);
});

test('selectSessions is deterministic under a seed', () => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f'];
  const first = selectSessions(files, 3, 42);
  const second = selectSessions(files, 3, 42);
  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  const other = selectSessions(files, 3, 43);
  assert.equal(other.length, 3);
});

test('extractTranscriptText formats jsonl speaker/text entries', () => {
  const raw = [
    JSON.stringify({ speaker: 'tutor', text: 'What does the notched serif tell us?' }),
    JSON.stringify({ role: 'learner', content: 'That the burin was worn.' }),
    'not-json falls through verbatim',
  ].join('\n');
  const out = extractTranscriptText('/fake/trace.jsonl', raw);
  assert.match(out, /tutor: What does the notched serif tell us\?/);
  assert.match(out, /learner: That the burin was worn\./);
  assert.match(out, /not-json falls through verbatim/);
});

test('extractTranscriptText finds container arrays in json objects', () => {
  const raw = JSON.stringify({
    meta: { world: 'world-005-marrick' },
    turns: [
      { agent: 'tutor', message: 'Begin with the dross.' },
      { agent: 'learner', message: 'The dross points to a cold crucible.' },
    ],
  });
  const out = extractTranscriptText('/fake/run.json', raw);
  assert.match(out, /tutor: Begin with the dross\./);
  assert.match(out, /learner: The dross points to a cold crucible\./);
});

test('extractTranscriptText passes markdown through', () => {
  const raw = '# Transcript\n\nTUTOR: hello';
  assert.equal(extractTranscriptText('/fake/t.md', raw), raw);
});

test('truncateTranscript keeps head and tail with an elision marker', () => {
  const text = 'x'.repeat(5000);
  const out = truncateTranscript(text, 2000);
  assert.ok(out.length < 2200);
  assert.match(out, /chars elided/);
  assert.equal(truncateTranscript('short', 2000), 'short');
});

test('parseStructuredTail reads the last fenced json block', () => {
  const reply = [
    'Some prose.',
    '```json',
    '{"notes": [{"note": "n1", "evidence_quote": "q", "check": "c"}], "memory_patch": {"section": "s", "op": "add", "text": "t"}, "confidence": 0.8}',
    '```',
  ].join('\n');
  const parsed = parseStructuredTail(reply);
  assert.equal(parsed.notes.length, 1);
  assert.equal(parsed.notes[0].note, 'n1');
  assert.equal(parsed.confidence, 0.8);
});

test('parseStructuredTail tolerates trailing commas (observed in the 2026-07-11 dress rehearsal)', () => {
  const reply = [
    '```json',
    '{"notes": [{"note": "n1"},], "memory_patch": {"section": "s", "op": "add", "text": "t",}, "confidence": 0.82}',
    '```',
  ].join('\n');
  const parsed = parseStructuredTail(reply);
  assert.equal(parsed.notes[0].note, 'n1');
  assert.equal(parsed.memory_patch.text, 't');
});

test('parseStructuredTail falls back to a bare notes object and returns null when absent', () => {
  const bare = 'closing words {"notes": [{"note": "n2"}]} trailing';
  assert.equal(parseStructuredTail(bare).notes[0].note, 'n2');
  assert.equal(parseStructuredTail('no json here'), null);
});

test('collectTranscriptFiles filters by extension and dedupes', async (t) => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate0-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'a.json'), '{}');
  fs.writeFileSync(path.join(dir, 'b.jsonl'), '{}');
  fs.writeFileSync(path.join(dir, 'ignore.db'), '');
  fs.mkdirSync(path.join(dir, 'sub'));
  fs.writeFileSync(path.join(dir, 'sub', 'c.md'), '# t');
  const files = collectTranscriptFiles([dir, path.join(dir, 'a.json')]);
  assert.equal(files.length, 3);
  assert.ok(files.every((f) => /\.(json|jsonl|md)$/.test(f)));
});

import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Provenance + regression guard for Paper 2.0 §6.2.3 (Round 1→Round 2 critique
 * resolution) and §6.2.5 (revision magnitude).
 *
 * WHY THIS EXISTS — the cause of the G4 "irreproducible" misdiagnosis (2026-06-06)
 * --------------------------------------------------------------------------------
 * The §6.2.3/§6.2.5 figures are produced by scripts/analyze-superego-taxonomy.js
 * (sections 9 and 10). They reproduce EXACTLY — yet an earlier audit pass concluded
 * they were "unreconstructable from the repo." That conclusion was wrong, and it was
 * wrong because of two silent traps this test pins down:
 *
 *   TRAP 1 — wrong corpus, no error. analyze-superego-taxonomy.js defaults --input to
 *   data/superego-critiques-classified.jsonl. In THIS fork that file is a DIFFERENT
 *   classification run (300 records / 195 dialogues; ~15-dialogue overlap with the
 *   paper source), not the paper corpus. Run with no --input and the script happily
 *   prints 53 pairs across 195 dialogues — plausible-looking, completely wrong, and
 *   with no warning. The real paper corpus is the 500-record / 56-dialogue file that
 *   is now tracked in this repo at
 *   data/paper2/superego-critiques-classified-paper-6.2-n500.jsonl.
 *
 *   TRAP 2 — turnIndex-null pairing. Section 9 pairs rounds with
 *   `round2.find(r => r.turnIndex === r1.turnIndex) || round2[0]`. Every record has
 *   turnIndex === null, so `null === null` makes .find() return the FIRST round-2 entry
 *   for every round-1 entry. The pairing is therefore "each round-1 verdict vs the
 *   dialogue's first round-2 verdict," one transition per round-1 entry — NOT strictly
 *   same-turn, and NOT a cartesian product. Deterministic and intended on this corpus,
 *   but it would change silently if a future corpus populated turnIndex.
 *
 * The three tests below: (1) lock every published §6.2.3/§6.2.5 number to the tracked
 * corpus and its sha256; (2) pin the turnIndex-null pairing rule hermetically; and
 * (3) assert the in-repo default corpus is NOT the paper source, so nobody re-walks
 * into Trap 1. Long-form notes: TODO.md §G4 and the paper-full-2.0.md v3.0.126
 * revision-history entry (both committed); exports/superego-transition-reproduction.md
 * (gitignored working copy).
 */

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'analyze-superego-taxonomy.js');

// The Paper §6.2 source corpus: 500 records / 56 dialogues, tracked in-repo.
// The sha256 is the integrity anchor cited inline in paper §6.2.3.
const ARCHIVE = path.resolve(
  ROOT,
  'data',
  'paper2',
  'superego-critiques-classified-paper-6.2-n500.jsonl',
);
const ARCHIVE_SHA256 = 'f9ba2d92645decae74ddd80c78afeda34aa71af761c5064dd932468084f54329';
const ARCHIVE_PRESENT = fs.existsSync(ARCHIVE);

// The in-repo DEFAULT input — the WRONG corpus for paper reproduction (Trap 1).
const DEFAULT_CORPUS = path.join(ROOT, 'data', 'superego-critiques-classified.jsonl');
const DEFAULT_PRESENT = fs.existsSync(DEFAULT_CORPUS);

function runScript(inputPath) {
  const argv = inputPath ? [SCRIPT, '--input', inputPath] : [SCRIPT];
  return execFileSync(process.execPath, argv, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
}

// Build a table-row regex that matches `<CATEGORY> <int> <int> ... <value>` regardless
// of column whitespace; `value`'s dot is escaped so it is a literal, not a wildcard.
function rowMatch(category, intCols, value) {
  const ints = Array(intCols).fill('\\d+').join('\\s+');
  return new RegExp(`${category}\\s+${ints}\\s+${value.replace('.', '\\.')}`);
}

describe('analyze-superego-taxonomy §6.2.3/§6.2.5 provenance', () => {
  it(
    'reproduces every published §6.2.3/§6.2.5 figure from the archived 500-record corpus',
    { skip: ARCHIVE_PRESENT ? false : `archived corpus absent (${ARCHIVE}); sibling private repo not checked out` },
    () => {
      // Corpus identity: byte-for-byte the paper source.
      const sha = createHash('sha256').update(fs.readFileSync(ARCHIVE)).digest('hex');
      assert.equal(sha, ARCHIVE_SHA256, 'archived corpus sha256 drifted from the paper source');

      const out = runScript(ARCHIVE);

      // §6.2.3 — transition totals.
      assert.ok(out.includes('Dialogues: 56'), '§6.2.3 dialogue count');
      assert.ok(out.includes('Round 1→2 transition pairs: 232'), '§6.2.3 transition pair count');

      // §6.2.3 — by-condition splits (Base N=57; Recognition N=175).
      assert.ok(out.includes('baseline (N=57):'), 'base N');
      assert.ok(out.includes('Persist: 35 (61.4%)'), 'base persist');
      assert.ok(out.includes('Resolve: 4 (7.0%)'), 'base resolve');
      assert.ok(out.includes('New: 16 (28.1%)'), 'base new');
      assert.ok(out.includes('Stay: 2 (3.5%)'), 'base stay');
      assert.ok(out.includes('recognition (N=175):'), 'recog N');
      assert.ok(out.includes('Persist: 13 (7.4%)'), 'recog persist');
      assert.ok(out.includes('Resolve: 63 (36.0%)'), 'recog resolve');
      assert.ok(out.includes('New: 33 (18.9%)'), 'recog new');
      assert.ok(out.includes('Stay: 66 (37.7%)'), 'recog stay');

      // §6.2.3 — category resolution rates (Category persistence table: 3 int cols
      // [persist shift resolve] then resolve%).
      const resolvePct = {
        RECOGNITION_FAILURE: '52.9',
        PEDAGOGICAL_MISJUDGMENT: '83.3',
        VAGUENESS: '83.3',
        CONTEXT_BLINDNESS: '66.7',
        REDIRECTION: '42.9',
      };
      for (const [cat, p] of Object.entries(resolvePct)) {
        assert.match(out, rowMatch(cat, 3, `${p}%`), `§6.2.3 ${cat} resolve%`);
      }

      // §6.2.5 — revision counts.
      assert.ok(out.includes('With text change: 216'), '§6.2.5 N=216');

      // §6.2.5 — base 78% / recog 57% substantive-or-strategic (46.5+31.5; 39.3+18.0).
      assert.match(out, /substantive\s+59 \(\s*46\.5%\)\s+35 \(\s*39\.3%\)/, '§6.2.5 substantive split');
      assert.match(out, /strategic\s+40 \(\s*31\.5%\)\s+16 \(\s*18\.0%\)/, '§6.2.5 strategic split');

      // §6.2.5 — per-category mean Jaccard (Revision type by category table: 5 int cols
      // [cosm cal sub strat N] then meanJ).
      const meanJ = {
        LACK_OF_AGENCY: '0.132',
        REDIRECTION: '0.157',
        EMOTIONAL_NEGLECT: '0.192',
        CONTEXT_BLINDNESS: '0.613',
      };
      for (const [cat, j] of Object.entries(meanJ)) {
        assert.match(out, rowMatch(cat, 5, j), `§6.2.5 ${cat} mean Jaccard`);
      }
    },
  );

  it("pairs each round-1 verdict against the dialogue's first round-2 verdict when turnIndex is null (Trap 2)", () => {
    // Fixture: one round-1 critique; TWO round-2 entries (first APPROVAL, then a
    // critique), all turnIndex:null. The design is discriminating —
    //   * one transition per round-1 entry  -> pairs == 1 (NOT 2, so not cartesian)
    //   * r2 resolves to round2[0] = APPROVAL -> "Resolve -> approval" (NOT "Persist")
    // If the section-9 pairing ever changes (same-turn match, last-entry, cartesian),
    // both assertions flip and this test fails.
    const rec = (round, primary, approved) =>
      JSON.stringify({
        dialogueId: 'd1',
        round,
        turnIndex: null,
        profileName: 'budget',
        model: 'x/haiku',
        approved,
        classification: { primary, confidence: 0.9 },
        feedback: `${primary} r${round}`,
      });
    const fixture =
      [rec(1, 'RECOGNITION_FAILURE', false), rec(2, 'APPROVAL', true), rec(2, 'MEMORY_FAILURE', false)].join('\n') +
      '\n';

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superego-taxonomy-'));
    const fpath = path.join(dir, 'fixture.jsonl');
    fs.writeFileSync(fpath, fixture);
    try {
      const out = runScript(fpath);
      assert.ok(out.includes('Round 1→2 transition pairs: 1'), 'one transition per round-1 entry');
      assert.match(
        out,
        /Resolve → approval \(R1 crit → R2 ok\):\s+1 \(100\.0%\)/,
        'paired against round2[0] = APPROVAL',
      );
      assert.match(
        out,
        /Persist critique\s+\(R1 crit → R2 crit\):\s+0 \(0\.0%\)/,
        'did NOT pair against the round-2 critique',
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it(
    'the in-repo default corpus is NOT the paper-source corpus (Trap 1 guard)',
    { skip: DEFAULT_PRESENT ? false : 'in-repo default corpus absent' },
    () => {
      const out = runScript(null); // no --input -> uses the in-repo default
      assert.ok(out.includes('Transition Analysis (Round 1 → Round 2)'), 'script ran section 9');
      // The default is a different classification run (300 rec / 195 dialogues). If it
      // ever prints the paper figures, someone replaced the default with the paper
      // corpus — update the §6.2.3 provenance note and this guard rather than silently
      // shipping reproduction off the default path.
      assert.ok(!out.includes('Round 1→2 transition pairs: 232'), 'default must not equal the paper pair count');
      assert.ok(!out.includes('Dialogues: 56'), 'default must not equal the paper dialogue count');
    },
  );
});

#!/usr/bin/env node
/**
 * Phase-2 human FORM labeller — the must-be-human transfer-gate channel.
 *
 * The §3 transfer gate asks whether the canon-validated instrument's FORM
 * classification AGREES with a human reader's FORM classification of the SAME
 * tutoring transcripts (quadratic-weighted κ ≥ 0.60). For that agreement to mean
 * anything, the human channel must be INDEPENDENT of the instrument — otherwise
 * the gate is closed-loop self-validation (PHASE2-DESIGN §3.2). This tool is that
 * independent channel.
 *
 * Two invariants make it valid:
 *
 *   1. The human assigns a 3-way *category*, NEVER a 0-100 score. A number would
 *      make the human a second copy of the instrument; the nominal FORM verdict is
 *      a genuinely different reading. (The instrument owns the scored axes; the
 *      human owns the category. κ then compares two channels, not one with itself.)
 *
 *   2. The tool is structurally BLIND. It reads ONLY the neutral phase2-sample/
 *      T*.txt files and never opens phase2-key.yaml. The labels file it writes is
 *      sampleId → {label, pivot, note} with NO stratum / dialogue_id / model. The
 *      join to stratum + instrument scores happens later, after both channels
 *      exist (exactly like key.yaml).
 *
 * The framing-lock is shown on screen: the human judges a TEXT RELATION — "does a
 * later learner turn re-read the learner's OWN earlier turns, so they now mean
 * something different?" — not whether the learner "really understood" (unknowable,
 * and not what this measures).
 *
 * Pure local interaction: no DB, no API, no network. Resumable; saves after every
 * label. Run once per labeller (≥2 preferred for inter-labeller reliability, §7).
 *
 * Usage:
 *   node scripts/label-poetics-phase2.js --labeller <id> [--relabel]
 *        [--sample-dir config/poetics-calibration/phase2-sample]
 *        [--labels    config/poetics-calibration/phase2-labels-<id>.yaml]
 *
 *   --relabel  re-walk every transcript (default: present only unlabelled ones).
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CALIB_DIR = path.join(ROOT, 'config', 'poetics-calibration');
const SAMPLE_DIR_DEFAULT = path.join(CALIB_DIR, 'phase2-sample');

const RUBRIC_VERSION = 'phase2-form-3way-v1';

// Decision order IS the numbering: ask "recohering?" first, then "insight-claim
// without it?" (trap), else flat. Letters mirror the words.
const CATEGORIES = {
  recognition: { keys: ['1', 'r'] },
  trap: { keys: ['2', 't'] },
  flat: { keys: ['3', 'f'] },
};

const FRAMING =
  'FORM classification of the transcript-as-drama. NOT a judgment of whether the ' +
  'learner learned (unknowable, and not what this measures).';

const INTRO = `
══════════════════════════════════════════════════════════════════════
  PHASE-2 FORM LABELLING — read once
══════════════════════════════════════════════════════════════════════

You are classifying the FORM of each transcript as a piece of drama. You are
NOT judging whether the learner "really understood" anything — that is
unknowable and not what this measures. Ask ONLY this question about the TEXT:

    Does a LATER learner turn re-read the learner's OWN earlier turns, so that
    those earlier turns now mean something different than they did at the time?

That re-reading ("recohering") is a relation you can POINT TO in the text — a
specific learner turn that turns back on the earlier ones and re-semanticizes
them. It is not a feeling you infer about the learner.

Decide in this order:

  [1/r] recognition — YES: a learner turn recoheres earlier learner turns.
                      You can name the turn that does it.
  [2/t] trap        — NO recohering, BUT the learner DECLARES understanding
                      ("now I get it", "that makes sense", "aha"). The costume
                      of insight bolted onto a non-event.
  [3/f] flat        — NO recohering and NO insight-declaration. A coherent,
                      ordinary exchange.

The split that matters most is recognition vs trap: same insight-vocabulary may
appear in both — only recognition has a turn that actually re-reads the earlier
ones. When unsure between trap and recognition, ask: can I quote the earlier
turns being re-read? If not, it is not recognition.

Commands: 1/r 2/t 3/f to label · b=back · s=skip · ?=show rubric · q=save&quit
Progress saves after every label.
`;

const RUBRIC_COMPACT = `  [1/r] recognition — a later learner turn re-reads the learner's OWN earlier turns (name it)
  [2/t] trap        — no recohering, but the learner DECLARES insight ("now I get it")
  [3/f] flat        — no recohering, no insight-claim; ordinary coherent exchange
  (b=back · s=skip · ?=rubric · q=save&quit)`;

// ── args ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const a = { labeller: null, relabel: false, sampleDir: SAMPLE_DIR_DEFAULT, labelsPath: null };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--relabel') a.relabel = true;
    else if (t === '--labeller') a.labeller = argv[++i];
    else if (t === '--sample-dir') a.sampleDir = path.resolve(argv[++i]);
    else if (t === '--labels') a.labelsPath = path.resolve(argv[++i]);
    else throw new Error(`unknown arg: ${t}`);
  }
  return a;
}

// ── sample I/O ────────────────────────────────────────────────────────────────

// Split a neutral T*.txt back into ordered STAGE/TUTOR/LEARNER turns. Blank-line
// separated blocks, each starting "STAGE:" / "TUTOR:" / "LEARNER:"; a stray block
// with no role prefix is appended to the previous turn (defensive — should not
// happen).
function parseTurns(raw) {
  const blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const turns = [];
  for (const b of blocks) {
    const m = b.match(/^(STAGE|TUTOR|LEARNER):\s*([\s\S]*)$/);
    if (m) turns.push({ role: m[1], text: m[2].trim() });
    else if (turns.length) turns[turns.length - 1].text += '\n\n' + b;
  }
  return turns;
}

function loadSample(dir) {
  if (!fs.existsSync(dir))
    throw new Error(`sample dir not found: ${dir}\n  → run scripts/load-poetics-phase2-sample.js first`);
  return fs
    .readdirSync(dir)
    .filter((f) => /\.txt$/.test(f))
    .sort()
    .map((f) => ({ id: path.basename(f, '.txt'), turns: parseTurns(fs.readFileSync(path.join(dir, f), 'utf8')) }));
}

function defaultLabelsPath(labeller) {
  return path.join(CALIB_DIR, `phase2-labels-${labeller}.yaml`);
}

function loadLabels(p, labeller) {
  if (fs.existsSync(p)) {
    const d = yaml.parse(fs.readFileSync(p, 'utf8')) || {};
    d.labels = d.labels || {};
    return d;
  }
  return {
    labeller,
    rubric_version: RUBRIC_VERSION,
    framing: FRAMING,
    categories: {
      recognition: 'a later learner turn re-reads the learner OWN earlier turns (recohering)',
      trap: 'no recohering, but the learner declares understanding ("aha") — insight costume on a non-event',
      flat: 'no recohering and no insight-declaration; ordinary coherent exchange',
    },
    blind: 'labeller sees only neutral T*.txt; stratum/dialogue_id live in the held-out key, joined later',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    labels: {},
  };
}

function saveLabels(p, store) {
  fs.writeFileSync(p, yaml.stringify(store), 'utf8');
}

// ── display ───────────────────────────────────────────────────────────────────

function displayItem(item, store, total) {
  const done = Object.keys(store.labels).length;
  const existing = store.labels[item.id];
  console.log('\n' + '─'.repeat(72));
  console.log(
    `  Sample ${item.id}     (${done}/${total} labelled)${existing ? `     [current: ${existing.label}]` : ''}`,
  );
  console.log('─'.repeat(72) + '\n');
  let sn = 0;
  let tn = 0;
  let ln = 0;
  for (const t of item.turns) {
    const tag = t.role === 'STAGE' ? `S${++sn}` : t.role === 'TUTOR' ? `T${++tn}` : `L${++ln}`;
    console.log(`[${tag}] ${t.role}: ${t.text}\n`);
  }
  console.log(RUBRIC_COMPACT);
}

function printSummary(store, sample, p) {
  const counts = { recognition: 0, trap: 0, flat: 0 };
  for (const v of Object.values(store.labels)) if (counts[v.label] != null) counts[v.label]++;
  const done = Object.keys(store.labels).length;
  console.log('\n' + '═'.repeat(72));
  console.log(`  ${done}/${sample.length} labelled by "${store.labeller}"`);
  console.log(`  recognition ${counts.recognition} · trap ${counts.trap} · flat ${counts.flat}`);
  if (done < sample.length) console.log(`  remaining: ${sample.length - done} (re-run to continue)`);
  console.log(`  labels → ${path.relative(process.cwd(), p)}`);
  console.log('═'.repeat(72) + '\n');
}

// ── interaction ────────────────────────────────────────────────────────────────

const ask = (rl, q) => new Promise((res) => rl.question(q, (a) => res(a)));

function categoryFromInput(s) {
  const t = s.trim().toLowerCase();
  for (const [name, def] of Object.entries(CATEGORIES)) if (def.keys.includes(t)) return name;
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sample = loadSample(args.sampleDir);
  if (!sample.length) throw new Error(`no transcripts in ${args.sampleDir}`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const labeller = (args.labeller || (await ask(rl, 'Labeller id: '))).trim().replace(/[^\w-]/g, '');
    if (!labeller) {
      console.error('A labeller id is required (letters/digits/-/_).');
      return;
    }
    const labelsPath = args.labelsPath || defaultLabelsPath(labeller);
    const store = loadLabels(labelsPath, labeller);
    store.labeller = labeller;

    const queue = args.relabel ? sample.map((s) => s.id) : sample.filter((s) => !store.labels[s.id]).map((s) => s.id);
    if (!queue.length) {
      console.log(`\nAll ${sample.length} transcripts already labelled by "${labeller}".`);
      printSummary(store, sample, labelsPath);
      return;
    }

    console.log(INTRO);
    console.log(
      `Labeller "${labeller}" · ${queue.length} to label${args.relabel ? ' (re-walk)' : ''} · saving to ${path.relative(process.cwd(), labelsPath)}`,
    );
    await ask(rl, 'Press Enter to begin… ');

    let i = 0;
    while (i < queue.length) {
      const item = sample.find((s) => s.id === queue[i]);
      displayItem(item, store, sample.length);

      const ans = (await ask(rl, `\n${item.id} ▶ label [1/r 2/t 3/f · b s ? q]: `)).trim().toLowerCase();
      if (ans === 'q') break;
      if (ans === '?') {
        console.log('\n' + INTRO);
        continue;
      }
      if (ans === 's') {
        i++;
        continue;
      }
      if (ans === 'b') {
        i = Math.max(0, i - 1);
        continue;
      }
      const cat = categoryFromInput(ans);
      if (!cat) {
        console.log('  ? unrecognized — enter 1/r, 2/t, 3/f, or b/s/?/q');
        continue;
      }

      let pivot = null;
      if (cat === 'recognition' || cat === 'trap') {
        const nLearner = item.turns.filter((t) => t.role === 'LEARNER').length;
        const pin = (
          await ask(
            rl,
            `  ▷ pivot learner turn 1-${nLearner} — the turn that ${cat === 'recognition' ? 'recoheres' : 'declares insight'} (Enter=skip): `,
          )
        ).trim();
        if (pin) {
          const v = parseInt(pin, 10);
          if (Number.isInteger(v) && v >= 1 && v <= nLearner) pivot = v;
          else console.log('  (out of range — pivot left blank)');
        }
      }
      const note = (await ask(rl, '  ▷ note (Enter=skip): ')).trim();

      store.labels[item.id] = {
        label: cat,
        pivot_learner_turn: pivot,
        note: note || null,
        labelled_at: new Date().toISOString(),
      };
      store.updated = new Date().toISOString();
      saveLabels(labelsPath, store);
      console.log(
        `  ✓ ${item.id} = ${cat}${pivot ? ` (pivot L${pivot})` : ''}   [saved ${Object.keys(store.labels).length}/${sample.length}]`,
      );
      i++;
    }

    store.updated = new Date().toISOString();
    saveLabels(labelsPath, store);
    printSummary(store, sample, labelsPath);
  } finally {
    rl.close();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

/**
 * Adaptation annotation sheet builder.
 *
 * Turns one outcome-pilot dialogue (a row of results.jsonl) into a
 * self-contained HTML page for structured per-turn annotation by a human
 * reader. For each learner turn the annotator records, BLIND to the tutor's
 * actual reply:
 *
 *   1. the learner state they read (bored, lost, confused, irritated,
 *      frustrated, opposed, jumping ahead, forgetting, on track), and
 *   2. the move a good teacher makes next, from a fixed repertoire
 *      (backtrack, simplify, slow down, speed up, change tone, more words,
 *      fewer words, humor, reinforce and test, off-track probe, continue).
 *
 * Only then does the page reveal the tutor's actual reply and ask whether it
 * made that move (yes / partly / no). The blind-first ordering keeps the gold
 * standard the annotator's own rather than anchored on the tutor's fluency,
 * and the match ratings price the default tutor's repertoire with no judge.
 *
 * The page needs no server: annotations autosave to localStorage and export
 * as JSON (schema machinespirits.adaptation-annotation.v1) for the replay
 * bench to score move-match against other tutor versions later.
 *
 * Usage:
 *   node scripts/build-adaptation-annotation-sheet.js \
 *     --results exports/tutor-stub-outcome/misconception-gate-2/results.jsonl \
 *     [--k 0,2 | all] [--out exports/adaptation-annotation] [--annotator id]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ADAPTATION_ANNOTATION_SCHEMA = 'machinespirits.adaptation-annotation.v1';

export const LEARNER_STATES = Object.freeze([
  { id: 'on_track', label: 'On track — engaged, following' },
  { id: 'bored', label: 'Bored — attention drifting' },
  { id: 'lost', label: 'Lost — no longer knows where we are' },
  { id: 'confused', label: 'Confused — misreads the current point' },
  { id: 'irritated', label: 'Irritated — rubbed wrong by the exchange' },
  { id: 'frustrated', label: 'Frustrated — effort not paying off' },
  { id: 'opposed', label: 'Opposed — committed against the content' },
  { id: 'jumping_ahead', label: 'Jumping ahead — concluding early' },
  { id: 'forgetting', label: 'Forgetting — earlier steps have dropped out' },
]);

export const TEACHER_MOVES = Object.freeze([
  { id: 'continue', label: 'Continue — no correction needed, advance' },
  { id: 'backtrack', label: 'Backtrack — return to an earlier step' },
  { id: 'simplify', label: 'Simplify — same point, plainer terms' },
  { id: 'slow_down', label: 'Slow down — smaller steps, more room' },
  { id: 'speed_up', label: 'Speed up — cut to the next real thing' },
  { id: 'change_tone', label: 'Change tone — warmth, lightness, gravity' },
  { id: 'more_words', label: 'More words — expand, illustrate' },
  { id: 'fewer_words', label: 'Fewer words — compress, get out of the way' },
  { id: 'humor', label: 'Humor — release the pressure' },
  { id: 'reinforce_and_test', label: 'Reinforce and test — consolidate, then check' },
  { id: 'off_track_probe', label: 'Off-track probe — improvise an oblique question' },
]);

function parseArgs(argv) {
  const args = { results: null, k: 'all', out: path.join(ROOT, 'exports', 'adaptation-annotation'), annotator: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--results') args.results = argv[++i];
    else if (a === '--k') args.k = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--annotator') args.annotator = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/build-adaptation-annotation-sheet.js --results <results.jsonl> [--k all|0,2] [--out dir] [--annotator id]',
      );
      process.exit(0);
    } else throw new Error(`unknown flag: ${a}`);
  }
  if (!args.results) throw new Error('--results <results.jsonl> is required');
  return args;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderSheet({ row, sourcePath, annotator }) {
  const docId = `${row.world}-d${row.k}`;
  const meta = {
    schema: ADAPTATION_ANNOTATION_SCHEMA,
    source: sourcePath,
    world: row.world,
    k: row.k,
    armId: row.armId || 'bare',
    annotator,
    states: LEARNER_STATES.map((s) => s.id),
    moves: TEACHER_MOVES.map((m) => m.id),
  };
  const turnsJson = JSON.stringify(
    (row.turns || []).map((t) => ({ index: t.index, learner: t.learner, tutor: t.tutor })),
  );
  const stateOptions = LEARNER_STATES.map((s) => `<option value="${s.id}">${escapeHtml(s.label)}</option>`).join('');
  const moveOptions = TEACHER_MOVES.map((m) => `<option value="${m.id}">${escapeHtml(m.label)}</option>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Adaptation annotation — ${escapeHtml(docId)}</title>
<style>
  :root { color-scheme: light dark; --line: #8884; --accent: #2a6f4e; --hide: #d97706; }
  body { font: 16px/1.55 Georgia, serif; max-width: 46rem; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.3rem; } .meta { color: #888; font-size: .85rem; }
  .opening { border-left: 3px solid var(--line); padding-left: .8rem; font-style: italic; }
  .turn { border: 1px solid var(--line); border-radius: 8px; padding: .9rem 1rem; margin: 1.2rem 0; }
  .turn.locked { opacity: .35; pointer-events: none; }
  .speaker { font-weight: bold; font-size: .8rem; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); }
  .tutorbox { border-top: 1px dashed var(--line); margin-top: .8rem; padding-top: .8rem; }
  .tutorbox.hidden .tutortext { display: none; }
  .tutorbox.hidden::before { content: "Tutor reply hidden — tag state and move first."; color: var(--hide); font-size: .85rem; }
  label { display: block; font-size: .85rem; margin-top: .6rem; }
  select, textarea { width: 100%; font: inherit; font-size: .9rem; margin-top: .15rem; }
  textarea { min-height: 2.2rem; }
  .match { margin-top: .6rem; font-size: .9rem; }
  .match span { margin-right: 1rem; white-space: nowrap; }
  button { font: inherit; padding: .4rem .9rem; margin: 1rem .5rem 0 0; cursor: pointer; }
  #exportbox { width: 100%; min-height: 8rem; font: 12px/1.4 monospace; margin-top: 1rem; }
  .progress { position: sticky; top: 0; background: Canvas; padding: .4rem 0; border-bottom: 1px solid var(--line); font-size: .85rem; }
</style>
</head>
<body>
<h1>Adaptation annotation — ${escapeHtml(row.world)} · dialogue ${escapeHtml(String(row.k))}</h1>
<p class="meta">Source: ${escapeHtml(sourcePath)} · schema ${ADAPTATION_ANNOTATION_SCHEMA}. For each learner turn:
read it in context, record the state you see and the move a good teacher makes next, then reveal what the
tutor did and say whether it made your move. Autosaves locally; export JSON when done (partial exports are fine).</p>
<div class="progress" id="progress"></div>
<div class="opening">${escapeHtml(row.openingText || '')}</div>
<div id="turns"></div>
<button id="export">Export JSON</button>
<a id="download" download="${escapeHtml(docId)}-annotation.json" hidden>download</a>
<textarea id="exportbox" hidden readonly></textarea>
<script>
const META = ${JSON.stringify(meta)};
const TURNS = ${turnsJson};
const KEY = 'adaptation-annotation:' + ${JSON.stringify(docId)};
const saved = JSON.parse(localStorage.getItem(KEY) || '{}');

const container = document.getElementById('turns');
for (const t of TURNS) {
  const card = document.createElement('div');
  card.className = 'turn locked';
  card.id = 'turn-' + t.index;
  card.innerHTML =
    '<div class="speaker">Learner — turn ' + t.index + '</div>' +
    '<div>' + escapeText(t.learner) + '</div>' +
    '<label>Learner state <select data-f="state"><option value="">—</option>${stateOptions.replaceAll("'", "\\'")}</select></label>' +
    '<label>The move a good teacher makes next <select data-f="move"><option value="">—</option>${moveOptions.replaceAll("'", "\\'")}</select></label>' +
    '<label>Why / what is not working (optional) <textarea data-f="note"></textarea></label>' +
    '<div class="tutorbox hidden"><div class="speaker">Tutor — actual reply</div>' +
    '<div class="tutortext">' + escapeText(t.tutor) + '</div>' +
    '<div class="match tutortext">Did it make your move? ' +
    ['yes','partly','no'].map(v => '<span><label style="display:inline"><input type="radio" name="match-' + t.index + '" value="' + v + '"> ' + v + '</label></span>').join('') +
    '</div></div>';
  container.appendChild(card);
}

function escapeText(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function record(index) {
  const card = document.getElementById('turn-' + index);
  const get = (f) => card.querySelector('[data-f="' + f + '"]').value;
  const match = card.querySelector('input[name="match-' + index + '"]:checked');
  return { index, state: get('state'), move: get('move'), note: get('note'), actualMoveMatch: match ? match.value : '' };
}

function refresh() {
  let unlocked = true;
  let done = 0;
  for (const t of TURNS) {
    const card = document.getElementById('turn-' + t.index);
    const r = record(t.index);
    const tagged = r.state && r.move;
    const complete = tagged && r.actualMoveMatch;
    card.classList.toggle('locked', !unlocked);
    card.querySelector('.tutorbox').classList.toggle('hidden', !tagged);
    if (complete) done += 1;
    if (unlocked && !complete) unlocked = false;
  }
  document.getElementById('progress').textContent = done + ' / ' + TURNS.length + ' turns annotated';
  localStorage.setItem(KEY, JSON.stringify({ turns: TURNS.map((t) => record(t.index)) }));
}

for (const t of TURNS) {
  const card = document.getElementById('turn-' + t.index);
  const prior = (saved.turns || []).find((x) => x.index === t.index) || {};
  for (const f of ['state', 'move', 'note']) if (prior[f]) card.querySelector('[data-f="' + f + '"]').value = prior[f];
  if (prior.actualMoveMatch) {
    const radio = card.querySelector('input[name="match-' + t.index + '"][value="' + prior.actualMoveMatch + '"]');
    if (radio) radio.checked = true;
  }
  card.addEventListener('change', refresh);
  card.addEventListener('input', refresh);
}
refresh();

document.getElementById('export').addEventListener('click', () => {
  const payload = { ...META, exportedAt: new Date().toISOString(), turns: TURNS.map((t) => record(t.index)) };
  const json = JSON.stringify(payload, null, 2);
  const box = document.getElementById('exportbox');
  box.hidden = false;
  box.value = json;
  const a = document.getElementById('download');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  a.hidden = false;
  a.click();
});
</script>
</body>
</html>
`;
}

function main() {
  const args = parseArgs(process.argv);
  const resultsPath = path.resolve(ROOT, args.results);
  const rows = fs
    .readFileSync(resultsPath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  const wanted = args.k === 'all' ? null : new Set(args.k.split(',').map((v) => Number(v)));
  const selected = rows.filter((row) => !wanted || wanted.has(Number(row.k)));
  if (!selected.length) {
    console.error('no dialogues matched; results has k values', rows.map((r) => r.k).join(', '));
    process.exit(1);
  }
  fs.mkdirSync(args.out, { recursive: true });
  for (const row of selected) {
    const outPath = path.join(args.out, `${row.world}-d${row.k}-annotation.html`);
    fs.writeFileSync(
      outPath,
      renderSheet({ row, sourcePath: path.relative(ROOT, resultsPath), annotator: args.annotator }),
    );
    console.log('wrote', path.relative(ROOT, outPath), `(${(row.turns || []).length} turns)`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

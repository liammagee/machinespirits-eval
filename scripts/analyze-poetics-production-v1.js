#!/usr/bin/env node
/**
 * Aggregate the Phase-2 poetics production-v1 run from committed score JSON.
 *
 * This is intentionally file-based rather than DB-based: the production-v1
 * dramatic samples are calibration artifacts with public samples, held-out
 * deliberation traces, and independent critic score JSON under
 * config/poetics-calibration/phase2-production-v1/.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_RUN_ROOT = path.join(ROOT, 'config/poetics-calibration/phase2-production-v1');
const DEFAULT_JSON_OUT = path.join(ROOT, 'exports/poetics-production-v1-summary.json');
const DEFAULT_MD_OUT = path.join(ROOT, 'exports/poetics-production-v1-summary.md');

const CRITICS = [
  {
    id: 'qwen',
    label: 'Qwen qwen3.5-plus-02-15',
    slug: 'qwen-qwen3-5-plus-02-15',
  },
  {
    id: 'gemini',
    label: 'Gemini 3.5 Flash',
    slug: 'google-gemini-3-5-flash',
  },
];

const TARGET_ARMS = ['none', 'reframe'];
const CONTROLS = [
  { id: 'd4', label: 'D4 flat' },
  { id: 'd10-emphatic', label: 'D10 emphatic trap' },
];
const STRESS_ID = 'stress-r01';

function parseArgs(argv) {
  const options = {
    rootDir: DEFAULT_RUN_ROOT,
    out: DEFAULT_JSON_OUT,
    markdown: DEFAULT_MD_OUT,
    targetRepeats: null,
    controlRepeats: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--root-dir') options.rootDir = path.resolve(argv[++i]);
    else if (token === '--out') options.out = path.resolve(argv[++i]);
    else if (token === '--markdown') options.markdown = path.resolve(argv[++i]);
    else if (token === '--target-repeats') options.targetRepeats = parseRepeatList(argv[++i]);
    else if (token === '--control-repeats') options.controlRepeats = parseRepeatList(argv[++i]);
    else if (token === '--no-markdown') options.markdown = null;
    else if (token === '--no-json') options.out = null;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/analyze-poetics-production-v1.js [--root-dir DIR] [--out FILE] [--markdown FILE]
      [--target-repeats r01,r02,r03] [--control-repeats r01,r02,r03]
  node scripts/analyze-poetics-production-v1.js --no-json --markdown exports/summary.md`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  return options;
}

function parseRepeatList(value) {
  const repeats = String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (repeats.length === 0) throw new Error('repeat list must not be empty');
  for (const repeat of repeats) {
    if (!/^r\d+$/.test(repeat)) throw new Error(`invalid repeat id: ${repeat}`);
  }
  return repeats;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing score artifact: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function scorePath(rootDir, name) {
  return path.join(rootDir, 'scores', name);
}

function scoreFiles(rootDir) {
  const dir = path.join(rootDir, 'scores');
  if (!fs.existsSync(dir)) throw new Error(`Missing scores directory: ${dir}`);
  return fs.readdirSync(dir).filter((file) => file.endsWith('.json'));
}

function emptyCounts() {
  return { recognition: 0, trap: 0, flat: 0 };
}

function addCounts(target, counts = {}) {
  for (const key of Object.keys(target)) target[key] += counts[key] || 0;
}

function totalCount(counts) {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

function formFor(counts = {}) {
  const entries = Object.entries(counts).filter(([, value]) => value > 0);
  if (entries.length !== 1) return 'mixed';
  return entries[0][0];
}

function discoverTargetRepeats(rootDir) {
  const files = scoreFiles(rootDir);
  const repeatsByCritic = CRITICS.map((critic) => {
    const repeats = new Set();
    for (const file of files) {
      const match = file.match(new RegExp(`^target-(r\\d+)-none-${critic.slug}\\.json$`));
      if (!match) continue;
      const repeat = match[1];
      const hasReframe = files.includes(`target-${repeat}-reframe-${critic.slug}.json`);
      if (hasReframe) repeats.add(repeat);
    }
    return repeats;
  });
  if (repeatsByCritic.length === 0) return [];
  return [...repeatsByCritic[0]]
    .filter((repeat) => repeatsByCritic.every((set) => set.has(repeat)))
    .sort();
}

function discoverControlRepeats(rootDir) {
  const files = scoreFiles(rootDir);
  const repeatsByCritic = CRITICS.map((critic) => {
    const repeats = new Set();
    for (const file of files) {
      const match = file.match(new RegExp(`^control-(r\\d+)-d4-${critic.slug}\\.json$`));
      if (!match) continue;
      const repeat = match[1];
      const hasTrap = files.includes(`control-${repeat}-d10-emphatic-${critic.slug}.json`);
      if (hasTrap) repeats.add(repeat);
    }
    return repeats;
  });
  if (repeatsByCritic.length === 0) return [];
  return [...repeatsByCritic[0]]
    .filter((repeat) => repeatsByCritic.every((set) => set.has(repeat)))
    .sort();
}

function summarizeTargets(rootDir, requestedRepeats = null) {
  const discoveredRepeats = discoverTargetRepeats(rootDir);
  const targetRepeats = requestedRepeats || discoveredRepeats;
  if (targetRepeats.length === 0) throw new Error(`No complete target repeats found under ${rootDir}`);
  const missing = targetRepeats.filter((repeat) => !discoveredRepeats.includes(repeat));
  if (missing.length > 0) throw new Error(`Missing complete target repeat(s): ${missing.join(', ')}`);
  const byCritic = {};
  for (const critic of CRITICS) {
    const arms = {};
    for (const arm of TARGET_ARMS) {
      const totals = emptyCounts();
      const repeats = {};
      for (const repeat of targetRepeats) {
        const filename = `target-${repeat}-${arm}-${critic.slug}.json`;
        const artifact = readJson(scorePath(rootDir, filename));
        const counts = artifact.formCounts || emptyCounts();
        repeats[repeat] = {
          file: path.relative(ROOT, scorePath(rootDir, filename)),
          counts,
          scored: totalCount(counts),
        };
        addCounts(totals, counts);
      }
      arms[arm] = {
        counts: totals,
        scored: totalCount(totals),
        repeats,
      };
    }
    byCritic[critic.id] = {
      label: critic.label,
      arms,
    };
  }
  return byCritic;
}

function summarizeControls(rootDir, requestedRepeats = null) {
  const discoveredRepeats = discoverControlRepeats(rootDir);
  const controlRepeats = requestedRepeats || discoveredRepeats;
  const missing = controlRepeats.filter((repeat) => !discoveredRepeats.includes(repeat));
  if (missing.length > 0) throw new Error(`Missing complete control repeat(s): ${missing.join(', ')}`);
  const rows = [];
  for (const repeat of controlRepeats) {
    for (const control of CONTROLS) {
      const row = {
        repeat,
        control: control.id,
        label: control.label,
        critics: {},
      };
      for (const critic of CRITICS) {
        const filename = `control-${repeat}-${control.id}-${critic.slug}.json`;
        const artifact = readJson(scorePath(rootDir, filename));
        const counts = artifact.formCounts || emptyCounts();
        row.critics[critic.id] = {
          file: path.relative(ROOT, scorePath(rootDir, filename)),
          form: formFor(counts),
          counts,
        };
      }
      rows.push(row);
    }
  }
  return rows;
}

function summarizeStress(rootDir) {
  const stress = {};
  for (const critic of CRITICS) {
    const filename = `${STRESS_ID}-${critic.slug}.json`;
    if (!fs.existsSync(scorePath(rootDir, filename))) continue;
    const artifact = readJson(scorePath(rootDir, filename));
    stress[critic.id] = {
      label: critic.label,
      file: path.relative(ROOT, scorePath(rootDir, filename)),
      counts: artifact.formCounts || emptyCounts(),
      scored: totalCount(artifact.formCounts || emptyCounts()),
      byTranscript: (artifact.scored || []).map((row) => ({
        id: row.id,
        form: row.formClass,
        recontextualization: row.recontextualization,
        statedInsight: row.statedInsight,
        rupture: row.rupture,
        flags: row.flags || [],
      })),
    };
  }
  return stress;
}

function buildSummary(rootDir, options = {}) {
  const target = summarizeTargets(rootDir, options.targetRepeats);
  const controls = summarizeControls(rootDir, options.controlRepeats);
  const stress = summarizeStress(rootDir);
  return {
    generatedAt: new Date().toISOString(),
    sourceRoot: path.relative(ROOT, rootDir),
    targetRepeats: options.targetRepeats || discoverTargetRepeats(rootDir),
    controlRepeats: options.controlRepeats || discoverControlRepeats(rootDir),
    critics: CRITICS.map(({ id, label }) => ({ id, label })),
    target,
    controls,
    stress,
    headline: {
      qwen: {
        noneRecognitions: target.qwen.arms.none.counts.recognition,
        reframeRecognitions: target.qwen.arms.reframe.counts.recognition,
        denominator: target.qwen.arms.none.scored,
      },
      gemini: {
        noneRecognitions: target.gemini.arms.none.counts.recognition,
        reframeRecognitions: target.gemini.arms.reframe.counts.recognition,
        denominator: target.gemini.arms.none.scored,
      },
    },
  };
}

function renderTargetTable(summary) {
  const lines = [
    '| Critic | none recognitions | reframe recognitions | none forms | reframe forms |',
    '|---|---:|---:|---|---|',
  ];
  for (const critic of CRITICS) {
    const row = summary.target[critic.id];
    const none = row.arms.none;
    const reframe = row.arms.reframe;
    lines.push(
      `| ${row.label} | ${none.counts.recognition}/${none.scored} | ${reframe.counts.recognition}/${reframe.scored} | R${none.counts.recognition} T${none.counts.trap} F${none.counts.flat} | R${reframe.counts.recognition} T${reframe.counts.trap} F${reframe.counts.flat} |`,
    );
  }
  return lines.join('\n');
}

function renderControlTable(summary) {
  const lines = ['| Repeat | Control | Qwen | Gemini |', '|---|---|---|---|'];
  for (const row of summary.controls) {
    lines.push(`| ${row.repeat} | ${row.label} | ${row.critics.qwen.form} | ${row.critics.gemini.form} |`);
  }
  return lines.join('\n');
}

function renderStressTable(summary) {
  if (Object.keys(summary.stress).length === 0) return 'No stress slice found for this production root.';
  const lines = ['| Critic | Recognition | Trap | Flat |', '|---|---:|---:|---:|'];
  for (const critic of CRITICS) {
    const row = summary.stress[critic.id];
    lines.push(`| ${row.label} | ${row.counts.recognition} | ${row.counts.trap} | ${row.counts.flat} |`);
  }
  return lines.join('\n');
}

function renderMarkdown(summary) {
  return `# Poetics Production-v1 Summary

Generated: ${summary.generatedAt}

Source root: \`${summary.sourceRoot}\`

## Headline

${renderTargetTable(summary)}

The bounded production-v1 target contrast is strong under both external critics:
Qwen reads \`none\` as ${summary.headline.qwen.noneRecognitions}/${summary.headline.qwen.denominator}
recognition and \`reframe\` as ${summary.headline.qwen.reframeRecognitions}/${summary.headline.qwen.denominator};
Gemini reads \`none\` as ${summary.headline.gemini.noneRecognitions}/${summary.headline.gemini.denominator}
recognition and \`reframe\` as ${summary.headline.gemini.reframeRecognitions}/${summary.headline.gemini.denominator}.

## Controls

${renderControlTable(summary)}

D4 is stable flat in all repeats under both critics. D10 emphatic is trap for both
critics in repeats 2 and 3; repeat 1 preserves the Qwen/Gemini split because the
generated sample contains a real later re-reading hook.

## Stress Slice

${renderStressTable(summary)}

The stress slice is diagnostic rather than part of the headline target contrast:
D16 supplies the clean costume-trap bracket, D8 remains a designed boundary split,
and D13/D15 remain flat under both critics.
`;
}

function writeArtifact(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const summary = buildSummary(options.rootDir, options);
  if (options.out) writeArtifact(options.out, `${JSON.stringify(summary, null, 2)}\n`);
  if (options.markdown) writeArtifact(options.markdown, renderMarkdown(summary));
  console.log(renderTargetTable(summary));
  if (options.out) console.log(`json: ${path.relative(ROOT, options.out)}`);
  if (options.markdown) console.log(`markdown: ${path.relative(ROOT, options.markdown)}`);
}

main();

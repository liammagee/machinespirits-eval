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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
  {
    id: 'deepseek',
    label: 'DeepSeek V4 Pro',
    slug: 'deepseek-deepseek-v4-pro',
  },
  {
    id: 'sonnet46',
    label: 'Claude Sonnet 4.6',
    slug: 'anthropic-claude-sonnet-4-6',
  },
];

const TARGET_ARMS = ['none', 'reframe'];
const CONTROLS = [
  { id: 'd4', label: 'D4 flat', role: 'flat_control', required: true },
  {
    id: 'd10-emphatic',
    label: 'D10 emphatic boundary trap',
    role: 'boundary_trap_control',
    required: true,
  },
  {
    id: 'd25-hard-trap',
    label: 'D25 hard trap',
    role: 'hard_trap_control',
    required: false,
  },
  {
    id: 'd26-hard-trap',
    label: 'D26 hard trap',
    role: 'hard_trap_control',
    required: false,
  },
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

function criticsWithTargetScores(rootDir) {
  const files = scoreFiles(rootDir);
  return CRITICS.filter((critic) =>
    files.some((file) => new RegExp(`^target-r\\d+-(?:none|reframe)-${critic.slug}\\.json$`).test(file)),
  );
}

function criticsWithControlScores(rootDir) {
  const files = scoreFiles(rootDir);
  return CRITICS.filter((critic) =>
    files.some((file) => new RegExp(`^control-r\\d+-[a-z0-9-]+-${critic.slug}\\.json$`).test(file)),
  );
}

function unionCritics(...groups) {
  const seen = new Set();
  const out = [];
  for (const group of groups) {
    for (const critic of group) {
      if (seen.has(critic.id)) continue;
      seen.add(critic.id);
      out.push(critic);
    }
  }
  return out;
}

function discoverTargetRepeats(rootDir, critics = criticsWithTargetScores(rootDir)) {
  const files = scoreFiles(rootDir);
  const repeatsByCritic = critics.map((critic) => {
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
  return [...repeatsByCritic[0]].filter((repeat) => repeatsByCritic.every((set) => set.has(repeat))).sort();
}

function discoverControlRepeats(rootDir, critics = criticsWithTargetScores(rootDir)) {
  const files = scoreFiles(rootDir);
  const requiredControls = CONTROLS.filter((control) => control.required);
  const repeatsByCritic = critics.map((critic) => {
    const repeats = new Set();
    for (const file of files) {
      const match = file.match(new RegExp(`^control-(r\\d+)-${requiredControls[0].id}-${critic.slug}\\.json$`));
      if (!match) continue;
      const repeat = match[1];
      const hasRequired = requiredControls.every((control) =>
        files.includes(`control-${repeat}-${control.id}-${critic.slug}.json`),
      );
      if (hasRequired) repeats.add(repeat);
    }
    return repeats;
  });
  if (repeatsByCritic.length === 0) return [];
  return [...repeatsByCritic[0]].filter((repeat) => repeatsByCritic.every((set) => set.has(repeat))).sort();
}

function summarizeTargets(rootDir, requestedRepeats = null, critics = criticsWithTargetScores(rootDir)) {
  const discoveredRepeats = discoverTargetRepeats(rootDir, critics);
  const targetRepeats = requestedRepeats || discoveredRepeats;
  if (targetRepeats.length === 0) throw new Error(`No complete target repeats found under ${rootDir}`);
  const missing = targetRepeats.filter((repeat) => !discoveredRepeats.includes(repeat));
  if (missing.length > 0) throw new Error(`Missing complete target repeat(s): ${missing.join(', ')}`);
  const byCritic = {};
  for (const critic of critics) {
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

function summarizeControls(rootDir, requestedRepeats = null, critics = criticsWithTargetScores(rootDir)) {
  const targetCritics = criticsWithTargetScores(rootDir);
  const discoveredRepeats = discoverControlRepeats(rootDir, targetCritics);
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
        role: control.role,
        critics: {},
      };
      for (const critic of critics) {
        const filename = `control-${repeat}-${control.id}-${critic.slug}.json`;
        const filePath = scorePath(rootDir, filename);
        if (!fs.existsSync(filePath)) {
          row.critics[critic.id] = {
            file: path.relative(ROOT, filePath),
            form: 'missing',
            counts: emptyCounts(),
          };
          continue;
        }
        const artifact = readJson(filePath);
        const counts = artifact.formCounts || emptyCounts();
        row.critics[critic.id] = {
          file: path.relative(ROOT, filePath),
          form: formFor(counts),
          counts,
        };
      }
      rows.push(row);
    }
  }
  return rows;
}

function summarizeStress(rootDir, critics = criticsWithTargetScores(rootDir)) {
  const stress = {};
  for (const critic of critics) {
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
  const critics = criticsWithTargetScores(rootDir);
  if (critics.length === 0) throw new Error(`No target critic score artifacts found under ${rootDir}`);
  const controlCritics = unionCritics(critics, criticsWithControlScores(rootDir));
  const target = summarizeTargets(rootDir, options.targetRepeats, critics);
  const controls = summarizeControls(rootDir, options.controlRepeats, controlCritics);
  const stress = summarizeStress(rootDir, critics);
  return {
    generatedAt: new Date().toISOString(),
    sourceRoot: path.relative(ROOT, rootDir),
    targetRepeats: options.targetRepeats || discoverTargetRepeats(rootDir, critics),
    controlRepeats: options.controlRepeats || discoverControlRepeats(rootDir, critics),
    critics: critics.map(({ id, label }) => ({ id, label })),
    controlCritics: controlCritics.map(({ id, label }) => ({ id, label })),
    target,
    controls,
    stress,
    headline: Object.fromEntries(
      critics.map((critic) => [
        critic.id,
        {
          noneRecognitions: target[critic.id].arms.none.counts.recognition,
          reframeRecognitions: target[critic.id].arms.reframe.counts.recognition,
          denominator: target[critic.id].arms.none.scored,
        },
      ]),
    ),
  };
}

function renderTargetTable(summary) {
  const lines = [
    '| Critic | none recognitions | reframe recognitions | none forms | reframe forms |',
    '|---|---:|---:|---|---|',
  ];
  for (const critic of summary.critics) {
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
  const critics = summary.controlCritics || summary.critics;
  const lines = [
    `| Repeat | Control | Role | ${critics.map((critic) => critic.label).join(' | ')} |`,
    `|---|---|---|${critics.map(() => '---').join('|')}|`,
  ];
  for (const row of summary.controls) {
    lines.push(
      `| ${row.repeat} | ${row.label} | ${row.role} | ${critics
        .map((critic) => row.critics[critic.id]?.form || 'missing')
        .join(' | ')} |`,
    );
  }
  return lines.join('\n');
}

function renderStressTable(summary) {
  if (Object.keys(summary.stress).length === 0) return '';
  const lines = ['| Critic | Recognition | Trap | Flat |', '|---|---:|---:|---:|'];
  for (const critic of summary.critics) {
    const row = summary.stress[critic.id];
    lines.push(`| ${row.label} | ${row.counts.recognition} | ${row.counts.trap} | ${row.counts.flat} |`);
  }
  return lines.join('\n');
}

function renderMarkdown(summary) {
  const runLabel = path.basename(summary.sourceRoot);
  const hasStress = Object.keys(summary.stress).length > 0;
  const stressNarrative = hasStress
    ? `The stress slice is diagnostic rather than part of the headline target contrast:
D16 supplies the clean costume-trap bracket, D8 remains a designed boundary split,
and D13/D15 remain flat under the available critics.`
    : 'No stress slice is present under this production root.';
  const targetNarrative = summary.critics
    .map((critic) => {
      const row = summary.headline[critic.id];
      return `${critic.label} reads \`none\` as ${row.noneRecognitions}/${row.denominator} recognition and \`reframe\` as ${row.reframeRecognitions}/${row.denominator}`;
    })
    .join(';\n');
  return `# Poetics ${runLabel} Summary

Generated: ${summary.generatedAt}

Source root: \`${summary.sourceRoot}\`

## Headline

${renderTargetTable(summary)}

The target contrast under this production root is:
${targetNarrative}.

## Controls

${renderControlTable(summary)}

The control rows are bracket checks. Preserve any unexpected form as variance;
D10 is now treated as a boundary trap control, not a hard trap: a recognitive
read by some critics means the generated sample crossed the form boundary. Hard
trap controls are separate rows when present. Do not smooth repeat-level control
results into a binary pass/fail.

## Stress Slice

${hasStress ? `${renderStressTable(summary)}\n\n` : ''}${stressNarrative}
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

if (path.resolve(process.argv[1] || '') === __filename) {
  main();
}

export {
  buildSummary,
  CONTROLS,
  CRITICS,
  criticsWithControlScores,
  criticsWithTargetScores,
  renderControlTable,
  renderMarkdown,
  renderTargetTable,
};

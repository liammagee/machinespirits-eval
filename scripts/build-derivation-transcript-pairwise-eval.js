#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_LOOP_DIR = path.join(ROOT, 'exports/dramatic-derivation/loop');
const DEFAULT_OUT_DIR = path.join(ROOT, 'exports/dramatic-derivation/pairwise-transcript-eval');

const RUBRIC = `# Blinded Pairwise Transcript Evaluation Rubric

You are comparing two public tutoring-drama transcripts from the same derivation task. The transcripts are blinded: do not guess which runtime arm produced them, and do not use length alone as evidence.

Judge the public transcript as a didactic play for a human reader. Prefer "no preference" when differences are cosmetic or too small to defend.

Score each transcript from 1 to 5 on:
- Natural didactic-play flow: the exchange can breathe without losing the inquiry.
- Dialogical acknowledgement: tutor and learner visibly register each other's stance.
- Phatic calibration: short acknowledgements and hesitations help thinking rather than padding.
- Non-formalist speech: no raw predicate, variable, board, proof-path, or policy language leaks into public dialogue.
- Readability and orientation: a reader can follow why the current evidence matters.
- Pedagogical traction: the learner appears to take up evidence, recover from strain, or move toward warranted assertion.

Return JSON only:

\`\`\`json
{
  "preferred_transcript": "A | B | no_preference",
  "preference_strength": "none | slight | moderate | strong",
  "scores": {
    "A": {
      "natural_flow": 1,
      "acknowledgement": 1,
      "phatic_calibration": 1,
      "non_formalist_speech": 1,
      "readability": 1,
      "pedagogical_traction": 1
    },
    "B": {
      "natural_flow": 1,
      "acknowledgement": 1,
      "phatic_calibration": 1,
      "non_formalist_speech": 1,
      "readability": 1,
      "pedagogical_traction": 1
    }
  },
  "formalism_leak_observed": {
    "A": false,
    "B": false
  },
  "evidence_A": ["short public-text evidence"],
  "evidence_B": ["short public-text evidence"],
  "reason": "brief comparative rationale"
}
\`\`\`
`;

function usage() {
  return `Usage:
  node scripts/build-derivation-transcript-pairwise-eval.js \\
    --pair <pair-id>=<label-a>,<label-b> [--pair ...] \\
    [--loop-dir exports/dramatic-derivation/loop] \\
    [--out-dir exports/dramatic-derivation/pairwise-transcript-eval] \\
    [--force]
`;
}

export function parsePairSpec(spec) {
  const splitAt = String(spec || '').indexOf('=');
  if (splitAt <= 0) {
    throw new Error(`Invalid --pair ${JSON.stringify(spec)}. Expected <pair-id>=<label-a>,<label-b>.`);
  }
  const pairId = spec.slice(0, splitAt).trim();
  const labels = spec
    .slice(splitAt + 1)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!pairId || labels.length !== 2) {
    throw new Error(`Invalid --pair ${JSON.stringify(spec)}. Expected exactly two labels.`);
  }
  if (labels[0] === labels[1]) {
    throw new Error(`Invalid --pair ${JSON.stringify(spec)}. Labels must differ.`);
  }
  return { pairId, labels };
}

export function parseArgs(argv = []) {
  const pairs = [];
  const opts = {
    loopDir: DEFAULT_LOOP_DIR,
    outDir: DEFAULT_OUT_DIR,
    force: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      return { ...opts, pairs, help: true };
    }
    if (arg === '--force') {
      opts.force = true;
      continue;
    }
    if (arg === '--pair') {
      pairs.push(parsePairSpec(argv[++i]));
      continue;
    }
    if (arg === '--loop-dir') {
      opts.loopDir = path.resolve(ROOT, argv[++i]);
      continue;
    }
    if (arg === '--out-dir') {
      opts.outDir = path.resolve(ROOT, argv[++i]);
      continue;
    }
    throw new Error(`Unknown argument ${arg}\n${usage()}`);
  }
  return { ...opts, pairs };
}

function stableAssignment(pairId, labels) {
  const digest = crypto.createHash('sha256').update(`${pairId}\n${labels.join('\n')}`).digest();
  return digest[0] % 2 === 0
    ? { A: labels[0], B: labels[1], leftSide: 'A', rightSide: 'B' }
    : { A: labels[1], B: labels[0], leftSide: 'B', rightSide: 'A' };
}

function readLive(loopDir, label) {
  const file = path.join(loopDir, label, 'live.json');
  if (!fs.existsSync(file)) {
    throw new Error(`Missing live artifact for ${label}: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function roleName(role) {
  if (role === 'stage' || role === 'director') return 'STAGE';
  if (role === 'tutor') return 'TUTOR';
  if (role === 'learner') return 'LEARNER';
  return null;
}

function normalizePublicText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function renderPublicTranscript(live) {
  const turns = Array.isArray(live?.turns) ? live.turns : [];
  const blocks = [];
  for (const turn of turns) {
    const renderedLines = [];
    for (const line of Array.isArray(turn.lines) ? turn.lines : []) {
      const role = roleName(line.role);
      const text = normalizePublicText(line.text);
      if (!role || !text) continue;
      renderedLines.push(`${role}: ${text}`);
    }
    if (renderedLines.length) {
      blocks.push(`Turn ${turn.turn}\n${renderedLines.join('\n')}`);
    }
  }
  return blocks.join('\n\n');
}

function renderPacket({ packetId, transcriptA, transcriptB }) {
  return `# Pair ${packetId}

Compare Transcript A and Transcript B using the rubric in ../rubric.md. These are public transcripts only. Treat them as blinded samples from the same tutoring task.

## Transcript A

${transcriptA}

## Transcript B

${transcriptB}
`;
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function buildDerivationPairwisePacket({ pairs, loopDir = DEFAULT_LOOP_DIR, outDir = DEFAULT_OUT_DIR, force = false }) {
  if (!Array.isArray(pairs) || !pairs.length) {
    throw new Error(`At least one --pair is required.\n${usage()}`);
  }
  if (fs.existsSync(outDir)) {
    if (!force) throw new Error(`Output directory already exists: ${outDir}. Pass --force to replace packet files.`);
  } else {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const pairsDir = path.join(outDir, 'pairs');
  fs.rmSync(pairsDir, { recursive: true, force: true });
  fs.mkdirSync(pairsDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'rubric.md'), RUBRIC);

  const manifestPairs = [];
  const keyPairs = [];
  pairs.forEach((pair, index) => {
    const packetId = `P${String(index + 1).padStart(2, '0')}`;
    const assignment = stableAssignment(pair.pairId, pair.labels);
    const liveA = readLive(loopDir, assignment.A);
    const liveB = readLive(loopDir, assignment.B);
    const transcriptA = renderPublicTranscript(liveA);
    const transcriptB = renderPublicTranscript(liveB);
    if (!transcriptA || !transcriptB) {
      throw new Error(`Pair ${pair.pairId} has an empty rendered public transcript.`);
    }
    const packetFile = path.join('pairs', `${packetId}.md`);
    fs.writeFileSync(path.join(outDir, packetFile), renderPacket({ packetId, transcriptA, transcriptB }));
    manifestPairs.push({
      pair_id: pair.pairId,
      packet_id: packetId,
      packet: packetFile,
      rubric: 'rubric.md',
    });
    keyPairs.push({
      pair_id: pair.pairId,
      packet_id: packetId,
      left_label: pair.labels[0],
      right_label: pair.labels[1],
      left_side: assignment.leftSide,
      right_side: assignment.rightSide,
      assignment: {
        A: assignment.A,
        B: assignment.B,
      },
    });
  });

  const generatedAt = new Date().toISOString();
  const manifest = {
    schema: 'machinespirits.derivation.blinded_pairwise_transcript_eval.v1',
    generated_at: generatedAt,
    pair_count: manifestPairs.length,
    pairs: manifestPairs,
  };
  const key = {
    schema: 'machinespirits.derivation.blinded_pairwise_transcript_key.v1',
    generated_at: generatedAt,
    loop_dir: loopDir,
    pairs: keyPairs,
  };
  writeJson(path.join(outDir, 'manifest.json'), manifest);
  writeJson(path.join(outDir, 'key.json'), key);
  return { outDir, manifest, key };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    const result = buildDerivationPairwisePacket(args);
    process.stdout.write(`Wrote ${result.manifest.pair_count} blinded pair(s) to ${result.outDir}\n`);
  } catch (err) {
    process.stderr.write(`${err.stack || err.message}\n`);
    process.exit(1);
  }
}

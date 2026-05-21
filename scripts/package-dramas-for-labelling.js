#!/usr/bin/env node
/**
 * Phase-2 cross-author packaging — merge the two arms into ONE blind 36-set.
 *
 * The dramatic-recognition arc runs two arms that share an identical setup map
 * (same {phase2-dramas-v2, phase2-dramas-v3} specs, same seed, --tid-start 6), so
 * every T-id is a matched pair — same setup, different AUTHOR:
 *   Arm A: config/poetics-calibration/phase2-sample-v2     (Claude-authored; codex-judged)
 *   Arm B: config/poetics-calibration/phase2-sample-codex  (codex-authored;  claude-judged)
 * Both arms therefore carry T01..T18, so handing the labeller the two directories
 * would leak the author (which dir a transcript came from). This tool removes that
 * leak: it reads the neutral T*.txt from both arms, RE-SHUFFLES all of them under
 * fresh blind S-ids (S01..S36), and writes a HELD-OUT key
 *   S-id → { arm, author, critic, source_tid, drama_id, discipline, condition,
 *            intended_lean, dramatic_shape, persona }
 * that is the ONLY place the S-id ↔ (arm, T-id) correspondence lives — exactly the
 * quarantine discipline of phase2-key-*.yaml. The human then labels the merged set
 * blind to author AND condition (scripts/label-poetics-phase2.js --sample-dir <merged>).
 *
 * The downstream join is deferred and three-way (never closed-loop):
 *   human label (S-id) → THIS key → (arm, source_tid)
 *                       → that arm's critic-score JSON (keyed source_tid)
 *                       → drama_id → intended_lean (design hypothesis, held out).
 *
 * This is the GENERATIVE read's packaging, NOT a gate: the human is a triangulation
 * second-reader, never a ground-truth oracle (feedback_dramatic_generative_not_oracle).
 *
 * Usage:
 *   node scripts/package-dramas-for-labelling.js                 # both arms → phase2-sample-human36
 *   node scripts/package-dramas-for-labelling.js --force         # overwrite an existing merged set
 *   node scripts/package-dramas-for-labelling.js --allow-partial # package whatever has landed (smoke)
 *   node scripts/package-dramas-for-labelling.js --allow-quality-warnings
 *   node scripts/package-dramas-for-labelling.js --single-dir /tmp/dramas/sample --single-key /tmp/dramas/key.yaml
 * Flags: --arm-a-dir / --arm-b-dir / --arm-a-key / --arm-b-key / --single-dir / --single-key / --out-dir / --key / --seed
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CAL_DIR = path.join(ROOT, 'config', 'poetics-calibration');

// Same mulberry32 + Fisher–Yates as the generator, so the blind shuffle is
// reproducible from --seed and independent of any earlier T-id shuffle.
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseArgs(argv) {
  const a = {
    armADir: path.join(CAL_DIR, 'phase2-sample-v2'),
    armBDir: path.join(CAL_DIR, 'phase2-sample-codex'),
    armAKey: path.join(CAL_DIR, 'phase2-key-v2.yaml'),
    armBKey: path.join(CAL_DIR, 'phase2-key-codex.yaml'),
    outDir: path.join(CAL_DIR, 'phase2-sample-human36'),
    keyPath: path.join(CAL_DIR, 'phase2-key-human36.yaml'),
    seed: 20260520,
    force: false,
    allowPartial: false,
    allowQualityWarnings: false,
    excludeBlockingQualityWarnings: false,
    singleDir: null,
    singleKey: null,
    sourceLabel: 'mixed',
    author: 'mixed',
    critic: 'unscored',
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--force') a.force = true;
    else if (t === '--allow-partial') a.allowPartial = true;
    else if (t === '--allow-quality-warnings') a.allowQualityWarnings = true;
    else if (t === '--exclude-blocking-quality-warnings') a.excludeBlockingQualityWarnings = true;
    else if (t === '--arm-a-dir') a.armADir = path.resolve(argv[++i]);
    else if (t === '--arm-b-dir') a.armBDir = path.resolve(argv[++i]);
    else if (t === '--arm-a-key') a.armAKey = path.resolve(argv[++i]);
    else if (t === '--arm-b-key') a.armBKey = path.resolve(argv[++i]);
    else if (t === '--single-dir') a.singleDir = path.resolve(argv[++i]);
    else if (t === '--single-key') a.singleKey = path.resolve(argv[++i]);
    else if (t === '--source-label') a.sourceLabel = argv[++i];
    else if (t === '--author') a.author = argv[++i];
    else if (t === '--critic') a.critic = argv[++i];
    else if (t === '--out-dir') a.outDir = path.resolve(argv[++i]);
    else if (t === '--key') a.keyPath = path.resolve(argv[++i]);
    else if (t === '--seed') a.seed = parseInt(argv[++i], 10);
    else throw new Error(`unknown arg: ${t}`);
  }
  if (!Number.isInteger(a.seed)) throw new Error('--seed must be an integer');
  if (a.singleKey && !a.singleDir) throw new Error('--single-key requires --single-dir');
  if (a.singleDir && !a.singleKey) a.singleKey = path.join(path.dirname(a.singleDir), 'key.yaml');
  return a;
}

// One arm → list of records {arm, author, critic, source_tid, text, ...keyFields}.
// keyItems may be {} (key not yet written / unreadable) — we still package the
// transcripts, just with null design fields, so a partial smoke works.
function collectArm(
  arm,
  dir,
  keyPath,
  meta,
  { allowQualityWarnings = false, excludeBlockingQualityWarnings = false } = {},
) {
  if (!fs.existsSync(dir)) throw new Error(`source ${arm} sample dir missing: ${dir}`);
  const tids = fs
    .readdirSync(dir)
    .filter((f) => /^T\d+\.txt$/.test(f))
    .map((f) => f.replace(/\.txt$/, ''))
    .sort();
  let keyItems = {};
  if (fs.existsSync(keyPath)) {
    try {
      keyItems = yaml.parse(fs.readFileSync(keyPath, 'utf8'))?.items || {};
    } catch (_) {
      /* leave empty */
    }
  }
  const records = [];
  const skipped = [];
  for (const tid of tids) {
    const k = keyItems[tid] || {};
    const qualityWarnings = Array.isArray(k.quality_warnings) ? k.quality_warnings : [];
    const qualityStatus = k.quality_status || (qualityWarnings.length ? 'review_before_scoring' : 'legacy_unmarked');
    const blockingWarnings = qualityWarnings.filter((warning) => warning.severity !== 'info');
    const legacyBlockingStatus = qualityStatus === 'review_before_scoring' && qualityWarnings.length === 0;
    const hasBlockingQualityWarnings = legacyBlockingStatus || blockingWarnings.length > 0;
    if (!allowQualityWarnings && hasBlockingQualityWarnings) {
      const reason = blockingWarnings.map((w) => w.code).join(',') || qualityStatus;
      if (excludeBlockingQualityWarnings) {
        skipped.push({
          source: arm,
          source_tid: tid,
          reason,
          quality_status: qualityStatus,
          quality_warnings: qualityWarnings,
        });
        continue;
      }
      throw new Error(
        `source ${arm} ${tid} has blocking quality warnings (${reason}); ` +
          'regenerate/exclude before human labelling, pass --exclude-blocking-quality-warnings for a clean subset, ' +
          'or pass --allow-quality-warnings for an explicit audit bundle',
      );
    }
    const effectiveQualityStatus = hasBlockingQualityWarnings
      ? qualityStatus
      : qualityWarnings.length > 0
        ? 'ok_with_info'
        : qualityStatus;
    records.push({
      arm,
      author: meta.author,
      critic: meta.critic,
      source_tid: tid,
      text: fs.readFileSync(path.join(dir, `${tid}.txt`), 'utf8'),
      drama_id: k.drama_id ?? null,
      discipline: k.discipline ?? null,
      condition: k.condition ?? null,
      intended_lean: k.intended_lean ?? null,
      dramatic_shape: k.dramatic_shape ?? null,
      persona: k.persona ?? null,
      quality_status: effectiveQualityStatus,
      source_quality_status: qualityStatus,
      quality_warnings: qualityWarnings,
      quality_blocking_warning_count: blockingWarnings.length + (legacyBlockingStatus ? 1 : 0),
    });
  }
  return { records, skipped };
}

function tally(records, field) {
  const out = {};
  for (const r of records) out[r[field] ?? 'null'] = (out[r[field] ?? 'null'] || 0) + 1;
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const skipped = [];
  let all;
  let complete;
  let sourceMeta;

  if (args.singleDir) {
    const source = collectArm(
      args.sourceLabel,
      args.singleDir,
      args.singleKey,
      { author: args.author, critic: args.critic },
      {
        allowQualityWarnings: args.allowQualityWarnings,
        excludeBlockingQualityWarnings: args.excludeBlockingQualityWarnings,
      },
    );
    all = source.records;
    skipped.push(...source.skipped);
    complete = skipped.length === 0;
    sourceMeta = {
      [args.sourceLabel]: {
        author: args.author,
        critic: args.critic,
        source_dir: path.relative(ROOT, args.singleDir),
      },
    };

    console.log('\n══ package dramas for human labelling — single source, blind re-id ══');
    console.log(
      `  Source ${args.sourceLabel}: ${all.length} transcript(s) from ${path.relative(ROOT, args.singleDir)}`,
    );
  } else {
    const armA = collectArm(
      'A',
      args.armADir,
      args.armAKey,
      { author: 'claude-opus', critic: 'codex' },
      {
        allowQualityWarnings: args.allowQualityWarnings,
        excludeBlockingQualityWarnings: args.excludeBlockingQualityWarnings,
      },
    );
    const armB = collectArm(
      'B',
      args.armBDir,
      args.armBKey,
      { author: 'codex', critic: 'claude-code' },
      {
        allowQualityWarnings: args.allowQualityWarnings,
        excludeBlockingQualityWarnings: args.excludeBlockingQualityWarnings,
      },
    );
    all = [...armA.records, ...armB.records];
    skipped.push(...armA.skipped, ...armB.skipped);

    console.log('\n══ package dramas for human labelling — merge two arms, blind re-id ══');
    console.log(
      `  Arm A (claude→codex):     ${armA.records.length} transcript(s) from ${path.relative(ROOT, args.armADir)}`,
    );
    console.log(
      `  Arm B (codex→claude):     ${armB.records.length} transcript(s) from ${path.relative(ROOT, args.armBDir)}`,
    );

    const expected = 18;
    complete = armA.records.length === expected && armB.records.length === expected && skipped.length === 0;
    if (!complete && !args.allowPartial) {
      throw new Error(
        `incomplete: expected ${expected}+${expected}=36 clean items ` +
          `(got ${armA.records.length}+${armB.records.length}=${all.length}; skipped ${skipped.length}). ` +
          'Re-run when both arms finish, or pass --allow-partial to package what has landed (smoke).',
      );
    }

    sourceMeta = {
      A: { author: 'claude-opus', critic: 'codex', source_dir: path.relative(ROOT, args.armADir) },
      B: { author: 'codex', critic: 'claude-code', source_dir: path.relative(ROOT, args.armBDir) },
    };
  }

  if (skipped.length > 0 && !args.excludeBlockingQualityWarnings) {
    throw new Error('internal error: skipped items require --exclude-blocking-quality-warnings');
  }
  if (all.length === 0) throw new Error('no transcripts found in either arm');

  if (fs.existsSync(args.outDir) && fs.readdirSync(args.outDir).some((f) => f.endsWith('.txt')) && !args.force) {
    throw new Error(`out-dir already populated: ${args.outDir}\n  → use --force to overwrite`);
  }
  fs.rmSync(args.outDir, { recursive: true, force: true });
  fs.mkdirSync(args.outDir, { recursive: true });

  // Blind shuffle → S-ids. Width tracks the actual count so a partial smoke still pads sanely.
  const rng = mulberry32(args.seed);
  const order = shuffled(all, rng);
  const width = Math.max(2, String(order.length).length);

  const keyItems = {};
  order.forEach((r, i) => {
    const sid = `S${String(i + 1).padStart(width, '0')}`;
    fs.writeFileSync(path.join(args.outDir, `${sid}.txt`), r.text, 'utf8');
    keyItems[sid] = {
      arm: r.arm,
      author: r.author,
      critic: r.critic,
      source_tid: r.source_tid,
      drama_id: r.drama_id,
      discipline: r.discipline,
      condition: r.condition,
      intended_lean: r.intended_lean,
      dramatic_shape: r.dramatic_shape,
      persona: r.persona,
      quality_status: r.quality_status,
      source_quality_status: r.source_quality_status,
      quality_warnings: r.quality_warnings,
      quality_blocking_warning_count: r.quality_blocking_warning_count,
    };
  });

  const keyObj = {
    _comment:
      'HELD OUT — do not read while labelling. The ONLY place the blind S-id ↔ (arm, source_tid) ' +
      'correspondence lives. Join AFTER labels + both critic-score JSONs exist: ' +
      'label(S-id) → this key → (arm, source_tid) → arm critic JSON → drama_id → intended_lean. ' +
      'intended_lean / dramatic_shape are DESIGN HYPOTHESES, never labels. Generative read, not a gate ' +
      '(human = triangulation second-reader, never a ground-truth oracle).',
    generated: new Date().toISOString(),
    seed: args.seed,
    n: order.length,
    complete,
    allow_quality_warnings: args.allowQualityWarnings,
    excluded_blocking_quality_warnings: skipped,
    arms: sourceMeta,
    balance: {
      arm: tally(order, 'arm'),
      condition: tally(order, 'condition'),
      intended_lean: tally(order, 'intended_lean'),
    },
    items: keyItems,
  };
  fs.writeFileSync(args.keyPath, yaml.stringify(keyObj), 'utf8');

  console.log(
    `\n  merged ${order.length} → ${path.relative(ROOT, args.outDir)} (S01..S${String(order.length).padStart(width, '0')})`,
  );
  console.log(`  held-out key → ${path.relative(ROOT, args.keyPath)}`);
  if (skipped.length > 0) {
    console.log(
      `  excluded ${skipped.length} blocking quality item(s): ${skipped.map((s) => s.source_tid).join(', ')}`,
    );
  }
  console.log(
    `  balance: arm=${JSON.stringify(keyObj.balance.arm)} condition=${JSON.stringify(keyObj.balance.condition)}`,
  );
  console.log(`           intended_lean=${JSON.stringify(keyObj.balance.intended_lean)}`);
  if (!complete) {
    const reason = skipped.length > 0 ? 'filtered set — blocking quality items were excluded' : 'partial set';
    console.log(`  ⚠ ${reason}; use only as a clean interim labelling bundle.`);
  }
  console.log(
    `\nnext: node scripts/label-poetics-phase2.js --sample-dir ${path.relative(ROOT, args.outDir)} --labeller liam`,
  );
}

main();

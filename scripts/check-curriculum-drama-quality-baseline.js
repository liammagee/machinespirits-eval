#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKTREE_ROOT = path.resolve(__dirname, '..');
const OPENING_SPEAKERS = new Set(['learner', 'tutor', 'director']);

const HIDDEN_PUBLIC_PATTERNS = [
  { code: 'hash_leak', pattern: /\bsha256:[a-f0-9]{16,}\b/iu },
  { code: 'world_spec_id_leak', pattern: /\bW_AF\d+_CURRICULUM\b/iu },
  { code: 'rhetorical_plan_id_leak', pattern: /\bRDP_AF\d+_CURRICULUM(?:_[A-Z_]+)?\b/iu },
  { code: 'world_adaptation_label_leak', pattern: /\bworld[_ -]adaptation\b/iu },
  { code: 'spec_hash_label_leak', pattern: /\bspec[_ -]hash\b/iu },
  { code: 'misconception_id_leak', pattern: /\bmisconception (?:id|ids|signature|signatures)\b/iu },
  { code: 'answer_key_leak', pattern: /\banswer keys?\b/iu },
  { code: 'verifier_internal_leak', pattern: /\bverifier internals?\b/iu },
  { code: 'hidden_label_leak', pattern: /\bhidden labels?\b/iu },
  { code: 'desired_classification_leak', pattern: /\b(?:evaluator )?desired classifications?\b/iu },
  { code: 'rhetorical_plan_label_leak', pattern: /\brhetorical dramatic plan\b/iu },
];

function parseArgs(argv) {
  const args = {
    keyPath: null,
    transcriptsDir: null,
    expectOpeningSpeaker: null,
    requireWorld: true,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--key') args.keyPath = path.resolve(argv[++i]);
    else if (token === '--transcripts-dir') args.transcriptsDir = path.resolve(argv[++i]);
    else if (token === '--expect-opening-speaker') args.expectOpeningSpeaker = String(argv[++i] || '').toLowerCase();
    else if (token === '--no-world-required') args.requireWorld = false;
    else if (token === '--json') args.json = true;
    else throw new Error(`unknown arg: ${token}`);
  }
  if (!args.keyPath) throw new Error('--key is required');
  if (args.expectOpeningSpeaker && !OPENING_SPEAKERS.has(args.expectOpeningSpeaker)) {
    throw new Error('--expect-opening-speaker must be learner|tutor|director');
  }
  return args;
}

function resolveArtifactPath(value, fallbackBase = WORKTREE_ROOT) {
  if (!value) return null;
  if (path.isAbsolute(value)) return value;
  const rootRelative = path.resolve(WORKTREE_ROOT, value);
  if (fs.existsSync(rootRelative)) return rootRelative;
  return path.resolve(fallbackBase, value);
}

function itemEntries(items) {
  if (Array.isArray(items)) {
    return items.map((item, index) => [item?.tid || item?.id || `item_${index + 1}`, item]);
  }
  return Object.entries(items || {});
}

function pushFailure(failures, code, message, detail = {}) {
  failures.push({ code, message, ...detail });
}

function publicTranscriptPath({ tid, item, key, keyPath, transcriptsDir }) {
  const artifactPath = item?.transcript_artifacts?.public || item?.transcripts?.public || null;
  if (artifactPath) return resolveArtifactPath(artifactPath, path.dirname(keyPath));
  const dir = transcriptsDir || resolveArtifactPath(key.transcripts_dir, path.dirname(keyPath));
  return dir ? path.join(dir, `${tid}.public.txt`) : null;
}

function publicLeakFindings(text) {
  return HIDDEN_PUBLIC_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ code }) => code);
}

function initialStageLineCount(text) {
  let count = 0;
  for (const rawLine of String(text || '').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^(?:TUTOR|LEARNER):/u.test(line)) return count;
    if (/^STAGE:/u.test(line)) {
      count++;
      continue;
    }
    if (count > 0) continue;
    return count;
  }
  return count;
}

function checkCurriculumDramaQualityBaseline(options) {
  const keyPath = path.resolve(options.keyPath);
  const key = yaml.parse(fs.readFileSync(keyPath, 'utf8'));
  const transcriptsDir = options.transcriptsDir ? path.resolve(options.transcriptsDir) : null;
  const failures = [];
  const warnings = [];
  const entries = itemEntries(key.items);

  if (!entries.length) {
    pushFailure(failures, 'missing_items', 'key has no items');
  }
  if ((key.quality_blocking_warning_count || 0) > 0) {
    pushFailure(failures, 'blocking_quality_warnings', 'key reports blocking quality warnings', {
      count: key.quality_blocking_warning_count,
    });
  }

  for (const [tid, item] of entries) {
    if (!item) {
      pushFailure(failures, 'empty_item', `item ${tid} is empty`, { tid });
      continue;
    }
    if (item.quality_status && item.quality_status !== 'ok') {
      pushFailure(failures, 'quality_status_not_ok', `${tid} quality_status is ${item.quality_status}`, { tid });
    }
    for (const warning of item.quality_warnings || []) {
      if (warning?.severity && warning.severity !== 'info') {
        pushFailure(failures, 'non_info_quality_warning', `${tid} has ${warning.severity} quality warning`, {
          tid,
          warning_code: warning.code || null,
        });
      }
      if (warning?.code === 'reframe_cue_not_reframed') {
        pushFailure(failures, 'reframe_cue_not_reframed', `${tid} did not publicly expose the reframe consequence`, {
          tid,
        });
      }
    }

    if (!item.curriculum_binding?.curriculum_id || !item.curriculum_binding?.module_id) {
      pushFailure(failures, 'missing_curriculum_binding', `${tid} lacks curriculum id/module binding`, { tid });
    }

    if (options.requireWorld !== false) {
      if (!item.world_adaptation?.spec_id || !item.world_adaptation?.spec_hash) {
        pushFailure(failures, 'missing_world_adaptation', `${tid} lacks locked world adaptation id/hash`, { tid });
      }
      if (item.world_adaptation && item.world_adaptation.locked_at_compile_time !== true) {
        pushFailure(failures, 'world_not_locked', `${tid} world adaptation is not locked at compile time`, { tid });
      }
      if (!item.rhetorical_dramatic_plan?.plan_id || !item.rhetorical_dramatic_plan?.plan_hash) {
        pushFailure(failures, 'missing_rhetorical_plan', `${tid} lacks rhetorical dramatic plan id/hash`, { tid });
      }
      if (!item.curriculum_script_notes?.rhetoric || !item.curriculum_script_notes?.script_lowering) {
        pushFailure(failures, 'missing_curriculum_script_notes', `${tid} lacks curriculum-to-rhetoric-to-script notes`, {
          tid,
        });
      }
    }

    if (options.expectOpeningSpeaker && item.opening_speaker !== options.expectOpeningSpeaker) {
      pushFailure(
        failures,
        'opening_speaker_mismatch',
        `${tid} opens with ${item.opening_speaker || 'unknown'}, expected ${options.expectOpeningSpeaker}`,
        { tid },
      );
    }
    if (item.opening_speaker_override && item.opening_speaker !== item.opening_speaker_override) {
      pushFailure(
        failures,
        'opening_speaker_override_not_honored',
        `${tid} opening_speaker does not match override`,
        { tid, opening_speaker: item.opening_speaker, override: item.opening_speaker_override },
      );
    }

    const transcriptPath = publicTranscriptPath({ tid, item, key, keyPath, transcriptsDir });
    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      pushFailure(failures, 'missing_public_transcript', `${tid} public transcript is missing`, {
        tid,
        path: transcriptPath,
      });
      continue;
    }

    const publicText = fs.readFileSync(transcriptPath, 'utf8');
    const leakCodes = publicLeakFindings(publicText);
    for (const leakCode of leakCodes) {
      pushFailure(failures, 'public_hidden_leak', `${tid} public transcript leaks hidden curriculum metadata`, {
        tid,
        leak_code: leakCode,
        path: transcriptPath,
      });
    }
    const stageLines = initialStageLineCount(publicText);
    if (stageLines > 1) {
      pushFailure(
        failures,
        'stage_preamble_not_consolidated',
        `${tid} begins with ${stageLines} separate STAGE lines; expected one consolidated scene block`,
        { tid, path: transcriptPath, stage_lines: stageLines },
      );
    }
  }

  return {
    pass: failures.length === 0,
    checked: {
      key: keyPath,
      items: entries.length,
      transcripts_dir: transcriptsDir || resolveArtifactPath(key.transcripts_dir, path.dirname(keyPath)),
    },
    failures,
    warnings,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = checkCurriculumDramaQualityBaseline(args);
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.pass) {
    console.log(`PASS curriculum drama quality baseline (${result.checked.items} item(s))`);
  } else {
    console.error(`FAIL curriculum drama quality baseline (${result.failures.length} failure(s))`);
    for (const failure of result.failures) {
      console.error(`  - ${failure.code}: ${failure.message}`);
    }
  }
  process.exit(result.pass ? 0 : 1);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}

export {
  HIDDEN_PUBLIC_PATTERNS,
  checkCurriculumDramaQualityBaseline,
  initialStageLineCount,
  parseArgs,
  publicLeakFindings,
};

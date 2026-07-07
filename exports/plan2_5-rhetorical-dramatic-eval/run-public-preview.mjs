#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import yaml from 'yaml';

const ROOT = process.cwd();
const EVAL_DIR = path.join(ROOT, 'exports/plan2_5-rhetorical-dramatic-eval');
const SPEC_PATH = path.join(EVAL_DIR, 'af6-comparison-dramas.yaml');

const ORDER = [
  'D_AF6_PLAN25_RDP_ADAPTIVE',
  'D_AF6_PLAN25_RDP_NO_CUE',
  'D_AF6_PLAN25_MISMATCH_AF1_RDP',
  'D_AF6_PLAN25_RDP_DOGMATIC',
  'D_AF6_PLAN25_GENERIC_DIRECT',
];

const CONDITION_INSTRUCTIONS = {
  generic_curriculum_drama:
    'Use the generic curriculum material directly. Keep the model audit artifact visible, but do not use a pre-shaped rhetorical scene, changed public device, class-specific metric repair, or final table update.',
  world_rhetorical_plan_no_cue:
    'Use the public rhetorical scene and evidence standard, but keep the route stable. The tutor should hold the same audit-table questioning route. Do not introduce a new test, counterexample, confusion matrix, precision/recall split, or final artifact repair.',
  mismatched_rhetorical_dramatic_plan:
    'This is a negative-control prompt. The public device is an AI problem formulation card governed by schema/consistency rules, but the learner is trying to justify an AF6 metric claim about accuracy. Do not repair the scene by switching back to a usable metric-audit route. Keep the mismatch visible: the tutor should press card fields and system-classification criteria that do not derive precision, recall, calibration, leakage, or deployment evidence from counts. The ending should expose unresolved or misdirected schema work, not a clean metric-table breakthrough.',
  dogmatic_routine_control:
    'Make the tutor a routine protocol gatekeeper. The tutor withholds the answer and presses sign-off requirements only. The tutor must not ask a consequence-opening question, introduce class-specific counts, derive a confusion matrix, or help the learner repair the claim.',
  adaptive_peripeteia_variant:
    'Make a learner misfit force the tutor to stock-take the failed route and introduce a changed public device or evidence standard. The learner should later perform the new device in their own words.',
};

const LEAK_RE =
  /\b(?:sha256|W_AF\d+|RDP_|D_AF6_PLAN25|evaluation_role|baseline_control_class|hidden label|misconception id|answer key|verifier internals|peripeteia|anagnorisis|ego|superego|director)\b/i;

function parseArgs() {
  const rawArgs = process.argv.slice(2);
  const args = new Set(rawArgs);
  function valueAfter(flag, fallback = null) {
    const index = rawArgs.indexOf(flag);
    return index >= 0 ? rawArgs[index + 1] : fallback;
  }
  return {
    force: args.has('--force'),
    model: process.env.PLAN25_PREVIEW_MODEL || 'haiku',
    attempts: Number(process.env.PLAN25_PREVIEW_ATTEMPTS || 2),
    tag: valueAfter('--tag', process.env.PLAN25_PREVIEW_TAG || 'public-preview-haiku'),
  };
}

function outputPaths(tag) {
  const safeTag = String(tag || 'public-preview-haiku').replace(/[^A-Za-z0-9_.-]/g, '-');
  const outDir = path.join(EVAL_DIR, safeTag);
  return {
    tag: safeTag,
    outDir,
    sampleDir: path.join(outDir, 'sample'),
    keyPath: path.join(outDir, 'key.yaml'),
    metaPath: path.join(outDir, 'generation-metadata.json'),
  };
}

function callClaude(prompt, model) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['--model', model, '--print', prompt], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const started = Date.now();
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      const latencyMs = Date.now() - started;
      if (code !== 0) {
        reject(new Error(stderr || `claude exited with code ${code}`));
      } else {
        resolve({ text: stdout.trim(), latencyMs, stderr: stderr.trim() });
      }
    });
  });
}

function cleanTranscript(raw) {
  let text = String(raw || '').trim();
  text = text.replace(/^```(?:text|txt|markdown|md)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return text;
}

function parseBlocks(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const match = block.match(/^(STAGE|TUTOR|LEARNER):\s*([\s\S]*)$/);
      return match ? { role: match[1], body: match[2].trim(), raw: block } : { role: 'UNKNOWN', body: block, raw: block };
    });
}

function publicSpeechIsQuoted(body) {
  const text = String(body || '').trim();
  return /^["'\u201c\u2018]/.test(text) && /["'\u201d\u2019]$/.test(text);
}

function conditionBehaviorErrors(drama, text) {
  const condition = drama?.condition || '';
  const errors = [];
  const transcript = String(text || '');
  const metricRepair =
    /\b(?:confusion matrix|precision|recall|true positives?|true negatives?|false positives?|false negatives?|specificity|sensitivity|F1|TP|TN|FP|FN|row totals?|column totals?|positive class|negative class|minority class|majority class|subgroup|class-specific|baseline|null classifier|null predictor|majority[- ]class floor|majority\/null floor|two[- ]gate|deployment verdict)\b/i;
  const recognitiveRepair =
    /\b(?:accuracy alone (?:is|isn['’]?t|is not)|accuracy (?:isn['’]?t|is not|doesn['’]?t|does not) enough|high accuracy (?:doesn['’]?t|does not|isn['’]?t|is not)|now the (?:check|test|question)|I was (?:treating|assuming|using|letting|reading)|I should (?:add|revise|change)|I(?:'|’)ll (?:add|revise|change)|add(?:ing)? (?:a )?(?:row|rows|column|columns)|update(?:d|s)? the (?:audit|table|claim)|evidence needs to include)\b/i;
  const organicRecognition =
    /\b(?:I['’]?m realizing|I realize|I see now|that means|I think (?:I|we)['’]?d need|I['’]?d need|we['’]?d need|need to make sure|need to check whether|doesn['’]?t actually tell|does not actually tell|work on new data|beyond the test set|production|errors cluster|test data wasn['’]?t|test data was not|what I still need)\b/i;
  const learnerFinal = [...parseBlocks(transcript)].reverse().find((block) => block.role === 'LEARNER')?.body || '';

  if (condition === 'world_rhetorical_plan_no_cue') {
    if (recognitiveRepair.test(transcript) || organicRecognition.test(transcript) || metricRepair.test(learnerFinal)) {
      errors.push('no_cue_recognition_leak');
    }
  }
  if (condition === 'dogmatic_routine_control') {
    if (recognitiveRepair.test(transcript) || organicRecognition.test(transcript) || metricRepair.test(transcript)) {
      errors.push('dogmatic_repair_leak');
    }
    if (!/\b(?:protocol|threshold|sign-off|signoff|licensed by|requirement|cannot proceed|can['’]?t proceed)\b/i.test(transcript)) {
      errors.push('dogmatic_protocol_pressure_missing');
    }
  }
  if (condition === 'mismatched_rhetorical_dramatic_plan') {
    if (metricRepair.test(transcript) || recognitiveRepair.test(transcript) || organicRecognition.test(transcript)) {
      errors.push('mismatch_metric_repair_leak');
    }
    if (!/\b(?:problem formulation card|System Type|Input\/Output|Decision Boundary|Evidence Source|Classification Rationale|schema|field)\b/i.test(transcript)) {
      errors.push('mismatch_card_device_missing');
    }
  }
  if (condition === 'generic_curriculum_drama') {
    if (metricRepair.test(transcript) || recognitiveRepair.test(transcript) || organicRecognition.test(transcript)) {
      errors.push('generic_metric_repair_leak');
    }
  }
  return errors;
}

function validateTranscript(text, drama = null) {
  const blocks = parseBlocks(text);
  const roles = blocks.map((block) => block.role);
  const errors = [];
  if (blocks.length < 6) errors.push('too_few_blocks');
  if (roles[0] !== 'STAGE') errors.push('missing_opening_stage');
  if (roles.includes('UNKNOWN')) errors.push('unknown_block_prefix');
  if (!roles.includes('STAGE')) errors.push('missing_stage');
  const tutorTurns = roles.filter((role) => role === 'TUTOR').length;
  const learnerTurns = roles.filter((role) => role === 'LEARNER').length;
  if (tutorTurns !== 3) errors.push(`wrong_tutor_turn_count_${tutorTurns}`);
  if (learnerTurns !== 4) errors.push(`wrong_learner_turn_count_${learnerTurns}`);
  if (blocks.some((block) => (block.role === 'TUTOR' || block.role === 'LEARNER') && !publicSpeechIsQuoted(block.body))) {
    errors.push('public_turn_not_quoted');
  }
  if (LEAK_RE.test(text)) errors.push('hidden_or_process_leak');
  errors.push(...conditionBehaviorErrors(drama, text));
  return { ok: errors.length === 0, errors, blocks };
}

function excerpt(value, max = 1000) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function publicConstraints(drama) {
  return (
    drama.curriculum_binding?.rhetorical_public_constraints ||
    drama.curriculum_binding?.world_public_constraints || {
      artifact: drama.curriculum_binding?.main_artifact,
      public_task: drama.topic,
      public_evidence_standard: drama.curriculum_binding?.primary_verifier,
      scene: drama.learner_start_state,
      action_gate: 'Learner makes a bounded, checkable attempt before receiving validation.',
    }
  );
}

function conditionSpecificPublicInstruction(drama) {
  if (drama.condition === 'world_rhetorical_plan_no_cue') {
    return `
No-cue control constraints:
- Keep the learner's first claim basically intact; the learner may notice an uncertainty but must not fully revise the frame.
- Do not introduce or compute precision, recall, a confusion matrix, true positives, true negatives, false positives, or false negatives.
- Do not let the final learner update the table, add metric rows, or state that accuracy alone is not enough.
- Do not let the learner say they are realizing a new frame, name a replacement evidence need, or explain how production evidence should change.
- The final learner turn should be a modest unresolved question or local clarification, not a breakthrough.
`;
  }
  if (drama.condition === 'dogmatic_routine_control') {
    return `
Dogmatic control constraints:
- The visible artifact is a sign-off protocol sheet, not a teaching device.
- The tutor asks only whether required protocol fields are present; do not ask a counterexample, class-balance, or metric-meaning question.
- Do not introduce or compute precision, recall, a confusion matrix, TP, TN, FP, FN, true positives, true negatives, false positives, false negatives, row totals, column totals, positive-class rates, majority/null floor, baseline comparison, or two-gate tests.
- Do not let the learner discover a replacement evidence standard, production-validity check, leakage check, or subgroup/error-cluster check.
- The final learner turn should remain blocked by missing protocol authority, threshold, or source; no claim repair and no table update.
`;
  }
  if (drama.condition === 'generic_curriculum_drama') {
    return `
Generic-direct control constraints:
- Use ordinary curriculum questioning, but do not create a changed public device or final metric repair.
- Do not introduce or compute precision, recall, a confusion matrix, true positives, true negatives, false positives, or false negatives.
- Do not let the learner name a replacement evidence standard, production-validity check, leakage check, or error-cluster check.
- The final learner may name what they still need, but must not update the audit table or state a replacement evidence standard.
`;
  }
  if (drama.condition !== 'mismatched_rhetorical_dramatic_plan') return '';
  return `
Mismatch-specific public setup:
- The visible table of metric counts is absent, locked, or treated as background; do not let the learner compute valid AF6 metrics from it.
- The usable public artifact is the AI problem formulation card with fields such as "system type", "input/output", "decision boundary", "evidence source", and "classification rationale".
- The learner's high-accuracy claim must be routed through that unsuitable card, producing category/schema work that cannot settle whether accuracy, precision, recall, calibration, leakage, or deployment readiness is licensed.
- The tutor may ask precise questions, but the questions should reveal the device mismatch rather than accidentally giving the learner the correct metric-audit device.
- The final learner turn should be a visible but misdirected or unresolved attempt, not a successful metric repair.
- If the transcript contains a confusion matrix, precision, recall, true positives, true negatives, false positives, or false negatives, it has failed this control.
- If the learner says they are realizing a new evidence standard, production-validity check, leakage check, or metric repair need, it has failed this control.
`;
}

function endingExpectation(drama) {
  switch (drama.condition) {
    case 'adaptive_peripeteia_variant':
      return 'The ending learner turn should visibly use the tutor\'s changed public device: revise a criterion, write a new evidence row, or name the replacement check in their own words.';
    case 'world_rhetorical_plan_no_cue':
      return 'The ending learner turn should remain unresolved or locally clarifying. It must not say accuracy alone is not enough, add metric rows, or complete an artifact repair.';
    case 'mismatched_rhetorical_dramatic_plan':
      return 'The ending learner turn should show unresolved or misdirected work caused by the unsuitable card/schema device. It must not complete any valid AF6 metric repair.';
    case 'dogmatic_routine_control':
      return 'The ending learner turn should remain blocked by protocol pressure: missing threshold, authority, or source. Do not complete a calculation or clean revision.';
    case 'generic_curriculum_drama':
      return 'The ending learner turn may identify what is missing, but it should not make a generic artifact improvement, metric repair, or route-change breakthrough.';
    default:
      return 'The ending learner turn should make a bounded attempt appropriate to this condition.';
  }
}

function buildPrompt(drama, attemptError = null) {
  const pc = publicConstraints(drama);
  const verifier = pc.public_evidence_standard || drama.curriculum_binding?.primary_verifier || 'the visible checker';
  const artifact = pc.artifact || drama.curriculum_binding?.main_artifact || 'the visible artifact';
  const scene = pc.scene || drama.learner_start_state || 'a technical review conversation';
  const conditionInstruction = CONDITION_INSTRUCTIONS[drama.condition] || 'Generate the transcript from the public scene constraints.';
  const actionGate = pc.action_gate || 'The learner must identify the uncertain part and make a checkable attempt.';
  const forbidden = [
    ...(pc.forbidden_public_exposure || []),
    'ids',
    'hashes',
    'hidden labels',
    'answer keys',
    'evaluator categories',
    'internal process names',
  ];

  return `Generate one PUBLIC tutoring-drama transcript for a blind evaluation screen.

Output constraints:
- Return only transcript blocks. No preface, notes, markdown fence, ids, or commentary.
- Use exactly these block labels: STAGE:, LEARNER:, TUTOR:.
- Public TUTOR and LEARNER blocks must be direct quoted speech only, starting and ending with double quotation marks.
- Stage blocks may describe visible action or room state, but not hidden instructions.
- Do not mention: ${forbidden.join(', ')}.
- Do not name dramatic theory, authorial process, internal deliberation, or evaluator classes.
- Keep it short enough for a critic to read: 1 opening stage block, 3 learner turns, 3 tutor turns, optional final stage block.
- Follow this shape exactly. Do not add extra TUTOR or LEARNER blocks:
  STAGE: visible scene only
  LEARNER: "direct speech"
  TUTOR: "direct speech"
  LEARNER: "direct speech"
  TUTOR: "direct speech"
  LEARNER: "direct speech"
  TUTOR: "direct speech"
  LEARNER: "direct speech"

Topic: ${drama.topic}
Scene: ${excerpt(scene)}
Visible artifact: ${artifact}
Public evidence standard: ${verifier}
Allowed rhetorical form: ${pc.allowed_rhetorical_form || drama.dialogue_approach || 'artifact-grounded questioning'}
Learner starting pressure: ${excerpt(drama.learner_start_state)}
Learner voice: ${excerpt(drama.learner_voice_constraint)}
Tutor voice: ${excerpt(drama.tutor_voice_constraint || drama.intended_tutor_character)}
Action gate: ${excerpt(actionGate)}
Dramatic shape to make visible: ${excerpt(drama.dramatic_shape)}
Condition instruction: ${conditionInstruction}
${conditionSpecificPublicInstruction(drama)}
Ending expectation: ${endingExpectation(drama)}

The learner's first turn should begin from the tempting claim "High accuracy means a good classifier" unless the public scene makes a different starting claim unavoidable.
${attemptError ? `\nPrevious attempt failed validation for: ${attemptError}. Regenerate cleanly and obey the output constraints exactly.\n` : ''}
`;
}

function keyItem(tid, drama) {
  return {
    source_tid: tid,
    drama_id: drama.id,
    discipline: drama.discipline,
    condition: drama.condition,
    evaluation_role: drama.evaluation_role,
    baseline_control_class: drama.baseline_control_class,
    tutor_profile: drama.tutor_profile,
    learner_profile: drama.learner_profile,
    persona: drama.persona,
    pedagogical_approach: drama.pedagogical_approach,
    dialogue_approach: drama.dialogue_approach,
    dramatic_shape: drama.dramatic_shape,
    intended_tutor_character: drama.intended_tutor_character,
    intended_lean: drama.intended_lean,
    tutor_adaptation_policy: drama.tutor_adaptation_policy,
    director_revisit_policy: drama.director_revisit_policy,
    curriculum_binding: drama.curriculum_binding,
    world_adaptation_spec_id: drama.world_adaptation_spec_id,
    world_adaptation_spec_hash: drama.world_adaptation_spec_hash,
    rhetorical_dramatic_plan_id: drama.rhetorical_dramatic_plan_id,
    rhetorical_dramatic_plan_hash: drama.rhetorical_dramatic_plan_hash,
    turn_plan: drama.turn_plan,
    quality_status: 'ok',
    quality_warnings: [],
  };
}

async function generate() {
  const args = parseArgs();
  const paths = outputPaths(args.tag);
  const spec = yaml.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
  const byId = new Map((spec.dramas || []).map((drama) => [drama.id, drama]));
  fs.mkdirSync(paths.sampleDir, { recursive: true });

  const key = {
    schema_version: 'plan2_5_public_preview_key_v0.1',
    source_spec: path.relative(ROOT, SPEC_PATH),
    sample_dir: path.relative(ROOT, paths.sampleDir),
    generator: 'claude-cli',
    model: args.model,
    tag: paths.tag,
    boundary:
      'Public-preview screen. These transcripts are not full bilateral ego-superego generation; they test whether public constraints can yield scoreable comparison artifacts.',
    items: {},
  };
  const metadata = {
    generated_at: new Date().toISOString(),
    model: args.model,
    source_spec: path.relative(ROOT, SPEC_PATH),
    rows: [],
  };

  for (const [index, dramaId] of ORDER.entries()) {
    const tid = `T${String(index + 1).padStart(2, '0')}`;
    const drama = byId.get(dramaId);
    if (!drama) throw new Error(`Missing drama in spec: ${dramaId}`);
    const outPath = path.join(paths.sampleDir, `${tid}.txt`);
    key.items[tid] = keyItem(tid, drama);
    if (!args.force && fs.existsSync(outPath)) {
      metadata.rows.push({ tid, drama_id: dramaId, condition: drama.condition, reused: true });
      continue;
    }

    let lastError = null;
    for (let attempt = 1; attempt <= args.attempts; attempt += 1) {
      const prompt = buildPrompt(drama, lastError);
      const result = await callClaude(prompt, args.model);
      const text = cleanTranscript(result.text);
      const validation = validateTranscript(text, drama);
      metadata.rows.push({
        tid,
        drama_id: dramaId,
        condition: drama.condition,
        attempt,
        latency_ms: result.latencyMs,
        prompt_chars: prompt.length,
        output_chars: text.length,
        validation_errors: validation.errors,
      });
      if (validation.ok) {
        fs.writeFileSync(outPath, `${text}\n`);
        lastError = null;
        console.log(`${tid} ${drama.condition} ok (${result.latencyMs}ms)`);
        break;
      }
      lastError = validation.errors.join(', ');
      if (attempt === args.attempts) {
        fs.writeFileSync(outPath, `${text}\n`);
        key.items[tid].quality_status = 'review_before_scoring';
        key.items[tid].quality_warnings.push({
          severity: 'warning',
          code: 'preview_generation_validation_failed',
          message: lastError,
        });
        console.log(`${tid} ${drama.condition} wrote with warning: ${lastError}`);
      }
    }
  }

  fs.writeFileSync(paths.keyPath, yaml.stringify(key, { lineWidth: 120 }));
  fs.writeFileSync(paths.metaPath, JSON.stringify(metadata, null, 2));
  console.log(`key: ${path.relative(ROOT, paths.keyPath)}`);
  console.log(`metadata: ${path.relative(ROOT, paths.metaPath)}`);
}

generate().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

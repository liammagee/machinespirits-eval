#!/usr/bin/env node
// Program-2 Phase 0 — dataset extraction (PROGRAM-2-FINETUNE-PLAN.md §8, phase 0).
//
// Walks sealed tutor-stub trace archives and emits fine-tuning datasets built
// entirely from recorded events — nothing is re-derived, no model is called:
//   - taskA-sft.jsonl     compliant warrant/stagnation trigger turns whose
//                         ORIGINAL draft was accepted and leak-clean
//                         (request -> delivered text)
//   - general-sft.jsonl   all audit-accepted, leak-clean original drafts
//   - kto.jsonl           unpaired preference labels: accepted originals
//                         (label true) vs audit-failed originals (label false)
//   - eval-moments.jsonl  every trigger moment (any compliance outcome) with
//                         the exact generation request + a pointer into the
//                         sealed trace, for the Phase 1/4 offline graders
//   - splits.json         deterministic dialogue-level train/dev/heldout split
//   - extraction-report.json  counts, leak-filter losses, per-source yield
//
// The generation request is taken from the turn's ORIGINAL-role model_call
// event (role tutor_stub_tutor), never from repair-role calls, so training
// inputs are exactly the interface the speaking model faced on its first
// attempt. Draft accept/fail labels come from the recorded guard accounting.
//
// Usage:
//   node scripts/program2-extract-dataset.mjs --step4 <archive-root> \
//     [--out <dir>] [--manifest <file>] [--split-seed 20260718]
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function argValue(flag, fallback = null) {
  const i = args.indexOf(flag);
  return i > -1 ? args[i + 1] : fallback;
}
const STEP4_ROOT = argValue('--step4');
if (!STEP4_ROOT) {
  console.error(
    'Usage: node scripts/program2-extract-dataset.mjs --step4 <archive-root> [--out <dir>] [--manifest <file>]',
  );
  process.exit(1);
}
const OUT_DIR = argValue('--out', path.join(process.env.HOME || '.', '.machinespirits-data/program-2/datasets/v1'));
const MANIFEST = argValue('--manifest', null);
const SPLIT_SEED = Number(argValue('--split-seed', '20260718'));
const EXPECTED_GIT_SHA_PREFIX = '91b8a50e';
const SPLIT_FRACTIONS = { train: 0.8, dev: 0.1, heldout: 0.1 };

// Verbatim frozen-apparatus RNG (scripts/analyze-register-confirmatory-step2.js).
function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// ---- load plan metadata (arm/profile/family per job id) ----
const planPath = path.join(STEP4_ROOT, 'launch-plan.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')).plan;
const jobsById = new Map(plan.jobs.map((j) => [j.id, j]));

// ---- walk sealed traces ----
const tracesRoot = path.join(STEP4_ROOT, 'traces');
const dialogueDirs = fs
  .readdirSync(tracesRoot)
  .filter((d) => d.startsWith('step4-'))
  .sort();

const rows = { taskA: [], general: [], kto: [], evalMoments: [] };
const counters = {
  dialogues: 0,
  turns: 0,
  triggerMoments: 0,
  acceptedOriginals: 0,
  failedOriginals: 0,
  missingOriginalCall: 0,
  leakDroppedPositives: 0,
  nonOriginalDeliveryCompliantTaskA: 0,
};

function sealedTraceFile(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  const sealed = files.filter((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes('"type":"run_end"'));
  if (sealed.length !== 1) throw new Error(`${dir}: expected 1 sealed trace, found ${sealed.length}`);
  return path.join(dir, sealed[0]);
}

for (const d of dialogueDirs) {
  const job = jobsById.get(d);
  if (!job) throw new Error(`trace dir ${d} not in launch plan`);
  const traceFile = sealedTraceFile(path.join(tracesRoot, d));
  const text = fs.readFileSync(traceFile, 'utf8');
  const gitMatch = text.match(/"git":\{"sha":"([0-9a-f]{40})"/u);
  if (!gitMatch || !gitMatch[1].startsWith(EXPECTED_GIT_SHA_PREFIX)) throw new Error(`${d}: provenance SHA mismatch`);
  counters.dialogues += 1;

  const originalCalls = new Map(); // turnId -> {request, responseText}
  const complianceByTurnId = new Map();
  const turnCompletes = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const ev = JSON.parse(line);
    if (ev.type === 'model_call' && ev.role === 'tutor_stub_tutor') {
      originalCalls.set(ev.turnId, {
        request: ev.request,
        responseText: ev.response?.text ?? null,
        model: ev.model,
        provider: ev.provider,
      });
    } else if (ev.type === 'point_of_action_compliance' && ev.compliance) {
      complianceByTurnId.set(ev.turnId, ev.compliance);
    } else if (ev.type === 'turn_complete' && ev.turnRecord) {
      turnCompletes.push(ev);
    }
  }

  for (const ev of turnCompletes) {
    const tr = ev.turnRecord;
    const ga = tr.tutorGuardAccounting || {};
    const poa = tr.pointOfAction || {};
    counters.turns += 1;
    const original = originalCalls.get(ev.turnId);
    const base = {
      source: 'step4',
      dialogueId: d,
      family: job.tutorFamily,
      arm: job.arm,
      profile: job.profile,
      turn: ev.turn,
      turnId: ev.turnId,
    };

    if (!original || !original.responseText) {
      counters.missingOriginalCall += 1;
    } else {
      const accepted = ga.outcome === 'guarded_original_accepted';
      const failed = ga.outcome === 'guarded_model_repair_accepted' || ga.outcome === 'guarded_deterministic_fallback';
      const originalLeakOk = ga.originalCandidate?.audits?.leakAudit?.ok !== false;
      const deliveredLeakOk = tr.tutorLeakAudit?.ok !== false;

      if (accepted) {
        counters.acceptedOriginals += 1;
        if (originalLeakOk && deliveredLeakOk) {
          const row = { ...base, request: original.request, target: original.responseText };
          rows.general.push(row);
          rows.kto.push({ ...row, label: true, text: row.target });
        } else {
          counters.leakDroppedPositives += 1;
        }
      } else if (failed) {
        counters.failedOriginals += 1;
        rows.kto.push({
          ...base,
          request: original.request,
          label: false,
          text: original.responseText,
          guardOutcome: ga.outcome,
        });
      }
    }

    if (poa.assigned_trigger) {
      counters.triggerMoments += 1;
      const compliance = complianceByTurnId.get(ev.turnId) || null;
      rows.evalMoments.push({
        ...base,
        trigger: poa.assigned_trigger,
        cofire: poa.cofire === true,
        historicalCompliant: compliance ? compliance.compliant === true : null,
        realizedActionFamily: compliance ? compliance.realized_action_family : null,
        request: original ? original.request : null,
        trace: { file: path.relative(STEP4_ROOT, traceFile), turnId: ev.turnId },
      });
      const compliantAcceptedOriginal =
        compliance?.compliant === true &&
        (tr.tutorGuardAccounting || {}).outcome === 'guarded_original_accepted' &&
        original?.responseText;
      if (compliance?.compliant === true && !compliantAcceptedOriginal) counters.nonOriginalDeliveryCompliantTaskA += 1;
      if (compliantAcceptedOriginal && tr.tutorLeakAudit?.ok !== false) {
        rows.taskA.push({
          ...base,
          trigger: poa.assigned_trigger,
          request: original.request,
          target: original.responseText,
        });
      }
    }
  }
}

// ---- deterministic dialogue-level split, stratified by family x profile ----
const strata = new Map();
for (const d of dialogueDirs) {
  const job = jobsById.get(d);
  const key = `${job.tutorFamily}|${job.profile}`;
  if (!strata.has(key)) strata.set(key, []);
  strata.get(key).push(d);
}
const random = mulberry32(SPLIT_SEED);
const splitOf = new Map();
for (const key of [...strata.keys()].sort()) {
  const ids = strata.get(key).sort();
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const nDev = Math.max(1, Math.round(ids.length * SPLIT_FRACTIONS.dev));
  const nHeld = Math.max(1, Math.round(ids.length * SPLIT_FRACTIONS.heldout));
  ids.forEach((id, idx) => {
    const split = idx < nHeld ? 'heldout' : idx < nHeld + nDev ? 'dev' : 'train';
    splitOf.set(id, split);
  });
}
for (const list of Object.values(rows)) for (const row of list) row.split = splitOf.get(row.dialogueId);

// ---- write outputs ----
fs.mkdirSync(OUT_DIR, { recursive: true });
function writeJsonl(name, list) {
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, list.map((r) => JSON.stringify(r)).join('\n') + (list.length ? '\n' : ''));
  return { name, rows: list.length, sha256: sha256File(file) };
}
const files = [
  writeJsonl('taskA-sft.jsonl', rows.taskA),
  writeJsonl('general-sft.jsonl', rows.general),
  writeJsonl('kto.jsonl', rows.kto),
  writeJsonl('eval-moments.jsonl', rows.evalMoments),
];
const splitsFile = path.join(OUT_DIR, 'splits.json');
fs.writeFileSync(
  splitsFile,
  JSON.stringify(
    {
      schema: 'machinespirits.program2.splits.v1',
      seed: SPLIT_SEED,
      fractions: SPLIT_FRACTIONS,
      byDialogue: Object.fromEntries([...splitOf.entries()].sort()),
    },
    null,
    2,
  ),
);
files.push({ name: 'splits.json', rows: splitOf.size, sha256: sha256File(splitsFile) });

const splitCounts = {};
for (const [name, list] of Object.entries(rows)) {
  splitCounts[name] = { train: 0, dev: 0, heldout: 0 };
  for (const row of list) splitCounts[name][row.split] += 1;
}
const report = {
  schema: 'machinespirits.program2.extraction-report.v1',
  plan: 'PROGRAM-2-FINETUNE-PLAN.md',
  phase: 0,
  splitSeed: SPLIT_SEED,
  source: {
    step4Root: STEP4_ROOT,
    launchPlanSha256: sha256File(planPath),
    expectedGitShaPrefix: EXPECTED_GIT_SHA_PREFIX,
  },
  counters,
  splitCounts,
  leakFilter: {
    droppedPositives: counters.leakDroppedPositives,
    lossFraction: counters.acceptedOriginals > 0 ? counters.leakDroppedPositives / counters.acceptedOriginals : null,
  },
  files,
};
const reportFile = path.join(OUT_DIR, 'extraction-report.json');
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ counters, splitCounts, leakFilter: report.leakFilter }, null, 2));
for (const f of files) console.log(`${f.name}: ${f.rows} rows, sha256 ${f.sha256.slice(0, 16)}…`);
console.log(`outputs: ${OUT_DIR}`);

if (MANIFEST) {
  fs.writeFileSync(
    MANIFEST,
    JSON.stringify(
      {
        schema: 'machinespirits.program2.dataset-manifest.v1',
        generatedAt: new Date().toISOString(),
        outDir: OUT_DIR,
        report: { file: 'extraction-report.json', sha256: sha256File(reportFile) },
        ...report,
      },
      null,
      2,
    ),
  );
  console.log(`manifest: ${MANIFEST}`);
}

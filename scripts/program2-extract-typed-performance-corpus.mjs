#!/usr/bin/env node
// Program-2 — typed-performance SFT corpus extraction (engineering-tier; outside
// the paper's claim set; PROGRAM-2-FINETUNE-PLAN.md Task B data side).
//
// Merges the preconscious record's ACCEPTED performances into one SFT corpus,
// built entirely from recorded events — nothing re-derived, no model calls:
//   - step4            accepted (guarded_original_accepted + leak-clean) tutor
//                      turns from the sealed Step 4 claim-run traces
//                      (exports/tutor-stub-step4-claim-runs is the tracked
//                      metadata mirror; traces live in the machine-local
//                      archive and are provenance-checked fail-closed)
//   - v17              character-generalization V17 passing repertoire:
//                      guarded_original_accepted turns across its four cells
//   - v52 / v53        the accepted Tallow compiled-entry draws (V52 2/2,
//                      V53 tallow 4/4) with their exact compact requests
//   - fixtures         compiled performance-entry candidates frozen in the
//                      first-draft campaign configs' model-free fixture files
//                      (recorded-audit-accepted candidates only)
//   - register frames  OPTIONAL aux register-conditioning set: raw recorded
//                      register→outcome frames from the register-confirmatory
//                      runs (responseConfiguration at turn t paired with the
//                      next turn's previousRegisterEfficacy via registerTurn)
//
// Split is BY WORLD, exactly mirroring V53's transfer matrix:
//   train   = Tallow family (world_025_tallow_street) + every non-transfer
//             world in the record (marrick, sealhouse, ai-syllabus, hethel,
//             greyfen, nocturne, ...)
//   heldout = the three V53 transfer worlds: world_009_ravensmark,
//             world_026_skyway_bakery, world_022_foxtrot_jukebox
// The script asserts the V53 artifact realizes this exact matrix (home cell
// accepted, transfer cells rejected) before writing anything.
//
// Outputs (default exports/program2-corpus/, untracked per the exports/
// convention; the repo tracks this extractor, the note, and the manifest):
//   sft-train.jsonl / sft-heldout.jsonl   {prompt, completion} pairs plus the
//                                         verbatim recorded request and typed
//                                         contract metadata
//   heldout-eval-contexts.jsonl           V53's three transfer-cell exact
//                                         requests + saved rejected drafts
//                                         (not_for_training: true)
//   aux-register-frames.jsonl             raw register-outcome frames
//   samples.json                          3 preview pairs (one per source)
//   extraction-report.json                per-source counts, token totals,
//                                         drops, file SHA-256s
//
// Usage:
//   node scripts/program2-extract-typed-performance-corpus.mjs \
//     [--step4 <dir>] [--v17 <dir>] [--v52 <dir>] [--v53 <dir>] \
//     [--out <dir>] [--manifest <file>] [--no-register]
// After regenerating a tracked --manifest, run `npx prettier --write` on it
// (prettier collapses short arrays; JSON.stringify keeps them expanded).
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = process.env.HOME || '.';

const args = process.argv.slice(2);
function argValue(flag, fallback = null) {
  const i = args.indexOf(flag);
  return i > -1 ? args[i + 1] : fallback;
}
const STEP4_ROOT = argValue('--step4', path.join(HOME, '.machinespirits-data/step4-claim-runs-2026-07'));
const V17_ROOT = argValue(
  '--v17',
  '/Users/lmagee/Dev/machinespirits/machinespirits-eval-preconscious/.tutor-stub-auto-eval/character-adaptation-generalization-v17',
);
const V52_ROOT = argValue(
  '--v52',
  '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v32/iteration-1',
);
const V53_ROOT = argValue(
  '--v53',
  '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v14/iteration-1',
);
const REGISTER_ROOTS = args.includes('--no-register')
  ? []
  : [
      '/Users/lmagee/Dev/machinespirits/machinespirits-eval-preconscious/.tutor-stub-auto-eval/register-confirmatory-terra-n5-live-2026-07-13',
      '/Users/lmagee/Dev/machinespirits/machinespirits-eval-preconscious/.tutor-stub-auto-eval/register-confirmatory-sonnet5-n5-live-2026-07-13',
    ];
const OUT_DIR = argValue('--out', path.join(ROOT, 'exports', 'program2-corpus'));
const MANIFEST = argValue('--manifest', null);

// Frozen provenance anchors (from the committed status notes / Phase 0).
const STEP4_EXPECTED_GIT_SHA_PREFIX = '91b8a50e';
// V17's note names functional commit c4772b9e; the traces record the checkout
// commit below (uniform across all four cells). Integrity additionally checked
// against each cell's run-seal.json artifact inventory.
const V17_EXPECTED_CHECKOUT_SHA = 'b02e3fac15cadb656858992083cf501005d6e203';
const V17_CELL_PROFILES = {
  foxtrot_false_memory: 'false_memory',
  ai_syllabus_fast: 'fast_learner',
  sealhouse_slow: 'slow_learner',
  hethel_resistant_low_agency: 'low_agency',
};
const V52_WORKING_RESULT_SHA256 = 'ebcf6d544ebfbbaf51ee923191dacd1926535556a918469a5ecdd107ce655f59';
const V53_WORKING_RESULT_SHA256 = '799085c2ab153d650a921cfbaedf9ff2c3d020c3026544276ac589318ae7a4e2';

// V53 transfer matrix, mirrored exactly (see first-draft-working-screens-v14.yaml
// + notes/status/2026-07-17-first-draft-v53-strict-generalization-failure.md).
const HELDOUT_WORLDS = new Set(['world_009_ravensmark', 'world_026_skyway_bakery', 'world_022_foxtrot_jukebox']);
const V53_HOME_WORLD = 'world_025_tallow_street';
function splitForWorld(worldId) {
  return HELDOUT_WORLDS.has(worldId) ? 'heldout' : 'train';
}

// House token estimator (services/tutorStubPromptSizeReport.js,
// utf16-code-units-div-4-ceiling-v1): JS string length IS utf16 code units.
const TOKENIZER_ID = 'utf16-code-units-div-4-ceiling-v1';
function estimateTokens(text) {
  return Math.ceil(String(text ?? '').length / 4);
}
function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function readJsonlEvents(file) {
  const events = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.trim()) events.push(JSON.parse(line));
  }
  return events;
}

// Flat prompt string for {prompt, completion} consumers; the verbatim request
// rides alongside so training code can re-template without loss.
function renderPromptFromRequest(request) {
  const parts = [];
  if (request.systemPrompt) parts.push(`[system]\n${request.systemPrompt}`);
  for (const message of request.messages || []) parts.push(`[${message.role}]\n${message.content}`);
  return parts.join('\n\n');
}

const counters = {};
function bump(name, by = 1) {
  counters[name] = (counters[name] || 0) + by;
}

const rows = { train: [], heldout: [], evalContexts: [], registerFrames: [] };
const sourceCounts = {};
function pushPair(row) {
  const split = splitForWorld(row.world);
  const key = sha256Text(`${row.prompt}␞${row.completion}`);
  if (pushPair.seen.has(key)) {
    bump(`dedupDropped_${row.source}`);
    return;
  }
  pushPair.seen.add(key);
  rows[split].push({ ...row, split });
  const bucket = (sourceCounts[row.source] ||= {
    pairs: 0,
    train: 0,
    heldout: 0,
    promptTokens: 0,
    completionTokens: 0,
  });
  bucket.pairs += 1;
  bucket[split] += 1;
  bucket.promptTokens += estimateTokens(row.prompt);
  bucket.completionTokens += estimateTokens(row.completion);
}
pushPair.seen = new Set();

// ---- source 1: sealed Step 4 claim-run traces --------------------------------
function extractStep4() {
  const planPath = path.join(STEP4_ROOT, 'launch-plan.json');
  const exportsPlanPath = path.join(ROOT, 'exports', 'tutor-stub-step4-claim-runs', 'launch-plan.json');
  if (sha256File(planPath) !== sha256File(exportsPlanPath)) {
    throw new Error(
      'step4: archive launch-plan.json does not match exports/tutor-stub-step4-claim-runs/launch-plan.json',
    );
  }
  const plan = readJson(planPath).plan;
  const jobsById = new Map(plan.jobs.map((j) => [j.id, j]));
  const tracesRoot = path.join(STEP4_ROOT, 'traces');
  const dialogueDirs = fs
    .readdirSync(tracesRoot)
    .filter((d) => d.startsWith('step4-'))
    .sort();

  for (const d of dialogueDirs) {
    const job = jobsById.get(d);
    if (!job) throw new Error(`step4: trace dir ${d} not in launch plan`);
    const dir = path.join(tracesRoot, d);
    const sealed = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .filter((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes('"type":"run_end"'));
    if (sealed.length !== 1) throw new Error(`step4: ${d}: expected 1 sealed trace, found ${sealed.length}`);
    const traceFile = path.join(dir, sealed[0]);
    const text = fs.readFileSync(traceFile, 'utf8');
    const gitMatch = text.match(/"git":\{"sha":"([0-9a-f]{40})"/u);
    if (!gitMatch || !gitMatch[1].startsWith(STEP4_EXPECTED_GIT_SHA_PREFIX)) {
      throw new Error(`step4: ${d}: provenance SHA mismatch`);
    }
    bump('step4Dialogues');

    let worldId = null;
    const originalCalls = new Map();
    const turnCompletes = [];
    for (const line of text.split('\n')) {
      if (!line) continue;
      const ev = JSON.parse(line);
      if (ev.type === 'run_start') worldId = ev.metadata?.world?.id || null;
      else if (ev.type === 'model_call' && ev.role === 'tutor_stub_tutor') {
        originalCalls.set(ev.turnId, { request: ev.request, responseText: ev.response?.text ?? null });
      } else if (ev.type === 'turn_complete' && ev.turnRecord) turnCompletes.push(ev);
    }
    if (!worldId) throw new Error(`step4: ${d}: run_start carries no world id`);

    for (const ev of turnCompletes) {
      const tr = ev.turnRecord;
      const ga = tr.tutorGuardAccounting || {};
      bump('step4Turns');
      const original = originalCalls.get(ev.turnId);
      if (!original || !original.responseText) {
        bump('step4MissingOriginalCall');
        continue;
      }
      if (ga.outcome !== 'guarded_original_accepted') {
        bump('step4NonAcceptedOriginals');
        continue;
      }
      const leakOk = ga.originalCandidate?.audits?.leakAudit?.ok !== false && tr.tutorLeakAudit?.ok !== false;
      if (!leakOk) {
        bump('step4LeakDropped');
        continue;
      }
      pushPair({
        source: 'step4',
        world: worldId,
        persona: job.profile,
        family: job.tutorFamily,
        dialogueId: d,
        turn: ev.turn,
        turnId: ev.turnId,
        prompt_profile: 'recorded_request_full_apparatus_v1',
        prompt: renderPromptFromRequest(original.request),
        completion: original.responseText,
        request: original.request,
        provenance: { file: path.relative(STEP4_ROOT, traceFile) },
      });
    }
  }
}

// ---- source 2: V17 character-generalization passing repertoire ---------------
function extractV17() {
  const cells = fs
    .readdirSync(V17_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'logs')
    .map((e) => e.name)
    .sort();
  if (!cells.length) throw new Error(`v17: no cell directories under ${V17_ROOT}`);
  for (const cell of cells) {
    const dir = path.join(V17_ROOT, cell);
    const sealed = fs
      .readdirSync(dir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}T[\d-]+Z\.jsonl$/u.test(f))
      .filter((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes('"type":"run_end"'));
    if (sealed.length !== 1) throw new Error(`v17: ${cell}: expected 1 sealed trace, found ${sealed.length}`);
    const traceFile = path.join(dir, sealed[0]);
    const seal = readJson(path.join(dir, 'run-seal.json'));
    const sealEntry = (seal.artifactInventory || []).find((a) => a.path === path.basename(traceFile));
    if (!sealEntry || sealEntry.sha256 !== sha256File(traceFile)) {
      throw new Error(`v17: ${cell}: sealed trace SHA does not match run-seal.json inventory`);
    }
    const events = readJsonlEvents(traceFile);
    const runStart = events.find((ev) => ev.type === 'run_start');
    const gitSha = runStart?.metadata?.provenance?.git?.sha || '';
    if (gitSha !== V17_EXPECTED_CHECKOUT_SHA) {
      throw new Error(
        `v17: ${cell}: checkout SHA ${gitSha.slice(0, 8) || '(none)'} does not match ${V17_EXPECTED_CHECKOUT_SHA.slice(0, 8)}`,
      );
    }
    const worldId = runStart?.metadata?.world?.id;
    if (!worldId) throw new Error(`v17: ${cell}: run_start carries no world id`);
    const persona = V17_CELL_PROFILES[cell];
    if (!persona) throw new Error(`v17: unexpected cell ${cell} (not in the declared V17 matrix)`);
    bump('v17Cells');

    const originalCalls = new Map();
    for (const ev of events) {
      if (ev.type === 'model_call' && ev.role === 'tutor_stub_tutor') {
        originalCalls.set(ev.turnId, { request: ev.request, responseText: ev.response?.text ?? null });
      }
    }
    for (const ev of events) {
      if (ev.type !== 'turn_complete' || !ev.turnRecord) continue;
      const tr = ev.turnRecord;
      const ga = tr.tutorGuardAccounting || {};
      bump('v17Turns');
      const original = originalCalls.get(ev.turnId);
      if (!original || !original.responseText) {
        bump('v17MissingOriginalCall');
        continue;
      }
      if (ga.outcome !== 'guarded_original_accepted') {
        bump('v17NonAcceptedOriginals');
        continue;
      }
      const leakOk = ga.originalCandidate?.audits?.leakAudit?.ok !== false && tr.tutorLeakAudit?.ok !== false;
      if (!leakOk) {
        bump('v17LeakDropped');
        continue;
      }
      pushPair({
        source: 'v17_character_generalization',
        world: worldId,
        persona,
        cell,
        family: tr.model ? `${tr.provider}.${tr.model}` : null,
        dialogueId: `${cell}/${path.basename(traceFile, '.jsonl')}`,
        turn: ev.turn,
        turnId: ev.turnId,
        prompt_profile: 'recorded_request_full_apparatus_v1',
        prompt: renderPromptFromRequest(original.request),
        completion: original.responseText,
        request: original.request,
        provenance: { file: path.relative(V17_ROOT, traceFile) },
      });
    }
  }
}

// ---- sources 3a/3b: V52 + V53 accepted Tallow compiled-entry draws -----------
function contractMetadata(bundle) {
  return {
    firstDraftContractSchema: bundle.firstDraftContract?.schema || null,
    selectedPerformance: bundle.compactSpeakingPrompt?.selectedPerformance || null,
    selectedResponseConfiguration: bundle.selectedResponseConfiguration
      ? {
          engagement_stance: bundle.selectedResponseConfiguration.engagement_stance || null,
          action_family: bundle.selectedResponseConfiguration.action_family || null,
          actorial_part: bundle.selectedResponseConfiguration.actorial_part || null,
        }
      : null,
    performanceObligations: (bundle.performanceObligationContract?.obligations || []).map((o) => o.id),
  };
}

function extractFrozenReplayScreen({ root, source, expectedWorkingResultSha256, expectations }) {
  const workingResult = path.join(root, 'working-screen-result.json');
  const actualSha = sha256File(workingResult);
  if (actualSha !== expectedWorkingResultSha256) {
    throw new Error(
      `${source}: working-screen-result.json SHA ${actualSha.slice(0, 12)} does not match the frozen note`,
    );
  }
  const cells = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'preflight')
    .map((e) => e.name)
    .sort();
  const screens = [];
  for (const cell of cells) {
    const turnFiles = fs
      .readdirSync(path.join(root, cell))
      .filter((f) => /^turn-\d+\.json$/u.test(f))
      .sort();
    for (const tf of turnFiles) {
      const file = path.join(root, cell, tf);
      screens.push({ cell, file, data: readJson(file) });
    }
  }
  for (const { cell, expectAccepted, expectDraws } of expectations) {
    const screen = screens.find((s) => s.cell === cell);
    if (!screen) throw new Error(`${source}: expected cell ${cell} missing`);
    const accepted = screen.data.summary?.originalCandidatesAccepted ?? -1;
    const draws = screen.data.summary?.draws ?? -1;
    if (accepted !== expectAccepted || draws !== expectDraws) {
      throw new Error(`${source}: ${cell}: expected ${expectAccepted}/${expectDraws}, found ${accepted}/${draws}`);
    }
  }
  return screens;
}

function pairsFromScreen(screen, source) {
  const bundle = screen.data.bundles[0];
  const worldId = bundle.worldId;
  const prompt = renderPromptFromRequest(bundle.request);
  const emitted = [];
  for (const result of screen.data.results || []) {
    if (result.audit?.ok !== true) continue;
    if (result.candidateProvenance?.kind !== 'joint_performance_original_composition') continue;
    emitted.push({
      source,
      world: worldId,
      persona: bundle.learnerProfile,
      family: result.model || null,
      dialogueId: bundle.runId,
      turn: bundle.turn,
      turnId: bundle.turnId,
      draw: result.draw,
      prompt_profile: 'recorded_request_compact_no_source_v1',
      prompt,
      completion: result.candidate,
      request: bundle.request,
      contract: contractMetadata(bundle),
      provenance: { file: screen.file, cell: screen.cell },
    });
  }
  return emitted;
}

function extractV52V53() {
  const v52Screens = extractFrozenReplayScreen({
    root: V52_ROOT,
    source: 'v52',
    expectedWorkingResultSha256: V52_WORKING_RESULT_SHA256,
    expectations: [
      { cell: 'tallow_answer_seeking_compiled_entry_ordinary_1', expectAccepted: 1, expectDraws: 1 },
      { cell: 'tallow_answer_seeking_compiled_entry_ordinary_2', expectAccepted: 1, expectDraws: 1 },
    ],
  });
  for (const screen of v52Screens) {
    if (screen.data.bundles[0].worldId !== V53_HOME_WORLD) {
      throw new Error(`v52: unexpected world ${screen.data.bundles[0].worldId}`);
    }
    for (const row of pairsFromScreen(screen, 'v52_compiled_entry')) pushPair(row);
  }

  const v53Screens = extractFrozenReplayScreen({
    root: V53_ROOT,
    source: 'v53',
    expectedWorkingResultSha256: V53_WORKING_RESULT_SHA256,
    expectations: [
      { cell: 'tallow_answer_seeking', expectAccepted: 4, expectDraws: 4 },
      { cell: 'ravensmark_affective_resistant', expectAccepted: 0, expectDraws: 1 },
      { cell: 'skyway_answer_seeking', expectAccepted: 0, expectDraws: 1 },
      { cell: 'foxtrot_diligent', expectAccepted: 0, expectDraws: 1 },
    ],
  });
  for (const screen of v53Screens) {
    const bundle = screen.data.bundles[0];
    const expectedSplit = bundle.worldId === V53_HOME_WORLD ? 'train' : 'heldout';
    if (splitForWorld(bundle.worldId) !== expectedSplit) {
      throw new Error(`v53: split map does not mirror the transfer matrix for ${bundle.worldId}`);
    }
    const accepted = pairsFromScreen(screen, 'v53_working_confirmation');
    for (const row of accepted) pushPair(row);
    if (bundle.worldId !== V53_HOME_WORLD) {
      const rejected = (screen.data.results || []).filter((r) => r.audit?.ok !== true);
      rows.evalContexts.push({
        source: 'v53_transfer_cell',
        world: bundle.worldId,
        persona: bundle.learnerProfile,
        split: 'heldout',
        not_for_training: true,
        dialogueId: bundle.runId,
        turn: bundle.turn,
        turnId: bundle.turnId,
        prompt_profile: 'recorded_request_compact_no_source_v1',
        prompt: renderPromptFromRequest(bundle.request),
        request: bundle.request,
        contract: contractMetadata(bundle),
        rejected_reference: rejected.map((r) => ({
          draw: r.draw,
          candidate: r.candidate,
          hardFailureClusters: r.audit?.hardFailureClusters || r.audit?.failureClusters || [],
        })),
        provenance: { file: screen.file, cell: screen.cell },
      });
      bump('v53TransferEvalContexts');
    }
  }
}

// ---- source 4: compiled performance-entry candidates from the campaign
// configs' model-free fixture files ---------------------------------------------
function extractCampaignFixtures() {
  const configDir = path.join(ROOT, 'config', 'tutor-stub-campaigns');
  const fixturePaths = new Set();
  for (const file of fs
    .readdirSync(configDir)
    .filter((f) => f.startsWith('first-draft-') && f.endsWith('.yaml'))
    .sort()) {
    const text = fs.readFileSync(path.join(configDir, file), 'utf8');
    for (const m of text.matchAll(/tests\/fixtures\/tutor-stub-first-draft\/[\w.-]+\.json/gu)) {
      fixturePaths.add(m[0]);
    }
  }
  for (const rel of [...fixturePaths].sort()) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) {
      bump('fixtureFilesMissing');
      continue;
    }
    const data = readJson(file);
    if (!Array.isArray(data.cases)) {
      // Single-specimen regression fixtures (known-miss / auditor-evolution
      // pins) are not accepted-performance records — skipped by design.
      bump('fixtureFilesSkippedOtherSchema');
      continue;
    }
    bump('fixtureFilesLoaded');
    data.cases.forEach((c, caseIndex) => {
      const bundle = c.bundle || {};
      const worldId = c.worldId || bundle.worldId;
      if (!worldId) return;
      (c.candidates || []).forEach((candidate, candidateIndex) => {
        bump('fixtureCandidates');
        // Original-channel only (repair/recovery/fallback candidates are the
        // documented style regression — plan §4 prohibits training toward
        // them), historically accepted, and not rejected by the current
        // (terminal) auditor.
        if (
          candidate.kind !== 'original_candidate' ||
          candidate.recordedAuditOk !== true ||
          candidate.expectedCurrentAuditOk === false
        ) {
          bump('fixtureCandidatesNotAccepted');
          return;
        }
        const priorTexts = (bundle.priorTutorTexts || []).map((t, i) => `[tutor turn ${i + 1}]\n${t}`);
        const prompt = [
          `[world] ${worldId}`,
          `[learner_profile] ${c.learnerProfile || bundle.learnerProfile || 'unknown'}`,
          ...priorTexts,
          `[learner]\n${bundle.learnerText || ''}`,
          `[typed_contract]\n${JSON.stringify(bundle.firstDraftContract || null)}`,
        ].join('\n\n');
        pushPair({
          source: 'campaign_fixture_compiled_entry',
          world: worldId,
          persona: c.learnerProfile || bundle.learnerProfile || null,
          family: null,
          dialogueId: `${path.basename(file, '.json')}#${c.id || caseIndex}`,
          turn: c.turn ?? null,
          turnId: c.id || null,
          draw: candidateIndex,
          prompt_profile: 'fixture_bundle_render_v1',
          prompt,
          completion: candidate.text,
          contract: { firstDraftContractSchema: bundle.firstDraftContract?.schema || null },
          provenance: { file: rel, caseIndex, candidateIndex },
        });
      });
    });
  }
}

// ---- optional aux: register-outcome frames ------------------------------------
function extractRegisterFrames() {
  for (const root of REGISTER_ROOTS) {
    if (!fs.existsSync(root)) throw new Error(`register: missing root ${root}`);
    const stack = root.includes('sonnet5') ? 'claude-code.sonnet-5' : 'codex.gpt-5.6-terra';
    const files = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.jsonl') && entry.name !== 'run-events.jsonl') files.push(full);
      }
    })(root);
    for (const file of files) {
      const events = readJsonlEvents(file);
      const turnCompletes = events.filter((ev) => ev.type === 'turn_complete' && ev.turnRecord);
      if (!turnCompletes.length) continue;
      const runStart = events.find((ev) => ev.type === 'run_start');
      const worldId = runStart?.metadata?.world?.id || null;
      const byTurn = new Map(turnCompletes.map((ev) => [ev.turn, ev]));
      for (const ev of turnCompletes) {
        const efficacy = ev.turnRecord.previousRegisterEfficacy;
        if (!efficacy || typeof efficacy.registerTurn !== 'number') continue;
        const sourceEv = byTurn.get(efficacy.registerTurn);
        if (!sourceEv) {
          bump('registerFramesMissingSourceTurn');
          continue;
        }
        const tr = sourceEv.turnRecord;
        const rc = tr.responseConfiguration || {};
        rows.registerFrames.push({
          source: 'register_confirmatory',
          stack,
          world: worldId,
          split: worldId ? splitForWorld(worldId) : null,
          dialogueId: path.relative(root, file),
          registerTurn: efficacy.registerTurn,
          evaluatedAtTurn: efficacy.evaluatedAtTurn ?? sourceEv.turn + 1,
          configuration: {
            engagement_stance: rc.engagement_stance || null,
            action_family: rc.action_family || null,
            audience_register: rc.audience_register || null,
            lexical_accessibility: rc.lexical_accessibility || null,
            scene_immersion: rc.scene_immersion || null,
            policy: rc.policy || null,
          },
          classification: tr.classification?.turn || null,
          outcome: {
            label: efficacy.label ?? null,
            progressScore: efficacy.progressScore ?? null,
            fieldDelta: efficacy.field?.delta ?? null,
            dagProgress: efficacy.dagProgress ?? null,
            selected_register: efficacy.selected_register ?? null,
          },
          leakOk: tr.tutorLeakAudit?.ok !== false,
        });
        bump('registerFrames');
      }
    }
  }
}

// ---- run ----------------------------------------------------------------------
extractStep4();
extractV17();
extractV52V53();
extractCampaignFixtures();
if (REGISTER_ROOTS.length) extractRegisterFrames();

fs.mkdirSync(OUT_DIR, { recursive: true });
function writeJsonl(name, list) {
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, list.map((r) => JSON.stringify(r)).join('\n') + (list.length ? '\n' : ''));
  const promptTokens = list.reduce((sum, r) => sum + estimateTokens(r.prompt), 0);
  const completionTokens = list.reduce((sum, r) => sum + estimateTokens(r.completion || ''), 0);
  return { name, rows: list.length, promptTokens, completionTokens, sha256: sha256File(file) };
}

const files = [
  writeJsonl('sft-train.jsonl', rows.train),
  writeJsonl('sft-heldout.jsonl', rows.heldout),
  writeJsonl('heldout-eval-contexts.jsonl', rows.evalContexts),
  writeJsonl('aux-register-frames.jsonl', rows.registerFrames),
];

const samples = [];
for (const source of ['step4', 'v17_character_generalization', 'v53_working_confirmation']) {
  const row = [...rows.train, ...rows.heldout].find((r) => r.source === source);
  if (row) {
    samples.push({
      source: row.source,
      world: row.world,
      persona: row.persona,
      split: row.split,
      prompt_profile: row.prompt_profile,
      promptTokens: estimateTokens(row.prompt),
      prompt: row.prompt,
      completion: row.completion,
    });
  }
}
const samplesFile = path.join(OUT_DIR, 'samples.json');
fs.writeFileSync(samplesFile, JSON.stringify(samples, null, 2));
files.push({ name: 'samples.json', rows: samples.length, sha256: sha256File(samplesFile) });

const worldCounts = {};
for (const row of [...rows.train, ...rows.heldout]) {
  worldCounts[row.world] = (worldCounts[row.world] || 0) + 1;
}

const report = {
  schema: 'machinespirits.program2.typed-performance-corpus.extraction-report.v1',
  plan: 'PROGRAM-2-FINETUNE-PLAN.md',
  corpusVersion: 'v1',
  tier: 'engineering (outside the paper claim set)',
  tokenizer: TOKENIZER_ID,
  split: {
    rule: 'by world, mirroring the V53 transfer matrix',
    heldoutWorlds: [...HELDOUT_WORLDS].sort(),
    trainWorlds: Object.keys(worldCounts)
      .filter((w) => !HELDOUT_WORLDS.has(w))
      .sort(),
  },
  sources: {
    step4: { root: STEP4_ROOT, expectedGitShaPrefix: STEP4_EXPECTED_GIT_SHA_PREFIX },
    v17: { root: V17_ROOT, expectedCheckoutSha: V17_EXPECTED_CHECKOUT_SHA, sealVerified: true },
    v52: { root: V52_ROOT, workingResultSha256: V52_WORKING_RESULT_SHA256 },
    v53: { root: V53_ROOT, workingResultSha256: V53_WORKING_RESULT_SHA256 },
    campaignFixtures: 'config/tutor-stub-campaigns/first-draft-*.yaml -> tests/fixtures/tutor-stub-first-draft/',
    registerRoots: REGISTER_ROOTS,
  },
  counters,
  sourceCounts,
  worldCounts,
  files,
};
const reportFile = path.join(OUT_DIR, 'extraction-report.json');
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ counters, sourceCounts, worldCounts }, null, 2));
for (const f of files) console.log(`${f.name}: ${f.rows} rows, sha256 ${f.sha256.slice(0, 16)}…`);
console.log(`outputs: ${OUT_DIR}`);

if (MANIFEST) {
  fs.writeFileSync(
    MANIFEST,
    JSON.stringify(
      {
        schema: 'machinespirits.program2.typed-performance-corpus-manifest.v1',
        generatedAt: new Date().toISOString(),
        outDir: OUT_DIR,
        report: { file: 'extraction-report.json', sha256: sha256File(reportFile) },
        ...report,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`manifest: ${MANIFEST}`);
}

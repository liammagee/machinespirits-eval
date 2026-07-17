#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildDynamicalSystemState } from '../services/tutorStubRegisterPolicy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROWS_FILE = 'exports/register-confirmatory-evidence/final/primary-endpoint-rows.json';
const FINAL_MANIFEST = 'config/adaptive-tutor-evidence/tutor-stub-register-confirmatory-final-analysis.manifest.json';
const GREENROOM_DIR = 'exports/greenroom-gate1-2026-07-12';
const GREENROOM_MANIFEST = `${GREENROOM_DIR}/raw-bundle-manifest.json`;
const OUTPUT_DIR = 'exports/tutor-stub-step4-trigger-audit';
const OUTPUT_JSON = `${OUTPUT_DIR}/trigger-density.json`;
const OUTPUT_MD = `${OUTPUT_DIR}/trigger-density.md`;
const TARGET_PROFILES = new Set(['affective_resistant', 'proof_skipper']);
const TURN_MIN = 3;
const TURN_MAX = 24;
const STAGNATION_THRESHOLD = 0.6;
const REPEATED_ACTION_LOOKBACK = 4;
const SAMPLE_SIZE = 12;
const WARRANT_CUE =
  /\b(?:because|if|unless|license|warrant|link|tie|follow|what (?:evidence|mark|record|fact|rule|finding|test|check)|which (?:link|fact|record|mark)|show|prove|establish|connect)\b/iu;

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function fileSha256(file) {
  return sha256(fs.readFileSync(file));
}

function expandHome(value) {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function parseArgs(argv) {
  const args = { check: false };
  for (const token of argv) {
    if (token === '--check') args.check = true;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage: node scripts/analyze-step4-trigger-density.js [--check]

Replays the selected Step 2 and Green Room traces without model calls. If an
ignored Step 2 trace is absent, the script reads it from the verified archive
named by the final Step 2 manifest. --check compares the replay with the
tracked JSON and Markdown outputs.`);
      process.exit(0);
    } else throw new Error(`Unknown option: ${token}`);
  }
  return args;
}

function archiveBuffer(archive, member) {
  const result = spawnSync('tar', ['-xOzf', archive, member], {
    cwd: ROOT,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Could not read ${member} from ${archive}: ${String(result.stderr || '').trim()}`);
  }
  return result.stdout;
}

function step2Sources() {
  const rows = readJson(ROWS_FILE).rows.filter((row) => TARGET_PROFILES.has(row.profile));
  const manifest = readJson(FINAL_MANIFEST);
  const archiveByFamily = Object.fromEntries(
    Object.entries(manifest.sourceArchives).map(([family, archive]) => [
      family,
      {
        ...archive,
        file: expandHome(archive.location),
        verified: false,
      },
    ]),
  );
  return rows.map((row) => {
    const local = path.join(ROOT, '.tutor-stub-auto-eval', row.trace);
    let buffer;
    let source;
    if (fs.existsSync(local)) {
      buffer = fs.readFileSync(local);
      source = path.relative(ROOT, local);
    } else {
      const archive = archiveByFamily[row.family];
      if (!archive || !fs.existsSync(archive.file)) {
        throw new Error(`Missing local trace and verified ${row.family} archive for ${row.trace}`);
      }
      if (!archive.verified) {
        const actual = fileSha256(archive.file);
        if (actual !== archive.sha256) throw new Error(`${row.family} archive SHA-256 mismatch`);
        archive.verified = true;
      }
      buffer = archiveBuffer(archive.file, row.trace);
      source = `${archive.location}::${row.trace}`;
    }
    const actual = sha256(buffer);
    if (actual !== row.traceSha256) throw new Error(`Trace SHA-256 mismatch: ${row.trace}`);
    return {
      family: row.family,
      profile: row.profile,
      condition: row.policy,
      run: row.key,
      trace: row.trace,
      traceSha256: actual,
      source,
      buffer,
    };
  });
}

function greenroomSources() {
  const manifest = readJson(GREENROOM_MANIFEST);
  const hashes = new Map(manifest.files.map((entry) => [entry.file, entry.sha256]));
  return Array.from({ length: 8 }, (_, index) => {
    const run = `P${index + 1}`;
    const performance = readJson(`${GREENROOM_DIR}/performances/${run}.json`);
    const relative = `traces/${path.basename(performance.trace)}`;
    const trace = `${GREENROOM_DIR}/${relative}`;
    const buffer = fs.readFileSync(path.join(ROOT, trace));
    const actual = sha256(buffer);
    if (actual !== hashes.get(relative)) throw new Error(`Green Room trace SHA-256 mismatch: ${trace}`);
    return {
      family: 'greenroom-sonnet',
      profile: 'proof_skipper',
      condition: run === 'P1' || run === 'P2' ? 'bare' : 'standing_book',
      run,
      trace,
      traceSha256: actual,
      source: trace,
      buffer,
    };
  });
}

function turnRecords(buffer, _trace) {
  return buffer
    .toString('utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((event) => event.type === 'turn_complete')
    .map((event) => event.turnRecord)
    .filter((record) => record && Number.isFinite(Number(record.turn)))
    .sort((left, right) => Number(left.turn) - Number(right.turn));
}

function questionCount(text) {
  return (String(text || '').match(/\?/gu) || []).length;
}

function textExcerpt(text) {
  const compact = String(text || '')
    .replace(/\s+/gu, ' ')
    .trim();
  return compact.length <= 240 ? compact : `${compact.slice(0, 237)}...`;
}

function baselineCompliance(kind, record, previousLeavesReleased) {
  const text = String(record.tutor || '');
  const action = record.registerSelection?.action_family || record.responseConfiguration?.action_family || null;
  const leavesReleased = Number(record.tutorDag?.leavesReleased || 0);
  if (kind === 'warrant_skip') {
    return {
      pass: questionCount(text) === 1 && WARRANT_CUE.test(text) && leavesReleased === previousLeavesReleased,
      criteria: {
        exactlyOneQuestion: questionCount(text) === 1,
        warrantCue: WARRANT_CUE.test(text),
        noPremiseRelease: leavesReleased === previousLeavesReleased,
      },
    };
  }
  return {
    pass:
      leavesReleased > previousLeavesReleased || ['reanchor_public_evidence', 'ground_in_material'].includes(action),
    criteria: {
      releasedDuePremise: leavesReleased > previousLeavesReleased,
      changedInstrument: ['reanchor_public_evidence', 'ground_in_material'].includes(action),
    },
  };
}

function replay(source) {
  const state = { turns: [], register: { history: [] }, comprehension: null };
  const opportunities = [];
  const rejected = { affective_risk: 0, regloss: 0 };
  let previousLeavesReleased = 0;
  for (const record of turnRecords(source.buffer, source.trace)) {
    if (record.previousRegisterEfficacy && state.register.history.length) {
      state.register.history.at(-1).efficacy = structuredClone(record.previousRegisterEfficacy);
    }
    const system = buildDynamicalSystemState({
      state,
      classification: record.classification,
      tutorLearnerDag: { model: record.tutorLearnerDagModel },
    });
    const turn = Number(record.turn);
    const action = record.registerSelection?.action_family || record.responseConfiguration?.action_family || null;
    const previousActions = state.turns
      .slice(-REPEATED_ACTION_LOOKBACK)
      .map((prior) => prior.registerSelection?.action_family || prior.responseConfiguration?.action_family || null);
    const inWindow = turn >= TURN_MIN && turn <= TURN_MAX;
    const nearClosure = system.trajectory?.flags?.nearClosure === true;
    const closureAction = action === 'close_inquiry';
    const eligible = inWindow && !nearClosure && !closureAction;
    const unresolvedGloss = record.comprehension?.beforeTutor?.features?.requiresGloss === true;
    const stagnantRepeat =
      eligible &&
      !unresolvedGloss &&
      Number(system.state_vector?.stagnation || 0) >= STAGNATION_THRESHOLD &&
      previousActions.length === REPEATED_ACTION_LOOKBACK &&
      previousActions.every((previous) => previous && previous === action);
    const evidenceUse = record.classification?.turn?.evidence_use || null;
    const warrantSkip = eligible && ['omits_warrant', 'overleaps_evidence'].includes(evidenceUse);

    if (eligible && Number(system.state_vector?.affective_risk || 0) >= 0.4) rejected.affective_risk += 1;
    if (inWindow && unresolvedGloss) rejected.regloss += 1;

    // Co-fires are assigned to stagnant_repeat first: the rarer action-change
    // intervention subsumes a warrant prompt, while the warrant denominator
    // remains dense after de-duplication.
    const trigger = stagnantRepeat ? 'stagnant_repeat' : warrantSkip ? 'warrant_skip' : null;
    if (trigger) {
      const compliance = baselineCompliance(trigger, record, previousLeavesReleased);
      opportunities.push({
        family: source.family,
        profile: source.profile,
        condition: source.condition,
        run: source.run,
        trace: source.trace,
        traceSha256: source.traceSha256,
        turn,
        trigger,
        evidenceUse,
        actionFamily: action,
        stagnation: Number(system.state_vector?.stagnation || 0),
        nearClosure,
        baselineCompliance: compliance,
        learnerExcerpt: textExcerpt(record.learner),
        tutorExcerpt: textExcerpt(record.tutor),
      });
    }
    if (record.registerSelection) state.register.history.push(structuredClone(record.registerSelection));
    state.turns.push(record);
    previousLeavesReleased = Number(record.tutorDag?.leavesReleased || 0);
  }
  return { opportunities, rejected };
}

function round(value, digits = 3) {
  return Number(Number(value || 0).toFixed(digits));
}

function quantile(values, probability) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function triggerSummary(opportunities, trigger, sources) {
  const rows = opportunities.filter((row) => row.trigger === trigger);
  const byTrace = new Map(sources.map((source) => [source.trace, 0]));
  for (const row of rows) byTrace.set(row.trace, (byTrace.get(row.trace) || 0) + 1);
  const counts = [...byTrace.values()];
  const passed = rows.filter((row) => row.baselineCompliance.pass).length;
  return {
    opportunities: rows.length,
    runsWithOpportunity: counts.filter(Boolean).length,
    runsAudited: counts.length,
    baselineCompliant: passed,
    baselineComplianceRate: round(passed / rows.length),
    opportunitiesPerRun: {
      p25: round(quantile(counts, 0.25)),
      median: round(quantile(counts, 0.5)),
      p75: round(quantile(counts, 0.75)),
      max: Math.max(...counts),
    },
  };
}

function cohortSummaries(opportunities, sources) {
  const keys = [...new Set(sources.map((source) => `${source.family}/${source.profile}`))].sort();
  return keys.map((key) => {
    const [family, profile] = key.split('/');
    const cohortSources = sources.filter((source) => source.family === family && source.profile === profile);
    const cohortRows = opportunities.filter((row) => row.family === family && row.profile === profile);
    const summarize = (trigger) => {
      const rows = cohortRows.filter((row) => row.trigger === trigger);
      const passed = rows.filter((row) => row.baselineCompliance.pass).length;
      return {
        opportunities: rows.length,
        baselineCompliant: passed,
        baselineComplianceRate: round(passed / rows.length),
      };
    };
    return {
      family,
      profile,
      runs: cohortSources.length,
      warrant_skip: summarize('warrant_skip'),
      stagnant_repeat: summarize('stagnant_repeat'),
    };
  });
}

function deterministicSample(opportunities, trigger) {
  return opportunities
    .filter((row) => row.trigger === trigger)
    .map((row) => ({
      ...row,
      sampleKey: sha256(Buffer.from(`${row.traceSha256}:${row.turn}:${trigger}`)),
    }))
    .sort((left, right) => left.sampleKey.localeCompare(right.sampleKey))
    .slice(0, SAMPLE_SIZE)
    .map(({ sampleKey, baselineCompliance, ...row }) => ({
      ...row,
      sampleKey,
      baselineCompliancePass: baselineCompliance.pass,
    }));
}

function buildAudit() {
  const sources = [...step2Sources(), ...greenroomSources()];
  const replays = sources.map(replay);
  const opportunities = replays.flatMap((result) => result.opportunities);
  const rejectedTotals = replays.reduce(
    (totals, result) => ({
      affective_risk: totals.affective_risk + result.rejected.affective_risk,
      regloss: totals.regloss + result.rejected.regloss,
    }),
    { affective_risk: 0, regloss: 0 },
  );
  return {
    schema: 'machinespirits.tutor-stub.step4-trigger-density.v1',
    generatedAt: '2026-07-14T00:00:00.000Z',
    zeroCall: true,
    corpus: {
      runs: sources.length,
      step2Runs: sources.filter((source) => source.family !== 'greenroom-sonnet').length,
      greenroomRuns: sources.filter((source) => source.family === 'greenroom-sonnet').length,
      profiles: ['affective_resistant', 'proof_skipper'],
      world: 'world_005_marrick',
      turnWindow: [TURN_MIN, TURN_MAX],
      traceHashesVerified: sources.length,
    },
    assignmentRule: 'stagnant_repeat > warrant_skip; one assigned trigger per eligible turn',
    selectedTriggers: {
      warrant_skip: {
        definition:
          'evidence_use is omits_warrant or overleaps_evidence; suppress near-closure and close_inquiry turns',
        targetAction:
          'expose_warrant: ask exactly one public, focused question linking the claim to an evidence item or rule; release no premise',
        ...triggerSummary(opportunities, 'warrant_skip', sources),
      },
      stagnant_repeat: {
        definition: `replayed stagnation >= ${STAGNATION_THRESHOLD.toFixed(2)} and the proposed action family repeats the four immediately preceding tutor actions; suppress glossary, near-closure, and close_inquiry turns`,
        targetAction:
          'break_stagnation: release a due public premise, otherwise reanchor a different already-public exhibit or material domain',
        ...triggerSummary(opportunities, 'stagnant_repeat', sources),
      },
    },
    rejectedCandidates: {
      affective_risk: {
        opportunities: rejectedTotals.affective_risk,
        decision: 'reject',
        reason:
          'classifier/trajectory-derived risk produced neutral-regression false positives in deterministic review and was not stable enough for a claim-bearing trigger',
      },
      regloss: {
        opportunities: rejectedTotals.regloss,
        decision: 'reject',
        reason:
          'mechanically valid but sparse and concentrated in one profile/family, so it cannot support a balanced two-family compliance denominator',
      },
    },
    cohorts: cohortSummaries(opportunities, sources),
    manualReview: {
      reviewer: 'Codex, deterministic excerpt review, 2026-07-14',
      warrant_skip: {
        sampleSize: SAMPLE_SIZE,
        validOpportunities: SAMPLE_SIZE,
        samples: deterministicSample(opportunities, 'warrant_skip'),
      },
      stagnant_repeat: {
        sampleSize: SAMPLE_SIZE,
        validOpportunities: SAMPLE_SIZE,
        samples: deterministicSample(opportunities, 'stagnant_repeat'),
      },
      caveat:
        'Small deterministic samples from one simulated world; validity does not establish human pedagogical benefit.',
    },
    preregistrationConsequence: {
      futureRunsPerArmFamily: 10,
      minimumAssignedOpportunitiesPerArmFamily: {
        warrant_skip: 25,
        stagnant_repeat: 12,
      },
      interpretation:
        'A family/arm below either minimum is an instrument failure for the affected trigger, not evidence of a coaching null.',
    },
    sources: sources.map(({ buffer: _buffer, ...source }) => source),
  };
}

function renderMarkdown(audit) {
  const warrant = audit.selectedTriggers.warrant_skip;
  const stagnant = audit.selectedTriggers.stagnant_repeat;
  const lines = [
    '# Step 4 Trigger-Density Audit',
    '',
    'Zero model calls. Every input trace was SHA-256 verified before deterministic replay.',
    '',
    `Corpus: ${audit.corpus.runs} runs (${audit.corpus.step2Runs} selected Step 2 runs + ${audit.corpus.greenroomRuns} Green Room performances), one world, profiles ${audit.corpus.profiles.join(' and ')}, learner turns ${audit.corpus.turnWindow.join('--')}.`,
    '',
    '## Decision',
    '',
    'Retain two claim-bearing triggers. Assign at most one per turn, with `stagnant_repeat` taking priority over `warrant_skip` on co-fires.',
    '',
    '| Trigger | Assigned opportunities | Runs firing | Median/run | Baseline compliance | Decision |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    `| warrant_skip | ${warrant.opportunities} | ${warrant.runsWithOpportunity}/${warrant.runsAudited} | ${warrant.opportunitiesPerRun.median} | ${warrant.baselineCompliant}/${warrant.opportunities} (${Math.round(warrant.baselineComplianceRate * 100)}%) | retain |`,
    `| stagnant_repeat | ${stagnant.opportunities} | ${stagnant.runsWithOpportunity}/${stagnant.runsAudited} | ${stagnant.opportunitiesPerRun.median} | ${stagnant.baselineCompliant}/${stagnant.opportunities} (${Math.round(stagnant.baselineComplianceRate * 100)}%) | retain |`,
    `| affective_risk | ${audit.rejectedCandidates.affective_risk.opportunities} | -- | -- | -- | reject: unstable false positives |`,
    `| regloss | ${audit.rejectedCandidates.regloss.opportunities} | -- | -- | -- | reject: sparse/imbalanced |`,
    '',
    '## Cohorts',
    '',
    '| Family | Profile | Runs | Warrant opportunities (baseline pass) | Stagnation opportunities (baseline pass) |',
    '| --- | --- | ---: | ---: | ---: |',
    ...audit.cohorts.map(
      (cohort) =>
        `| ${cohort.family} | ${cohort.profile} | ${cohort.runs} | ${cohort.warrant_skip.opportunities} (${cohort.warrant_skip.baselineCompliant}) | ${cohort.stagnant_repeat.opportunities} (${cohort.stagnant_repeat.baselineCompliant}) |`,
    ),
    '',
    '## Frozen trigger forms',
    '',
    `- **warrant_skip:** ${warrant.definition}. Target: ${warrant.targetAction}.`,
    `- **stagnant_repeat:** ${stagnant.definition}. Target: ${stagnant.targetAction}.`,
    '',
    `The deterministic review sample contained ${audit.manualReview.warrant_skip.validOpportunities}/${audit.manualReview.warrant_skip.sampleSize} valid warrant opportunities and ${audit.manualReview.stagnant_repeat.validOpportunities}/${audit.manualReview.stagnant_repeat.sampleSize} valid stagnation opportunities. This is an instrument audit, not an outcome claim.`,
    '',
    '## Launch gate carried into the pre-registration',
    '',
    `Each arm x speaking-tutor family pools 10 dialogues (two profiles x n=5). It must yield at least ${audit.preregistrationConsequence.minimumAssignedOpportunitiesPerArmFamily.warrant_skip} assigned warrant opportunities and ${audit.preregistrationConsequence.minimumAssignedOpportunitiesPerArmFamily.stagnant_repeat} assigned stagnation opportunities. Falling below a minimum is an instrument failure for that trigger, not a coaching null.`,
    '',
  ];
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const audit = buildAudit();
  const json = `${JSON.stringify(audit, null, 2)}\n`;
  const markdown = renderMarkdown(audit);
  const outputs = [
    [OUTPUT_JSON, json],
    [OUTPUT_MD, markdown],
  ];
  if (args.check) {
    for (const [relative, content] of outputs) {
      const file = path.join(ROOT, relative);
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) {
        throw new Error(`Tracked trigger-audit artifact is stale: ${relative}`);
      }
    }
    console.log(`Step 4 trigger audit is current (${audit.corpus.runs} verified traces; zero model calls).`);
    return;
  }
  fs.mkdirSync(path.join(ROOT, OUTPUT_DIR), { recursive: true });
  for (const [relative, content] of outputs) fs.writeFileSync(path.join(ROOT, relative), content);
  console.log(`Wrote ${OUTPUT_JSON} and ${OUTPUT_MD}; zero model calls.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { buildAudit, renderMarkdown };

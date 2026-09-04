#!/usr/bin/env node

/**
 * Zero-call follow-up to the merged communication-topology link audit.
 *
 * Reads the frozen per-link ledger and its source traces, verifies every trace
 * hash, writes an exploratory aggregate sensitivity report, and prepares a
 * blinded semantic-review packet plus a separate identity ledger. It never
 * invokes a model/provider or writes to the evaluation database.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format as formatWithPrettier, resolveConfig as resolvePrettierConfig } from 'prettier';
import { resolveTutorDialoguesDir } from '../services/evaluationDataPaths.js';
import {
  aggregateBrokenLinkSensitivity,
  auditEvidenceChannels,
  buildSemanticReviewPacket,
  causalReplayProtocolSeed,
  hydrateLinkFromTrace,
} from '../services/superegoCritiqueCausalFollowupAnalyzer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANALYSIS_DATE = '2026-09-04';

function parseArgs(argv) {
  const args = {
    input: path.join(ROOT, 'notes', '2026-09-04-communication-topology-link-analysis.json'),
    logs: null,
    output: path.join(ROOT, 'notes', `${ANALYSIS_DATE}-superego-critique-causal-followup.md`),
    packetDir: path.join(ROOT, 'exports', 'superego-critique-causal-followup'),
    permutations: 20000,
    seed: 20260904,
    samplePerProfile: 4,
    json: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === '--input') args.input = path.resolve(argv[++index]);
    else if (token === '--logs') args.logs = argv[++index];
    else if (token === '--output') args.output = path.resolve(argv[++index]);
    else if (token === '--packet-dir') args.packetDir = path.resolve(argv[++index]);
    else if (token === '--permutations') args.permutations = Number(argv[++index]);
    else if (token === '--seed') args.seed = Number(argv[++index]);
    else if (token === '--sample-per-profile') args.samplePerProfile = Number(argv[++index]);
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return `Usage: node scripts/analyze-superego-critique-causal-followup.js [options]

Options:
  --input <path>               Merged per-link JSON ledger from PR #1017
  --logs <path>                Dialogue-log root or tutor-dialogues directory
  --output <path>              Markdown report path
  --packet-dir <path>          Local blinded-packet output directory
  --permutations <n>           Aggregate randomization draws (default: 20000)
  --seed <n>                   Deterministic randomization seed (default: 20260904)
  --sample-per-profile <n>     Blinded semantic items per profile (default: 4)
  --json                       Write the report's JSON companion
  --help                       Show this help

The command makes zero model/provider calls, verifies frozen trace hashes, and
writes only derived report and packet files.`;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const prettierConfig = (await resolvePrettierConfig(filePath)) || {};
  const formatted = await formatWithPrettier(JSON.stringify(value), { ...prettierConfig, filepath: filePath });
  fs.writeFileSync(filePath, formatted);
}

function portablePath(filePath) {
  const relative = path.relative(ROOT, filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative
    : `<external>/${path.basename(filePath)}`;
}

function loadHydratedLinks(inputPath, logsDir) {
  const sourceBytes = fs.readFileSync(inputPath);
  const source = JSON.parse(sourceBytes.toString('utf8'));
  if (source.schemaVersion !== 'communication-topology-link-audit-v1' || !Array.isArray(source?.analysis?.rows)) {
    throw new Error('Input is not the merged communication-topology per-link ledger');
  }
  if (!Array.isArray(source.dialogues)) throw new Error('Input is missing its dialogue provenance ledger');
  const traceCache = new Map();
  for (const dialogue of source.dialogues) {
    const filePath = path.join(logsDir, dialogue.sourceFileName || `${dialogue.dialogueId}.json`);
    if (!fs.existsSync(filePath)) throw new Error(`${dialogue.dialogueId}: source trace is missing`);
    const bytes = fs.readFileSync(filePath);
    const digest = sha256(bytes);
    if (digest !== dialogue.sourceTraceSha256) {
      throw new Error(`${dialogue.dialogueId}: source trace hash differs from the merged ledger`);
    }
    const parsed = JSON.parse(bytes.toString('utf8'));
    if (!Array.isArray(parsed.dialogueTrace))
      throw new Error(`${dialogue.dialogueId}: source dialogueTrace is missing`);
    traceCache.set(dialogue.dialogueId, { trace: parsed.dialogueTrace, digest });
  }
  const hydrated = [];
  for (const row of source.analysis.rows) {
    const cached = traceCache.get(row.dialogueId);
    if (!cached) {
      throw new Error(`${row.checkId}: link dialogue is absent from the provenance ledger`);
    }
    if (cached.digest !== row.sourceTraceSha256) {
      throw new Error(`${row.checkId}: one dialogue carries inconsistent source hashes`);
    }
    hydrated.push(hydrateLinkFromTrace(row, cached.trace));
  }
  return {
    source,
    sourceSha256: sha256(sourceBytes),
    traceFilesVerified: traceCache.size,
    links: hydrated,
  };
}

function individualTestResolution(rows) {
  const testable = rows.filter((row) => Number.isFinite(row.empiricalP));
  const comparatorCounts = testable.map((row) => row.nullComparatorCount);
  return {
    testableLinks: testable.length,
    minimumComparators: Math.min(...comparatorCounts),
    maximumComparators: Math.max(...comparatorCounts),
    coarsestMinimumEmpiricalP: 1 / (Math.min(...comparatorCounts) + 1),
    finestMinimumEmpiricalP: 1 / (Math.max(...comparatorCounts) + 1),
    nominalPAtMost005: testable.filter((row) => row.empiricalP <= 0.05).length,
    bestObservedFdrQ: Math.min(...testable.map((row) => row.fdrQ)),
  };
}

function formatNumber(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function formatP(value) {
  if (!Number.isFinite(value)) return '—';
  return value < 0.001 ? `< ${formatNumber(value + Number.EPSILON, 5)}` : formatNumber(value, 4);
}

function reportMarkdown(result) {
  const { aggregate, robustness, channels, individualResolution, semanticPacket, causalProtocol } = result;
  const lines = [
    '# Superego critique influence: aggregate sensitivity and causal boundary',
    '',
    `Analysis date: ${ANALYSIS_DATE}`,
    '',
    '## Bottom line',
    '',
    `The merged per-link audit could not identify a single exceptional link after multiple-testing correction, but its testable corpus contains a clear **exploratory aggregate lexical association**. Across ${aggregate.links} links in ${aggregate.strata} matched strata, actual critique→revision pairs averaged ${formatNumber(aggregate.observedMean)} uptake versus ${formatNumber(aggregate.brokenMean)} under broken pairings (${formatNumber(aggregate.observedToBrokenRatio, 2)}×; one-sided Monte Carlo p ${formatP(aggregate.oneSidedMonteCarloP)} from ${aggregate.permutations.toLocaleString('en-US')} deterministic draws).`,
    '',
    'This does not establish that critiques caused revisions or improved them. The draft is a common cause of both the critique and revision, and exact-word uptake can be superficial. The result says the corpus is not well described as “no link signal”; it says link-specific influence still needs semantic measurement and randomized intervention.',
    '',
    '## Why the individual-link null was not an aggregate null',
    '',
    `Each testable link had only ${individualResolution.minimumComparators}–${individualResolution.maximumComparators} wrong-critique comparators. Its smallest attainable empirical p-value therefore ranged from ${formatNumber(individualResolution.coarsestMinimumEmpiricalP, 3)} to ${formatNumber(individualResolution.finestMinimumEmpiricalP, 3)}. Across ${individualResolution.testableLinks} corrected tests, the best observed FDR q was ${formatNumber(individualResolution.bestObservedFdrQ)} even though ${individualResolution.nominalPAtMost005} links had uncorrected p ≤ 0.05. That procedure was designed to name exceptional individual links, not test a corpus-level shift.`,
    '',
    'The aggregate test preserves each scenario, ego/superego route, and deliberation ordinal. Within every stratum it applies a non-zero cyclic shift to the critique assignments, preserving the critique multiset while breaking every observed pairing. The test and seed were added after the per-link result was known, so this is a sensitivity analysis rather than a confirmatory finding.',
    '',
    '## Robustness',
    '',
    `Removing the ${channels.parserFailureCritiquesTestable} testable parser-failure critiques (${channels.parserFailureCritiques} across the complete eligible corpus) leaves ${robustness.withoutParserFailures.links} testable links: observed ${formatNumber(robustness.withoutParserFailures.observedMean)} versus broken ${formatNumber(robustness.withoutParserFailures.brokenMean)} (${formatNumber(robustness.withoutParserFailures.observedToBrokenRatio, 2)}×; p ${formatP(robustness.withoutParserFailures.oneSidedMonteCarloP)}). Including the structured change text in the critique representation also retains an aggregate association (${formatNumber(robustness.completeCritiqueText.observedToBrokenRatio, 2)}×; p ${formatP(robustness.completeCritiqueText.oneSidedMonteCarloP)}). These are post-hoc checks, not separate discoveries.`,
    '',
    '## What the original lexical instrument could not see',
    '',
    `Across all ${channels.links} eligible links:`,
    '',
    `- ${channels.critiquesWithStructuredChanges} critiques carried structured change requests; ${channels.critiquesWithSpecificRevisionLists} contained explicit revision lists.`,
    `- ${channels.changedActionTarget} revisions changed the public action target; ${channels.changedActionType} changed the action type.`,
    `- ${channels.changedTitle} changed the title and ${channels.changedMessage} changed the first public message.`,
    `- The original score read only \`${channels.originalLexicalInstrumentRead.join('` and `')}\`; it omitted structured instructions, action fields, titles, and additional suggestions.`,
    '',
    'These counts show measurement coverage, not successful compliance. A target change may be useful, irrelevant, or harmful; only semantic coding and independent quality assessment can decide.',
    '',
    '## Outcome-blind semantic review packet',
    '',
    `A deterministic ${semanticPacket.selected}-item calibration packet was sampled systematically across ${semanticPacket.profiles} profiles before any semantic labels exist. It contains the complete draft, critique, structured changes, and public revision, but withholds run, profile, model, lexical outcome, and trace identity from the coding packet. A separate identity ledger preserves provenance. Ambiguity and coder disagreement must remain \`measurement_indeterminate\`; exact-word signals are auxiliary only.`,
    '',
    `- Packet: \`${semanticPacket.packetPath}\` (SHA-256 \`${semanticPacket.packetSha256}\`)`,
    `- Identity ledger: \`${semanticPacket.identityLedgerPath}\` (SHA-256 \`${semanticPacket.identityLedgerSha256}\`)`,
    '',
    'The packet is calibration material, not a scored result. No semantic proportions are reported until an independent coder and a deliberate reliability check exist.',
    '',
    '## Causal replay that would answer the harder question',
    '',
    'Hold one frozen draft and its visible context constant, then compare four arms:',
    '',
  ];
  for (const arm of causalProtocol.arms) lines.push(`- \`${arm.id}\`: ${arm.operation}.`);
  lines.push(
    '',
    'This separates the extra-pass effect from the actual critique-content effect and from link-specific matching. Directive fulfillment, material action/strategy change, and blind public-output quality are separate endpoints; learner response or transfer remains a later evidence lane.',
    '',
    'This repository change does not register or authorize that paid experiment. The corpus, sample size, routes, seed, primary threshold, indeterminate disposition, and attempt/spend ceilings remain deliberately unresolved.',
    '',
    '## Provenance and execution boundary',
    '',
    `- Source ledger: \`${result.provenance.sourceLedger}\` (SHA-256 \`${result.provenance.sourceLedgerSha256}\`)`,
    `- Frozen trace files verified: ${result.provenance.traceFilesVerified}/${result.provenance.traceFilesExpected}; hash mismatches: 0.`,
    `- Model/provider calls: 0 completed, 0 failed, 0 reserved; hard ceiling 0.`,
    '- Historical traces and evaluation rows were read only; no score was backfilled or overwritten.',
    '- The aggregate result is exploratory association, the semantic packet is unscored calibration material, and the causal protocol is a design seed rather than authorization.',
    '',
  );
  return lines.join('\n');
}

export async function runAnalysis(args) {
  const logsDir = resolveTutorDialoguesDir(ROOT, args.logs);
  const loaded = loadHydratedLinks(args.input, logsDir);
  const testable = loaded.links.filter((link) => Number.isFinite(link.empiricalP));
  const nonParser = testable.filter((link) => !/unable to parse review/iu.test(link.critique.feedback));
  const aggregate = aggregateBrokenLinkSensitivity(testable, {
    permutations: args.permutations,
    seed: args.seed,
    idfCorpus: loaded.links,
  });
  const withoutParserFailures = aggregateBrokenLinkSensitivity(nonParser, {
    permutations: args.permutations,
    seed: args.seed,
    idfCorpus: loaded.links.filter((link) => !/unable to parse review/iu.test(link.critique.feedback)),
  });
  const completeCritiqueText = aggregateBrokenLinkSensitivity(nonParser, {
    permutations: args.permutations,
    seed: args.seed,
    critiqueField: 'fullCritiqueText',
    idfCorpus: loaded.links.filter((link) => !/unable to parse review/iu.test(link.critique.feedback)),
  });
  const channels = auditEvidenceChannels(loaded.links);
  const review = buildSemanticReviewPacket(loaded.links, { samplePerProfile: args.samplePerProfile });
  const packetPath = path.join(args.packetDir, 'semantic-review-packet.json');
  const identityLedgerPath = path.join(args.packetDir, 'semantic-review-identity-ledger.json');
  await writeJson(packetPath, review.packet);
  await writeJson(identityLedgerPath, review.identityLedger);
  const packetBytes = fs.readFileSync(packetPath);
  const ledgerBytes = fs.readFileSync(identityLedgerPath);
  const jsonPath = args.output.endsWith('.md') ? args.output.replace(/\.md$/u, '.json') : `${args.output}.json`;
  const result = {
    schemaVersion: 'superego-critique-causal-followup-v1',
    analysisDate: ANALYSIS_DATE,
    claimBoundary:
      'Post-hoc aggregate lexical association, evidence-channel coverage, and unscored semantic calibration only; no causal or quality effect.',
    provenance: {
      sourceLedger: portablePath(args.input),
      sourceLedgerSha256: loaded.sourceSha256,
      sourceSchemaVersion: loaded.source.schemaVersion,
      traceFilesExpected: loaded.source.corpus.tracesLoaded,
      traceFilesVerified: loaded.traceFilesVerified,
      sourceLinks: loaded.links.length,
    },
    individualResolution: individualTestResolution(loaded.source.analysis.rows),
    aggregate,
    robustness: { withoutParserFailures, completeCritiqueText },
    channels,
    semanticPacket: {
      ...review.packet.selection,
      packetPath: portablePath(packetPath),
      packetSha256: sha256(packetBytes),
      identityLedgerPath: portablePath(identityLedgerPath),
      identityLedgerSha256: sha256(ledgerBytes),
      status: 'unscored_calibration_material',
    },
    causalProtocol: causalReplayProtocolSeed(),
    execution: {
      modelCallsCompleted: 0,
      modelCallsFailed: 0,
      modelCallsReserved: 0,
      hardCeiling: 0,
      historicalMutation: false,
    },
  };
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${reportMarkdown(result).trimEnd()}\n`);
  if (args.json) await writeJson(jsonPath, result);
  return { result, output: args.output, jsonPath: args.json ? jsonPath : null, packetPath, identityLedgerPath };
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      return;
    }
    const outcome = await runAnalysis(args);
    console.log(`Aggregate links: ${outcome.result.aggregate.links}`);
    console.log(`Observed/broken ratio: ${outcome.result.aggregate.observedToBrokenRatio}`);
    console.log(`Monte Carlo p: ${outcome.result.aggregate.oneSidedMonteCarloP}`);
    console.log(`Semantic packet items: ${outcome.result.semanticPacket.selected}`);
    console.log(`Report: ${outcome.output}`);
    if (outcome.jsonPath) console.log(`Report JSON: ${outcome.jsonPath}`);
    console.log(`Blinded packet: ${outcome.packetPath}`);
    console.log(`Identity ledger: ${outcome.identityLedgerPath}`);
  } catch (error) {
    console.error(`superego-critique-causal-followup: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

#!/usr/bin/env node
/**
 * Harvest acquired discursive-policy memory from bounded replay loops.
 *
 * This is the higher-order learning layer: it turns replay-loop evidence into
 * explicit, versioned policy-memory artifacts. It does not train model weights
 * and does not claim online tutor adaptation. It emits:
 *   - JSON report for analysis
 *   - TTL ABox facts in the shared ms: ontology namespace
 *   - Markdown brief usable as --policy-memory in future replay/loop runs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_OUT_PARENT = path.join(ROOT, 'exports', 'discursive-replay-lessons');
const NS = 'https://machinespirits.dev/ontology/reasoning#';

function usage() {
  return `Usage:
  node scripts/harvest-discursive-replay-lessons.js --loop-root DIR [--loop-root DIR...]
    [--out-dir DIR] [--min-support N] [--promote] [--force]

Outputs JSON, TTL, and a Markdown policy-memory brief.`;
}

function defaultArgs() {
  return {
    loopRoots: [],
    outDir: null,
    minSupport: 2,
    promote: false,
    force: false,
  };
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = defaultArgs();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--loop-root') args.loopRoots.push(path.resolve(argv[++i]));
    else if (token === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (token === '--min-support') args.minSupport = positiveInt(argv[++i], '--min-support');
    else if (token === '--promote') args.promote = true;
    else if (token === '--force') args.force = true;
    else if (!token.startsWith('--')) args.loopRoots.push(path.resolve(token));
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (args.help) return args;
  if (!args.loopRoots.length) throw new Error(`--loop-root is required\n\n${usage()}`);
  for (const loopRoot of args.loopRoots) {
    if (!fs.existsSync(path.join(loopRoot, 'manifest.json'))) {
      throw new Error(`loop manifest not found: ${path.join(loopRoot, 'manifest.json')}`);
    }
  }
  args.outDir = args.outDir || path.join(DEFAULT_OUT_PARENT, `discursive-replay-lessons-${timestampId()}`);
  return args;
}

function positiveInt(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} must be a positive integer`);
  return n;
}

function timestampId() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function safeSlug(value) {
  return String(value || 'lesson')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 140);
}

function rel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function resolveArtifactPath(value, loopRoot) {
  if (!value) return null;
  if (path.isAbsolute(value)) return value;
  const fromLoop = path.resolve(loopRoot, value);
  if (fs.existsSync(fromLoop)) return fromLoop;
  return path.resolve(ROOT, value);
}

function issueText(issue) {
  return [issue?.criterion, issue?.evidence, issue?.recommendation].filter(Boolean).join(' ');
}

function normalizeCriterion(issue) {
  return String(issue?.criterion || '').trim().toLowerCase();
}

function hasIssueMatching(item, pattern) {
  return item.localIssues.some((issue) => pattern.test(`${normalizeCriterion(issue)} ${issueText(issue)}`));
}

function originCounts(critics = {}) {
  const counts = {};
  for (const row of Object.values(critics)) {
    const origin = row?.recognitionOrigin || 'none';
    counts[origin] = (counts[origin] || 0) + 1;
  }
  return counts;
}

function collectLoop(loopRoot) {
  const loopManifestPath = path.join(loopRoot, 'manifest.json');
  const loopManifest = readJson(loopManifestPath);
  const itemMap = new Map();
  const loopId = path.basename(loopRoot);

  const itemFor = (itemId) => {
    if (!itemMap.has(itemId)) {
      itemMap.set(itemId, {
        itemId,
        sourceLoopRoot: loopRoot,
        sourceLoopId: loopId,
        localStatuses: [],
        localIssues: [],
        feedbackIterations: [],
        panelOutcomes: [],
        firstPanelPassIteration: null,
        finalStatus: 'pending',
      });
    }
    return itemMap.get(itemId);
  };

  for (const iteration of loopManifest.iterations || []) {
    const replayDir = resolveArtifactPath(iteration.replayDir, loopRoot);
    const replayManifestPath = replayDir ? path.join(replayDir, 'manifest.json') : null;
    if (replayManifestPath && fs.existsSync(replayManifestPath)) {
      const replayManifest = readJson(replayManifestPath);
      for (const record of replayManifest.records || []) {
        const itemId = record?.item?.id;
        if (!itemId) continue;
        const item = itemFor(itemId);
        const status = record?.gate?.status || 'unknown';
        item.localStatuses.push({
          iteration: iteration.iteration,
          status,
          feedbackProvided: Boolean(record?.feedback?.provided),
          policyMemoryProvided: Boolean(record?.policyMemory?.provided),
          revisedPublicPath: record?.paths?.revisedPublic || null,
        });
        if (record?.feedback?.provided) item.feedbackIterations.push(iteration.iteration);
        for (const issue of [...(record?.gate?.failures || []), ...(record?.gate?.warnings || [])]) {
          item.localIssues.push({ iteration: iteration.iteration, status, ...issue });
        }
      }
    }

    for (const itemId of iteration.localNeedsRevision || []) {
      const item = itemFor(itemId);
      if (!item.localStatuses.some((s) => s.iteration === iteration.iteration && s.status === 'revise_again')) {
        item.localStatuses.push({ iteration: iteration.iteration, status: 'revise_again' });
      }
    }

    for (const panelItem of iteration.panelSummary || []) {
      const itemId = panelItem.sourceItemId;
      if (!itemId) continue;
      const item = itemFor(itemId);
      const origins = originCounts(panelItem.critics || {});
      const requiredRecognitionVotes = panelItem.requiredRecognitionVotes || 1;
      const requiredOriginVotes = panelItem.requiredOriginVotes || requiredRecognitionVotes;
      const recognitionPass =
        panelItem.recognitionPass ?? ((panelItem.recognitionVotes || 0) >= requiredRecognitionVotes);
      const originPass = panelItem.originPass ?? ((origins.peripeteia_induced || 0) >= requiredOriginVotes);
      const outcome = {
        iteration: iteration.iteration,
        status: panelItem.status,
        recognitionVotes: panelItem.recognitionVotes || 0,
        totalCritics: panelItem.totalCritics || 0,
        expectedCritics: panelItem.expectedCritics || panelItem.totalCritics || 0,
        requiredRecognitionVotes,
        originVotes: panelItem.originVotes ?? origins.peripeteia_induced ?? 0,
        requiredOriginVotes,
        recognitionPass,
        originPass,
        originCounts: origins,
        peripeteiaInducedVotes: origins.peripeteia_induced || 0,
        organicVotes: origins.organic || 0,
        noneVotes: origins.none || 0,
        critics: panelItem.critics || {},
      };
      item.panelOutcomes.push(outcome);
      if (panelItem.status === 'panel_pass') {
        item.firstPanelPassIteration = item.firstPanelPassIteration || iteration.iteration;
        item.finalStatus = 'panel_pass';
      } else if (item.finalStatus !== 'panel_pass') {
        item.finalStatus = 'panel_fail';
      }
    }
  }

  return {
    loopRoot,
    loopId,
    manifestPath: loopManifestPath,
    manifest: loopManifest,
    items: [...itemMap.values()].sort((a, b) => a.itemId.localeCompare(b.itemId)),
  };
}

function supportEvidence(items, predicate) {
  return items.filter(predicate).map((item) => ({
    itemId: item.itemId,
    firstReviseAgainIteration: item.localStatuses.find((s) => s.status === 'revise_again')?.iteration ?? null,
    feedbackIterations: item.feedbackIterations,
    firstPanelPassIteration: item.firstPanelPassIteration,
    panel: item.panelOutcomes[item.panelOutcomes.length - 1] || null,
    issues: item.localIssues.map((issue) => ({
      iteration: issue.iteration,
      criterion: issue.criterion || null,
      evidence: issue.evidence || null,
      recommendation: issue.recommendation || null,
    })),
  }));
}

function statusForSupport(count, args) {
  return args.promote && count >= args.minSupport ? 'promoted' : 'candidate';
}

function lesson({
  id,
  title,
  type = 'process',
  addressesFailure,
  activatesIn,
  requires,
  support,
  counterEvidence = [],
  recommendedUse,
  args,
}) {
  const supportCount = support.length;
  return {
    id,
    ontologyId: `learned_${safeSlug(id).replace(/-/g, '_')}`,
    title,
    type,
    promotionStatus: statusForSupport(supportCount, args),
    promotionThreshold: {
      minSupport: args.minSupport,
      promoteFlagRequired: true,
    },
    addressesFailure,
    activatesIn,
    requires,
    supportCount,
    supportingItems: support.map((s) => s.itemId),
    support,
    counterEvidence,
    recommendedUse,
  };
}

function deriveLessons(collectedLoops, args) {
  const items = collectedLoops.flatMap((loop) => loop.items);
  const hadReviseThenPass = (item) =>
    item.finalStatus === 'panel_pass' &&
    item.localStatuses.some((s) => s.status === 'revise_again') &&
    item.feedbackIterations.some((iteration) => iteration > (item.localStatuses.find((s) => s.status === 'revise_again')?.iteration || 0));

  const feedbackSupport = supportEvidence(items, hadReviseThenPass);
  const ledgerSupport = supportEvidence(
    items,
    (item) => item.finalStatus === 'panel_pass' && hasIssueMatching(item, /ledger|temporal|cross-turn|attribution/i),
  );
  const proseSupport = supportEvidence(
    items,
    (item) => item.finalStatus === 'panel_pass' && hasIssueMatching(item, /prose|natural|rehearsed|spontane/i),
  );
  const originRiskSupport = supportEvidence(
    items,
    (item) =>
      item.panelOutcomes.some(
        (outcome) =>
          outcome.recognitionPass !== false &&
          outcome.recognitionVotes >= (outcome.requiredRecognitionVotes || 1) &&
          outcome.peripeteiaInducedVotes < (outcome.requiredOriginVotes || outcome.requiredRecognitionVotes || 1),
      ),
  );

  return [
    lesson({
      id: 'feedback-gated-replay-repair',
      title: 'Feed local-gate failures into the next replay pass',
      addressesFailure: ['PanelRecognitionFailure'],
      activatesIn: ['ReplayPromptConstruction', 'PanelEscalationDecision'],
      requires:
        'When a replay item is marked revise_again, do not panel it unchanged. Feed the local findings into the next rewrite and retry locally first.',
      support: feedbackSupport,
      recommendedUse:
        'Default for capped replay loops; keep panel escalation behind local survivor status unless explicitly overridden.',
      args,
    }),
    lesson({
      id: 'temporal-ledger-scope',
      title: 'Keep move-ledger entries temporally scoped',
      addressesFailure: ['TemporalLedgerOverclaim'],
      activatesIn: ['MoveLedgerConstruction'],
      requires:
        'Each move-ledger entry must record only what is publicly owned by that turn; do not copy a final learner self-reframe backward into earlier entries.',
      support: ledgerSupport,
      recommendedUse:
        'Inject into replay generator and local checker whenever move_ledger entries are requested.',
      args,
    }),
    lesson({
      id: 'natural-self-reframe-prose',
      title: 'Preserve natural learner prose while making the self-reframe explicit',
      addressesFailure: ['IncompleteLearnerSelfReframe'],
      activatesIn: ['ReplayPromptConstruction'],
      requires:
        'The learner self-reframe must contrast old check, limit, new check, and application, but it should read as ordinary domain speech rather than a rehearsed rubric sentence.',
      support: proseSupport,
      recommendedUse:
        'Use as a style guard after self-reframe completeness is already satisfied.',
      args,
    }),
    lesson({
      id: 'recognition-majority-is-not-origin-attribution',
      title: 'Do not treat recognition majority as tutor-induced origin evidence',
      type: 'claim_boundary',
      addressesFailure: ['OriginAttributionRisk'],
      activatesIn: ['OriginClaimDiscipline', 'PanelEscalationDecision'],
      requires:
        'A blind-panel recognition majority is enough for recognitive-form survival, not enough for a tutor-induced adaptation claim. Require origin/mechanism evidence separately.',
      support: originRiskSupport,
      counterEvidence: originRiskSupport.map((item) => {
        const latest = item.panel;
        return {
          itemId: item.itemId,
          recognitionVotes: latest?.recognitionVotes ?? null,
          totalCritics: latest?.totalCritics ?? null,
          peripeteiaInducedVotes: latest?.peripeteiaInducedVotes ?? null,
          organicVotes: latest?.organicVotes ?? null,
          noneVotes: latest?.noneVotes ?? null,
        };
      }),
      recommendedUse:
        'Use as a reporting and stop-rule guard: escalate to origin/mechanism validation before claiming induced adaptation.',
      args,
    }),
  ].filter((entry) => entry.supportCount > 0);
}

export function harvestDiscursiveReplayLessons(rawArgs = {}) {
  const args = {
    ...defaultArgs(),
    ...rawArgs,
    loopRoots: [...(rawArgs.loopRoots || [])],
  };
  const loops = args.loopRoots.map(collectLoop);
  const lessons = deriveLessons(loops, args);
  return {
    schema_version: 'discursive-replay-learned-policy-v1',
    generated_at: new Date().toISOString(),
    claim_boundary: 'counterfactual_replay_policy_memory_not_model_weight_training',
    source_loop_roots: loops.map((loop) => rel(loop.loopRoot)),
    promotion_policy: {
      min_support: args.minSupport,
      promote_flag_required: true,
      note: 'Promotion means this policy may be injected into future replay prompts; it is not an empirical claim of deployed tutor adaptation.',
    },
    lessons,
    items: loops.flatMap((loop) =>
      loop.items.map((item) => ({
        itemId: item.itemId,
        sourceLoopRoot: rel(item.sourceLoopRoot),
        finalStatus: item.finalStatus,
        localStatuses: item.localStatuses,
        firstPanelPassIteration: item.firstPanelPassIteration,
        latestPanel: item.panelOutcomes[item.panelOutcomes.length - 1] || null,
        localIssues: item.localIssues,
      })),
    ),
  };
}

function ttlString(value) {
  return JSON.stringify(String(value ?? ''));
}

function ttlUri(id) {
  return `ms:${id}`;
}

export function renderLessonsTtl(report) {
  const lines = [
    '@prefix ms: <https://machinespirits.dev/ontology/reasoning#> .',
    '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
    '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
    '',
    `# Generated ${report.generated_at}`,
    `# Claim boundary: ${report.claim_boundary}`,
    '',
  ];

  for (const entry of report.lessons || []) {
    const statusClass = entry.promotionStatus === 'promoted' ? 'PromotedLearnedPolicy' : 'CandidateLearnedPolicy';
    lines.push(`${ttlUri(entry.ontologyId)} a ms:LearnedDiscursivePolicy, ms:${statusClass} ;`);
    lines.push(`  ms:promotionStatus ${ttlString(entry.promotionStatus)} ;`);
    lines.push(`  ms:supportingItemCount ${entry.supportCount} ;`);
    lines.push(`  ms:validationRunCount ${(report.source_loop_roots || []).length || 1} ;`);
    for (const root of report.source_loop_roots || []) lines.push(`  ms:derivedFromLoopRoot ${ttlString(root)} ;`);
    for (const failure of entry.addressesFailure || []) lines.push(`  ms:addressesFailure ms:${failure} ;`);
    for (const context of entry.activatesIn || []) lines.push(`  ms:activatesIn ms:${context} ;`);
    lines.push(`  ms:requiresConstraint ${ttlString(entry.requires)} ;`);
    for (const itemId of entry.supportingItems || []) lines.push(`  ms:supportingSourceItem ${ttlString(itemId)} ;`);
    for (const evidence of entry.counterEvidence || []) lines.push(`  ms:counterEvidence ${ttlString(JSON.stringify(evidence))} ;`);
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

export function renderPolicyBrief(report, { includeCandidates = true } = {}) {
  const active = (report.lessons || []).filter(
    (entry) => includeCandidates || entry.promotionStatus === 'promoted',
  );
  const lines = [
    '# Discursive Replay Learned Policy Memory',
    '',
    `Generated: ${report.generated_at}`,
    `Claim boundary: ${report.claim_boundary}`,
    '',
    'Use these as acquired policy constraints for counterfactual replay generation/checking. They are not evidence of online tutor adaptation.',
    '',
  ];
  for (const entry of active) {
    lines.push(`## ${entry.title}`);
    lines.push('');
    lines.push(`- id: ${entry.id}`);
    lines.push(`- status: ${entry.promotionStatus}`);
    lines.push(`- support: ${entry.supportCount} item(s)`);
    lines.push(`- applies in: ${(entry.activatesIn || []).join(', ')}`);
    lines.push(`- constraint: ${entry.requires}`);
    if (entry.recommendedUse) lines.push(`- use: ${entry.recommendedUse}`);
    if (entry.counterEvidence?.length) {
      lines.push(`- caution: ${entry.counterEvidence.length} supporting case(s) carry counter-evidence or claim-boundary limits.`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function writeOutputs(report, args) {
  if (fs.existsSync(args.outDir)) {
    if (!args.force) throw new Error(`output exists: ${args.outDir} (pass --force to overwrite)`);
    fs.rmSync(args.outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(args.outDir, { recursive: true });
  const jsonPath = path.join(args.outDir, 'lessons.json');
  const ttlPath = path.join(args.outDir, 'lessons.ttl');
  const briefPath = path.join(args.outDir, 'policy-memory.md');
  writeJson(jsonPath, report);
  fs.writeFileSync(ttlPath, renderLessonsTtl(report), 'utf8');
  fs.writeFileSync(briefPath, renderPolicyBrief(report), 'utf8');
  return { jsonPath, ttlPath, briefPath };
}

function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(usage());
    return;
  }
  const report = harvestDiscursiveReplayLessons(args);
  const outputs = writeOutputs(report, args);
  console.log(
    JSON.stringify(
      {
        outDir: args.outDir,
        lessons: report.lessons.length,
        promoted: report.lessons.filter((entry) => entry.promotionStatus === 'promoted').length,
        candidate: report.lessons.filter((entry) => entry.promotionStatus === 'candidate').length,
        outputs,
      },
      null,
      2,
    ),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}

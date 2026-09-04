import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  aggregateBrokenLinkSensitivity,
  auditEvidenceChannels,
  buildSemanticReviewPacket,
  causalReplayProtocolSeed,
  hydrateLinkFromTrace,
} from '../services/superegoCritiqueCausalFollowupAnalyzer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function makeHydratedLink(index, overrides = {}) {
  const token = `specificterm${index}`;
  return {
    checkId: `dialogue-${index}#check-1`,
    dialogueId: `dialogue-${index}`,
    runId: 'fixture-run',
    profileName: index % 2 ? 'cell_22_base_suspicious_unified' : 'cell_23_recog_suspicious_unified',
    scenarioId: 'fixture-scenario',
    egoModel: 'fixture-ego',
    superegoModel: 'fixture-superego',
    sourceTraceSha256: `hash-${index}`,
    ordinal: 1,
    interventionType: 'revise',
    traceIndexes: { draft: 0, critique: 1, revision: 2 },
    draft: {
      type: 'lecture',
      priority: 'high',
      title: 'Initial title',
      message: 'Give the answer directly.',
      actionType: 'navigate',
      actionTarget: 'lecture-1',
      suggestionCount: 1,
    },
    critique: {
      feedback: `Introduce ${token}.`,
      approved: false,
      interventionType: 'revise',
      suggestedChanges: { specificRevisions: [`Use ${token}.`] },
    },
    revision: {
      type: 'lecture',
      priority: 'high',
      title: 'Revised title',
      message: `Use ${token} in the response.`,
      actionType: 'navigate',
      actionTarget: 'lecture-2',
      suggestionCount: 1,
    },
    draftText: 'Give the answer directly.',
    critiqueText: `Introduce ${token}.`,
    fullCritiqueText: `Introduce ${token}. Use ${token}.`,
    revisionText: `Use ${token} in the response.`,
    empiricalP: 0.05,
    fdrQ: 0.05,
    nullComparatorCount: 19,
    ...overrides,
  };
}

describe('superego critique causal follow-up service', () => {
  it('detects a corpus-level paired association with deterministic broken-link draws', () => {
    const links = Array.from({ length: 20 }, (_, index) => makeHydratedLink(index));
    const first = aggregateBrokenLinkSensitivity(links, { permutations: 1000, seed: 42 });
    const second = aggregateBrokenLinkSensitivity(links, { permutations: 1000, seed: 42 });
    assert.deepEqual(first, second);
    assert.equal(first.links, 20);
    assert.equal(first.strata, 1);
    assert.ok(first.observedMean > first.brokenMean);
    assert.equal(first.drawsAtLeastObserved, 0);
    assert.equal(first.oneSidedMonteCarloP, 0.000999);
    assert.match(first.claimBoundary, /not an individual-link or causal effect/u);
  });

  it('accounts for structured critique and public revision channels', () => {
    const links = [
      makeHydratedLink(1),
      makeHydratedLink(2, {
        critique: {
          feedback: 'Unable to parse review, requesting revision',
          approved: false,
          interventionType: 'revise',
          suggestedChanges: null,
        },
        revision: {
          type: 'lecture',
          priority: 'high',
          title: 'Initial title',
          message: 'A different message.',
          actionType: 'navigate',
          actionTarget: 'lecture-1',
          suggestionCount: 2,
        },
      }),
    ];
    const audit = auditEvidenceChannels(links);
    assert.equal(audit.links, 2);
    assert.equal(audit.parserFailureCritiques, 1);
    assert.equal(audit.parserFailureCritiquesTestable, 1);
    assert.equal(audit.critiquesWithStructuredChanges, 1);
    assert.equal(audit.critiquesWithSpecificRevisionLists, 1);
    assert.equal(audit.changedActionTarget, 1);
    assert.equal(audit.changedTitle, 1);
    assert.equal(audit.multipleRevisionSuggestions, 1);
    assert.ok(audit.omittedFromOriginalLexicalInstrument.includes('critique.suggestedChanges'));
  });

  it('hydrates only the frozen ego-review-revision indexes', () => {
    const row = makeHydratedLink(1);
    const trace = [
      { agent: 'ego', action: 'generate', suggestions: [{ message: row.draftText }] },
      {
        agent: 'superego',
        action: 'review',
        approved: false,
        interventionType: 'revise',
        feedback: row.critiqueText,
        suggestedChanges: { specificRevisions: ['Use the specific term.'] },
      },
      { agent: 'ego', action: 'revise', suggestions: [{ message: row.revisionText }] },
    ];
    const hydrated = hydrateLinkFromTrace(row, trace);
    assert.equal(hydrated.critique.suggestedChanges.specificRevisions.length, 1);
    assert.equal(hydrated.revision.message, row.revisionText);
    assert.throws(
      () => hydrateLinkFromTrace(row, [trace[0], { ...trace[1], agent: 'learner' }, trace[2]]),
      /does not match the frozen link indexes/u,
    );
  });

  it('builds a deterministic blinded packet and separate identity ledger', () => {
    const links = Array.from({ length: 20 }, (_, index) => makeHydratedLink(index));
    const first = buildSemanticReviewPacket(links, { samplePerProfile: 4 });
    const second = buildSemanticReviewPacket(links, { samplePerProfile: 4 });
    assert.deepEqual(first, second);
    assert.equal(first.packet.rows.length, 8);
    assert.equal(first.identityLedger.rows.length, 8);
    assert.ok(first.packet.rows.every((row) => !('check_id' in row) && !('profile_name' in row)));
    assert.ok(first.packet.rows.every((row) => row.coding.semantic_incorporation === null));
    assert.ok(first.identityLedger.rows.every((row) => row.source_trace_sha256));
    assert.deepEqual(
      first.packet.rows.map((row) => row.item_id),
      first.identityLedger.rows.map((row) => row.item_id),
    );
  });

  it('keeps the four-arm replay protocol explicitly unready for launch', () => {
    const protocol = causalReplayProtocolSeed();
    assert.equal(protocol.status, 'design_seed_not_authorized');
    assert.deepEqual(
      protocol.arms.map((arm) => arm.id),
      ['draft_only', 'generic_revision', 'actual_critique', 'matched_wrong_critique'],
    );
    assert.ok(protocol.unresolved_before_registration.includes('attempt and spend ceilings'));
    assert.match(protocol.launch_boundary, /No provider call is authorized/u);
  });
});

describe('analyze-superego-critique-causal-followup CLI', () => {
  it('verifies frozen hashes and writes byte-identical zero-call artifacts', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'superego-causal-followup-'));
    try {
      const logsDir = path.join(tmp, 'tutor-dialogues');
      const packetDir = path.join(tmp, 'packets');
      const sourcePath = path.join(tmp, 'source.json');
      const reportPath = path.join(tmp, 'report.md');
      fs.mkdirSync(logsDir);
      const rows = [];
      const dialogues = [];
      for (let index = 0; index < 20; index++) {
        const dialogueId = `dialogue-${index}`;
        const trace = {
          dialogueId,
          dialogueTrace: [
            {
              agent: 'ego',
              action: 'generate',
              suggestions: [
                {
                  title: 'Initial',
                  message: 'Give the answer directly.',
                  actionType: 'navigate',
                  actionTarget: 'lecture-1',
                },
              ],
            },
            {
              agent: 'superego',
              action: 'review',
              approved: false,
              interventionType: 'revise',
              feedback: `Introduce specificterm${index}.`,
              suggestedChanges: { specificRevisions: [`Use specificterm${index}.`] },
            },
            {
              agent: 'ego',
              action: 'revise',
              suggestions: [
                {
                  title: 'Revised',
                  message: `Use specificterm${index} in the response.`,
                  actionType: 'navigate',
                  actionTarget: 'lecture-2',
                },
              ],
            },
          ],
        };
        const bytes = Buffer.from(`${JSON.stringify(trace, null, 2)}\n`);
        fs.writeFileSync(path.join(logsDir, `${dialogueId}.json`), bytes);
        dialogues.push({
          dialogueId,
          sourceFileName: `${dialogueId}.json`,
          sourceTraceSha256: hash(bytes),
        });
        rows.push({
          checkId: `${dialogueId}#check-1`,
          dialogueId,
          runId: 'fixture-run',
          profileName: 'cell_22_base_suspicious_unified',
          scenarioId: 'fixture-scenario',
          egoModel: 'fixture-ego',
          superegoModel: 'fixture-superego',
          sourceTraceSha256: hash(bytes),
          ordinal: 1,
          traceIndexes: { draft: 0, critique: 1, revision: 2 },
          interventionType: 'revise',
          nullComparatorCount: 19,
          empiricalP: 0.05,
          fdrQ: 0.05,
          outcome: 'not_detected',
        });
      }
      fs.writeFileSync(
        sourcePath,
        `${JSON.stringify(
          {
            schemaVersion: 'communication-topology-link-audit-v1',
            corpus: { tracesLoaded: 20 },
            dialogues,
            analysis: { rows },
          },
          null,
          2,
        )}\n`,
      );
      const sourceBefore = hash(fs.readFileSync(sourcePath));
      const logsBefore = hash(
        Buffer.concat(
          fs
            .readdirSync(logsDir)
            .sort()
            .map((name) => fs.readFileSync(path.join(logsDir, name))),
        ),
      );
      const args = [
        'scripts/analyze-superego-critique-causal-followup.js',
        '--input',
        sourcePath,
        '--logs',
        logsDir,
        '--output',
        reportPath,
        '--packet-dir',
        packetDir,
        '--permutations',
        '1000',
        '--sample-per-profile',
        '4',
        '--json',
      ];
      const stdout = execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
      assert.match(stdout, /Aggregate links: 20/u);
      assert.match(stdout, /Semantic packet items: 4/u);
      assert.match(fs.readFileSync(reportPath, 'utf8'), /exploratory aggregate lexical association/u);
      const result = JSON.parse(fs.readFileSync(reportPath.replace(/\.md$/u, '.json'), 'utf8'));
      assert.equal(result.execution.hardCeiling, 0);
      assert.equal(result.provenance.traceFilesVerified, 20);
      assert.equal(result.semanticPacket.status, 'unscored_calibration_material');
      const firstArtifacts = [
        reportPath,
        reportPath.replace(/\.md$/u, '.json'),
        ...fs
          .readdirSync(packetDir)
          .sort()
          .map((name) => path.join(packetDir, name)),
      ].map((file) => hash(fs.readFileSync(file)));
      execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
      const secondArtifacts = [
        reportPath,
        reportPath.replace(/\.md$/u, '.json'),
        ...fs
          .readdirSync(packetDir)
          .sort()
          .map((name) => path.join(packetDir, name)),
      ].map((file) => hash(fs.readFileSync(file)));
      assert.deepEqual(secondArtifacts, firstArtifacts);
      assert.equal(hash(fs.readFileSync(sourcePath)), sourceBefore);
      assert.equal(
        hash(
          Buffer.concat(
            fs
              .readdirSync(logsDir)
              .sort()
              .map((name) => fs.readFileSync(path.join(logsDir, name))),
          ),
        ),
        logsBefore,
      );

      const firstTrace = path.join(logsDir, 'dialogue-0.json');
      fs.appendFileSync(firstTrace, '\n');
      assert.throws(
        () => execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }),
        /source trace hash differs/u,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

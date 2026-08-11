#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  scoreBlindedAnnotations,
  validateBlindedAnnotationResponse,
} from './run-adaptive-warrant-baseline-study.js';
import { validateAdaptiveWarrantChallengeFreeze } from './build-adaptive-warrant-challenge-corpus.js';
import { validateAdaptiveWarrantAnnotationAuthorizationRequest } from './prepare-adaptive-warrant-annotation-batches.js';

export const ADAPTIVE_WARRANT_TARGETED_CHALLENGE_SCORE_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-targeted-challenge-diagnostic-score.v2';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function fileSha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function diagnosticSupport(score, minima) {
  const observed = {
    tutor_directed_public_result_request: score.metrics.resultRequestConsensusCases,
    learner_proposed_test: score.metrics.proposedTestConsensusCases,
    obligation_persistence: score.metrics.obligationPersistenceCases,
    obligation_resolution: score.metrics.obligationResolutionCases,
    inquiry_complete: score.metrics.inquiryCompleteConsensusCases,
    inquiry_incomplete: score.metrics.inquiryIncompleteConsensusCases,
    ...Object.fromEntries(
      Object.entries(score.metrics.divergenceDimensionMetrics).map(([dimension, metrics]) => [
        `divergence_${dimension}_nonaligned`,
        metrics.nonaligned_consensus_cases,
      ]),
    ),
  };
  const checks = Object.fromEntries(
    Object.entries(minima).map(([name, minimum]) => [
      name,
      { minimum, observed: observed[name] ?? 0, passed: (observed[name] ?? 0) >= minimum },
    ]),
  );
  return {
    status: Object.values(checks).every((check) => check.passed) ? 'supported' : 'insufficient_support',
    checks,
  };
}

/**
 * Score a targeted challenge without ever applying the representative-study
 * decision gate. Both blind files and identities are validated before the
 * freeze validator or this function reads the private key.
 */
export function scoreAdaptiveWarrantChallengeAnnotations({
  rootDir,
  annotationAPath,
  annotationBPath,
  authorizationRequestPath = null,
  collectionManifestPath = null,
  outputPath = null,
} = {}) {
  const root = path.resolve(rootDir);
  const corpusPath = path.join(root, 'annotation-sample.blinded.json');
  const keyPath = path.join(root, 'annotation-key.private.json');
  const freezeManifestPath = path.join(root, 'annotation-freeze-manifest.json');
  const firstPath = path.resolve(annotationAPath);
  const secondPath = path.resolve(annotationBPath);
  if (firstPath === secondPath) throw new Error('independent annotations must use distinct response files');

  const corpus = readJson(corpusPath);
  const annotatorA = readJson(firstPath);
  const annotatorB = readJson(secondPath);
  const corpusSha256 = fileSha256(corpusPath);
  const blindValidation = {
    annotatorA: validateBlindedAnnotationResponse({
      response: annotatorA,
      corpus,
      expectedCorpusSha256: corpusSha256,
    }),
    annotatorB: validateBlindedAnnotationResponse({
      response: annotatorB,
      corpus,
      expectedCorpusSha256: corpusSha256,
    }),
  };
  if (String(annotatorA.annotator_id || '').trim() === String(annotatorB.annotator_id || '').trim()) {
    throw new Error('targeted challenge requires distinct annotator_id values');
  }
  if (String(annotatorA.annotation_run_id || '').trim() === String(annotatorB.annotation_run_id || '').trim()) {
    throw new Error('targeted challenge requires distinct annotation_run_id values');
  }

  let authorizationValidation = null;
  if (authorizationRequestPath || collectionManifestPath) {
    if (!authorizationRequestPath || !collectionManifestPath) {
      throw new Error('authorization scoring requires both the request and collection manifest');
    }
    authorizationValidation = validateAdaptiveWarrantAnnotationAuthorizationRequest({
      requestPath: path.resolve(authorizationRequestPath),
      manifestPath: path.resolve(collectionManifestPath),
    });
  }

  // This validates every freeze binding and is intentionally called only
  // after both blind artifacts and independent identities pass.
  const freezeValidation = validateAdaptiveWarrantChallengeFreeze({ manifestPath: freezeManifestPath });
  const freezeManifest = readJson(freezeManifestPath);
  const key = readJson(keyPath);
  const score = scoreBlindedAnnotations({ annotatorA, annotatorB, key });
  const artifact = {
    schema: ADAPTIVE_WARRANT_TARGETED_CHALLENGE_SCORE_SCHEMA,
    status: 'complete',
    inferential_role: 'diagnostic_only',
    gate_eligible: false,
    pass_fail_gate: {
      status: 'not_applicable',
      reason:
        'Targeted challenge rows may diagnose and motivate prospective repair but cannot contribute to passage, prevalence, or false-positive inference.',
    },
    scored_at: new Date().toISOString(),
    authorization_digest: authorizationValidation?.approval_digest || null,
    freeze_validation: freezeValidation,
    blind_validation: blindValidation,
    diagnostic_support: diagnosticSupport(score, freezeManifest.diagnostic_coverage_minima),
    sources: {
      freeze_manifest: { path: freezeManifestPath, sha256: fileSha256(freezeManifestPath) },
      corpus: { path: corpusPath, sha256: corpusSha256 },
      key: { path: keyPath, sha256: fileSha256(keyPath) },
      annotator_a: { path: firstPath, sha256: fileSha256(firstPath) },
      annotator_b: { path: secondPath, sha256: fileSha256(secondPath) },
      authorization_request: authorizationRequestPath
        ? { path: path.resolve(authorizationRequestPath), sha256: fileSha256(path.resolve(authorizationRequestPath)) }
        : null,
      collection_manifest: collectionManifestPath
        ? { path: path.resolve(collectionManifestPath), sha256: fileSha256(path.resolve(collectionManifestPath)) }
        : null,
    },
    score,
  };
  const resolvedOutputPath = outputPath
    ? path.resolve(outputPath)
    : path.join(root, 'diagnostic-consensus-and-scores.json');
  writeJson(resolvedOutputPath, artifact);
  return { artifact, outputPath: resolvedOutputPath };
}

function usage() {
  return `Usage: node scripts/score-adaptive-warrant-challenge-annotations.js --root <freeze> --annotation-a <file> --annotation-b <file> [--authorization-request <file> --collection-manifest <file>] [--output <file>]\n`;
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string' },
      'annotation-a': { type: 'string' },
      'annotation-b': { type: 'string' },
      'authorization-request': { type: 'string' },
      'collection-manifest': { type: 'string' },
      output: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) return process.stdout.write(usage());
  if (!values.root || !values['annotation-a'] || !values['annotation-b']) {
    throw new Error(usage().trim());
  }
  const result = scoreAdaptiveWarrantChallengeAnnotations({
    rootDir: values.root,
    annotationAPath: values['annotation-a'],
    annotationBPath: values['annotation-b'],
    authorizationRequestPath: values['authorization-request'],
    collectionManifestPath: values['collection-manifest'],
    outputPath: values.output,
  });
  process.stdout.write(`${result.outputPath}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main();
}

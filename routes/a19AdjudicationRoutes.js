/**
 * A19 human adjudication dashboard routes.
 *
 * These endpoints mirror the offline CLI without exposing private packet keys.
 * They only serve the blinded assignment/codebook and write validator-compatible
 * coder files.
 */

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCoderSubmission,
  defaultSubmissionDirForAssignment,
  nextCoderId,
} from '../scripts/run-a19-human-adjudication-cli.js';
import { validateA19HumanCoderFile } from '../scripts/validate-a19-human-coder-file.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ASSIGNMENT = path.join(
  ROOT,
  'exports',
  'a19',
  'human-coder-assignments',
  'moral-disclosure-standing-repair-a.assignment.json',
);
const DEFAULT_CODEBOOK = path.join(
  ROOT,
  'exports',
  'a19',
  'adjudication-codebooks',
  'learner-standing-v01.codebook.json',
);

const router = Router();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function resolvePaths() {
  const assignmentPath = path.resolve(process.env.A19_ADJUDICATION_ASSIGNMENT || DEFAULT_ASSIGNMENT);
  const codebookPath = path.resolve(process.env.A19_ADJUDICATION_CODEBOOK || DEFAULT_CODEBOOK);
  const outDir = process.env.A19_ADJUDICATION_OUT_DIR
    ? path.resolve(process.env.A19_ADJUDICATION_OUT_DIR)
    : defaultSubmissionDirForAssignment(assignmentPath);
  return { assignmentPath, codebookPath, outDir };
}

function assertConfigured({ assignmentPath, codebookPath }) {
  if (!fs.existsSync(assignmentPath)) throw new Error(`A19 assignment not found: ${repoRel(assignmentPath)}`);
  if (!fs.existsSync(codebookPath)) throw new Error(`A19 codebook not found: ${repoRel(codebookPath)}`);
}

function safeCoderId(value) {
  const coderId = String(value || '')
    .trim()
    .replace(/[^\w-]/gu, '');
  if (!coderId) throw new Error('coder_id is required');
  if (coderId.length > 80) throw new Error('coder_id is too long');
  return coderId;
}

function submitPath(outDir, coderId) {
  return path.join(outDir, `${coderId}.json`);
}

function listSubmissions({ assignmentPath, codebookPath, outDir }) {
  if (!fs.existsSync(outDir)) return [];
  return fs
    .readdirSync(outDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort()
    .map((entry) => {
      const coderPath = path.join(outDir, entry);
      let validation = null;
      try {
        validation = validateA19HumanCoderFile({ assignmentPath, coderPath, codebookPath });
      } catch (error) {
        validation = {
          status: 'fail',
          issues: [{ severity: 'error', path: repoRel(coderPath), message: error.message }],
        };
      }
      return {
        coder_id: entry.replace(/\.json$/u, ''),
        path: repoRel(coderPath),
        status: validation.status,
        issues: validation.issues || [],
      };
    });
}

router.get('/assignment', (req, res) => {
  try {
    const paths = resolvePaths();
    assertConfigured(paths);
    fs.mkdirSync(paths.outDir, { recursive: true });
    const assignment = readJson(paths.assignmentPath);
    const codebook = readJson(paths.codebookPath);
    res.json({
      success: true,
      assignment,
      codebook,
      paths: {
        assignment: repoRel(paths.assignmentPath),
        codebook: repoRel(paths.codebookPath),
        out_dir: repoRel(paths.outDir),
      },
      next_coder_id: nextCoderId(paths.outDir),
      submissions: listSubmissions(paths),
      claim_boundary: {
        licenses_a19_transfer_claim: false,
        licenses_paper_or_atlas_claim: false,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/submissions', (req, res) => {
  try {
    const paths = resolvePaths();
    assertConfigured(paths);
    res.json({ success: true, submissions: listSubmissions(paths) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/submissions', (req, res) => {
  const paths = resolvePaths();
  let tmpPath = null;
  try {
    assertConfigured(paths);
    fs.mkdirSync(paths.outDir, { recursive: true });
    const assignment = readJson(paths.assignmentPath);
    const codebook = readJson(paths.codebookPath);
    const coderId = safeCoderId(req.body?.coder_id);
    const outPath = submitPath(paths.outDir, coderId);
    if (fs.existsSync(outPath) && !req.body?.overwrite) {
      return res.status(409).json({
        success: false,
        error: `coder submission already exists: ${repoRel(outPath)}`,
        code: 'A19_CODER_EXISTS',
      });
    }
    const coder = buildCoderSubmission({
      assignment,
      codebook,
      coderId,
      coderRole: req.body?.coder_role || 'expert_or_semi_expert',
      armJudgments: Array.isArray(req.body?.arm_judgments) ? req.body.arm_judgments : [],
      pairwiseJudgment: req.body?.pairwise_judgment || {},
      codebookFeedback: req.body?.codebook_feedback || { ambiguous_terms: [], suggested_revision: '' },
    });
    tmpPath = path.join(paths.outDir, `.${coderId}.${Date.now()}.tmp.json`);
    writeJson(tmpPath, coder);
    const validation = validateA19HumanCoderFile({
      assignmentPath: paths.assignmentPath,
      coderPath: tmpPath,
      codebookPath: paths.codebookPath,
    });
    if (validation.status !== 'pass') {
      fs.rmSync(tmpPath, { force: true });
      tmpPath = null;
      return res.status(422).json({ success: false, validation });
    }
    fs.renameSync(tmpPath, outPath);
    tmpPath = null;
    return res.status(201).json({
      success: true,
      coder_path: repoRel(outPath),
      validation: {
        ...validation,
        coder_path: repoRel(outPath),
      },
    });
  } catch (error) {
    if (tmpPath) fs.rmSync(tmpPath, { force: true });
    return res.status(400).json({ success: false, error: error.message });
  }
});

export default router;

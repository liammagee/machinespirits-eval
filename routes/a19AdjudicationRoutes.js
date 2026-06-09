/**
 * A19 human adjudication dashboard routes.
 *
 * These endpoints mirror the offline CLI without exposing private packet keys.
 * Panel logic (roster, serving-time blind enforcement, drafts, completeness)
 * lives in services/a19AdjudicationPanel.js; this file is the HTTP shape.
 *
 * Two modes, decided per request by the presence of the roster file
 * (exports/a19/adjudication-roster.json or A19_ADJUDICATION_ROSTER):
 *
 *   open  — no roster. The original localhost research flow: the legacy
 *           single-assignment endpoints (/assignment, /submissions) keep
 *           working, coder identity is self-asserted, and the new
 *           multi-assignment endpoints accept a ?coder_id/body coder_id.
 *   keyed — roster present. Every coder endpoint requires X-A19-Coder-Key;
 *           identity comes ONLY from the key, a coder sees only their
 *           assigned packets, and the legacy open endpoints are refused.
 *
 * /panel is admin-only in both modes (participant-role requests are 403'd);
 * it is the packets × coders completeness matrix for the researcher.
 */

import { Router } from 'express';
import fs from 'node:fs';
import {
  A19PanelError,
  coderWorklist,
  deleteDraft,
  findCoderByKey,
  getAssignment,
  listSubmissions,
  loadRoster,
  nextCoderId,
  panelStatus,
  readDraft,
  repoRel,
  resolveCodebookPath,
  resolveWorkspace,
  safeCoderId,
  safeSlug,
  sanitizeAssignment,
  submissionDirForSlug,
  writeDraft,
  writeSubmission,
  assignmentSlug,
} from '../services/a19AdjudicationPanel.js';

const router = Router();

const CODER_KEY_HEADER = 'x-a19-coder-key';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/** Per-request context: workspace paths + roster (null in open mode). */
function context() {
  const workspace = resolveWorkspace(process.env);
  const roster = loadRoster(workspace);
  return { workspace, roster, mode: roster ? 'keyed' : 'open' };
}

function sendError(res, error) {
  const status = error instanceof A19PanelError ? error.httpStatus : 500;
  const body = { success: false, error: error.message };
  if (error.code) body.code = error.code;
  if (error.details) body.details = error.details;
  return res.status(status).json(body);
}

/**
 * Resolve the requesting coder in keyed mode. Throws 401 when the key is
 * missing or wrong — the key IS the coder's identity; nothing in the request
 * body can substitute for it.
 */
function requireCoder(ctx, req) {
  const coder = findCoderByKey(ctx.roster, req.get(CODER_KEY_HEADER) || '');
  if (!coder) {
    throw new A19PanelError('a valid coder access key is required (X-A19-Coder-Key)', {
      status: 401,
      code: 'coder_key_required',
    });
  }
  return coder;
}

/** Keyed mode: the slug must be on the coder's roster line. */
function requireAssigned(coder, slug) {
  if (!coder.assignments.includes(slug)) {
    throw new A19PanelError(`assignment ${slug} is not assigned to you`, {
      status: 403,
      code: 'not_assigned',
    });
  }
}

/**
 * Identity for draft/submission endpoints. Keyed mode: from the key, and any
 * client-supplied coder_id must agree (a mismatch is a blind-integrity error,
 * not a fallback). Open mode: self-asserted, as the original flow allowed.
 */
function resolveIdentity(ctx, req, { slug, claimed }) {
  if (ctx.mode === 'keyed') {
    const coder = requireCoder(ctx, req);
    requireAssigned(coder, slug);
    if (claimed && safeCoderId(claimed) !== coder.coder_id) {
      throw new A19PanelError('coder_id is fixed by your access key', {
        status: 400,
        code: 'coder_id_mismatch',
      });
    }
    return { coderId: coder.coder_id, coderRole: coder.coder_role || null };
  }
  return { coderId: safeCoderId(claimed), coderRole: null };
}

// ---------------------------------------------------------------------------
// Worklist + assignments
// ---------------------------------------------------------------------------

router.get('/me', (req, res) => {
  try {
    const ctx = context();
    if (ctx.mode === 'keyed') {
      const coder = requireCoder(ctx, req);
      return res.json({
        success: true,
        mode: 'keyed',
        coder: { coder_id: coder.coder_id, coder_role: coder.coder_role || null },
        worklist: coderWorklist(ctx.workspace, { coder }),
      });
    }
    const coderId = req.query.coder_id ? safeCoderId(req.query.coder_id) : null;
    return res.json({
      success: true,
      mode: 'open',
      coder: coderId ? { coder_id: coderId, coder_role: null } : null,
      worklist: coderWorklist(ctx.workspace, { coderId }),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/assignments/:slug', (req, res) => {
  try {
    const ctx = context();
    // Authenticate on the canonical slug BEFORE touching the assignment file:
    // an unauthenticated probe must not learn (via 404/500 vs 401) whether a
    // slug exists or whether its file is leaky.
    const slug = safeSlug(req.params.slug);
    if (ctx.mode === 'keyed') {
      const coder = requireCoder(ctx, req);
      requireAssigned(coder, slug);
      const resolved = getAssignment(ctx.workspace, slug);
      const [entry] = coderWorklist(ctx.workspace, {
        coder: { ...coder, assignments: [resolved.slug] },
      });
      return res.json({
        success: true,
        mode: 'keyed',
        assignment: resolved.assignment,
        codebook: resolved.codebook,
        coder_status: entry,
      });
    }
    const resolved = getAssignment(ctx.workspace, slug);
    const submissions = listSubmissions({
      assignmentPath: resolved.assignmentPath,
      codebookPath: resolved.codebookPath,
      submissionDir: resolved.submissionDir,
    });
    return res.json({
      success: true,
      mode: 'open',
      assignment: resolved.assignment,
      codebook: resolved.codebook,
      submissions,
      next_coder_id: nextCoderId(resolved.submissionDir),
      paths: {
        assignment: repoRel(resolved.assignmentPath),
        codebook: repoRel(resolved.codebookPath),
        out_dir: repoRel(resolved.submissionDir),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// Drafts — resume/progress state
// ---------------------------------------------------------------------------

router.get('/assignments/:slug/draft', (req, res) => {
  try {
    const ctx = context();
    const slug = safeSlug(req.params.slug);
    const { coderId } = resolveIdentity(ctx, req, { slug, claimed: req.query.coder_id });
    const resolved = getAssignment(ctx.workspace, slug);
    const draft = readDraft({ submissionDir: resolved.submissionDir, coderId });
    return res.json({ success: true, draft });
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/assignments/:slug/draft', (req, res) => {
  try {
    const ctx = context();
    const slug = safeSlug(req.params.slug);
    const { coderId } = resolveIdentity(ctx, req, { slug, claimed: req.body?.coder_id });
    const resolved = getAssignment(ctx.workspace, slug);
    const draft = writeDraft({
      submissionDir: resolved.submissionDir,
      coderId,
      slug: resolved.slug,
      assignmentId: resolved.assignment.assignment_id,
      payload: req.body?.payload ?? null,
    });
    return res.json({
      success: true,
      draft: { assignment_slug: draft.assignment_slug, coder_id: draft.coder_id, updated_at: draft.updated_at },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/assignments/:slug/draft', (req, res) => {
  try {
    const ctx = context();
    const slug = safeSlug(req.params.slug);
    const { coderId } = resolveIdentity(ctx, req, { slug, claimed: req.query.coder_id });
    const resolved = getAssignment(ctx.workspace, slug);
    deleteDraft({ submissionDir: resolved.submissionDir, coderId });
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

router.post('/assignments/:slug/submissions', (req, res) => {
  try {
    const ctx = context();
    const slug = safeSlug(req.params.slug);
    const identity = resolveIdentity(ctx, req, { slug, claimed: req.body?.coder_id });
    const resolved = getAssignment(ctx.workspace, slug);
    const result = writeSubmission({
      assignmentPath: resolved.assignmentPath,
      codebookPath: resolved.codebookPath,
      submissionDir: resolved.submissionDir,
      coderId: identity.coderId,
      coderRole: req.body?.coder_role || identity.coderRole || 'expert_or_semi_expert',
      armJudgments: req.body?.arm_judgments,
      pairwiseJudgment: req.body?.pairwise_judgment,
      codebookFeedback: req.body?.codebook_feedback,
      overwrite: Boolean(req.body?.overwrite),
    });
    if (!result.ok) return res.status(422).json({ success: false, validation: result.validation });
    return res.status(201).json({
      success: true,
      coder_path: repoRel(result.coderPath),
      validation: result.validation,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// Panel completeness — admin only
// ---------------------------------------------------------------------------

router.get('/panel', (req, res) => {
  try {
    // makeRoleGate() tags participant-credentialed requests; the completeness
    // matrix (who has coded what, across the whole panel) is researcher-only.
    if (req.evalRole === 'participant') {
      throw new A19PanelError('an admin role is required for the panel view', {
        status: 403,
        code: 'admin_required',
      });
    }
    const ctx = context();
    return res.json({ success: true, mode: ctx.mode, ...panelStatus(ctx.workspace, { roster: ctx.roster }) });
  } catch (error) {
    return sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// Legacy single-assignment endpoints (open mode only)
// ---------------------------------------------------------------------------

/**
 * The pre-roster contract: one assignment resolved from env/default, full
 * submissions listing, self-asserted coder identity. Kept verbatim for the
 * localhost research flow and the offline-CLI parity tests — but refused in
 * keyed mode, where an un-keyed listing would leak panel state to coders.
 */
function requireOpenMode(ctx) {
  if (ctx.mode === 'keyed') {
    throw new A19PanelError('this server runs keyed adjudication; open /adjudication/ with your access key link', {
      status: 403,
      code: 'keyed_mode',
    });
  }
}

function legacyPaths(ctx) {
  const { workspace } = ctx;
  const assignmentPath = workspace.legacyAssignmentPath;
  if (!fs.existsSync(assignmentPath)) throw new Error(`A19 assignment not found: ${repoRel(assignmentPath)}`);
  const raw = readJson(assignmentPath);
  const assignment = sanitizeAssignment(raw, { sourcePath: assignmentPath });
  const codebookPath = resolveCodebookPath(workspace, assignment);
  if (!fs.existsSync(codebookPath)) throw new Error(`A19 codebook not found: ${repoRel(codebookPath)}`);
  const submissionDir = submissionDirForSlug(workspace, assignmentSlug(assignmentPath));
  return { assignment, assignmentPath, codebookPath, submissionDir };
}

router.get('/assignment', (req, res) => {
  try {
    const ctx = context();
    requireOpenMode(ctx);
    const { assignment, assignmentPath, codebookPath, submissionDir } = legacyPaths(ctx);
    const codebook = readJson(codebookPath);
    res.json({
      success: true,
      assignment,
      codebook,
      paths: {
        assignment: repoRel(assignmentPath),
        codebook: repoRel(codebookPath),
        out_dir: repoRel(submissionDir),
      },
      next_coder_id: nextCoderId(submissionDir),
      submissions: listSubmissions({ assignmentPath, codebookPath, submissionDir }),
      claim_boundary: {
        licenses_a19_transfer_claim: false,
        licenses_paper_or_atlas_claim: false,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/submissions', (req, res) => {
  try {
    const ctx = context();
    requireOpenMode(ctx);
    const { assignmentPath, codebookPath, submissionDir } = legacyPaths(ctx);
    res.json({ success: true, submissions: listSubmissions({ assignmentPath, codebookPath, submissionDir }) });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/submissions', (req, res) => {
  try {
    const ctx = context();
    requireOpenMode(ctx);
    const { assignmentPath, codebookPath, submissionDir } = legacyPaths(ctx);
    const result = writeSubmission({
      assignmentPath,
      codebookPath,
      submissionDir,
      coderId: req.body?.coder_id,
      coderRole: req.body?.coder_role || 'expert_or_semi_expert',
      armJudgments: req.body?.arm_judgments,
      pairwiseJudgment: req.body?.pairwise_judgment,
      codebookFeedback: req.body?.codebook_feedback,
      overwrite: Boolean(req.body?.overwrite),
    });
    if (!result.ok) return res.status(422).json({ success: false, validation: result.validation });
    return res.status(201).json({
      success: true,
      coder_path: repoRel(result.coderPath),
      validation: result.validation,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;

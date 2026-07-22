/**
 * Human labelling-game routes for the Paper 2.0 superego taxonomy and the
 * tutor-stub communicative-impasse corpus.
 *
 * This is an admin/researcher surface. On a public/role-authenticated server it
 * remains outside the participant allowlist, while localhost-open dev mode can
 * use it directly.
 */

import { Router } from 'express';
import {
  getCodebook,
  getComparison,
  getItems,
  getStatus,
  HumanCodingError,
  saveCoding,
} from '../services/humanCodingStore.js';
import {
  getLabellingGameCodebook,
  getLabellingGameComparison,
  getLabellingGameItems,
  getLabellingGameStatus,
  listLabellingGameDatasets,
  saveLabellingGameCoding,
} from '../services/labellingGameStore.js';

const router = Router();

router.get('/datasets', (_req, res) => {
  try {
    return res.json(listLabellingGameDatasets());
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/datasets/:datasetId/status', (req, res) => {
  try {
    return res.json(getLabellingGameStatus({ datasetId: req.params.datasetId }));
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/datasets/:datasetId/codebook', (req, res) => {
  try {
    return res.json(getLabellingGameCodebook({ datasetId: req.params.datasetId }));
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/datasets/:datasetId/items', (req, res) => {
  try {
    return res.json(
      getLabellingGameItems({
        datasetId: req.params.datasetId,
        coderId: req.query.coder_id,
      }),
    );
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/datasets/:datasetId/comparison', (req, res) => {
  try {
    return res.json(
      getLabellingGameComparison({
        datasetId: req.params.datasetId,
        coderId: req.query.coder_id,
        allowPartial: req.query.allow_partial === '1',
      }),
    );
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/datasets/:datasetId/items/:itemId', (req, res) => {
  try {
    return res.json(
      saveLabellingGameCoding({
        datasetId: req.params.datasetId,
        coderId: req.body?.coder_id || req.query.coder_id,
        itemId: req.params.itemId,
        coding: req.body || {},
      }),
    );
  } catch (error) {
    return sendError(res, error);
  }
});

function sendError(res, error) {
  const status = error instanceof HumanCodingError ? error.httpStatus : 500;
  const body = { success: false, error: error.message };
  if (error.code) body.code = error.code;
  if (error.details) body.details = error.details;
  return res.status(status).json(body);
}

router.get('/status', (_req, res) => {
  try {
    return res.json(getStatus());
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/codebook', (_req, res) => {
  try {
    return res.json(getCodebook());
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/items', (req, res) => {
  try {
    return res.json(getItems({ coderId: req.query.coder_id }));
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/comparison', (req, res) => {
  try {
    return res.json(
      getComparison({
        coderId: req.query.coder_id,
        allowPartial: req.query.allow_partial === '1',
      }),
    );
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/items/:itemId', (req, res) => {
  try {
    return res.json(
      saveCoding({
        coderId: req.body?.coder_id || req.query.coder_id,
        itemId: req.params.itemId,
        coding: req.body || {},
      }),
    );
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;

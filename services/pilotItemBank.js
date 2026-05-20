/**
 * Pilot Item Bank — pre/post fractions test items.
 *
 * Loads `data/pilot/fractions-items.yaml`, exposes form-counterbalanced
 * lookup per session, and scores responses by comparing `value` to `correct`.
 *
 * Form counterbalancing: a session whose UUID's last hex digit is even
 * gets Form A pretest / Form B posttest; odd gets B / A. Deterministic from
 * the session ID — no schema changes needed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const ITEMS_PATH = process.env.PILOT_ITEMS_PATH || path.join(ROOT_DIR, 'config', 'pilot', 'fractions-items.yaml');

let cache = null;

export function loadItems() {
  if (cache) return cache;
  if (!fs.existsSync(ITEMS_PATH)) {
    throw new Error(`Pilot item bank not found at ${ITEMS_PATH}`);
  }
  const raw = fs.readFileSync(ITEMS_PATH, 'utf-8');
  const parsed = yaml.parse(raw);
  if (!parsed?.forms?.A || !parsed?.forms?.B) {
    throw new Error(`Item bank missing forms.A and/or forms.B`);
  }
  cache = parsed;
  return cache;
}

export function clearCache() {
  cache = null;
}

// Deterministic per-session form order. The session ID UUID v4 has the form
// xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx — the last hex digit is uniformly
// random, so even/odd parity gives a 50/50 split.
export function getFormOrder(sessionId) {
  if (!sessionId) return ['A', 'B'];
  const lastChar = String(sessionId).replace(/-/g, '').slice(-1).toLowerCase();
  const n = parseInt(lastChar, 16);
  if (Number.isNaN(n)) return ['A', 'B'];
  return n % 2 === 0 ? ['A', 'B'] : ['B', 'A'];
}

export function getFormForPhase(sessionId, phase) {
  const [pre, post] = getFormOrder(sessionId);
  if (phase === 'pretest') return pre;
  if (phase === 'posttest') return post;
  throw new Error(`Unknown phase: ${phase}`);
}

// Strip the `correct` field before sending to participants — the answer key
// must never round-trip through their browser.
function publicView(item) {
  const { correct, ...rest } = item; // eslint-disable-line no-unused-vars
  return rest;
}

export function getItemsForSession(sessionId, phase) {
  const items = loadItems();
  const form = getFormForPhase(sessionId, phase);
  const list = items.forms[form];
  if (!Array.isArray(list)) {
    throw new Error(`Form ${form} not found in item bank`);
  }
  return {
    form,
    items: list.map(publicView),
  };
}

// The judge-free predicate, decoupled from the human-pilot form machinery.
// Given an explicit items array (each at least {id, correct}) and a responses
// array, return the is_correct shape — deterministic case-insensitive
// exact-match of chosen value vs `correct`, NO LLM, no session, no forms.A/B.
//
// This is the single audited scoring predicate. scoreResponses() (the human
// pilot path) layers form-counterbalancing on top and delegates here; A17's
// lock-probe harness scores its freshly-authored misconception-keyed panel
// through here directly (notes/design-a17-speech-act-lock-prototype.md §3.3).
// One predicate, two callers — so "judge-free" stays verifiable by reading
// one function (the §2 anti-closed-loop requirement).
export function scoreResponsesRaw(items, responses) {
  if (!Array.isArray(items)) {
    throw new Error('items must be an array');
  }
  if (!Array.isArray(responses)) {
    throw new Error('responses must be an array');
  }
  const byId = new Map(items.map((it) => [it.id, it]));

  return responses.map((r, idx) => {
    const item = byId.get(r.item_id);
    const isCorrect =
      item && r.response_value !== undefined && r.response_value !== null
        ? String(r.response_value).toLowerCase() === String(item.correct).toLowerCase()
        : null;
    return {
      item_id: r.item_id,
      item_position: r.item_position ?? idx,
      response_value: r.response_value,
      is_correct: isCorrect,
      response_ms: r.response_ms ?? null,
    };
  });
}

// Server-side scoring: for each submitted response, look up the item in the
// session's form and check value === correct. Returns the responses array
// shaped for pilotStore.recordTestResponses (with is_correct populated).
export function scoreResponses(sessionId, phase, responses) {
  if (!Array.isArray(responses)) {
    throw new Error('responses must be an array');
  }
  const items = loadItems();
  const form = getFormForPhase(sessionId, phase);
  const list = items.forms[form];
  return scoreResponsesRaw(list, responses);
}

export default {
  loadItems,
  clearCache,
  getFormOrder,
  getFormForPhase,
  getItemsForSession,
  scoreResponses,
  scoreResponsesRaw,
};

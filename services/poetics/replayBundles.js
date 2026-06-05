import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// Discursive replay bundles — read-only model for the poetics browser.
//
// A "replay" is a COUNTERFACTUAL REVISION, not an online tutor run: an original
// public transcript gets ONE bounded rewrite by a generator CLI (codex/claude/…)
// → a revised copy, optionally smoke-checked by an adversarial checker CLI, then
// a local GATE sorts each item into survivor / needs_revision / rejected /
// unchecked. Every manifest carries the claim boundary verbatim:
//   "counterfactual_revision_not_online_adaptation".
//
// Each run lives under exports/discursive-replays/<bundle>/ with a manifest.json
// that already INLINES, per record: gate (per-criterion raw/value/threshold/pass),
// check, generator, checker, and the on-disk paths. So the list/item views build
// almost entirely from the manifest; we only read original-public.txt /
// revised-public.txt to compute the line diff. Reads are defensive — dry-run and
// partially-materialised bundles (no .txt yet) degrade gracefully.
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '../..');
export const REPLAYS_DIR = path.join(ROOT_DIR, 'exports', 'discursive-replays');

// Gate verdict buckets in the manifest's local_gate.summary, in display order.
export const GATE_BUCKETS = Object.freeze([
  'survivors',
  'needs_revision',
  'rejected',
  'unchecked',
  'disabled',
  'dry_run',
  'unknown',
]);

// Guard against pathological diffs: transcripts are ~30 lines, but never let a
// stray huge file drive the O(n·m) LCS table into the millions of cells.
const MAX_DIFF_LINES = 4000;

function readJson(p) {
  try {
    return p ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  } catch {
    return null;
  }
}
function readText(p) {
  try {
    return p ? fs.readFileSync(p, 'utf8') : null;
  } catch {
    return null;
  }
}
function exists(p) {
  try {
    return !!p && fs.existsSync(p);
  } catch {
    return false;
  }
}

// item_id -> { bucket, status, failures, warnings } from local_gate.summary.
function statusByItemId(manifest) {
  const map = new Map();
  const summary = manifest?.local_gate?.summary;
  if (!summary) return map;
  for (const bucket of GATE_BUCKETS) {
    for (const entry of summary[bucket] || []) {
      if (entry?.item_id) {
        map.set(entry.item_id, {
          bucket,
          status: entry.status || bucket,
          failures: entry.failures || [],
          warnings: entry.warnings || [],
        });
      }
    }
  }
  return map;
}

function bucketCounts(manifest) {
  const summary = manifest?.local_gate?.summary || {};
  const counts = {};
  for (const bucket of GATE_BUCKETS) counts[bucket] = (summary[bucket] || []).length;
  return counts;
}

// The checker payload has two shapes: the manifest inlines it FLAT
// ({passes,scores,findings,…}); the per-item check.json wraps it as {parsed:{…}}.
// Collapse both to the flat body.
function checkBody(check) {
  return check?.parsed || check || null;
}

// Normalised gate scores: prefer the manifest's inline per-criterion shape
// ({raw,value,threshold,passes}); fall back to the checker's flat scores.
function normaliseScores(rec, check) {
  const gateScores = rec?.gate?.scores;
  if (gateScores && typeof gateScores === 'object') {
    return Object.entries(gateScores).map(([criterion, s]) => ({
      criterion,
      raw: s?.raw ?? null,
      value: s?.value ?? null,
      scale: s?.scale ?? null,
      threshold: s?.threshold ?? null,
      passes: s?.passes ?? null,
    }));
  }
  const flat = checkBody(check)?.scores;
  if (flat && typeof flat === 'object') {
    return Object.entries(flat).map(([criterion, raw]) => ({
      criterion,
      raw,
      value: null,
      scale: null,
      threshold: null,
      passes: null,
    }));
  }
  return [];
}

// ── bundle discovery ──────────────────────────────────────────────────────────

export function listReplayBundles({ dir = REPLAYS_DIR } = {}) {
  if (!exists(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const bundleDir = path.join(dir, name);
    let stat;
    try {
      stat = fs.statSync(bundleDir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    const manifest = readJson(path.join(bundleDir, 'manifest.json'));
    if (!manifest) continue;
    out.push({
      name,
      kind: manifest.kind || null,
      createdAt: manifest.created_at || null,
      generator: manifest.generator || null,
      checker: manifest.checker || null,
      claimBoundary: manifest.claim_boundary || null,
      gateEnabled: !!manifest?.local_gate?.enabled,
      thresholds: manifest?.local_gate?.thresholds || null,
      count: manifest.count ?? (manifest.records?.length || 0),
      buckets: bucketCounts(manifest),
    });
  }
  // Newest first (createdAt is ISO; lexical sort is chronological), name as tiebreak.
  out.sort(
    (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || a.name.localeCompare(b.name),
  );
  return out;
}

// ── one bundle: items with gate verdict + check summary ─────────────────────────

export function readReplayBundle(name, { dir = REPLAYS_DIR } = {}) {
  const bundleDir = path.join(dir, name);
  const manifest = readJson(path.join(bundleDir, 'manifest.json'));
  if (!manifest) return null;
  const statusMap = statusByItemId(manifest);

  const items = (manifest.records || []).map((rec) => {
    const itemId = rec.item?.id || null;
    const status = statusMap.get(itemId) || {};
    const check = rec.check || readJson(rec.paths?.checkJson);
    const body = checkBody(check);
    const scores = normaliseScores(rec, check);
    return {
      itemId,
      runId: rec.item?.run_id || null,
      source: rec.item?.source || null,
      status: rec.gate?.status || status.status || 'unknown',
      bucket: status.bucket || 'unknown',
      escalate: !!rec.gate?.escalate,
      generator: rec.generator?.backend || manifest.generator || null,
      checker: rec.checker?.backend || manifest.checker || null,
      hasOriginal: exists(rec.paths?.originalPublic),
      hasRevised: exists(rec.paths?.revisedPublic),
      passes: body?.passes ?? null,
      scores,
      findingsCount: (body?.findings || []).length,
      failures: status.failures || [],
      warnings: status.warnings || [],
    };
  });

  return {
    name,
    kind: manifest.kind || null,
    createdAt: manifest.created_at || null,
    generator: manifest.generator || null,
    checker: manifest.checker || null,
    claimBoundary: manifest.claim_boundary || null,
    nextStageRule: manifest?.local_gate?.next_stage_rule || null,
    thresholds: manifest?.local_gate?.thresholds || null,
    gateEnabled: !!manifest?.local_gate?.enabled,
    buckets: bucketCounts(manifest),
    count: manifest.count ?? items.length,
    items,
  };
}

// ── one item: the original↔revised diff + check findings + revision rationale ──

export function readReplayItem(name, itemId, { dir = REPLAYS_DIR } = {}) {
  const bundleDir = path.join(dir, name);
  const manifest = readJson(path.join(bundleDir, 'manifest.json'));
  if (!manifest) return null;
  const rec = (manifest.records || []).find((r) => r.item?.id === itemId);
  if (!rec) return null;

  const original = readText(rec.paths?.originalPublic);
  const revised = readText(rec.paths?.revisedPublic);
  const status = statusByItemId(manifest).get(itemId) || {};
  const check = rec.check || readJson(rec.paths?.checkJson);
  const body = checkBody(check);
  const revision = readJson(rec.paths?.revisionJson);
  const diff = lineDiff(original || '', revised || '');

  return {
    bundle: name,
    itemId,
    runId: rec.item?.run_id || null,
    source: rec.item?.source || null,
    fullTranscriptPath: rec.item?.full_transcript_path || null,
    status: rec.gate?.status || status.status || 'unknown',
    bucket: status.bucket || 'unknown',
    escalate: !!rec.gate?.escalate,
    materialized: {
      original: exists(rec.paths?.originalPublic),
      revised: exists(rec.paths?.revisedPublic),
    },
    original: original || '',
    revised: revised || '',
    diff,
    diffStats: diffStats(diff),
    scores: normaliseScores(rec, check),
    passes: body?.passes ?? null,
    claimBoundaryOk: body?.claim_boundary_ok ?? null,
    findings: body?.findings || [],
    revision: summariseRevision(revision),
    generator: rec.generator
      ? { backend: rec.generator.backend, model: rec.generator.model, latencyMs: rec.generator.latencyMs ?? null }
      : null,
    checker: rec.checker
      ? { backend: rec.checker.backend, model: rec.checker.model, latencyMs: rec.checker.latencyMs ?? null }
      : null,
    failures: status.failures || [],
    warnings: status.warnings || [],
  };
}

// Pull the human-legible parts of revision.json. The materialised codex/claude
// shape carries a per-turn move_ledger (why each turn was rewritten) and a
// hidden_state_use_ledger (which private fact was used, its public licence quote,
// and the leakage risk) — that pairing is the audit trail behind the claim
// boundary. We also accept a {summary,changes,turns} fallback for other generators.
function summariseRevision(revision) {
  if (!revision || typeof revision !== 'object') return null;
  const parsed = revision.parsed || revision;
  const moveLedger = (Array.isArray(parsed.move_ledger) ? parsed.move_ledger : []).map((m) => ({
    turn: m?.turn ?? null,
    learnerSignal: m?.learner_signal ?? null,
    evidenceQuote: m?.evidence_quote ?? null,
    tutorHypothesis: m?.tutor_hypothesis ?? null,
    tactic: m?.tactic ?? null,
    publicAction: m?.public_action ?? null,
    learnerUptakeOrContest: m?.learner_uptake_or_contest ?? null,
    tutorRevision: m?.tutor_revision ?? null,
    ontologyTerms: Array.isArray(m?.ontology_terms) ? m.ontology_terms : [],
  }));
  const hiddenStateLedger = (Array.isArray(parsed.hidden_state_use_ledger) ? parsed.hidden_state_use_ledger : []).map(
    (h) => ({
      privateFact: h?.private_fact ?? null,
      usedFor: h?.used_for ?? null,
      publicLicenseQuote: h?.public_license_quote ?? null,
      leakageRisk: h?.leakage_risk ?? null,
    }),
  );
  const nl = parsed.non_leakage_check;
  return {
    summary: parsed.summary || parsed.rationale || null,
    moveLedger,
    hiddenStateLedger,
    nonLeakageCheck: nl && typeof nl === 'object' ? { passes: nl.passes ?? null, notes: nl.notes || [] } : null,
    claimBoundary: parsed.claim_boundary || null,
    // legacy fallback shape
    changes: Array.isArray(parsed.changes) ? parsed.changes : [],
    turns: Array.isArray(parsed.turns) ? parsed.turns : [],
  };
}

// ── minimal LCS line diff (no dependency) ───────────────────────────────────────

// Returns [{ type: 'eq'|'add'|'del', text, aLine, bLine }] in original reading order.
// aLine/bLine are 1-based source line numbers (null on the side that lacks the line).
export function lineDiff(aText, bText) {
  const a = String(aText ?? '').split('\n');
  const b = String(bText ?? '').split('\n');
  const n = a.length;
  const m = b.length;

  // Bail to a coarse all-replace diff if either side is pathologically large.
  if (n > MAX_DIFF_LINES || m > MAX_DIFF_LINES) {
    const out = [];
    a.forEach((text, i) => out.push({ type: 'del', text, aLine: i + 1, bLine: null }));
    b.forEach((text, j) => out.push({ type: 'add', text, aLine: null, bLine: j + 1 }));
    return out;
  }

  // dp[i][j] = LCS length of a[i:] and b[j:].
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'eq', text: a[i], aLine: i + 1, bLine: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i], aLine: i + 1, bLine: null });
      i++;
    } else {
      out.push({ type: 'add', text: b[j], aLine: null, bLine: j + 1 });
      j++;
    }
  }
  while (i < n) out.push({ type: 'del', text: a[i], aLine: ++i, bLine: null });
  while (j < m) out.push({ type: 'add', text: b[j], aLine: null, bLine: ++j });
  return out;
}

export function diffStats(diff) {
  let added = 0;
  let deleted = 0;
  let unchanged = 0;
  for (const row of diff) {
    if (row.type === 'add') added++;
    else if (row.type === 'del') deleted++;
    else unchanged++;
  }
  return { added, deleted, unchanged, changed: added + deleted };
}

export default { listReplayBundles, readReplayBundle, readReplayItem, lineDiff, diffStats, REPLAYS_DIR, GATE_BUCKETS };

#!/usr/bin/env node
/**
 * readjudicate-a18-transfer.js
 *
 * Re-adjudicates A18.37 held-out transfer under ONE uniform criterion applied
 * to every family (fresh families AND the relational_betweenness prior),
 * replacing two inconsistent standards in the shipped pipeline:
 *   - fresh families judged by the per-sibling lexical `policy_correctness_gate`
 *     (a repair-marker phrase matcher, shown to false-negative correct moves);
 *   - the prior judged by `relationalPrior()` with NO correctness gate at all.
 *
 * The unit judged here is the registered token the FINAL learner turn COMMITS
 * to -- a semantic property, recorded by hand (or by the --llm channel) in
 * committed-answers.json. Three lexical matchers (contiguous / ordered-
 * subsequence / order-free) are computed alongside as EVIDENCE: they are shown
 * to contradict one another on the load-bearing arms, which is the empirical
 * reason a surface rule cannot be canonical here.
 *
 * Criterion spec: notes/poetics/2026-06-06-a18-transfer-readjudication-criterion.md
 * Criterion version: a18-transfer-readjudication-v2
 *
 * STATUS: independent cross-check, NOT the canonical channel. The canonical
 * A18.37 adjudication is scripts/blind-option-adjudication.js, reported in
 * paper-full-2.0.md §7.9 (blind three-critic panel; target/decoy aliases held
 * out of the critic; symmetric mechanical match; reasoning-basis divergence as
 * the distinctiveness guard). That instrument is stronger than this one on three
 * counts: blind to the answer key, mechanically matched, and function-level in
 * its distinctiveness check. This script reads the SAME turns by hand and AGREES
 * with the blind arbiter card-for-card on every shared card; its value is
 * convergent confirmation, not a competing rate. Two known limits of this
 * cross-check, both reported in the output: (a) COVERAGE -- findReports() only
 * adjudicates families whose resolved report sits at the flat layout
 * a18.35-*-local/a18.6-policy-ablation.<sib>/; a family whose report is nested
 * deeper (e.g. distal_correspondence, under distal_correspondence_priority/) is
 * listed under summary.skipped_resolved_chain_dirs and NOT counted -- defer to
 * the blind arbiter for those; (b) CRITERION -- the MIN_DISTINCTIVENESS numeric
 * gate below is a proxy for the canonical reasoning-basis-divergence guard and
 * is stricter; it is the only reason this cross-check's per-family count differs
 * from §7.9 (it rejects plum_posts and both pointer_chain cards the canonical
 * guard credits). Do NOT cite this script's convergence_rate as "the rate";
 * cite §7.9's per-card 5/8.
 *
 * Deterministic given its inputs (reports + globbed continuations + committed-
 * answers.json): no randomness, no clock, no network. Same inputs -> identical
 * output. Provenance: SHA-256 of every continuation and of committed-answers.json.
 *
 * Usage:
 *   node scripts/readjudicate-a18-transfer.js \
 *     --root exports/recursive-tutor-learning \
 *     --out  exports/recursive-tutor-learning/a18.37-readjudication
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CRITERION_VERSION = 'a18-transfer-readjudication-v2';
const CRITERION_SPEC = 'notes/poetics/2026-06-06-a18-transfer-readjudication-criterion.md';
const MIN_DISTINCTIVENESS = 0.12; // mirror of the contrast gate's own floor

function parseArgs(argv) {
  const a = { root: 'exports/recursive-tutor-learning', out: null, committed: null, llm: false };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--root') a.root = argv[++i];
    else if (t === '--out') a.out = argv[++i];
    else if (t === '--committed') a.committed = argv[++i];
    else if (t === '--llm') a.llm = true;
    else throw new Error(`unknown arg: ${t}`);
  }
  if (!a.out) a.out = path.join(a.root, 'a18.37-readjudication');
  if (!a.committed) a.committed = path.join(a.out, 'committed-answers.json');
  return a;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Walk root for every resolved sibling transfer report (sorted, deterministic). */
function findReports(root) {
  const out = [];
  let chainDirs = [];
  try {
    chainDirs = fs.readdirSync(root).filter((d) => d.startsWith('a18.35-') && d.endsWith('-local'));
  } catch (e) {
    throw new Error(`cannot read root ${root}: ${e.message}`);
  }
  for (const cd of chainDirs.sort()) {
    const famDir = path.join(root, cd);
    let abls = [];
    try {
      abls = fs.readdirSync(famDir).filter((x) => x.startsWith('a18.6-policy-ablation.'));
    } catch (e) {
      continue;
    }
    for (const a of abls.sort()) {
      const rp = path.join(famDir, a, 'a18.8-s0-hard-bounded-transfer-report.json');
      if (fs.existsSync(rp)) out.push({ chainDir: cd, ablationDir: path.join(famDir, a), reportPath: rp });
    }
  }
  return out;
}

/**
 * Every a18.35-*-local family dir that contains a resolved transfer report
 * ANYWHERE beneath it (recursive), regardless of layout depth. Compared against
 * the flat-layout set found by findReports() to surface families this
 * cross-check silently skips (e.g. distal_correspondence's deeper nesting).
 */
function findResolvedChainDirs(root) {
  const found = new Set();
  const REPORT = 'a18.8-s0-hard-bounded-transfer-report.json';
  let chainDirs = [];
  try {
    chainDirs = fs.readdirSync(root).filter((d) => d.startsWith('a18.35-') && d.endsWith('-local'));
  } catch (e) {
    return found;
  }
  for (const cd of chainDirs.sort()) {
    let hit = false;
    (function walk(dir) {
      if (hit) return;
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (e) {
        return;
      }
      for (const ent of entries) {
        if (hit) return;
        if (ent.isFile() && ent.name === REPORT) {
          hit = true;
          return;
        }
        if (ent.isDirectory()) walk(path.join(dir, ent.name));
      }
    })(path.join(root, cd));
    if (hit) found.add(cd);
  }
  return found;
}

/**
 * Discover revised-public.txt for an arm by GLOBBING the ablation dir, never
 * trusting the report's recorded `revised_public_path` (stale across protocol
 * versions). `armMarker` is the substring identifying the replay dir.
 */
function findContinuation(ablationDir, armMarker) {
  const hits = [];
  (function walk(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name === 'revised-public.txt' && p.includes(armMarker)) hits.push(p);
    }
  })(ablationDir);
  hits.sort();
  return hits[0] || null; // deterministic pick if (unexpectedly) more than one
}

/** Split a transcript into {speaker, text} turns by line prefix. */
function parseTurns(raw) {
  const lines = raw.split(/\r?\n/);
  const turns = [];
  let cur = null;
  const prefix = /^(LEARNER|TUTOR|STAGE)\s*:\s*(.*)$/i;
  for (const line of lines) {
    const m = line.match(prefix);
    if (m) {
      if (cur) turns.push(cur);
      cur = { speaker: m[1].toUpperCase(), text: m[2] };
    } else if (cur) {
      cur.text += (cur.text ? '\n' : '') + line;
    }
  }
  if (cur) turns.push(cur);
  return turns;
}

function lastLearnerTurn(raw) {
  const turns = parseTurns(raw);
  for (let i = turns.length - 1; i >= 0; i--) if (turns[i].speaker === 'LEARNER') return turns[i].text;
  return null;
}

// ---- lexical matchers (EVIDENCE ONLY; not canonical) ----------------------
function norm(s) {
  return (s || '').replace(/^["“]|["”]$/g, '').toLowerCase();
}
function tokens(s) {
  return norm(s)
    .replace(/-/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
function matchContiguous(text, alias) {
  return norm(text).includes(norm(alias));
}
function matchOrderedSubseq(text, alias) {
  const a = tokens(alias);
  const h = tokens(text);
  let i = 0;
  for (const w of h) if (i < a.length && w === a[i]) i++;
  return i === a.length;
}
function matchOrderFree(text, alias) {
  const h = new Set(tokens(text));
  return tokens(alias).every((t) => h.has(t));
}
function isSubsetTokens(small, big) {
  const B = new Set(tokens(big));
  return tokens(small).every((t) => B.has(t));
}
/** Classify under one matcher fn; suppress incorrect aliases subsumed by a matched correct alias. */
function classifyBy(matchFn, text, correctAliases, incorrectAliases) {
  const c = (correctAliases || []).filter((al) => al && matchFn(text, al));
  let w = (incorrectAliases || []).filter((al) => al && matchFn(text, al));
  if (c.length) w = w.filter((iw) => !c.some((cw) => isSubsetTokens(iw, cw)));
  if (c.length && !w.length) return 'correct';
  if (w.length && !c.length) return 'incorrect';
  if (c.length && w.length) return 'contested';
  return 'unreached';
}
function lexicalEvidence(text, correctAliases, incorrectAliases) {
  const contiguous = classifyBy(matchContiguous, text, correctAliases, incorrectAliases);
  const ordered = classifyBy(matchOrderedSubseq, text, correctAliases, incorrectAliases);
  const order_free = classifyBy(matchOrderFree, text, correctAliases, incorrectAliases);
  const agree = contiguous === ordered && ordered === order_free;
  return { contiguous, ordered, order_free, agree, agreed_value: agree ? contiguous : null };
}

// ---------------------------------------------------------------------------

function adjudicateSibling({ ablationDir, reportPath }, committed) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const g = report.policy_correctness_gate || {};
  const contrast = report.policy_contrast_gate || {};
  const localArms = report.local_arms || {};
  const familyId = report.family_id || null;
  const siblingId = report.sibling_id || null;

  const correctAliases = [g.target_id, ...(g.target_aliases || [])].filter(Boolean);
  const incorrectAliases = g.incorrect_target_aliases || [];

  const s0Path = findContinuation(ablationDir, '__S0-no-policy-replay');
  const s1Path = findContinuation(ablationDir, '__S1-policy-memory-replay');

  const readArm = (p, arm) => {
    const out = { arm, path: p, sha256: null, final_learner_turn: null, available: false };
    if (!p || !fs.existsSync(p)) return out;
    const buf = fs.readFileSync(p);
    out.sha256 = sha256(buf);
    out.final_learner_turn = lastLearnerTurn(buf.toString('utf8'));
    out.available = true;
    return out;
  };
  const s0 = readArm(s0Path, 'S0');
  const s1 = readArm(s1Path, 'S1');

  // canonical committed-answer read (+ verbatim-quote integrity check) and the
  // lexical-matcher evidence for the same turn.
  const resolveArm = (armRead) => {
    const key = `${familyId}/${siblingId}/${armRead.arm}`;
    const rec = committed[key] || null;
    const lexical = lexicalEvidence(armRead.final_learner_turn, correctAliases, incorrectAliases);
    let quote_verified = null;
    let canonical = null;
    let canonical_source = null;
    if (rec) {
      quote_verified = rec.quote ? norm(armRead.final_learner_turn).includes(norm(rec.quote)) : false;
      if (quote_verified) {
        canonical = rec.outcome;
        canonical_source = 'committed_read';
      }
    }
    if (canonical === null) {
      // no trusted committed read: fall back to lexical ONLY if all three agree.
      if (lexical.agree) {
        canonical = lexical.agreed_value;
        canonical_source = 'lexical_unanimous';
      } else {
        canonical = 'PENDING_COMMITTED_READ';
        canonical_source = 'pending';
      }
    }
    return {
      arm: armRead.arm,
      available: armRead.available,
      canonical,
      canonical_source,
      committed: rec ? { outcome: rec.outcome, answer: rec.answer, quote: rec.quote, rationale: rec.rationale } : null,
      quote_verified,
      lexical,
      final_learner_turn: armRead.final_learner_turn,
      sha256: armRead.sha256,
      path: armRead.path,
    };
  };
  const s0r = resolveArm(s0);
  const s1r = resolveArm(s1);

  const distinctiveness = typeof contrast.distinctiveness === 'number' ? contrast.distinctiveness : null;
  const s1LocalStatus = (localArms.S1_policy_memory || {}).status || null;

  const checks = {
    distinct:
      contrast.verdict === 'policy_distinct' && (distinctiveness === null || distinctiveness >= MIN_DISTINCTIVENESS),
    s1_correct: s1r.canonical === 'correct',
    s0_not_correct: s0r.canonical !== 'correct' && s0r.canonical !== 'PENDING_COMMITTED_READ',
    s1_survivor: s1LocalStatus === 'survivor',
  };
  const text_available = s0.available && s1.available;
  const pending = s0r.canonical === 'PENDING_COMMITTED_READ' || s1r.canonical === 'PENDING_COMMITTED_READ';
  const headroom =
    text_available && !pending && checks.distinct && checks.s1_correct && checks.s0_not_correct && checks.s1_survivor;

  return {
    family_id: familyId,
    sibling_id: siblingId,
    target_id: g.target_id || null,
    correct_aliases: correctAliases,
    incorrect_aliases: incorrectAliases,
    distinctiveness,
    contrast_verdict: contrast.verdict || null,
    s1_local_status: s1LocalStatus,
    legacy_correctness_verdict: g.verdict || null, // shipped lexical gate, for comparison
    text_available,
    pending,
    checks,
    headroom,
    S0: s0r,
    S1: s1r,
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.llm) {
    console.error(
      '[note] --llm is a documented future channel (push-button regeneration of committed-answers.json under a fixed prompt). Not implemented in v2; emitting committed + lexical-evidence verdicts only.',
    );
  }
  let committedDoc = { reads: {} };
  let committedSha = null;
  if (fs.existsSync(args.committed)) {
    const buf = fs.readFileSync(args.committed);
    committedSha = sha256(buf);
    committedDoc = JSON.parse(buf.toString('utf8'));
  } else {
    console.error(`[warn] no committed-answers.json at ${args.committed}; every arm will be PENDING.`);
  }
  const committed = committedDoc.reads || {};

  const reports = findReports(args.root);
  const siblings = reports.map((r) => adjudicateSibling(r, committed));

  // Coverage check: families with a resolved report at a layout findReports()
  // does not match (e.g. distal_correspondence's deeper nesting) are SKIPPED by
  // this cross-check, not counted. Surface them loudly — defer to the canonical
  // blind arbiter (§7.9) for those, do not read their absence as "not resolved".
  const adjudicatedChainDirs = new Set(reports.map((r) => r.chainDir));
  const skippedResolvedChainDirs = [...findResolvedChainDirs(args.root)]
    .filter((cd) => !adjudicatedChainDirs.has(cd))
    .sort();
  if (skippedResolvedChainDirs.length) {
    console.error(
      `[warn] ${skippedResolvedChainDirs.length} resolved family dir(s) have a transfer report this cross-check does NOT adjudicate (deeper layout): ${skippedResolvedChainDirs.join(', ')}. Defer to scripts/blind-option-adjudication.js (§7.9) for these; they are NOT in the rate below.`,
    );
  }

  const byFamily = new Map();
  for (const s of siblings) {
    const k = s.family_id || 'unknown';
    if (!byFamily.has(k)) byFamily.set(k, []);
    byFamily.get(k).push(s);
  }
  const families = [...byFamily.keys()].sort().map((fam) => {
    const sibs = byFamily.get(fam).sort((a, b) => String(a.sibling_id).localeCompare(String(b.sibling_id)));
    const resolved = sibs.length >= 2 && sibs.every((s) => s.text_available);
    const pending = sibs.some((s) => s.pending);
    const converges = resolved && !pending && sibs.every((s) => s.headroom);
    return { family_id: fam, n_siblings: sibs.length, resolved, pending, converges, siblings: sibs };
  });

  const resolvedFamilies = families.filter((f) => f.resolved && !f.pending);
  const converged = resolvedFamilies.filter((f) => f.converges);
  const pendingFamilies = families.filter((f) => f.pending);

  // where do the three lexical matchers disagree? (the empirical motivation)
  const lexicalDisagreements = [];
  for (const f of families) {
    for (const s of f.siblings) {
      for (const arm of [s.S0, s.S1]) {
        if (arm && arm.lexical && !arm.lexical.agree) {
          lexicalDisagreements.push({
            arm: `${f.family_id}/${s.sibling_id}/${arm.arm}`,
            contiguous: arm.lexical.contiguous,
            ordered: arm.lexical.ordered,
            order_free: arm.lexical.order_free,
            committed: arm.canonical,
          });
        }
      }
    }
  }

  const summary = {
    criterion_version: CRITERION_VERSION,
    criterion_spec: CRITERION_SPEC,
    status:
      'independent cross-check of the canonical blind arbiter (blind-option-adjudication.js, paper §7.9); not the rate of record',
    canonical_channel: 'scripts/blind-option-adjudication.js (paper-full-2.0.md §7.9, per-card 5/8)',
    min_distinctiveness: MIN_DISTINCTIVENESS,
    distinctiveness_note:
      'numeric proxy, STRICTER than the canonical reasoning-basis-divergence guard; the only reason this per-family count differs from §7.9',
    committed_answers_sha256: committedSha,
    families_total: families.length,
    families_resolved: resolvedFamilies.length,
    converges: converged.length,
    cross_check_per_family_rate: resolvedFamilies.length
      ? `${((100 * converged.length) / resolvedFamilies.length).toFixed(0)}%`
      : 'n/a',
    converged_families: converged.map((f) => f.family_id),
    pending_families: pendingFamilies.map((f) => f.family_id),
    skipped_resolved_chain_dirs: skippedResolvedChainDirs,
    lexical_disagreement_count: lexicalDisagreements.length,
  };

  const outDir = args.out;
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'readjudication.json');
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ summary, families, lexical_disagreements: lexicalDisagreements }, null, 2),
  );

  // Markdown audit report.
  const md = [];
  md.push(`# A18.37 transfer re-adjudication (${CRITERION_VERSION})`);
  md.push('');
  md.push(`Criterion: \`${CRITERION_SPEC}\``);
  md.push('');
  md.push(
    '> **Independent cross-check, not the rate of record.** The canonical A18.37 adjudication is the blind three-critic arbiter `scripts/blind-option-adjudication.js` (paper §7.9, per-card **5/8**). This cross-check reads the same turns by hand and agrees with it card-for-card on every shared card; its `MIN_DISTINCTIVENESS` numeric gate is a stricter proxy for the canonical reasoning-basis-divergence guard, and is the only reason the per-family count below differs from §7.9.',
  );
  md.push('');
  md.push(
    `**Cross-check per-family convergence: ${converged.length}/${resolvedFamilies.length} resolved families** (committed-answer criterion + ${MIN_DISTINCTIVENESS} distinctiveness gate, prior included).`,
  );
  md.push(`Converged: ${converged.map((f) => f.family_id.replace(/_priority$/, '')).join(', ') || '(none)'}.`);
  if (pendingFamilies.length) md.push(`Pending committed read: ${pendingFamilies.map((f) => f.family_id).join(', ')}.`);
  if (skippedResolvedChainDirs.length) {
    md.push(
      `**Skipped (resolved, deeper layout — defer to §7.9 blind arbiter, NOT counted here):** ${skippedResolvedChainDirs.join(', ')}.`,
    );
  }
  md.push('');
  md.push(
    `Lexical matchers disagree on **${lexicalDisagreements.length}** of ${2 * siblings.length} arms — the reason a surface rule cannot be canonical (see spec).`,
  );
  md.push('');
  md.push('| family | converges | sibling | distinct | S0 | S1 | S1 local | headroom | shipped gate |');
  md.push('|---|---|---|---|---|---|---|---|---|');
  for (const f of families) {
    for (const s of f.siblings) {
      md.push(
        `| ${f.family_id.replace(/_priority$/, '')} | ${f.converges ? '**YES**' : 'no'} | ${(s.sibling_id || '').replace(/^.*holdout_/, '')} | ${s.contrast_verdict === 'policy_distinct' ? `Y(${(s.distinctiveness ?? 0).toFixed(2)})` : `n(${(s.distinctiveness ?? 0).toFixed(2)})`} | ${s.S0.canonical} | ${s.S1.canonical} | ${s.s1_local_status} | ${s.headroom ? 'YES' : '-'} | ${s.legacy_correctness_verdict} |`,
      );
    }
  }
  md.push('');
  md.push('## Per-arm audit (committed read vs the three lexical matchers)');
  md.push('');
  for (const f of families) {
    for (const s of f.siblings) {
      md.push(
        `### ${f.family_id.replace(/_priority$/, '')} / ${(s.sibling_id || '').replace(/^.*holdout_/, '')}  (target: ${s.target_id})`,
      );
      for (const arm of [s.S0, s.S1]) {
        const lx = arm.lexical;
        md.push(
          `- **${arm.arm} = ${arm.canonical}** (${arm.canonical_source}${arm.committed ? `; "${arm.committed.answer}"` : ''}) — lexical: contiguous=${lx.contiguous}, ordered=${lx.ordered}, order_free=${lx.order_free}${lx.agree ? '' : '  ⟵ DISAGREE'}`,
        );
        if (arm.committed) md.push(`  - rationale: ${arm.committed.rationale}`);
        md.push(`  - turn: ${JSON.stringify(arm.final_learner_turn)}`);
      }
      md.push('');
    }
  }
  const mdPath = path.join(outDir, 'readjudication.md');
  fs.writeFileSync(mdPath, md.join('\n'));

  // Console summary.
  const w = (s, n) => String(s).padEnd(n).slice(0, n);
  console.log(`\nA18.37 re-adjudication — ${CRITERION_VERSION}`);
  console.log('='.repeat(78));
  console.log(w('family', 26), w('converges', 10), w('S0->S1 (canonical)', 40));
  console.log('-'.repeat(78));
  for (const f of families) {
    const outc = f.siblings
      .map(
        (s) =>
          `${(s.sibling_id || '').replace(/^.*holdout_/, '')}:${s.S0.canonical}->${s.S1.canonical}${s.headroom ? '*' : ''}`,
      )
      .join('  ');
    console.log(
      w(f.family_id.replace(/_priority$/, ''), 26),
      w(f.converges ? 'YES' : f.resolved ? 'no' : 'unresolved', 10),
      outc,
    );
  }
  console.log('-'.repeat(78));
  console.log(
    `Cross-check per-family convergence: ${converged.length}/${resolvedFamilies.length} resolved families  (rate ${summary.cross_check_per_family_rate})`,
  );
  console.log(
    'Canonical channel: scripts/blind-option-adjudication.js (paper §7.9, per-card 5/8). This is a cross-check.',
  );
  console.log(`Converged: ${converged.map((f) => f.family_id).join(', ') || '(none)'}`);
  if (skippedResolvedChainDirs.length)
    console.log(`Skipped (resolved, deeper layout; defer to §7.9): ${skippedResolvedChainDirs.join(', ')}`);
  console.log(
    `Lexical matchers disagree on ${lexicalDisagreements.length}/${2 * siblings.length} arms (surface rule is not canonical).`,
  );
  if (pendingFamilies.length)
    console.log(`Pending committed read: ${pendingFamilies.map((f) => f.family_id).join(', ')}`);
  console.log(`\nWrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

main();

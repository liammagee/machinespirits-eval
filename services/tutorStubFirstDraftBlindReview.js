import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const FIRST_DRAFT_BLIND_REVIEW_SCHEMA = 'machinespirits.tutor-stub.first-draft-blind-review.v1';
export const FIRST_DRAFT_BLIND_REVIEW_KEY_SCHEMA = 'machinespirits.tutor-stub.first-draft-blind-review-key.v1';
export const FIRST_DRAFT_BLIND_RATINGS_SCHEMA = 'machinespirits.tutor-stub.first-draft-blind-ratings.v1';

export const FIRST_DRAFT_REVIEW_DIMENSIONS = [
  'naturalness',
  'learner_responsiveness',
  'dramatic_effect',
  'clarity',
  'usefulness',
];

function text(value) {
  return String(value || '').trim();
}

function normalized(value) {
  return text(value).replace(/\s+/gu, ' ').toLowerCase();
}

function stableNumber(seed, value) {
  const digest = crypto.createHash('sha256').update(`${seed}|${value}`).digest();
  return digest.readUInt32BE(0) / 0x100000000;
}

function campaignVersion(tracePath) {
  return tracePath.match(/first-draft-generalization-v(\d+)-live/iu)?.[1]
    ? `V${tracePath.match(/first-draft-generalization-v(\d+)-live/iu)[1]}`
    : 'unknown';
}

function traceCell(tracePath) {
  return path.basename(path.dirname(tracePath));
}

function auditIssueIds(audits = {}) {
  const rows = [];
  for (const [auditName, audit] of Object.entries(audits || {})) {
    for (const issue of audit?.issues || []) {
      rows.push(`${auditName}:${text(issue?.type || issue?.reason || 'issue')}`);
    }
  }
  return [...new Set(rows)];
}

function publicSafeOriginal(original = {}) {
  const audits = original?.audits || {};
  if (!text(original?.candidate?.text)) return false;
  if (audits?.leakAudit?.ok !== true) return false;
  if ((audits?.leakAudit?.leaks || []).length > 0) return false;
  return true;
}

function contextBeforeTurn({ opening, turnRecords, turn }) {
  const prior = turnRecords
    .filter((row) => Number(row.turn) < Number(turn))
    .sort((left, right) => Number(left.turn) - Number(right.turn))
    .slice(-2)
    .flatMap((row) => [
      { speaker: 'Learner', text: text(row.learner) },
      { speaker: 'Tutor', text: text(row.tutor) },
    ])
    .filter((row) => row.text);
  if (!prior.length && opening) prior.push({ speaker: 'Tutor', text: opening });
  return prior;
}

export function extractTutorStubFirstDraftReviewRows({ events = [], tracePath = '' } = {}) {
  const opening = text(events.find((event) => event?.type === 'tutor_opening')?.text);
  const turnRecords = events
    .filter((event) => event?.type === 'turn_complete' && event?.turnRecord)
    .map((event) => ({
      turn: Number(event.turn),
      learner: text(event.turnRecord.learner),
      tutor: text(event.turnRecord.tutor),
    }));
  const learnerByTurn = new Map(
    events
      .filter((event) => event?.type === 'auto_learner_turn')
      .map((event) => [Number(event.turn), text(event.text)]),
  );
  const completedByTurn = new Map(turnRecords.map((row) => [Number(row.turn), row]));

  return events
    .filter((event) => event?.type === 'tutor_response_guard_accounting' && event?.accounting)
    .map((event) => {
      const accounting = event.accounting;
      const turn = Number(event.turn ?? accounting.turn);
      const original = accounting.originalCandidate || {};
      const delivered = accounting.finalDelivery || {};
      const originalText = text(original?.candidate?.text);
      const deliveredText = text(delivered?.candidate?.text || completedByTurn.get(turn)?.tutor);
      const originalAccepted =
        accounting.outcome === 'guarded_original_accepted' ||
        accounting.outcome === 'guarded_original_accepted_with_advisory' ||
        original.auditOk === true ||
        original?.audits?.deliveryOk === true;
      return {
        campaign: campaignVersion(tracePath),
        cell: traceCell(tracePath),
        tracePath,
        turn,
        context: contextBeforeTurn({ opening, turnRecords, turn }),
        learner: learnerByTurn.get(turn) || completedByTurn.get(turn)?.learner || '',
        originalText,
        deliveredText,
        originalAccepted,
        originalPublicSafe: publicSafeOriginal(original),
        finalSource: text(delivered.source || 'unknown'),
        outcome: text(accounting.outcome),
        originalAuditIssues: auditIssueIds(original.audits),
        originalRealizationRate: Number(original?.audits?.responseConfigurationAudit?.realization_rate ?? NaN),
      };
    })
    .filter((row) => row.originalText && row.learner);
}

export function readTutorStubTraceEvents(tracePath) {
  return fs
    .readFileSync(tracePath, 'utf8')
    .split(/\r?\n/gu)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${tracePath}:${index + 1}: ${error.message}`);
      }
    });
}

export function tutorStubFirstDraftReviewIssueFamily(issue = '') {
  const audit = text(issue).split(':')[0];
  if (audit === 'leakAudit') return 'evidence_safety';
  if (['dramaticReleaseAudit', 'repetitionAudit'].includes(audit)) return 'public_delivery_integrity';
  if (audit === 'responseCompositionAudit') return 'learner_response_structure';
  if (audit === 'questionSupportAudit') return 'pedagogical_support';
  if (audit === 'closureAudit') return 'dialogue_completion';
  if (audit === 'actorialRealizationAudit') return 'trajectory_realization';
  if (audit === 'scaffoldAudit') return 'human_scaffold';
  return 'other';
}

export function summarizeTutorStubFirstDraftReviewInventory(rows = []) {
  const counts = (values) =>
    Object.fromEntries(
      [...values.reduce((map, value) => map.set(value, Number(map.get(value) || 0) + 1), new Map()).entries()].sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      ),
    );
  const rejectedPublicSafe = rows.filter((row) => !row.originalAccepted && row.originalPublicSafe);
  const issueRows = rejectedPublicSafe.flatMap((row) => row.originalAuditIssues);
  const familySets = rejectedPublicSafe.map((row) => [
    ...new Set(row.originalAuditIssues.map(tutorStubFirstDraftReviewIssueFamily)),
  ]);
  return {
    schema: 'machinespirits.tutor-stub.first-draft-review-inventory.v1',
    generatedAt: new Date().toISOString(),
    tutorTurns: rows.length,
    originalAccepted: rows.filter((row) => row.originalAccepted).length,
    rejectedPublicSafe: rejectedPublicSafe.length,
    unsafeOriginalsExcludedFromReview: rows.filter((row) => !row.originalPublicSafe).length,
    campaigns: counts(rows.map((row) => row.campaign)),
    finalDeliverySources: counts(rows.map((row) => row.finalSource)),
    rejectedSafeFailureClusters: counts(issueRows),
    rejectedSafeIssueFamilies: counts(issueRows.map(tutorStubFirstDraftReviewIssueFamily)),
    rejectedSafeCandidateFamilies: counts(familySets.flat()),
    shadowBuckets: {
      trajectoryOnly: familySets.filter(
        (families) => families.length > 0 && families.every((family) => family === 'trajectory_realization'),
      ).length,
      noPublicIntegrityFailure: familySets.filter(
        (families) => !families.includes('public_delivery_integrity') && !families.includes('evidence_safety'),
      ).length,
      learnerResponseStructureInvolved: familySets.filter((families) => families.includes('learner_response_structure'))
        .length,
      publicDeliveryIntegrityInvolved: familySets.filter((families) => families.includes('public_delivery_integrity'))
        .length,
    },
  };
}

function ranked(rows, seed, label) {
  return [...rows].sort(
    (left, right) =>
      stableNumber(seed, `${label}|${left.tracePath}|${left.turn}`) -
      stableNumber(seed, `${label}|${right.tracePath}|${right.turn}`),
  );
}

function stratifiedSample(rows, count, seed, label) {
  const selected = [];
  const used = new Set();
  const byCampaign = new Map();
  for (const row of ranked(rows, seed, label)) {
    if (!byCampaign.has(row.campaign)) byCampaign.set(row.campaign, []);
    byCampaign.get(row.campaign).push(row);
  }
  for (const campaign of [...byCampaign.keys()].sort()) {
    if (selected.length >= count) break;
    const row = byCampaign.get(campaign)[0];
    selected.push(row);
    used.add(`${row.tracePath}|${row.turn}`);
  }
  for (const row of ranked(rows, seed, `${label}|remainder`)) {
    if (selected.length >= count) break;
    const id = `${row.tracePath}|${row.turn}`;
    if (used.has(id)) continue;
    selected.push(row);
    used.add(id);
  }
  return selected;
}

export function buildTutorStubFirstDraftBlindReview({
  rows = [],
  seed = 20260716,
  pairCount = 6,
  calibrationCount = 8,
} = {}) {
  const safeRows = rows.filter((row) => row.originalPublicSafe);
  const pairRows = safeRows.filter(
    (row) =>
      !row.originalAccepted && row.deliveredText && normalized(row.deliveredText) !== normalized(row.originalText),
  );
  const calibrationRows = safeRows.filter((row) => row.originalAccepted);
  if (pairRows.length < pairCount) throw new Error(`only ${pairRows.length} eligible pairs for requested ${pairCount}`);
  if (calibrationRows.length < calibrationCount) {
    throw new Error(`only ${calibrationRows.length} eligible accepted originals for requested ${calibrationCount}`);
  }

  const selectedPairs = stratifiedSample(pairRows, pairCount, seed, 'pair');
  const selectedCalibration = stratifiedSample(calibrationRows, calibrationCount, seed, 'calibration');
  const cases = [];
  const keyCases = [];

  selectedPairs.forEach((row, index) => {
    const caseId = `P${String(index + 1).padStart(2, '0')}`;
    const originalFirst = stableNumber(seed, `${caseId}|order`) < 0.5;
    const candidates = originalFirst
      ? [
          { label: 'A', text: row.originalText },
          { label: 'B', text: row.deliveredText },
        ]
      : [
          { label: 'A', text: row.deliveredText },
          { label: 'B', text: row.originalText },
        ];
    cases.push({ id: caseId, kind: 'pair', context: row.context, learner: row.learner, candidates });
    keyCases.push({
      id: caseId,
      campaign: row.campaign,
      cell: row.cell,
      tracePath: row.tracePath,
      turn: row.turn,
      finalSource: row.finalSource,
      originalAuditIssues: row.originalAuditIssues,
      originalRealizationRate: Number.isFinite(row.originalRealizationRate) ? row.originalRealizationRate : null,
      candidates: candidates.map((candidate) => ({
        label: candidate.label,
        sourceClass:
          normalized(candidate.text) === normalized(row.originalText) ? 'rejected_original' : 'delivered_repair',
      })),
    });
  });

  selectedCalibration.forEach((row, index) => {
    const caseId = `C${String(index + 1).padStart(2, '0')}`;
    cases.push({
      id: caseId,
      kind: 'calibration',
      context: row.context,
      learner: row.learner,
      candidates: [{ label: 'A', text: row.originalText }],
    });
    keyCases.push({
      id: caseId,
      campaign: row.campaign,
      cell: row.cell,
      tracePath: row.tracePath,
      turn: row.turn,
      finalSource: row.finalSource,
      originalAuditIssues: [],
      originalRealizationRate: Number.isFinite(row.originalRealizationRate) ? row.originalRealizationRate : null,
      candidates: [{ label: 'A', sourceClass: 'accepted_original' }],
    });
  });

  return {
    blind: {
      schema: FIRST_DRAFT_BLIND_REVIEW_SCHEMA,
      generatedAt: new Date().toISOString(),
      seed,
      dimensions: FIRST_DRAFT_REVIEW_DIMENSIONS,
      candidateCount: cases.reduce((sum, entry) => sum + entry.candidates.length, 0),
      cases,
      instructions:
        'Rate only the visible reply for naturalness, learner responsiveness, dramatic effect, clarity, and usefulness. Audit verdicts, source class, campaign, and repair status are deliberately hidden.',
    },
    key: {
      schema: FIRST_DRAFT_BLIND_REVIEW_KEY_SCHEMA,
      generatedAt: new Date().toISOString(),
      seed,
      cases: keyCases,
    },
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function tutorStubFirstDraftBlindReviewHtml(blind) {
  const cards = blind.cases
    .map(
      (entry) => `<section class="case" data-case="${escapeHtml(entry.id)}">
        <h2>${escapeHtml(entry.id)}</h2>
        <div class="context">${entry.context.map((row) => `<p><b>${escapeHtml(row.speaker)}:</b> ${escapeHtml(row.text)}</p>`).join('')}</div>
        <p class="learner"><b>Learner:</b> ${escapeHtml(entry.learner)}</p>
        <div class="candidates">${entry.candidates
          .map(
            (candidate) => `<article data-candidate="${escapeHtml(candidate.label)}">
              <h3>Reply ${escapeHtml(candidate.label)}</h3><p class="reply">${escapeHtml(candidate.text)}</p>
              <div class="ratings">${blind.dimensions
                .map(
                  (dimension) =>
                    `<label>${escapeHtml(dimension.replaceAll('_', ' '))}<select data-dimension="${escapeHtml(dimension)}"><option value=""></option>${[1, 2, 3, 4, 5].map((value) => `<option>${value}</option>`).join('')}</select></label>`,
                )
                .join('')}</div>
            </article>`,
          )
          .join('')}</div>
        ${entry.kind === 'pair' ? '<label class="preference">Preferred reply <select data-preference><option value=""></option><option>A</option><option>B</option><option>tie</option></select></label>' : ''}
      </section>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Blind first-draft review</title><style>
  :root{color-scheme:light;font-family:ui-sans-serif,system-ui,sans-serif;background:#f3efe6;color:#1e2420}body{max-width:1180px;margin:0 auto;padding:32px}h1{font-family:Georgia,serif;font-size:42px}.lede{max-width:800px;color:#4c554e}.case{background:#fffaf0;border:1px solid #c7bdac;border-radius:14px;padding:22px;margin:24px 0}.context{color:#64675f;border-left:4px solid #8f9d86;padding-left:14px}.learner{font-size:18px}.candidates{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:18px}article{background:white;border:1px solid #d7cebf;border-radius:10px;padding:18px}.reply{font-family:Georgia,serif;font-size:18px;line-height:1.55}.ratings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}label{display:flex;justify-content:space-between;gap:10px;text-transform:capitalize}.preference{margin-top:16px;justify-content:flex-start}button{background:#244d3f;color:white;border:0;border-radius:8px;padding:12px 18px;font-weight:700;cursor:pointer}</style></head><body>
  <h1>Blind first-draft review</h1><p class="lede">${escapeHtml(blind.instructions)} Scale: 1 poor, 3 adequate, 5 excellent.</p>
  <button id="export">Export ratings JSON</button>${cards}<script>
  const schema=${JSON.stringify(FIRST_DRAFT_BLIND_RATINGS_SCHEMA)};
  document.querySelector('#export').addEventListener('click',()=>{const cases=[...document.querySelectorAll('.case')].map(section=>({id:section.dataset.case,candidates:[...section.querySelectorAll('[data-candidate]')].map(card=>({label:card.dataset.candidate,scores:Object.fromEntries([...card.querySelectorAll('[data-dimension]')].map(input=>[input.dataset.dimension,Number(input.value)||null]))})),preference:section.querySelector('[data-preference]')?.value||null}));const blob=new Blob([JSON.stringify({schema,generatedAt:new Date().toISOString(),cases},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ratings.json';a.click();URL.revokeObjectURL(a.href)});
  </script></body></html>`;
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

export function compileTutorStubFirstDraftBlindReview({ blind, key, ratings } = {}) {
  if (blind?.schema !== FIRST_DRAFT_BLIND_REVIEW_SCHEMA) throw new Error('invalid blind review corpus');
  if (key?.schema !== FIRST_DRAFT_BLIND_REVIEW_KEY_SCHEMA) throw new Error('invalid blind review key');
  if (ratings?.schema !== FIRST_DRAFT_BLIND_RATINGS_SCHEMA) throw new Error('invalid blind ratings');
  const keyByCase = new Map(key.cases.map((entry) => [entry.id, entry]));
  const ratingsByCase = new Map(ratings.cases.map((entry) => [entry.id, entry]));
  const candidateRows = [];
  const pairRows = [];

  for (const blindCase of blind.cases) {
    const keyCase = keyByCase.get(blindCase.id);
    const ratingCase = ratingsByCase.get(blindCase.id);
    if (!keyCase || !ratingCase) throw new Error(`missing key or rating for ${blindCase.id}`);
    const byLabel = new Map(ratingCase.candidates.map((entry) => [entry.label, entry]));
    const caseCandidates = [];
    for (const candidate of blindCase.candidates) {
      const keyCandidate = keyCase.candidates.find((entry) => entry.label === candidate.label);
      const ratingCandidate = byLabel.get(candidate.label);
      if (!keyCandidate || !ratingCandidate)
        throw new Error(`missing candidate rating ${blindCase.id}/${candidate.label}`);
      const scores = Object.fromEntries(
        FIRST_DRAFT_REVIEW_DIMENSIONS.map((dimension) => {
          const score = Number(ratingCandidate.scores?.[dimension]);
          if (!Number.isFinite(score) || score < 1 || score > 5) {
            throw new Error(`invalid ${dimension} score for ${blindCase.id}/${candidate.label}`);
          }
          return [dimension, score];
        }),
      );
      const row = {
        caseId: blindCase.id,
        label: candidate.label,
        sourceClass: keyCandidate.sourceClass,
        campaign: keyCase.campaign,
        cell: keyCase.cell,
        turn: keyCase.turn,
        finalSource: keyCase.finalSource,
        scores,
        overall: mean(Object.values(scores)),
      };
      candidateRows.push(row);
      caseCandidates.push(row);
    }
    if (blindCase.kind === 'pair') {
      const original = caseCandidates.find((row) => row.sourceClass === 'rejected_original');
      const delivered = caseCandidates.find((row) => row.sourceClass === 'delivered_repair');
      const preferenceClass =
        ratingCase.preference === 'tie'
          ? 'tie'
          : caseCandidates.find((row) => row.label === ratingCase.preference)?.sourceClass || null;
      pairRows.push({
        caseId: blindCase.id,
        campaign: keyCase.campaign,
        finalSource: keyCase.finalSource,
        originalOverall: original.overall,
        deliveredOverall: delivered.overall,
        deliveredMinusOriginal: delivered.overall - original.overall,
        preference: preferenceClass,
        originalAuditIssues: keyCase.originalAuditIssues,
      });
    }
  }

  const sourceClasses = [...new Set(candidateRows.map((row) => row.sourceClass))];
  const bySourceClass = Object.fromEntries(
    sourceClasses.map((sourceClass) => {
      const rows = candidateRows.filter((row) => row.sourceClass === sourceClass);
      return [
        sourceClass,
        {
          n: rows.length,
          overall: mean(rows.map((row) => row.overall)),
          dimensions: Object.fromEntries(
            FIRST_DRAFT_REVIEW_DIMENSIONS.map((dimension) => [
              dimension,
              mean(rows.map((row) => row.scores[dimension])),
            ]),
          ),
        },
      ];
    }),
  );
  const preferenceCounts = pairRows.reduce((counts, row) => {
    counts[row.preference || 'missing'] = Number(counts[row.preference || 'missing'] || 0) + 1;
    return counts;
  }, {});
  return {
    schema: 'machinespirits.tutor-stub.first-draft-blind-review-report.v1',
    generatedAt: new Date().toISOString(),
    candidateCount: candidateRows.length,
    pairCount: pairRows.length,
    bySourceClass,
    pairedComparison: {
      meanDeliveredMinusOriginal: mean(pairRows.map((row) => row.deliveredMinusOriginal)),
      deliveredBetterCount: pairRows.filter((row) => row.deliveredMinusOriginal > 0).length,
      originalBetterCount: pairRows.filter((row) => row.deliveredMinusOriginal < 0).length,
      equalScoreCount: pairRows.filter((row) => row.deliveredMinusOriginal === 0).length,
      preferenceCounts,
      pairs: pairRows,
    },
    candidates: candidateRows,
  };
}

export function tutorStubFirstDraftBlindReviewMarkdown(report) {
  const fmt = (value) => (Number.isFinite(value) ? value.toFixed(2) : 'n/a');
  const classes = ['accepted_original', 'rejected_original', 'delivered_repair'];
  return (
    `# Blind first-draft transcript review\n\n` +
    `Candidates: ${report.candidateCount}; paired rejected-original vs delivered-repair cases: ${report.pairCount}.\n\n` +
    `| Source revealed after rating | n | Overall | Naturalness | Learner response | Dramatic effect | Clarity | Usefulness |\n` +
    `| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n` +
    classes
      .map((sourceClass) => {
        const row = report.bySourceClass[sourceClass] || {};
        return `| ${sourceClass.replaceAll('_', ' ')} | ${row.n || 0} | ${fmt(row.overall)} | ${fmt(row.dimensions?.naturalness)} | ${fmt(row.dimensions?.learner_responsiveness)} | ${fmt(row.dimensions?.dramatic_effect)} | ${fmt(row.dimensions?.clarity)} | ${fmt(row.dimensions?.usefulness)} |`;
      })
      .join('\n') +
    `\n\n## Paired comparison\n\n` +
    `Mean delivered-minus-original score: ${fmt(report.pairedComparison.meanDeliveredMinusOriginal)}. ` +
    `Delivered repair scored higher in ${report.pairedComparison.deliveredBetterCount}/${report.pairCount}; ` +
    `rejected original scored higher in ${report.pairedComparison.originalBetterCount}/${report.pairCount}; ` +
    `equal scores in ${report.pairedComparison.equalScoreCount}/${report.pairCount}.\n\n` +
    `Blind preferences: ${Object.entries(report.pairedComparison.preferenceCounts)
      .map(([key, value]) => `${key.replaceAll('_', ' ')} ${value}`)
      .join('; ')}.\n`
  );
}

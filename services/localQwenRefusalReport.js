import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildFactorialInterchange, qualitySummary } from './localQwenFactorialReport.js';
import { renderDramaticDialogueFragment, renderDramaticDialogueStyles } from './dramaticDialogueRenderer.js';

const asset = (name) =>
  fs.readFileSync(fileURLToPath(new URL(`../notes/poetics/assets/${name}`, import.meta.url)), 'utf8');
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/gu,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const num = (value, digits = 1) =>
  Number.isFinite(value) ? Number(value.toPrecision(12)).toFixed(digits) : 'Unavailable';
const label = (arm) => (arm.variant === 'normal' ? 'Normal Qwen' : 'Abliterated Qwen');

export function renderRefusalReport({
  arms,
  evaluation,
  mock = false,
  provenance = {},
  characterBrief = '',
  observations = [],
}) {
  const scores = evaluation.scores || [];
  const accepted = scores.filter((score) => !score.partial).length;
  const complete = accepted === 8;
  const totalCeiling = provenance.totalAttemptCeiling ?? 40;
  const budgetDescription = Number.isSafeInteger(provenance.continuationCallCeiling)
    ? `Latest continuation: ${provenance.continuationCallsCompleted} of ${provenance.continuationCallCeiling} additionally authorized Opus calls; ${provenance.continuationHelperCallsObserved} background helper calls observed in this continuation. The historical ledger records ${provenance.recordedStudyInvocations} intended study invocations, with at least ${provenance.knownModelCallLowerBound} model calls once known helper traffic is included. Earlier helper traffic is unobservable, so the cumulative total is not verified. The old 41-call ceiling is not claimed as met: the user separately authorized the remaining four assessments. Both dialogues and all four accepted normal-Qwen assessments were reused unchanged. Earlier failed and partial outputs remain archived, not pooled with replacements.`
    : `Maximum ${totalCeiling} attempts: 16 local Qwen, 16 Sol and ${totalCeiling - 32} Opus. ${totalCeiling === 41 ? 'The original 40-attempt ceiling was explicitly increased to 41 for five further assessments: one complete replacement for the incomplete normal-quality reply and four previously unattempted abliterated assessments. The three valid assessments and both dialogues were reused unchanged. The original partial assessment remains archived separately, not combined with its replacement.' : 'No resampling.'}`;
  const score = (arm, kind) => scores.find((row) => row.arm === arm.id && row.kind === kind);
  const summaries = new Map(
    arms.map((arm) => [arm.id, score(arm, 'quality') ? qualitySummary(score(arm, 'quality').raw) : null]),
  );
  const table = (caption, rows) =>
    `<div class="table-wrap"><table><caption>${esc(caption)}</caption><thead><tr><th>Measure</th>${arms.map((arm) => `<th>${label(arm)}</th>`).join('')}</tr></thead><tbody>${rows.map(([name, value]) => `<tr><th scope="row">${esc(name)}</th>${arms.map((arm) => `<td>${esc(value(arm))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const qualityTable = table(
    scores.some((row) => row.partial)
      ? 'Partial Opus ratings · normal only; abliterated not assessed'
      : 'Independent Opus ratings and annotations',
    [
      ...['overall_quality', 'successful_pedagogy', 'surprise_nonrepetition', 'character_adherence'].map((key) => [
        key.replaceAll('_', ' ') + ' /5',
        (arm) => score(arm, 'quality')?.raw.scores[key].score ?? 'Unavailable',
      ]),
      [
        'Substantively developing, non-repeated moves · turns 2–8 /7',
        (arm) => summaries.get(arm.id)?.freshGroundedTurns ?? 'Unavailable',
      ],
      ['Semantic repetition /8', (arm) => summaries.get(arm.id)?.semanticRepeats ?? 'Unavailable'],
      ['Reopened accepted objections /8', (arm) => summaries.get(arm.id)?.reopenedObjections ?? 'Unavailable'],
      ['Unsupported learner assertions /8', (arm) => summaries.get(arm.id)?.unsupportedLearner ?? 'Unavailable'],
      ['Unsupported tutor assertions /8', (arm) => summaries.get(arm.id)?.unsupportedTutor ?? 'Unavailable'],
    ],
  );
  const rubricTable = table(
    'Unchanged v2.2 instruments · weighted scores /100',
    ['tutor', 'learner', 'dialogue'].map((kind) => [kind, (arm) => num(score(arm, kind)?.scored.overall)]),
  );
  const speedTable = table('Speed and auxiliary lexical diagnostics', [
    ['Median learner response · seconds', (arm) => num(arm.technical.learnerMechanism.medianLatencyMs / 1000)],
    [
      'Mean learner output tokens/second · end-to-end',
      (arm) => num(arm.technical.learnerFinal.meanEndToEndOutputTokensPerSecond, 2),
    ],
    ['Tutor total · seconds', (arm) => num(arm.technical.tutor.totalLatencyMs / 1000)],
    ['Dialogue wall time including service start/stop · seconds', (arm) => num(arm.wallTimeMs / 1000)],
    ['Lexical surprise after opening', (arm) => num(arm.repetition.meanLexicalSurpriseAfterOpening, 3)],
    ['Distinct bigrams', (arm) => num(arm.repetition.distinct2, 3)],
    ['Tutor turns with native guard findings', (arm) => arm.technical.guardedTutorTurns],
    ['Prompt compaction/recovery events', (arm) => arm.technical.promptAuditRecoveries],
  ]);
  const interchange = buildFactorialInterchange(arms, scores, {
    groups: [
      {
        id: 'qwen-hostile-refusal',
        label: 'Aggressive refusal: normal versus abliterated Qwen',
        arms,
        baseline: arms[0].id,
      },
    ],
  });
  const sections = [
    [
      'setup',
      'The learner refuses the lesson itself',
      `<p>Alex is an adult tenant in a contemporary shared flat with a ceiling leak. The tutor wants a careful causal inquiry. Alex resents being made an unpaid investigator and rejects that assignment through pointed mockery, sarcasm and a competing practical agenda.</p><p>Two fresh eight-turn conversations. Sol medium is tutor in both; no learner or tutor superego, no learner revision or semantic repair. Same temperature 0.6, 900-token ceiling, thinking and MTP off, service seed 17. Normal runs first, abliterated second.</p><details><summary>Exact assigned behavior, character and tone</summary><pre>${esc(characterBrief)}</pre></details>`,
    ],
    [
      'quality',
      'Convincing refusal is not the same as successful teaching',
      `${qualityTable}${scores.some((row) => row.partial) ? '<p class="notice">Normal-Qwen quality ratings and available annotations are PARTIAL: intact fields from a malformed reply, not a completed assessment. Seven reopening judgments were omitted, so the combined development count and reopening count are unavailable. Abliterated Qwen has not been judged. Do not read this as a paired Opus comparison.</p>' : ''}<p>A developing move changes the disputed boundary, interaction or practical agenda without repetition, reopening an accepted objection or inventing evidence. It need not help solve the leak. A continuing unresolved refusal is not automatically repetition; a new insult is not automatically development. This measure is contextual and must not be pooled with the earlier counterexample-hunter study.</p><p>One conversation per checkpoint permits comparison of these performances, not a general ranking or a causal estimate of abliteration.</p>${observations.length ? `<h3>Direct reading · separate from Opus judgments</h3><ul>${observations.map((row) => `<li>${esc(row)}</li>`).join('')}</ul>` : ''}`,
    ],
    [
      'rubrics',
      'Keep the instruments and their disagreements visible',
      `${rubricTable}<p>The existing tutor, learner and dialogue rubrics are unchanged. Faithful refusal may score poorly on demonstrated learning; character fidelity is reported separately. No aggregate blends these meanings together.</p>${arms
        .map(
          (arm) =>
            `<details><summary>${label(arm)} · dialogue and quality reasoning</summary><pre>${esc(
              JSON.stringify(
                scores
                  .filter((row) => row.arm === arm.id && ['dialogue', 'quality'].includes(row.kind))
                  .map((row) => ({ kind: row.kind, assessment: row.raw })),
                null,
                2,
              ),
            )}</pre></details>`,
        )
        .join('')}`,
    ],
    [
      'speed',
      'Latency counts the whole public turn',
      `${speedTable}<p>Direct learners have exactly one Qwen pass. Token rates include request latency, not just decoding. Model loading remains in wall time. Lexical difference is not semantic difference.</p>`,
    ],
    [
      'transcripts',
      'Exact public swimlanes',
      `<p>The opening is context; all eight generated turns per speaker were planned for scoring. Available assessments appear below; missing assessments are labelled, not filled in. The existing world releases its final clue on tutor turn 7, allowing one subsequent learner response. Expand either speaker's assessment to inspect its available rubric reasoning and public-evidence annotation.</p>${interchange.map(renderDramaticDialogueFragment).join('')}`,
    ],
    [
      'scope',
      'Private engineering evidence',
      `<p>${esc(budgetDescription)} No fallback judge, publication, production database ingestion or paper claim. The judge sees public dialogue and the character brief, not checkpoint identity or hidden world state. Source provenance is recorded, not an authorization gate.</p><p>Accepted assessments: ${accepted}/8. ${complete ? 'All planned assessments are available.' : esc(evaluation.stopReason || 'Scoring is incomplete; unavailable is not zero.')}</p>${evaluation.rejected?.map((row) => `<details><summary>Original reply flagged by validation · ${esc(row.arm)} ${esc(row.kind)}</summary><p>${esc(row.error)}</p><pre>${esc(row.text)}</pre></details>`).join('') || ''}<pre>${esc(JSON.stringify(provenance, null, 2))}</pre>`,
    ],
  ];
  const nav = ['Setup', 'Quality', 'Rubrics', 'Speed', 'Transcripts', 'Scope'];
  const html = `<!doctype html><html lang="en" data-skin="machine-spirits"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Qwen — aggressive refusal in Rowan Flat</title><style>${asset('techne.css')}</style><style>${renderDramaticDialogueStyles()}
.dd__turn-badge{background:var(--ink);color:var(--paper)}
.shell{max-width:1500px}.refusal .body{grid-column:2/-1;min-width:0}.table-wrap{overflow-x:auto;margin:1.5rem 0}table{width:100%;border-collapse:collapse;font-size:.9rem}caption{text-align:left;font-weight:700;padding:.6rem 0}th,td{border-bottom:1px solid var(--rule);padding:.65rem;text-align:left;vertical-align:top}td{font-variant-numeric:tabular-nums}details{margin:1rem 0}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.8rem;line-height:1.5}.notice{border-left:4px solid var(--brick);padding:1rem;background:var(--paper-deep)}li{margin-bottom:.8rem}@media(max-width:760px){.refusal .body{grid-column:1/-1}.refusal .ml{display:none}.hero__rune{position:static;margin:0 1rem 1.25rem}th,td{padding:.45rem}}
</style></head><body><header class="rail" id="rail"><div class="rail__inner"><span class="rail__title">Qwen · refusal</span><nav class="rail__nav" aria-label="Section navigation">${sections.map(([id], i) => `<a href="#${id}">${nav[i]}</a>`).join('')}</nav><div class="rail__actions"><button class="rail__btn" id="themeToggle" type="button">Dark</button></div></div><div class="rail__progress" id="railProgress"></div></header><main><section class="hero"><div class="hero__rune">Machine Spirits · local engineering experiment</div><h1 class="hero__h1">What if the learner <span class="em">refuses?</span></h1><p class="hero__subtitle">Normal and abliterated Qwen · Sol tutor · no superego</p><p class="notice">${mock ? 'SYNTHETIC PREVIEW ONLY — no real model results.' : complete ? 'Exploratory comparison · one dialogue per checkpoint · acting and learning scored separately.' : 'ASSESSMENT INCOMPLETE — preserved available evidence; missing scores are not zeros.'}</p></section><div class="shell">${sections.map(([id, title, body], i) => `<section class="s refusal" id="${id}"><div class="diag"><div class="ml"><h2 class="s__num">0${i + 1}<span class="glyph">·</span></h2></div><div class="body"><h2 class="s__h">${title}</h2>${body}</div></div></section>`).join('')}</div><footer class="colophon"><p>Local only · Techne + shared dialogue renderer · no remote assets</p></footer></main><script>${asset('techne.js').replace(/<\/script/giu, '<\\/script')}</script></body></html>`;
  return { html, interchange };
}

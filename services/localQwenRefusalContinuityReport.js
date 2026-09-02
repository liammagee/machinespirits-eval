import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildFactorialInterchange, qualitySummary } from './localQwenFactorialReport.js';
import { renderDramaticDialogueFragment, renderDramaticDialogueStyles } from './dramaticDialogueRenderer.js';

const asset = (name) =>
  fs.readFileSync(fileURLToPath(new URL(`../notes/poetics/assets/${name}`, import.meta.url)), 'utf8');
const esc = (text) =>
  String(text ?? '').replace(
    /[&<>"']/gu,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const num = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : 'Unavailable');
const label = (arm) =>
  ({ normal: 'Normal Qwen', abliterated: 'Abliterated Qwen', luna: 'Luna learner' })[arm.variant] ||
  arm.label ||
  arm.id;
export function renderContinuityReport({
  arms,
  evaluation,
  provenance,
  characterBrief,
  baseline = null,
  observations = [],
  measurementCaveats = [],
  corrections = [],
  failures = [],
  assessmentFailures = [],
  proofControl = false,
  comparisonLabel = 'Compared with the original eight-exchange baseline',
  reportMeta = {},
  mock = false,
}) {
  const meta = {
    pageTitle: 'Qwen refusal · continuity re-test',
    railTitle: 'Qwen · continuity',
    headline: 'Refusal that can move on.',
    subtitle: 'Normal and abliterated Qwen · Sol tutor · no superego',
    interchangeLabel: 'Goal-directed hostile refusal · normal versus abliterated',
    setupTitle: 'Can the refusal move on?',
    setupDescription:
      'Alex wants the ceiling leak handled without being drafted into unpaid investigation. The character has a practical goal, separate private continuity notes, and the right to end the encounter.',
    qualityDescription:
      'Semantic repetition means the same conversational move, not merely similar words or continued resistance. A useful new move can be a counteroffer, a concession, a boundary clarification or a credible exit. Counts are descriptive; shorter conversations offer fewer chances to repeat.',
    comparisonDescription:
      'The old outputs and judgments were reused unchanged, not rescored. Early endings do not establish sustained eight-turn acting.',
    rubricDescription:
      'Low learner-learning scores can coexist with faithful adversarial acting. No combined score conflates character performance with learning or obedience.',
    transcriptDescription:
      'Expand either speaker’s assessment to see available ratings and reasons, or the explicit missing-assessment label. The fixed opening is not scored. An absent later message means the arm ended or stopped at the failure documented above.',
    proofDescription:
      'The private harness uses the existing proof engine. Neither speaker sees its hidden answer or proof tree. Required source delivery is checked mechanically; private continuity notes and available clues do not establish that the learner understood anything. An early exit remains unresolved when its evidence is insufficient.',
    scopeDescription:
      'One conversation per checkpoint is not a general model ranking or evidence of human learning. Speaker end signals are self-reported interaction choices, not an independent success criterion.',
    learnerFamilyLabel: 'Qwen',
    attemptScopeLabel: 'total attempts used, including carried-forward calls',
    opusAttemptScopeLabel: 'Opus attempts used',
    setupMechanismDescription:
      'One new dialogue per checkpoint; no superego, revision or extra continuity-model call. Normal first, abliterated second. Same world opening and evidence availability; due evidence is required and committed only after delivery. Maximum eight paired exchanges, not a minimum.',
    comparisonMechanismDescription:
      'The learner brief and sampling are matched across the two new arms; both use the same tutor proof control.',
    speedDescription:
      'Qwen generates a short private note and public speech in one pass. These response times include both. Session wall time includes service start/stop but excludes imported calls and their earlier sessions. Cold/warm conditions, conversation lengths and response lengths were not matched. Do not infer a checkpoint throughput advantage. Lexical difference is auxiliary, not semantic evidence.',
    ...reportMeta,
  };
  const expectedAssessments = arms.length * 4;
  const plannedAssessmentPackets = evaluation.plannedNewAssessmentPackets ?? expectedAssessments;
  const opusAttemptSummary = Number.isFinite(evaluation.newPhysicalAttempts)
    ? `${evaluation.newPhysicalAttempts} physical Opus attempts for ${plannedAssessmentPackets} planned packets`
    : `${evaluation.attemptsUsed ?? '?'} of ${plannedAssessmentPackets} ${meta.opusAttemptScopeLabel}`;
  const complete = evaluation.scores.length === expectedAssessments && failures.length === 0;
  const generationStopped =
    failures.length > 0 || arms.some((arm) => ['generation_failure', 'not_started'].includes(arm.snapshot.disposition));
  const score = (arm, kind) => evaluation.scores.find((s) => s.arm === arm.id && s.kind === kind);
  const summary = (arm) => (score(arm, 'quality') ? qualitySummary(score(arm, 'quality').raw) : null);
  const table = (caption, rows) =>
    `<div class="table-wrap"><table><caption>${esc(caption)}</caption><thead><tr><th>Measure</th>${arms.map((a) => `<th>${label(a)}</th>`).join('')}</tr></thead><tbody>${rows.map(([key, getter]) => `<tr><th>${esc(key)}</th>${arms.map((a) => `<td>${esc(getter(a))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const qualityKeys = ['overall_quality', 'successful_pedagogy', 'surprise_nonrepetition', 'character_adherence'];
  const quality = table('Independent Opus judgments · actual denominators', [
    ['Completed exchanges / maximum', (a) => `${a.snapshot.turns.length} / ${a.snapshot.maxExchanges}`],
    [
      'Ending',
      (a) =>
        ({
          learner_exit: 'Learner ended the conversation',
          tutor_closure: 'Tutor ended the conversation',
          generation_failure: 'Stopped: invalid learner output',
          not_started: 'Not run: stopped before this arm',
          exchange_cap: 'Eight-exchange limit',
        })[a.snapshot.disposition] || a.snapshot.disposition,
    ],
    ...qualityKeys.map((key) => [
      key.replaceAll('_', ' ') + ' /5',
      (a) => score(a, 'quality')?.raw.scores[key].score ?? 'Unavailable',
    ]),
    [
      'Developing, nonrepeated moves after opening',
      (a) =>
        summary(a) ? `${summary(a).freshGroundedTurns} / ${Math.max(0, a.snapshot.turns.length - 1)}` : 'Not assessed',
    ],
    [
      'Semantic repeats',
      (a) => (summary(a) ? `${summary(a).semanticRepeats} / ${a.snapshot.turns.length}` : 'Not assessed'),
    ],
    ['Reopened accepted objections', (a) => summary(a)?.reopenedObjections ?? 'Unavailable'],
    ['Unsupported learner assertions', (a) => summary(a)?.unsupportedLearner ?? 'Unavailable'],
    ['Unsupported tutor assertions', (a) => summary(a)?.unsupportedTutor ?? 'Unavailable'],
    [
      'Exact repeated learner replies',
      (a) =>
        a.snapshot.turns.length
          ? a.snapshot.turns.length - new Set(a.snapshot.turns.map((t) => t.learner)).size
          : 'No delivered learner turns',
    ],
  ]);
  const rubrics = table(
    'Unchanged v2.2 instruments · /100',
    ['tutor', 'learner', 'dialogue'].map((kind) => [kind, (a) => num(score(a, kind)?.scored.overall)]),
  );
  const previous = baseline
    ? table('Before → after · descriptive, not a controlled effect', [
        ...qualityKeys.map((key) => [
          key.replaceAll('_', ' ') + ' /5',
          (a) =>
            `${baseline.evaluation.scores.find((s) => s.arm === a.id && s.kind === 'quality')?.raw.scores[key].score ?? 'Not assessed'} → ${score(a, 'quality')?.raw.scores[key].score ?? 'Not assessed'}`,
        ]),
        [
          'Dialogue length',
          (a) =>
            `${baseline.arms.find((old) => old.id === a.id)?.snapshot?.turns?.length ?? baseline.arms.find((old) => old.id === a.id)?.technical?.learnerFinal?.calls ?? 8} → ${a.snapshot.turns.length}`,
        ],
        [
          'Semantic repeats',
          (a) => {
            const old = baseline.evaluation.scores.find((s) => s.arm === a.id && s.kind === 'quality');
            return `${old ? `${qualitySummary(old.raw).semanticRepeats}/${old.raw.learner_turns.length}` : 'Not assessed'} → ${summary(a) ? `${summary(a).semanticRepeats}/${a.snapshot.turns.length}` : 'Not assessed'}`;
          },
        ],
      ])
    : '<p>Historical comparison has not been attached to this rendering.</p>';
  const speed = table('Response speed includes private note generation', [
    [
      `Median accepted ${meta.learnerFamilyLabel} response · seconds`,
      (a) =>
        a.technical.learnerMechanism.calls
          ? num(a.technical.learnerMechanism.medianLatencyMs / 1000)
          : 'No accepted response',
    ],
    [
      `${meta.learnerFamilyLabel} output tokens/second · end-to-end`,
      (a) => num(a.technical.learnerFinal.meanEndToEndOutputTokensPerSecond, 2),
    ],
    [
      `Total accepted ${meta.learnerFamilyLabel} time · seconds`,
      (a) =>
        a.technical.learnerMechanism.calls
          ? num(a.technical.learnerMechanism.totalLatencyMs / 1000)
          : 'No accepted response',
    ],
    [
      'Total Sol time · seconds',
      (a) => (a.technical.tutor.calls ? num(a.technical.tutor.totalLatencyMs / 1000) : 'Not called'),
    ],
    [
      'Recorded session wall time · seconds',
      (a) => `${num(a.wallTimeMs / 1000)}${provenance.priorAttempts && a.id === 'A' ? ' · continuation only' : ''}`,
    ],
    [
      'Auxiliary lexical surprise',
      (a) =>
        a.snapshot.turns.length > 1
          ? num(a.repetition.meanLexicalSurpriseAfterOpening, 3)
          : 'Not measurable: fewer than two replies',
    ],
  ]);
  const interchange = buildFactorialInterchange(arms, evaluation.scores, {
    groups: [
      {
        id: 'continuity',
        label: meta.interchangeLabel,
        arms,
        baseline: arms[0].id,
      },
    ],
  });
  const measurementNotice = measurementCaveats.length
    ? `<div class="notice"><h3>Measurement caveats · scores preserved, not corrected</h3><ul>${measurementCaveats.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>`
    : '';
  const sections = [
    [
      'setup',
      meta.setupTitle,
      `<p>${esc(meta.setupDescription)} ${proofControl ? 'Sol is responsible for an explicit proof-directed teaching step.' : 'Sol is a responsive housemate without proof steering.'}</p>${corrections.length ? `<h3>Design features</h3><ul>${corrections.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}<p>${esc(meta.setupMechanismDescription)}</p><details><summary>Assigned character, goal and tone</summary><pre>${esc(characterBrief)}</pre></details>`,
    ],
    [
      'quality',
      'Acting and teaching are separate outcomes',
      `${!complete ? '<p class="notice">INCOMPLETE RE-TEST. No paired quality conclusion is available. Missing assessments are not zeros.</p>' : ''}${assessmentFailures.map((f) => `<div class="notice"><h3>${esc(f.arm)} · ${esc(f.kind)} assessment unavailable</h3><p>${esc(f.reason)}</p><p>The dialogue is complete and unchanged. No missing score or reason was inferred.</p></div>`).join('')}${failures.map((f) => `<div class="notice"><h3>${esc(f.arm)} · failed output, not delivered to Sol</h3><p>${esc(f.reason)}</p><blockquote>${esc(f.text)}</blockquote><p>Response latency: ${num(f.latencyMs / 1000, 2)} seconds. Preserved unchanged; no missing note or ending signal was inferred.</p></div>`).join('')}${quality}<p>${esc(meta.qualityDescription)}</p>${observations.length ? `<h3>Direct reading · separate from Opus</h3><ul>${observations.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}`,
    ],
    [
      'before-after',
      comparisonLabel,
      `${previous}<p>${esc(proofControl ? meta.comparisonMechanismDescription : 'The two new arms share the same tutor framing.')} ${esc(meta.comparisonDescription)}</p>`,
    ],
    [
      'rubrics',
      'Keep the existing instruments visible',
      `${measurementNotice}${rubrics}<p>${esc(meta.rubricDescription)}</p>${arms
        .map(
          (a) =>
            `<details><summary>${label(a)} · available dialogue and quality assessments</summary><pre>${esc(
              JSON.stringify(
                evaluation.scores.filter((s) => s.arm === a.id && ['quality', 'dialogue'].includes(s.kind)),
                null,
                2,
              ),
            )}</pre></details>`,
        )
        .join('')}`,
    ],
    [
      'speed',
      'Cost of remembering the interaction',
      `${speed}<p>${provenance.priorAttempts ? 'Normal-Qwen generation crossed multiple sessions; ' : ''}${esc(meta.speedDescription)}</p>`,
    ],
    [
      'transcripts',
      'Exact public swimlanes',
      `<p>${esc(meta.transcriptDescription)} Each numbered row is the learner followed by Sol. Learner turn N cannot respond to Sol turn N, which comes afterwards.</p>${interchange.map(renderDramaticDialogueFragment).join('')}`,
    ],
    [
      'proof',
      'Public proof progress is not learner understanding',
      proofControl
        ? `${table('Deterministic public-evidence audit', [
            [
              'Delivered authored clues',
              (a) =>
                `${a.snapshot.proofControl?.releasedPremiseIds.length ?? 0} / ${a.snapshot.proofControl?.scheduledPremises ?? '?'}`,
            ],
            [
              'Public evidence logically supports the cause',
              (a) => (a.snapshot.proofControl?.publicProofEntailed ? 'Yes' : 'No'),
            ],
            [
              'Inquiry status',
              (a) =>
                ({
                  inquiry_unresolved: 'Unresolved',
                  public_evidence_sufficient_learner_understanding_unassessed:
                    'Cause supported; learner understanding not established',
                })[a.snapshot.proofControl?.inquiryDisposition] || 'Unavailable',
            ],
          ])}<p>${esc(meta.proofDescription)} The independent assessments above judge actual public reasoning and character.</p>`
        : '<p>This comparison did not run public-proof control. The optional evidence schedule is not a learner-DAG assessment.</p>',
    ],
    [
      'continuity',
      'Private continuity · bookkeeping, not a verdict',
      `<p>Each speaker saw only their own note and the public dialogue. Quotes were checked against ${provenance.noteQuotationScope === 'prior_or_current_public_speech' ? 'earlier public speech or the speaker’s current line' : 'preceding speech'}; whether a quotation really settles an issue is the model’s interpretation, not an independently validated fact. Notes are excluded from every Opus assessment.</p>${arms.map((a) => `<details><summary>${label(a)} · final notes</summary><pre>${esc(a.snapshot.ledgers ? JSON.stringify(a.snapshot.ledgers, null, 2) : 'No note returned — generation failed.')}</pre></details>`).join('')}`,
    ],
    [
      'scope',
      'Private, bounded engineering evidence',
      `<p>${evaluation.scores.length}/${expectedAssessments} assessments accepted. ${provenance.budget?.used ?? '?'} of ${provenance.totalAttemptCeiling ?? provenance.budget?.limit ?? 40} ${esc(meta.attemptScopeLabel)}. ${esc(opusAttemptSummary)}. No outcome-driven resampling, fallback judge, production ingestion, push or publication. ${esc(meta.scopeDescription)}</p><pre>${esc(JSON.stringify(provenance, null, 2))}</pre>`,
    ],
  ];
  const html = `<!doctype html><html lang="en" data-skin="machine-spirits"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Qwen refusal · continuity re-test</title><style>${asset('techne.css')}\n${renderDramaticDialogueStyles()}\n.shell{max-width:1500px}.retest .body{grid-column:2/-1;min-width:0}.table-wrap{overflow-x:auto;margin:1.5rem 0}table{width:100%;border-collapse:collapse}caption{text-align:left;font-weight:700;padding:.7rem 0}th,td{border-bottom:1px solid var(--rule);padding:.65rem;text-align:left;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.8rem;line-height:1.5}details{margin:1rem 0}summary{cursor:pointer}li{margin-bottom:.8rem}.notice{padding:1rem;border-left:4px solid var(--brick);background:var(--paper-deep)}.dd__turn-badge{background:var(--ink);color:var(--paper)}@media(max-width:760px){.retest .body{grid-column:1/-1}.retest .ml{display:none}.hero__rune{position:static;margin:1rem}th,td{padding:.4rem}}</style></head><body><header class="rail" id="rail"><div class="rail__inner"><span class="rail__title">Qwen · continuity</span><nav class="rail__nav" aria-label="Sections">${sections.map(([id]) => `<a href="#${id}">${id}</a>`).join('')}</nav><div class="rail__actions"><button class="rail__btn" id="themeToggle" type="button">Dark</button></div></div><div class="rail__progress" id="railProgress"></div></header><main><section class="hero"><div class="hero__rune">Machine Spirits · private engineering</div><h1 class="hero__h1">Refusal that can <span class="em">move on.</span></h1><p class="hero__subtitle">Normal and abliterated Qwen · Sol tutor · no superego</p><p class="notice">${mock ? 'SYNTHETIC PREVIEW — no model evidence.' : 'Exploratory re-test · natural endings allowed · acting is not obedience.'}</p></section><div class="shell">${sections.map(([id, title, body], i) => `<section class="s retest" id="${id}"><div class="diag"><div class="ml"><h2 class="s__num">0${i + 1}<span class="glyph">·</span></h2></div><div class="body"><h2 class="s__h">${title}</h2>${body}</div></div></section>`).join('')}</div><footer class="colophon"><p>Local only · Techne + shared dialogue renderer · no remote assets</p></footer></main><script>${asset('techne.js').replace(/<\/script/giu, '<\\/script')}</script></body></html>`;
  const brandedHtml = html
    .replace('<title>Qwen refusal · continuity re-test</title>', `<title>${esc(meta.pageTitle)}</title>`)
    .replace(
      '<span class="rail__title">Qwen · continuity</span>',
      `<span class="rail__title">${esc(meta.railTitle)}</span>`,
    )
    .replace(
      '<h1 class="hero__h1">Refusal that can <span class="em">move on.</span></h1>',
      `<h1 class="hero__h1">${esc(meta.headline)}</h1>`,
    )
    .replace(
      '<p class="hero__subtitle">Normal and abliterated Qwen · Sol tutor · no superego</p>',
      `<p class="hero__subtitle">${esc(meta.subtitle)}</p>`,
    );
  return {
    html:
      complete || mock
        ? brandedHtml
        : brandedHtml.replace(
            'Exploratory re-test · natural endings allowed · acting is not obedience.',
            generationStopped
              ? 'INCOMPLETE RE-TEST · generation stopped · no paired quality scores.'
              : 'INCOMPLETE ASSESSMENT · both dialogues complete · some scores unavailable.',
          ),
    interchange,
  };
}

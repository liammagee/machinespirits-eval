import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA,
  renderDramaticDialogueFragment,
  renderDramaticDialogueStyles,
} from './dramaticDialogueRenderer.js';

const asset = (name) =>
  fs.readFileSync(fileURLToPath(new URL(`../notes/poetics/assets/${name}`, import.meta.url)), 'utf8');
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/gu,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const num = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : 'unavailable');
const name = (arm) =>
  arm.displayLabel ||
  `${arm.variant === 'normal' ? 'Normal' : 'Abliterated'} · ${arm.mode === 'direct' ? 'direct' : 'Luna + revision'}`;

export function qualitySummary(quality) {
  const turns = quality.learner_turns;
  const noveltyComplete = turns.every(
    (turn) =>
      typeof turn.new_move_is_substantive === 'boolean' &&
      typeof turn.accepted_objection_reopened === 'boolean' &&
      typeof turn.unsupported_evidence_assertion === 'boolean',
  );
  return {
    freshGroundedTurns: noveltyComplete
      ? turns.filter(
          (turn) =>
            turn.turn > 1 &&
            turn.new_move_is_substantive &&
            turn.semantic_repeat_of === null &&
            !turn.accepted_objection_reopened &&
            !turn.unsupported_evidence_assertion,
        ).length
      : null,
    semanticRepeats: turns.filter((turn) => turn.semantic_repeat_of !== null).length,
    reopenedObjections: turns.every((turn) => typeof turn.accepted_objection_reopened === 'boolean')
      ? turns.filter((turn) => turn.accepted_objection_reopened).length
      : null,
    unsupportedLearner: turns.filter((turn) => turn.unsupported_evidence_assertion).length,
    unsupportedTutor: quality.tutor_turns.filter((turn) => turn.unsupported_evidence_assertion).length,
    character: quality.scores.character_adherence.score,
    pedagogy: quality.scores.successful_pedagogy.score,
  };
}

export function compareMechanisms(direct, superego) {
  if (!Number.isFinite(direct.freshGroundedTurns) || !Number.isFinite(superego.freshGroundedTurns))
    return { freshTurnGain: null, promising: null };
  const gain = superego.freshGroundedTurns - direct.freshGroundedTurns;
  return {
    freshTurnGain: gain,
    promising:
      gain >= 2 &&
      superego.character >= 3 &&
      superego.character >= direct.character &&
      superego.pedagogy >= direct.pedagogy &&
      superego.unsupportedLearner <= direct.unsupportedLearner,
  };
}

export function buildFactorialInterchange(arms, scores = [], { groups = null } = {}) {
  const pairs =
    groups ||
    ['normal', 'abliterated'].map((variant) => ({
      id: `qwen-${variant}-superego`,
      label: `${variant} Qwen: direct versus Luna + revision`,
      arms: arms.filter((arm) => arm.variant === variant).toSorted((a) => (a.mode === 'direct' ? -1 : 1)),
    }));
  return pairs.map((group) => {
    const pair = group.arms;
    return {
      schema: DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA,
      id: group.id,
      label: group.label,
      layout: 'parallel',
      arms: pair.map((arm) => ({
        id: arm.id,
        label: name(arm),
        baseline: group.baseline ? arm.id === group.baseline : arm.mode === 'direct',
      })),
      turns: [
        {
          id: `${group.id}-opening`,
          turn: 0,
          messages: pair.map((arm) => ({
            id: `${arm.id}-opening`,
            arm: arm.id,
            speaker: 'tutor',
            turn: 0,
            text: arm.opening,
          })),
        },
        ...Array.from({ length: Math.max(...pair.map((arm) => arm.snapshot.turns.length)) }, (_, index) => ({
          id: `${group.id}-${index + 1}`,
          turn: index + 1,
          messages: pair
            .filter((arm) => arm.snapshot.turns[index])
            .flatMap((arm) =>
              ['learner', 'tutor'].map((speaker) => {
                const qualityScore = scores.find((score) => score.arm === arm.id && score.kind === 'quality');
                const quality = qualityScore?.raw;
                const annotation = quality?.[`${speaker}_turns`]?.[index];
                const rubric = scores.find((score) => score.arm === arm.id && score.kind === speaker)?.raw.turns[index];
                return {
                  id: `${arm.id}-${speaker}-${index + 1}`,
                  arm: arm.id,
                  speaker,
                  turn: index + 1,
                  text: arm.snapshot.turns[index][speaker],
                  provenance: { sourceId: arm.id, locator: `turns[${index}].${speaker}`, quoteExact: true },
                  details: [
                    {
                      summary: 'Opus assessment',
                      entries: [
                        ...(qualityScore?.partial &&
                        speaker === 'learner' &&
                        typeof annotation?.accepted_objection_reopened !== 'boolean'
                          ? [
                              {
                                label: 'Missing annotation',
                                text: 'Whether a settled objection was reopened was not returned. It is unknown, not false; the combined fresh-grounded measure is unavailable.',
                              },
                            ]
                          : []),
                        {
                          label: 'Public-evidence annotation',
                          text: annotation ? JSON.stringify(annotation, null, 2) : 'Not assessed — scoring incomplete.',
                        },
                        ...(!rubric ? [{ label: 'Rubric', text: 'No accepted assessment.' }] : []),
                        ...Object.entries(rubric?.scores || {}).map(([label, value]) => ({
                          label,
                          text: `${value.score ?? 'N/A'}/5 — ${value.reasoning || ''}`,
                        })),
                      ],
                    },
                  ],
                };
              }),
            ),
        })),
      ],
    };
  });
}

export function renderFactorialReport({ arms, evaluation, mock = false, provenance = {}, observations = [] }) {
  const acceptedCount = evaluation.scores.filter((score) => !score.partial).length;
  const partialCount = evaluation.scores.filter((score) => score.partial).length;
  const complete = arms.every((arm) =>
    ['tutor', 'learner', 'dialogue', 'quality'].every((kind) =>
      evaluation.scores.some((score) => score.arm === arm.id && score.kind === kind && !score.partial),
    ),
  );
  const quality = new Map(
    arms.map((arm) => [
      arm.id,
      evaluation.scores.find((score) => score.arm === arm.id && score.kind === 'quality')?.raw,
    ]),
  );
  const summaries = new Map(
    arms.map((arm) => [arm.id, quality.get(arm.id) ? qualitySummary(quality.get(arm.id)) : null]),
  );
  const ordered = ['normal', 'abliterated'].flatMap((variant) =>
    ['direct', 'ego_superego'].map((mode) => arms.find((arm) => arm.variant === variant && arm.mode === mode)),
  );
  const table = (caption, rows) =>
    `<div class="table-wrap"><table><caption>${esc(caption)}</caption><thead><tr><th scope="col">Measure</th>${ordered.map((arm) => `<th scope="col">${esc(name(arm))}</th>`).join('')}</tr></thead><tbody>${rows.map(([label, getter]) => `<tr><th scope="row">${esc(label)}</th>${ordered.map((arm) => `<td>${esc(getter(arm))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const primary = table('Independent Opus annotations · descriptive counts and ordinal scores', [
    [
      'Fresh grounded contributions · turns 2–8 / 7',
      (arm) => summaries.get(arm.id)?.freshGroundedTurns ?? 'Not assessed',
    ],
    ['Semantic repeats / 8', (arm) => summaries.get(arm.id)?.semanticRepeats ?? 'Not assessed'],
    ['Reopened settled objections / 8', (arm) => summaries.get(arm.id)?.reopenedObjections ?? 'Not assessed'],
    ['Unsupported learner observations / 8', (arm) => summaries.get(arm.id)?.unsupportedLearner ?? 'Not assessed'],
    ['Unsupported tutor observations / 8', (arm) => summaries.get(arm.id)?.unsupportedTutor ?? 'Not assessed'],
    ...['overall_quality', 'successful_pedagogy', 'surprise_nonrepetition', 'character_adherence'].map((key) => [
      key.replaceAll('_', ' ') + ' / 5',
      (arm) => quality.get(arm.id)?.scores[key].score ?? 'Not assessed',
    ]),
  ]);
  const rubric = table(
    'Active v2.2 rubrics · weighted summaries / 100',
    ['tutor', 'learner', 'dialogue'].map((kind) => [
      kind,
      (arm) => num(evaluation.scores.find((score) => score.arm === arm.id && score.kind === kind)?.scored.overall),
    ]),
  );
  const speed = table('Timing and lexical diagnostics · not semantic proof', [
    ['Whole learner mechanism median seconds', (arm) => num(arm.technical.learnerMechanism.medianLatencyMs / 1000)],
    ['Final Qwen call median seconds', (arm) => num(arm.technical.learnerFinal.medianLatencyMs / 1000)],
    [
      'Final Qwen mean end-to-end output tokens/s',
      (arm) => num(arm.technical.learnerFinal.meanEndToEndOutputTokensPerSecond, 2),
    ],
    ['Tutor total seconds', (arm) => num(arm.technical.tutor.totalLatencyMs / 1000)],
    ['Arm wall seconds including load/stop', (arm) => num(arm.wallTimeMs / 1000)],
    ['Lexical surprise after opening', (arm) => num(arm.repetition.meanLexicalSurpriseAfterOpening, 3)],
    ['Distinct bigrams', (arm) => num(arm.repetition.distinct2, 3)],
    ['Tutor turns with native guard findings', (arm) => arm.technical.guardedTutorTurns],
    ['Prompt compaction/recovery events', (arm) => arm.technical.promptAuditRecoveries],
  ]);
  const contrasts = ['normal', 'abliterated']
    .map((variant) => {
      const direct = arms.find((arm) => arm.variant === variant && arm.mode === 'direct');
      const treated = arms.find((arm) => arm.variant === variant && arm.mode === 'ego_superego');
      if (!summaries.get(direct.id) || !summaries.get(treated.id))
        return `<p><strong>${esc(variant)}:</strong> Assessment incomplete — the predeclared comparison cannot be calculated.</p>`;
      const result = compareMechanisms(summaries.get(direct.id), summaries.get(treated.id));
      if (result.promising === null)
        return `<p><strong>${esc(variant)}:</strong> The combined fresh-contribution comparison is unavailable because an annotation is missing. The returned quality, pedagogy, repetition and character measures remain comparable above; no missing judgment is filled in.</p>`;
      return `<p><strong>${esc(variant)}:</strong> ${mock ? 'SYNTHETIC PREVIEW — no result' : result.promising ? 'Promising for a replicated follow-up' : 'Not yet demonstrated'}. Fresh-contribution difference: ${result.freshTurnGain}. This is the predeclared engineering triage rule, not statistical significance.</p>`;
    })
    .join('');
  const interchange = buildFactorialInterchange(arms, evaluation.scores);
  const sections = [
    [
      'setup',
      'The same actor, with or without a private critic',
      `<p>Four fresh eight-turn dialogues. Counterexample-hunter Tamsin, Marrick, Sol medium, temperature 0.6, thinking and MTP off. All arms use the same active-resistance prompt. Luna low critiques a draft once; the same Qwen authors the final revision. Direct arms have one pass. The treatment bundles advice and extra inference.</p><p>Success is believable, developing resistance—not compulsory agreement. Turn 8 has no later learner uptake. One dialogue per condition, divergent histories and fixed order cannot establish a causal checkpoint effect.</p>`,
    ],
    [
      'quality',
      'Does resistance develop?',
      `${primary}${contrasts}${observations.length ? `<h3>Direct transcript reading · not an Opus score</h3><p>These observations describe visible passages only. They do not replace the missing registered assessments.</p><ul>${observations.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}`,
    ],
    [
      'rubrics',
      'Existing instruments, with the reasoning visible',
      `${rubric}<p>${arms.every((arm) => ['tutor', 'learner', 'dialogue'].every((kind) => evaluation.scores.some((score) => score.arm === arm.id && score.kind === kind && !score.partial))) ? 'All eight generated turns per speaker and all four dialogues have complete v2.2 rubric assessments.' : 'Only available assessments are displayed; unavailable is not a zero score.'} The opening is context only. Expanded transcript details contain available turn-level rubric reasoning and evidence annotations.</p>${ordered
        .map(
          (arm) =>
            `<details><summary>${esc(name(arm))} · dialogue and quality reasoning</summary><pre>${esc(
              JSON.stringify(
                evaluation.scores
                  .filter((score) => score.arm === arm.id && ['dialogue', 'quality'].includes(score.kind))
                  .map((score) => ({
                    kind: score.kind,
                    ...(score.partial ? { status: 'partial', missingFields: score.missingFields } : {}),
                    assessment: score.raw,
                  })),
                null,
                2,
              ),
            )}</pre></details>`,
        )
        .join('')}`,
    ],
    [
      'speed',
      'Count the entire mechanism',
      `${speed}<p>Whole learner time includes initial Qwen draft, Luna critique and Qwen revision where present. Final-call token rate is end-to-end, not decoder-only throughput. Model loading and service overhead remain in arm wall time. Lexical novelty is not evidence of fresh reasoning.</p>`,
    ],
    [
      'transcripts',
      'Exact public swimlanes',
      `<p>No private drafts, critique, hidden state or system prompts are reproduced here. Expand “Opus assessment” beside either speaker for scores and reasoning.</p>${interchange.map((item) => `<h3>${esc(item.label)}</h3>${renderDramaticDialogueFragment(item)}`).join('')}`,
    ],
    [
      'provenance',
      'Scope and provenance',
      `<p>${mock ? 'This entire document is a synthetic fixture. No Qwen, Sol, Luna or Opus inference produced these contents. It tests rendering and plumbing only.' : 'Independent model assessment is fallible. These are local engineering observations, not human-learning evidence, paper claims or a model ranking.'}</p><p>Generation ceiling 96; judge ceiling 16; total ceiling 112. No retries, fallback, resampling, database ingestion or publication.</p><pre>${esc(JSON.stringify(provenance, null, 2))}</pre>`,
    ],
  ];
  if (!complete)
    sections[0][2] = `<div class="notice"><strong>${partialCount ? 'One annotation family is missing; the other measures can be compared.' : 'Assessment incomplete.'}</strong> ${esc(evaluation.stopReason || 'The planned assessments are not all available.')} Accepted assessments: ${acceptedCount}/16.${partialCount ? ` Partial assessments: ${partialCount}. Their returned, validated fields are displayed without altering the original reply.` : ''} No further model calls were made after the stop.</div>${sections[0][2]}`;
  if (evaluation.rejected?.length)
    sections[2][2] += evaluation.rejected
      .map(
        (row) =>
          `<details><summary>Rejected response — arm ${esc(row.arm)} ${esc(row.kind)} (not scored)</summary><p>${esc(row.error)}</p><pre>${esc(row.text)}</pre></details>`,
      )
      .join('');
  if (evaluation.indexRecovery) sections[2][2] += `<p class="notice">${esc(evaluation.indexRecovery)}</p>`;
  const notice = mock
    ? 'SYNTHETIC PREVIEW ONLY — no experiment launched, no real scores.'
    : complete
      ? 'Exploratory results — one dialogue per condition. Not a causal effect estimate.'
      : partialCount
        ? 'Exploratory comparison — all four dialogues scored; one quality assessment lacks a turn annotation. Missing values are not zeros.'
        : 'ASSESSMENT INCOMPLETE — four dialogues saved; no complete quality comparison or treatment conclusion.';
  const navLabels = ['Setup', 'Quality', 'Rubrics', 'Speed', 'Transcripts', 'Scope'];
  const html = `<!doctype html><html lang="en" data-skin="machine-spirits"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="color-scheme" content="light dark"><title>Qwen × Luna — ${mock ? 'synthetic preview' : 'resistant learner experiment'}</title><style>${asset('techne.css')}</style><style>${renderDramaticDialogueStyles()}
.shell{max-width:1500px}.factorial .body{grid-column:2/-1;min-width:0}.hero__lede{max-width:100%}.table-wrap{overflow-x:auto;margin:1.5rem 0}table{width:100%;border-collapse:collapse;font-size:.85rem}caption{text-align:left;font-weight:700;padding:.6rem 0}th,td{border-bottom:1px solid var(--rule);padding:.65rem;text-align:left;vertical-align:top}td{font-variant-numeric:tabular-nums}details{margin:1rem 0}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.8rem;line-height:1.5}.notice{border-left:4px solid var(--brick);padding:1rem;background:var(--paper-deep)}@media(max-width:760px){.factorial .body{grid-column:1/-1}.factorial .ml{display:none}.hero__rune{position:static;margin:0 1rem 1.25rem}th,td{padding:.45rem}}
</style></head><body><header class="rail" id="rail"><div class="rail__inner"><span class="rail__title">Qwen × Luna</span><nav class="rail__nav" aria-label="Section navigation">${sections.map(([id], index) => `<a href="#${id}">${navLabels[index]}</a>`).join('')}</nav><div class="rail__actions"><button class="rail__btn" id="themeToggle" type="button">Dark</button></div></div><div class="rail__progress" id="railProgress"></div></header><main><section class="hero"><div class="hero__rune">Machine Spirits · local engineering experiment</div><h1 class="hero__h1">Can a private critic keep <span class="em">resistance alive?</span></h1><p class="hero__subtitle">Normal and abliterated Qwen · direct and Luna-assisted · Sol tutor</p><p class="notice">${notice}</p></section><div class="shell">${sections.map(([id, title, body], index) => `<section class="s factorial" id="${id}"><div class="diag"><div class="ml"><h2 class="s__num">0${index + 1}<span class="glyph">·</span></h2></div><div class="body"><h2 class="s__h">${esc(title)}</h2>${body}</div></div></section>`).join('')}</div><footer class="colophon"><p>Local only · Techne + shared dramatic-dialogue renderer · no remote assets</p></footer></main><script>${asset('techne.js').replace(/<\/script/giu, '<\\/script')}</script></body></html>`;
  return { html, interchange };
}

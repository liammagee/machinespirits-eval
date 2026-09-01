import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildFactorialInterchange, qualitySummary } from './localQwenFactorialReport.js';
import { renderDramaticDialogueFragment, renderDramaticDialogueStyles } from './dramaticDialogueRenderer.js';

const asset = (name) =>
  fs.readFileSync(fileURLToPath(new URL(`../notes/poetics/assets/${name}`, import.meta.url)), 'utf8');
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/gu,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const n = (v, digits = 1) => (Number.isFinite(v) ? v.toFixed(digits) : 'Unavailable');

export function renderBilateralReport({
  arms,
  evaluation,
  provenance,
  baseline,
  characterBrief,
  observations = [],
  resultSummary = '',
  mock = false,
}) {
  const reference = { ...baseline.arms.find((arm) => arm.id === 'B'), displayLabel: 'Prior: neither superego' };
  const current = arms.map((arm) => ({ ...arm, displayLabel: arm.label }));
  const display = [reference, ...current];
  const scores = [...baseline.evaluation.scores.filter((s) => s.arm === 'B'), ...evaluation.scores];
  const score = (a, kind) => scores.find((s) => s.arm === a.id && s.kind === kind);
  const q = (a) => (score(a, 'quality') ? qualitySummary(score(a, 'quality').raw) : null);
  const table = (caption, rows) =>
    `<div class="table-wrap"><table><caption>${esc(caption)}</caption><thead><tr><th>Measure</th>${display.map((a) => `<th>${esc(a.displayLabel)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label, get]) => `<tr><th>${esc(label)}</th>${display.map((a) => `<td>${esc(get(a))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const interchange = buildFactorialInterchange(current, evaluation.scores, {
    groups: [
      { id: 'bilateral', label: 'Abliterated Qwen: learner-only versus bilateral Luna superego', arms: current },
    ],
  });
  const sections = [
    [
      'design',
      'One adviser, or one on each side?',
      `<p>Both new dialogues use the same abliterated Qwen as Alex, Sol as the housemate, and the same public-proof controller. In the first, Luna reviews only Alex’s draft. In the second, a separate Luna review also precedes Sol’s final reply. Each speaker can keep or revise its draft; Luna never writes the public turn.</p><p>Same Rowan Flat world, character, seed, sampling and eight-exchange maximum. Natural exits remain allowed. No new practical-action simulator, accelerated clue release or live learner-DAG analysis.</p><details><summary>Character and practical stakes</summary><pre>${esc(characterBrief)}</pre></details>`,
    ],
    [
      'quality',
      'Character, teaching and repetition',
      `${evaluation.scores.length < 8 ? '<p class="notice">Some new assessments are missing. Missing values are not zeros; inspect the preserved failure records.</p>' : ''}${table(
        'Opus judgments · one dialogue per condition · /5',
        [
          ['Completed exchanges / maximum', (a) => `${a.snapshot.turns.length} / 8`],
          [
            'Ending',
            (a) =>
              ({ learner_exit: 'Learner exit', tutor_closure: 'Tutor closure', exchange_cap: 'Eight-exchange limit' })[
                a.snapshot.disposition
              ] || a.snapshot.disposition,
          ],
          ...['overall_quality', 'successful_pedagogy', 'surprise_nonrepetition', 'character_adherence'].map((key) => [
            key.replaceAll('_', ' '),
            (a) => score(a, 'quality')?.raw.scores[key].score ?? 'Unavailable',
          ]),
          [
            'Semantic repeated moves',
            (a) => (q(a) ? `${q(a).semanticRepeats} / ${a.snapshot.turns.length}` : 'Unavailable'),
          ],
          [
            'Developing nonrepeated moves after opening',
            (a) => (q(a) ? `${q(a).freshGroundedTurns} / ${Math.max(0, a.snapshot.turns.length - 1)}` : 'Unavailable'),
          ],
          [
            'Unsupported learner / tutor assertions',
            (a) => (q(a) ? `${q(a).unsupportedLearner} / ${q(a).unsupportedTutor}` : 'Unavailable'),
          ],
        ],
      )}<p>The older no-superego dialogue is a descriptive reference, not a new randomized control. Its original scores are reused unchanged. Different realized histories, lengths and a source-context clarification in the new judge packets prevent a clean causal effect estimate.</p>${observations.length ? `<h3>Direct reading · separate from Opus</h3><ul>${observations.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}`,
    ],
    [
      'rubrics',
      'The existing instruments',
      `${table(
        'Unchanged v2.2 dimensions · weighted summaries /100',
        ['tutor', 'learner', 'dialogue'].map((kind) => [kind, (a) => n(score(a, kind)?.scored.overall)]),
      )}<p>Faithful refusal can coexist with low learning scores. The new judge packets include only the public opening situation and the authored sources actually delivered, labelled by turn. They exclude model/condition identities, private notes, drafts, reviews and hidden proof. The old judge packet lacked source provenance; its source-grounding disagreement remains a limitation, not a corrected score.</p>${current
        .map(
          (a) =>
            `<details><summary>${esc(a.label)} · complete saved judgments</summary><pre>${esc(
              JSON.stringify(
                evaluation.scores.filter((s) => s.arm === a.id),
                null,
                2,
              ),
            )}</pre></details>`,
        )
        .join('')}`,
    ],
    [
      'proof',
      'Proof progress is not demonstrated understanding',
      `${table('Delivered public evidence · deterministic bookkeeping', [
        ['Authored clues delivered', (a) => `${a.snapshot.proofControl.releasedPremiseIds.length} / 4`],
        ['Public evidence supports the cause', (a) => (a.snapshot.proofControl.publicProofEntailed ? 'Yes' : 'No')],
        ['Learner understanding', () => 'Not inferred by the controller'],
      ])}<p>Only final spoken replies advance the evidence record. The private proof tree is never shown to either speaker or adviser. Understanding must be demonstrated in public speech; available clues, agreement and private notes are not sufficient.</p>`,
    ],
    [
      'transcripts',
      'The two new public dialogues',
      `<p>Each row contains Alex’s reply followed by Sol’s reply. Open an assessment to inspect the unchanged ratings and reasons. Drafts and advice are excluded from these swimlanes and from judging.</p>${interchange.map(renderDramaticDialogueFragment).join('')}<details><summary>Earlier no-superego public transcript</summary><pre>${esc(reference.transcript)}</pre></details>`,
    ],
    [
      'deliberation',
      'Did Luna change anything? · private trace',
      `<p>Every enabled loop makes one draft, one review and one final response. A changed string is not necessarily improved acting or pedagogy. These records are private process evidence, not judge input.</p>${current.map((a) => `<details><summary>${esc(a.label)} · ${a.snapshot.deliberations.length} draft / review / final records</summary><pre>${esc(JSON.stringify(a.snapshot.deliberations, null, 2))}</pre></details>`).join('')}`,
    ],
    [
      'speed',
      'Time and call cost',
      `${table('Whole-mechanism latency includes drafts, reviews and revisions', [
        ['Learner calls', (a) => a.technical.learnerMechanism.calls],
        ['Tutor calls', (a) => a.technical.tutorMechanism?.calls ?? a.technical.tutor.calls],
        ['Median whole learner turn · seconds', (a) => n(a.technical.learnerMechanism.medianLatencyMs / 1000)],
        [
          'Median whole tutor turn · seconds',
          (a) => n((a.technical.tutorMechanism?.medianLatencyMs ?? a.technical.tutor.medianLatencyMs) / 1000),
        ],
        ['Median final Qwen call · seconds', (a) => n(a.technical.learnerFinal.medianLatencyMs / 1000)],
        ['Whole dialogue session · seconds', (a) => n(a.wallTimeMs / 1000)],
      ])}<p>Different histories, lengths, warm-up and response sizes prevent a pure throughput comparison. Historical wall time includes service startup/shutdown; new per-arm wall time excludes the shared service lifecycle. Call counts and mechanism latencies remain explicit.</p>`,
    ],
    [
      'scope',
      'Private engineering result, not a general model ranking',
      `<p>${evaluation.scores.length}/8 new assessments available. ${provenance.budget.used}/100 total attempts used. ${evaluation.attemptsUsed} Opus attempts, including preserved failures. No replacement dialogue, self-judge, fallback model, push or publication. ${mock ? 'SYNTHETIC PREVIEW: no model evidence.' : ''}</p><p>One comparison cannot establish a general superego effect, an abliteration advantage or human-learning efficacy. Low quality is not technical failure. Indeterminate measurement is not a zero.</p><pre>${esc(JSON.stringify({ provenance, failures: evaluation.failures || [], recoveries: evaluation.recoveries || [] }, null, 2))}</pre>`,
    ],
  ];
  const html = `<!doctype html><html lang="en" data-skin="machine-spirits"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Qwen refusal · bilateral Luna review</title><style>${asset('techne.css')}\n${renderDramaticDialogueStyles()}\n.shell{max-width:1500px}.bilateral .body{grid-column:2/-1;min-width:0}.table-wrap{overflow-x:auto;margin:1.5rem 0}table{width:100%;border-collapse:collapse}caption{text-align:left;font-weight:700;padding:.7rem 0}th,td{border-bottom:1px solid var(--rule);padding:.65rem;text-align:left;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.8rem;line-height:1.5}details{margin:1rem 0}summary{cursor:pointer}li{margin-bottom:.8rem}.notice{padding:1rem;border-left:4px solid var(--brick)}.dd__turn-badge{background:var(--ink);color:var(--paper)}@media(max-width:760px){.bilateral .body{grid-column:1/-1}.bilateral .ml{display:none}.hero__rune{position:static;margin:1rem}th,td{padding:.4rem}}</style></head><body><header class="rail" id="rail"><div class="rail__inner"><span class="rail__title">Qwen · Luna review</span><nav class="rail__nav" aria-label="Sections">${sections.map(([id]) => `<a href="#${id}">${id}</a>`).join('')}</nav><div class="rail__actions"><button class="rail__btn" id="themeToggle" type="button">Dark</button></div></div><div class="rail__progress" id="railProgress"></div></header><main><section class="hero"><div class="hero__rune">Machine Spirits · private engineering</div><h1 class="hero__h1">Advice without <span class="em">obedience.</span></h1><p class="hero__subtitle">Abliterated Qwen · Sol tutor · learner-only versus bilateral Luna superego</p><p class="notice">${mock ? 'SYNTHETIC PREVIEW — no model evidence.' : 'Exploratory comparison · natural exits allowed · acting is not obedience.'}</p>${resultSummary ? `<p class="hero__subtitle">${esc(resultSummary)}</p>` : ''}</section><div class="shell">${sections.map(([id, title, body], i) => `<section class="s bilateral" id="${id}"><div class="diag"><div class="ml"><h2 class="s__num">0${i + 1}<span class="glyph">·</span></h2></div><div class="body"><h2 class="s__h">${title}</h2>${body}</div></div></section>`).join('')}</div><footer class="colophon"><p>Local only · Techne + shared swimlanes · no remote assets</p></footer></main><script>${asset('techne.js').replace(/<\/script/giu, '<\\/script')}</script></body></html>`;
  return { html, interchange };
}

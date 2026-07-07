# Curriculum Drama Runtime Performance: Compression Options

Status: design note for later revisit. Do not treat any speed-up path here as quality-neutral until tested against the curriculum-drama quality gate and the poetics scoring rubric.

## Current Finding

The static/dynamic prompt split fixes persistent-worker reuse, but early evidence suggests only modest wall-clock gain by itself. Reused workers still receive large dynamic user-context messages, especially for tutor superego and ego-adjudication calls. The next likely performance gains require token compression, context factoring, or fewer model calls.

## Low-Risk Token Compression

These options preserve the current ego-superego architecture and should be tested first:

1. Move repeated director, blinding, public-speech, and forbidden-label instructions into stable static prompts.
2. Compile a compact `world_runtime_card` from the curriculum/world spec and pass per-turn references instead of repeating full curriculum prose.
3. Replace repeated curriculum/world/turn-plan prose with handles such as `KC.AF101`, `MOVE.ACTION_GATE`, `FORBID.HIDDEN_LABELS`, with lookup definitions present in the static prompt or expanded by the runtime.
4. Send only active references, current cue, last public turns, and a short state summary in dynamic context.
5. Represent scene artifacts as structured rows or IDs, expanding only the row currently under review.

Expected gain: roughly 15-35% wall-clock improvement if dynamic prompt size falls materially, with lower quality risk than reducing call count.

## Higher-Risk Call-Count Compression

The larger speed lever is to skip some internal passes:

1. No tutor superego on routine or low-risk turns.
2. No second ego/adjudication pass when the tutor draft passes cheap structural checks.
3. Compact superego on non-pivot turns.
4. Full ego-superego-ego only on predicted pivot, reframe, peripeteia, or closure-risk turns.
5. Single-pass learner on low-stakes response turns, preserving full learner ego-superego only around reframe/actional-breakthrough windows.

Expected gain: potentially 30-60% if many turns avoid the second and third calls. This is also the highest regression risk because recent quality gains may depend on the internal critique/adjudication loop.

## Testing Requirement

Minimal speed-up may trade away the exact quality we have just gained. Any call-count reduction needs a staged evaluation:

1. Baseline full-fidelity run.
2. Static/dynamic split only.
3. Token-compressed full-fidelity run.
4. Selective-superego or no-second-ego ablation.
5. Compare quality warnings, hidden-label leakage, public reframe exposure, curriculum evidence coverage, poetics form score, and human-read transcript plausibility.

Do not adopt a faster lane as default unless it preserves the curriculum-to-drama pathway and does not regress recognition/peripeteia quality on the same seed/module comparisons.

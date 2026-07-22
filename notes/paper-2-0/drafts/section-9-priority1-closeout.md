# Section 9 closeout draft — v3.0.228

Scope: replace only the `### What comes next` block in
`docs/research/paper-full-2.0.md`. This is an agenda reconciliation, not a new
results fold.

The remaining agenda has shifted again. Mechanism isolation is no longer a
proposed future run: Section 6.4.2 reports direct M1/M2 isolation, and Section
6.4.2.1 links the substitution pattern back to the critique-taxonomy evidence.
Likewise, the superego taxonomy is no longer merely an intended coding scheme:
Section 5.3 reports the automated 500-critique corpus, the 10-category codebook,
and the inter-LLM reliability baseline. The Program-2 context-versus-weights
question has also been run rather than merely proposed (§§6.20--6.22): it finds
partial parametric traction, while the live committee clears its compliance
endpoint only after fail-closed checks cover every non-release delivered-text
path it owns; the hard-safety guardrail still fails. The nearest unresolved
Program-2 question is therefore causal attribution between trained weights and
the harness that selects, repairs, and guards their output. What remains is not
generation of the first mechanism evidence, but external validation,
human-grounded failure detection, causal attribution within the validated
committee, boundary mapping, and deeper mechanistic localisation.
<!-- [VERIFIED: §§6.4.2, 5.3, 6.20--6.22; no new empirical claim] -->

First, **human expert coding of the superego taxonomy** is the nearest
validation step for the process-level claims in Section 8.2. The apparatus
already exists: a stratified 40-item rater packet, a matched key, a codebook
with boundary rules and exemplars, and an analysis script for Cohen's
$\kappa$, Fleiss' $\kappa$, per-category F1, confusion matrices, and human-LLM
agreement (§5.3). The empirical task is to collect at least two independent
expert ratings, compare them with the Haiku/Sonnet inter-LLM baseline
($\kappa = 0.633$), and decide which categories are stable, which need
codebook refinement, and which should be treated as pilot-unstable. If the
pilot clears the pre-specified $\kappa \geq 0.60$ floor, the next scale-up is a
100--150 item human-coded sample; if it does not, the taxonomy remains an
LLM-process instrument rather than a validated expert coding scheme.
<!-- [PENDING: two independent expert raters; existing apparatus in §5.3] -->

Second, **human learner validation** remains the critical external-validity
test. The present study establishes tutor-output and simulated-dialogue
effects; it does not show that recognition-enhanced tutoring improves human
learning. The human pilot should therefore compare recognition-enhanced and
baseline tutoring with real learners, measuring pre/post conceptual
understanding, transfer, engagement, and learner experience rather than
satisfaction alone. This is the point at which the synthetic-learner apparatus
must give way to educational outcomes: the mechanisms identified here matter
pedagogically only if they survive contact with human learners.
<!-- [PENDING: IRB approval, real consent text, and real item content] -->

Third, **human-grounded communicative-impasse validation** is the nearest
available bridge between the synthetic adaptation apparatus and the full human
pilot. A bounded candidate-episode corpus has already been extracted without
model calls from the user's own interactive tutor sessions; the next gate is
human labeling of whether each episode is a genuine impasse, what kind it is,
and whether the tutor resolves it. Only after the existing computed signals
are tested against those labels should a repair policy be designed. This is a
validation of failure detection and repair in one person's interactions, not a
human-learning result.
<!-- [PENDING: user annotation of notes/impasse/2026-07-17-phase1-labeling-sheet.md] -->

Fourth, **a trained-mini versus untuned-mini committee ablation** should price
the Program-2 fine-tune before any retraining or further transfer expansion.
The contrast holds the fail-closed committee harness fixed and changes only
the small model in its specialist seat. If the untuned floor reproduces the
trained committee, the live result belongs primarily to harness engineering;
if it falls toward the silent control, the trained weights are load-bearing.
The comparison requires its own frozen pre-registration and run license; the
completed Program-2 ledger authorizes neither outcome in advance.
<!-- [PENDING: workplan item program-2-committee-floor-ablation] -->

Fifth, **model-boundary, prompt-threshold, and white-box localisation work**
remain longer-term rather than immediate widening. The useful targets are
already defined: role- and capability-stratified tests of where the mechanism
account stops generalising; a threshold map for when procedural scaffolding
changes from prosthesis to straitjacket (§7.8.3); and open-weights analysis of
the initiative-ceding mediator isolated in §7.10. These lines should follow the
human-coding and causal-attribution gates above, not displace them.
<!-- [PENDING: separately scoped future experiments] -->

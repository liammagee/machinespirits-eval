# First-draft speaking boundary — V2 working screen

Date: 2026-07-16

## Scope

This development cycle tested the coordinated speaking-boundary rewrite on
frozen answer-seeking prefixes from Nocturne, Skyway, and Greyfen. It did not
rerun the learner, classifier, learner-DAG, prior dialogue, repair, fallback,
or continuation. Each screened turn generated one original Terra speaking
candidate. The labels are reusable development provenance, not held-out or
deterministic sampling seeds.

The implementation separates three concerns:

- hard public-integrity and conversational-integrity guards remain fail-closed;
- the first speaking attempt receives one ordered OPEN → DEVELOP → END contract,
  with an exact public target/evidence pair where counterpressure is applicable;
- broader configuration variation is retained as a trajectory diagnostic rather
  than an aggregate development veto. Selected part/tactic realization remains
  required for an original candidate to count as accepted. Strict held-out
  acceptance still enforces its existing configuration gate.

## Development history

### Iteration 1

Nocturne produced 3/4 accepted originals and zero safety failures. The original
gate passed, but the legacy aggregate configuration gate failed at 0.875 versus
0.90. The decisive accepted reply averaged 25.67 words per sentence against a
tolerated ceiling of about 25.3, while still realizing its selected advocate and
evidentiary-boundary work. This motivated making aggregate non-actorial
configuration realization report-only in the development screen. The metric and
0.90 reference remain in the report.

### Iteration 2

Nocturne stopped after two rejected originals:

- a lexical leak false positive combined the grammatical preposition `beside`
  with the ambiguous material word `strokes` and treated them as the unreleased
  Liane-hand clue;
- a contradictory contract asked for a rapid question while the authoritative
  question-support frame prohibited open recall before more evidence was public.

The strict guards rejected both candidates. The fixes classify `beside` as
non-evidentiary in both live and frozen private-token matching, while preserving
the two-distinctive-token rule, and compile direction-only/no-new-evidence rapid
handoffs as short declarative boundaries. The selected examiner/rapid-handoff
configuration and its audit remain unchanged.

### Iteration 3 — pass

Artifact:
`/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v2/iteration-3/working-screen-result.json`

| Cell | Originals | Safety failures | Uptake failures | Mean configuration realization | Mean original latency |
|---|---:|---:|---:|---:|---:|
| Nocturne / answer-seeking | 4/4 | 0 | 0 | 1.000 | 6,660 ms |
| Skyway / answer-seeking | 4/4 | 0 | 0 | 0.917 | 6,826 ms |
| Greyfen / answer-seeking | 4/4 | 0 | 0 | 0.958 | 6,615 ms |

Across all twelve turns there were no mechanical repairs, model rewrites,
deterministic fallbacks, semantic-adjudicator calls, or recorded failure
clusters.

## Claim boundary

This is strong development evidence that the revised first-draft contract works
on the three frozen difficult pairings. It is not evidence of held-out
generalization, full-trajectory recovery quality, or final trajectory-level
character appropriateness. Those require a fresh predeclared held-out matrix and
the separate trajectory shadow instrument.

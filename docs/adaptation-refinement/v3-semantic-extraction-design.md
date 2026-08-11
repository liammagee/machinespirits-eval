# V3 Semantic Extraction Design and Predeclared Gate

**Status:** prospective design; no V3 implementation or V3 labels exist

**Declared:** 11 August 2026

**Scope:** automated tutor-stub mechanism validation only

**Prior evidence:** the frozen representative V2 result remains unchanged and
must not be rescored under this design

## 1. Why V3 changes the observation boundary

V2 established that the typed reducer and execution boundary can run cleanly:
24/24 valid dialogues, 192/192 live/replay comparisons, and 192/192 delivery
comparisons. It did not establish that the observations entering that reducer
were semantically valid. The representative score retained reasonable
precision but failed recall, request/proposal classification, transition
accuracy, inquiry recall, mechanism consensus, and three divergence
interpretations.

The concrete audit found ordinary public requests such as “show me the
shelf-two access times” outside the lexical recognizer. It also found that the
target builder treated requested value types such as `names` and `times` as
subject terms, so a response supplying Dario and 12:02 could remain falsely
overdue. These are recorded in the
[living research log](./2026-08-09_living-research-log.md) and the
[baseline comparison design](./baseline-comparison-design.md). They are
coverage requirements for V3, not new evidence and not cases that may be used
to pass its fresh gate.

V3 therefore inserts a constrained semantic-event boundary between public
language and the existing deterministic DAG machinery:

```text
public learner turn
  -> existing learner-analysis call emits candidate semantic events
  -> deterministic schema and public-evidence validator
  -> accepted events or explicit uncertainty
  -> typed obligation, action-contract, completion, divergence, and warrant reducers
  -> deterministic live/offline decision and delivery checks
```

The ledger, reducers, policy map, live gate, replay, and delivery authority
remain deterministic. V3 changes the observation function feeding them. It is
not an in-place repair of V2.

## 2. Semantic-event contract

### 2.1 Envelope and multiplicity

The learner-analysis result must contain one
`machinespirits.adaptation-refinement.semantic-event-extraction.v1` envelope.
An utterance may contain zero, one, or several ordered events. Compound speech
is not collapsed to a single primary label: “I would compare the dies; what
does the comparison show?” contains both a proposed action and a result
request. Precedence is applied later by deterministic policy, never by deleting
one of the events.

The conceptual envelope is:

```json
{
  "schema": "machinespirits.adaptation-refinement.semantic-event-extraction.v1",
  "source_turn": 4,
  "source_text_sha256": "...",
  "events": [
    {
      "event_id": "turn-004-event-01",
      "speaker": "learner",
      "speech_act": "tutor_directed_public_result_request",
      "target": {
        "kind": "record_entry",
        "subject": "shelf-two access record",
        "public_identifiers": ["shelf-two"],
        "requested_value_types": ["time"],
        "required_components": ["access_time"]
      },
      "requested_or_proposed_action": {
        "mode": "requested",
        "actor": "tutor",
        "action": "supply_public_result",
        "object": "shelf-two access times"
      },
      "evidence_span": {
        "text": "show me the shelf-two access times",
        "start": 0,
        "end": 34
      },
      "confidence": "high",
      "uncertainty": []
    }
  ],
  "extraction_status": "accepted"
}
```

Offsets use JavaScript UTF-16 string indices and an exclusive `end`. The
example offsets above are illustrative; implementation tests must compute and
verify the exact saved offsets rather than copying them from this document.

### 2.2 Required event fields

Every candidate event has these required fields:

| Field | Contract |
|---|---|
| `speaker` | `learner` or `tutor`. V3 runtime extraction is seated on the current learner-analysis call, so current-turn events must say `learner`. The wider enum prevents an implicit speaker assumption in saved artifacts and permits later symmetric use without a schema rewrite. |
| `speech_act` | One declared act from the closed V3 vocabulary. Unknown acts use `other`; they are never invented as near-synonyms. |
| `target` | A public target object or `null`. It separates the object under discussion from the values requested about that object. |
| `requested_or_proposed_action` | A typed action object or `null`, distinguishing who is being asked to act from who proposed the action. |
| `evidence_span` | Exact literal text plus verified start/end offsets into the current public utterance. Paraphrases and inferred spans are invalid. |
| `confidence` | `high`, `medium`, or `low`. This is a bounded self-report, not a calibrated probability. |
| `uncertainty` | A possibly empty list from the closed reasons below. Any non-empty list prevents asserted state mutation. |

The initial speech-act vocabulary is:

- `tutor_directed_public_result_request`;
- `learner_proposed_test`;
- `criterion_question`;
- `tutor_selection_request`;
- `learner_record_entry_request`;
- `learner_wording_request`;
- `withdrawal`;
- `transfer_to_learner`;
- `repair_request`;
- `stall`;
- `register_complaint`;
- `repetition_complaint`;
- `low_agency_deferral`;
- `analytic_contribution`;
- `other`.

This vocabulary unifies the two V2 lexical surfaces that separately inferred
public obligations and engagement signals. It does not merge their downstream
normative consequences.

### 2.3 Target and action identity

`target.subject` names the public object or relation whose result is owed.
`target.requested_value_types` names the fields requested from it. Value types
include `name`, `time`, `date`, `weight`, `sound`, `material`, `match_status`,
`record_text`, and `other`. A value type must never become a subject term merely
because its surface token is a noun.

For “show me the shelf-two access times”, the required paper result is:

- speaker: learner;
- speech act: `tutor_directed_public_result_request`;
- target subject: the shelf-two access record, with `shelf-two` retained as a
  public identifier;
- requested value type: `time`;
- action: learner requests the tutor to supply a public result;
- evidence span: the exact request text;
- consequence after validation: create or remind tutor-owned public-result
  debt.

For a later public response giving “Dario” and “12:02”, `name` and `time` are
answer value types. They are not extra target subjects that must recur in the
response as the words “names” and “times”. The deterministic delivery audit
must check the structured target, requested components, released public
evidence, and literal delivered answer. It must accept a supplied name and
time without demanding those category nouns, while continuing to reject an
answer about a different shelf, person, or record.

The action object uses three independent fields:

- `mode`: `requested`, `proposed`, or `none`;
- `actor`: `learner`, `tutor`, `joint`, `unspecified`, or `none`;
- `action`: one closed operation such as `supply_public_result`,
  `perform_public_test`, `select_next_step`, `record_public_claim`,
  `explain_wording`, `withdraw_request`, or `none`.

Thus “I will check the shelf-two access record” and “show me the shelf-two
access times” may share a target while producing different actors, modes,
actions, and obligation consequences.

### 2.4 Evidence and public-only validation

The deterministic validator must establish all of the following before an
event is accepted:

1. the source hash matches the exact current public learner utterance;
2. the evidence span text equals the indexed substring;
3. all public identifiers occur in the current public transcript or the
   public decision-time world frame;
4. the action actor/mode combination is legal;
5. target subject and requested value types occupy different fields;
6. no target, identifier, answer, future clue, secret, or technical trace is
   introduced from outside the public decision-time payload;
7. `confidence=high` and `uncertainty=[]` for an asserted event.

Regex and exact matching remain permitted for span equality, identifiers,
schema syntax, provenance, and conservative compatibility fallback. They do
not independently promote an uncertain semantic act to an asserted request,
proposal, agency state, or analytic state.

### 2.5 Uncertain fallback

The extractor must use an uncertainty reason rather than guess when two
material readings remain plausible. The initial reasons are
`ambiguous_speech_act`, `ambiguous_actor`, `ambiguous_target`,
`ambiguous_value_type`, `referent_not_public`, `span_not_literal`, and
`insufficient_context`.

An event is uncertain when confidence is `medium` or `low`, uncertainty is
non-empty, or deterministic validation cannot establish the public referent.
The fallback is deliberately conservative:

- it creates no new obligation and resolves no existing obligation;
- it does not mark a proposed test, analytic engagement, low agency, repair
  request, or stall as present;
- it does not erase or reset an existing obligation, action contract, or
  completion blocker;
- it records the candidate event, uncertainty reasons, validation failures,
  and evidence span in the trace;
- downstream policy may still act on independently established prior typed
  state, including an already-open obligation or a closure safety veto;
- model abstention counts as an extraction miss when readers reach a hard
  non-uncertain consensus. It is never removed from the denominator to improve
  apparent accuracy.

This fallback protects the DAG from an unsupported semantic mutation while
making excessive abstention visible through recall and coverage gates.

### 2.6 Deterministic event-to-engagement compilation

The warrant consumes one stable turn signal with an ordered `labels` list,
one `primary` label, and explicit `deference_present` and
`engaged_analytic_present` booleans. V3 derives that signal only from accepted
semantic events. The compiler may inspect event fields and ordering; it may
not inspect the learner text, run a regex, or infer a new speech act from
tokens.

Accepted events contribute engagement labels as follows:

| Accepted semantic event | Engagement contribution |
|---|---|
| `repair_request` | `repair_request` |
| `stall` | `stall` |
| `register_complaint` | `register_complaint` |
| `repetition_complaint` | `repetition_complaint` |
| `low_agency_deferral` | `low_agency_deferral`; set `deference_present=true` |
| `tutor_selection_request` with `mode=requested`, `actor=tutor`, and `action=select_next_step` | `low_agency_deferral`; set `deference_present=true` |
| `analytic_contribution` | `engaged_analytic`; set `engaged_analytic_present=true` |
| `learner_proposed_test` or `criterion_question` | `engaged_analytic`; set `engaged_analytic_present=true` |
| every other accepted event | no engagement contribution |

Repeated contributions deduplicate to one label and do not increase a
counter. `deference_present` is the input to the existing cross-turn sustained
deference check even when a higher-priority immediate label becomes primary.
An uncertain or rejected event contributes no engagement label.

The compiler orders distinct contributed labels by this fixed precedence:

1. `repair_request`;
2. `stall`;
3. `register_complaint`;
4. `repetition_complaint`;
5. `low_agency_deferral`;
6. `engaged_analytic`;
7. `neutral` when no accepted event contributed another label.

`primary` is the first label in that order. Within one label, evidence
provenance uses the smallest evidence-span start offset; equal offsets use the
original event-list order and then `event_id`. These ties never change the
primary category.

Conflicting acts are retained when they occupy distinct literal spans. Thus
“Would you choose the first matter for me to examine?” may validly emit both a
`tutor_selection_request` and a `low_agency_deferral`; the compiler produces
one deduplicated `low_agency_deferral` label and
`deference_present=true`. If the extractor also emits an
`analytic_contribution`, analytic remains a secondary label and cannot mask
the deference primary. A repair request or stall remains primary over both,
while the deference boolean remains available for sustained history.

Two asserted events that assign incompatible actors or modes to the same
overlapping evidence span are not resolved by precedence. The validator marks
both `ambiguous_actor` or `ambiguous_speech_act`, so neither mutates engagement
state. This prevents the compiler from becoming a replacement semantic
classifier.

## 3. Extraction seat and failure behaviour

### 3.1 Reuse the existing learner-analysis call

V3 adds no model seat and no model call. The existing once-per-learner-turn
combined learner-analysis call already receives the bounded public transcript,
current learner utterance, classifier task, learner-DAG preflight, and public
decision-time constraints. Its versioned structured response will gain the
semantic-event envelope beside the existing learner-record and DAG outputs.

The deterministic harness remains the authority:

- the model proposes semantic events;
- the validator checks schema, spans, public referents, and legal typed
  combinations;
- only validated events reach the obligation, contract, completion,
  divergence, and warrant reducers;
- live and offline replay consume the same saved validated envelope and its
  content hash;
- replay never asks a model to reinterpret the utterance.

The learner-analysis prompt must not receive the private answer, future
evidence, private support plan, gate prediction, annotation key, or downstream
decision. Adding semantic extraction must not weaken the existing public-only
preflight or speaker-privilege audit.

### 3.2 Prompt and response size budget

The semantic-event task stays inside the existing learner-analysis envelope;
it does not receive an additive budget. The final dispatched prompt, including
the semantic vocabulary, instructions, public context, output schema, and
provider wrapper, must remain at or below both existing limits:

- 42,000 UTF-16 characters; and
- 10,500 approximate tokens under the shared prompt audit.

The build must record total prompt characters, approximate tokens, and the
semantic-task delta relative to the same fixture without the V3 block. Before
a model-backed freeze, a worst-case eight-turn fixture for each V3 world and
prompt profile must pass both limits. During the study, all 192 dispatched
learner-analysis prompts must pass and preserve their prompt-audit records.
Compaction may remove duplicate wording or whitespace but may not omit the
event vocabulary, uncertainty rules, public evidence, or current learner
utterance.

The combined learner-analysis response retains the existing 2,500-token
generation ceiling. Within it, V3 additionally limits the semantic envelope
to:

- at most four ordered events;
- at most 4,096 UTF-8 bytes after canonical JSON serialization;
- at most 240 characters in any evidence span;
- at most six public identifiers, four requested value types, four required
  components, and three uncertainty reasons per event.

The full raw structured learner-analysis response must be no more than 12,000
UTF-8 bytes as well as no more than the provider's 2,500 generated-token
ceiling. Prompt and response sizes, semantic-envelope bytes, event count, and
configured limits must be persisted per turn. An oversize prompt fails before
dispatch. An oversize response or semantic envelope fails strict parsing and
uses only the existing bounded redispatch for the learner-analysis seat; it is
never truncated into a valid event.

### 3.3 When the existing call fails

The current bounded retry and fail-closed learner-analysis policy remains in
force. A missing or malformed semantic-event envelope makes that existing
learner-analysis response invalid; it may use only the already-authorized
bounded redispatch for that same seat. V3 does not launch a separate semantic
repair call.

If no accepted learner-analysis response is obtained within the existing
retry allowance:

- no semantic fallback model is called;
- the learner turn, DAG update, obligation event, and warrant decision do not
  commit;
- the child dialogue seals `evidence_invalid` rather than treating failure as
  the speech act `other` or as a negative decision;
- any study matrix containing that child is execution-invalid and cannot
  produce a gate-eligible corpus;
- resume may rerun only under the same frozen source, payload, model route,
  call ceiling, and authorization provenance. Otherwise a new freeze is
  required.

An event-level ambiguity expressed through a valid envelope follows the
uncertain fallback in section 2.5. A call-level failure never does.

## 4. Separate extraction scoring

### 4.1 Independent reader task

Semantic extraction has its own reader task and artifacts. It is not inferred
from the decision readers' warrant labels and is not scored by asking whether
the final decision happened to be correct.

Two isolated extraction readers receive, for every case:

- the public opening and public situation/question;
- the public transcript through the current learner utterance;
- public evidence available at that decision;
- the closed semantic-event vocabulary and target/action handbook;
- opaque case IDs and an exact output schema.

They do not receive the model extraction, validator output, obligation ledger,
warrant decision, condition identity, active-arm response, private key,
support-plan tags, later turns, technical trace, or the other reader's output.
Each reader returns the ordered semantic events, target subject, requested
value types, action mode/actor/action, literal evidence span, and whether the
utterance is genuinely ambiguous under the handbook. Reader confidence is not
used as a substitute for field agreement.

The reader response schema carries only the literal `evidence_span.text`, not
numeric offsets. The text must be non-empty, no longer than 240 characters,
and occur exactly once in the current learner utterance. Exact JavaScript
UTF-16 `start` and exclusive `end` offsets are then derived mechanically by the
assembler and listed case by case in its assembly audit. A missing, repeated,
or non-literal span fails assembly. This schema-declared derivation removes
LLM character-count arithmetic from the reader instrument; it does not relax
the live extractor contract in section 2, which still requires validated text
and offsets in the learner-analysis envelope.

Both extraction files must assemble with exact IDs, no missing or additional
fields, and no hand repair. Only schema-declared mechanical canonicalization
may occur, and every such change must be disclosed. The private prediction key
remains unread until both files are frozen and hashed.

Decision readers are a separate pair of isolated tasks. They receive the
existing decision-time handbook and label warrant, successor, obligation
lifecycle, completion, and six-axis divergence. They do not see the model
extraction or extraction-reader responses. The same model family may be used
for operational consistency, but separate contexts make this independent
blind replication, not cross-model validation.

### 4.2 Extraction consensus and metrics

Hard extraction consensus requires both readers to agree on event count and,
for the relevant event, speech act, action mode, action actor, action,
target-present status, target subject, requested value types, and ambiguity.
Span differences are scored separately and do not erase otherwise hard field
consensus. A reader disagreement or either reader marking genuine ambiguity is
reported as uncertain and excluded from field-gold scoring; it remains in raw
agreement and support reporting.

The extractor is scored against hard-consensus fields with:

- raw event-structure reader agreement;
- exact event-count accuracy;
- speech-act micro-F1 and macro-F1;
- result-request precision and recall;
- request-versus-proposal macro-F1;
- action mode/actor/action exact accuracy;
- target-present accuracy and target-kind accuracy;
- subject/value-type partition accuracy;
- requested-component exact-set accuracy;
- evidence-span exact match and token-overlap F1;
- asserted-event coverage and uncertain/abstention rate;
- proposed-test false-obligation rate.

Model uncertainty is treated as a prediction. On a hard-consensus
non-ambiguous reader case it is incorrect, not unscored. Reader-uncertain cases
are never used to tune a favorable threshold.

### 4.3 Conditional decision decomposition

The fresh V3 scorer emits three distinct results:

1. **Extraction:** model semantic events versus extraction-reader consensus.
2. **Conditional policy:** the deterministic reducer and policy replayed from
   the frozen consensus semantic events versus decision-reader consensus.
3. **End to end:** the live validated model events through the same reducer and
   policy versus decision-reader consensus.

Conditional replay is a localization instrument, not a replacement result. V3
passes only when extraction, conditional-policy, and end-to-end decision gates
all pass. If extraction fails but conditional policy passes, the observation
layer is at fault. If extraction passes but conditional and end-to-end
decisions fail, the typed policy is at fault. If conditional passes while end
to end fails, extraction or event-to-reducer compilation is at fault. No layer
may borrow another layer's score.

## 5. Predeclared V3 corpus split

### 5.1 Targeted rare-state diagnostic

The rare-state surface is a separately authored 24-case public decision-time
challenge with a private hash-bound support plan. It must cover result
requests, proposed tests, record-entry and tutor-selection boundaries,
subject/value-type separation, compound acts, obligation persistence and
resolution, inquiry completion and non-completion, and at least two intended
non-aligned cases for each divergence dimension.

Its paper coverage tests must include paraphrases of, but not be limited to:

- “show me the shelf-two access times” as a tutor-directed result request;
- the same target phrased as a learner-proposed check;
- `name` and `time` as requested value types rather than target subjects;
- a response that supplies a public name and time without repeating the
  category nouns;
- a request for what a log shows versus a request to record an already-public
  claim;
- an analytic contribution with an appended permission phrase versus a true
  low-agency deferral.

The exact V2 cases and responses remain burned historical evidence and must
not be copied into the fresh diagnostic or representative corpus. The
diagnostic may expose a defect and motivate a prospective repair. Any repair
burns that diagnostic relative to the repaired code and requires a new clean
freeze. Its enriched rows are always `gate_eligible: false`; they may not be
pooled into natural prevalence, accuracy, precision, recall, false-positive,
or divergence rates.

Reader-backed diagnostic support, rather than private construction tags, must
contain at least four result requests, four proposed tests, four target/value
partition cases, two record-entry requests, two tutor-selection requests, two
obligation persistence cases, two obligation resolution cases, two complete
and six incomplete inquiries, and two non-aligned cases per divergence
dimension. Failure is `insufficient_support`, not mechanism failure. The
representative freeze does not begin while the diagnostic reveals an
unresolved instrument or semantic-contract defect.

### 5.2 Representative natural-prevalence frame

The sole pass/fail corpus is a fresh unselected natural census generated after
the final diagnostic repair from one clean committed source:

- worlds: `world_022_foxtrot_jukebox` and
  `world_028_larkspur_fridge`;
- learner profiles: `diligent`, `low_agency`, `answer_seeking`,
  `counterexample_hunter`, `goalpost_shifter`, and `fast_learner`;
- conditions: `observe` and `active`;
- one fresh eight-turn dialogue per world/profile/condition cell;
- master seed: `503`;
- 24 dialogues and 192 decisions total;
- the corpus is every decision from all twelve observe dialogues: 96 cases,
  with no balancing, prediction filtering, replacement, or post-hoc selection;
- active decisions are reserved for matched execution, parity, and delivery
  verification and are not added to the reader denominator.

The freeze binds source commit, model routes, prompt hashes, world/profile
matrix, seed derivation, semantic schema, validator fingerprint, reducer
fingerprint, handbook hashes, reader schemas, thresholds, prior-corpus
exclusions, authorization payload, and call ceilings. Any drift burns the
freeze.

Natural absence of a rare state is reported as `not_evaluable` for that cell.
It does not fail the representative gate and cannot be filled with diagnostic
rows. In particular, V3 removes V2's requirement that five divergence
dimensions contain at least two naturally occurring non-aligned consensus
cases. Every naturally supported dimension is still held to the unchanged
quality thresholds below.

### 5.3 Mandatory brittleness preflight

Before a diagnostic or representative freeze may emit an authorization
request, a zero-call instrument preflight must pass against the exact reader
schemas, assembler, consensus builder, scorer, thresholds, and corpus builder
that the freeze will bind. The preflight is an execution prerequisite, not
research evidence. Its machine-readable report binds the source commit and
fingerprints of those surfaces; a missing, failed, stale, or mismatched report
blocks the freeze.

The preflight must establish both representation invariance and semantic
sensitivity. Equivalent mock responses may vary display prose, notes, JSON key
order, evidence-span extent, and the order of fields declared as sets without
changing semantic consensus or the gate verdict. Conversely, changing one
meaning-bearing speech act, actor, target ID, action ID, requested value type,
or component ID must be detected. The complete prepare, assemble, consensus,
and score path must also reject unknown catalogue entries, ambiguous identity,
non-literal evidence, malformed envelopes, and under-supported threshold
cells without hand repair.

Free text may support an evidence or display field, but it may not determine
identity, equality, joins, state mutation, or gate passage. Reader tasks may
not ask a model to calculate offsets, hashes, token counts, ordering keys, or
other deterministic arithmetic. Downstream semantic compilers consume typed
events rather than learner prose; regex remains limited to exact syntax,
identifiers, provenance checks, and explicitly conservative fallbacks.

After the zero-call preflight, at most one separately authorized two-call
smoke may use synthetic cases that are permanently excluded from every
diagnostic and gate corpus. It checks that the declared model route can return
the canonical-ID envelope without truncation, schema repair, arithmetic, or
hidden normalization. Any preflight or smoke defect is repaired prospectively
and rechecked before fresh cases are frozen.

## 6. Predeclared V3 thresholds

### 6.1 Execution prerequisites

Scoring is forbidden unless all of these hold:

- 24/24 valid child seals and 24 complete eight-turn dialogues;
- 192 accepted learner-analysis calls and zero learner-analysis failures;
- zero semantic schema, public-boundary, prompt-audit, leak, provenance, or
  run-seal failures;
- every dispatched learner-analysis prompt is at most 42,000 characters and
  10,500 approximate tokens, with a recorded V3 semantic-task size delta;
- every accepted learner-analysis response is at most 12,000 UTF-8 bytes and
  2,500 generated tokens, its canonical semantic envelope is at most 4,096
  UTF-8 bytes, and every declared event/span/cardinality limit passes;
- 192/192 exact structured live/offline comparisons with zero mismatch;
- 192/192 delivery-application comparisons with zero issue;
- exact source, digest, model-route, payload, corpus, key, and reader-artifact
  closure.

### 6.2 Extraction-layer gate on the 96 natural cases

All applicable checks must pass:

| Check | Threshold |
|---|---:|
| Raw event-structure reader agreement | at least 0.80 |
| Hard-consensus non-ambiguous cases | at least 72 of 96 |
| Exact event-count accuracy | at least 0.85 |
| Speech-act micro-F1 | at least 0.80 |
| Speech-act macro-F1 across naturally supported acts | at least 0.75 |
| Result-request precision | at least 0.90 |
| Result-request recall | at least 0.75 |
| Request/proposal macro-F1 | at least 0.80 |
| Action mode/actor/action exact accuracy | at least 0.80 |
| Target-present and target-kind accuracy | each at least 0.80 |
| Subject/value-type partition accuracy | at least 0.90 |
| Requested-component exact-set accuracy | at least 0.85 |
| Evidence-span token-overlap F1 | at least 0.90 |
| Evidence-span public-substring validity | exactly 1.00 |
| Abstention on hard-consensus non-ambiguous cases | at most 0.15 |
| False obligation on consensus proposed tests | at most 0.10 |

An act-specific metric is `not_evaluable`, not failed, when the natural corpus
contains no hard-consensus support for that act. Core request/proposal scoring
requires at least four consensus result requests and four consensus proposed
tests; if either minimum is absent, every request/proposal cell is declared
`inconclusive_support`, not passage. Diagnostic rows cannot fill it.

### 6.3 Decision-layer gate on the same 96 natural cases

V3 retains the V2 performance thresholds that do not require enriched rare
states:

| Check | Threshold |
|---|---:|
| Raw decision-reader agreement | at least 0.80 |
| Scored binary consensus | at least 12 cases, including at least 2 positive and 6 negative |
| Binary precision | at least 0.70 |
| Binary recall | at least 0.70 |
| Binary accuracy | at least 0.75 |
| Hard typed-mechanism consensus rate | at least 0.75 |
| Diligent false-positive rate | at most 0.25 when at least one diligent consensus negative exists |
| Live/offline agreement | exactly 1.00 |
| Structured parity mismatches | zero |
| Closure-safety violations | zero |

For transition, lifecycle, completion, basis, candidate override, and
divergence cells, the unchanged supported-cell quality thresholds are:

- transition accuracy at least 0.70 when at least two consensus transitions
  occur;
- obligation-lifecycle accuracy at least 0.80 when naturally supported;
- inquiry-completion precision at least 0.90 and recall at least 0.75 when both
  complete and incomplete consensus cases occur;
- commitment-transition, candidate-override, and primary-basis accuracy each
  at least 0.75 when naturally supported;
- for each divergence dimension with at least two non-aligned hard-consensus
  cases: reader consensus at least 0.75, interpretation macro-F1 at least
  0.70, magnitude accuracy at least 0.70, persistence accuracy at least 0.70,
  and joint accuracy at least 0.65.

Every naturally supported cell must pass. A rare cell without natural support
is reported `not_evaluable` and remains a limitation; it neither passes nor
fails and is never filled from the challenge. Both conditional-policy and
end-to-end decision reports use these thresholds, but only the end-to-end
report participates in V3 passage. Conditional failure still blocks passage
because it demonstrates a downstream policy defect even if an end-to-end
error happens to cancel it.

### 6.4 V3 verdict

`V3 mechanism supported` requires, conjunctively:

1. all execution prerequisites;
2. a supported diagnostic with no unresolved instrument defect, used only as
   a readiness check;
3. passage of every applicable extraction-layer check on the fresh natural
   corpus;
4. passage of conditional-policy and end-to-end decision checks on that same
   natural corpus; and
5. no source, reader, normalization, or scoring-provenance violation.

This verdict validates only the automated semantic observation and warrant
mechanism. It does not establish learning benefit, human validity, or policy
superiority. It only licenses a separately frozen variance-controlled outcome
study.

## 7. Call budget

V3 is bounded before execution:

| Activity | Planned calls | Hard ceiling |
|---|---:|---:|
| Representative 24-dialogue mechanism matrix | generated by the existing plan | 1,536 total model calls, no more than 64 per child |
| Added semantic-extraction seat | 0 | 0 |
| Rare diagnostic extraction readers: 24 cases, two readers, batches of 8 | 6 | 8 |
| Rare diagnostic decision readers: 24 cases, two readers, batches of 8 | 6 | 8 |
| Natural extraction readers: 96 cases, two readers, batches of 8 | 24 | 32 |
| Natural decision readers: 96 cases, two readers, batches of 8 | 24 | 32 |

The full reader programme therefore plans 60 calls with a hard ceiling of 80.
Together with the mechanism ceiling, the maximum V3 programme envelope is
1,616 model calls. Retries consume the applicable task ceiling. Calls may not
be moved between tasks after reader output is seen, and an incomplete task may
not be rescued by merging extraction and decision prompts.

The 1,536 mechanism ceiling includes the existing learner-analysis calls that
now return semantic events. It does not authorize a new extractor, semantic
repair, adjudicator, or tie-break model.

## 8. Stop rule and licensed next step

The sequence stops before the representative run if the diagnostic lacks
reader-backed support, reveals an unresolved semantic or reader-interface
defect, exceeds its call ceiling, or requires any hand repair. A principled
change burns that diagnostic and requires a new clean commit and freeze.

The representative sequence stops without scoring if any execution
prerequisite, seal, parity, delivery, prompt, leak, provenance, payload, or
call-budget check fails. It stops without private-key access if either reader
task fails exact assembly.

Once both natural reader pairs are frozen, the scorer runs once under the
hash-bound thresholds above:

- extraction failure stops V3 before policy tuning or outcome study;
- extraction passage with conditional-policy failure stops V3 at the typed
  policy layer;
- conditional passage with end-to-end failure stops V3 at extraction
  compilation or integration;
- any threshold change, prompt change, schema change, validator change, model
  route change, manual label edit, or mechanism repair after labels are read
  burns the corpus for subsequent code;
- the first representative verdict, pass or fail, ends this V3 validation
  cycle. Another repair requires a prospectively named successor design and a
  wholly fresh diagnostic and natural corpus.

Only a complete V3 pass licenses design of a downstream variance-controlled
outcome comparison. No outcome run, human-learning claim, retrospective V2
rescore, or pooling of natural and challenge rows is licensed by this document.

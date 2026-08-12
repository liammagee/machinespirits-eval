# V3 Semantic Extraction Design and Predeclared Gate

**Status:** V3 contract revision implemented prospectively; no valid V3 diagnostic labels exist

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
`machinespirits.adaptation-refinement.semantic-event-extraction.v3` envelope.
An utterance may contain zero, one, or several ordered events. The compound
licence is general, not a whitelist: each independent clause-level act that
would change a distinct typed state receives an event, unless it is merely the
grammatical complement of another event. Thus “I would compare the dies; what
does the comparison show?” contains both a proposed action and a result
request. Within one clause, the closed speech-act precedence in §2.3.2 selects
one act; deterministic engagement precedence is applied only after extraction.

The conceptual envelope is:

```json
{
  "schema": "machinespirits.adaptation-refinement.semantic-event-extraction.v3",
  "source_turn": 4,
  "source_text_sha256": "...",
  "events": [
    {
      "event_id": "turn-004-event-01",
      "speech_act": "tutor_directed_public_result_request",
      "target": {
        "kind": "record_entry",
        "target_id": "target-shelf-two-access-record",
        "public_identifier_ids": ["public-id-shelf-two"],
        "requested_value_types": ["time"],
        "component_ids": ["access_time"]
      },
      "requested_or_proposed_action": {
        "mode": "requested",
        "executor": "tutor",
        "action": "supply_public_result",
        "action_object_id": "target-shelf-two-access-record"
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

Every candidate event has these required fields. `speaker` is deliberately not
one of them: current-turn authorship already establishes it, so the harness
adds `speaker=learner` after parsing and before validation, replay, consensus,
or scoring.

| Field | Contract |
|---|---|
| `speech_act` | One declared act from the closed V3 vocabulary. Unknown acts use `other`; they are never invented as near-synonyms. |
| `target` | A public target object or explicit semantic absence. At the reader boundary this field is always a non-null tagged object: `{"state":"catalog", ...}` or exactly `{"state":"none"}`. The assembler alone normalizes the latter to internal `null`. It separates the object under discussion from values requested about it. |
| `requested_or_proposed_action` | A typed action object or explicit semantic absence. At the reader boundary this field is always a non-null tagged object: `{"state":"catalog", ...}` or exactly `{"state":"none"}`. The assembler alone normalizes the latter. |
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

`target.target_id` names the stable public object, relation, or enumerated
choice set whose result or selection is owed. A `tutor_selection_request`
requires the catalogue target naming the public choices; neither the requested
value nor the tutor becomes the target.
`target.requested_value_types` names the fields requested from it. Value types
include `name`, `time`, `date`, `weight`, `sound`, `material`, `match_status`,
`record_text`, and `other`. A value type must never become a subject term merely
because its surface token is a noun.

For “show me the shelf-two access times”, the required paper result is:

- speaker: learner;
- speech act: `tutor_directed_public_result_request`;
- target ID: `target-shelf-two-access-record`, with `public-id-shelf-two`
  retained as a public identifier ID;
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
- `executor`: `learner`, `tutor`, `joint`, `unspecified`, or `none`;
- `action`: one closed operation such as `supply_public_result`,
  `perform_public_test`, `select_next_step`, `record_public_claim`,
  `explain_wording`, `withdraw_request`, or `none`.

`speaker` and `executor` are different types. Speaker is mechanical turn
authorship and is never submitted to a reader. Executor is the reader judgment
about who must perform the action. A tutor-directed result, tutor-selection,
record-entry, wording, or repair request requires `executor != speaker`; in
this learner-turn instrument that means `tutor`, `joint`, or `unspecified` as
licensed by the act contract. A learner proposal uses `learner` or `joint`.
Withdrawal is not a request to the tutor and retains learner execution.

Thus “I will check the shelf-two access record” and “show me the shelf-two
access times” may share a target while producing different executors, modes,
actions, and obligation consequences.

### 2.3.1 Zero-call reader-field tabletop

Before the fourth diagnostic freeze, every reader-returned field was examined
with the question: can two correct readers follow the written contract and
still disagree? The resulting allocation is fixed below. The harness must not
ask a reader for a fact it already knows.

| Field or decision | Owner | Closed rule |
|---|---|---|
| Event multiplicity and order | Reader, then mechanical ordering | One event per independent clause-level act that changes a distinct typed state. One clause receives one act under the precedence table. Distinct events require non-overlapping minimal literal spans and are mechanically ordered by span start. |
| `speaker` | Harness | Current packet authorship supplies `learner`; absent from reader schema. |
| `speech_act` | Reader | One value from the closed vocabulary under the within-clause precedence table. No synonymous labels. |
| `target` / `target_id` | Reader | Total and non-null: the public object, relation, or enumerated choice set the act itself is about, chosen from the catalogue in the `state="catalog"` branch, or the exact sole-field object `{"state":"none"}` when that act names no catalogue entity. Requested values and actors are never targets. Tutor-selection requests require the public choice-set target. For `analytic_contribution`, ownership follows the analysis itself independently of any co-occurring request. |
| `target.kind` | Harness | Derived exactly from the selected `target_id`; absent from reader schema. |
| `public_identifier_ids` | Harness | Exact catalogue identifiers for `target_id`; absent from reader schema. |
| `requested_value_types` | Reader | Non-empty only for request-mode acts and only for closed-set values named by the event. Every proposal, question, analysis, withdrawal, and transfer uses an empty array. A value such as `time` or `match_status` is not a subject or target kind. Surface-to-ID fit is scored semantically; lexical word overlap is never a validity condition. |
| `component_ids` | Reader | Non-empty only for request-mode acts and only for catalogue components requested by the event. Every proposal, question, analysis, withdrawal, and transfer uses an empty array. Surface-to-ID fit is scored semantically; lexical word overlap is never a validity condition. |
| `executor` | Reader | The party who must perform the action, not the speaker. Request-type acts cannot use learner execution. |
| `requested_or_proposed_action` / `action_object_id` | Reader | Total and non-null: the public action object licensed by the clause, chosen from the catalogue in the `state="catalog"` branch, or the exact sole-field object `{"state":"none"}` when no action applies. |
| action `mode` and operation | Harness | Derived exactly from `action_object_id`; absent from reader schema and checked against the speech act. |
| `evidence_span` | Reader | At the reader transport boundary, one string containing the shortest complete literal clause. It must occur exactly once and not overlap another event span. This scalar representation keeps the canonical act-discriminated provider schema within its byte and depth budgets; it changes no reader judgment. |
| span offsets and event order | Harness | Derived from the unique literal span and audited; absent from reader schema. |
| `genuinely_ambiguous` | Reader | True only when two complete typed readings remain after every closed rule; then `events=[]`. |
| `ambiguity_reason` | Reader | Total closed value: `none` when not ambiguous, otherwise exactly one of `speech_act`, `executor`, `target`, `action_object`, `multiplicity`, `referent`, `span`, or `context`. |
| `assembly_rejection` | Harness | Added after reading. A non-unique literal span produces a typed case-level rejection rather than a batch crash. |
| `note` | Reader | Public rationale only; excluded from identity, consensus, joins, scores, and gates. |

Multiplicity is not limited to named families. Any separate clause stating an
inference, evidential limit, request, proposal, complaint, withdrawal,
transfer, or deferral receives its own event when it changes a distinct typed
state. A record-entry request receives a second `analytic_contribution` only
when a separate clause independently states an inference or evidential limit.
A tutor-selection request receives a second `low_agency_deferral` only when a
separate declarative clause says the learner cannot, refuses to, or leaves the
choice to the tutor. A proposal followed by a request for its result is two
events. One request for several values is one event with several value and
component IDs. One clause coordinating several catalogue targets receives one
event per target with the smallest non-overlapping identifier-bearing spans;
this is the sole waiver of the complete-clause span rule. Other overlapping
events are invalid rather than another way to express uncertainty.

Target ownership is event-local. The target of an `analytic_contribution`,
`withdrawal`, or `transfer_to_learner` is the catalogue entity that act itself
concerns, even when a neighbouring request names the same entity. It may use
`state="none"` only when its own clause names no catalogue entity. Each
co-occurring request retains and is judged on its own target. No reader-returned
property anywhere in the response envelope is optional or nullable: every
object property is required, categorical domains are closed, arrays are
present even when empty, and semantic absence is an explicit closed-domain
token.

### 2.3.2 Closed reader judgment rules

The remaining cold-reader boundaries are settled prospectively as follows:

1. A request whose tutor is the only other party uses executor `tutor`.
   `joint` requires explicit first-person-plural wording such as “we” or
   “let’s”; `unspecified` requires an explicit passive or impersonal form.
2. `tutor_selection_request` asks or directs the tutor to choose an enumerated
   next step. `low_agency_deferral` is a declarative inability, refusal, or
   handoff of agency. If one clause contains both delegation and inability
   language, tutor selection wins and no second event is emitted; a separate
   declarative deferral clause receives its own low-agency event.
3. `learner_wording_request` asks for restatement or word meaning;
   `repair_request` asks why an evidential or inferential relation holds or
   identifies a missing reasoning step.
4. `transfer_to_learner` relinquishes a previously tutor-owned public action
   to learner execution. `learner_proposed_test` introduces a new learner
   action. `withdrawal` cancels a matching prior request without transferring
   it.
5. `stall` states inability to continue or propose a check;
   `register_complaint` criticises tone or style;
   `repetition_complaint` says content was repeated;
   `analytic_contribution` states an inference or evidential limit; `other` is
   reserved for a distinct state-changing act fitting none of those rules.
6. Cross-turn anaphora resolves through the supplied public transcript to the
   most recently mentioned catalogue entity; an equal-recency tie uses
   `genuinely_ambiguous=true` and reason `referent`.
7. A first-person declarative need whose object is a public record is a result
   request with tutor execution; without a public-record object it is analytic.
8. A confirmation sayback is analytic when its content is already public and
   is a result request only when the content is not yet public.
9. A rhetorical question answered by the learner in the same turn creates no
   question event; annotate the answer clause. Conditional antecedents are not
   events. A negated or deferred request is a withdrawal only when a matching
   prior request exists; otherwise it creates no event.
10. Choose the most specific catalogue action object whose label content words
    all occur in the span; break an exact specificity tie lexicographically.
    Politeness is only a modifier: a clause with its own imperative or
    performative verb remains an act. Third-party reported speech is analytic;
    only a matrix-clause first-person commitment is a proposed test.

For span uniqueness, begin with the shortest complete supporting clause and
extend leftward by whole tokens until the literal is unique. If no unique span
exists, return typed ambiguity reason `span`; if a non-unique string still
reaches assembly, reject that case mechanically without invalidating its batch.

### 2.4 Evidence and public-only validation

The deterministic validator must establish all of the following before an
event is accepted:

1. the source hash matches the exact current public learner utterance;
2. the evidence span text equals the indexed substring;
3. all public identifiers occur in the current public transcript or the
   public decision-time world frame;
4. the action executor/mode combination is legal;
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
material readings remain plausible. The live-extraction reasons are
`ambiguous_speech_act`, `ambiguous_executor`, `ambiguous_target`,
`ambiguous_value_type`, `ambiguous_multiplicity`, `referent_not_public`,
`span_not_literal`, and `insufficient_context`. The independent-reader task
uses the corresponding total case-level reasons enumerated in §2.3.1.

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
| `tutor_selection_request` with `mode=requested`, `executor=tutor`, and `action=select_next_step` | `low_agency_deferral`; set `deference_present=true` |
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
“Choose the first public record for me. I cannot decide between the listed
records.” produces a `tutor_selection_request` for the first clause and a
`low_agency_deferral` for the second. The compiler produces one deduplicated
`low_agency_deferral` label and `deference_present=true`. The one-clause form
“Would you choose the first matter for me to examine?” produces only
`tutor_selection_request` under §2.3.2. If a separate clause also emits an
`analytic_contribution`, analytic remains a secondary label and cannot mask
the deference primary. A repair request or stall remains primary over both,
while the deference boolean remains available for sustained history.

Two asserted events over the same or overlapping evidence span are not
resolved by precedence. The validator marks both with
`ambiguous_multiplicity`, so neither mutates engagement state. Executor and
speech-act ambiguity are expressed on one uncertain event, never by emitting
competing overlapping events. This prevents the compiler from becoming a
replacement semantic classifier.

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
Each reader returns event multiplicity, speech act, target ID, requested value
types, component IDs, action executor, action-object ID, literal evidence span,
and whether the utterance is genuinely ambiguous under the handbook. The
harness supplies speaker; derives target kind and public identifiers from the
target ID; and derives action mode and operation from the action-object ID.
Reader confidence is not used as a substitute for field agreement.

The reader response schema carries only the literal `evidence_span.text`, not
numeric offsets. The text must be non-empty, no longer than 240 characters,
and occur exactly once in the current learner utterance. Exact JavaScript
UTF-16 `start` and exclusive `end` offsets are then derived mechanically by the
assembler, and events are ordered by those literal start positions with source
order as the equal-position tie. Both operations are listed case by case in
the assembly audit. A missing, repeated, or non-literal span fails assembly.
This schema-declared derivation removes LLM character-count and list-order
arithmetic from the reader instrument; it does not relax the live extractor
contract in section 2, which still requires validated text and offsets in the
learner-analysis envelope.

The frozen corpus also carries one public corpus-wide annotation catalogue of
`target_id`, `public_identifier_id`, `component_id`, and `action_object_id`
entries. Every entry keeps its stable ID separate from a reader-facing display
label. The catalogue contains the union of public candidates available across
all cases but no case mapping, construction stratum, expected event, or model
output. Readers return IDs only. This prevents synonymous reader prose from
destroying typed agreement while still requiring each reader to decide which
public referent and action applies in the case.

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
for the relevant event, speech act, action mode, action executor, action,
target-present status, target ID, requested value types, and ambiguity.
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
- action mode/executor/action exact accuracy;
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

### 5.0 Invalid instrument three: actor-contract failure

The third V3 diagnostic at clean commit `7df153d9` is preserved at
`/private/tmp/adaptive-warrant-v3-semantic-diagnostic-7df153d9` with status
`evidence_invalid`. It produced hard consensus on only 10/24 cases. The core
request/proposal support cells were present (4 result requests and 5 proposed
tests), but both independent readers assigned incompatible meanings to the
reader field then named `actor`: one treated it as the utterance speaker and
the other as the requested action performer. Record-entry requests reached
0/2 hard consensus and tutor-selection requests 1/2. Smaller disagreements
also exposed under-specified event multiplicity and target-kind selection,
including the V2 family in which a requested value type could be read as the
subject.

This is contract death three, not evidence about model capability, V3 semantic
accuracy, or warrant policy. Its cases, responses, and results are burned and
must not be copied into another diagnostic or gate corpus. No decision-reader
or outcome call followed it. The fourth instrument replaces reader-authored
`actor` with mechanical `speaker` plus reader-judged `executor`, removes every
other harness-known field from the reader response, and closes multiplicity
and target/value rules in the tabletop above.

### 5.0.1 Invalid pre-diagnostic smoke: contract/catalog inconsistency

The first post-repair two-call smoke at clean commit `93519217` is preserved at
`/private/tmp/adaptive-warrant-v3-semantic-smoke-run-93519217`. Both independent
readers completed all three fresh cases and returned the same semantic identity
for every case. Both correctly attached the public archive-choice target to the
tutor-selection request, but the production act contract still declared that
field forbidden. Assembly therefore failed before a smoke result could pass.

This is not reader disagreement, model-capability evidence, or the fourth
diagnostic. It is a zero-call-detectable contract/catalog inconsistency. The
repair makes the public choice-set target required for
`tutor_selection_request`; the burned smoke wording and identifiers cannot be
reused.

### 5.0.2 Invalid pre-diagnostic smoke: nullable analytic target

The next two-reader smoke at clean commit `b37b9faa` is preserved at
`/private/tmp/adaptive-warrant-v3-semantic-smoke-run-b37b9faa`. It completed
both calls and reached exact expected agreement on the tutor-selection and
compound proposal/result cases, but only 2/3 hard consensus overall. On the
record-entry pattern both readers agreed on the request and its target; one
reader also attached that catalogue entity to the preceding
`analytic_contribution`, while the other used a null target. The schema and
handbook had permitted both readings.

This is another instrument-contract result, not evidence about semantic-model
capability or warrant policy. The burned cases cannot be reused. The
prospective repair makes every reader property total and non-null, uses an
explicit tagged `state="none"` absence branch, and assigns analytic-target ownership to the
entity the analytic clause itself is about independently of a co-occurring
request. A schema-totality audit now owns the mechanically detectable part of
this failure class before a wholly fresh smoke.

### 5.0.3 Invalid pre-diagnostic launches: provider schema rejection

The next wholly fresh smoke at clean commit `fcd944f0` never produced a model
response. Two launch attempts are preserved at
`/private/tmp/adaptive-warrant-v3-semantic-smoke-run-fcd944f0` and
`/private/tmp/adaptive-warrant-v3-semantic-smoke-run-fcd944f0-retry1`; each
attempted one call, completed zero, and ended in a provider failed-turn event.
The response schema used JSON Schema `oneOf`, which the selected structured-
output transport does not accept. These attempts contain no semantic judgment,
reader agreement, or model-capability evidence, but their cases remain burned.

Prospectively the single canonical response schema uses `anyOf`. The zero-call
preflight proves this transport change meaning-preserving by requiring every
union branch to carry a distinct required singleton discriminator: `speech_act`
for event branches and `state` for catalogue/none branches. It also rejects
every schema keyword outside the declared provider-supported subset. No
separate strict/provider schema copy exists.

### 5.0.4 Invalid pre-diagnostic smoke: act-agnostic representability

The next smoke from clean commit `efcca5f0` completed its live reader calls but
failed assembly. Its schema allowed a target for every speech act while the
production validator enforced act-specific target rules. The delegating
tutor-selection clause also sat on an unwritten boundary with
`low_agency_deferral`, so a schema-valid response could not be represented
under the validator's stricter language. This is an instrument-contract result,
not semantic-model or policy evidence; all exposed smoke cases are burned and
no diagnostic followed.

The prospective repair uses one act-discriminated schema whose branches are
generated from the same exported contract table enforced by the runtime and
gold validators. A language-equivalence assertion checks all 15 acts. The
reader rule in §2.3.2 assigns a one-clause delegation to tutor selection and
reserves low-agency deferral for a separate declarative inability, refusal, or
handoff clause. The production-size eight-case schema must remain at or below
10 nesting levels and 10,500 serialized bytes.

### 5.0.5 Superseded smoke: lexical validator false positive

The fresh smoke from clean commit `4beccd8f` is preserved at
`/private/tmp/adaptive-warrant-v3-semantic-smoke-4beccd8f-run`. Both readers
selected the same `next_check` catalogue component for “Choose which
observatory chart I should inspect first”, but assembly rejected that shared
encoding because neither canonical ID word occurred literally in the span.
That rejection is a validator false positive: it recreates the lexical
observation layer that V3 is intended to measure. The omitted separate
low-agency deferral by one reader is a reader miss under the already-written
general multiplicity rule, not a contract ambiguity. The stop rule is not
triggered, but all exposed cases remain burned.

Prospectively the instrument gate is structural only: schema validity,
catalogue membership, unique literal evidence span, provenance, size, and no
prohibited tools. Word overlap between a surface and a canonical value or
component ID may be reported as scoring evidence but cannot reject an
encoding. Semantic correctness belongs to independent-reader consensus and
gold comparison.

The first structural-smoke attempt under this amendment, from commit
`65d45700`, is preserved at
`/private/tmp/adaptive-warrant-v3-semantic-smoke-65d45700-run`. Its reader
response was rejected because the hard validator inferred `joint` execution
from the word “our” even though the reader supplied a contract-compatible
typed executor. This is the same implementation defect class: a lexical
semantic judgment remained in the structural gate. It provides no evidence
about agreement or model capability, burns those fresh cases, and is repaired
within this already-approved prospective amendment by making surface-executor
comparison diagnostic-only.

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
meaning-bearing speech act, executor, target ID, action ID, requested value type,
or component ID must be detected. The complete prepare, assemble, consensus,
and score path must also reject unknown catalogue entries, ambiguous identity,
non-literal evidence, malformed envelopes, and under-supported threshold
cells without hand repair.

The exact generated eight-case reader schema files that launch would send are
also traversed as data before any live call; a smaller proxy does not satisfy
the preflight. The acceptance ping likewise uses eight synthetic cases. Every
object property must appear in its `required` set, no node may admit
JSON `null`, target and action absence must each be represented only by the
sole-field tagged object `{"state":"none"}`, and target, component, action-object, speech-act, executor,
and value-type identities must be closed to their declared catalogue or
vocabulary. The assertion runs against the synthetic preflight, smoke, and
diagnostic catalogues; one failure blocks the freeze.

The same traversal owns provider compatibility. It permits only the declared
structured-output keyword subset and requires every `anyOf` branch to be
pairwise disjoint through a distinct required singleton constant field. It
also requires nesting depth at most 10 and serialized response-schema size at
most 10,500 bytes. The prepare path enforces the same schema and 42,000-byte
packet limits, and the launch path re-audits the exact bound schema before its
first call. After
that static preflight and before either smoke or diagnostic readers, one
throwaway synthetic case sends the exact canonical response schema through the
same Luna transport. This schema-acceptance ping is capped at one call,
permanently excluded from all evidence, and hash-bound to the preflight and
source commit. A provider rejection before a model response burns no smoke or
diagnostic case; a passing ping is a required freeze and authorization binding.

It must also audit contract/catalog consistency before any live smoke. Every
speech act in the closed vocabulary must have a satisfiable catalogue,
catalogue-or-none, or none-valued field pattern against each catalogue that can be
frozen. For each act, the audit derives a catalogue-backed worked example,
materializes its mechanical fields, and sends it through the production
annotation validator. Missing action families, action objects bound to a
forbidden target, required targets absent from an action binding, illegal
executors, and vocabulary/contract inventory drift all fail the zero-call
preflight. The exact synthetic, smoke, and diagnostic catalogues are audited;
the live smoke is reserved for whether two fresh readers can read the valid
contract alike.

Each preflight uses a unique commit-prefixed temporary directory. It validates
the completed report before an atomic rename; a failed check exits nonzero and
cannot leave a passed-status artifact behind.

Free text may support an evidence or display field, but it may not determine
identity, equality, joins, state mutation, or gate passage. Reader tasks may
not ask a model to calculate offsets, hashes, token counts, ordering keys, or
other deterministic arithmetic. Downstream semantic compilers consume typed
events rather than learner prose; regex remains limited to exact syntax,
identifiers, provenance checks, and explicitly conservative fallbacks.

Tests must be strict about semantic behaviour and evidence integrity, but
invariant to harmless representational variation. No free-text field may
determine identity, consensus, joins, state mutation, or gate passage.

After the zero-call preflight, exactly two reader calls may use three synthetic
cases that are permanently excluded from every diagnostic and gate corpus.
Their fresh surface text must separately instantiate the three failure
patterns: a record-entry request beside an analytic clause, a tutor-selection
request beside an explicit choice deferral, and a proposal followed by a
result request. Neither wording nor case identity may reuse a burned case.

The smoke passes only when both calls complete without repair or prohibited
tools, both responses assemble using declared literal-span derivation and
ordering only, and every semantic disagreement is classified against the
preregistered closed contract identity. Hard consensus and exact expected
identity are reported as semantic observations, not structural checks. A
disagreement where one encoding violates the preregistered written rule is a
reader error and does not block; a disagreement for which neither encoding can
be excluded by that rule is a both-defensible contract ambiguity and blocks.
Merely returning schema-valid JSON is still insufficient because provenance,
literal-span uniqueness, normalization, and the disagreement classification
must all close.

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
| Action mode/executor/action exact accuracy | at least 0.80 |
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

The representative matrix has one preregistered mechanism-typing fallback.
If raw binary decision-reader agreement reaches `0.80` but full typed-mechanism
consensus remains below `0.75`, the typed mechanism-attribution layer is cut
from certified claims and its checks become advisory. The run is not iterated,
the instrument is not reopened, and diagnostic rows are not imported. Binary
decision correctness and the separately scored five-cell semantic-extraction
layer remain eligible to carry the later outcome study. Any attribution to the
`register_or_accumulated_trouble` basis family must retain an explicit
reliability caveat, because three of the four diagnostic binary disagreements
occurred in that family.

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
reader-backed support, reveals a transport, schema, provenance,
non-evaluability, or both-defensible contract-ambiguity defect, exceeds its
call ceiling, or requires any hand repair. Ordinary reader semantic misses are
recorded in the score and do not reopen the instrument. A principled change
burns that diagnostic and requires a new clean commit and freeze.

This is the final contract-refinement attempt in this V3 cycle. A diagnostic
support failure driven by a both-defensible contract ambiguity invokes the
preregistered scope cut: there is no fifth refinement and no new all-field
diagnostic. A support failure driven by reader misses is a substantive result
about the reader model under the declared contract and is handled in scoring
and thresholds, not by rewriting reader instructions. Any later outcome study
must be prospectively scoped to fields and derived policy cells with proven
hard consensus; unvalidated fields cannot support a mechanism claim.

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

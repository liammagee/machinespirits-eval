# V53 zero-call close-out diagnosis

Date: 2026-07-17  
Status: fold close-out documentation only — model-free re-audit and contract diagnosis of the three saved V53 rejected candidates  
Campaign: `first-draft-working-screens-v14`  
Model calls: 0  
Re-audit HEAD: `a7f52abe` (audit services and world configs byte-identical to frozen runtime `dbc45b25` and predeclaration `ab07c57b`; `git diff` empty over `services/`, `tutor-core/`, `config/drama-derivation/`)

This note executes the V53 note's sanctioned next step ("model-free re-audit and
contract diagnosis on the three saved candidates before any new model draw")
under the fold decision (`PLAN_4_0/2026-07-17-continue-or-fold.md`; retroactive
card `workplan/items/tutor-stub-first-draft-series.md`). It reclassifies
nothing, changes no gate, widens no recognizer, and authorizes no draw. All
counterfactuals below were applied to scratch copies of candidate text only, to
localize the failing conjunct; no repo code or artifact was modified.

## Candidates located and provenance verified

All three rejected candidates (and the four accepted Tallow controls) are in
the campaign artifact root declared by the V14 config:

- `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v14/iteration-1/ravensmark_affective_resistant/turn-6.json` — candidate SHA-256 `826dc9f56abeb08d2e3af0cba13d4d301ad6029cd1c771bccaccbce5c277af82`
- `.../iteration-1/skyway_answer_seeking/turn-3.json` — candidate SHA-256 `8b2ae670416b26d72c1014adc8ab8e4a70dc1d2e65ad2ebb0d64ebc0b20d71ab`
- `.../iteration-1/foxtrot_diligent/turn-5.json` — candidate SHA-256 `2197f7c11797813e956a4d09236429e441fa3b26b34bf69f67dd4301257ec0f3`

The four iteration-1 artifacts hash exactly to the V53 note's recorded values
(working result `799085c2…`, campaign validation `05d1ae06…`, preflight
`53fc404e…`, qualitative review `e6eb249d…`).

## Model-free re-audit: 7/7 verdicts reproduce

A scratch harness replicated the runner's `auditOriginalCandidate` path
verbatim (parse → compose → `auditTutorStubFrozenCandidate` →
`applyTutorStubJointPerformanceOwnershipAudit`, same option threading as
`scripts/replay-tutor-stub-frozen-turns.js`) from each saved bundle. Result:
recomposition is byte-identical to every saved candidate, and all seven
verdicts reproduce exactly — three rejections with identical hard clusters,
four Tallow acceptances with zero clusters, zero safety failures. There is no
V33-style intra-run audit disagreement in V53: the recorded rejections are
deterministic, stable at HEAD, and correctly reported. Nothing here reopens
the campaign verdict.

## Where each rejection binds

**Skyway (`turnProgressionAudit:learner_uptake_not_realized:uptake`).** The
learner's writable request ("What should I write next about the bolted frost
shutter?") puts the contract in `writable_entry` mode, whose recognizer is
`/^Write:\s*[“"]/` AND material linkage
(`services/tutorStubTurnProgressionContract.js`). The saved uptake — `Write:
The shutter stayed bolted, yet cold loaves arrived; unbolting cannot cause
them.` — is in the correct owner, materially linked (matched `bolt`,
`shutter`), licensed in polarity, and begins exactly `Write:`. The sole
failing conjunct is the missing opening quotation mark. Counterfactual: adding
the two quote marks flips the whole cell audit to ok with zero hard clusters.
The prompt never states the quoted form: Tallow's prompt supplies the exact
minutes sentence pre-quoted (all 4 accepted draws inherited quotes by
transcription); Skyway's prompt supplies only an abstract schema to compose
from.

**Foxtrot (`jointPerformanceAudit:axis_not_realized_in_owner:action_family`).**
The handoff owner must realize `close_inquiry`, recognized as zero questions
AND `/\b(closed|settled|conclude|therefore)\b/`
(`services/tutorStubResponseConfiguration.js`). The saved handoff — "I close
the inquiry: Moth's signed pulse links Moth's access to the wipe, so Moth
wiped the mess-hall jukebox's music core." — is the instruction's own phrase
("State the licensed public finding and close the inquiry") executed
performatively; the lexicon lacks present-tense "close" and connective "so".
This is a pure lexicon miss, not an owner-boundary miss: the whole-response
configuration audit also reports the action invisible. Counterfactuals: ", so"
→ "; therefore" alone → full pass; "I close the inquiry:" → "The inquiry is
closed:" alone → full pass. The foreperson part itself passed in performance
(via "finding" in the entry).

**Ravensmark (two clusters).** (a)
`response_composition:verbatim_learner_echo` is a genuine generation defect:
the uptake copies the learner's sentence nearly wholesale (echo detector:
learner-token coverage ≥ 0.85 with ≤ 4 added tokens; both hold), where the
owner obligation was credit/development. (b)
`jointPerformanceAudit:axis_not_realized_in_owner:actorial_part` is the V33
owner-local recognition class: the whole-response audit reports the foreperson
VISIBLE (via "The public finding is entered … this inquiry is closed" — in
handoff), but the performance owner's spans fail the part lexicon because
`close the (case|record|book|log|ledger|inquiry)` requires bare-noun adjacency
and the entry says "I close the **warrant book**" — the world's own
`ledger_term`, which the entry instruction itself steered toward ("close the
record. Use an already-named object; add no prop"). Counterfactuals: dropping
"warrant" clears (b) only; rewording the uptake clears (a) only; both → full
pass. Note the Foxtrot mirror: the two foreperson/close_inquiry cells
distributed the same close-out oppositely (Ravensmark: act in performance,
finding+"closed" in handoff; Foxtrot: finding in performance, performative
closure in handoff) and each failed exactly the owner its distribution left
lexically uncovered while passing the axis the other failed.

## One cause or three: verdict

**Neither one nor three. Four instance defects reduce to two causes.**

(A) **One shared structural cause accounts for three defects spanning all
three cells** (Skyway-uptake, Foxtrot-action, Ravensmark-part): acceptance is
decided by owner-local, closed surface-form lexicons, while the compiled
prompt states the same obligations abstractly — or in phrases the lexicons do
not contain. Only the Tallow home cell had the gap bridged, and by dictation,
not generalization: its prompt verbatim-supplies the uptake sentence and both
performance sentences and templates the handoff onto the recognizer's own verb
list ("Begin HANDOFF with 'Next,' or 'Now,' … test, check, compare, or
trace"), which is what the entire V37→V52 repair chain compiled (V14
`change_control`: all advocate-entry items). Under generalization the model's
instruction-faithful surfaces missed the lexicons at single-token margins —
one punctuation mark, one connective/verb form, one intervening world-noun —
and each counterfactual single-token edit flips its cell to a full pass. This
is V51's result (semantics pass, form fails at token grain) recurring at three
new sites, and V33's owner-local recognition gap recurring at one of them.

The specific hypothesis to test — slot-ownership allocation interacting with
world dramaturgy so natural discourse order misaligns with owner boundaries —
is supported only at Ravensmark, and only partially: its cross-slot
distribution is real (finding declaration in handoff, part owner =
performance), but its performance slot DID contain a foreperson act that the
lexicon failed to parse through the world's compound ledger noun. Skyway and
Foxtrot put the required content in the correct owners. The general mechanism
is intra-slot surface-lexicon brittleness under world/part variation, one
level below discourse order.

(B) **One independent genuine generation defect**: Ravensmark's verbatim
learner echo. It is not a recognizer artifact, and it alone would have
terminated its cell (0/1 against a 4/4 gate) regardless of (A). The V53
note's "not one repeated stochastic miss" reading survives: the three cells
fail at three different owners; but the deeper accounting is one form-class
plus one content defect, not three unrelated causes.

## Close-out boundary

This is fold close-out documentation. The V53 campaign remains terminal failed
development evidence; no rejected candidate is reclassified; no gate,
recognizer, lexicon, or prompt is changed by this note; no seed is
resurrected; no held-out or development draw is authorized. The counterfactual
passes above are candidate-text edits made to localize failing conjuncts —
they are not evidence that V53 "would have passed" (Ravensmark's echo stands
on its own, and every failed cell stopped at draw 1 of a 4/4 gate, so draw-1
counterfactuals say nothing about 4/4).

## Input to any future sanction

Any restart must first adjudicate the status of owner-local surface lexicons,
because the program's two precedents conflict at exactly this point: V33
treated an owner-local recognition gap as an audit-recognition correction
(canonical fixture, both audits consuming one realization result), while V51
refused lexicon widening as the brittleness the workflow exists to avoid. If
the lexicons stand, generalization means compiling exact surfaces per world ×
part × action — the V52 pattern, which is hand-authoring the tutor, as the
fold memo already concludes. If they are generalized (parameterize the
foreperson closure object on the world's `ledger_term`; accept performative
present-tense closure; state or drop the quoted-`Write:` form), that is
contract surgery requiring fresh predeclaration plus V33-style regression
fixtures, adjudicated case-by-case as recognition-correction versus
gate-loosening — not a quiet fix. The one V53 defect no recognizer decision
can absorb is the echo: uptake echo-resistance under close-out allocations is
the only genuine generation target this diagnosis adds. Prompt-recognizer
consistency should be a preflight gate in any successor: two of the three
rejections bind on surfaces the prompt itself steered the model toward
("close the inquiry"; "use an already-named object").

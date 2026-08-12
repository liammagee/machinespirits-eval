# 027 — Direction: compare against the schema-shaped template; one more retry; then matrix

**Date:** 12 August 2026
**Answers:** report 026 (`a828606f`): retry ping failed on a missing
value at `$.semantic_events.extraction_status`; raw and parsed
responses retained. Unattended budget spent: 2 of 4,000.

## Ruling

Ping-harness template defect, timebox class. The retained evidence
settles it:

1. The enforced response schema (`response.schema.json`, built with
   semantic events included) defines `semantic_events` with
   `additionalProperties: false` and the single property `events`.
   The model CANNOT return `extraction_status`, `schema`,
   `source_turn`, or `source_text_sha256` — structured output forbids
   them.
2. Those four fields are harness-derived envelope fields, added after
   validation (`services/adaptiveWarrantSemanticEvents.js:600`); the
   live prompt itself says the harness supplies the envelope status.
3. The synthetic template embeds them anyway, so the comparison
   expects a value the schema makes unreturnable. The model's
   `{"events":[]}` was the maximal correct copy.

The model passed. The template lives outside its own schema. No
semantic contract, rubric, or matrix datum is touched.

## Authorized now

1. **Template projection:** the value the ping compares against must
   be the provider-schema view of the template — for
   `semantic_events`, exactly `{"events": []}`. Either project the
   template through the enforced schema mechanically or amend the
   synthetic constant; the packet sent to the model and the expected
   value must be the same schema-shaped object.
2. **Closure test (zero calls):** add a focused test and a preflight
   assertion that the synthetic response template VALIDATES against
   the enforced response schema, walking nested objects, so any future
   template/schema drift fails before a call is spent. Keep the
   025 tests (retention, canonical-value comparison) unchanged.
3. **One more retry ping (1 call; running total 3 of 4,000).**
   - Pass: LAUNCH the representative matrix at seed 506 under
     direction 022's terms — no stop.
   - Fail: STOP with the retained diff. Three ping failures of three
     distinct causes would then be on record and the reviewer rules
     next; do not spend another call.

## Note for the record

The three ping failures were byte-identity (024), then a template
carrying harness-derived fields (026); each fix narrowed the check to
what the transport can prove. The closure test in item 2 removes this
class: from now on the template must fit the schema at preflight,
with zero calls.

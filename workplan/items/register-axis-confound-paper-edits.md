---
id: register-axis-confound-paper-edits
title: Say which "registers" are tones and which are arguments, in the paper
status: done
type: paper
priority: P3
owner: claude
source: manual
created: 2026-08-08
updated: 2026-08-08
verification: §6.7 states, where the register list is introduced, that its entries span argumentative demands, tones and delivery styles; and the judge-repair sentence marks 68.1 as coming from a different rubric than the three negative arms. No figure moves.
claim_status: exploratory
links:
  paper:
    - docs/research/paper-full-2.0.md#67-architectural-extension-the-id-director-family-and-charismatic-pedagogy
  items:
    - stance-payload-comparability
    - sarcasm-mood-floor-replication
---

## Why

A 2026-07-07 audit found `config/engagement-registers.yaml` mixing three kinds
of thing in one eleven-entry list: argumentative demands
(`transfer_grounding`, `scaffolding`), tones (`charismatic_challenge`,
`witnessing_restraint`, the three negative arms), and delivery styles
(`plain_compression`, `lived_stakes_reentry`). The design note's own rule says
moves and registers stay separate; the list broke it inside itself.

The recorded verdicts survive. The load-bearing contrasts were either
within-kind or already scoped as bundles: the four negative arms share a
trigger and mandate the same argumentative payload, so tone was the only
designed difference, and the §6.13.19 stance router holds its style palette
constant. What was missing was the caveat in the prose.

The audit was held pending another agent's v2 rework. That arc has since
concluded and gone further — the registry is at `register_ontology_version: 5`
and merged — so the hold is released.

## What changed

Paper only. v3.0.273. No run, no re-judging, no row rewritten, **no figure
moves**; the change is entirely in what the existing numbers are said to
license.

1. **§6.7, where the register list is introduced.** States the mixing, warns
   that a difference between two entries is not in general a difference of
   tone, and repeats that cell 193's advantage is a bundle — tone plus a
   mandated curriculum move plus a per-signal resistance strategy — whose
   causal weight the arc's own evidence puts on the argumentative half. Never
   to be glossed as charismatic tone breaking resistance. The same note
   records that the runtime split the axes structurally (engagement stance,
   request type, action family, audience register, lexical accessibility,
   scene immersion, each chosen independently), that the paper keeps the older
   word because it is what the runs recorded, and that "register" carries two
   further senses here — the sociolinguistic one in the same section, and the
   §6.13.19 stance router, a different mechanism with a different verdict.

2. **The judge-repair sentence.** It set `ironic_challenge` 83.8,
   `sarcastic_challenge` 79.6, `face_threat_challenge` 76.0 and
   `charismatic_challenge` 68.1 in one parenthesis as an ordered list. The
   first three come from the irony-sarcasm rubric; the fourth comes from the
   charisma rubric, because `charismatic` names no rubric of its own. 68.1 is
   now marked as a reference point on a different instrument, and only the
   ordering among the negative arms is presented as a comparison.

## Not done, and why

The audit proposed an `axis:` metadata field per registry entry. Dropped as
superseded: ontology v5 splits the axes into independently selected
dimensions, which is the same fix done properly. The payload-equivalence check
the audit also asked for shipped at v3.0.271
(`services/stancePayloadComparability.js`), which prints both the payload
asymmetry and the two-instrument fact beside every cross-stance table; this
card only carries those facts into the prose.

# V29 first-draft working screen: deterministic preflight failure

Date: 2026-07-17  
Status: failed before any tutor-model call  
Campaign: `first-draft-working-screens-v9`  
Frozen HEAD: `bfa0b4857a229ddab6a6ba733ba214850c23468b`

V29 compiled cleanly and its structural campaign validation passed with no
blockers. Development iteration 1 then stopped in the hard Tallow cell's
model-free preflight. The saved Skyway/answer-seeking corpus re-audited 14
candidates and found one deterministic fallback that had been accepted in its
source trace but is now correctly rejected by the hard
`response_composition:verbatim_learner_echo` gate. There were zero safety
failures, zero generated candidates, and zero model calls.

The rejected saved fallback begins with an exact `Write:` repetition of the
learner's requested entry. This is not a reason to loosen the audit. A clean
V28 checkout produces the same model-free result, so the failure predates
V29's source-accessibility compensation. V30 should repair the ordinary
deterministic fallback so it satisfies the typed learner-uptake and terminal
handoff contract, while preserving the stricter audit.

The run also exposed a campaign-runner evidence gap: a nonzero deterministic
preflight command preserved the campaign validation artifact but did not write
the usual `working-screen-result.json`. V30 should serialize that terminal
preflight state explicitly, including the failed command and zero-call seed
dispositions.

## Preserved evidence

- Campaign validation: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v9/iteration-1/campaign-validation.json`
  - SHA-256: `5380f46ce14329222268ee48856f353717e20ecd51947bccab6e8fabd5e55c9c`
- Model-free Skyway audit: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v9/iteration-1/model-free-skyway-audit.json`
  - SHA-256: `361dd6c0579492f411a18ad49ca975fc6a096b576213f0fe3710f84d54e464b5`
- Frozen campaign config: `config/tutor-stub-campaigns/first-draft-working-screens-v9.yaml`
  - SHA-256: `06d0c19ac59eaaabcdf2d5e4cba3c46d3e1fa49d28a485f7c41ced782f7ff7c9`

All V29 development labels are retired unconsumed:

- `20261900` — Tallow / answer-seeking
- `20261901` — Ravensmark / affective-resistant
- `20261902` — Larkspur / premature-closure
- `20261903` — Foxtrot / diligent

V29 therefore provides deterministic diagnostic evidence only. It is neither
a working-screen pass nor held-out acceptance evidence.

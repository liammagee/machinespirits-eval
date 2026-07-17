# V28 first-draft structural screen: zero-call preflight failure

Date: 2026-07-17

V28 was a valid, clean, committed development predeclaration, but it did not
admit any model call. The deterministic structural preflight found exactly one
blocker: the Ravensmark turn-5 SOURCE is a 36-word sentence, while both the
selected audience and lexical-accessibility budgets are 23 words. Tallow,
Larkspur, and Foxtrot had no structural preflight blocker.

This is a development failure, not a safety or generation result. All four
V28 seeds remain unconsumed and are retired when the loop advances to V29.
No original, repair, model rewrite, fallback, semantic-adjudication, or final
delivery event occurred.

## Clean committed run

- Git HEAD: `223984b981d8413fc9409cd31c2ccf8739889314`
- Campaign config SHA-256: `ce299510188de85ca8e9820863654d8954cf20130a24d432cc0ba9e5bea016b2`
- Validation artifact: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v8/iteration-1/campaign-validation.json`
- Validation SHA-256: `cb41c1f8f6c5babb26c26668bc92fd8f867da6892178f0860b91487aebfa2058`
- Result artifact: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v8/iteration-1/working-screen-result.json`
- Result SHA-256: `f6394fc4462f1577a0d9b47d232cd2992c5f39551edd9aedc6d494d1a1bbf65d`
- Model calls: `0`
- Worktree at freeze: clean
- Blockers: `1` (`source_surface_accessibility`, Ravensmark turn 5)
- Seed dispositions: `20261800`-`20261803` all `unconsumed_development_preflight_failure`

## Archived dirty precommit check

The earlier dirty-worktree check was preserved rather than overwritten at:

`/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v8/iteration-1-archived-dirty-precommit-063bdbbd`

Its validation and result hashes are respectively
`038abe9d3505cf92fa3257d75436d5dfd501bd090b334d737bf295ac29520aef`
and `ed33bc9c7aba2457d71313ac80cdfb792d0ec7b0ad5c7e5c2dc1f8adf5820758`.
Those artifacts are diagnostic only and are not the clean V28 result.

## Consequence

V29 must keep exact SOURCE delivery and all strict safety gates, but add a
generic, typed accessibility-compensation contract for a single inaccessible
SOURCE. The compensation must be source-grounded, short, declarative,
immediately adjacent to the exact SOURCE, and unable to introduce a new name,
number, object, action, or qualifier. V28's direct-only policy remains frozen.

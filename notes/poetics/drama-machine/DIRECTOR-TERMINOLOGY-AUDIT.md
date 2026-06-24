# Director Terminology Audit

Status: decision note, 2026-06-24.

## Decision

Keep `director` as the canonical serialized key. Gloss it as **scene author /
director** in human-facing docs and UI labels when the authorship function is
being selected or explained.

Do not run a broad rename now. The compatibility-bearing surface is too wide:
CLI flags, role maps, generated YAML, cached plan files, traces, tests, public
browser routes, and archived empirical artifacts all already use `director`.

Reserve `authorial_voice` as a future alias for setup-only scene authorship if
the runtime later splits setup authorship from live cueing. Reserve
`staging_director` as the conceptual name for live cueing / movement
declarations. Neither alias is accepted by loaders today.

## Inventory

Runtime-facing uses:

| Surface | Representative paths | Current use | Policy |
|---|---|---|---|
| Teaching-drama generator | `scripts/generate-pedagogical-dramas.js`, `scripts/drama-generator.js` | `--director-*` flags, `--role-map director=...`, director plan JSON, raw director-plan cache, full-transcript role labels | Keep keys; clarify comments and prompts only. |
| Drama-machine compose UI | `scripts/browse-poetics-scripts.js`, `services/poetics/dramaParameters.js` | `cast.director` input and vocabulary catalog | Label as `scene author / director`; keep serialized `cast.director`. |
| Dramatic-derivation runtime | `services/dramaticDerivation/*`, `scripts/run-derivation-loop.js`, `scripts/run-derivation-episode.js` | `roles.director`, transcript `role: director`, movement declarations, `staging.source === 'director'`, `director-cadence` | Keep keys; this is the staging-director function. |
| Derivation worlds and scripts | `config/drama-derivation/world-*.yaml`, `config/drama-derivation/tutor-scripts/*.md` | `via: director`, authored dramaturgy sketches, director-owned releases | Do not rename; these are config/artifact compatibility keys. |
| Curriculum drama outputs | `curriculum/*dramas*.yaml`, `services/curriculum/curriculumCompiler.js` | Generated `role: director` turns and director role defaults | Do not migrate without a compiler-level alias. |
| Tests | `tests/dramaGenerator*.test.js`, `tests/dramaticDerivation*.test.js`, `tests/generatePedagogicalDramas.test.js` | Assertions over serialized `director` behavior | Leave intact; they protect compatibility. |

Doc-facing uses:

| Surface | Current use | Policy |
|---|---|---|
| `notes/poetics/drama-machine/{README,SPEC,TAXONOMY,ADAPTATION-MOVES,example-drama.yaml}` | Names the drama-machine role as `director` | Updated to define `director` as the compatibility key for scene author / staging director. |
| `notes/poetics/2026-06-09-free-dramaturgy-and-register-dials.md` and `notes/2026-06-09-dramatic-derivation-plan.md` | Historical/operator notes about free director, plot skeleton, releases, and staging | Do not rewrite; they describe decisions made under the vocabulary of the run. |
| Paper/id-director/charisma docs and prompts | `id_director`, `tutor-id-director.md`, cells 101-109 | Out of scope. This is a separate architecture where an id authors the tutor ego prompt. |

## Compatibility Path

If a future code migration is warranted:

1. Add parser aliases only at input boundaries: accept `cast.authorial_voice` or
   `role: authorial_voice`, normalize to internal `director`.
2. Continue writing output artifacts as `director` until a versioned artifact
   migration exists.
3. Add warnings in generated specs when aliases are used.
4. Migrate UI labels first, runtime keys last.
5. Keep historical notes, paper claims, and run artifacts unchanged.

That path gives future ergonomics without breaking existing traces or changing
the meaning of prior experiments.

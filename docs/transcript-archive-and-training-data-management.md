# Transcript archive and training-data management

Status: operational policy and tooling, 2026-08-04. This document governs
future collection and reuse. The implementation does not retrospectively
license any existing data: approvals remain separate, private, append-only
records scoped to an exact corpus hash, purpose, and model.

## Decisions

1. A trace is evidence, not training data. Capture, analysis, corpus
   derivation, training approval, and model evaluation are separate states.
2. Bulk transcripts and corpora stay in the private data home. Git tracks
   code, schemas, redacted manifests, checksums, and decisions, not raw human
   dialogue or model weights.
3. Every corpus must be reproducible from immutable source assets by tracked
   code. A hand-written or untracked formatter is not an acceptable training
   boundary.
4. While the project has one human operator, that owner's human and
   mixed-authorship tutor-stub dialogue is a `training_candidate` by default,
   with a durable per-session and global opt-out. This default never extends
   to pilot participants, imported dialogue, external users, or unknown
   authorship; those remain `do_not_train` until their own reuse basis is
   recorded.
5. A response rating is an observational preference signal. It may nominate a
   candidate, but it does not by itself license training, prove learning, or
   create a valid preference pair.
6. Holdout status propagates through lineage. No turn, paraphrase, rating,
   repair, summary, or other descendant of a held-out dialogue may enter a
   training split.
7. Source, corpus, and training-run manifests are immutable once used. A
   correction creates a new version and records the supersession.

## What Program-2 actually did

The completed Program-2 fine-tune used one deliberately narrow source rather
than indiscriminately training on every prior transcript.

| Stage | Artifact and behavior |
| --- | --- |
| Sealed source | `~/.machinespirits-data/step4-claim-runs-2026-07/`: 80 completed Step-4 dialogues, with 2,076 tutor turns and 645 trigger moments. The extractor rejects traces not stamped with the frozen `91b8a50e` lineage and requires one sealed trace per dialogue. |
| Extraction | `scripts/program2-extract-dataset.mjs` joins the original `tutor_stub_tutor` model call, `turn_complete`, guard accounting, and point-of-action compliance. It never trains on repair-role prompts. |
| Positive and negative labels | An audit-accepted, leak-clean original becomes a positive. An original rejected into repair or deterministic fallback becomes an unpaired negative. A compliant trigger turn becomes Task-A SFT data only when the original itself was accepted. |
| Split | Dialogue-level 80/10/10 split, seed `20260718`, stratified by tutor family and learner profile. All turns from one dialogue stay together. |
| Extracted v1 | 1,096 general SFT positives, 141 Task-A positives, 2,076 KTO rows (1,096 positive / 980 negative), and 645 evaluation moments. Bulk data lives under `~/.machinespirits-data/program-2/datasets/v1/`; the repo tracks its manifest. |
| Training handoff | A small formatter produced 865-row instruct and base SFT files and a 1,676-row train-only KTO file under `datasets/trl-v1/`. The instruct file used chat messages; the base file used the frozen flattened prompt. |
| Weight update | `scripts/program2-train-sft.py` trained LoRA adapters for pinned Qwen3.5-9B instruct and base siblings with completion-only loss. `scripts/program2-train-kto.py` then used the unpaired labels conditionally, starting from each SFT adapter. |
| Artifacts and evaluation | Adapters, environment records, and local serving/evaluation outputs live under `~/.machinespirits-data/program-2/`; redacted evidence manifests live in `config/adaptive-tutor-evidence/`. The KTO adapters were behaviorally identical to their SFT parents in the frozen evaluation. |

This design got several things right: immutable source traces, original-versus-
repair separation, deterministic dialogue grouping, exact hashes, pinned base
models, completion-only loss, and held-out local evaluation.

The first governance repair is now reproducible. The tracked v1 manifest
reports 868 train-split general positives, while the frozen TRL export has 865
SFT rows. `scripts/program2-export-trl-v1.mjs` reconstructs the original
Task-A-first ordering and exact Python JSONL serialization, then records the
three excluded rows in
`config/data-governance/program2-v1-trl-exclusions.json`. No contemporaneous
rationale for those three exclusions survives, so the ledger says that
plainly rather than inventing one. A clean rebuild reproduces the frozen
hashes exactly: instruct
`e89f3ac443ea612f64be0be8388174852006903df5a725f7e41c9a56bb1de6b6`,
base `5b1718ea3b7882b7fd03d22d9f6ea2bb79c5f842438061719dd23995af92cf9f`,
and KTO `d8e29db88947d1d948ff688073d417800eb57452e9405045a9a9edc2836ae927`.
The rebuild also emits a separate row-level lineage ledger; it does not alter
the historical training files.

### The separate archived v2 corpus

`archive/program-2-corpus-v2-2026-07-18` is not the corpus used for the
completed Qwen runs. It is a later engineering-tier typed-performance corpus:
1,118 accepted-original pairs from Step 4 and several V-series/fixture sources,
with three held-out world rows, a matched-versus-shuffled faithfulness gate,
and 4,697 auxiliary register frames. It is preserved as:

- remote archive branch and immutable archive tag;
- `~/.machinespirits-data/archives/program-2-corpus-v2-2026-07-18.tgz`;
- SHA-256
  `1363c537fc724a3e32563d2a73a911367e75ee2b561731a4c933f609c0b37211`.

It was archived rather than merged. Do not train on it or revive its extractor
in place. If Task B is reopened, port the required code onto current `main`,
register every source asset, re-run current eligibility and leakage gates, and
create a new corpus version.

## Current data estate

Observed on the primary workstation on 2026-07-25. Sizes and counts are an
inventory snapshot, not assertions that code should hard-code.

| Location | Contents | Observed state | Management status |
| --- | --- | --- | --- |
| `~/.machinespirits-data/logs/` | Canonical evaluation dialogue logs, rendered transcripts, checkpoints, and run manifests | 7.3 GB; 48,838 tutor-dialogue files, 542 transcript files, 583 run manifests | Canonical evidence archive; append-only log files; replicated with Syncthing. |
| `data/evaluations.db` | Evaluation results, scores, pilot tables, and claim-set projections | Symlink to the 324 MB `~/.machinespirits-data/evaluations.db`; consistent copies in `snapshots/` | Live SQLite; never file-sync directly. Snapshot through SQLite backup. |
| `.tutor-stub-traces/` | Human, mixed, and ad-hoc tutor-stub JSONL traces plus transcript/summary HTML | 44 MB; 22 JSONL, 17 sealed, 70 completed turns; one immediate rating and one enriched observation | Mutable ignored working store. It is not yet a canonical or reliably replicated archive. |
| `.tutor-stub-auto-eval/` | Current checkout's auto-eval summaries, ledgers, priors, and generated assets | 188 KB in this checkout; larger historical campaigns live elsewhere or in archives | Generated working store. Source summaries and traces must be sealed before reuse. |
| `.tutor-stub-tuning/` | Versioned tutor tuning evidence, candidates, replay plans, and ledgers | Absent/empty on this checkout; off by default and relocatable with `TUTOR_STUB_TUNING_DIR` | Private evidence store, not a training corpus. Raw comments are evidence only. |
| `~/.machinespirits-data/step4-claim-runs-2026-07/` | Frozen Step-4 source used by Program-2 v1 | 576 MB; 80 trace directories, 94 JSONL files, exactly 80 sealed traces | Immutable claim/training source. Quarantined pre-isolation traces remain separate. |
| `~/.machinespirits-data/program-2/` | v1 and TRL datasets, floor/live traces, adapters, environment, local toolchain | 8.5 GB: 186 MB datasets, 6.6 GB adapters, about 573 MB live-run artifacts, plus disposable toolchain/venv | Mixed durable and disposable material currently sharing one root. Needs asset-level catalog entries. |
| `~/.machinespirits-data/runs/tutor-stub/` | Packaged register-confirmatory and headroom runs | Four tarballs; parent `runs/` is 2.1 GB | Candidate source archives; not automatically training-eligible. |
| `~/.machinespirits-data/archives/` | Worktree/branch closeout bundles, including Program-2 v2 | 1.3 GB | Historical preservation. Archive presence does not imply training permission. |
| `exports/` and tracked fixtures | Generated analyses, selected trace projections, corpus drafts, and test fixtures | 613 MB in the main checkout; content has mixed provenance | Derived/local by convention. Test fixtures may be code dependencies but still need source and license declarations before corpus reuse. |
| Pilot tables and files | Participant/session/turn/test/survey data, plus simulated pilot data | Canonical DB currently has two sessions and 18 turns; no exit surveys | Human-governed zone. Treat as restricted and `do_not_train` unless an approved consent record explicitly says otherwise. |

The code already provides useful projections:

- `scripts/ingest-tutor-stub-auto-evals.js` can materialize auto-eval runs,
  rows, and per-turn frames in namespaced `tutor_stub_*` SQL tables. The SQL
  view is a derived analysis surface, not a source archive.
- `scripts/ingest-tutor-stub-turn-failures.js` hashes source traces and stores
  failure candidates while forcing `training_licensed = 0`. This is the right
  default and should remain fail-closed.
- `scripts/build-tutor-stub-register-priors.js` deduplicates run/turn evidence,
  keeps subjective rating separate from objective progress, and uses a
  chronological run-level holdout. It produces an advisory policy prior, not
  a general fine-tuning license.

## Problems to correct

1. **No unified asset register.** The archive is canonical for evaluation
   logs, but tutor-stub, Program-2, V-series, exports, and branch-closeout
   bundles are discoverable only through path knowledge and scattered notes.
2. **Working and durable stores are mixed.** Program-2 adapters, corpora,
   evaluation traces, a cloned toolchain, and a Python environment share one
   directory; `.tutor-stub-traces/` mixes incomplete and sealed sessions.
3. **Manifest vocabulary is inconsistent.** Existing manifests are strong on
   hashes and empirical lineage but generally lack authorship, consent/reuse
   basis, sensitivity, retention, and revocation fields. Several also expose
   machine-specific absolute paths.
4. **One untracked transformation entered a real training run.** The Program-2
   TRL formatter is missing from `main`, and the 868-to-865 row change is not
   explained by a tracked exclusion ledger.
5. **Training and evaluation exclusions are local to individual projects.**
   There is no global do-not-train/holdout registry that follows a dialogue
   into later exports, ratings, paraphrases, or repaired candidates.
6. **Ratings are richer than the archive policy.** The trace records immediate
   ratings, optional comments, the rated response, next learner response,
   objective progress, and next adaptation, but there is no governed corpus
   builder for this evidence.
7. **Provider-output and source-text reuse is undeclared.** Existing data may
   include outputs from multiple model providers and authored world material.
   Unknown reuse terms must resolve to quarantine, not implied permission.
8. **Archive replication protects bytes, not meaning.** Syncthing and DB
   snapshots provide recovery, but cannot answer which assets are sealed,
   sensitive, held out, superseded, or used by a model.

## Data zones and lifecycle

Use five zones. Existing paths need not be moved immediately; the asset
registry can point at them while migration proceeds.

| Zone | Meaning | Mutability | Training status |
| --- | --- | --- | --- |
| Working | Incomplete traces, local experiments, HTML projections, logs, and caches | Mutable | Prohibited |
| Sealed source | Completed, checksummed source bundle with provenance and an archive manifest | Immutable | Not yet eligible |
| Restricted/quarantined | Human or mixed data, unknown rights, secrets/PII, malformed traces, heldout data, or policy failures | Immutable except access/retention metadata | Prohibited unless a new explicit approval changes only the policy record |
| Derived corpus | Deterministic transform of registered sources with row lineage, exclusion ledger, split map, and corpus manifest | Immutable by version | Candidate only |
| Approved training/evaluation release | Frozen corpus plus training-run manifest, explicit approval, and disjoint evaluation asset | Immutable | Approved for the named purpose and model only |

The lifecycle is:

`capture -> seal -> catalog -> classify -> audit -> split/deduplicate -> derive -> approve -> train -> evaluate -> retain or retire`

No step may be inferred from the next one. In particular, sealing an archive
does not approve training, and training approval for one corpus/model does not
license a later model or broader purpose.

## Canonical private layout

Keep `~/.machinespirits-data` as the data home. Add a metadata overlay before
attempting costly file moves:

```text
~/.machinespirits-data/
  catalog/
    assets.jsonl                 # append-only private asset register
    holdouts.jsonl               # global do-not-train lineage/group register
    approvals.jsonl              # explicit, append-only use approvals/revocations
  logs/                          # existing canonical evaluation evidence
  runs/                          # sealed source runs and campaign bundles
  corpora/<corpus-id>/           # future immutable derived corpora
  program-2/                     # grandfathered location, catalogued in place
  restricted-human/             # encrypted/restricted; excluded from broad sync by default
  models/<model-artifact-id>/    # future adapters/weights and training records
  archives/                      # historical branch/worktree bundles
  snapshots/                     # consistent SQLite snapshots only
```

The repository should eventually carry schemas under
`config/data-governance/` and redacted asset summaries under
`config/data-assets/`. Full manifests stay beside private assets. Redacted
manifests must use logical asset IDs and path hints, not usernames or absolute
machine paths.

## Required records

### Source/archive manifest

Every sealed source asset needs:

- stable `asset_id`, schema version, creation/seal timestamps, and status;
- source kind (`automated_eval`, `human_session`, `mixed_session`, `pilot`,
  `fixture`, `public_corpus`, or other declared value);
- authorship for learner and tutor text (`human`, `ai`, `hybrid`, `unknown`);
- human-data flag, human-subject class (`owner_operator`,
  `research_participant`, `external_user`, or `unknown`), sensitivity,
  consent/reuse record, provider-output reuse basis, and source-text license;
  unknown values are allowed but force quarantine;
- repository SHA, dirty-tree fingerprint, world/scenario/profile IDs, models
  and providers by role, trace schema versions, and run/turn counts;
- immutable file inventory with relative paths, sizes, and SHA-256;
- parent asset IDs, superseded asset ID if any, retention rule, replication
  class, and access class;
- completeness results: seal event, malformed-line count, missing calls,
  missing prompt snapshots, and any known loss.

### Corpus manifest and row lineage

Every derived corpus needs:

- corpus ID/version, builder path and SHA, command/options, source asset IDs,
  source-manifest hashes, and deterministic seed;
- intended task, model interface, prompt surface, target surface, masking rule,
  and prohibited fields;
- one lineage record per row: source asset, dialogue, turn, source event hash,
  normalized prompt hash, target hash, transformation steps, exclusion/audit
  results, and split group;
- exclusion ledger with counts and stable reason codes; silent filtering is
  prohibited;
- exact/normalized/near-duplicate results, rights/PII/leak audits, holdout
  registry check, row counts by source/authorship/world/profile/split, and file
  hashes;
- approval status and scope. The default is `candidate`, not `approved`.

### Training-run and model manifest

Every trained artifact needs:

- approved corpus manifest hash and exact train files;
- base model ID, immutable revision, license, tokenizer/chat template, and
  serving format;
- complete training configuration, seeds, dependency lock/freeze, hardware,
  logs, checkpoints, restart ledger, and final adapter/weight hashes;
- code SHA and any preregistration or human approval record;
- evaluation asset IDs, proof of train/eval disjointness, metrics, and known
  limitations;
- lineage to parent adapter/model and a list of corpus IDs known to be in its
  weights. This permits future contamination checks.

## Eligibility policy

| Source | Default | What can change it |
| --- | --- | --- |
| Fully automated tutor/learner run | Candidate after sealing | Declared provider-output and source-text reuse basis, no protected data, deterministic audit, and explicit corpus approval |
| Sole owner-operator's human learner turn or prompt/history | `training_candidate` unless opted out | The recorded sole-owner policy covers candidate extraction; corpus admission still requires sensitive-content review, lineage checks, and explicit corpus approval |
| Sole owner-operator's mixed turn or human-edited AI suggestion | `training_candidate` unless opted out | Same owner policy; preserve human/AI contribution provenance and honor either session-level or global opt-out |
| External, imported, or unknown human/mixed dialogue | `do_not_train` | Explicit informed reuse authorization covering training input, purpose, retention, and revocation; de-identification review |
| Pilot/research participant data | Restricted; `do_not_train` | The approved consent/IRB protocol must explicitly allow this secondary use; project-owner approval alone is insufficient |
| Public or third-party corpus | Quarantine until reviewed | License and terms explicitly permit the intended transformation and model use |
| Model repair/fallback output | Not a positive by default | A separate quality judgment can nominate it; mechanical delivery or a guard pass is insufficient |
| Hidden answer, release schedule, private director/coach prompt, chain-of-thought, secrets, credentials, or PII | Prohibited as a target | No override for secrets/credentials/PII; private apparatus may appear as masked input only when required by the declared model interface and independently audited |
| Test fixture | Engineering-only by default | Proven source/authorship/license plus proof it is not in the evaluation holdout |

Historical Program-2 v1 is grandfathered as an executed experiment, not as a
blanket eligibility precedent. Before its data is reused, add a retrospective
source classification and a new approval scoped to the proposed corpus.

The owner-operated default is conditional on the present single-user
deployment. Before another person can use the tutor, the runtime must
distinguish `owner_operator` from `external_user` and make external use opt-in.
A rating action is never treated as the opt-out control: reuse is a separate
setting so the learner can rate freely without changing archive policy.

The tutor-stub runtime control surface now implemented is:

- global default: training reuse on for the sole owner;
- per-session override: `/settings training-reuse on|off|status`,
  `--training-reuse on|off`, and `--no-training-reuse` as an opt-out alias;
- trace metadata: resolved default, override source, effective value, and
  human-subject class captured at `run_start`;
- closeout display: whether the sealed session is a candidate or opted out;
- opt-out effect: source and descendants enter the global holdout/do-not-train
  registry, without deleting the evidential trace.

The runtime currently records that source-and-descendant obligation in the
trace and closeout artifacts. Materializing it into the planned global holdout
registry remains part of P1/P2 below; until that registry exists, every corpus
builder must treat the effective trace value as authoritative and fail closed
when it is missing.

## Response ratings and future preference data

The current tutor-stub trace design should remain the source model:

- `feedback-rating-record.v1` captures the rating immediately, so `/quit`
  cannot lose it;
- `feedback-observation.v1` later joins the same rated response to the learner
  reply, objective DAG/field progress, and next-response adaptation;
- raw comments remain review evidence and never become instructions;
- automated learners do not emit human feedback.

Add these management rules:

1. Give each rating a stable ID derived from source asset, run, rated turn, and
   rated-response hash. The immediate and enriched records must join through
   that ID rather than only path/turn heuristics.
2. Record rater class, learner/tutor authorship, human-subject class,
   effective reuse status and its source, reason code, and whether the rated
   text was actually displayed. Keep the free-text comment in the restricted
   source record only.
3. Keep three labels separate in every export:
   `subjective_helpfulness`, `objective_progress`, and
   `next_response_adaptation`. Never collapse them into one reward without a
   separately preregistered estimator.
4. A thumbs-up may nominate an audit-passing response for SFT. A thumbs-down
   may nominate the exact displayed response as an unpaired negative. For an
   owner-operated session with reuse on, these are corpus candidates; neither
   enters training until source, safety, holdout, and corpus-approval gates
   pass.
5. Do not fabricate DPO pairs. A repaired or later response is not the
   `chosen` response merely because the first was down-rated. Paired preference
   data requires an explicit comparison of two responses generated from the
   same frozen public prefix, with a recorded chooser and order/randomization.
6. Deduplicate repeated ratings from the same rater/session/turn. Report both
   rating count and independent dialogue/rater count; turns are not independent
   samples.
7. Ratings used online for one-turn adaptation remain operational evidence.
   They enter an offline corpus only through a reviewed, versioned builder.
8. Preserve safety as a hard gate. A helpfulness rating cannot rehabilitate a
   response that leaks hidden evidence or violates another binding guard.

## Split, deduplication, and leakage discipline

- Split on the largest dependency group available: human participant (when
  applicable), root source lineage, world, dialogue/episode, and template
  family. Never randomly split turns.
- Create the holdout registry before corpus extraction. A holdout entry names a
  stable group ID and all known source hashes. Descendants inherit the block.
- Keep evaluation prompts, rejected held-out drafts, ratings, summaries,
  translations, repairs, and paraphrases in the same group as their source.
- Run exact SHA-256, normalized-text hash, prompt-prefix hash, and near-duplicate
  checks across train/dev/test and against registered historical evaluation
  assets. Template overlap is reported separately from verbatim overlap.
- Track model lineage. An output from a model already trained on corpus X is
  contaminated for a purported held-out evaluation of X, even when the exact
  text is new.
- Freeze split membership as a file with its own hash. Later corpus versions may
  add sources but must not silently move an existing dialogue from heldout to
  train.

## Retention, replication, and deletion

- **Working data:** review within 30 days. Classify it as seal, quarantine, or
  disposable. This is a review deadline, not an automatic deletion command.
- **Claim-bearing or training-bearing source:** retain while any published
  claim, corpus, adapter, or model depends on it. Preserve the full manifest and
  checksum even after explicit retirement.
- **Exact trained corpus and run record:** retain with the model artifact. A
  model without its exact data manifest and training record is unsupported.
- **Owner-operated human/mixed data:** retain in the private archive under the
  same evidence rules as other local sessions. The default training-candidate
  status is reversible through global or per-session opt-out; an opt-out adds
  an append-only tombstone so future corpus builds fail closed on that lineage.
- **Participant/external/restricted data:** use the consent/IRB retention
  period. If no valid rule is recorded, quarantine it, do not train on it, and
  do not broaden replication. Record revocation/deletion as an append-only
  tombstone.
- **Disposable caches/toolchains:** virtual environments, cloned build tools,
  converted temporary weights, and regenerable HTML do not belong in evidence
  retention merely because they share a directory with durable artifacts.
- **Replication:** continue Syncthing for immutable logs and SQLite `.backup`
  snapshots. Never sync a live WAL database. Restricted-human data requires a
  separately approved encrypted/access-controlled replication class.
- **Deletion:** require an inventory, dependency check, and recovery decision.
  Use the branch archive policy for worktree-associated private artifacts. No
  automated cleanup may delete an uncatalogued trace.

## Operating procedure

### At collection time

1. Allocate a run/asset ID and declare source kind, authorship, human-subject
   class, effective reuse status and source, intended purpose, and provisional
   holdout group.
2. Write versioned events and exact model/prompt provenance. Keep original,
   repaired, fallback, and delivered responses distinct.
3. Record ratings immediately and enriched outcomes later through a stable
   rating ID.

### At closeout

1. Require `run_end` or record an explicit incomplete status.
2. Inventory files, hash them, verify JSONL parseability and counts, and write
   the private source manifest.
3. Register the asset. Move/package it only after verification; path is not
   identity.
4. Apply sensitivity, reuse, holdout, retention, and replication classes.
5. Emit a redacted tracked manifest only when it contains no private text or
   machine-specific path.

### Before deriving a corpus

1. Name the proposed task and exact use; obtain explicit approval.
2. Resolve every source asset to an eligibility decision. Unknown means stop.
3. Load the global holdout registry, group before splitting, and run exact and
   near-duplicate checks.
4. Build with tracked code into a new immutable version. Emit row lineage and
   the exclusion ledger.
5. Review samples from every source/authorship/outcome stratum. Freeze the
   corpus manifest and hashes.

### Before training

1. Verify the corpus is `training_approved` for this model and purpose.
2. Recompute hashes and train/eval disjointness from a clean environment.
3. Freeze the training manifest, base revision, configuration, seed, and run
   budget. Record any restart; do not silently tune-and-retry.
4. Bring home the adapter/model, logs, and environment record; hash and
   register them before deleting cloud storage.

## Operational commands

All commands below are zero-model operations. Private registries live under
`MS_DATA_HOME/catalog` (normally `~/.machinespirits-data/catalog`); tracked
files contain schemas, code, logical paths, and redacted summaries only.

```bash
export MS_DATA_HOME="${MS_DATA_HOME:-$HOME/.machinespirits-data}"

# Create append-only private registries and seed conservative exclusions.
npm run data:governance -- init --root "$MS_DATA_HOME/catalog"
npm run data:governance -- seed-holdouts \
  --seed config/data-governance/default-holdouts.json \
  --registry "$MS_DATA_HOME/catalog/holdouts.jsonl"
npm run data:governance -- seed-program2-split-holdouts \
  --splits "$MS_DATA_HOME/program-2/datasets/v1/splits.json" \
  --registry "$MS_DATA_HOME/catalog/holdouts.jsonl"

# Register and verify the historical Program-2 estate in place.
npm run data:governance -- register-retrospective \
  --catalog config/data-assets/program-2-v1-retrospective.json \
  --registry "$MS_DATA_HOME/catalog/assets.jsonl"
npm run data:governance -- audit-retrospective \
  --catalog config/data-assets/program-2-v1-retrospective.json

# Rebuild the exact historical TRL files plus reconciliation and lineage.
npm run program2:export-trl-v1 -- \
  --input "$MS_DATA_HOME/program-2/datasets/v1" \
  --out "$MS_DATA_HOME/program-2/datasets/trl-v1-rebuilt"

# Extract private rating candidates. Missing asset or holdout registries stop.
npm run tutor:stub:export-rating-candidates -- \
  --input .tutor-stub-traces \
  --assets "$MS_DATA_HOME/catalog/assets.jsonl" \
  --holdouts "$MS_DATA_HOME/catalog/holdouts.jsonl" \
  --out "$MS_DATA_HOME/tutor-stub/training-candidates/review-v1"
```

The ratings export is deliberately only `candidate_not_approved`. It requires
the source trace to be sealed and catalogued, joins immediate and enriched
feedback by stable rating ID, groups splits by source run, strips comments,
rejects exact/normalized/near duplicates, and keeps subjective helpfulness,
objective progress, and next-response adaptation in separate fields.

The Program-2 SFT and KTO entrypoints now require `--corpus-manifest`,
`--approval-registry`, and `--holdout-registry`. They invoke the same exact-
hash admission check before importing the training stack or touching a model.
`--governance-check-only` provides a free smoke test. A revoked approval, a
different purpose/model, any held-out ancestor, a missing registry, or one
changed corpus byte stops the run.

## Implementation plan

Implementation status, 2026-08-04: P0-P3's source controls are implemented.
The private catalog was initialized without moving bulk data; nine Program-2
assets and 21 initial holdout records were registered. The retrospective audit
verified the sealed Step-4 source, v1 and TRL corpora, four adapter roots,
floor/live evaluation roots, and the archived-v2 checksum. Automated tests
cover atomic seal/restore, tamper detection, grouped lineage, owner opt-out,
external/unknown exclusion, held-out descendants, exact and near duplicates,
approval revocation, and unapproved-versus-approved training admission.

### P0 — make existing Program-2 reproducible

- Add a tracked v1-to-TRL exporter with fixtures/tests for instruct, base, and
  KTO shapes.
- Reconcile 868 source train positives versus 865 frozen SFT rows with an
  explicit exclusion ledger. Verify the exporter can reproduce the historical
  hashes, or record exactly why it cannot without modifying the originals.
- Add retrospective private asset records for Step 4, dataset v1, TRL v1, the
  four adapters, floor/live evaluations, and the archived v2 corpus.

Complete: the exact three historical hashes reproduce, the exception and row-
lineage ledgers are emitted, and the redacted/private retrospective catalogs
cover all named assets.

### P1 — introduce the catalog and sealing contract

- Add the three data-governance schemas and validators.
- Implement an inventory-only command that discovers current roots without
  moving data, writes private manifests, and produces redacted summaries.
- Add a seal/package command with atomic manifest creation, SHA-256 inventory,
  parse/completeness checks, and verification after copy.
- Seed the global holdout registry from Program-2, V-series transfer worlds,
  paper evaluation sets, and pilot data.

Complete: schemas, conservative validators, private registry initialization,
atomic copy-and-verify sealing, in-place inventories, default protected asset
seeds, and all 16 Program-2 dev/heldout dialogue groups are implemented.

### P2 — governed ratings corpus

- Add stable rating IDs and an explicit join migration for immediate and
  enriched observations.
- **Implemented 2026-07-25:** owner-default opt-out setting in the CLI,
  keyboard `/settings`, remembered settings, `run_start`, feedback provenance,
  transcript/closeout displays, and resume/recipe provenance. External or
  unknown human-subject classes fail closed.
- Build a zero-model-call candidate exporter that defaults external/unknown
  users to `do_not_train`, honors owner opt-outs, strips comments from derived
  rows, keeps the three outcome channels separate, and reports
  authorship/reuse/safety coverage.
- Add reviewer decisions and approval records; no command should directly
  train from `.tutor-stub-traces/` or `.tutor-stub-tuning/`.
- Test grouped splits, lineage inheritance, exact/near-duplicate rejection,
  heldout contamination, revocation, and malformed/incomplete traces.

Complete: the zero-call exporter is candidate-only and fail-closed on missing
catalog, reuse, safety, lineage, or holdout evidence.

### P3 — training and retention gates

- Require corpus/training manifest hashes in future training entrypoints and
  fail closed on unapproved or held-out assets.
- Separate durable Program-2 assets from its venv, cloned `llama.cpp`, caches,
  and temporary conversions after the catalog proves dependencies.
- Add a periodic read-only audit: uncatalogued files, missing replicas,
  absolute-path leakage, stale working data, checksum drift, and models whose
  source corpus cannot be resolved.
- Perform a restore drill for one source archive, one corpus, one DB snapshot,
  and one adapter.

The exact Program-2 corpus rebuild and automated seal/restore drill are
complete, and current Program-2 source/corpus/adapter/evaluation checksums are
auditable. The broader periodic estate audit and physical relocation of
disposable toolchains remain routine archive housekeeping, not a prerequisite
for using the new admission boundary.

## Completion gate

This policy is operational only when:

- every current transcript/corpus/model root has a catalog entry or explicit
  disposable classification;
- Program-2 v1's final training files are reproducible or have a complete,
  immutable exception record;
- a clean-room corpus build can prove source hashes, exclusions, grouped split,
  holdout disjointness, row lineage, and output hashes;
- owner opt-outs, external/unknown human data, and unknown-rights rows fail
  closed, while a sole-owner session with reuse on reaches candidate status;
- the rating exporter demonstrates that helpfulness, objective progress, and
  adaptation remain separate and that comments never enter prompts/targets;
- a training smoke refuses an unapproved corpus and accepts the same corpus
  after a scoped approval; and
- restore and checksum verification succeed from the replicated private
  archive without relying on a deleted worktree.

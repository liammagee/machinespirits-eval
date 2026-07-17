# Codex speaker base-instructions override probe

Date: 2026-07-17

Status: passed non-equivalent development transport probe; not tutor acceptance

## Purpose

Test the installed Codex CLI's supported `model_instructions_file` replacement
boundary after adding an opt-in, development-only bridge path. This probe does
not use a tutor campaign, frozen learner prefix, development seed, strict seed,
or held-out seed. It cannot count as Codex tutor acceptance.

The additive `developer_instructions` setting was not used: it adds another
instruction layer and therefore cannot reduce the built-in base prompt.

## Frozen call pair

- CLI: `codex-cli 0.144.1`
- model: `gpt-5.6-terra`
- effort: `low`
- system: `You are a text-only tutor transport probe. Return exactly OK. Do not use tools.`
- user: `Return exactly OK.`
- order: default base, then replacement base
- replacement source: `config/tutor-stub-codex-speaker-instructions.md`
- replacement SHA-256: `09039c3eaaabc4557474252a341d99326913df62946c7bcbe0ebfb5929ed370b`
- replacement bytes: `566`

The bridge copied the hashed instruction bytes into the ephemeral call
directory, passed the copied file with `--strict-config`, retained read-only,
ephemeral, ignored-user-config and ignored-rules isolation, and preserved the
JSON event audit.

## Result

| Measure | Default base | Replacement base | Change |
|---|---:|---:|---:|
| Observed input tokens | 12,265 | 8,826 | -3,439 (-28.0%) |
| Cached input tokens | 9,984 | 6,400 | -3,584 (-35.9%) |
| Uncached input tokens | 2,281 | 2,426 | +145 (+6.4%) |
| Output tokens | 5 | 5 | 0 |
| Reasoning output tokens | 0 | 0 | 0 |
| Total tokens | 12,270 | 8,831 | -3,439 (-28.0%) |
| Latency | 4,780 ms | 3,197 ms | -1,583 ms (-33.1%) |
| Prohibited tool events | 0 | 0 | 0 |

Both calls returned exactly `OK`. Token usage was available for both calls.

The cached/uncached split prevents attributing the single-pair latency change
solely to base-instruction size. The observed input reduction is direct provider
accounting for these calls; it is not a claim that a full tutor request will
fall by the same proportion.

## Governance and next step

The replacement transport remains:

- opt-in;
- development-only;
- restricted to the checked-in speaker instruction file;
- non-equivalent to the ordinary Codex base contract;
- ineligible for strict or held-out acceptance;
- subject to all ordinary deterministic tutor audits;
- included in the preflight certificate source inventory.

The next informative test is a freshly predeclared non-held-out frozen-prefix
screen comparing a real compact tutor request. Ordinary Codex CLI verification
must still pass before any model-specific success claim.

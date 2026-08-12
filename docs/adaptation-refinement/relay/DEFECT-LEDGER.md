# Defect ledger — systematic harness defects and their regression guards

**Purpose (human directive, 12 Aug):** every systematic defect gets a
permanent entry here with the guard that prevents its return. A
systematic defect is one the harness causes on a predictable class of
inputs — as opposed to a model slip, which is random. Systematic
defects are cheap to fix and cheap to guard; this file is the record
that the guard exists.

**Standing policy (same directive):** a systematic transport defect is
a WARNING while the run stays inside its registered coverage line
(≤15% unanalyzed, 10-turn floor). It becomes a restart cause only when
the run fails its own registered gate. Two things stay forbidden:
patching a live run (dialogues inside one run must be uniform), and
waiving a failed gate after seeing the data (that is the criterion
change that would break the pre-registration). Fixes are carried
forward into the next seed with a guard test.

| # | Defect (where found) | Class | Fix commit | Regression guard |
|---|---|---|---|---|
| 1 | Ping compared the model's copy byte-for-byte against the serialized template; any key order or whitespace difference failed the transport check (report 024) | ping harness | `176e9adf` | Focused tests: canonical value comparison passes on key-order/byte differences, fails on any true value change; preflight asserts raw+parsed retention on failure |
| 2 | Ping template embedded four harness-derived fields the enforced response schema forbids the model to return; the correct model reply could never pass (report 026) | ping template | `fe2d7a2f` | Zero-call closure: focused test + preflight assertion that the synthetic template VALIDATES against the enforced response schema; drift test plants the old defect and must fail |
| 3 | Quote matching compared typographic vs ASCII apostrophes byte-wise; 8 Sonnet probe discards were this, not misquotes (direction 022) | live validator | per 022 | Punctuation-normalized quote matching both seats, mechanical, preflight-asserted |
| 4 | Analysis prompt metadata rows carried embedded line breaks, corrupting live calls; the 48-turn probe never exercised the exact live prompt so it passed at 10.4% while live failed at 33% (seed-506 run) | live prompt build | `ec85a49b` | Tests assert metadata rows contain no line break; probe/live prompt-parity preflight assertion (byte-compare one synthetic turn through both paths) pre-declared in 028 |
| 5 | Prompt audit cap (42,000 chars) blocks the largest analysis prompt, which is always the LAST turn; loss lands on dialogue closure, worse than random (seed-507 run, live traces) | run-management cap | contingent, 028 | Unconditional: every matrix report splits unanalyzed turns into audit-overflow vs model-residual and the gate ruling quotes both. Contingent (only if s507 halts/fails on coverage with overflow as a cause): cap 56,000 chars / 14,000 tokens, turn-8-sized prompt passes, >56,000 still fails closed |

Note on the Sonnet probe failure (022): only its apostrophe portion
was systematic (entry 3). After rescuing those 8 discards Sonnet still
failed at 35.4% and broke the value/component rule 19 times against
Luna's 3 — that residue was model behavior, not harness defect, and
stays a seat decision, not a ledger entry.

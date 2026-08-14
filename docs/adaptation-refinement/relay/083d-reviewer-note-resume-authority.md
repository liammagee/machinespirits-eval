# 083d — Reviewer note: human resume authority for the v4 pilot

**Date:** 13 August 2026. Human instruction, verbatim, in the
reviewer session: **"And I authorise resumption from all failures
where possible."**

This extends ruling 052a and direction 083c for the v4 pilot block:

- On a TECHNICAL failure (process death, provider error, guard stop
  with a mechanical cause), the run may be resumed without a fresh
  human ruling: disclose the failure in the report, repair the
  mechanical cause if one exists, and relaunch with `--resume` on the
  existing checkpoint so completed dialogues and reader calls are not
  re-bought. Every attempt still counts against the 19,337 ceiling.
- A SUBSTANTIVE fail stays terminal (ruling 052a). Resumption
  authority never converts a failed gate into a pass.
- The 144-case fingerprint guard and coverage guard stay mandatory on
  the resumed run; the registered predictions P1/P2 are judged on the
  completed whole, never on a fragment.
- The reviewer applies this authority when the driver exits on a
  failure; the driver's report must state what failed and where the
  checkpoint stands.

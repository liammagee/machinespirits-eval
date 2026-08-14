# 055b — Reviewer note: measure 1's reader output form (manifest must name it)

**Date:** 13 August 2026, ~01:25. From the second session's check on
note 055a. Prospective; no data exists. Not a change to any pin.

Measure 1 is decision CORRECTNESS. Pin 1 says the stub's logged
decision is scored against two-reader binary consensus, but that
leaves two paths open:

1. The readers report the DECISION they read from the case; the
   harness then computes correctness against world ground truth.
2. The readers report correctness directly.

Either path is acceptable. The A1 manifest MUST state which one the
frozen binary instrument uses, in one line, so the computation is
unambiguous before any call. If the instrument's output is the
decision (path 1), the manifest also names where world ground truth
comes from and that the same ground-truth source applies in all
three conditions.

The go note will check this line together with pins 1 and 2.

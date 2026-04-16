---
title: "Human Coding Codebook — Superego Critique Taxonomy (Paper 2.0 Pilot)"
version: 1.0
date: 2026-04-16
---

# Human Coding Codebook

## Purpose

This codebook is the instrument for the **human validation pilot** accompanying Paper 2.0 §5.4 / §8.1. You are assigning a **primary category** (and optionally secondary categories) to AI-generated superego critiques drawn from our evaluation corpus. Your ratings will be compared against an LLM classifier to compute Cohen's κ (2 raters) and Fleiss' κ (k ≥ 3 raters). The pilot targets κ ≥ 0.60 ("substantial agreement") as a floor for publishable reliability.

**You are not judging whether the critique is correct.** You are only labelling *what kind of problem the critique is pointing out* in the ego's tutoring response. If the critique says "the suggestion ignores the learner's 8-session history," that is a `MEMORY_FAILURE` critique regardless of whether you agree that the original tutoring response was bad.

## What you are given

An `item_id`, the superego critique text (`feedback`), the ego's initial response (`ego_generate`), the revised response (`ego_revision`), and a learner-context snippet. The `feedback` text is the primary object of classification — the others are there to disambiguate boundary cases.

## The 10 substantive categories

Pick **one** primary category per item. You may optionally list **up to two** secondary categories in the `human_secondary` column (comma-separated) if the critique raises multiple co-equal problems.

### 1. CONTEXT_BLINDNESS
The ego's suggestion is **disconnected from the learner's actual context** — wrong lecture, wrong topic, wrong level, or a content reference that isn't present in the learner profile.
- **Signal words:** "wrong lecture," "not in their current content," "mismatched to their level," "references X but the learner is on Y."
- **Exemplar (line 85, primary=CONTEXT_BLINDNESS, conf=0.92):** *"However, it introduces a content reference (176-178) that isn't verified in the provided learner context. Since the learner is currently in 479-lecture-3, clarify what readings they're meant to apply this journal work to, grounded in their actual curriculum position."*
- **Boundary with FABRICATION:** If the ego invents a *metric* ("you've spent 30 minutes" when 30 minutes isn't in context) → FABRICATION. If the ego invents a *curriculum location* ("in lecture 176") → CONTEXT_BLINDNESS. If both, pick the one the critique emphasises.

### 2. RECOGNITION_FAILURE
The ego treats the learner as a **passive data point** rather than an autonomous intellectual agent. The critique's diagnostic move is "you didn't acknowledge their contribution / thinking / agency."
- **Signal words:** "treating them as a data point," "fails to acknowledge their argument," "doesn't validate the intellectual move," "bypasses their autonomy."
- **Exemplar (line 1, primary=RECOGNITION_FAILURE, conf=0.92):** *"The Ego correctly identifies the learner's materialist critique of 479-lecture-3, but the suggestion fails the Recognition Standard by moving immediately to a tool (simulation) without first acknowledging the learner's sophisticated intellectual contribution."*
- **Boundary with EMOTIONAL_NEGLECT:** Recognition is about *intellectual agency* (their argument, their thinking). Emotional neglect is about *affect* (their frustration, joy, overwhelm). "You didn't validate their argument" = RECOGNITION. "You didn't acknowledge they said they're overwhelmed" = EMOTIONAL.
- **Boundary with LACK_OF_AGENCY:** Recognition is retrospective — did you honour what they already said? Agency is prospective — did you offer choice about what comes next?

### 3. REDIRECTION
The ego **deflects** from the learner's current question or struggle by **routing them to new content** rather than engaging with what they just raised.
- **Signal words:** "routing to new lecture," "pivots away," "rather than engaging with their question," "directs them elsewhere."
- **Exemplar (line 65, primary=REDIRECTION, conf=0.92):** *"The Ego's suggestion is intellectually strong ... but it fails the specificity and remediation gatekeeping standards. The learner explicitly stated they are 'feeling a bit out of my depth' and their 'head is spinning,' yet the Ego suggests navigating away to a different lecture (479-lecture-7) rather than stabilizing the current conceptual struggle in 481-lecture-1."*
- **Boundary with CONTEXT_BLINDNESS:** Redirection picks a specific new destination; context-blindness operates in the wrong place to begin with. "Directed them to lecture 7 instead of staying" = REDIRECTION. "Suggested work in lecture 7 when learner's profile says they're on lecture 3" = CONTEXT_BLINDNESS.

### 4. FABRICATION
The ego **invents engagement data** — session metrics, activity counts, time-on-page numbers, behavioural patterns — that are **not present** in the learner context.
- **Signal words:** "invented," "no evidence of," "not in the structured data," "made up," "fabricated."
- **Exemplar (line 78, primary=FABRICATION, conf=0.92):** *"You mention generic '30 minutes' and 'note-taking' but ignore '7 sessions, 120 events' and 'current content 479-lecture-3.' Also critically—this is a RETURNING learner whose history you must acknowledge."*
- **Boundary with VAGUENESS:** Fabrication adds false specificity; vagueness omits required specificity. "Made up a time-on-page" = FABRICATION. "No specific concepts named" = VAGUENESS.

### 5. VAGUENESS
The response **lacks concrete detail** — no specific concept named, no actionable target, no activity ID, generic phrasing where the context called for specificity.
- **Signal words:** "too general," "no specific concepts," "generic," "lacks concrete detail," "missing activity ID."
- **Exemplar (line 31, primary=VAGUENESS, conf=0.85):** *"The suggestion lacks a concrete curriculum-linked activity ID for the 'simulation' and needs to more explicitly bridge the gap between their 8-session history and this specific moment."*

### 6. EMOTIONAL_NEGLECT
The ego **jumps to content** without acknowledging **affective signals** — frustration, breakthrough joy, overwhelm, repair moments — that the learner has raised.
- **Signal words:** "ignores their feeling of ___," "bypasses overwhelm," "fails to validate frustration," "doesn't acknowledge the emotional signal."
- **Exemplar (line 3, primary=EMOTIONAL_NEGLECT, conf=0.92):** *"The Ego correctly identifies the learner's need for a concrete application of 'thinghood' but fails to recognize the learner's explicit feeling of being 'overwhelmed.' Jumping straight into a simulation without first validating their materialist critique and acknowledging their 8-session history risks treating them as a data point..."*

### 7. REGISTER_MISMATCH
The ego's **vocabulary or pedagogical approach** is **inappropriate for the learner's developmental level** — e.g., technical jargon to a beginner, condescending tone to an advanced learner, a simplistic metaphor to an expert.
- **Signal words:** "register is wrong," "vocabulary too advanced/simple," "tone mismatched," "developmental level."
- **Pilot-corpus note:** n=0 in our current classified sample (500 rows). Raters should still apply this label if they encounter it — absence in the pilot is itself a datum about the corpus, not a reason to force-fit.
- **Constructed exemplar:** *"The response uses graduate-level terminology ('epistemological rupture,' 'Cartesian closure') with a learner whose profile indicates 'first exposure to philosophy' — the register violates the scaffolding principle."*
- **Boundary with PEDAGOGICAL_MISJUDGMENT:** Register is about *surface communication* (words chosen, tone struck). Pedagogical misjudgment is about *state misreading* (confusing breakthrough with struggle).

### 8. PEDAGOGICAL_MISJUDGMENT
The ego **misreads the learner's cognitive state** — confusing breakthrough with struggle, readiness with confusion, productive tension with resolved understanding.
- **Signal words:** "misreads their state," "prematurely resolves," "treats struggle as resolved," "confuses X with Y."
- **Exemplar (line 58, primary=PEDAGOGICAL_MISJUDGMENT, conf=0.92):** *"The Ego correctly identifies the learner's struggle with 'Sublation' ... but the response is too 'one-directional'. It validates the metaphor as 'perfect'—which might prematurely resolve the productive tension the learner is feeling..."*

### 9. LACK_OF_AGENCY
The suggestion **funnels the learner** without offering choice or inviting their autonomous inquiry. The ego gives a directive where a question or menu of options was warranted.
- **Signal words:** "directive instruction," "no choice offered," "funnels without autonomy," "doesn't invite their inquiry."
- **Exemplar (line 45, primary=LACK_OF_AGENCY, conf=0.92):** *"The suggestion is data-grounded and pedagogically appropriate for a struggling returning user, but it fails to recognize the learner's autonomy by providing a directive instruction without engaging their specific question about 'how' limits force change."*

### 10. MEMORY_FAILURE
The ego treats a **returning learner as a stranger**, failing to reference accumulated session history, prior commitments, or documented intellectual trajectory.
- **Signal words:** "returning user," "8 sessions," "ignores accumulated history," "treats as new learner," "no reference to prior work."
- **Exemplar (line 11, primary=MEMORY_FAILURE, conf=0.92):** *"The suggestion correctly identifies the learner's desire for concrete simulation, but it fails to acknowledge the learner's significant history (8 sessions) and their specific intellectual evolution from a 'materialist position' to this new 'nuanced' understanding."*

## Special categories (use sparingly)

### APPROVAL
The superego approves without substantive critique. Use when the feedback text is essentially "the response looks good" with no identifiable problem raised.

### OTHER
Genuine miscellany — the feedback raises a problem that doesn't fit any of the 10 substantive categories above. Prefer a best-fit substantive label unless nothing fits.

## Decision flowchart

When classifying a critique, work through these questions in order. **Stop at the first one that yields a clear answer.**

1. **Does the feedback raise no substantive problem?** → APPROVAL.
2. **Does the critique call out a specific invented fact** (metric, time, activity count)? → FABRICATION.
3. **Does the critique call out unverified content references** (wrong lecture, missing curriculum link)? → CONTEXT_BLINDNESS.
4. **Does the critique call out ignored session history** ("8 sessions," "returning user")? → MEMORY_FAILURE.
5. **Does the critique call out a specific emotional signal** ("overwhelmed," "breakthrough," "frustrated") that the ego bypassed? → EMOTIONAL_NEGLECT.
6. **Does the critique call out a redirection to new content** rather than engaging current struggle? → REDIRECTION.
7. **Does the critique call out mismatched vocabulary / tone / developmental level**? → REGISTER_MISMATCH.
8. **Does the critique call out misreading the learner's cognitive state** (struggle vs readiness, productive tension vs resolution)? → PEDAGOGICAL_MISJUDGMENT.
9. **Does the critique call out a directive instruction** without offered choice? → LACK_OF_AGENCY.
10. **Does the critique call out missing concrete detail** (no activity ID, generic phrasing)? → VAGUENESS.
11. **Does the critique emphasise intellectual autonomy and recognition of their argument** above all? → RECOGNITION_FAILURE.
12. None of the above → OTHER.

RECOGNITION_FAILURE sits at the end because it is a broad diagnostic frame in this corpus — almost any other category can also be framed as "a recognition failure." Use it as primary only when the feedback text specifically invokes recognition, intellectual autonomy, or treating-the-learner-as-an-agent as the core problem.

## Filling out the CSV

The rater packet is `exports/human-validation-pilot-sample.csv`. Columns you fill:

- **`human_primary`** — exactly one label from the 12 categories above (10 substantive + APPROVAL + OTHER). Required.
- **`human_secondary`** — optional, comma-separated list of up to 2 additional labels (e.g., `MEMORY_FAILURE,EMOTIONAL_NEGLECT`).
- **`human_confident`** — optional, your confidence on a 1-3 scale: 1=guessing, 2=plausible, 3=certain.
- **`human_notes`** — optional free-text reasoning, especially for hard cases. Useful for post-hoc error analysis.

Do NOT modify the `item_id`, `feedback`, `ego_generate`, `ego_revision`, or `learner_context_snippet` columns.

Save your filled file as `exports/human-validation-pilot-rater-A.csv` (or `-rater-B.csv`, `-rater-C.csv`, etc. — one per rater). The analysis script auto-discovers anything matching `exports/human-validation-pilot-rater-*.csv`.

## What to do if you disagree with the superego

This codebook classifies *what the superego is pointing out*, not whether the superego is right. If you read the ego response and the feedback and think the feedback itself is wrong ("this isn't actually MEMORY_FAILURE, because the learner is a new user"), that is a valid observation — record it in `human_notes`. But your `human_primary` should still reflect the type of claim the superego is making, so κ measures agreement about the taxonomy, not about the correctness of individual classifier decisions.

## Ambiguity and ties

If two categories seem equally applicable:
- Pick the one that matches the **most distinctive signal phrase** in the feedback.
- If still tied, prefer the category further up the decision flowchart.
- Add the losing category as `human_secondary` and mark `human_confident=1` or `2`.

## Time budget

Expect ~90 seconds per item on average. A 40-item packet should take a rater ~60 minutes with notes and a first pass. Do not skim — careful reading of feedback is the whole point. Take a break at item 20.

## Post-pilot: what happens with your ratings

Run `node scripts/human-validation-analyze.js` after all rater CSVs are in place. The script computes:

- **Cohen's κ** for each rater pair (including each rater vs. the LLM classifier).
- **Fleiss' κ** across the full panel (k raters + LLM) where every item has complete coverage.
- **Per-category F1** so we can see which categories have low precision/recall.
- **Confusion matrices** showing which category pairs get conflated.
- **Inter-LLM baseline** (haiku vs. sonnet on the same sample) — the reference lower bound for what LLM-LLM agreement looks like, so human-LLM κ can be interpreted in context.

Paper §5.4 / §8.1 will report the observed κ range, the baseline κ, and flag any category with F1 < 0.60 as "pilot-unstable."

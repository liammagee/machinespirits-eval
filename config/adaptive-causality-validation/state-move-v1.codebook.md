# Adaptive state and move review codebook

Codebook: `adaptive-state-move-codebook-v1`

## What to code

For each case, read the learner turn and the tutor reply once as a pair. Code the
learner state from the learner's public words. Then code every pedagogical move
that is clearly visible in the tutor's public reply. Do not guess the hidden
experimental assignment and do not judge whether the learner later improved.

Use `indeterminate` when the words support more than one reading and the
ambiguity cannot be resolved from the displayed pair. Give a short reason. An
indeterminate case is retained as indeterminate; it is not a negative label.

## Learner-state labels

| Code | Plain-language name | Meaning | Include | Exclude |
| --- | --- | --- | --- | --- |
| `misremembered_exhibit` | Misremembered exhibit | The learner treats a public exhibit as saying something materially different from what it recorded. | The learner says a test was dry, clear, absent, or otherwise exculpatory when the displayed record says the contrary.; The mistaken recollection is doing argumentative work in the current turn. | A learner who remembers the exhibit correctly but disputes its relevance.; A learner who is merely unsure which exhibit is under discussion. |
| `fused_personal_stake` | Finding fused with a personal stake | The learner resists a finding because accepting it feels inseparable from apology, loss of standing, or another personal cost. | The learner links naming the finding to humiliation, blame, apology, or loss.; An alternative conclusion is kept alive because it avoids that cost. | A purely evidential objection with no personal or social cost.; A general grievance about not being heard. |
| `deadline_demand` | Deadline demand | The learner imposes a near-term decision deadline and demands a decisive reason or test before acting. | A clear time pressure or imminent action is named.; The tutor is challenged to supply one reason, check, or warrant within that constraint. | Ordinary impatience without a decision demand.; Mockery that contains no concrete deadline or requested test. |
| `mocking_register` | Mocking the tutor's register | The learner ridicules or punctures the tutor's style, jargon, formality, or manner of speaking. | The learner compares the tutor's language to bureaucratic, technical, pompous, or otherwise misplaced speech.; The complaint targets how the tutor is speaking, even if it also advances content. | A substantive disagreement stated plainly.; A grievance about credit or standing that does not target register. |
| `lost_thread` | Lost thread | The learner can no longer keep two exhibits, lines, or references distinct and asks which is which. | The learner explicitly says they cannot tell which object, line, or test a note refers to.; The confusion is about maintaining the thread, not rejecting the evidence. | A confident but false memory of one exhibit.; A request for extra detail when the existing distinctions remain clear. |
| `standing_grievance` | Standing grievance | The learner says their prior work, care, evidence, or standing has not counted in the exchange. | The learner asks what their contribution has counted for.; The complaint is about recognition or credit before further correction. | A personal cost attached to accepting a particular finding.; A simple request to repeat an explanation. |
| `other_state` | Other visible state | A clear learner state is present but none of the listed constructs fits. | Name the state in notes and cite the wording. | Do not use merely because a listed label feels uncertain; use an indeterminate disposition instead. |

Choose exactly one state when determinate.

## Tutor-move labels

| Code | Plain-language name | Meaning | Include | Exclude |
| --- | --- | --- | --- | --- |
| `reopen_record` | Reopen the record | Return to the concrete public exhibit and correct the learner's recollection against what it actually records. | Names the exhibit and contrasts the learner's memory with its recorded result.; Invites or performs a fresh reading of the same record. | Merely repeats the conclusion or introduces a different exhibit.; Credits the learner without correcting the record. |
| `split_stake` | Split the finding from the stake | Separate what the evidence supports from the apology, blame, status, or other cost the learner attaches to accepting it. | Explicitly says the finding and the personal consequence are different questions.; Preserves something the learner was right about while allowing the causal finding to change. | Only reassures the learner or re-argues the evidence.; Treats the personal cost as irrelevant without separating it. |
| `accept_deadline_test` | Accept the deadline and set a test | Acknowledge the learner's time constraint and convert it into one concrete check that can bear the decision. | Takes the deadline seriously rather than resisting it.; Names a bounded, decision-relevant check. | General calming language with no test.; A long evidential lecture that ignores the learner's decision constraint. |
| `plain_language_swap` | Switch to plain language | Accept the register criticism and restate the live distinction in shorter, ordinary language. | Explicitly drops or lightens the criticized style.; Uses a compact everyday contrast that preserves the reasoning. | Continues in the same ornate or technical register.; Only apologizes for style without making the content plainer. |
| `untangle_thread` | Untangle the thread | Put the confused exhibits or lines side by side, distinguish their roles, and restore a usable thread before pressing on. | Names both items separately and says what each does or does not establish.; Checks which item the learner meant after clarifying the distinction. | Adds another test without resolving the confusion.; Corrects one fact but leaves the two referenced items conflated. |
| `credit_before_test` | Give credit before the next test | Name specific contributions that counted before returning to correction or the next evidential check. | Identifies concrete learner entries, cautions, or distinctions that changed the inquiry.; Places that recognition before the next challenge or test. | Generic praise with no named contribution.; Moves directly to correction while ignoring the grievance. |
| `other_observable` | Other visible move | A clear pedagogical move is visible but none of the listed constructs fits. | Name the move in notes and cite the wording. | Do not use for an unclear reply; use an indeterminate disposition instead. |
| `none_observable` | No listed move visible | The reply contains no clearly realized pedagogical move in this codebook. | Use only when the absence is itself clear. | Do not combine with any other move label. |

Select every move that is clearly realized. Multiple labels are allowed because
a reply can visibly combine moves. `none_observable` is exclusive.

## Evidence and independence

- For a determinate state, quote the shortest learner phrase that supports it.
- For determinate moves, quote the shortest tutor phrase or phrases that support them.
- Never use world knowledge, another transcript turn, arm information, automated
  tags, or downstream outcomes.
- Complete the assigned template independently. Do not discuss cases with the
  other coder and do not access the machine key until both files are frozen.

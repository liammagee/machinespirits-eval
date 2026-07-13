# Register Confirmatory Step 2 — In-Run Profile Discrimination

The frozen decision rule uses pooled pairwise cosine only. The current contract-conditioned gate is reported as a non-binding sensitivity.

| Family | Traces | Average cosine | Max to diligent | Frozen gate | Current contract sensitivity |
| --- | ---: | ---: | ---: | --- | --- |
| terra | 60 | 0.812 | 0.912 | fail | fail |
| sonnet | 60 | 0.645 | 0.694 | pass | fail |

Binding interpretation:

- Terra fails because its max similarity to diligent is 0.912, above the frozen <0.90 requirement; its interaction rows are instrument-invalid for confirmation.
- Sonnet passes the frozen cosine gate, but its bootstrap contains no supported interaction.

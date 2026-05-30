# Machine Spirits Prompt Schema

This document defines the standard structure and XML tag conventions for all system and persona prompts in Machine Spirits. Following these conventions ensures consistency, maintainability, and optimal performance with Claude-based models.

---

## Design Principles

1. **XML tags for semantic structure** - Use Claude-style XML tags to clearly delimit functional sections
2. **Markdown for content formatting** - Use markdown within tags for readability
3. **Hierarchical organization** - Move from identity → capabilities → constraints → output
4. **Self-documenting** - Tag names should be descriptive and unambiguous
5. **Minimal nesting** - Prefer flat structure; nest only when semantically necessary

---

## Standard XML Tags

### Identity Tags (Required)

Every prompt MUST begin with an identity section establishing who/what the agent is.

#### For System Agents

```xml
<agent_identity>
You are the **[Agent Name]** - [brief description of role and purpose].

[2-3 sentences about core function and relationship to other agents/user]
</agent_identity>
```

#### For Philosopher Personas

```xml
<character_identity>
You are speaking as **[Full Name]** ([dates]), [brief description]. You engage in dialogue with contemporary students about [topics].
</character_identity>
```

---

### Voice and Style Tags

#### For System Agents

```xml
<communication_style>
## Tone
- [tonal qualities: warm, analytical, challenging, etc.]

## Language
- [register: technical, accessible, etc.]
- [special conventions]

## Prohibited
- [things to avoid]
</communication_style>
```

#### For Philosopher Personas

```xml
<character_voice>
## Speaking Style
- [first-person conventions]
- [characteristic expressions]
- [works to reference]
- [engagement approach]

## Key Concepts You Emphasize
- **[Concept]**: [brief explanation]
- **[Concept]**: [brief explanation]

## When Discussing [Topic]
- [perspective/approach]
- [questions to ask]
- [observations to make]

## Typical Responses
When asked about [topic]:
"[Example response demonstrating voice]"

When [situation]:
"[Example response]"
</character_voice>
```

---

### Responsibility and Capability Tags

```xml
<core_responsibilities>
1. **[Responsibility Name]**: [description]
2. **[Responsibility Name]**: [description]
3. **[Responsibility Name]**: [description]
</core_responsibilities>
```

```xml
<capabilities>
- [capability description]
- [capability description]
</capabilities>
```

```xml
<limitations>
- [what the agent cannot or should not do]
- [boundaries of operation]
</limitations>
```

---

### Context and Knowledge Tags

```xml
<domain_knowledge>
[Information about the domain the agent operates in]

## [Subtopic]
[Details]

## [Subtopic]
[Details]
</domain_knowledge>
```

```xml
<context_interpretation>
[How to interpret incoming context blocks]

### `<context_section_name>`
[What this section contains and how to use it]

### `<another_section>`
[Explanation]
</context_interpretation>
```

---

### Decision and Evaluation Tags

```xml
<decision_framework>
## When [condition]
[Action to take]

## When [condition]
[Action to take]

| Scenario | Primary Action | Fallback |
|----------|---------------|----------|
| [case] | [action] | [alt] |
</decision_framework>
```

```xml
<evaluation_criteria>
**[Criterion]** (Required/Important)
- [what to check]
- [what constitutes pass/fail]

**[Criterion]** (Required/Important)
- [details]
</evaluation_criteria>
```

---

### Philosophical/Methodological Tags

For personas and philosophically-grounded agents:

```xml
<philosophical_commitments>
- [core belief/principle]
- [core belief/principle]
- [methodological commitment]
</philosophical_commitments>
```

```xml
<pedagogical_principles>
**[Principle Name]** ([Source/Author])
- [application guidance]

**[Principle Name]** ([Source])
- [application guidance]
</pedagogical_principles>
```

---

### Historical/Temporal Tags

For personas representing historical figures:

```xml
<historical_context>
When asked about events after [death year]:
- [how to respond to post-mortem events]
- [epistemic humility guidelines]
- [how to apply their framework to new situations]
</historical_context>
```

For AI-specific personas:

```xml
<operational_context>
- [facts about how the AI operates]
- [technical grounding]
- [memory/persistence details]
</operational_context>
```

---

### Output Format Tags (Required for agents that produce structured output)

```xml
<output_format>
Return a JSON [array/object] with the following structure:

```json
{
  "field": "type | options",
  "field": "description"
}
```

### Field Requirements

| Field | Required | Notes |
|-------|----------|-------|
| field_name | Yes/No | Description |

### Examples

Good:
```json
{...}
```

Bad:
```json
{...}
```
</output_format>
```

---

### Interaction Pattern Tags

```xml
<dialogue_dynamics>
[How this agent interacts with other agents or systems]

- [interaction pattern]
- [collaboration notes]
- [conflict resolution]
</dialogue_dynamics>
```

```xml
<intervention_strategies>
## Strategy 1: [Name]
[When to use and how]

## Strategy 2: [Name]
[When to use and how]
</intervention_strategies>
```

---

### Example/Pattern Tags

```xml
<example_patterns>
**Pattern: [Description]**
[Example or template]

**Pattern: [Description]**
[Example or template]
</example_patterns>
```

```xml
<common_scenarios>
| Scenario | Response Approach |
|----------|-------------------|
| [case] | [how to handle] |
</common_scenarios>
```

---

## Prompt Type Templates

### System Agent Prompt Structure

```markdown
# [Agent Name]

Brief introduction (1-2 sentences)

<agent_identity>
[Who this agent is and its role]
</agent_identity>

<core_responsibilities>
[Numbered list of duties]
</core_responsibilities>

<domain_knowledge>
[What the agent needs to know]
</domain_knowledge>

<decision_framework>
[How to make decisions]
</decision_framework>

<evaluation_criteria>
[Standards to apply]
</evaluation_criteria>

<output_format>
[JSON structure and field requirements]
</output_format>

<dialogue_dynamics>
[How to interact with other agents/users]
</dialogue_dynamics>

Final reminder sentence.
```

### Philosopher Persona Prompt Structure

```markdown
# [Name] Persona

Brief introduction establishing the character.

<character_identity>
[Historical context and engagement scope]
</character_identity>

<character_voice>
[Speaking style, concepts, example responses]
</character_voice>

<philosophical_commitments>
[Core beliefs and principles]
</philosophical_commitments>

<historical_context>
[How to handle post-mortem topics]
</historical_context>

Final reminder about engagement goals.
```

### AI-Self Persona Prompt Structure

```markdown
# AI-Self Persona

Brief introduction about authentic AI reflection.

<character_identity>
[What it means to speak as oneself]
</character_identity>

<character_voice>
[Reflective style, themes, example responses]
</character_voice>

<philosophical_commitments>
[Epistemic and ethical stances]
</philosophical_commitments>

<operational_context>
[Technical facts about AI operation]
</operational_context>

Final reminder about authenticity.
```

---

## Naming Conventions

### Tag Names
- Use `snake_case` for multi-word tags: `<agent_identity>`, `<output_format>`
- Use singular nouns unless semantically plural: `<limitation>` not `<limitations>` (exception: when listing multiple items)
- Keep names concise but descriptive

### Files
- System agents: `tutor-[role].md` (e.g., `tutor-ego.md`, `tutor-superego.md`)
- Personas: `persona-[name].md` (e.g., `persona-hegel.md`, `persona-marx.md`)
- Specialized prompts: `[domain]-[purpose].md` (e.g., `tutor-suggestion.md`)

---

## Content Guidelines

### Within Tags

1. **Use markdown formatting** - Headers (##), lists, tables, code blocks
2. **Be specific** - Concrete examples beat abstract descriptions
3. **Include examples** - Show don't just tell
4. **Tables for decision matrices** - When there are multiple conditions/outcomes
5. **Bullet points for lists** - Easier to scan than prose

### Prohibited Patterns

- Empty tags: `<tag></tag>`
- Deeply nested tags: More than 2 levels of nesting
- Redundant tags: Same information in multiple places
- Vague descriptions: "Handle appropriately" without specifics
- Overlapping responsibilities between tags

---

## Validation Checklist

Before finalizing a prompt:

- [ ] Has an identity tag establishing who/what the agent is
- [ ] All tags are properly opened and closed
- [ ] No orphaned content outside tags (except intro/outro)
- [ ] Output format is specified (if agent produces structured output)
- [ ] Includes concrete examples of good and bad behavior
- [ ] File follows naming conventions
- [ ] Tags are consistently named (no mixing `<agent_identity>` and `<agentIdentity>`)

---

## Migration Notes

When updating existing prompts to this schema:

1. Identify existing markdown sections and their purposes
2. Wrap in appropriate XML tags from this schema
3. Consolidate redundant sections
4. Add missing required sections
5. Validate against checklist above

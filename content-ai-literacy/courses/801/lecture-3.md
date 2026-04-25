## Prompt-and-Compare: Auditing Cultural Artifacts with AI

The previous lecture taught a vocabulary for reading short-form video as craft. This one teaches what to do once you have that vocabulary: a critical method for using generative AI as an analytical instrument rather than as a black box. The method has a name in recent empirical work — *recursive analytic-generative design* — and a much shorter informal name we will use here: *prompt-and-compare*. The logic is straightforward. Take a real cultural artifact. Decompose it using the four-layer vocabulary from Lecture 2. Translate the decomposition into a structured prompt. Run the prompt through one or more generative video models. Compare the outputs against the original. The comparison is the analysis.

What this method delivers is not a copy of the original — that is not the goal — but a diagnostic of what the model has and has not learned about the genre to which the original belongs. The gaps are where literacy lives.

### Why This Works

Three properties of contemporary generative video models make prompt-and-compare productive. First, the models are highly responsive to structured prompting; a prompt that names auditory dynamics, visual elements, character framing, and discourse explicitly elicits substantially different outputs than a prompt that says only "make me an influencer video." Second, the models embed defaults — about race, gender, language, gesture, setting — that surface most clearly when the prompt does not specify those features. Third, the models have characteristic failure modes — symbolic text, irony, durations beyond fifteen seconds — that are stable enough to be predicted in advance and audited systematically.

These three properties together mean that two different runs of the method, on the same artifact, by the same analyst, with the same model, will produce broadly comparable findings. The method is reproducible enough to teach.

### The Procedure

In its simplest form, the procedure has six steps.

**Step one: select a target artifact.** A thirty-to-sixty-second clip with clearly identifiable craft on each of the four layers. Educational influencer clips are a good starting point because the layers are unusually legible.

**Step two: decompose.** Watch the clip three times, taking notes per layer: auditory (pitch range, tempo, music), visual (shot sizes, color palette, gesture), character (relational role, age/gender/class signaling), discourse (direct address, rhetorical questioning, topic and subtext). Be specific. Vague notes produce vague prompts produce uninformative outputs.

**Step three: translate to a prompt.** Convert the notes into a structured prompt. A useful template names the four layers explicitly: "A [character description] speaks directly to camera in [shot framing], using [auditory pattern], delivered with [gestural style], discussing [topic] with [rhetorical structure]." Resist the temptation to specify race, age, or gender when these are not part of what you are testing — the omission is what surfaces the model's defaults.

**Step four: generate.** Run the prompt through at least two models when possible. The recent literature uses both Sora 2 (OpenAI) and Vidu Q3 (a Chinese model) in parallel, and the comparison between the two produces some of the method's most useful findings. If only one model is available, run the prompt twice with no other change to test stability.

**Step five: compare.** For each of the four layers, document what the AI reproduced, what it modified, and what it missed entirely. Attend especially to features that appeared without being prompted (defaults) and features that the prompt requested but the model could not deliver (failures).

**Step six: interpret.** Defaults are claims about what the model has learned to assume. Failures are claims about what the model has not yet been able to encode. Both are findings. A short report — a paragraph or two per layer — is enough to make the diagnostic explicit.

### What Comes Out

Two kinds of finding recur in this method when applied to Chinese influencer content, and both are pedagogically valuable.

The first is *default bias*. When the prompt omits race, gender, or national origin, models reveal what they have absorbed as the unmarked case. In one recent study, a prompt describing a Chinese-platform influencer with no racial cues produced native Chinese faces in Vidu Q3 (a Chinese model) and "non-Asian faces or American-born Chinese appearances" in Sora 2 (a US model). When the same prompt described an interaction among a reporter, an employee, and a boss, Sora 2 first generated a female reporter, an African-American employee, and a white male boss; on regeneration it produced three white men. These are not impersonation failures. They are revelations of what the model treats as *default*. Reading those defaults is direct AI literacy practice.

The second is *capability ceiling*. There are features of charismatic short-form video that current models do not yet reproduce well, and these too are stable enough to be audited. Chinese characters are frequently corrupted; mathematical and physical formulas garble; durations beyond fifteen seconds force segmented prompting; irony, exaggeration, and implicit social commentary fail in characteristic ways. A clip whose effect depends on understatement or knowing irony will reliably be produced as a flatter, more literal version of itself. Naming these ceilings produces a practical skill: reading a real clip and knowing in advance which of its features would survive AI reproduction and which would not.

### A Note on Ethics

Prompt-and-compare is an analytical method, not a production method. The clips it generates are tools of inquiry, not artifacts to publish. The named individuals whose work informs the prompts deserve attribution in any written analysis, and the generated outputs should not be presented as if they were the work of those individuals. The point of the method is to read more carefully, not to manufacture more content. AI literacy that loses sight of this distinction has stopped being literacy and started being something else.

### Practice

By the end of this lecture you should be able to take an unfamiliar short-form clip, run the six-step procedure, and produce a structured comparison document. The document is the deliverable; the comparison is the analysis. The next lecture takes a step back and asks what this kind of analysis tells us about a phenomenon larger than any individual clip — about *artificial charisma* as a feature of the contemporary media environment.

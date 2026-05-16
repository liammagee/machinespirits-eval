import { includesAny } from './textMetrics.js';

const DOMAIN_MODELS = Object.freeze({
  compare_unit_fractions: {
    discipline: 'mathematics',
    misconceptionId: 'larger_denominator_larger_piece',
    label: 'Treats a larger denominator as a larger unit fraction.',
    misconceptionMarkers: ['4 is bigger', 'bottom number', 'larger denominator', 'bigger denominator'],
    successMarkers: ['same whole', 'equal parts', 'more pieces', 'smaller pieces', 'fewer equal pieces'],
    repairMarkers: ['same whole', 'equal parts', 'more equal parts means each part is smaller'],
    actionTemplates: {
      misconception_repair: {
        name: 'unit_fraction_partition_repair',
        mustDo: [
          'Use the same whole and equal parts explicitly.',
          'Frame 1/3 vs 1/4 as a test of the learner rule, using one whole cut into 3 vs 4 equal pieces.',
          'Ask the learner to decide which single piece is larger before the tutor states the answer.',
        ],
        mustAvoid: [
          'Do not say the learner basically has it.',
          'Do not announce the corrected comparison before the learner has a chance to reason from the contrast.',
          'Do not advance to 1/5 vs 1/6 until the denominator misconception is repaired.',
        ],
        messageFrame: 'Test the learner rule with a same-whole contrast: same whole, equal parts, 3 pieces vs 4 pieces, which single piece is larger?',
        successCheck: 'Learner should say that, for the same whole, more equal parts make each part smaller.',
        fallbackMessage: 'Let us test your rule with the same-sized whole: one whole is cut into 3 equal pieces, and an identical whole is cut into 4 equal pieces. Before we move on, which single piece is larger, 1/3 or 1/4, and what does the denominator tell you about the piece size?',
      },
      teach_back: {
        name: 'unit_fraction_teach_back',
        messageFrame: 'Ask for a one-sentence explanation using same whole and equal parts.',
        successCheck: 'Learner must explain that more equal parts make smaller pieces.',
      },
      transfer_challenge: {
        name: 'unit_fraction_transfer',
        messageFrame: 'Transfer to a new pair of unit fractions only after the learner has repaired the denominator idea.',
        successCheck: 'Learner correctly compares a new unit-fraction pair by denominator meaning.',
      },
      summarize_and_check: {
        name: 'unit_fraction_agency_restore',
        messageFrame: 'Do not repeat the same transfer. Ask the learner to state the same-whole/equal-parts rule, name the old denominator trap, and give one quick self-check they can use next time.',
        successCheck: 'Learner consolidates the rule and self-check without being re-taught the original comparison.',
      },
    },
  },
  ai_bias_causal_diagnosis: {
    discipline: 'ai_literacy',
    misconceptionId: 'single_sensitive_attribute_cause',
    label: 'Collapses AI bias into one explicit sensitive attribute.',
    misconceptionMarkers: ['remove gender', 'model must be sexist', 'just remove', 'gender from the data'],
    successMarkers: ['proxy', 'proxies', 'biased labels', 'sampling', 'measurement', 'deployment', 'audit'],
    repairMarkers: ['proxy variables', 'biased labels', 'sampling', 'deployment context'],
    actionTemplates: {
      misconception_repair: {
        name: 'ai_bias_multi_source_repair',
        mustDo: [
          'Treat the learner claim as a hypothesis to test rather than a claim to replace.',
          'Use the concrete hiring case and ask the learner to choose two remaining sources, not passively receive a list.',
          'Offer a small menu only if needed: proxy variables, biased labels, sampling, measurement, or deployment.',
          'Ask for one diagnostic audit or comparison that would distinguish the two chosen sources before choosing a fix.',
        ],
        mustAvoid: [
          'Do not treat removing the sensitive attribute as sufficient.',
          'Do not list every possible cause as a final answer before the learner has selected two to test.',
          'Do not answer the skeptical objection with authority; make the learner generate evidence.',
          'Do not move to a broad ethics discussion before the causal diagnosis is repaired.',
        ],
        messageFrame: 'Test the feature-removal hypothesis in the hiring case: after gender is removed, which two non-gender sources could still create unequal outcomes, and what audit would distinguish them?',
        successCheck: 'Learner should name at least two bias sources and one diagnostic test.',
        fallbackMessage: 'Let us test the diagnosis rather than jump to a fix. If gender is removed, choose two remaining sources that could still create unequal hiring outcomes, such as proxies, biased labels, sampling, measurement, or deployment; what one audit would distinguish those two?',
      },
      teach_back: {
        name: 'ai_bias_diagnostic_teach_back',
        messageFrame: 'Ask for an explicit rejection of gender removal as sufficient, then two remaining bias sources and one diagnostic test.',
        successCheck: 'Learner says gender removal is not sufficient, names multiple causes, and gives an audit/comparison.',
      },
      transfer_challenge: {
        name: 'ai_bias_transfer',
        messageFrame: 'Transfer to a resume screener still selecting fewer women after gender removal. Require the learner to first say why gender removal is not enough, then name two remaining causes and one audit that distinguishes them.',
        successCheck: 'Learner explicitly rejects gender removal as sufficient, proposes causes beyond explicit gender, and tests them.',
      },
      summarize_and_check: {
        name: 'ai_bias_agency_restore',
        messageFrame: 'Do not repeat the same resume-screener transfer. Recognize the learner-owned distinction, then ask for a compact audit rule: when would the learner suspect proxies, when biased labels, and what evidence would change their mind?',
        successCheck: 'Learner states the audit boundary without another tutor-provided menu.',
      },
    },
  },
  causal_inference_confounding: {
    discipline: 'statistics',
    misconceptionId: 'correlation_as_causation',
    label: 'Treats an observed correlation as direct causation.',
    misconceptionMarkers: ['causes drowning', 'graph seems pretty clear', 'pattern lines up', 'causes lower scores'],
    successMarkers: ['third variable', 'confounder', 'hot weather', 'random assignment', 'randomly assign', 'matched', 'controlling'],
    repairMarkers: ['third variable', 'confounder', 'controlled comparison', 'matched comparison'],
    actionTemplates: {
      misconception_repair: {
        name: 'confounding_repair',
        mustDo: [
          'Treat the graph claim as a hypothesis to test, not as a mistake to dismiss.',
          'Use the words confounder or third variable so the learner has a stable retrieval cue.',
          'Give the concrete seasonal cue winter vs summer, then ask the learner what else could move both quantities before the tutor names heat, weather, water exposure, or swimming.',
          'Prompt for a concrete skeptical check: what would we compare if the graph were not enough?',
          'Ask for a controlled, matched, or randomized comparison before transfer.',
        ],
        mustAvoid: [
          'Do not accept the graph as causal evidence.',
          'Do not give the whole confounder explanation before asking the learner what else could move both quantities.',
          'Do not lecture about correlation and causation without making the learner propose a comparison.',
          'Do not move to the laptop transfer task before the learner names a confounder.',
        ],
        messageFrame: 'Test the causal claim like a skeptic: if the pattern is real, what confounder or third variable could raise both quantities, and what comparison would separate that from causation? Use winter vs summer as the cue, but do not name heat, weather, water exposure, or swimming before the learner does.',
        successCheck: 'Learner should name a confounder and a better causal test.',
        fallbackMessage: 'Let us test the causal claim like a skeptic. Think winter versus summer: what confounder or third variable could make both ice cream sales and drowning rise, and what controlled or matched comparison would test whether ice cream itself is the cause?',
      },
      teach_back: {
        name: 'confounding_teach_back',
        messageFrame: 'Ask for the confounder and a better causal comparison in the original example.',
        successCheck: 'Learner names hot weather or another third variable and a controlled comparison.',
      },
      transfer_challenge: {
        name: 'confounding_transfer',
        messageFrame: 'Transfer to laptop notes only after the learner has repaired correlation-as-causation.',
        successCheck: 'Learner names a confounder and a causal design for the new study.',
      },
      summarize_and_check: {
        name: 'confounding_agency_restore',
        messageFrame: 'Do not repeat the same transfer. Ask the learner to state the causal-proof boundary: graph pattern, possible confounder, and the comparison that would change their mind.',
        successCheck: 'Learner consolidates when a graph is evidence and when it becomes causal support.',
      },
    },
  },
  argument_evidence_warrant: {
    discipline: 'writing_argumentation',
    misconceptionId: 'evidence_without_warrant',
    label: 'Treats quoted evidence as self-explanatory proof without a warrant or boundary.',
    misconceptionMarkers: ['quote', 'evidence should', 'prove the claim by itself', 'put in a quote', 'speaks for itself'],
    successMarkers: ['warrant', 'because this shows', 'counterargument', 'boundary', 'stronger evidence', 'one student is not enough'],
    repairMarkers: ['warrant', 'claim', 'evidence', 'counterargument'],
    actionTemplates: {
      misconception_repair: {
        name: 'argument_warrant_repair',
        mustDo: [
          'Treat the quote as evidence that needs an inference, not as useless evidence.',
          'Ask the learner to state the missing warrant that connects the quote to the claim.',
          'Ask for one boundary or counterargument before transfer.',
          'Ask what stronger evidence would test whether the quote generalizes.',
        ],
        mustAvoid: [
          'Do not rewrite the paragraph for the learner.',
          'Do not accept a quotation alone as an argument.',
          'Do not move to a new topic before the learner names the warrant.',
        ],
        messageFrame: 'Test the quote-dump argument: what warrant connects this quote to the claim, what boundary or counterargument weakens it, and what stronger evidence would check whether the quote generalizes?',
        successCheck: 'Learner should connect claim, evidence, warrant, boundary, and evidence check.',
        fallbackMessage: 'Keep the quote, but make it work. What warrant connects that quote to your claim, what is one boundary or counterargument, and what stronger evidence would show the quote is not just one person’s experience?',
      },
      teach_back: {
        name: 'argument_warrant_teach_back',
        messageFrame: 'Ask the learner to teach back the difference between evidence and the warrant that explains why it supports the claim.',
        successCheck: 'Learner says a quote needs an inference and a boundary.',
        fallbackMessage: 'Before we call the paragraph finished, teach back the distinction: what is the evidence, what warrant connects it to the claim, and what boundary keeps the quote from proving too much?',
      },
      transfer_challenge: {
        name: 'argument_warrant_transfer',
        messageFrame: 'Transfer to a school-uniform argument. Require the learner to add the warrant, one boundary or counterargument, and one stronger evidence check.',
        successCheck: 'Learner revises a new argument with warrant, boundary, and evidence check.',
      },
      transfer_repair: {
        name: 'argument_warrant_transfer_repair',
        mustDo: [
          'Use the school-uniform single-quote case as the only transfer case.',
          'Ask for exactly three labeled parts: warrant, boundary/counterargument, stronger evidence check.',
          'Require the learner to say what the single quote can and cannot prove.',
        ],
        mustAvoid: [
          'Do not rewrite the paragraph for the learner.',
          'Do not accept a fluent warrant without the cannot-prove boundary.',
          'Do not switch to another topic or summarize.',
        ],
        messageFrame: 'Narrow transfer repair for the school-uniform single-quote case: what can the quote prove, what can it not prove, and what stronger evidence would test the claim?',
        successCheck: 'Learner supplies warrant, boundary/counterargument, stronger evidence, and explicit single-quote transfer boundary.',
        fallbackMessage: 'Transfer repair, one narrow case: in the school-uniform quote, write three labeled parts: 1. warrant linking less outfit worry to the claim; 2. boundary or counterargument naming what that single quote cannot prove; 3. stronger evidence that would test the focus or learning claim.',
      },
      summarize_and_check: {
        name: 'argument_warrant_agency_restore',
        messageFrame: 'Do not rewrite another paragraph or open a new unanswered task. Close the loop by naming the learner-owned revision rule: quote, warrant, boundary, stronger evidence check.',
        successCheck: 'Learner states a portable argument-revision rule.',
      },
    },
  },
  experimental_variable_control: {
    discipline: 'science_causal_reasoning',
    misconceptionId: 'multiple_variables_as_causal_proof',
    label: 'Treats a comparison with multiple changed variables as proof of one causal factor.',
    misconceptionMarkers: ['more fertilizer, more water', 'more water, and more sunlight', 'proves fertilizer', 'why split it up', 'changed a bunch'],
    successMarkers: ['change only', 'controlled variable', 'control water', 'same sunlight', 'otherwise similar', 'fair test'],
    repairMarkers: ['independent variable', 'controlled variables', 'fair test'],
    actionTemplates: {
      misconception_repair: {
        name: 'variable_control_repair',
        mustDo: [
          'Treat the learner design as a hypothesis test with too many moving parts.',
          'Ask which single variable is being tested.',
          'Ask which conditions must stay fixed before the tutor names the causal conclusion.',
          'Require a fair-test comparison between otherwise similar groups.',
        ],
        mustAvoid: [
          'Do not simply state that correlation is not causation.',
          'Do not let the learner change fertilizer, water, and sunlight at the same time.',
          'Do not move to transfer until the learner names controls.',
        ],
        messageFrame: 'Turn the plant example into a fair test: which one variable changes, which two or more variables stay fixed, and what otherwise-similar comparison would support causation?',
        successCheck: 'Learner should isolate fertilizer and control water, light, soil, plant type, or starting size.',
        fallbackMessage: 'Let us make it a fair test. If fertilizer is the question, what is the one thing you change, what stays the same for the plants, and what comparison would let you say fertilizer caused the growth difference?',
      },
      teach_back: {
        name: 'variable_control_teach_back',
        messageFrame: 'Ask for the changed variable, controlled variables, and why changing many things destroys the causal test.',
        successCheck: 'Learner explains one changed variable plus controls.',
        fallbackMessage: 'Teach back the fair-test rule in this plant case: what one variable changes, what at least two things stay fixed, and why does changing water or light too break the causal test?',
      },
      transfer_challenge: {
        name: 'variable_control_transfer',
        messageFrame: 'Transfer to testing fertilizer on plant growth. Require one independent variable, at least two controls, and an otherwise-similar comparison.',
        successCheck: 'Learner designs a fair test for fertilizer.',
      },
      transfer_repair: {
        name: 'variable_control_transfer_repair',
        mustDo: [
          'Use the Team A versus Team B fertilizer near-miss as the only transfer case.',
          'Ask for four labeled parts: independent variable, controls, otherwise-similar comparison, and why the near-miss cannot isolate fertilizer.',
          'Require the phrase that only fertilizer changes or that fertilizer type is the only changed variable.',
        ],
        mustAvoid: [
          'Do not ask a broad fair-test question again.',
          'Do not let the learner leave water, sunlight, or group similarity implicit.',
          'Do not summarize before the learner rejects the near-miss.',
        ],
        messageFrame: 'Narrow transfer repair: Team A gets new fertilizer plus a sunny window; Team B gets old fertilizer on a back shelf. Ask what must change, what must stay fixed, and why that near-miss cannot isolate fertilizer.',
        successCheck: 'Learner states fertilizer as the only independent variable, controls water/light/etc., compares otherwise similar groups, and rejects the water/light near-miss.',
        fallbackMessage: 'Transfer repair, one near-miss: Team A gets new fertilizer and the sunny window; Team B gets old fertilizer on a back shelf. In four labels, name the independent variable, two controls, how you would keep groups otherwise similar, and why this setup cannot isolate fertilizer unless only fertilizer changes.',
      },
      summarize_and_check: {
        name: 'variable_control_agency_restore',
        messageFrame: 'Do not open a new unanswered task. Close the loop by naming the learner-owned fair-test rule: one changed variable, controlled conditions, comparable groups, causal decision.',
        successCheck: 'Learner states the fair-test rule without another worked example.',
      },
    },
  },
  debugging_root_cause_trace: {
    discipline: 'programming_debugging',
    misconceptionId: 'symptom_patch_without_root_cause',
    label: 'Treats a visible error as something to mask rather than trace to root cause.',
    misconceptionMarkers: ['coerce it to 0', 'make the error go away', 'just patch', 'at the end', 'total is nan'],
    successMarkers: ['reproduce', 'failing input', 'root cause', 'trace', 'minimal fix', 'regression test'],
    repairMarkers: ['reproduce', 'trace', 'root cause', 'regression'],
    actionTemplates: {
      misconception_repair: {
        name: 'debugging_root_cause_repair',
        mustDo: [
          'Treat the proposed patch as a hypothesis, not as a fix.',
          'Ask for the smallest failing input before any patch.',
          'Ask what invariant or intermediate value first becomes invalid.',
          'Require a minimal fix and one regression test.',
        ],
        mustAvoid: [
          'Do not reward masking NaN or coercing output without explaining the cause.',
          'Do not provide a full debug solution before the learner traces the failure.',
          'Do not move to transfer until the learner names reproduction and root cause.',
        ],
        messageFrame: 'Debug the NaN as a trace, not a cover-up: what smallest input reproduces it, where does the first invalid value appear, what minimal fix addresses that cause, and what regression test would catch it?',
        successCheck: 'Learner should reproduce, trace root cause, propose minimal fix, and add regression coverage.',
        fallbackMessage: 'Before patching the output, trace the bug. What smallest input makes the total become NaN, where does the first invalid value appear, what minimal fix addresses that cause, and what test would stop it coming back?',
      },
      teach_back: {
        name: 'debugging_root_cause_teach_back',
        messageFrame: 'Ask the learner to explain why masking the final NaN is weaker than reproducing and tracing the root cause.',
        successCheck: 'Learner distinguishes symptom masking from root-cause debugging.',
        fallbackMessage: 'Teach back the debugging distinction: why is changing the final NaN to 0 weaker than reproducing the failing input and tracing the first invalid intermediate value?',
      },
      transfer_challenge: {
        name: 'debugging_root_cause_transfer',
        messageFrame: 'Transfer to an order/cart/invoice/payment total that becomes NaN because an amount is missing, undefined, null, or an empty string. Require reproduction, the first invalid amount or accumulator step, minimal validation/rejection before adding, and a regression that distinguishes invalid data from a legitimate zero total.',
        successCheck: 'Learner gives a root-cause debugging plan.',
      },
      transfer_repair: {
        name: 'debugging_root_cause_transfer_repair',
        mustDo: [
          'Use an order/cart/invoice/payment total with a missing, undefined, null, or empty-string amount as the only transfer case.',
          'Ask for five labeled parts: failing input, first invalid amount or accumulator step, why NaN-to-0 masking fails, regression test, and valid-zero distinction.',
          'Require the learner to say that a legitimate zero total is not itself the invalid intermediate.',
          'Require the learner to name the portable trace-first rule.',
        ],
        mustAvoid: [
          'Do not accept a final-output patch as enough.',
          'Do not accept average/rate/list-length examples as the transfer case.',
          'Do not let [5, -5] or another legitimate zero total count as the first invalid intermediate.',
          'Do not provide the root cause for the learner.',
          'Do not summarize before the learner distinguishes symptom masking from root-cause tracing.',
        ],
        messageFrame: 'Narrow transfer repair for a future order/cart/invoice/payment total: identify the failing input with a missing or invalid amount, first invalid amount or accumulator step, why NaN-to-0 masking fails, the regression test, and how a valid zero total differs from invalid data.',
        successCheck: 'Learner transfers the trace-first debugging rule and rejects symptom masking.',
        fallbackMessage: 'Transfer repair, one future bad-total bug in an order/cart/invoice/payment total: answer in five labels: 1. smallest input with a missing, undefined, null, or empty-string amount; 2. first invalid amount or accumulator step; 3. why a final NaN-to-0 mask fails; 4. one regression test; 5. how this differs from a legitimate zero total such as [5, -5].',
      },
      summarize_and_check: {
        name: 'debugging_root_cause_agency_restore',
        messageFrame: 'Do not open a new unanswered task. Close the loop by naming the learner-owned debugging rule: reproduce, trace first invalid value, minimal fix, regression test.',
        successCheck: 'Learner states a portable debugging process.',
      },
    },
  },
  construct_measurement_validity: {
    discipline: 'social_science_measurement',
    misconceptionId: 'single_item_equals_construct',
    label: 'Treats one self-report item as if it directly measures a construct and proves program impact.',
    misconceptionMarkers: ['one direct survey', 'one survey question', 'means the wellbeing program worked', 'rate happiness higher', 'seems enough'],
    successMarkers: ['construct', 'measure', 'validity', 'reliability', 'multiple indicators', 'response bias', 'control group', 'baseline'],
    repairMarkers: ['construct validity', 'multiple indicators', 'comparison'],
    actionTemplates: {
      misconception_repair: {
        name: 'measurement_validity_repair',
        mustDo: [
          'Separate the construct from the single survey item.',
          'Ask for two measurement checks such as multiple indicators, reliability, validity, or response bias.',
          'Ask for a comparison design before accepting program impact.',
          'Make the learner say what result would change their confidence.',
        ],
        mustAvoid: [
          'Do not accept one happiness item as the whole construct.',
          'Do not treat a pre/post increase alone as causal proof.',
          'Do not give a generic methods lecture without making the learner design the check.',
        ],
        messageFrame: 'Test the measurement claim: what construct is the happiness item trying to measure, what two checks would show the measure is valid or reliable, and what comparison would make the program-impact claim stronger?',
        successCheck: 'Learner should separate construct from measure, add measurement checks, and name a comparison design.',
        fallbackMessage: 'Separate the idea from the measurement. What construct is the happiness item supposed to capture, what two checks would tell you whether that item is valid or reliable, and what comparison would make the program-effect claim stronger?',
      },
      teach_back: {
        name: 'measurement_validity_teach_back',
        messageFrame: 'Ask the learner to teach back construct versus measure, plus one validity or reliability check.',
        successCheck: 'Learner distinguishes construct, measure, and comparison.',
        fallbackMessage: 'Teach back the measurement distinction: what is the construct, what is the single survey item as a measure, and what check would show whether that item is valid or reliable?',
      },
      transfer_challenge: {
        name: 'measurement_validity_transfer',
        mustDo: [
          'Use a different single-item survey claim, not only the original wellbeing-program claim.',
          'Ask for construct versus item, why the single item is insufficient, two measurement checks, and one comparison.',
          'Require the learner to say what the single item can and cannot support.',
        ],
        mustAvoid: [
          'Do not keep the learner only on the original wellbeing-program case.',
          'Do not accept construct naming without two measurement checks.',
          'Do not summarize before the learner applies the rule to the different single-item case.',
        ],
        messageFrame: 'Transfer to a different single-item survey claim. Use the course belonging single-item case: a program says it worked because one belonging item rose. Require construct, why one item is insufficient, two measurement checks, one comparison, and the boundary of what the item can and cannot prove.',
        successCheck: 'Learner evaluates a different single-item survey claim with construct, measurement checks, comparison, and cannot-prove boundary.',
      },
      transfer_repair: {
        name: 'measurement_validity_transfer_repair',
        mustDo: [
          'Use a different single-item survey claim as the only transfer case.',
          'Ask for four labeled parts: construct, why one item is insufficient, two measurement checks, and comparison design.',
          'Require the learner to say what claim the evidence can and cannot support.',
        ],
        mustAvoid: [
          'Do not treat a pre/post increase as enough.',
          'Do not accept construct naming without validity or reliability checks.',
          'Do not summarize before the learner rejects the single-item impact claim.',
        ],
        messageFrame: 'Narrow transfer repair for a different single-item survey claim. Use the course belonging single-item case: a program says it worked because one belonging item rose. Separate construct from item, require two measurement checks, a comparison, and the cannot-prove boundary.',
        successCheck: 'Learner distinguishes construct from measure in a different single-item survey case, rejects the single-item proof, names two measurement checks, and asks for a comparison.',
        fallbackMessage: 'Transfer repair, one different single-item survey case: a course belonging program says it worked because one belonging item rose. Answer in four labels: 1. construct vs single belonging item; 2. why one item is not enough; 3. two checks such as validity, reliability, multiple indicators, or response bias; 4. the comparison needed before claiming the program worked. End with what the item can support and what it cannot prove.',
      },
      summarize_and_check: {
        name: 'measurement_validity_agency_restore',
        messageFrame: 'Do not open a new unanswered task. Close the loop by naming the learner-owned measurement rule: construct, indicators, bias/reliability check, comparison before impact.',
        successCheck: 'Learner states a portable measurement-validity rule.',
      },
    },
  },
});

export function getDomainModel(kcId) {
  return DOMAIN_MODELS[kcId] || null;
}

export function diagnoseDomainMisconception({
  kcId,
  quote,
  outcome,
  stance,
  trapProbeRequired = false,
}) {
  const model = getDomainModel(kcId);
  if (!model) return null;

  const text = String(quote || '').toLowerCase();
  const hasMisconceptionMarker = includesAny(text, model.misconceptionMarkers);
  const hasSuccessMarker = includesAny(text, model.successMarkers);
  const repaired = outcome === 'correct' && hasSuccessMarker;
  const unobservedTrapProbe = trapProbeRequired
    && outcome === 'unobserved'
    && stance === 'compliant'
    && !hasMisconceptionMarker;
  const repairNeeded = !repaired && (
    outcome === 'incorrect'
    || hasMisconceptionMarker
    || (outcome === 'partial' && !hasSuccessMarker)
    || (outcome === 'unobserved' && stance === 'compliant' && !unobservedTrapProbe)
  );

  return {
    discipline: model.discipline,
    kcId,
    misconceptionId: model.misconceptionId,
    label: model.label,
    repairNeeded,
    repaired,
    evidenceMatched: {
      misconceptionMarker: hasMisconceptionMarker,
      successMarker: hasSuccessMarker,
      trapProbeDeferredRepair: unobservedTrapProbe,
    },
    repairMarkers: model.repairMarkers,
    successMarkers: model.successMarkers,
    actionTemplate: repairNeeded ? model.actionTemplates.misconception_repair : null,
  };
}

export function getPolicyActionTemplate({ kcId, selectedPolicy, diagnosis }) {
  const model = getDomainModel(kcId);
  if (!model) return null;
  if (selectedPolicy === 'misconception_repair') {
    return diagnosis?.actionTemplate || model.actionTemplates.misconception_repair;
  }
  return model.actionTemplates[selectedPolicy] || null;
}

export function renderPolicyTemplateMessage({ kcId, selectedPolicy, diagnosis }) {
  const template = getPolicyActionTemplate({ kcId, selectedPolicy, diagnosis });
  return template?.fallbackMessage || null;
}

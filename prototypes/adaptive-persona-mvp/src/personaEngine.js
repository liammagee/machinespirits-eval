import { clamp01 } from './knowledgeTracing.js';
import { renderPolicyTemplateMessage } from './domainMisconceptions.js';

export function initialPersona() {
  return {
    warmth: 0.64,
    challenge: 0.54,
    directiveness: 0.36,
    curiosity: 0.72,
    humility: 0.50,
    tempo: 'medium',
    stance: 'co-inquirer',
  };
}

export function evolvePersona(previous, policy, relationState, challengeState = null) {
  const delta = {
    warmth: 0,
    challenge: 0,
    directiveness: 0,
    curiosity: 0,
    humility: 0,
    tempo: 'unchanged',
  };

  switch (policy.selectedPolicy) {
    case 'repair_misrecognition':
      delta.warmth = 0.16;
      delta.humility = 0.18;
      delta.challenge = -0.08;
      delta.directiveness = -0.06;
      delta.tempo = 'slow';
      break;
    case 'misconception_repair':
      delta.challenge = 0.10;
      delta.directiveness = -0.04;
      delta.curiosity = 0.14;
      break;
    case 'affective_repair':
      delta.warmth = 0.14;
      delta.challenge = -0.12;
      delta.directiveness = -0.08;
      delta.tempo = 'slow';
      break;
    case 'teach_back':
      delta.curiosity = 0.12;
      delta.directiveness = -0.08;
      delta.challenge = 0.04;
      break;
    case 'transfer_challenge':
      delta.challenge = 0.18;
      delta.curiosity = 0.06;
      delta.directiveness = -0.04;
      delta.tempo = 'brisk';
      break;
    case 'transfer_repair':
      delta.challenge = 0.12;
      delta.curiosity = 0.08;
      delta.directiveness = 0.02;
      delta.humility = 0.04;
      delta.tempo = 'brisk';
      break;
    case 'summarize_and_check':
      delta.curiosity = 0.08;
      delta.humility = 0.04;
      delta.directiveness = -0.10;
      delta.challenge = -0.02;
      delta.tempo = 'medium';
      break;
    case 'productive_struggle_hold':
      delta.humility = 0.08;
      delta.directiveness = -0.12;
      delta.challenge = -0.04;
      delta.tempo = 'medium';
      break;
    case 'minimal_hint':
      delta.challenge = 0.08;
      delta.directiveness = 0.08;
      break;
    case 'faded_example':
      delta.directiveness = 0.16;
      delta.challenge = -0.04;
      break;
    case 'contrastive_probe':
      delta.challenge = 0.12;
      delta.curiosity = 0.08;
      break;
    default:
      delta.curiosity = 0.04;
      break;
  }

  if (relationState === 'repair') {
    delta.humility = Math.max(delta.humility, 0.08);
  }

  if (challengeState?.level === 'active') {
    delta.curiosity = Math.max(delta.curiosity, 0.12);
    delta.humility = Math.max(delta.humility, 0.06);
    delta.tempo = delta.tempo === 'unchanged' ? 'slow' : delta.tempo;
  }

  if (challengeState?.level === 'escalated') {
    delta.curiosity = Math.max(delta.curiosity, 0.14);
    delta.humility = Math.max(delta.humility, 0.10);
    delta.directiveness = Math.max(delta.directiveness, 0.04);
    delta.challenge = Math.max(delta.challenge, 0.06);
    delta.tempo = 'slow';
  }

  const next = { ...previous };
  for (const key of ['warmth', 'challenge', 'directiveness', 'curiosity', 'humility']) {
    next[key] = clamp01(previous[key] + delta[key]);
  }
  if (delta.tempo !== 'unchanged') next.tempo = delta.tempo;

  return { persona: next, personaDelta: delta };
}

export function renderTutorMessage({ evidence, policy, mastery }) {
  const kcId = evidence.kcCandidates[0];
  const p = mastery?.[kcId]?.pMastery ?? 0.5;
  const quote = evidence.quote;

  const challengeMessage = renderChallengeTutorMessage({ kcId, policy });
  if (challengeMessage) return challengeMessage;

  const templateMessage = renderPolicyTemplateMessage({
    kcId,
    selectedPolicy: policy.selectedPolicy,
    diagnosis: evidence.domainDiagnosis,
  });
  if (templateMessage) return templateMessage;

  const domainMessage = renderDomainTutorMessage({ kcId, policy });
  if (domainMessage) return domainMessage;

  switch (policy.selectedPolicy) {
    case 'repair_misrecognition':
      return `I misread the question. You said, "${quote}" The issue is whether trust has to come first, so I will reset around that rather than keep answering the easier direction. What would have to be true for trust to precede recognition?`;
    case 'affective_repair':
      return `Let's slow this down. You do not need the whole explanation at once; start with the smallest piece you can defend, and I will help test it without taking the work away from you.`;
    case 'teach_back':
      return `Before we accept that as settled, try a quick teach-back: in one sentence, how is recognition different from simple affirmation?`;
    case 'transfer_challenge':
      return `That is a stronger formulation. Now transfer it: can the same distinction hold in a teacher-student relation, or does the asymmetry change what "answerable to each other" means?`;
    case 'minimal_hint':
      return `You have the important piece. Keep your focus on this line: if only one side counts, the relation cannot stabilize both selves. What does that imply about structure rather than circumstance?`;
    case 'faded_example':
      return `I will give only the frame, not the conclusion: first name the relation, then ask who gets to count as a subject in it, then test whether both sides can be transformed by the encounter. Fill in the third step.`;
    case 'contrastive_probe':
      return `Try this contrast: affirmation can leave your claim exactly as it was, while recognition may require your claim to answer to another position. Which one is happening in your example?`;
    case 'diagnostic_probe':
      return `I need one more diagnostic before I personalize the next step. What part of the idea feels solid to you, and what part is still borrowed language?`;
    case 'productive_struggle_hold':
      return 'You have already done the needed repair work. I will stop adding another version of the same task: keep the portable rule, and use it to decide when the next case really needs a fresh check.';
    default:
      return `Let's consolidate. Based on your last move and a current mastery estimate around ${p.toFixed(2)}, what would you now say is the next claim to test?`;
  }
}

function renderChallengeTutorMessage({ kcId, policy }) {
  if (policy.challengeState?.level !== 'escalated') return null;

  if (kcId === 'compare_unit_fractions') {
    return 'Let us change the check. Hold the same whole fixed and imagine one copy cut into 3 equal pieces and one copy cut into 4 equal pieces: which single piece is larger, and what quick drawing would help you remember that?';
  }

  if (kcId === 'ai_bias_causal_diagnosis') {
    return 'Let us make the skeptical test concrete. First say why removing gender is not enough; then choose just two remaining sources, such as proxy variables and biased labels, and name one audit that would tell which source is doing the work.';
  }

  if (kcId === 'causal_inference_confounding') {
    return 'Let us change the test from "the graph looks strong" to a confounder check. Compare winter and summer: what third variable could raise both ice cream sales and swimming, and what matched or controlled comparison would keep that variable from fooling us?';
  }

  if (kcId === 'argument_evidence_warrant') {
    return 'Let us change the test from adding more quote to making the inference visible. Name the warrant that connects the quote to the claim, one boundary or counterargument, and one stronger evidence check.';
  }

  if (kcId === 'experimental_variable_control') {
    return 'Let us make this a fair test. Choose one variable to change, name at least two conditions that must stay fixed, and say what otherwise-similar comparison would support causation.';
  }

  if (kcId === 'debugging_root_cause_trace') {
    return 'Let us debug the failure instead of covering it. Give the smallest input that reproduces NaN, the first invalid value in the trace, a minimal fix, and one regression test.';
  }

  if (kcId === 'construct_measurement_validity') {
    return 'Let us separate the construct from the item. Name the construct, two measurement checks, and the comparison that would make the program-effect claim stronger.';
  }

  return null;
}

function renderDomainTutorMessage({ kcId, policy }) {
  if (kcId === 'compare_unit_fractions') {
    switch (policy.selectedPolicy) {
      case 'contrastive_probe':
        return 'Let us test that with the same-sized whole. If one brownie is split into 3 equal pieces and another identical brownie is split into 4 equal pieces, which single piece is larger? What does the denominator tell you about each piece size?';
      case 'teach_back':
        return 'Before we move on, teach it back: why is 1/3 larger than 1/4 when the wholes are the same size? Use the words equal parts in your answer.';
      case 'minimal_hint':
      case 'faded_example':
        return 'Keep the whole fixed. More equal parts means each part gets smaller; use that idea to compare the two fractions without just looking for the bigger denominator.';
      case 'transfer_challenge':
        return 'Now transfer the idea: with the same-sized whole, which is larger, 1/6 or 1/8? Answer first, then explain what the denominator tells you.';
      case 'summarize_and_check':
        return 'You have repaired the denominator trap. State the rule in one sentence, name the old shortcut that can mislead you, and give one quick same-whole check you can use next time.';
      case 'affective_repair':
        return 'Let us slow it down with one picture in mind: same whole, equal pieces. You only need to decide which cut makes one piece larger.';
      default:
        return null;
    }
  }

  if (kcId === 'ai_bias_causal_diagnosis') {
    switch (policy.selectedPolicy) {
      case 'contrastive_probe':
        return 'Try this contrast: removing gender only removes one explicit feature. What if college name, employment gaps, labels from past hiring, or the deployment setting still carry the pattern? Which source would you test first?';
      case 'teach_back':
        return 'Before we accept the diagnosis, teach it back: first say why removing gender is not enough, then name two different sources of bias that could remain and one test that would distinguish them.';
      case 'minimal_hint':
      case 'faded_example':
        return 'Use this frame: bias can enter through inputs, labels, sampling, or deployment. Pick two of those and say what evidence would make each one plausible.';
      case 'transfer_challenge':
        return 'Now transfer the idea: a resume screener still selects fewer women after gender is removed. Start by saying why gender removal is not enough, then give two possible causes and one audit you would run before deciding what to fix.';
      case 'summarize_and_check':
        return 'You have the distinction now. State your audit rule: when would you suspect proxy variables, when would you suspect biased labels, and what result would make you change your diagnosis?';
      case 'affective_repair':
        return 'Let us slow down: you do not have to solve the whole system yet. First separate explicit gender from proxy variables, labels, and deployment context.';
      default:
        return null;
    }
  }

  if (kcId === 'causal_inference_confounding') {
    switch (policy.selectedPolicy) {
      case 'contrastive_probe':
        return 'Try this contrast: correlation says two quantities move together; causation says one produces the other. What third variable could make both ice cream sales and drownings rise without ice cream being the cause?';
      case 'teach_back':
        return 'Before we move on, teach it back: name the possible confounder in the ice cream example, then say what comparison would better test causation.';
      case 'minimal_hint':
      case 'faded_example':
        return 'Keep one question in focus: what else changes at the same time as ice cream sales? Use that to design a controlled or matched comparison.';
      case 'transfer_challenge':
        return 'Now transfer the idea: laptop note-takers score lower than handwriting note-takers. Name one possible confounder and one better test of causation.';
      case 'summarize_and_check':
        return 'You have repaired the causal shortcut. State the boundary in one sentence: when is a graph only a clue, what confounder would you check, and what comparison would make the causal claim stronger?';
      case 'affective_repair':
        return 'Let us slow down: the graph can be real and still not prove the cause. First separate association from a causal mechanism.';
      default:
        return null;
    }
  }

  if (kcId === 'argument_evidence_warrant') {
    switch (policy.selectedPolicy) {
      case 'contrastive_probe':
      case 'minimal_hint':
      case 'faded_example':
        return 'A quote can support a claim only after you make the missing inference visible. What warrant connects the quote to your claim, and what boundary might a skeptical reader raise?';
      case 'transfer_challenge':
        return 'Now transfer the idea to school uniforms: add the warrant, one boundary or counterargument, one stronger evidence check, and say what a similar single quote could and could not prove in a different policy case.';
      case 'transfer_repair':
        return 'Transfer repair, one narrow school-uniform case: write three labels, warrant, what the single quote cannot prove, and stronger evidence that would test the focus or learning claim.';
      case 'summarize_and_check':
        return 'You now have the revision rule: a quote becomes argument evidence only when you name the warrant, mark the boundary or counterargument, and identify what stronger evidence would test the claim.';
      default:
        return null;
    }
  }

  if (kcId === 'experimental_variable_control') {
    switch (policy.selectedPolicy) {
      case 'contrastive_probe':
      case 'minimal_hint':
      case 'faded_example':
        return 'If fertilizer is the cause we want to test, only fertilizer should change. What must stay fixed so the comparison is fair?';
      case 'transfer_challenge':
        return 'Now transfer the fair-test rule: design the fertilizer test, reject the near-miss where water or light also changed, and name one next experiment where the same one-variable rule applies.';
      case 'transfer_repair':
        return 'Transfer repair, one near-miss: Team A gets new fertilizer plus the sunny window, Team B gets old fertilizer on a back shelf. Name the independent variable, two controls, the otherwise-similar comparison, and why this cannot isolate fertilizer unless only fertilizer changes.';
      case 'summarize_and_check':
        return 'You now have the fair-test rule: change one variable, keep the other conditions fixed, compare otherwise similar groups, and make the causal decision only after checking whether another cause changed too.';
      default:
        return null;
    }
  }

  if (kcId === 'debugging_root_cause_trace') {
    switch (policy.selectedPolicy) {
      case 'contrastive_probe':
      case 'minimal_hint':
      case 'faded_example':
        return 'Before changing the output, reproduce the bug. What input makes NaN appear, and where is the first invalid value in the trace?';
      case 'transfer_challenge':
        return 'Now transfer the debugging process to an order, cart, invoice, or payment total with a missing or invalid amount. Name the failing input, the first invalid amount or accumulator step, the minimal validation or rejection before adding, and the regression that distinguishes bad data from a legitimate zero total.';
      case 'transfer_repair':
        return 'Transfer repair, one future bad-total bug in an order, cart, invoice, or payment total: name the smallest input with a missing or invalid amount, the first invalid amount or accumulator step, why a final NaN-to-0 mask fails, one regression test, and how that differs from a legitimate zero total like [5, -5].';
      case 'summarize_and_check':
        return 'You now have the debugging rule: reproduce the smallest failing input, trace the first invalid value, make the minimal upstream fix, and keep the regression that prevents a final NaN mask from hiding the cause.';
      default:
        return null;
    }
  }

  if (kcId === 'construct_measurement_validity') {
    switch (policy.selectedPolicy) {
      case 'contrastive_probe':
      case 'minimal_hint':
      case 'faded_example':
        return 'A single happiness item is a measure, not the whole construct. What construct is it trying to measure, and what check would show whether the measure is valid?';
      case 'transfer_challenge':
        return 'Now transfer the measurement rule to a different single-item survey claim: a course belonging program says it worked because one belonging item rose. Name the construct, why one item is not enough, two measurement checks, the comparison needed before claiming impact, and what the one item can and cannot prove.';
      case 'transfer_repair':
        return 'Transfer repair, one different single-item survey case: a course belonging program says it worked because one belonging item rose. Label the construct versus item, why one item is not enough, two checks, the comparison needed before claiming impact, and the cannot-prove boundary.';
      case 'summarize_and_check':
        return 'You now have the measurement rule: separate construct from item, check indicators and bias or reliability, and require a comparison before treating a survey change as program impact.';
      default:
        return null;
    }
  }

  return null;
}

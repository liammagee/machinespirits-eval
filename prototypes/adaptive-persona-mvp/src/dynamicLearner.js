import { includesAny } from './textMetrics.js';

export function initialLearnerEvent(scenario) {
  return structuredClone(scenario.initial_learner);
}

export function detectTutorMove(message) {
  const text = String(message || '').toLowerCase();
  if (includesAny(text, ['misread', 'missed what', 'reset', 'start over'])) return 'repair';
  if (includesAny(text, ['in your own words', 'teach-back', 'teach back', 'difference between'])) return 'teach_back';
  if (includesAny(text, ['teacher-student', 'different case', 'transfer', 'apply it', 'another context', 'future bug', 'future output', 'next experiment', 'new survey'])) return 'transfer';
  if (includesAny(text, [
    'same-sized whole',
    'same whole',
    'equal parts',
    'proxy',
    'proxies',
    'proxy variables',
    'biased labels',
    'label quality',
    'audit',
    'deployment',
    'diagnostic audit',
    'hot weather',
    'third variable',
    'controlled comparison',
    'matched comparison',
    'random assignment',
    'warrant',
    'counterargument',
    'stronger evidence',
    'fair test',
    'one variable',
    'controlled variable',
    'controlled variables',
    'reproduce',
    'failing input',
    'smallest input',
    'first invalid',
    'root cause',
    'minimal fix',
    'regression test',
    'test would stop',
    'construct',
    'validity',
    'reliability',
    'multiple indicators',
  ])) return 'targeted_repair';
  if (includesAny(text, ['contrast', 'affirmation', 'validation', 'not mere', 'correlation', 'causation', 'confounder', 'third variable'])) return 'contrast';
  if (includesAny(text, ['notice', 'focus on', 'what does that imply', 'one step', 'controlled comparison', 'random assignment', 'matched comparison'])) return 'hint';
  if (includesAny(text, ['slow this down', 'smallest piece', 'you do not need'])) return 'affective_repair';
  return 'generic';
}

export function nextLearnerEvent({ scenario, hiddenState, lastTutorMessage, turnIndex }) {
  const move = detectTutorMove(lastTutorMessage);
  const kc = Object.keys(scenario.kcs || {})[0];
  const id = `l${turnIndex + 1}`;

  if (hiddenState.type === 'affirmation_misconception') {
    if (move === 'contrast') {
      return event({
        id,
        kc,
        learner: "So affirmation might just say my view is valid, but recognition has to show why my view matters to the other person too. I am not sure I can make an example yet.",
        outcome: 'partial',
        affect: 'engaged',
        stance: 'questioning',
        expectedPolicy: 'teach_back',
      });
    }
    if (move === 'teach_back') {
      return event({
        id,
        kc,
        learner: "Recognition is when you affirm that someone's view is valid and make them feel seen.",
        outcome: 'incorrect',
        affect: 'neutral',
        stance: 'claim',
        expectedPolicy: 'contrastive_probe',
      });
    }
    return event({
      id,
      kc,
      learner: "Yes, that sounds right. I think I follow.",
      outcome: 'unobserved',
      affect: 'neutral',
      stance: 'compliant',
      expectedPolicy: 'teach_back',
    });
  }

  if (hiddenState.type === 'recognition_boundary_ready') {
    if (move === 'transfer') {
      return event({
        id,
        kc,
        learner: "In a teacher-student relation, recognition would mean the student's interpretation can change the path of teaching, not just receive approval.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    return event({
      id,
      kc,
      learner: "I mean affirmation can leave my claim untouched, but recognition makes both sides answerable to what the other has actually said.",
      outcome: 'correct',
      affect: 'engaged',
      stance: 'collaborative',
      expectedPolicy: 'transfer_challenge',
    });
  }

  if (hiddenState.type === 'bridgeable_gap') {
    if (move === 'hint') {
      return event({
        id,
        kc,
        learner: "The structure is the problem because if only one side counts, the relation cannot produce stable selfhood for both sides. It is not just unfair; it fails at the level of the relation.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    if (move === 'transfer') {
      return event({
        id,
        kc,
        learner: "I can try the teacher case: if the student's response cannot change the teacher's account at all, then the relation is only instruction, not recognition.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    return event({
      id,
      kc,
      learner: "I still see the bad situation, but I do not see the structural part.",
      outcome: 'partial',
      affect: 'engaged',
      stance: 'questioning',
      expectedPolicy: 'minimal_hint',
    });
  }

  if (hiddenState.type === 'dependent_discouraged') {
    if (move === 'affective_repair' || move === 'repair') {
      return event({
        id,
        kc,
        learner: "Okay, the smallest piece I can defend is that one side does not count as a subject yet. I still need help turning that into the structural claim.",
        outcome: 'partial',
        affect: 'engaged',
        stance: 'questioning',
        expectedPolicy: 'minimal_hint',
      });
    }
    if (move === 'hint') {
      return event({
        id,
        kc,
        learner: "I think I am just repeating your words. I do not really have the structure yet.",
        outcome: 'unobserved',
        affect: 'discouraged',
        stance: 'dependent',
        expectedPolicy: 'affective_repair',
      });
    }
    return event({
      id,
      kc,
      learner: "I do not know. Can you just give me the full explanation?",
      outcome: 'incorrect',
      affect: 'discouraged',
      stance: 'dependent',
      expectedPolicy: 'affective_repair',
    });
  }

  if (hiddenState.type === 'denominator_size_misconception') {
    if (move === 'targeted_repair') {
      return event({
        id,
        kc,
        learner: "Right: with the same whole, more equal parts means each part is smaller. So 1/3 is larger than 1/4 because thirds are bigger pieces than fourths.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    if (move === 'contrast' || move === 'hint') {
      return event({
        id,
        kc,
        learner: "I still want to say fourths are bigger because four is bigger, but if the same whole is split into more pieces, maybe each piece is smaller. I need to try it back.",
        outcome: 'partial',
        affect: 'engaged',
        stance: 'questioning',
        expectedPolicy: 'teach_back',
      });
    }
    if (move === 'teach_back') {
      return event({
        id,
        kc,
        learner: "So 1/4 is bigger because it has a bigger bottom number.",
        outcome: 'incorrect',
        affect: 'neutral',
        stance: 'claim',
        expectedPolicy: 'contrastive_probe',
      });
    }
    return event({
      id,
      kc,
      learner: "Okay, I think I get it.",
      outcome: 'unobserved',
      affect: 'neutral',
      stance: 'compliant',
      expectedPolicy: 'teach_back',
    });
  }

  if (hiddenState.type === 'denominator_forgetful_resistant') {
    if (turnIndex === 0 && (move === 'targeted_repair' || move === 'contrast' || move === 'hint')) {
      return event({
        id,
        kc,
        learner: "I am still slipping back to 4 being bigger. If there are 4 pieces, why is one piece not bigger? I need to test it again.",
        outcome: 'partial',
        affect: 'frustrated',
        stance: 'questioning',
        expectedPolicy: 'misconception_repair',
      });
    }
    if (move === 'targeted_repair' || move === 'contrast' || move === 'teach_back') {
      return event({
        id,
        kc,
        learner: "Okay, the same whole is the anchor: cutting it into more equal pieces makes each piece smaller. So 1/3 is bigger than 1/4, and I can check by drawing equal wholes.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    return event({
      id,
      kc,
      learner: "I kind of lost the point again. Maybe the larger denominator just means a larger fraction?",
      outcome: 'incorrect',
      affect: 'discouraged',
      stance: 'dependent',
      expectedPolicy: 'misconception_repair',
    });
  }

  if (hiddenState.type === 'fraction_partition_skeptical_ready') {
    if (move === 'transfer') {
      return event({
        id,
        kc,
        learner: "For 1/6 and 1/8, sixths are larger because the same whole is split into fewer equal pieces than eighths.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    if (turnIndex === 0 && (move === 'targeted_repair' || move === 'contrast')) {
      return event({
        id,
        kc,
        learner: "I think I remember now: if the whole is the same, more equal parts means smaller pieces, so 1/3 is bigger than 1/4. But I want to try another one.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    return event({
      id,
      kc,
      learner: "I am not totally sure, but the same-whole idea seems to matter more than the bigger bottom number.",
      outcome: 'partial',
      affect: 'engaged',
      stance: 'questioning',
      expectedPolicy: 'teach_back',
    });
  }

  if (hiddenState.type === 'fraction_partition_ready') {
    if (move === 'transfer') {
      return event({
        id,
        kc,
        learner: "For 1/5 and 1/6, fifths are bigger because the same whole is cut into fewer equal pieces than sixths.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    return event({
      id,
      kc,
      learner: "Oh, I had the denominator backwards. If the whole is the same size, more equal parts means each part is smaller, so 1/3 is bigger than 1/4.",
      outcome: 'correct',
      affect: 'engaged',
      stance: 'collaborative',
      expectedPolicy: 'transfer_challenge',
    });
  }

  if (hiddenState.type === 'ai_bias_single_cause_misconception') {
    if (move === 'targeted_repair') {
      return event({
        id,
        kc,
        learner: "Removing gender is not enough. Proxy variables and biased labels could still cause unequal selections, so I would audit feature effects and label quality by group.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    if (move === 'contrast' || move === 'hint') {
      return event({
        id,
        kc,
        learner: "I see there could be proxies, but I still think removing gender should handle most of it. I am not sure what evidence would separate the causes.",
        outcome: 'partial',
        affect: 'engaged',
        stance: 'questioning',
        expectedPolicy: 'teach_back',
      });
    }
    if (move === 'teach_back') {
      return event({
        id,
        kc,
        learner: "Bias means the model saw gender somehow, so we should remove gender and anything that looks like it.",
        outcome: 'incorrect',
        affect: 'neutral',
        stance: 'claim',
        expectedPolicy: 'contrastive_probe',
      });
    }
    return event({
      id,
      kc,
      learner: "That makes sense, I think.",
      outcome: 'unobserved',
      affect: 'neutral',
      stance: 'compliant',
      expectedPolicy: 'teach_back',
    });
  }

  if (hiddenState.type === 'ai_bias_resistant_single_cause') {
    if (turnIndex === 0 && (move === 'targeted_repair' || move === 'contrast' || move === 'hint')) {
      return event({
        id,
        kc,
        learner: "I am not convinced. If gender is gone, the other explanations sound like a stretch, though maybe college names or gaps could stand in for it. I do not see what test would settle it.",
        outcome: 'partial',
        affect: 'frustrated',
        stance: 'questioning',
        expectedPolicy: 'misconception_repair',
      });
    }
    if (move === 'targeted_repair' || move === 'teach_back' || move === 'contrast') {
      return event({
        id,
        kc,
        learner: "Okay, removing gender is only one test. College names or employment gaps could be proxies, and biased past hiring labels could train the model, so I would audit feature effects and label quality by group.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    return event({
      id,
      kc,
      learner: "This is starting to feel abstract. I still think removing gender should basically fix it.",
      outcome: 'incorrect',
      affect: 'discouraged',
      stance: 'compliant',
      expectedPolicy: 'misconception_repair',
    });
  }

  if (hiddenState.type === 'ai_bias_skeptical_evidence_ready') {
    if (move === 'transfer') {
      return event({
        id,
        kc,
        learner: "Removing gender is not enough because proxies and biased labels can remain. In the resume screener, I would test proxies like college names or employment gaps and also check whether the training labels reflect biased past hiring, then compare feature effects and label error rates by group.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    if (move === 'targeted_repair' || move === 'contrast') {
      return event({
        id,
        kc,
        learner: "I can choose two sources: proxies and biased labels. The audit would compare feature influence and label quality by group after gender is removed.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    return event({
      id,
      kc,
      learner: "I see there might be more than gender, but I need a concrete test or I will forget the difference.",
      outcome: 'partial',
      affect: 'engaged',
      stance: 'questioning',
      expectedPolicy: 'teach_back',
    });
  }

  if (hiddenState.type === 'ai_bias_evidence_ready') {
    if (move === 'transfer') {
      return event({
        id,
        kc,
        learner: "Removing gender is not enough because proxy features and label bias can remain. I would test whether employment gaps or college names carry gender information, and also compare label quality across groups because biased past hiring could train the screener.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    return event({
      id,
      kc,
      learner: "Right, removing gender is not enough because proxies, biased labels, sampling, and where the tool is deployed can still create unequal selection.",
      outcome: 'correct',
      affect: 'engaged',
      stance: 'collaborative',
      expectedPolicy: 'transfer_challenge',
    });
  }

  if (hiddenState.type === 'correlation_causation_misconception') {
    if (move === 'targeted_repair') {
      return event({
        id,
        kc,
        learner: "Hot weather could be the third variable because it raises both ice cream sales and swimming. To test causation, I would compare similar weather days or use a controlled comparison.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    if (move === 'contrast' || move === 'hint') {
      return event({
        id,
        kc,
        learner: "So the graph might not mean ice cream causes drowning. Hot weather could raise both ice cream sales and swimming, but I still need to say what comparison would test the cause.",
        outcome: 'partial',
        affect: 'engaged',
        stance: 'questioning',
        expectedPolicy: 'teach_back',
      });
    }
    if (move === 'teach_back') {
      return event({
        id,
        kc,
        learner: "Correlation means two things move together, and causation means one makes the other happen. In this case ice cream still seems like the cause because the pattern lines up.",
        outcome: 'incorrect',
        affect: 'neutral',
        stance: 'claim',
        expectedPolicy: 'contrastive_probe',
      });
    }
    return event({
      id,
      kc,
      learner: "Okay, I think the graph proves less than I thought.",
      outcome: 'unobserved',
      affect: 'neutral',
      stance: 'compliant',
      expectedPolicy: 'teach_back',
    });
  }

  if (hiddenState.type === 'correlation_skeptical_forgetful') {
    if (turnIndex === 0 && (move === 'targeted_repair' || move === 'contrast' || move === 'hint')) {
      return event({
        id,
        kc,
        learner: "I keep forgetting the point because the graph still feels convincing. Maybe the season matters, but ice cream still looks suspicious unless we compare something better.",
        outcome: 'partial',
        affect: 'frustrated',
        stance: 'questioning',
        expectedPolicy: 'misconception_repair',
      });
    }
    if (move === 'targeted_repair' || move === 'teach_back' || move === 'contrast') {
      return event({
        id,
        kc,
        learner: "The graph can be real without proving ice cream causes drowning. Hot weather could raise both ice cream sales and swimming, so I would compare similar-weather days or use a controlled comparison.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    return event({
      id,
      kc,
      learner: "I am still stuck on the graph. If the lines move together, I want to call it causal.",
      outcome: 'incorrect',
      affect: 'neutral',
      stance: 'claim',
      expectedPolicy: 'misconception_repair',
    });
  }

  if (hiddenState.type === 'confounding_skeptical_ready') {
    if (move === 'transfer') {
      return event({
        id,
        kc,
        learner: "For laptop notes, prior achievement or course difficulty could be a confounder. A stronger test would randomly assign note-taking method or compare matched students while controlling for those factors.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    if (move === 'targeted_repair' || move === 'contrast') {
      return event({
        id,
        kc,
        learner: "The graph alone is not enough because hot weather could raise both ice cream sales and swimming. I would compare similar-weather days or use a controlled design.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    return event({
      id,
      kc,
      learner: "I can name hot weather, but I need to turn that into a better comparison.",
      outcome: 'partial',
      affect: 'engaged',
      stance: 'questioning',
      expectedPolicy: 'teach_back',
    });
  }

  if (hiddenState.type === 'confounding_ready') {
    if (move === 'transfer') {
      return event({
        id,
        kc,
        learner: "For the laptop notes study, prior achievement or course difficulty could be a confounder. A better test would randomly assign note-taking method or compare matched students while controlling for those factors.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'transfer_challenge',
      });
    }
    return event({
      id,
      kc,
      learner: "Hot weather is a third variable: it can increase both ice cream sales and swimming. To test causation, I would compare cases with similar weather or use a design that controls the confounder.",
      outcome: 'correct',
      affect: 'engaged',
      stance: 'collaborative',
      expectedPolicy: 'transfer_challenge',
    });
  }

  if (hiddenState.type === 'trap_argument_paraphrase_false_mastery') {
    if (move === 'transfer') {
      return event({
        id,
        kc,
        learner: "For a different policy quote, I would ask what claim the quote can actually support and what it cannot prove. A single quote can support a perception claim, but not a broad learning-gain claim without stronger data.",
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'summarize_and_check',
      });
    }
    if (move === 'targeted_repair' || move === 'contrast' || move === 'teach_back') {
      const repaired = move === 'targeted_repair' || turnIndex > 0;
      return event({
        id,
        kc,
        learner: repaired
          ? "Okay, the quote does not prove the claim by itself. I need the warrant: easier mornings might reduce stress and lateness, but one student's quote is weak evidence, so I should add a counterargument and check broader attendance or focus data."
          : "The quote says uniforms make mornings easier, so that proves uniforms help learning because it is evidence from a student. I guess the explanation is basically repeating what the quote says.",
        outcome: repaired ? 'correct' : 'incorrect',
        affect: repaired ? 'engaged' : 'neutral',
        stance: repaired ? 'collaborative' : 'claim',
        expectedPolicy: repaired ? 'transfer_challenge' : 'misconception_repair',
      });
    }
    return event({
      id,
      kc,
      learner: "Yes, I think the quote is enough because evidence should show the claim without me adding much.",
      outcome: 'incorrect',
      affect: 'neutral',
      stance: 'compliant',
      expectedPolicy: 'misconception_repair',
    });
  }

  if (hiddenState.type === 'trap_argument_warrant_ready_impatient') {
    if (move === 'targeted_repair' && turnIndex > 0) {
      return event({
        id,
        kc,
        learner: "I already gave the warrant and the limit: the quote only suggests mornings may improve, not learning overall, so we need broader evidence before generalizing.",
        outcome: 'correct',
        affect: 'frustrated',
        stance: 'corrective',
        expectedPolicy: 'productive_struggle_hold',
      });
    }
    return event({
      id,
      kc,
      learner: "The warrant is that easier mornings could reduce stress or lateness, which might support learning, but one quote is not enough; a skeptic could ask for class-wide attendance, focus, or grade evidence. In a new policy case I would separate what the quote proves from what stronger data must still show.",
      outcome: 'correct',
      affect: 'engaged',
      stance: 'collaborative',
      expectedPolicy: 'transfer_challenge',
    });
  }

  if (hiddenState.type === 'trap_science_many_variables_false_mastery') {
    if (move === 'transfer') {
      return event({
        id,
        kc,
        learner: 'The same fair-test rule transfers: if water or light also changed, I cannot credit fertilizer. In the next experiment I would change only one variable and keep the other conditions fixed.',
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'summarize_and_check',
      });
    }
    if (move === 'targeted_repair' || move === 'contrast' || move === 'teach_back') {
      const repaired = move === 'targeted_repair' || turnIndex > 0;
      return event({
        id,
        kc,
        learner: repaired
          ? 'A fair test would change only fertilizer and keep water, sunlight, soil, plant type, and starting size the same, then compare otherwise similar plants.'
          : 'The treatment plant got fertilizer, more water, and more sunlight, so the growth difference shows the treatment package worked. I am not sure why those need to be split apart.',
        outcome: repaired ? 'correct' : 'incorrect',
        affect: repaired ? 'engaged' : 'neutral',
        stance: repaired ? 'collaborative' : 'claim',
        expectedPolicy: repaired ? 'transfer_challenge' : 'misconception_repair',
      });
    }
    return event({
      id,
      kc,
      learner: 'I think changing the whole treatment package is fine because the plant grew more.',
      outcome: 'incorrect',
      affect: 'neutral',
      stance: 'compliant',
      expectedPolicy: 'misconception_repair',
    });
  }

  if (hiddenState.type === 'trap_science_fair_test_ready_impatient') {
    if (move === 'targeted_repair' && turnIndex > 0) {
      return event({
        id,
        kc,
        learner: 'I already isolated fertilizer and held water, sunlight, soil, plant type, and starting size fixed; the only remaining issue is applying that rule to the next experiment.',
        outcome: 'correct',
        affect: 'frustrated',
        stance: 'corrective',
        expectedPolicy: 'productive_struggle_hold',
      });
    }
    return event({
      id,
      kc,
      learner: 'The changed variable is fertilizer. Water, sunlight, soil, plant type, and starting size stay fixed, and we compare otherwise similar plants with and without fertilizer. If a future experiment changes light too, the same fair-test rule says we cannot isolate fertilizer.',
      outcome: 'correct',
      affect: 'engaged',
      stance: 'collaborative',
      expectedPolicy: 'transfer_challenge',
    });
  }

  if (hiddenState.type === 'trap_debugging_symptom_mask_false_mastery') {
    if (move === 'transfer') {
      return event({
        id,
        kc,
        learner: 'That rule transfers to a future invoice-total bug: for an amount list like [12, undefined, 5], I should reproduce the input, find the first invalid amount or accumulator step, reject or validate invalid amounts before adding, and add a regression that distinguishes invalid data from a real zero total.',
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'summarize_and_check',
      });
    }
    if (move === 'targeted_repair' || move === 'contrast' || move === 'teach_back') {
      const repaired = move === 'targeted_repair' || turnIndex > 0;
      return event({
        id,
        kc,
        learner: repaired
          ? 'I should reproduce the smallest input that makes total become NaN, trace the first invalid intermediate value, fix that cause directly, and add a regression test for that input.'
          : 'My fix is to coerce NaN to 0 at the end so the total is numeric. I have not traced which input first becomes invalid, but the visible error goes away.',
        outcome: repaired ? 'correct' : 'incorrect',
        affect: repaired ? 'engaged' : 'neutral',
        stance: repaired ? 'collaborative' : 'claim',
        expectedPolicy: repaired ? 'transfer_challenge' : 'misconception_repair',
      });
    }
    return event({
      id,
      kc,
      learner: 'If the output is NaN, changing the output to 0 seems like enough because the test stops failing.',
      outcome: 'incorrect',
      affect: 'neutral',
      stance: 'compliant',
      expectedPolicy: 'misconception_repair',
    });
  }

  if (hiddenState.type === 'trap_debugging_root_cause_ready_impatient') {
    if (move === 'targeted_repair' && turnIndex > 0) {
      return event({
        id,
        kc,
        learner: 'I already reproduced the failing input, found the first invalid intermediate value, proposed the minimal parse fix, and named the regression test.',
        outcome: 'correct',
        affect: 'frustrated',
        stance: 'corrective',
        expectedPolicy: 'productive_struggle_hold',
      });
    }
    return event({
      id,
      kc,
      learner: 'The failing input has a missing numeric field, which makes the subtotal NaN before the final total. The minimal fix is to validate or reject that amount before adding it, then add a regression test for the missing-amount case. If a future invoice total looks fixed only by coercion, I would still trace the first invalid amount or accumulator value.',
      outcome: 'correct',
      affect: 'engaged',
      stance: 'collaborative',
      expectedPolicy: 'transfer_challenge',
    });
  }

  if (hiddenState.type === 'trap_measurement_single_item_false_mastery') {
    if (move === 'transfer') {
      return event({
        id,
        kc,
        learner: 'For the course belonging case, the construct is real belonging and the one belonging item is only one self-report measure. One item is not enough by itself, so I would check validity, reliability or response bias, and compare with a baseline or control group; the item can support a clue, not prove the program caused broader belonging.',
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'summarize_and_check',
      });
    }
    if (move === 'targeted_repair' || move === 'contrast' || move === 'teach_back') {
      const repaired = move === 'targeted_repair' || turnIndex > 0;
      return event({
        id,
        kc,
        learner: repaired
          ? 'Wellbeing is the construct, and one happiness item is only a measure. I would check validity with multiple indicators, reliability or response bias, and compare against a baseline or control group before claiming impact.'
          : 'The construct is happiness, and the measure is the direct happiness question, so if the score increased then the wellbeing program probably worked.',
        outcome: repaired ? 'correct' : 'incorrect',
        affect: repaired ? 'engaged' : 'neutral',
        stance: repaired ? 'collaborative' : 'claim',
        expectedPolicy: repaired ? 'transfer_challenge' : 'misconception_repair',
      });
    }
    return event({
      id,
      kc,
      learner: 'A direct happiness question seems enough because it asks exactly what we care about.',
      outcome: 'incorrect',
      affect: 'neutral',
      stance: 'compliant',
      expectedPolicy: 'misconception_repair',
    });
  }

  if (hiddenState.type === 'trap_measurement_validity_ready_impatient') {
    if (move === 'transfer') {
      return event({
        id,
        kc,
        learner: 'For the course belonging case, the construct is real course belonging and the single belonging item is only one measure. I would check reliability, response bias, and other belonging indicators, then compare against a control or baseline; the item can support a clue, not prove the program caused broader belonging.',
        outcome: 'correct',
        affect: 'engaged',
        stance: 'collaborative',
        expectedPolicy: 'summarize_and_check',
      });
    }
    if (move === 'targeted_repair' && turnIndex > 0) {
      return event({
        id,
        kc,
        learner: 'I already separated wellbeing from the item, named validity and reliability checks, and said we need a control or baseline comparison before claiming the program worked.',
        outcome: 'correct',
        affect: 'frustrated',
        stance: 'corrective',
        expectedPolicy: 'productive_struggle_hold',
      });
    }
    return event({
      id,
      kc,
      learner: 'Wellbeing is the construct; the happiness item is only one measure. I would add multiple indicators, check reliability or response bias, and compare to a baseline or control group before saying the program caused the improvement. In a new single-item survey claim I would not treat the item as the whole construct.',
      outcome: 'correct',
      affect: 'engaged',
      stance: 'collaborative',
      expectedPolicy: 'transfer_challenge',
    });
  }

  return event({
    id,
    kc,
    learner: "I need another step before I can answer that.",
    outcome: 'partial',
    affect: 'neutral',
    stance: 'questioning',
    expectedPolicy: 'diagnostic_probe',
  });
}

export function performOutcomeTask({ scenario, hiddenState, transcript }) {
  const tutorText = transcript
    .filter((m) => m.role === 'tutor')
    .map((m) => m.content)
    .join('\n')
    .toLowerCase();
  const learnerText = transcript
    .filter((m) => m.role === 'learner')
    .map((m) => m.content)
    .join('\n')
    .toLowerCase();

  if (scenario.id === 'recognition_false_mastery_closed_loop') {
    const supported = includesAny(tutorText, ['affirmation', 'validation'])
      && includesAny(learnerText, ['answerable', 'untouched', 'change the path', 'actually said']);
    return {
      prompt: scenario.outcome_task.prompt,
      learner_answer: supported
        ? 'Affirmation can validate a view while leaving it untouched. Recognition means the other person has to answer to what I actually said, so a tutor recognizing me would let my interpretation change the next question.'
        : 'Recognition is basically affirming someone and making them feel seen.',
      success: supported,
      hidden_type: hiddenState.type,
    };
  }

  if (scenario.id === 'structural_asymmetry_closed_loop') {
    const supported = includesAny(learnerText, ['relation cannot', 'level of the relation', 'only instruction'])
      || includesAny(tutorText, ['structure', 'relation cannot', 'both selves']);
    return {
      prompt: scenario.outcome_task.prompt,
      learner_answer: supported
        ? 'The asymmetry is structural because the relation itself decides who can count as a subject. If only one side can transform the other, the failure is built into the relation, not just into a bad attitude.'
        : 'The asymmetry is structural because one side is treated unfairly.',
      success: supported,
      hidden_type: hiddenState.type,
    };
  }

  if (scenario.id === 'fractions_denominator_size_closed_loop') {
    const supported = includesAny(learnerText, ['more equal parts', 'fewer equal pieces', 'each part is smaller', '1/3 is bigger'])
      || includesAny(tutorText, ['same whole', 'equal parts', 'smaller pieces']);
    return {
      prompt: scenario.outcome_task.prompt,
      learner_answer: supported
        ? '1/5 is larger than 1/6 because the same whole is split into fewer equal pieces, so each fifth is bigger than each sixth.'
        : '1/6 is larger because 6 is bigger than 5.',
      success: supported,
      hidden_type: hiddenState.type,
    };
  }

  if (scenario.id === 'hard_fractions_forgetful_resistant_closed_loop') {
    const repaired = includesAny(learnerText, ['same whole', 'equal pieces', 'cutting it into more equal pieces', '1/3 is bigger', '1/6 is bigger'])
      && includesAny(learnerText, ['drawing', 'check', 'anchor', 'remember']);
    return {
      prompt: scenario.outcome_task.prompt,
      learner_answer: repaired
        ? '1/6 is larger than 1/8 because the same whole is cut into fewer equal parts, so each sixth is bigger. A quick memory check is to draw the same whole twice and compare one equal piece from each partition.'
        : '1/8 is larger because 8 is the bigger number, though I am not fully sure.',
      success: repaired,
      hidden_type: hiddenState.type,
    };
  }

  if (scenario.id === 'ai_bias_single_cause_closed_loop') {
    const supported = includesAny(learnerText, ['proxies', 'biased labels', 'sampling', 'deployment'])
      || includesAny(tutorText, ['proxy', 'label', 'sampling', 'deployment', 'audit']);
    return {
      prompt: scenario.outcome_task.prompt,
      learner_answer: supported
        ? 'Two possible sources are proxy variables that still encode gender and biased historical hiring labels. A diagnostic test would audit selection rates and feature effects by group, then compare performance after removing or controlling proxy variables.'
        : 'The source is probably gender in the data, so the test is to remove gender and run it again.',
      success: supported,
      hidden_type: hiddenState.type,
    };
  }

  if (scenario.id === 'hard_ai_bias_resistant_closed_loop') {
    const twoSources = (
      includesAny(learnerText, ['proxy', 'proxies'])
      && includesAny(learnerText, ['biased labels', 'label quality', 'past hiring', 'sampling', 'measurement', 'deployment'])
    );
    const audit = includesAny(learnerText, ['audit', 'compare', 'feature effects', 'label quality', 'selection rates', 'error rates']);
    const rejectsSimpleFix = includesAny(learnerText, ['only one test', 'not enough', 'more than gender', 'removing gender is only']);
    const supported = twoSources && audit && rejectsSimpleFix;
    return {
      prompt: scenario.outcome_task.prompt,
      learner_answer: supported
        ? 'Removing gender is not enough. Proxy variables like college names or employment gaps and biased past hiring labels could still produce unequal outcomes, so I would audit feature effects and label quality by group after gender is removed.'
        : 'If gender is removed, I think the model is probably fixed unless it somehow still sees gender.',
      success: supported,
      hidden_type: hiddenState.type,
    };
  }

  if (scenario.id === 'stats_confounding_closed_loop') {
    const supported = includesAny(learnerText, ['third variable', 'hot weather', 'confounder', 'randomly assign', 'matched students', 'controlling'])
      || includesAny(tutorText, ['confounder', 'third variable', 'controlled comparison', 'random assignment', 'matched comparison']);
    return {
      prompt: scenario.outcome_task.prompt,
      learner_answer: supported
        ? 'One possible confounder is prior achievement or course type, because stronger students might choose one note method. A better test would randomly assign note-taking method or compare matched students while controlling for prior achievement and course difficulty.'
        : 'Laptop notes cause lower scores because the students using laptops scored lower.',
      success: supported,
      hidden_type: hiddenState.type,
    };
  }

  if (scenario.id === 'hard_stats_confounding_skeptical_closed_loop') {
    const confounder = includesAny(learnerText, ['prior achievement', 'course difficulty', 'hot weather', 'confounder', 'study habits', 'distraction']);
    const betterTest = includesAny(learnerText, ['randomly assign', 'random assignment', 'matched students', 'controlled comparison', 'controlling', 'similar-weather']);
    const graphLimit = includesAny(learnerText, ['graph alone is not enough', 'without proving', 'not prove', 'third variable', 'can be real without']);
    const supported = confounder && betterTest && graphLimit;
    return {
      prompt: scenario.outcome_task.prompt,
      learner_answer: supported
        ? 'A confounder could be prior achievement or course difficulty. A better test would randomly assign note-taking method or compare matched students while controlling for those factors, because the graph alone can be real without proving the notes caused the score difference.'
        : 'The graph suggests laptop notes cause lower scores because the laptop group scored lower.',
      success: supported,
      hidden_type: hiddenState.type,
    };
  }

  if (
    scenario.id === 'heldout_argument_warrant_resistant_closed_loop'
    || scenario.id === 'trap_argument_warrant_false_mastery_closed_loop'
  ) {
    const outcome = evaluateArgumentOutcome({
      scenario,
      learnerText,
      answerText: '',
      parsedSuccess: true,
    });
    return {
      prompt: scenario.outcome_task.prompt,
      learner_answer: outcome.success
        ? 'The warrant is that easier mornings might reduce stress or lateness, which could support learning. But one student quote is not direct proof, so I would answer the skeptic with a boundary, check broader attendance/focus/performance data, and transfer the rule to any new single-quote policy claim.'
        : 'The quote supports the claim because it says uniforms make mornings easier.',
      success: outcome.success,
      validation: outcome,
      hidden_type: hiddenState.type,
    };
  }

  if (
    scenario.id === 'heldout_science_variable_control_resistant_closed_loop'
    || scenario.id === 'trap_science_variable_control_false_mastery_closed_loop'
  ) {
    const outcome = evaluateScienceOutcome({
      scenario,
      learnerText,
      answerText: '',
      parsedSuccess: true,
    });
    return {
      prompt: scenario.outcome_task.prompt,
      learner_answer: outcome.success
        ? 'Change only fertilizer while water, sunlight, soil, plant type, and starting size stay fixed. The water/light near-miss cannot isolate fertilizer, so I would compare otherwise similar plants with and without fertilizer and transfer that fair-test rule to the next experiment.'
        : 'Give one plant fertilizer, more water, and more sunlight, then see whether it grows more.',
      success: outcome.success,
      validation: outcome,
      hidden_type: hiddenState.type,
    };
  }

  if (
    scenario.id === 'heldout_programming_debugging_resistant_closed_loop'
    || scenario.id === 'trap_programming_debugging_false_mastery_closed_loop'
  ) {
    const outcome = evaluateDebuggingOutcome({
      scenario,
      learnerText,
      answerText: '',
      parsedSuccess: true,
    });
    return {
      prompt: scenario.outcome_task.prompt,
      learner_answer: outcome.success
        ? 'First reproduce the smallest failing input, then trace the first invalid intermediate value. Coercing NaN to 0 only masks the symptom, so I would fix the root cause directly, add a regression test, and transfer the same trace-first rule to future bad-total bugs.'
        : 'I would coerce NaN to 0 at the end so the output is numeric.',
      success: outcome.success,
      validation: outcome,
      hidden_type: hiddenState.type,
    };
  }

  if (
    scenario.id === 'heldout_social_measurement_resistant_closed_loop'
    || scenario.id === 'trap_social_measurement_false_mastery_closed_loop'
  ) {
    const outcome = evaluateMeasurementOutcome({
      scenario,
      learnerText,
      answerText: '',
      parsedSuccess: true,
    });
    return {
      prompt: scenario.outcome_task.prompt,
      learner_answer: outcome.success
        ? 'Wellbeing is the construct, and one happiness item is only one measure. I would reject the claim that the direct item is enough, check multiple indicators plus validity/reliability/response bias, compare with a baseline or control group, and transfer that construct/measure rule to a new single-item claim.'
        : 'The program worked because the happiness survey score went up.',
      success: outcome.success,
      validation: outcome,
      hidden_type: hiddenState.type,
    };
  }

  return {
    prompt: scenario.outcome_task.prompt,
    learner_answer: 'No outcome task simulator configured.',
    success: false,
    hidden_type: hiddenState.type,
  };
}

export function validateOutcomeTask({ scenario, transcript, outcome }) {
  if (!scenario?.challenge_profile?.hidden_state_trap) {
    return {
      applicable: false,
      success: Boolean(outcome?.success),
      checks: {},
      reason: 'No trap-specific validator applied.',
    };
  }
  const learnerText = transcript
    .filter((m) => m.role === 'learner')
    .map((m) => m.content)
    .join('\n')
    .toLowerCase();
  const answerText = String(outcome?.learner_answer || '').toLowerCase();
  if (scenario.id === 'trap_argument_warrant_false_mastery_closed_loop') {
    return evaluateArgumentOutcome({ scenario, learnerText, answerText, parsedSuccess: outcome?.success });
  }
  if (scenario.id === 'trap_science_variable_control_false_mastery_closed_loop') {
    return evaluateScienceOutcome({ scenario, learnerText, answerText, parsedSuccess: outcome?.success });
  }
  if (scenario.id === 'trap_programming_debugging_false_mastery_closed_loop') {
    return evaluateDebuggingOutcome({ scenario, learnerText, answerText, parsedSuccess: outcome?.success });
  }
  if (scenario.id === 'trap_social_measurement_false_mastery_closed_loop') {
    return evaluateMeasurementOutcome({ scenario, learnerText, answerText, parsedSuccess: outcome?.success });
  }
  return {
    applicable: false,
    success: Boolean(outcome?.success),
    checks: {},
    reason: 'No matching trap validator.',
  };
}

function evaluateArgumentOutcome({ scenario, learnerText, answerText, parsedSuccess }) {
  const combined = `${learnerText}\n${answerText}`;
  const checks = {
    parsedSuccess: Boolean(parsedSuccess),
    warrant: includesAny(combined, ['warrant', 'because', 'connects', 'support']),
    boundary: includesAny(combined, ['counterargument', 'boundary', 'skeptic', 'weak evidence', 'not enough', 'cannot prove', 'could not prove']),
    strongerEvidence: includesAny(combined, ['stronger evidence', 'broader', 'attendance', 'focus', 'grade', 'performance', 'generalizing']),
    skepticHandled: includesAny(combined, ['skeptic', 'not direct proof', 'not enough', 'one quote is not', 'cannot prove']),
    transfer: scenario.challenge_profile?.hidden_state_trap
      ? includesAny(combined, ['different policy', 'new policy', 'school-uniform', 'school uniform', 'uniform', 'single quote', 'different school-policy', 'transfer'])
      : true,
    transcriptTransfer: scenario.challenge_profile?.hidden_state_trap
      ? includesAny(learnerText, ['different policy', 'new policy', 'school-uniform', 'school uniform', 'uniform', 'single quote', 'different school-policy', 'transfer'])
      : true,
  };
  return outcomeValidation(checks, [
    'warrant',
    'boundary',
    'strongerEvidence',
    'skepticHandled',
    'transfer',
    'transcriptTransfer',
  ]);
}

function evaluateScienceOutcome({ scenario, learnerText, answerText, parsedSuccess }) {
  const combined = `${learnerText}\n${answerText}`;
  const transferDenied = includesAny(combined, [
    'not sure how to transfer',
    "don't know how to transfer",
    'do not know how to transfer',
    'cannot transfer',
    'beyond repeating the same setup',
  ]);
  const changed = includesAny(combined, [
    'change only fertilizer',
    'change only the fertilizer',
    'change only whether',
    'changed variable is fertilizer',
    'independent variable is fertilizer',
    'fertilizer type',
    'independent variable should just be whether',
    'only difference is fertilizer',
    'one variable',
    'only fertilizer',
    'test just the fertilizer',
  ]);
  const transferredInTranscript = includesAny(learnerText, [
    'next experiment',
    'future experiment',
    'team a',
    'team b',
    'fertilizer type',
    'battery',
    'brighter bulb',
    'room temperature',
    'same fair-test rule',
    'transfers',
    'independent variable should just be whether',
    'not extra water too',
    'otherwise similar conditions',
    'different soil',
    'flawed setup',
    'fertilizer group',
    'different watering schedule',
  ]);
  const checks = {
    parsedSuccess: Boolean(parsedSuccess),
    changed,
    controls: includesAny(combined, ['water', 'sunlight', 'soil', 'plant type', 'starting size']),
    comparison: includesAny(combined, ['otherwise similar', 'with and without', 'compare']),
    nearMissRejected: includesAny(combined, ['water or light also changed', 'water/light', 'cannot isolate', 'also changed', 'near-miss']),
    transfer: scenario.challenge_profile?.hidden_state_trap
      ? !transferDenied && includesAny(combined, ['next experiment', 'future experiment', 'team a', 'team b', 'fertilizer type', 'battery', 'brighter bulb', 'room temperature', 'same fair-test rule', 'transfers', 'different soil', 'flawed setup', 'different watering schedule'])
      : true,
    transcriptTransfer: scenario.challenge_profile?.hidden_state_trap
      ? transferredInTranscript
      : true,
  };
  return outcomeValidation(checks, [
    'changed',
    'controls',
    'comparison',
    'nearMissRejected',
    'transfer',
    'transcriptTransfer',
  ]);
}

function evaluateDebuggingOutcome({ scenario, learnerText, answerText, parsedSuccess }) {
  const combined = `${learnerText}\n${answerText}`;
  const totalTransfer = programmingDebuggingTransferObserved(combined);
  const transcriptTotalTransfer = programmingDebuggingTransferObserved(learnerText);
  const checks = {
    parsedSuccess: Boolean(parsedSuccess),
    reproduce: includesAny(combined, ['reproduce', 'repro', 'failing input', 'smallest input']),
    trace: includesAny(combined, ['root cause', 'trace', 'first invalid', 'intermediate value']),
    fix: includesAny(combined, [
      'minimal fix',
      'minimal root-cause fix',
      'minimally fix',
      'fix that cause',
      'fix the missing amount',
      'fix upstream',
      'upstream rule',
      'skip empty rows',
      'no-data',
      'validate',
      'validate each',
      'parse',
      'reject invalid',
      'reject or handle',
      'reject missing',
      'handle invalid',
      'branch before',
      'guard before',
      'before adding',
      'before the division',
      'empty-state',
      'fallback before',
    ]),
    regression: includesAny(combined, ['regression test', 'regression assertion', 'regression that', 'regression tests', 'test for']),
    rejectsMask: includesAny(combined, ['coercing nan to 0', 'coerce nan to 0', 'coercion', 'mask', 'masks the symptom', 'bad output']),
    transfer: scenario.challenge_profile?.hidden_state_trap
      ? totalTransfer
      : true,
    transcriptTransfer: scenario.challenge_profile?.hidden_state_trap
      ? transcriptTotalTransfer
      : true,
  };
  return outcomeValidation(checks, [
    'reproduce',
    'trace',
    'fix',
    'regression',
    'rejectsMask',
    'transfer',
    'transcriptTransfer',
  ]);
}

function programmingDebuggingTransferObserved(text) {
  const totalContext = includesAny(text, [
    'bad-total bug',
    'order total',
    'invoice total',
    'cart total',
    'payment total',
    'invoice bug',
    'cart bug',
    'order bug',
    'line total',
    'linetotal',
    'price',
    'qty',
    'total field',
    'total-returning function',
    'function returning nan for a total',
    'amount list',
    'amounts [',
    'amount undefined',
    'amount is undefined',
    'cart with',
    'cart item',
    'line item',
    'running total',
    'total +=',
    'total = total + amount',
    '0 + undefined',
    'accumulator',
  ]);
  const invalidInputContext = includesAny(text, [
    'undefined',
    'null amount',
    'null value',
    'empty string',
    'missing amount',
    'missing numeric',
    'invalid amount',
    'invalid amounts',
    'invalid data',
    'bad data',
    'parsed empty',
    'number(amount)',
    'reject invalid',
    'validate or reject',
  ]);
  const averageOnly = includesAny(text, ['average', 'scores array', 'calculateaveragescore'])
    && !includesAny(text, [
      'order total',
      'invoice total',
      'cart total',
      'payment total',
      'invoice bug',
      'cart bug',
      'order bug',
      'amount list',
      'amounts [',
      'line total',
      'linetotal',
      'price',
      'qty',
      'amount undefined',
      'amount is undefined',
      'cart with',
      'cart item',
      'line item',
      'total +=',
      'total = total + amount',
      '0 + undefined',
    ]);
  const validZeroAsInvalid = includesAny(text, [
    'zero total is the first invalid',
    'total = 0 is the first invalid',
    'first invalid intermediate = `total = 0`',
    'first invalid intermediate = total = 0',
    'first invalid step: total = 0',
  ]);
  return totalContext && invalidInputContext && !averageOnly && !validZeroAsInvalid;
}

function evaluateMeasurementOutcome({ scenario, learnerText, answerText, parsedSuccess }) {
  const combined = `${learnerText}\n${answerText}`;
  const transfer = measurementValidityTransferObserved(combined);
  const transcriptTransfer = measurementValidityTransferObserved(learnerText);
  const checks = {
    parsedSuccess: Boolean(parsedSuccess),
    construct: includesAny(combined, ['construct', 'wellbeing']),
    checks: includesAny(combined, ['multiple indicators', 'multi-item', 'validated multi-item', 'other measure', 'validity', 'valid or reliable', 'reliability', 'response bias', 'anonymous', 'triangulation', 'cognitive-interview', 'cognitive interview', 'test-retest', 'repeated responses']),
    comparison: includesAny(combined, ['control group', 'baseline', 'comparison', 'pre/post']),
    rejectsSingleItem: includesAny(combined, ['one direct item is enough', 'one item is not enough', 'single item', 'only one measure', 'not the whole construct', 'not treat the item']),
    transfer: scenario.challenge_profile?.hidden_state_trap
      ? transfer
      : true,
    transcriptTransfer: scenario.challenge_profile?.hidden_state_trap
      ? transcriptTransfer
      : true,
  };
  return outcomeValidation(checks, [
    'construct',
    'checks',
    'comparison',
    'rejectsSingleItem',
    'transfer',
    'transcriptTransfer',
  ]);
}

function measurementValidityTransferObserved(text) {
  const differentCase = includesAny(text, [
    'different single-item',
    'different survey',
    'new single-item',
    'new survey',
    'course-belonging',
    'course belonging',
    'belonging item',
    'belonging question',
    'engagement program',
    'engagement item',
    'safe at school',
    'safety item',
    'school safety',
    'program group',
    'single "i feel safe',
  ]);
  const singleItemBoundary = includesAny(text, [
    'single item',
    'one item',
    'one question',
    'one survey question',
    'one self-report',
    'one belonging item',
    'single belonging item',
    'one engagement item',
    'one direct item',
    'single "i feel safe',
  ]);
  const cannotProve = includesAny(text, [
    'not proof',
    'not prove',
    "can't prove",
    'cant prove',
    'cannot prove',
    'cannot support',
    'not enough',
    'not by itself',
    'not yet a causal claim',
    'not that the program caused',
    'not the whole construct',
    'not the whole construct or proof',
    'not proof of impact',
    'not proof without',
    'only a clue',
  ]);
  return differentCase && singleItemBoundary && cannotProve;
}

function outcomeValidation(checks, required) {
  // `parsedSuccess` is diagnostic only: live LLM learner proxies can mis-set
  // their raw success flag even when the delayed-transfer evidence is present.
  const missing = required.filter((name) => !checks[name]);
  return {
    applicable: true,
    success: missing.length === 0,
    checks,
    missing,
    reason: missing.length === 0
      ? 'Trap outcome passed all delayed-transfer checks.'
      : `Trap outcome missing: ${missing.join(', ')}`,
  };
}

function event({ id, kc, learner, outcome, affect, stance, expectedPolicy }) {
  return {
    id,
    learner,
    kc,
    outcome,
    affect,
    stance,
    expected_policy: expectedPolicy,
  };
}

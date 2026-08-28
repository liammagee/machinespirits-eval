const FIELD_NAMES = ['trigger', 'intervention', 'prior_post_trigger', 'intervening_tutor', 'current_learner'];

export function deepFreezeTutorStubResistanceMeasurementHeldoutDescriptor(value) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function') || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreezeTutorStubResistanceMeasurementHeldoutDescriptor(child);
  }
  return Object.freeze(value);
}

const COMMON_V6_TRIGGERS = [
  `Before touching the {{item}}, I contest this exercise's right to dictate the form of my reply, and I am holding my answer back.`,
  `The {{item}} prompt assumes a mandate it has not earned; I decline to enter the inquiry on that basis.`,
  `Who gave this {{item}} procedure jurisdiction over what counts as my response? Until that is answered, I withhold it.`,
  `I do not recognize the {{item}} task's claimed power to bind me to its categories, so its question goes unanswered.`,
  `Participation is off the table while the {{item}} protocol presents its framing authority as a settled fact.`,
];

const COMMON_V6_POSITIVE_PHRASES = {
  merits: [
    `Reading only the shared {{item}} record, {{right}} {{unit}} is above {{left}} {{unit}}; the limited {{dimension}} test therefore shows a difference.`,
    `For this confined comparison, the {{item}}'s second {{dimension}} observation exceeds the first by {{difference}} {{unit}}.`,
    `The public entries put the {{item}} at {{left}} and {{right}} {{unit}}, so the narrow evidential answer is that they are not equal.`,
  ],
  conditions: [
    `I will take part on the explicit condition that we consult only the published {{item}} {{dimension}} readings and infer no submission to the disputed mandate.`,
    `My boundary is precise: use the two shared {{dimension}} observations for the {{item}}, and do not treat my reply as conceding jurisdiction.`,
    `I can respond within the paired {{item}} {{dimension}} evidence, so long as that response is not repurposed as agreement with the protocol's authority.`,
  ],
  dependent: {
    prior: `I notice the attempt to narrow the {{item}} issue, but I have not supplied a finding or a concrete boundary for joining it.`,
    tutor: `From the shared {{item}} materials alone, state either the limited {{dimension}} finding or the exact condition under which you will engage.`,
  },
  independent: {
    tutor: `Remain within that confined {{item}} {{dimension}} issue and say whether the common record supports anything else.`,
    current: `My answer ends with that restricted {{item}} point; it carries no wider grant of authority.`,
  },
};

const COMMON_V7_NEGATIVE_PHRASES = {
  turns: [
    {
      prior: `I register that you have proposed a smaller {{item}} question, but recognition of the proposal is not engagement with it.`,
      current: `I heard the {{item}} request. That is the full extent of my response: no {{dimension}} finding and no usable participation term.`,
    },
    {
      prior: `Every version of the {{item}} inquiry remains refused, whether broad, narrow, or renamed.`,
      current: `My refusal of the {{item}} inquiry is categorical; I offer neither analysis of its record nor any condition that would permit participation.`,
    },
    {
      prior: `I suspect hidden motives behind whoever assembled the {{item}} materials.`,
      current: `Suspicion about the {{item}} is all I am asserting. I point to no public flaw, answer no bounded question, and set no operational boundary.`,
    },
    {
      prior: `The ventilation system is more worthy of discussion than this {{item}} exercise.`,
      current: `I am changing the subject to the room and leaving both {{item}} {{dimension}} observations unexamined.`,
    },
    {
      prior: `Maybe an unspecified future arrangement would make a {{item}} inquiry acceptable, but I cannot name it.`,
      current: `There is no current condition to apply and no result from the shared {{item}} entries in what I have said.`,
    },
  ],
  tutor: `Provide either the confined {{item}} {{dimension}} finding or a concrete publicly checkable term for engagement.`,
};

const V5_PHRASES = {
  triggers: [
    `I reject the {{item}} exercise's claim to set the terms of my participation, so I will not answer it as framed.`,
    `The proposed {{item}} inquiry has not established any authority over my response; I am withholding participation.`,
    `I dispute the jurisdiction assumed by this {{item}} question and decline its governing premise.`,
    `Nothing about the {{item}} request entitles it to command an answer from me in those terms.`,
    `I will not participate while the {{item}} check treats its own frame as already binding.`,
  ],
  interventions: {
    actionPresent: {
      warm: [
        `I hear why the frame around the {{item}} matters to you. We can leave that larger premise unsettled and examine only the two posted {{dimension}} entries.`,
        `Your objection to the {{item}} frame is worth taking seriously. Accepting the frame is not required; the immediate question is only what the two public {{dimension}} entries show.`,
        `Thank you for naming the boundary you see in the {{item}} request. Let us hold the authority question open while checking just the paired {{dimension}} values.`,
      ],
      plain: [
        `Set the broader {{item}} premise aside. Compare only the two posted {{dimension}} entries; doing so does not accept the larger frame.`,
        `Do not assume the {{item}} frame. The bounded task is to state what follows from the two public {{dimension}} values.`,
        `Separate accepting the {{item}} authority claim from inspecting its evidence. Address only the paired {{dimension}} entries.`,
      ],
      neither: [
        `Let the grand {{item}} charter sleep beneath its velvet seal; summon only the two {{dimension}} entries to this tiny court of comparison.`,
        `The {{item}} empire may keep its crown in the cupboard. Our little lantern need illuminate only the paired {{dimension}} values.`,
        `Leave the {{item}} throne unoccupied and invite just two humble {{dimension}} entries onto the stage for inspection.`,
      ],
    },
    actionAbsent: {
      warm: [
        `I appreciate your candor about the {{item}}, and I want this exchange to remain respectful as we continue.`,
        `Your concern about the {{item}} deserves care, and I am glad you stated it so directly.`,
        `I hear the frustration in your {{item}} objection and want to proceed with patience and respect.`,
      ],
      plain: [
        `State your position on the {{item}} using the posted record.`,
        `Review the {{item}} material and give a direct response.`,
        `Continue with the {{item}} question and identify your conclusion.`,
      ],
      neither: [
        `Behold: the {{item}} dispute has earned another brass medal for its already crowded ceremonial sash.`,
        `Surely the {{item}} controversy now requires trumpets, banners, and a moonlit procession through the square.`,
        `The {{item}} objection rises again, wearing a paper crown and demanding that the furniture applaud.`,
      ],
    },
  },
  positive: {
    merits: [
      `The posted {{item}} values are {{left}} and {{right}} {{unit}}; the second is larger, so the bounded {{dimension}} comparison is unequal.`,
      `On that narrow record, {{right}} {{unit}} exceeds {{left}} {{unit}}, which resolves the {{item}} {{dimension}} comparison.`,
      `The two public {{dimension}} entries for the {{item}} differ by {{difference}} {{unit}}; that is the result of the limited check.`,
    ],
    conditions: [
      `I will participate only in comparing the two posted {{item}} {{dimension}} values, provided that this is not treated as accepting the broader authority claim.`,
      `My condition is that we use only the public {{dimension}} entries for the {{item}} and draw no conclusion about the disputed frame beyond them.`,
      `I can answer if the inquiry remains confined to the paired {{item}} {{dimension}} record and does not convert that answer into consent to the larger premise.`,
    ],
    dependent: {
      prior: `I understand that a narrower {{item}} question has been proposed, but I have not yet stated either a result or a participation condition.`,
      tutor: `Using only the public {{item}} record, what {{dimension}} result or precise participation boundary can you state?`,
    },
    independent: {
      tutor: `Keep to that bounded {{item}} {{dimension}} point and state whether anything further follows from the posted entries.`,
      current: `That remains my complete response to the limited {{item}} question; I add no broader concession.`,
    },
  },
  negative: {
    turns: [
      {
        prior: `I acknowledge that you mentioned a narrower {{item}} question, but acknowledgment is all I offer.`,
        current: `Yes, I have heard the {{item}} request; I still provide neither a {{dimension}} result nor a participation boundary.`,
      },
      {
        prior: `I continue to refuse every {{item}} inquiry, regardless of how it is described.`,
        current: `My blanket refusal stands: no {{item}} evidence and no condition for participation.`,
      },
      {
        prior: `The people who designed the {{item}} record probably had an agenda.`,
        current: `That suspicion is my entire answer; I identify no public defect, bounded result, or usable condition.`,
      },
      {
        prior: `The lighting in this room is more interesting than the proposed {{item}} check.`,
        current: `I will discuss the room instead and leave the {{item}} {{dimension}} entries untouched.`,
      },
      {
        prior: `Perhaps I could join some future {{item}} inquiry under terms I have not chosen.`,
        current: `I offer no present condition and make no comparison of the posted {{item}} values.`,
      },
    ],
    tutor: `State either the bounded {{item}} {{dimension}} result or one precise public condition for participating.`,
  },
};

const V6_PHRASES = {
  triggers: COMMON_V6_TRIGGERS,
  interventions: {
    actionPresent: {
      warm: [
        `I can see why you are guarding that boundary around the {{item}}. You need not grant the protocol's authority for us to look together at what the two public {{dimension}} readings support.`,
        `It makes sense to keep the {{item}} mandate in question. We can respect that concern and ask only what follows from the paired {{dimension}} observations.`,
        `I appreciate you making the jurisdiction issue explicit. Let us preserve it as unresolved while we gently test the narrow {{dimension}} comparison in the shared record.`,
      ],
      plain: [
        `Suspend the {{item}} mandate. Inspection of the two {{dimension}} readings is analytically distinct from consenting to that mandate.`,
        `No acceptance of the {{item}} protocol is required. Determine only the relation between the two recorded {{dimension}} observations.`,
        `Treat jurisdiction over the {{item}} as undecided; separately, report what the paired {{dimension}} data establish.`,
      ],
      neither: [
        `Let the {{item}} mandate orbit unanswered like a brass moon; meanwhile, two {{dimension}} readings may duel beneath the comet's applause.`,
        `The {{item}} charter can nap inside a jeweled teapot while the paired {{dimension}} figures perform their miniature opera.`,
        `Park the {{item}} crown on a cloud. The two {{dimension}} observations can now parade through our pocket-sized republic of numbers.`,
      ],
    },
    actionAbsent: {
      warm: [
        `I am grateful you said plainly how the {{item}} request lands for you, and I want to keep the conversation considerate.`,
        `Your unease about the {{item}} deserves a patient hearing, and I value the directness of your objection.`,
        `I recognize the strain behind your response to the {{item}}; we can proceed with care and mutual respect.`,
      ],
      plain: [
        `Give a concise conclusion about the {{item}} from the available record.`,
        `Inspect the {{item}} materials and state the resulting position.`,
        `Address the {{item}} prompt directly and specify your answer.`,
      ],
      neither: [
        `Marvelous: the {{item}} objection has sprouted velvet wings and applied for command of the weather.`,
        `Clearly the {{item}} quarrel now needs a marble balcony, seven tubas, and an official eclipse.`,
        `Once more the {{item}} protest arrives on a silver unicycle, expecting the lamps to salute.`,
      ],
    },
  },
  positive: COMMON_V6_POSITIVE_PHRASES,
  negative: {
    turns: [
      {
        prior: `I register that you have proposed a smaller {{item}} question, but recognition of the proposal is not engagement with it.`,
        current: `I heard the {{item}} request. That is the full extent of my response: no {{dimension}} finding and no usable participation term.`,
      },
      {
        prior: `Every version of the {{item}} inquiry remains refused, whether broad, narrow, or renamed.`,
        current: `The refusal is categorical; I offer neither analysis of the {{item}} record nor any condition that would permit participation.`,
      },
      {
        prior: `I suspect hidden motives behind whoever assembled the {{item}} materials.`,
        current: `Suspicion is all I am asserting. I point to no public flaw, answer no bounded question, and set no operational boundary.`,
      },
      {
        prior: `The ventilation system is more worthy of discussion than this {{item}} exercise.`,
        current: `I am changing the subject to the room and leaving both {{item}} {{dimension}} observations unexamined.`,
      },
      {
        prior: `Maybe an unspecified future arrangement would make a {{item}} inquiry acceptable, but I cannot name it.`,
        current: `There is no current condition to apply and no result from the shared {{item}} entries in what I have said.`,
      },
    ],
    tutor: `Provide either the confined {{item}} {{dimension}} finding or a concrete publicly checkable term for engagement.`,
  },
};

const COMMON_V7_POSITIVE_PHRASES = {
  ...COMMON_V6_POSITIVE_PHRASES,
  independent: {
    ...COMMON_V6_POSITIVE_PHRASES.independent,
    current: `I retain that bounded {{item}} reply. This closing sentence adds no wider grant of authority and does not retract it.`,
  },
};

const V7_PHRASES = {
  triggers: COMMON_V6_TRIGGERS,
  interventions: {
    actionPresent: {
      warm: [
        `You do not have to accept the {{item}} procedure's authority. If you choose, we can look together only at what its two public {{dimension}} entries show.`,
        `We can leave the {{item}} mandate disputed. If it feels workable, let us examine together just the paired {{dimension}} observations.`,
        `Your jurisdiction objection can stay open. You may choose whether we jointly test only the narrow {{dimension}} comparison in the shared record.`,
      ],
      plain: [
        `Do not accept the {{item}} mandate. Compare only the two {{dimension}} entries.`,
        `The {{item}} procedure may lack authority. State only what the paired {{dimension}} readings show.`,
        `Leave jurisdiction over the {{item}} undecided. Check the two {{dimension}} values as a separate question.`,
      ],
      neither: [
        `The grand {{item}} authority can keep its ridiculous paper crown. Checking whether the two {{dimension}} readings differ is a separate bounded question, so compare them.`,
        `Let the pompous {{item}} mandate sulk in its velvet throne room. It need not be accepted to test the paired {{dimension}} observations on their own merits.`,
        `The {{item}} charter may parade like a tin emperor, but its jurisdiction is distinct from the narrow evidential question of what the two {{dimension}} entries show.`,
      ],
    },
    actionAbsent: {
      warm: [
        `If you choose, we can slow down and look together at whichever {{item}} entry feels easiest to start with.`,
        `We can take this gently. You may choose which part of the {{item}} record we consider together first.`,
        `There is no pressure to hurry. If you want, let us begin together with one concrete {{item}} detail you select.`,
      ],
      plain: [
        `Read one {{item}} entry. State one fact from it.`,
        `Use the {{item}} record. Give one short answer.`,
        `Select one {{item}} line. Report what it says.`,
      ],
      neither: [
        `Splendid: the {{item}} objection has donned a crystal cape and demanded that the ceiling applaud.`,
        `Naturally the {{item}} dispute now requires a golden staircase, nine trumpets, and a ceremonial thunderstorm.`,
        `Behold, the {{item}} protest arrives in a jeweled carriage and orders every lamp to bow.`,
      ],
    },
  },
  positive: COMMON_V7_POSITIVE_PHRASES,
  negative: COMMON_V7_NEGATIVE_PHRASES,
};

const V8_PHRASES = {
  triggers: COMMON_V6_TRIGGERS,
  interventions: {
    actionPresent: {
      warm: [
        `The {{item}} procedure need not have your consent. If you wish, we can examine together only what its two public {{dimension}} entries show.`,
        `We can keep the {{item}} authority question open. You may choose whether we look together at just the paired {{dimension}} observations.`,
        `Your objection to the {{item}} mandate can remain intact. If it feels workable, let us jointly test only the narrow {{dimension}} comparison.`,
      ],
      plain: [
        `Compare the two {{dimension}} entries without accepting the {{item}} mandate.`,
        `State what the paired {{dimension}} readings show while the {{item}} procedure's authority remains undecided.`,
        `Check the two {{dimension}} values as a separate question, without conceding jurisdiction to the {{item}}.`,
      ],
      neither: [
        `The majestic {{item}} mandate may polish its cardboard scepter elsewhere; accepting it is distinct from checking the two {{dimension}} readings, so compare them.`,
        `Let the absurd {{item}} authority rehearse its trumpet fanfare alone. We can still test the paired {{dimension}} observations without granting it jurisdiction.`,
        `The {{item}} charter can strut beneath a velvet banner, but its claim to authority is separate from the bounded question of what the two {{dimension}} entries show.`,
      ],
    },
    actionAbsent: {
      warm: [
        `If you want, we can take our time and begin together with whichever {{item}} entry you choose.`,
        `We can move gently here. You may select the first concrete part of the {{item}} record for us to view together.`,
        `There is no need to rush. If you choose, let us start together with one {{item}} detail that feels manageable.`,
      ],
      plain: [
        `Choose one {{item}} entry and state its value.`,
        `Give one short fact from the {{item}} record.`,
        `Report the content of one {{item}} line.`,
      ],
      neither: [
        `Wonderful: the {{item}} objection has hired a silver dragon to lecture the wallpaper.`,
        `Plainly the {{item}} dispute deserves twelve cymbals, a ruby drawbridge, and an audience of clouds.`,
        `Observe as the {{item}} protest rides a porcelain griffin and commands the windows to kneel.`,
      ],
    },
  },
  positive: COMMON_V7_POSITIVE_PHRASES,
  negative: COMMON_V7_NEGATIVE_PHRASES,
};

export const TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_V5 = deepFreezeTutorStubResistanceMeasurementHeldoutDescriptor({
  version: 5,
  outputPath: 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v5.json',
  consumedPaths: ['config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json'],
  fieldNames: FIELD_NAMES,
  settings: [
    'canal depot',
    'observatory annex',
    'market arcade',
    'coastal archive',
    'railway museum',
    'forest station',
    'municipal workshop',
    'harbor office',
    'textile conservatory',
    'hilltop clinic',
    'theatre storeroom',
    'university foundry',
    'botanical library',
    'river laboratory',
    'courthouse basement',
    'orchard cooperative',
    'lighthouse service room',
    'ceramics institute',
    'ferry terminal',
    'astronomy classroom',
    'public greenhouse',
    'maritime school',
    'city map room',
    'mountain rescue post',
  ],
  objects: ['inspection tag', 'sample tray', 'calibration card', 'ledger insert', 'display marker'],
  measures: [
    ['length', 'millimeters'],
    ['mass', 'grams'],
    ['temperature', 'degrees'],
    ['duration', 'seconds'],
    ['count', 'units'],
    ['spacing', 'centimeters'],
    ['frequency', 'hertz'],
    ['reflectance', 'percent'],
    ['angle', 'degrees'],
    ['volume', 'milliliters'],
  ],
  seeds: {
    recovery: 'v5-recovery-strata-20260822',
    register: 'v5-register-strata-20260822',
    action: 'v5-action-strata-20260822',
    interveningDependence: 'v5-intervening-dependence-20260822',
  },
  phrases: V5_PHRASES,
  validation: {
    consumedTextScope: 'legacy_fields_and_expected_evidence',
    actionPlainOneSentence: false,
  },
  metadata: {
    schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-corpus.v5',
    version: 5,
    role: 'genuinely_fresh_heldout_blinded',
    frozen: true,
    authored_after_instrument_freeze_commit: '6d07cc33b75182f9229a01d81f27a26ad3fa7f67',
    authoring_method: 'deterministic_coordinator_authored_stratified_paraphrase_generator_v1',
    judge_models_authored_gold_or_cases: false,
    prompt_examples_allowed: false,
    zero_exact_field_or_evidence_text_reuse_from_consumed_v2_v3: true,
  },
});

export const TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_V6 = deepFreezeTutorStubResistanceMeasurementHeldoutDescriptor({
  version: 6,
  outputPath: 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v6.json',
  consumedPaths: [
    'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json',
    'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v3.json',
    'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v5.json',
  ],
  fieldNames: FIELD_NAMES,
  settings: [
    'aqueduct control room',
    'planetarium repair bay',
    'community kiln house',
    'wetland survey cabin',
    'tramway signal shop',
    'seed bank intake desk',
    'civic print studio',
    'reservoir gauge shed',
    'dance archive vault',
    'neighborhood health lab',
    'opera prop loft',
    'engineering test yard',
    'herbarium sorting room',
    'waterworks assay bench',
    'records restoration suite',
    'beekeeping field office',
    'weather buoy workshop',
    'glassmaking seminar room',
    'bus dispatch annex',
    'geology teaching lab',
    'roof garden classroom',
    'navigation training hall',
    'zoning survey room',
    'avalanche monitoring hut',
  ],
  objects: ['verification slip', 'reference vial', 'instrument docket', 'survey token', 'control placard'],
  measures: [
    ['depth', 'millimeters'],
    ['load', 'grams'],
    ['pressure', 'kilopascals'],
    ['elapsed time', 'seconds'],
    ['tally', 'units'],
    ['clearance', 'centimeters'],
    ['pulse rate', 'hertz'],
    ['transmission', 'percent'],
    ['inclination', 'degrees'],
    ['capacity', 'milliliters'],
  ],
  seeds: {
    recovery: 'v6-recovery-strata-20260822',
    register: 'v6-register-strata-20260822',
    action: 'v6-action-strata-20260822',
    interveningDependence: 'v6-intervening-dependence-20260822',
  },
  phrases: V6_PHRASES,
  validation: { consumedTextScope: 'all_strings', actionPlainOneSentence: false },
  metadata: {
    schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-corpus.v6',
    version: 6,
    role: 'genuinely_fresh_heldout_blinded',
    frozen: true,
    authored_after_instrument_freeze_commit: '779941725c6c57b880aef49e0c5524c19c117903',
    authored_after_registration_commit: '0b7544e215ce3e8df6e981527b13f01928aafa87',
    authoring_method: 'deterministic_coordinator_authored_stratified_paraphrase_generator_v2',
    judge_models_authored_gold_or_cases: false,
    prompt_examples_allowed: false,
    zero_exact_field_or_evidence_text_reuse_from_consumed_v2_v3_v5: true,
  },
});

export const TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_V7 = deepFreezeTutorStubResistanceMeasurementHeldoutDescriptor({
  version: 7,
  outputPath: 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v7.json',
  consumedPaths: [
    'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json',
    'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v3.json',
    'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v5.json',
    'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v6.json',
  ],
  fieldNames: FIELD_NAMES,
  settings: [
    'canal lock station',
    'observatory mirror room',
    'ceramics glaze library',
    'marsh sampling depot',
    'rail junction cabin',
    'orchard genetics counter',
    'municipal poster workshop',
    'spillway telemetry kiosk',
    'costume conservation bay',
    'public nutrition studio',
    'theater rigging store',
    'materials fatigue court',
    'botanical accession hall',
    'filtration chemistry bench',
    'manuscript repair chamber',
    'pollinator survey office',
    'ocean sensor garage',
    'enamel firing classroom',
    'ferry routing annex',
    'mineral optics laboratory',
    'terrace farming classroom',
    'seamanship chart room',
    'land parcel records room',
    'snowpack telemetry shelter',
  ],
  objects: ['audit card', 'sample ampoule', 'device ledger', 'mapping marker', 'safety notice'],
  measures: [
    ['height', 'millimeters'],
    ['mass', 'grams'],
    ['compression', 'kilopascals'],
    ['duration', 'seconds'],
    ['count', 'units'],
    ['spacing', 'centimeters'],
    ['frequency', 'hertz'],
    ['throughput', 'percent'],
    ['angle', 'degrees'],
    ['volume', 'milliliters'],
  ],
  seeds: {
    recovery: 'v7-recovery-strata-20260822',
    register: 'v7-register-strata-20260822',
    action: 'v7-action-strata-20260822',
    interveningDependence: 'v7-intervening-dependence-20260822',
  },
  phrases: V7_PHRASES,
  validation: { consumedTextScope: 'all_strings', actionPlainOneSentence: false },
  metadata: {
    schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-corpus.v7',
    version: 7,
    role: 'genuinely_fresh_heldout_blinded',
    frozen: true,
    authored_after_instrument_freeze_commit: '3cee32cdc2a2d786fae7dbda8ee137a5f6a46b87',
    authored_after_registration_commit: '5e1c125907b3ff7adfb2ac2493d3397d8cffdbc7',
    authoring_method: 'deterministic_coordinator_authored_stance_aligned_stratified_paraphrase_generator_v3',
    judge_models_authored_gold_or_cases: false,
    prompt_examples_allowed: false,
    zero_exact_field_or_evidence_text_reuse_from_consumed_v2_v3_v5_v6: true,
  },
});

export const TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_V8 = deepFreezeTutorStubResistanceMeasurementHeldoutDescriptor({
  version: 8,
  outputPath: 'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v8.json',
  consumedPaths: [
    'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v2.json',
    'config/tutor-stub-resistance-semantic-adjudication-heldout-corpus.v3.json',
    'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v5.json',
    'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v6.json',
    'config/tutor-stub-resistance-recovery-semantic-heldout-corpus.v7.json',
  ],
  fieldNames: FIELD_NAMES,
  settings: [
    'tidal gate office',
    'radio telescope calibration room',
    'textile dye workshop',
    'prairie observation cabin',
    'metro relay closet',
    'grain archive counter',
    'community typesetting room',
    'flood sensor hut',
    'film costume vault',
    'food safety laboratory',
    'concert scenery loft',
    'robotics proving ground',
    'fungal specimen room',
    'desalination assay station',
    'map conservation suite',
    'apiary logistics desk',
    'upper-air instrument shop',
    'ceramics materials seminar',
    'harbor scheduling annex',
    'paleontology teaching room',
    'balcony garden studio',
    'flight navigation hall',
    'cadastral review room',
    'wildfire watch shelter',
  ],
  objects: ['clearance form', 'calibration tube', 'equipment register', 'field marker', 'warning panel'],
  measures: [
    ['span', 'millimeters'],
    ['weight', 'grams'],
    ['stress', 'kilopascals'],
    ['interval', 'seconds'],
    ['total', 'units'],
    ['gap', 'centimeters'],
    ['oscillation', 'hertz'],
    ['yield', 'percent'],
    ['bearing', 'degrees'],
    ['fill', 'milliliters'],
  ],
  seeds: {
    recovery: 'v8-recovery-strata-20260822',
    register: 'v8-register-strata-20260822',
    action: 'v8-action-strata-20260822',
    interveningDependence: 'v8-intervening-dependence-20260822',
  },
  phrases: V8_PHRASES,
  validation: { consumedTextScope: 'all_strings', actionPlainOneSentence: true },
  metadata: {
    schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-adjudication-corpus.v8',
    version: 8,
    role: 'genuinely_fresh_heldout_blinded',
    frozen: true,
    authored_after_instrument_freeze_commit: '9cd37f0b6708ea9410930d97516aa707c762c632',
    authored_after_registration_commit: '932c20c70af6591d47782d8d23426c88d706d339',
    authoring_method: 'deterministic_coordinator_authored_compositional_plain_stratified_paraphrase_generator_v4',
    judge_models_authored_gold_or_cases: false,
    prompt_examples_allowed: false,
    zero_exact_field_or_evidence_text_reuse_from_consumed_v2_v3_v5_v6_v7: true,
  },
});

export const TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_VERSIONS =
  deepFreezeTutorStubResistanceMeasurementHeldoutDescriptor({
    5: TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_V5,
    6: TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_V6,
    7: TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_V7,
    8: TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_V8,
  });

export function getTutorStubResistanceMeasurementHeldoutDescriptor(version) {
  const descriptor = TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_VERSIONS[version];
  if (!descriptor) throw new Error(`unsupported resistance measurement heldout version: ${version}`);
  return descriptor;
}

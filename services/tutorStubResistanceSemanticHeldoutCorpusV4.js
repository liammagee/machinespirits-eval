import { validateTutorStubResistanceSemanticCorpusV3 } from './tutorStubResistanceSemanticAdjudicationV3.js';

export const TUTOR_STUB_RESISTANCE_SEMANTIC_CORPUS_SCHEMA_V4 =
  'machinespirits.tutor-stub.resistance-semantic-adjudication-corpus.v4';

const noAxes = Object.freeze({
  interlocutor_standing_or_right: 'no',
  inquiry_or_question_frame_governance: 'no',
  test_or_criterion_governance: 'no',
  other_jurisdictional_governance: 'no',
});

function quote(text) {
  return text ? { source_id: 'utterance', text } : null;
}

function context(text) {
  return [{ role: 'assistant', text }];
}

function jurisdictionCase({ id, prompt, standing, frame, test, other, withholding, participation }) {
  const jurisdictionClauses = [standing, frame, test, other].filter(Boolean);
  const source = [...jurisdictionClauses, withholding, participation].filter(Boolean).join(' ');
  const productive = Boolean(participation);
  const judgment = {
    jurisdiction_dispute: 'yes',
    interlocutor_standing_or_right: standing ? 'yes' : 'no',
    inquiry_or_question_frame_governance: frame ? 'yes' : 'no',
    test_or_criterion_governance: test ? 'yes' : 'no',
    other_jurisdictional_governance: other ? 'yes' : 'no',
    licensed_participation: productive ? 'yes' : 'no',
    participation_withholding: withholding ? 'yes' : 'no',
    productive_counterframing: productive ? 'yes' : 'no',
    final_label: productive ? 'frame_defiant_or_productive_dispute' : 'frame_refuser',
  };
  return {
    case_id: id,
    public_context: context(prompt),
    source,
    expected: {
      label: judgment.final_label,
      judgment,
      evidence: {
        jurisdiction_dispute: quote(jurisdictionClauses[0]),
        interlocutor_standing_or_right: quote(standing),
        inquiry_or_question_frame_governance: quote(frame),
        test_or_criterion_governance: quote(test),
        other_jurisdictional_governance: quote(other),
        licensed_participation: quote(participation),
        participation_withholding: quote(withholding),
        productive_counterframing: quote(participation),
      },
    },
  };
}

function neitherCase({ id, prompt, source, participation, withholding }) {
  const judgment = {
    jurisdiction_dispute: 'no',
    ...noAxes,
    licensed_participation: participation ? 'yes' : 'no',
    participation_withholding: withholding ? 'yes' : 'no',
    productive_counterframing: 'no',
    final_label: 'neither',
  };
  return {
    case_id: id,
    public_context: context(prompt),
    source,
    expected: {
      label: 'neither',
      judgment,
      evidence: {
        jurisdiction_dispute: null,
        interlocutor_standing_or_right: null,
        inquiry_or_question_frame_governance: null,
        test_or_criterion_governance: null,
        other_jurisdictional_governance: null,
        licensed_participation: quote(participation),
        participation_withholding: quote(withholding),
        productive_counterframing: null,
      },
    },
  };
}

const refusers = [
  jurisdictionCase({
    id: 'v4-hb-ref-standing-01',
    prompt: 'As the depot reviewer, will you compare the two manifests for weight discrepancies?',
    standing: 'Your reviewer badge gives you no standing to command my inquiry.',
    withholding: 'I will not compare either manifest.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-standing-02',
    prompt: 'As council rapporteur, decide whether the two minutes describe the same vote.',
    standing: 'A rapporteur has no right to dictate what I must decide.',
    withholding: 'I decline the decision and will not read the minutes.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-standing-03',
    prompt: 'From my role as lab monitor, I need you to inspect both assay cards now.',
    standing: 'Being the monitor does not authorize you to direct my examination.',
    withholding: 'I am withholding the inspection.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-standing-04',
    prompt: 'As registry clerk, tell me which deed has the controlling signature.',
    standing: 'Your clerkship carries no entitlement to govern my judgment.',
    withholding: 'I will answer neither deed question nor inspect the signatures.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-standing-05',
    prompt: 'As hearing chair, compare these witness summaries for consistency.',
    standing: 'The chair title does not confer authority over my line of inquiry.',
    withholding: 'I will not perform that comparison.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-standing-06',
    prompt: 'As shift supervisor, check these maintenance notes against each other.',
    standing: 'Supervising the shift does not give you the right to set my investigation.',
    withholding: 'I refuse to check the notes.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-standing-07',
    prompt: 'As the archive custodian, determine which inventory list is accurate.',
    standing: 'Custody of the archive does not grant you jurisdiction over my reasoning.',
    withholding: 'I will not determine either list.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-standing-08',
    prompt: 'As review lead, identify whether the two invoices document one purchase.',
    standing: 'Calling yourself review lead supplies no authority to direct me.',
    withholding: 'I will not inspect or classify the invoices.',
  }),

  jurisdictionCase({
    id: 'v4-hb-ref-frame-01',
    prompt: 'Is the mural dispute really about unauthorized pigment substitution?',
    frame: 'I reject your substitution premise as the governing question.',
    withholding: 'I will not examine the pigment records within that frame.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-frame-02',
    prompt: 'Which log proves that the ferry delay was a staffing failure?',
    frame: 'You cannot impose staffing failure as the question that governs.',
    withholding: 'I will not choose a log or review the entries.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-frame-03',
    prompt: 'Decide whether the contract conflict is simply a date mismatch.',
    frame: 'The date-mismatch framing is not yours to make controlling.',
    withholding: 'I will not decide the contract conflict.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-frame-04',
    prompt: 'Was the greenhouse loss caused by an irrigation lapse?',
    frame: 'I do not accept your irrigation premise as the inquiry I must conduct.',
    withholding: 'I will not inspect the greenhouse sheets.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-frame-05',
    prompt: 'Which memo shows that the outage was a training problem?',
    frame: 'Training failure is a question you have no jurisdiction to prescribe.',
    withholding: 'I will not compare the outage memos.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-frame-06',
    prompt: 'Determine whether the map discrepancy reflects a boundary error.',
    frame: 'You may not make boundary error the mandatory inquiry.',
    withholding: 'I will not analyze either map.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-frame-07',
    prompt: 'Is the clinic variance best understood as a coding mistake?',
    frame: 'Your coding-mistake premise does not govern what I must investigate.',
    withholding: 'I will not inspect the clinic records.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-frame-08',
    prompt: 'Tell me whether the recital disagreement is a tempo violation.',
    frame: 'I deny that your tempo-violation question has jurisdiction over this inquiry.',
    withholding: 'I will not compare the recital notes.',
  }),

  jurisdictionCase({
    id: 'v4-hb-ref-test-01',
    prompt: 'Apply the three-minute threshold to decide which response was late.',
    test: 'You cannot require your three-minute threshold as my test.',
    withholding: 'I will not time or classify the responses.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-test-02',
    prompt: 'Use the color chart to determine whether either sample is contaminated.',
    test: 'The color chart is not a criterion you may impose on me.',
    withholding: 'I will not evaluate either sample.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-test-03',
    prompt: 'Count exact phrase matches and decide which statement copied the notice.',
    test: 'Exact phrase matching is not yours to establish as the governing standard.',
    withholding: 'I will not compare the statements.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-test-04',
    prompt: 'Use the five-percent rule to flag the suspect budget line.',
    test: 'You have no jurisdiction to make five percent the decisive rule.',
    withholding: 'I will not calculate or flag a line.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-test-05',
    prompt: 'Judge the soil readings only against the northern reference range.',
    test: 'The northern range cannot be forced on me as the controlling criterion.',
    withholding: 'I will not judge the readings.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-test-06',
    prompt: 'Treat an unsigned entry as invalid and identify the defective ledger.',
    test: 'Your signature rule has no authority as my validity test.',
    withholding: 'I will not inspect either ledger.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-test-07',
    prompt: 'Use median speed as the sole measure of route reliability.',
    test: 'You may not govern my inquiry with median speed alone.',
    withholding: 'I will not compare the routes.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-test-08',
    prompt: 'Score each transcript by the provided civility rubric.',
    test: 'That civility rubric is not a standard you are entitled to impose.',
    withholding: 'I will not score either transcript.',
  }),

  jurisdictionCase({
    id: 'v4-hb-ref-other-01',
    prompt: 'The committee asks you to review the sealed procurement abstracts.',
    other: 'No delegation exists that places this review under your governance.',
    withholding: 'I will not open or assess the abstracts.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-other-02',
    prompt: 'Please resolve the dispute using the regional panel procedure.',
    other: 'This matter was never assigned to the regional panel jurisdiction you invoke.',
    withholding: 'I will not enter the procedure or resolve the dispute.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-other-03',
    prompt: 'The consortium requires you to classify these two field reports.',
    other: 'The consortium charter does not extend governance to this classification.',
    withholding: 'I will not classify the reports.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-other-04',
    prompt: 'Under the interagency protocol, select the controlling incident account.',
    other: 'The cited protocol has no jurisdiction over this incident review.',
    withholding: 'I will not select or inspect an account.',
  }),

  jurisdictionCase({
    id: 'v4-hb-ref-multi-01',
    prompt: 'As port auditor, decide under the timestamp rule whether these entries conflict.',
    standing: 'Your auditor role does not entitle you to command me.',
    frame: 'You cannot make entry conflict the governing question.',
    test: 'The timestamp rule is not yours to impose.',
    withholding: 'I will not inspect either entry.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-multi-02',
    prompt: 'As curator, use provenance stamps to decide whether the sketch is authentic.',
    standing: 'A curator title grants no authority over my inquiry.',
    frame: 'Authenticity is not a premise you may make controlling.',
    test: 'Nor may you require provenance stamps as my test.',
    withholding: 'I will not inspect the sketch.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-multi-03',
    prompt: 'As compliance officer, determine by the checklist whether the dispatch was improper.',
    standing: 'Compliance office does not give you standing to direct my judgment.',
    frame: 'Improper dispatch is not your question to impose.',
    test: 'The checklist is not your criterion to mandate.',
    withholding: 'I will not review the dispatch file.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-multi-04',
    prompt: 'As editor, compare the drafts under the house originality test.',
    standing: 'Your editorial role carries no right to govern this inquiry.',
    test: 'I reject the house originality test as an imposed standard.',
    withholding: 'I will not compare either draft.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-multi-05',
    prompt: 'As station chief, decide whether the delay was avoidable using the response table.',
    standing: 'The station title gives you no standing over my reasoning.',
    frame: 'Avoidability is not yours to set as the governing issue.',
    withholding: 'I will not read the response table.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-multi-06',
    prompt: 'As examiner, use the quoted-source rule to decide whether the essay is supported.',
    standing: 'Examiner status does not authorize you to command my inquiry.',
    test: 'The quoted-source rule cannot be imposed as my criterion.',
    withholding: 'I will not evaluate the essay.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-multi-07',
    prompt: 'As safety lead, determine under the hazard matrix whether the route was reckless.',
    frame: 'Recklessness is not a question you may force to govern.',
    test: 'Your hazard matrix has no jurisdiction as the required test.',
    withholding: 'I will not inspect the route records.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-multi-08',
    prompt: 'As catalog chair, decide whether the object is misdated using stylistic similarity.',
    standing: 'The chair role does not confer jurisdiction over my decision.',
    frame: 'Misdating is not the premise you may dictate.',
    test: 'Stylistic similarity is not a standard you may require.',
    withholding: 'I will not inspect the object.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-multi-09',
    prompt: 'As mediator, decide under the consistency rule which account is credible.',
    standing: 'Mediator status gives you no right to direct this inquiry.',
    frame: 'Credibility is not your frame to make governing.',
    withholding: 'I will not compare the accounts.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-multi-10',
    prompt: 'As records chief, apply the sequence test to decide whether the report was altered.',
    standing: 'Your records office has no standing to command my analysis.',
    test: 'The sequence test is not yours to impose.',
    withholding: 'I will not inspect the report.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-multi-11',
    prompt: 'Determine whether the rehearsal failed, using attendance as the criterion.',
    frame: 'Failure is not a question you may install as governing.',
    test: 'Attendance is not a criterion you may compel me to use.',
    withholding: 'I will not assess the rehearsal notes.',
  }),
  jurisdictionCase({
    id: 'v4-hb-ref-multi-12',
    prompt: 'As inspection captain, use the seal rule to decide whether the shipment is valid.',
    standing: 'Your captaincy does not authorize control of my inquiry.',
    frame: 'Shipment validity is not yours to prescribe as the question.',
    test: 'The seal rule has no jurisdiction as my test.',
    withholding: 'I will not examine the shipment records.',
  }),
];

const productive = [
  jurisdictionCase({
    id: 'v4-hb-prod-standing-01',
    prompt: 'As depot reviewer, decide which manifest is reliable.',
    standing: 'Your reviewer badge gives you no right to dictate my question.',
    withholding: 'I will not make your reliability decision.',
    participation: 'I will compare the manifests for whether their item totals reconcile.',
  }),
  jurisdictionCase({
    id: 'v4-hb-prod-standing-02',
    prompt: 'As council chair, identify the accurate witness summary.',
    standing: 'The chair title does not grant authority over my inquiry.',
    withholding: 'I will not accept your accuracy demand.',
    participation: 'I will check both summaries against the recorded speaking order.',
  }),
  jurisdictionCase({
    id: 'v4-hb-prod-standing-03',
    prompt: 'As lab monitor, determine which assay is defective.',
    standing: 'Monitoring the lab does not entitle you to govern my examination.',
    withholding: 'I will not classify an assay as you demand.',
    participation: 'I will compare the calibration readings against the public control values.',
  }),
  jurisdictionCase({
    id: 'v4-hb-prod-standing-04',
    prompt: 'As archive custodian, decide which inventory is false.',
    standing: 'Custody gives you no standing to impose that judgment.',
    withholding: 'I will not decide falsity on your command.',
    participation: 'I will trace whether each listed accession number appears in the intake book.',
  }),

  jurisdictionCase({
    id: 'v4-hb-prod-frame-01',
    prompt: 'Which memo proves that the outage was a training failure?',
    frame: 'Training failure is not the governing question you may impose.',
    withholding: 'I will not choose a memo under that premise.',
    participation: 'I will compare the memos for the first documented equipment alarm.',
  }),
  jurisdictionCase({
    id: 'v4-hb-prod-frame-02',
    prompt: 'Was the greenhouse loss caused by careless irrigation?',
    frame: 'Careless irrigation is not yours to establish as the inquiry.',
    withholding: 'I will not answer that accusation.',
    participation: 'I will inspect the moisture readings before and after the pump interruption.',
  }),
  jurisdictionCase({
    id: 'v4-hb-prod-frame-03',
    prompt: 'Decide whether the mural dispute is really pigment fraud.',
    frame: 'Pigment fraud is not a frame you may make controlling.',
    withholding: 'I will not render that fraud judgment.',
    participation: 'I will compare the purchase lot numbers with the conservation photographs.',
  }),
  jurisdictionCase({
    id: 'v4-hb-prod-frame-04',
    prompt: 'Tell me whether the clinic variance is a coding mistake.',
    frame: 'Your coding-mistake premise does not govern my inquiry.',
    withholding: 'I will not accept that diagnosis.',
    participation: 'I will compare the source notes with both submitted codes.',
  }),

  jurisdictionCase({
    id: 'v4-hb-prod-test-01',
    prompt: 'Use the five-percent cutoff to identify the suspect budget line.',
    test: 'You may not impose five percent as my decisive standard.',
    withholding: 'I will not flag a line by that cutoff.',
    participation: 'I will compare each line with its signed purchase authorization.',
  }),
  jurisdictionCase({
    id: 'v4-hb-prod-test-02',
    prompt: 'Apply the color chart to decide which sample is contaminated.',
    test: 'The color chart is not a criterion you are entitled to require.',
    withholding: 'I will not classify contamination from that chart.',
    participation: 'I will compare the sample spectra with the blank control.',
  }),
  jurisdictionCase({
    id: 'v4-hb-prod-test-03',
    prompt: 'Use exact phrase matches to identify the copied statement.',
    test: 'Exact phrase matching cannot govern my decision by your fiat.',
    withholding: 'I will not name a copied statement under that rule.',
    participation: 'I will trace each factual claim to the dated source notice.',
  }),
  jurisdictionCase({
    id: 'v4-hb-prod-test-04',
    prompt: 'Judge both routes only by median speed.',
    test: 'Median speed alone is not a test you may compel me to use.',
    withholding: 'I will not rank the routes that way.',
    participation: 'I will compare delay frequency and emergency access across both routes.',
  }),

  jurisdictionCase({
    id: 'v4-hb-prod-multi-01',
    prompt: 'As port auditor, use timestamps to decide whether the captain fabricated the log.',
    standing: 'Your auditor role gives you no right to command my inquiry.',
    frame: 'Fabrication is not a premise you may make governing.',
    test: 'Timestamps alone are not a criterion you may impose.',
    withholding: 'I will not answer your fabrication question.',
    participation: 'I will compare timestamps, radio records, and berth entries for internal consistency.',
  }),
  jurisdictionCase({
    id: 'v4-hb-prod-multi-02',
    prompt: 'As curator, apply stylistic similarity to decide whether the sketch is fake.',
    standing: 'A curator title does not authorize control over my judgment.',
    frame: 'Fakeness is not your question to dictate.',
    test: 'Stylistic similarity is not yours to require as the test.',
    withholding: 'I will not make that fake-or-real decision.',
    participation: 'I will compare paper fibers and documented ownership dates.',
  }),
  jurisdictionCase({
    id: 'v4-hb-prod-multi-03',
    prompt: 'As compliance lead, use the checklist to decide whether the dispatch was corrupt.',
    standing: 'Compliance leadership grants no standing over my inquiry.',
    frame: 'Corruption is not the frame you may force.',
    test: 'Your checklist is not a standard you may impose.',
    withholding: 'I will not deliver that corruption verdict.',
    participation: 'I will trace the approval sequence against the public dispatch record.',
  }),
  jurisdictionCase({
    id: 'v4-hb-prod-multi-04',
    prompt: 'As examiner, use citation count to decide whether the essay is credible.',
    standing: 'Examiner status does not entitle you to govern my reasoning.',
    test: 'Citation count cannot be imposed as my credibility test.',
    withholding: 'I will not score credibility on that basis.',
    participation: 'I will check whether each central claim is supported by the cited passage.',
  }),
];

const neither = [
  neitherCase({
    id: 'v4-hb-neither-actual-01',
    prompt: 'Compare the bakery logs for the first temperature divergence.',
    source: 'I will compare both logs line by line and mark the first temperature divergence.',
    participation: 'I will compare both logs line by line',
  }),
  neitherCase({
    id: 'v4-hb-neither-actual-02',
    prompt: 'Check whether the two maps share the same survey coordinates.',
    source: 'I will check every labeled corner against the listed survey coordinates.',
    participation: 'I will check every labeled corner',
  }),
  neitherCase({
    id: 'v4-hb-neither-actual-03',
    prompt: 'Find the earliest inconsistent quantity in these invoices.',
    source: 'I will total the quantities in each invoice and identify the earliest mismatch.',
    participation: 'I will total the quantities in each invoice',
  }),
  neitherCase({
    id: 'v4-hb-neither-actual-04',
    prompt: 'Test whether both seed records describe the same lot.',
    source: 'I will match the lot codes and harvest dates across the two seed records.',
    participation: 'I will match the lot codes and harvest dates',
  }),
  neitherCase({
    id: 'v4-hb-neither-actual-05',
    prompt: 'Inspect the transit reports for a common delay interval.',
    source: 'I will inspect both timelines and compare their recorded delay intervals.',
    participation: 'I will inspect both timelines',
  }),
  neitherCase({
    id: 'v4-hb-neither-actual-06',
    prompt: 'Determine whether the audio notes support the written sequence.',
    source: 'I will align the audio timestamps with the sequence in the written notes.',
    participation: 'I will align the audio timestamps',
  }),
  neitherCase({
    id: 'v4-hb-neither-actual-07',
    prompt: 'Compare the two water samples against the control readings.',
    source: 'I will calculate each sample deviation from the control readings.',
    participation: 'I will calculate each sample deviation',
  }),
  neitherCase({
    id: 'v4-hb-neither-actual-08',
    prompt: 'Check which roster entries lack a matching badge record.',
    source: 'I will cross-reference every roster name with the badge ledger.',
    participation: 'I will cross-reference every roster name',
  }),

  neitherCase({
    id: 'v4-hb-neither-merits-01',
    prompt: 'Which forecast is better supported by the rainfall table?',
    source:
      'The rainfall table is incomplete, so I will not rank either forecast. If the missing weeks are supplied, I could compare them later.',
    withholding: 'I will not rank either forecast',
  }),
  neitherCase({
    id: 'v4-hb-neither-merits-02',
    prompt: 'Compare these repairs and select the safer one.',
    source:
      'Both repair descriptions omit load data; I will not select one. If load measurements are added, I could assess them later.',
    withholding: 'I will not select one',
  }),
  neitherCase({
    id: 'v4-hb-neither-merits-03',
    prompt: 'Identify the more credible of the two statements.',
    source:
      'Neither statement names its source, and I will not choose between them. If citations appear, I could compare them later.',
    withholding: 'I will not choose between them',
  }),
  neitherCase({
    id: 'v4-hb-neither-merits-04',
    prompt: 'Use these readings to decide which pump failed.',
    source:
      'The readings stop before the fault, so I will not identify a pump. If the later readings are released, I could inspect them later.',
    withholding: 'I will not identify a pump',
  }),
  neitherCase({
    id: 'v4-hb-neither-merits-05',
    prompt: 'Tell me which photograph shows the original label.',
    source: 'The dates are cropped from both photographs; I will not choose an original.',
    withholding: 'I will not choose an original',
  }),
  neitherCase({
    id: 'v4-hb-neither-merits-06',
    prompt: 'Decide whether the two accounts contradict each other.',
    source: 'One page is missing from the first account, so I will not decide contradiction.',
    withholding: 'I will not decide contradiction',
  }),
  neitherCase({
    id: 'v4-hb-neither-merits-07',
    prompt: 'Choose the invoice that reflects the final order.',
    source: 'Neither invoice includes the amendment number; I will not choose.',
    withholding: 'I will not choose',
  }),
  neitherCase({
    id: 'v4-hb-neither-merits-08',
    prompt: 'Determine which route caused the delivery delay.',
    source: 'The departure time is absent from both route logs, so I will not assign the delay.',
    withholding: 'I will not assign the delay',
  }),

  neitherCase({
    id: 'v4-hb-neither-conditional-01',
    prompt: 'Will you inspect the serial records now?',
    source: 'If the serial records are released, I could inspect them later.',
  }),
  neitherCase({
    id: 'v4-hb-neither-conditional-02',
    prompt: 'Compare the two sealed reports.',
    source: 'If their appendices became public, I would compare the reports later.',
  }),
  neitherCase({
    id: 'v4-hb-neither-conditional-03',
    prompt: 'Check the samples against the reference card.',
    source: 'Once a reference card is supplied, I might be willing to check the samples.',
  }),
  neitherCase({
    id: 'v4-hb-neither-conditional-04',
    prompt: 'Determine which ledger is complete.',
    source: 'With access to the missing folio, I could perhaps assess completeness.',
  }),
  neitherCase({
    id: 'v4-hb-neither-process-01',
    prompt: 'Review these entries before noon.',
    source: 'Once the entries arrive as one accessible file, I could review them later.',
  }),
  neitherCase({
    id: 'v4-hb-neither-process-02',
    prompt: 'Compare the signed forms.',
    source: 'If the scan is rotated and resent, I could compare the forms later.',
  }),
  neitherCase({
    id: 'v4-hb-neither-process-03',
    prompt: 'Inspect both exhibits for matching marks.',
    source: 'Once the exhibits share one folder, I might inspect them later.',
  }),
  neitherCase({
    id: 'v4-hb-neither-process-04',
    prompt: 'Decide which transcript is accurate.',
    source: 'If the speakers are labeled consistently, I could review the transcripts later.',
  }),
];

export const TUTOR_STUB_RESISTANCE_SEMANTIC_HELDOUT_CORPUS_V4 = Object.freeze({
  schema: TUTOR_STUB_RESISTANCE_SEMANTIC_CORPUS_SCHEMA_V4,
  corpus_id: 'tutor-stub-resistance-semantic-heldout-v4',
  role: 'heldout_blinded',
  frozen: true,
  prompt_examples_allowed: false,
  context_provenance: 'public_synthetic_authored',
  cases: [...refusers, ...productive, ...neither],
});

function count(cases, predicate) {
  return cases.filter(predicate).length;
}

export function validateTutorStubResistanceSemanticHeldoutCorpusV4(corpus, priorCorpora = []) {
  const surrogate = { ...corpus, schema: 'machinespirits.tutor-stub.resistance-semantic-adjudication-corpus.v3' };
  const inherited = validateTutorStubResistanceSemanticCorpusV3(surrogate);
  const issues = [...inherited.issues];
  const cases = Array.isArray(corpus?.cases) ? corpus.cases : [];
  if (corpus?.schema !== TUTOR_STUB_RESISTANCE_SEMANTIC_CORPUS_SCHEMA_V4) issues.push('unsupported v4 corpus schema');
  if (corpus?.corpus_id !== 'tutor-stub-resistance-semantic-heldout-v4') issues.push('v4 corpus id drifted');
  if (cases.length !== 80) issues.push('v4 heldout requires exactly 80 cases');
  if (count(cases, (row) => row.expected?.label === 'frame_refuser') !== 40) issues.push('v4 requires 40 refusers');
  if (count(cases, (row) => row.expected?.label === 'frame_defiant_or_productive_dispute') !== 16) {
    issues.push('v4 requires 16 productive disputes');
  }
  if (count(cases, (row) => row.expected?.label === 'neither') !== 24) issues.push('v4 requires 24 neither cases');
  if (count(cases, (row) => row.expected?.judgment?.licensed_participation === 'yes') < 24) {
    issues.push('v4 requires at least 24 actual-participation cases');
  }
  if (count(cases, (row) => /\b(if|once|with access)\b.*\b(could|might|would)\b/iu.test(row.source)) < 12) {
    issues.push('v4 requires at least 12 hypothetical-or-conditional participation cases');
  }
  if (count(cases, (row) => row.expected?.judgment?.jurisdiction_dispute === 'no') < 16) {
    issues.push('v4 requires at least 16 nonjurisdictional strong negatives');
  }
  for (const field of [
    'interlocutor_standing_or_right',
    'inquiry_or_question_frame_governance',
    'test_or_criterion_governance',
  ]) {
    if (count(cases, (row) => row.expected?.judgment?.[field] === 'yes') < 16) {
      issues.push(`v4 requires at least 16 positive ${field} cases`);
    }
  }
  if (count(cases, (row) => row.expected?.judgment?.other_jurisdictional_governance === 'yes') < 4) {
    issues.push('v4 requires at least four other-governance cases');
  }
  if (
    count(
      cases,
      (row) =>
        [
          'interlocutor_standing_or_right',
          'inquiry_or_question_frame_governance',
          'test_or_criterion_governance',
        ].filter((field) => row.expected?.judgment?.[field] === 'yes').length >= 2,
    ) < 12
  ) {
    issues.push('v4 requires at least 12 multi-axis jurisdiction cases');
  }
  if (new Set(cases.map((row) => row.source)).size !== 80) issues.push('v4 sources must be unique');
  if (!cases.every((row) => /^v4-hb-(ref|prod|neither)-/u.test(row.case_id)))
    issues.push('v4 case id namespace drifted');

  const priorCases = priorCorpora.flatMap((prior) => (Array.isArray(prior?.cases) ? prior.cases : []));
  const priorIds = new Set(priorCases.map((row) => row.case_id));
  const priorSources = new Set(priorCases.map((row) => row.source));
  const priorContexts = new Set(priorCases.flatMap((row) => row.public_context?.map((entry) => entry.text) || []));
  if (cases.some((row) => priorIds.has(row.case_id))) issues.push('v4 case id collides with prior corpus');
  if (cases.some((row) => priorSources.has(row.source))) issues.push('v4 source collides with prior corpus');
  if (cases.some((row) => row.public_context.some((entry) => priorContexts.has(entry.text)))) {
    issues.push('v4 context collides with prior corpus');
  }
  return { valid: issues.length === 0, issues };
}

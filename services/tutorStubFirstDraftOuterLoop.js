import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { loadTutorStubFirstDraftCampaign, validateTutorStubFirstDraftCampaign } from './tutorStubFirstDraftCampaign.js';

export const TUTOR_STUB_FIRST_DRAFT_OUTER_LOOP_SCHEMA = 'machinespirits.tutor-stub.first-draft-outer-loop.v1';

const REQUIRED_STATES = Object.freeze({
  awaiting_working_screen: { terminalScope: 'none', outcome: 'pending' },
  working_predeclared: { terminalScope: 'none', outcome: 'pending' },
  working_running: { terminalScope: 'none', outcome: 'pending' },
  working_passed: { terminalScope: 'none', outcome: 'pending' },
  acceptance_predeclared: { terminalScope: 'none', outcome: 'pending' },
  hard_cell_running: { terminalScope: 'none', outcome: 'pending' },
  remaining_cells_running: { terminalScope: 'none', outcome: 'pending' },
  accepted: { terminalScope: 'loop', outcome: 'success' },
  stagnated: { terminalScope: 'version', outcome: 'no_progress' },
  retired_after_working_failure: { terminalScope: 'version', outcome: 'working_failure' },
  blocked_infrastructure: { terminalScope: 'loop', outcome: 'infrastructure' },
  retired_after_acceptance_failure: { terminalScope: 'version', outcome: 'acceptance_failure' },
});

const REQUIRED_TRANSITIONS = Object.freeze([
  ['awaiting_working_screen', 'working_predeclared'],
  ['working_predeclared', 'working_running'],
  ['working_running', 'working_predeclared'],
  ['working_running', 'working_passed'],
  ['working_running', 'stagnated'],
  ['working_running', 'retired_after_working_failure'],
  ['working_running', 'blocked_infrastructure'],
  ['working_passed', 'acceptance_predeclared'],
  ['acceptance_predeclared', 'hard_cell_running'],
  ['acceptance_predeclared', 'blocked_infrastructure'],
  ['hard_cell_running', 'remaining_cells_running'],
  ['hard_cell_running', 'retired_after_acceptance_failure'],
  ['hard_cell_running', 'blocked_infrastructure'],
  ['remaining_cells_running', 'accepted'],
  ['remaining_cells_running', 'retired_after_acceptance_failure'],
  ['remaining_cells_running', 'blocked_infrastructure'],
  ['retired_after_acceptance_failure', 'working_predeclared'],
  ['stagnated', 'working_predeclared'],
  ['retired_after_working_failure', 'working_predeclared'],
]);

const REQUIRED_REVIEW_RESPONSIBILITIES = Object.freeze([
  'observe_evidence',
  'select_single_bounded_change',
  'generate_original_candidate',
  'deterministic_audit',
  'semantic_recognition_review',
  'verify_gates',
  'record_provenance',
]);

const V27_OPEN_QUALITATIVE_DEBT = Object.freeze({
  status: 'open_debt',
  source: 'V28_structural_audit_of_v27_iteration_7',
  items: Object.freeze([
    'host_source_renderer',
    'handoff_contract_and_cross_slot_progression',
    'typed_due_source_action_referent',
    'typed_turn_focus_relation',
  ]),
});

const V27_ITERATION_1_RESULT = Object.freeze({
  artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-1/working-screen-result.json',
  runHead: '7fc926a2801f947da056b573a499933dccc71968',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-1/campaign-validation.json',
  campaignValidationSha256: 'a7ade2ebce6d67dbfe9babb73bc52d2def9e396dca5b90d278b989e9c3677d07',
  resultSha256: '970cb051c9335f89ede51d8018002cb90017d42fdbefb79521a7747e6039d435',
  turns: Object.freeze([
    Object.freeze({
      turn: 4,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-1/marrick_v27_joint_performance/turn-4.json',
      sha256: '7b18f4e9ecfeb05e95cac828d99d8f76acccbb6773421602980c2b6ba4c1e828',
    }),
    Object.freeze({
      turn: 5,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-1/marrick_v27_joint_performance/turn-5.json',
      sha256: '2947ff1d15e921ad228ba7fbbcbaa6b936252d59c2a1766054d8326cfb50bf9f',
    }),
    Object.freeze({
      turn: 6,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-1/marrick_v27_joint_performance/turn-6.json',
      sha256: '3a5c1d8b57c9110f2bad39a5e78b2031ac8b108b2287315d418ae1bb6898d1b9',
    }),
  ]),
});

const V27_ITERATION_2_RESULT = Object.freeze({
  artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-2/working-screen-result.json',
  runHead: 'bec13717719be76891bf5ece0c1ae94375cdea9a',
  configSha256: '4b71da924e17639a800012ed45f7682a1942eac25356bc7d9450715cc2638ea5',
  sourceTraceSha256: 'b6d98928d6042485895fe1e958044d6303f7c600512593876c6c1acd630f127a',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-2/campaign-validation.json',
  campaignValidationSha256: '7eb96da004326ac21dc0844d23fbf95bb8209bde221e297f47870437946b842d',
  resultSha256: 'a5788cc7cd8aa68d1e540611b457f04d1590f1e3b5f5692663b7a04da186a4fb',
  turns: Object.freeze([
    Object.freeze({
      turn: 4,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-2/marrick_v27_joint_performance/turn-4.json',
      sha256: '1a9eb462a3d638e867d190fecc1ec2cedda434421196ebe896a389f2b6dcdc56',
    }),
    Object.freeze({
      turn: 5,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-2/marrick_v27_joint_performance/turn-5.json',
      sha256: 'c3e88048f0e0de30035c148c88b20a14ed9580afeb0b0dc9670fb0aac9f8042d',
    }),
    Object.freeze({
      turn: 6,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-2/marrick_v27_joint_performance/turn-6.json',
      sha256: '7257019859d7e62596672f651e34dea63d9d7889e69e3530ece092d60c9465ec',
    }),
  ]),
});

const V27_ITERATION_3_RESULT = Object.freeze({
  artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-3/working-screen-result.json',
  runHead: 'f0df994d1912c3c8b6d6f1b9960b5ef05962f1a6',
  configSha256: 'eac765695c4e10a971cdf9ec95d4e83dd20ea48fdc281487541147e98f996568',
  sourceTraceSha256: 'b6d98928d6042485895fe1e958044d6303f7c600512593876c6c1acd630f127a',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-3/campaign-validation.json',
  campaignValidationSha256: 'd758f789c558e687d60cd97272658f580a1e4bc07d02e07b4592690b1cd77b7d',
  resultSha256: '743a31ae5779930b02e488c6092069fc3a1872ac462af6acee8512f1abd43888',
  turns: Object.freeze([
    Object.freeze({
      turn: 4,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-3/marrick_v27_joint_performance/turn-4.json',
      sha256: '675d6a7794253e4c16b28ba0ec69625fef5ee26d790aac88496b4ca15422351f',
    }),
  ]),
});

const V27_ITERATION_4_RESULT = Object.freeze({
  artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-4/working-screen-result.json',
  runHead: 'd048ec273e3a4a4618f51b7b0c999d20542ea14f',
  configSha256: '287169e63d296f311e422933e94af582057716f04f9a8a3ed20a1f7686e5cc38',
  sourceTraceSha256: 'b6d98928d6042485895fe1e958044d6303f7c600512593876c6c1acd630f127a',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-4/campaign-validation.json',
  campaignValidationSha256: '7d36c45d8c3c4a2afc849658674de57c30632f5c282bf1e7621b1582b14a2bcd',
  resultSha256: 'c90dd4a8e785988f7b1d10b888ca9f6a158acc057f6d9f1b853865568ebe1169',
  turns: Object.freeze([
    Object.freeze({
      turn: 4,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-4/marrick_v27_joint_performance/turn-4.json',
      sha256: '469ae92726049f9669754f1f05ff34a26d79d2f995e1429b08138c40dfc461aa',
    }),
    Object.freeze({
      turn: 5,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-4/marrick_v27_joint_performance/turn-5.json',
      sha256: 'b00e043b931efdedaf1c466e76d8888a2fdf29b70e38036f09478fd489339043',
    }),
    Object.freeze({
      turn: 6,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-4/marrick_v27_joint_performance/turn-6.json',
      sha256: '32fd864d79e18eea5d2cb75ab4ee788192852c8126336a617ab2909e1e8110ee',
    }),
    Object.freeze({
      turn: 9,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-4/marrick_v27_joint_performance/turn-9.json',
      sha256: '8d804c6cf7c1d458bf97032e76788c57aaa969d18b0f2745cd7ffa5c1cf1b974',
    }),
  ]),
});

const V27_ITERATION_5_RESULT = Object.freeze({
  artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-5/working-screen-result.json',
  runHead: '965a5708d5acc37a79e51b9f5c813b32336106d2',
  configSha256: '236dbc2b5b9f708a127c73b889b467450b1fc7ad0939e912fdac6533fb5f5c0f',
  sourceTraceSha256: 'b6d98928d6042485895fe1e958044d6303f7c600512593876c6c1acd630f127a',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-5/campaign-validation.json',
  campaignValidationSha256: 'a8807ed6052423eae32332a614f23655ea511a30ddc2219e29c14d08dfe341fd',
  resultSha256: '5dc24a93500b90c291b8a749095ff67824f5f18e70cb66d0d9797972d202f709',
  turns: Object.freeze([
    Object.freeze({
      turn: 4,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-5/marrick_v27_joint_performance/turn-4.json',
      sha256: 'c3a444ac33a7cb2ae5e13cf06edbeca350e21be2ce9e3b186e3d9002d007c67b',
    }),
  ]),
});

const V27_ITERATION_6_RESULT = Object.freeze({
  artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-6/working-screen-result.json',
  runHead: '1e6ae86ee407ea06258cfc9d013e2eaec5d8bf3a',
  configSha256: 'bc58477b3f3982c742f9d1a18505a956e56726762bfa2645ee80251fd964d928',
  sourceTraceSha256: 'b6d98928d6042485895fe1e958044d6303f7c600512593876c6c1acd630f127a',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-6/campaign-validation.json',
  campaignValidationSha256: '8f4b6aed9dced0bde19b9b4200937b56623a9aa9f62365d54e21ea75f934abbf',
  resultSha256: 'd5fb716abac48df6eba0a2561513d05f954e994108e5074eca3a4781d2d24a3d',
  turns: Object.freeze([
    Object.freeze({
      turn: 4,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-6/marrick_v27_joint_performance/turn-4.json',
      sha256: 'fa3aa342375afd87ecc3be64e78283bc826800bfc3e7b645c1fca8eee2d27087',
    }),
    Object.freeze({
      turn: 5,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-6/marrick_v27_joint_performance/turn-5.json',
      sha256: '19f82a57250fe47d8c9cb861fbc2331927b54c19a44c980d2593e78bad8f1c4d',
    }),
    Object.freeze({
      turn: 6,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-6/marrick_v27_joint_performance/turn-6.json',
      sha256: '97fdeb6d9856b75ea80e006d9969d790b3434aaf21b090ead9aaa848c767e6eb',
    }),
    Object.freeze({
      turn: 9,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-6/marrick_v27_joint_performance/turn-9.json',
      sha256: '841b6a2ab228de92f0e70bd78469c2d2bf9918564d9c77828813706d50cd0510',
    }),
  ]),
});

const V27_ITERATION_7_RESULT = Object.freeze({
  artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-7/working-screen-result.json',
  runHead: '20f9cb414a6ef0a225f7e0c0f22674ddffd812f7',
  configSha256: 'ef2789b1eed46e8759f9e04bc9f29cc005d2ed49d1909cbfde6630f412a4109e',
  sourceTraceSha256: 'b6d98928d6042485895fe1e958044d6303f7c600512593876c6c1acd630f127a',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-7/campaign-validation.json',
  campaignValidationSha256: '083af907162898723acac9aadbb79093500b9f124734dc42f24363be65b604ee',
  resultSha256: 'd4b26cf326b8b1b2336e7b7b84762cfcc7ef14ac86500bbba49b5f9da43c31a6',
  turns: Object.freeze([
    Object.freeze({
      turn: 4,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-7/marrick_v27_joint_performance/turn-4.json',
      sha256: '0b4cc362375600648e85e432cb7526a7bd7ef28f15a8e7d747523c77bb51fa29',
    }),
    Object.freeze({
      turn: 5,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-7/marrick_v27_joint_performance/turn-5.json',
      sha256: 'b282db8cab2c44f33188544bd58056317bfe50cf7274014b6a8c5d77c319344a',
    }),
    Object.freeze({
      turn: 6,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-7/marrick_v27_joint_performance/turn-6.json',
      sha256: 'b1b0108408c17ba2d28db2d6eefde7bb099a97f2a6d5e094fdcc89618b3bcd24',
    }),
    Object.freeze({
      turn: 9,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v6/iteration-7/marrick_v27_joint_performance/turn-9.json',
      sha256: 'c2e82605fa1e1d9d015d91d647f1ace7b326cf06703aff1d31f27268b176de30',
    }),
  ]),
});

const V27_ITERATION_8_RESULT = Object.freeze({
  artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v7/iteration-8/working-screen-result.json',
  runHead: '4af6269edc45fef95962026a3b3e7a7ac5a694a9',
  configSha256: '3258a41e4e6324b299b9c529529d99b9aa7e417e874c15f26d6a8c451dab99bf',
  sourceTraceSha256: '5ffe6180107ef050565108d4c8341d750e47c4712450dc5b789da9a3b02b202d',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v7/iteration-8/campaign-validation.json',
  campaignValidationSha256: 'ed8bc3b4fae525e489883e0b32e11b8159194d9b6a13f332967acdcc8bc7c9c3',
  resultSha256: '05783cc988308539b05a6934dfbf7654dba79dc7513bb04b1efdcbfb1539e355',
  turnArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v7/iteration-8/tallow_answer_seeking/turn-5.json',
  turnArtifactSha256: '5a5bc1c05a39ad306ecfe6e8db23e8ab549dc2e93462deba0c920479d6ce8a93',
});

const V28_ITERATION_1_PREFLIGHT = Object.freeze({
  artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v8/iteration-1/working-screen-result.json',
  runHead: '223984b981d8413fc9409cd31c2ccf8739889314',
  configSha256: 'ce299510188de85ca8e9820863654d8954cf20130a24d432cc0ba9e5bea016b2',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v8/iteration-1/campaign-validation.json',
  campaignValidationSha256: 'cb41c1f8f6c5babb26c26668bc92fd8f867da6892178f0860b91487aebfa2058',
  resultSha256: 'f6394fc4462f1577a0d9b47d232cd2992c5f39551edd9aedc6d494d1a1bbf65d',
});

const V29_ITERATION_1_PREFLIGHT = Object.freeze({
  runHead: 'bfa0b4857a229ddab6a6ba733ba214850c23468b',
  configSha256: '06d0c19ac59eaaabcdf2d5e4cba3c46d3e1fa49d28a485f7c41ced782f7ff7c9',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v9/iteration-1/campaign-validation.json',
  campaignValidationSha256: '5380f46ce14329222268ee48856f353717e20ecd51947bccab6e8fabd5e55c9c',
  modelFreeAuditArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v9/iteration-1/model-free-skyway-audit.json',
  modelFreeAuditSha256: '361dd6c0579492f411a18ad49ca975fc6a096b576213f0fe3710f84d54e464b5',
});

const V31_ITERATION_1_RESULT = Object.freeze({
  artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v11/iteration-1/working-screen-result.json',
  runHead: '959775961e500dd847fc43f47f86ba60fd9fff82',
  configSha256: 'bae7c07b462a2cf11ba498f4d1001d9eff6490d106539edfe96db842616b8841',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v11/iteration-1/campaign-validation.json',
  campaignValidationSha256: '55e06a77985e2b8f72d973b6d59f503e627b712bd987a98bfe9e1d80331a0f57',
  preflightExecutionArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v11/iteration-1/preflight-execution.json',
  preflightExecutionSha256: 'a6c936df8593d191943d6c6a4d74b7ede4ba43255172ef53a8e0e1fdfc85f41c',
  turnArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v11/iteration-1/tallow_answer_seeking/turn-5.json',
  turnArtifactSha256: 'b0c6d9444bc022a94cc4272398c2e051898fad17838dca11516c10d6d316c8a4',
  resultSha256: 'cf0bba78e8ddd209ff59a1a0accf021b4d19776ad6dda7a3d6422a1aee8d1a9a',
});

const V32_ITERATION_1_RESULT = Object.freeze({
  artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/iteration-1/working-screen-result.json',
  runHead: '8c49f1b9af4678d51af0ab6357c7cf47487b5269',
  configSha256: 'b73a98eb5d855a2010775820dc7410c2607e87c320492b6efcdfe055a5dca18a',
  worktreePorcelainSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  campaignValidationArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/iteration-1/campaign-validation.json',
  campaignValidationSha256: '5df1553cb8b1ce87f3d9b55c36758f563f79c0afdc6af411890988f51487613d',
  preflightExecutionArtifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/iteration-1/preflight-execution.json',
  preflightExecutionSha256: '1132f3c4b24d348a0a250834bc67de9a725f641199934abb72ae9f25e5d25673',
  resultSha256: 'f878860372b0f9a2dc67872bf3601b25b74b27cd0eb66576863728dd27094647',
  turns: Object.freeze([
    Object.freeze({
      cell: 'tallow_answer_seeking_diagnostic_1',
      turn: 5,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/iteration-1/tallow_answer_seeking_diagnostic_1/turn-5.json',
      sha256: 'f93bad77dba3171f70ea898baf380e9287f7079d574be1726b8b92576a351f16',
    }),
    Object.freeze({
      cell: 'tallow_answer_seeking_diagnostic_2',
      turn: 5,
      path: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/iteration-1/tallow_answer_seeking_diagnostic_2/turn-5.json',
      sha256: 'fd15e08cb23168541eef44453c7e3ae7321b98274f1963789d5bad1be439dc9c',
    }),
  ]),
});

function requiredString(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function integer(value, label, { minimum = 0 } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${label} must be an integer >= ${minimum}`);
  }
  return parsed;
}

function absolute(root, value) {
  const normalized = requiredString(value, 'path');
  return path.isAbsolute(normalized) ? normalized : path.join(root, normalized);
}

function expect(value, expected, label) {
  if (value !== expected) throw new Error(`${label} must be ${JSON.stringify(expected)}`);
}

function expectJson(value, expected, label) {
  if (JSON.stringify(value) !== JSON.stringify(expected)) {
    throw new Error(`${label} must preserve the exact predeclared value`);
  }
}

function validateV27Iteration1Observation(observation, label) {
  expect(observation?.version, 27, `${label} version`);
  expect(observation?.working_iteration, 1, `${label} working iteration`);
  expect(observation?.status, 'fail', `${label} status`);
  expect(observation?.result_artifact, V27_ITERATION_1_RESULT.artifact, `${label} result artifact`);
  expect(observation?.development_seed, 20261500, `${label} development seed`);
  expect(
    observation?.seed_disposition,
    'reusable_non_held_out_development',
    `${label} seed disposition`,
  );
  expect(observation?.run_head, V27_ITERATION_1_RESULT.runHead, `${label} run HEAD`);
  expect(
    observation?.provenance?.campaign_validation_artifact,
    V27_ITERATION_1_RESULT.campaignValidationArtifact,
    `${label} campaign validation artifact`,
  );
  expect(
    observation?.provenance?.campaign_validation_sha256,
    V27_ITERATION_1_RESULT.campaignValidationSha256,
    `${label} campaign validation hash`,
  );
  expect(
    observation?.provenance?.result_sha256,
    V27_ITERATION_1_RESULT.resultSha256,
    `${label} result hash`,
  );
  expectJson(
    observation?.provenance?.turn_artifacts,
    V27_ITERATION_1_RESULT.turns,
    `${label} turn provenance`,
  );
  expectJson(observation?.completed_turns, [4, 5, 6], `${label} completed turns`);
  expectJson(observation?.unstarted_turns, [9], `${label} unstarted turns`);
  expect(observation?.original_candidates_accepted, 2, `${label} accepted originals`);
  expect(observation?.original_candidates_completed, 3, `${label} completed originals`);
  expect(observation?.original_candidate_acceptance_rate, 0.6666667, `${label} acceptance rate`);
  expect(observation?.mean_configuration_realization, 0.6666667, `${label} configuration realization`);
  for (const field of [
    'final_safety_failures',
    'transcript_specific_uptake_failures',
    'mechanical_repairs',
    'model_rewrites',
    'deterministic_fallbacks',
    'semantic_adjudicator_calls',
    'semantic_recognition_corrections',
  ]) {
    expect(observation?.[field], 0, `${label} ${field}`);
  }
  expect(observation?.joint_performance_model_outputs, 3, `${label} joint outputs`);
  expect(observation?.valid_joint_performance_outputs, 2, `${label} valid joint outputs`);
  expect(observation?.joint_performance_output_failures, 1, `${label} joint output failures`);
  expect(observation?.joint_performance_ownership_passes, 2, `${label} ownership passes`);
  expect(observation?.joint_performance_ownership_failures, 1, `${label} ownership failures`);
  expect(observation?.exact_host_source_occurrence_passes, 2, `${label} host source passes`);
  expect(observation?.exact_host_source_occurrence_failures, 1, `${label} host source failures`);
  expect(observation?.mean_original_latency_ms, 8143.6667, `${label} mean original latency`);
  expect(observation?.mean_total_tutor_latency_ms, 8143.6667, `${label} mean total latency`);
  expectJson(
    observation?.dominant_failure_clusters,
    [
      {
        cluster: 'jointPerformanceGenerationAudit:slot_exceeds_word_target',
        count: 1,
        evidence: 'observed_hard_failure',
      },
      {
        cluster: 'jointPerformanceGenerationPrompt:v2_axis_ownership_conflict',
        count: 2,
        evidence: 'post_audit_counterfactual_contract_review',
        manifestations: [
          'advocate_testability_delegated_to_handoff',
          'stance_contract_assigns_concrete_check_to_performance',
        ],
      },
    ],
    `${label} dominant failure cluster`,
  );
  expect(observation?.comparison?.comparison_available, false, `${label} comparison availability`);
  expect(observation?.comparison?.measurable_improvement, null, `${label} measurable improvement`);
  expect(observation?.comparison?.consecutive_without_improvement, 0, `${label} stagnation count`);
  expect(observation?.comparison?.stop, false, `${label} stop decision`);
  expect(observation?.comparison?.reason, 'first_measured_iteration', `${label} stop reason`);
}

function validateV27Iteration2Observation(observation, label) {
  expect(observation?.version, 27, `${label} version`);
  expect(observation?.working_iteration, 2, `${label} working iteration`);
  expect(observation?.status, 'fail', `${label} status`);
  expect(observation?.result_artifact, V27_ITERATION_2_RESULT.artifact, `${label} result artifact`);
  expect(observation?.development_seed, 20261500, `${label} development seed`);
  expect(
    observation?.seed_disposition,
    'reusable_non_held_out_development',
    `${label} seed disposition`,
  );
  expect(observation?.run_head, V27_ITERATION_2_RESULT.runHead, `${label} run HEAD`);
  expect(
    observation?.run_head_provenance,
    'launch_log_timeline_confirmed',
    `${label} run HEAD provenance`,
  );
  expect(observation?.run_head_artifact_embedded, false, `${label} artifact run HEAD flag`);
  expect(
    observation?.provenance?.working_screen_config_sha256,
    V27_ITERATION_2_RESULT.configSha256,
    `${label} config hash`,
  );
  expect(
    observation?.provenance?.source_trace_sha256,
    V27_ITERATION_2_RESULT.sourceTraceSha256,
    `${label} source trace hash`,
  );
  expect(
    observation?.provenance?.campaign_validation_artifact,
    V27_ITERATION_2_RESULT.campaignValidationArtifact,
    `${label} campaign validation artifact`,
  );
  expect(
    observation?.provenance?.campaign_validation_sha256,
    V27_ITERATION_2_RESULT.campaignValidationSha256,
    `${label} campaign validation hash`,
  );
  expect(
    observation?.provenance?.result_sha256,
    V27_ITERATION_2_RESULT.resultSha256,
    `${label} result hash`,
  );
  expectJson(
    observation?.provenance?.turn_artifacts,
    V27_ITERATION_2_RESULT.turns,
    `${label} turn provenance`,
  );
  expectJson(observation?.completed_turns, [4, 5, 6], `${label} completed turns`);
  expectJson(observation?.unstarted_turns, [9], `${label} unstarted turns`);
  expect(observation?.original_candidates_accepted, 2, `${label} accepted originals`);
  expect(observation?.original_candidates_completed, 3, `${label} completed originals`);
  expect(
    observation?.original_candidate_acceptance_rate,
    0.6666666666666666,
    `${label} acceptance rate`,
  );
  expect(
    observation?.mean_configuration_realization,
    0.9443333333333334,
    `${label} configuration realization`,
  );
  expect(observation?.maximum_possible_originals_accepted, 3, `${label} maximum accepted`);
  expect(
    observation?.maximum_possible_configuration_realization,
    0.95825,
    `${label} maximum configuration realization`,
  );
  for (const field of [
    'final_safety_failures',
    'transcript_specific_uptake_failures',
    'mechanical_repairs',
    'model_rewrites',
    'deterministic_fallbacks',
    'semantic_adjudicator_calls',
    'semantic_adjudicator_errors',
    'semantic_recognition_corrections',
  ]) {
    expect(observation?.[field], 0, `${label} ${field}`);
  }
  expect(observation?.joint_performance_model_outputs, 3, `${label} joint outputs`);
  expect(observation?.valid_joint_performance_outputs, 3, `${label} valid joint outputs`);
  expect(observation?.joint_performance_output_failures, 0, `${label} joint output failures`);
  expect(observation?.joint_performance_ownership_passes, 2, `${label} ownership passes`);
  expect(observation?.joint_performance_ownership_failures, 1, `${label} ownership failures`);
  expect(observation?.exact_host_source_occurrence_passes, 3, `${label} host source passes`);
  expect(observation?.exact_host_source_occurrence_failures, 0, `${label} host source failures`);
  expect(observation?.mean_original_latency_ms, 8973.666666666666, `${label} mean original latency`);
  expect(observation?.mean_total_tutor_latency_ms, 8973.666666666666, `${label} mean total latency`);
  expectJson(observation?.token_usage, { input: 50101, output: 724, total: 50825 }, `${label} token usage`);
  expectJson(
    observation?.dominant_failure_clusters,
    [
      { cluster: 'actorialRealizationAudit:missing_selected_actorial_part', count: 1 },
      { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:actorial_part', count: 1 },
    ],
    `${label} dominant failure clusters`,
  );
  expectJson(
    observation?.comparison,
    {
      comparison_available: true,
      compared_to_iteration: 1,
      comparable_completion: true,
      measurable_improvement: true,
      configuration_realization_improved: true,
      original_candidates_accepted_delta: 0,
      original_candidate_acceptance_rate_delta: 0,
      mean_configuration_realization_delta: 0.27766666666666673,
      valid_joint_performance_outputs_delta: 1,
      joint_performance_output_failures_delta: -1,
      joint_performance_ownership_passes_delta: 0,
      joint_performance_ownership_failures_delta: 0,
      exact_host_source_occurrence_passes_delta: 1,
      exact_host_source_occurrence_failures_delta: -1,
      mean_original_latency_ms_delta: 830,
      consecutive_without_improvement: 0,
      stop: false,
      reason: 'improved',
    },
    `${label} comparison`,
  );
}

function validateV27Iteration3Observation(observation, label) {
  expect(observation?.version, 27, `${label} version`);
  expect(observation?.working_iteration, 3, `${label} working iteration`);
  expect(observation?.status, 'fail', `${label} status`);
  expect(observation?.result_artifact, V27_ITERATION_3_RESULT.artifact, `${label} result artifact`);
  expect(observation?.development_seed, 20261500, `${label} development seed`);
  expect(
    observation?.seed_disposition,
    'reusable_non_held_out_development',
    `${label} seed disposition`,
  );
  expect(observation?.run_head, V27_ITERATION_3_RESULT.runHead, `${label} run HEAD`);
  expect(observation?.run_head_provenance, 'launch_log_confirmed', `${label} run HEAD provenance`);
  expect(observation?.run_head_artifact_embedded, false, `${label} artifact run HEAD flag`);
  expect(
    observation?.provenance?.working_screen_config_sha256,
    V27_ITERATION_3_RESULT.configSha256,
    `${label} config hash`,
  );
  expect(
    observation?.provenance?.source_trace_sha256,
    V27_ITERATION_3_RESULT.sourceTraceSha256,
    `${label} source trace hash`,
  );
  expect(
    observation?.provenance?.campaign_validation_artifact,
    V27_ITERATION_3_RESULT.campaignValidationArtifact,
    `${label} campaign validation artifact`,
  );
  expect(
    observation?.provenance?.campaign_validation_sha256,
    V27_ITERATION_3_RESULT.campaignValidationSha256,
    `${label} campaign validation hash`,
  );
  expect(
    observation?.provenance?.result_sha256,
    V27_ITERATION_3_RESULT.resultSha256,
    `${label} result hash`,
  );
  expectJson(
    observation?.provenance?.turn_artifacts,
    V27_ITERATION_3_RESULT.turns,
    `${label} turn provenance`,
  );
  expectJson(observation?.completed_turns, [4], `${label} completed turns`);
  expectJson(observation?.unstarted_turns, [5, 6, 9], `${label} unstarted turns`);
  expect(observation?.original_candidates_accepted, 0, `${label} accepted originals`);
  expect(observation?.original_candidates_completed, 1, `${label} completed originals`);
  expect(observation?.original_candidate_acceptance_rate, 0, `${label} acceptance rate`);
  expect(observation?.mean_configuration_realization, 0, `${label} configuration realization`);
  expect(observation?.maximum_possible_originals_accepted, 3, `${label} maximum accepted`);
  expect(
    observation?.maximum_possible_configuration_realization,
    0.75,
    `${label} maximum configuration realization`,
  );
  for (const field of [
    'final_safety_failures',
    'transcript_specific_uptake_failures',
    'mechanical_repairs',
    'model_rewrites',
    'deterministic_fallbacks',
    'semantic_adjudicator_calls',
    'semantic_adjudicator_errors',
    'semantic_recognition_corrections',
  ]) {
    expect(observation?.[field], 0, `${label} ${field}`);
  }
  expect(observation?.joint_performance_model_outputs, 1, `${label} joint outputs`);
  expect(observation?.valid_joint_performance_outputs, 0, `${label} valid joint outputs`);
  expect(observation?.joint_performance_output_failures, 1, `${label} joint output failures`);
  expect(observation?.joint_performance_ownership_passes, 0, `${label} ownership passes`);
  expect(observation?.joint_performance_ownership_failures, 1, `${label} ownership failures`);
  expect(observation?.exact_host_source_occurrence_passes, 0, `${label} host source passes`);
  expect(observation?.exact_host_source_occurrence_failures, 1, `${label} host source failures`);
  expect(observation?.mean_original_latency_ms, 9932, `${label} mean original latency`);
  expect(observation?.mean_total_tutor_latency_ms, 9932, `${label} mean total latency`);
  expectJson(observation?.token_usage, { input: 15906, output: 281, total: 16187 }, `${label} token usage`);
  expectJson(
    observation?.dominant_failure_clusters,
    [{ cluster: 'jointPerformanceGenerationAudit:slot_has_outer_whitespace', count: 1 }],
    `${label} dominant failure clusters`,
  );
  expectJson(
    observation?.comparison,
    {
      comparison_available: true,
      compared_to_iteration: 2,
      comparable_completion: false,
      measurable_improvement: false,
      configuration_realization_improved: false,
      semantic_recognition_corrections: 0,
      consecutive_without_improvement: 1,
      stop: false,
      reason: 'no_improvement',
    },
    `${label} comparison`,
  );
}

function validateV27Iteration4Observation(observation, label) {
  expect(observation?.version, 27, `${label} version`);
  expect(observation?.working_iteration, 4, `${label} working iteration`);
  expect(observation?.status, 'fail', `${label} status`);
  expect(observation?.result_artifact, V27_ITERATION_4_RESULT.artifact, `${label} result artifact`);
  expect(observation?.development_seed, 20261500, `${label} development seed`);
  expect(
    observation?.seed_disposition,
    'reusable_non_held_out_development',
    `${label} seed disposition`,
  );
  expect(observation?.run_head, V27_ITERATION_4_RESULT.runHead, `${label} run HEAD`);
  expect(observation?.run_head_provenance, 'launch_log_confirmed', `${label} run HEAD provenance`);
  expect(observation?.run_head_artifact_embedded, false, `${label} artifact run HEAD flag`);
  expect(
    observation?.provenance?.working_screen_config_sha256,
    V27_ITERATION_4_RESULT.configSha256,
    `${label} config hash`,
  );
  expect(
    observation?.provenance?.source_trace_sha256,
    V27_ITERATION_4_RESULT.sourceTraceSha256,
    `${label} source trace hash`,
  );
  expect(
    observation?.provenance?.campaign_validation_artifact,
    V27_ITERATION_4_RESULT.campaignValidationArtifact,
    `${label} campaign validation artifact`,
  );
  expect(
    observation?.provenance?.campaign_validation_sha256,
    V27_ITERATION_4_RESULT.campaignValidationSha256,
    `${label} campaign validation hash`,
  );
  expect(
    observation?.provenance?.result_sha256,
    V27_ITERATION_4_RESULT.resultSha256,
    `${label} result hash`,
  );
  expectJson(
    observation?.provenance?.turn_artifacts,
    V27_ITERATION_4_RESULT.turns,
    `${label} turn provenance`,
  );
  expectJson(observation?.completed_turns, [4, 5, 6, 9], `${label} completed turns`);
  expectJson(observation?.unstarted_turns, [], `${label} unstarted turns`);
  expect(observation?.original_candidates_accepted, 3, `${label} accepted originals`);
  expect(observation?.original_candidates_completed, 4, `${label} completed originals`);
  expect(observation?.original_candidate_acceptance_rate, 0.75, `${label} acceptance rate`);
  expect(observation?.mean_configuration_realization, 0.91675, `${label} configuration realization`);
  expect(observation?.maximum_possible_originals_accepted, 3, `${label} maximum accepted`);
  expect(
    observation?.maximum_possible_configuration_realization,
    0.91675,
    `${label} maximum configuration realization`,
  );
  for (const field of [
    'final_safety_failures',
    'transcript_specific_uptake_failures',
    'mechanical_repairs',
    'model_rewrites',
    'deterministic_fallbacks',
    'semantic_adjudicator_calls',
    'semantic_adjudicator_errors',
    'semantic_recognition_corrections',
    'transport_normalized_outputs',
    'transport_normalization_count',
  ]) {
    expect(observation?.[field], 0, `${label} ${field}`);
  }
  expectJson(observation?.transport_normalizations, [], `${label} transport normalizations`);
  expect(observation?.joint_performance_model_outputs, 4, `${label} joint outputs`);
  expect(observation?.valid_joint_performance_outputs, 4, `${label} valid joint outputs`);
  expect(observation?.joint_performance_output_failures, 0, `${label} joint output failures`);
  expect(observation?.joint_performance_ownership_passes, 3, `${label} ownership passes`);
  expect(observation?.joint_performance_ownership_failures, 1, `${label} ownership failures`);
  expect(observation?.exact_host_source_occurrence_passes, 4, `${label} host source passes`);
  expect(observation?.exact_host_source_occurrence_failures, 0, `${label} host source failures`);
  expect(observation?.mean_original_latency_ms, 11007.25, `${label} mean original latency`);
  expect(observation?.mean_total_tutor_latency_ms, 11007.25, `${label} mean total latency`);
  expectJson(
    observation?.per_turn_latency_and_tokens,
    [
      { turn: 4, latency_ms: 10435, input_tokens: 17715, output_tokens: 317, total_tokens: 18032 },
      { turn: 5, latency_ms: 9377, input_tokens: 15980, output_tokens: 285, total_tokens: 16265 },
      { turn: 6, latency_ms: 11111, input_tokens: 17987, output_tokens: 374, total_tokens: 18361 },
      { turn: 9, latency_ms: 13106, input_tokens: 18827, output_tokens: 246, total_tokens: 19073 },
    ],
    `${label} per-turn latency and tokens`,
  );
  expectJson(observation?.token_usage, { input: 70509, output: 1222, total: 71731 }, `${label} token usage`);
  expectJson(
    observation?.dominant_failure_clusters,
    [
      { cluster: 'actorialRealizationAudit:missing_selected_performance_tactic', count: 1 },
      { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:actorial_performance', count: 1 },
      { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:engagement_stance', count: 1 },
    ],
    `${label} dominant failure clusters`,
  );
  expectJson(
    observation?.comparison,
    {
      comparison_available: true,
      compared_to_iteration: 3,
      comparable_completion: true,
      measurable_improvement: true,
      configuration_realization_improved: true,
      original_candidates_accepted_delta: 3,
      original_candidate_acceptance_rate_delta: 0.75,
      mean_configuration_realization_delta: 0.91675,
      valid_joint_performance_outputs_delta: 4,
      joint_performance_output_failures_delta: -1,
      joint_performance_ownership_passes_delta: 3,
      joint_performance_ownership_failures_delta: 0,
      exact_host_source_occurrence_passes_delta: 4,
      exact_host_source_occurrence_failures_delta: -1,
      mean_original_latency_ms_delta: 1075.25,
      semantic_recognition_corrections: 0,
      transport_normalization_count: 0,
      consecutive_without_improvement: 0,
      stop: false,
      reason: 'improved',
    },
    `${label} comparison`,
  );
}

function validateV27Iteration5Observation(observation, label) {
  expect(observation?.version, 27, `${label} version`);
  expect(observation?.working_iteration, 5, `${label} working iteration`);
  expect(observation?.status, 'fail', `${label} status`);
  expect(observation?.result_artifact, V27_ITERATION_5_RESULT.artifact, `${label} result artifact`);
  expect(observation?.development_seed, 20261500, `${label} development seed`);
  expect(observation?.seed_disposition, 'reusable_non_held_out_development', `${label} seed disposition`);
  expect(observation?.run_head, V27_ITERATION_5_RESULT.runHead, `${label} run HEAD`);
  expect(observation?.run_head_provenance, 'launch_log_confirmed', `${label} run HEAD provenance`);
  expect(observation?.run_head_artifact_embedded, false, `${label} artifact run HEAD flag`);
  expect(observation?.provenance?.working_screen_config_sha256, V27_ITERATION_5_RESULT.configSha256, `${label} config hash`);
  expect(observation?.provenance?.source_trace_sha256, V27_ITERATION_5_RESULT.sourceTraceSha256, `${label} source trace hash`);
  expect(observation?.provenance?.campaign_validation_artifact, V27_ITERATION_5_RESULT.campaignValidationArtifact, `${label} campaign validation artifact`);
  expect(observation?.provenance?.campaign_validation_sha256, V27_ITERATION_5_RESULT.campaignValidationSha256, `${label} campaign validation hash`);
  expect(observation?.provenance?.result_sha256, V27_ITERATION_5_RESULT.resultSha256, `${label} result hash`);
  expectJson(observation?.provenance?.turn_artifacts, V27_ITERATION_5_RESULT.turns, `${label} turn provenance`);
  expectJson(observation?.completed_turns, [4], `${label} completed turns`);
  expectJson(observation?.unstarted_turns, [5, 6, 9], `${label} unstarted turns`);
  expect(observation?.original_candidates_accepted, 0, `${label} accepted originals`);
  expect(observation?.original_candidates_completed, 1, `${label} completed originals`);
  expect(observation?.original_candidate_acceptance_rate, 0, `${label} acceptance rate`);
  expect(observation?.mean_configuration_realization, 1, `${label} configuration realization`);
  expect(observation?.maximum_possible_originals_accepted, 3, `${label} maximum accepted`);
  expect(observation?.maximum_possible_configuration_realization, 1, `${label} maximum configuration realization`);
  for (const field of [
    'final_safety_failures', 'transcript_specific_uptake_failures', 'mechanical_repairs',
    'model_rewrites', 'deterministic_fallbacks', 'semantic_adjudicator_calls',
    'semantic_adjudicator_errors', 'semantic_recognition_corrections',
    'transport_normalized_outputs', 'transport_normalization_count',
  ]) expect(observation?.[field], 0, `${label} ${field}`);
  expectJson(observation?.transport_normalizations, [], `${label} transport normalizations`);
  expect(observation?.joint_performance_model_outputs, 1, `${label} joint outputs`);
  expect(observation?.valid_joint_performance_outputs, 1, `${label} valid joint outputs`);
  expect(observation?.joint_performance_output_failures, 0, `${label} joint output failures`);
  expect(observation?.joint_performance_ownership_passes, 0, `${label} ownership passes`);
  expect(observation?.joint_performance_ownership_failures, 1, `${label} ownership failures`);
  expect(observation?.exact_host_source_occurrence_passes, 1, `${label} host source passes`);
  expect(observation?.exact_host_source_occurrence_failures, 0, `${label} host source failures`);
  expect(observation?.mean_original_latency_ms, 8122, `${label} mean original latency`);
  expect(observation?.mean_total_tutor_latency_ms, 8122, `${label} mean total latency`);
  expectJson(observation?.per_turn_latency_and_tokens, [
    { turn: 4, latency_ms: 8122, input_tokens: 17717, output_tokens: 149, total_tokens: 17866 },
  ], `${label} per-turn latency and tokens`);
  expectJson(observation?.token_usage, { input: 17717, output: 149, total: 17866 }, `${label} token usage`);
  expectJson(observation?.dominant_failure_clusters, [
    { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:scene_immersion', count: 1 },
  ], `${label} dominant failure clusters`);
  expectJson(observation?.comparison, {
    comparison_available: true,
    compared_to_iteration: 4,
    comparable_completion: false,
    measurable_improvement: false,
    configuration_realization_improved: false,
    original_candidates_accepted_delta: -3,
    original_candidate_acceptance_rate_delta: -0.75,
    mean_configuration_realization_delta: 0.08325,
    valid_joint_performance_outputs_delta: -3,
    joint_performance_output_failures_delta: 0,
    joint_performance_ownership_passes_delta: -3,
    joint_performance_ownership_failures_delta: 0,
    exact_host_source_occurrence_passes_delta: -3,
    exact_host_source_occurrence_failures_delta: 0,
    mean_original_latency_ms_delta: -2885.25,
    semantic_recognition_corrections: 0,
    transport_normalization_count: 0,
    consecutive_without_improvement: 1,
    stop: false,
    reason: 'no_improvement',
  }, `${label} comparison`);
}

function validateV27Iteration6Observation(observation, label) {
  expect(observation?.version, 27, `${label} version`);
  expect(observation?.working_iteration, 6, `${label} working iteration`);
  expect(observation?.status, 'fail', `${label} status`);
  expect(observation?.result_artifact, V27_ITERATION_6_RESULT.artifact, `${label} result artifact`);
  expect(observation?.development_seed, 20261500, `${label} development seed`);
  expect(observation?.seed_disposition, 'reusable_non_held_out_development', `${label} seed disposition`);
  expect(observation?.run_head, V27_ITERATION_6_RESULT.runHead, `${label} run HEAD`);
  expect(observation?.run_head_provenance, 'launch_log_confirmed', `${label} run HEAD provenance`);
  expect(observation?.run_head_artifact_embedded, false, `${label} artifact run HEAD flag`);
  expect(observation?.provenance?.working_screen_config_sha256, V27_ITERATION_6_RESULT.configSha256, `${label} config hash`);
  expect(observation?.provenance?.source_trace_sha256, V27_ITERATION_6_RESULT.sourceTraceSha256, `${label} source trace hash`);
  expect(observation?.provenance?.campaign_validation_artifact, V27_ITERATION_6_RESULT.campaignValidationArtifact, `${label} campaign validation artifact`);
  expect(observation?.provenance?.campaign_validation_sha256, V27_ITERATION_6_RESULT.campaignValidationSha256, `${label} campaign validation hash`);
  expect(observation?.provenance?.result_sha256, V27_ITERATION_6_RESULT.resultSha256, `${label} result hash`);
  expectJson(observation?.provenance?.turn_artifacts, V27_ITERATION_6_RESULT.turns, `${label} turn provenance`);
  expectJson(observation?.completed_turns, [4, 5, 6, 9], `${label} completed turns`);
  expectJson(observation?.unstarted_turns, [], `${label} unstarted turns`);
  expect(observation?.original_candidates_accepted, 3, `${label} accepted originals`);
  expect(observation?.original_candidates_completed, 4, `${label} completed originals`);
  expect(observation?.original_candidate_acceptance_rate, 0.75, `${label} acceptance rate`);
  expect(observation?.mean_configuration_realization, 0.95825, `${label} configuration realization`);
  expect(observation?.maximum_possible_originals_accepted, 3, `${label} maximum accepted`);
  expect(observation?.maximum_possible_configuration_realization, 0.95825, `${label} maximum configuration realization`);
  for (const field of [
    'final_safety_failures', 'mechanical_repairs', 'model_rewrites',
    'deterministic_fallbacks', 'semantic_adjudicator_calls',
    'semantic_adjudicator_errors', 'semantic_recognition_corrections',
    'transport_normalized_outputs', 'transport_normalization_count',
  ]) expect(observation?.[field], 0, `${label} ${field}`);
  expect(observation?.transcript_specific_uptake_failures, 1, `${label} uptake failures`);
  expectJson(observation?.transport_normalizations, [], `${label} transport normalizations`);
  expect(observation?.joint_performance_model_outputs, 4, `${label} joint outputs`);
  expect(observation?.valid_joint_performance_outputs, 4, `${label} valid joint outputs`);
  expect(observation?.joint_performance_output_failures, 0, `${label} joint output failures`);
  expect(observation?.joint_performance_ownership_passes, 3, `${label} ownership passes`);
  expect(observation?.joint_performance_ownership_failures, 1, `${label} ownership failures`);
  expect(observation?.exact_host_source_occurrence_passes, 4, `${label} host source passes`);
  expect(observation?.exact_host_source_occurrence_failures, 0, `${label} host source failures`);
  expect(observation?.mean_original_latency_ms, 9004.75, `${label} mean original latency`);
  expect(observation?.mean_total_tutor_latency_ms, 9004.75, `${label} mean total latency`);
  expectJson(observation?.per_turn_latency_and_tokens, [
    { turn: 4, latency_ms: 8885, input_tokens: 15904, output_tokens: 252, total_tokens: 16156 },
    { turn: 5, latency_ms: 9952, input_tokens: 15978, output_tokens: 353, total_tokens: 16331 },
    { turn: 6, latency_ms: 8302, input_tokens: 18199, output_tokens: 226, total_tokens: 18425 },
    { turn: 9, latency_ms: 8880, input_tokens: 16808, output_tokens: 285, total_tokens: 17093 },
  ], `${label} per-turn latency and tokens`);
  expectJson(observation?.token_usage, { input: 66889, output: 1116, total: 68005 }, `${label} token usage`);
  expectJson(observation?.dominant_failure_clusters, [
    { cluster: 'actorialRealizationAudit:missing_selected_performance_tactic', count: 1 },
    { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:actorial_performance', count: 1 },
    { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:engagement_stance', count: 1 },
    { cluster: 'responseCompositionAudit:verbatim_learner_echo', count: 1 },
  ], `${label} dominant failure clusters`);
  expectJson(observation?.comparison, {
    comparison_available: true,
    compared_to_iteration: 5,
    comparable_completion: true,
    measurable_improvement: true,
    configuration_realization_improved: false,
    original_candidates_accepted_delta: 3,
    original_candidate_acceptance_rate_delta: 0.75,
    mean_configuration_realization_delta: -0.04175,
    valid_joint_performance_outputs_delta: 3,
    joint_performance_output_failures_delta: 0,
    joint_performance_ownership_passes_delta: 3,
    joint_performance_ownership_failures_delta: 0,
    exact_host_source_occurrence_passes_delta: 3,
    exact_host_source_occurrence_failures_delta: 0,
    mean_original_latency_ms_delta: 882.75,
    semantic_recognition_corrections: 0,
    transport_normalization_count: 0,
    consecutive_without_improvement: 0,
    stop: false,
    reason: 'improved',
  }, `${label} comparison`);
}

function validateV27Iteration7Observation(observation, label) {
  expect(observation?.version, 27, `${label} version`);
  expect(observation?.working_iteration, 7, `${label} working iteration`);
  expect(observation?.status, 'pass', `${label} status`);
  expect(observation?.result_artifact, V27_ITERATION_7_RESULT.artifact, `${label} result artifact`);
  expect(observation?.development_seed, 20261500, `${label} development seed`);
  expect(observation?.seed_disposition, 'reusable_non_held_out_development', `${label} seed disposition`);
  expect(observation?.run_head, V27_ITERATION_7_RESULT.runHead, `${label} run HEAD`);
  expect(observation?.run_head_provenance, 'launch_head_confirmed', `${label} run HEAD provenance`);
  expect(observation?.run_head_artifact_embedded, false, `${label} artifact run HEAD flag`);
  expect(observation?.provenance?.working_screen_config_sha256, V27_ITERATION_7_RESULT.configSha256, `${label} config hash`);
  expect(observation?.provenance?.source_trace_sha256, V27_ITERATION_7_RESULT.sourceTraceSha256, `${label} source trace hash`);
  expect(observation?.provenance?.campaign_validation_artifact, V27_ITERATION_7_RESULT.campaignValidationArtifact, `${label} campaign validation artifact`);
  expect(observation?.provenance?.campaign_validation_sha256, V27_ITERATION_7_RESULT.campaignValidationSha256, `${label} campaign validation hash`);
  expect(observation?.provenance?.result_sha256, V27_ITERATION_7_RESULT.resultSha256, `${label} result hash`);
  expectJson(observation?.provenance?.turn_artifacts, V27_ITERATION_7_RESULT.turns, `${label} turn provenance`);
  expectJson(observation?.completed_turns, [4, 5, 6, 9], `${label} completed turns`);
  expectJson(observation?.unstarted_turns, [], `${label} unstarted turns`);
  expect(observation?.original_candidates_accepted, 4, `${label} accepted originals`);
  expect(observation?.original_candidates_completed, 4, `${label} completed originals`);
  expect(observation?.original_candidate_acceptance_rate, 1, `${label} acceptance rate`);
  expect(observation?.mean_configuration_realization, 1, `${label} configuration realization`);
  expect(observation?.maximum_possible_originals_accepted, 4, `${label} maximum accepted`);
  expect(observation?.maximum_possible_configuration_realization, 1, `${label} maximum configuration realization`);
  for (const field of [
    'final_safety_failures', 'transcript_specific_uptake_failures', 'mechanical_repairs',
    'model_rewrites', 'deterministic_fallbacks', 'semantic_adjudicator_calls',
    'semantic_adjudicator_errors', 'semantic_recognition_corrections',
    'transport_normalized_outputs', 'transport_normalization_count',
    'joint_performance_output_failures', 'joint_performance_ownership_failures',
    'exact_host_source_occurrence_failures',
  ]) expect(observation?.[field], 0, `${label} ${field}`);
  expectJson(observation?.transport_normalizations, [], `${label} transport normalizations`);
  expect(observation?.joint_performance_model_outputs, 4, `${label} joint outputs`);
  expect(observation?.valid_joint_performance_outputs, 4, `${label} valid joint outputs`);
  expect(observation?.joint_performance_ownership_passes, 4, `${label} ownership passes`);
  expect(observation?.exact_host_source_occurrence_passes, 4, `${label} host source passes`);
  expect(observation?.mean_original_latency_ms, 8157, `${label} mean original latency`);
  expect(observation?.mean_total_tutor_latency_ms, 8157, `${label} mean total latency`);
  expectJson(observation?.per_turn_latency_and_tokens, [
    { turn: 4, latency_ms: 9268, input_tokens: 17715, output_tokens: 273, total_tokens: 17988 },
    { turn: 5, latency_ms: 7369, input_tokens: 18001, output_tokens: 210, total_tokens: 18211 },
    { turn: 6, latency_ms: 7475, input_tokens: 16180, output_tokens: 223, total_tokens: 16403 },
    { turn: 9, latency_ms: 8516, input_tokens: 16806, output_tokens: 276, total_tokens: 17082 },
  ], `${label} per-turn latency and tokens`);
  expectJson(observation?.token_usage, { input: 68702, output: 982, total: 69684 }, `${label} token usage`);
  expectJson(observation?.dominant_failure_clusters, [], `${label} dominant failure clusters`);
  expectJson(observation?.comparison, {
    comparison_available: true,
    compared_to_iteration: 6,
    comparable_completion: true,
    measurable_improvement: true,
    configuration_realization_improved: true,
    original_candidates_accepted_delta: 1,
    original_candidate_acceptance_rate_delta: 0.25,
    mean_configuration_realization_delta: 0.04175,
    valid_joint_performance_outputs_delta: 0,
    joint_performance_output_failures_delta: 0,
    joint_performance_ownership_passes_delta: 1,
    joint_performance_ownership_failures_delta: -1,
    exact_host_source_occurrence_passes_delta: 0,
    exact_host_source_occurrence_failures_delta: 0,
    mean_original_latency_ms_delta: -847.75,
    semantic_recognition_corrections: 0,
    transport_normalization_count: 0,
    consecutive_without_improvement: 0,
    stop: false,
    reason: 'improved',
  }, `${label} comparison`);
}

function validateV27Iteration8Advance(advance, label) {
  expect(advance?.version, 27, `${label} version`);
  expect(advance?.terminal_state, 'development_confirmation_failed', `${label} terminal state`);
  expect(advance?.kind, 'non_held_out_cross_world_confirmation', `${label} kind`);
  expect(
    advance?.authorized_by,
    'versioning.tuning_after_observation_retires_entire_version',
    `${label} version authority`,
  );
  expect(advance?.final_iteration, 8, `${label} final iteration`);
  expect(advance?.result_artifact, V27_ITERATION_8_RESULT.artifact, `${label} result artifact`);
  expect(advance?.run_head, V27_ITERATION_8_RESULT.runHead, `${label} run HEAD`);
  expect(advance?.provenance?.working_screen_config_sha256, V27_ITERATION_8_RESULT.configSha256, `${label} config hash`);
  expect(advance?.provenance?.source_trace_sha256, V27_ITERATION_8_RESULT.sourceTraceSha256, `${label} source trace hash`);
  expect(advance?.provenance?.campaign_validation_artifact, V27_ITERATION_8_RESULT.campaignValidationArtifact, `${label} campaign validation artifact`);
  expect(advance?.provenance?.campaign_validation_sha256, V27_ITERATION_8_RESULT.campaignValidationSha256, `${label} campaign validation hash`);
  expect(advance?.provenance?.result_sha256, V27_ITERATION_8_RESULT.resultSha256, `${label} result hash`);
  expect(advance?.provenance?.turn_artifact, V27_ITERATION_8_RESULT.turnArtifact, `${label} turn artifact`);
  expect(advance?.provenance?.turn_artifact_sha256, V27_ITERATION_8_RESULT.turnArtifactSha256, `${label} turn artifact hash`);
  expect(advance?.hard_cell, 'tallow_answer_seeking', `${label} hard cell`);
  expect(advance?.completed_draws, 1, `${label} completed draws`);
  expect(advance?.strict_originals_accepted, 0, `${label} accepted originals`);
  expect(advance?.original_candidate_acceptance_rate, 0, `${label} acceptance rate`);
  expect(advance?.mean_configuration_realization, 0.833, `${label} realization`);
  expect(advance?.maximum_possible_originals_accepted, 3, `${label} maximum originals`);
  expect(advance?.maximum_possible_configuration_realization, 0.95825, `${label} maximum realization`);
  for (const field of [
    'final_safety_failures', 'mechanical_repairs', 'model_rewrites',
    'deterministic_fallbacks', 'semantic_adjudicator_calls',
    'semantic_recognition_corrections', 'transport_normalized_outputs',
    'transport_normalization_count', 'joint_performance_ownership_passes',
    'exact_host_source_occurrence_failures',
  ]) expect(advance?.[field], 0, `${label} ${field}`);
  expect(advance?.transcript_specific_uptake_failures, 1, `${label} uptake failures`);
  expect(advance?.joint_performance_model_outputs, 1, `${label} joint outputs`);
  expect(advance?.valid_joint_performance_outputs, 1, `${label} valid joint outputs`);
  expect(advance?.joint_performance_ownership_failures, 1, `${label} ownership failures`);
  expect(advance?.exact_host_source_occurrence_passes, 1, `${label} host source passes`);
  expect(advance?.mean_original_latency_ms, 7978, `${label} original latency`);
  expect(advance?.mean_total_tutor_latency_ms, 7978, `${label} total latency`);
  expectJson(advance?.token_usage, { input: 15840, output: 136, total: 15976 }, `${label} token usage`);
  expectJson(advance?.dominant_failure_clusters, [
    { cluster: 'actorialRealizationAudit:missing_selected_actorial_part', count: 1 },
    { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:actorial_part', count: 1 },
    { cluster: 'jointPerformanceAudit:composite_part_requirement_failed:actorial_part', count: 1 },
    { cluster: 'responseCompositionAudit:missing_learner_uptake', count: 1 },
  ], `${label} failure clusters`);
  expectJson(advance?.seed_dispositions, [
    { seed: 20261500, status: 'consumed_development_retired_on_version_advance' },
    { seed: 20261600, status: 'consumed_development_retired_on_version_advance' },
    { seed: 20261601, status: 'retired_unstarted_due_to_version_advance' },
    { seed: 20261602, status: 'retired_unstarted_due_to_version_advance' },
    { seed: 20261603, status: 'retired_unstarted_due_to_version_advance' },
  ], `${label} seed dispositions`);
}

function validateV28Iteration1Advance(advance, label) {
  expect(advance?.version, 28, `${label} version`);
  expect(advance?.terminal_state, 'development_preflight_failed', `${label} terminal state`);
  expect(
    advance?.kind,
    'deterministic_zero_call_source_accessibility_preflight',
    `${label} kind`,
  );
  expect(
    advance?.authorized_by,
    'versioning.tuning_after_observation_retires_entire_version',
    `${label} version authority`,
  );
  expect(advance?.final_iteration, 1, `${label} final iteration`);
  expect(advance?.result_artifact, V28_ITERATION_1_PREFLIGHT.artifact, `${label} result artifact`);
  expect(advance?.run_head, V28_ITERATION_1_PREFLIGHT.runHead, `${label} run HEAD`);
  expect(
    advance?.provenance?.working_screen_config_sha256,
    V28_ITERATION_1_PREFLIGHT.configSha256,
    `${label} config hash`,
  );
  expect(
    advance?.provenance?.campaign_validation_artifact,
    V28_ITERATION_1_PREFLIGHT.campaignValidationArtifact,
    `${label} validation artifact`,
  );
  expect(
    advance?.provenance?.campaign_validation_sha256,
    V28_ITERATION_1_PREFLIGHT.campaignValidationSha256,
    `${label} validation hash`,
  );
  expect(
    advance?.provenance?.result_sha256,
    V28_ITERATION_1_PREFLIGHT.resultSha256,
    `${label} result hash`,
  );
  expect(advance?.provenance?.clean_worktree, true, `${label} clean worktree`);
  expect(advance?.model_calls, 0, `${label} model calls`);
  expect(advance?.candidates_generated, 0, `${label} candidates generated`);
  expect(advance?.preflight_ready, false, `${label} preflight readiness`);
  expectJson(advance?.blocker, {
    cell: 'ravensmark_affective_resistant',
    turn: 5,
    kind: 'source_surface_accessibility',
    source_words: 36,
    audience_word_limit: 23,
    lexical_word_limit: 23,
    detail: advance?.blocker?.detail,
  }, `${label} blocker`);
  if (!/direct-only contract.*fails closed before any model call/isu.test(advance?.blocker?.detail || '')) {
    throw new Error(`${label} blocker must preserve the V28 zero-call reason`);
  }
  expectJson(advance?.seed_dispositions, [
    { seed: 20261800, status: 'retired_unconsumed_after_preflight_failure' },
    { seed: 20261801, status: 'retired_unconsumed_after_preflight_failure' },
    { seed: 20261802, status: 'retired_unconsumed_after_preflight_failure' },
    { seed: 20261803, status: 'retired_unconsumed_after_preflight_failure' },
  ], `${label} seed dispositions`);
}

function validateV29Iteration1Advance(advance, label) {
  expect(advance?.version, 29, `${label} version`);
  expect(advance?.terminal_state, 'development_preflight_failed', `${label} terminal state`);
  expect(advance?.kind, 'deterministic_zero_call_model_free_regression', `${label} kind`);
  expect(
    advance?.authorized_by,
    'versioning.tuning_after_observation_retires_entire_version',
    `${label} version authority`,
  );
  expect(advance?.final_iteration, 1, `${label} final iteration`);
  expect(advance?.result_artifact, null, `${label} missing result artifact`);
  expect(advance?.run_head, V29_ITERATION_1_PREFLIGHT.runHead, `${label} run HEAD`);
  expect(
    advance?.provenance?.working_screen_config_sha256,
    V29_ITERATION_1_PREFLIGHT.configSha256,
    `${label} config hash`,
  );
  expect(
    advance?.provenance?.campaign_validation_artifact,
    V29_ITERATION_1_PREFLIGHT.campaignValidationArtifact,
    `${label} validation artifact`,
  );
  expect(
    advance?.provenance?.campaign_validation_sha256,
    V29_ITERATION_1_PREFLIGHT.campaignValidationSha256,
    `${label} validation hash`,
  );
  expect(
    advance?.provenance?.model_free_audit_artifact,
    V29_ITERATION_1_PREFLIGHT.modelFreeAuditArtifact,
    `${label} model-free artifact`,
  );
  expect(
    advance?.provenance?.model_free_audit_sha256,
    V29_ITERATION_1_PREFLIGHT.modelFreeAuditSha256,
    `${label} model-free hash`,
  );
  expect(advance?.provenance?.clean_worktree, true, `${label} clean worktree`);
  expect(advance?.provenance?.missing_result_envelope, true, `${label} missing result envelope`);
  expect(advance?.model_calls, 0, `${label} model calls`);
  expect(advance?.candidates_generated, 0, `${label} candidates generated`);
  expect(advance?.structural_preflight_ready, true, `${label} structural readiness`);
  expect(advance?.deterministic_execution_preflight_passed, false, `${label} execution preflight`);
  expectJson(advance?.blocker, {
    fixture: 'tests/fixtures/tutor-stub-first-draft/skyway-answer-seeking-v18.json',
    case_id: '2026-07-16T04-44-58-444Z:t003',
    candidate_kind: 'deterministic_fallback',
    attempt: 4,
    kind: 'expected_hard_audit_correction_not_yet_declared',
    failure_cluster: 'response_composition:verbatim_learner_echo',
    safety_failures: 0,
    detail: advance?.blocker?.detail,
  }, `${label} blocker`);
  expectJson(advance?.seed_dispositions, [
    { seed: 20261900, status: 'retired_unconsumed_after_preflight_failure' },
    { seed: 20261901, status: 'retired_unconsumed_after_preflight_failure' },
    { seed: 20261902, status: 'retired_unconsumed_after_preflight_failure' },
    { seed: 20261903, status: 'retired_unconsumed_after_preflight_failure' },
  ], `${label} seed dispositions`);
}

function validateV30Iteration1PreflightObservation(observation, label) {
  expect(observation?.version, 30, `${label} version`);
  expect(observation?.working_iteration, 1, `${label} working iteration`);
  expect(observation?.status, 'development_preflight_failed', `${label} status`);
  expect(
    observation?.kind,
    'deterministic_zero_call_transient_focused_test_preflight',
    `${label} kind`,
  );
  expect(
    observation?.result_artifact,
    '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v10/iteration-1/working-screen-result.json',
    `${label} result artifact`,
  );
  expect(observation?.run_head, 'c6aa265eebd255c7eb41377cb2a6c01b75a6fa6f', `${label} run HEAD`);
  expect(
    observation?.provenance?.working_screen_config_sha256,
    '649821ca63257c7514def5ded78cc2eb86ef031b825e59acff22ecc7b88ab419',
    `${label} config hash`,
  );
  expect(
    observation?.provenance?.campaign_validation_artifact,
    '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v10/iteration-1/campaign-validation.json',
    `${label} validation artifact`,
  );
  expect(
    observation?.provenance?.campaign_validation_sha256,
    '9659bc19cb0ebd244d4945999768dc92afd7860de93c005d003d6c184cadb606',
    `${label} validation hash`,
  );
  expect(
    observation?.provenance?.result_sha256,
    '57cd95cd572766c8319c4a0bf8df4723b96c523083e85416ba55d9341a4bc52c',
    `${label} result hash`,
  );
  expect(observation?.provenance?.clean_worktree, true, `${label} clean worktree`);
  expect(observation?.structural_preflight_ready, true, `${label} structural readiness`);
  expect(
    observation?.deterministic_execution_preflight_passed,
    false,
    `${label} execution preflight`,
  );
  for (const field of [
    'model_calls', 'candidates_generated', 'completed_candidates',
    'completed_turns', 'final_safety_failures',
  ]) expect(observation?.[field], 0, `${label} ${field}`);
  expectJson(observation?.focused_test_observation?.first_run, {
    passed: 536, total: 537, exit_code: 1,
  }, `${label} first focused-test run`);
  expectJson(observation?.focused_test_observation?.immediate_identical_rerun, {
    passed: 537, total: 537, exit_code: 0,
  }, `${label} focused-test rerun`);
  expect(
    observation?.focused_test_observation?.classification,
    'unclassified_transient_focused_test_failure',
    `${label} focused-test classification`,
  );
  expect(observation?.focused_test_observation?.rerun_artifact, null, `${label} rerun artifact`);
  if (!/subtest output.*cannot be identified/isu.test(
    observation?.focused_test_observation?.evidence_gap || '',
  )) {
    throw new Error(`${label} must preserve the failed-subtest evidence gap`);
  }
  expectJson(observation?.seed_dispositions, [
    { seed: 20262000, status: 'retired_unconsumed_after_preflight_failure' },
    { seed: 20262001, status: 'retired_unconsumed_after_preflight_failure' },
    { seed: 20262002, status: 'retired_unconsumed_after_preflight_failure' },
    { seed: 20262003, status: 'retired_unconsumed_after_preflight_failure' },
  ], `${label} seed dispositions`);
  expect(observation?.terminal_action?.v31_status, 'not_predeclared', `${label} V31 status`);
  expect(observation?.terminal_action?.generation_claim, 'none', `${label} generation claim`);
}

function validateV30Iteration1Advance(advance, label) {
  validateV30Iteration1PreflightObservation(advance, label);
}

function validateV31Iteration1Observation(observation, label) {
  expect(observation?.version, 31, `${label} version`);
  expect(observation?.working_iteration, 1, `${label} working iteration`);
  expect(observation?.status, 'development_hard_cell_failed', `${label} status`);
  expect(
    observation?.kind,
    'non_held_out_hard_cell_first_draft_failure',
    `${label} kind`,
  );
  expect(observation?.result_artifact, V31_ITERATION_1_RESULT.artifact, `${label} result artifact`);
  expect(observation?.run_head, V31_ITERATION_1_RESULT.runHead, `${label} run HEAD`);
  expect(
    observation?.provenance?.working_screen_config_sha256,
    V31_ITERATION_1_RESULT.configSha256,
    `${label} config hash`,
  );
  expect(
    observation?.provenance?.campaign_validation_artifact,
    V31_ITERATION_1_RESULT.campaignValidationArtifact,
    `${label} campaign validation artifact`,
  );
  expect(
    observation?.provenance?.campaign_validation_sha256,
    V31_ITERATION_1_RESULT.campaignValidationSha256,
    `${label} campaign validation hash`,
  );
  expect(
    observation?.provenance?.preflight_execution_artifact,
    V31_ITERATION_1_RESULT.preflightExecutionArtifact,
    `${label} preflight execution artifact`,
  );
  expect(
    observation?.provenance?.preflight_execution_sha256,
    V31_ITERATION_1_RESULT.preflightExecutionSha256,
    `${label} preflight execution hash`,
  );
  expect(
    observation?.provenance?.turn_artifact,
    V31_ITERATION_1_RESULT.turnArtifact,
    `${label} turn artifact`,
  );
  expect(
    observation?.provenance?.turn_artifact_sha256,
    V31_ITERATION_1_RESULT.turnArtifactSha256,
    `${label} turn artifact hash`,
  );
  expect(
    observation?.provenance?.result_sha256,
    V31_ITERATION_1_RESULT.resultSha256,
    `${label} result hash`,
  );
  expect(observation?.provenance?.clean_worktree, true, `${label} clean worktree`);
  expect(observation?.structural_preflight_ready, true, `${label} structural readiness`);
  expect(
    observation?.deterministic_execution_preflight_passed,
    true,
    `${label} deterministic preflight`,
  );
  expect(
    observation?.preflight_observation?.execution,
    'passed_once_without_retry',
    `${label} preflight execution mode`,
  );
  expect(observation?.preflight_observation?.commands, 9, `${label} preflight commands`);
  expect(observation?.preflight_observation?.model_calls, 0, `${label} preflight model calls`);
  expectJson(observation?.preflight_observation?.suites, [
    {
      id: 'audit_contracts',
      passed: 434,
      total: 434,
      artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v11/iteration-1/preflight/02-focused-audit_contracts.stdout.log',
      sha256: '86f4a203c0487afc45ed2dbdb5d99ca0d51e2e5acc7fe9451b12ea6b986abf4f',
    },
    {
      id: 'interactive_modes',
      passed: 24,
      total: 24,
      artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v11/iteration-1/preflight/03-focused-interactive_modes.stdout.log',
      sha256: '6629246bf354b43fbddb476daabdaa0451aa788e77401c494490fbada342bd6e',
    },
    {
      id: 'adaptive_evidence',
      passed: 4,
      total: 4,
      artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v11/iteration-1/preflight/04-focused-adaptive_evidence.stdout.log',
      sha256: '1041cd9beab2c9b00a976e0d6cc0d94c42d154967817ba6d0efcd4f46747a96a',
    },
    {
      id: 'campaign_orchestration',
      passed: 81,
      total: 81,
      artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v11/iteration-1/preflight/05-focused-campaign_orchestration.stdout.log',
      sha256: 'eaaeefa647a76580b1faae0447433065319d55d6d26817618209ab711e5b0c07',
    },
  ], `${label} focused preflight suites`);
  expect(
    observation?.preflight_observation?.model_free_fixtures_passed,
    4,
    `${label} model-free fixtures`,
  );
  for (const field of ['model_calls', 'candidates_generated', 'completed_candidates', 'completed_turns']) {
    expect(observation?.[field], 1, `${label} ${field}`);
  }
  expect(observation?.hard_cell, 'tallow_answer_seeking', `${label} hard cell`);
  expect(observation?.hard_cell_turn, 5, `${label} hard-cell turn`);
  expect(observation?.completed_draws, 1, `${label} completed draws`);
  expect(observation?.strict_originals_accepted, 0, `${label} strict originals`);
  expect(observation?.original_candidate_acceptance_rate, 0, `${label} acceptance rate`);
  expect(observation?.mean_configuration_realization, 0.667, `${label} realization`);
  expect(observation?.maximum_possible_originals_accepted, 3, `${label} maximum originals`);
  expect(
    observation?.maximum_possible_configuration_realization,
    0.91675,
    `${label} maximum realization`,
  );
  for (const field of [
    'final_safety_failures', 'transcript_specific_uptake_failures',
    'mechanical_repairs', 'model_rewrites', 'deterministic_fallbacks',
    'semantic_adjudicator_calls', 'semantic_recognition_corrections',
    'transport_normalized_outputs', 'transport_normalization_count',
  ]) expect(observation?.[field], 0, `${label} ${field}`);
  expect(observation?.joint_performance_model_outputs, 1, `${label} joint outputs`);
  expect(observation?.valid_joint_performance_outputs, 1, `${label} valid joint outputs`);
  expect(observation?.joint_performance_ownership_passes, 0, `${label} ownership passes`);
  expect(observation?.joint_performance_ownership_failures, 1, `${label} ownership failures`);
  expect(observation?.source_surface_accessibility_passes, 1, `${label} accessibility passes`);
  expect(observation?.source_surface_accessibility_failures, 0, `${label} accessibility failures`);
  expect(observation?.mean_original_latency_ms, 9787, `${label} original latency`);
  expect(observation?.mean_total_tutor_latency_ms, 9787, `${label} total tutor latency`);
  expectJson(
    observation?.token_usage,
    { input: 17903, output: 247, total: 18150 },
    `${label} token usage`,
  );
  expectJson(observation?.dominant_failure_clusters, [
    { cluster: 'jointPerformanceAudit:composite_part_requirement_failed:actorial_part', count: 3 },
    { cluster: 'actorialRealizationAudit:missing_selected_actorial_part', count: 1 },
    { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:action_family', count: 1 },
    { cluster: 'jointPerformanceAudit:axis_not_realized_in_owner:actorial_part', count: 1 },
  ], `${label} failure clusters`);
  expectJson(observation?.attempted_cells, ['tallow_answer_seeking'], `${label} attempted cells`);
  expectJson(observation?.unstarted_cells, [
    'ravensmark_affective_resistant',
    'larkspur_premature_closure',
    'foxtrot_diligent',
  ], `${label} unstarted cells`);
  expectJson(observation?.seed_dispositions, [
    { seed: 20262100, status: 'consumed_development_failed_retired' },
    { seed: 20262101, status: 'retired_unconsumed_unstarted_after_hard_cell_failure' },
    { seed: 20262102, status: 'retired_unconsumed_unstarted_after_hard_cell_failure' },
    { seed: 20262103, status: 'retired_unconsumed_unstarted_after_hard_cell_failure' },
  ], `${label} seed dispositions`);
  expect(observation?.terminal_action?.v32_status, 'not_predeclared', `${label} V32 status`);
  expect(
    observation?.terminal_action?.generation_claim,
    'failed_non_held_out_working_evidence',
    `${label} generation claim`,
  );
}

function validateV32Iteration1Observation(observation, label) {
  expect(observation?.version, 32, `${label} version`);
  expect(observation?.working_iteration, 1, `${label} working iteration`);
  expect(
    observation?.status,
    'development_diagnostic_failed_but_measurably_improved',
    `${label} status`,
  );
  expect(
    observation?.kind,
    'non_held_out_staged_diagnostic_first_draft_failure',
    `${label} kind`,
  );
  expect(observation?.result_artifact, V32_ITERATION_1_RESULT.artifact, `${label} result artifact`);
  expect(observation?.run_head, V32_ITERATION_1_RESULT.runHead, `${label} run HEAD`);
  expect(
    observation?.provenance?.working_screen_config_sha256,
    V32_ITERATION_1_RESULT.configSha256,
    `${label} config hash`,
  );
  expect(
    observation?.provenance?.worktree_porcelain_sha256,
    V32_ITERATION_1_RESULT.worktreePorcelainSha256,
    `${label} worktree hash`,
  );
  expect(
    observation?.provenance?.campaign_validation_artifact,
    V32_ITERATION_1_RESULT.campaignValidationArtifact,
    `${label} campaign validation artifact`,
  );
  expect(
    observation?.provenance?.campaign_validation_sha256,
    V32_ITERATION_1_RESULT.campaignValidationSha256,
    `${label} campaign validation hash`,
  );
  expect(
    observation?.provenance?.preflight_execution_artifact,
    V32_ITERATION_1_RESULT.preflightExecutionArtifact,
    `${label} preflight execution artifact`,
  );
  expect(
    observation?.provenance?.preflight_execution_sha256,
    V32_ITERATION_1_RESULT.preflightExecutionSha256,
    `${label} preflight execution hash`,
  );
  expectJson(
    observation?.provenance?.turn_artifacts,
    V32_ITERATION_1_RESULT.turns,
    `${label} turn artifacts`,
  );
  expect(
    observation?.provenance?.result_sha256,
    V32_ITERATION_1_RESULT.resultSha256,
    `${label} result hash`,
  );
  expect(observation?.provenance?.clean_worktree, true, `${label} clean worktree`);
  expectJson(observation?.provenance?.preflight_certificate, {
    disposition: 'executed',
    key: 'dc58fa9121070d4f96304fa573a274450161deeffc9b8aeb5e527d164fb73bb5',
    path: '/Users/lmagee/Dev/machinespirits/machinespirits-eval-preconscious/.tutor-stub-auto-eval/preflight-certificates/dc58fa9121070d4f96304fa573a274450161deeffc9b8aeb5e527d164fb73bb5.json',
    canonical_sha256: '0dec859fc2a305c6d71ee305f8b4146ce4c2db0b31b5f98061fded9ae0a7a8af',
    file_sha256: '460ffc993909917aaa19842f0bc87c9acfecf419bab18db7c37c0294df2512da',
    status: 'pass',
    reusable: true,
    observed_head: V32_ITERATION_1_RESULT.runHead,
    result_boundary_disposition: 'frozen_run_evidence_not_reused_after_result_record_changes',
  }, `${label} preflight certificate`);
  expect(observation?.structural_preflight_ready, true, `${label} structural readiness`);
  expect(
    observation?.deterministic_execution_preflight_passed,
    true,
    `${label} deterministic preflight`,
  );
  expect(
    observation?.preflight_observation?.execution,
    'passed_once_without_retry',
    `${label} preflight execution mode`,
  );
  expect(observation?.preflight_observation?.commands, 9, `${label} preflight commands`);
  expect(observation?.preflight_observation?.model_calls, 0, `${label} preflight model calls`);
  expect(observation?.preflight_observation?.elapsed_ms, 48946, `${label} preflight elapsed time`);
  expectJson(observation?.preflight_observation?.suites, [
    {
      id: 'audit_contracts', passed: 436, total: 436,
      artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/iteration-1/preflight/02-focused-audit_contracts.stdout.log',
      sha256: '883ee8fd728447503829a8fc6f8678802fa0310aead52220418aa0731c58e7fe',
    },
    {
      id: 'interactive_modes', passed: 24, total: 24,
      artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/iteration-1/preflight/03-focused-interactive_modes.stdout.log',
      sha256: '9932e6b3441c8ec86d33ada7df3d3366906a6f6d5d8d0928a16a968661decc9b',
    },
    {
      id: 'adaptive_evidence', passed: 4, total: 4,
      artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/iteration-1/preflight/04-focused-adaptive_evidence.stdout.log',
      sha256: '2a454b0526f8e198cb500fa947c11e03d9e59a64169d463fe8b9a4a669f9b9b8',
    },
    {
      id: 'campaign_orchestration', passed: 49, total: 49,
      artifact: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v12/iteration-1/preflight/05-focused-campaign_orchestration.stdout.log',
      sha256: '83914bdbbaa6cbbc5180b6b019cd2c09bfffef512e628c7b9ea28ce299851068',
    },
  ], `${label} focused preflight suites`);
  expect(
    observation?.preflight_observation?.model_free_fixtures_passed,
    4,
    `${label} model-free fixtures`,
  );
  for (const field of [
    'model_calls', 'candidates_generated', 'completed_candidates',
    'completed_turns', 'completed_draws',
  ]) expect(observation?.[field], 2, `${label} ${field}`);
  expectJson(observation?.attempted_cells, [
    'tallow_answer_seeking_diagnostic_1',
    'tallow_answer_seeking_diagnostic_2',
  ], `${label} attempted cells`);
  expect(observation?.strict_originals_accepted, 1, `${label} strict originals`);
  expect(observation?.original_candidate_acceptance_rate, 0.5, `${label} acceptance rate`);
  expect(observation?.mean_configuration_realization, 1, `${label} realization`);
  for (const field of [
    'final_safety_failures', 'transcript_specific_uptake_failures',
    'mechanical_repairs', 'model_rewrites', 'deterministic_fallbacks',
    'semantic_adjudicator_calls', 'semantic_adjudicator_errors',
    'semantic_recognition_corrections', 'transport_normalized_outputs',
    'transport_normalization_count', 'joint_performance_ownership_failures',
    'source_surface_accessibility_failures',
  ]) expect(observation?.[field], 0, `${label} ${field}`);
  for (const field of [
    'joint_performance_model_outputs', 'valid_joint_performance_outputs',
    'joint_performance_ownership_passes', 'source_surface_accessibility_passes',
  ]) expect(observation?.[field], 2, `${label} ${field}`);
  expect(observation?.mean_original_latency_ms, 9242, `${label} original latency`);
  expect(observation?.mean_total_tutor_latency_ms, 9242, `${label} total tutor latency`);
  expectJson(
    observation?.token_usage,
    { input: 32458, output: 611, total: 33069 },
    `${label} token usage`,
  );
  expectJson(observation?.cells, [
    {
      id: 'tallow_answer_seeking_diagnostic_1', seed: 20262200, status: 'pass',
      strict_originals_accepted: 1, original_candidate_acceptance_rate: 1,
      mean_configuration_realization: 1, latency_ms: 12415,
      token_usage: { input: 16229, output: 451, total: 16680 },
      dominant_failure_clusters: [],
    },
    {
      id: 'tallow_answer_seeking_diagnostic_2', seed: 20262201, status: 'fail',
      strict_originals_accepted: 0, original_candidate_acceptance_rate: 0,
      mean_configuration_realization: 1, latency_ms: 6069,
      token_usage: { input: 16229, output: 160, total: 16389 },
      dominant_failure_clusters: [
        { cluster: 'turnProgressionAudit:handoff_loses_turn_focus:handoff', count: 1 },
      ],
    },
  ], `${label} cells`);
  expectJson(observation?.dominant_failure_clusters, [
    { cluster: 'turnProgressionAudit:handoff_loses_turn_focus:handoff', count: 1 },
  ], `${label} failure clusters`);
  expect(
    observation?.failure_interpretation?.strict_failure,
    'deterministic_turn_focus_recognition_false_negative',
    `${label} strict failure interpretation`,
  );
  expect(
    observation?.failure_interpretation?.generation_regression,
    false,
    `${label} generation regression`,
  );
  expect(
    observation?.failure_interpretation?.reclassification_of_v32,
    'prohibited',
    `${label} result reclassification`,
  );
  if (!/dark-charger.*one token.*stocktake/isu.test(
    observation?.failure_interpretation?.evidence || '',
  )) throw new Error(`${label} must preserve the hyphenated-compound recognition evidence`);
  expect(observation?.qualitative_wording_debt?.status, 'open', `${label} wording-debt status`);
  expect(
    observation?.qualitative_wording_debt?.id,
    'did_not_stop_causal_wording',
    `${label} wording-debt id`,
  );
  expect(
    observation?.qualitative_wording_debt?.strict_gate_effect,
    'none',
    `${label} wording-debt gate effect`,
  );
  if (!/did not stop/iu.test(observation?.qualitative_wording_debt?.evidence || '')) {
    throw new Error(`${label} must preserve the separate did-not-stop wording debt`);
  }
  expectJson(observation?.comparison, {
    comparison_available: true,
    compared_to_version: 31,
    comparable_prefix: true,
    comparable_completion: false,
    measurable_improvement: true,
    strict_original_acceptance_rate_delta: 0.5,
    strict_original_count_delta: 1,
    mean_configuration_realization_delta: 0.333,
    joint_performance_ownership_passes_delta: 2,
    joint_performance_ownership_failures_delta: -1,
    final_safety_failures_delta: 0,
    deterministic_fallbacks_delta: 0,
    consecutive_without_improvement: 0,
    stop: false,
    reason: 'improved',
  }, `${label} comparison`);
  expectJson(observation?.seed_dispositions, [
    {
      seed: 20262200,
      artifact_status: 'consumed_development',
      final_status: 'consumed_development_passed_but_campaign_failed_retired',
    },
    {
      seed: 20262201,
      artifact_status: 'consumed_development',
      final_status: 'consumed_development_failed_retired',
    },
  ], `${label} seed dispositions`);
  expect(
    observation?.terminal_action?.v33_status,
    'strict_confirmation_prohibited',
    `${label} V33 status`,
  );
  expect(
    observation?.terminal_action?.generation_claim,
    'failed_but_measurably_improved_non_held_out_development_evidence',
    `${label} generation claim`,
  );
}

function validateStateMachine(manifest) {
  const states = manifest.state_machine?.states || {};
  for (const [id, requirement] of Object.entries(REQUIRED_STATES)) {
    const state = states[id];
    if (!state) throw new Error(`state machine is missing ${id}`);
    expect(state.terminal_scope, requirement.terminalScope, `${id} terminal scope`);
    expect(state.outcome, requirement.outcome, `${id} outcome`);
  }

  const currentState = requiredString(manifest.current?.state, 'current state');
  if (!states[currentState]) throw new Error(`current state is not declared: ${currentState}`);

  const transitions = Array.isArray(manifest.state_machine?.transitions) ? manifest.state_machine.transitions : [];
  const pairs = new Set();
  for (const transition of transitions) {
    const from = requiredString(transition.from, 'transition from');
    const to = requiredString(transition.to, 'transition to');
    if (!states[from] || !states[to]) throw new Error(`transition references an unknown state: ${from} -> ${to}`);
    requiredString(transition.when, `${from} -> ${to} condition`);
    const key = `${from}|${to}`;
    if (pairs.has(key)) throw new Error(`duplicate transition ${from} -> ${to}`);
    pairs.add(key);
  }
  for (const [from, to] of REQUIRED_TRANSITIONS) {
    if (!pairs.has(`${from}|${to}`)) throw new Error(`state machine is missing transition ${from} -> ${to}`);
  }

  const advance = transitions.find(
    (transition) => transition.from === 'retired_after_acceptance_failure' && transition.to === 'working_predeclared',
  );
  expect(advance?.version_action, 'increment_by_one', 'retired-version transition action');
  const reset = transitions.find(
    (transition) => transition.from === 'stagnated' && transition.to === 'working_predeclared',
  );
  expect(reset?.version_action, 'increment_by_one', 'stagnated-version transition action');
  const workingFailureReset = transitions.find(
    (transition) => transition.from === 'retired_after_working_failure' && transition.to === 'working_predeclared',
  );
  expect(
    workingFailureReset?.version_action,
    'increment_by_one',
    'failed-working-version transition action',
  );

  return { states, transitions, currentState };
}

function validateVersioning(manifest) {
  const currentVersion = integer(manifest.current?.campaign_version, 'current campaign version', { minimum: 1 });
  expect(manifest.current?.label, `V${currentVersion}`, 'current version label');
  expect(manifest.versioning?.current, currentVersion, 'versioning current');
  expect(manifest.versioning?.next, currentVersion + 1, 'versioning next');
  expect(manifest.versioning?.increment, 1, 'version increment');
  expect(manifest.versioning?.unbounded, true, 'unbounded version progression');
  expect(manifest.versioning?.acceptance_version_immutable_after_first_paid_call, true, 'acceptance immutability');
  expect(manifest.versioning?.tuning_after_observation_retires_entire_version, true, 'version retirement rule');

  const examples = Array.isArray(manifest.versioning?.examples) ? manifest.versioning.examples : [];
  if (examples.length < 3) throw new Error('versioning must show at least three Vn -> Vn+1 examples');
  for (const example of examples) {
    const from = integer(example.from, 'version example from', { minimum: 1 });
    const to = integer(example.to, 'version example to', { minimum: 1 });
    if (to !== from + 1) throw new Error(`version example must increment by one: V${from} -> V${to}`);
  }
  return currentVersion;
}

function validateReviewRoles(manifest) {
  const roles = Array.isArray(manifest.inner_review_roles) ? manifest.inner_review_roles : [];
  if (!roles.length) throw new Error('inner review roles are required');
  const ids = new Set();
  const responsibilities = new Set();
  for (const role of roles) {
    const id = requiredString(role.id, 'inner review role id');
    if (ids.has(id)) throw new Error(`duplicate inner review role ${id}`);
    ids.add(id);
    requiredString(role.authority, `${id} authority`);
    const owned = Array.isArray(role.responsibilities) ? role.responsibilities : [];
    if (!owned.length) throw new Error(`${id} must own at least one responsibility`);
    for (const responsibility of owned) responsibilities.add(requiredString(responsibility, `${id} responsibility`));
  }
  for (const responsibility of REQUIRED_REVIEW_RESPONSIBILITIES) {
    if (!responsibilities.has(responsibility)) {
      throw new Error(`inner review roles do not assign ${responsibility}`);
    }
  }
  return roles;
}

function validateSeedLedger(manifest) {
  expect(manifest.seed_rules?.global_ledger_required, true, 'global seed ledger requirement');
  expect(manifest.seed_rules?.same_seed_retry_only_before_any_candidate_or_result, true, 'same-seed retry rule');
  expect(manifest.seed_rules?.tuning_retires_active_unstarted_and_reserve_seeds, true, 'seed retirement rule');
  expect(manifest.seed_rules?.fresh_acceptance_seeds_predeclared_before_paid_calls, true, 'seed predeclaration rule');

  const ledger = manifest.seed_ledger || {};
  const development = Array.isArray(ledger.development) ? ledger.development : [];
  if (!development.length) throw new Error('development seed ledger is empty');
  const historical = Array.isArray(ledger.historical) ? ledger.historical : [];
  const heldOut = Array.isArray(ledger.held_out?.entries) ? ledger.held_out.entries : [];
  const reserves = Array.isArray(ledger.reserve?.entries) ? ledger.reserve.entries : [];
  const seen = new Set();
  for (const entry of [...historical, ...development, ...heldOut, ...reserves]) {
    const seed = integer(entry.seed, 'seed ledger entry', { minimum: 1 });
    if (seen.has(seed)) throw new Error(`seed appears more than once in the ledger: ${seed}`);
    seen.add(seed);
    requiredString(entry.status, `seed ${seed} status`);
  }
  const developmentStatuses = new Set([
    'reusable_non_held_out_development',
    'consumed_development_reusable',
    'consumed_development_retired_after_stagnation',
    'consumed_development_failed_retired',
    'consumed_development_passed_but_campaign_failed_retired',
    'retired_unstarted_due_to_stagnation',
    'retired_unconsumed_unstarted_after_hard_cell_failure',
    'retired_unconsumed_after_preflight_failure',
  ]);
  for (const entry of development) {
    if (!developmentStatuses.has(entry.status)) {
      throw new Error(`development seed ${entry.seed} has unsupported status ${entry.status}`);
    }
  }

  if (['working_predeclared', 'stagnated', 'retired_after_working_failure'].includes(manifest.current?.state)) {
    expect(manifest.current?.acceptance_config, null, 'acceptance config before working-screen pass');
    expect(ledger.held_out?.status, 'not_predeclared', 'held-out seed status before working-screen pass');
    expect(ledger.reserve?.status, 'not_predeclared', 'reserve seed status before working-screen pass');
    if (heldOut.length || reserves.length) {
      throw new Error('held-out and reserve seeds must remain empty until acceptance is predeclared');
    }
  }
  if (['stagnated', 'retired_after_working_failure'].includes(manifest.current?.state)) {
    const reusable = development.filter((entry) =>
      ['reusable_non_held_out_development', 'consumed_development_reusable'].includes(entry.status),
    );
    if (reusable.length) {
      throw new Error('stagnated version must retire every development and confirmation seed');
    }
  }
  return { development, historical, heldOut, reserves };
}

function validateWorkingScreen(manifest, { root }) {
  const configPath = absolute(root, manifest.current?.working_screen_config);
  if (!fs.existsSync(configPath)) throw new Error(`working screen config is missing: ${configPath}`);
  const loaded = loadTutorStubFirstDraftCampaign(configPath, { root });
  const validation = validateTutorStubFirstDraftCampaign({ config: loaded.config, root });
  if (validation.kind !== 'working_screen') throw new Error('outer loop working config is not a working screen');

  const config = loaded.config;
  const confirmation = [
    'first-draft-working-screens-v7',
    'first-draft-working-screens-v8',
    'first-draft-working-screens-v9',
    'first-draft-working-screens-v10',
    'first-draft-working-screens-v11',
  ]
    .includes(config.id);
  const v28StructuralScreen = config.id === 'first-draft-working-screens-v8';
  const v29SourceAccessibilityScreen = config.id === 'first-draft-working-screens-v9';
  const v30RecoveryIntegrationScreen = config.id === 'first-draft-working-screens-v10';
  const v31PreflightDiagnosticsScreen = config.id === 'first-draft-working-screens-v11';
  const v32DiagnosticScreen = config.id === 'first-draft-diagnostic-screens-v12';
  expect(config.id, manifest.current?.working_screen_id, 'working screen id');
  expect(config.held_out, false, 'working screen held-out flag');
  expect(config.fixed_configuration?.original_only, true, 'working screen original-only mode');
  expect(config.fixed_configuration?.draws_per_turn, confirmation ? 4 : 1, 'working screen draws per turn');
  expect(config.fixed_configuration?.concurrency, 1, 'working screen concurrency');
  expect(config.fixed_configuration?.max_live_model_jobs, confirmation ? 3 : 1, 'working screen maximum live jobs');
  if (config.fixed_configuration?.structured_generation === true) {
    expect(config.gates_per_cell?.require_structured_output, true, 'structured output gate');
    expect(config.gates_per_cell?.require_structured_slot_ownership, true, 'structured slot ownership gate');
    expect(config.gates_per_cell?.require_exact_source_once, true, 'exact source once gate');
  }
  if (config.fixed_configuration?.joint_performance_generation === true) {
    expect(
      config.gates_per_cell?.require_joint_performance_output,
      true,
      'joint-performance output gate',
    );
    expect(
      config.gates_per_cell?.require_joint_performance_ownership,
      true,
      'joint-performance ownership gate',
    );
    expect(
      config.gates_per_cell?.require_exact_host_source_occurrences,
      true,
      'exact host source occurrences gate',
    );
  }
  expect(config.gates_per_cell?.required_turns, v32DiagnosticScreen ? 1 : 4, 'working screen required turns');
  expect(
    config.gates_per_cell?.required_originals_accepted,
    v32DiagnosticScreen ? 1 : 4,
    'working screen required originals',
  );
  expect(config.gates_per_cell?.minimum_mean_configuration_realization, 1, 'working screen configuration realization');
  expect(config.gates_per_cell?.configuration_realization_enforcement, 'gate', 'configuration realization enforcement');
  expect(config.gates_per_cell?.maximum_safety_failures, 0, 'working screen safety failures');
  if (confirmation || v32DiagnosticScreen) {
    for (const field of [
      'maximum_mechanical_repairs', 'maximum_model_rewrites',
      'maximum_semantic_recognition_corrections', 'maximum_transport_normalizations',
    ]) expect(config.gates_per_cell?.[field], 0, `confirmation ${field}`);
    expect(config.gates_per_cell?.required_prefixes, 1, 'confirmation required prefixes');
    expect(
      config.gates_per_cell?.required_draws_per_prefix,
      v32DiagnosticScreen ? 1 : 4,
      'confirmation draws per prefix',
    );
  }
  if (
    v28StructuralScreen || v29SourceAccessibilityScreen ||
    v30RecoveryIntegrationScreen || v31PreflightDiagnosticsScreen || v32DiagnosticScreen
  ) {
    const label = v32DiagnosticScreen
      ? 'V32'
      : v31PreflightDiagnosticsScreen
        ? 'V31'
        : v30RecoveryIntegrationScreen
          ? 'V30'
          : v29SourceAccessibilityScreen
            ? 'V29'
            : 'V28';
    expect(config.fixed_configuration?.adjudication_policy, 'deterministic_only', `${label} adjudication policy`);
    expect(config.fixed_configuration?.semantic_adjudication, false, `${label} semantic adjudication disabled`);
    expect(config.gates_per_cell?.maximum_semantic_adjudicator_calls, 0, `${label} semantic calls`);
    expect(config.gates_per_cell?.maximum_semantic_adjudicator_errors, 0, `${label} semantic errors`);
    expect(config.gates_per_cell?.require_deterministic_only_audit, true, `${label} deterministic audit gate`);
    expect(config.gates_per_cell?.require_structural_target_activation, true, `${label} structural activation gate`);
    expect(
      config.gates_per_cell?.require_source_surface_accessibility,
      true,
      `${label} source-surface accessibility gate`,
    );
    expect(
      config.gates_per_cell?.require_successful_semantic_adjudication_per_draw,
      false,
      `${label} semantic-every-draw gate disabled`,
    );
  }
  expect(config.gates_per_cell?.maximum_fallbacks, 0, 'working screen fallbacks');
  expect(config.gates_per_cell?.require_transcript_specific_uptake, true, 'working screen uptake gate');
  const finalFrontierAttemptIteration = config.stopping?.final_frontier_attempt_iteration;
  if (finalFrontierAttemptIteration != null) {
    integer(finalFrontierAttemptIteration, 'final-frontier attempt iteration', { minimum: 1 });
    expect(
      config.stopping?.stop_if_final_frontier_attempt_fails,
      true,
      'failed final-frontier attempt stop',
    );
  }
  const requiredCellCount = v32DiagnosticScreen ? 2 : confirmation ? 4 : 1;
  if (config.matrix.length !== requiredCellCount) {
    throw new Error(`working screen must contain exactly ${requiredCellCount} cell(s)`);
  }

  for (const cell of config.matrix) {
    const ledgerEntry = (manifest.seed_ledger?.development || []).find(
      (entry) => Number(entry.seed) === Number(cell.development_seed),
    );
    if (!ledgerEntry) throw new Error(`working seed ${cell.development_seed} is absent from the outer-loop ledger`);
    expect(ledgerEntry.cell, cell.id, `working seed ${cell.development_seed} cell binding`);
    expect(ledgerEntry.screen, config.id, `working seed ${cell.development_seed} screen binding`);
  }
  const cell = config.matrix[0];
  let changeConfig = config;
  if (confirmation) {
    const primaryPath = absolute(root, manifest.current?.primary_working_screen_config);
    if (!fs.existsSync(primaryPath)) throw new Error(`primary working screen config is missing: ${primaryPath}`);
    const primary = loadTutorStubFirstDraftCampaign(primaryPath, { root }).config;
    expect(primary.id, manifest.current?.primary_working_screen_id, 'primary working screen id');
    changeConfig = primary;
  }

  return {
    configPath,
    id: config.id,
    cell: cell.id,
    turns: cell.turns.map(Number),
    developmentSeed: Number(cell.development_seed),
    cells: config.matrix.map((entry) => ({
      id: entry.id,
      priority: Number(entry.priority),
      world: entry.world,
      learnerProfile: entry.learner_profile,
      turns: entry.turns.map(Number),
      developmentSeed: Number(entry.development_seed),
      sourceTraceSha256: entry.source_trace_sha256 || null,
    })),
    targetBundles: config.matrix.map((entry) => ({
      id: entry.id,
      sourceTrace: entry.source_trace,
      targetTurn: Number(entry.prefix_integrity?.target_turn),
      targetBundle: entry.prefix_integrity?.target_bundle || null,
    })),
    confirmation,
    finalFrontierAttemptIteration:
      finalFrontierAttemptIteration == null ? null : Number(finalFrontierAttemptIteration),
    stopIfFinalFrontierAttemptFails:
      config.stopping?.stop_if_final_frontier_attempt_fails === true,
    jointPerformanceGeneration:
      config.fixed_configuration?.joint_performance_generation === true,
    jointPerformanceSchema:
      config.fixed_configuration?.joint_performance_schema || null,
    jointPerformanceCompositionSchema:
      config.fixed_configuration?.joint_performance_composition_schema || null,
    jointPerformanceAuditSchema:
      config.fixed_configuration?.joint_performance_audit_schema || null,
    adjudicationPolicy: config.fixed_configuration?.adjudication_policy || null,
    iteration2Change: changeConfig.change_log?.iteration_2 || null,
    iteration3Change: changeConfig.change_log?.iteration_3 || null,
    iteration4Change: changeConfig.change_log?.iteration_4 || null,
    iteration5Change: changeConfig.change_log?.iteration_5 || null,
    iteration6Change: changeConfig.change_log?.iteration_6 || null,
    iteration7Change: changeConfig.change_log?.iteration_7 || null,
    execution: config.execution || null,
    changeControl: config.change_control || null,
    openQualitativeDebt: config.open_qualitative_debt || null,
    structuralDebtTargets: config.structural_debt_targets || null,
    preflight: config.preflight || null,
    preflightReady: validation.preflightReady !== false,
    preflightBlockers: validation.preflightBlockers || [],
    structuralPreflight: validation.structuralPreflight || [],
    v28StructuralScreen,
    v29SourceAccessibilityScreen,
    v30RecoveryIntegrationScreen,
    v31PreflightDiagnosticsScreen,
    v32DiagnosticScreen,
    sourceAccessibilityPolicy:
      config.fixed_configuration?.source_accessibility_policy || 'direct_only',
    gates: {
      requiredOriginalsAccepted: Number(config.gates_per_cell?.required_originals_accepted),
      requiredTurns: Number(config.gates_per_cell?.required_turns),
      minimumMeanConfigurationRealization: 1,
      maximumSafetyFailures: 0,
      maximumFallbacks: 0,
      requireTranscriptSpecificUptake: true,
      requireStructuredOutput: config.fixed_configuration?.structured_generation === true,
      requireStructuredSlotOwnership: config.fixed_configuration?.structured_generation === true,
      requireExactSourceOnce: config.fixed_configuration?.structured_generation === true,
      requireJointPerformanceOutput:
        config.gates_per_cell?.require_joint_performance_output === true,
      requireJointPerformanceOwnership:
        config.gates_per_cell?.require_joint_performance_ownership === true,
      requireExactHostSourceOccurrences:
        config.gates_per_cell?.require_exact_host_source_occurrences === true,
      requireSourceSurfaceAccessibility:
        config.gates_per_cell?.require_source_surface_accessibility === true,
    },
  };
}

export function loadTutorStubFirstDraftOuterLoop(manifestPath, { root = process.cwd() } = {}) {
  const resolvedPath = absolute(root, manifestPath);
  const manifest = YAML.parse(fs.readFileSync(resolvedPath, 'utf8')) || {};
  return { manifest, manifestPath: resolvedPath, root: path.resolve(root) };
}

export function validateTutorStubFirstDraftOuterLoop({ manifest, root = process.cwd() } = {}) {
  expect(manifest?.schema, TUTOR_STUB_FIRST_DRAFT_OUTER_LOOP_SCHEMA, 'outer-loop schema');
  const id = requiredString(manifest.id, 'outer-loop id');
  const currentVersion = validateVersioning(manifest);
  const state = validateStateMachine(manifest);
  const workingIteration = integer(manifest.current?.working_iteration, 'working iteration', { minimum: 1 });
  if (state.currentState === 'working_predeclared' && workingIteration > 1) {
    expect(manifest.current?.last_observation?.version, currentVersion, 'last working observation version');
    expect(
      manifest.current?.last_observation?.working_iteration,
      workingIteration - 1,
      'last working observation iteration',
    );
    const comparison = manifest.current?.last_observation?.comparison || {};
    if (comparison.reason === 'first_measured_iteration') {
      expect(comparison.comparison_available, false, 'first working comparison availability');
      expect(comparison.measurable_improvement, null, 'first working measurable improvement');
    } else if (typeof comparison.measurable_improvement !== 'boolean') {
      throw new Error('last working observation must record whether improvement was measurable');
    }
    integer(
      manifest.current?.last_observation?.comparison?.consecutive_without_improvement,
      'consecutive working iterations without improvement',
    );
  }
  if (state.currentState === 'stagnated') {
    expect(manifest.current?.last_observation?.version, currentVersion, 'terminal observation version');
    expect(
      manifest.current?.last_observation?.working_iteration,
      workingIteration,
      'terminal observation iteration',
    );
    expect(manifest.current?.last_observation?.status, 'stagnated', 'terminal observation status');
    expect(
      manifest.current?.last_observation?.comparison?.consecutive_without_improvement,
      2,
      'terminal consecutive iterations without improvement',
    );
    expect(manifest.current?.last_observation?.comparison?.stop, true, 'terminal stop decision');
    expect(
      manifest.current?.last_observation?.comparison?.reason,
      'predeclared_final_frontier_attempt_failed',
      'terminal stopping reason',
    );
    expect(
      manifest.current?.last_observation?.terminal_action?.v27_status,
      'not_activated_or_predeclared',
      'V27 activation status',
    );
    expect(
      manifest.current?.required_confirmation_after_primary_pass?.status,
      'retired_unstarted_due_to_stagnation',
      'cross-world confirmation status',
    );
  }
  const roles = validateReviewRoles(manifest);
  const seeds = validateSeedLedger(manifest);
  const workingScreen = validateWorkingScreen(manifest, { root });

  if (currentVersion === 27) {
    expect(state.currentState, 'working_predeclared', 'V27 current state');
    expect(workingIteration, 8, 'V27 working iteration');
    const workingHistory = manifest.current?.working_history || [];
    if (workingHistory.length !== 7) {
      throw new Error('V27 working history must preserve exactly iterations 1 through 7 before confirmation');
    }
    validateV27Iteration1Observation(workingHistory[0], 'V27 working history iteration 1');
    validateV27Iteration2Observation(workingHistory[1], 'V27 working history iteration 2');
    validateV27Iteration3Observation(workingHistory[2], 'V27 working history iteration 3');
    validateV27Iteration4Observation(workingHistory[3], 'V27 working history iteration 4');
    validateV27Iteration5Observation(workingHistory[4], 'V27 working history iteration 5');
    validateV27Iteration6Observation(workingHistory[5], 'V27 working history iteration 6');
    validateV27Iteration7Observation(workingHistory[6], 'V27 working history iteration 7');
    validateV27Iteration7Observation(manifest.current?.last_observation, 'V27 last observation');
    expectJson(
      manifest.current?.last_observation,
      workingHistory[6],
      'V27 last observation and working history',
    );
    expect(manifest.current?.architectural_reset_from?.version, 26, 'V27 reset source version');
    expect(
      manifest.current?.architectural_reset_from?.terminal_state,
      'stagnated',
      'V27 reset source state',
    );
    expect(manifest.current?.architectural_reset_from?.final_iteration, 3, 'V26 final iteration');
    expect(
      manifest.current?.architectural_reset_from?.provenance?.result_sha256,
      '2643b16921017de46573bd4d92ae08dc8a7e7303b07ff094dc798a239b61e1ae',
      'V26 terminal result hash',
    );
    expect(
      manifest.current?.required_confirmation_after_primary_pass?.status,
      'predeclared',
      'V27 confirmation status',
    );
    expect(
      manifest.current?.required_confirmation_after_primary_pass?.seed_status,
      'reusable_non_held_out_development',
      'V27 confirmation seed status',
    );
    expect(workingScreen.jointPerformanceGeneration, true, 'V27 joint-performance generation');
    expect(workingScreen.iteration2Change?.status, 'predeclared', 'V27 iteration 2 change status');
    expect(
      workingScreen.iteration2Change?.bounded_change_owner,
      'speaking_prompt',
      'V27 iteration 2 bounded change owner',
    );
    expectJson(
      workingScreen.iteration2Change?.target_failure_clusters,
      [
        'jointPerformanceGenerationAudit:slot_exceeds_word_target',
        'jointPerformanceGenerationPrompt:v2_axis_ownership_conflict',
      ],
      'V27 iteration 2 target clusters',
    );
    expectJson(
      workingScreen.iteration2Change?.speaking_changes,
      ['three_word_drafting_cushion', 'compiled_v2_axis_ownership_compatibility'],
      'V27 iteration 2 speaking changes',
    );
    expectJson(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.permitted_instruction_sources,
      ['stance_definition', 'safe_fallback'],
      'V27 iteration 2 stance instruction sources',
    );
    expect(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.registry_field,
      'joint_performance_stance_contract',
      'V27 iteration 2 stance registry field',
    );
    expect(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.loader,
      'getJointPerformanceStanceContract',
      'V27 iteration 2 stance contract loader',
    );
    expect(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.host_plan_instruction_field,
      'slots.performance.stance_instruction',
      'V27 iteration 2 host-plan stance field',
    );
    expect(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.host_plan_source_field,
      'slots.performance.stance_instruction_source',
      'V27 iteration 2 host-plan stance source field',
    );
    expectJson(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.performance_response_owns,
      ['advocate_testability', 'action_neutral_stance_distinction'],
      'V27 iteration 2 performance-response ownership',
    );
    expectJson(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.performance_forbids,
      ['concrete_check_or_move'],
      'V27 iteration 2 performance exclusions',
    );
    expectJson(
      workingScreen.iteration2Change?.compiled_v2_axis_ownership_compatibility?.handoff_owns,
      ['concrete_check_or_move'],
      'V27 iteration 2 handoff ownership',
    );
    expect(workingScreen.iteration2Change?.recovery_change, 'none', 'V27 iteration 2 recovery change');
    expect(
      workingScreen.iteration2Change?.audit_recognition_change,
      'none',
      'V27 iteration 2 audit-recognition change',
    );
    expect(workingScreen.iteration3Change?.status, 'predeclared', 'V27 iteration 3 change status');
    expect(
      workingScreen.iteration3Change?.bounded_change_owner,
      'audit_recognition',
      'V27 iteration 3 bounded change owner',
    );
    expectJson(
      workingScreen.iteration3Change?.target_failure_clusters,
      [
        'actorialRealizationAudit:missing_selected_actorial_part',
        'jointPerformanceAudit:axis_not_realized_in_owner:actorial_part',
      ],
      'V27 iteration 3 target clusters',
    );
    expectJson(workingScreen.iteration3Change?.speaking_changes, [], 'V27 iteration 3 speaking changes');
    expectJson(workingScreen.iteration3Change?.recovery_changes, [], 'V27 iteration 3 recovery changes');
    expectJson(
      workingScreen.iteration3Change?.audit_recognition_changes,
      ['typed_composite_part_ownership'],
      'V27 iteration 3 audit-recognition changes',
    );
    expectJson(
      workingScreen.iteration3Change?.phrase_level_recognition_changes,
      [],
      'V27 iteration 3 phrase-level recognition changes',
    );
    const composite = workingScreen.iteration3Change?.typed_composite_part_ownership || {};
    expect(composite.joint_audit_field, 'compositePartOwnership', 'V27 iteration 3 joint audit field');
    expect(composite.mode, 'delegated_complement', 'V27 iteration 3 composite mode');
    expect(
      composite.contract_schema_constant,
      'TUTOR_STUB_COMPOSITE_PART_OWNERSHIP_SCHEMA',
      'V27 iteration 3 composite contract schema',
    );
    expect(
      composite.audit_schema_constant,
      'TUTOR_STUB_COMPOSITE_PART_OWNERSHIP_AUDIT_SCHEMA',
      'V27 iteration 3 composite audit schema',
    );
    const expectedRequirements = {
      performance_initiation: { owner: 'performance', slots: ['performance_entry'], required: true },
      performance_action_absent: {
        owner: 'performance',
        slots: ['performance_entry', 'performance_response'],
        required: true,
      },
      handoff_relevant_delegated_complement: { owner: 'handoff', slots: ['handoff'], required: true },
      handoff_selected_action: { owner: 'handoff', slots: ['handoff'], required: true },
    };
    expectJson(composite.requirements, expectedRequirements, 'V27 iteration 3 composite requirements');
    expect(
      composite.excluded_span_reporting?.field,
      'excluded_span_ids',
      'V27 iteration 3 excluded-span report field',
    );
    expect(
      composite.excluded_span_reporting?.require_host_source_excluded,
      true,
      'V27 iteration 3 host source exclusion',
    );
    expect(
      composite.excluded_span_reporting?.source_owner,
      'host',
      'V27 iteration 3 source owner',
    );
    expect(
      composite.linkage_reporting?.field,
      'linkage.shared_content_tokens',
      'V27 iteration 3 linkage report field',
    );
    expect(
      composite.linkage_reporting?.require_nonempty,
      true,
      'V27 iteration 3 relevant complement linkage',
    );
    expect(composite.delivery_gates_changed, false, 'V27 iteration 3 delivery gate change');
    expect(workingScreen.iteration4Change?.status, 'predeclared', 'V27 iteration 4 change status');
    expect(
      workingScreen.iteration4Change?.bounded_change_owner,
      'transport',
      'V27 iteration 4 bounded change owner',
    );
    expectJson(
      workingScreen.iteration4Change?.target_failure_clusters,
      ['jointPerformanceGenerationAudit:slot_has_outer_whitespace'],
      'V27 iteration 4 target clusters',
    );
    expectJson(workingScreen.iteration4Change?.speaking_changes, [], 'V27 iteration 4 speaking changes');
    expectJson(workingScreen.iteration4Change?.recovery_changes, [], 'V27 iteration 4 recovery changes');
    expectJson(
      workingScreen.iteration4Change?.audit_recognition_changes,
      [],
      'V27 iteration 4 audit-recognition changes',
    );
    expectJson(
      workingScreen.iteration4Change?.transport_changes,
      ['trim_outer_slot_whitespace'],
      'V27 iteration 4 transport changes',
    );
    const transport = workingScreen.iteration4Change?.outer_slot_whitespace_canonicalization || {};
    expect(transport.input_scope, 'decoded_model_owned_slot_strings', 'V27 iteration 4 transport input');
    expectJson(
      transport.slot_ids,
      ['uptake', 'performance.entry', 'performance.response', 'handoff'],
      'V27 iteration 4 transport slots',
    );
    expect(transport.operation, 'trim_outer_whitespace_only', 'V27 iteration 4 transport operation');
    expect(transport.preserve_internal_whitespace, true, 'V27 iteration 4 internal whitespace');
    expect(transport.preserve_semantic_content, true, 'V27 iteration 4 semantic content');
    expect(transport.preserve_raw_model_output, true, 'V27 iteration 4 raw output');
    expect(transport.preserve_original_candidate_provenance, true, 'V27 iteration 4 candidate provenance');
    expect(transport.reporting?.field, 'transportCanonicalization', 'V27 iteration 4 report field');
    expect(transport.reporting?.applied_field, 'applied', 'V27 iteration 4 applied report');
    expect(
      transport.reporting?.canonicalized_slot_ids_field,
      'canonicalized_slot_ids',
      'V27 iteration 4 slot report',
    );
    expect(
      transport.reporting?.classification,
      'transport_canonicalization',
      'V27 iteration 4 report classification',
    );
    expectJson(
      transport.reporting?.separate_from,
      [
        'mechanical_repair',
        'model_rewrite',
        'deterministic_fallback',
        'semantic_recognition_correction',
        'configuration_realization',
      ],
      'V27 iteration 4 separate accounting',
    );
    expectJson(
      transport.unchanged_contracts,
      {
        safety_audits: true,
        semantic_audits: true,
        response_configuration_audit: true,
        source_ownership_audit: true,
        strict_delivery_gates: true,
      },
      'V27 iteration 4 unchanged contracts',
    );
    expectJson(
      workingScreen.iteration5Change,
      {
        status: 'predeclared',
        bounded_change_owner: 'audit_recognition',
        target_failure_clusters: [
          'actorialRealizationAudit:missing_selected_performance_tactic',
          'jointPerformanceAudit:axis_not_realized_in_owner:actorial_performance',
          'jointPerformanceAudit:axis_not_realized_in_owner:engagement_stance',
        ],
        speaking_changes: [],
        recovery_changes: [],
        transport_changes: [],
        semantic_adjudication_changes: [],
        audit_recognition_changes: ['typed_public_judgment_falter_recognition'],
        phrase_level_recognition_changes: [],
        typed_public_judgment_falter_recognition: {
          construction: 'declared_public_judgment_under_counterpressure',
          performance_contract: {
            schema: 'machinespirits.tutor-stub.performance-obligation-contract.v1',
            complete: true,
            selected_tactic: 'dramatic_counterpressure',
          },
          selected_part_visibility: {
            field: 'axes.actorial_part.part_visible',
            required: true,
          },
          local_pressure_target_overlap: {
            segment: 'performance_response',
            anchor_id: 'pressure_target',
            minimum_content_tokens: 2,
          },
          exact_contrary_source: {
            owner: 'host',
            surface_match: 'exact',
            required_in_full_composition: true,
            excluded_from_performance_spans: true,
          },
          terminal_handoff: {
            segment: 'handoff',
            anchor_id: 'learner_handoff',
            minimum_content_tokens: 1,
            terminal_question: true,
          },
          judgment_construction: {
            subject_category: 'declared_public_judgment',
            category_extension: ['judgment', 'judgement'],
            predicate_family: 'falter',
          },
          recognized_outputs: {
            actorial_performance: 'dramatic_counterpressure',
            engagement_stance: 'charismatic',
          },
          charismatic_visibility_reuse: {
            source: 'successful_typed_public_judgment_falter_event',
            require_selected_stance: 'charismatic',
            require_selected_tactic: 'dramatic_counterpressure',
            independent_lexical_shortcut: false,
          },
          reporting: {
            field: 'publicJudgmentFalterRecognition',
            require_contract_prerequisite_results: true,
            require_anchor_overlap_count: true,
            require_excluded_source_span_ids: true,
          },
          unchanged_contracts: {
            generation: true,
            recovery: true,
            transport: true,
            safety_audits: true,
            semantic_adjudication: true,
            response_configuration_audit: true,
            source_ownership_audit: true,
            configuration_realization: true,
            strict_delivery_gates: true,
          },
        },
      },
      'V27 iteration 5 audit-recognition change',
    );
    expectJson(
      workingScreen.iteration6Change,
      {
        status: 'predeclared',
        bounded_change_owner: 'audit_recognition',
        target_failure_clusters: ['jointPerformanceAudit:axis_not_realized_in_owner:scene_immersion'],
        speaking_changes: [],
        recovery_changes: [],
        transport_changes: [],
        semantic_adjudication_changes: [],
        audit_recognition_changes: ['world_general_scene_lexicon_number_morphology'],
        phrase_level_recognition_changes: [],
        world_general_scene_lexicon_number_morphology: {
          axis: 'scene_immersion',
          lexicon_source: 'public_world_surfaces',
          audited_segment: 'performance',
          token_match: {
            mode: 'exact_or_regular_terminal_s_number_pair',
            full_token_boundary_required: true,
            casefold_before_match: true,
            bidirectional: true,
            minimum_singular_length: 4,
            require_one_exact_public_world_term: true,
            allowed_inflection: { suffix: 's', operation: 'add_or_remove_once' },
            forbidden_expansions: {
              fuzzy_edit_distance: true,
              substring_match: true,
              derivational_stemming: true,
              synonym_expansion: true,
              terminal_es_rule: true,
              terminal_ies_rule: true,
            },
          },
          counting: {
            count_morphological_family_once: true,
            minimum_scene_terms_changed: false,
          },
          reporting: {
            field: 'sceneLexiconMorphologyRecognition',
            require_world_term: true,
            require_candidate_term: true,
            require_canonical_singular: true,
            require_rule_id: true,
          },
          unchanged_contracts: {
            generation: true,
            recovery: true,
            transport: true,
            safety_audits: true,
            semantic_adjudication: true,
            response_configuration_audit: true,
            source_ownership_audit: true,
            configuration_realization: true,
            scene_immersion_threshold: true,
            strict_delivery_gates: true,
          },
        },
      },
      'V27 iteration 6 scene-lexicon morphology change',
    );
    expectJson(
      workingScreen.iteration7Change,
      {
        status: 'predeclared',
        bounded_change_owner: 'audit_recognition',
        target_failure_clusters: [
          'responseCompositionAudit:verbatim_learner_echo',
          'actorialRealizationAudit:missing_selected_performance_tactic',
          'jointPerformanceAudit:axis_not_realized_in_owner:actorial_performance',
          'jointPerformanceAudit:axis_not_realized_in_owner:engagement_stance',
        ],
        speaking_changes: [],
        recovery_changes: [],
        transport_changes: [],
        semantic_adjudication_changes: [],
        audit_recognition_changes: [
          'requested_entry_answer_recognition',
          'public_judgment_meets_contrary_evidence_recognition',
        ],
        phrase_level_recognition_changes: [],
        requested_entry_answer_recognition: {
          construction: 'licensed_requested_writable_entry_answer',
          audit: 'responseCompositionAudit',
          failure: 'verbatim_learner_echo',
          request_contract: {
            source: 'frozen_turn_public_contract',
            explicit_writable_entry_request: true,
            permitted_prefix: 'Write:',
            answer_scope: 'licensed_pre_turn_limit',
          },
          candidate_contract: {
            owner: 'uptake',
            form: 'declarative',
            question_forbidden: true,
            meta_commentary_forbidden: true,
            must_answer_requested_entry: true,
          },
          ordinary_echo_behavior: {
            remains_hard_failure: true,
            question_recast_without_contract_fails: true,
            copied_or_paraphrased_learner_language_without_answer_fails: true,
          },
          reporting: {
            field: 'requestedEntryAnswerRecognition',
            require_request_contract: true,
            require_candidate_form: true,
            require_answer_scope: true,
          },
        },
        public_judgment_meets_contrary_evidence_recognition: {
          construction: 'declared_public_judgment_meets_contrary_evidence',
          performance_contract: {
            schema: 'machinespirits.tutor-stub.performance-obligation-contract.v1',
            complete: true,
            selected_tactic: 'dramatic_counterpressure',
          },
          selected_part_visibility: {
            field: 'axes.actorial_part.part_visible',
            required: true,
          },
          same_owned_sentence: {
            segment: 'performance_response',
            required: true,
            judgment_nouns: ['claim', 'judgment', 'judgement'],
            opposition_predicates: ['fails against'],
          },
          local_pressure_target_overlap: {
            segment: 'performance_response',
            anchor_id: 'pressure_target',
            minimum_content_tokens: 2,
          },
          contrary_anchor_overlap: {
            segment: 'performance_response',
            anchor_id: 'contrary_evidence',
            minimum_content_tokens: 2,
          },
          exact_contrary_source: {
            owner: 'host',
            surface_match: 'exact',
            required_in_full_composition: true,
            excluded_from_performance_spans: true,
          },
          terminal_handoff: {
            segment: 'handoff',
            anchor_id: 'learner_handoff',
            minimum_content_tokens: 1,
            terminal_question: true,
          },
          recognized_outputs: {
            actorial_performance: 'dramatic_counterpressure',
            engagement_stance: 'charismatic',
          },
          charismatic_visibility_reuse: {
            source: 'successful_public_judgment_meets_contrary_evidence_event',
            require_selected_stance: 'charismatic',
            require_selected_tactic: 'dramatic_counterpressure',
            independent_lexical_shortcut: false,
          },
          reporting: {
            field: 'publicJudgmentMeetsContraryEvidenceRecognition',
            require_contract_prerequisite_results: true,
            require_same_sentence_result: true,
            require_pressure_overlap_count: true,
            require_contrary_overlap_count: true,
            require_excluded_source_span_ids: true,
          },
          unchanged_contracts: {
            generation: true,
            recovery: true,
            transport: true,
            safety_audits: true,
            semantic_adjudication: true,
            response_configuration_audit: true,
            source_ownership_audit: true,
            configuration_realization: true,
            strict_delivery_gates: true,
          },
        },
      },
      'V27 iteration 7 typed audit-recognition change',
    );
    expect(workingScreen.confirmation, true, 'V27 cross-world confirmation screen');
    expectJson(workingScreen.cells, [
      {
        id: 'tallow_answer_seeking',
        priority: 1,
        world: 'world_025_tallow_street',
        learnerProfile: 'answer_seeking',
        turns: [5],
        developmentSeed: 20261600,
        sourceTraceSha256: '5ffe6180107ef050565108d4c8341d750e47c4712450dc5b789da9a3b02b202d',
      },
      {
        id: 'ravensmark_affective_resistant',
        priority: 2,
        world: 'world_009_ravensmark',
        learnerProfile: 'affective_resistant',
        turns: [5],
        developmentSeed: 20261601,
        sourceTraceSha256: 'f3435a216646758cb27e71ae86597b63eddcd104bc49514df5573b8d25baff92',
      },
      {
        id: 'larkspur_premature_closure',
        priority: 3,
        world: 'world_028_larkspur_fridge',
        learnerProfile: 'premature_closure',
        turns: [2],
        developmentSeed: 20261602,
        sourceTraceSha256: '307e77091962297b25832499a5c311eb133b84919ad1688485c9fcb9f21bd820',
      },
      {
        id: 'foxtrot_diligent',
        priority: 4,
        world: 'world_022_foxtrot_jukebox',
        learnerProfile: 'diligent',
        turns: [4],
        developmentSeed: 20261603,
        sourceTraceSha256: 'cbdf897ccd592d9ed7bf3d79b135079a2eb121a8f1291a6b7450c36c8fe773da',
      },
    ], 'V27 confirmation cells');
    expectJson(workingScreen.execution, {
      hardest_cell_first: true,
      hard_cell: 'tallow_answer_seeking',
      hard_cell_must_pass_before_remaining: true,
      remaining_cells_execution: 'concurrent',
      maximum_concurrent_remaining_cells: 3,
      one_job_per_cell: true,
      forbid_duplicate_active_or_completed_cells: true,
      complete_all_cells_after_hard_cell_passes: true,
      stop_cell_when_gate_mathematically_impossible: true,
      preserve_unstarted_seeds_as_unconsumed: true,
      require_exact_target_bundle_binding: true,
    }, 'V27 confirmation execution');
    expectJson(workingScreen.changeControl, {
      implementation_change_from_v27_iteration_7: 'none',
      speaking_changes: [],
      audit_recognition_changes: [],
      recovery_changes: [],
      transport_changes: [],
      safety_changes: [],
      semantic_adjudication_changes: [],
      gate_changes: [],
    }, 'V27 confirmation change control');
    expectJson(
      {
        status: workingScreen.openQualitativeDebt?.status,
        source: workingScreen.openQualitativeDebt?.source,
        items: workingScreen.openQualitativeDebt?.items,
      },
      V27_OPEN_QUALITATIVE_DEBT,
      'V27 confirmation open qualitative debt',
    );
    expectJson(
      {
        status: manifest.current?.required_confirmation_after_primary_pass?.open_qualitative_debt?.status,
        source: manifest.current?.required_confirmation_after_primary_pass?.open_qualitative_debt?.source,
        items: manifest.current?.required_confirmation_after_primary_pass?.open_qualitative_debt?.items,
      },
      V27_OPEN_QUALITATIVE_DEBT,
      'V27 outer-loop open qualitative debt',
    );
    expectJson(
      manifest.current?.required_confirmation_after_primary_pass?.seeds,
      [20261600, 20261601, 20261602, 20261603],
      'V27 confirmation seeds',
    );
    expect(
      manifest.current?.required_confirmation_after_primary_pass?.hard_cell,
      'tallow_answer_seeking',
      'V27 confirmation hard cell',
    );
    if (seeds.development.length !== 5) {
      throw new Error('V27 must preserve the primary development seed plus four confirmation seeds');
    }
    expectJson(
      seeds.development.map((entry) => Number(entry.seed)),
      [20261500, 20261600, 20261601, 20261602, 20261603],
      'V27 development seed ledger',
    );
    for (const entry of seeds.development) {
      expect(entry.status, 'reusable_non_held_out_development', `V27 development seed ${entry.seed} status`);
    }
    const retiredV26Statuses = new Map([
      [20261400, 'consumed_development_retired_after_stagnation'],
      [20261401, 'retired_unstarted_due_to_stagnation'],
      [20261402, 'retired_unstarted_due_to_stagnation'],
      [20261403, 'retired_unstarted_due_to_stagnation'],
      [20261404, 'retired_unstarted_due_to_stagnation'],
    ]);
    for (const [seed, status] of retiredV26Statuses) {
      const retired = seeds.historical.find((entry) => Number(entry.seed) === seed);
      if (!retired || retired.status !== status) {
        throw new Error(`V27 history must preserve retired V26 seed ${seed}`);
      }
    }
  }

  if (currentVersion === 28) {
    expect(state.currentState, 'working_predeclared', 'V28 current state');
    expect(workingIteration, 1, 'V28 working iteration');
    expectJson(manifest.current?.active_working_history, [], 'V28 active working history');
    expect(manifest.current?.active_last_observation, null, 'V28 active last observation');
    expect(
      manifest.current?.working_history_scope,
      'preserved_v27_primary_history_read_only',
      'V28 inherited working-history scope',
    );
    const inheritedHistory = manifest.current?.prior_version_working_history || [];
    if (inheritedHistory.length !== 7) {
      throw new Error('V28 must preserve exactly seven V27 primary observations');
    }
    validateV27Iteration1Observation(inheritedHistory[0], 'V28 inherited V27 iteration 1');
    validateV27Iteration2Observation(inheritedHistory[1], 'V28 inherited V27 iteration 2');
    validateV27Iteration3Observation(inheritedHistory[2], 'V28 inherited V27 iteration 3');
    validateV27Iteration4Observation(inheritedHistory[3], 'V28 inherited V27 iteration 4');
    validateV27Iteration5Observation(inheritedHistory[4], 'V28 inherited V27 iteration 5');
    validateV27Iteration6Observation(inheritedHistory[5], 'V28 inherited V27 iteration 6');
    validateV27Iteration7Observation(inheritedHistory[6], 'V28 inherited V27 iteration 7');
    validateV27Iteration7Observation(
      manifest.current?.prior_version_last_primary_observation,
      'V28 inherited V27 primary last observation',
    );
    validateV27Iteration8Advance(manifest.current?.version_advance_from, 'V28 version advance');

    expect(
      manifest.current?.prior_version_confirmation?.status,
      'failed_and_retired_on_v28_advance',
      'V27 confirmation result status',
    );
    expect(
      manifest.current?.prior_version_confirmation?.result_artifact,
      V27_ITERATION_8_RESULT.artifact,
      'V27 confirmation result artifact',
    );
    expect(
      manifest.current?.prior_version_confirmation?.result_sha256,
      V27_ITERATION_8_RESULT.resultSha256,
      'V27 confirmation result hash',
    );
    expectJson(
      manifest.current?.prior_version_confirmation?.attempted_cells,
      ['tallow_answer_seeking'],
      'V27 confirmation attempted cells',
    );
    expectJson(
      manifest.current?.prior_version_confirmation?.unstarted_cells,
      ['ravensmark_affective_resistant', 'larkspur_premature_closure', 'foxtrot_diligent'],
      'V27 confirmation unstarted cells',
    );

    expect(workingScreen.id, 'first-draft-working-screens-v8', 'V28 screen id');
    expect(workingScreen.confirmation, true, 'V28 strict multi-cell screen');
    expect(workingScreen.v28StructuralScreen, true, 'V28 structural screen flag');
    expect(workingScreen.jointPerformanceGeneration, true, 'V28 joint-performance generation');
    expectJson(workingScreen.cells, [
      {
        id: 'tallow_answer_seeking', priority: 1, world: 'world_025_tallow_street',
        learnerProfile: 'answer_seeking', turns: [5], developmentSeed: 20261800,
        sourceTraceSha256: '5ffe6180107ef050565108d4c8341d750e47c4712450dc5b789da9a3b02b202d',
      },
      {
        id: 'ravensmark_affective_resistant', priority: 2, world: 'world_009_ravensmark',
        learnerProfile: 'affective_resistant', turns: [5], developmentSeed: 20261801,
        sourceTraceSha256: 'f3435a216646758cb27e71ae86597b63eddcd104bc49514df5573b8d25baff92',
      },
      {
        id: 'larkspur_premature_closure', priority: 3, world: 'world_028_larkspur_fridge',
        learnerProfile: 'premature_closure', turns: [2], developmentSeed: 20261802,
        sourceTraceSha256: '307e77091962297b25832499a5c311eb133b84919ad1688485c9fcb9f21bd820',
      },
      {
        id: 'foxtrot_diligent', priority: 4, world: 'world_022_foxtrot_jukebox',
        learnerProfile: 'diligent', turns: [4], developmentSeed: 20261803,
        sourceTraceSha256: 'cbdf897ccd592d9ed7bf3d79b135079a2eb121a8f1291a6b7450c36c8fe773da',
      },
    ], 'V28 working cells');
    expectJson(workingScreen.execution, {
      hardest_cell_first: true,
      hard_cell: 'tallow_answer_seeking',
      hard_cell_must_pass_before_remaining: true,
      remaining_cells_execution: 'concurrent',
      maximum_concurrent_remaining_cells: 3,
      one_job_per_cell: true,
      forbid_duplicate_active_or_completed_cells: true,
      complete_all_cells_after_hard_cell_passes: true,
      stop_cell_when_gate_mathematically_impossible: true,
      preserve_unstarted_seeds_as_unconsumed: true,
      require_exact_target_bundle_binding: true,
      require_clean_worktree: true,
    }, 'V28 execution');
    expectJson(workingScreen.changeControl, {
      implementation_change_from_v27_iteration_8: 'coordinated_v28_structural_contracts',
      speaking_prompt_progression_changes: [
        'typed_handoff_contract',
        'cross_slot_progression',
        'typed_turn_focus_relation',
      ],
      deterministic_host_changes: [
        'colon_safe_due_source_renderer',
        'due_source_action_referent_alignment',
      ],
      audit_recognition_changes: ['shared_writable_request_classifier'],
      recovery_changes: [],
      transport_changes: [],
      safety_changes: [],
      semantic_adjudication_changes: ['explicit_deterministic_only_working_screen'],
      gate_changes: [
        'per_draw_structural_target_activation',
        'source_renderer_mode_activation',
        'due_source_action_alignment_visibility',
        'source_turn_lexical_accessibility_visibility',
        'authored_source_sentence_accessibility',
        'deterministic_only_adjudication_policy',
        'clean_worktree_provenance_gate',
      ],
      delivery_audit_changes: [
        'turn_progression_audit_is_a_strict_delivery_gate',
        'due_source_action_alignment_is_a_joint_ownership_gate',
      ],
    }, 'V28 change control');
    expect(workingScreen.adjudicationPolicy, 'deterministic_only', 'V28 adjudication policy');
    expectJson(workingScreen.structuralDebtTargets, {
      status: 'active_v28_targets',
      source: 'V28_structural_audit_of_v27_iteration_7_and_confirmation_failure',
      items: V27_OPEN_QUALITATIVE_DEBT.items,
      consequence: workingScreen.structuralDebtTargets?.consequence,
    }, 'V28 structural debt targets');
    if (!/pass permits.*held-out predeclaration/isu.test(workingScreen.structuralDebtTargets?.consequence || '')) {
      throw new Error('V28 structural debt consequence must preserve the development-only boundary');
    }
    for (const requiredTest of [
      'tests/tutorStubDueSourceRenderer.test.js',
      'tests/tutorStubLiveFirstDraftAudit.test.js',
      'tests/tutorStubTurnProgressionContract.test.js',
      'tests/tutorStubWorldScaffold.test.js',
      'tests/tutorStubV27ConfirmationRegression.test.js',
    ]) {
      if (!String(workingScreen.preflight?.focused_tests || '').includes(requiredTest)) {
        throw new Error(`V28 preflight must include ${requiredTest}`);
      }
    }
    expectJson(
      workingScreen.preflight?.structural_regression_fixtures,
      ['tests/fixtures/tutor-stub-first-draft/tallow-answer-seeking-v27-i8-turn5.json'],
      'V28 structural regression fixture',
    );

    expectJson(
      seeds.development.map((entry) => ({
        seed: Number(entry.seed), status: entry.status, cell: entry.cell, screen: entry.screen,
      })),
      [
        { seed: 20261800, status: 'reusable_non_held_out_development', cell: 'tallow_answer_seeking', screen: 'first-draft-working-screens-v8' },
        { seed: 20261801, status: 'reusable_non_held_out_development', cell: 'ravensmark_affective_resistant', screen: 'first-draft-working-screens-v8' },
        { seed: 20261802, status: 'reusable_non_held_out_development', cell: 'larkspur_premature_closure', screen: 'first-draft-working-screens-v8' },
        { seed: 20261803, status: 'reusable_non_held_out_development', cell: 'foxtrot_diligent', screen: 'first-draft-working-screens-v8' },
      ],
      'V28 development seed ledger',
    );
    const expectedV27Retirements = new Map([
      [20261500, 'consumed_development_retired_on_version_advance'],
      [20261600, 'consumed_development_retired_on_version_advance'],
      [20261601, 'retired_unstarted_due_to_version_advance'],
      [20261602, 'retired_unstarted_due_to_version_advance'],
      [20261603, 'retired_unstarted_due_to_version_advance'],
    ]);
    for (const [seed, status] of expectedV27Retirements) {
      const retired = seeds.historical.find((entry) => Number(entry.seed) === seed);
      if (!retired || retired.status !== status) {
        throw new Error(`V28 history must preserve V27 seed ${seed} as ${status}`);
      }
    }
    const allSeeds = [...seeds.historical, ...seeds.development, ...seeds.heldOut, ...seeds.reserves]
      .map((entry) => Number(entry.seed));
    if (allSeeds.some((seed) => seed >= 20261700 && seed <= 20261799)) {
      throw new Error('V28 must leave 202617xx absent and unreserved');
    }
  }

  if (currentVersion === 29) {
    expect(state.currentState, 'working_predeclared', 'V29 current state');
    expect(workingIteration, 1, 'V29 working iteration');
    expectJson(manifest.current?.active_working_history, [], 'V29 active working history');
    expect(manifest.current?.active_last_observation, null, 'V29 active last observation');
    expect(
      manifest.current?.working_history_scope,
      'preserved_v27_primary_history_and_v28_preflight_read_only',
      'V29 inherited working-history scope',
    );
    const inheritedHistory = manifest.current?.prior_version_working_history || [];
    if (inheritedHistory.length !== 7) {
      throw new Error('V29 must preserve exactly seven V27 primary observations');
    }
    validateV27Iteration1Observation(inheritedHistory[0], 'V29 inherited V27 iteration 1');
    validateV27Iteration2Observation(inheritedHistory[1], 'V29 inherited V27 iteration 2');
    validateV27Iteration3Observation(inheritedHistory[2], 'V29 inherited V27 iteration 3');
    validateV27Iteration4Observation(inheritedHistory[3], 'V29 inherited V27 iteration 4');
    validateV27Iteration5Observation(inheritedHistory[4], 'V29 inherited V27 iteration 5');
    validateV27Iteration6Observation(inheritedHistory[5], 'V29 inherited V27 iteration 6');
    validateV27Iteration7Observation(inheritedHistory[6], 'V29 inherited V27 iteration 7');
    validateV27Iteration7Observation(
      manifest.current?.prior_version_last_primary_observation,
      'V29 inherited V27 primary last observation',
    );
    validateV27Iteration8Advance(
      manifest.current?.v28_version_advance_from,
      'V29 inherited V27 confirmation advance',
    );
    validateV28Iteration1Advance(manifest.current?.version_advance_from, 'V29 version advance');

    expect(workingScreen.id, 'first-draft-working-screens-v9', 'V29 screen id');
    expect(workingScreen.confirmation, true, 'V29 strict multi-cell screen');
    expect(workingScreen.v29SourceAccessibilityScreen, true, 'V29 accessibility screen flag');
    expect(workingScreen.jointPerformanceGeneration, true, 'V29 joint-performance generation');
    expect(
      workingScreen.sourceAccessibilityPolicy,
      'direct_or_compensated_v1',
      'V29 source-accessibility policy',
    );
    expectJson(workingScreen.cells, [
      {
        id: 'tallow_answer_seeking', priority: 1, world: 'world_025_tallow_street',
        learnerProfile: 'answer_seeking', turns: [5], developmentSeed: 20261900,
        sourceTraceSha256: '5ffe6180107ef050565108d4c8341d750e47c4712450dc5b789da9a3b02b202d',
      },
      {
        id: 'ravensmark_affective_resistant', priority: 2, world: 'world_009_ravensmark',
        learnerProfile: 'affective_resistant', turns: [5], developmentSeed: 20261901,
        sourceTraceSha256: 'f3435a216646758cb27e71ae86597b63eddcd104bc49514df5573b8d25baff92',
      },
      {
        id: 'larkspur_premature_closure', priority: 3, world: 'world_028_larkspur_fridge',
        learnerProfile: 'premature_closure', turns: [2], developmentSeed: 20261902,
        sourceTraceSha256: '307e77091962297b25832499a5c311eb133b84919ad1688485c9fcb9f21bd820',
      },
      {
        id: 'foxtrot_diligent', priority: 4, world: 'world_022_foxtrot_jukebox',
        learnerProfile: 'diligent', turns: [4], developmentSeed: 20261903,
        sourceTraceSha256: 'cbdf897ccd592d9ed7bf3d79b135079a2eb121a8f1291a6b7450c36c8fe773da',
      },
    ], 'V29 working cells');
    expectJson(workingScreen.execution, {
      hardest_cell_first: true,
      hard_cell: 'tallow_answer_seeking',
      hard_cell_must_pass_before_remaining: true,
      remaining_cells_execution: 'concurrent',
      maximum_concurrent_remaining_cells: 3,
      one_job_per_cell: true,
      forbid_duplicate_active_or_completed_cells: true,
      complete_all_cells_after_hard_cell_passes: true,
      stop_cell_when_gate_mathematically_impossible: true,
      preserve_unstarted_seeds_as_unconsumed: true,
      require_exact_target_bundle_binding: true,
      require_clean_worktree: true,
    }, 'V29 execution');
    expectJson(workingScreen.changeControl, {
      implementation_change_from_v28_preflight: 'typed_source_accessibility_compensation_v1',
      speaking_prompt_changes: [
        'conditional_compensation_instruction_replaces_direct_only_prohibition',
        'selected_part_and_tactic_remain_outside_compensation_owner',
      ],
      deterministic_host_changes: [],
      audit_recognition_changes: [],
      recovery_changes: ['compensation_aware_v1_recovery_and_fallback'],
      transport_changes: [],
      safety_changes: [],
      gate_changes: [
        'direct_or_compensated_source_accessibility',
        'exact_adjacent_compensation_owner',
        'source_grounded_ordered_subsequence',
        'no_new_content_or_qualifier',
      ],
      delivery_audit_changes: [
        'source_accessibility_is_a_strict_delivery_gate',
        'duplicate_clue_exception_requires_passing_compensation_audit',
      ],
    }, 'V29 change control');
    expect(workingScreen.adjudicationPolicy, 'deterministic_only', 'V29 adjudication policy');
    expectJson(workingScreen.structuralDebtTargets, {
      status: 'active_v29_target',
      source: 'V28_clean_zero_call_preflight_failure',
      items: ['inaccessible_single_source_compensation'],
      consequence: workingScreen.structuralDebtTargets?.consequence,
    }, 'V29 structural debt target');
    if (!/pass permits.*held-out predeclaration/isu.test(workingScreen.structuralDebtTargets?.consequence || '')) {
      throw new Error('V29 structural debt consequence must preserve the development-only boundary');
    }
    if (!String(workingScreen.preflight?.focused_tests || '').includes(
      'tests/tutorStubSourceAccessibilityContract.test.js',
    )) {
      throw new Error('V29 preflight must include the source-accessibility contract tests');
    }
    expectJson(
      workingScreen.preflight?.structural_regression_fixtures,
      ['tests/fixtures/tutor-stub-first-draft/tallow-answer-seeking-v27-i8-turn5.json'],
      'V29 structural regression fixture',
    );

    expectJson(
      seeds.development.map((entry) => ({
        seed: Number(entry.seed), status: entry.status, cell: entry.cell, screen: entry.screen,
      })),
      [
        { seed: 20261900, status: 'reusable_non_held_out_development', cell: 'tallow_answer_seeking', screen: 'first-draft-working-screens-v9' },
        { seed: 20261901, status: 'reusable_non_held_out_development', cell: 'ravensmark_affective_resistant', screen: 'first-draft-working-screens-v9' },
        { seed: 20261902, status: 'reusable_non_held_out_development', cell: 'larkspur_premature_closure', screen: 'first-draft-working-screens-v9' },
        { seed: 20261903, status: 'reusable_non_held_out_development', cell: 'foxtrot_diligent', screen: 'first-draft-working-screens-v9' },
      ],
      'V29 development seed ledger',
    );
    for (const seed of [20261800, 20261801, 20261802, 20261803]) {
      const retired = seeds.historical.find((entry) => Number(entry.seed) === seed);
      if (!retired || retired.status !== 'retired_unconsumed_after_preflight_failure') {
        throw new Error(`V29 history must preserve V28 seed ${seed} as unconsumed and retired`);
      }
    }
    const allSeeds = [...seeds.historical, ...seeds.development, ...seeds.heldOut, ...seeds.reserves]
      .map((entry) => Number(entry.seed));
    if (allSeeds.some((seed) => seed >= 20261700 && seed <= 20261799)) {
      throw new Error('V29 must leave 202617xx absent and unreserved');
    }
  }

  if (currentVersion === 30) {
    expect(state.currentState, 'awaiting_working_screen', 'V30 current state');
    expect(workingIteration, 1, 'V30 working iteration');
    const activeHistory = manifest.current?.active_working_history || [];
    if (activeHistory.length !== 1) {
      throw new Error('V30 active working history must preserve exactly its zero-call preflight');
    }
    validateV30Iteration1PreflightObservation(activeHistory[0], 'V30 active working history');
    validateV30Iteration1PreflightObservation(
      manifest.current?.active_last_observation,
      'V30 active last observation',
    );
    expectJson(
      manifest.current?.active_last_observation,
      activeHistory[0],
      'V30 active last observation and history',
    );
    expect(
      manifest.current?.working_history_scope,
      'preserved_v27_primary_history_with_v28_v29_and_v30_zero_call_preflights',
      'V30 inherited working-history scope',
    );
    const inheritedHistory = manifest.current?.prior_version_working_history || [];
    if (inheritedHistory.length !== 7) {
      throw new Error('V30 must preserve exactly seven V27 primary observations');
    }
    validateV27Iteration1Observation(inheritedHistory[0], 'V30 inherited V27 iteration 1');
    validateV27Iteration2Observation(inheritedHistory[1], 'V30 inherited V27 iteration 2');
    validateV27Iteration3Observation(inheritedHistory[2], 'V30 inherited V27 iteration 3');
    validateV27Iteration4Observation(inheritedHistory[3], 'V30 inherited V27 iteration 4');
    validateV27Iteration5Observation(inheritedHistory[4], 'V30 inherited V27 iteration 5');
    validateV27Iteration6Observation(inheritedHistory[5], 'V30 inherited V27 iteration 6');
    validateV27Iteration7Observation(inheritedHistory[6], 'V30 inherited V27 iteration 7');
    validateV27Iteration7Observation(
      manifest.current?.prior_version_last_primary_observation,
      'V30 inherited V27 primary last observation',
    );
    validateV27Iteration8Advance(
      manifest.current?.v28_version_advance_from,
      'V30 inherited V27 confirmation advance',
    );
    validateV28Iteration1Advance(
      manifest.current?.v29_version_advance_from,
      'V30 inherited V28 preflight advance',
    );
    validateV29Iteration1Advance(manifest.current?.version_advance_from, 'V30 version advance');

    expect(workingScreen.id, 'first-draft-working-screens-v10', 'V30 screen id');
    expect(workingScreen.confirmation, true, 'V30 strict multi-cell screen');
    expect(workingScreen.v30RecoveryIntegrationScreen, true, 'V30 recovery screen flag');
    expect(workingScreen.jointPerformanceGeneration, true, 'V30 joint-performance generation');
    expect(
      workingScreen.sourceAccessibilityPolicy,
      'direct_or_compensated_v1',
      'V30 source-accessibility policy',
    );
    expectJson(workingScreen.cells, [
      {
        id: 'tallow_answer_seeking', priority: 1, world: 'world_025_tallow_street',
        learnerProfile: 'answer_seeking', turns: [5], developmentSeed: 20262000,
        sourceTraceSha256: '5ffe6180107ef050565108d4c8341d750e47c4712450dc5b789da9a3b02b202d',
      },
      {
        id: 'ravensmark_affective_resistant', priority: 2, world: 'world_009_ravensmark',
        learnerProfile: 'affective_resistant', turns: [5], developmentSeed: 20262001,
        sourceTraceSha256: 'f3435a216646758cb27e71ae86597b63eddcd104bc49514df5573b8d25baff92',
      },
      {
        id: 'larkspur_premature_closure', priority: 3, world: 'world_028_larkspur_fridge',
        learnerProfile: 'premature_closure', turns: [2], developmentSeed: 20262002,
        sourceTraceSha256: '307e77091962297b25832499a5c311eb133b84919ad1688485c9fcb9f21bd820',
      },
      {
        id: 'foxtrot_diligent', priority: 4, world: 'world_022_foxtrot_jukebox',
        learnerProfile: 'diligent', turns: [4], developmentSeed: 20262003,
        sourceTraceSha256: 'cbdf897ccd592d9ed7bf3d79b135079a2eb121a8f1291a6b7450c36c8fe773da',
      },
    ], 'V30 working cells');
    expectJson(workingScreen.execution, {
      hardest_cell_first: true,
      hard_cell: 'tallow_answer_seeking',
      hard_cell_must_pass_before_remaining: true,
      remaining_cells_execution: 'concurrent',
      maximum_concurrent_remaining_cells: 3,
      one_job_per_cell: true,
      forbid_duplicate_active_or_completed_cells: true,
      complete_all_cells_after_hard_cell_passes: true,
      stop_cell_when_gate_mathematically_impossible: true,
      preserve_unstarted_seeds_as_unconsumed: true,
      require_exact_target_bundle_binding: true,
      require_clean_worktree: true,
    }, 'V30 execution');
    expectJson(workingScreen.changeControl, {
      implementation_change_from_v29_preflight: 'typed_progression_aware_recovery_and_preflight_serialization_v1',
      speaking_prompt_changes: [],
      deterministic_host_changes: [],
      audit_recognition_changes: [
        'skyway_saved_fallback_verbatim_echo_recorded_as_expected_correction',
      ],
      recovery_changes: [
        'reject_uptake_already_failed_by_live_progression',
        'progression_aware_deterministic_uptake',
        'ordinary_fallback_uses_typed_terminal_handoff',
        'deterministic_preflight_failure_writes_zero_call_result',
      ],
      transport_changes: [],
      safety_changes: [],
      gate_changes: [],
      delivery_audit_changes: [],
    }, 'V30 change control');
    expect(workingScreen.adjudicationPolicy, 'deterministic_only', 'V30 adjudication policy');
    expectJson(workingScreen.structuralDebtTargets, {
      status: 'active_v30_target',
      source: 'V29_model_free_zero_call_preflight_failure',
      items: [
        'deterministic_fallback_progression_contract',
        'complete_preflight_failure_provenance',
      ],
      consequence: workingScreen.structuralDebtTargets?.consequence,
    }, 'V30 structural debt target');
    if (!/pass permits.*held-out predeclaration/isu.test(workingScreen.structuralDebtTargets?.consequence || '')) {
      throw new Error('V30 structural debt consequence must preserve the development-only boundary');
    }
    for (const requiredTest of [
      'tests/tutorStubSourceAccessibilityContract.test.js',
      'tests/tutorStubTurnProgressionContract.test.js',
      'tests/tutorStubInteractiveModes.test.js',
      'tests/adaptiveRunEvidencePackage.test.js',
      'tests/tutorStubFirstDraftCampaign.test.js',
    ]) {
      if (!String(workingScreen.preflight?.focused_tests || '').includes(requiredTest)) {
        throw new Error(`V30 preflight must include ${requiredTest}`);
      }
    }
    expectJson(
      workingScreen.preflight?.structural_regression_fixtures,
      ['tests/fixtures/tutor-stub-first-draft/tallow-answer-seeking-v27-i8-turn5.json'],
      'V30 structural regression fixture',
    );

    expectJson(
      seeds.development.map((entry) => ({
        seed: Number(entry.seed), status: entry.status, cell: entry.cell, screen: entry.screen,
      })),
      [
        { seed: 20262000, status: 'retired_unconsumed_after_preflight_failure', cell: 'tallow_answer_seeking', screen: 'first-draft-working-screens-v10' },
        { seed: 20262001, status: 'retired_unconsumed_after_preflight_failure', cell: 'ravensmark_affective_resistant', screen: 'first-draft-working-screens-v10' },
        { seed: 20262002, status: 'retired_unconsumed_after_preflight_failure', cell: 'larkspur_premature_closure', screen: 'first-draft-working-screens-v10' },
        { seed: 20262003, status: 'retired_unconsumed_after_preflight_failure', cell: 'foxtrot_diligent', screen: 'first-draft-working-screens-v10' },
      ],
      'V30 development seed ledger',
    );
    for (const seed of [20261800, 20261801, 20261802, 20261803, 20261900, 20261901, 20261902, 20261903]) {
      const retired = seeds.historical.find((entry) => Number(entry.seed) === seed);
      if (!retired || retired.status !== 'retired_unconsumed_after_preflight_failure') {
        throw new Error(`V30 history must preserve zero-call seed ${seed} as unconsumed and retired`);
      }
    }
    const allSeeds = [...seeds.historical, ...seeds.development, ...seeds.heldOut, ...seeds.reserves]
      .map((entry) => Number(entry.seed));
    if (allSeeds.some((seed) => seed >= 20261700 && seed <= 20261799)) {
      throw new Error('V30 must leave 202617xx absent and unreserved');
    }
  }

  if (currentVersion === 31) {
    expect(state.currentState, 'awaiting_working_screen', 'V31 current state');
    expect(workingIteration, 1, 'V31 working iteration');
    const activeHistory = manifest.current?.active_working_history || [];
    if (activeHistory.length !== 1) {
      throw new Error('V31 active working history must preserve exactly its hard-cell failure');
    }
    validateV31Iteration1Observation(activeHistory[0], 'V31 active working history');
    validateV31Iteration1Observation(
      manifest.current?.active_last_observation,
      'V31 active last observation',
    );
    expectJson(
      manifest.current?.active_last_observation,
      activeHistory[0],
      'V31 active last observation and history',
    );
    expect(
      manifest.current?.working_history_scope,
      'preserved_v27_primary_history_with_v28_v29_v30_preflights_and_v31_hard_cell_failure',
      'V31 inherited working-history scope',
    );
    const inheritedHistory = manifest.current?.prior_version_working_history || [];
    if (inheritedHistory.length !== 7) {
      throw new Error('V31 must preserve exactly seven V27 primary observations');
    }
    validateV27Iteration1Observation(inheritedHistory[0], 'V31 inherited V27 iteration 1');
    validateV27Iteration2Observation(inheritedHistory[1], 'V31 inherited V27 iteration 2');
    validateV27Iteration3Observation(inheritedHistory[2], 'V31 inherited V27 iteration 3');
    validateV27Iteration4Observation(inheritedHistory[3], 'V31 inherited V27 iteration 4');
    validateV27Iteration5Observation(inheritedHistory[4], 'V31 inherited V27 iteration 5');
    validateV27Iteration6Observation(inheritedHistory[5], 'V31 inherited V27 iteration 6');
    validateV27Iteration7Observation(inheritedHistory[6], 'V31 inherited V27 iteration 7');
    validateV27Iteration7Observation(
      manifest.current?.prior_version_last_primary_observation,
      'V31 inherited V27 primary last observation',
    );
    validateV27Iteration8Advance(
      manifest.current?.v28_version_advance_from,
      'V31 inherited V27 confirmation advance',
    );
    validateV28Iteration1Advance(
      manifest.current?.v29_version_advance_from,
      'V31 inherited V28 preflight advance',
    );
    validateV29Iteration1Advance(
      manifest.current?.v30_version_advance_from,
      'V31 inherited V29 preflight advance',
    );
    validateV30Iteration1Advance(manifest.current?.version_advance_from, 'V31 version advance');
    validateV30Iteration1Advance(
      manifest.current?.v30_preflight_observation,
      'V31 preserved V30 preflight observation',
    );
    expectJson(
      manifest.current?.v30_preflight_observation,
      manifest.current?.version_advance_from,
      'V31 V30 observation and version advance',
    );

    expect(workingScreen.id, 'first-draft-working-screens-v11', 'V31 screen id');
    expect(workingScreen.confirmation, true, 'V31 strict multi-cell screen');
    expect(workingScreen.v31PreflightDiagnosticsScreen, true, 'V31 diagnostics screen flag');
    expect(workingScreen.jointPerformanceGeneration, true, 'V31 joint-performance generation');
    expect(
      workingScreen.sourceAccessibilityPolicy,
      'direct_or_compensated_v1',
      'V31 source-accessibility policy',
    );
    expectJson(workingScreen.cells, [
      {
        id: 'tallow_answer_seeking', priority: 1, world: 'world_025_tallow_street',
        learnerProfile: 'answer_seeking', turns: [5], developmentSeed: 20262100,
        sourceTraceSha256: '5ffe6180107ef050565108d4c8341d750e47c4712450dc5b789da9a3b02b202d',
      },
      {
        id: 'ravensmark_affective_resistant', priority: 2, world: 'world_009_ravensmark',
        learnerProfile: 'affective_resistant', turns: [5], developmentSeed: 20262101,
        sourceTraceSha256: 'f3435a216646758cb27e71ae86597b63eddcd104bc49514df5573b8d25baff92',
      },
      {
        id: 'larkspur_premature_closure', priority: 3, world: 'world_028_larkspur_fridge',
        learnerProfile: 'premature_closure', turns: [2], developmentSeed: 20262102,
        sourceTraceSha256: '307e77091962297b25832499a5c311eb133b84919ad1688485c9fcb9f21bd820',
      },
      {
        id: 'foxtrot_diligent', priority: 4, world: 'world_022_foxtrot_jukebox',
        learnerProfile: 'diligent', turns: [4], developmentSeed: 20262103,
        sourceTraceSha256: 'cbdf897ccd592d9ed7bf3d79b135079a2eb121a8f1291a6b7450c36c8fe773da',
      },
    ], 'V31 working cells');
    expectJson(workingScreen.execution, {
      hardest_cell_first: true,
      hard_cell: 'tallow_answer_seeking',
      hard_cell_must_pass_before_remaining: true,
      remaining_cells_execution: 'concurrent',
      maximum_concurrent_remaining_cells: 3,
      one_job_per_cell: true,
      forbid_duplicate_active_or_completed_cells: true,
      complete_all_cells_after_hard_cell_passes: true,
      stop_cell_when_gate_mathematically_impossible: true,
      preserve_unstarted_seeds_as_unconsumed: true,
      require_exact_target_bundle_binding: true,
      require_clean_worktree: true,
    }, 'V31 execution');
    expectJson(workingScreen.changeControl, {
      implementation_change_from_v30_preflight:
        'suite_scoped_preflight_execution_and_diagnostics_v1',
      speaking_prompt_changes: [],
      deterministic_host_changes: [],
      audit_recognition_changes: [],
      recovery_changes: [],
      preflight_orchestration_changes: [
        'split_unchanged_focused_test_inventory_into_four_named_suites',
        'preserve_suite_command_stdout_stderr_and_failed_subtest_diagnostics',
      ],
      transport_changes: [],
      safety_changes: [],
      gate_changes: [],
      delivery_audit_changes: [],
    }, 'V31 change control');
    expect(workingScreen.adjudicationPolicy, 'deterministic_only', 'V31 adjudication policy');
    expectJson(workingScreen.structuralDebtTargets, {
      status: 'active_v31_target',
      source: 'V30_deterministic_zero_call_transient_focused_test_preflight',
      items: [
        'suite_scoped_preflight_execution',
        'durable_failed_subtest_diagnostics',
      ],
      consequence: workingScreen.structuralDebtTargets?.consequence,
    }, 'V31 structural debt target');
    if (!/pass permits.*held-out predeclaration/isu.test(
      workingScreen.structuralDebtTargets?.consequence || '',
    )) {
      throw new Error('V31 structural debt consequence must preserve the development-only boundary');
    }
    expectJson(workingScreen.preflight?.focused_test_suites, [
      {
        id: 'audit_contracts',
        test_files: [
          'tests/tutorStubPromptAudit.test.js',
          'tests/derivationWorldQuality.test.js',
          'tests/tutorStubFrozenReplay.test.js',
          'tests/tutorStubFrozenReplayCheckpoint.test.js',
          'tests/tutorStubFirstDraftContract.test.js',
          'tests/tutorStubStructuredFirstDraft.test.js',
          'tests/tutorStubJointPerformanceFirstDraft.test.js',
          'tests/tutorStubV27JointPerformanceCalibration.test.js',
          'tests/tutorStubTypedCompositeAdvocateCalibration.test.js',
          'tests/tutorStubResponseComposition.test.js',
          'tests/tutorStubDueSourceRenderer.test.js',
          'tests/tutorStubSourceAccessibilityContract.test.js',
          'tests/tutorStubLiveFirstDraftAudit.test.js',
          'tests/tutorStubTurnProgressionContract.test.js',
          'tests/tutorStubWorldScaffold.test.js',
          'tests/tutorStubV27ConfirmationRegression.test.js',
          'tests/tutorStubV21PerformanceCalibrationFixture.test.js',
          'tests/tutorStubV25RecognitionFixture.test.js',
          'services/__tests__/tutorStubPerformanceObligationContract.test.js',
          'services/__tests__/tutorStubPerformanceAdjudication.test.js',
          'services/__tests__/tutorStubResponseConfiguration.test.js',
          'services/__tests__/tutorStubCounterpressure.test.js',
        ],
      },
      { id: 'interactive_modes', test_files: ['tests/tutorStubInteractiveModes.test.js'] },
      { id: 'adaptive_evidence', test_files: ['tests/adaptiveRunEvidencePackage.test.js'] },
      {
        id: 'campaign_orchestration',
        test_files: [
          'tests/tutorStubFirstDraftCampaign.test.js',
          'tests/tutorStubFirstDraftOuterLoop.test.js',
        ],
      },
    ], 'V31 focused-test suites');
    expectJson(
      workingScreen.preflight?.structural_regression_fixtures,
      ['tests/fixtures/tutor-stub-first-draft/tallow-answer-seeking-v27-i8-turn5.json'],
      'V31 structural regression fixture',
    );

    expectJson(
      seeds.development.map((entry) => ({
        seed: Number(entry.seed), status: entry.status, cell: entry.cell, screen: entry.screen,
      })),
      [
        { seed: 20262100, status: 'consumed_development_failed_retired', cell: 'tallow_answer_seeking', screen: 'first-draft-working-screens-v11' },
        { seed: 20262101, status: 'retired_unconsumed_unstarted_after_hard_cell_failure', cell: 'ravensmark_affective_resistant', screen: 'first-draft-working-screens-v11' },
        { seed: 20262102, status: 'retired_unconsumed_unstarted_after_hard_cell_failure', cell: 'larkspur_premature_closure', screen: 'first-draft-working-screens-v11' },
        { seed: 20262103, status: 'retired_unconsumed_unstarted_after_hard_cell_failure', cell: 'foxtrot_diligent', screen: 'first-draft-working-screens-v11' },
      ],
      'V31 development seed ledger',
    );
    for (const seed of [
      20261800, 20261801, 20261802, 20261803,
      20261900, 20261901, 20261902, 20261903,
      20262000, 20262001, 20262002, 20262003,
    ]) {
      const retired = seeds.historical.find((entry) => Number(entry.seed) === seed);
      if (!retired || retired.status !== 'retired_unconsumed_after_preflight_failure') {
        throw new Error(`V31 history must preserve zero-call seed ${seed} as unconsumed and retired`);
      }
    }
    const allSeeds = [...seeds.historical, ...seeds.development, ...seeds.heldOut, ...seeds.reserves]
      .map((entry) => Number(entry.seed));
    if (allSeeds.some((seed) => seed >= 20261700 && seed <= 20261799)) {
      throw new Error('V31 must leave 202617xx absent and unreserved');
    }
  }

  if (currentVersion === 32) {
    expect(state.currentState, 'retired_after_working_failure', 'V32 current state');
    expect(workingIteration, 1, 'V32 working iteration');
    const activeHistory = manifest.current?.active_working_history || [];
    if (activeHistory.length !== 1) {
      throw new Error('V32 active working history must preserve exactly its staged diagnostic result');
    }
    validateV32Iteration1Observation(activeHistory[0], 'V32 active working history');
    validateV32Iteration1Observation(
      manifest.current?.active_last_observation,
      'V32 active last observation',
    );
    expectJson(
      manifest.current?.active_last_observation,
      activeHistory[0],
      'V32 active last observation and history',
    );
    expect(
      manifest.current?.working_screen_config,
      'config/tutor-stub-campaigns/first-draft-diagnostic-screens-v12.yaml',
      'V32 diagnostic config path',
    );
    expect(
      manifest.current?.primary_working_screen_config,
      'config/tutor-stub-campaigns/first-draft-diagnostic-screens-v12.yaml',
      'V32 primary diagnostic config path',
    );
    expect(
      manifest.current?.working_history_scope,
      'preserved_v27_primary_history_with_v28_v29_v30_preflights_v31_hard_cell_failure_and_v32_staged_diagnostic_failure',
      'V32 inherited working-history scope',
    );
    const inheritedHistory = manifest.current?.prior_version_working_history || [];
    if (inheritedHistory.length !== 7) {
      throw new Error('V32 must preserve exactly seven V27 primary observations');
    }
    validateV27Iteration1Observation(inheritedHistory[0], 'V32 inherited V27 iteration 1');
    validateV27Iteration2Observation(inheritedHistory[1], 'V32 inherited V27 iteration 2');
    validateV27Iteration3Observation(inheritedHistory[2], 'V32 inherited V27 iteration 3');
    validateV27Iteration4Observation(inheritedHistory[3], 'V32 inherited V27 iteration 4');
    validateV27Iteration5Observation(inheritedHistory[4], 'V32 inherited V27 iteration 5');
    validateV27Iteration6Observation(inheritedHistory[5], 'V32 inherited V27 iteration 6');
    validateV27Iteration7Observation(inheritedHistory[6], 'V32 inherited V27 iteration 7');
    validateV27Iteration7Observation(
      manifest.current?.prior_version_last_primary_observation,
      'V32 inherited V27 primary last observation',
    );
    validateV27Iteration8Advance(
      manifest.current?.v28_version_advance_from,
      'V32 inherited V27 confirmation advance',
    );
    validateV28Iteration1Advance(
      manifest.current?.v29_version_advance_from,
      'V32 inherited V28 preflight advance',
    );
    validateV29Iteration1Advance(
      manifest.current?.v30_version_advance_from,
      'V32 inherited V29 preflight advance',
    );
    validateV30Iteration1Advance(
      manifest.current?.v31_version_advance_from,
      'V32 inherited V30 preflight advance',
    );
    validateV30Iteration1Advance(
      manifest.current?.v30_preflight_observation,
      'V32 preserved V30 preflight observation',
    );
    expectJson(
      manifest.current?.v30_preflight_observation,
      manifest.current?.v31_version_advance_from,
      'V32 V30 observation and inherited version advance',
    );
    validateV31Iteration1Observation(manifest.current?.version_advance_from, 'V32 version advance');
    validateV31Iteration1Observation(
      manifest.current?.v31_working_observation,
      'V32 preserved V31 working observation',
    );
    expectJson(
      manifest.current?.v31_working_observation,
      manifest.current?.version_advance_from,
      'V32 V31 observation and version advance',
    );

    expect(workingScreen.id, 'first-draft-diagnostic-screens-v12', 'V32 screen id');
    expect(workingScreen.confirmation, false, 'V32 is not the strict multi-cell screen');
    expect(workingScreen.v32DiagnosticScreen, true, 'V32 diagnostic screen flag');
    expect(workingScreen.jointPerformanceGeneration, true, 'V32 joint-performance generation');
    expect(
      workingScreen.sourceAccessibilityPolicy,
      'direct_or_compensated_v1',
      'V32 source-accessibility policy',
    );
    expectJson(workingScreen.cells, [
      {
        id: 'tallow_answer_seeking_diagnostic_1', priority: 1, world: 'world_025_tallow_street',
        learnerProfile: 'answer_seeking', turns: [5], developmentSeed: 20262200,
        sourceTraceSha256: '5ffe6180107ef050565108d4c8341d750e47c4712450dc5b789da9a3b02b202d',
      },
      {
        id: 'tallow_answer_seeking_diagnostic_2', priority: 2, world: 'world_025_tallow_street',
        learnerProfile: 'answer_seeking', turns: [5], developmentSeed: 20262201,
        sourceTraceSha256: '5ffe6180107ef050565108d4c8341d750e47c4712450dc5b789da9a3b02b202d',
      },
    ], 'V32 working cells');
    expectJson(workingScreen.targetBundles, [
      {
        id: 'tallow_answer_seeking_diagnostic_1',
        sourceTrace: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v20-live/tallow_answer_seeking/2026-07-16T07-03-36-147Z.jsonl',
        targetTurn: 5,
        targetBundle: {
          turn_id: '2026-07-16T07-03-36-147Z:t005',
          world: 'world_025_tallow_street',
          learner_profile: 'answer_seeking',
          request_model: 'gpt-5.6-terra',
          request_effort: 'low',
        },
      },
      {
        id: 'tallow_answer_seeking_diagnostic_2',
        sourceTrace: '/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v20-live/tallow_answer_seeking/2026-07-16T07-03-36-147Z.jsonl',
        targetTurn: 5,
        targetBundle: {
          turn_id: '2026-07-16T07-03-36-147Z:t005',
          world: 'world_025_tallow_street',
          learner_profile: 'answer_seeking',
          request_model: 'gpt-5.6-terra',
          request_effort: 'low',
        },
      },
    ], 'V32 exact diagnostic target bundles');
    expectJson(workingScreen.execution, {
      hardest_cell_first: true,
      hard_cell: 'tallow_answer_seeking_diagnostic_1',
      hard_cell_must_pass_before_remaining: true,
      mandatory_stage_dependency: true,
      remaining_cells_execution: 'concurrent',
      maximum_concurrent_remaining_cells: 1,
      one_job_per_cell: true,
      forbid_duplicate_active_or_completed_cells: true,
      complete_all_cells_after_hard_cell_passes: true,
      stop_cell_when_gate_mathematically_impossible: true,
      preserve_unstarted_seeds_as_unconsumed: true,
      require_exact_target_bundle_binding: true,
      require_clean_worktree: true,
    }, 'V32 execution');
    expectJson(workingScreen.changeControl, {
      implementation_commit: '10409158ce020860786ed47dc8f949611fc1b449',
      implementation_change_from_v31_working_failure:
        'advocate_handoff_operationalization_v1',
      speaking_prompt_changes: [
        'require_advocate_performance_entry_to_state_concrete_public_proposition_and_limit_in_same_entry',
        'require_eligible_declarative_handoff_to_begin_next_or_now_and_name_concrete_operation_on_public_object',
      ],
      deterministic_host_changes: [],
      audit_recognition_changes: [],
      recovery_changes: [],
      preflight_orchestration_changes: [
        'run_outer_loop_governance_tests_separately_at_frozen_config_and_result_boundaries',
        'exclude_outer_loop_governance_tests_from_reusable_speaking_compiler_preflight_certificate',
      ],
      transport_changes: [],
      safety_changes: [],
      gate_changes: [],
      delivery_audit_changes: [],
    }, 'V32 change control');
    expect(workingScreen.adjudicationPolicy, 'deterministic_only', 'V32 adjudication policy');
    expectJson(workingScreen.structuralDebtTargets, {
      status: 'active_v32_target',
      source: 'V31_safe_hard_cell_joint_ownership_failure',
      items: [
        'advocate_performance_initiation_as_concrete_public_proposition_with_same_entry_limit',
        'declarative_stage_next_step_handoff_as_concrete_operation_on_named_public_object',
      ],
      consequence: workingScreen.structuralDebtTargets?.consequence,
    }, 'V32 structural debt target');
    if (!/both passes permit.*V33/isu.test(
      workingScreen.structuralDebtTargets?.consequence || '',
    )) {
      throw new Error('V32 structural debt consequence must preserve the staged V33 boundary');
    }
    expectJson(workingScreen.preflight?.focused_test_suites, [
      {
        id: 'audit_contracts',
        test_files: [
          'tests/tutorStubPromptAudit.test.js',
          'tests/derivationWorldQuality.test.js',
          'tests/tutorStubFrozenReplay.test.js',
          'tests/tutorStubFrozenReplayCheckpoint.test.js',
          'tests/tutorStubFirstDraftContract.test.js',
          'tests/tutorStubStructuredFirstDraft.test.js',
          'tests/tutorStubJointPerformanceFirstDraft.test.js',
          'tests/tutorStubV27JointPerformanceCalibration.test.js',
          'tests/tutorStubTypedCompositeAdvocateCalibration.test.js',
          'tests/tutorStubResponseComposition.test.js',
          'tests/tutorStubDueSourceRenderer.test.js',
          'tests/tutorStubSourceAccessibilityContract.test.js',
          'tests/tutorStubLiveFirstDraftAudit.test.js',
          'tests/tutorStubTurnProgressionContract.test.js',
          'tests/tutorStubWorldScaffold.test.js',
          'tests/tutorStubV27ConfirmationRegression.test.js',
          'tests/tutorStubV21PerformanceCalibrationFixture.test.js',
          'tests/tutorStubV25RecognitionFixture.test.js',
          'services/__tests__/tutorStubPerformanceObligationContract.test.js',
          'services/__tests__/tutorStubPerformanceAdjudication.test.js',
          'services/__tests__/tutorStubResponseConfiguration.test.js',
          'services/__tests__/tutorStubCounterpressure.test.js',
        ],
      },
      { id: 'interactive_modes', test_files: ['tests/tutorStubInteractiveModes.test.js'] },
      { id: 'adaptive_evidence', test_files: ['tests/adaptiveRunEvidencePackage.test.js'] },
      {
        id: 'campaign_orchestration',
        test_files: ['tests/tutorStubFirstDraftCampaign.test.js'],
      },
    ], 'V32 focused-test suites');
    expectJson(
      workingScreen.preflight?.structural_regression_fixtures,
      ['tests/fixtures/tutor-stub-first-draft/tallow-answer-seeking-v27-i8-turn5.json'],
      'V32 structural regression fixture',
    );

    expectJson(
      seeds.development.map((entry) => ({
        seed: Number(entry.seed), status: entry.status, cell: entry.cell, screen: entry.screen,
      })),
      [
        { seed: 20262200, status: 'consumed_development_passed_but_campaign_failed_retired', cell: 'tallow_answer_seeking_diagnostic_1', screen: 'first-draft-diagnostic-screens-v12' },
        { seed: 20262201, status: 'consumed_development_failed_retired', cell: 'tallow_answer_seeking_diagnostic_2', screen: 'first-draft-diagnostic-screens-v12' },
      ],
      'V32 development seed ledger',
    );
    expectJson(seeds.heldOut, [], 'V32 held-out seeds');
    expectJson(seeds.reserves, [], 'V32 reserve seeds');
    expectJson(
      [20262100, 20262101, 20262102, 20262103].map((seed) => {
        const entry = seeds.historical.find((candidate) => Number(candidate.seed) === seed);
        return { seed, status: entry?.status, version: Number(entry?.version) };
      }),
      [
        { seed: 20262100, status: 'consumed_development_failed_retired', version: 31 },
        { seed: 20262101, status: 'retired_unconsumed_unstarted_after_hard_cell_failure', version: 31 },
        { seed: 20262102, status: 'retired_unconsumed_unstarted_after_hard_cell_failure', version: 31 },
        { seed: 20262103, status: 'retired_unconsumed_unstarted_after_hard_cell_failure', version: 31 },
      ],
      'V32 historical V31 seed dispositions',
    );
    for (const seed of [
      20261800, 20261801, 20261802, 20261803,
      20261900, 20261901, 20261902, 20261903,
      20262000, 20262001, 20262002, 20262003,
    ]) {
      const retired = seeds.historical.find((entry) => Number(entry.seed) === seed);
      if (!retired || retired.status !== 'retired_unconsumed_after_preflight_failure') {
        throw new Error(`V32 history must preserve zero-call seed ${seed} as unconsumed and retired`);
      }
    }
    const allSeeds = [...seeds.historical, ...seeds.development, ...seeds.heldOut, ...seeds.reserves]
      .map((entry) => Number(entry.seed));
    if (allSeeds.some((seed) => seed >= 20261700 && seed <= 20261799)) {
      throw new Error('V32 must leave 202617xx absent and unreserved');
    }
  }


  if (state.currentState === 'stagnated') {
    expect(
      workingScreen.finalFrontierAttemptIteration,
      workingIteration,
      'terminal final-frontier attempt iteration',
    );
    expect(
      workingScreen.stopIfFinalFrontierAttemptFails,
      true,
      'terminal failed final-frontier stop',
    );
    expect(
      manifest.current?.last_observation?.final_frontier_attempt?.outcome,
      'failed',
      'terminal final-frontier outcome',
    );
    expect(
      manifest.current?.last_observation?.final_frontier_attempt?.speaking_change,
      'none',
      'terminal final-frontier speaking change',
    );
    expect(
      manifest.current?.last_observation?.final_frontier_attempt?.recovery_change,
      'none',
      'terminal final-frontier recovery change',
    );
    expect(
      manifest.current?.last_observation?.final_frontier_attempt?.audit_recognition_change,
      'none',
      'terminal final-frontier audit-recognition change',
    );
  }

  const iterationAuthority =
    manifest.current?.last_observation?.[`iteration_${workingIteration}_authority`];
  if (iterationAuthority?.attempt === 'final_frontier_attempt') {
    expect(
      workingScreen.finalFrontierAttemptIteration,
      workingIteration,
      'working-screen final-frontier attempt iteration',
    );
    expect(
      workingScreen.stopIfFinalFrontierAttemptFails,
      true,
      'working-screen failed final-frontier stop',
    );
    expect(iterationAuthority.speaking_change, 'none', 'final-frontier speaking change');
    expect(iterationAuthority.recovery_change, 'none', 'final-frontier recovery change');
    expect(
      iterationAuthority.audit_recognition_change,
      'none',
      'final-frontier audit-recognition change',
    );
  }

  expect(manifest.stop_policy?.stagnation?.maximum_consecutive_iterations_without_improvement, 2, 'stagnation limit');
  expect(manifest.stop_policy?.stagnation?.terminal_state, 'stagnated', 'stagnation terminal state');
  expect(manifest.stop_policy?.success?.terminal_state, 'accepted', 'success terminal state');
  expect(
    manifest.stop_policy?.infrastructure?.terminal_state,
    'blocked_infrastructure',
    'infrastructure terminal state',
  );
  expect(
    manifest.stop_policy?.acceptance_failure?.terminal_state,
    'retired_after_acceptance_failure',
    'acceptance-failure state',
  );
  expect(
    manifest.stop_policy?.working_failure_with_improvement?.terminal_state,
    'retired_after_working_failure',
    'improved working-failure state',
  );
  if (
    !(manifest.stop_policy?.stagnation?.measurable_improvement_order || []).includes(
      'higher mean configuration realization',
    )
  ) {
    throw new Error('stagnation policy must count higher mean configuration realization as improvement');
  }

  return {
    schema: TUTOR_STUB_FIRST_DRAFT_OUTER_LOOP_SCHEMA,
    id,
    valid: true,
    currentVersion,
    currentState: state.currentState,
    workingIteration,
    terminalScope: state.states[state.currentState].terminal_scope,
    outcome: state.states[state.currentState].outcome,
    acceptancePredeclared: Boolean(manifest.current.acceptance_config),
    roles: roles.map((role) => role.id),
    seedCounts: {
      historical: seeds.historical.length,
      development: seeds.development.length,
      heldOut: seeds.heldOut.length,
      reserve: seeds.reserves.length,
    },
    workingScreen,
  };
}

export function summarizeTutorStubFirstDraftOuterLoop({ manifest, root = process.cwd() } = {}) {
  const validation = validateTutorStubFirstDraftOuterLoop({ manifest, root });
  const states = manifest.state_machine.states;
  const next = manifest.state_machine.transitions
    .filter((transition) => transition.from === validation.currentState)
    .map((transition) => ({
      state: transition.to,
      terminalScope: states[transition.to].terminal_scope,
      when: transition.when,
      versionAction: transition.version_action || 'none',
    }));
  return {
    ...validation,
    generatedAt: new Date().toISOString(),
    makesModelCalls: false,
    label: manifest.current.label,
    workingIteration: Number(manifest.current.working_iteration || 1),
    heldOutMatrixStatus: manifest.seed_ledger.held_out.status,
    reserveSeedStatus: manifest.seed_ledger.reserve.status,
    developmentSeeds: manifest.seed_ledger.development.map((entry) => ({
      seed: Number(entry.seed),
      cell: entry.cell,
      status: entry.status,
    })),
    next,
  };
}

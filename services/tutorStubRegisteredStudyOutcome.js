import fs from 'node:fs';

export const TUTOR_STUB_REGISTERED_STUDY_OUTCOME_SCHEMA = 'machinespirits.tutor-stub.registered-study-outcome.v1';
export const TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS = 'retained_substantive_failure';

export const TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_CODES = Object.freeze([
  'TUTOR_STUB_BOREDOM_PROOF_DAG_ADHERENCE_EXHAUSTED',
  'TUTOR_STUB_BOREDOM_PROOF_DAG_TRIGGER_MISSING',
  'TUTOR_STUB_RESISTANCE_ACTION_REGISTER_CONFIRMATION_TRIGGER_MISSING',
  'TUTOR_STUB_RESISTANCE_SEMANTIC_MEASUREMENT_INDETERMINATE',
]);

const RETAINED_SUBSTANTIVE_FAILURE_CODE_SET = new Set(TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_CODES);
const RETAINED_SUBSTANTIVE_FAILURE_DISPOSITION = 'substantive_registered_failure_stop_no_replacement';

export function tutorStubRegisteredStudyOutcomeFromError({ error, jobId } = {}) {
  const code = String(error?.code || '');
  const normalizedJobId = String(jobId || '');
  if (error?.substantiveStudyFailure !== true || !RETAINED_SUBSTANTIVE_FAILURE_CODE_SET.has(code) || !normalizedJobId) {
    return null;
  }
  return {
    schema: TUTOR_STUB_REGISTERED_STUDY_OUTCOME_SCHEMA,
    status: TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS,
    job_id: normalizedJobId,
    code,
    disposition: RETAINED_SUBSTANTIVE_FAILURE_DISPOSITION,
    substantive_study_failure: true,
    recoverable: false,
    replacement_allowed: false,
  };
}

export function writeTutorStubRegisteredStudyOutcome({ filePath, error, jobId } = {}) {
  const outcome = tutorStubRegisteredStudyOutcomeFromError({ error, jobId });
  if (!outcome || !filePath) return null;
  fs.writeFileSync(filePath, `${JSON.stringify(outcome, null, 2)}\n`, { flag: 'wx' });
  return outcome;
}

export function readTutorStubRegisteredStudyOutcome({ filePath, expectedJobId } = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { present: false, valid: false, outcome: null, issues: [] };
  }
  let outcome;
  try {
    outcome = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return { present: true, valid: false, outcome: null, issues: ['invalid_json'] };
  }
  const issues = [];
  if (outcome?.schema !== TUTOR_STUB_REGISTERED_STUDY_OUTCOME_SCHEMA) issues.push('schema');
  if (outcome?.status !== TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS) issues.push('status');
  if (outcome?.job_id !== String(expectedJobId || '')) issues.push('job_id');
  if (!RETAINED_SUBSTANTIVE_FAILURE_CODE_SET.has(outcome?.code)) issues.push('code');
  if (outcome?.disposition !== RETAINED_SUBSTANTIVE_FAILURE_DISPOSITION) issues.push('disposition');
  if (outcome?.substantive_study_failure !== true) issues.push('substantive_study_failure');
  if (outcome?.recoverable !== false) issues.push('recoverable');
  if (outcome?.replacement_allowed !== false) issues.push('replacement_allowed');
  return { present: true, valid: issues.length === 0, outcome, issues };
}

export default {
  readTutorStubRegisteredStudyOutcome,
  tutorStubRegisteredStudyOutcomeFromError,
  writeTutorStubRegisteredStudyOutcome,
};

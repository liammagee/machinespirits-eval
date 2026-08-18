/**
 * The learner personas the warrant outcome study runs against.
 *
 * These live on their own so that the zero-call preparation script can name a
 * persona without importing the scorer, which pulls in the whole baseline-study
 * module. The scorer re-exports both names, so existing callers are unchanged.
 */

export const OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE = 'low_agency';

export const OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES = Object.freeze(['low_agency', 'overconfident']);

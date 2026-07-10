export const DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE = 0.85;
export const MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE = 0.05;
export const MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE = 3;

// Backward-compatible public names for existing CLI wrappers and saved configs.
export const DEFAULT_TUTOR_STUB_REGISTER_TEMPERATURE = DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE;
export const MIN_TUTOR_STUB_REGISTER_TEMPERATURE = MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE;
export const MAX_TUTOR_STUB_REGISTER_TEMPERATURE = MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE;

export function normalizeTutorStubEngagementStanceTemperature(
  value,
  { label = 'engagement-stance temperature' } = {},
) {
  const temperature = Number(value);
  if (
    !Number.isFinite(temperature) ||
    temperature < MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE ||
    temperature > MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE
  ) {
    throw new RangeError(
      `${label} must be between ${MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE} and ${MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE}`,
    );
  }
  return Number(temperature.toFixed(4));
}

export const normalizeTutorStubRegisterTemperature = normalizeTutorStubEngagementStanceTemperature;

export function temperTutorStubEngagementStanceScores(
  scores,
  { temperature = DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE, floor = 0.02 } = {},
) {
  const normalizedTemperature = normalizeTutorStubEngagementStanceTemperature(temperature);
  const entries = Object.entries(scores || {}).map(([register, score]) => [
    register,
    Math.max(floor, Number(score) || 0),
  ]);
  if (!entries.length) return {};
  const maxScore = Math.max(...entries.map(([, score]) => score), floor);
  return Object.fromEntries(
    entries.map(([register, score]) => [
      register,
      Math.pow(score / maxScore, 1 / normalizedTemperature),
    ]),
  );
}

export const temperTutorStubRegisterScores = temperTutorStubEngagementStanceScores;

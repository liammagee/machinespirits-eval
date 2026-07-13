import fs from 'node:fs';
import path from 'node:path';

export const TUTOR_STUB_LAST_SETTINGS_SCHEMA = 'machinespirits.tutor-stub.last-settings.v1';

const ALLOWED_OVERLAYS = new Set(['state', 'field']);

function boundedNumber(value, { label, min, max }) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return number;
}

function nonEmptyString(value, label) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} must be a non-empty string`);
  return text;
}

export function normalizeTutorStubLastSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('saved settings file must contain a JSON object');
  }
  if (value.schema && value.schema !== TUTOR_STUB_LAST_SETTINGS_SCHEMA) {
    throw new Error(`saved settings were written by an unsupported version: ${value.schema}`);
  }
  const overlays = Array.isArray(value.registerOverlays)
    ? [
        ...new Set(
          value.registerOverlays.map((entry) =>
            String(entry || '')
              .trim()
              .replace(/-/gu, '_'),
          ),
        ),
      ]
    : [];
  const invalidOverlay = overlays.find((entry) => !ALLOWED_OVERLAYS.has(entry));
  if (invalidOverlay) throw new Error(`unsupported saved teaching-style override: ${invalidOverlay}`);
  return {
    schema: TUTOR_STUB_LAST_SETTINGS_SCHEMA,
    updatedAt: value.updatedAt ? String(value.updatedAt) : null,
    tutorModelRef: nonEmptyString(value.tutorModelRef, 'tutor model ref'),
    engagementStanceTemperature: boundedNumber(value.engagementStanceTemperature, {
      label: 'teaching-style range',
      min: 0.05,
      max: 3,
    }),
    dagFactDropoutRate: boundedNumber(value.dagFactDropoutRate, {
      label: 'evidence-memory dropout',
      min: 0,
      max: 1,
    }),
    releaseSpeed: boundedNumber(value.releaseSpeed ?? 1, {
      label: 'clue release speed',
      min: 0.5,
      max: 2,
    }),
    registerPolicy: nonEmptyString(value.registerPolicy, 'teaching approach').replace(/-/gu, '_'),
    registerOverlays: overlays,
    registerOverlayThreshold: boundedNumber(value.registerOverlayThreshold, {
      label: 'override sensitivity',
      min: 0,
      max: 1,
    }),
  };
}

export function readTutorStubLastSettings(filePath) {
  const absolute = path.resolve(filePath);
  try {
    const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    return {
      status: 'loaded',
      filePath: absolute,
      settings: normalizeTutorStubLastSettings(parsed),
      error: null,
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { status: 'missing', filePath: absolute, settings: null, error: null };
    }
    return { status: 'invalid', filePath: absolute, settings: null, error: error.message };
  }
}

export function writeTutorStubLastSettings(filePath, settings, { now = () => new Date() } = {}) {
  const absolute = path.resolve(filePath);
  const payload = normalizeTutorStubLastSettings({
    ...settings,
    schema: TUTOR_STUB_LAST_SETTINGS_SCHEMA,
    updatedAt: now().toISOString(),
  });
  const directory = path.dirname(absolute);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = `${absolute}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.renameSync(temporary, absolute);
  } finally {
    try {
      fs.rmSync(temporary, { force: true });
    } catch {
      // A successful rename already removed the temporary path.
    }
  }
  return payload;
}

export function clearTutorStubLastSettings(filePath) {
  const absolute = path.resolve(filePath);
  const existed = fs.existsSync(absolute);
  fs.rmSync(absolute, { force: true });
  return { filePath: absolute, existed };
}

export function tutorStubRememberedPolicyStack(settings) {
  const normalized = normalizeTutorStubLastSettings(settings);
  return [normalized.registerPolicy, ...normalized.registerOverlays].join('+');
}

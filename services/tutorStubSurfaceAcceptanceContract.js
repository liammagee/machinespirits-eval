export const TUTOR_STUB_SURFACE_ACCEPTANCE_SCHEMA = 'machinespirits.tutor-stub.surface-acceptance.v1';
export const TUTOR_STUB_SURFACE_PRIVATE_PROJECTION_SCHEMA = 'machinespirits.tutor-stub.surface-acceptance-private.v1';

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function contractDifferences(actual, expected, prefix = 'contract') {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return [`${prefix}: expected an array`];
    const differences = [];
    if (actual.length !== expected.length) {
      differences.push(`${prefix}: expected length ${expected.length}, received ${actual.length}`);
    }
    for (let index = 0; index < expected.length; index += 1) {
      differences.push(...contractDifferences(actual[index], expected[index], `${prefix}[${index}]`));
    }
    return differences;
  }
  if (isObject(expected)) {
    if (!isObject(actual)) return [`${prefix}: expected an object`];
    return Object.entries(expected).flatMap(([key, value]) =>
      contractDifferences(actual[key], value, `${prefix}.${key}`),
    );
  }
  return Object.is(actual, expected)
    ? []
    : [`${prefix}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`];
}

export function assertTutorStubSurfaceAcceptanceContract(result, expectedContract) {
  if (!isObject(result)) throw new Error('tutor-stub surface acceptance result must be an object');
  if (result.schema !== TUTOR_STUB_SURFACE_ACCEPTANCE_SCHEMA) {
    throw new Error(`unexpected tutor-stub surface acceptance schema: ${result.schema || 'missing'}`);
  }
  const differences = contractDifferences(result.contract, expectedContract);
  if (differences.length) {
    throw new Error(`tutor-stub surface acceptance contract failed:\n- ${differences.join('\n- ')}`);
  }
  if (!['web', 'packaged-electron'].includes(result.host?.kind)) {
    throw new Error(`unexpected tutor-stub surface host: ${result.host?.kind || 'missing'}`);
  }
  if (result.host.kind === 'packaged-electron') {
    if (result.host.authRequired !== true || result.host.unauthenticatedStatus !== 401) {
      throw new Error('packaged Electron acceptance must prove the per-launch loopback credential boundary');
    }
    if (result.host.cspPresent !== true) {
      throw new Error('packaged Electron acceptance must prove the renderer CSP boundary');
    }
  } else if (result.host.authRequired !== false || result.host.unauthenticatedStatus !== 200) {
    throw new Error('web acceptance must prove the loopback-only, credential-free development posture');
  }
  return result;
}

export function assertTutorStubSurfacePrivateProjection(projection) {
  if (projection?.schema !== TUTOR_STUB_SURFACE_PRIVATE_PROJECTION_SCHEMA) {
    throw new Error(`unexpected private acceptance projection schema: ${projection?.schema || 'missing'}`);
  }
  if (projection.providerRequestsStarted !== 2 || projection.providerRequestsCompleted !== 1) {
    throw new Error(
      `private acceptance projection expected two starts and one completion; received ${projection.providerRequestsStarted}/${projection.providerRequestsCompleted}`,
    );
  }
  const requiredTrue = [
    'providerPromptObserved',
    'privateCanaryObserved',
    'credentialCanaryObserved',
    'completedReplyObserved',
    'delayedRequestObserved',
    'delayedCompletionAbsent',
  ];
  for (const key of requiredTrue) {
    if (projection[key] !== true) throw new Error(`private acceptance projection failed: ${key}`);
  }
  return projection;
}

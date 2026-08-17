import { createHash } from 'node:crypto';

export const PAID_STUDY_ENDPOINT_CONTRACT_SCHEMA = 'machinespirits.paid-study-endpoint-contract.v1';
export const PAID_STUDY_ENDPOINT_PREFLIGHT_SCHEMA = 'machinespirits.paid-study-endpoint-preflight.v1';
export const PAID_STUDY_ENDPOINT_GO_SCHEMA = 'machinespirits.paid-study-endpoint-go.v1';

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

export function hashPaidStudyEndpointValue(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJson(value)))
    .digest('hex');
}

function exactUniqueStrings(values, label, errors) {
  if (!Array.isArray(values) || !values.length) {
    errors.push(`${label} must be a non-empty array`);
    return [];
  }
  const normalized = values.map((value) => String(value || '').trim());
  if (normalized.some((value) => !value)) errors.push(`${label} contains an empty value`);
  if (new Set(normalized).size !== normalized.length) errors.push(`${label} contains duplicates`);
  return normalized;
}

function valueAtPath(value, dottedPath) {
  return String(dottedPath)
    .split('.')
    .reduce((current, key) => (current == null ? undefined : current[key]), value);
}

function pairKey(row, fields) {
  return fields.map((field) => JSON.stringify(valueAtPath(row, field))).join('::');
}

function endpointCases(endpoint, cases) {
  const arms = endpoint.denominator?.include_arms;
  return Array.isArray(arms) ? cases.filter((row) => arms.includes(row.arm)) : cases;
}

export function validatePaidStudyEndpointContract(contract) {
  const errors = [];
  if (contract?.schema !== PAID_STUDY_ENDPOINT_CONTRACT_SCHEMA) errors.push('unsupported endpoint-contract schema');
  if (!String(contract?.study_id || '').trim()) errors.push('endpoint contract requires study_id');
  if (!Number.isInteger(contract?.registered_scale?.cases) || contract.registered_scale.cases < 1) {
    errors.push('registered_scale.cases must be a positive integer');
  }

  const emitted = new Set(exactUniqueStrings(contract?.runner?.emitted_event_fields, 'runner emitted fields', errors));
  if (!String(contract?.runner?.packet_builder || '').trim()) errors.push('runner packet_builder is required');
  if (!String(contract?.runner?.result_assembler || '').trim()) errors.push('runner result_assembler is required');
  const channels = contract?.channels && typeof contract.channels === 'object' ? contract.channels : {};
  const endpointRows = Array.isArray(contract?.endpoints) ? contract.endpoints : [];
  const endpointIds = exactUniqueStrings(
    endpointRows.map((endpoint) => endpoint?.id),
    'endpoint ids',
    errors,
  );
  const registeredPrimaryIds = exactUniqueStrings(
    contract?.registration?.primary_endpoint_ids,
    'registered primary endpoint ids',
    errors,
  );

  for (const primaryId of registeredPrimaryIds) {
    const endpoint = endpointRows.find((row) => row?.id === primaryId);
    if (!endpoint) errors.push(`registered primary endpoint ${primaryId} is missing`);
    else if (endpoint.role !== 'primary' || endpoint.enabled !== true) {
      errors.push(`registered primary endpoint ${primaryId} was disabled or demoted`);
    }
  }

  for (const endpoint of endpointRows) {
    const label = endpoint?.id || '(unnamed endpoint)';
    if (!endpointIds.includes(label)) continue;
    if (endpoint.enabled !== true) errors.push(`${label}: endpoint is disabled`);
    const requiredChannels = exactUniqueStrings(endpoint.required_channels, `${label} required channels`, errors);
    for (const channelId of requiredChannels) {
      const channel = channels[channelId];
      if (!channel) errors.push(`${label}: required channel ${channelId} is missing`);
      else if (channel.enabled !== true) errors.push(`${label}: required channel ${channelId} is disabled`);
      else if (!String(channel.implementation || '').trim()) {
        errors.push(`${label}: required channel ${channelId} has no implementation`);
      }
    }
    for (const field of exactUniqueStrings(endpoint.required_event_fields, `${label} required event fields`, errors)) {
      if (!emitted.has(field)) errors.push(`${label}: runner does not declare required event ${field}`);
    }
    if (!Number.isInteger(endpoint.denominator?.expected_cases) || endpoint.denominator.expected_cases < 1) {
      errors.push(`${label}: denominator.expected_cases must be a positive integer`);
    }
    const pairing = endpoint.pairing;
    if (pairing) {
      exactUniqueStrings(pairing.key_fields, `${label} pairing key fields`, errors);
      exactUniqueStrings(pairing.required_arm_values, `${label} pairing arm values`, errors);
      if (!Number.isInteger(pairing.expected_cases_per_arm) || pairing.expected_cases_per_arm < 1) {
        errors.push(`${label}: pairing.expected_cases_per_arm must be a positive integer`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function validateCaseEvents(contract, cases, errors) {
  const requiredFields = new Set(
    contract.endpoints.flatMap((endpoint) => (endpoint.enabled ? endpoint.required_event_fields || [] : [])),
  );
  for (const row of cases) {
    const caseId = row.case_id || '(unnamed case)';
    for (const field of requiredFields) {
      if (valueAtPath(row, field) === undefined || valueAtPath(row, field) === null) {
        errors.push(`${caseId}: missing required event ${field}`);
      }
    }
  }
}

function validateEndpointDenominators(contract, cases, errors) {
  for (const endpoint of contract.endpoints) {
    const rows = endpointCases(endpoint, cases);
    if (rows.length !== endpoint.denominator.expected_cases) {
      errors.push(`${endpoint.id}: expected denominator ${endpoint.denominator.expected_cases}, found ${rows.length}`);
    }
    if (!endpoint.pairing) continue;
    const requiredArms = endpoint.pairing.required_arm_values;
    const groups = new Map();
    for (const row of rows) {
      const key = pairKey(row, endpoint.pairing.key_fields);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row.arm);
    }
    for (const [key, observedArms] of groups) {
      const actual = [...observedArms].sort();
      const expected = requiredArms.flatMap((arm) => Array(endpoint.pairing.expected_cases_per_arm).fill(arm)).sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        errors.push(`${endpoint.id}: pairing group ${key} has arms ${actual.join(',') || 'none'}`);
      }
    }
  }
}

function validatePackets(contract, cases, packets, errors) {
  if (!Array.isArray(packets) || !packets.length) {
    errors.push('packet builder returned no packets');
    return;
  }
  const expectedIds = cases.map((row) => row.case_id).sort();
  const observedIds = [];
  const packetByCase = new Map();
  for (const packet of packets) {
    if (!String(packet?.packet_id || '').trim()) errors.push('packet is missing packet_id');
    const ids = Array.isArray(packet?.case_ids) ? packet.case_ids : [];
    const bytes = Buffer.byteLength(JSON.stringify(packet), 'utf8');
    if (bytes > contract.runner.packet_cap_bytes) {
      errors.push(
        `${packet.packet_id || '(unnamed packet)'} exceeds ${contract.runner.packet_cap_bytes}-byte packet cap`,
      );
    }
    for (const caseId of ids) {
      observedIds.push(caseId);
      if (packetByCase.has(caseId)) errors.push(`${caseId}: appears in more than one packet`);
      packetByCase.set(caseId, packet.packet_id);
    }
  }
  if (JSON.stringify(observedIds.sort()) !== JSON.stringify(expectedIds)) {
    errors.push('packet coverage does not exactly match the synthetic corpus');
  }

  for (const endpoint of contract.endpoints.filter((row) => row.pairing)) {
    const groups = new Map();
    for (const row of endpointCases(endpoint, cases)) {
      const key = pairKey(row, endpoint.pairing.key_fields);
      if (!groups.has(key)) groups.set(key, new Set());
      groups.get(key).add(packetByCase.get(row.case_id));
    }
    for (const [key, packetIds] of groups) {
      if (packetIds.size !== 1 || packetIds.has(undefined)) {
        errors.push(`${endpoint.id}: sharding split pairing group ${key}`);
      }
    }
  }
}

export function runPaidStudyEndpointPreflight({ contract, cases, buildPackets, assemble }) {
  const contractValidation = validatePaidStudyEndpointContract(contract);
  if (!contractValidation.ok) throw new Error(`endpoint contract invalid: ${contractValidation.errors.join('; ')}`);
  if (typeof buildPackets !== 'function') throw new Error('endpoint preflight requires the production packet builder');
  if (typeof assemble !== 'function') throw new Error('endpoint preflight requires the production result assembler');
  if (!Array.isArray(cases)) throw new Error('endpoint preflight cases must be an array');

  const errors = [];
  const caseIds = cases.map((row) => row?.case_id);
  if (caseIds.some((value) => !String(value || '').trim()) || new Set(caseIds).size !== caseIds.length) {
    errors.push('synthetic corpus case ids must be non-empty and unique');
  }
  if (cases.length !== contract.registered_scale.cases) {
    errors.push(`expected full synthetic scale ${contract.registered_scale.cases}, found ${cases.length}`);
  }
  validateCaseEvents(contract, cases, errors);
  validateEndpointDenominators(contract, cases, errors);
  const packets = buildPackets(cases, contract);
  validatePackets(contract, cases, packets, errors);
  if (errors.length) throw new Error(`endpoint runtime preflight failed: ${errors.join('; ')}`);

  const assembled = assemble({ cases, packets, contract });
  const assembledIds = Array.isArray(assembled?.case_ids) ? [...assembled.case_ids].sort() : [];
  if (JSON.stringify(assembledIds) !== JSON.stringify([...caseIds].sort())) {
    throw new Error('endpoint runtime preflight failed: result assembly does not cover the synthetic corpus exactly');
  }
  for (const endpoint of contract.endpoints) {
    if (assembled?.endpoint_status?.[endpoint.id] !== 'complete') {
      throw new Error(`endpoint runtime preflight failed: assembler did not complete ${endpoint.id}`);
    }
  }

  const reportBody = {
    schema: PAID_STUDY_ENDPOINT_PREFLIGHT_SCHEMA,
    status: 'passed',
    model_calls: 0,
    production_writes: 0,
    study_id: contract.study_id,
    contract_sha256: hashPaidStudyEndpointValue(contract),
    registered_scale: contract.registered_scale,
    endpoint_code_map: Object.fromEntries(
      contract.endpoints.map((endpoint) => [
        endpoint.id,
        {
          role: endpoint.role,
          channels: endpoint.required_channels.map((channelId) => ({
            id: channelId,
            implementation: contract.channels[channelId].implementation,
          })),
          packet_builder: contract.runner.packet_builder,
          result_assembler: contract.runner.result_assembler,
        },
      ]),
    ),
    packet_audit: {
      packets: packets.length,
      largest_packet_bytes: Math.max(...packets.map((packet) => Buffer.byteLength(JSON.stringify(packet), 'utf8'))),
      maximum_packet_bytes: contract.runner.packet_cap_bytes,
      covered_cases: caseIds.length,
    },
    assembly_audit: {
      covered_cases: assembledIds.length,
      endpoint_status: assembled.endpoint_status,
    },
  };
  return { ...reportBody, preflight_sha256: hashPaidStudyEndpointValue(reportBody) };
}

export function validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight }) {
  const errors = [];
  if (certificate?.schema !== PAID_STUDY_ENDPOINT_GO_SCHEMA) errors.push('unsupported endpoint GO schema');
  if (certificate?.status !== 'endpoint_runtime_go') errors.push('endpoint GO status is not endpoint_runtime_go');
  if (certificate?.study_id !== contract?.study_id || preflight?.study_id !== contract?.study_id) {
    errors.push('endpoint GO study id does not match the executable contract');
  }
  const contractSha256 = hashPaidStudyEndpointValue(contract);
  if (certificate?.contract_sha256 !== contractSha256 || preflight?.contract_sha256 !== contractSha256) {
    errors.push('endpoint GO contract digest does not match the executable contract');
  }
  if (certificate?.preflight_sha256 !== preflight?.preflight_sha256) {
    errors.push('endpoint GO preflight digest does not match the executable preflight');
  }
  return {
    ok: errors.length === 0,
    errors,
    contract_sha256: contractSha256,
    preflight_sha256: preflight?.preflight_sha256,
  };
}

export default {
  hashPaidStudyEndpointValue,
  runPaidStudyEndpointPreflight,
  validatePaidStudyEndpointContract,
  validatePaidStudyEndpointGoCertificate,
};

import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { createPaperManifestReporter } from './paperManifestValidator.js';

export const PAPER2_EVIDENCE_CLASSES = new Set([
  'database-recomputable',
  'archived-artifact-recomputable',
  'historical-only',
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

function claimSemantics(claim) {
  return canonicalize({
    id: claim.id,
    epoch: claim.epoch ?? null,
    statement: claim.statement ?? null,
    evidence: claim.evidence ?? null,
    assertion: claim.assertion ?? null,
  });
}

export function computeSemanticAuthorityFingerprint(authority, source) {
  if (authority.format === 'text-markers') {
    const markers = authority.semantic_markers || [];
    if (markers.length === 0 || markers.some((marker) => !source.includes(marker))) {
      throw new Error('required semantic marker missing');
    }
    return createHash('sha256')
      .update(JSON.stringify([...markers].sort()))
      .digest('hex');
  }
  const parsed = authority.format === 'json-document' ? JSON.parse(source) : parseYaml(source);
  if (authority.format === 'json-document') {
    const paths = authority.semantic_paths || [];
    if (paths.length === 0) throw new Error('semantic_paths is empty');
    const selected = paths.map((path) => {
      const value = path === '$' ? parsed : path.split('.').reduce((current, key) => current?.[key], parsed);
      if (value === undefined) throw new Error(`semantic path missing: ${path}`);
      return [path, canonicalize(value)];
    });
    return createHash('sha256').update(JSON.stringify(selected)).digest('hex');
  }
  const claims = Array.isArray(parsed?.claims) ? parsed.claims : [];
  const prefixes = authority.claim_id_prefixes || [];
  const ids = new Set(authority.claim_ids || []);
  const selected = claims
    .filter((claim) => ids.has(claim.id) || prefixes.some((prefix) => claim.id?.startsWith(prefix)))
    .map(claimSemantics)
    .sort((left, right) => left.id.localeCompare(right.id));
  if (selected.length === 0) throw new Error('selected no claims');
  return createHash('sha256').update(JSON.stringify(selected)).digest('hex');
}

function resultSections(paper) {
  return [...paper.matchAll(/^### (6\.[0-9]+)\s+/gmu)].map((match) => match[1]);
}

function validateShape(manifest, report) {
  if (!manifest || typeof manifest !== 'object') {
    report.fail('Paper 2 evidence manifest was not provided or is not a JSON object');
    return false;
  }
  let valid = true;
  if (manifest.schema !== 'paper2-evidence-manifest/v1') {
    report.fail('Manifest schema must be paper2-evidence-manifest/v1');
    valid = false;
  }
  if (manifest.paper !== 'docs/research/paper-full-2.0.md') {
    report.fail('Manifest paper must be docs/research/paper-full-2.0.md');
    valid = false;
  }
  if (!Array.isArray(manifest.semantic_authorities) || manifest.semantic_authorities.length === 0) {
    report.fail('Manifest semantic_authorities must be a non-empty array');
    valid = false;
  }
  if (!Array.isArray(manifest.claim_families) || manifest.claim_families.length === 0) {
    report.fail('Manifest claim_families must be a non-empty array');
    valid = false;
  }
  return valid;
}

export function validatePaper2EvidenceManifest({
  manifest,
  paper,
  db,
  readAuthority = () => null,
  substrateExists = () => false,
  manifestPath = 'manifest input',
  paperPath = 'paper input',
  databasePath = 'database input',
} = {}) {
  const report = createPaperManifestReporter();
  if (!manifest) {
    report.fail(`Manifest not found or unreadable: ${manifestPath}`);
    return report.result();
  }
  if (!validateShape(manifest, report)) return report.result();
  if (typeof paper !== 'string') {
    report.fail(`Paper not found or unreadable: ${paperPath}`);
    return report.result();
  }

  report.heading('Paper 2 evidence authority');
  const authorities = new Map();
  for (const authority of manifest.semantic_authorities) {
    if (!authority?.id || authorities.has(authority.id)) {
      report.fail(`Semantic authority id is missing or duplicated: ${authority?.id || '<missing>'}`);
      continue;
    }
    authorities.set(authority.id, authority);
    const source = readAuthority(authority.locator);
    if (typeof source !== 'string') {
      report.fail(`${authority.id}: semantic authority unavailable (${authority.locator})`);
      continue;
    }
    try {
      const actual = computeSemanticAuthorityFingerprint(authority, source);
      if (actual !== authority.semantic_sha256) {
        report.fail(`${authority.id}: semantic fingerprint drift (${actual}, expected ${authority.semantic_sha256})`);
      } else {
        report.pass(`${authority.id}: semantic claim fingerprint matches`);
      }
    } catch (error) {
      report.fail(`${authority.id}: semantic authority invalid (${error.message})`);
    }
  }

  report.heading('Paper 2 empirical claim families');
  const coveredSections = new Map();
  const familyIds = new Set();
  for (const family of manifest.claim_families) {
    const prefix = family?.id || '<missing-id>';
    if (!family?.id || familyIds.has(family.id)) report.fail(`Claim family id is missing or duplicated: ${prefix}`);
    familyIds.add(family?.id);
    if (!PAPER2_EVIDENCE_CLASSES.has(family?.evidence_class)) {
      report.fail(`${prefix}: evidence_class is missing or unclassified`);
      continue;
    }
    if (!Array.isArray(family.paper_sections) || family.paper_sections.length === 0) {
      report.fail(`${prefix}: paper_sections must be a non-empty array`);
    } else {
      for (const section of family.paper_sections) {
        const owner = coveredSections.get(section);
        if (owner) report.fail(`${prefix}: paper section ${section} is already classified by ${owner}`);
        else coveredSections.set(section, prefix);
      }
    }
    if (!Array.isArray(family.paper_markers) || family.paper_markers.length === 0) {
      report.fail(`${prefix}: paper_markers must be a non-empty array`);
    } else {
      for (const marker of family.paper_markers) {
        if (!paper.includes(marker)) report.fail(`${prefix}: canonical paper marker missing: ${marker}`);
      }
    }
    if (!Array.isArray(family.semantic_authority_ids) || family.semantic_authority_ids.length === 0) {
      report.fail(`${prefix}: semantic_authority_ids must be a non-empty array`);
    } else {
      for (const authorityId of family.semantic_authority_ids) {
        if (!authorities.has(authorityId)) report.fail(`${prefix}: unknown semantic authority ${authorityId}`);
      }
    }

    const substrates = family.substrates || [];
    if (family.evidence_class === 'database-recomputable') {
      if (!db) report.fail(`${prefix}: database substrate unavailable (${databasePath})`);
      if (!substrates.some((substrate) => substrate.kind === 'evaluation-database')) {
        report.fail(`${prefix}: database-recomputable family lacks an evaluation-database substrate`);
      }
    } else if (family.evidence_class === 'archived-artifact-recomputable') {
      if (substrates.length === 0) report.fail(`${prefix}: artifact-recomputable family has no substrate`);
      for (const substrate of substrates) {
        if (!substrate?.path || !substrateExists(substrate.path)) {
          report.fail(`${prefix}: archived substrate missing: ${substrate?.path || '<missing path>'}`);
        }
      }
    } else if (family.evidence_class === 'historical-only') {
      if (substrates.length > 0)
        report.fail(`${prefix}: historical-only family must not claim a reproducible substrate`);
      if (!family.disclosure || !paper.includes(family.disclosure)) {
        report.fail(`${prefix}: historical-only disclosure missing from canonical paper`);
      }
    }
  }

  const uncovered = resultSections(paper).filter((section) => !coveredSections.has(section));
  if (uncovered.length > 0) report.fail(`Unclassified Paper 2 result sections: ${uncovered.join(', ')}`);
  else report.pass(`All ${coveredSections.size} Paper 2 result sections are evidence-classified`);

  if (report.result().failCount === 0) {
    const counts = Object.fromEntries(
      [...PAPER2_EVIDENCE_CLASSES].map((evidenceClass) => [
        evidenceClass,
        manifest.claim_families.filter((family) => family.evidence_class === evidenceClass).length,
      ]),
    );
    report.pass(
      `Claim families: ${counts['database-recomputable']} database, ${counts['archived-artifact-recomputable']} artifact, ${counts['historical-only']} historical-only`,
    );
  }
  return report.result();
}

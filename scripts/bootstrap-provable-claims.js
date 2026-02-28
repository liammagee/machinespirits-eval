#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function usage() {
  console.log(`Usage:
  node scripts/bootstrap-provable-claims.js [options]

Options:
  --spec <path>         Base spec path (default: config/provable-discourse.yaml)
  --inventory <path>    Inventory path (default: config/provable-claim-inventory.json)
  --out <path>          Generated claims path (default: config/provable-discourse.generated.yaml)
  --help
`);
}

function getArgValue(argv, flag) {
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === flag) return i + 1 < argv.length ? argv[i + 1] : null;
    if (token.startsWith(`${flag}=`)) return token.slice(flag.length + 1);
  }
  return null;
}

function resolvePath(value, fallback) {
  const source = value || fallback;
  return path.isAbsolute(source) ? source : path.join(ROOT, source);
}

function normalizeIdPart(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function shortHash(value) {
  let hash = 5381;
  const text = String(value || '');
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function regexEscape(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeClaimTextForKey(claimText) {
  let text = String(claimText || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase();
  text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\s*([=<>≈])\s*/g, '$1');
  text = text.replace(/[,\\.;:]+$/g, '');
  return text;
}

function parseSourceKey(sourceKey) {
  const raw = String(sourceKey || '');
  const first = raw.indexOf('|');
  if (first < 0) return null;
  const second = raw.indexOf('|', first + 1);
  if (second < 0) return null;
  const kind = raw.slice(0, first);
  const lineNo = Number(raw.slice(first + 1, second));
  const claimText = raw.slice(second + 1);
  return {
    kind,
    line_no: Number.isFinite(lineNo) ? lineNo : null,
    claim_text: claimText,
  };
}

function canonicalSourceKeyFromParts({ kind, line_no, claim_text }) {
  if (!kind || !Number.isFinite(line_no)) return null;
  return `${kind}|${line_no}|${normalizeClaimTextForKey(claim_text)}`;
}

function canonicalSourceFamilyFromParts({ kind, claim_text }) {
  if (!kind) return null;
  return `${kind}|${normalizeClaimTextForKey(claim_text)}`;
}

function loadClaimsFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed;
  if (ext === '.json') parsed = JSON.parse(raw);
  else parsed = YAML.parse(raw);

  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  return Array.isArray(parsed.claims) ? parsed.claims : [];
}

function parseClaimLowerBound(claimText) {
  const numeric = String(claimText || '').match(/\d[\d,]*/)?.[0];
  if (!numeric) return null;
  const value = Number(numeric.replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  const isLowerBound = /\+/.test(String(claimText || ''));
  return { value, isLowerBound };
}

function sectionMajor(section) {
  const raw = String(section || '').trim().toLowerCase();
  if (raw === 'front matter') return 'front';
  const m = raw.match(/^(\d+)/);
  return m ? m[1] : null;
}

function groupEntries(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const normalizedClaimText = normalizeClaimTextForKey(entry.claim_text);
    const key = `${entry.kind}|${normalizedClaimText}|${entry.expected}`;
    if (!groups.has(key)) {
      groups.set(key, {
        kind: entry.kind,
        claim_text: entry.claim_text,
        normalized_claim_text: normalizedClaimText,
        expected: entry.expected,
        source_keys: [],
        sections: [],
        items: [],
      });
    }
    const group = groups.get(key);
    group.source_keys.push(entry.source_key);
    group.sections.push(entry.section);
    group.items.push({
      source_key: entry.source_key,
      line_no: entry.line_no,
      section: entry.section,
      section_major: sectionMajor(entry.section),
      claim_text: entry.claim_text,
      kind: entry.kind,
      expected: entry.expected,
    });
  }
  return [...groups.values()];
}

function splitGroupBySection(group) {
  const bySection = new Map();
  for (const item of group.items || []) {
    const key = item.section || 'unknown';
    if (!bySection.has(key)) {
      bySection.set(key, {
        kind: group.kind,
        claim_text: group.claim_text,
        normalized_claim_text: group.normalized_claim_text,
        expected: group.expected,
        source_keys: [],
        sections: [],
        items: [],
      });
    }
    const sectionGroup = bySection.get(key);
    sectionGroup.source_keys.push(item.source_key);
    sectionGroup.sections.push(item.section);
    sectionGroup.items.push(item);
  }
  return [...bySection.values()];
}

function buildStatementPattern(claimText) {
  const trimmed = String(claimText || '')
    .trim()
    .replace(/[,\\.;:]+$/g, '');
  if (!trimmed) return '.+';
  return `${regexEscape(trimmed)}[\\.,;:]?`;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function buildTemplateIndexes(claims, inventory) {
  const inventoryByCanonicalKey = new Map();
  for (const entry of inventory.entries || []) {
    const canonicalKey = canonicalSourceKeyFromParts(entry);
    if (canonicalKey) inventoryByCanonicalKey.set(canonicalKey, entry);
  }

  const familyTemplates = new Map();
  const familySectionTemplates = new Map();
  for (const claim of claims) {
    if (!claim?.evidence || !claim?.assertion) continue;
    const sourceKeys = Array.isArray(claim.source_keys)
      ? claim.source_keys
      : claim.source_key
        ? [claim.source_key]
        : [];
    if (sourceKeys.length === 0) continue;

    const sectionMajors = new Set();
    for (const sourceKey of sourceKeys) {
      const parsed = parseSourceKey(sourceKey);
      if (!parsed) continue;
      const family = canonicalSourceFamilyFromParts(parsed);
      if (!family) continue;
      if (!familyTemplates.has(family)) {
        familyTemplates.set(family, {
          evidence: cloneJson(claim.evidence),
          assertion: cloneJson(claim.assertion),
          remediation: Array.isArray(claim.remediation) ? [...claim.remediation] : [],
          origin_claim_id: claim.id || null,
        });
      }

      const canonicalKey = canonicalSourceKeyFromParts(parsed);
      const inv = canonicalKey ? inventoryByCanonicalKey.get(canonicalKey) : null;
      const secMajor = sectionMajor(inv?.section);
      if (secMajor) sectionMajors.add(secMajor);
    }

    const parsedFirst = parseSourceKey(sourceKeys[0]);
    const family = parsedFirst ? canonicalSourceFamilyFromParts(parsedFirst) : null;
    if (!family || sectionMajors.size === 0) continue;
    for (const secMajor of sectionMajors) {
      const sectionKey = `${family}|section:${secMajor}`;
      if (!familySectionTemplates.has(sectionKey)) {
        familySectionTemplates.set(sectionKey, {
          evidence: cloneJson(claim.evidence),
          assertion: cloneJson(claim.assertion),
          remediation: Array.isArray(claim.remediation) ? [...claim.remediation] : [],
          origin_claim_id: claim.id || null,
        });
      }
    }
  }

  return { familyTemplates, familySectionTemplates };
}

function buildManifestExpectedIndex(manifest) {
  const index = new Map();
  for (const row of manifest.key_evaluations || []) {
    const value = Number(row?.expected_scored);
    if (!Number.isFinite(value)) continue;
    if (!index.has(value)) index.set(value, []);
    index.get(value).push(row);
  }
  return index;
}

function buildEvidenceAndAssertion(group, manifest, dbScoredTotal, manifestExpectedIndex) {
  const claimInfo = parseClaimLowerBound(group.claim_text);
  const expected = Number(group.expected);
  const claimValue = claimInfo?.value;
  const manifestScored = Number(manifest?.totals?.expected_scored || 0);
  const manifestAttempts = Number(manifest?.totals?.expected_attempts || 0);

  if (Number.isFinite(expected) && expected === manifestScored) {
    return {
      evidence: { type: 'manifest_total', field: 'expected_scored' },
      assertion: { op: 'eq', expected },
    };
  }

  if (Number.isFinite(expected) && expected === manifestAttempts) {
    return {
      evidence: { type: 'manifest_total', field: 'expected_attempts' },
      assertion: { op: 'eq', expected },
    };
  }

  if (
    Number.isFinite(expected) &&
    (expected === dbScoredTotal || (claimInfo?.isLowerBound && dbScoredTotal >= (claimInfo?.value || 0)))
  ) {
    return {
      evidence: {
        type: 'db_count',
        filters: {
          not_null: ['tutor_first_turn_score'],
        },
      },
      assertion: claimInfo?.isLowerBound
        ? { op: 'gte', expected: claimInfo.value }
        : { op: 'eq', expected },
    };
  }

  if (claimInfo?.isLowerBound) {
    return {
      evidence: {
        type: 'db_count',
        filters: {
          not_null: ['tutor_first_turn_score'],
        },
      },
      assertion: { op: 'gte', expected: claimInfo.value },
    };
  }

  if (Number.isFinite(claimValue) && manifestExpectedIndex.has(claimValue)) {
    const rows = manifestExpectedIndex.get(claimValue);
    let selectedRows = rows;
    if (rows.length > 1) {
      const sectionHints = [...new Set(group.sections.filter((section) => /^\d+(\.\d+)*$/.test(String(section))))];
      if (sectionHints.length > 0) {
        const filtered = rows.filter((row) =>
          sectionHints.some((hint) => row.section === hint || String(row.section || '').startsWith(`${hint}.`)),
        );
        if (filtered.length > 0) {
          selectedRows = filtered;
        }
      }
    }

    if (selectedRows.length === 1) {
      const row = selectedRows[0];
      const filters = {
        run_ids: row.run_ids || [],
        not_null: ['tutor_first_turn_score'],
      };
      if (row.primary_judge_pattern) {
        filters.like = { judge_model: row.primary_judge_pattern };
      }
      if (row.profile_filter) {
        filters.like = { ...(filters.like || {}), profile_name: row.profile_filter };
      }

      return {
        evidence: {
          type: 'db_count',
          filters,
        },
        assertion: { op: 'eq', expected: claimValue },
      };
    }
  }

  if (Number.isFinite(claimValue)) {
    const numericSections = [...new Set(group.sections.filter((section) => /^\d+(\.\d+)*$/.test(String(section))))];
    if (numericSections.length === 1) {
      const section = numericSections[0];
      const sectionTotal = (manifest.key_evaluations || [])
        .filter((row) => row.section === section)
        .reduce((sum, row) => sum + Number(row.expected_scored || 0), 0);
      if (sectionTotal === claimValue) {
        return {
          evidence: {
            type: 'manifest_section_total',
            section,
            field: 'expected_scored',
            match: 'exact',
          },
          assertion: { op: 'eq', expected: claimValue },
        };
      }
    }
  }

  return null;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(0);
  }

  const specPath = resolvePath(getArgValue(args, '--spec'), 'config/provable-discourse.yaml');
  const inventoryPath = resolvePath(getArgValue(args, '--inventory'), 'config/provable-claim-inventory.json');
  const outPath = resolvePath(getArgValue(args, '--out'), 'config/provable-discourse.generated.yaml');

  const spec = YAML.parse(fs.readFileSync(specPath, 'utf8')) || {};
  const manifestPath = path.isAbsolute(spec.manifest_path) ? spec.manifest_path : path.join(ROOT, spec.manifest_path);
  const dbPath = path.isAbsolute(spec.db_path) ? spec.db_path : path.join(ROOT, spec.db_path);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

  const db = new Database(dbPath, { readonly: true });
  const dbScoredTotal = Number(
    db.prepare('SELECT COUNT(*) AS value FROM evaluation_results WHERE tutor_first_turn_score IS NOT NULL').get()?.value || 0,
  );
  db.close();

  const mappedCanonicalKeys = new Set();
  const importPaths = Array.isArray(spec.import_claims_from) ? spec.import_claims_from : [];
  const baseClaims = Array.isArray(spec.claims) ? spec.claims : [];
  const importedClaims = [];
  for (const claim of baseClaims) {
    const keys = Array.isArray(claim.source_keys) ? claim.source_keys : claim.source_key ? [claim.source_key] : [];
    for (const key of keys) {
      const parsed = parseSourceKey(key);
      if (!parsed) continue;
      const canonicalKey = canonicalSourceKeyFromParts(parsed);
      if (canonicalKey) mappedCanonicalKeys.add(canonicalKey);
    }
  }
  for (const importPath of importPaths) {
    const resolvedImportPath = path.isAbsolute(importPath) ? importPath : path.join(ROOT, importPath);
    if (path.resolve(resolvedImportPath) === path.resolve(outPath)) {
      continue;
    }
    const claims = loadClaimsFile(resolvedImportPath);
    importedClaims.push(...claims);
    for (const claim of claims) {
      const keys = Array.isArray(claim.source_keys) ? claim.source_keys : claim.source_key ? [claim.source_key] : [];
      for (const key of keys) {
        const parsed = parseSourceKey(key);
        if (!parsed) continue;
        const canonicalKey = canonicalSourceKeyFromParts(parsed);
        if (canonicalKey) mappedCanonicalKeys.add(canonicalKey);
      }
    }
  }

  const templateCandidateClaims = [
    ...baseClaims,
    ...importedClaims.filter((claim) => !String(claim?.id || '').startsWith('manual.')),
  ];
  const { familyTemplates, familySectionTemplates } = buildTemplateIndexes(templateCandidateClaims, inventory);

  const majorCandidates = (inventory.entries || []).filter((entry) => entry.is_major && ['n', 'stat'].includes(entry.kind));
  const exactUnmappedCandidates = majorCandidates.filter((entry) => {
    const canonicalKey = canonicalSourceKeyFromParts(entry);
    if (canonicalKey && mappedCanonicalKeys.has(canonicalKey)) return false;
    return true;
  });
  const grouped = groupEntries(exactUnmappedCandidates);
  const manifestExpectedIndex = buildManifestExpectedIndex(manifest);

  const generatedClaims = [];
  let generatedFromTemplates = 0;
  let generatedFromInference = 0;
  let skipped = 0;
  const generatedIdSet = new Set();

  function pushGeneratedClaim(group, mapping, mode) {
    const claimId = `auto.inventory.${mode}.${normalizeIdPart(group.kind)}.${normalizeIdPart(group.claim_text)}.${normalizeIdPart(group.expected)}.${shortHash(
      [...group.source_keys].sort().join('|'),
    )}`;
    if (generatedIdSet.has(claimId)) return;
    generatedIdSet.add(claimId);
    generatedClaims.push({
      id: claimId,
      description:
        mode === 'template'
          ? `Auto-template mapped inventory claim: ${group.claim_text}`
          : `Auto-inferred inventory claim: ${group.claim_text}`,
      source_keys: [...new Set(group.source_keys)].sort(),
      statement: {
        pattern: buildStatementPattern(group.claim_text),
        flags: 'i',
        min_occurrences: 1,
      },
      evidence: cloneJson(mapping.evidence),
      assertion: cloneJson(mapping.assertion),
      remediation: [
        ...(Array.isArray(mapping.remediation) ? mapping.remediation : []),
        'If this auto-mapped claim fails, replace it with a hand-authored claim using run-scoped DB evidence.',
        'Re-run inventory sync and bootstrap after paper claim edits.',
      ],
    });
  }

  for (const group of grouped) {
    const family = `${group.kind}|${group.normalized_claim_text}`;
    const sectionMajors = [...new Set((group.items || []).map((item) => item.section_major).filter(Boolean))];

    let template = null;
    if (sectionMajors.length === 1) {
      template = familySectionTemplates.get(`${family}|section:${sectionMajors[0]}`) || null;
    }
    if (!template) {
      template = familyTemplates.get(family) || null;
    }

    if (template) {
      pushGeneratedClaim(
        group,
        {
          evidence: template.evidence,
          assertion: template.assertion,
          remediation: template.remediation,
        },
        'template',
      );
      generatedFromTemplates++;
      continue;
    }

    if (group.kind !== 'n') {
      skipped++;
      continue;
    }

    const mapping = buildEvidenceAndAssertion(group, manifest, dbScoredTotal, manifestExpectedIndex);
    if (mapping) {
      pushGeneratedClaim(group, mapping, 'inferred');
      generatedFromInference++;
      continue;
    }

    let matchedSectionInference = false;
    const sectionGroups = splitGroupBySection(group);
    for (const sectionGroup of sectionGroups) {
      const sectionMapping = buildEvidenceAndAssertion(sectionGroup, manifest, dbScoredTotal, manifestExpectedIndex);
      if (!sectionMapping) continue;
      pushGeneratedClaim(sectionGroup, sectionMapping, 'inferred');
      generatedFromInference++;
      matchedSectionInference = true;
    }

    if (!matchedSectionInference) {
      skipped++;
    }
  }

  const output = {
    generated_at: new Date().toISOString(),
    source_spec: path.relative(ROOT, specPath),
    source_inventory: path.relative(ROOT, inventoryPath),
    source_db: path.relative(ROOT, dbPath),
    totals: {
      major_candidates: majorCandidates.length,
      exact_unmapped_candidates: exactUnmappedCandidates.length,
      template_families: familyTemplates.size,
      template_section_families: familySectionTemplates.size,
      generated_claims: generatedClaims.length,
      generated_from_templates: generatedFromTemplates,
      generated_from_inference: generatedFromInference,
      skipped_groups: skipped,
    },
    claims: generatedClaims,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, YAML.stringify(output), 'utf8');

  console.log(
    `Wrote ${path.relative(ROOT, outPath)} :: candidates=${majorCandidates.length} exact_unmapped=${exactUnmappedCandidates.length} generated=${generatedClaims.length} skipped=${skipped}`,
  );
}

main();

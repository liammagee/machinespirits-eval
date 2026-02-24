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

function groupEntries(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = `${entry.kind}|${entry.claim_text}|${entry.expected}`;
    if (!groups.has(key)) {
      groups.set(key, {
        kind: entry.kind,
        claim_text: entry.claim_text,
        expected: entry.expected,
        source_keys: [],
        sections: [],
      });
    }
    groups.get(key).source_keys.push(entry.source_key);
    groups.get(key).sections.push(entry.section);
  }
  return [...groups.values()];
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
          not_null: ['overall_score'],
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
          not_null: ['overall_score'],
        },
      },
      assertion: { op: 'gte', expected: claimInfo.value },
    };
  }

  if (Number.isFinite(claimValue) && manifestExpectedIndex.has(claimValue)) {
    const rows = manifestExpectedIndex.get(claimValue);
    if (rows.length === 1) {
      const row = rows[0];
      const filters = {
        run_ids: row.run_ids || [],
        not_null: ['overall_score'],
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
    db.prepare('SELECT COUNT(*) AS value FROM evaluation_results WHERE overall_score IS NOT NULL').get()?.value || 0,
  );
  db.close();

  const mappedSourceKeys = new Set();
  const importPaths = Array.isArray(spec.import_claims_from) ? spec.import_claims_from : [];
  const baseClaims = Array.isArray(spec.claims) ? spec.claims : [];
  for (const claim of baseClaims) {
    const keys = Array.isArray(claim.source_keys) ? claim.source_keys : claim.source_key ? [claim.source_key] : [];
    for (const key of keys) mappedSourceKeys.add(key);
  }
  for (const importPath of importPaths) {
    const resolvedImportPath = path.isAbsolute(importPath) ? importPath : path.join(ROOT, importPath);
    if (path.resolve(resolvedImportPath) === path.resolve(outPath)) {
      continue;
    }
    const claims = loadClaimsFile(resolvedImportPath);
    for (const claim of claims) {
      const keys = Array.isArray(claim.source_keys) ? claim.source_keys : claim.source_key ? [claim.source_key] : [];
      for (const key of keys) mappedSourceKeys.add(key);
    }
  }

  const majorDeterministic = (inventory.entries || []).filter((entry) => entry.is_major && entry.kind === 'n');
  const unmappedDeterministic = majorDeterministic.filter((entry) => !mappedSourceKeys.has(entry.source_key));
  const grouped = groupEntries(unmappedDeterministic);
  const manifestExpectedIndex = buildManifestExpectedIndex(manifest);

  const generatedClaims = [];
  let skipped = 0;
  for (const group of grouped) {
    const mapping = buildEvidenceAndAssertion(group, manifest, dbScoredTotal, manifestExpectedIndex);
    if (!mapping) {
      skipped++;
      continue;
    }

    const claimId = `auto.inventory.${normalizeIdPart(group.kind)}.${normalizeIdPart(group.claim_text)}.${normalizeIdPart(group.expected)}.${shortHash(
      [...group.source_keys].sort().join('|'),
    )}`;
    generatedClaims.push({
      id: claimId,
      description: `Auto-mapped deterministic inventory claim: ${group.claim_text}`,
      source_keys: group.source_keys.sort(),
      statement: {
        pattern: regexEscape(group.claim_text),
        flags: 'i',
        min_occurrences: 1,
      },
      evidence: mapping.evidence,
      assertion: mapping.assertion,
      remediation: [
        'If this auto-mapped claim fails, replace it with a hand-authored claim using run-scoped DB evidence.',
        'Re-run inventory sync and bootstrap after paper claim edits.',
      ],
    });
  }

  const output = {
    generated_at: new Date().toISOString(),
    source_spec: path.relative(ROOT, specPath),
    source_inventory: path.relative(ROOT, inventoryPath),
    source_db: path.relative(ROOT, dbPath),
    totals: {
      major_deterministic: majorDeterministic.length,
      unmapped_deterministic: unmappedDeterministic.length,
      generated_claims: generatedClaims.length,
      skipped_groups: skipped,
    },
    claims: generatedClaims,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, YAML.stringify(output), 'utf8');

  console.log(
    `Wrote ${path.relative(ROOT, outPath)} :: deterministic=${majorDeterministic.length} generated=${generatedClaims.length} skipped=${skipped}`,
  );
}

main();

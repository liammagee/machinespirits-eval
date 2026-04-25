#!/usr/bin/env node
/**
 * validate-pilot-items — sanity-check the pilot item bank
 *
 * Verifies `config/pilot/fractions-items.yaml` (or any items YAML at the
 * path passed via --path / PILOT_ITEMS_PATH) for:
 *   - both `forms.A` and `forms.B` exist
 *   - same item count per form (counterbalancing requires this)
 *   - every item has: id, type, stem, choices, correct
 *   - every item id is unique within its form
 *   - choice values are unique within a single item
 *   - the `correct` field matches one of the choice values
 *   - id naming is consistent within a form (warning, not error)
 *   - reasonable bounds: ≥3 choices per item, stem ≥10 chars
 *
 * Exits non-zero on any error so it can drop into CI without ceremony.
 *
 * Usage:
 *   node scripts/validate-pilot-items.js
 *   node scripts/validate-pilot-items.js --path some/other/items.yaml
 *   node scripts/validate-pilot-items.js --quiet              # only print on errors
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = {
    pathArg: null,
    quiet: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--path') out.pathArg = argv[++i];
    else if (a === '--quiet') out.quiet = true;
    else if (a === '-h' || a === '--help') {
      console.log(fs.readFileSync(__filename, 'utf-8').slice(0, 1000));
      process.exit(0);
    }
  }
  return out;
}

function validateItem(item, formLetter, errors, warnings) {
  const id = item?.id;
  const where = `form ${formLetter}, item ${id || '<no id>'}`;

  if (!id || typeof id !== 'string') {
    errors.push(`${where}: missing or non-string id`);
    return;
  }
  if (!item.type || typeof item.type !== 'string') {
    errors.push(`${where}: missing or non-string type`);
  } else if (!['procedural', 'conceptual', 'transfer'].includes(item.type)) {
    warnings.push(`${where}: type "${item.type}" is not one of [procedural, conceptual, transfer]`);
  }
  if (!item.stem || typeof item.stem !== 'string') {
    errors.push(`${where}: missing or non-string stem`);
  } else if (item.stem.length < 10) {
    warnings.push(`${where}: stem is suspiciously short (${item.stem.length} chars)`);
  }

  if (!Array.isArray(item.choices)) {
    errors.push(`${where}: choices must be a list`);
    return;
  }
  if (item.choices.length < 3) {
    warnings.push(`${where}: only ${item.choices.length} choices (≥3 recommended)`);
  }

  const seenChoiceValues = new Set();
  for (let i = 0; i < item.choices.length; i++) {
    const c = item.choices[i];
    const cwhere = `${where}, choice ${i}`;
    if (!c || typeof c !== 'object') {
      errors.push(`${cwhere}: choice must be an object with value + label`);
      continue;
    }
    if (c.value === undefined || c.value === null) {
      errors.push(`${cwhere}: missing value`);
    } else if (seenChoiceValues.has(c.value)) {
      errors.push(`${cwhere}: duplicate choice value "${c.value}"`);
    } else {
      seenChoiceValues.add(c.value);
    }
    if (!c.label || typeof c.label !== 'string') {
      errors.push(`${cwhere}: missing or non-string label`);
    }
  }

  if (item.correct === undefined || item.correct === null) {
    errors.push(`${where}: missing correct field`);
  } else if (!seenChoiceValues.has(item.correct)) {
    errors.push(
      `${where}: correct="${item.correct}" not in choice values [${[...seenChoiceValues].join(', ')}]`,
    );
  }
}

function validateForm(form, letter, errors, warnings) {
  if (!Array.isArray(form)) {
    errors.push(`forms.${letter}: must be a list of items`);
    return;
  }
  if (form.length === 0) {
    errors.push(`forms.${letter}: empty (no items)`);
    return;
  }

  const seenIds = new Set();
  const idPrefixes = new Set();
  for (const item of form) {
    validateItem(item, letter, errors, warnings);
    if (item?.id) {
      if (seenIds.has(item.id)) {
        errors.push(`forms.${letter}: duplicate item id "${item.id}"`);
      } else {
        seenIds.add(item.id);
      }
      const prefix = item.id.match(/^([a-zA-Z]+-[a-zA-Z]+-)/)?.[1] || null;
      if (prefix) idPrefixes.add(prefix);
    }
  }
  if (idPrefixes.size > 1) {
    warnings.push(
      `forms.${letter}: mixed id prefixes [${[...idPrefixes].join(', ')}] — naming should be consistent within a form`,
    );
  }

  // Type distribution sanity (info only)
  const typeCount = {};
  for (const item of form) {
    if (item?.type) typeCount[item.type] = (typeCount[item.type] || 0) + 1;
  }
  return { count: form.length, types: typeCount };
}

function main() {
  const args = parseArgs(process.argv);
  const itemsPath = args.pathArg
    || process.env.PILOT_ITEMS_PATH
    || path.join(ROOT_DIR, 'config', 'pilot', 'fractions-items.yaml');

  if (!fs.existsSync(itemsPath)) {
    console.error(`[validate-pilot-items] file not found: ${itemsPath}`);
    process.exit(2);
  }

  const errors = [];
  const warnings = [];
  let parsed;
  try {
    parsed = yaml.parse(fs.readFileSync(itemsPath, 'utf-8'));
  } catch (err) {
    console.error(`[validate-pilot-items] YAML parse error: ${err.message}`);
    process.exit(2);
  }

  if (!parsed || typeof parsed !== 'object') {
    errors.push('top-level value is not an object');
  } else if (!parsed.forms || typeof parsed.forms !== 'object') {
    errors.push('missing top-level forms map');
  }

  const formStats = {};
  if (errors.length === 0) {
    for (const letter of ['A', 'B']) {
      if (!parsed.forms[letter]) {
        errors.push(`forms.${letter}: missing`);
      } else {
        formStats[letter] = validateForm(parsed.forms[letter], letter, errors, warnings);
      }
    }

    if (formStats.A && formStats.B && formStats.A.count !== formStats.B.count) {
      errors.push(
        `form A has ${formStats.A.count} items but form B has ${formStats.B.count} — counterbalancing requires equal counts`,
      );
    }
  }

  // Output
  if (!args.quiet || errors.length > 0 || warnings.length > 0) {
    console.log(`\nPilot item bank: ${path.relative(ROOT_DIR, itemsPath)}`);
    for (const letter of ['A', 'B']) {
      const stats = formStats[letter];
      if (stats) {
        const types = Object.entries(stats.types).map(([t, n]) => `${t}=${n}`).join(', ');
        console.log(`  Form ${letter}: ${stats.count} items (${types})`);
      } else {
        console.log(`  Form ${letter}: missing`);
      }
    }
  }

  if (warnings.length > 0) {
    console.log(`\n  ⚠  ${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`     - ${w}`);
  }

  if (errors.length > 0) {
    console.error(`\n  ✗  ${errors.length} error(s):`);
    for (const e of errors) console.error(`     - ${e}`);
    console.error('');
    process.exit(1);
  }

  if (!args.quiet) console.log('\n  ✓  validation passed\n');
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

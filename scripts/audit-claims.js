#!/usr/bin/env node
// Final claim audit report — reads provable discourse JSON output
import fs from 'fs';

const data = JSON.parse(fs.readFileSync(process.argv[2] || '/tmp/pd-final.json', 'utf8'));
console.log('=== PROVABLE DISCOURSE FINAL AUDIT ===');
console.log('Summary:', JSON.stringify(data.summary));
console.log();

// Symmetry rules
if (data.symmetry) {
  const symNonPass = data.symmetry.filter((s) => s.status !== 'pass' && s.status !== 'skip');
  console.log(`Symmetry rules: ${data.symmetry.length} total, ${symNonPass.length} non-pass`);
  for (const s of symNonPass) console.log(`  ${s.id}: ${s.status} — ${s.message || ''}`);
  if (symNonPass.length === 0) console.log('  All pass/skip.');
}

// Coverage
if (data.coverage) {
  for (const c of data.coverage) {
    console.log(`Coverage: ${c.id} → ${c.status}`);
    if (c.status !== 'pass' && c.details) {
      console.log(`  Details: ${JSON.stringify(c.details)}`);
    }
  }
}

// Dependency graph
if (data.dependency_graph) {
  console.log(
    `\nDependency graph: ${data.dependency_graph.total_edges} edges, max depth ${data.dependency_graph.max_depth}`,
  );
}

// Fails
const fails = (data.claims || []).filter((c) => c.status === 'fail');
console.log(`\n--- FAILS: ${fails.length} ---`);
for (const f of fails) {
  console.log(`  ${f.id}`);
  console.log(`    Actual: ${f.actual_value}, Assertion: ${JSON.stringify(f.assertion)}`);
  if (f.messages) console.log(`    Messages: ${f.messages.join('; ')}`);
  if (f.remediation) console.log(`    Fix: ${f.remediation[0]}`);
}

// Warns
const warns = (data.claims || []).filter((c) => c.status === 'warn');
console.log(`\n--- WARNS: ${warns.length} ---`);
for (const w of warns) {
  const msg = (w.messages || []).join('; ');
  console.log(`  ${w.id}: ${msg}`);
}

// Pass count
const passes = (data.claims || []).filter((c) => c.status === 'pass');
console.log(`\n--- PASSES: ${passes.length} ---`);

// Skipped
const skipped = data.summary?.skipped_by_epoch || 0;
console.log(`\n--- SKIPPED (epoch filter): ${skipped} ---`);

console.log('\n=== AUDIT COMPLETE ===');

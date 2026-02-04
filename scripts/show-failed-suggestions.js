#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const dir = 'logs/tutor-dialogues';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

// Get recent files
const recentFiles = files.filter(f => {
  const stat = fs.statSync(path.join(dir, f));
  return new Date(stat.mtime) >= new Date('2026-02-03');
});

console.log(`Scanning ${recentFiles.length} dialogue files...\n`);

// Find recognition profile dialogues
let recognitionExamples = [];

for (const f of recentFiles) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (d.profileName !== 'recognition') continue;

    const suggestions = d.suggestions || [];
    if (suggestions.length === 0) continue;

    const first = suggestions[0];
    const text = ((first.title || '') + ' ' + (first.message || '')).toLowerCase();
    const hasReview = text.includes('review');

    // Store suggestion content
    recognitionExamples.push({
      file: f,
      title: first.title || '',
      message: first.message || '',
      hasReview,
      text
    });
  } catch (e) {}
}

// Show examples without "review"
const failingExamples = recognitionExamples.filter(e => !e.hasReview);
const passingExamples = recognitionExamples.filter(e => e.hasReview);

console.log(`Recognition profile: ${recognitionExamples.length} total dialogues`);
console.log(`  With "review": ${passingExamples.length}`);
console.log(`  Without "review": ${failingExamples.length}\n`);

console.log('=== FAILING EXAMPLES (no "review" in text) ===\n');
for (const ex of failingExamples.slice(0, 6)) {
  console.log(`File: ${ex.file}`);
  console.log(`Title: "${ex.title}"`);
  console.log(`Message: ${ex.message.substring(0, 300)}...`);
  console.log('---\n');
}

console.log('=== PASSING EXAMPLES (has "review") ===\n');
for (const ex of passingExamples.slice(0, 3)) {
  console.log(`File: ${ex.file}`);
  console.log(`Title: "${ex.title}"`);
  console.log(`Message: ${ex.message.substring(0, 200)}...`);
  console.log('---\n');
}

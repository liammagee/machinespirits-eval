#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const dir = 'logs/tutor-dialogues';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

// Get recent files from Feb 3
const recentFiles = files.filter(f => {
  const stat = fs.statSync(path.join(dir, f));
  const date = new Date(stat.mtime);
  return date >= new Date('2026-02-03');
});

console.log(`Analyzing ${recentFiles.length} dialogue files from Feb 3+\n`);

// Collect examples by profile and scenario
const examples = { budget: [], recognition: [] };

for (const f of recentFiles) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const profile = d.profileName;
    const scenario = d.scenario?.scenarioId || d.scenarioId || 'unknown';

    if (profile !== 'budget' && profile !== 'recognition') continue;

    // Only look at struggling_learner and concept_confusion
    if (!scenario.includes('struggling') && !scenario.includes('confusion')) continue;

    const suggestions = d.suggestions || [];
    const firstSuggestion = suggestions[0];
    if (!firstSuggestion) continue;

    const title = firstSuggestion.title || '';
    const message = firstSuggestion.message || '';
    const fullText = (title + ' ' + message).toLowerCase();

    const hasReview = fullText.includes('review');
    const hasForbidden = ['next lecture', 'move on to', 'continue with'].some(fb => fullText.includes(fb));

    examples[profile].push({
      file: f,
      scenario,
      title,
      messagePreview: message.substring(0, 150),
      hasReview,
      hasForbidden,
      passed: hasReview && !hasForbidden
    });
  } catch (e) {}
}

// Show failing examples for each profile
for (const profile of ['budget', 'recognition']) {
  const data = examples[profile];
  const passing = data.filter(x => x.passed);
  const failing = data.filter(x => !x.passed);

  console.log(`=== ${profile.toUpperCase()} ===`);
  console.log(`Total: ${data.length}, Passing: ${passing.length}, Failing: ${failing.length}`);
  console.log(`Pass rate: ${(passing.length / data.length * 100).toFixed(1)}%\n`);

  console.log('FAILING examples (missing review or has forbidden):');
  for (const ex of failing.slice(0, 5)) {
    console.log(`  Scenario: ${ex.scenario}`);
    console.log(`  Title: "${ex.title}"`);
    console.log(`  Has review: ${ex.hasReview}, Has forbidden: ${ex.hasForbidden}`);
    console.log(`  Preview: ${ex.messagePreview}...`);
    console.log(`  File: ${ex.file}\n`);
  }

  console.log('PASSING examples:');
  for (const ex of passing.slice(0, 3)) {
    console.log(`  Scenario: ${ex.scenario}`);
    console.log(`  Title: "${ex.title}"`);
    console.log('');
  }
  console.log('');
}

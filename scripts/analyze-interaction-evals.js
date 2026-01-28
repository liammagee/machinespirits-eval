#!/usr/bin/env node

/**
 * Analyze Interaction Evaluation Results
 *
 * Extracts and analyzes judge evaluation scores from interaction eval logs.
 * Used for the updated research paper on dyadic learner-tutor recognition.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '..', 'logs', 'interaction-evals');

// Tutor dimensions
const TUTOR_DIMS = ['mutual_recognition', 'dialectical_responsiveness', 'transformative_potential', 'tone'];

// Learner dimensions
const LEARNER_DIMS = ['authenticity', 'responsiveness', 'development'];

/**
 * Load all interaction eval JSON files
 */
function loadEvals() {
  const files = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.json'));
  const evals = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(LOGS_DIR, file), 'utf8');
      const data = JSON.parse(content);
      data._filename = file;
      evals.push(data);
    } catch (e) {
      console.warn(`Failed to load ${file}: ${e.message}`);
    }
  }

  return evals;
}

/**
 * Extract tutor dimension scores from judge evaluation
 */
function extractTutorScores(evalData) {
  const judgeEval = evalData.judgeEvaluation;
  if (!judgeEval?.tutor_evaluation) return null;

  const tutor = judgeEval.tutor_evaluation;
  const scores = {};
  let total = 0;
  let count = 0;

  for (const dim of TUTOR_DIMS) {
    if (tutor[dim]?.score != null) {
      scores[dim] = tutor[dim].score;
      total += tutor[dim].score;
      count++;
    }
  }

  if (count > 0) {
    scores.overall = total / count;
  }

  return count > 0 ? scores : null;
}

/**
 * Extract learner dimension scores from judge evaluation
 */
function extractLearnerScores(evalData) {
  const judgeEval = evalData.judgeEvaluation;
  if (!judgeEval?.learner_evaluation) return null;

  const learner = judgeEval.learner_evaluation;
  const scores = {};
  let total = 0;
  let count = 0;

  for (const dim of LEARNER_DIMS) {
    if (learner[dim]?.score != null) {
      scores[dim] = learner[dim].score;
      total += learner[dim].score;
      count++;
    }
  }

  if (count > 0) {
    scores.overall = total / count;
  }

  return count > 0 ? scores : null;
}

/**
 * Extract scenario metadata
 */
function extractMetadata(evalData) {
  return {
    scenarioId: evalData.scenarioId || evalData.evalId?.split('-')[1] || 'unknown',
    learnerId: evalData.learnerId,
    tutorProfile: evalData.tutorProfile || 'default',
    learnerArchitecture: evalData.learnerArchitecture || 'unknown',
    personaId: evalData.personaId,
    turnCount: evalData.metrics?.turnCount || 0,
    totalTokens: evalData.metrics?.totalTokens || 0,
    duration: evalData.metrics?.durationMs || 0,
    outcomes: evalData.summary?.outcomes || [],
    skipJudge: evalData.skipJudge || false,
  };
}

/**
 * Group evals by tutor profile
 */
function groupByTutorProfile(evals) {
  const groups = {};

  for (const e of evals) {
    const meta = extractMetadata(e);
    const profile = meta.tutorProfile;

    if (!groups[profile]) {
      groups[profile] = [];
    }
    groups[profile].push(e);
  }

  return groups;
}

/**
 * Group evals by learner architecture
 */
function groupByArchitecture(evals) {
  const groups = {};

  for (const e of evals) {
    const meta = extractMetadata(e);
    const arch = meta.learnerArchitecture;

    if (!groups[arch]) {
      groups[arch] = [];
    }
    groups[arch].push(e);
  }

  return groups;
}

/**
 * Calculate average scores for a group of evals
 */
function calculateAverages(evals, extractFn) {
  const allScores = {};
  const counts = {};

  for (const e of evals) {
    const scores = extractFn(e);
    if (!scores) continue;

    for (const [dim, score] of Object.entries(scores)) {
      if (!allScores[dim]) {
        allScores[dim] = 0;
        counts[dim] = 0;
      }
      allScores[dim] += score;
      counts[dim]++;
    }
  }

  const averages = {};
  for (const dim of Object.keys(allScores)) {
    averages[dim] = counts[dim] > 0 ? (allScores[dim] / counts[dim]).toFixed(2) : null;
  }
  averages._count = Math.max(...Object.values(counts), 0);

  return averages;
}

/**
 * Generate summary report
 */
function generateReport(evals) {
  console.log('\n' + '═'.repeat(70));
  console.log('INTERACTION EVALUATION ANALYSIS');
  console.log('═'.repeat(70));

  // Filter to only evals with judge evaluation
  const judgedEvals = evals.filter(e => e.judgeEvaluation && !e.skipJudge);
  console.log(`\nTotal evals: ${evals.length}`);
  console.log(`With judge evaluation: ${judgedEvals.length}`);

  // Battery evals
  const batteryEvals = judgedEvals.filter(e => e._filename.includes('battery'));
  console.log(`Battery evals: ${batteryEvals.length}`);

  // By Tutor Profile
  console.log('\n' + '─'.repeat(70));
  console.log('TUTOR PROFILE COMPARISON');
  console.log('─'.repeat(70));

  const byProfile = groupByTutorProfile(batteryEvals);
  const profileResults = {};

  for (const [profile, profileEvals] of Object.entries(byProfile)) {
    const tutorAvg = calculateAverages(profileEvals, extractTutorScores);
    const learnerAvg = calculateAverages(profileEvals, extractLearnerScores);

    profileResults[profile] = { tutor: tutorAvg, learner: learnerAvg };

    console.log(`\n${profile.toUpperCase()} (n=${tutorAvg._count || 0}):`);
    console.log('  Tutor dimensions:');
    for (const dim of TUTOR_DIMS) {
      console.log(`    ${dim}: ${tutorAvg[dim] || 'N/A'}`);
    }
    console.log(`    OVERALL: ${tutorAvg.overall || 'N/A'}`);

    console.log('  Learner dimensions:');
    for (const dim of LEARNER_DIMS) {
      console.log(`    ${dim}: ${learnerAvg[dim] || 'N/A'}`);
    }
    console.log(`    OVERALL: ${learnerAvg.overall || 'N/A'}`);
  }

  // By Learner Architecture
  console.log('\n' + '─'.repeat(70));
  console.log('LEARNER ARCHITECTURE COMPARISON');
  console.log('─'.repeat(70));

  const byArch = groupByArchitecture(batteryEvals);
  const archResults = {};

  for (const [arch, archEvals] of Object.entries(byArch)) {
    const tutorAvg = calculateAverages(archEvals, extractTutorScores);
    const learnerAvg = calculateAverages(archEvals, extractLearnerScores);

    archResults[arch] = { tutor: tutorAvg, learner: learnerAvg };

    console.log(`\n${arch.toUpperCase()} (n=${tutorAvg._count || 0}):`);
    console.log('  Tutor dimensions:');
    for (const dim of TUTOR_DIMS) {
      console.log(`    ${dim}: ${tutorAvg[dim] || 'N/A'}`);
    }
    console.log(`    OVERALL: ${tutorAvg.overall || 'N/A'}`);

    console.log('  Learner dimensions:');
    for (const dim of LEARNER_DIMS) {
      console.log(`    ${dim}: ${learnerAvg[dim] || 'N/A'}`);
    }
    console.log(`    OVERALL: ${learnerAvg.overall || 'N/A'}`);
  }

  // Cross-tabulation: Profile × Architecture
  console.log('\n' + '─'.repeat(70));
  console.log('CROSS-TABULATION: TUTOR PROFILE × LEARNER ARCHITECTURE');
  console.log('─'.repeat(70));

  const crossTab = {};
  for (const e of batteryEvals) {
    const meta = extractMetadata(e);
    const key = `${meta.tutorProfile}|${meta.learnerArchitecture}`;

    if (!crossTab[key]) {
      crossTab[key] = [];
    }
    crossTab[key].push(e);
  }

  // Create table
  const profiles = [...new Set(batteryEvals.map(e => extractMetadata(e).tutorProfile))].sort();
  const architectures = [...new Set(batteryEvals.map(e => extractMetadata(e).learnerArchitecture))].sort();

  console.log('\nTutor Overall Score by Profile × Architecture:');
  console.log('─'.repeat(70));

  // Header row
  let header = 'Profile'.padEnd(20);
  for (const arch of architectures) {
    header += arch.slice(0, 12).padStart(14);
  }
  console.log(header);
  console.log('─'.repeat(70));

  // Data rows
  for (const profile of profiles) {
    let row = profile.padEnd(20);
    for (const arch of architectures) {
      const key = `${profile}|${arch}`;
      const cellEvals = crossTab[key] || [];
      const avg = calculateAverages(cellEvals, extractTutorScores);
      row += (avg.overall || '-').toString().padStart(14);
    }
    console.log(row);
  }

  // Summary statistics
  console.log('\n' + '─'.repeat(70));
  console.log('SUMMARY STATISTICS');
  console.log('─'.repeat(70));

  // Overall averages
  const overallTutor = calculateAverages(batteryEvals, extractTutorScores);
  const overallLearner = calculateAverages(batteryEvals, extractLearnerScores);

  console.log('\nOverall Tutor Dimensions:');
  for (const dim of TUTOR_DIMS) {
    console.log(`  ${dim}: ${overallTutor[dim] || 'N/A'}`);
  }
  console.log(`  OVERALL: ${overallTutor.overall || 'N/A'}`);

  console.log('\nOverall Learner Dimensions:');
  for (const dim of LEARNER_DIMS) {
    console.log(`  ${dim}: ${overallLearner[dim] || 'N/A'}`);
  }
  console.log(`  OVERALL: ${overallLearner.overall || 'N/A'}`);

  // Best/worst by profile
  if (Object.keys(profileResults).length > 0) {
    const sortedProfiles = Object.entries(profileResults)
      .filter(([_, r]) => r.tutor.overall)
      .sort((a, b) => parseFloat(b[1].tutor.overall) - parseFloat(a[1].tutor.overall));

    if (sortedProfiles.length > 0) {
      console.log(`\nBest tutor profile: ${sortedProfiles[0][0]} (${sortedProfiles[0][1].tutor.overall})`);
      console.log(`Worst tutor profile: ${sortedProfiles[sortedProfiles.length-1][0]} (${sortedProfiles[sortedProfiles.length-1][1].tutor.overall})`);
    }
  }

  // Best/worst by architecture
  if (Object.keys(archResults).length > 0) {
    const sortedArchs = Object.entries(archResults)
      .filter(([_, r]) => r.learner.overall)
      .sort((a, b) => parseFloat(b[1].learner.overall) - parseFloat(a[1].learner.overall));

    if (sortedArchs.length > 0) {
      console.log(`\nBest learner architecture: ${sortedArchs[0][0]} (${sortedArchs[0][1].learner.overall})`);
      console.log(`Worst learner architecture: ${sortedArchs[sortedArchs.length-1][0]} (${sortedArchs[sortedArchs.length-1][1].learner.overall})`);
    }
  }

  // Output JSON for paper
  const jsonOutput = {
    generated: new Date().toISOString(),
    totalEvals: evals.length,
    judgedEvals: judgedEvals.length,
    batteryEvals: batteryEvals.length,
    byProfile: profileResults,
    byArchitecture: archResults,
    overallTutor,
    overallLearner,
  };

  const outputPath = path.join(__dirname, '..', 'docs', 'analysis-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`\nJSON output saved to: ${outputPath}`);

  return jsonOutput;
}

// Main
const evals = loadEvals();
generateReport(evals);

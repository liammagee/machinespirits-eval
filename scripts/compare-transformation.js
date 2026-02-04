#!/usr/bin/env node
/**
 * Compare transformation metrics between base and recognition profiles
 */
import fs from 'fs';
import path from 'path';

const logsDir = './logs/tutor-dialogues/';
const files = fs.readdirSync(logsDir)
  .filter(f => f.endsWith('.json'))
  .sort()
  .reverse()
  .slice(0, 20);

const baseProfiles = [];
const recogProfiles = [];

files.forEach(f => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(logsDir, f)));
    if (!data.transformationAnalysis || !data.isMultiTurn) return;

    const ta = data.transformationAnalysis;
    const tp = ta.turnProgression || {};
    const bm = ta.dialogueTraceReport?.bilateralMetrics || {};
    const sm = ta.dialogueTraceReport?.superegoMetrics || {};

    const entry = {
      file: f,
      profile: data.profileName,
      tutorAdaptIdx: tp.adaptationIndex,
      learnerGrowthIdx: tp.learnerGrowthIndex,
      bilateralIdx: tp.bilateralTransformationIndex,
      tutorSignals: bm.tutorTransformationCount,
      learnerSignals: bm.learnerTransformationCount,
      balance: bm.bilateralBalance,
      quality: ta.dialogueTraceReport?.overallAssessment?.transformationQuality,
      superegoIncorp: sm?.incorporationRate,
      isMutual: bm.isMutualTransformation,
    };

    if (data.profileName === 'recognition' || (data.profileName && data.profileName.includes('recog'))) {
      recogProfiles.push(entry);
    } else {
      baseProfiles.push(entry);
    }
  } catch (e) {
    // Skip invalid files
  }
});

function avg(arr, key) {
  const vals = arr.map(a => a[key]).filter(v => v !== undefined && v !== null);
  return vals.length > 0 ? (vals.reduce((a,b)=>a+b,0)/vals.length) : null;
}

function fmt(v) {
  return v !== null && v !== undefined ? v.toFixed(3) : 'N/A';
}

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║       BILATERAL TRANSFORMATION METRICS COMPARISON           ║');
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log('');

console.log('=== BASE PROFILES (budget/single) ===');
console.log('Sample count:', baseProfiles.length);
if (baseProfiles.length > 0) {
  console.log('');
  console.log('  Tutor adaptation index:     ', fmt(avg(baseProfiles, 'tutorAdaptIdx')));
  console.log('  Learner growth index:       ', fmt(avg(baseProfiles, 'learnerGrowthIdx')));
  console.log('  Bilateral transformation:   ', fmt(avg(baseProfiles, 'bilateralIdx')));
  console.log('  Avg tutor signals:          ', fmt(avg(baseProfiles, 'tutorSignals')));
  console.log('  Avg learner signals:        ', fmt(avg(baseProfiles, 'learnerSignals')));
  console.log('  Avg transformation quality: ', fmt(avg(baseProfiles, 'quality')));
  console.log('  Mutual transformation rate: ',
    (baseProfiles.filter(p => p.isMutual).length / baseProfiles.length * 100).toFixed(0) + '%');
}

console.log('');
console.log('=== RECOGNITION PROFILES (ego-superego) ===');
console.log('Sample count:', recogProfiles.length);
if (recogProfiles.length > 0) {
  console.log('');
  console.log('  Tutor adaptation index:     ', fmt(avg(recogProfiles, 'tutorAdaptIdx')));
  console.log('  Learner growth index:       ', fmt(avg(recogProfiles, 'learnerGrowthIdx')));
  console.log('  Bilateral transformation:   ', fmt(avg(recogProfiles, 'bilateralIdx')));
  console.log('  Avg tutor signals:          ', fmt(avg(recogProfiles, 'tutorSignals')));
  console.log('  Avg learner signals:        ', fmt(avg(recogProfiles, 'learnerSignals')));
  console.log('  Avg transformation quality: ', fmt(avg(recogProfiles, 'quality')));
  console.log('  Superego incorporation:     ', fmt(avg(recogProfiles, 'superegoIncorp')));
  console.log('  Mutual transformation rate: ',
    (recogProfiles.filter(p => p.isMutual).length / recogProfiles.length * 100).toFixed(0) + '%');
}

console.log('');
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log('║                        COMPARISON                           ║');
console.log('╠══════════════════════════════════════════════════════════════╣');

if (baseProfiles.length > 0 && recogProfiles.length > 0) {
  const baseTutor = avg(baseProfiles, 'tutorAdaptIdx');
  const recogTutor = avg(recogProfiles, 'tutorAdaptIdx');
  const baseQuality = avg(baseProfiles, 'quality');
  const recogQuality = avg(recogProfiles, 'quality');

  console.log('');
  console.log('  Tutor adaptation delta:     ',
    baseTutor && recogTutor ? ((recogTutor - baseTutor) * 100).toFixed(1) + '% points' : 'N/A');
  console.log('  Quality delta:              ',
    baseQuality !== null && recogQuality !== null ?
      ((recogQuality - baseQuality)).toFixed(1) + ' points' : 'N/A');
}

console.log('');
console.log('╚══════════════════════════════════════════════════════════════╝');

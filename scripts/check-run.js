import * as store from '../services/evaluationStore.js';
const runId = process.argv[2] || 'eval-2026-02-03-c8d32121';
const results = store.getResults(runId);
const failed = results.filter(r => r.success === false || r.errorMessage);
const succeeded = results.filter(r => r.success === true && !r.errorMessage);
console.log('Total results:', results.length);
console.log('Succeeded:', succeeded.length);
console.log('Failed:', failed.length);
const errorCounts = {};
for (const r of failed) {
  const msg = r.errorMessage || 'no error message';
  errorCounts[msg] = (errorCounts[msg] || 0) + 1;
}
console.log('\nFailure breakdown:');
for (const [msg, count] of Object.entries(errorCounts).sort((a,b) => b[1] - a[1])) {
  console.log('  ' + count + 'x: ' + msg.substring(0, 100));
}

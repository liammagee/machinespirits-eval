import fs from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

import { admitPaidStudyLaunch } from '../../services/paidStudyLaunchContract.js';

const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

while (!fs.existsSync(config.startFile)) await delay(5);

try {
  const admission = admitPaidStudyLaunch(config.admission);
  admission.reserveModelAttempts(config.reserveCount, { unit: config.unit });
  fs.appendFileSync(config.providerLog, `${config.unit}\n`);
  await delay(config.holdMilliseconds || 0);
  admission.close(config.closeEvent);
  fs.writeFileSync(config.resultFile, `${JSON.stringify({ status: 'admitted' })}\n`);
} catch (error) {
  fs.writeFileSync(config.resultFile, `${JSON.stringify({ status: 'rejected', error: error.message })}\n`);
}

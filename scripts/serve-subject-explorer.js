/**
 * Standalone server for the (decoupled) Subject Explorer surface.
 *   node scripts/serve-subject-explorer.js [port]
 * Mounts ONLY the subject-explorer routes — no eval DB, no poetics stack — so
 * the surface can be developed and verified in isolation. The same
 * mountSubjectExplorer(app) call also drops it into the main web/electron app.
 */

import express from 'express';
import { mountSubjectExplorer } from '../services/subjectExplorer.js';

const port = Number(process.argv[2] || process.env.PORT || 4505);
const app = express();
mountSubjectExplorer(app);
app.get('/', (_req, res) => res.redirect('/subject'));
app.listen(port, () => console.log(`[subject-explorer] http://localhost:${port}/subject`));

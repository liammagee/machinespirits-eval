import { createPoeticsBrowserApp } from './browse-poetics-scripts.js';
import { shutdownApplication } from '../services/applicationShutdown.js';

const HOST = '127.0.0.1';
const app = createPoeticsBrowserApp({ dbPath: process.env.EVAL_DB_PATH || null, host: HOST });
const server = app.listen(0, HOST, () => {
  const port = server.address().port;
  process.send?.({ type: 'listening', baseUrl: `http://${HOST}:${port}` });
});

server.on('error', (error) => {
  process.send?.({ type: 'fatal', error: error?.stack || String(error) });
  process.exitCode = 1;
});

let closing = null;
async function close(reason) {
  if (closing) return closing;
  closing = shutdownApplication({ app, server, reason, timeoutMs: 5_000 }).then(
    () => {
      process.send?.({ type: 'shutdown-complete' });
      process.exit(0);
    },
    (error) => {
      process.send?.({ type: 'fatal', error: error?.stack || String(error) });
      process.exit(1);
    },
  );
  return closing;
}

process.on('message', (message) => {
  if (message?.type === 'shutdown') void close('acceptance_shutdown');
});
process.once('SIGINT', () => void close('SIGINT'));
process.once('SIGTERM', () => void close('SIGTERM'));

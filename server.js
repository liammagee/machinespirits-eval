/**
 * @machinespirits/eval - Standalone Server
 *
 * Runs the evaluation system as a standalone application.
 * This server provides:
 * - API endpoints for evaluation runs, results, and analysis
 * - Static file serving for the UI components
 * - Documentation serving
 *
 * Environment variables:
 *   PORT - Server port (default: 8081)
 *   STANDALONE - Set to 'true' to run in standalone mode
 *
 * Usage:
 *   STANDALONE=true node server.js
 *   # or
 *   npm start
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

const app = express();
const PORT = Number(process.env.PORT) || 8081;
const isStandalone = process.env.STANDALONE === 'true';

// Middleware
app.use(express.json());

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
  console.log('[EvalServer] Created data directory');
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    package: '@machinespirits/eval',
    version: pkg.version,
    mode: isStandalone ? 'standalone' : 'mounted',
  });
});

// API routes
import evalRoutes from './routes/evalRoutes.js';
app.use('/api/eval', evalRoutes);

// Serve components as static files
const componentsDir = path.join(__dirname, 'components');
if (existsSync(componentsDir)) {
  app.use('/components', express.static(componentsDir));
}

// Serve documentation
const docsDir = path.join(__dirname, 'docs');
if (existsSync(docsDir)) {
  app.use('/docs', express.static(docsDir));
}

// In standalone mode, serve a basic UI
if (isStandalone) {
  app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Machine Spirits Eval</title>
  <style>
    body {
      font-family: 'Space Mono', monospace;
      background: #0a0a0a;
      color: #fafafa;
      margin: 0;
      padding: 2rem;
    }
    h1 { color: #E63946; }
    a { color: #E63946; }
    .endpoint {
      background: rgba(255,255,255,0.05);
      padding: 1rem;
      margin: 0.5rem 0;
      border-radius: 4px;
    }
    code {
      background: rgba(255,255,255,0.1);
      padding: 0.2rem 0.4rem;
      border-radius: 2px;
    }
  </style>
</head>
<body>
  <h1>Machine Spirits Eval</h1>
  <p>Evaluation system running in standalone mode.</p>

  <h2>API Endpoints</h2>

  <div class="endpoint">
    <strong>GET</strong> <code>/api/eval/scenarios</code>
    <p>List available evaluation scenarios</p>
  </div>

  <div class="endpoint">
    <strong>GET</strong> <code>/api/eval/profiles</code>
    <p>List tutor profiles</p>
  </div>

  <div class="endpoint">
    <strong>GET</strong> <code>/api/eval/runs</code>
    <p>List evaluation runs</p>
  </div>

  <div class="endpoint">
    <strong>GET</strong> <code>/api/eval/runs/:id</code>
    <p>Get details of a specific run</p>
  </div>

  <div class="endpoint">
    <strong>POST</strong> <code>/api/eval/quick</code>
    <p>Run a quick evaluation test</p>
  </div>

  <h2>Documentation</h2>
  <p><a href="/docs">/docs</a> - Research papers and analysis</p>

  <h2>Health</h2>
  <p><a href="/health">/health</a> - Service health check</p>
</body>
</html>
    `);
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('[EvalServer] Error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EvalServer] Machine Spirits Eval running at http://0.0.0.0:${PORT}`);
    console.log(`[EvalServer] Mode: ${isStandalone ? 'standalone' : 'mounted'}`);
    console.log(`[EvalServer] API: http://0.0.0.0:${PORT}/api/eval`);
    console.log(`[EvalServer] Docs: http://0.0.0.0:${PORT}/docs`);
  });
}

export { app };

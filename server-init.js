/**
 * Evaluation Extension - Server Initialization
 *
 * Called by the extension loader when mounting this extension
 * into the main Machine Spirits website.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize the evaluation extension
 * @param {Object} context - Initialization context
 * @param {Express} context.app - Express application
 * @param {Object} context.manifest - Extension manifest
 * @param {string} context.extensionPath - Path to extension directory
 * @param {string} context.rootDir - Path to main website root
 */
export async function init({ app, manifest, extensionPath, rootDir }) {
  console.log(`[EvalExtension] Initializing ${manifest.name} v${manifest.version}`);

  // Serve static files for components (for client-side imports)
  const componentsDir = path.join(extensionPath, 'components');
  app.use('/extensions/eval', express.static(componentsDir));

  // Serve documentation
  const docsDir = path.join(extensionPath, 'docs');
  app.use('/docs/extensions/eval', express.static(docsDir));

  // Ensure data directory exists
  const dataDir = path.join(extensionPath, 'data');
  const fs = await import('fs');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('[EvalExtension] Created data directory');
  }

  console.log('[EvalExtension] Initialization complete');
}

export default { init };

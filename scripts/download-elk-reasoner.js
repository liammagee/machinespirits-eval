#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const VERSION = '0.4.3';
const ARTIFACT = `elk-standalone-${VERSION}.jar`;
const TARGET_DIR = path.join(ROOT_DIR, 'vendor', 'reasoners', 'elk');
const TARGET_PATH = path.join(TARGET_DIR, ARTIFACT);
const URL = `https://repo1.maven.org/maven2/org/semanticweb/elk/elk-standalone/${VERSION}/${ARTIFACT}`;

const force = process.argv.includes('--force');

async function main() {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  if (fs.existsSync(TARGET_PATH) && !force) {
    console.log(`ELK already present: ${path.relative(ROOT_DIR, TARGET_PATH)}`);
    return;
  }
  console.log(`Downloading ${URL}`);
  const response = await fetch(URL);
  if (!response.ok) {
    throw new Error(`Failed to download ELK: HTTP ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(TARGET_PATH, buffer);
  console.log(`Downloaded ${buffer.length} bytes to ${path.relative(ROOT_DIR, TARGET_PATH)}`);
  console.log('Run with Java installed: npm run ontology:elk -- --input config/ontology/reasoning-core.ofn');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

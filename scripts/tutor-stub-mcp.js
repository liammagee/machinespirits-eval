#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import {
  createTutorStubCodexRemoteMcpServer,
  tutorStubCodexRemoteCommandAdmission,
} from '../services/tutorStubCodexRemoteBridge.js';
import { createTutorStubProcessSessionHost } from '../services/tutorStubProcessSessionFactory.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = createTutorStubProcessSessionHost({
  root,
  maxSessions: Number(process.env.TUTOR_STUB_MCP_MAX_SESSIONS || 8),
  commandAdmission: tutorStubCodexRemoteCommandAdmission,
});
const { server } = createTutorStubCodexRemoteMcpServer({ host });

let shutdownPromise = null;
async function shutdown(reason, exitCode = 0) {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    await host.closeAll(reason);
    await server.close();
    process.exitCode = exitCode;
  })();
  return shutdownPromise;
}

process.once('SIGINT', () => void shutdown('mcp_sigint', 130));
process.once('SIGTERM', () => void shutdown('mcp_sigterm', 143));
process.stdin.once('end', () => void shutdown('mcp_stdin_closed'));

try {
  await server.connect(new StdioServerTransport());
  console.error('Machine Spirits tutor-stub MCP bridge ready on stdio');
} catch (error) {
  console.error(`Tutor-stub MCP bridge failed: ${error?.message || String(error)}`);
  await shutdown('mcp_start_failed', 1);
}

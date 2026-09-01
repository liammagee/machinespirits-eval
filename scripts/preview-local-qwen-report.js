#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Serve a single self-contained report, never a directory or the workspace.
export function createReportPreviewServer(reportPath) {
  const html = fs.readFileSync(reportPath);
  return http.createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method) || request.url !== '/') {
      response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    });
    response.end(request.method === 'HEAD' ? undefined : html);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (!process.argv[2]) throw new Error('Provide the one standalone HTML report to preview');
  const server = createReportPreviewServer(path.resolve(process.argv[2]));
  server.listen(0, '127.0.0.1', () => console.log(`Report-only preview: http://127.0.0.1:${server.address().port}/`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}

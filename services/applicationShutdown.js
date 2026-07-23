const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5_000;

export class ApplicationShutdownTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`application shutdown exceeded ${timeoutMs}ms`);
    this.name = 'ApplicationShutdownTimeoutError';
    this.code = 'application_shutdown_timeout';
    this.timeoutMs = timeoutMs;
  }
}

function closeHttpServer(server) {
  if (!server || typeof server.close !== 'function' || server.listening === false) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
    // Do not let an idle keep-alive socket hold a graceful shutdown open.
    server.closeIdleConnections?.();
  });
}

function closeDatabase(app) {
  const db = app?.locals?.db;
  if (!db || typeof db.close !== 'function' || db.open === false) return;
  db.close();
}

/**
 * Stop accepting HTTP work, terminate tutor subprocesses, drain active
 * handlers, and finally close the application database. The timeout bounds
 * the whole operation; it does not install process listeners or exit.
 */
export async function shutdownApplication({
  app,
  server,
  reason = 'application_shutdown',
  timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error('shutdown timeout must be a positive integer');

  const cleanup = (async () => {
    const host = app?.locals?.tutorStubSessionHost;
    const results = await Promise.allSettled([
      closeHttpServer(server),
      typeof host?.closeAll === 'function' ? Promise.resolve().then(() => host.closeAll(reason)) : Promise.resolve(),
    ]);

    let databaseError = null;
    try {
      closeDatabase(app);
    } catch (error) {
      databaseError = error;
    }

    const errors = results.filter((result) => result.status === 'rejected').map((result) => result.reason);
    if (databaseError) errors.push(databaseError);
    if (errors.length) throw new AggregateError(errors, 'application shutdown failed');
    return { reason, closed: true };
  })();

  let timeoutHandle = null;
  const timeout = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new ApplicationShutdownTimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([cleanup, timeout]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Install signal handlers for a concrete running server. Keeping this separate
 * from module initialization makes importing server factories test-safe.
 */
export function installApplicationShutdownHandlers({
  app,
  server,
  timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
  signalTarget = process,
  exit = (code) => process.exit(code),
  logger = console,
} = {}) {
  let shutdownPromise = null;

  const dispose = () => {
    signalTarget.removeListener('SIGINT', onSigint);
    signalTarget.removeListener('SIGTERM', onSigterm);
  };

  const beginShutdown = (signal = 'application_shutdown') => {
    if (shutdownPromise) return shutdownPromise;
    logger.log?.(`[shutdown] ${signal}: closing HTTP server and tutor sessions`);
    shutdownPromise = shutdownApplication({ app, server, reason: signal, timeoutMs }).then(
      () => {
        dispose();
        exit(0);
      },
      (error) => {
        dispose();
        logger.error?.(`[shutdown] ${signal}: ${error?.message || String(error)}`);
        exit(1);
      },
    );
    return shutdownPromise;
  };

  const onSigint = () => void beginShutdown('SIGINT');
  const onSigterm = () => void beginShutdown('SIGTERM');

  signalTarget.on('SIGINT', onSigint);
  signalTarget.on('SIGTERM', onSigterm);

  return Object.freeze({ dispose, shutdown: beginShutdown });
}

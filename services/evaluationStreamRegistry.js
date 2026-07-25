const DEFAULT_MAX_STREAM_DURATION_MS = 2 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_WARNING_MS = 30 * 60 * 1000;
const DEFAULT_WATCHDOG_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Track the timers and response owned by each evaluation SSE stream.
 *
 * The factory keeps lifecycle behavior independently testable; evalRoutes uses
 * the singleton export below so its existing process-wide semantics remain
 * unchanged.
 */
export function createEvaluationStreamRegistry({
  logger = console,
  now = () => Date.now(),
  maxStreamDurationMs = DEFAULT_MAX_STREAM_DURATION_MS,
  timeoutWarningMs = DEFAULT_TIMEOUT_WARNING_MS,
  watchdogIntervalMs = DEFAULT_WATCHDOG_INTERVAL_MS,
} = {}) {
  const activeStreams = new Map();
  let streamIdCounter = 0;

  function unregisterStream(streamId) {
    const stream = activeStreams.get(streamId);
    if (!stream) return;

    if (stream.keepAlive) clearInterval(stream.keepAlive);
    if (stream.timeoutTimer) clearTimeout(stream.timeoutTimer);
    activeStreams.delete(streamId);
    const duration = Math.round((now() - stream.startedAt) / 1000);
    logger.log?.(`[EvalRoutes] Stream closed: ${streamId} (Duration: ${duration}s, Remaining: ${activeStreams.size})`);
  }

  function registerStream(res, keepAlive, options = {}) {
    const streamId = `eval-stream-${++streamIdCounter}-${now()}`;
    const maxDuration = options.maxDuration || maxStreamDurationMs;
    const startedAt = now();

    const timeoutTimer = setTimeout(() => {
      logger.warn?.(`[EvalRoutes] Stream ${streamId} exceeded max duration (${maxDuration}ms), forcing cleanup`);
      try {
        if (res && !res.writableEnded) {
          res.write(
            'event: error\ndata: {"error": "Evaluation timeout - exceeded maximum duration", "timeout": true}\n\n',
          );
          res.end();
        }
      } catch (error) {
        logger.error?.(`[EvalRoutes] Error sending timeout to ${streamId}:`, error.message);
      }
      unregisterStream(streamId);
    }, maxDuration);

    activeStreams.set(streamId, {
      res,
      keepAlive,
      timeoutTimer,
      streamId,
      startedAt,
      maxDuration,
    });

    logger.log?.(
      `[EvalRoutes] Stream registered: ${streamId} (Timeout: ${maxDuration}ms, Total active: ${activeStreams.size})`,
    );
    return streamId;
  }

  function cleanupAllStreams() {
    if (activeStreams.size === 0) return;

    logger.log?.(`[EvalRoutes] Cleaning up ${activeStreams.size} active streams...`);
    activeStreams.forEach(({ res, keepAlive, timeoutTimer, streamId }) => {
      try {
        if (keepAlive) clearInterval(keepAlive);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (res && !res.writableEnded) {
          res.write('event: error\ndata: {"error": "Server restarting"}\n\n');
          res.end();
        }
      } catch (error) {
        logger.error?.(`[EvalRoutes] Error cleaning stream ${streamId}:`, error.message);
      }
    });
    activeStreams.clear();
  }

  const watchdog = setInterval(() => {
    const currentTime = now();
    activeStreams.forEach((stream, streamId) => {
      const age = currentTime - stream.startedAt;

      if (age > stream.maxDuration - timeoutWarningMs && !stream.warningShown) {
        const remaining = Math.round((stream.maxDuration - age) / 1000 / 60);
        logger.warn?.(`[EvalRoutes] Stream ${streamId} will timeout in ${remaining} minutes`);
        try {
          if (stream.res && !stream.res.writableEnded) {
            stream.res.write(
              `event: warning\ndata: {"message": "Evaluation will timeout in ${remaining} minutes", "remainingMs": ${stream.maxDuration - age}}\n\n`,
            );
          }
        } catch {
          // A failed warning write is non-fatal; normal close/timeout owns cleanup.
        }
        stream.warningShown = true;
      }
    });
  }, watchdogIntervalMs);
  watchdog.unref?.();

  return Object.freeze({
    registerStream,
    unregisterStream,
    cleanupAllStreams,
    get activeCount() {
      return activeStreams.size;
    },
  });
}

export const evaluationStreamRegistry = createEvaluationStreamRegistry();

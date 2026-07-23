import readline from 'node:readline';

export const TUTOR_STUB_SESSION_RPC_SCHEMA = 'machinespirits.tutor-stub.session-rpc.v1';
export const TUTOR_STUB_SESSION_RPC_VERSION = 1;

const OPERATIONS = new Set(['snapshot', 'step', 'resume', 'reset', 'finalize']);
const STEP_KINDS = new Set(['auto', 'learner', 'command']);

function frameError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseFrame(line) {
  let frame;
  try {
    frame = JSON.parse(line);
  } catch {
    throw frameError('invalid_json', 'session RPC frame must be valid JSON');
  }
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) {
    throw frameError('invalid_frame', 'session RPC frame must be an object');
  }
  const id = String(frame.id || '').trim();
  if (!id) throw frameError('invalid_frame', 'session RPC frame id is required');
  const operation = String(frame.operation || '').trim();
  if (!OPERATIONS.has(operation))
    throw frameError('invalid_operation', `unsupported session RPC operation: ${operation}`);
  return { ...frame, id, operation };
}

function writeFrame(output, frame) {
  return new Promise((resolve, reject) => {
    const line = `${JSON.stringify({ schema: TUTOR_STUB_SESSION_RPC_SCHEMA, version: 1, ...frame })}\n`;
    output.write(line, (error) => (error ? reject(error) : resolve()));
  });
}

async function dispatch(runtime, frame) {
  if (frame.operation === 'snapshot') return runtime.snapshot();
  if (frame.operation === 'step') {
    if (typeof frame.input !== 'string' || !frame.input.trim()) {
      throw frameError('invalid_frame', 'session RPC step input must be a non-empty string');
    }
    const kind = frame.kind || 'auto';
    if (!STEP_KINDS.has(kind))
      throw frameError('invalid_frame', 'session RPC step kind must be auto, learner, or command');
    return runtime.step(frame.input, {
      kind,
      context: {
        ...(frame.context && typeof frame.context === 'object' && !Array.isArray(frame.context) ? frame.context : {}),
        source: 'session_rpc',
        awaitCompletion: true,
      },
    });
  }
  if (frame.operation === 'resume') return runtime.resume(frame.payload || {});
  if (frame.operation === 'reset') return runtime.reset(frame.payload || {});
  return runtime.finalize(frame.reason || 'session_rpc_finalize', frame.payload || {});
}

/**
 * Run the private, newline-delimited control channel used by the server-side
 * tutor-stub process adapter. Terminal stdout/stderr remain diagnostic only;
 * structured frames travel over dedicated file descriptors.
 */
export async function runTutorStubSessionRpc({ input, output, runtime } = {}) {
  if (!input || !output) throw new Error('session RPC requires input and output streams');
  if (!runtime || typeof runtime.snapshot !== 'function') throw new Error('session RPC requires a tutor-stub runtime');

  await writeFrame(output, { type: 'ready', session: runtime.snapshot() });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const rawLine of lines) {
      const line = String(rawLine || '').trim();
      if (!line) continue;
      let frame;
      try {
        frame = parseFrame(line);
        const result = await dispatch(runtime, frame);
        await writeFrame(output, {
          type: 'response',
          id: frame.id,
          operation: frame.operation,
          ok: true,
          result,
          session: runtime.snapshot(),
        });
        if (frame.operation === 'finalize') break;
      } catch (error) {
        await writeFrame(output, {
          type: 'response',
          id: frame?.id || null,
          operation: frame?.operation || null,
          ok: false,
          error: {
            code: error?.code || 'session_rpc_failed',
            message: error?.message || String(error),
          },
          session: runtime.snapshot(),
        });
      }
    }
  } finally {
    lines.close();
  }
}

export default runTutorStubSessionRpc;

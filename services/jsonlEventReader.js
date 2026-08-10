import fs from 'node:fs';
import { StringDecoder } from 'node:string_decoder';

const DEFAULT_CHUNK_BYTES = 1024 * 1024;
const TYPE_PREFIX_LIMIT = 8192;

function eventTypeFromPrefix(prefix) {
  return String(prefix || '').match(/"type"\s*:\s*"([^"]+)"/u)?.[1] || null;
}

/**
 * Scan a JSONL event file without first materializing the whole file as one
 * JavaScript string. Once a line's event type is known, unselected lines are
 * discarded chunk by chunk. This is intentionally synchronous because the
 * auto-eval close handler needs a complete deterministic summary before it
 * seals the child run.
 */
export function readSelectedJsonlEventsSync(
  filePath,
  { retainTypes = null, retainErrorTypes = false, chunkBytes = DEFAULT_CHUNK_BYTES } = {},
) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { events: [], eventCount: 0, lastType: null, parseErrorCount: 0 };
  }
  const selected = retainTypes ? new Set(retainTypes) : null;
  const shouldRetain = (type) => !selected || selected.has(type) || (retainErrorTypes && /error/iu.test(type || ''));
  const buffer = Buffer.allocUnsafe(Math.max(1024, Number(chunkBytes) || DEFAULT_CHUNK_BYTES));
  const decoder = new StringDecoder('utf8');
  const events = [];
  let eventCount = 0;
  let lastType = null;
  let parseErrorCount = 0;
  let line = '';
  let lineType = null;
  let retainLine = null;

  const consumeFragment = (fragment) => {
    if (retainLine === false) return;
    line += fragment;
    if (lineType === null) {
      lineType = eventTypeFromPrefix(line);
      if (lineType) {
        retainLine = shouldRetain(lineType);
        if (!retainLine) line = '';
      } else if (line.length >= TYPE_PREFIX_LIMIT) {
        // Trace events put `type` in their small header. Retain a malformed or
        // foreign line so parsing reports it instead of silently dropping it.
        retainLine = true;
      }
    }
  };

  const finishLine = () => {
    if (!line && retainLine === null && lineType === null) return;
    eventCount += 1;
    lastType = lineType;
    if (retainLine !== false) {
      try {
        const event = JSON.parse(line);
        events.push(event);
        lastType = event?.type || lastType;
      } catch {
        parseErrorCount += 1;
      }
    }
    line = '';
    lineType = null;
    retainLine = null;
  };

  const consumeText = (text) => {
    let start = 0;
    while (start < text.length) {
      const newline = text.indexOf('\n', start);
      if (newline < 0) {
        consumeFragment(text.slice(start));
        break;
      }
      consumeFragment(text.slice(start, newline));
      finishLine();
      start = newline + 1;
    }
  };

  const descriptor = fs.openSync(filePath, 'r');
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) consumeText(decoder.write(buffer.subarray(0, bytesRead)));
    } while (bytesRead > 0);
    consumeText(decoder.end());
    finishLine();
  } finally {
    fs.closeSync(descriptor);
  }
  return { events, eventCount, lastType, parseErrorCount };
}

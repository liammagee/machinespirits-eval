import { afterEach, describe, expect, it } from 'vitest';

import { isQuietOrTranscript, setQuietMode } from '../dialogueLoggingState.js';

const originalTranscript = process.env.TUTOR_TRANSCRIPT;

afterEach(() => {
  setQuietMode(false);
  if (originalTranscript === undefined) delete process.env.TUTOR_TRANSCRIPT;
  else process.env.TUTOR_TRANSCRIPT = originalTranscript;
});

describe('dialogueLoggingState', () => {
  it('remains the named public surface of the dialogue engine', async () => {
    const dialogueEngine = await import('../tutorDialogueEngine.js');

    expect(dialogueEngine.setQuietMode).toBe(setQuietMode);
    expect(dialogueEngine.isQuietOrTranscript).toBe(isQuietOrTranscript);
  });

  it('defaults to verbose output when neither mode is enabled', () => {
    delete process.env.TUTOR_TRANSCRIPT;
    setQuietMode(false);

    expect(isQuietOrTranscript()).toBe(false);
  });

  it('tracks explicit quiet-mode changes in one shared leaf state', () => {
    delete process.env.TUTOR_TRANSCRIPT;

    setQuietMode(true);
    expect(isQuietOrTranscript()).toBe(true);

    setQuietMode(false);
    expect(isQuietOrTranscript()).toBe(false);
  });

  it('continues to honor the transcript environment switch', () => {
    setQuietMode(false);
    process.env.TUTOR_TRANSCRIPT = 'true';

    expect(isQuietOrTranscript()).toBe(true);
  });
});

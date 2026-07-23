import { createHash } from 'node:crypto';

/**
 * Hash the complete legacy cell configuration used for one chat session.
 *
 * This deliberately preserves the human-pilot hash format: cell identity,
 * model/prompt configuration, prompt contents, topic, and curriculum text.
 * The hash can therefore prove which instrument produced a research trace
 * without exposing any of those private inputs through the public session
 * projection.
 */
export function computeLegacyChatConfigHash({
  cellName,
  egoConfig,
  superegoConfig,
  egoPromptText = '',
  superegoPromptText = '',
  topic = '',
  lectureText = '',
  personaId = '',
}) {
  const hash = createHash('sha256');
  hash.update(cellName || '');
  hash.update('\0');
  hash.update(
    JSON.stringify({
      p: egoConfig?.provider || null,
      m: egoConfig?.model || null,
      f: egoConfig?.prompt_file || null,
      t: egoConfig?.hyperparameters?.temperature ?? null,
    }),
  );
  hash.update('\0');
  hash.update(egoPromptText);
  hash.update('\0');
  hash.update(
    JSON.stringify(
      superegoConfig
        ? {
            p: superegoConfig.provider,
            m: superegoConfig.model,
            f: superegoConfig.prompt_file || null,
            t: superegoConfig.hyperparameters?.temperature ?? null,
          }
        : null,
    ),
  );
  hash.update('\0');
  hash.update(superegoPromptText || '');
  hash.update('\0');
  hash.update(topic || '');
  hash.update('\0');
  hash.update(lectureText || '');
  if (personaId) {
    hash.update('\0');
    hash.update(personaId);
  }
  return hash.digest('hex');
}

export default computeLegacyChatConfigHash;

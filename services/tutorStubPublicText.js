/**
 * Normalize public-world prose and symbolic facts onto the same token surface.
 *
 * World prose naturally uses possessives ("Brandt's business") while facts use
 * bare symbols (\`brandt\`). Treating those as different tokens makes already
 * public names look like concealed premise content.
 */
export function splitTutorStubPublicWords(value) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .map((word) => word.trim().replace(/(?:'s|s')$/u, ''))
    .filter(Boolean);
}

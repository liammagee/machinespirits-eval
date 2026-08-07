/**
 * Reports what `import 'dotenv/config'` put into the environment.
 *
 * Stands in for scripts/eval-cli.js, which loads dotenv the same way. Used by
 * tests/dryRun.test.js to check that the child of runCli() cannot read a .env
 * off disk. It lives in the repo so it resolves `dotenv` from the repo's
 * node_modules even when spawned with cwd pointed somewhere else — which is
 * what lets the test plant a .env in a temp directory instead of at the repo
 * root, where it would clobber a developer's real one.
 */

import 'dotenv/config';

process.stdout.write(
  JSON.stringify({
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? null,
    DEFAULT_AI_PROVIDER: process.env.DEFAULT_AI_PROVIDER ?? null,
  }),
);

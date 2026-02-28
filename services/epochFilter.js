/**
 * epochFilter.js — Data epoch filtering for Paper 2.0
 *
 * Prevents accidental cross-epoch contamination by enforcing rubric version
 * boundaries on all analysis queries. Paper 1.0 data (v1.0/v2.0/v2.1 rubric)
 * is treated as pilot data; Paper 2.0 data uses v2.2 rubric exclusively.
 *
 * Usage in analysis scripts:
 *
 *   import { parseEpochArg, getEpochFilter, printEpochBanner } from '../services/epochFilter.js';
 *
 *   const epoch = parseEpochArg(process.argv);
 *   printEpochBanner(epoch);
 *
 *   // SQL usage:
 *   const filter = getEpochFilter(epoch);
 *   const sql = `SELECT ... FROM evaluation_results WHERE ${filter.where}`;
 *   // filter.params contains any bind parameters
 *
 *   // Or append to existing WHERE:
 *   const sql2 = `SELECT ... FROM evaluation_results WHERE run_id = ? ${filter.and}`;
 */

// ── Epoch Definitions ───────────────────────────────────────────────────────

export const EPOCHS = {
    pilot: {
        label: 'Pilot (Paper 1.0)',
        description: 'Data generated under v1.0/v2.0/v2.1 rubrics (pre-2026-02-28)',
        rubricVersions: ['1.0', '2.0', '2.1'],
        where: `(tutor_rubric_version IS NULL OR tutor_rubric_version IN ('1.0', '2.0', '2.1'))`,
        and: `AND (tutor_rubric_version IS NULL OR tutor_rubric_version IN ('1.0', '2.0', '2.1'))`,
        params: [],
    },
    '2.0': {
        label: 'Paper 2.0',
        description: 'Data generated under v2.2 rubric with full provenance',
        rubricVersions: ['2.2'],
        where: `tutor_rubric_version = '2.2'`,
        and: `AND tutor_rubric_version = '2.2'`,
        params: [],
    },
    all: {
        label: 'All Data (cross-epoch)',
        description: 'All data regardless of rubric version — use with caution',
        rubricVersions: null,
        where: '1=1',
        and: '',
        params: [],
    },
};

// The default epoch for analysis scripts
export const DEFAULT_EPOCH = '2.0';

// ── CLI Parsing ─────────────────────────────────────────────────────────────

/**
 * Parse --epoch argument from argv. Returns epoch key.
 * Accepts: --epoch pilot, --epoch 2.0, --epoch all
 * Aliases: --epoch paper1, --epoch paper2, --epoch legacy
 */
export function parseEpochArg(argv) {
    const args = argv || process.argv;
    const idx = args.indexOf('--epoch');
    if (idx === -1) return DEFAULT_EPOCH;

    const val = (args[idx + 1] || '').toLowerCase();

    // Aliases
    if (['pilot', 'paper1', 'legacy', '1.0'].includes(val)) return 'pilot';
    if (['2.0', 'paper2', 'current'].includes(val)) return '2.0';
    if (['all', '*'].includes(val)) return 'all';

    console.error(`Unknown epoch: "${val}". Use: pilot, 2.0, or all`);
    process.exit(1);
}

/**
 * Get the SQL filter for the given epoch.
 * Returns { where, and, params, label, description }
 */
export function getEpochFilter(epoch) {
    const e = EPOCHS[epoch];
    if (!e) {
        console.error(`Unknown epoch: "${epoch}". Known epochs: ${Object.keys(EPOCHS).join(', ')}`);
        process.exit(1);
    }
    return e;
}

// ── Banner ──────────────────────────────────────────────────────────────────

/**
 * Print a visible epoch banner to stderr (so it shows even when stdout is piped).
 */
export function printEpochBanner(epoch) {
    const e = EPOCHS[epoch];
    if (!e) return;

    if (epoch === 'all') {
        console.error(`\n  ⚠  EPOCH: ${e.label}`);
        console.error(`     ${e.description}`);
        console.error(`     Cross-epoch results may not be comparable.\n`);
    } else if (epoch === 'pilot') {
        console.error(`\n  📊 EPOCH: ${e.label}`);
        console.error(`     ${e.description}`);
        console.error(`     These are pilot findings — not for Paper 2.0 claims.\n`);
    } else {
        console.error(`\n  ✅ EPOCH: ${e.label}`);
        console.error(`     ${e.description}\n`);
    }
}

// ── Dialogue Log Filtering ──────────────────────────────────────────────────

/**
 * For scripts that work with dialogue log files (not DB), filter by created_at.
 * Paper 2.0 epoch starts 2026-02-28.
 */
export const EPOCH_BOUNDARIES = {
    pilot: { before: '2026-02-28' },
    '2.0': { after: '2026-02-28' },
    all: {},
};

/**
 * Check if a dialogue log file belongs to the given epoch based on its filename.
 * Dialogue files are named: dialogue-<timestamp>-<id>.json
 * Returns true if the file matches the epoch.
 */
export function dialogueMatchesEpoch(filename, epoch) {
    if (epoch === 'all') return true;

    const match = filename.match(/dialogue-(\d+)-/);
    if (!match) return true; // Hash-named files are pilot data

    const ts = parseInt(match[1]);
    const boundary = new Date('2026-02-28T00:00:00Z').getTime();

    if (epoch === 'pilot') return ts < boundary;
    if (epoch === '2.0') return ts >= boundary;
    return true;
}

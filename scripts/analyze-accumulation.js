#!/usr/bin/env node
/**
 * analyze-accumulation.js — Accumulative dataset status dashboard
 *
 * Shows the current state of incremental data collection for Paper 2.0:
 *   - Which cell×scenario combinations have N=1, N=2, N=3+
 *   - Which combinations need more data
 *   - Signature validation (config hash consistency)
 *   - Power analysis at current N levels
 *
 * Usage:
 *   node scripts/analyze-accumulation.js                  # Paper 2.0 (default)
 *   node scripts/analyze-accumulation.js --epoch pilot    # Pilot data
 *   node scripts/analyze-accumulation.js --target-n 5     # Target N=5 per group
 *   node scripts/analyze-accumulation.js --profile cell_80  # Filter by profile
 *   node scripts/analyze-accumulation.js --json           # Machine-readable
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { parseEpochArg, getEpochFilter, printEpochBanner } from '../services/epochFilter.js';
import { getAggregatedStats, findAccumulationGaps } from '../services/evalSignature.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'evaluations.db');

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const epoch = parseEpochArg(args);
const jsonMode = args.includes('--json');
const targetNIdx = args.indexOf('--target-n');
const targetN = targetNIdx !== -1 ? parseInt(args[targetNIdx + 1], 10) : 3;
const profileIdx = args.indexOf('--profile');
const profileFilter = profileIdx !== -1 ? args[profileIdx + 1] : null;

// ── Helpers ─────────────────────────────────────────────────────────────────

function pct(n, total) {
    return total > 0 ? (n / total * 100).toFixed(1) : '0.0';
}

function bar(n, max, width = 30) {
    const filled = max > 0 ? Math.round((n / max) * width) : 0;
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}

// Minimum detectable effect size (MDE) for Welch's t-test at power=0.8, alpha=0.05
function minimumDetectableEffect(n1, n2) {
    if (n1 < 2 || n2 < 2) return Infinity;
    // Approximation: d ≈ 2.8 / sqrt(n_harmonic)
    const nHarmonic = 2 * n1 * n2 / (n1 + n2);
    return 2.8 / Math.sqrt(nHarmonic);
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
    if (!fs.existsSync(DB_PATH)) {
        console.error(`Database not found: ${DB_PATH}`);
        process.exit(1);
    }

    const db = new Database(DB_PATH, { readonly: true });
    printEpochBanner(epoch);

    const stats = getAggregatedStats(db, epoch);
    const gaps = findAccumulationGaps(db, epoch, targetN);

    if (jsonMode) {
        // Simplify groups for JSON output
        const groupsSummary = {};
        for (const [sig, group] of stats.groups) {
            groupsSummary[sig] = {
                profileName: group.profileName,
                scenarioId: group.scenarioId,
                n: group.n,
                nRuns: group.nRuns,
                mean: group.mean,
                sd: group.sd,
                runIds: group.runIds,
            };
        }
        console.log(JSON.stringify({
            epoch,
            totalRows: stats.totalRows,
            totalGroups: stats.totalGroups,
            byN: stats.byN,
            gaps: gaps.length,
            validationIssues: stats.validationIssues.length,
            groups: groupsSummary,
        }, null, 2));
        db.close();
        return;
    }

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  ACCUMULATIVE DATASET STATUS — Epoch: ${epoch}`);
    console.log(`${'═'.repeat(70)}\n`);

    // ── 1. Overview ─────────────────────────────────────────────────────

    console.log('── 1. Overview ───────────────────────────────────────────────────────\n');
    console.log(`  Total scored rows:    ${stats.totalRows}`);
    console.log(`  Unique signatures:    ${stats.totalGroups}`);
    console.log(`  Target N per group:   ${targetN}`);
    console.log('');
    console.log(`  N=1 groups:  ${stats.byN[1]}  (${pct(stats.byN[1], stats.totalGroups)}%)`);
    console.log(`  N=2 groups:  ${stats.byN[2]}  (${pct(stats.byN[2], stats.totalGroups)}%)`);
    console.log(`  N≥3 groups:  ${stats.byN['3+']}  (${pct(stats.byN['3+'], stats.totalGroups)}%)`);

    const readyGroups = stats.byN['3+'];
    const totalGroups = stats.totalGroups;
    console.log(`\n  Readiness:   ${bar(readyGroups, totalGroups)}  ${readyGroups}/${totalGroups} at target N`);

    // ── 2. By Profile ──────────────────────────────────────────────────

    console.log('\n── 2. Accumulation by Profile ─────────────────────────────────────────\n');
    console.log('  Profile                                          Scenarios  Total N  Avg N');
    console.log('  ' + '─'.repeat(70));

    const profiles = Object.entries(stats.byProfile)
        .filter(([name]) => !profileFilter || name.includes(profileFilter))
        .sort((a, b) => b[1].nSum - a[1].nSum);

    for (const [name, data] of profiles) {
        const avgN = data.total > 0 ? (data.nSum / data.total).toFixed(1) : '0.0';
        const shortName = name.length > 48 ? name.slice(0, 45) + '...' : name;
        console.log(`  ${shortName.padEnd(50)} ${String(data.scenarios.length).padStart(5)}    ${String(data.nSum).padStart(5)}  ${avgN.padStart(5)}`);
    }

    // ── 3. Data Gaps ──────────────────────────────────────────────────

    console.log(`\n── 3. Gaps (groups below N=${targetN}) ─────────────────────────────────\n`);

    if (gaps.length === 0) {
        console.log('  ✅ All groups meet the target N. No gaps.');
    } else {
        console.log(`  ${gaps.length} groups need more data:\n`);
        console.log('  Profile                                          Scenario                           Have  Need');
        console.log('  ' + '─'.repeat(90));

        const shown = gaps.slice(0, 30); // Cap display
        for (const gap of shown) {
            const shortProfile = (gap.profileName || '').length > 48
                ? gap.profileName.slice(0, 45) + '...'
                : (gap.profileName || 'unknown');
            const shortScenario = (gap.scenarioId || '').length > 30
                ? gap.scenarioId.slice(0, 27) + '...'
                : (gap.scenarioId || 'unknown');
            console.log(`  ${shortProfile.padEnd(50)} ${shortScenario.padEnd(33)} ${String(gap.currentN).padStart(4)}  ${String(gap.needed).padStart(4)}`);
        }
        if (gaps.length > 30) {
            console.log(`\n  ... and ${gaps.length - 30} more gaps`);
        }

        // Summary: how many more runs needed?
        const totalNeeded = gaps.reduce((s, g) => s + g.needed, 0);
        console.log(`\n  Total additional data points needed: ${totalNeeded}`);
    }

    // ── 4. Power Analysis ─────────────────────────────────────────────

    console.log('\n── 4. Power Analysis ─────────────────────────────────────────────────\n');

    // Group by recognition condition
    const recogGroups = [...stats.groups.values()].filter(g => g.factorRecognition === 1);
    const baseGroups = [...stats.groups.values()].filter(g => g.factorRecognition === 0);
    const recogN = recogGroups.reduce((s, g) => s + g.n, 0);
    const baseN = baseGroups.reduce((s, g) => s + g.n, 0);

    if (recogN > 0 && baseN > 0) {
        const mde = minimumDetectableEffect(recogN, baseN);
        console.log(`  Recognition: N=${recogN}  |  Baseline: N=${baseN}`);
        console.log(`  Minimum detectable effect (d): ${mde.toFixed(2)} (at power=0.8, α=0.05)`);
        console.log(`  → Can detect ${mde < 0.2 ? 'negligible' : mde < 0.5 ? 'small' : mde < 0.8 ? 'medium' : 'large'} effects or larger`);

        // What N would we need for d=0.3?
        const nFor03 = Math.ceil((2.8 / 0.3) ** 2);
        const nFor05 = Math.ceil((2.8 / 0.5) ** 2);
        console.log(`\n  To detect d=0.3 (small): need N≈${nFor03} per condition (have ${Math.min(recogN, baseN)})`);
        console.log(`  To detect d=0.5 (medium): need N≈${nFor05} per condition (have ${Math.min(recogN, baseN)})`);
    } else {
        console.log('  Insufficient data for power analysis (need both recognition and baseline conditions).');
    }

    // ── 5. Validation ─────────────────────────────────────────────────

    if (stats.validationIssues.length > 0) {
        console.log('\n── 5. Validation Issues ──────────────────────────────────────────────\n');
        for (const issue of stats.validationIssues.slice(0, 10)) {
            if (issue.issue === 'missing_config_hash') {
                console.log(`  ⚠ Missing config_hash: ${issue.profileName} × ${issue.scenarioId} (N=${issue.n})`);
            } else if (issue.issue === 'config_hash_drift') {
                console.log(`  🚨 Config drift: ${issue.profileName} × ${issue.scenarioId} — ${issue.hashes.length} different hashes in ${issue.n} rows`);
            }
        }
        if (stats.validationIssues.length > 10) {
            console.log(`  ... and ${stats.validationIssues.length - 10} more issues`);
        }
    } else {
        console.log('\n── 5. Validation ─────────────────────────────────────────────────────\n');
        console.log('  ✅ No config hash drift or missing hashes detected.');
    }

    console.log(`\n${'═'.repeat(70)}\n`);
    db.close();
}

main();

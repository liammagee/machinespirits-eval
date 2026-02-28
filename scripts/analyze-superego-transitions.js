#!/usr/bin/env node
/**
 * analyze-superego-transitions.js — Transition and revision analysis
 *
 * Analyzes classified critiques in context of their dialogues:
 *   1. Transition analysis: which critique categories follow which across turns?
 *   2. Revision correlation: do certain categories predict substantive ego revision?
 *
 * Uses the classified JSONL + original dialogue logs (pure computation, no API).
 *
 * Usage:
 *   node scripts/analyze-superego-transitions.js [--input data/superego-critiques-classified.jsonl]
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const args = process.argv.slice(2);
const inputIdx = args.indexOf('--input');
const inputPath = inputIdx !== -1 ? args[inputIdx + 1] : join(ROOT, 'data', 'superego-critiques-classified.jsonl');

// ── Helpers ─────────────────────────────────────────────────────────────────

function pct(n, total) {
    return total > 0 ? (n / total * 100).toFixed(1) : '0.0';
}

function jaccard(a, b) {
    if (!a || !b) return null;
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    return union > 0 ? intersection / union : 0;
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
    if (!existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        process.exit(1);
    }

    const lines = readFileSync(inputPath, 'utf-8').trim().split('\n');
    const critiques = lines.map(l => JSON.parse(l));

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  SUPEREGO TRANSITION & REVISION ANALYSIS — N=${critiques.length}`);
    console.log(`${'═'.repeat(70)}\n`);

    // ── 1. Group critiques by dialogue ────────────────────────────────────

    const byDialogue = {};
    for (const c of critiques) {
        const d = c.dialogueId || 'unknown';
        if (!byDialogue[d]) byDialogue[d] = [];
        byDialogue[d].push(c);
    }

    // Sort within each dialogue by round/turnIndex
    for (const d of Object.values(byDialogue)) {
        d.sort((a, b) => (a.round || a.turnIndex || 0) - (b.round || b.turnIndex || 0));
    }

    const multiCrit = Object.entries(byDialogue).filter(([, crits]) => crits.length > 1);
    console.log(`  Dialogues with critiques: ${Object.keys(byDialogue).length}`);
    console.log(`  Dialogues with 2+ critiques (for transitions): ${multiCrit.length}\n`);

    // ── 2. Transition Matrix ──────────────────────────────────────────────

    console.log('── 1. Critique Category Transitions (turn N → turn N+1) ─────────────\n');

    const transitions = {};
    let totalTransitions = 0;

    for (const [, crits] of multiCrit) {
        for (let i = 0; i < crits.length - 1; i++) {
            const from = crits[i].classification?.primary || 'UNKNOWN';
            const to = crits[i + 1].classification?.primary || 'UNKNOWN';
            const key = `${from} → ${to}`;
            transitions[key] = (transitions[key] || 0) + 1;
            totalTransitions++;
        }
    }

    if (totalTransitions > 0) {
        console.log(`  Total transitions observed: ${totalTransitions}\n`);
        const sorted = Object.entries(transitions).sort((a, b) => b[1] - a[1]);
        console.log('  Transition                                           Count    %');
        console.log('  ' + '─'.repeat(65));
        for (const [key, count] of sorted.slice(0, 20)) {
            console.log(`  ${key.padEnd(50)}${String(count).padStart(5)}  ${pct(count, totalTransitions).padStart(6)}%`);
        }

        // Persistence rate: how often does the same category repeat?
        const selfTransitions = sorted.filter(([k]) => {
            const parts = k.split(' → ');
            return parts[0] === parts[1];
        });
        const selfTotal = selfTransitions.reduce((sum, [, c]) => sum + c, 0);
        console.log(`\n  Persistence rate (same category repeats): ${selfTotal}/${totalTransitions} (${pct(selfTotal, totalTransitions)}%)`);

        // Escalation patterns: APPROVAL → non-APPROVAL
        const fromApproval = sorted.filter(([k]) => k.startsWith('APPROVAL → ') && !k.endsWith('→ APPROVAL'));
        const toApproval = sorted.filter(([k]) => k.endsWith('→ APPROVAL') && !k.startsWith('APPROVAL'));
        const escCount = fromApproval.reduce((sum, [, c]) => sum + c, 0);
        const deescCount = toApproval.reduce((sum, [, c]) => sum + c, 0);
        console.log(`  Escalation (APPROVAL → critique): ${escCount}`);
        console.log(`  De-escalation (critique → APPROVAL): ${deescCount}`);
    }

    // ── 3. Revision Magnitude by Category ─────────────────────────────────

    console.log('\n── 2. Revision Magnitude by Critique Category ─────────────────────────\n');

    const revisionByCategory = {};

    for (const c of critiques) {
        const cat = c.classification?.primary || 'UNKNOWN';
        if (cat === 'APPROVAL') continue; // No revision expected

        const egoGen = c.egoGenerate || '';
        const egoRev = c.egoRevision || '';

        if (egoGen.length > 20 && egoRev.length > 20) {
            const sim = jaccard(egoGen, egoRev);
            if (sim !== null) {
                if (!revisionByCategory[cat]) revisionByCategory[cat] = { similarities: [], count: 0, hasRevision: 0 };
                revisionByCategory[cat].similarities.push(sim);
                revisionByCategory[cat].count++;
                if (sim < 0.7) revisionByCategory[cat].hasRevision++; // Substantial change threshold
            }
        }
    }

    if (Object.keys(revisionByCategory).length > 0) {
        console.log('  Category                    N     Mean Sim.   Substantive Rev.  (sim<0.7)');
        console.log('  ' + '─'.repeat(70));

        for (const [cat, data] of Object.entries(revisionByCategory).sort((a, b) => {
            const avgA = a[1].similarities.reduce((s, v) => s + v, 0) / a[1].similarities.length;
            const avgB = b[1].similarities.reduce((s, v) => s + v, 0) / b[1].similarities.length;
            return avgA - avgB; // Sort by least similar first (most revision)
        })) {
            const avg = data.similarities.reduce((s, v) => s + v, 0) / data.similarities.length;
            console.log(`  ${cat.padEnd(30)}${String(data.count).padStart(3)}     ${avg.toFixed(3)}         ${data.hasRevision}/${data.count} (${pct(data.hasRevision, data.count)}%)`);
        }
    } else {
        console.log('  No ego generate/revision pairs found in classified data.');
        console.log('  (The extraction captures these when available in the dialogue trace.)');
    }

    // ── 4. Multi-Round Stalling Detection ─────────────────────────────────

    console.log('\n── 3. Stalling Detection (same critique 3+ consecutive rounds) ───────\n');

    let stallingDialogues = 0;
    const stallingCategories = {};

    for (const [_dialogueId, crits] of multiCrit) {
        if (crits.length < 3) continue;

        // Check for 3+ consecutive same category
        for (let i = 0; i <= crits.length - 3; i++) {
            const cats = [
                crits[i].classification?.primary,
                crits[i + 1].classification?.primary,
                crits[i + 2].classification?.primary,
            ];
            if (cats[0] && cats[0] === cats[1] && cats[1] === cats[2] && cats[0] !== 'APPROVAL') {
                stallingDialogues++;
                stallingCategories[cats[0]] = (stallingCategories[cats[0]] || 0) + 1;
                break; // Count each dialogue once
            }
        }
    }

    console.log(`  Dialogues with 3+ consecutive same critique: ${stallingDialogues}/${multiCrit.length}`);
    if (stallingDialogues > 0) {
        console.log('  Stalling categories:');
        for (const [cat, count] of Object.entries(stallingCategories).sort((a, b) => b[1] - a[1])) {
            console.log(`    ${cat}: ${count} dialogues`);
        }
    }

    // ── 5. Approval Rate Trajectory ───────────────────────────────────────

    console.log('\n── 4. Approval Rate by Round ──────────────────────────────────────────\n');

    const approvalByRound = {};
    const totalByRound = {};

    for (const c of critiques) {
        const round = c.round || c.turnIndex || 0;
        if (round < 0 || round > 20) continue;
        totalByRound[round] = (totalByRound[round] || 0) + 1;
        if (c.classification?.primary === 'APPROVAL') {
            approvalByRound[round] = (approvalByRound[round] || 0) + 1;
        }
    }

    const rounds = Object.keys(totalByRound).map(Number).sort((a, b) => a - b);
    if (rounds.length > 0) {
        console.log('  Round    N    Approval Rate');
        console.log('  ' + '─'.repeat(35));
        for (const r of rounds) {
            const total = totalByRound[r];
            const approved = approvalByRound[r] || 0;
            const bar = '█'.repeat(Math.round(approved / total * 20));
            console.log(`  ${String(r).padStart(5)}  ${String(total).padStart(4)}    ${pct(approved, total).padStart(5)}%  ${bar}`);
        }
    }

    console.log(`\n${'═'.repeat(70)}\n`);
}

main();

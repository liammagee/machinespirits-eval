import path from 'node:path';

import {
  renderProof as renderDerivationProof,
  renderProofProse as renderDerivationProofProse,
  renderEvalPanel as renderDerivationEvalPanel,
  stagingSegments as derivationStagingSegments,
} from './dramaticDerivation/index.js';
import { getDerivationConceptSchema } from './dramaticDerivation/conceptSchema.js';

export function createPoeticsDerivationPresentation({
  escapeHtml,
  escapeAttr,
  pageHead,
  railHtml,
  reportTypeBand,
  safeJsonForScript,
  transcriptTtsClient: TRANSCRIPT_TTS_CLIENT,
  transcriptTtsToolbarHtml,
  ttsDataAttrs,
  ttsPlayButton,
  listDerivationLiveRuns,
}) {
  // Backend chips tolerate both ledger formats: per-role ({mode, roles:{...}},
  // current) and the flat pre-per-role shape ({mode, provider, model}).
  function derivationBackendChips(backend = {}) {
    const chips = [`mode ${backend.mode || '?'}`];
    if (backend.roles) {
      for (const [role, t] of Object.entries(backend.roles)) {
        chips.push(`${role} ${t.provider}/${t.model || '(cli default)'}`);
      }
    } else if (backend.provider) {
      chips.push(`all roles ${backend.provider}/${backend.model || '(cli default)'}`);
    }
    return chips;
  }

  // Compact backend cell for the runs index: group the roles by the model that
  // played them, so a typical run (three tutor-side roles on one model, learner
  // on another) reads as two lines instead of four near-identical ones. The
  // "(cli default)" suffix is dropped — it carries no signal in a dense table.
  function derivationBackendCell(backend = {}) {
    const short = (provider, model) => (model && model !== '(cli default)' ? `${provider}/${model}` : provider);
    let pairs;
    if (backend.roles) {
      pairs = Object.entries(backend.roles).map(([role, t]) => [role, short(t.provider, t.model)]);
    } else if (backend.provider) {
      return escapeHtml(short(backend.provider, backend.model));
    } else {
      return '—';
    }
    const byModel = new Map();
    for (const [role, model] of pairs) {
      if (!byModel.has(model)) byModel.set(model, []);
      byModel.get(model).push(role);
    }
    return [...byModel.entries()]
      .map(
        ([model, roles]) =>
          `<span class="bk"><span class="bk__m">${escapeHtml(model)}</span> <span class="bk__r">${escapeHtml(
            roles.join(', '),
          )}</span></span>`,
      )
      .join('');
  }

  const DERIVATION_SUCCESS_EVENTS = new Set(['forced', 'grounded_anagnorisis']);

  // Trope glossary for the tutor's move-figure labels. The two figures the
  // rhetoric ontology registers (anaphora, erotema) take their gloss verbatim
  // from config/ontology/rhetoric-core.ttl rdfs:labels; the other three are
  // glossed per the tutor scripts' own usage. Lookup is case-insensitive;
  // unknown figures render as plain labels.
  const DERIVATION_FIGURE_GLOSSARY = {
    erotema:
      'rhetorical question (erotema / interrogatio): a question asked not for information but to assert or press — the audience supplies the answer ("How long, Catiline, will you abuse our patience?").',
    anaphora: 'repetition at the START of successive clauses ("we shall fight … we shall fight …").',
    analogia:
      'argument by proportion — the known case carried onto the unknown one ("a watermark is to paper what a signature is not to music").',
    exemplum:
      'a concrete instance made to carry the rule — the particular case offered as evidence for the general claim.',
    aposiopesis:
      'breaking off mid-sentence and leaving the thought unfinished — the silence invites the hearer to complete the inference.',
  };

  // A move-figure label, expandable to its gloss when the glossary knows it.
  function derivationFigureHtml(figure) {
    const name = String(figure || '—');
    const gloss = DERIVATION_FIGURE_GLOSSARY[name.toLowerCase().trim()];
    if (!gloss) return escapeHtml(name);
    return `<details class="figdef"><summary title="show what this figure is">${escapeHtml(name)}</summary><span class="figdef__t">${escapeHtml(gloss)}</span></details>`;
  }

  // Inline markdown → HTML for the derivation artifacts (escape first, then the
  // few spans the panel/notice/proof actually use: \`code\`, **bold**, *italic*,
  // and «fact» — the proof prose marks logical tokens with guillemets).
  function derivationInlineMd(text) {
    return escapeHtml(String(text))
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/«([^»]+)»/g, '<span class="fact">«$1»</span>');
  }

  // Block-level markdown → HTML, sized to what the run artifacts emit
  // (renderEvalPanel, commentary.md): ##/### headings (mapped one level down so
  // they sit under the page's own h2 sections), nested "- " lists, pipe tables,
  // "> " blockquotes, paragraphs. Not a general markdown engine on purpose —
  // the artifacts are ours, and everything is escaped before any tag is added.
  function derivationMdToHtml(md) {
    const lines = String(md || '')
      .replace(/\r\n/g, '\n')
      .split('\n');
    const out = [];
    const para = [];
    const quote = [];
    let listDepth = 0;
    let tableRows = null;

    const flushPara = () => {
      if (!para.length) return;
      out.push(`<p>${derivationInlineMd(para.join(' '))}</p>`);
      para.length = 0;
    };
    const flushQuote = () => {
      if (!quote.length) return;
      out.push(`<blockquote>${derivationInlineMd(quote.join(' '))}</blockquote>`);
      quote.length = 0;
    };
    const closeLists = (to = 0) => {
      while (listDepth > to) {
        out.push('</ul>');
        listDepth -= 1;
      }
    };
    const flushTable = () => {
      if (!tableRows) return;
      const [head, ...body] = tableRows;
      const cells = (row, tag) => row.map((c) => `<${tag}>${derivationInlineMd(c)}</${tag}>`).join('');
      out.push(
        `<table><thead><tr>${cells(head, 'th')}</tr></thead>${
          body.length ? `<tbody>${body.map((r) => `<tr>${cells(r, 'td')}</tr>`).join('')}</tbody>` : ''
        }</table>`,
      );
      tableRows = null;
    };
    const flushAll = () => {
      flushPara();
      flushQuote();
      closeLists();
      flushTable();
    };

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      if (/^\|.*\|$/.test(line.trim())) {
        flushPara();
        flushQuote();
        closeLists();
        const cells = line
          .trim()
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
        if (!tableRows) tableRows = [];
        tableRows.push(cells);
        continue;
      }
      if (tableRows) flushTable();
      const heading = line.match(/^(#{1,4})\s+(.*)$/);
      if (heading) {
        flushAll();
        const level = Math.min(heading[1].length + 1, 4);
        out.push(`<h${level}>${derivationInlineMd(heading[2])}</h${level}>`);
        continue;
      }
      const item = line.match(/^(\s*)-\s+(.*)$/);
      if (item) {
        flushPara();
        flushQuote();
        const depth = Math.floor(item[1].length / 2) + 1;
        while (listDepth < depth) {
          out.push('<ul>');
          listDepth += 1;
        }
        closeLists(depth);
        out.push(`<li>${derivationInlineMd(item[2])}</li>`);
        continue;
      }
      if (/^>\s?/.test(line)) {
        flushPara();
        closeLists();
        flushTable();
        quote.push(line.replace(/^>\s?/, ''));
        continue;
      }
      if (!line.trim()) {
        flushAll();
        continue;
      }
      flushQuote();
      closeLists();
      flushTable();
      para.push(line.trim());
    }
    flushAll();
    return out.join('\n');
  }

  // The dramaturgical arc as an inline SVG: movement bands behind a step-after
  // D(t) staircase, release ▲ ticks (hover = which premise, via whom), the
  // forced moment as a dashed vertical, the grounded assertion as a star, event
  // flags at the top. All colors ride the page's CSS variables, so dark mode
  // follows for free. Tolerates the early-run diagnosis shape (no slope/staging).
  function renderDerivationArcSvg({
    trajectory = [],
    segments = [],
    ledger = [],
    events = [],
    world = null,
    result = {},
  }) {
    if (!trajectory.length) return '<p class="mono">(no trajectory recorded)</p>';
    const W = 940;
    const left = 44;
    const right = 16;
    const top = 16;
    const plotH = 220;
    const bottom = top + plotH;
    const H = bottom + 46;
    const t0 = trajectory[0].turn;
    const tN = Math.max(trajectory[trajectory.length - 1].turn, t0 + 1);
    const maxD = Math.max(...trajectory.map((p) => p.D), 1);
    const x = (turn) => left + ((turn - t0) / (tN - t0)) * (W - left - right);
    const y = (D) => bottom - (D / maxD) * plotH;
    const svg = [];

    // movement bands (alternating wash) + clipped names, full title on hover
    segments.forEach((seg, i) => {
      const x0 = Math.max(x(seg.turns[0] - 0.5), left);
      const x1 = Math.min(x(seg.turns[1] + 0.5), W - right);
      if (x1 <= x0) return;
      if (i % 2 === 0) {
        svg.push(
          `<rect x="${x0.toFixed(1)}" y="${top}" width="${(x1 - x0).toFixed(1)}" height="${plotH}" class="arc__band"/>`,
        );
      }
      const label = String(seg.title || '');
      const fit = Math.max(0, Math.floor((x1 - x0 - 10) / 6.4));
      const shown = label.length > fit ? `${label.slice(0, Math.max(fit - 1, 0))}…` : label;
      if (shown) {
        svg.push(
          `<text x="${(x0 + 5).toFixed(1)}" y="${top + 13}" class="arc__bandlabel">${escapeHtml(shown)}<title>${escapeHtml(
            `${label} (turns ${seg.turns[0]}–${seg.turns[1]}${seg.source === 'director' ? ', declared by the director' : ''})${seg.intent ? ` — ${seg.intent}` : ''}`,
          )}</title></text>`,
        );
      }
    });

    // D gridlines + axis labels (thin to every 2nd line when D runs deep)
    const dStep = maxD > 10 ? 2 : 1;
    for (let level = 0; level <= maxD; level += dStep) {
      svg.push(
        `<line x1="${left}" y1="${y(level).toFixed(1)}" x2="${W - right}" y2="${y(level).toFixed(1)}" class="arc__grid"/>`,
        `<text x="${left - 6}" y="${(y(level) + 3.5).toFixed(1)}" text-anchor="end" class="arc__tick">${level}</text>`,
      );
    }
    // turn axis ticks every 5
    for (let turn = Math.ceil(t0 / 5) * 5; turn <= tN; turn += 5) {
      svg.push(
        `<line x1="${x(turn).toFixed(1)}" y1="${bottom}" x2="${x(turn).toFixed(1)}" y2="${bottom + 4}" class="arc__grid"/>`,
        `<text x="${x(turn).toFixed(1)}" y="${bottom + 15}" text-anchor="middle" class="arc__tick">${turn}</text>`,
      );
    }

    // the forced moment — dashed vertical where the board first compels S
    const forcedTurn = result.firstForcedTurn ?? null;
    if (forcedTurn !== null) {
      svg.push(
        `<line x1="${x(forcedTurn).toFixed(1)}" y1="${top}" x2="${x(forcedTurn).toFixed(1)}" y2="${bottom}" class="arc__forced"/>`,
        `<text x="${(x(forcedTurn) + 4).toFixed(1)}" y="${top + 30}" class="arc__forcedlabel">forced t${forcedTurn}</text>`,
      );
    }

    // step-after staircase: D holds until the next turn moves it
    const d0 = trajectory[0];
    let dPath = `M ${x(d0.turn).toFixed(1)} ${y(d0.D).toFixed(1)}`;
    for (let i = 1; i < trajectory.length; i += 1) {
      dPath += ` H ${x(trajectory[i].turn).toFixed(1)} V ${y(trajectory[i].D).toFixed(1)}`;
    }
    svg.push(`<path d="${dPath}" class="arc__d"/>`);
    for (const p of trajectory) {
      svg.push(
        `<circle cx="${x(p.turn).toFixed(1)}" cy="${y(p.D).toFixed(1)}" r="2.4" class="arc__dot${p.forced ? ' arc__dot--forced' : ''}"><title>turn ${p.turn} — D=${p.D}${p.forced ? ' (S forced)' : ''}, ${p.groundedCount ?? '?'} facts grounded</title></circle>`,
      );
    }

    // release ▲ ticks under the axis — which premise, via whom, on hover
    const premiseById = new Map((world?.premises || []).map((p) => [p.id, p]));
    const relByTurn = new Map();
    for (const entry of ledger) {
      if (!relByTurn.has(entry.turn)) relByTurn.set(entry.turn, []);
      relByTurn.get(entry.turn).push(entry);
    }
    for (const [turn, entries] of relByTurn) {
      const title = entries
        .map((e) => {
          const surface = premiseById.get(e.premiseId)?.surface;
          return `${e.premiseId}${surface ? ` — ${surface}` : ''} (via ${e.via})`;
        })
        .join('\n');
      svg.push(
        `<text x="${x(turn).toFixed(1)}" y="${bottom + 30}" text-anchor="middle" class="arc__rel">▲<title>${escapeHtml(`released turn ${turn}:\n${title}`)}</title></text>`,
      );
    }

    // event flags inside the top edge (stacked when a turn carries several)
    const evByTurn = new Map();
    for (const event of events) {
      if (!evByTurn.has(event.turn)) evByTurn.set(event.turn, []);
      evByTurn.get(event.turn).push(event);
    }
    for (const [turn, list] of evByTurn) {
      list.forEach((e, i) => {
        const ok = DERIVATION_SUCCESS_EVENTS.has(e.type);
        svg.push(
          `<text x="${x(turn).toFixed(1)}" y="${top + 44 + i * 13}" text-anchor="middle" class="arc__flag ${ok ? 'arc__flag--ok' : 'arc__flag--bad'}">⚑<title>${escapeHtml(`${e.type} — ${e.detail || ''}`)}</title></text>`,
        );
      });
    }

    // the grounded assertion — a star where the recognition landed
    const assertedTurn = result.assertedGroundedTurn ?? null;
    if (assertedTurn !== null) {
      const at = trajectory.find((p) => p.turn === assertedTurn);
      svg.push(
        `<text x="${x(assertedTurn).toFixed(1)}" y="${(y(at ? at.D : 0) - 8).toFixed(1)}" text-anchor="middle" class="arc__star">★<title>grounded assertion at turn ${assertedTurn}</title></text>`,
      );
    }

    return `<svg viewBox="0 0 ${W} ${H}" class="arc" role="img" aria-label="D(t) — remaining derivation distance per turn, with movements, releases and events">${svg.join('')}</svg>`;
  }

  // The slope line under the arc, in words (mirrors the ASCII curve's caption).
  function derivationSlopeCaption(slope) {
    if (!slope) return '';
    const overall = slope.overall?.ratePerTurn;
    const perAct = (slope.perAct || [])
      .map((a) => `${a.act} ${a.ratePerTurn === null ? '—' : a.ratePerTurn.toFixed(2)}`)
      .join(' · ');
    return `<p class="slopecap">slope ${overall === null || overall === undefined ? '—' : overall.toFixed(2)} D/turn overall (D ${slope.d0}→${slope.dFinal})${perAct ? ` · per movement: ${perAct}` : ''} — D counts the premises still missing for the nearest proof of the secret; ▲ marks evidence entering the room.</p>`;
  }

  function shortFactLabel(fact) {
    if (!Array.isArray(fact) || !fact.length) return '—';
    return fact.join(' ');
  }

  function targetProgress(target) {
    const total = target?.sourcePremiseIds?.length || 0;
    const held = target?.heldSourcePremiseIds?.length || 0;
    const decayed = target?.decayedSourcePremiseIds?.length || 0;
    return { total, held, decayed, pct: total ? held / total : target?.derived ? 1 : 0 };
  }

  function renderDerivationLogicVisualizer(logicProjection) {
    const turns = logicProjection?.turns || [];
    if (!turns.length) {
      return '<p class="notice-missing">No logic projection snapshots are present for this run. New loop artifacts include them automatically.</p>';
    }

    const W = 940;
    const labelW = 92;
    const right = 12;
    const top = 20;
    const rowH = 34;
    const gap = 8;
    const rows = [
      { key: 'rules', label: 'rules fired' },
      { key: 'unvoiced', label: 'unvoiced' },
      { key: 'secret', label: 'secret path' },
      { key: 'mirror', label: 'mirror path' },
    ];
    const H = top + rows.length * rowH + (rows.length - 1) * gap + 36;
    const colW = (W - labelW - right) / Math.max(turns.length, 1);
    const maxRules = Math.max(1, ...turns.map((t) => t.counts?.firedHyperedges || 0));
    const maxUnvoiced = Math.max(1, ...turns.map((t) => t.counts?.derivedUnvoiced || 0));
    const yFor = (i) => top + i * (rowH + gap);
    const svg = [];

    rows.forEach((row, i) => {
      const y = yFor(i);
      svg.push(
        `<text x="8" y="${y + rowH / 2 + 4}" class="logicviz__label">${escapeHtml(row.label)}</text>`,
        `<line x1="${labelW}" y1="${y + rowH}" x2="${W - right}" y2="${y + rowH}" class="logicviz__rule"/>`,
      );
    });

    turns.forEach((turn, i) => {
      const x = labelW + i * colW;
      const cx = x + colW / 2;
      const activity = (turn.counts?.firedHyperedges || 0) + (turn.counts?.derivedUnvoiced || 0);
      if (activity > 0) {
        svg.push(
          `<rect x="${x.toFixed(1)}" y="${top - 8}" width="${colW.toFixed(1)}" height="${H - top - 18}" class="logicviz__active"/>`,
        );
      }
      if (i % 2 === 0) {
        svg.push(
          `<text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" class="logicviz__tick">t${turn.turn}</text>`,
        );
      }

      const rules = turn.counts?.firedHyperedges || 0;
      const ruleH = rules ? Math.max(3, (rules / maxRules) * (rowH - 8)) : 0;
      const rulesTitle = (turn.firedHyperedges || [])
        .map((edge) => `${edge.ruleId} → ${shortFactLabel(edge.outputFact)}`)
        .join('\n');
      svg.push(
        `<rect x="${(x + 3).toFixed(1)}" y="${(yFor(0) + rowH - ruleH).toFixed(1)}" width="${Math.max(2, colW - 6).toFixed(1)}" height="${ruleH.toFixed(1)}" class="logicviz__bar logicviz__bar--rules"><title>${escapeHtml(rulesTitle || `turn ${turn.turn}: no rule hyperedges fired`)}</title></rect>`,
      );

      const unvoiced = turn.counts?.derivedUnvoiced || 0;
      const unvoicedH = unvoiced ? Math.max(3, (unvoiced / maxUnvoiced) * (rowH - 8)) : 0;
      const unvoicedTitle = (turn.derivedUnvoiced || [])
        .map((node) => `${shortFactLabel(node.fact)} (${node.rule || 'rule?'})`)
        .join('\n');
      svg.push(
        `<rect x="${(x + 3).toFixed(1)}" y="${(yFor(1) + rowH - unvoicedH).toFixed(1)}" width="${Math.max(2, colW - 6).toFixed(1)}" height="${unvoicedH.toFixed(1)}" class="logicviz__bar logicviz__bar--unvoiced"><title>${escapeHtml(unvoicedTitle || `turn ${turn.turn}: no derived-unvoiced facts`)}</title></rect>`,
      );

      for (const [rowIndex, targetKey] of [
        [2, 'secret'],
        [3, 'mirror'],
      ]) {
        const target = turn[targetKey];
        const p = targetProgress(target);
        const y = yFor(rowIndex);
        const w = Math.max(2, colW - 6);
        const fill = Math.max(0, Math.min(1, p.pct)) * w;
        const title = `${targetKey} ${target?.derived ? 'derived' : 'not derived'} at turn ${turn.turn}
held ${p.held}/${p.total} source premises${target?.missingSourcePremiseIds?.length ? `; missing ${target.missingSourcePremiseIds.join(', ')}` : ''}${target?.decayedSourcePremiseIds?.length ? `; decayed ${target.decayedSourcePremiseIds.join(', ')}` : ''}`;
        svg.push(
          `<rect x="${(x + 3).toFixed(1)}" y="${(y + 8).toFixed(1)}" width="${w.toFixed(1)}" height="${(rowH - 16).toFixed(1)}" class="logicviz__path"><title>${escapeHtml(title)}</title></rect>`,
          `<rect x="${(x + 3).toFixed(1)}" y="${(y + 8).toFixed(1)}" width="${fill.toFixed(1)}" height="${(rowH - 16).toFixed(1)}" class="logicviz__pathfill logicviz__pathfill--${targetKey}"><title>${escapeHtml(title)}</title></rect>`,
        );
        if (p.decayed) {
          svg.push(
            `<text x="${cx.toFixed(1)}" y="${(y + rowH - 5).toFixed(1)}" text-anchor="middle" class="logicviz__decay">×<title>${escapeHtml(title)}</title></text>`,
          );
        }
        if (target?.derived) {
          svg.push(
            `<text x="${cx.toFixed(1)}" y="${(y + 20).toFixed(1)}" text-anchor="middle" class="logicviz__derived">●<title>${escapeHtml(title)}</title></text>`,
          );
        }
      }
    });

    const activeTurns = turns.filter(
      (t) =>
        (t.firedHyperedges || []).length ||
        (t.derivedUnvoiced || []).length ||
        t.secret?.derived ||
        t.mirror?.derived ||
        (t.decayedProofCriticalSources || []).length,
    );
    const details = activeTurns.length
      ? activeTurns
          .map((turn) => {
            const rules = (turn.firedHyperedges || [])
              .map(
                (edge) =>
                  `<li><code>${escapeHtml(edge.ruleId)}</code> → <code>${escapeHtml(shortFactLabel(edge.outputFact))}</code></li>`,
              )
              .join('');
            const unvoiced = (turn.derivedUnvoiced || [])
              .map(
                (node) =>
                  `<li><code>${escapeHtml(shortFactLabel(node.fact))}</code>${node.rule ? ` via <code>${escapeHtml(node.rule)}</code>` : ''}</li>`,
              )
              .join('');
            const secret = targetProgress(turn.secret);
            const mirror = targetProgress(turn.mirror);
            return `<details class="logicturn"><summary><span class="mono">t${turn.turn}</span> rules ${turn.counts?.firedHyperedges || 0} · unvoiced ${turn.counts?.derivedUnvoiced || 0} · secret ${secret.held}/${secret.total}${turn.secret?.derived ? ' forced' : ''} · mirror ${mirror.held}/${mirror.total}${turn.mirror?.derived ? ' derived' : ''}</summary>
<div class="logicturn__grid">
<div><strong>rules fired</strong>${rules ? `<ul>${rules}</ul>` : '<p class="mono">none</p>'}</div>
<div><strong>derived but unvoiced</strong>${unvoiced ? `<ul>${unvoiced}</ul>` : '<p class="mono">none</p>'}</div>
<div><strong>path status</strong><p class="mono">secret held ${secret.held}/${secret.total}${turn.secret?.decayedSourcePremiseIds?.length ? ` · decayed ${escapeHtml(turn.secret.decayedSourcePremiseIds.join(', '))}` : ''}<br>mirror held ${mirror.held}/${mirror.total}${turn.mirror?.decayedSourcePremiseIds?.length ? ` · decayed ${escapeHtml(turn.mirror.decayedSourcePremiseIds.join(', '))}` : ''}</p></div>
</div></details>`;
          })
          .join('\n')
      : '<p class="mono">No derived facts or target-path changes were recorded.</p>';

    return `<div class="logicviz">
<svg viewBox="0 0 ${W} ${H}" class="logicviz__svg" role="img" aria-label="Logic projection by turn: fired rules, unvoiced derived facts, secret path, and mirror path">${svg.join('')}</svg>
<p class="slopecap">The logic view is harness-only: it renders the learner board closure from <code>WorldIR.logic</code>. Bar height shows rule firings and unvoiced derivations; path fill shows how many source premises for the secret or mirror are held; ● means the target fact is derived; × marks decayed proof-critical source material.</p>
<div class="logicviz__details">${details}</div>
</div>`;
  }

  const DERIVATION_CSS = `
.wrap{max-width:1020px;margin:0 auto;padding:18px var(--margin) 80px}
.wrap h1{font-family:Fraunces,serif;font-weight:600;font-size:var(--s-4);margin:.3em 0 .15em}
.wrap .lede{color:var(--ink-3);margin:0 0 14px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}
.chip{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);border:1px solid var(--rule);border-radius:4px;padding:2px 8px;background:var(--paper-4)}
.chip--ok{background:var(--moss-soft);border-color:var(--moss);color:var(--moss-deep)}
.chip--bad{background:var(--brick-soft);border-color:var(--brick);color:var(--brick-d)}
.chip--live{background:var(--ochre-soft);border-color:var(--ochre);color:var(--ochre-d)}
.live-panel{border:1px solid var(--rule-soft);border-radius:8px;background:var(--paper-4);padding:12px 14px;margin:12px 0 22px}
.live-panel__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.live-panel__head h2{font-family:Fraunces,serif;font-size:var(--s-2);font-weight:600;margin:0}
.live-panel__meta{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3)}
.live-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;margin-top:10px}
.live-link{display:block;border:1px solid var(--rule-soft);border-radius:6px;background:var(--paper);padding:9px 10px;text-decoration:none;color:var(--ink)}
.live-link:hover{border-color:var(--ochre);background:var(--ochre-soft)}
.live-link b{display:block;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);overflow-wrap:anywhere}
.live-link span{display:block;margin-top:3px;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3)}
.live-progress{height:8px;background:var(--paper-2);border:1px solid var(--rule-soft);border-radius:999px;overflow:hidden;margin:10px 0 6px}
.live-progress i{display:block;height:100%;background:var(--ochre);width:0}
.live-status{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0}
.live-turns{margin-top:14px}
.live-turn{border:1px solid var(--rule-soft);border-radius:7px;background:var(--paper-4);padding:10px 12px;margin:10px 0}
.live-turn__top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3);margin-bottom:5px}
.live-turn__stats{display:flex;flex-wrap:wrap;gap:5px}
.live-pill{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);border:1px solid var(--rule-soft);border-radius:4px;padding:1px 6px;background:var(--paper-2);color:var(--ink-2)}
.live-empty{font-family:"JetBrains Mono",monospace;color:var(--ink-3);background:var(--paper-2);border:1px dashed var(--rule);border-radius:8px;padding:18px;text-align:center}
.egraph{border:1px solid var(--rule);border-radius:8px;background:var(--paper-4);padding:12px 14px;margin:12px 0 18px}
.egraph__h{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-4);margin-bottom:9px}
.egraph__links{display:flex;flex-wrap:wrap;gap:6px}
.egraph__links a{min-height:32px;display:inline-flex;align-items:center;border:1px solid var(--rule);border-radius:4px;background:var(--paper-3);color:var(--moss-deep);padding:3px 9px;text-decoration:none;font-family:"JetBrains Mono",monospace;font-size:var(--s-0)}
.egraph__links a:hover{border-color:var(--moss);background:var(--moss-soft)}
.egraph__meta{margin-top:8px;color:var(--ink-3);font-family:"JetBrains Mono",monospace;font-size:var(--s-0)}
.proofdag{border:1px solid var(--rule);border-radius:8px;background:var(--paper-4);padding:13px 14px;margin:14px 0 22px}
.proofdag__top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
.proofdag__k{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);font-weight:700;text-transform:uppercase;color:var(--ink-4);margin-bottom:5px}
.proofdag h2{font-family:Fraunces,serif;font-weight:600;font-size:var(--s-2);margin:0}
.proofdag__summary{max-width:74ch;color:var(--ink-2);line-height:1.45;margin:7px 0 0}
.proofdag__metrics{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}
.proofdag__metric{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);border:1px solid var(--rule-soft);border-radius:4px;background:var(--paper-2);padding:3px 8px;color:var(--ink-3)}
.proofdag__grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(300px,.9fr);gap:12px;align-items:start;margin-top:12px}
.proofdag__paths{display:grid;gap:9px}
.proofdag__path{border:1px solid var(--rule-soft);border-radius:6px;background:var(--paper);padding:9px 10px}
.proofdag__path h3{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);font-weight:700;margin:0 0 7px;color:var(--ink-2)}
.proofdag__path ol{margin:0;padding-left:1.35em}
.proofdag__path li{margin:6px 0;line-height:1.35}
.proofdag__pid{font-family:"JetBrains Mono",monospace;font-size:.9em;color:var(--moss-deep)}
.proofdag__release{font-family:"JetBrains Mono",monospace;font-size:.84em;color:var(--ink-3)}
.proofdag__surface{display:block;color:var(--ink-2)}
.proofdag__fact{display:block;font-family:"JetBrains Mono",monospace;font-size:.86em;color:var(--ink-3);overflow-wrap:anywhere}
.proofdag__side{border:1px solid var(--rule-soft);border-radius:6px;background:var(--paper);padding:9px 10px;overflow-x:auto}
.proofdag__side h3{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);text-transform:uppercase;color:var(--ink-4);margin:0 0 7px}
.proofdag table{border-collapse:collapse;width:100%;font-size:var(--s-0)}
.proofdag th,.proofdag td{border-bottom:1px solid var(--rule-soft);padding:5px 7px;text-align:left;vertical-align:top}
.proofdag th{font-family:"JetBrains Mono",monospace;color:var(--ink-3);text-transform:uppercase}
.proofdag details{border-top:1px solid var(--rule-soft);padding-top:8px;margin-top:10px}
.proofdag summary{cursor:pointer;font-family:"JetBrains Mono",monospace;color:var(--moss-deep)}
.proofdag__rules{margin:8px 0 0;padding-left:1.15em}
.proofdag__rules li{margin:5px 0;line-height:1.35}
.learnerdag{border:1px solid var(--rule);border-radius:8px;background:var(--paper-4);padding:13px 14px;margin:14px 0 22px}
.learnerdag__k{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);font-weight:700;text-transform:uppercase;color:var(--ink-4);margin-bottom:5px}
.learnerdag h2{font-family:Fraunces,serif;font-weight:600;font-size:var(--s-2);margin:0}
.learnerdag__summary{max-width:74ch;color:var(--ink-2);line-height:1.45;margin:7px 0 0}
.learnerdag__metrics{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}
.learnerdag__metric{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);border:1px solid var(--rule-soft);border-radius:4px;background:var(--paper-2);padding:3px 8px;color:var(--ink-3)}
.learnerdag__grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.8fr);gap:12px;align-items:start}
.learnerdag__panel{border:1px solid var(--rule-soft);border-radius:6px;background:var(--paper);padding:9px 10px;overflow-x:auto}
.learnerdag__panel h3{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);text-transform:uppercase;color:var(--ink-4);margin:0 0 7px}
.learnerdag__nodes{margin:0;padding-left:1.15em}
.learnerdag__nodes li{margin:6px 0;line-height:1.35}
.learnerdag__fact{font-family:"JetBrains Mono",monospace;font-size:.88em;color:var(--moss-deep);overflow-wrap:anywhere}
.learnerdag__status{font-family:"JetBrains Mono",monospace;font-size:.82em;color:var(--ink-3)}
.learnerdag table{border-collapse:collapse;width:100%;font-size:var(--s-0)}
.learnerdag th,.learnerdag td{border-bottom:1px solid var(--rule-soft);padding:5px 7px;text-align:left;vertical-align:top}
.learnerdag th{font-family:"JetBrains Mono",monospace;color:var(--ink-3);text-transform:uppercase}
.vocab{border:1px solid var(--rule);border-radius:8px;background:var(--paper-4);padding:11px 13px;margin:12px 0 20px}
.vocab>summary{cursor:pointer;list-style:none;display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);font-weight:700;text-transform:uppercase;color:var(--ink-4)}
.vocab>summary::-webkit-details-marker{display:none}
.vocab__hint{font-family:"Source Serif 4",Georgia,serif;font-size:var(--s-0);font-weight:400;text-transform:none;color:var(--ink-3)}
.vocab__intro{max-width:78ch;color:var(--ink-2);line-height:1.45;margin:9px 0 10px}
.vocab__layers{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin:10px 0 12px}
.vocab__layer{border:1px solid var(--rule);border-radius:6px;background:var(--paper);padding:9px 10px;min-width:0}
.vocab__layer h3{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);text-transform:uppercase;color:var(--ink);margin:0 0 5px}
.vocab__layer p{margin:0 0 7px;color:var(--ink-3);line-height:1.4}
.vocab__layer .vocab__tokens{gap:4px}
.vocabschema{border:1px solid var(--rule);background:var(--paper-4);border-radius:6px;margin:12px 0;padding:10px}
.vocabschema__head{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;border-bottom:1px solid var(--rule-soft);padding-bottom:9px;margin-bottom:10px}
.vocabschema__head h3{margin:0;font-family:"JetBrains Mono",monospace;font-size:var(--s-1);text-transform:uppercase;color:var(--ink)}
.vocabschema__head p{margin:4px 0 0;color:var(--ink-3);line-height:1.45;max-width:76ch}
.vocabschema__link{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);text-transform:uppercase;color:var(--moss-deep);text-decoration:none;border:1px solid var(--moss);background:var(--moss-soft);border-radius:999px;padding:4px 8px;white-space:nowrap}
.vocabschema__ontology{display:grid;grid-template-columns:minmax(170px,.55fr) minmax(0,1fr);gap:8px;align-items:start;border:1px solid var(--moss);background:var(--moss-soft);border-radius:6px;padding:9px 10px;margin-bottom:10px}
.vocabschema__ontology h4{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);text-transform:uppercase;color:var(--moss-deep);margin:0 0 4px}
.vocabschema__ontology p{margin:0;color:var(--ink-3);line-height:1.35}
.vocabschema__ontology .vocab__token{background:var(--paper);border-color:var(--moss);color:var(--moss-deep)}
.vocabschema__novel{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;margin-bottom:10px}
.vocabschema__acts{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-bottom:10px}
.vocabschema__act{border:1px solid var(--rule-soft);background:var(--paper);border-radius:6px;padding:8px}
.vocabschema__act h4{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);text-transform:uppercase;margin:0 0 5px;color:var(--ink)}
.vocabschema__act p{margin:0 0 7px;color:var(--ink-3);line-height:1.35}
.vocabschema__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:8px}
.concept{border:1px solid var(--rule-soft);background:var(--paper);border-radius:6px;padding:9px;min-width:0}
.concept--novel{border-color:var(--ochre);background:var(--ochre-soft)}
.concept__top{display:flex;gap:6px;align-items:center;justify-content:space-between;margin-bottom:6px}
.concept__label{font-family:"JetBrains Mono",monospace;color:var(--ink);font-size:var(--s-0);font-weight:700}
.concept__layer{font-family:"JetBrains Mono",monospace;font-size:var(--s--1);text-transform:uppercase;color:var(--ink-4);border:1px solid var(--rule-soft);border-radius:999px;padding:1px 5px}
.concept--novel .concept__layer{border-color:var(--ochre);color:var(--ochre-d);background:var(--paper)}
.concept__definition{color:var(--ink-2);line-height:1.4;margin:0 0 7px}
.concept__deflabel,.concept__linkslabel,.concept__ontologylabel{font-family:"JetBrains Mono",monospace;font-size:var(--s--1);text-transform:uppercase;color:var(--ink-4);display:block;margin-bottom:2px}
.concept__meta{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:7px}
.concept__metachip{font-family:"JetBrains Mono",monospace;font-size:var(--s--1);color:var(--ink-4);border:1px solid var(--rule-soft);background:var(--paper-2);border-radius:4px;padding:2px 5px;min-width:0;overflow-wrap:anywhere}
.concept__ontology{margin-bottom:8px}
.concept__ontology a{display:inline-flex;align-items:center;max-width:100%;font-family:"JetBrains Mono",monospace;font-size:var(--s--1);color:var(--moss-deep);text-decoration:none;border:1px solid var(--moss);background:var(--moss-soft);border-radius:4px;padding:2px 5px}
.concept__ontology code{font-family:inherit;white-space:normal;overflow-wrap:anywhere}
.concept__links{display:flex;flex-wrap:wrap;gap:4px}
.concept__linkslabel{flex:0 0 100%}
.concept__edge{font-family:"JetBrains Mono",monospace;font-size:var(--s--1);border:1px solid var(--rule);background:var(--paper-3);color:var(--ink-3);border-radius:999px;padding:2px 6px;max-width:100%;overflow:hidden;text-overflow:ellipsis;text-decoration:none}
.concept__edge b{color:var(--ink)}
.concept--novel .concept__edge{background:var(--paper);border-color:var(--ochre);color:var(--ochre-d)}
.vocabschema__edges{margin-top:10px;border-top:1px solid var(--rule-soft);padding-top:10px}
.vocabschema__edges h4{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);text-transform:uppercase;color:var(--ink-4);margin:0 0 6px}
.vocabschema__edgegrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:5px}
.vocabschema__edge{font-family:"JetBrains Mono",monospace;font-size:var(--s--1);color:var(--ink-3);background:var(--paper);border:1px solid var(--rule-soft);border-radius:6px;padding:5px 7px;min-width:0}
.vocabschema__edge b{color:var(--ink)}
.vocab__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.vocab__group{border:1px solid var(--rule-soft);border-radius:6px;background:var(--paper);padding:9px 10px}
.vocab__group h3{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);text-transform:uppercase;color:var(--ink-4);margin:0 0 6px}
.vocab__group p{margin:0 0 7px;color:var(--ink-3);line-height:1.4}
.vocab__tokens{display:flex;flex-wrap:wrap;gap:5px}
.vocab__token{font-family:"JetBrains Mono",monospace;font-size:.78rem;border:1px solid var(--rule-soft);border-radius:4px;background:var(--paper-2);color:var(--ink-2);padding:2px 6px;overflow-wrap:anywhere;text-decoration:none}
.vocab__token--public{background:var(--moss-soft);border-color:var(--moss);color:var(--moss-deep)}
.vocab__token--warn{background:var(--brick-soft);border-color:var(--brick);color:var(--brick-d)}
.vocab__token--private{background:var(--ochre-soft);border-color:var(--ochre);color:var(--ochre-d)}
@media(max-width:860px){.learnerdag__grid{grid-template-columns:1fr}}
@media(max-width:860px){.proofdag__grid{grid-template-columns:1fr}}
@media(max-width:860px){.vocab__grid{grid-template-columns:1fr}.vocab>summary{display:block}.vocab__hint{display:block;margin-top:3px}.vocabschema__ontology{grid-template-columns:1fr}}
.tts-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:14px 0 18px;padding:9px 10px;border:1px solid var(--rule-soft);border-radius:6px;background:var(--paper-4)}
.tts-toolbar--compact{margin:4px 0 8px}
.tts-control,.tts-btn{border:1px solid var(--rule);background:var(--paper);color:var(--moss-deep);cursor:pointer;font-family:"JetBrains Mono",monospace;text-transform:uppercase}
.tts-control{min-height:28px;padding:5px 10px;font-size:var(--s-0);letter-spacing:.08em}
.tts-btn{margin-right:7px;padding:2px 7px;font-size:10px;letter-spacing:.07em;vertical-align:middle}
.tts-control:hover,.tts-btn:hover{color:var(--brick-d);border-color:var(--brick)}
.tts-check,.tts-status{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3)}
.tts-check{display:inline-flex;gap:5px;align-items:center}
.tts-status[data-state="error"]{color:var(--brick-d)}
pre.panel{background:var(--paper-2);border:1px solid var(--rule-soft);border-radius:6px;padding:12px;overflow-x:auto;font-size:var(--s-0);line-height:1.35}
h2.sect{font-family:Fraunces,serif;font-weight:600;margin:1.7em 0 .4em;font-size:var(--s-3);border-bottom:1px solid var(--rule);padding-bottom:.2em}
.turn{margin:14px 0;padding:10px 14px;border:1px solid var(--rule-soft);border-radius:6px;background:var(--paper-4)}
.turn__n{font-family:"JetBrains Mono",monospace;color:var(--ink-3);font-size:var(--s-0);margin-bottom:4px}
.line{margin:7px 0;transition:background .12s var(--ease),box-shadow .12s var(--ease)}
.line[data-tts-click="1"]{cursor:pointer;border-radius:4px;padding:3px 5px;margin-left:-5px}
.line[data-tts-click="1"]:focus{outline:2px solid color-mix(in srgb,var(--moss) 70%,transparent);outline-offset:2px}
.line[data-tts-click="1"]:hover,.line.is-playing{background:var(--paper-2);box-shadow:inset 3px 0 0 var(--moss)}
.line--director{font-style:italic;color:var(--ink-3)}
.line .who{font-weight:600}
.line--tutor .who{color:var(--moss-deep)}
.line--learner .who{color:var(--indigo)}
.tmeta{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3);margin:2px 0 0 14px}
.tmeta[data-tts-click="1"]{cursor:pointer;border-radius:4px;padding:3px 5px;margin-left:9px}
.tmeta[data-tts-click="1"]:hover,.tmeta.is-playing{background:var(--paper-2);box-shadow:inset 3px 0 0 var(--brick)}
.tmeta .release{color:var(--moss-deep);background:var(--moss-soft);padding:0 5px;border-radius:3px}
.tmeta .assert{color:var(--brick-d);font-weight:600}
.flag{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);margin:6px 0 0 14px;padding:2px 8px;border-radius:4px}
.flag--ok{background:var(--moss-soft);color:var(--moss-deep)}
.flag--bad{background:var(--brick-soft);color:var(--brick-d)}
table.idx{border-collapse:collapse;width:100%;font-size:var(--s-1)}
table.idx th,table.idx td{border-bottom:1px solid var(--rule-soft);padding:8px 10px;text-align:left;vertical-align:top}
table.idx th{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3);text-transform:uppercase;letter-spacing:.06em}
.mono{font-family:"JetBrains Mono",monospace;font-size:var(--s-0)}
.wrap a{color:var(--moss-deep)}
.sect__intent{display:block;font-family:"Source Serif 4",Georgia,serif;font-style:italic;font-weight:400;font-size:var(--s-1);color:var(--ink-3);margin-top:2px}
details.figdef{display:inline}
details.figdef summary{display:inline;cursor:pointer;list-style:none;text-decoration:underline dotted;text-underline-offset:2px}
details.figdef summary::-webkit-details-marker{display:none}
details.figdef[open] summary{color:var(--moss-deep)}
.figdef__t{display:block;margin:4px 0 2px;padding:5px 9px;border-left:2px solid var(--moss);background:var(--paper-2);color:var(--ink-2);font-style:italic;max-width:62ch;white-space:normal}
.mdblock{max-width:74ch}
.mdblock p{margin:.55em 0;line-height:1.55}
.mdblock ul{margin:.4em 0 .4em 1.2em;padding:0}
.mdblock li{margin:.25em 0;line-height:1.5}
.mdblock code{font-family:"JetBrains Mono",monospace;font-size:.9em;background:var(--paper-2);border:1px solid var(--rule-soft);border-radius:3px;padding:0 4px}
.mdblock h3,.mdblock h4{font-family:Fraunces,serif;font-weight:600;margin:1.1em 0 .3em}
.mdblock table{border-collapse:collapse;margin:.6em 0;font-size:var(--s-1)}
.mdblock th,.mdblock td{border-bottom:1px solid var(--rule-soft);padding:5px 10px;text-align:left}
.mdblock th{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3);text-transform:uppercase;letter-spacing:.06em}
.mdblock blockquote{margin:.6em 0;padding:2px 12px;border-left:2px solid var(--rule);color:var(--ink-3);font-style:italic}
.mdblock--notice{font-family:"Source Serif 4",Georgia,serif;font-size:var(--s-2)}
.mdblock--notice p{line-height:1.62}
.mdblock--notice blockquote{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);font-style:normal}
.fact{font-family:"JetBrains Mono",monospace;font-size:.88em;color:var(--moss-deep);white-space:nowrap}
svg.arc{display:block;width:100%;height:auto;margin:6px 0 2px;background:var(--paper-4);border:1px solid var(--rule-soft);border-radius:6px}
.arc text{font-family:"JetBrains Mono",monospace;font-size:10.5px;fill:var(--ink-3)}
.arc__band{fill:var(--rule-soft);fill-opacity:.28}
.arc__bandlabel{font-size:11px;fill:var(--ink-2)}
.arc__grid{stroke:var(--rule-soft);stroke-width:1}
.arc__tick{font-size:10px}
.arc__d{fill:none;stroke:var(--moss-deep);stroke-width:2.2;stroke-linejoin:round}
.arc__dot{fill:var(--moss-deep)}
.arc__dot--forced{fill:var(--indigo)}
.arc__forced{stroke:var(--indigo);stroke-width:1.2;stroke-dasharray:4 3}
.arc__forcedlabel{fill:var(--indigo);font-size:10.5px}
.arc__rel{fill:var(--moss-deep);font-size:11px;cursor:default}
.arc__flag{font-size:12px;cursor:default}
.arc__flag--ok{fill:var(--moss-deep)}
.arc__flag--bad{fill:var(--brick-d)}
.arc__star{fill:var(--brick-d);font-size:16px;cursor:default}
.slopecap{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3);margin:4px 0 0}
.notice-missing{color:var(--ink-3);font-style:italic}
.logicviz{margin:8px 0 20px}
.logicviz__svg{display:block;width:100%;height:auto;margin:6px 0 4px;background:var(--paper-4);border:1px solid var(--rule-soft);border-radius:6px}
.logicviz__label,.logicviz__tick{font-family:"JetBrains Mono",monospace;font-size:10px;fill:var(--ink-3)}
.logicviz__label{fill:var(--ink-2)}
.logicviz__rule{stroke:var(--rule-soft);stroke-width:1}
.logicviz__active{fill:var(--ochre-soft);fill-opacity:.38}
.logicviz__bar{rx:2}
.logicviz__bar--rules{fill:var(--moss-deep)}
.logicviz__bar--unvoiced{fill:var(--brick)}
.logicviz__path{fill:var(--paper-2);stroke:var(--rule);stroke-width:1}
.logicviz__pathfill{opacity:.75}
.logicviz__pathfill--secret{fill:var(--indigo)}
.logicviz__pathfill--mirror{fill:var(--ochre)}
.logicviz__decay{font-family:"JetBrains Mono",monospace;font-size:16px;fill:var(--brick-d)}
.logicviz__derived{font-family:"JetBrains Mono",monospace;font-size:13px;fill:var(--paper)}
.logicviz__details{margin-top:10px}
.logicturn{border:1px solid var(--rule-soft);border-radius:6px;background:var(--paper-4);margin:7px 0;padding:7px 10px}
.logicturn summary{cursor:pointer;color:var(--ink-2)}
.logicturn__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:8px}
.logicturn__grid strong{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);text-transform:uppercase;letter-spacing:.04em;color:var(--ink-3)}
.logicturn__grid ul{margin:.35em 0 0 1.15em;padding:0}
.logicturn__grid li{margin:.2em 0;line-height:1.35}
@media (max-width:760px){.logicturn__grid{grid-template-columns:1fr}.logicviz__svg{min-width:760px}.logicviz{overflow-x:auto}}
/* ── derivation index: scoreboard · toolbar · readability panel · win flags ── */
.wrap--wide{max-width:1180px}
.idx-scoreboard{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 14px}
.idx-tally{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);border:1px solid var(--rule);border-radius:5px;padding:3px 10px;background:var(--paper-4);color:var(--ink-2)}
.idx-tally b{color:var(--ink);font-size:var(--s-1)}
.idx-tally--win{background:var(--ochre-soft);border-color:var(--ochre);color:var(--ochre-d)}
.idx-tally--win b{color:var(--ochre-d)}
.idx-tools{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 18px;padding:10px 12px;border:1px solid var(--rule-soft);border-radius:8px;background:var(--paper-4)}
.idx-search{flex:1 1 220px;min-width:160px;min-height:40px;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);padding:6px 10px;border:1px solid var(--rule);border-radius:5px;background:var(--paper);color:var(--ink)}
.idx-search:focus{outline:2px solid color-mix(in srgb,var(--ochre) 55%,transparent);outline-offset:1px;border-color:var(--ochre)}
.idx-seg{display:inline-flex;border:1px solid var(--rule);border-radius:5px;overflow:hidden}
.idx-seg button{min-height:40px;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);text-transform:uppercase;letter-spacing:.05em;padding:5px 11px;border:0;border-right:1px solid var(--rule);background:var(--paper);color:var(--ink-3);cursor:pointer;transition:background .12s var(--ease),color .12s var(--ease)}
.idx-seg button:last-child{border-right:0}
.idx-seg button:hover{color:var(--ink)}
.idx-seg button.is-on{background:var(--ochre-soft);color:var(--ochre-d)}
.idx-check,.idx-sort{display:inline-flex;align-items:center;gap:6px;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3)}
.idx-sort select{min-height:40px;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);padding:5px 8px;border:1px solid var(--rule);border-radius:5px;background:var(--paper);color:var(--ink)}
.idx-count{margin-left:auto;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3)}
.idx-flatcount{margin:0 0 6px}
.idx-empty{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3);background:var(--paper-2);border:1px dashed var(--rule);border-radius:8px;padding:18px;text-align:center;margin:6px 0 24px}
.idx-panel{background:var(--paper-2);border:1px solid var(--rule-soft);border-radius:8px;padding:2px 12px;margin:6px 0 24px;overflow-x:auto}
.idx-group>summary{min-height:40px;display:flex;align-items:center;gap:8px;cursor:pointer;list-style:none}
.idx-group>summary::-webkit-details-marker{display:none}
.idx-group-card{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:8px 0 10px}
.idx-gm{border:1px solid var(--rule-soft);background:var(--paper-4);border-radius:6px;padding:9px 10px;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3)}
.idx-gm b{display:block;color:var(--ink);font-size:var(--s-1);margin-bottom:2px}
.idx-gm a{color:var(--moss-deep);text-decoration:none;overflow-wrap:anywhere}
.idx-gm a:hover{text-decoration:underline}
.dcompare{border:1px solid var(--rule);border-radius:8px;background:var(--paper-4);padding:12px 14px;margin:0 0 18px}
.dcompare__head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.dcompare__head h2{font-family:Fraunces,serif;font-size:var(--s-2);font-weight:600;margin:0;color:var(--ink)}
.dcompare__head a{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--moss-deep)}
.dcompare__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dcompare__card{border:1px solid var(--rule-soft);border-radius:7px;background:var(--paper);padding:10px 12px;min-width:0}
.dcompare__title{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);font-weight:700;overflow-wrap:anywhere;margin-bottom:7px}
.dcompare__meta{display:flex;flex-wrap:wrap;gap:6px;margin:7px 0}
.dcompare__line{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3);line-height:1.5}
.dcompare__summary{font-family:"Source Serif 4",Georgia,serif;font-size:var(--s-1);line-height:1.5;color:var(--ink-2);margin-top:8px}
@media(max-width:860px){.idx-group-card{grid-template-columns:1fr 1fr}}
@media(max-width:860px){.dcompare__grid{grid-template-columns:1fr}}
@media(max-width:520px){.idx-group-card{grid-template-columns:1fr}}
/* runs table: fixed columns (colgroup-driven) + tokens that wrap inside cells */
table.idx--runs{table-layout:fixed}
table.idx--runs td{overflow-wrap:anywhere}
table.idx--runs th,table.idx--runs td{padding-left:8px;padding-right:8px}
/* headers stay whole-word (no mid-word breaks) and crisp/dark, not pale */
table.idx--runs thead th{vertical-align:bottom;white-space:normal;overflow-wrap:normal;word-break:normal;font-size:0.68rem;letter-spacing:.03em;line-height:1.22;color:var(--ink-2);border-bottom:1px solid var(--rule)}
table.idx--runs tbody tr.idx-row td{border-bottom:0;padding-bottom:4px}
/* full-width summary caption row beneath each run */
.idx-sum td{padding:2px 12px 12px 16px;border-bottom:1px solid var(--rule-soft)}
.idx-sum .run-summary{display:block;margin:0;max-width:84ch;font-family:"Source Serif 4",Georgia,serif;font-size:var(--s-1);color:var(--ink-2);line-height:1.5}
tr.idx-sum--win{box-shadow:inset 3px 0 0 var(--ochre);background:color-mix(in srgb,var(--ochre-soft) 32%,transparent)}
tr.idx-sum--win.is-alt{background:color-mix(in srgb,var(--ochre-soft) 52%,transparent)}
/* compressed backend cell: model + the roles that used it */
.bk{display:block}
.bk__m{color:var(--ink-2)}
.bk__r{color:var(--ink-3)}
table.idx tbody tr.idx-row{transition:background .12s var(--ease)}
table.idx tbody tr.is-alt{background:color-mix(in srgb,var(--linen) 15%,transparent)}
table.idx tbody tr.idx-row:hover{background:var(--paper-4)}
tr.idx-row--win{box-shadow:inset 3px 0 0 var(--ochre);background:color-mix(in srgb,var(--ochre-soft) 32%,transparent)}
tr.idx-row--win.is-alt{background:color-mix(in srgb,var(--ochre-soft) 52%,transparent)}
tr.idx-row--win:hover{background:color-mix(in srgb,var(--ochre-soft) 62%,transparent)}
.idx-legend summary{min-height:40px;display:flex;align-items:center}
.run-name{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);font-weight:600}
.run-summary{display:block;margin-top:3px;font-family:"Source Serif 4",Georgia,serif;font-size:var(--s-0);color:var(--ink-3);line-height:1.42;max-width:48ch;white-space:normal}
/* outcome badge: one distinct treatment per verdict, with a leading status dot */
.vchip{display:inline-flex;align-items:center;gap:5px;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);font-weight:600;border:1px solid var(--rule);border-radius:5px;padding:2px 9px 2px 7px;white-space:nowrap}
.vchip::before{content:"";flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:currentColor}
.vchip--grounded{background:var(--ochre-soft);border-color:var(--ochre);color:var(--ochre-d)}
.vchip--disengaged{background:color-mix(in srgb,var(--ink-3) 14%,var(--paper));border-color:var(--ink-4);color:var(--ink-2)}
.vchip--impasse{background:var(--brick-soft);border-color:var(--brick);color:var(--brick-d)}
.dvscore{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-2)}
.dvscore--win{color:var(--ochre-d);font-weight:600}
.dvscore__bar{display:inline-block;width:34px;height:6px;border-radius:3px;background:var(--paper-3);border:1px solid var(--rule-soft);vertical-align:middle;margin-left:6px;overflow:hidden}
.dvscore__bar i{display:block;height:100%;background:var(--ochre)}
.winflag{margin-left:5px}
.when{white-space:nowrap;line-height:1.32}
.when__t{color:var(--ink-3)}
@media (max-width:760px){.idx-sum{display:none}}
`;

  // The three verdicts the deterministic checker emits, in plain words. The win
  // is grounded_anagnorisis (the learner reached the secret and its proof closed);
  // the other two are the failure taxonomy.
  const DERIVATION_VERDICT_LABEL = {
    grounded_anagnorisis: 'grounded',
    disengagement: 'disengaged',
    aporia: 'impasse',
  };
  // Each verdict gets its own badge treatment so the two failure modes
  // (disengaged vs impasse) no longer collapse into one undifferentiated red.
  const DERIVATION_VERDICT_CLASS = {
    grounded_anagnorisis: 'vchip--grounded',
    disengagement: 'vchip--disengaged',
    aporia: 'vchip--impasse',
  };

  // One plain-language sentence per run, leading with the outcome — for readers
  // who don't carry the jargon. Deterministic facts only (no judge): the verdict,
  // how far the proof got (D counts the premises still missing; d0 is the full
  // set, so d0−dFinal is how many were established), and how the scheduled
  // evidence reveals landed.
  function derivationPlainSummary(d) {
    const slope = d.learningSlope || {};
    const d0 = typeof slope.d0 === 'number' ? slope.d0 : null;
    const dFinal = typeof slope.dFinal === 'number' ? slope.dFinal : null;
    const grounded = d0 !== null && dFinal !== null ? d0 - dFinal : null;
    const steps = grounded !== null ? `${grounded} of ${d0} proof step${d0 === 1 ? '' : 's'} established` : null;
    const adherence = d.releaseAdherence || {};
    const devs = adherence.deviations?.length || 0;
    const cues =
      typeof adherence.onCue === 'number'
        ? `${adherence.onCue} planned reveal${adherence.onCue === 1 ? '' : 's'} on cue${devs ? `, ${devs} off-schedule` : ''}`
        : null;
    const turn = d.turnsPlayed ?? '?';
    let lead;
    if (d.verdict === 'grounded_anagnorisis') {
      lead = `The learner reached the hidden answer at turn ${d.assertedGroundedTurn ?? turn} and the proof closed`;
    } else if (d.verdict === 'disengagement') {
      lead = `The learner disengaged at turn ${turn}, before the proof closed`;
    } else if (d.verdict === 'aporia') {
      lead = `The dialogue reached an impasse at turn ${turn} with no way forward`;
    } else {
      lead = `Run ended at turn ${turn}`;
    }
    const tail = [steps, cues].filter(Boolean).join('; ');
    return tail ? `${lead} — ${tail}.` : `${lead}.`;
  }

  // The deterministic "score": proof steps established (d0−dFinal) out of d0, with
  // a 🏁 + completion bar when the proof actually closed (dFinal 0 = a win). Not a
  // judge's rating — it reads straight off the D-curve. Returns the cell HTML plus
  // the integer value the client uses to sort by "most proof steps".
  function derivationScoreCell(d) {
    const slope = d.learningSlope || {};
    const d0 = typeof slope.d0 === 'number' ? slope.d0 : null;
    const dFinal = typeof slope.dFinal === 'number' ? slope.dFinal : null;
    if (d0 === null || dFinal === null || d0 <= 0) {
      return { html: '<span class="dvscore">—</span>', value: -1 };
    }
    const grounded = d0 - dFinal;
    const pct = Math.max(0, Math.min(100, Math.round((grounded / d0) * 100)));
    const win = dFinal === 0;
    const flag = win ? ' <span class="winflag" title="proof closed">🏁</span>' : '';
    const html = `<span class="dvscore${win ? ' dvscore--win' : ''}" title="${grounded} of ${d0} proof steps established">${grounded}/${d0}${flag}<span class="dvscore__bar"><i style="width:${pct}%"></i></span></span>`;
    return { html, value: grounded };
  }

  // When the run finished, from the diagnosis artifact's mtime (no wall-clock
  // stamp is written into the run). Compact two lines — "Jun 12, 2026" over the
  // HH:MM — with the full ISO timestamp on hover; value is the epoch ms the client
  // sorts on.
  const DERIVATION_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function derivationWhenCell(mtimeMs) {
    if (!mtimeMs) return { html: '<span class="mono">—</span>', value: 0 };
    const dt = new Date(mtimeMs);
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${DERIVATION_MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
    const time = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    const html = `<span class="when" title="${escapeHtml(dt.toISOString())}">${date}<br><span class="when__t">${time}</span></span>`;
    return { html, value: mtimeMs };
  }

  // Client wiring for the index: live search, outcome filter, real-only toggle,
  // and sort — all in-page over the rows already rendered (no fetch). Each section
  // (experimental group) sorts and zebra-stripes independently; a group with no
  // matching rows hides itself, and the toolbar shows a live shown/grounded count.
  const DERIVATION_INDEX_CLIENT = `<script>
(function () {
  var root = document.querySelector('[data-derivation-index]');
  if (!root) return;
  var search = root.querySelector('.idx-search');
  var seg = [].slice.call(root.querySelectorAll('.idx-seg button'));
  var realChk = root.querySelector('.idx-real');
  var sortSel = root.querySelector('.idx-sortsel');
  var countEl = root.querySelector('[data-idx-count]');
  var emptyEl = root.querySelector('[data-idx-empty]');
  var sections = [].slice.call(root.querySelectorAll('.idx-group'));
  var verdict = 'all';
  var WIN = 'grounded_anagnorisis';
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function rowsOf(sec) { return [].slice.call(sec.querySelectorAll('tr.idx-row')); }
  function matches(tr) {
    var q = (search && search.value || '').trim().toLowerCase();
    if (q && (tr.dataset.label || '').indexOf(q) < 0) return false;
    if (verdict !== 'all' && tr.dataset.verdict !== verdict) return false;
    if (realChk && realChk.checked && tr.dataset.mode !== 'real') return false;
    return true;
  }
  function compare(key, a, b) {
    var ord = num(a.dataset.ord) - num(b.dataset.ord);
    if (key === 'wins') {
      var aw = a.dataset.verdict === WIN ? 0 : 1;
      var bw = b.dataset.verdict === WIN ? 0 : 1;
      return (aw - bw) || ord;
    }
    if (key === 'score') return (num(b.dataset.score) - num(a.dataset.score)) || ord;
    if (key === 'turns') return (num(a.dataset.turns) - num(b.dataset.turns)) || ord;
    if (key === 'cost') return (num(b.dataset.cost) - num(a.dataset.cost)) || ord;
    if (key === 'label') {
      var an = a.dataset.name || '', bn = b.dataset.name || '';
      return an < bn ? -1 : an > bn ? 1 : 0;
    }
    return ord;
  }
  // Order the GROUP sections for the current key, using each section's best
  // visible run — so the whole page reorders, not just rows within a group.
  // (Without this, sorting only shuffles rows inside each of the ~20 condition
  // groups and the page looks unchanged.) Ties fall back to recency (min ord).
  function compareSection(key, a, b) {
    if (key === 'wins') return (b.wins - a.wins) || (a.ord - b.ord);
    if (key === 'score') return (b.score - a.score) || (a.ord - b.ord);
    if (key === 'turns') return (a.turns - b.turns) || (a.ord - b.ord);
    if (key === 'cost') return (b.cost - a.cost) || (a.ord - b.ord);
    if (key === 'label') return a.group < b.group ? -1 : a.group > b.group ? 1 : 0;
    return a.ord - b.ord;
  }
  // Each run renders as two rows: the data row (.idx-row) and a full-width
  // summary caption row (.idx-sum) right after it. Stash the caption on its
  // data row so sort/filter/striping move and hide them together as one unit.
  sections.forEach(function (sec) {
    rowsOf(sec).forEach(function (tr) {
      var nx = tr.nextElementSibling;
      tr.sumRow = nx && nx.classList && nx.classList.contains('idx-sum') ? nx : null;
    });
  });
  function apply() {
    var key = sortSel ? sortSel.value : 'recent';
    var shown = 0, wins = 0;
    var stats = sections.map(function (sec) {
      var tbody = sec.querySelector('tbody');
      var rows = rowsOf(sec);
      rows.sort(function (a, b) { return compare(key, a, b); });
      rows.forEach(function (tr) { tbody.appendChild(tr); if (tr.sumRow) tbody.appendChild(tr.sumRow); });
      var visible = 0, secWins = 0, alt = false;
      var agg = { ord: Infinity, wins: 0, score: -1, turns: Infinity, cost: -1, group: sec.getAttribute('data-group') || '' };
      rows.forEach(function (tr) {
        var ok = matches(tr);
        tr.hidden = !ok;
        tr.classList.remove('is-alt');
        if (tr.sumRow) { tr.sumRow.hidden = !ok; tr.sumRow.classList.remove('is-alt'); }
        if (!ok) return;
        visible += 1; shown += 1;
        if (alt) { tr.classList.add('is-alt'); if (tr.sumRow) tr.sumRow.classList.add('is-alt'); }
        alt = !alt;
        agg.ord = Math.min(agg.ord, num(tr.dataset.ord));
        agg.score = Math.max(agg.score, num(tr.dataset.score));
        agg.turns = Math.min(agg.turns, num(tr.dataset.turns));
        agg.cost = Math.max(agg.cost, num(tr.dataset.cost));
        if (tr.dataset.verdict === WIN) { wins += 1; secWins += 1; agg.wins += 1; }
      });
      sec.hidden = visible === 0;
      var counter = sec.querySelector('[data-sec-count]');
      if (counter) counter.textContent = visible + (visible === 1 ? ' run' : ' runs') + (secWins ? ' \\u00b7 ' + secWins + ' grounded' : '');
      return agg;
    });
    if (sections.length > 1 && sections[0].parentNode) {
      var parent = sections[0].parentNode;
      stats
        .map(function (agg, i) { return { agg: agg, sec: sections[i] }; })
        .sort(function (a, b) { return compareSection(key, a.agg, b.agg); })
        .forEach(function (s) { parent.appendChild(s.sec); });
    }
    if (emptyEl) emptyEl.hidden = shown !== 0;
    if (countEl) countEl.textContent = shown + ' shown \\u00b7 ' + wins + ' grounded';
  }
  if (search) search.addEventListener('input', apply);
  if (realChk) realChk.addEventListener('change', apply);
  if (sortSel) sortSel.addEventListener('change', apply);
  seg.forEach(function (b) {
    b.addEventListener('click', function () {
      verdict = b.dataset.verdict;
      seg.forEach(function (x) {
        var on = x === b;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      apply();
    });
  });
  // Seed the outcome filter from ?verdict= so the dashboard Signal chart can
  // deep-link into one outcome (e.g. /derivation?verdict=aporia). Only a value
  // matching one of the toggle buttons is honoured; anything else stays 'all'.
  try {
    var qv = new URL(window.location.href).searchParams.get('verdict');
    var match = qv && seg.filter(function (b) { return b.dataset.verdict === qv; })[0];
    if (match) {
      verdict = qv;
      seg.forEach(function (x) {
        var on = x === match;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
  } catch (_e) {
    /* malformed URL — leave the filter at 'all' */
  }
  apply();
})();
</script>`;

  function liveStatusChip(live) {
    const status = live.effectiveStatus || live.status || 'running';
    const cls =
      status === 'complete' ? 'chip--ok' : status === 'failed' || status === 'stale' ? 'chip--bad' : 'chip--live';
    return `<span class="chip ${cls}">${escapeHtml(status)}</span>`;
  }

  function publicDerivationLine(line) {
    return line.role !== 'director' || line.meta?.release || line.meta?.phase?.name;
  }

  function liveProgress(live) {
    const turnCap = Number(live.turnCap || 0);
    const turns = Array.isArray(live.turns) ? live.turns.length : 0;
    const pct = turnCap ? Math.max(0, Math.min(100, Math.round((turns / turnCap) * 100))) : 0;
    return { turns, turnCap, pct };
  }

  function renderDerivationLivePanel(liveRuns) {
    const runs = (liveRuns || []).filter((run) => run.effectiveStatus !== 'complete');
    if (!runs.length) return '';
    const items = runs
      .slice(0, 8)
      .map((run) => {
        const p = liveProgress(run);
        const latest = run.latest ? `t${run.latest.turn} D=${run.latest.D}` : 'awaiting first turn';
        return `<a class="live-link" href="/derivation/${encodeURIComponent(run.label)}">
<b>${escapeHtml(run.label)}</b>
<span>${escapeHtml(run.effectiveStatus || run.status || 'running')} · ${escapeHtml(latest)} · ${p.turns}/${p.turnCap || '?'} turns</span>
</a>`;
      })
      .join('\n');
    return `<section class="live-panel" aria-label="Live derivation runs">
<div class="live-panel__head">
<h2>Live runs</h2>
<a class="mono" href="/derivation/live">all live artifacts</a>
</div>
<div class="live-list">${items}</div>
</section>`;
  }

  function renderDerivationLiveIndexHtml(runs) {
    const body = runs.length
      ? `<div class="live-list">${runs
          .map((run) => {
            const p = liveProgress(run);
            const latest = run.latest ? `t${run.latest.turn} D=${run.latest.D}` : 'awaiting first turn';
            const when = derivationWhenCell(run.mtimeMs);
            return `<a class="live-link" href="/derivation/${encodeURIComponent(run.label)}">
<b>${escapeHtml(run.label)}</b>
<span>${liveStatusChip(run)} ${escapeHtml(latest)} · ${p.turns}/${p.turnCap || '?'} turns · updated ${when.html}</span>
</a>`;
          })
          .join('\n')}</div>`
      : '<p class="live-empty">No live derivation artifacts found.</p>';
    return `${pageHead({ title: 'Live derivation runs · machine spirits', css: DERIVATION_CSS })}
<body>
${railHtml({
  active: 'derivation',
  sub: 'live proof runs',
  hint: '<span><b>live proof runs</b> — read-only progress artifacts from run-derivation-loop.js</span><span class="navhint__sep">·</span><span>finished runs are under <a href="/derivation">proof runs</a></span>',
})}
<main class="wrap wrap--wide">
<p class="mono" style="margin-top:14px"><a href="/derivation">← proof runs</a></p>
<h1>Live proof runs</h1>
<p class="lede">These rows read <span class="mono">live.json</span> artifacts under <span class="mono">exports/dramatic-derivation/loop/</span>. They do not attach to running processes or start paid work.</p>
${body}
</main>
</body></html>`;
  }

  function renderDerivationLiveRunClient(initial) {
    return `<script>
(function () {
  var state = ${safeJsonForScript(initial)};
  var root = document.querySelector('[data-live-run]');
  if (!root) return;
  var label = root.getAttribute('data-label') || (state && state.label) || '';
  var fallbackTimer = null;
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function statusClass(status) {
    if (status === 'complete') return 'chip--ok';
    if (status === 'failed' || status === 'stale') return 'chip--bad';
    return 'chip--live';
  }
  function roleLabel(role) {
    if (role === 'tutor') return 'Tutor';
    if (role === 'learner') return 'Learner';
    if (role === 'stage') return 'Stage';
    if (role === 'director') return 'Director';
    return role || 'Role';
  }
  function lineHtml(line) {
    var role = line.role || '';
    var cls = role === 'tutor' ? 'line--tutor' : role === 'learner' ? 'line--learner' : (role === 'director' || role === 'stage') ? 'line--director' : '';
    var out = '<div class="line ' + cls + '"><span class="who">' + esc(roleLabel(role)) + ':</span> ' + esc(line.text || '') + '</div>';
    var delib = line.meta && line.meta.deliberation;
    if (delib && delib.note) out += '<div class="tmeta">- second voice: ' + esc(delib.note) + '</div>';
    return out;
  }
  function turnHtml(turn) {
    var stats = [
      'D=' + esc(turn.D),
      turn.forced ? 'forced' : '',
      turn.released && turn.released.length ? 'release ' + turn.released.map(esc).join(', ') : '',
      turn.adopted ? '+' + turn.adopted + ' adopted' : '',
      turn.retracted ? '-' + turn.retracted + ' retracted' : '',
      turn.derived ? '+' + turn.derived + ' voiced' : '',
      turn.overreached ? turn.overreached + ' overreach' : '',
      turn.intervened ? 'superego' : '',
      turn.asserted ? 'asserts' : '',
      turn.decayedNow && turn.decayedNow.length ? 'decay ' + turn.decayedNow.map(esc).join(', ') : '',
      turn.repairedNow && turn.repairedNow.length ? 'repair ' + turn.repairedNow.map(esc).join(', ') : '',
      turn.endedBy ? 'ends ' + esc(turn.endedBy) : ''
    ].filter(Boolean).map(function (x) { return '<span class="live-pill">' + x + '</span>'; }).join('');
    var phase = turn.phase && turn.phase.name ? '<span class="live-pill">' + esc(turn.phase.name) + '</span>' : '';
    var events = (turn.events || []).map(function (event) {
      return '<span class="flag flag--bad">flag ' + esc(event.type) + (event.detail ? ' - ' + esc(event.detail) : '') + '</span>';
    }).join('');
    var lines = (turn.lines || []).map(lineHtml).join('');
    return '<section class="live-turn"><div class="live-turn__top"><span>turn ' + esc(turn.turn) + '</span><span class="live-turn__stats">' + phase + stats + '</span></div>' + lines + events + '</section>';
  }
  function render(live) {
    var turns = live && Array.isArray(live.turns) ? live.turns : [];
    var turnCap = Number(live && live.turnCap || 0);
    var pct = turnCap ? Math.max(0, Math.min(100, Math.round((turns.length / turnCap) * 100))) : 0;
    var status = (live && (live.effectiveStatus || live.status)) || 'running';
    var latest = live && live.latest ? 'latest t' + live.latest.turn + ' D=' + live.latest.D : 'awaiting first turn';
    var doneLink = live && live.completeAvailable ? '<a class="mono" href="/derivation/' + encodeURIComponent(label) + '">open finished artifact</a>' : '';
    root.innerHTML =
      '<div class="live-status"><span class="chip ' + statusClass(status) + '">' + esc(status) + '</span>' +
      '<span class="chip">world ' + esc(live && live.worldId || '?') + '</span>' +
      '<span class="chip">' + esc(latest) + '</span>' +
      '<span class="chip">updated ' + esc(live && live.updatedAt || '?') + '</span>' +
      doneLink + '</div>' +
      '<div class="live-progress" aria-label="turn progress"><i style="width:' + pct + '%"></i></div>' +
      '<p class="live-panel__meta">' + turns.length + '/' + (turnCap || '?') + ' turns recorded from ' + esc(live && live.scriptPath || '?') + '</p>' +
      '<div class="live-turns">' + (turns.length ? turns.map(turnHtml).join('') : '<p class="live-empty">Waiting for the first completed turn.</p>') + '</div>';
  }
  async function poll() {
    try {
      var res = await fetch('/api/derivation/live/' + encodeURIComponent(label), { cache: 'no-store' });
      if (!res.ok) return;
      var json = await res.json();
      state = json.run;
      render(state);
    } catch (_e) {}
  }
  function startPolling() {
    if (fallbackTimer) return;
    fallbackTimer = setInterval(poll, 1500);
  }
  render(state);
  if (window.EventSource) {
    var es = new EventSource('/api/derivation/live/' + encodeURIComponent(label) + '/events');
    es.addEventListener('update', function (event) {
      state = JSON.parse(event.data);
      render(state);
      if (state.effectiveStatus === 'complete' || state.effectiveStatus === 'failed') es.close();
    });
    es.onerror = function () {
      es.close();
      startPolling();
    };
  } else {
    startPolling();
  }
})();
</script>`;
  }

  function renderDerivationLiveRunHtml(live) {
    return `${pageHead({ title: `${live.label} · live derivation`, css: DERIVATION_CSS })}
<body>
${railHtml({
  active: 'derivation',
  sub: `live proof run — ${live.label}`,
  hint: `<span><b>live proof run</b> — ${escapeHtml(live.label)}</span><span class="navhint__sep">·</span><span>back to <a href="/derivation/live">live runs</a> or <a href="/derivation">finished proof runs</a></span>`,
})}
<main class="wrap">
<p class="mono" style="margin-top:14px"><a href="/derivation/live">← live runs</a></p>
<h1>${escapeHtml(live.worldTitle || live.worldId || live.label)}</h1>
<p class="lede mono">${escapeHtml(live.label)} · ${escapeHtml(live.backend?.mode || '?')} · live artifact ${escapeHtml(live.worldPath || '?')}</p>
<section class="live-panel" data-live-run data-label="${escapeHtml(live.label)}">
<p class="live-empty">Loading live run...</p>
</section>
</main>
${renderDerivationLiveRunClient(live)}
</body></html>`;
  }

  function derivationCompareLabels(query = {}) {
    const labels = [];
    const add = (value) => {
      if (Array.isArray(value)) {
        value.forEach(add);
        return;
      }
      String(value || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .forEach((v) => labels.push(v));
    };
    add(query.compare);
    add(query.left);
    add(query.right);
    return [...new Set(labels)];
  }

  function renderDerivationComparePanel(runs, query = {}) {
    const byLabel = new Map(runs.map((r) => [r.label, r]));
    const picked = derivationCompareLabels(query)
      .map((label) => byLabel.get(label))
      .filter(Boolean);
    if (picked.length === 1) {
      const first = picked[0];
      const sameGroup = runs.filter(
        (r) => r.label !== first.label && (r.diagnosis.group || '') === (first.diagnosis.group || ''),
      );
      const opposite =
        sameGroup.find((r) => r.diagnosis.verdict !== first.diagnosis.verdict) ||
        runs.find((r) => r.label !== first.label && r.diagnosis.verdict !== first.diagnosis.verdict) ||
        runs.find((r) => r.label !== first.label);
      if (opposite) picked.push(opposite);
    }
    if (picked.length < 2) return '';
    const pair = picked.slice(0, 2);
    const href = `/derivation?compare=${pair.map((r) => encodeURIComponent(r.label)).join(',')}`;
    const eventText = (d) =>
      Object.entries(d.eventsByType || {})
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
        .slice(0, 5)
        .map(([event, count]) => `${event}×${count}`)
        .join(', ') || 'no events';
    const card = (run) => {
      const d = run.diagnosis || {};
      const verdictClass = DERIVATION_VERDICT_CLASS[d.verdict] || 'vchip--disengaged';
      const verdictLabel = DERIVATION_VERDICT_LABEL[d.verdict] || d.verdict || '?';
      const score = derivationScoreCell(d).html;
      const adherence = d.releaseAdherence || {};
      return `<article class="dcompare__card">
      <div class="dcompare__title"><a href="/derivation/${encodeURIComponent(run.label)}">${escapeHtml(run.label)}</a></div>
      <div class="dcompare__meta"><span class="vchip ${verdictClass}">${escapeHtml(verdictLabel)}</span>${score}</div>
      <div class="dcompare__line">group ${escapeHtml(d.group || '(ungrouped)')} · backend ${derivationBackendCell(d.backend)}</div>
      <div class="dcompare__line">turns ${escapeHtml(d.turnsPlayed ?? '?')}/${escapeHtml(d.turnCap ?? '?')} · forced ${escapeHtml(d.firstForcedTurn ?? '—')} → asserted ${escapeHtml(d.assertedGroundedTurn ?? '—')}</div>
      <div class="dcompare__line">releases ${escapeHtml(adherence.onCue ?? '—')} on cue · ${(adherence.deviations || []).length} dev · ${(adherence.missed || []).length} missed</div>
      <div class="dcompare__line">events ${escapeHtml(eventText(d))}</div>
      <div class="dcompare__summary">${escapeHtml(derivationPlainSummary(d))}</div>
    </article>`;
    };
    return `<section class="dcompare" id="compare">
    <div class="dcompare__head"><h2>Proof-run comparison</h2><a href="${escapeHtml(href)}">permalink</a></div>
    <div class="dcompare__grid">${pair.map(card).join('')}</div>
  </section>`;
  }

  function renderDerivationEvidenceGraph({ label, diagnosis }) {
    const encLabel = encodeURIComponent(label);
    const scriptFile = diagnosis.scriptPath ? path.basename(diagnosis.scriptPath) : '';
    const worldFile = diagnosis.worldPath ? path.basename(diagnosis.worldPath) : '';
    const runHref =
      '/admin/runs?kind=derivation' +
      (worldFile ? `&world=${encodeURIComponent(worldFile)}` : '') +
      (scriptFile ? `&script=${encodeURIComponent(scriptFile)}` : '');
    const links = [
      ['run permalink', `/derivation/${encLabel}`],
      ['compare this run', `/derivation?compare=${encLabel}`],
      ['same outcome', `/derivation?verdict=${encodeURIComponent(diagnosis.verdict || '')}`],
      ['rerun in launcher', runHref],
      ['controlled vocabulary', '#controlled-vocabulary'],
      ['proof runs index', '/derivation'],
      ['replays', '/replays'],
      ['scripts', '/browse'],
      ['workplan evidence', '/board?tag=evidence'],
    ];
    return `<div class="egraph"><div class="egraph__h">evidence graph</div><div class="egraph__links">${links
      .map(([labelText, href]) => `<a href="${escapeHtml(href)}">${escapeHtml(labelText)}</a>`)
      .join('')}</div><div class="egraph__meta">verdict ${escapeHtml(
      diagnosis.verdict || '?',
    )} · world ${escapeHtml(worldFile || '?')} · script ${escapeHtml(scriptFile || '?')}</div></div>`;
  }

  function renderDerivationProofDagHtml(profile) {
    if (!profile) {
      return `<section class="proofdag"><div class="proofdag__k">authored proof DAG</div><h2>Proof DAG unavailable</h2><p class="proofdag__summary">The run loaded, but its world file could not be found. The mechanical result is still inspectable below; the authored DAG requires the original world spec.</p></section>`;
    }
    const metric = (label, value) =>
      `<span class="proofdag__metric"><b>${escapeHtml(label)}</b> ${escapeHtml(value ?? 'n/a')}</span>`;
    const paths = profile.paths
      .map((pathProfile) => {
        const premises = pathProfile.premises
          .map((premise) => {
            const release = premise.scheduled ? `t${premise.releaseTurn} / ${premise.releaseVia}` : 'unscheduled';
            return `<li><span class="proofdag__pid">${escapeHtml(premise.id)}</span> <span class="proofdag__release">${escapeHtml(
              release,
            )}</span><span class="proofdag__surface">${escapeHtml(
              premise.surface || premise.factText || '(no surface text)',
            )}</span><span class="proofdag__fact">${escapeHtml(premise.factText)}</span></li>`;
          })
          .join('');
        return `<article class="proofdag__path"><h3>${escapeHtml(pathProfile.id)} · ${
          pathProfile.completeByTurn == null
            ? 'not fully scheduled'
            : `complete by t${escapeHtml(pathProfile.completeByTurn)}`
        }</h3><ol>${premises}</ol></article>`;
      })
      .join('');
    const releases = profile.releases
      .map(
        (release) =>
          `<tr><td class="mono">t${escapeHtml(release.turn)}</td><td>${escapeHtml(
            release.via,
          )}</td><td class="mono">${escapeHtml(release.premiseId)}${
            release.proofPremise ? '' : ' *'
          }</td><td>${escapeHtml(release.surface || release.factText)}</td></tr>`,
      )
      .join('');
    const rules = profile.rules
      .map(
        (rule) =>
          `<li><span class="proofdag__pid">${escapeHtml(rule.id || '?')}</span>: ${escapeHtml(
            rule.gloss || `${rule.if.join(' + ')} -> ${rule.then.join(', ')}`,
          )}</li>`,
      )
      .join('');
    return `<section class="proofdag" id="authored-proof-dag">
  <div class="proofdag__top">
    <div>
      <div class="proofdag__k">authored proof DAG</div>
      <h2>${escapeHtml(profile.title)}</h2>
      <p class="proofdag__summary">${escapeHtml(profile.summary)}</p>
      <p class="proofdag__summary"><b>Question:</b> ${escapeHtml(profile.question || 'n/a')}<br><b>Secret:</b> ${escapeHtml(
        profile.secret.surface || profile.secret.factText || 'n/a',
      )}${profile.mirror ? `<br><b>Mirror:</b> ${escapeHtml(profile.mirror.surface || profile.mirror.factText)}` : ''}</p>
    </div>
  </div>
  <div class="proofdag__metrics">
    ${metric('paths', profile.metrics.pathCount)}
    ${metric('premises', `${profile.metrics.scheduledProofPremiseCount}/${profile.metrics.uniqueProofPremiseCount} scheduled`)}
    ${metric('rules', profile.metrics.ruleCount)}
    ${metric('rule apps', profile.metrics.ruleApplicationCount)}
    ${metric('earliest complete', profile.metrics.earliestCompleteTurn == null ? 'n/a' : `t${profile.metrics.earliestCompleteTurn}`)}
    ${metric('t_min', profile.metrics.tMin)}
    ${metric('cap', profile.metrics.turnCap)}
  </div>
  <div class="proofdag__grid">
    <div class="proofdag__paths">${paths}</div>
    <aside class="proofdag__side">
      <h3>release schedule</h3>
      <table><thead><tr><th>turn</th><th>via</th><th>premise</th><th>surface</th></tr></thead><tbody>${releases}</tbody></table>
      <p class="mono" style="color:var(--ink-3);margin:6px 0 0">* mirror or color premise, not required by an authored proof path</p>
      <details><summary>public rules</summary><ul class="proofdag__rules">${rules}</ul></details>
    </aside>
  </div>
</section>`;
  }

  function renderDerivationLearnerDagHtml(learnerDag, learnerDagAssessment) {
    if (!learnerDag?.final || learnerDagAssessment?.status !== 'available') {
      return `<section class="learnerdag"><div class="learnerdag__k">learner DAG</div><h2>No learner proof sketch</h2><p class="learnerdag__summary">This artifact does not expose enough learner board data to reconstruct a learner-side proof graph.</p></section>`;
    }
    const final = learnerDag.final;
    const metric = (label, value) =>
      `<span class="learnerdag__metric"><b>${escapeHtml(label)}</b> ${escapeHtml(value ?? 'n/a')}</span>`;
    const nodes = final.nodes
      .filter((node) => node.kind === 'fact' || node.kind === 'hypothesis')
      .slice(0, 18)
      .map((node) => {
        if (node.kind === 'hypothesis') {
          return `<li><span class="learnerdag__fact">${escapeHtml(node.text)}</span><br><span class="learnerdag__status">${escapeHtml(
            node.label || 'hypothesis',
          )}</span></li>`;
        }
        return `<li><span class="learnerdag__fact">${escapeHtml(
          node.surface || node.factText,
        )}</span><br><span class="learnerdag__status">${escapeHtml(
          [...(node.statuses || []), node.label].filter(Boolean).join(' · '),
        )}</span></li>`;
      })
      .join('');
    const pathRows = (learnerDagAssessment.pathCoverage || [])
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.id)}</td><td class="mono">${Math.round(
            row.coverage * 100,
          )}%</td><td>${escapeHtml(row.missingPremiseIds.length ? row.missingPremiseIds.join(', ') : 'none')}</td></tr>`,
      )
      .join('');
    const missingRows = (learnerDagAssessment.missingPremises || [])
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.premiseId)}</td><td>${escapeHtml(row.bucket)}</td><td class="mono">${escapeHtml(
            row.releaseTurn == null ? 'n/a' : `t${row.releaseTurn}`,
          )}</td></tr>`,
      )
      .join('');
    return `<section class="learnerdag" id="learner-proof-dag">
  <div class="learnerdag__k">learner DAG</div>
  <h2>Learner proof sketch</h2>
  <p class="learnerdag__summary">Reconstructed from learner-visible board actions and voiced derivations. Source: <span class="mono">${escapeHtml(
    learnerDagAssessment.source,
  )}</span>. This is assessed after the run; it does not feed the learner the authored proof paths.</p>
  <div class="learnerdag__metrics">
    ${metric('best path', `${learnerDagAssessment.bestPathId || 'n/a'} · ${Math.round(learnerDagAssessment.bestPathCoverage * 100)}%`)}
    ${metric('complete paths', learnerDagAssessment.completePathIds?.length || 0)}
    ${metric('secret entailed', learnerDagAssessment.finalSecretEntailed)}
    ${metric('asserted secret', learnerDagAssessment.assertedSecret)}
    ${metric('asserted mirror', learnerDagAssessment.assertedMirror)}
    ${metric('bottleneck', learnerDagAssessment.bottleneck || 'n/a')}
    ${metric('turns', learnerDag.turns?.length || 0)}
  </div>
  <div class="learnerdag__grid">
    <div class="learnerdag__panel">
      <h3>final learner graph nodes</h3>
      <ul class="learnerdag__nodes">${nodes || '<li class="notice-missing">No nodes reconstructed.</li>'}</ul>
    </div>
    <aside class="learnerdag__panel">
      <h3>authored-path coverage</h3>
      <table><thead><tr><th>path</th><th>covered</th><th>missing</th></tr></thead><tbody>${pathRows}</tbody></table>
      ${
        missingRows
          ? `<h3 style="margin-top:12px">missing-premise buckets</h3><table><thead><tr><th>premise</th><th>bucket</th><th>release</th></tr></thead><tbody>${missingRows}</tbody></table>`
          : ''
      }
      <p class="mono" style="color:var(--ink-3);margin:8px 0 0">first complete path: ${
        learnerDagAssessment.firstCompletePathTurn ?? 'n/a'
      }; first secret entailed: ${learnerDagAssessment.firstSecretEntailedTurn ?? 'n/a'}</p>
    </aside>
  </div>
	</section>`;
  }

  function renderVocabularyTokens(tokens, modifier = '') {
    return tokens
      .map(
        (token) =>
          `<span class="vocab__token${modifier ? ` vocab__token--${modifier}` : ''}">${escapeHtml(token)}</span>`,
      )
      .join('');
  }

  function renderDerivationConceptChip(id, conceptsById) {
    const concept = conceptsById.get(id);
    const label = concept?.label || id;
    return concept
      ? `<a class="vocab__token" href="#concept-${escapeAttr(concept.id)}">${escapeHtml(label)}</a>`
      : `<span class="vocab__token">${escapeHtml(label)}</span>`;
  }

  function renderDerivationConceptEdge(link, conceptsById) {
    const target = conceptsById.get(link.target);
    const targetLabel = target?.label || link.target;
    const targetHref = target ? ` href="#concept-${escapeAttr(target.id)}"` : '';
    return `<a class="concept__edge"${targetHref}><span>${escapeHtml(link.type)}:</span> <b>${escapeHtml(targetLabel)}</b></a>`;
  }

  function renderDerivationConceptCard(
    concept,
    conceptsById,
    ontologyHref,
    { highlight = false, idPrefix = 'concept-' } = {},
  ) {
    const links = concept.links.map((link) => renderDerivationConceptEdge(link, conceptsById)).join('');
    return `<article class="concept${highlight ? ' concept--novel' : ''}" id="${escapeAttr(idPrefix + concept.id)}">
    <div class="concept__top"><span class="concept__label">${escapeHtml(concept.label)}</span><span class="concept__layer">${escapeHtml(concept.layer)}</span></div>
    <p class="concept__definition"><span class="concept__deflabel">definition</span>${escapeHtml(concept.definition)}</p>
    <div class="concept__meta">
      <span class="concept__metachip">category: ${escapeHtml(concept.category)}</span>
      <span class="concept__metachip">app term: <code>${escapeHtml(concept.id)}</code></span>
    </div>
    <div class="concept__ontology">
      <span class="concept__ontologylabel">ontology affinity</span>
      <a href="${escapeAttr(ontologyHref)}" title="Open the ontology atlas with the derivation concept-world module loaded"><code>${escapeHtml(concept.ontology)}</code></a>
    </div>
    <div class="concept__links"><span class="concept__linkslabel">typed links</span>${links}</div>
  </article>`;
  }

  function renderDerivationConceptSchemaHtml(schema) {
    const conceptsById = new Map(schema.concepts.map((concept) => [concept.id, concept]));
    const ontologyHref = `/ontology?view=system&modules=${encodeURIComponent(schema.ontologyModules.join(','))}&source=1`;
    const ontologyModules = schema.ontologyModules
      .map((module) => `<span class="vocab__token">${escapeHtml(module)}</span>`)
      .join('');
    const novelConcepts = (schema.novelConceptIds || [])
      .map((id) => conceptsById.get(id))
      .filter(Boolean)
      .map((concept) =>
        renderDerivationConceptCard(concept, conceptsById, ontologyHref, {
          highlight: true,
          idPrefix: 'concept-featured-',
        }),
      )
      .join('');
    const acts = schema.acts
      .map(
        (act) => `<section class="vocabschema__act">
    <h4>${escapeHtml(act.title)}</h4>
    <p>${escapeHtml(act.note)}</p>
    <div class="vocab__tokens">${act.concepts.map((id) => renderDerivationConceptChip(id, conceptsById)).join('')}</div>
  </section>`,
      )
      .join('');
    const concepts = schema.concepts
      .map((concept) => renderDerivationConceptCard(concept, conceptsById, ontologyHref))
      .join('');
    const edges = schema.links
      .map(
        (link) =>
          `<div class="vocabschema__edge"><b>${escapeHtml(link.sourceLabel)}</b> ${escapeHtml(link.type)} <b>${escapeHtml(link.targetLabel)}</b></div>`,
      )
      .join('');
    return `<section class="vocabschema" id="conceptual-world">
    <div class="vocabschema__head">
      <div>
        <h3>Conceptual world</h3>
        <p>The derivation run is a single semantic world: drama stages the problem, rhetoric shapes address, logic licenses claims, pedagogy manages ownership, and theory names the authority dynamics.</p>
      </div>
      <a class="vocabschema__link" href="${escapeAttr(ontologyHref)}">open ontology module</a>
    </div>
    <div class="vocabschema__ontology">
      <div>
        <h4>Ontology affinity</h4>
        <p>Concept cards below name the app-level term, its ontology individual, and the loaded ontology modules that make the concept-world available.</p>
      </div>
      <div class="vocab__tokens">${ontologyModules}</div>
    </div>
    <div class="vocabschema__novel">${novelConcepts}</div>
    <div class="vocabschema__acts">${acts}</div>
    <div class="vocabschema__grid">${concepts}</div>
    <div class="vocabschema__edges"><h4>Typed semantic links</h4><div class="vocabschema__edgegrid">${edges}</div></div>
  </section>`;
  }

  function renderDerivationControlledVocabularyHtml({ open = false } = {}) {
    const schema = getDerivationConceptSchema();
    const body = schema.vocabularyGroups
      .map(
        (group) => `<section class="vocab__group">
    <h3>${escapeHtml(group.title)}</h3>
    <p>${escapeHtml(group.note)}</p>
    <div class="vocab__tokens">${renderVocabularyTokens(group.tokens, group.modifier || '')}</div>
  </section>`,
      )
      .join('');
    const layerBody = schema.layers
      .map(
        (layer) => `<section class="vocab__layer">
    <h3>${escapeHtml(layer.title)}</h3>
    <p>${escapeHtml(layer.note)}</p>
    <div class="vocab__tokens">${renderVocabularyTokens(layer.tokens)}</div>
  </section>`,
      )
      .join('');
    return `<details class="vocab" id="controlled-vocabulary"${open ? ' open' : ''}>
  <summary>Controlled vocabulary <span class="vocab__hint">drama, rhetoric, logic, pedagogy, theory, novel</span></summary>
  <p class="vocab__intro">The app keeps scenario content separate from the stable learner contract. The conceptual world gives definitions, typed semantic links, and ontology affinity for the terms the run uses.</p>
  ${renderDerivationConceptSchemaHtml(schema)}
  <div class="vocab__layers">${layerBody}</div>
  <div class="vocab__grid">${body}</div>
</details>`;
  }

  function renderDerivationIndexHtml(runs, query = {}, liveRuns = listDerivationLiveRuns()) {
    // Stable "most recent" ordering: the list arrives mtime-sorted, so the index
    // here is what the client sorts back to when it resets to recency.
    runs.forEach((run, i) => {
      run.ord = i;
    });
    const rowHtml = ({ label, diagnosis: d, hasNotice, ord, mtimeMs }) => {
      const events = Object.entries(d.eventsByType || {})
        .map(([k, v]) => {
          const txt = `${escapeHtml(k)}×${v}`;
          return DERIVATION_SUCCESS_EVENTS.has(k) ? txt : `<span style="color:var(--brick-d)">${txt}</span>`;
        })
        .join(', ');
      const verdictOk = d.verdict === 'grounded_anagnorisis';
      const verdictLabel = DERIVATION_VERDICT_LABEL[d.verdict] || d.verdict || '?';
      const verdictClass = DERIVATION_VERDICT_CLASS[d.verdict] || 'vchip--disengaged';
      const score = derivationScoreCell(d);
      const when = derivationWhenCell(mtimeMs);
      const summary = derivationPlainSummary(d);
      const adherence = d.releaseAdherence || {};
      const sg = d.tutorFigures?.superego;
      const staging = [
        d.staging
          ? d.staging.source === 'director'
            ? `${d.staging.movements.length} mv${d.staging.tutorNotes?.length ? ` · ${d.staging.tutorNotes.length} notes` : ''}`
            : 'sketch held'
          : '—',
        ...(sg ? [`sego ${sg.interventions}/${sg.watched}${d.tutorStallWatch ? ' +stall' : ''}`] : []),
      ].join(' · ');
      const marks = [
        hasNotice ? ' <span title="critic’s notice on file" style="color:var(--moss-deep)">✎</span>' : '',
        d.criticFeedback
          ? ` <span title="counsel folded in from ${escapeHtml(d.criticFeedback.source)}" style="color:var(--moss-deep)">⟲</span>`
          : '',
      ].join('');
      // data-* attributes drive client-side search / filter / sort.
      const haystack = escapeHtml(`${label} ${summary}`.toLowerCase());
      return `<tr class="idx-row${verdictOk ? ' idx-row--win' : ''}" data-ord="${ord}" data-name="${escapeHtml(
        label.toLowerCase(),
      )}" data-label="${haystack}" data-verdict="${escapeHtml(d.verdict || '?')}" data-mode="${escapeHtml(
        d.backend?.mode || '?',
      )}" data-score="${score.value}" data-turns="${d.turnsPlayed ?? 0}" data-cost="${d.usage?.costUSD ?? 0}" data-mtime="${when.value}">
<td><a class="run-name" href="/derivation/${encodeURIComponent(label)}">${escapeHtml(label)}</a>${marks}</td>
<td><span class="vchip ${verdictClass}">${escapeHtml(verdictLabel)}</span></td>
<td>${score.html}</td>
<td class="mono">${d.firstForcedTurn ?? '—'} → ${d.assertedGroundedTurn ?? '—'}</td>
<td class="mono">${d.turnsPlayed ?? '?'}/${d.turnCap ?? '?'}</td>
<td class="mono">${events || '—'}</td>
<td class="mono">${adherence.onCue ?? '—'} on cue${adherence.deviations?.length ? `, <span style="color:var(--brick-d)">${adherence.deviations.length} dev</span>` : ''}</td>
<td class="mono">${staging}</td>
<td class="mono">${derivationBackendCell(d.backend)}</td>
<td class="mono">${d.elapsedMs ? `${(d.elapsedMs / 1000).toFixed(0)}s` : '—'} · $${(d.usage?.costUSD ?? 0).toFixed(2)}</td>
<td class="mono">${when.html}</td>
</tr>
<tr class="idx-sum${verdictOk ? ' idx-sum--win' : ''}"><td colspan="11"><span class="run-summary">${escapeHtml(summary)}</span></td></tr>`;
    };
    const tableFor = (rs) =>
      `<div class="idx-panel"><table class="idx idx--runs"><colgroup><col style="width:10%"><col style="width:12%"><col style="width:9%"><col style="width:7%"><col style="width:6%"><col style="width:11%"><col style="width:7%"><col style="width:9%"><col style="width:11%"><col style="width:7%"><col style="width:11%"></colgroup><thead><tr><th>run</th><th>outcome</th><th>proof</th><th>forced → asserted</th><th>turns</th><th>events</th><th>releases</th><th>dramaturgy</th><th>backend</th><th>wall · cost</th><th>when</th></tr></thead><tbody>${rs
        .map(rowHtml)
        .join('\n')}</tbody></table></div>`;
    const median = (values) => {
      const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
      if (!nums.length) return null;
      return nums[Math.floor(nums.length / 2)];
    };
    const groupSummary = (rs) => {
      const wins = rs.filter((r) => r.diagnosis.verdict === 'grounded_anagnorisis');
      const failures = rs.filter((r) => r.diagnosis.verdict !== 'grounded_anagnorisis');
      const best = wins[0] || rs[0];
      const worst =
        failures.find((r) => r.diagnosis.verdict === 'aporia') ||
        failures.find((r) => r.diagnosis.verdict === 'disengagement') ||
        failures[0];
      const real = rs.filter((r) => r.diagnosis.backend?.mode === 'real').length;
      const turns = median(rs.map((r) => Number(r.diagnosis.turnsPlayed)));
      const eventCounts = new Map();
      for (const r of rs) {
        for (const [event, count] of Object.entries(r.diagnosis.eventsByType || {})) {
          eventCounts.set(event, (eventCounts.get(event) || 0) + Number(count || 0));
        }
      }
      const commonEvents = [...eventCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([event, count]) => `${event}×${count}`)
        .join(', ');
      const compare =
        best && worst
          ? `<a href="/derivation?compare=${encodeURIComponent(best.label)},${encodeURIComponent(worst.label)}">best vs failure</a>`
          : 'best vs failure';
      return `<div class="idx-group-card">
      <div class="idx-gm"><b>${wins.length}/${rs.length}</b> grounded runs</div>
      <div class="idx-gm"><b>${turns ?? '—'}</b> median turns</div>
      <div class="idx-gm"><b>${real}/${rs.length - real}</b> real/mock split</div>
      <div class="idx-gm"><b>${escapeHtml(commonEvents || '—')}</b> common events</div>
      <div class="idx-gm"><b>compare</b>${compare}${best ? ` · <a href="/derivation/${encodeURIComponent(best.label)}">best</a>` : ''}${worst ? ` · <a href="/derivation/${encodeURIComponent(worst.label)}">failure</a>` : ''}</div>
    </div>`;
    };
    const winCount = (rs) => rs.filter((r) => r.diagnosis.verdict === 'grounded_anagnorisis').length;
    const countText = (rs) => {
      const w = winCount(rs);
      return `${rs.length} run${rs.length === 1 ? '' : 's'}${w ? ` · ${w} grounded` : ''}`;
    };
    // Experimental-condition grouping (diagnosis.group, set by --group or the
    // backfill script): one section per group, ordered by each group's most
    // recent run (the list arrives mtime-sorted). All-ungrouped keeps a single
    // flat section. Each section is its own client-sortable unit.
    const grouped = new Map();
    for (const run of runs) {
      const key = run.diagnosis.group || '(ungrouped)';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(run);
    }
    const flat = grouped.size === 1 && grouped.has('(ungrouped)');
    const body = !runs.length
      ? '<p>No runs found. Run <span class="mono">npm run derivation:loop</span> first.</p>'
      : flat
        ? `<section class="idx-group" data-group="(all)"><p class="mono idx-flatcount" style="color:var(--ink-3)" data-sec-count>${countText(
            runs,
          )}</p>${groupSummary(runs)}${tableFor(runs)}</section>`
        : [...grouped.entries()]
            .map(
              ([g, rs]) =>
                `<details class="idx-group" data-group="${escapeHtml(g)}" open><summary><h2 class="sect">${escapeHtml(
                  g,
                )} <span class="mono" style="color:var(--ink-3);font-weight:normal" data-sec-count>${countText(
                  rs,
                )}</span></h2></summary>${groupSummary(rs)}${tableFor(rs)}</details>`,
            )
            .join('\n');
    // Top-line scoreboard — wins vs the two failure modes, across every run on
    // disk (not just what the filters currently show; the client updates a live
    // "shown" tally in the toolbar instead).
    const tally = { grounded_anagnorisis: 0, disengagement: 0, aporia: 0, other: 0 };
    for (const run of runs) {
      const v = run.diagnosis.verdict;
      if (v in tally) tally[v] += 1;
      else tally.other += 1;
    }
    const scoreboard = runs.length
      ? `<div class="idx-scoreboard">
<span class="idx-tally idx-tally--win"><b>${tally.grounded_anagnorisis}</b> grounded</span>
<span class="idx-tally"><b>${tally.disengagement}</b> disengaged</span>
<span class="idx-tally"><b>${tally.aporia}</b> impasse</span>
${tally.other ? `<span class="idx-tally"><b>${tally.other}</b> other</span>` : ''}
<span class="idx-tally"><b>${runs.length}</b> runs total</span>
</div>`
      : '';
    const toolbar = runs.length
      ? `<div class="idx-tools" role="search">
<input type="search" class="idx-search" placeholder="search runs by name or summary…" aria-label="Search runs by name or summary">
<div class="idx-seg" role="group" aria-label="Filter by outcome">
<button type="button" data-verdict="all" class="is-on" aria-pressed="true">all</button>
<button type="button" data-verdict="grounded_anagnorisis" aria-pressed="false">wins</button>
<button type="button" data-verdict="disengagement" aria-pressed="false">disengaged</button>
<button type="button" data-verdict="aporia" aria-pressed="false">impasse</button>
</div>
<label class="idx-check"><input type="checkbox" class="idx-real"> real only</label>
<label class="idx-sort">sort
<select class="idx-sortsel" aria-label="Sort runs">
<option value="recent">most recent</option>
<option value="wins">wins first</option>
<option value="score">most proof steps</option>
<option value="turns">fewest turns</option>
<option value="cost">highest cost</option>
<option value="label">name A–Z</option>
</select>
</label>
<span class="idx-count" data-idx-count></span>
</div>`
      : '';
    const comparePanel = renderDerivationComparePanel(runs, query);
    return `${pageHead({ title: 'Derivation runs · machine spirits', css: DERIVATION_CSS })}
<body>
${railHtml({
  active: 'derivation',
  sub: 'proof runs — a fixed rule-checker decides each outcome, no AI judge anywhere',
  hint: '<span><b>proof runs</b> — a fixed rule-checker (not an AI judge, not a quality score) decides whether the learner reached the hidden answer</span><span class="navhint__sep">·</span><span>for generated drama graded by AI critics, see <a href="/browse">scripts</a></span>',
})}
<main class="wrap wrap--wide" data-derivation-index>
<h1>Proof runs — did the learner reach the hidden answer?</h1>
${reportTypeBand('/derivation')}
<p class="lede">Each row is one tutoring run. The tutor has to lead the learner to a hidden conclusion purely by inference, and a fixed rule-checker — not an AI judge — decides the outcome: a run is <strong>grounded</strong> when the learner reaches the hidden conclusion and its proof closes; otherwise it ends in an <strong>impasse</strong> or the learner <strong>disengages</strong>. Runs are grouped by experimental condition (the <span class="mono">--group</span> flag); artifacts live under <span class="mono">exports/dramatic-derivation/loop/</span>.</p>
${renderDerivationControlledVocabularyHtml()}
${renderDerivationLivePanel(liveRuns)}
${scoreboard}
${toolbar}
${comparePanel}
${runs.length ? '<p class="idx-empty" data-idx-empty hidden>No runs match your search or filters.</p>' : ''}
${runs.length ? '<details class="idx-legend"><summary class="mono" style="cursor:pointer;color:var(--ink-3);font-size:12px">what the columns mean</summary><p class="mono" style="color:var(--ink-3);font-size:11px;line-height:1.6;margin:.4em 0 .8em">proof = how many of the required reasoning steps the learner established · forced → asserted = the turn the hidden fact had to be handed to the learner vs the turn the learner stated it themselves · events = per-turn flags from the rule-checker (plot move, repair, decay, act end…) · releases = planned fact-reveals that landed on cue vs off-schedule (dev) · dramaturgy = director-declared scene moves</p></details>' : ''}
${body}
</main>
${DERIVATION_INDEX_CLIENT}
</body></html>`;
  }

  function groupDerivationRowsByTurn(rows) {
    const byTurn = new Map();
    for (const row of rows || []) {
      if (!byTurn.has(row.turn)) byTurn.set(row.turn, []);
      byTurn.get(row.turn).push(row);
    }
    return byTurn;
  }

  function renderDerivationDirectorLine(line, rawText, text) {
    if (!publicDerivationLine(line)) return '';
    const dbits = [];
    if (line.meta?.phase?.name)
      dbits.push(
        `<div class="tmeta">— declares the movement <strong>${escapeHtml(line.meta.phase.name)}</strong>${line.meta.phase.intent ? `: ${escapeHtml(line.meta.phase.intent)}` : ''}</div>`,
      );
    if (line.meta?.tutorNote)
      dbits.push(`<div class="tmeta">— note to the tutor: “${escapeHtml(line.meta.tutorNote)}”</div>`);
    if (line.meta?.release)
      dbits.push(`<div class="tmeta">— releases <span class="release">${escapeHtml(line.meta.release)}</span></div>`);
    return `<div class="line line--director tts-fragment"${ttsDataAttrs('stage', rawText, 'Stage')}>${rawText ? ttsPlayButton('stage') : ''}${text}</div>${dbits.join('')}`;
  }

  function renderDerivationTutorLine(line, rawText, text) {
    const move = line.meta?.move;
    const bits = [];
    if (move)
      bits.push(
        `move: ${derivationFigureHtml(move.figure)} → ${escapeHtml(move.targetPremise || '—')} (${escapeHtml(move.intent || '—')})`,
      );
    if (line.meta?.release) bits.push(`releases <span class="release">${escapeHtml(line.meta.release)}</span>`);
    const delib = line.meta?.deliberation;
    const delibNote = (delib?.note || '').trim();
    const voice = delib?.intervened
      ? `<div class="tmeta tts-fragment"${ttsDataAttrs('tutor_superego', delibNote, 'Tutor superego')}>${delibNote ? ttsPlayButton('tutor superego') : ''}— the second voice: “${escapeHtml(delib.note || '')}”${
          delib.draftFigure && move?.figure && delib.draftFigure !== move.figure
            ? ` (draft ${escapeHtml(delib.draftFigure)} → ${escapeHtml(move.figure)})`
            : ' (figure held)'
        }</div>`
      : '';
    return `<div class="line line--tutor tts-fragment"${ttsDataAttrs('tutor', rawText, 'Tutor')}>${rawText ? ttsPlayButton('tutor') : ''}<span class="who">Tutor:</span> ${text}</div>${bits.length ? `<div class="tmeta">— ${bits.join(', ')}</div>` : ''}${voice}`;
  }

  function renderDerivationLearnerLine(line, rawText, text) {
    const meta = line.meta || {};
    const bits = [];
    if (meta.adopt?.length)
      bits.push(`adopts ${meta.adopt.map((f) => `<code>${escapeHtml(f.join(' '))}</code>`).join(', ')}`);
    if (meta.retract?.length)
      bits.push(`retracts ${meta.retract.map((f) => `<code>${escapeHtml(f.join(' '))}</code>`).join(', ')}`);
    if (meta.hypothesis) bits.push(`hypothesis: ${escapeHtml(meta.hypothesis)}`);
    if (meta.asserts)
      bits.push(`<span class="assert">asserts <code>${escapeHtml(meta.asserts.join(' '))}</code></span>`);
    return `<div class="line line--learner tts-fragment"${ttsDataAttrs('learner', rawText, 'Learner')}>${rawText ? ttsPlayButton('learner') : ''}<span class="who">Learner:</span> ${text}</div>${bits.length ? `<div class="tmeta">— ${bits.join(' · ')}</div>` : ''}`;
  }

  function renderDerivationTranscriptLine(line) {
    const rawText = (line.text || '').trim();
    const text = escapeHtml(rawText);
    if (line.role === 'director') return renderDerivationDirectorLine(line, rawText, text);
    if (line.role === 'tutor') return renderDerivationTutorLine(line, rawText, text);
    if (line.role === 'learner') return renderDerivationLearnerLine(line, rawText, text);
    return `<div class="line">${text}</div>`;
  }

  function renderDerivationTurnBlocks(result, segments) {
    const segmentFor = (turn) =>
      segments.find((segment) => turn >= segment.turns[0] && turn <= segment.turns[1]) || null;
    const byTurn = groupDerivationRowsByTurn(result.transcript);
    const eventsByTurn = groupDerivationRowsByTurn(result.events);
    const blocks = [];
    let currentSegment = null;
    for (const [turn, turnLines] of [...byTurn.entries()].sort((a, b) => a[0] - b[0])) {
      const segment = segmentFor(turn);
      if (segment && segment !== currentSegment) {
        currentSegment = segment;
        const declared = segment.source === 'director' ? ' — declared by the director' : '';
        const intent = segment.intent ? `<span class="sect__intent">${escapeHtml(segment.intent)}</span>` : '';
        blocks.push(
          `<h2 class="sect">${escapeHtml(segment.title)} <span class="mono" style="color:var(--ink-3)">(turns ${segment.turns[0]}–${segment.turns[1]}${declared})</span>${intent}</h2>`,
        );
      }
      const lines = turnLines.map(renderDerivationTranscriptLine).join('\n');
      const flags = (eventsByTurn.get(turn) || [])
        .map(
          (event) =>
            `<span class="flag ${DERIVATION_SUCCESS_EVENTS.has(event.type) ? 'flag--ok' : 'flag--bad'}">⚑ ${escapeHtml(event.type)} — ${escapeHtml(event.detail || '')}</span>`,
        )
        .join('\n');
      blocks.push(`<div class="turn"><div class="turn__n">turn ${turn}</div>${lines}${flags}</div>`);
    }
    return blocks;
  }

  function renderDerivationRunChips(diagnosis, result) {
    const verdictOk = result.verdict === 'grounded_anagnorisis';
    const adherence = diagnosis.releaseAdherence || {};
    const stagingChip = diagnosis.staging
      ? diagnosis.staging.source === 'director'
        ? `${diagnosis.staging.movements.length} movements declared${diagnosis.staging.tutorNotes?.length ? ` · ${diagnosis.staging.tutorNotes.length} tutor notes` : ''}`
        : 'sketch held (no movements declared)'
      : null;
    const sg = diagnosis.tutorFigures?.superego;
    const superegoChip = sg
      ? `superego ${sg.interventions}/${sg.watched} interventions · ${sg.withinTurnChanges} within-turn figure changes${diagnosis.tutorStallWatch ? ' · stall-watch v3' : ''}`
      : null;
    const dials = diagnosis.dials || {};
    return [
      `<span class="chip ${verdictOk ? 'chip--ok' : 'chip--bad'}">${escapeHtml(result.verdict || '?')}</span>`,
      ...(diagnosis.group ? [`<span class="chip">group ${escapeHtml(diagnosis.group)}</span>`] : []),
      ...(diagnosis.criticFeedback
        ? [`<span class="chip">⟲ counsel from ${escapeHtml(diagnosis.criticFeedback.source)}</span>`]
        : []),
      `<span class="chip">turns ${result.turnsPlayed}/${diagnosis.turnCap ?? '?'}</span>`,
      `<span class="chip">forced ${result.firstForcedTurn ?? '—'} → asserted ${result.assertedGroundedTurn ?? '—'}</span>`,
      `<span class="chip">releases ${adherence.onCue ?? '—'} on cue · ${adherence.deviations?.length ?? 0} dev · ${adherence.missed?.length ?? 0} missed · ${adherence.unscheduled?.length ?? 0} unscheduled</span>`,
      ...(stagingChip ? [`<span class="chip">${escapeHtml(stagingChip)}</span>`] : []),
      ...(superegoChip ? [`<span class="chip">${escapeHtml(superegoChip)}</span>`] : []),
      ...(dials.recognition || dials.charisma
        ? [
            `<span class="chip">dials recognition ${dials.recognition || 0}/3 · charisma ${dials.charisma || 0}/3</span>`,
          ]
        : []),
      ...derivationBackendChips(diagnosis.backend).map((c) => `<span class="chip">${escapeHtml(c)}</span>`),
      `<span class="chip">${diagnosis.elapsedMs ? `${(diagnosis.elapsedMs / 1000).toFixed(1)}s` : '—'} · ${diagnosis.usage?.calls ?? '?'} calls · $${(diagnosis.usage?.costUSD ?? 0).toFixed(4)}</span>`,
    ].join('\n');
  }

  function renderDerivationDiscipline(diagnosis) {
    return Object.entries(diagnosis.dialogueDiscipline || {})
      .map(
        ([role, s]) =>
          `<tr><td>${escapeHtml(role)}</td><td class="mono">${s.turns}</td><td class="mono">${s.avgSentences} (max ${s.maxSentences})</td><td class="mono">${s.avgWords}</td></tr>`,
      )
      .join('\n');
  }

  function renderDerivationCommentary(commentary, label) {
    return commentary
      ? `<h2 class="sect">Critic's commentary</h2><div class="mdblock mdblock--notice">${derivationMdToHtml(commentary.replace(/^# .*\n+/, ''))}</div>`
      : `<h2 class="sect">Critic's commentary</h2><p class="notice-missing">No notice for this run yet — backfill with <span class="mono">npm run derivation:critic -- --label ${escapeHtml(label)}</span>.</p>`;
  }

  function renderDerivationExtractedProof(result, world) {
    if (!result.proof) return '';
    return `<h2 class="sect">The extracted proof (what did the forcing)</h2><pre class="panel">${escapeHtml(renderDerivationProof(result.proof))}</pre><div class="mdblock">${derivationMdToHtml(renderDerivationProofProse(result.proof, world, { ledger: result.ledger }))}</div>`;
  }

  function renderDerivationRunHtml({ label, diagnosis, result, world, commentary, assessment }) {
    // Realized staging: director-declared movements when there are any, the
    // author's sketch otherwise — same segments feed the headers AND the curve.
    const segments = derivationStagingSegments(result, world);
    const blocks = renderDerivationTurnBlocks(result, segments);
    const chips = renderDerivationRunChips(diagnosis, result);
    const discipline = renderDerivationDiscipline(diagnosis);

    return `${pageHead({ title: `${label} · derivation`, css: DERIVATION_CSS })}
<body>
${railHtml({
  active: 'derivation',
  sub: `proof run — ${label}`,
  hint: `<span><b>one proof run</b> — ${escapeHtml(label)}</span><span class="navhint__sep">·</span><span>back to all <a href="/derivation">proof runs</a>, or read generated drama in <a href="/browse">scripts</a></span>`,
})}
<main class="wrap">
<p class="mono" style="margin-top:14px"><a href="/derivation">← all runs</a></p>
<h1>${escapeHtml(world?.title || result.worldId || label)}</h1>
<p class="lede mono">${escapeHtml(label)} · script ${escapeHtml(diagnosis.scriptPath || '?')}${diagnosis.note ? ` · ${escapeHtml(diagnosis.note)}` : ''}</p>
	<div class="chips">${chips}</div>
	${renderDerivationEvidenceGraph({ label, diagnosis })}
	${renderDerivationControlledVocabularyHtml({ open: true })}
	${renderDerivationProofDagHtml(assessment?.dagProfile || null)}
${renderDerivationLearnerDagHtml(assessment?.learnerDag || null, assessment?.learnerDagAssessment || null)}
${transcriptTtsToolbarHtml({ fullLabel: 'Play full transcript', includeLabel: 'include tutor superego' })}
${renderDerivationCommentary(commentary, label)}
<h2 class="sect">The dramaturgical arc — D(t), remaining derivation distance</h2>
${renderDerivationArcSvg({
  trajectory: result.trajectory || [],
  segments,
  ledger: result.ledger || [],
  events: result.events || [],
  world,
  result,
})}
${derivationSlopeCaption(diagnosis.learningSlope || null)}
<h2 class="sect">Logic projection — board closure by turn</h2>
${renderDerivationLogicVisualizer(diagnosis.logicProjection || null)}
<h2 class="sect">Dialogue discipline</h2>
<table class="idx"><thead><tr><th>role</th><th>turns</th><th>avg sentences</th><th>avg words</th></tr></thead><tbody>${discipline}</tbody></table>
${blocks.join('\n')}
${renderDerivationExtractedProof(result, world)}
<h2 class="sect">Instrument panel (programmatic eval — no judge)</h2>
<div class="mdblock">${derivationMdToHtml(renderDerivationEvalPanel(diagnosis).replace(/^## .*\n+/, ''))}</div>
</main>
${TRANSCRIPT_TTS_CLIENT}
<script>window.TranscriptTts.bind(document.body);</script>
</body></html>`;
  }

  return {
    DERIVATION_VERDICT_LABEL,
    derivationPlainSummary,
    renderDerivationControlledVocabularyHtml,
    renderDerivationIndexHtml,
    renderDerivationLiveIndexHtml,
    renderDerivationLiveRunHtml,
    renderDerivationLogicVisualizer,
    renderDerivationRunHtml,
  };
}

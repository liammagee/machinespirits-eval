import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import {
  getLabellingGameCodebook,
  getLabellingGameItems,
  LABELLING_GAME_DATASETS,
  listLabellingGameDatasets,
  saveLabellingGameCoding,
} from './labellingGameStore.js';

function write(output, value = '') {
  output.write(`${value}\n`);
}

function oneLine(value, max = 140) {
  const compact = String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function numberedChoice(value, choices) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const number = Number.parseInt(raw, 10);
  if (Number.isInteger(number) && number >= 1 && number <= choices.length) return choices[number - 1].id;
  const exact = choices.find((choice) => choice.id.toLowerCase() === raw.toLowerCase());
  if (exact) return exact.id;
  const normalized = raw.toLowerCase().replace(/[\s/-]+/gu, '_');
  return choices.find((choice) => choice.id.toLowerCase().replace(/[\s/-]+/gu, '_') === normalized)?.id || null;
}

async function askChoice(rl, output, prompt, choices, { current = '', optional = false } = {}) {
  while (true) {
    choices.forEach((choice, index) =>
      write(output, `  ${index + 1}. ${choice.id}${choice.name ? ` - ${choice.name}` : ''}`),
    );
    const suffix = current ? ` [${current}]` : optional ? ' [skip]' : '';
    const answer = await rl.question(`${prompt}${suffix}: `);
    if (!answer.trim() && current) return current;
    if (!answer.trim() && optional) return '';
    const selected = numberedChoice(answer, choices);
    if (selected) return selected;
    write(output, 'Choose one of the listed numbers or ids.');
  }
}

async function askMultiple(rl, output, prompt, choices, { current = [] } = {}) {
  choices.forEach((choice, index) => write(output, `  ${index + 1}. ${choice.id} - ${choice.name}`));
  while (true) {
    const suffix = current.length ? ` [${current.join(',')}]` : '';
    const answer = await rl.question(`${prompt} (comma-separated)${suffix}: `);
    if (!answer.trim() && current.length) return current;
    const tokens = answer
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    const selected = tokens.map((token) => numberedChoice(token, choices));
    if (selected.length && selected.every(Boolean)) return [...new Set(selected)];
    write(output, 'Choose at least one listed number or id.');
  }
}

function renderTaxonomyItem(output, item) {
  write(output, '\nSuperego feedback');
  write(output, item.feedback || '—');
  write(output, '\nEgo initial response');
  write(output, item.ego_generate || '—');
  write(output, '\nEgo revised response');
  write(output, item.ego_revision || '—');
  write(output, '\nLearner context');
  write(output, item.learner_context_snippet || '—');
}

function renderImpasseItem(output, item) {
  const turns = Array.isArray(item.turn_range) ? item.turn_range.join('–') : '';
  write(
    output,
    `\n${item.session_date || ''}${turns ? ` · turns ${turns}` : ''}${item.mixed ? ' · mixed session' : ''}`,
  );
  write(output, `signals > ${(item.signals_fired || []).join(' · ') || 'none'}`);
  for (const turn of item.excerpt_turns || []) {
    write(output, `\nlearner t${turn.turn} > ${turn.learner_text || '—'}`);
    write(output, `tutor          > ${turn.tutor_text || '—'}`);
  }
  if (item.followup_turns?.length) {
    write(output, '\nFollow-up');
    for (const turn of item.followup_turns) {
      write(output, `learner t${turn.turn} > ${turn.learner_text || '—'}`);
      write(output, `tutor          > ${turn.tutor_text || '—'}`);
    }
  } else {
    write(output, '\nFollow-up > session ended or no later exchange was captured.');
  }
}

export function renderLabellingGameItem(output, datasetId, item, index, total) {
  write(output, `\n${'='.repeat(72)}`);
  write(output, `${item.item_id} · ${index + 1}/${total} · ${item.labelling_summary || 'open'}`);
  write(output, '='.repeat(72));
  if (datasetId === LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY) renderTaxonomyItem(output, item);
  else renderImpasseItem(output, item);
}

async function labelTaxonomyItem({ rl, output, item, codebook }) {
  const primary = await askChoice(rl, output, 'Primary label', codebook.categories || [], {
    current: item.human_primary || '',
  });
  const confidence = await askChoice(
    rl,
    output,
    'Confidence',
    [
      { id: '1', name: 'hard case' },
      { id: '2', name: 'plausible' },
      { id: '3', name: 'clear' },
    ],
    { current: item.human_confident || '', optional: true },
  );
  const secondaryAnswer = await rl.question(`Secondary labels, comma-separated [${item.human_secondary || 'skip'}]: `);
  const notes = await rl.question(`Notes [${oneLine(item.human_notes || 'skip', 60)}]: `);
  return {
    human_primary: primary,
    human_confident: confidence,
    human_secondary: secondaryAnswer.trim()
      ? secondaryAnswer.split(',').map((entry) => entry.trim())
      : item.human_secondary || [],
    human_notes: notes.trim() || item.human_notes || '',
  };
}

async function labelImpasseItem({ rl, output, item, codebook }) {
  const impasse = await askChoice(
    rl,
    output,
    'Actual communicative impasse',
    [
      { id: 'yes', name: 'yes' },
      { id: 'no', name: 'no' },
    ],
    { current: item.impasse || '' },
  );
  const impasseTypes =
    impasse === 'yes'
      ? await askMultiple(rl, output, 'Impasse types', codebook.categories || [], {
          current: item.impasse_types || [],
        })
      : [];
  const tutorAddressed = await askChoice(
    rl,
    output,
    'Tutor response addressed it',
    [
      { id: 'yes', name: 'yes' },
      { id: 'partly', name: 'partly' },
      { id: 'no', name: 'no' },
    ],
    { current: item.tutor_addressed || '' },
  );
  const resolved = await askChoice(
    rl,
    output,
    'Resolved within two turns',
    [
      { id: 'yes', name: 'yes' },
      { id: 'no', name: 'no' },
      { id: 'session_ended', name: 'session ended' },
    ],
    { current: item.resolved_within_2 || '' },
  );
  const notes = await rl.question(`Notes [${oneLine(item.notes || 'skip', 60)}]: `);
  return {
    impasse,
    impasse_types: impasseTypes,
    tutor_addressed: tutorAddressed,
    resolved_within_2: resolved,
    notes: notes.trim() || item.notes || '',
  };
}

async function chooseDataset(rl, output, env) {
  const datasets = listLabellingGameDatasets({ env }).datasets;
  write(output, '\nDatasets');
  datasets.forEach((dataset, index) =>
    write(output, `  ${index + 1}. ${dataset.id} - ${dataset.title} (${dataset.total})`),
  );
  while (true) {
    const answer = await rl.question(`Dataset [${datasets[0].id}]: `);
    if (!answer.trim()) return datasets[0].id;
    const selected = numberedChoice(answer, datasets);
    if (selected) return selected;
    write(output, 'Choose one of the listed datasets.');
  }
}

/**
 * Run the consolidated labelling game in a terminal.
 * The injectable streams make the same flow usable from tutor-stub and tests.
 */
export async function runLabellingGameCli({
  datasetId = '',
  coderId = '',
  input = stdin,
  output = stdout,
  env = process.env,
} = {}) {
  const rl = readline.createInterface({ input, output, terminal: Boolean(input.isTTY && output.isTTY) });
  try {
    write(output, 'Machine Spirits · Labelling Game');
    write(output, 'Human judgments only. Hidden model keys remain sealed until a packet is complete.');
    const selectedDataset = datasetId || (await chooseDataset(rl, output, env));
    const configuredCoder = coderId || env.LABELLING_GAME_CODER || '';
    const selectedCoder = configuredCoder || (await rl.question('Coder ID [rater-A]: ')) || 'rater-A';
    const codebook = getLabellingGameCodebook({ datasetId: selectedDataset, env });
    let packet = getLabellingGameItems({ datasetId: selectedDataset, coderId: selectedCoder, env });
    let index = Math.max(
      0,
      packet.items.findIndex((item) => !item.labelling_complete),
    );

    write(output, `\ncoder > ${packet.coder_id}`);
    write(output, `${packet.dataset_id} · ${packet.progress.complete}/${packet.progress.total} complete`);
    while (packet.items.length) {
      const item = packet.items[index];
      renderLabellingGameItem(output, packet.dataset_id, item, index, packet.items.length);
      const command = (await rl.question('\nEnter=label · n=next · p=previous · j <id>=jump · s=status · q=quit > '))
        .trim()
        .toLowerCase();
      if (command === 'q' || command === 'quit' || command === 'exit') break;
      if (command === 'n' || command === 'next') {
        index = Math.min(packet.items.length - 1, index + 1);
        continue;
      }
      if (command === 'p' || command === 'prev' || command === 'previous') {
        index = Math.max(0, index - 1);
        continue;
      }
      if (command === 's' || command === 'status') {
        write(
          output,
          `${packet.progress.complete}/${packet.progress.total} complete · ${packet.progress.remaining} remaining`,
        );
        continue;
      }
      if (command.startsWith('j ')) {
        const target = command.slice(2).trim().toUpperCase();
        const targetIndex = packet.items.findIndex((entry) => entry.item_id.toUpperCase() === target);
        if (targetIndex >= 0) index = targetIndex;
        else write(output, `Unknown item: ${target}`);
        continue;
      }
      if (command && command !== 'l' && command !== 'label') {
        write(output, 'Use Enter, label, next, previous, jump, status, or quit.');
        continue;
      }

      const coding =
        packet.dataset_id === LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY
          ? await labelTaxonomyItem({ rl, output, item, codebook })
          : await labelImpasseItem({ rl, output, item, codebook });
      const saved = saveLabellingGameCoding({
        datasetId: packet.dataset_id,
        coderId: selectedCoder,
        itemId: item.item_id,
        coding,
        env,
      });
      write(output, `Saved ${item.item_id} -> ${saved.rater_path}`);
      packet = getLabellingGameItems({ datasetId: packet.dataset_id, coderId: selectedCoder, env });
      if (packet.progress.remaining === 0) {
        write(output, `\nPacket complete: ${packet.progress.complete}/${packet.progress.total}`);
        break;
      }
      const nextOpen = packet.items.findIndex(
        (entry, candidateIndex) => candidateIndex > index && !entry.labelling_complete,
      );
      index = nextOpen >= 0 ? nextOpen : packet.items.findIndex((entry) => !entry.labelling_complete);
    }
    return { dataset_id: packet.dataset_id, coder_id: selectedCoder, progress: packet.progress };
  } finally {
    rl.close();
  }
}

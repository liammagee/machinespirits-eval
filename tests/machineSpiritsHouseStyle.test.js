import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA,
  MACHINE_SPIRITS_HOUSE_STYLE_SOURCES,
  machineSpiritsHouseStyleCss,
  renderMachineSpiritsHouseBackdrop,
  renderMachineSpiritsHouseStyleTag,
} from '../services/machineSpiritsHouseStyle.js';

test('house-style foundation preserves the website identity tokens and editorial extension', () => {
  const css = machineSpiritsHouseStyleCss();

  assert.match(css, /--ms-black:\s*#0a0a0a/u);
  assert.match(css, /--ms-red:\s*#e63946/u);
  assert.match(css, /--ms-grid:\s*60px/u);
  assert.match(css, /--ms-slash-angle:\s*-18deg/u);
  assert.match(css, /--ms-paper:\s*#f4eedd/u);
  assert.match(css, /\.ms-house-grid--primary/u);
  assert.match(css, /\.ms-house-cut--one/u);
  assert.match(css, /\.ms-house-noise/u);
  assert.ok(MACHINE_SPIRITS_HOUSE_STYLE_SOURCES.includes('notes/poetics/assets/techne.css'));
});

test('house-style embedding helpers produce a self-contained, versioned surface', () => {
  const style = renderMachineSpiritsHouseStyleTag();
  const backdrop = renderMachineSpiritsHouseBackdrop();

  assert.match(style, new RegExp(`data-machine-spirits-house-style="${MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA}"`, 'u'));
  assert.match(style, /--ms-font-mono/u);
  assert.doesNotMatch(style, /(?:src|href)=["']https?:\/\//u);
  assert.match(
    backdrop,
    new RegExp(`data-machine-spirits-house-backdrop="${MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA}"`, 'u'),
  );
  assert.match(backdrop, /ms-house-grid--secondary/u);
  assert.match(backdrop, /ms-house-cut--three/u);
});

import fs from 'node:fs';

export const MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA = 'machinespirits.house-style.v1';

export const MACHINE_SPIRITS_HOUSE_STYLE_SOURCES = Object.freeze([
  '../machinespirits-website/markdown/dev/STYLE-GUIDE.md',
  '../machinespirits-website/styles/main.css',
  '../machinespirits-website/plugins/techne-theme-manager/techne-tokens.css',
  'notes/poetics/assets/techne.css',
]);

const stylesheetUrl = new URL('../styles/machinespirits-house-style.css', import.meta.url);
let cachedCss = null;

export function machineSpiritsHouseStyleCss() {
  if (cachedCss === null) cachedCss = fs.readFileSync(stylesheetUrl, 'utf8');
  return cachedCss;
}

export function renderMachineSpiritsHouseStyleTag() {
  const css = machineSpiritsHouseStyleCss().replace(/<\/style/giu, '<\\/style');
  return `<style data-machine-spirits-house-style="${MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA}">\n${css}\n</style>`;
}

export function renderMachineSpiritsHouseBackdrop() {
  return `<div class="ms-house-backdrop" data-machine-spirits-house-backdrop="${MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA}" aria-hidden="true">
  <div class="ms-house-grid ms-house-grid--primary"></div>
  <div class="ms-house-grid ms-house-grid--secondary"></div>
  <div class="ms-house-grid ms-house-grid--micro"></div>
  <div class="ms-house-cuts">
    <i class="ms-house-cut ms-house-cut--one"></i>
    <i class="ms-house-cut ms-house-cut--two"></i>
    <i class="ms-house-cut ms-house-cut--three"></i>
  </div>
  <div class="ms-house-noise"></div>
</div>`;
}

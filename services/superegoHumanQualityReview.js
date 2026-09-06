import fs from 'node:fs';
import path from 'node:path';
import { ARMS, UNKNOWN, humanPacket, validateHumanRatings } from './superegoContemporaryPilot.js';

export function readHumanQuality(plan, results, first, second) {
  const documents = [first, second].filter(Boolean).map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
  const packet = humanPacket(plan, results, 'quality');
  if (
    plan.human_quality_first &&
    documents.some((document) => document.study_id !== packet.study_id || document.packet_id !== packet.packet_id)
  )
    throw new Error('Human ratings belong to a different public packet');
  const combined = {
    study_id: packet.study_id,
    packet_id: packet.packet_id,
    raters: documents.flatMap((document) => document.raters || []),
  };
  return validateHumanRatings(plan, results, 'quality', combined);
}

export function contrast(plan, lookup, arm) {
  const differences = plan.units.map((unit) => {
    const values = [arm, 'generic_revision'].map((a) => {
      const presentation = plan.presentations.quality.find((p) => p.unit === unit.id && p.arm === a);
      return lookup(presentation.id);
    });
    return {
      unit: unit.id,
      scenario: unit.scenario,
      difference: values.every(Number.isInteger) ? values[0] - values[1] : null,
    };
  });
  const known = differences.filter((row) => row.difference !== null);
  const missing = differences.length - known.length;
  const sum = known.reduce((total, row) => total + row.difference, 0);
  return {
    arm,
    comparator: 'generic_revision',
    differences,
    determinate_pairs: known.length,
    missing_or_indeterminate_pairs: missing,
    complete_case_mean_descriptive: known.length ? sum / known.length : null,
    all_unit_identification_bounds: [
      (sum - 9 * missing) / differences.length,
      (sum + 9 * missing) / differences.length,
    ],
  };
}

export function summarizeHumanQuality(plan, results, document) {
  validateHumanRatings(plan, results, 'quality', document);
  const packet = humanPacket(plan, results, 'quality');
  const rows = plan.presentations.quality.map((presentation) => {
    const ratings = document.raters.map((reader) => reader.ratings.find((row) => row.id === presentation.id).rating);
    const consensus = (field) =>
      ratings[0]?.[field] !== undefined && ratings[0][field] !== UNKNOWN && ratings[0][field] === ratings[1]?.[field]
        ? ratings[0][field]
        : UNKNOWN;
    return {
      ...presentation,
      available: !packet.items.find((item) => item.id === presentation.id).unavailable,
      human_ratings: ratings,
      quality_consensus: consensus('quality'),
      accuracy_consensus: consensus('accuracy'),
    };
  });
  const arms = ARMS.filter((arm) => arm !== 'generic_revision');
  const readers = document.raters.map((reader) => ({
    coder_id: reader.coder_id,
    contrasts: arms.map((arm) =>
      contrast(plan, (id) => reader.ratings.find((row) => row.id === id)?.rating?.quality, arm),
    ),
  }));
  const consensus = arms.map((arm) => contrast(plan, (id) => rows.find((row) => row.id === id).quality_consensus, arm));
  const availability = ARMS.map((arm) => ({
    arm,
    available: rows.filter((row) => row.arm === arm && row.available).length,
    planned: plan.units.length,
  }));
  const report = {
    study_id: plan.study_id,
    claim_status: 'descriptive_human_quality_pilot',
    primary_endpoint: 'blind public quality, actual critique minus generic revision',
    meaningful_difference: 1,
    sample: { draft_units: plan.units.length, contexts: new Set(plan.units.map((unit) => unit.scenario)).size },
    availability,
    readers,
    consensus,
    rows,
    automatic_promotion: false,
    semantic_measurement: 'not_collected',
    model_judging: 'not_collected',
    learner_or_transfer_evidence: null,
  };
  const number = (value) => (value === null ? 'unavailable' : value.toFixed(2));
  report.markdown =
    `# Human teaching-quality comparison\n\n` +
    `This is a descriptive pilot of ${report.sample.draft_units} draft units nested in ${report.sample.contexts} contexts. ` +
    `Each reader is reported separately. Disagreement remains measurement_indeterminate. ` +
    `The prespecified meaningful difference is one quality point.\n\n` +
    `| Arm | Available / planned |\n| --- | --- |\n` +
    availability.map((row) => `| ${row.arm} | ${row.available} / ${row.planned} |`).join('\n') +
    `\n\n| Reader | Actual minus generic: observed mean | Determinate pairs | Full-unit bounds |\n| --- | --- | --- | --- |\n` +
    [
      ...readers.map((reader) => ({
        label: reader.coder_id,
        value: reader.contrasts.find((row) => row.arm === 'actual_critique'),
      })),
      { label: 'Exact human consensus', value: consensus.find((row) => row.arm === 'actual_critique') },
    ]
      .map(
        ({ label, value }) =>
          `| ${label.replaceAll('|', '\\|')} | ${number(value.complete_case_mean_descriptive)} | ${value.determinate_pairs} / ${plan.units.length} | [${value.all_unit_identification_bounds.map(number).join(', ')}] |`,
      )
      .join('\n') +
    `\n\nThe observed mean covers determinate pairs only. Bounds assign every unknown difference its full [-9,+9] range; ` +
    `they are not confidence intervals. No failed unit is replaced or removed from the full-unit denominator.\n\n` +
    `Decisions for the researchers:\n\n` +
    `- Is coverage sufficient to interpret the comparison, and do both readers see a practically useful difference?\n` +
    `- Does the full pattern across draft, generic, actual and wrong critique support a larger test of feedback relevance?\n` +
    `- Do disagreements require a clearer quality construct before more automated measurement?\n\n` +
    `Accuracy and individual rationales remain in report.json. Directive fulfillment, strategy change, lexical uptake, ` +
    `learner response and transfer have not been measured. No automatic progression or efficacy claim follows.\n`;
  return report;
}

// This page receives only the blinded public packet. It has no network calls,
// arm mapping, critiques, model labels, or access to another reader's ratings.
export function humanQualityReviewHtml(packet) {
  if (packet.category !== 'quality') throw new Error('Only public quality may enter this review page');
  const blinded = {
    study_id: packet.study_id,
    packet_id: packet.packet_id,
    category: 'quality',
    instructions: packet.instructions,
    demonstration: packet.demonstration === true,
    items: packet.items.map((item) =>
      item.unavailable
        ? { id: item.id, unavailable: true }
        : {
            id: item.id,
            context: {
              learner: item.context.learner,
              teaching_material: item.context.teaching_material,
              practice_question: item.context.practice_question || null,
            },
            candidate: item.candidate.map(({ id, text }) => ({ id, text })),
          },
    ),
  };
  const data = JSON.stringify(blinded).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Teaching quality review</title><style>
body{font:17px/1.55 system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 22px;background:#faf9f5;color:#202620}
h1,h2{line-height:1.2}button,input,select,textarea{font:inherit}button{padding:10px 16px;cursor:pointer}label{display:block;margin:12px 0}
input,select,textarea{padding:8px;max-width:100%;box-sizing:border-box}textarea{width:100%;min-height:95px}article{background:white;border:1px solid #ced4c9;border-radius:12px;padding:24px;margin:28px 0}
.paragraph{white-space:pre-wrap}.evidence{display:flex;gap:10px}.evidence input{flex-shrink:0}.toolbar{position:sticky;top:0;background:#faf9f5;padding:12px 0;border-bottom:1px solid #ced4c9;z-index:1}
#status{display:block;margin:8px 0}.unavailable{color:#596155}details{margin:14px 0}small{display:block} @media print{.toolbar{position:static}button{display:none}article{break-inside:avoid}}
</style><h1>Teaching quality review</h1>
<p>Read each learner's message, the teaching context and the tutor response. Assess instructional usefulness and factual accuracy separately. Work independently and keep your ratings private until both readers finish.</p>
<p>Each response has a neutral ID. Some outputs may be unavailable; those receive no rating. All available outputs must be rated, including poor or uncertain ones.</p>
<details><summary>Scoring guidance</summary><p id="rubric"></p></details>
<div class="toolbar"><label>Your reader ID <input id="coder" autocomplete="off" placeholder="Enter your own ID"></label>
<button id="load" type="button">Load my saved progress</button> <button id="draft" type="button">Download draft</button> <button id="finish" type="button">Finish and download ratings</button><output id="status" aria-live="polite"></output></div>
<main id="items"></main><script id="packet" type="application/json">${data}</script><script>
const packet=JSON.parse(document.getElementById('packet').textContent), saved={}, coder=document.getElementById('coder'), status=document.getElementById('status');
document.getElementById('rubric').textContent=packet.instructions;
if(packet.demonstration){const banner=document.createElement('p');banner.textContent='OFFLINE DEMONSTRATION — synthetic examples, not study evidence.';banner.style.fontWeight='bold';document.querySelector('h1').after(banner);}
const element=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
const key=()=> 'superego-quality:'+packet.packet_id+':'+coder.value.trim();
function selection(name,values){const label=element('label',name+' '), select=element('select');select.append(new Option('Choose…',''));for(const value of values)select.append(new Option(String(value).replaceAll('_',' '),String(value)));label.append(select);return {label,select};}
function read(item){if(item.unavailable)return null;const controls=saved[item.id];const value=(select)=>/^\\d+$/.test(select.value)?Number(select.value):select.value;return {quality:value(controls.quality),accuracy:value(controls.accuracy),candidate_refs:controls.refs.filter(c=>c.checked).map(c=>c.value),rationale:controls.rationale.value};}
function complete(item){const rating=read(item);return item.unavailable||!!(rating.quality&&rating.accuracy&&rating.candidate_refs.length&&rating.rationale.trim());}
function documentFor(completed){return {study_id:packet.study_id,packet_id:packet.packet_id,raters:[{coder_id:coder.value.trim(),completed_at:completed?new Date().toISOString():null,ratings:packet.items.map(item=>({id:item.id,rating:read(item)}))}]};}
function progress(){status.textContent=packet.items.filter(item=>!item.unavailable&&complete(item)).length+' / '+packet.items.filter(item=>!item.unavailable).length+' available responses rated';if(coder.value.trim())try{localStorage.setItem(key(),JSON.stringify(documentFor(false)));}catch{status.textContent+=' — use Download draft to save';}}
for(const item of packet.items){const article=element('article');article.dataset.id=item.id;article.append(element('h2',item.id));document.getElementById('items').append(article);if(item.unavailable){article.append(element('p','Output unavailable — no rating.'));article.className='unavailable';continue;}
article.append(element('h3','Learner message'),element('p',item.context.learner));if(item.context.practice_question)article.append(element('p','Practice question: '+item.context.practice_question));const context=element('details');context.append(element('summary','Teaching context'),element('p',item.context.teaching_material));article.append(context,element('h3','Tutor response — select supporting paragraphs'));
const refs=item.candidate.map(paragraph=>{const label=element('label');label.className='evidence';const checkbox=element('input');checkbox.type='checkbox';checkbox.value=paragraph.id;checkbox.setAttribute('aria-label','Evidence '+paragraph.id+' for '+item.id);const text=element('span',paragraph.id+' — '+paragraph.text);text.className='paragraph';label.append(checkbox,text);article.append(label);return checkbox;});
const quality=selection('Teaching quality',[1,2,3,4,5,6,7,8,9,10,'measurement_indeterminate']),accuracy=selection('Factual accuracy',[1,2,3,4,5,'not_applicable','measurement_indeterminate']);quality.select.setAttribute('aria-label','Quality '+item.id);accuracy.select.setAttribute('aria-label','Accuracy '+item.id);const rationale=element('textarea');rationale.setAttribute('aria-label','Rationale '+item.id);const label=element('label','Brief explanation');label.append(rationale);article.append(quality.label,accuracy.label,label);saved[item.id]={quality:quality.select,accuracy:accuracy.select,refs,rationale};article.addEventListener('input',progress);article.addEventListener('change',progress);}
let activeReader='';
coder.onchange=()=>{const nextReader=coder.value.trim();if(activeReader&&nextReader!==activeReader){for(const controls of Object.values(saved)){controls.quality.value='';controls.accuracy.value='';controls.rationale.value='';for(const checkbox of controls.refs)checkbox.checked=false;}}activeReader=nextReader;status.textContent='Reader ID set. Load saved progress or continue your review.';};
document.getElementById('load').onclick=()=>{if(!coder.value.trim()){status.textContent='Enter your reader ID first.';return;}try{const previous=JSON.parse(localStorage.getItem(key()));if(!previous){status.textContent='No saved progress for this reader ID.';return;}for(const row of previous.raters[0].ratings){const controls=saved[row.id];if(!controls||!row.rating)continue;controls.quality.value=row.rating.quality;controls.accuracy.value=row.rating.accuracy;controls.rationale.value=row.rating.rationale;for(const checkbox of controls.refs)checkbox.checked=row.rating.candidate_refs.includes(checkbox.value);}progress();}catch{status.textContent='Could not load saved progress.';}};
function download(finish){if(!coder.value.trim()){status.textContent='Enter your reader ID first.';return;}if(finish&&!packet.items.every(complete)){status.textContent='Please rate every available response and select supporting evidence before finishing.';return;}const data=JSON.stringify(documentFor(finish),null,2),blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=element('a');a.href=url;a.download='quality-'+coder.value.trim().replace(/[^a-zA-Z0-9_-]/g,'_')+(finish?'':'-draft')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent=finish?'Ratings downloaded. Send this file to the study operator.':'Draft downloaded; it is not a completed rating file.';}
document.getElementById('draft').onclick=()=>download(false);document.getElementById('finish').onclick=()=>download(true);progress();
</script></html>`;
}

export function writeHumanQualityReview(destination, packet) {
  fs.mkdirSync(destination, { recursive: false });
  fs.writeFileSync(path.join(destination, 'review.html'), humanQualityReviewHtml(packet), { flag: 'wx' });
  fs.writeFileSync(
    path.join(destination, 'README.txt'),
    'Give each of two independent human readers only this folder. Open review.html in a browser.\n' +
      'Each reader enters their own ID, rates every available output, and downloads their completed ratings.\n' +
      "Keep the two readers separate; do not share the private plan, requests, responses, critiques, or another reader's ratings.\n" +
      'The operator combines both downloads with --human-report --human-quality FIRST.json --human-quality-other SECOND.json.\n' +
      'The report is offline and requires no semantic labels or model judging.\n',
    { flag: 'wx' },
  );
}

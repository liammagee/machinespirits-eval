import fs from 'node:fs';

import { Parser, Store } from 'n3';
import SHACLValidator from 'rdf-validate-shacl';

function termValue(term) {
  if (!term) return null;
  if (Array.isArray(term)) return term.map(termValue).filter(Boolean);
  return term.value ?? String(term);
}

function validationResult(row) {
  return {
    focusNode: termValue(row.focusNode),
    path: termValue(row.path),
    severity: termValue(row.severity),
    sourceConstraintComponent: termValue(row.sourceConstraintComponent),
    sourceShape: termValue(row.sourceShape),
    message: termValue(row.message),
  };
}

export function loadProofDagShaclShapes(filePath) {
  return new Store(new Parser({ baseIRI: `file://${filePath}` }).parse(fs.readFileSync(filePath, 'utf8')));
}

export async function validateProofDagDataset(dataset, shapes) {
  const report = await new SHACLValidator(shapes).validate(dataset);
  return {
    conforms: report.conforms,
    results: report.results.map(validationResult),
  };
}

export async function validateProofDagSemanticWebArtifacts({ artifacts, authoredShapes, publicShapes } = {}) {
  if (!artifacts?.authored?.store || !artifacts?.learner?.store || !artifacts?.tutor?.store) {
    throw new Error('authored, learner, and tutor semantic-web artifacts are required');
  }
  if (!authoredShapes || !publicShapes) throw new Error('authored and public SHACL shape datasets are required');
  const authored = await validateProofDagDataset(artifacts.authored.store, authoredShapes);
  const learner = await validateProofDagDataset(artifacts.learner.store, publicShapes);
  const tutor = await validateProofDagDataset(artifacts.tutor.store, publicShapes);
  return {
    schema: 'machinespirits.derivation.proof-dag-shacl-report.v1',
    worldId: artifacts.worldId,
    conforms: authored.conforms && learner.conforms && tutor.conforms,
    graphs: {
      authored: { ...authored, quadCount: artifacts.authored.store.size },
      learner: { ...learner, quadCount: artifacts.learner.store.size },
      tutor: { ...tutor, quadCount: artifacts.tutor.store.size },
    },
  };
}

/**
 * Durable template-completion gate.
 *
 * Usage:
 *   node scripts/completeTemplateAudit.mjs <TemplateName> --target /tmp/target-lock.json
 *
 * Keep the target lock outside the repository because it can identify a real
 * tracker row or record. Required shape:
 * {
 *   "trackerRow": 123,
 *   "trackerPrompt": "exact tracker prompt",
 *   "collection": "collection_name",
 *   "component": "ExampleDocument",
 *   "pdfTemplate": "ExampleDocumentPDFTemplate",
 *   "recordReference": "local reference used to select the real record",
 *   "realRecordFile": "/tmp/example-real.json",
 *   "userVisibleStateChecked": true,
 *   "pdfRegistryChecked": true,
 *   "rendererBranches": [
 *     { "name": "normal scalar", "evidence": "real" },
 *     { "name": "unlabeled grouped rows", "evidence": "shape", "file": "/tmp/example-shape.json" }
 *   ]
 * }
 */
import { existsSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(ROOT, '../..');
const TEMPLATES = path.join(ROOT, 'src/components/artifact/templates');
const PDF_TEMPLATES = path.join(ROOT, 'src/components/artifact/pdf-templates');

function fail(message) {
  console.error(`\n⛔ TEMPLATE COMPLETION BLOCKED: ${message}`);
  process.exit(2);
}

function isOutsideRepo(file) {
  const rel = path.relative(REPO_ROOT, path.resolve(file));
  return rel.startsWith('..') && !path.isAbsolute(rel);
}

function requiredString(target, key) {
  if (typeof target[key] !== 'string' || !target[key].trim()) fail(`target lock requires non-empty "${key}"`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const args = process.argv.slice(2);
const templateName = args[0]?.replace(/\.jsx$/, '');
const targetFlag = args.indexOf('--target');
if (!templateName || targetFlag < 0 || !args[targetFlag + 1]) {
  fail('usage: node scripts/completeTemplateAudit.mjs <TemplateName> --target /tmp/target-lock.json');
}

const targetFile = path.resolve(args[targetFlag + 1]);
if (!existsSync(targetFile)) fail(`target lock not found: ${targetFile}`);
if (!isOutsideRepo(targetFile)) fail('target lock must stay outside the repository');

let target;
try {
  target = JSON.parse(readFileSync(targetFile, 'utf8'));
} catch (error) {
  fail(`cannot parse target lock: ${error.message}`);
}

if (!Number.isInteger(target.trackerRow) || target.trackerRow < 1) fail('target lock requires a positive integer "trackerRow"');
for (const key of ['trackerPrompt', 'collection', 'component', 'pdfTemplate', 'recordReference', 'realRecordFile']) {
  requiredString(target, key);
}
if (target.component.replace(/\.jsx$/, '') !== templateName) {
  fail(`component mismatch: command targets ${templateName}, lock targets ${target.component}`);
}
const expectedPdf = `${templateName}PDFTemplate`;
if (target.pdfTemplate.replace(/\.jsx$/, '') !== expectedPdf) {
  fail(`PDF mismatch: expected ${expectedPdf}, lock targets ${target.pdfTemplate}`);
}
if (target.userVisibleStateChecked !== true) fail('confirm "userVisibleStateChecked": true after comparing the reported UI value with the Mongo baseline');
if (target.pdfRegistryChecked !== true) fail('confirm "pdfRegistryChecked": true after checking the direct import and pdf-templates/index.js');
const jsxFile = path.join(TEMPLATES, `${templateName}.jsx`);
const pdfFile = path.join(PDF_TEMPLATES, `${expectedPdf}.jsx`);
const pdfRegistryFile = path.join(PDF_TEMPLATES, 'index.js');
if (!existsSync(jsxFile)) fail(`JSX component not found: ${templateName}.jsx`);
if (!existsSync(pdfFile)) fail(`PDF component not found: ${expectedPdf}.jsx`);
if (!existsSync(pdfRegistryFile)) fail('PDF registry not found: pdf-templates/index.js');

const jsxSource = readFileSync(jsxFile, 'utf8');
const registrySource = readFileSync(pdfRegistryFile, 'utf8');
const pdfName = escapeRegExp(expectedPdf);
const collectionName = escapeRegExp(target.collection);
const directImport = new RegExp(`import\\s+${pdfName}\\s+from\\s+['"]\\.\\./pdf-templates/${pdfName}['"]`).test(jsxSource);
const directRender = new RegExp(`<${pdfName}\\b`).test(jsxSource);
if (!directImport || !directRender) {
  fail(`direct PDF selection must import and render ${expectedPdf} from ${templateName}.jsx`);
}
const registryImport = new RegExp(`import\\s+${pdfName}\\s+from\\s+['"]\\./${pdfName}['"]`).test(registrySource);
const registryEntry = new RegExp(`['"]${collectionName}['"]\\s*:\\s*${pdfName}\\b`).test(registrySource);
if (!registryImport || !registryEntry) {
  fail(`pdf-templates/index.js must map ${target.collection} to ${expectedPdf}`);
}

const realRecordFile = path.resolve(target.realRecordFile);
if (!existsSync(realRecordFile)) fail(`real record fixture not found: ${realRecordFile}`);
if (!isOutsideRepo(realRecordFile)) fail('real record fixture must stay outside the repository');

if (!Array.isArray(target.rendererBranches) || target.rendererBranches.length === 0) {
  fail('declare every modified renderer branch in "rendererBranches"');
}
const shapeFiles = new Set();
for (const branch of target.rendererBranches) {
  if (!branch || typeof branch.name !== 'string' || !branch.name.trim()) fail('every renderer branch requires a name');
  if (!['real', 'shape'].includes(branch.evidence)) fail(`renderer branch "${branch.name}" needs evidence "real" or "shape"`);
  if (branch.evidence === 'shape') {
    if (typeof branch.file !== 'string' || !branch.file.trim()) fail(`shape branch "${branch.name}" requires a fixture file`);
    const shapeFile = path.resolve(branch.file);
    if (!existsSync(shapeFile)) fail(`shape fixture not found for "${branch.name}": ${shapeFile}`);
    if (!isOutsideRepo(shapeFile)) fail(`shape fixture for "${branch.name}" must stay outside the repository`);
    if (shapeFile === realRecordFile) fail(`shape branch "${branch.name}" must use a fixture distinct from the real record`);
    shapeFiles.add(shapeFile);
  }
}

const audit = (label, fixture) => {
  console.log(`\n══ COMPLETION EVIDENCE: ${label} ══`);
  execFileSync('node', [path.join(ROOT, 'scripts/auditTemplate.mjs'), templateName, fixture], {
    cwd: ROOT,
    stdio: 'inherit',
  });
};

try {
  audit('full real record', realRecordFile);
  for (const fixture of shapeFiles) audit(`shape fixture ${path.basename(fixture)}`, fixture);
} catch (error) {
  fail(`audit failed with exit code ${error.status ?? 1}`);
}

console.log('\n✅ TEMPLATE COMPLETION RECEIPT');
console.log(`   Tracker row: ${target.trackerRow}`);
console.log(`   Collection: ${target.collection}`);
console.log(`   Component: ${templateName}`);
console.log(`   Renderer branches: ${target.rendererBranches.length}`);
console.log(`   Supplemental shape fixtures: ${shapeFiles.size}`);
console.log('   Eligible for a local FINISHED checkpoint; Excel coloring is deferred to the user.');

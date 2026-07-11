#!/usr/bin/env node
/**
 * _fieldDetailAudit.js — throwaway companion to checkTemplateCoverageAndOverlap.js.
 * For each collection arg: resolve matched template (same routing), then for EVERY
 * extractable unified-schema field report substring-presence in BOTH the JSX source
 * and the corresponding PDF template source. Emits JSON for downstream analysis.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const RENDERER = path.join(REPO, 'apps/frontend-vite/src/components/artifact/AIDocumentRenderer.jsx');
const TEMPLATES_DIR = path.join(REPO, 'apps/frontend-vite/src/components/artifact');
const SCHEMAS = path.join(REPO, 'apps/backend-api/services/unified-medical-schemas.json');

const src = fs.readFileSync(RENDERER, 'utf8');

const importMap = {};
const importRe = /const (\w+) = lazy\(\(\) => import\('\.\/templates\/(\w+)'\)\);/g;
let im;
while ((im = importRe.exec(src))) importMap[im[1]] = im[2]; // ComponentName -> base file name (no ext)

const start = src.indexOf('const TEMPLATE_PATTERNS = [');
const end = src.indexOf('\n  ];', start);
const block = src.slice(start, end);
const entries = [];
const nameRe = /name:\s*'([^']+)'/g;
let m, idxs = [];
while ((m = nameRe.exec(block))) idxs.push({ name: m[1], pos: m.index });
for (let i = 0; i < idxs.length; i++) {
  const seg = block.slice(idxs[i].pos, idxs[i + 1] ? idxs[i + 1].pos : block.length);
  const patterns = [];
  const patRe = /\/((?:[^\/\\\n]|\\.)+)\/([gimsuy]*)/g;
  let p;
  while ((p = patRe.exec(seg))) { try { patterns.push(new RegExp(p[1], p[2])); } catch { } }
  const compM = seg.match(/component:\s*(\w+)/);
  entries.push({ name: idxs[i].name, patterns, component: compM ? compM[1] : null });
}

const schemas = JSON.parse(fs.readFileSync(SCHEMAS, 'utf8'));

function matchEntry(collection) {
  const norm = collection.toLowerCase().trim();
  for (const t of entries) if (t.patterns.some(pt => norm === pt.source.toLowerCase())) return t;
  for (const t of entries) for (const pt of t.patterns) if (pt.test(norm)) return t;
  return null;
}

const out = [];
for (const col of process.argv.slice(2)) {
  const entry = matchEntry(col);
  if (!entry) { out.push({ col, status: 'NO_MATCH' }); continue; }
  const schema = schemas[col];
  if (!schema) { out.push({ col, status: 'NO_SCHEMA', entry: entry.name }); continue; }
  const exFields = Object.keys(schema).filter(k => schema[k].extractable);
  const base = importMap[entry.component];
  const jsxFile = path.join(TEMPLATES_DIR, 'templates', `${base}.jsx`);
  const pdfFile = path.join(TEMPLATES_DIR, 'pdf-templates', `${base}PDFTemplate.jsx`);
  const jsx = fs.existsSync(jsxFile) ? fs.readFileSync(jsxFile, 'utf8') : null;
  const pdf = fs.existsSync(pdfFile) ? fs.readFileSync(pdfFile, 'utf8') : null;
  const fields = exFields.map(f => ({
    field: f,
    type: schema[f].type,
    inJSX: jsx ? jsx.includes(f) : false,
    inPDF: pdf ? pdf.includes(f) : false,
  }));
  out.push({
    col,
    component: entry.component,
    jsxFile: path.relative(REPO, jsxFile),
    pdfFile: fs.existsSync(pdfFile) ? path.relative(REPO, pdfFile) : '(none)',
    totalExtractable: exFields.length,
    missingJSX: fields.filter(f => !f.inJSX).map(f => f.field),
    missingPDF: pdf ? fields.filter(f => !f.inPDF).map(f => f.field) : '(no pdf file)',
  });
}
console.log(JSON.stringify(out, null, 2));

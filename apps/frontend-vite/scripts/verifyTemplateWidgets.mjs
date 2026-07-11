/**
 * verifyTemplateWidgets.mjs — mechanical "did every edit widget get applied?" check for artifact templates.
 *
 * WHY: the recurring failure is shipping a PARTIAL one-pass (a numeric field left as a textarea, a native
 * <select>/<input type=date> instead of the themed picker). This renders a template with a REAL record,
 * CLICKS every editable field, records which widget mounts, and FLAGS value/widget mismatches — so a
 * partial pass fails here BEFORE the user ever sees it.
 *
 * USAGE:
 *   cd apps/frontend-vite
 *   node scripts/verifyTemplateWidgets.mjs <TemplateName|path> <record.json>
 * e.g.
 *   node scripts/verifyTemplateWidgets.mjs DocumentMetadataDocument /tmp/rec.json
 * <record.json> is ONE real record object (or an array of records) — fetch it via the MongoDB MCP /
 * mongosh and write it to a file. Exits non-zero if any mismatch is flagged.
 *
 * Widget classes it recognizes (canonical across all templates): .num-step (number stepper),
 * .blue-select-trigger (BlueSelect), .blue-date-picker / .blue-time-picker / .blue-month-picker /
 * .blue-diplotype-picker, select.edit-select (legacy native select — FLAGGED), input[type=date]
 * (native date — FLAGGED), textarea (plain text).
 */
import { transformWithOxc } from 'vite';
import babel from '@babel/core';
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import vm from 'vm';
import path from 'path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); // apps/frontend-vite
const TEMPLATES_DIR = path.join(ROOT, 'src/components/artifact/templates');
const COMPONENTS_DIR = path.join(ROOT, 'src/components/artifact/components');
const JSDOM_PATH = path.resolve(ROOT, '../backend-api/node_modules/jsdom');

/* ─── args ─── */
const [, , templateArg, recordArg] = process.argv;
if (!templateArg || !recordArg) {
  console.error('usage: node scripts/verifyTemplateWidgets.mjs <TemplateName|path> <record.json>');
  process.exit(2);
}
const templatePath = templateArg.endsWith('.jsx')
  ? path.resolve(templateArg)
  : path.join(TEMPLATES_DIR, `${templateArg.replace(/\.jsx$/, '')}.jsx`);
if (!existsSync(templatePath)) { console.error('template not found:', templatePath); process.exit(2); }
let records;
try {
  const parsed = JSON.parse(readFileSync(path.resolve(recordArg), 'utf8'));
  records = Array.isArray(parsed) ? parsed : (parsed.documents ? parsed.documents : [parsed]);
} catch (e) { console.error('cannot read record json:', e.message); process.exit(2); }

/* ─── jsdom globals ─── */
const { JSDOM } = require(JSDOM_PATH);
const dom = new JSDOM('<!doctype html><html dir="rtl"><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
let clipboard = '';
Object.assign(global, { window, document: window.document, HTMLElement: window.HTMLElement, Node: window.Node });
global.getComputedStyle = window.getComputedStyle.bind(window);
global.localStorage = window.localStorage;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', language: 'en-US', clipboard: { writeText: async (t) => { clipboard = t; } } }, configurable: true });
window.document.execCommand = () => true;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/* ─── compile (oxc jsx → classic; babel esm → cjs) ─── */
async function compile(file) {
  const oxc = await transformWithOxc(readFileSync(file, 'utf8'), file, { lang: 'jsx', jsx: { runtime: 'classic' } });
  return babel.transformSync(oxc.code, { filename: file, plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')], babelrc: false, configFile: false }).code;
}
function runModule(code, file, req) {
  const module = { exports: {} };
  new vm.Script(`(function(exports,require,module,__filename,__dirname){${code}\n})`, { filename: file }).runInThisContext()(module.exports, req, module, file, path.dirname(file));
  return module.exports;
}
const React = require('react');
const rpdf = {
  Document: ({ children }) => React.createElement('pdf', null, children),
  Page: ({ children }) => React.createElement('pdf', null, children),
  Text: ({ children }) => React.createElement('pdf', null, children),
  View: ({ children }) => React.createElement('pdf', null, children),
  StyleSheet: { create: (x) => x },
  PDFDownloadLink: ({ children }) => (typeof children === 'function' ? children({ loading: false }) : children),
};
const compiledComponents = new Map();
async function loadComponent(spec, fromDir) {
  // Blue* pickers must be REAL so the probe can detect their class; other components can be stubbed.
  const base = spec.split('/').pop();
  if (/^Blue[A-Za-z]+$/.test(base)) {
    if (!compiledComponents.has(base)) {
      const file = path.join(COMPONENTS_DIR, `${base}.jsx`);
      const mod = runModule(await compile(file), file, (s) => makeRequire(path.dirname(file))(s));
      compiledComponents.set(base, mod);
    }
    return compiledComponents.get(base);
  }
  return { __esModule: true, default: () => null }; // SearchBar / SmartDataRenderer / etc.
}
// synchronous require built from a pre-resolved cache (components compiled up-front)
function makeRequire(fromDir) {
  return (spec) => {
    if (spec === 'react') return React;
    if (spec === 'react-dom' || spec === 'react-dom/client') return require(spec);
    if (spec === '@react-pdf/renderer') return rpdf;
    if (spec.endsWith('.css')) return {};
    if (spec.includes('secureApiClient')) return { __esModule: true, default: { put: async () => ({ success: true }), get: async () => ({}), post: async () => ({}) } };
    if (/PDFTemplate$/.test(spec) || spec.includes('pdf-templates/')) return { __esModule: true, default: () => null };
    const base = spec.split('/').pop();
    if (/^Blue[A-Za-z]+$/.test(base)) { if (compiledComponents.has(base)) return compiledComponents.get(base); return { __esModule: true, default: () => null }; }
    if (spec.startsWith('../components/') || spec.startsWith('./')) return { __esModule: true, default: () => null };
    return require(spec);
  };
}

/* Pre-compile every Blue* component the template imports (so makeRequire is synchronous). */
async function precompileBlueImports(file) {
  const src = readFileSync(file, 'utf8');
  const re = /from\s+['"][^'"]*\/components\/(Blue[A-Za-z]+)['"]/g;
  let m;
  while ((m = re.exec(src))) { await loadComponent(m[1]); }
}

/* ─── value-shape classification + expected widget ─── */
const RE_INT_OR_DEC = /^-?\d+(\.\d+)?$/;
const RE_NUM_UNIT = /^-?\d+(\.\d+)?\s*(%|[A-Za-z]{1,6}(\/[A-Za-z]{1,6})?)$/; // "100 mg", "7.5%"
const RE_RANGE = /^-?\d+(\.\d+)?\s*[-–]\s*\d/;                                // "100-150 mg" → text
const RE_DATE = /^\d{4}-\d{2}-\d{2}/;                                        // ISO
const RE_DATE_WORDS = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}$/;
const RE_PHONE = /^\+?1?[\s.-]*\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}$/;          // "(602) 555-0482" (strict 3-3-4; ISO date / SSN 3-2-4 don't match)
function classify(value) {
  const v = String(value == null ? '' : value).trim();
  if (v === '') return 'empty';
  if (RE_RANGE.test(v)) return 'range';           // stays text
  if (RE_INT_OR_DEC.test(v)) return 'number';     // → stepper
  if (RE_DATE.test(v) || RE_DATE_WORDS.test(v)) return 'date'; // → BlueDatePicker
  if (RE_NUM_UNIT.test(v)) return 'number-unit';  // → stepper (measure)
  if (RE_PHONE.test(v)) return 'phone';           // → BluePhonePicker
  return 'text';
}
function widgetOf(container) {
  if (container.querySelector('.blue-date-picker')) return 'BlueDatePicker';
  if (container.querySelector('.blue-time-picker')) return 'BlueTimePicker';
  if (container.querySelector('.blue-month-picker')) return 'BlueMonthPicker';
  if (container.querySelector('.blue-diplotype-picker')) return 'BlueDiplotypePicker';
  if (container.querySelector('.blue-phone-picker')) return 'BluePhonePicker';
  if (container.querySelector('.blue-select-trigger')) return 'BlueSelect';
  if (container.querySelector('.num-step')) return 'num-stepper';
  if (container.querySelector('select')) return 'native-select';
  if (container.querySelector('input[type="date"]')) return 'native-date';
  if (container.querySelector('textarea')) return 'textarea';
  if (container.querySelector('input[type="number"]')) return 'bare-number-input';
  if (container.querySelector('input')) return 'input';
  return 'none';
}

/* ─── run ─── */
const { createRoot } = require('react-dom/client');
const { act } = React;

async function main() {
  await precompileBlueImports(templatePath);
  const Comp = runModule(await compile(templatePath), templatePath, makeRequire(path.dirname(templatePath))).default;
  const host = window.document.createElement('div');
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Comp, { document: records })); });

  const flags = [];
  const rows = [];
  // Each scalar field is a rec-mini-card with a .nested-subtitle (label) + a .numbered-row.editable-row.
  const cards = [...host.querySelectorAll('.rec-mini-card')];
  for (let i = 0; i < cards.length; i++) {
    // re-query (react re-renders replace nodes)
    const cardsNow = [...host.querySelectorAll('.rec-mini-card')];
    const card = cardsNow[i]; if (!card) continue;
    const sub = card.querySelector('.nested-subtitle');
    const label = sub ? sub.textContent.trim() : '(unlabeled)';
    const valEl = card.querySelector('.content-value');
    const value = valEl ? valEl.textContent.trim() : '';
    // Guards against false positives: numeric-looking IDENTIFIERS/CODES are not measurements → no stepper.
    const isMultiItem = card.querySelectorAll('.content-value').length > 1; // array/list field (codes, items) rendered verbatim
    const idLabel = /\b(npi|mrn|code|codes|id|identifier|account|record\s*number|phone|fax|zip|ssn|dea|upin|tin)\b/i.test(label);
    const row = card.querySelector('.numbered-row.editable-row');
    if (!row || !valEl) continue; // not an editable scalar row (may be array/section wrapper)
    await act(async () => { row.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    const widget = widgetOf(cards[i] === card ? card : ([...host.querySelectorAll('.rec-mini-card')][i] || card));
    let kind = classify(value);
    // reclassify numeric identifiers/codes so they are NOT expected to have a stepper
    if ((kind === 'number' || kind === 'number-unit') && (idLabel || isMultiItem)) kind = 'identifier/code';
    rows.push({ label, value: value.length > 42 ? value.slice(0, 42) + '…' : value, kind, widget });
    // mismatch rules (mechanical, high-confidence only)
    if (kind === 'number' && !['num-stepper'].includes(widget)) flags.push({ label, value, kind, widget, why: 'numeric value not on a −/+ stepper' });
    if (kind === 'date' && !idLabel && !isMultiItem && !['BlueDatePicker', 'BlueMonthPicker'].includes(widget)) flags.push({ label, value, kind, widget, why: 'date value not on BlueDatePicker' });
    if (widget === 'native-select') flags.push({ label, value, kind, widget, why: 'native <select> — use BlueSelect (RTL-unsafe OS chrome)' });
    if (widget === 'native-date') flags.push({ label, value, kind, widget, why: 'native <input type=date> — use BlueDatePicker' });
    if (kind === 'phone' && widget !== 'BluePhonePicker') flags.push({ label, value, kind, widget, why: 'phone value not on BluePhonePicker' });
    if (widget === 'bare-number-input' && !idLabel && !isMultiItem) flags.push({ label, value, kind, widget, why: 'bare <input type=number> without −/+ stepper' });
    // cancel to restore
    const cancel = [...([...host.querySelectorAll('.rec-mini-card')][i] || card).querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel');
    if (cancel) await act(async () => { cancel.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
  }
  await act(async () => { root.unmount(); });

  /* ─── report ─── */
  const tname = path.basename(templatePath);
  console.log(`\n=== verifyTemplateWidgets: ${tname} (${rows.length} scalar fields probed) ===`);
  const pad = Math.min(34, Math.max(...rows.map(r => r.label.length), 5));
  for (const r of rows) {
    const bad = flags.find(f => f.label === r.label && f.value === r.value.replace(/…$/, r.value.slice(-1)));
    const mark = flags.some(f => f.label === r.label) ? '❌' : '✅';
    console.log(`  ${mark} ${r.label.padEnd(pad)}  value="${r.value}"  [${r.kind}] → ${r.widget}`);
  }
  if (flags.length) {
    console.log(`\n⛔ ${flags.length} WIDGET MISMATCH(ES) — partial one-pass:`);
    flags.forEach(f => console.log(`   • ${f.label}: value "${String(f.value).slice(0, 40)}" [${f.kind}] mounted ${f.widget} — ${f.why}`));
    console.log('\nFix the widget for each flagged field, then re-run. (enums are judgment calls — verify dropdowns visually.)');
    process.exit(1);
  }
  console.log('\n✅ No mechanical widget mismatches. (Still eyeball enum dropdowns + sentence splitting — those are judgment calls.)');
  process.exit(0);
}
main().catch(e => { console.error('HARNESS ERROR:', e && e.stack || e); process.exit(3); });

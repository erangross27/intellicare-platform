/**
 * auditTemplate.mjs — FULL one-pass audit for an artifact template (memory 6a45e766, 11 items).
 *
 * WHY: verifyTemplateWidgets.mjs only checks edit WIDGETS (checklist item 8). The recurring misses
 * are the OTHER items — approve button (item 7), copy dividers (item 2), PDF (item 9), header pills
 * (item 10), titles/fileName (item 11), RTL. This script checks them STATICALLY (grep the JSX/CSS/PDF)
 * and DYNAMICALLY (render Copy All + the PDF), AND runs the widget harness — so a green here means the
 * whole checklist passed, not just widgets. A green widget harness is NOT "done".
 *
 * USAGE:
 *   cd apps/frontend-vite
 *   node scripts/auditTemplate.mjs <TemplateName> <record.json>   # FULL (static + dynamic render)
 *   node scripts/auditTemplate.mjs <TemplateName> --static        # STATIC only (no record, no render deps)
 * The --static mode is pure file-regex (no vite/babel/jsdom) so the pre-commit hook can run it fast to
 * BLOCK a commit whose staged template fails the source-checkable items. Exits non-zero if any check fails.
 * Checks are GATED on presence (a template with no approve button skips the approve checks, etc.).
 */
import { readFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'); // apps/frontend-vite
const TEMPLATES = path.join(ROOT, 'src/components/artifact/templates');
const PDFDIR = path.join(ROOT, 'src/components/artifact/pdf-templates');
const COMPONENTS = path.join(ROOT, 'src/components/artifact/components');
const JSDOM_PATH = path.resolve(ROOT, '../backend-api/node_modules/jsdom');

const [, , templateArg, recordArg] = process.argv;
if (!templateArg) { console.error('usage: node scripts/auditTemplate.mjs <TemplateName> <record.json|--static>'); process.exit(2); }
const STATIC_ONLY = !recordArg || recordArg === '--static';
const name = path.basename(templateArg).replace(/\.jsx$/, '');
const jsxPath = templateArg.endsWith('.jsx') ? path.resolve(templateArg) : path.join(TEMPLATES, `${name}.jsx`);
const cssPath = path.join(TEMPLATES, `${name}.css`);
const pdfPath = path.join(PDFDIR, `${name}PDFTemplate.jsx`);
if (!existsSync(jsxPath)) { console.error('template not found:', jsxPath); process.exit(2); }
const JSX = readFileSync(jsxPath, 'utf8');
const CSS = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
const PDFSRC = existsSync(pdfPath) ? readFileSync(pdfPath, 'utf8') : '';
const records = STATIC_ONLY ? [] : (() => { const p = JSON.parse(readFileSync(path.resolve(recordArg), 'utf8')); return Array.isArray(p) ? p : (p.documents || [p]); })();

let fails = 0, passes = 0, skips = 0;
const ok = (n) => { passes++; console.log(`  ✅ ${n}`); };
const bad = (n, d = '') => { fails++; console.log(`  ❌ ${n}${d ? '  — ' + d : ''}`); };
const skip = (n) => { skips++; console.log(`  ·  ${n} (n/a)`); };
let advisories = 0;
const advise = (n) => { advisories++; console.log(`  ⚠  ${n}`); }; // non-blocking — surfaces a judgment call, never fails the gate
const check = (n, cond, d = '') => (cond ? ok(n) : bad(n, d));

console.log(`\n══ AUDIT ${name}${STATIC_ONLY ? ' [static]' : ''} ══`);
console.log('\n── STATIC (item 7 approve · 8 widgets · 10 pills · 11 titles · RTL · 9 PDF lines) ──');

// item 8 — no native edit controls
check('no native <input type=date>', !/type=["']date["']/.test(JSX));
check('no native <select> (use BlueSelect)', !/<select[\s>]/.test(JSX));
check('no native <input type=number>', !/type=["']number["']/.test(JSX));
check('no native phone input (use BluePhonePicker)', !/type=["']tel["']/.test(JSX));
// item 8 — phone fields (phone/officePhone/afterHoursPhone/…) must be wired to BluePhonePicker (edit-widget rule, memory 6a4cbf9a)
if (/PHONE_FIELDS|BluePhonePicker/.test(JSX)) check('phone fields wired to BluePhonePicker', /import\s+BluePhonePicker/.test(JSX));

// item 7 — approve button standard (gated: only if the template has an approve button)
if (/approve-btn/.test(JSX)) {
  // accept both styles: concat ('Pending Approve' / ' pending') AND inline JSX (>Pending Approve< / className="approve-btn pending").
  // NB: the badge "click Pending Approve to save" must NOT satisfy this — require a quote or '>' immediately before "Pending".
  check("approve text 'Pending Approve'", /['"`]Pending Approve['"`]/.test(JSX) || />\s*Pending Approve\s*</.test(JSX));
  check("approve className has pending", /' pending'/.test(JSX) || /approve-btn\s+pending/.test(JSX));
  check("badge 'click Pending Approve to save' (not 'click approve')", /Pending Approve to save/.test(JSX) && !/click approve to save/i.test(JSX));
  if (CSS) {
    check('CSS .approve-btn capitalize (not uppercase)', /\.approve-btn\s*\{[^}]*text-transform:\s*capitalize/s.test(CSS) && !/\.approve-btn\s*\{[^}]*text-transform:\s*uppercase/s.test(CSS));
    check('CSS .approve-btn.pending exists', /\.approve-btn\.pending\s*\{/.test(CSS));
    check('CSS .approve-btn.approved exists', /\.approve-btn\.approved\s*\{/.test(CSS));
    check('CSS .header-right-actions column (approve BELOW copy)', /\.header-right-actions\s*\{[^}]*flex-direction:\s*column/s.test(CSS));
  }
} else skip('approve button standard');

// item 11 — titles + fileName convention
check('fileName not date-suffixed lowercase', !/fileName=\{`[a-z_]+_\$\{new Date/.test(JSX) && !/toISOString\(\)\.split\('T'\)\[0\]\}\.pdf/.test(JSX));
check("fileName Underscore_Name.pdf convention", /fileName=["'][A-Z][A-Za-z0-9_]*\.pdf["']/.test(JSX) || /fileName=\{`[A-Z]/.test(JSX));

// item 10 — no record-header meta pills left rendering
check('no .date-badge value pill', !/className="date-badge"/.test(JSX) && !/\.date-badge\s*\{/.test(CSS));

// RTL + copied-blue + splitBySentence
if (CSS) {
  check('CSS root direction:ltr', /-document\s*\{[^}]*direction:\s*ltr/s.test(CSS));
  check('CSS * direction:ltr (RTL force)', /-document \*\s*\{[^}]*direction:\s*ltr/s.test(CSS));
  check('copied button NOT green', !/\.copied\s*\{[^}]*(#22c55e|#10b981|rgba\(16,\s*185)/s.test(CSS));
  // edit Save/Cancel buttons LEFT-aligned (standing user pref, memory 6a4b923a): flex-start, never flex-end
  if (/\.edit-actions\s*\{/.test(CSS)) check('edit Save/Cancel LEFT (.edit-actions flex-start not flex-end)', !/\.edit-actions\s*\{[^}]*justify-content:\s*flex-end/s.test(CSS));
} else skip('CSS checks');
// The split char-class must be [.;]/[;.] IMMEDIATELY followed by a whitespace matcher — i.e. the .split() regex
// itself splits on ';'. (Old check just grepped for "[.;]" anywhere and was satisfied by a trailing-trim
// /[;.]+$/ while splitBySentence split on PERIOD ONLY — FamilyMedicineVisits followUp/plan blob, July 9 2026.)
if (/splitBySentence/.test(JSX)) check('splitBySentence splits on [.;] not just period', /\[[.;]{2}\](?:\(\?:)?\\s/.test(JSX));

// item 9 — PDF underline rules (box-free donor: title/section/label all get a borderBottom line)
if (PDFSRC) {
  check('PDF documentTitle has borderBottom rule', /documentTitle:\s*\{[^}]*borderBottom/s.test(PDFSRC));
  check('PDF sectionTitle has borderBottom rule (1pt black line)', /sectionTitle:\s*\{[^}]*borderBottom/s.test(PDFSRC));
  check('PDF fieldLabel has borderBottom rule (0.5pt #999 line)', /fieldLabel:\s*\{[^}]*borderBottom/s.test(PDFSRC));
  // ── PDF page-break structure (Rule #74, memory 6a2d6af6 + 6a4cb19d) — the #1 systemic bug, at the source ──
  // wrap={…?undefined:false} passes wrap={undefined} which is UNBREAKABLE on react-pdf 4.5.1 → the block
  // silently overflows/OVERPRINTS instead of moving. BOOLEANS ONLY: wrap={rows>N?true:false}. Verified: all
  // good templates pass, EdCourse/EmergencyObservationUnit/EmergencyProcedures/EdDisposition/EmergencyReports/
  // EmergencyInformation fail. (recordContainer marginBottom is a REAL but conditional bug — 474/958 templates
  // use it and mostly render fine, so it stays memory guidance, NOT a commit-block that would wedge half the family.)
  check('PDF no broken wrap idiom (wrap={…undefined…} is unbreakable → overprint on 4.5.1)',
    !/wrap=\{[^{}]*\bundefined\b[^{}]*\}/.test(PDFSRC),
    (PDFSRC.match(/wrap=\{[^{}]*\bundefined\b[^{}]*\}/) || [''])[0]);
} else skip('PDF underline rules');

// item 8 — enum dropdown dup guard (memory 6a4b38d2): enumOptionsWith MUST be case-insensitive
if (/enumOptionsWith/.test(JSX)) check('enumOptionsWith case-insensitive (no duplicate dropdown option)', /\.some\(o\s*=>\s*o\.toLowerCase\(\)/s.test(JSX) && !/return base\.includes\(cur\)/.test(JSX));

if (STATIC_ONLY) {
  console.log(`\n══ ${passes} passed · ${fails} failed · ${skips} n/a  [static] ══`);
  process.exit(fails ? 1 : 0);
}

/* ── DYNAMIC (record-based): widget harness + Copy All render + PDF render ── */
const { transformWithOxc } = await import('vite');
const babel = (await import('@babel/core')).default;
const vm = (await import('vm')).default;

// widget harness (item 8) — and catch the vacuous "0 scalar fields probed" green (memory 6a4b845b)
console.log('\n── WIDGET HARNESS (verifyTemplateWidgets.mjs) ──');
let widgetProbeCount = 0;
try {
  const out = execFileSync('node', [path.join(ROOT, 'scripts/verifyTemplateWidgets.mjs'), name, path.resolve(recordArg)], { encoding: 'utf8' });
  const m = out.match(/\((\d+) scalar fields probed\)/);
  const n = m ? parseInt(m[1], 10) : 0;
  widgetProbeCount = n;
  check('widget harness exit 0', true);
  check('widget harness probed > 0 fields (not vacuous green)', n > 0, `${n} probed — 0 means rows don't match .numbered-row.editable-row`);
} catch (e) {
  bad('widget harness exit 0', (e.stdout || '').split('\n').filter(Boolean).slice(-3).join(' | '));
}

const { JSDOM } = require(JSDOM_PATH);
const dom = new JSDOM('<!doctype html><html dir="rtl"><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
let clip = '';
let jsxScalarValues = [];
Object.assign(global, { window, document: window.document, HTMLElement: window.HTMLElement, Node: window.Node });
global.getComputedStyle = window.getComputedStyle.bind(window);
global.localStorage = window.localStorage;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0); global.cancelAnimationFrame = (id) => clearTimeout(id);
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', language: 'en-US', clipboard: { writeText: async (t) => { clip = t; } } }, configurable: true });
window.document.execCommand = () => true; globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function compile(f) { const oxc = await transformWithOxc(readFileSync(f, 'utf8'), f, { lang: 'jsx', jsx: { runtime: 'classic' } }); return babel.transformSync(oxc.code, { filename: f, plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')], babelrc: false, configFile: false }).code; }
function runMod(code, f, req) { const m = { exports: {} }; new vm.Script(`(function(exports,require,module,__filename,__dirname){${code}\n})`, { filename: f }).runInThisContext()(m.exports, req, m, f, path.dirname(f)); return m.exports; }
const React = require('react');
const rpdfStub = { Document: ({ children }) => React.createElement('pdf', null, children), Page: ({ children }) => React.createElement('pdf', null, children), Text: ({ children }) => React.createElement('pdf', null, children), View: ({ children }) => React.createElement('pdf', null, children), StyleSheet: { create: (x) => x }, PDFDownloadLink: ({ children }) => (typeof children === 'function' ? children({ loading: false }) : children) };
const blues = new Map();
const mkReq = () => (spec) => {
  if (spec === 'react') return React;
  if (spec === 'react-dom' || spec === 'react-dom/client') return require(spec);
  if (spec === '@react-pdf/renderer') return rpdfStub;
  if (spec.endsWith('.css')) return {};
  if (spec.includes('secureApiClient')) return { __esModule: true, default: { put: async () => ({ success: true }) } };
  if (/PDFTemplate$/.test(spec) || spec.includes('pdf-templates/')) return { __esModule: true, default: () => null };
  const b = spec.split('/').pop();
  if (/^Blue[A-Za-z]+$/.test(b)) return blues.has(b) ? blues.get(b) : { __esModule: true, default: () => null };
  if (spec.startsWith('../components/') || spec.startsWith('./')) return { __esModule: true, default: () => null };
  return require(spec);
};

console.log('\n── DYNAMIC (item 2 copy dividers · 4 mirror · 9 PDF) ──');
try {
  const re = /from\s+['"][^'"]*\/components\/(Blue[A-Za-z]+)['"]/g; let mm;
  while ((mm = re.exec(JSX))) { const b = mm[1], f = path.join(COMPONENTS, `${b}.jsx`); if (!blues.has(b) && existsSync(f)) blues.set(b, runMod(await compile(f), f, mkReq())); }
  const Comp = runMod(await compile(jsxPath), jsxPath, mkReq()).default;
  const { createRoot } = require('react-dom/client'); const { act } = require('react');
  const host = window.document.createElement('div'); window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Comp, { document: records })); });
  const btn = [...host.querySelectorAll('button')].find(b => /copy all/i.test(b.textContent));
  if (btn) {
    await act(async () => { btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    check('Copy All EQ dividers (====)', clip.includes('='.repeat(40)));
    check('Copy All DASH dividers (----) or single-value only', clip.includes('-'.repeat(40)) || /^1\. /m.test(clip));
    check('Copy All numbers rows (1.)', /^\s*1\. /m.test(clip));
    const sb = clip.split('\n').filter(l => /^[A-Z][A-Za-z ]{1,30}:\s+\S/.test(l) && !/^https?:/.test(l));
    check('Copy All NO side-by-side "Label: value"', sb.length === 0, sb.slice(0, 3).join(' | '));
  } else skip('Copy All (no button)');
  check("no bare 'Approve' button rendered (must be 'Pending Approve')", ![...host.querySelectorAll('button')].some(b => b.textContent.trim() === 'Approve'));
  // Single-name gate: a nested-subtitle must NEVER duplicate its OWN section title (double-name bug — EmergencyReports Recommendations/Recommendations, July 7 2026). When a field label equals the section title, suppress the nested-subtitle.
  {
    const dnorm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const dupTitles = [];
    for (const sec of host.querySelectorAll('.section')) {
      const stEl = sec.querySelector('.section-title'); const st = dnorm(stEl && stEl.textContent);
      if (!st) continue;
      if ([...sec.querySelectorAll('.nested-subtitle')].some(n => dnorm(n.textContent) === st)) dupTitles.push(stEl.textContent.trim());
    }
    check('JSX no section-title duplicated as a nested-subtitle (single-name gate)', dupTitles.length === 0, dupTitles.join(', '));
  }
  // JSX side-by-side "Label: value" IN THE RENDERED DOM. The Copy-All check above only inspects the CLIPBOARD
  // string AND only flags labels that live in FIELD_LABELS — so OBJECT-ARRAY sub-fields whose labels are NOT in
  // FIELD_LABELS (a medication's "Dosage: 1000mg", an AED's "Dose: ..."), rendered inline on-screen, slipped
  // through green (user-caught FamilyMedicineVisits medications, July 9 2026 — memory 6a4e4e51). Canonical: every
  // field label is a nested-subtitle ABOVE its value row, NEVER "Label: value" baked into the row itself.
  {
    const labelSpans = [...host.querySelectorAll('.content-label')]; // the explicit side-by-side label span
    const inlineColon = [...host.querySelectorAll('.row-content')].filter(rc => {
      if (rc.querySelector('.content-label')) return false;                 // already counted above
      const vEls = rc.querySelectorAll('.content-value');
      if (vEls.length !== 1) return false;                                  // multi-value/array rows are not label:value
      return /^[A-Z][A-Za-z0-9 /&()+-]{1,28}:\s+\S/.test((vEls[0].textContent || '').trim());
    });
    const offenders = [...new Set([...labelSpans.map(s => s.textContent.trim()), ...inlineColon.map(rc => rc.textContent.trim().slice(0, 40))])];
    check('JSX no side-by-side "Label: value" row (label must be a nested-subtitle above the value)', offenders.length === 0, offenders.slice(0, 3).join(' | '));
  }
  // JSX rows must be UNNUMBERED — numbering lives ONLY in Copy Section / Copy All / PDF (canonical one-pass item 3,
  // memory 6a45e766 / 697ba988). A renderer that prints "${i+1}. " into the on-screen .content-value (a common
  // array / comma-split miss — EndocrineTherapy "Side Effects" showed "1./2./3." on screen, user-caught July 8 2026)
  // is a violation. Copy/PDF numbering is unaffected (those are separate string builders, not .content-value nodes).
  {
    const numbered = [...host.querySelectorAll('.content-value')]
      .map(v => v.textContent.trim()).filter(t => /^\d+\.\s/.test(t));
    check('JSX rows unnumbered (numbering only in Copy/PDF)', numbered.length === 0,
      numbered.slice(0, 4).map(t => JSON.stringify(t.slice(0, 40))).join(' | '));
  }
  // COMPLETE EDITABILITY: a nonzero widget count is not enough. Every visible scalar row must actually be
  // clickable/editable, and cards containing multiple rows must give each row a stable data-edit-field identity
  // so the harness can re-query it after React renders (Pulmonology Consultations row 644, July 2026).
  {
    const scalarRows = [...new Set([...host.querySelectorAll('.content-value')]
      .map(value => value.closest('.numbered-row')).filter(Boolean))];
    jsxScalarValues = [...host.querySelectorAll('.content-value')]
      .map(value => value.textContent.trim()).filter(Boolean);
    const readOnlyRows = scalarRows.filter(row => !row.classList.contains('editable-row'));
    check('JSX every visible scalar row is editable', readOnlyRows.length === 0,
      readOnlyRows.slice(0, 4).map(row => JSON.stringify(row.textContent.trim().slice(0, 50))).join(' | '));

    const untracked = [];
    for (const card of host.querySelectorAll('.rec-mini-card')) {
      const rows = [...card.querySelectorAll('.numbered-row.editable-row')];
      if (rows.length <= 1) continue;
      rows.forEach(row => { if (!row.closest('[data-edit-field]')) untracked.push(row); });
    }
    check('JSX multi-row cards expose every leaf to the widget harness', untracked.length === 0,
      `${untracked.length} editable row(s) in multi-row cards lack data-edit-field`);
    check('widget harness probe count equals visible scalar row count', widgetProbeCount === scalarRows.length,
      `${widgetProbeCount} probed vs ${scalarRows.length} visible scalar rows`);

    const copyValueLines = new Set(clip.split('\n').map(line => line.trim().replace(/^\d+\.\s+/, '')).filter(Boolean));
    const missingCopyRows = jsxScalarValues.filter(value => !copyValueLines.has(value));
    check('Copy All mirrors every JSX scalar as its own row', missingCopyRows.length === 0,
      missingCopyRows.slice(0, 4).map(value => JSON.stringify(value.slice(0, 60))).join(' | '));
  }
  // ADVISORY (non-blocking): a field that renders as ONE value row but whose text is a comma/semicolon list of
  // several items — surfaces the "keep whole vs split" judgment call so it is a CONSCIOUS decision, never a
  // silent miss (clinicalIndication/findings left whole, EmergencyReports July 7 2026). This user prefers
  // aggressive splitting; a legitimately-whole field (ECG-lead 'II, III, aVF' shatter trap) is expected to be
  // listed and left alone. Advisory only — it NEVER changes the pass/fail count or exit code.
  {
    const splitGuardedComma = (t) => {
      const out = []; let cur = '', depth = 0;
      for (let i = 0; i < t.length; i++) { const c = t[i];
        if (c === '(') { depth++; cur += c; }
        else if (c === ')') { depth = Math.max(0, depth - 1); cur += c; }
        else if (c === ',' && depth === 0) {
          const rest = t.slice(i + 1).replace(/^\s+/, '');
          if (/^(and|or)\b/i.test(rest) || /^\d/.test(t[i + 1] || '')) { cur += c; } // Oxford + "$18,000" guards
          else { if (cur.trim()) out.push(cur.trim()); cur = ''; }
        } else cur += c;
      }
      if (cur.trim()) out.push(cur.trim());
      return out;
    };
    const reported = new Set();
    for (const val of host.querySelectorAll('.content-value')) {
      const container = val.closest('.rec-mini-card') || val.closest('.section');
      if (!container || container.querySelectorAll('.content-value').length !== 1) continue; // >1 → already split
      const txt = val.textContent.trim();
      if (txt.length < 20 || reported.has(txt)) continue;
      reported.add(txt);
      // Skip date/time-shaped values — a "Monday, February 9, 2026, 2:30 PM" display is not a narrative list.
      if (/\b\d{4}\b|\d{1,2}:\d{2}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b|\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\b/i.test(txt)) continue;
      const commaItems = splitGuardedComma(txt).filter(x => /[A-Za-z]{2,}/.test(x)); // wordy items only (drop bare numbers)
      const semiItems = txt.split(';').map(s => s.trim()).filter(x => /[A-Za-z]{2,}/.test(x));
      // Skip name + credentials ("Dr. Sarah Johnson, MD, FACC") — a title prefix or a bare credential token means
      // it's a person, not a narrative list. (Roman numerals excluded so ECG-lead "II, III, aVF" still surfaces.)
      const CRED = /^(?:MD|DO|RN|LPN|NP|PA|PhD|PharmD|FACC|FACP|FACS|FAAP|FACOG|MPH|MBA|BSN|MSN|DDS|DMD|DVM|DPT|Esq|Jr|Sr)\.?$/i;
      if (/^(?:Dr|Mr|Mrs|Ms|Prof|Rev|Sir|Dame)\.?\s/i.test(txt) || [...commaItems, ...semiItems].some(x => CRED.test(x))) continue;
      const label = (container.querySelector('.nested-subtitle')?.textContent           // labeled field
        || val.closest('.section')?.querySelector('.section-title')?.textContent        // single-name field → section title lives on the section ancestor
        || '(field)').trim();
      if (commaItems.length >= 3) advise(`splittable-but-whole: "${label}" — ${commaItems.length} comma items in one row (intentional? this user prefers aggressive splitting)`);
      else if (semiItems.length >= 2) advise(`splittable-but-whole: "${label}" — ${semiItems.length} semicolon items in one row`);
    }
  }
  await act(async () => { root.unmount(); });
} catch (e) { bad('Copy All render', String(e.message).slice(0, 120)); }

if (PDFSRC) {
  try {
    const warns = []; const ow = console.warn; console.warn = (...a) => warns.push(a.join(' '));
    const realRpdf = require(path.join(ROOT, 'node_modules/@react-pdf/renderer'));
    const PdfComp = runMod(await compile(pdfPath), pdfPath, (s) => (s === 'react' ? React : s === '@react-pdf/renderer' ? realRpdf : s.endsWith('.css') ? {} : require(s))).default;
    const buf = await realRpdf.renderToBuffer(React.createElement(PdfComp, { document: records }));
    console.warn = ow;
    check('PDF renders (bytes > 1000)', buf.length > 1000, `${buf.length}`);
    check('PDF 0 wrap/orphan warnings', warns.length === 0, warns.slice(0, 2).join('; '));
  } catch (e) { bad('PDF render', String(e.message).slice(0, 120)); }
} else skip('PDF (no PDFTemplate)');

// FIELD PARITY (JSX/PDF): DOM-mock RENDER the PDF and confirm every field the JSX ACTUALLY RENDERED
// (its FIELD_LABEL appears as a line in the Copy All output above — which already respects hasVal + hide-zero)
// also renders in the PDF, as an exact >Label< text node. Catches a field present on-screen but MISSING from
// the PDF export (the EdTriageAssessment "date missing from the PDF, header showed createdAt" bug, memory
// 6a4bb189). Using the Copy All `clip` as the source of truth (not raw record keys) avoids false-positives on
// hide-zero fields (educationDurationMinutes=0 renders in neither → not required). Array-field labels are
// excluded (some PDFs render arrays under a section title, not the field label). A source name-grep is too
// weak (a field name in a DATE_KEYS/ENUM const falsely passes) — must render. Dynamic-only (needs the record
// + the Copy All render) → never runs in the --static commit-block, can't spuriously block a commit.
if (PDFSRC && clip) {
  try {
    const RDS = require(path.join(ROOT, 'node_modules/react-dom/server'));
    const mkEl = (tag) => ({ children }) => React.createElement(tag, null, children);
    const rpdfMock = { Document: mkEl('div'), Page: mkEl('div'), View: mkEl('div'), Text: mkEl('span'), Link: mkEl('span'), Image: mkEl('img'), StyleSheet: { create: (x) => x }, Font: { register: () => {} } };
    const PdfMock = runMod(await compile(pdfPath), pdfPath, (s) => (s === 'react' ? React : s === '@react-pdf/renderer' ? rpdfMock : s.endsWith('.css') ? {} : require(s))).default;
    const html = RDS.renderToStaticMarkup(React.createElement(PdfMock, { document: records }));
    const pdfDoc = new JSDOM(`<body>${html}</body>`).window.document;
    const pdfValueLines = new Set([...pdfDoc.querySelectorAll('span')]
      .map(node => node.textContent.trim().replace(/^\d+\.\s+/, '')).filter(Boolean));
    const missingPdfRows = jsxScalarValues.filter(value => !pdfValueLines.has(value));
    check('PDF mirrors every JSX scalar as its own row', missingPdfRows.length === 0,
      missingPdfRows.slice(0, 4).map(value => JSON.stringify(value.slice(0, 60))).join(' | '));
    const labelsBlock = (JSX.match(/const FIELD_LABELS\s*=\s*\{[\s\S]*?\n\};/) || [''])[0];
    const labels = Object.fromEntries([...labelsBlock.matchAll(/(\w+):\s*'([^']+)'/g)].map(m => [m[1], m[2]]));
    const arrFields = new Set();
    [...JSX.matchAll(/(?:ARRAY_FIELDS|OBJECT_FIELDS|OBJECT_ARRAY_FIELDS)\s*=\s*\[([^\]]*)\]/g)].forEach(m => [...m[1].matchAll(/'([A-Za-z0-9]+)'/g)].forEach(x => arrFields.add(x[1])));
    const clipLines = new Set(clip.split('\n').map(l => l.trim()));
    const missing = Object.entries(labels).filter(([f, lab]) => clipLines.has(lab) && !arrFields.has(f) && !html.includes('>' + lab + '<')).map(([, lab]) => lab);
    check('PDF renders every JSX-rendered field (JSX/PDF parity)', missing.length === 0, 'MISSING label(s) in PDF: ' + [...new Set(missing)].join(', '));
  } catch (e) { bad('PDF field parity', String(e.message).slice(0, 120)); }
}

// PAGE-BREAK ANTI-ORPHAN (Rule #74, memory 6a2d6af6): DOM-mock render the PDF preserving each View's wrap +
// style NAME, then assert every sectionTitle is INSIDE a wrap=false View (glued to its field content) — NOT a
// standalone sibling of field Views, which react-pdf strands alone at a page bottom when the section flows
// (the "orphaned title" bug). The ChiropracticConsultation renderFieldUnit invariant: the title rides inside
// the FIRST field's own wrap-gated (≤22 rows → false) View. Dynamic-only (needs the record) → never blocks a commit.
if (PDFSRC) {
  try {
    const RDS = require(path.join(ROOT, 'node_modules/react-dom/server'));
    const pick = (style) => (Array.isArray(style) ? style.find(s => s && s.__name) : style) || {};
    const named = (tag) => ({ style, wrap, children }) => React.createElement(tag, {
      'data-style': pick(style).__name,
      'data-wrap': wrap === undefined ? undefined : String(wrap),
    }, children);
    const orphanMock = {
      Document: named('div'), Page: named('div'), View: named('div'), Text: named('span'), Link: named('span'), Image: named('img'),
      StyleSheet: { create: (obj) => { const t = {}; for (const k in obj) t[k] = { ...obj[k], __name: k }; return t; } },
      Font: { register: () => {} },
    };
    const PdfO = runMod(await compile(pdfPath), pdfPath, (s) => (s === 'react' ? React : s === '@react-pdf/renderer' ? orphanMock : s.endsWith('.css') ? {} : require(s))).default;
    const html = RDS.renderToStaticMarkup(React.createElement(PdfO, { document: records }));
    const { JSDOM } = require(JSDOM_PATH);
    const odoc = new JSDOM(`<body>${html}</body>`).window.document;
    const titles = [...odoc.querySelectorAll('[data-style="sectionTitle"]')];
    const orphans = titles.filter(t => {
      let el = t.parentElement;                                   // nearest ANCESTOR carrying an explicit wrap
      while (el && el.getAttribute('data-wrap') === null) el = el.parentElement;
      return !el || el.getAttribute('data-wrap') !== 'false';     // must be wrap=false (atomic, glued) → no orphan
    });
    if (titles.length) check('PDF section titles glued — each inside a wrap=false View (no orphaned title)',
      orphans.length === 0, `${orphans.length}/${titles.length} title(s) not in a wrap=false block (orphan risk)`);

    // CONDITIONAL-CLAUSE-AS-SUBTITLE (memory 6a4cb55c): a nested-subtitle that is actually a conditional clause
    // ("If chest pain recurs", "When …") means parseLabel mis-split a sentence's GRAMMATICAL colon as Label:Value.
    // Fix by stripping that colon upstream in splitBySentence. Dynamic-only (needs the record) → never blocks a commit.
    const subs = [...odoc.querySelectorAll('span')].filter(s => /subtitle|sublabel/i.test(s.getAttribute('data-style') || ''));
    const condSubs = subs.filter(s => /^(If|When|While|Unless|Until|Once|Whenever|Should|In case|As needed)\b/i.test((s.textContent || '').trim()));
    if (subs.length) check('PDF no conditional clause mis-rendered as a subtitle (grammatical colon ≠ Label:Value)',
      condSubs.length === 0, condSubs.slice(0, 2).map(s => `"${s.textContent.trim()}"`).join(' | '));
  } catch (e) { bad('PDF anti-orphan', String(e.message).slice(0, 120)); }
}

console.log(`\n══ ${passes} passed · ${fails} failed · ${skips} n/a${advisories ? ` · ${advisories} advisory ⚠` : ''} ══`);
process.exit(fails ? 1 : 0);

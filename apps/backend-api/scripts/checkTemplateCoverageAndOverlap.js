#!/usr/bin/env node
/**
 * checkTemplateCoverageAndOverlap.js — THE canonical template-coverage audit.
 *
 * WHY TWO LEVELS (lesson from June 12, 2026): a collection can "have a template"
 * by pattern match and still render EMPTY because the matched template was built
 * for a different schema. iv_infusions matched "Infusion Therapy" (0/25 fields),
 * immediate_interventions matched its own entry built for an old shape (0/25),
 * immunization_record was caught by /^immunization.*record/i inside the
 * Immunization Status entry (renders none of its payload). Pattern match alone
 * is NOT coverage. This script checks BOTH:
 *   Level 1 — ROUTING: which TEMPLATE_PATTERNS entry wins (first-match-wins,
 *             replicating AIDocumentRenderer's findMatchingTemplate).
 *   Level 2 — FIELD OVERLAP: % of the collection's fields that appear in the
 *             matched component's JSX source.
 *
 * DATA-AWARE BY DEFAULT (June 13, 2026 — user directive "work only on real data"):
 *   We do NOT display empty fields (hide-empty is the template rule), so an empty
 *   schema field that the template omits is NOT a gap. The denominator is therefore
 *   the set of extractable schema fields that are ACTUALLY POPULATED in real
 *   MongoDB documents — never the full schema. A field that is empty everywhere is
 *   excluded from the % (it would be hidden anyway). This stops false "missing"
 *   flags (e.g. medications.durationDays=0/originalDosage='' across every record).
 *   "Populated" matches the templates' display rule: '' / [] / {} / null / undefined
 *   are empty; number 0 is empty (hide-zero convention, memory 69870205); boolean
 *   false IS data (shown as "No"); a non-empty array/object (incl. arrays of objects)
 *   is data. We also report any populated field missing from the PDF template.
 *
 * USAGE (two-step patient audit):
 *   1. node showPatientMedicalCollections.js --name First Last
 *   2. node checkTemplateCoverageAndOverlap.js col1 col2 col3 ...
 * FLAGS:
 *   --patientId <id>  scope the real-data check to ONE patient's documents
 *   --db <name>       database (default intellicare_practice_yale)
 *   --schema-only     OLD static behavior: % over ALL extractable schema fields,
 *                     no DB (use offline or to see raw schema-vs-JSX overlap)
 *   --all             every registered collection that has a unified schema
 *
 *   ❌ <40% = wrong/empty template, ⚠️ <70% = partial gap, ✅ ≥70% (of POPULATED fields).
 *
 * FOLLOW-UPS the audit can trigger:
 *   - NO MATCH            -> build a new template (full checklist build).
 *   - ❌ low overlap      -> inspect real docs (mongosh, db intellicare_practice_yale
 *                            — patient data is NEVER in intellicare_practice_global),
 *                            then build/rebuild the right template or fix routing.
 *   - Near-name twins both holding data (e.g. history_of_present_illness vs
 *     history_present_illness, laboratory_results vs lab_results) -> suspect a
 *     registry duplicate: compare docs, deregister the non-canonical one, migrate.
 *
 * PARSER NOTE: this file extracts regex literals from TEMPLATE_PATTERNS entry
 * segments. Do NOT write slash-delimited fragments (like medical_/clinical_) in
 * comments inside TEMPLATE_PATTERNS entries — they parse as regexes here and
 * produce false theft reports. Write prefixes comma-separated in prose.
 *
 * AGENT-BLIND CHECK (June 12, 2026; updated same day for the search-based
 * architecture — MCP memory 698d5d1702ee2910ed222842): the agent discovers
 * tools via Anthropic's server-side tool_search_tool_bm25 over ALL registry
 * tool definitions (functionRegistry USE_TOOL_SEARCH, defer_loading). A
 * collection is AGENT-BLIND only if it has NO get* entry in
 * functionCollectionMap (optimizedMedicalFunctions.js) — i.e. no tool exists
 * to be found. 🤖 AGENT-BLIND is a ❌-class failure (fix: add the collection to
 * the generator categories + functionCollectionMap so CRUD tools exist).
 */
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const REPO = path.resolve(__dirname, '..', '..', '..');
const RENDERER = path.join(REPO, 'apps/frontend-vite/src/components/artifact/AIDocumentRenderer.jsx');
const TEMPLATES_DIR = path.join(REPO, 'apps/frontend-vite/src/components/artifact');
const SCHEMAS = path.join(REPO, 'apps/backend-api/services/unified-medical-schemas.json');
const COLLECTIONS_SERVICE = path.join(REPO, 'apps/backend-api/services/medicalCollectionsService.js');

const src = fs.readFileSync(RENDERER, 'utf8');

// Lazy-import map: ComponentName -> { jsx, pdf } template file paths
const importMap = {};
const importRe = /const (\w+) = lazy\(\(\) => import\(['"]\.\/templates\/(\w+)['"]\)\);/g;
let im;
while ((im = importRe.exec(src))) {
  importMap[im[1]] = {
    jsx: path.join(TEMPLATES_DIR, 'templates', `${im[2]}.jsx`),
    pdf: path.join(TEMPLATES_DIR, 'pdf-templates', `${im[2]}PDFTemplate.jsx`),
  };
}

// TEMPLATE_PATTERNS entries: { name, patterns[], component }
// PARSED BY EVAL of the real array literal (June 16 2026 fix). The old name-based
// splitter mis-attributed NAMELESS entries' patterns + component to the PREVIOUS
// named entry — so any collection routed by a nameless dedicated entry was measured
// against the wrong component and falsely reported as a low-% "wrong template".
// Bracket-counting the array close is safe because regex char classes [..] are balanced.
const start = src.indexOf('const TEMPLATE_PATTERNS = [');
const arrOpen = src.indexOf('[', start);
let _depth = 0, _j = arrOpen, arrClose = -1;
for (; _j < src.length; _j++) { const ch = src[_j]; if (ch === '[') _depth++; else if (ch === ']') { _depth--; if (_depth === 0) { arrClose = _j; break; } } }
let arrText = src.slice(arrOpen, arrClose + 1).replace(/component:\s*([A-Za-z0-9_]+)/g, 'component: "$1"');
let rawEntries;
try { rawEntries = eval('(' + arrText + ')'); } // eslint-disable-line no-eval
catch (e) { console.error('TEMPLATE_PATTERNS parse failed:', e.message); process.exit(2); }
const entries = rawEntries.map(t => ({ name: t.name || t.component || '(unnamed)', patterns: t.patterns || [], component: t.component || null }));

const schemas = JSON.parse(fs.readFileSync(SCHEMAS, 'utf8'));

// AGENT-BLIND CHECK input: collection -> get* function (functionCollectionMap).
const OPTIMIZED = path.join(REPO, 'apps/backend-api/services/optimizedMedicalFunctions.js');
const fnByCollection = {};
{
  const opt = fs.readFileSync(OPTIMIZED, 'utf8');
  const mapRe = /(get\w+):\s*'([a-z0-9_]+)'/g;
  let mm;
  while ((mm = mapRe.exec(opt))) fnByCollection[mm[2]] = mm[1];
}
function agentBlind(collection) {
  const fn = fnByCollection[collection];
  if (!fn) return { blind: true, reason: 'no functionCollectionMap entry — no CRUD tool exists for the agent to find' };
  return { blind: false };
}

// Replicates AIDocumentRenderer findMatchingTemplate: exact-source pass, then first pattern.test wins
function matchEntry(collection) {
  const norm = collection.toLowerCase().trim();
  for (const t of entries) if (t.patterns.some(pt => norm === pt.source.toLowerCase())) return t;
  for (const t of entries) for (const pt of t.patterns) if (pt.test(norm)) return t;
  return null;
}

/**
 * Real-data emptiness: matches what the templates DISPLAY (hide-empty).
 * '' / [] / {} / null / undefined -> empty. Number 0 -> empty (hide-zero convention,
 * memory 69870205). Boolean false -> DATA (shown as "No"). Non-empty array/object
 * (including arrays of objects) -> data.
 */
function isPopulated(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'number') return Number.isFinite(v) && v !== 0; // 0 / NaN / Infinity = empty (hide-zero)
  if (typeof v === 'boolean') return true;                          // false IS data (shown as "No")
  if (typeof v === 'string') {
    const s = v.trim();
    if (s === '') return false;
    // epoch/1970 sentinel date string (e.g. new Date(true) coercion) — templates hide year < 1971
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { const d = new Date(s); if (!isNaN(d.getTime()) && d.getUTCFullYear() < 1971) return false; }
    return true;
  }
  if (v instanceof Date) return !isNaN(v.getTime()) && v.getUTCFullYear() >= 1971;
  if (Array.isArray(v)) return v.some(isPopulated);
  if (typeof v === 'object') {
    if (v instanceof ObjectId) return true;
    if (v.$date) { const d = new Date(v.$date); return !isNaN(d.getTime()) && d.getUTCFullYear() >= 1971; }
    return Object.values(v).some(isPopulated);
  }
  return Boolean(v);
}

// ---- args ----
const argv = process.argv.slice(2);
const SCHEMA_ONLY = argv.includes('--schema-only');
const ALL = argv.includes('--all');
function flagVal(name) { const i = argv.indexOf(name); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null; }
const PATIENT_ID = flagVal('--patientId');
const DB_NAME = flagVal('--db') || 'intellicare_practice_yale';
const SAMPLE_CAP = 5000;

let collections = argv.filter(a => !a.startsWith('--') && a !== PATIENT_ID && a !== flagVal('--db'));
if (ALL) {
  const svc = fs.readFileSync(COLLECTIONS_SERVICE, 'utf8');
  const colRe = /^\s*"([a-z0-9_]+)",?\s*$/gm;
  const set = new Set();
  let c;
  while ((c = colRe.exec(svc))) set.add(c[1]);
  collections = [...set];
}
if (collections.length === 0) {
  console.error('Usage: node checkTemplateCoverageAndOverlap.js <collection ...> [--patientId <id>] [--db <name>] [--schema-only] | --all');
  process.exit(2);
}

// Build the set of POPULATED extractable fields per collection from real documents.
async function computePopulatedFields(collectionList) {
  const populated = {}; // collection -> Set(fieldName)  (undefined = not data-checked)
  if (SCHEMA_ONLY) return populated;
  const mongoUriPath = path.join(__dirname, '..', '.kms', 'MONGODB_ADMIN_URI');
  let MONGO_URI;
  try { MONGO_URI = fs.readFileSync(mongoUriPath, 'utf8').trim(); }
  catch { console.error('⚠️  Cannot read .kms/MONGODB_ADMIN_URI — falling back to --schema-only.\n'); return null; }
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  try {
    const db = client.db(DB_NAME);
    const existing = new Set((await db.listCollections().toArray()).map(c => c.name));
    let filter = {};
    if (PATIENT_ID) {
      const oid = /^[0-9a-fA-F]{24}$/.test(PATIENT_ID) ? new ObjectId(PATIENT_ID) : PATIENT_ID;
      filter = { $or: [{ patientId: oid }, { patientId: PATIENT_ID }] };
    }
    for (const col of collectionList) {
      const schema = schemas[col];
      if (!schema) continue;
      const exFields = Object.keys(schema).filter(k => schema[k].extractable);
      const set = new Set();
      populated[col] = set;
      if (!existing.has(col)) continue; // no docs => no real data
      const docs = await db.collection(col).find(filter).limit(SAMPLE_CAP).toArray();
      for (const doc of docs) {
        for (const f of exFields) {
          if (!set.has(f) && isPopulated(doc[f])) set.add(f);
        }
        if (set.size === exFields.length) break; // all fields seen populated
      }
    }
  } finally {
    await client.close();
  }
  return populated;
}

(async () => {
  let populated = {};
  if (!SCHEMA_ONLY) {
    const p = await computePopulatedFields(collections);
    if (p === null) { /* DB unavailable */ } else { populated = p; }
  }
  const dataAware = !SCHEMA_ONLY && Object.keys(populated).length > 0;

  const jsxCache = {}, pdfCache = {};
  const results = [];
  for (const col of collections) {
    const entry = matchEntry(col);
    if (!entry) { results.push({ col, status: 'NO_MATCH' }); continue; }
    const schema = schemas[col];
    if (!schema) { results.push({ col, status: 'NO_SCHEMA', entry: entry.name }); continue; }
    const exFields = Object.keys(schema).filter(k => schema[k].extractable);
    if (exFields.length === 0) { results.push({ col, status: 'NO_EXTRACTABLE', entry: entry.name }); continue; }
    const files = importMap[entry.component];
    if (!files || !fs.existsSync(files.jsx)) { results.push({ col, status: 'NO_COMPONENT_FILE', entry: entry.name, component: entry.component }); continue; }
    if (!(files.jsx in jsxCache)) jsxCache[files.jsx] = fs.readFileSync(files.jsx, 'utf8');
    if (!(files.pdf in pdfCache)) pdfCache[files.pdf] = fs.existsSync(files.pdf) ? fs.readFileSync(files.pdf, 'utf8') : null;
    const jsx = jsxCache[files.jsx];
    const pdf = pdfCache[files.pdf];

    // DATA-AWARE denominator = populated extractable fields (fall back to all extractable in --schema-only)
    const popSet = dataAware ? (populated[col] || new Set()) : null;
    const denomFields = popSet ? exFields.filter(f => popSet.has(f)) : exFields;

    if (dataAware && denomFields.length === 0) {
      results.push({ col, status: 'NO_DATA', entry: entry.name, extractable: exFields.length });
      continue;
    }
    const present = denomFields.filter(f => jsx.includes(f));
    const missing = denomFields.filter(f => !jsx.includes(f));
    const pdfMissing = pdf ? denomFields.filter(f => !pdf.includes(f)) : null;
    results.push({
      col, status: 'OK', entry: entry.name,
      overlap: present.length / denomFields.length,
      present: present.length, total: denomFields.length,
      extractable: exFields.length, dataAware: !!popSet,
      missing, pdfMissing, hasPdf: !!pdf,
    });
  }

  results.sort((a, b) => (a.overlap ?? -1) - (b.overlap ?? -1));
  let bad = 0, warn = 0, blind = 0;
  for (const r of results) {
    const ab = agentBlind(r.col);
    const blindTag = ab.blind ? `   🤖 AGENT-BLIND (${ab.reason} — see MCP memory 698d5d1702ee2910ed222842)` : '';
    if (ab.blind) blind++;
    if (r.status === 'NO_MATCH') { bad++; console.log(`❌ ${r.col.padEnd(38)} NO TEMPLATE MATCH — build a template${blindTag}`); continue; }
    if (r.status === 'NO_DATA') { console.log(`➖ ${r.col.padEnd(38)} no real data (0 populated of ${r.extractable} extractable) → ${r.entry}${blindTag}`); continue; }
    if (r.status !== 'OK') { console.log(`?? ${r.col.padEnd(38)} ${r.status} → ${r.entry || ''} ${r.component || ''}${blindTag}`); continue; }
    const pct = Math.round(r.overlap * 100);
    const scope = r.dataAware ? `${r.present}/${r.total} data-fields; ${r.extractable} extractable` : `${r.present}/${r.total}`;
    const pdfNote = (r.hasPdf && r.pdfMissing && r.pdfMissing.length) ? `   PDF-missing: ${r.pdfMissing.slice(0, 8).join(', ')}${r.pdfMissing.length > 8 ? '…' : ''}` : '';
    if (pct < 40) { bad++; console.log(`❌ ${r.col.padEnd(38)} ${String(pct).padStart(3)}% (${scope}) → ${r.entry} — WRONG/EMPTY template; inspect real docs. Missing: ${r.missing.slice(0, 8).join(', ')}${r.missing.length > 8 ? '…' : ''}${blindTag}${pdfNote}`); }
    else if (pct < 70) { warn++; console.log(`⚠️  ${r.col.padEnd(38)} ${String(pct).padStart(3)}% (${scope}) → ${r.entry} — partial gap. Missing: ${r.missing.slice(0, 8).join(', ')}${r.missing.length > 8 ? '…' : ''}${blindTag}${pdfNote}`); }
    else {
      const miss = r.missing.length ? `   JSX-missing: ${r.missing.join(', ')}` : '';
      console.log(`${ab.blind ? '🤖' : '✅'} ${r.col.padEnd(38)} ${String(pct).padStart(3)}% (${scope}) → ${r.entry}${blindTag}${miss}${pdfNote}`);
    }
  }
  const mode = SCHEMA_ONLY ? 'schema-only' : (dataAware ? `data-aware (real docs${PATIENT_ID ? ', patient ' + PATIENT_ID : ''})` : 'schema-only (DB unavailable)');
  console.log(`\n${results.length} collections [${mode}]: ${results.filter(r => r.status === 'OK').length - bad - warn} ok, ${warn} partial (⚠️), ${bad} broken (❌), ${results.filter(r => r.status === 'NO_DATA').length} no-data (➖), ${blind} agent-blind (🤖)`);
  if (blind > 0) console.log(`🤖 fix agent-blind: add the collection to scripts/generate-medical-functions.js categories + functionCollectionMap in services/optimizedMedicalFunctions.js so its CRUD tools exist (the agent finds tools via tool_search_tool_bm25)`);
  process.exit(bad > 0 || blind > 0 ? 1 : 0);
})().catch(e => { console.error('Audit error:', e.message); process.exit(2); });

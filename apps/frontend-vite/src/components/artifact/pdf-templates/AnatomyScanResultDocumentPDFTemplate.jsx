/**
 * AnatomyScanResultDocumentPDFTemplate.jsx
 * June 2026 — Fetal anatomy ultrasound survey — Helvetica — A4
 * Collection: anatomy_scan_result
 *
 * Canonical PDF typography: document 26, record 19, section 16, field label 14,
 * and body/list text 13. Blue headings and restrained divider rules match the
 * selected artifact PDF family.
 *
 * Field handling mirrors the JSX:
 *   - Narrative strings → per-sentence/semicolon split with TRAILING-DELIMITER STRIP
 *   - Array (abnormalities) → per-item, delimiters stripped
 *   - date → formatted; short strings → simple field; hide-empty everywhere
 *
 * Content-only layout uses divider rules rather than bordered field containers. Page-break handling uses
 * the canonical codebase pattern:
 * each field is ONE View with a boolean wrap gate — small fields stay
 * together and move whole to the next page (no orphan, no overprint), long narratives flow and
 * break across pages. The section title rides INSIDE the first field's View (never a standalone
 * sibling). Only the small record header is unconditionally wrap={false}. Delimiters are stripped.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: 'Helvetica', fontSize: 13, lineHeight: 1.35, backgroundColor: '#ffffff', color: '#111827' },
  documentHeader: { marginBottom: 10 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#0f172a', paddingBottom: 9, borderBottom: '2pt solid #000000', marginBottom: 10 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#1e3a8a' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1d4ed8', paddingBottom: 5, borderBottom: '1pt solid #000000', marginBottom: 6 },
  fieldGroup: { marginBottom: 6 },
  fieldLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1e3a8a', paddingBottom: 3, borderBottom: '0.5pt solid #999999', marginBottom: 3 },
  subLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#334155', marginTop: 2, marginBottom: 2 },
  fieldValue: { fontSize: 13, color: '#111827' },
  listItem: { fontSize: 13, color: '#111827', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 13, color: '#111827', textAlign: 'center', marginTop: 40 },
});

/* ═══════ FIELD CONFIG (mirror JSX) ═══════ */
const SECTION_TITLES = {
  'scan-overview': 'Scan Overview',
  'fetal-anatomy': 'Fetal Anatomy',
  'placenta-fluid': 'Placenta & Amniotic Fluid',
  'findings-recs': 'Findings & Recommendations',
  'provider': 'Provider',
};

const FIELD_LABELS = {
  gestationalAge: 'Gestational Age',
  scanCompleteness: 'Scan Completeness',
  fetalNumber: 'Fetal Number',
  sex: 'Sex',
  brain: 'Brain',
  face: 'Face',
  spine: 'Spine',
  heart: 'Heart',
  chest: 'Chest',
  abdomen: 'Abdomen',
  kidneys: 'Kidneys',
  extremities: 'Extremities',
  placenta: 'Placenta',
  amnioticFluid: 'Amniotic Fluid',
  abnormalities: 'Abnormalities',
  recommendations: 'Recommendations',
  notes: 'Notes',
  sonographer: 'Sonographer',
  facility: 'Facility',
  date: 'Scan Date',
};

const SECTION_FIELDS = {
  'scan-overview': ['gestationalAge', 'scanCompleteness', 'fetalNumber', 'sex'],
  'fetal-anatomy': ['brain', 'face', 'spine', 'heart', 'chest', 'abdomen', 'kidneys', 'extremities'],
  'placenta-fluid': ['placenta', 'amnioticFluid'],
  'findings-recs': ['abnormalities', 'recommendations', 'notes'],
  'provider': ['sonographer', 'facility', 'date'],
};

const STRING_FIELDS = ['brain', 'face', 'spine', 'heart', 'chest', 'abdomen', 'kidneys', 'extremities', 'placenta', 'amnioticFluid', 'recommendations', 'notes'];
const ARRAY_FIELDS = ['abnormalities'];
const DATE_FIELDS = ['date'];
const COMMA_SPLIT_FIELDS = new Set([]);
const SEMICOLON_SPLIT_FIELDS = new Set(STRING_FIELDS);
const SEMICOLON_SEPARATOR = /;\s+/;

/* ═══════ SHARED HELPERS (delimiter-stripping — identical to JSX) ═══════ */
const stripDelims = (text) => {
  if (text === null || text === undefined) return '';
  return String(text).replace(/^[\s.;,]+/, '').replace(/[\s.;,]+$/, '').trim();
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    const atBoundary = ch === '.' && parenDepth === 0 &&
      (i + 1 >= text.length || /\s/.test(text[i + 1]));
    if (atBoundary) {
      if (ch === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/.test(current)) {
        current += ch;
        continue;
      }
      const t = stripDelims(current);
      if (t) result.push(t);
      current = '';
      while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
    } else {
      current += ch;
    }
  }
  const t = stripDelims(current);
  if (t) result.push(t);
  return result;
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: stripDelims(m[2]) };
  return { isLabeled: false, label: '', value: text };
};

/* splitOnChar / clausesOf / segmentSentence / buildUnits — IDENTICAL to the JSX (segmentation parity). */
const splitOnChar = (text, sep) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === sep && depth === 0) {
      if (sep === ',' && /\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || '')) { cur += ch; continue; }
      const t = stripDelims(cur); if (t) out.push(t); cur = '';
    } else { cur += ch; }
  }
  const t = stripDelims(cur); if (t) out.push(t);
  return out;
};
const clausesOf = (base, fieldName) => {
  const semi = SEMICOLON_SPLIT_FIELDS.has(fieldName) && SEMICOLON_SEPARATOR.test(base) ? splitOnChar(base, ';') : [base];
  if (semi.length >= 2) return { sep: '; ', items: semi };
  if (COMMA_SPLIT_FIELDS.has(fieldName)) { const c = splitOnChar(base, ','); if (c.length >= 2) return { sep: ', ', items: c }; }
  return { sep: null, items: [stripDelims(base)] };
};
const segmentSentence = (sentence, fieldName) => {
  const semi = SEMICOLON_SPLIT_FIELDS.has(fieldName) && SEMICOLON_SEPARATOR.test(sentence) ? splitOnChar(sentence, ';') : [sentence];
  if (semi.length >= 2) return { label: null, sep: '; ', items: semi.map(s => stripDelims(s)) };
  const p = parseLabel(sentence);
  const { sep, items } = clausesOf(p.isLabeled ? p.value : sentence, fieldName);
  return { label: p.isLabeled ? p.label : null, sep, items };
};
const buildUnits = (value, fieldName) => {
  const sentences = splitBySentence(String(value || ''));
  const units = [];
  sentences.forEach((sentence, sIdx) => {
    const { label, sep, items } = segmentSentence(sentence, fieldName);
    const rows = items.map((text, cIdx) => ({ text: stripDelims(text), sIdx, cIdx, sep }));
    const last = units[units.length - 1];
    if (!label && last && !last.label) last.rows.push(...rows);
    else units.push({ label, rows });
  });
  return units;
};

/* ═══════ PRESENCE + DISPLAY ═══════ */
const safeArray = (v) => (Array.isArray(v) ? v.filter(x => x !== null && x !== undefined && String(x).trim() !== '') : []);

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime()) || d.getFullYear() < 1971) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return ''; }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
};

const fieldHasVal = (fn, v) => {
  if (ARRAY_FIELDS.includes(fn)) return safeArray(v).length > 0;
  if (DATE_FIELDS.includes(fn)) return formatDate(v) !== '';
  return safeString(v).trim() !== '';
};

/* ═══════ BUILD A FIELD'S CONTENT ROWS — flat array of React row-elements ═══════
 * Returns the field's content as a flat array of <Text>/<View> rows that the renderer drops,
 * together with the field heading, into ONE View whose wrap is gated on rows.length (see
 * renderFieldGroup). The narrative branch emits a mix of numbered <Text> rows and labeled
 * bullet <View> sub-groups — all collected into one `rows` array; `rows.length` is the count
 * used for the wrap threshold.
 */
const buildFieldRows = (record, fn) => {
  const val = record[fn];
  const rows = [];

  /* Array field — abnormalities */
  if (ARRAY_FIELDS.includes(fn)) {
    safeArray(val).forEach((item, i) => {
      rows.push(<Text key={i} style={styles.listItem}>{i + 1}. {stripDelims(item)}</Text>);
    });
    return rows;
  }

  /* Date field */
  if (DATE_FIELDS.includes(fn)) {
    rows.push(<Text key="d" style={styles.fieldValue}>{formatDate(val)}</Text>);
    return rows;
  }

  /* Narrative string — buildUnits (mirror JSX): labeled unit → sub-label + numbered rows;
     consecutive unlabeled → one merged group of numbered rows. Per-unit numbering matches JSX Copy. */
  if (STRING_FIELDS.includes(fn)) {
    const units = buildUnits(safeString(val), fn);
    units.forEach((u, ui) => {
      if (u.label) rows.push(<Text key={`l${ui}`} style={styles.subLabel}>{u.label}</Text>);
      u.rows.forEach((r, ri) => rows.push(<Text key={`${ui}-${ri}`} style={styles.listItem}>{ri + 1}. {r.text}</Text>));
    });
    return rows;
  }

  /* Simple short string */
  rows.push(<Text key="v" style={styles.fieldValue}>{safeString(val)}</Text>);
  return rows;
};

/* ═══════ RENDER ONE FIELD GROUP — canonical per-field conditional wrap ═══════
 * Proven codebase pattern (378/832 PDF templates; memories 699004a9 / 6989860833 / 697da621;
 * sibling reference CervicalLengthMeasurementDocumentPDFTemplate.jsx): put the field's heading
 * (leading sectionTitle, only on the FIRST present field of a section) + fieldLabel + ALL rows
 * in ONE View and gate it with a boolean row-count expression.
 *   - ≤8 rows  → wrap={false}: the whole small block (title+label+rows) stays together and
 *     moves to the NEXT PAGE intact when it doesn't fit → no orphan; small enough to never
 *     overprint (e.g. SPINE's label + its 2 rows never split across pages).
 *   - >8 rows  → wrap=undefined: a long narrative (e.g. BRAIN, 9 rows) flows/breaks naturally.
 * DO NOT split a field into a wrap={false} "glue" sub-View + flowing siblings — THAT is what
 * overprints (a wrap={false} block beside flowing content gets compressed at the boundary).
 * Box-free: no border/background.
 */
const renderFieldGroup = (record, fn, leadingSectionTitle) => {
  const val = record[fn];
  if (!fieldHasVal(fn, val)) return null;
  const label = FIELD_LABELS[fn] || fn;
  const rows = buildFieldRows(record, fn);
  if (rows.length === 0) return null;

  return (
    <View key={fn} style={styles.fieldGroup} wrap={rows.length > 8}>
      {leadingSectionTitle ? <Text style={styles.sectionTitle}>{leadingSectionTitle}</Text> : null}
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows}
    </View>
  );
};

/* ═══════ RENDER SECTION — box-free, content-only, anti-orphan via leading title ═══════ */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => fieldHasVal(f, record[f]));
  if (presentFields.length === 0) return null;
  // Box-free, content-only: no bordered/background container; the section View itself never
  // wraps. The sectionTitle is NOT a standalone sibling (that orphans) — it is passed INTO the
  // FIRST present field's View, which carries the canonical conditional wrap
  // (see renderFieldGroup), so the title rides with
  // its field and small fields move to the next page intact (no orphan, no overprint).
  return (
    <View key={sid} style={styles.section}>
      {presentFields.map((f, i) => renderFieldGroup(record, f, i === 0 ? title : null))}
    </View>
  );
};

/* ═══════ MAIN COMPONENT ═══════ */
const unwrap = (source) => {
  if (!source) return [];
  let records = Array.isArray(source) ? source : [source];
  records = records.flatMap(record => {
    if (record?.anatomy_scan_result) return Array.isArray(record.anatomy_scan_result) ? record.anatomy_scan_result : [record.anatomy_scan_result];
    if (record?.documentData) {
      const nested = record.documentData;
      if (Array.isArray(nested)) return nested.flatMap(item => item?.anatomy_scan_result ? (Array.isArray(item.anatomy_scan_result) ? item.anatomy_scan_result : [item.anatomy_scan_result]) : [item]);
      if (nested?.anatomy_scan_result) return Array.isArray(nested.anatomy_scan_result) ? nested.anatomy_scan_result : [nested.anatomy_scan_result];
      return [nested];
    }
    return [record];
  });
  return records.filter(record => record && typeof record === 'object');
};

const AnatomyScanResultDocumentPDFTemplate = ({ document: docProp }) => {
  const records = unwrap(docProp);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Anatomy Scan Result</Text>
          </View>
          <Text style={styles.noDataText}>No anatomy scan result data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Anatomy Scan Result</Text>
        </View>
        {records.map((record, idx) => (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Anatomy Scan Result ${idx + 1}`}</Text>
              </View>
              {renderSection(record, 'scan-overview')}
              {renderSection(record, 'fetal-anatomy')}
              {renderSection(record, 'placenta-fluid')}
              {renderSection(record, 'findings-recs')}
              {renderSection(record, 'provider')}
            </View>
        ))}
      </Page>
    </Document>
  );
};

export default AnatomyScanResultDocumentPDFTemplate;

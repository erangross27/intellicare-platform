/**
 * AmnioticFluidAssessmentDocumentPDFTemplate.jsx
 * Box-free B&W — Helvetica — LETTER — amniotic fluid assessment
 * Mirrors the JSX: buildUnits (semicolon-first for ALL text; comma >=3 only for LABELED values,
 * paren-aware + number-guard) → clause rows. Anti-orphan via Rule #74 conditional wrap (section
 * title inside the first field View); Rule #75 break per record. Box-free: only #000000 / #ffffff.
 * Collection: amniotic_fluid_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 20 },
  recordContainer: { marginBottom: 20 },
  recordDate: { fontSize: 12, color: '#000000', marginBottom: 4 },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12 },
  fieldBox: { marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 3 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  fieldValue: { fontSize: 12, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 12, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 10 },
  nestedSubtitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  nested: { marginLeft: 10, marginTop: 2 },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS (mirror the JSX exactly) ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const STRIP = (s) => String(s == null ? '' : s).replace(/[;.\s]+$/, '').trim();

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,80}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/)
    .map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

// Paren-aware split on a separator char; comma skips a comma between two digits (46,XX / thousands / ranges).
const splitOnChar = (text, sep) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === sep && depth === 0) {
      if (sep === ',' && /\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || '')) { cur += ch; continue; }
      const t = cur.trim(); if (t) out.push(t); cur = '';
    } else { cur += ch; }
  }
  const t = cur.trim(); if (t) out.push(t);
  return out;
};

// Semicolon = explicit list separator (always safe). Comma split ONLY for LABELED values (genuine
// lists, >=3) — NEVER comma-split unlabeled narrative ("Robert Yamashiro, MD, FACOG" stays whole).
const clausesOf = (base, isLabeled) => {
  const semi = splitOnChar(base, ';');
  if (semi.length >= 2) return { sep: '; ', items: semi };
  if (isLabeled) { const c = splitOnChar(base, ','); if (c.length >= 3) return { sep: ', ', items: c }; }
  return { sep: null, items: [String(base || '').trim()] };
};

// Sentences -> units; a labeled value = its own unit (sub-label); consecutive unlabeled merge.
const buildUnits = (value) => {
  const sentences = splitBySentence(String(value || ''));
  const units = [];
  sentences.forEach((sentence) => {
    const p = parseLabel(sentence);
    const base = p.isLabeled ? p.value : sentence;
    const { items } = clausesOf(base, p.isLabeled);
    const rows = items.map((t) => STRIP(t));
    const last = units[units.length - 1];
    if (!p.isLabeled && last && !last.label) last.rows.push(...rows);
    else units.push({ label: p.isLabeled ? p.label : null, rows });
  });
  return units;
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

/* recursive object node: label = bold heading; value = plain line below (box-free) */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* count rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* ======= SECTION CONFIG ======= */
const SECTION_TITLES = {
  'header-info': 'Header Information',
  'monitoring-config': 'Monitoring Configuration',
  'clinical-findings': 'Clinical Findings',
  'plan-notes': 'Plan & Notes',
  'thresholds-data': 'Thresholds',
  'results-data': 'Results',
  'recommendations-data': 'Recommendations',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  frequency: 'Frequency',
  startingWeek: 'Starting Week',
  method: 'Method',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  notes: 'Notes',
  thresholds: 'Thresholds',
  results: 'Results',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  'header-info': ['date', 'provider', 'facility', 'status'],
  'monitoring-config': ['frequency', 'startingWeek', 'method'],
  'clinical-findings': ['findings', 'assessment'],
  'plan-notes': ['plan', 'notes'],
  'thresholds-data': ['thresholds'],
  'results-data': ['results'],
  'recommendations-data': ['recommendations'],
};

const SECTION_ORDER = ['header-info', 'monitoring-config', 'clinical-findings', 'plan-notes', 'thresholds-data', 'results-data', 'recommendations-data'];
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['startingWeek'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

/* ======= RENDER FIELD — Rule #74 per-field wrap-gating.
   Returns an ARRAY of Views; EACH View is one wrap unit. sectionTitle goes INSIDE the first
   View (isFirst) — never a sibling. @react-pdf v4: wrap={rows>8} boolean (undefined ≡ false). ======= */
const renderField = (record, fn, sectionTitle, isFirst) => {
  const val = record[fn];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (DATE_FIELDS.includes(fn)) {
    return [(
      <View key={fn} style={styles.fieldBox} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{formatDate(val)}</Text>
      </View>
    )];
  }

  if (NUMBER_FIELDS.includes(fn)) {
    return [(
      <View key={fn} style={styles.fieldBox} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{safeString(val)}</Text>
      </View>
    )];
  }

  if (OBJECT_ARRAY_FIELDS.includes(fn)) {
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return [];
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    return [(
      <View key={fn} style={styles.fieldBox} wrap={recs.length > 8}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            {group.date ? <Text style={styles.subLabel}>{group.date}</Text> : null}
            {group.items.map((r, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {(r?.recommendation || '').trim()}</Text>))}
          </View>
        ))}
      </View>
    )];
  }

  if (OBJECT_FIELDS.includes(fn)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => {
      const rows = countRows(v);
      return (
        <View key={`${fn}-${k}`} style={styles.fieldBox} wrap={rows > 8}>
          {i === 0 ? titleNode : null}
          {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {renderObjectNode(humanizeKey(k), v, `${fn}-${k}`, 1)}
        </View>
      );
    });
  }

  if (fn === 'thresholds') {
    if (typeof val === 'object' && !Array.isArray(val)) {
      const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
      if (entries.length === 0) return [];
      return [(
        <View key={fn} style={styles.fieldBox} wrap={entries.length > 8}>
          {titleNode}
          {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
          {entries.map(([k, v], i) => (
            <View key={i} style={{ marginBottom: 4 }}>
              <Text style={styles.nestedSubtitle}>{humanizeKey(k)}</Text>
              <Text style={styles.fieldValue}>{safeString(v)}</Text>
            </View>
          ))}
        </View>
      )];
    }
    return [(
      <View key={fn} style={styles.fieldBox} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{safeString(val)}</Text>
      </View>
    )];
  }

  /* String fields — clause units (mirror JSX buildUnits): semicolon list / labeled comma list. */
  const units = buildUnits(safeString(val));
  if (units.length === 0) return [];
  const totalRows = units.reduce((a, u) => a + u.rows.length, 0);
  return [(
    <View key={fn} style={styles.fieldBox} wrap={totalRows > 8}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {units.map((u, uIdx) => (
        <View key={uIdx}>
          {u.label && <Text style={styles.subLabel}>{u.label}</Text>}
          {u.rows.map((r, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {r}</Text>))}
        </View>
      ))}
    </View>
  )];
};

/* ======= RENDER SECTION — flatten per-field Views; title inside first present field ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => hasVal(record[f]));
  if (presentFields.length === 0) return null;
  const views = [];
  presentFields.forEach((f, i) => { views.push(...renderField(record, f, title, i === 0)); });
  return <React.Fragment key={sid}>{views}</React.Fragment>;
};

/* ======= MAIN COMPONENT ======= */
const AmnioticFluidAssessmentDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].amniotic_fluid_assessment && Array.isArray(docProp[0].amniotic_fluid_assessment)) {
      records = docProp[0].amniotic_fluid_assessment;
    } else {
      records = docProp;
    }
  } else if (docProp && docProp.amniotic_fluid_assessment) {
    records = Array.isArray(docProp.amniotic_fluid_assessment) ? docProp.amniotic_fluid_assessment : [docProp.amniotic_fluid_assessment];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Amniotic Fluid Assessment</Text>
          <Text style={styles.noDataText}>No amniotic fluid assessment data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Amniotic Fluid Assessment</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View wrap={false}>
              {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
              <Text style={styles.recordTitle}>Amniotic Fluid Assessment {idx + 1}</Text>
            </View>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AmnioticFluidAssessmentDocumentPDFTemplate;

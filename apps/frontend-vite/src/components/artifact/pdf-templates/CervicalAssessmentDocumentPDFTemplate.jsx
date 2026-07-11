/**
 * CervicalAssessmentDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable —
 * the old "totalRows > 8 ? undefined : false" idiom made big sections unbreakable and caused
 * the text-overprint bug); fields inside a section carry NO wrap of their own (glue-inside-flow
 * overprints); recordContainer uses paddingBottom only (marginBottom shoves the whole record).
 * Collection: cervical_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, marginBottom: 3, paddingLeft: 8 },
  nested: { marginLeft: 12 },
  noDataText: { fontSize: 14, color: '#666666', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
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

/* ======= SECTION CONFIG ======= */
const SECTION_TITLES = {
  'header-info': 'Header Information',
  'cervical-exam': 'Cervical Examination',
  'clinical-assessment': 'Clinical Assessment',
  'results-info': 'Results',
  'recommendations-info': 'Recommendations',
  'cerclage-info': 'Cervical Cerclage',
};

const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status',
  cervicalLength: 'Cervical Length', cervicalDilation: 'Cervical Dilation', cervicalEffacement: 'Cervical Effacement',
  cervicalConsistency: 'Cervical Consistency', cervicalPosition: 'Cervical Position', bishopScore: 'Bishop Score',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes',
  results: 'Results', recommendations: 'Recommendations', cervicalCerclage: 'Cervical Cerclage',
};

const SECTION_FIELDS = {
  'header-info': ['date', 'provider', 'facility', 'status'],
  'cervical-exam': ['cervicalLength', 'cervicalDilation', 'cervicalEffacement', 'cervicalConsistency', 'cervicalPosition', 'bishopScore'],
  'clinical-assessment': ['findings', 'assessment', 'plan', 'notes'],
  'results-info': ['results'],
  'recommendations-info': ['recommendations'],
  'cerclage-info': ['cervicalCerclage'],
};

const DATE_FIELDS = ['date'];
const OBJECT_FIELDS = ['cervicalCerclage', 'results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];

/* ======= OBJECT/RECURSION HELPERS ======= */
const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
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

/* recursive object node: humanized label with underline, "1." numbered value beneath */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) {
    /* leaf = label + value glued as one small unit so the label can't orphan at a page bottom */
    return (
      <View key={keyPath} style={{ marginBottom: 6 }} wrap={false}>
        {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        <Text style={styles.listItem}>1. {fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath} style={{ marginBottom: 6 }} wrap={countRows(value) > 8 ? true : false}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* count rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 2;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* ======= SPLITTERS (mirror the JSX) ======= */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      if (!/\s/.test(text[i + 1] || '')) { current += ch; continue; }
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
const PARTS_FIELDS = {
  provider: (s) => String(s).split(/;\s*/).map(t => t.trim()).filter(Boolean),
  facility: (s) => splitByComma(String(s)),
};

/* ======= RENDER FIELD (no wrap props here — the section-level boolean gate decides) ======= */
const renderField = (record, fn, sectionTitle) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = label.toLowerCase() !== (sectionTitle || '').toLowerCase();

  if (DATE_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={{ marginBottom: 6 }}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.listItem}>1. {formatDate(val)}</Text>
      </View>
    );
  }

  /* recommendations: date-grouped; numbering restarts per dated group, undated runs continue */
  if (OBJECT_ARRAY_FIELDS.includes(fn)) {
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return null;
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    let num = 0;
    return (
      <View key={fn} style={{ marginBottom: 6 }}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {groups.map((group, gIdx) => {
          if (group.date) num = 0;
          const start = num;
          num += group.items.length;
          return (
            <View key={gIdx} style={{ marginBottom: 4 }} wrap={group.items.length > 8 ? true : false}>
              {group.date ? <Text style={styles.fieldLabel}>{group.date}</Text> : null}
              {group.items.map((r, i) => (<Text key={i} style={styles.listItem}>{`${start + i + 1}. ${(r?.recommendation || '').trim()}`}</Text>))}
            </View>
          );
        })}
      </View>
    );
  }

  /* objects (results recursive; cerclage flat): humanized sub-labels + numbered values */
  if (OBJECT_FIELDS.includes(fn)) {
    if (typeof val === 'object' && !Array.isArray(val)) {
      const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
      if (entries.length === 0) return null;
      return (
        <View key={fn} style={{ marginBottom: 6 }}>
          {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
          {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${fn}-${k}`, 1))}
        </View>
      );
    }
    return (
      <View key={fn} style={{ marginBottom: 6 }}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.listItem}>1. {safeString(val)}</Text>
      </View>
    );
  }

  const strVal = safeString(val);

  /* provider/facility: numbered parts (semicolon / guarded comma) */
  const partsSplit = PARTS_FIELDS[fn];
  if (partsSplit) {
    const parts = partsSplit(strVal);
    if (parts.length > 1) {
      return (
        <View key={fn} style={{ marginBottom: 6 }}>
          {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
          {parts.map((p, i) => <Text key={i} style={styles.listItem}>{i + 1}. {p}</Text>)}
        </View>
      );
    }
  }

  /* strings: sentences; labeled sentences become sub-label groups with comma items
     (numbering restarts at labeled groups, unlabeled rows continue the count) */
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    let num = 0;
    return (
      <View key={fn} style={{ marginBottom: 6 }}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {sentences.map((s, i) => {
          const parsed = parseLabel(s);
          if (parsed.isLabeled) {
            const items = splitByComma(parsed.value);
            num = 0;
            const start = num;
            num += items.length;
            return (
              <View key={i} style={{ marginBottom: 4 }} wrap={items.length > 8 ? true : false}>
                <Text style={styles.fieldLabel}>{parsed.label}</Text>
                {items.map((it, j) => <Text key={j} style={styles.listItem}>{start + j + 1}. {it.replace(/[.;]+$/, '').trim()}</Text>)}
              </View>
            );
          }
          num += 1;
          return <Text key={i} style={styles.listItem}>{num}. {s.replace(/[.;]+$/, '').trim()}</Text>;
        })}
      </View>
    );
  }

  return (
    <View key={fn} style={{ marginBottom: 6 }}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.listItem}>1. {strVal}</Text>
    </View>
  );
};

/* row estimate for ONE field — drives the per-field wrap gate */
const fieldRowsOf = (record, fn) => {
  const v = record[fn];
  if (!hasVal(v)) return 0;
  if (DATE_FIELDS.includes(fn)) return 2;
  if (OBJECT_ARRAY_FIELDS.includes(fn)) { const recs = Array.isArray(v) ? v : []; const dates = new Set(recs.map(r => (r?.date || '').trim()).filter(Boolean)).size; return recs.length + dates + 1; }
  if (fn === 'results' && typeof v === 'object' && !Array.isArray(v)) return countRows(v) + 1;
  if (OBJECT_FIELDS.includes(fn) && typeof v === 'object' && !Array.isArray(v)) return Object.values(v).filter(hasVal).length * 2 + 1;
  const s = safeString(v);
  const partsSplit = PARTS_FIELDS[fn];
  if (partsSplit) { const p = partsSplit(s); if (p.length > 1) return p.length + 1; }
  const sentences = splitBySentence(s);
  if (sentences.length > 1) {
    let rows = 1;
    sentences.forEach(x => { const pl = parseLabel(x); rows += pl.isLabeled ? splitByComma(pl.value).length + 1 : 1; });
    return rows;
  }
  return 2;
};

/* ======= RENDER SECTION — Rule #74: each FIELD is one View with a boolean wrap gate;
   the section title rides INSIDE the FIRST field's View so it can never orphan at a
   page bottom (small first unit glues title+content; big fields flow on their own) ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => hasVal(record[f]));
  if (presentFields.length === 0) return null;
  return (
    <View key={sid} style={styles.section}>
      {presentFields.map((f, i) => {
        const rows = fieldRowsOf(record, f) + (i === 0 ? 1 : 0);
        return (
          <View key={f} wrap={rows > 8 ? true : false}>
            {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
            {renderField(record, f, title)}
          </View>
        );
      })}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const CervicalAssessmentDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].cervical_assessment && Array.isArray(docProp[0].cervical_assessment)) {
      records = docProp[0].cervical_assessment;
    } else {
      records = docProp;
    }
  } else if (docProp && docProp.cervical_assessment) {
    records = Array.isArray(docProp.cervical_assessment) ? docProp.cervical_assessment : [docProp.cervical_assessment];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Cervical Assessment</Text>
          </View>
          <Text style={styles.noDataText}>No cervical assessment data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Cervical Assessment</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              {/* date + provider render in Header Information — no duplicates here */}
              <Text style={styles.recordTitle}>{`Cervical Assessment ${idx + 1}`}</Text>
            </View>
            {renderSection(record, 'header-info')}
            {renderSection(record, 'cervical-exam')}
            {renderSection(record, 'clinical-assessment')}
            {renderSection(record, 'results-info')}
            {renderSection(record, 'recommendations-info')}
            {renderSection(record, 'cerclage-info')}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CervicalAssessmentDocumentPDFTemplate;

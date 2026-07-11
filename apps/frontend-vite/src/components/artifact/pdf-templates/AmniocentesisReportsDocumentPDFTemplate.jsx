/**
 * AmniocentesisReportsDocumentPDFTemplate.jsx
 * Box-free B&W — Helvetica — LETTER — amniocentesis reports
 * Mirrors the JSX: splitClauses (semicolon-first, else comma >=3, paren+number-aware) + triple-nested
 * sub-labels. Anti-orphan glue (title/sub-label glued to first row); wrap={rows>8}; break per record.
 * Collection: amniocentesis_reports
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 20 },
  recordContainer: { marginBottom: 20 },
  recordDate: { fontSize: 12, color: '#000000', marginBottom: 4 },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 3 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  fieldValue: { fontSize: 12, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 12, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 10 },
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
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

// Paren-aware split on a separator char; comma skips digit,digit (thousands / 46,XX / ranges).
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

// Semicolon first (>=2), else comma (>=3), else single clause.
const splitClauses = (text) => {
  if (!text || typeof text !== 'string') return { sep: null, items: [text || ''] };
  const semi = splitOnChar(text, ';');
  if (semi.length >= 2) return { sep: '; ', items: semi };
  const comma = splitOnChar(text, ',');
  if (comma.length >= 3) return { sep: ', ', items: comma };
  return { sep: null, items: [text.trim()] };
};

// Sentences -> units; labeled value = its own unit (sub-label); consecutive unlabeled merge.
const buildUnits = (value) => {
  const sentences = splitBySentence(String(value || ''));
  const units = [];
  sentences.forEach((sentence) => {
    const p = parseLabel(sentence);
    const base = p.isLabeled ? p.value : sentence;
    const { items } = splitClauses(base);
    const rows = items.map((t) => STRIP(t));
    const last = units[units.length - 1];
    if (!p.isLabeled && last && !last.label) last.rows.push(...rows);
    else units.push({ label: p.isLabeled ? p.label : null, rows });
  });
  return units;
};

/* ======= SECTION CONFIG ======= */
const SECTION_TITLES = {
  'assessment-info': 'Assessment Information',
  'findings': 'Findings',
  'goals-progress': 'Goals & Progress',
  'recommendations': 'Recommendations',
};

const FIELD_LABELS = {
  assessmentDate: 'Assessment Date',
  programType: 'Program Type',
  findings: 'Findings',
  goals: 'Goals',
  progress: 'Progress',
  recommendations: 'Recommendations',
  followUp: 'Follow-Up',
};

const SECTION_FIELDS = {
  'assessment-info': ['assessmentDate', 'programType'],
  'findings': ['findings'],
  'goals-progress': ['goals', 'progress'],
  'recommendations': ['recommendations', 'followUp'],
};

const DATE_FIELDS = ['assessmentDate'];

/* ======= RENDER FIELD ======= */
// isFirstField → the section title rides INSIDE this field's first glue View (anti-orphan, never a
// standalone sibling). Sub-labels + each clause-list's first row are glued; remaining rows flow.
const renderField = (record, fn, sectionTitle, isFirstField) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = label.toLowerCase() !== (sectionTitle || '').toLowerCase();

  if (DATE_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={styles.fieldBox} wrap={false}>
        {isFirstField && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{formatDate(val)}</Text>
      </View>
    );
  }

  const units = buildUnits(safeString(val));
  const totalRows = units.reduce((a, u) => a + u.rows.length, 0);
  return (
    <View key={fn} style={styles.fieldBox} wrap={totalRows > 8}>
      {units.map((u, uIdx) => {
        const first = u.rows[0];
        const rest = u.rows.slice(1);
        return (
          <React.Fragment key={uIdx}>
            <View wrap={false}>
              {isFirstField && uIdx === 0 && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
              {showLabel && uIdx === 0 && <Text style={styles.fieldLabel}>{label}</Text>}
              {u.label && <Text style={styles.subLabel}>{u.label}</Text>}
              {first !== undefined && <Text style={styles.listItem}>1. {first}</Text>}
            </View>
            {rest.map((r, ri) => (
              <Text key={ri} style={styles.listItem}>{ri + 2}. {r}</Text>
            ))}
          </React.Fragment>
        );
      })}
    </View>
  );
};

/* ======= RENDER SECTION ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = (SECTION_FIELDS[sid] || []).filter(f => hasVal(record[f]));
  if (fields.length === 0) return null;
  return (
    <View key={sid} style={styles.section}>
      {fields.map((f, i) => renderField(record, f, title, i === 0))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const AmniocentesisReportsDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].amniocentesis_reports && Array.isArray(docProp[0].amniocentesis_reports)) {
      records = docProp[0].amniocentesis_reports;
    } else {
      records = docProp;
    }
  } else if (docProp && docProp.amniocentesis_reports) {
    records = Array.isArray(docProp.amniocentesis_reports) ? docProp.amniocentesis_reports : [docProp.amniocentesis_reports];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Amniocentesis Reports</Text>
          <Text style={styles.noDataText}>No amniocentesis reports data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Amniocentesis Reports</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View wrap={false}>
              {hasVal(record.assessmentDate) && (
                <Text style={styles.recordDate}>{formatDate(record.assessmentDate)}</Text>
              )}
              <Text style={styles.recordTitle}>Amniocentesis Report {idx + 1}</Text>
            </View>
            {renderSection(record, 'assessment-info')}
            {renderSection(record, 'findings')}
            {renderSection(record, 'goals-progress')}
            {renderSection(record, 'recommendations')}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AmniocentesisReportsDocumentPDFTemplate;

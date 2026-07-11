/**
 * PreChemotherapyWorkupDocumentPDFTemplate.jsx
 * Helvetica — LETTER size — US medical platform
 * Collection: pre_chemotherapy_workup
 * Box-free B&W underline theme (mirrors the JSX Copy All structure for parity).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000', lineHeight: 1.5 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 24 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  emptyState: { fontSize: 14, color: '#333333', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (d) => {
  if (!d) return '';
  try {
    const date = new Date(d.$date || d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(d); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) s = formatDate(val.$date);
  else s = String(val);
  return s.replace(/×/g, 'x');
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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

/* splitBySentence — split on '.'/';' + whitespace, guarding abbreviations, single-letter
   initials (Dr. R. Vashisht), and digits (5.8, "124; "); strip a leading "N. " marker. */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/)
    .map(s => s.replace(/^\d+\.\s+/, '').trim())
    .filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma — parenthesis-aware; skip no-space commas (3,951) and year-leading commas. */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '') && !/^\s*\d{4}\b/.test(text.slice(i + 1))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ======= FIELD RENDERERS (return bare <View fieldBox>) ======= */
const renderFieldRow = (label, value, key) => {
  if (!hasVal(value)) return null;
  return (
    <View key={key} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField — mirrors the JSX renderSentenceField + formatSentenceFieldLines:
   single unlabeled value -> plain row; multi-sentence or single labeled comma-list ->
   sub-labels + numbered rows (single running counter per field). */
const renderSentenceField = (label, text, key) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') return renderFieldRow(label, text, key);
  const strVal = fmtVal(text);
  const sentences = splitBySentence(strVal);
  if (sentences.length === 0) return null;
  const parsedWhole = parseLabel(strVal);
  const singleLabeledList = sentences.length === 1 && parsedWhole.isLabeled && splitByComma(parsedWhole.value).length >= 2;
  if (!(sentences.length > 1 || singleLabeledList)) {
    return renderFieldRow(label, strVal, key);
  }
  const rows = []; let n = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      rows.push({ t: 'sub', v: safeString(parsed.label), k: `sub${si}` });
      if (parts.length >= 2) {
        parts.forEach((p, pi) => rows.push({ t: 'item', v: safeString(p), num: n++, k: `p${si}-${pi}` }));
      } else {
        rows.push({ t: 'item', v: safeString(parsed.value), num: n++, k: `p${si}v` });
      }
    } else {
      rows.push({ t: 'item', v: safeString(s), num: n++, k: `s${si}` });
    }
  });
  return (
    <View key={key} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map(r => r.t === 'sub'
        ? <Text key={r.k} style={styles.nestedSubtitle}>{r.v}</Text>
        : <Text key={r.k} style={styles.listItem}>{r.num}. {r.v}</Text>)}
    </View>
  );
};

const renderArrayField = (label, items, key) => {
  if (!Array.isArray(items)) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;
  return (
    <View key={key} style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* ======= OBJECT (dynamic-key) RENDERERS ======= */
const KEY_OVERRIDES = { cbc: 'CBC', cmp: 'CMP', anc: 'ANC', hgb: 'Hgb', wbc: 'WBC', egfr: 'eGFR', crcl: 'CrCl', lvef: 'LVEF', ecog: 'ECOG', fev1: 'FEV1', dlco: 'DLCO', hiv: 'HIV', ldh: 'LDH', bun: 'BUN', ast: 'AST', alt: 'ALT', inr: 'INR' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const base = String(key);
  if (KEY_OVERRIDES[base]) return KEY_OVERRIDES[base];
  if (KEY_OVERRIDES[base.toLowerCase()]) return KEY_OVERRIDES[base.toLowerCase()];
  const s = base.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return safeString(v); };

/* Recursive OBJECT node renderer (box-free; nested indentation via paddingLeft) */
const renderObjectNode = (label, value, depth, keyPrefix) => {
  if (!hasVal(value)) return null;
  if (isScalar(value)) {
    return (
      <View key={keyPrefix} style={[styles.fieldBox, depth > 0 ? { paddingLeft: depth * 8, marginBottom: 4 } : { marginBottom: 4 }]}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => hasVal(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPrefix} style={depth > 0 ? { paddingLeft: depth * 8 } : undefined}>
      {label ? <Text style={styles.nestedSubtitle}>{label}</Text> : null}
      {entries.map(([k, v], i) => renderObjectNode(humanizeKey(k), v, depth + 1, `${keyPrefix}-${k}-${i}`))}
    </View>
  );
};

/* Anti-orphan: glue the section title to its first present field in a wrap=false View. */
const renderSection = (title, elements) => {
  const present = (elements || []).filter(Boolean);
  if (!present.length) return null;
  const [first, ...rest] = present;
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {first}
      </View>
      {rest.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
    </View>
  );
};

/* Render a top-level OBJECT field as its own section */
const renderObjectField = (title, value) => {
  if (!hasVal(value) || isScalar(value)) return null;
  const entries = Object.entries(value).filter(([, v]) => hasVal(v));
  if (entries.length === 0) return null;
  const nodes = entries.map(([k, v], i) => renderObjectNode(humanizeKey(k), v, 0, `${title}-${k}-${i}`));
  return renderSection(title, nodes);
};

/* ======= COMPONENT ======= */
const PreChemotherapyWorkupDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.pre_chemotherapy_workup && Array.isArray(data.pre_chemotherapy_workup)) {
    records = data.pre_chemotherapy_workup;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) records = docData;
    else if (docData?.pre_chemotherapy_workup) records = docData.pre_chemotherapy_workup;
    else if (docData && typeof docData === 'object') records = [docData];
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Pre-Chemotherapy Workup</Text>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Pre-Chemotherapy Workup</Text>
        {records.map((record, idx) => {
          const inf = record.infectiousScreening || {};
          const car = record.cardiacAssessment || {};
          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <Text style={styles.recordTitle}>{`Pre-Chemotherapy Workup ${idx + 1}`}</Text>

              {renderSection('Visit Information', [
                hasVal(record.date) ? renderFieldRow('Date', formatDate(record.date), 'date') : null,
                renderSentenceField('Provider', record.provider, 'provider'),
                renderSentenceField('Facility', record.facility, 'facility'),
                renderSentenceField('Status', record.status, 'status'),
              ])}

              {renderSection('Infectious Screening', [
                renderSentenceField('Hepatitis B', inf.hepatitisB, 'hepB'),
                renderSentenceField('Hepatitis C', inf.hepatitisC, 'hepC'),
                renderSentenceField('HIV', inf.hiv, 'hiv'),
              ])}

              {renderSection('Cardiac Assessment', [
                renderSentenceField('EKG', car.ekg, 'ekg'),
                renderSentenceField('Echo', car.echo, 'echo'),
                renderSentenceField('Indication', car.indication, 'indication'),
              ])}

              {renderSection('Consultations', [
                renderSentenceField('Fertility Consultation', record.fertilityConsultation, 'fertility'),
                renderSentenceField('Dental Clearance', record.dentalClearance, 'dental'),
              ])}

              {renderSection('Eligibility', [
                renderSentenceField('Findings', record.findings, 'findings'),
                renderSentenceField('Assessment', record.assessment, 'assessment'),
              ])}

              {renderSection('Treatment Plan', [
                renderSentenceField('Plan', record.plan, 'plan'),
                renderSentenceField('Notes', record.notes, 'notes'),
              ])}

              {renderObjectField('Results', record.results)}

              {renderSection('Recommendations', [
                renderArrayField('Recommendations', record.recommendations, 'recs'),
              ])}

              {idx < records.length - 1 && <View style={styles.separator} />}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PreChemotherapyWorkupDocumentPDFTemplate;

/**
 * PsychiatricProgressNotesDocumentPDFTemplate.jsx
 * Box-free canonical PDF — Helvetica — LETTER — psychiatric progress notes
 * Collection: psychiatric_progress_notes
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 8, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
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
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) s = formatDate(val.$date);
  else s = String(val);
  return s
    .replace(/×/g, 'x')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
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

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ======= CONFIG ======= */
const SECTION_TITLES = {
  'visit-info': 'Visit Information',
  'referral': 'Referral & Chief Complaint',
  'examination': 'Examination Findings',
  'diagnosis-plan': 'Diagnosis & Treatment Plan',
  'follow-up': 'Follow-Up & Recommendations',
};
const SECTION_ORDER = ['visit-info', 'referral', 'examination', 'diagnosis-plan', 'follow-up'];
const SECTION_FIELDS = {
  'visit-info': ['consultDate'],
  'referral': ['referralReason', 'chiefComplaint'],
  'examination': ['examFindings'],
  'diagnosis-plan': ['diagnosis', 'treatmentPlan'],
  'follow-up': ['followUpPlan', 'recommendations'],
};
const FIELD_LABELS = {
  consultDate: 'Consult Date',
  referralReason: 'Referral Reason',
  chiefComplaint: 'Chief Complaint',
  examFindings: 'Exam Findings',
  diagnosis: 'Diagnosis',
  treatmentPlan: 'Treatment Plan',
  followUpPlan: 'Follow-Up Plan',
  recommendations: 'Recommendations',
};
const DATE_FIELDS = ['consultDate'];
const ARRAY_FIELDS = ['recommendations'];

/* ======= FLAT ELEMENT BUILDERS (each returns an array of small <Text> elements) ======= */
const labelEl = (f) => <Text key={`${f}-l`} style={styles.fieldLabel}>{FIELD_LABELS[f] || f}</Text>;

/* string field → bare label + sentence/comma value lines (mirrors JSX renderStringField display) */
const stringFieldEls = (f, val, showLabel) => {
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  const els = [];
  if (showLabel) els.push(labelEl(f));
  if (sentences.length <= 1) {
    els.push(<Text key={`${f}-v`} style={styles.value}>{safeString(strVal)}</Text>);
    return els;
  }
  let n = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      els.push(<Text key={`${f}-sl${si}`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
      if (parts.length >= 2) parts.forEach((p, pi) => els.push(<Text key={`${f}-s${si}c${pi}`} style={styles.listItem}>{`${n++}. ${safeString(p)}`}</Text>));
      else els.push(<Text key={`${f}-s${si}v`} style={styles.listItem}>{`${n++}. ${safeString(parsed.value)}`}</Text>);
    } else {
      els.push(<Text key={`${f}-s${si}`} style={styles.listItem}>{`${n++}. ${safeString(s)}`}</Text>);
    }
  });
  return els;
};

/* recommendations array (objects {recommendation, date}) → bare label + one numbered line per item */
const arrayFieldEls = (f, val, showLabel) => {
  const items = Array.isArray(val) ? val.filter(Boolean) : [];
  if (items.length === 0) return [];
  const els = [];
  if (showLabel) els.push(labelEl(f));
  items.forEach((item, i) => {
    const recText = item?.recommendation || String(item);
    const recDate = item?.date ? ` (${formatDate(item.date)})` : '';
    els.push(<Text key={`${f}-${i}`} style={styles.listItem}>{`${i + 1}. ${safeString(`${recText}${recDate}`)}`}</Text>);
  });
  return els;
};

/* dispatch one field → flat element array */
const fieldEls = (record, f, sid) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  const sectionTitle = SECTION_TITLES[sid] || '';
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.toLowerCase() !== sectionTitle.toLowerCase();
  if (DATE_FIELDS.includes(f)) return [labelEl(f), <Text key={`${f}-v`} style={styles.value}>{formatDate(val)}</Text>];
  if (ARRAY_FIELDS.includes(f)) return arrayFieldEls(f, val, showLabel);
  return stringFieldEls(f, val, showLabel);
};

/* ======= COMPONENT ======= */
const PsychiatricProgressNotesDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.psychiatric_progress_notes) return Array.isArray(r.psychiatric_progress_notes) ? r.psychiatric_progress_notes : [r.psychiatric_progress_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychiatric_progress_notes) return Array.isArray(dd.psychiatric_progress_notes) ? dd.psychiatric_progress_notes : [dd.psychiatric_progress_notes]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Psychiatric Progress Notes</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Psychiatric Progress Notes</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Psychiatric Progress Notes ${index + 1}`}</Text>
            </View>

            {SECTION_ORDER.map((sid) => {
              const fields = SECTION_FIELDS[sid] || [];
              const flat = [];
              fields.forEach(f => flat.push(...fieldEls(record, f, sid)));
              if (flat.length === 0) return null;
              const first = React.cloneElement(flat[0], { key: 'f0' });
              const rest = flat.slice(1).map((el, i) => React.cloneElement(el, { key: `f${i + 1}` }));
              return (
                <View key={sid} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                    {first}
                  </View>
                  {rest}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PsychiatricProgressNotesDocumentPDFTemplate;

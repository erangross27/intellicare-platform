/**
 * TherapySessionNotesDocumentPDFTemplate.jsx
 * Box-free canonical PDF - Helvetica - LETTER - therapy session notes
 * Collection: therapy_session_notes
 *
 * Array-object fields render stacked, one leaf per numbered row. Anti-orphan renderSection glues
 * the section title to its first field while the remaining field groups flow normally.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 6, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  value: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 2 },
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

/* safeString: \u-escapes only (no literal smart-quotes / invisible chars) */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) s = formatDate(val.$date);
  else s = String(val);
  return s
    .replace(/\u00d7/g, 'x')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00b5\u03bc]/g, 'u')
    .replace(/\u00b1/g, '+/-')
    .replace(/\u2265/g, '>=').replace(/\u2264/g, '<=').replace(/\u2192/g, '->');
};

const isEpochDate = (v) => {
  if (v === null || v === undefined || v === '') return true;
  try { const d = new Date(v.$date || v); return isNaN(d.getTime()) || d.getUTCFullYear() <= 1970; } catch { return false; }
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length > 0;
  if (typeof v === 'object') return !isEmptyDeep(v);
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const normalizedText = text.replace(/;\s+/g, '; ');
  return normalizedText.split(/(?:(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.|;)(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitByComma: parenthesis-aware with Oxford ("and"/"or") + numeric-thousands guards */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest) || /^\d/.test(text[i + 1] || '')) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ======= OBJECT (recursive) HELPERS ======= */
const KEY_OVERRIDES = {
  type: 'Type', value: 'Value', unit: 'Unit', method: 'Method', name: 'Name', dosage: 'Dosage', frequency: 'Frequency', route: 'Route',
  allergen: 'Allergen', reaction: 'Reaction', medication: 'Medication', directions: 'Directions', test: 'Test', indication: 'Indication', modality: 'Modality', region: 'Region',
};
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
function isEmptyDeep(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
}
const isScalar = (v) => v === null || typeof v !== 'object';
const isDateStr = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v.trim());
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };

const flattenItem = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    const primary = item.recommendation || item.text || item.name || item.__simpleType;
    if (primary) return String(primary) + (item.date ? ` (${formatDate(item.date)})` : '');
    return Object.entries(item).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => `${humanizeKey(k)}: ${fmtScalar(v)}`).join(', ');
  }
  return String(item);
};

/* ======= CONFIG (mirrors JSX) ======= */
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'presenting-issues': 'Presenting Issues',
  interventions: 'Interventions',
  response: 'Patient Response',
  homework: 'Homework',
  'next-session': 'Plan for Next Session',
  risk: 'Risk Assessment',
};
const SECTION_ORDER = ['session-info', 'presenting-issues', 'interventions', 'response', 'homework', 'next-session', 'risk'];
const SECTION_FIELDS = {
  'session-info': ['sessionDate', 'sessionNumber', 'sessionType', 'therapist'],
  'presenting-issues': ['presentingIssues'],
  interventions: ['interventions'],
  response: ['response'],
  homework: ['homework'],
  'next-session': ['planForNext'],
  risk: ['riskAssessment'],
};
const FIELD_LABELS = {
  sessionDate: 'Session Date',
  sessionNumber: 'Session Number',
  sessionType: 'Session Type',
  therapist: 'Therapist',
  presentingIssues: 'Presenting Issues',
  interventions: 'Interventions',
  response: 'Patient Response',
  homework: 'Homework',
  planForNext: 'Plan for Next Session',
  riskAssessment: 'Risk Assessment',
};
const DATE_FIELDS = ['sessionDate'];
const OBJECT_FIELDS = ['riskAssessment'];
const ARRAY_FIELDS = ['presentingIssues', 'interventions'];
const BOOLEAN_FIELDS = [];
const NUMBER_FIELDS = ['sessionNumber'];
const COMMA_FIELDS = new Set(['planForNext']);
const OBJECT_ITEM_LABELS = {};
const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();
const labelEl = (f, key) => <Text key={key} style={styles.fieldLabel}>{FIELD_LABELS[f] || f}</Text>;
const glueFieldLabel = (f, rows, key) => {
  if (!rows.length) return [];
  return [
    <View key={`${key}-glue`} wrap={false}>
      <Text style={styles.fieldLabel}>{FIELD_LABELS[f] || f}</Text>
      {rows[0]}
    </View>,
    ...rows.slice(1),
  ];
};
const glueSubLabel = (label, rows, key) => {
  if (!rows.length) return [];
  return [
    <View key={`${key}-glue`} wrap={false}>
      <Text style={styles.subLabel}>{safeString(label)}</Text>
      {rows[0]}
    </View>,
    ...rows.slice(1),
  ];
};

const splitTopLevelComma = (text) => {
  const parts = []; let current = ''; let depth = 0;
  for (const character of String(text || '')) {
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    if (character === ',' && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; }
    else current += character;
  }
  if (current.trim()) parts.push(current.trim());
  return parts.length ? parts : [String(text || '')];
};

/* string field -> bare label + sentence/comma value lines (mirrors JSX renderStringField display) */
const stringFieldEls = (f, val, showLabel) => {
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  const els = [];
  if (sentences.length <= 1 && !COMMA_FIELDS.has(f)) {
    els.push(<Text key={`${f}-v`} style={styles.listItem}>{`1. ${safeString(strVal)}`}</Text>);
    return showLabel ? glueFieldLabel(f, els, f) : els;
  }
  let n = 1;
  sentences.forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      const rows = parts.map((p, pi) => <Text key={`${f}-s${si}c${pi}`} style={styles.listItem}>{`${pi + 1}. ${safeString(p)}`}</Text>);
      els.push(...glueSubLabel(parsed.label, rows, `${f}-s${si}`));
    } else if (COMMA_FIELDS.has(f)) splitTopLevelComma(s).forEach((part, pi) => els.push(<Text key={`${f}-s${si}c${pi}`} style={styles.listItem}>{`${n++}. ${safeString(part)}`}</Text>));
    else els.push(<Text key={`${f}-s${si}`} style={styles.listItem}>{`${n++}. ${safeString(s)}`}</Text>);
  });
  return showLabel ? glueFieldLabel(f, els, f) : els;
};

/* recursive object node -> flat STACKED elements. ARRAY branch numbers each item under the sub-label;
   scalar date leaves format; numeric-index sub-labels suppressed. */
const objectNodeEls = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return [];
  if (isScalar(value)) {
    const disp = isDateStr(value) ? formatDate(value) : fmtScalar(value);
    const clauses = label === 'Risk Level' ? splitBySentence(disp) : [disp];
    const rows = clauses.map((clause, clauseIndex) => <Text key={`${keyPath}-v${clauseIndex}`} style={styles.listItem}>{`${clauseIndex + 1}. ${safeString(clause)}`}</Text>);
    if (!label) return rows;
    return [<View key={`${keyPath}-glue`} wrap={false}><Text style={depth <= 1 ? styles.fieldLabel : styles.subLabel}>{safeString(label)}</Text>{rows[0]}</View>, ...rows.slice(1)];
  }
  if (Array.isArray(value)) {
    const items = value.filter(v => !isEmptyDeep(v));
    if (items.length === 0) return [];
    const els = [];
    items.forEach((v, i) => {
      if (isScalar(v)) els.push(<Text key={`${keyPath}-${i}`} style={styles.listItem}>{`${i + 1}. ${safeString(isDateStr(v) ? formatDate(v) : fmtScalar(v))}`}</Text>);
      else objectNodeEls('', v, `${keyPath}-${i}`, depth + 1).forEach(e => els.push(e));
    });
    if (!label) return els;
    const labelStyle = depth <= 1 ? styles.fieldLabel : styles.subLabel;
    return [<View key={`${keyPath}-glue`} wrap={false}><Text style={labelStyle}>{safeString(label)}</Text>{els[0]}</View>, ...els.slice(1)];
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return [];
  const els = [];
  entries.forEach(([k, v]) => els.push(...objectNodeEls(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1)));
  if (!label) return els;
  const labelStyle = depth <= 1 ? styles.fieldLabel : styles.subLabel;
  return [<View key={`${keyPath}-glue`} wrap={false}><Text style={labelStyle}>{safeString(label)}</Text>{els[0]}</View>, ...els.slice(1)];
};

/* top-level OBJECT field -> flat stacked elements. showLabel emits the object label (single-name gated) */
const objectFieldEls = (f, val, showLabel) => {
  if (isEmptyDeep(val) || isScalar(val)) return [];
  const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return [];
  const els = [];
  if (Array.isArray(val)) {
    entries.forEach(([k, item]) => {
      const itemRows = isScalar(item) ? objectNodeEls('', item, `${f}-${k}`, 2) : Object.entries(item).filter(([, child]) => !isEmptyDeep(child)).flatMap(([childKey, child]) => objectNodeEls(humanizeKey(childKey), child, `${f}-${k}-${childKey}`, 2));
      els.push(...glueSubLabel(`${OBJECT_ITEM_LABELS[f] || 'Item'} ${Number(k) + 1}`, itemRows, `${f}-${k}-item`));
    });
  } else entries.forEach(([k, v]) => els.push(...objectNodeEls(humanizeKey(k), v, `${f}-${k}`, 1)));
  return showLabel ? glueFieldLabel(f, els, f) : els;
};

/* array field -> bare label + numbered items */
const arrayFieldEls = (f, val, showLabel) => {
  const items = Array.isArray(val) ? val.filter(hasVal) : [];
  if (items.length === 0) return [];
  const rows = [];
  let itemNumber = 1;
  items.forEach((it, i) => {
    const parsed = parseLabel(flattenItem(it));
    if (parsed.isLabeled) {
      rows.push(...glueSubLabel(parsed.label, [<Text key={`${f}-${i}-v`} style={styles.listItem}>{`1. ${safeString(parsed.value)}`}</Text>], `${f}-${i}`));
    } else rows.push(<Text key={`${f}-${i}`} style={styles.listItem}>{`${itemNumber++}. ${safeString(flattenItem(it))}`}</Text>);
  });
  return showLabel ? glueFieldLabel(f, rows, f) : rows;
};

/* dispatch one field -> flat element array */
const fieldEls = (record, f, sid) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = !sameAsTitle(label, sid);
  if (OBJECT_FIELDS.includes(f)) return isScalar(val) ? stringFieldEls(f, val, showLabel) : objectFieldEls(f, val, showLabel);
  if (ARRAY_FIELDS.includes(f)) return arrayFieldEls(f, val, showLabel);
  if (DATE_FIELDS.includes(f)) { if (isEpochDate(val)) return []; return glueFieldLabel(f, [<Text key={`${f}-v`} style={styles.listItem}>{`1. ${formatDate(val)}`}</Text>], f); }
  return stringFieldEls(f, val, showLabel);
};

/* ======= COMPONENT ======= */
const TherapySessionNotesDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.therapy_session_notes) return Array.isArray(r.therapy_session_notes) ? r.therapy_session_notes : [r.therapy_session_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.therapy_session_notes) return Array.isArray(dd.therapy_session_notes) ? dd.therapy_session_notes : [dd.therapy_session_notes]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Therapy Session Notes</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Therapy Session Notes</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Therapy Session Notes ${index + 1}`}</Text>
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

export default TherapySessionNotesDocumentPDFTemplate;

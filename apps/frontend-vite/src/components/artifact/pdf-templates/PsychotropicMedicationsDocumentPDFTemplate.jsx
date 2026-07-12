/**
 * PsychotropicMedicationsDocumentPDFTemplate.jsx
 * Box-free canonical PDF - Helvetica - LETTER - psychotropic medications
 * Collection: psychotropic_medications
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
    .replace(/\u00b5m/g, 'um').replace(/\u03bcm/g, 'um')
    .replace(/\u00b0/g, ' deg').replace(/\u00b1/g, '+/-')
    .replace(/\u2265/g, '>=').replace(/\u2264/g, '<=').replace(/\u2192/g, '->');
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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const safeArray = (v) => Array.isArray(v) ? v.filter(x => !isEmptyDeep(x)) : [];

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

/* ======= CONFIG (mirror JSX) ======= */
const SECTION_TITLES = {
  'medication-info': 'Medication Information',
  'prescription-details': 'Prescription Details',
  'indication-instructions': 'Indication and Instructions',
  'current-medications': 'Current Medications',
  'past-medications': 'Past Medications',
  'medication-changes': 'Medication Changes',
  'safety-allergies': 'Safety and Allergies',
};
const SECTION_ORDER = ['medication-info', 'prescription-details', 'indication-instructions', 'current-medications', 'past-medications', 'medication-changes', 'safety-allergies'];
const SECTION_FIELDS = {
  'medication-info': ['name', 'genericName', 'dosage', 'frequency', 'route', 'active'],
  'prescription-details': ['startDate', 'endDate', 'duration', 'durationDays', 'durationUnit', 'prescriber', 'refills'],
  'indication-instructions': ['indication', 'instructions'],
  'current-medications': ['current'],
  'past-medications': ['past'],
  'medication-changes': ['medicationChanges'],
  'safety-allergies': ['sideEffects', 'drugInteractions', 'allergiesAdverse', 'safetyWarning'],
};
const FIELD_LABELS = {
  name: 'Name',
  genericName: 'Generic Name',
  dosage: 'Dosage',
  frequency: 'Frequency',
  route: 'Route',
  active: 'Active',
  startDate: 'Start Date',
  endDate: 'End Date',
  duration: 'Duration',
  durationDays: 'Duration (Days)',
  durationUnit: 'Duration Unit',
  prescriber: 'Prescriber',
  refills: 'Refills',
  indication: 'Indication',
  instructions: 'Instructions',
  current: 'Current Medications',
  past: 'Past Medications',
  medicationChanges: 'Medication Changes',
  sideEffects: 'Side Effects',
  drugInteractions: 'Drug Interactions',
  allergiesAdverse: 'Allergies and Adverse Reactions',
  safetyWarning: 'Safety Warning',
};
const BOOLEAN_FIELDS = ['active'];
const DATE_FIELDS = ['startDate', 'endDate'];
const NUMBER_FIELDS = ['durationDays', 'refills'];
const MEANINGFUL_ZERO_FIELDS = [];
const ARRAY_FIELDS = ['sideEffects', 'drugInteractions'];
const OBJECT_ARRAY_FIELDS = ['current', 'past', 'medicationChanges', 'allergiesAdverse'];

const OBJECT_ARRAY_CONFIG = {
  current: [['dose', 'Dose'], ['frequency', 'Frequency'], ['startDate', 'Started'], ['response', 'Response'], ['sideEffects', 'Side Effects']],
  past: [['maxDose', 'Max Dose'], ['duration', 'Duration'], ['reasonStopped', 'Reason Stopped'], ['efficacy', 'Efficacy']],
  medicationChanges: [['dose', 'Dose'], ['reason', 'Reason']],
  allergiesAdverse: [['reaction', 'Reaction']],
};
const objPrimary = (f, item) => {
  if (!item || typeof item !== 'object') return String(item ?? '');
  if (f === 'medicationChanges') return [item.action, item.medication].filter(v => v != null && String(v).trim() !== '').join(' ').trim() || 'Change';
  return String(item.medication || item.name || item.drug || '').trim() || 'Item';
};

const isHiddenZero = (fn, val) => NUMBER_FIELDS.includes(fn) && Number(val) === 0 && !MEANINGFUL_ZERO_FIELDS.includes(fn);
const isEpochSentinel = (v) => { if (!v) return false; try { const d = new Date(v.$date || v); return !isNaN(d.getTime()) && d.getUTCFullYear() <= 1970; } catch { return false; } };
const sameAsTitle = (label, sid) => String(label || '').trim().toLowerCase() === String(SECTION_TITLES[sid] || '').trim().toLowerCase();

const hasVal = (v, fn) => {
  if (fn && isHiddenZero(fn, v)) return false;
  if (fn && DATE_FIELDS.includes(fn) && isEpochSentinel(v)) return false;
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length > 0;
  if (typeof v === 'object') return Object.entries(v).filter(([, x]) => !isEmptyDeep(x)).length > 0;
  return true;
};

/* ======= FLAT ELEMENT BUILDERS (each returns an array of small <Text> elements) ======= */
const fieldLabelEl = (label) => <Text style={styles.fieldLabel}>{safeString(label)}</Text>;
const subLabelEl = (label) => <Text style={styles.subLabel}>{safeString(label)}</Text>;
const valueEl = (v) => <Text style={styles.value}>{safeString(v)}</Text>;

/* date field -> label + formatted value */
const dateFieldEls = (label, val, showLabel) => {
  const els = [];
  if (showLabel) els.push(fieldLabelEl(label));
  els.push(valueEl(formatDate(val)));
  return els;
};

/* boolean field -> label + Yes/No value */
const booleanEls = (label, val, showLabel) => {
  const els = [];
  if (showLabel) els.push(fieldLabelEl(label));
  els.push(valueEl(val ? 'Yes' : 'No'));
  return els;
};

/* number field -> label + value */
const numberEls = (label, val, showLabel) => {
  const els = [];
  if (showLabel) els.push(fieldLabelEl(label));
  els.push(valueEl(fmtVal(val)));
  return els;
};

/* plain string array -> label + one numbered line per item */
const arrayFieldEls = (label, arr, showLabel) => {
  const items = safeArray(arr);
  if (items.length === 0) return [];
  const els = [];
  if (showLabel) els.push(fieldLabelEl(label));
  items.forEach((it, i) => els.push(<Text style={styles.listItem}>{`${i + 1}. ${safeString(fmtVal(it))}`}</Text>));
  return els;
};

/* string field -> label + sentence/comma value lines (mirrors JSX renderStringField display) */
const stringFieldEls = (label, val, showLabel) => {
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  const parsedWhole = parseLabel(strVal);
  const singleLabeledList = sentences.length === 1 && parsedWhole.isLabeled && splitByComma(parsedWhole.value).length >= 2;
  const els = [];
  if (showLabel) els.push(fieldLabelEl(label));
  if (sentences.length <= 1 && !singleLabeledList) { els.push(valueEl(strVal)); return els; }
  let n = 1;
  sentences.forEach((s) => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      els.push(subLabelEl(parsed.label));
      if (parts.length >= 2) parts.forEach(p => els.push(<Text style={styles.listItem}>{`${n++}. ${safeString(p)}`}</Text>));
      else els.push(<Text style={styles.listItem}>{`${n++}. ${safeString(parsed.value)}`}</Text>);
    } else {
      els.push(<Text style={styles.listItem}>{`${n++}. ${safeString(s)}`}</Text>);
    }
  });
  return els;
};

/* object-array (current/past/medicationChanges/allergiesAdverse) -> numbered item header + stacked sub-fields
   (single-name-gated field label; the section title serves as the header for current/past/medicationChanges) */
const objectArrayEls = (f, arr, showLabel) => {
  const items = safeArray(arr).filter(it => !isEmptyDeep(it));
  if (items.length === 0) return [];
  const subs = OBJECT_ARRAY_CONFIG[f] || [];
  const els = [];
  if (showLabel) els.push(fieldLabelEl(FIELD_LABELS[f] || f));
  items.forEach((item, i) => {
    if (typeof item === 'string') { els.push(<Text style={styles.listItem}>{`${i + 1}. ${safeString(item)}`}</Text>); return; }
    els.push(subLabelEl(`${i + 1}. ${objPrimary(f, item)}`));
    subs.forEach(([k, subLabel]) => {
      const v = item[k];
      if (!hasVal(v)) return;
      const vv = Array.isArray(v) ? v.filter(Boolean).join(', ') : fmtVal(v);
      if (!vv || !vv.trim()) return;
      els.push(fieldLabelEl(subLabel));
      els.push(valueEl(vv));
    });
  });
  return els;
};

/* dispatch one field -> flat element array */
const fieldEls = (record, f, sid) => {
  const val = record[f];
  if (!hasVal(val, f)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = !sameAsTitle(label, sid);
  if (OBJECT_ARRAY_FIELDS.includes(f)) return objectArrayEls(f, val, showLabel);
  if (DATE_FIELDS.includes(f)) return dateFieldEls(label, val, showLabel);
  if (BOOLEAN_FIELDS.includes(f)) return booleanEls(label, val, showLabel);
  if (NUMBER_FIELDS.includes(f)) return numberEls(label, val, showLabel);
  if (ARRAY_FIELDS.includes(f)) return arrayFieldEls(label, val, showLabel);
  return stringFieldEls(label, val, showLabel);
};

/* ======= COMPONENT ======= */
const PsychotropicMedicationsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.psychotropic_medications) return Array.isArray(r.psychotropic_medications) ? r.psychotropic_medications : [r.psychotropic_medications];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.psychotropic_medications) return Array.isArray(dd.psychotropic_medications) ? dd.psychotropic_medications : [dd.psychotropic_medications]; return [dd]; }
      if (r?.document) return Array.isArray(r.document) ? r.document : [r.document];
      if (r?.data) return Array.isArray(r.data) ? r.data : [r.data];
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Psychotropic Medications</Text>
          <Text style={styles.noDataText}>No psychotropic medication records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Psychotropic Medications</Text>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Psychotropic Medications ${index + 1}`}</Text>
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

export default PsychotropicMedicationsDocumentPDFTemplate;

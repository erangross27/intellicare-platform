/**
 * ProphylacticMedicationsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — box-free — prophylactic medications
 * Collection: prophylactic_medications
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 5, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, marginTop: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginTop: 6, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#000000', marginTop: 40 },
});

/* ═══════ CONFIG (mirrors JSX) ═══════ */
const SECTION_TITLES = {
  'medication-info': 'Medication Information',
  'antimicrobials': 'Antimicrobials',
  'bone-supportive': 'Bone Supportive',
  'gastric-protection': 'Gastric Protection',
  'dvt-prophylaxis': 'DVT Prophylaxis',
  'additional-details': 'Additional Details',
};
const FIELD_LABELS = {
  name: 'Name', genericName: 'Generic Name', dosage: 'Dosage', frequency: 'Frequency', route: 'Route', indication: 'Indication', prescriber: 'Prescriber',
  antimicrobials: 'Antimicrobials', boneSupportive: 'Bone Supportive', gastricProtection: 'Gastric Protection', dvtProphylaxis: 'DVT Prophylaxis',
  startDate: 'Start Date', endDate: 'End Date', duration: 'Duration', durationDays: 'Duration (Days)', durationUnit: 'Duration Unit',
  instructions: 'Instructions', sideEffects: 'Side Effects', drugInteractions: 'Drug Interactions', safetyWarning: 'Safety Warning', active: 'Active', refills: 'Refills',
};
const SECTION_FIELDS = {
  'medication-info': ['name', 'genericName', 'dosage', 'frequency', 'route', 'indication', 'prescriber'],
  'antimicrobials': ['antimicrobials'],
  'bone-supportive': ['boneSupportive'],
  'gastric-protection': ['gastricProtection'],
  'dvt-prophylaxis': ['dvtProphylaxis'],
  'additional-details': ['startDate', 'endDate', 'duration', 'durationDays', 'durationUnit', 'instructions', 'sideEffects', 'drugInteractions', 'safetyWarning', 'active', 'refills'],
};
const BOOLEAN_FIELDS = ['active'];
const DATE_FIELDS = ['startDate', 'endDate'];
const NUMBER_FIELDS = ['refills', 'durationDays'];
const MEANINGFUL_ZERO_FIELDS = [];
const ARRAY_FIELDS = ['antimicrobials', 'boneSupportive', 'gastricProtection', 'sideEffects', 'drugInteractions'];
const COMMA_SPLIT_FIELDS = ['instructions'];
const STRING_FIELDS = ['name', 'genericName', 'dosage', 'frequency', 'route', 'indication', 'prescriber', 'dvtProphylaxis', 'duration', 'durationUnit', 'instructions', 'safetyWarning'];

/* ═══════ UTILS ═══════ */
const safeString = (str) => {
  if (str === null || str === undefined) return '';
  return String(str).replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
};
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try { const d = new Date(dateStr.$date || dateStr); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateStr); }
};
const isEpochSentinel = (v) => { if (!v) return false; try { const d = new Date(v.$date || v); return !isNaN(d.getTime()) && d.getUTCFullYear() <= 1970; } catch { return false; } };
const isHiddenZero = (fn, val) => NUMBER_FIELDS.includes(fn) && Number(val) === 0 && !MEANINGFUL_ZERO_FIELDS.includes(fn);
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};

const flattenItem = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && !Array.isArray(item)) {
    const main = item.value || item.text || item.name || '';
    if (main) return String(main);
    return Object.entries(item).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '').map(([k, v]) => `${k}: ${v}`).join(', ');
  }
  return String(item);
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();
const shouldCommaSplit = (fn, strVal) => COMMA_SPLIT_FIELDS.includes(fn) && splitBySentence(strVal).length <= 1 && !parseLabel(strVal).isLabeled && splitByComma(strVal).length >= 2;

const fieldHasVal = (record, fn) => {
  const v = record[fn];
  if (isHiddenZero(fn, v)) return false;
  if (DATE_FIELDS.includes(fn) && isEpochSentinel(v)) return false;
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length > 0;
  if (typeof v === 'object') return Object.entries(v).filter(([, x]) => !isEmptyDeep(x)).length > 0;
  return true;
};

/* ═══════ FIELD BODY — returns a FLAT array of Text elements (anti-orphan) ═══════ */
const ProphylacticMedicationsDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && data[0] && data[0].records) records = data[0].records;
    else records = data;
  } else if (data?.records) {
    records = data.records;
  } else if (data) {
    records = [data];
  }

  if (!Array.isArray(records) || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Prophylactic Medications</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  // Render a labeled sentence-field's lines (label sub-heading + numbered value rows), returns flat Text els.
  const sentenceFieldEls = (fn, strVal, keyBase) => {
    const els = [];
    const sentences = splitBySentence(strVal);
    let n = 1;
    sentences.forEach((sentence, si) => {
      const parsed = parseLabel(sentence);
      if (parsed.isLabeled) {
        const parts = splitByComma(parsed.value);
        els.push(<Text key={`${keyBase}-s${si}-l`} style={styles.subLabel}>{safeString(parsed.label)}</Text>);
        if (parts.length >= 2) {
          parts.forEach((p, pi) => els.push(<Text key={`${keyBase}-s${si}-p${pi}`} style={styles.listItem}>{n++}. {safeString(p)}</Text>));
        } else {
          els.push(<Text key={`${keyBase}-s${si}-v`} style={styles.listItem}>{n++}. {safeString(parsed.value)}</Text>);
        }
      } else {
        els.push(<Text key={`${keyBase}-s${si}`} style={styles.value}>{n++}. {safeString(sentence)}</Text>);
      }
    });
    return els;
  };

  // fieldBody: returns a FLAT array of Text elements for one field (label + value rows).
  const fieldBody = (record, fn, sid) => {
    if (!fieldHasVal(record, fn)) return [];
    const label = FIELD_LABELS[fn] || fn;
    const val = record[fn];
    const showLabel = !sameAsTitle(label, sid);
    const els = [];
    const labelEl = showLabel ? <Text key={`${fn}-lab`} style={styles.fieldLabel}>{safeString(label)}</Text> : null;

    if (DATE_FIELDS.includes(fn)) {
      if (labelEl) els.push(labelEl);
      els.push(<Text key={`${fn}-v`} style={styles.value}>1. {safeString(formatDate(val))}</Text>);
    } else if (ARRAY_FIELDS.includes(fn)) {
      const items = (Array.isArray(val) ? val : [val]).filter(x => !isEmptyDeep(x)).map(flattenItem).filter(s => s && s.trim());
      if (items.length === 0) return [];
      if (labelEl) els.push(labelEl);
      items.forEach((item, i) => els.push(<Text key={`${fn}-i${i}`} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>));
    } else if (BOOLEAN_FIELDS.includes(fn) || NUMBER_FIELDS.includes(fn)) {
      if (labelEl) els.push(labelEl);
      els.push(<Text key={`${fn}-v`} style={styles.value}>1. {safeString(fmtVal(val))}</Text>);
    } else {
      const strVal = fmtVal(val);
      if (shouldCommaSplit(fn, strVal)) {
        const parts = splitByComma(strVal);
        if (labelEl) els.push(labelEl);
        parts.forEach((p, i) => els.push(<Text key={`${fn}-c${i}`} style={styles.listItem}>{i + 1}. {safeString(p)}</Text>));
      } else {
        const sentences = splitBySentence(strVal);
        if (sentences.length > 1 || parseLabel(strVal).isLabeled) {
          if (labelEl) els.push(labelEl);
          sentenceFieldEls(fn, strVal, fn).forEach(el => els.push(el));
        } else {
          if (labelEl) els.push(labelEl);
          els.push(<Text key={`${fn}-v`} style={styles.value}>1. {safeString(strVal)}</Text>);
        }
      }
    }
    return els;
  };

  // renderSection: FLATTEN body, glue sectionTitle + first element in wrap={false}, rest flow.
  const renderSection = (record, idx, sid) => {
    const fields = SECTION_FIELDS[sid] || [];
    if (!fields.some(f => fieldHasVal(record, f))) return null;
    const title = SECTION_TITLES[sid];
    let body = [];
    fields.forEach(f => { body = body.concat(fieldBody(record, f, sid)); });
    if (body.length === 0) return null;
    body = body.map((el, i) => React.cloneElement(el, { key: `f${i}` }));
    const [first, ...rest] = body;
    return (
      <View key={sid}>
        <View wrap={false}>
          <Text style={styles.sectionTitle}>{safeString(title)}</Text>
          {first}
        </View>
        {rest}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Prophylactic Medications</Text>
        {records.map((record, idx) => (
          <View key={idx} break={idx > 0}>
            <Text style={styles.recordTitle}>Prophylactic Medication {idx + 1}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, idx, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ProphylacticMedicationsDocumentPDFTemplate;

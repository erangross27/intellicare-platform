/**
 * PostpartumNotesDocumentPDFTemplate.jsx
 * Box-free B&W — Helvetica — LETTER size — postpartum notes
 * Collection: postpartum_notes
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 20, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
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

/* Helvetica has no glyph for U+00D7 (multiplication sign) — scrub to 'x' */
const safeString = (val) => {
  let s;
  if (val === null || val === undefined) return '';
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

const sameAsTitle = (label, title) => String(label || '').trim().toLowerCase() === String(title || '').trim().toLowerCase();

/* splitBySentence: paren-protected [.;] split so a parenthetical clause is never broken
   (e.g. "intact (cesarean delivery; no vaginal laceration)" stays whole). */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const D = String.fromCharCode(1), S = String.fromCharCode(2);
  let depth = 0, guarded = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth > 0 && ch === '.') guarded += D;
    else if (depth > 0 && ch === ';') guarded += S;
    else guarded += ch;
  }
  return guarded
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/)
    .map(s => s.split(D).join('.').split(S).join(';').replace(/^\d+\.\s+/, '').trim())
    .filter(s => s && !/^[;.,!?]+$/.test(s));
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
      const nextIsSpace = /\s/.test(text[i + 1] || '');
      const nextIsYear = /^\s*\d{4}\b/.test(text.slice(i + 1));
      if (nextIsSpace && !nextIsYear) { const t = current.trim(); if (t) result.push(t); current = ''; }
      else { current += ch; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ======= FIELD RENDERERS (bare Views — the section glue owns the only wrap=false) ======= */
const renderScalarField = (label, text, showLabel) => (
  <View style={styles.fieldBox}>
    {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
    <Text style={styles.fieldValue}>{safeString(text)}</Text>
  </View>
);

/* sentence field: split by sentence, parseLabel, comma-list (mirror of the JSX renderStringField) */
const renderSentenceField = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  const strVal = fmtVal(value);
  const sentences = splitBySentence(strVal);
  const parsedWhole = parseLabel(strVal);
  const singleLabeledList = sentences.length === 1 && parsedWhole.isLabeled && splitByComma(parsedWhole.value).length >= 2;

  if (sentences.length <= 1 && !singleLabeledList) {
    return (
      <View style={styles.fieldBox}>
        {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{safeString(strVal)}</Text>
      </View>
    );
  }

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const items = splitByComma(parsed.value);
      if (items.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        items.forEach(it => { rows.push({ type: 'item', text: safeString(it), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  return (
    <View style={styles.fieldBox}>
      {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.nestedSubtitle}>{r.text}</Text>
        : <Text key={i} style={styles.listItem}>{r.num}. {r.text}</Text>)}
    </View>
  );
};

/* array field: numbered list of string items */
const renderArrayField = (label, value, showLabel) => {
  const items = Array.isArray(value) ? value.filter(Boolean) : [];
  if (items.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}
    </View>
  );
};

/* ======= SECTION CONFIGS (mirror JSX SECTION_FIELDS) ======= */
const SECTION_CONFIGS = [
  { title: 'Delivery Information', fields: [
    { key: 'deliveryDate', label: 'Delivery Date', isDate: true },
    { key: 'deliveryType', label: 'Delivery Type', isSentence: true },
    { key: 'gestationalAge', label: 'Gestational Age', isSentence: true },
  ] },
  { title: 'Recovery Assessment', fields: [
    { key: 'lochiaCharacteristics', label: 'Lochia Characteristics', isSentence: true },
    { key: 'uterineInvolution', label: 'Uterine Involution', isSentence: true },
    { key: 'perinealHealing', label: 'Perineal Healing', isSentence: true },
    { key: 'cesareanIncisionStatus', label: 'Cesarean Incision Status', isSentence: true },
    { key: 'vitalSigns', label: 'Vital Signs', isSentence: true },
  ] },
  { title: 'Lactation', fields: [
    { key: 'breastfeedingStatus', label: 'Breastfeeding Status', isSentence: true },
    { key: 'lactationAssessment', label: 'Lactation Assessment', isSentence: true },
  ] },
  { title: 'Screening & Scores', fields: [
    { key: 'edinburghPostnatalDepressionScore', label: 'Edinburgh Postnatal Depression Score', isNumber: true },
    { key: 'homansSign', label: "Homan's Sign", isBoolean: true },
    { key: 'estimatedBloodLoss', label: 'Estimated Blood Loss (mL)', isNumber: true },
    { key: 'hemoglobinLevel', label: 'Hemoglobin Level', isNumber: true },
    { key: 'postpartumHemorrhageHistory', label: 'Postpartum Hemorrhage History', isBoolean: true },
  ] },
  { title: 'Bowel and Bladder Function', fields: [
    { key: 'bowelBladderFunction', label: 'Bowel and Bladder Function', isSentence: true },
    { key: 'diastasisRectiMeasurement', label: 'Diastasis Recti Measurement', isSentence: true },
  ] },
  { title: 'Immunizations', fields: [
    { key: 'immunizationStatus', label: 'Immunization Status', isArray: true },
    { key: 'rhogamAdministration', label: 'RhoGAM Administration', isBoolean: true },
    { key: 'rubellaImmunityStatus', label: 'Rubella Immunity Status', isSentence: true },
  ] },
  { title: 'Discharge & Guidance', fields: [
    { key: 'contraceptionCounseling', label: 'Contraception Counseling', isSentence: true },
    { key: 'sleepPatterns', label: 'Sleep Patterns', isSentence: true },
    { key: 'socialSupportAssessment', label: 'Social Support Assessment', isSentence: true },
    { key: 'returnToActivityGuidance', label: 'Return to Activity Guidance', isSentence: true },
  ] },
];

const fieldVisible = (f, val) => {
  if (f.isArray) return Array.isArray(val) && val.filter(Boolean).length > 0;
  return hasVal(val);
};

/* ======= COMPONENT ======= */
const PostpartumNotesDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.postpartum_notes) return Array.isArray(r.postpartum_notes) ? r.postpartum_notes : [r.postpartum_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.postpartum_notes) return Array.isArray(dd.postpartum_notes) ? dd.postpartum_notes : [dd.postpartum_notes]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Postpartum Notes</Text>
          <Text style={styles.noDataText}>No postpartum note records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.documentTitle}>Postpartum Notes</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {idx > 0 && <View style={styles.separator} />}

            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Postpartum Note {idx + 1}</Text>
            </View>

            {SECTION_CONFIGS.map((cfg, sIdx) => {
              const visible = cfg.fields.filter(f => fieldVisible(f, record[f.key]));
              if (!visible.length) return null;
              const elements = visible.map((f) => {
                const showLabel = !sameAsTitle(f.label, cfg.title);
                const val = record[f.key];
                let el = null;
                if (f.isDate) el = renderScalarField(f.label, formatDate(val), showLabel);
                else if (f.isBoolean) el = renderScalarField(f.label, val ? 'Yes' : 'No', showLabel);
                else if (f.isNumber) el = renderScalarField(f.label, String(val), showLabel);
                else if (f.isArray) el = renderArrayField(f.label, val, showLabel);
                else el = renderSentenceField(f.label, val, showLabel);
                return el ? <React.Fragment key={f.key}>{el}</React.Fragment> : null;
              }).filter(Boolean);
              if (!elements.length) return null;
              const [first, ...rest] = elements;

              return (
                <View key={sIdx} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{cfg.title}</Text>
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

export default PostpartumNotesDocumentPDFTemplate;

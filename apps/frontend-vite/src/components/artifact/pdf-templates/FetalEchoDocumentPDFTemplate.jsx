/**
 * FetalEchoDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: real record.date (never createdAt),
 * values numbered ('1.' even singles), single-name label gate, unlabeled single sentence with >=3 guarded
 * comma items split into numbered rows, semicolon/period narratives sentence-split. Collection: fetal_echo
 *
 * Rule #74: each field is ONE wrap={false} atomic View; the sectionTitle rides INSIDE the first present
 * field's View (anti-orphan). splitBySentence splits on [.;]. PHI footer is STATIC only.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const SECTION_TITLES = {
  'header-info': 'Header Information', 'cardiac-basics': 'Cardiac Basics', 'cardiac-anatomy': 'Cardiac Anatomy',
  'valve-vessel': 'Valves & Vessels', 'functional': 'Functional Assessment',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', gestationalAge: 'Gestational Age', indicationForStudy: 'Indication For Study',
  fetalHeartRate: 'Fetal Heart Rate', fetalCardiacRhythm: 'Fetal Cardiac Rhythm', cardiacAxis: 'Cardiac Axis', cardiacPosition: 'Cardiac Position', cardiothoracicRatio: 'Cardiothoracic Ratio',
  atrialSitus: 'Atrial Situs', ventriculoarterialConnection: 'Ventriculoarterial Connection', atrioventricularConnection: 'Atrioventricular Connection', foramenOvaleStatus: 'Foramen Ovale Status', atrialSeptalIntegrity: 'Atrial Septal Integrity', ventricularSeptalIntegrity: 'Ventricular Septal Integrity',
  mitralValveMorphology: 'Mitral Valve Morphology', tricuspidValveMorphology: 'Tricuspid Valve Morphology', aorticValveMorphology: 'Aortic Valve Morphology', pulmonicValveMorphology: 'Pulmonic Valve Morphology', aorticArchSidedness: 'Aortic Arch Sidedness', ductusArteriosusPatency: 'Ductus Arteriosus Patency',
  ventricularSize: 'Ventricular Size', myocardialFunction: 'Myocardial Function', pericardialEffusion: 'Pericardial Effusion',
};
const SECTION_CONFIG = [
  { title: 'Header Information', fields: ['date', 'provider', 'facility', 'gestationalAge', 'indicationForStudy'] },
  { title: 'Cardiac Basics', fields: ['fetalHeartRate', 'fetalCardiacRhythm', 'cardiacAxis', 'cardiacPosition', 'cardiothoracicRatio'] },
  { title: 'Cardiac Anatomy', fields: ['atrialSitus', 'ventriculoarterialConnection', 'atrioventricularConnection', 'foramenOvaleStatus', 'atrialSeptalIntegrity', 'ventricularSeptalIntegrity'] },
  { title: 'Valves & Vessels', fields: ['mitralValveMorphology', 'tricuspidValveMorphology', 'aorticValveMorphology', 'pulmonicValveMorphology', 'aorticArchSidedness', 'ductusArteriosusPatency'] },
  { title: 'Functional Assessment', fields: ['ventricularSize', 'myocardialFunction', 'pericardialEffusion'] },
];
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['fetalHeartRate', 'cardiothoracicRatio'];

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean' || typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
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

/* STRING rows: LABELED sentence → subtitle + >=2 comma rows; UNLABELED single sentence >=3 comma → numbered;
   otherwise one whole numbered row per sentence. */
const stringRows = (text) => {
  const strip = (x) => x.replace(/[;.]+$/, '').trim();
  const strVal = fmtVal(text);
  const sentences = splitBySentence(strVal);
  const single = parseLabel(strVal);
  if (sentences.length <= 1 && !single.isLabeled) {
    const commaItems = splitByComma(strVal);
    if (commaItems.length >= 3) return commaItems.map((c, i) => ({ text: safeString(strip(c)), num: i + 1 }));
    return [{ text: safeString(strVal), num: 1 }];
  }
  const rows = []; let n = 1;
  sentences.forEach(s => { rows.push({ text: safeString(strip(s)), num: n++ }); });
  return rows;
};

/* Rule #74: render a field as a wrap={false} atomic View; sectionTitle rides inside the first View. */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;
  let body;
  if (DATE_FIELDS.includes(field)) {
    body = <Text style={styles.value}>1. {formatDate(val)}</Text>;
  } else if (NUMBER_FIELDS.includes(field)) {
    body = <Text style={styles.value}>1. {safeString(fmtVal(val))}</Text>;
  } else {
    const rows = stringRows(val);
    body = rows.map((r, i) => <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>);
  }
  return (
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  );
};

const FetalEchoDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0]?.fetal_echo && Array.isArray(docProp[0].fetal_echo)) records = docProp[0].fetal_echo;
    else records = docProp;
  } else if (docProp && docProp.fetal_echo) records = Array.isArray(docProp.fetal_echo) ? docProp.fetal_echo : [docProp.fetal_echo];
  else if (docProp) records = [docProp];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fetal Echocardiography</Text></View>
        <Text style={styles.emptyState}>No fetal echo data available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fetal Echocardiography</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Fetal Echo ${idx + 1}`}</Text>
            {SECTION_CONFIG.map((section, sIdx) => {
              const vis = section.fields.filter(f => hasVal(record[f]));
              if (vis.length === 0) return null;
              return (
                <View key={sIdx} style={styles.section}>
                  {vis.map((f, fi) => renderField(record, f, section.title, fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default FetalEchoDocumentPDFTemplate;

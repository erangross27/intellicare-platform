/**
 * FetalEchoResultsDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: hide-zero numerics (a measured cardiac
 * quantity never legitimately reads exactly 0 → not-measured sentinel, unless doctor-edited), values numbered
 * ('1.' even singles), single-name label gate, semicolon/period narratives sentence-split. Collection: fetal_echo_results
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

const SECTION_CONFIG = [
  { title: 'Cardiac Biometry', fields: [['fetalHeartRate', 'Fetal Heart Rate (bpm)', 'number'], ['cardiothoracicRatio', 'Cardiothoracic Ratio', 'number'], ['cardiacAxis', 'Cardiac Axis', 'string'], ['gestationalAge', 'Gestational Age', 'string']] },
  { title: 'Views & Outflow', fields: [['fourChamberView', 'Four-Chamber View', 'string'], ['leftVentricularOutflowTract', 'Left Ventricular Outflow Tract', 'string'], ['rightVentricularOutflowTract', 'Right Ventricular Outflow Tract', 'string'], ['ductalArchView', 'Ductal Arch View', 'string'], ['aorticArchAssessment', 'Aortic Arch Assessment', 'string']] },
  { title: 'Valves & Function', fields: [['tricuspidValveFunction', 'Tricuspid Valve Function', 'string'], ['mitralValveFunction', 'Mitral Valve Function', 'string'], ['ventricularFunction', 'Ventricular Function', 'string'], ['tricuspidRegurgitationVelocity', 'TR Velocity (m/s)', 'number']] },
  { title: 'Septum & Shunts', fields: [['septalIntegrity', 'Septal Integrity', 'string'], ['ductusArteriosusFlow', 'Ductus Arteriosus Flow', 'string'], ['foramenOvaleFlow', 'Foramen Ovale Flow', 'string']] },
  { title: 'Venous Return', fields: [['pulmonaryVeinReturn', 'Pulmonary Vein Return', 'string'], ['systemicVenousReturn', 'Systemic Venous Return', 'string']] },
  { title: 'Other', fields: [['rythmAnalysis', 'Rhythm Analysis', 'string'], ['pericardialSpace', 'Pericardial Space', 'string'], ['coronaryArteryOrigins', 'Coronary Artery Origins', 'string'], ['fetalHydrocardiaMeasurement', 'Fetal Hydrocardia Measurement', 'number'], ['cardiacMalformationSeverity', 'Cardiac Malformation Severity', 'string']] },
];

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
// hide-zero: a measured cardiac quantity of exactly 0 = not-measured sentinel (unless doctor-edited). Mirrors JSX.
const numberShows = (record, key) => {
  const val = record[key];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
  return true;
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
    if (commaItems.length >= 3) return commaItems.map((c, i) => ({ type: 'item', text: safeString(strip(c)), num: i + 1 }));
    return [{ type: 'item', text: safeString(strVal), num: 1 }];
  }
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      const items = (parts.length >= 2 ? parts : [parsed.value]).map(strip);
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      let m = 1; items.forEach(it => rows.push({ type: 'item', text: safeString(it), num: m++ }));
    } else {
      rows.push({ type: 'item', text: safeString(strip(s)), num: n++ });
    }
  });
  return rows;
};

/* Rule #74: render a field as a wrap={false} atomic View; sectionTitle rides inside the first View. */
const renderField = (record, key, label, kind, sectionTitle, isFirst) => {
  const val = record[key];
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;
  let body;
  if (kind === 'number') {
    body = <Text style={styles.value}>1. {safeString(fmtVal(val))}</Text>;
  } else {
    const rows = stringRows(val);
    body = rows.map((r, i) => r.type === 'subtitle'
      ? <Text key={i} style={styles.fieldLabel}>{r.text}</Text>
      : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>);
  }
  return (
    <View key={key} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  );
};

const FetalEchoResultsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.fetal_echo_results) return Array.isArray(r.fetal_echo_results) ? r.fetal_echo_results : [r.fetal_echo_results];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.fetal_echo_results) return Array.isArray(dd.fetal_echo_results) ? dd.fetal_echo_results : [dd.fetal_echo_results]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fetal Echocardiography Results</Text></View>
        <Text style={styles.emptyState}>No data available</Text>
      </Page></Document>
    );
  }

  const present = (record, key, kind) => (kind === 'number' ? numberShows(record, key) : hasVal(record[key]));

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fetal Echocardiography Results</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Fetal Echocardiography Results ${idx + 1}`}</Text>
            {SECTION_CONFIG.map((section, sIdx) => {
              const vis = section.fields.filter(([key, , kind]) => present(record, key, kind));
              if (vis.length === 0) return null;
              return (
                <View key={sIdx} style={styles.section}>
                  {vis.map(([key, label, kind], fi) => renderField(record, key, label, kind, section.title, fi === 0))}
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

export default FetalEchoResultsDocumentPDFTemplate;

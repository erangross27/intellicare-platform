/**
 * CaseSummariesPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer uses paddingBottom only (marginBottom shoves the whole record → empty page 1).
 * Collection: case_summaries
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 12, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/[;.]\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
// Comma split: never inside parentheses; keep "and"/"or" connected on either side of the
// comma (", and consideration..." stays attached); skip no-space commas ("50,000").
const splitLabParts = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      if (!/\s/.test(s[i + 1] || '')) { cur += ch; continue; }
      const rest = s.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\b(and|or)\s*$/i.test(cur)) { cur += ch; continue; }
      if (!/[A-Za-z>(]/.test(rest[0] || '')) { cur += ch; continue; }
      const t = cur.trim(); if (t) out.push(t); cur = ''; continue;
    }
    cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out;
};

const FL = {
  patientAge: 'Age', patientGender: 'Gender', bodyMassIndex: 'BMI',
  chiefComplaint: 'Chief Complaint', symptomDuration: 'Symptom Duration', primaryDiagnosis: 'Primary Diagnosis',
  secondaryDiagnoses: 'Secondary Diagnoses',
  glasgowComaScale: 'Glasgow Coma Scale', apacheIIScore: 'APACHE II Score', sofaScore: 'SOFA Score', nyhaClass: 'NYHA Class', painScale: 'Pain Scale',
  vitalSigns: 'Vital Signs', laboratoryValues: 'Laboratory Values', creatinineClearance: 'Creatinine Clearance',
  imagingStudies: 'Imaging Studies', ecgFindings: 'ECG Findings', echocardiogramResults: 'Echocardiogram Results', leftVentricularEjectionFraction: 'LVEF (%)',
  medicationList: 'Medications', allergies: 'Allergies', proceduresPerformed: 'Procedures Performed',
  hospitalLengthOfStay: 'Length of Stay (days)', dischargeDisposition: 'Discharge Disposition', followUpInstructions: 'Follow-Up Instructions',
};
// Fields whose sentences carry embedded "Label: value" labels → nested sub-labels + comma-split rows
const LABEL_COMMA_FIELDS = new Set(['laboratoryValues', 'vitalSigns', 'echocardiogramResults', 'followUpInstructions']);

// Sentences -> groups: labeled sentence = own group with comma-split items; consecutive
// unlabeled sentences collect into one group and are ALSO comma-split (mirrors the JSX).
const parseLabeledSentences = (text) => {
  const groups = []; let nullGroup = null;
  splitBySentence(String(text || '')).forEach(sentence => {
    const ci = sentence.indexOf(':');
    const lbl = ci > 0 && ci < 60 && !sentence.substring(0, ci).includes('.') ? sentence.substring(0, ci).trim() : null;
    if (lbl) { groups.push({ label: lbl, items: splitLabParts(sentence.substring(ci + 1).trim()).map(p => p.replace(/[.;]+$/, '').trim()) }); nullGroup = null; }
    else { if (!nullGroup) { nullGroup = { label: null, items: [] }; groups.push(nullGroup); } splitLabParts(sentence).forEach(p => nullGroup.items.push(p.replace(/[.;]+$/, '').trim())); }
  });
  return groups;
};
const labelCommaRows = (text) => parseLabeledSentences(text).reduce((sum, g) => sum + g.items.length + (g.label ? 1 : 0), 0);

// single-name rule: field label == section title → the label is not repeated under the title
const showLbl = (f, sTitle) => (FL[f] || f).toLowerCase() !== String(sTitle).toLowerCase();

// Numbering restarts at each LABELED group; an unlabeled group continues the running
// count so "1." never appears twice in a visually contiguous list.
const renderLabelCommaGroups = (text) => {
  let num = 0;
  return parseLabeledSentences(text).map((g, gi) => {
    if (g.label) num = 0;
    const start = num;
    num += g.items.length;
    return (
      <View key={gi} style={{ marginBottom: 4 }}>
        {g.label && <Text style={styles.fieldLabel}>{g.label}</Text>}
        {g.items.map((s, si) => <Text key={si} style={styles.listItem}>{start + si + 1}. {s}</Text>)}
      </View>
    );
  });
};

const renderFieldSection = (sTitle, fields, record) => {
  const visible = fields.filter(f => hasVal(record[f]));
  if (visible.length === 0) return null;
  const rows = visible.reduce((sum, f) => sum + (LABEL_COMMA_FIELDS.has(f) ? labelCommaRows(String(record[f])) + 1 : 2), 0);
  return (
    <View style={styles.section} wrap={rows > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sTitle}</Text>
      {visible.map((f, i) => {
        if (LABEL_COMMA_FIELDS.has(f)) {
          return (<View key={i} style={{ marginBottom: 6 }}>{showLbl(f, sTitle) && <Text style={styles.fieldLabel}>{FL[f] || f}</Text>}{renderLabelCommaGroups(String(record[f]))}</View>);
        }
        return (<View key={i} style={{ marginBottom: 6 }}>{showLbl(f, sTitle) && <Text style={styles.fieldLabel}>{FL[f] || f}</Text>}<Text style={styles.listItem}>1. {fmtVal(record[f])}</Text></View>);
      })}
    </View>
  );
};

const renderLabelCommaSection = (sTitle, fn, record) => {
  if (!hasVal(record[fn])) return null;
  const rows = labelCommaRows(String(record[fn]));
  return (
    <View style={styles.section} wrap={rows > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sTitle}</Text>
      {renderLabelCommaGroups(String(record[fn]))}
    </View>
  );
};

const renderArraySection = (sTitle, items) => {
  const arr = safeArr(items);
  if (arr.length === 0) return null;
  const groups = []; let cg = { label: null, items: [] };
  arr.forEach(it => { const ci = String(it).indexOf(':'); const pfx = ci > 0 && ci < 30 ? String(it).substring(0, ci).trim() : null;
    if (pfx && pfx !== cg.label) { if (cg.items.length) groups.push(cg); cg = { label: pfx, items: [] }; }
    else if (!pfx && cg.label) { if (cg.items.length) groups.push(cg); cg = { label: null, items: [] }; }
    cg.items.push(pfx ? String(it).substring(ci + 1).trim() : String(it));
  });
  if (cg.items.length) groups.push(cg);
  return (
    <View style={styles.section} wrap={arr.length > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sTitle}</Text>
      {groups.map((g, gi) => (
        <View key={gi} style={{ marginBottom: 6 }}>
          {g.label && <Text style={styles.fieldLabel}>{g.label}</Text>}
          {g.items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}
        </View>
      ))}
    </View>
  );
};

const CaseSummariesPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.case_summaries) return Array.isArray(r.case_summaries) ? r.case_summaries : [r.case_summaries];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.case_summaries) return Array.isArray(dd.case_summaries) ? dd.case_summaries : [dd.case_summaries]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Case Summaries</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Case Summaries</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Case Summary ${idx + 1}`}</Text>
              {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>
            {renderFieldSection('Patient Demographics', ['patientAge', 'patientGender', 'bodyMassIndex'], record)}
            {renderFieldSection('Chief Complaint', ['chiefComplaint', 'symptomDuration'], record)}
            {renderFieldSection('Primary Diagnosis', ['primaryDiagnosis'], record)}
            {renderArraySection('Secondary Diagnoses', record.secondaryDiagnoses)}
            {renderFieldSection('Clinical Scores', ['glasgowComaScale', 'apacheIIScore', 'sofaScore', 'nyhaClass', 'painScale'], record)}
            {renderFieldSection('Vital Signs', ['vitalSigns'], record)}
            {renderLabelCommaSection('Laboratory Values', 'laboratoryValues', record)}
            {hasVal(record.creatinineClearance) && <View style={styles.section} wrap={false}><Text style={styles.sectionTitle}>Creatinine Clearance</Text><Text style={styles.listItem}>1. {fmtVal(record.creatinineClearance)}</Text></View>}
            {(() => {
              const imaging = safeArr(record.imagingStudies);
              const hasOther = hasVal(record.ecgFindings) || hasVal(record.echocardiogramResults) || hasVal(record.leftVentricularEjectionFraction);
              if (imaging.length === 0 && !hasOther) return null;
              const echoRows = hasVal(record.echocardiogramResults) ? labelCommaRows(String(record.echocardiogramResults)) : 0;
              const rows = imaging.length + (hasVal(record.ecgFindings) ? 2 : 0) + (echoRows ? echoRows + 1 : 0) + (hasVal(record.leftVentricularEjectionFraction) ? 2 : 0);
              return (
                <View style={styles.section} wrap={rows > 8 ? true : false}>
                  <Text style={styles.sectionTitle}>Imaging & Diagnostics</Text>
                  {imaging.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}
                  {hasVal(record.ecgFindings) && <View style={{ marginTop: 6 }}><Text style={styles.fieldLabel}>{FL.ecgFindings}</Text><Text style={styles.listItem}>1. {fmtVal(record.ecgFindings)}</Text></View>}
                  {echoRows > 0 && <View style={{ marginTop: 6 }}><Text style={styles.fieldLabel}>{FL.echocardiogramResults}</Text>{renderLabelCommaGroups(String(record.echocardiogramResults))}</View>}
                  {hasVal(record.leftVentricularEjectionFraction) && <View style={{ marginTop: 6 }}><Text style={styles.fieldLabel}>{FL.leftVentricularEjectionFraction}</Text><Text style={styles.listItem}>1. {fmtVal(record.leftVentricularEjectionFraction)}</Text></View>}
                </View>
              );
            })()}
            {renderArraySection('Medications', record.medicationList)}
            {renderArraySection('Allergies', record.allergies)}
            {renderArraySection('Procedures Performed', record.proceduresPerformed)}
            {renderFieldSection('Disposition & Follow-Up', ['hospitalLengthOfStay', 'dischargeDisposition', 'followUpInstructions'], record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CaseSummariesPDFTemplate;

/**
 * CardiologyConsultationsDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt
 * Collection: cardiology_consultations
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 14, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 6, backgroundColor: '#f0f0f0', padding: 6, borderWidth: 1, borderColor: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 2, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  subSectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, marginTop: 6, paddingLeft: 4 },
  subLabelLine: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 8, marginBottom: 4, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
// Split a list on ", " only — parenthesis-aware, so "V3-V6 (anterolateral leads)" stays intact.
const splitByComma = (text) => { const s = String(text || ''); const out = []; let cur = '', depth = 0; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1); if (ch === ',' && depth === 0 && /\s/.test(s[i + 1] || '')) { const t = cur.trim(); if (t) out.push(t); cur = ''; } else cur += ch; } const t = cur.trim(); if (t) out.push(t); return out; };
const parseLabel = (text) => { const m = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&()₂%,-]{0,49}?):\s*(.+)$/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };
// Comma-split a finding field into continuous numbered items; labeled part → underlined subtitle + numbered value.
const renderDiagItems = (text) => { const items = []; splitBySentence(text).forEach(sent => splitByComma(sent).forEach(p => items.push(p))); let n = 0; return items.map((s, i) => { const pp = parseLabel(s); n += 1; return pp ? (<View key={i} wrap={false}><Text style={styles.subLabelLine}>{pp.label}</Text><Text style={styles.listItem}>{n}. {pp.content}</Text></View>) : (<Text key={i} style={styles.listItem}>{n}. {s}</Text>); }); };

const FL = {
  referralReason: 'Referral Reason', referringProvider: 'Referring Provider', chiefComplaint: 'Chief Complaint', urgency: 'Urgency',
  cardiologyDiagnosis: 'Diagnosis', nyhaClass: 'NYHA Class', proceduresRecommended: 'Procedures',
  ecgFindings: 'ECG Findings', echoFindings: 'Echo Findings', stressTestResults: 'Stress Test',
  cathResults: 'Cath Results', holterFindings: 'Holter Findings', cardiacExamFindings: 'Cardiac Exam',
};

const CardiologyConsultationsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cardiology_consultations) return Array.isArray(r.cardiology_consultations) ? r.cardiology_consultations : [r.cardiology_consultations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cardiology_consultations) return Array.isArray(dd.cardiology_consultations) ? dd.cardiology_consultations : [dd.cardiology_consultations]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Cardiology Consultations</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Cardiology Consultations</Text>
        {records.map((record, idx) => {
          const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(r => r?.recommendation) : [];
          return (
            <View key={idx} style={styles.recordSection}>
              <View wrap={false}><Text style={styles.recordTitle}>{`Cardiology Consultation ${idx + 1}`}</Text>{record.consultDate && <Text style={styles.recordMeta}>{formatDate(record.consultDate)}</Text>}</View>

              {(['referralReason', 'referringProvider', 'chiefComplaint', 'urgency'].some(f => hasVal(record[f]))) && (
                <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Consultation</Text>
                  {['referralReason', 'referringProvider', 'chiefComplaint', 'urgency'].filter(f => hasVal(record[f])).map((f, i) => <View key={i}><Text style={styles.subSectionTitle}>{FL[f]}</Text><Text style={styles.listItem}>{fmtVal(record[f])}</Text></View>)}
                </View>)}

              {hasVal(record.cardiologyHistory) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Cardiology History</Text>{splitBySentence(fmtVal(record.cardiologyHistory)).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</View>)}
              {hasVal(record.cardiacRiskFactors) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Cardiac Risk Factors</Text>{splitBySentence(fmtVal(record.cardiacRiskFactors)).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</View>)}

              {['ecgFindings', 'echoFindings', 'stressTestResults', 'cathResults', 'holterFindings', 'cardiacExamFindings'].some(f => hasVal(record[f])) && (
                <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Diagnostics</Text>
                  {['ecgFindings', 'echoFindings', 'stressTestResults', 'cathResults', 'holterFindings', 'cardiacExamFindings'].filter(f => hasVal(record[f])).map((f, i) => <View key={i} wrap={false}><Text style={styles.subSectionTitle}>{FL[f] || f}</Text>{renderDiagItems(fmtVal(record[f]))}</View>)}
                </View>)}

              {hasVal(record.cardiologyDiagnosis) && (<View style={styles.fieldContainer}><Text style={styles.subSectionTitle}>Diagnosis</Text><Text style={styles.listItem}>{record.cardiologyDiagnosis}</Text></View>)}
              {hasVal(record.riskStratification) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Risk Stratification</Text>{splitBySentence(fmtVal(record.riskStratification)).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</View>)}

              {hasVal(record.currentCardiacMedications) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Current Medications</Text>{splitBySentence(fmtVal(record.currentCardiacMedications)).map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</View>)}
              {hasVal(record.medicationsRecommended) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Medications Recommended</Text>{renderDiagItems(fmtVal(record.medicationsRecommended))}</View>)}
              {hasVal(record.lifestyleModifications) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Lifestyle Modifications</Text>{renderDiagItems(fmtVal(record.lifestyleModifications))}</View>)}
              {hasVal(record.proceduresRecommended) && (<View style={styles.fieldContainer}><Text style={styles.subSectionTitle}>Procedures Recommended</Text><Text style={styles.listItem}>{record.proceduresRecommended}</Text></View>)}

              {recs.length > 0 && (() => { const groups = {}; recs.forEach(r => { const d = r.date ? formatDate(r.date) : 'No Date'; if (!groups[d]) groups[d] = []; groups[d].push(r); }); return (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Recommendations</Text>{Object.entries(groups).map(([date, items], gi) => <View key={gi}><Text style={styles.subSectionTitle}>{date}</Text>{items.map((rec, i) => <Text key={i} style={styles.listItem}>{i + 1}. {rec.recommendation}</Text>)}</View>)}</View>); })()}

              {hasVal(record.followUpPlan) && (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>Follow-Up Plan</Text>{renderDiagItems(fmtVal(record.followUpPlan))}</View>)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default CardiologyConsultationsDocumentPDFTemplate;

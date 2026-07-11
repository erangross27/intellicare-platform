/**
 * CareCoordinationTemplate.jsx (PDF)
 * FULL TEMPLATE STANDARD — collection: care_coordination
 * B&W: #000000 / #ffffff ONLY. Rule #74 wrap-gating (small sections wrap={false}).
 * Covers all 25 non-system fields: number, date, 7 arrays, 4 recursive objects, strings.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 14, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, borderWidth: 1, borderColor: '#000000', padding: 6 },
  recordMeta: { fontSize: 11, color: '#000000', marginBottom: 2, paddingLeft: 4 },
  fieldContainer: { marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  subSectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, marginTop: 6, paddingLeft: 4, borderBottomWidth: 0.5, borderBottomColor: '#000000', paddingBottom: 2 },
  fieldValue: { fontSize: 12, lineHeight: 1.5, color: '#000000', paddingLeft: 8, marginBottom: 2 },
  listItem: { fontSize: 12, lineHeight: 1.5, color: '#000000', paddingLeft: 12, marginBottom: 3 },
  nestedLeaf: { fontSize: 12, lineHeight: 1.5, color: '#000000', paddingLeft: 12, marginBottom: 2 },
  nestedLabel: { fontFamily: 'Helvetica-Bold', color: '#000000' },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const isScalar = (v) => v === null || typeof v !== 'object';
const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
  if (typeof v === 'object') return Object.values(v).some(hasVal);
  return true;
};
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(x => x !== null && x !== undefined && String(x).trim() !== '') : [];
const humanizeKey = (key) => {
  if (!key) return '';
  if (key === key.toUpperCase() && key.length <= 6) return key;
  return String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
};

const FL = {
  referralSource: 'Referral Source', referralDestination: 'Referral Destination',
  referralReason: 'Referral Reason', transitionType: 'Transition Type', careCoordinator: 'Care Coordinator',
  functionalStatus: 'Functional Status', cognitiveStatus: 'Cognitive Status',
  mobilityLevel: 'Mobility Level', fallRiskAssessment: 'Fall Risk Assessment',
  insuranceAuthorization: 'Insurance Authorization', readmissionRiskScore: 'Readmission Risk Score',
  languageBarriers: 'Language Barriers', culturalConsiderations: 'Cultural Considerations',
};

const NUMBER_FIELDS = ['readmissionRiskScore'];
const SENTENCE_FIELDS = ['referralReason', 'functionalStatus', 'cognitiveStatus', 'culturalConsiderations'];
const COMMA_SPLIT_FIELDS = new Set(['referralDestination']);

const splitBySentence = (text) => { if (!text) return []; return String(text).split(/(?<=[.;])\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
const splitByComma = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      const rest = s.slice(i + 1).replace(/^\s+/, '');
      if (/^and\b/i.test(rest)) { cur += ch; continue; }
      const t = cur.trim(); if (t) out.push(t); cur = ''; continue;
    }
    cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length ? out : (s.trim() ? [s.trim()] : []);
};
const splitItems = (text) => splitBySentence(text).flatMap(s => splitByComma(s));

const fieldHasVal = (f, record) => {
  const v = record[f];
  if (NUMBER_FIELDS.includes(f)) return v !== null && v !== undefined && v !== '' && Number(v) !== 0;
  return hasVal(v);
};

/* recursive object → nested rows mirroring the on-screen mini-cards:
   label = its OWN Helvetica-Bold sub-label row, value/numbered items indented below.
   NEVER a side-by-side "Label: value" row. */
const objectRows = (label, value, depth, out) => {
  if (!hasVal(value)) return out;
  if (Array.isArray(value)) {
    if (label) out.push({ kind: 'label', text: label, depth });
    const allScalar = value.every(v => v === null || typeof v !== 'object');
    if (allScalar) { value.filter(v => hasVal(v)).forEach((v, i) => out.push({ kind: 'item', text: fmtVal(v), num: i + 1, depth: depth + 1 })); }
    else { value.forEach((item, i) => { if (item && typeof item === 'object') objectRows(`${label || 'Item'} ${i + 1}`, item, depth + 1, out); else if (hasVal(item)) out.push({ kind: 'item', text: fmtVal(item), num: i + 1, depth: depth + 1 }); }); }
    return out;
  }
  if (isScalar(value)) { if (label) out.push({ kind: 'label', text: label, depth }); out.push({ kind: 'item', text: fmtVal(value), num: 1, depth: depth + 1 }); return out; }
  if (label) out.push({ kind: 'label', text: label, depth });
  Object.entries(value).filter(([, v]) => hasVal(v)).forEach(([k, v]) => objectRows(humanizeKey(k), v, depth + (label ? 1 : 0), out));
  return out;
};

const renderStringGroup = (title, fields, record) => {
  const visible = fields.filter(f => fieldHasVal(f, record));
  if (visible.length === 0) return null;
  return (
    <View style={styles.fieldContainer} wrap={visible.length > 6 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {visible.map((f, i) => {
        const items = SENTENCE_FIELDS.includes(f) ? splitItems(fmtVal(record[f])) : (COMMA_SPLIT_FIELDS.has(f) ? splitByComma(fmtVal(record[f])) : null);
        return (
          <View key={i} wrap={false}>
            <Text style={styles.subSectionTitle}>{FL[f] || f}</Text>
            {items && items.length > 1
              ? items.map((it, j) => <Text key={j} style={styles.listItem}>{j + 1}. {it}</Text>)
              : <Text style={styles.listItem}>1. {fmtVal(record[f])}</Text>}
          </View>
        );
      })}
    </View>
  );
};

const renderArrayGroup = (title, fieldName, record) => {
  const items = safeArr(record[fieldName]);
  if (items.length === 0) return null;
  return (
    <View style={styles.fieldContainer} wrap={items.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {fmtVal(it)}</Text>)}
    </View>
  );
};

const renderObjectGroup = (title, fieldName, record) => {
  const val = record[fieldName];
  if (!hasVal(val) || isScalar(val)) return null;
  const rows = [];
  Object.entries(val).filter(([, v]) => hasVal(v)).forEach(([k, v]) => objectRows(humanizeKey(k), v, 0, rows));
  if (rows.length === 0) return null;
  return (
    <View style={styles.fieldContainer} wrap={rows.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.map((r, i) => {
        if (r.kind === 'label') return <Text key={i} style={[styles.subSectionTitle, { paddingLeft: 4 + r.depth * 8 }]}>{r.text}</Text>;
        if (r.kind === 'item') return <Text key={i} style={[styles.listItem, { paddingLeft: 12 + r.depth * 8 }]}>{r.num}. {r.text}</Text>;
        return <Text key={i} style={[styles.nestedLeaf, { paddingLeft: 12 + r.depth * 8 }]}>{r.text}</Text>;
      })}
    </View>
  );
};

const CareCoordinationPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.care_coordination) return Array.isArray(r.care_coordination) ? r.care_coordination : [r.care_coordination];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.care_coordination) return Array.isArray(dd.care_coordination) ? dd.care_coordination : [dd.care_coordination]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Care Coordination</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Care Coordination</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Care Coordination ${idx + 1}`}</Text>
              {record.referralDate && <Text style={styles.recordMeta}>Referral Date: {formatDate(record.referralDate)}</Text>}
            </View>
            {renderStringGroup('Referral Information', ['referralSource', 'referralDestination', 'referralReason', 'transitionType', 'careCoordinator'], record)}
            {renderArrayGroup('Primary Diagnoses', 'primaryDiagnoses', record)}
            {renderArrayGroup('Active Medications', 'activeMedications', record)}
            {renderArrayGroup('Discharge Medications', 'dischargeMedications', record)}
            {renderStringGroup('Functional Status', ['functionalStatus', 'cognitiveStatus', 'mobilityLevel', 'fallRiskAssessment'], record)}
            {renderArrayGroup('Follow-Up Appointments', 'followUpAppointments', record)}
            {renderArrayGroup('Pending Tests', 'pendingTests', record)}
            {renderArrayGroup('Medical Equipment', 'medicalEquipmentNeeds', record)}
            {renderArrayGroup('Patient Education', 'patientEducationProvided', record)}
            {renderObjectGroup('Home Health Services', 'homeHealthServices', record)}
            {renderObjectGroup('Caregiver Information', 'caregiverInformation', record)}
            {renderObjectGroup('Advance Directives', 'advanceDirectives', record)}
            {renderObjectGroup('Social Determinants', 'socialDeterminants', record)}
            {renderStringGroup('Administrative', ['insuranceAuthorization', 'readmissionRiskScore', 'languageBarriers', 'culturalConsiderations'], record)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CareCoordinationPDFTemplate;

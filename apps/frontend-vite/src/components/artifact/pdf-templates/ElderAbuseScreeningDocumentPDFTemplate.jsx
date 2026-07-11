/**
 * ElderAbuseScreeningDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — config-driven, mirrors the JSX SECTION_FIELDS
 * exactly (JSX/PDF parity 6a4bb189). Enum-canonical + hide-zero mirror; sentence/parseLabel/comma-split.
 * Collection: elder_abuse_screening
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { paddingBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 1.4, marginBottom: 3, paddingLeft: 8, color: '#000000' },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

/* ═══ SCHEMA (mirror of the JSX) ═══ */
const SECTION_TITLES = {
  'screening-info': 'Screening Information',
  'abuse-indicators': 'Abuse Indicators',
  'injury-assessment': 'Injury Assessment',
  'caregiver-concerns': 'Caregiver Concerns',
  'patient-status': 'Patient Status',
  'perpetrator-info': 'Perpetrator Information',
  'patient-disclosure': 'Patient Disclosure',
  'reporting-safety': 'Reporting & Safety',
};
const FIELD_LABELS = {
  date: 'Date', screeningToolUsed: 'Screening Tool Used', screeningIndicator: 'Screening Indicator', screeningScore: 'Screening Score',
  physicalAbuseIndicators: 'Physical Abuse Indicators', emotionalAbuseIndicators: 'Emotional Abuse Indicators', sexualAbuseIndicators: 'Sexual Abuse Indicators', financialExploitationIndicators: 'Financial Exploitation Indicators', neglectIndicators: 'Neglect Indicators', selfNeglectPresent: 'Self-Neglect Present',
  unexplainedInjuryDescription: 'Unexplained Injury Description', injuryPatternSuspicious: 'Injury Pattern Suspicious',
  caregiverBehaviorConcerns: 'Caregiver Behavior Concerns', patientFearfulOfCaregiver: 'Patient Fearful of Caregiver',
  cognitiveStatusAtScreening: 'Cognitive Status at Screening', functionalDependencyLevel: 'Functional Dependency Level', socialIsolationPresent: 'Social Isolation Present', environmentalHazardsNoted: 'Environmental Hazards Noted', medicationHoardingOrWithholding: 'Medication Hoarding or Withholding',
  allegedPerpetratorRelationship: 'Alleged Perpetrator Relationship', perpetratorRiskFactors: 'Perpetrator Risk Factors',
  patientDisclosureStatement: 'Patient Disclosure Statement',
  mandatoryReportFiled: 'Mandatory Report Filed', reportingAgencyName: 'Reporting Agency Name', safetyPlanInitiated: 'Safety Plan Initiated', referralsMade: 'Referrals Made',
};
const SECTION_FIELDS = {
  'screening-info': ['date', 'screeningToolUsed', 'screeningIndicator', 'screeningScore'],
  'abuse-indicators': ['physicalAbuseIndicators', 'emotionalAbuseIndicators', 'sexualAbuseIndicators', 'financialExploitationIndicators', 'neglectIndicators', 'selfNeglectPresent'],
  'injury-assessment': ['unexplainedInjuryDescription', 'injuryPatternSuspicious'],
  'caregiver-concerns': ['caregiverBehaviorConcerns', 'patientFearfulOfCaregiver'],
  'patient-status': ['cognitiveStatusAtScreening', 'functionalDependencyLevel', 'socialIsolationPresent', 'environmentalHazardsNoted', 'medicationHoardingOrWithholding'],
  'perpetrator-info': ['allegedPerpetratorRelationship', 'perpetratorRiskFactors'],
  'patient-disclosure': ['patientDisclosureStatement'],
  'reporting-safety': ['mandatoryReportFiled', 'reportingAgencyName', 'safetyPlanInitiated', 'referralsMade'],
};
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['screeningScore'];
const ARRAY_FIELDS = ['physicalAbuseIndicators', 'emotionalAbuseIndicators', 'sexualAbuseIndicators', 'financialExploitationIndicators', 'neglectIndicators', 'caregiverBehaviorConcerns', 'environmentalHazardsNoted', 'perpetratorRiskFactors', 'referralsMade'];
const SENTENCE_FIELDS = ['patientDisclosureStatement'];
const ENUM_OPTIONS = {
  screeningToolUsed: ['Elder Abuse Suspicion Index (EASI)', 'Elder Assessment Instrument (EAI)', 'Hwalek-Sengstock Elder Abuse Screening Test (H-S/EAST)', 'Vulnerability to Abuse Screening Scale (VASS)', 'Brief Abuse Screen for the Elderly (BASE)', 'Caregiver Abuse Screen (CASE)'],
  screeningIndicator: ['Routine', 'Targeted', 'Follow-Up', 'Reported Concern'],
  cognitiveStatusAtScreening: ['Normal', 'Mild Impairment', 'Moderate Impairment', 'Severe Impairment'],
  functionalDependencyLevel: ['Independent', 'Partially Dependent', 'Fully Dependent'],
  allegedPerpetratorRelationship: ['Spouse/Partner', 'Adult Child', 'Other Family Member', 'Paid Caregiver', 'Friend/Neighbor', 'Facility Staff', 'Other', 'N/A - No abuse suspected'],
};
const ENUM_FIELDS = Object.keys(ENUM_OPTIONS);
const MEANINGFUL_ZERO_FIELDS = ['screeningScore'];
const enumCanonical = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; const hit = base.find(o => o.toLowerCase() === String(cur ?? '').toLowerCase()); return hit || cur; };

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const numericShows = (fn, v) => { if (v === null || v === undefined || v === '') return false; const n = Number(v); if (Number.isNaN(n)) return false; if (n === 0) return MEANINGFUL_ZERO_FIELDS.includes(fn); return true; };

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,80}?):\s+([\s\S]*)/);
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

/* buildValueRows: decompose a narrative value — labeled sentence → subtitle + comma rows (≥2),
   unlabeled sentence → one row (kept whole). Mirrors the JSX formatSentenceFieldLines. */
const buildValueRows = (text) => {
  const rows = []; let n = 1;
  const strip = (x) => x.replace(/[;.]+$/, '').trim();
  splitBySentence(fmtVal(text)).forEach(s => {
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

/* fieldInner: the label + value node(s) for ONE visible field (or null). Single-name gated. */
const fieldInner = (record, sid, fn) => {
  const label = FIELD_LABELS[fn] || fn;
  const title = SECTION_TITLES[sid];
  const showLabel = label.toLowerCase() !== (title || '').toLowerCase();
  const val = record[fn];
  if (NUMBER_FIELDS.includes(fn)) { if (!numericShows(fn, val)) return null; }
  else if (ARRAY_FIELDS.includes(fn)) { if (!Array.isArray(val) || val.length === 0) return null; }
  else if (!hasVal(val)) return null;

  const nodes = [];
  if (showLabel) nodes.push(<Text key="l" style={styles.fieldLabel}>{label}</Text>);
  if (DATE_FIELDS.includes(fn)) {
    nodes.push(<Text key="v" style={styles.fieldValue}>1. {formatDate(val)}</Text>);
  } else if (ENUM_FIELDS.includes(fn)) {
    nodes.push(<Text key="v" style={styles.fieldValue}>1. {safeString(enumCanonical(fn, fmtVal(val)))}</Text>);
  } else if (ARRAY_FIELDS.includes(fn)) {
    val.forEach((item, i) => nodes.push(<Text key={`a${i}`} style={styles.listItem}>{i + 1}. {safeString(typeof item === 'object' ? JSON.stringify(item) : String(item))}</Text>));
  } else if (SENTENCE_FIELDS.includes(fn)) {
    buildValueRows(val).forEach((row, i) => nodes.push(row.type === 'subtitle'
      ? <Text key={`s${i}`} style={styles.nestedSubtitle}>{row.text}</Text>
      : <Text key={`s${i}`} style={styles.listItem}>{row.num}. {row.text}</Text>));
  } else {
    nodes.push(<Text key="v" style={styles.fieldValue}>1. {safeString(fmtVal(val))}</Text>);
  }
  return nodes;
};

/* renderSection: section title rides inside the first visible field's glue box (anti-orphan). */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const visible = [];
  fields.forEach(fn => { const inner = fieldInner(record, sid, fn); if (inner) visible.push({ fn, inner }); });
  if (visible.length === 0) return null;
  return (
    <View key={sid} style={styles.section} wrap={visible.length > 8 ? true : false}>
      {visible.map((v, i) => (
        <View key={v.fn} style={styles.fieldBox} wrap={false}>
          {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
          {v.inner}
        </View>
      ))}
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const ElderAbuseScreeningDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.elder_abuse_screening) return Array.isArray(r.elder_abuse_screening) ? r.elder_abuse_screening : [r.elder_abuse_screening];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.elder_abuse_screening) return Array.isArray(dd.elder_abuse_screening) ? dd.elder_abuse_screening : [dd.elder_abuse_screening]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Elder Abuse Screening</Text></View>
        <Text style={styles.emptyState}>No records available</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Elder Abuse Screening</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Elder Abuse Screening ${idx + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ElderAbuseScreeningDocumentPDFTemplate;

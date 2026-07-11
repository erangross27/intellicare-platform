/**
 * EmploymentCounselingDocumentPDFTemplate.jsx
 * July 2026 — box-free canonical — LETTER — BLACK & WHITE ONLY (#000000)
 * Collection: employment_counseling. Mirrors EmploymentCounselingDocument.jsx (4-area rule):
 * numbered value rows, single-name gate, enum canonical display, paren-aware [.;] sentence split,
 * labeled + unlabeled(≥3) comma split, section title rides INSIDE the first field's glue View,
 * per-field wrap={false} anti-orphan, break={idx>0}.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { paddingBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 6 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldGroup: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 1 },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ═══════ CONFIG (mirror JSX) ═══════ */
const SECTION_TITLES = {
  'capacity-assessment': 'Capacity Assessment',
  'job-analysis': 'Job Analysis',
  'return-to-work': 'Return to Work',
  'limitations': 'Limitations & Accommodations',
  'disability-status': 'Disability Status',
  'cognitive': 'Cognitive Assessment',
};
const FIELD_LABELS = {
  functionalCapacityEvaluation: 'Functional Capacity Evaluation',
  workCapacityScore: 'Work Capacity Score',
  workHardnessLevel: 'Work Hardness Level',
  modifiedDutyCapacity: 'Modified Duty Capacity',
  jobTaskAnalysis: 'Job Task Analysis',
  ergonomicAssessmentFindings: 'Ergonomic Assessment Findings',
  workRelatedStressFactors: 'Work-Related Stress Factors',
  returnToWorkTimeline: 'Return to Work Timeline',
  medicalStabilityDate: 'Medical Stability Date',
  vocationalRehabilitationEligibility: 'Vocational Rehabilitation Eligibility',
  workConditioningProgram: 'Work Conditioning Program',
  workRelatedLimitations: 'Work-Related Limitations',
  adaAccommodationNeeds: 'ADA Accommodation Needs',
  jobModificationRequirements: 'Job Modification Requirements',
  occupationalTherapyRecommendations: 'Occupational Therapy Recommendations',
  permanentPartialDisabilityRating: 'Permanent Partial Disability Rating',
  socialSecurityDisabilityStatus: 'Social Security Disability Status',
  workersCompensationStatus: 'Workers Compensation Status',
  transferableSkillsAssessment: 'Transferable Skills Assessment',
  cognitiveAssessmentResults: 'Cognitive Assessment Results',
};
const SECTION_FIELDS = {
  'capacity-assessment': ['functionalCapacityEvaluation', 'workCapacityScore', 'workHardnessLevel', 'modifiedDutyCapacity'],
  'job-analysis': ['jobTaskAnalysis', 'ergonomicAssessmentFindings', 'workRelatedStressFactors'],
  'return-to-work': ['returnToWorkTimeline', 'medicalStabilityDate', 'vocationalRehabilitationEligibility', 'workConditioningProgram'],
  'limitations': ['workRelatedLimitations', 'adaAccommodationNeeds', 'jobModificationRequirements', 'occupationalTherapyRecommendations'],
  'disability-status': ['permanentPartialDisabilityRating', 'socialSecurityDisabilityStatus', 'workersCompensationStatus', 'transferableSkillsAssessment'],
  'cognitive': ['cognitiveAssessmentResults'],
};
const NUMBER_FIELDS = ['workCapacityScore', 'permanentPartialDisabilityRating'];
const BOOLEAN_FIELDS = ['vocationalRehabilitationEligibility'];
const ARRAY_FIELDS = ['workRelatedLimitations', 'adaAccommodationNeeds', 'occupationalTherapyRecommendations', 'workRelatedStressFactors', 'jobModificationRequirements'];
const DATE_FIELDS = ['medicalStabilityDate'];
const ENUM_FIELDS = { workHardnessLevel: ['Sedentary', 'Light', 'Medium', 'Heavy', 'Very Heavy'] };
const SENTENCE_FIELDS = ['functionalCapacityEvaluation', 'modifiedDutyCapacity', 'jobTaskAnalysis', 'ergonomicAssessmentFindings', 'returnToWorkTimeline', 'workConditioningProgram', 'socialSecurityDisabilityStatus', 'workersCompensationStatus', 'transferableSkillsAssessment', 'cognitiveAssessmentResults'];

/* ═══════ UTILS ═══════ */
const formatDate = (d) => {
  if (!d) return '';
  try {
    const date = new Date(d.$date || d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(d); }
};
const enumCanonical = (options, current) => {
  if (current === null || current === undefined || String(current).trim() === '') return '';
  const c = String(current).trim().toLowerCase();
  const match = (options || []).find(o => o.toLowerCase() === c);
  return match || String(current).trim();
};
const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
  return true;
};
const safeString = (v) => (v === null || v === undefined) ? '' : (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
/* paren-aware sentence split: top-level (depth 0) [.;] + whitespace; abbrev-guarded '.'; keeps /[.;]/ */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const ABBR = /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/i;
  const parts = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; continue; }
    if (depth === 0 && /[.;]/.test(ch)) {
      const next = text[i + 1];
      const boundary = next === undefined || /\s/.test(next);
      const abbrev = ch === '.' && ABBR.test(current);
      if (boundary && !abbrev) { const t = current.trim(); if (t) parts.push(t); current = ''; continue; }
    }
    current += ch;
  }
  const t = current.trim(); if (t) parts.push(t);
  return parts.map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
/* paren-aware comma split with Oxford (and/or) + numeric ($18,000) guards */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      const between = /\d$/.test(cur) && /^\d/.test(rest);
      if (/^(and|or)\b/i.test(rest) || between) { cur += ch; }
      else { const t = cur.trim(); if (t) out.push(t); cur = ''; }
    }
    else { cur += ch; }
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length > 0 ? out : [text];
};
const dispVal = (fn, v) => ENUM_FIELDS[fn] ? (enumCanonical(ENUM_FIELDS[fn], v) || safeString(v)) : safeString(v);

const fieldPresent = (record, fn) => {
  const v = record[fn];
  if (ARRAY_FIELDS.includes(fn)) return Array.isArray(v) && v.filter(x => String(x).trim() !== '').length > 0;
  return hasVal(v);
};

/* rows for a field → array of {sub?} | {value} (mirror the JSX + copy numbering) */
const fieldRows = (record, fn) => {
  const val = record[fn];
  const rows = [];
  if (ARRAY_FIELDS.includes(fn)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    items.forEach((item, i) => rows.push({ value: `${i + 1}. ${safeString(item)}` }));
  } else if (SENTENCE_FIELDS.includes(fn)) {
    let n = 1;
    splitBySentence(safeString(val)).forEach(s => {
      const parsed = parseLabel(s);
      if (parsed.isLabeled) {
        rows.push({ sub: parsed.label });
        const parts = splitByComma(parsed.value);
        if (parts.length >= 2) parts.forEach(p => rows.push({ value: `${n++}. ${p}` }));
        else rows.push({ value: `${n++}. ${parsed.value}` });
      } else {
        const parts = splitByComma(s);
        if (parts.length >= 3) parts.forEach(p => rows.push({ value: `${n++}. ${p}` }));
        else rows.push({ value: `${n++}. ${s}` });
      }
    });
  } else if (DATE_FIELDS.includes(fn)) {
    rows.push({ value: `1. ${formatDate(val)}` });
  } else {
    rows.push({ value: `1. ${dispVal(fn, val)}` });
  }
  return rows;
};

/* one field = one glue View (anti-orphan). sectionTitle rides on the first present field. single-name gate. */
const renderField = (record, fn, sectionTitle) => {
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = label !== sectionTitle;
  const rows = fieldRows(record, fn);
  return (
    <View key={fn} style={styles.fieldGroup} wrap={rows.length > 22 ? true : false}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {rows.map((r, i) => r.sub
        ? <Text key={i} style={styles.fieldLabel}>{r.sub}</Text>
        : <Text key={i} style={styles.fieldValue}>{r.value}</Text>)}
    </View>
  );
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => fieldPresent(record, f));
  if (present.length === 0) return null;
  const title = SECTION_TITLES[sid];
  return present.map((f, i) => renderField(record, f, i === 0 ? title : null));
};

/* ═══════ MAIN ═══════ */
const EmploymentCounselingDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.employment_counseling) return Array.isArray(r.employment_counseling) ? r.employment_counseling : [r.employment_counseling];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.employment_counseling) return Array.isArray(dd.employment_counseling) ? dd.employment_counseling : [dd.employment_counseling];
        return [dd];
      }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  const DOC_TITLE = 'Employment Counseling';

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
          <Text style={styles.noDataText}>No employment counseling records available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`${DOC_TITLE} ${idx + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default EmploymentCounselingDocumentPDFTemplate;

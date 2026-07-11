/**
 * SyphilisTreatmentFollowUpDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — syphilis treatment follow-up
 * Collection: syphilis_treatment_follow_up
 * NO BLUE COLORS (#606060/#9a9a9a/#bcbcbc BANNED) — #000000/#333333/#cccccc/#f5f5f5 ONLY
 * Rule #74: sectionTitle rendered INSIDE the first present field's View (no orphan siblings).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#333333', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* hide-zero: numeric "not recorded" (0) hidden unless doctor-edited */
const numberShowsPDF = (record, key) => {
  const val = record[key];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* renderFieldRow: optional sectionTitle inside the View (Rule #74) */
const renderFieldRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateRow: date field with sectionTitle support (Rule #74) */
const renderDateRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split — duplicate label suppression */
const renderSentenceSection = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Staging & Serology',
    fields: [
      { key: 'syphilisStage', label: 'Syphilis Stage', isSentence: true },
      { key: 'initialRprTiter', label: 'Initial RPR Titer', isSentence: true },
      { key: 'followUpRprTiter', label: 'Follow-Up RPR Titer', isSentence: true },
      { key: 'vdrlTiter', label: 'VDRL Titer', isSentence: true },
      { key: 'fourFoldTiterDecline', label: 'Four-Fold Titer Decline', isBoolean: true },
      { key: 'titerDeclinePercentage', label: 'Titer Decline (%)', isNumber: true },
      { key: 'serofastState', label: 'Serofast State', isBoolean: true },
    ],
  },
  {
    title: 'Treatment',
    fields: [
      { key: 'treatmentRegimen', label: 'Treatment Regimen', isSentence: true },
      { key: 'penicillinDosesCompleted', label: 'Penicillin Doses Completed', isNumber: true },
      { key: 'jarischHerxheimerReaction', label: 'Jarisch-Herxheimer Reaction', isBoolean: true },
    ],
  },
  {
    title: 'Neurosyphilis / CSF',
    fields: [
      { key: 'lumbarPunctureDate', label: 'Lumbar Puncture Date', isDate: true },
      { key: 'csfVdrlResult', label: 'CSF VDRL Result', isSentence: true },
      { key: 'csfProteinLevel', label: 'CSF Protein (mg/dL)', isNumber: true },
      { key: 'csfWhiteCellCount', label: 'CSF White Cell Count (cells/uL)', isNumber: true },
    ],
  },
  {
    title: 'HIV & Special Populations',
    fields: [
      { key: 'hivCoinfectionStatus', label: 'HIV Co-Infection Status', isSentence: true },
      { key: 'cd4CountAtTreatment', label: 'CD4 Count (cells/mm3)', isNumber: true },
      { key: 'ophthalmicExamFindings', label: 'Ophthalmic Exam Findings', isSentence: true },
      { key: 'otologicSymptomResolution', label: 'Otologic Symptom Resolution', isBoolean: true },
      { key: 'partnerNotificationStatus', label: 'Partner Notification Status', isSentence: true },
      { key: 'pregnancyStatus', label: 'Pregnancy Status', isSentence: true },
    ],
  },
  {
    title: 'Response & Follow-Up',
    fields: [
      { key: 'clinicalSymptomResolution', label: 'Clinical Symptom Resolution', isBoolean: true },
      { key: 'treatmentFailureCriteria', label: 'Treatment Failure Criteria', isBoolean: true },
      { key: 'retreatmentIndicated', label: 'Retreatment Indicated', isBoolean: true },
      { key: 'followUpIntervalMonths', label: 'Follow-Up Interval (months)', isNumber: true },
      { key: 'nextScheduledFollowUp', label: 'Next Scheduled Follow-Up', isDate: true },
    ],
  },
];

/* field presence respecting hide-zero + boolean + date */
const fieldPresent = (record, field) => {
  if (field.isNumber) return numberShowsPDF(record, field.key);
  if (field.isBoolean) return typeof record[field.key] === 'boolean';
  return hasVal(record[field.key]);
};

const renderField = (record, field, sectionTitle, key) => {
  const val = record[field.key];
  if (field.isDate) return <View key={key}>{renderDateRow(field.label, val, sectionTitle)}</View>;
  if (field.isSentence) return <View key={key}>{renderSentenceSection(field.label, val, sectionTitle)}</View>;
  return <View key={key}>{renderFieldRow(field.label, val, sectionTitle)}</View>;
};

/* ======= COMPONENT ======= */
const SyphilisTreatmentFollowUpDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.syphilis_treatment_follow_up) return Array.isArray(r.syphilis_treatment_follow_up) ? r.syphilis_treatment_follow_up : [r.syphilis_treatment_follow_up];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.syphilis_treatment_follow_up) return Array.isArray(dd.syphilis_treatment_follow_up) ? dd.syphilis_treatment_follow_up : [dd.syphilis_treatment_follow_up]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Syphilis Treatment Follow-Up</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Syphilis Treatment Follow-Up</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {`Syphilis Treatment Follow-Up ${index + 1}`}
              </Text>
            </View>

            {/* Sections — sectionTitle rendered inside the first present field (Rule #74) */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => fieldPresent(record, f));
              if (presentFields.length === 0) return null;

              return (
                <View key={sIdx} style={styles.section} wrap={presentFields.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                  {presentFields.map((field, fIdx) =>
                    renderField(record, field, null, fIdx)
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SyphilisTreatmentFollowUpDocumentPDFTemplate;

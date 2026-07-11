/**
 * CaregiverSupportGroupsDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — caregiver support groups
 * Collection: caregiver_support_groups
 * NO BLUE COLORS (#606060/#9a9a9a/#bcbcbc BANNED) — #000000/#333333/#cccccc/#f5f5f5 ONLY
 * Rule #74: sectionTitle rendered INSIDE the first present field's View (no orphan siblings).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* Box-free line-based layout (mirrors user-approved ConsultationNotes style):
   underline under section titles (1pt black) and field sub-labels (0.5pt gray);
   bigger fonts (page 15 / title 26 / record 19 / section 16 / labels 12 / values 14). */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 15, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 3, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 16, color: '#333333', textAlign: 'center', marginTop: 40 },
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

/* splitByComma: top-level commas only — NOT inside parentheses, NOT when "and"/"or"
   sits right before or right after the comma, NOT without a following space ("$18,000") */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      if (!/\s/.test(text[i + 1] || '')) { current += ch; continue; }
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: optional sectionTitle inside the View (Rule #74); every value numbered */
const renderFieldRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.listItem}>1. {safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split — duplicate label suppression */
const renderSentenceSection = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let plainN = 0;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach((ci, gi) => { rows.push({ type: 'item', text: safeString(ci), num: gi + 1 }); });
        return;
      }
    }
    rows.push({ type: 'item', text: safeString(s), num: ++plainN });
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

/* renderArrayField */
const renderArrayFieldPDF = (label, items, sectionTitle) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Caregiver Burden Scores',
    fields: [
      { key: 'caregiverBurdenInventoryScore', label: 'Caregiver Burden Inventory Score', isNumber: true },
      { key: 'caregiverDepressionScale', label: 'Depression Scale', isNumber: true },
      { key: 'caregiverStressScale', label: 'Stress Scale', isNumber: true },
      { key: 'caregiverSleepQuality', label: 'Caregiver Sleep Quality', isSentence: true },
      { key: 'caregiverPhysicalHealthStatus', label: 'Caregiver Physical Health Status', isSentence: true },
    ],
  },
  {
    title: 'Care Demands',
    fields: [
      { key: 'hoursOfCarePerWeek', label: 'Hours of Care/Week', isNumber: true },
      { key: 'dailyLivingActivitiesScore', label: 'ADL Score', isNumber: true },
      { key: 'medicationManagementComplexity', label: 'Medication Management Complexity', isNumber: true },
      { key: 'functionalDeclineRate', label: 'Functional Decline Rate', isSentence: true },
      { key: 'cognitiveImpairmentSeverity', label: 'Cognitive Impairment Severity', isSentence: true },
      { key: 'behavioralDisturbancesPresent', label: 'Behavioral Disturbances Present', isBoolean: true },
    ],
  },
  {
    title: 'Patient & Relationship',
    fields: [
      { key: 'patientDiagnosisPrimary', label: 'Patient Primary Diagnosis', isSentence: true },
      { key: 'caregiverRelationshipToPatient', label: 'Caregiver Relationship to Patient', isSentence: true },
      { key: 'socialSupportNetwork', label: 'Social Support Network', isSentence: true },
      { key: 'financialStrainLevel', label: 'Financial Strain Level', isSentence: true },
    ],
  },
  {
    title: 'Support & Planning',
    fields: [
      { key: 'groupSessionAttendance', label: 'Group Session Attendance', isNumber: true },
      { key: 'respiteCareUtilization', label: 'Respite Care Utilization', isBoolean: true },
      { key: 'emergencyPreparedness', label: 'Emergency Preparedness', isBoolean: true },
      { key: 'careTransitionPlanning', label: 'Care Transition Planning', isBoolean: true },
    ],
  },
  {
    title: 'Education & Coping',
    fields: [
      { key: 'caregiverEducationNeeds', label: 'Caregiver Education Needs', isArray: true },
      { key: 'copingStrategiesUsed', label: 'Coping Strategies Used', isArray: true },
    ],
  },
];

/* field presence respecting hide-zero + boolean */
const fieldPresent = (record, field) => {
  if (field.isNumber) return numberShowsPDF(record, field.key);
  if (field.isBoolean) return typeof record[field.key] === 'boolean';
  return hasVal(record[field.key]);
};

const renderField = (record, field, sectionTitle, key) => {
  const val = record[field.key];
  if (field.isArray) return <View key={key}>{renderArrayFieldPDF(field.label, val, sectionTitle)}</View>;
  if (field.isSentence) return <View key={key}>{renderSentenceSection(field.label, val, sectionTitle)}</View>;
  return <View key={key}>{renderFieldRow(field.label, val, sectionTitle)}</View>;
};

/* ======= COMPONENT ======= */
const CaregiverSupportGroupsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.caregiver_support_groups) return Array.isArray(r.caregiver_support_groups) ? r.caregiver_support_groups : [r.caregiver_support_groups];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.caregiver_support_groups) return Array.isArray(dd.caregiver_support_groups) ? dd.caregiver_support_groups : [dd.caregiver_support_groups]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Caregiver Support Groups</Text>
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
          <Text style={styles.documentTitle}>Caregiver Support Groups</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {`Caregiver Support Groups ${index + 1}`}
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

export default CaregiverSupportGroupsDocumentPDFTemplate;

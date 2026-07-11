/**
 * AnesthesiaConsentDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — anesthesia consent
 * Collection: anesthesia_consent
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 13, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 23, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 12, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 13, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 13, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 40 },
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

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).trimStart();
      if (/^\d{4}\b/.test(rest)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox. leadingTitle (anti-orphan) rides INSIDE
   this box so the section title can never break away from its first field. */
const renderFieldRow = (label, value, showLabel = true, leadingTitle = null) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={leadingTitle ? false : undefined}>
      {leadingTitle && <Text style={styles.sectionTitle}>{leadingTitle}</Text>}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value, showLabel = true, leadingTitle = null) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={leadingTitle ? false : undefined}>
      {leadingTitle && <Text style={styles.sectionTitle}>{leadingTitle}</Text>}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text, showLabel = true, leadingTitle = null) => {
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
      {leadingTitle && <Text style={styles.sectionTitle}>{leadingTitle}</Text>}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
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
const renderArrayFieldPDF = (label, items, showLabel = true, leadingTitle = null) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {leadingTitle && <Text style={styles.sectionTitle}>{leadingTitle}</Text>}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Record Information',
    fields: [
      { key: 'anesthesiologist', label: 'Anesthesiologist', isSentence: true },
      { key: 'anesthesiologistLicenseNumber', label: 'Anesthesiologist License Number', isSentence: true },
      { key: 'asaClassification', label: 'ASA Classification', isSentence: true },
      { key: 'anesthesiaType', label: 'Anesthesia Type', isSentence: true },
      { key: 'scheduledProcedure', label: 'Scheduled Procedure', isSentence: true },
    ],
  },
  {
    title: 'Risks & Alternatives',
    fields: [
      { key: 'risksDisclosed', label: 'Risks Disclosed', isArray: true },
      { key: 'alternativesDiscussed', label: 'Alternatives Discussed', isArray: true },
    ],
  },
  {
    title: 'Patient History',
    fields: [
      { key: 'npoDuration', label: 'NPO Duration', isSentence: true },
      { key: 'lastOralIntake', label: 'Last Oral Intake', isSentence: true },
      { key: 'allergiesDisclosed', label: 'Allergies Disclosed', isArray: true },
      { key: 'previousAnesthesiaComplications', label: 'Previous Anesthesia Complications', isBoolean: true },
      { key: 'complicationDetails', label: 'Complication Details', isSentence: true },
      { key: 'familyHistoryMalignantHyperthermia', label: 'Family History Malignant Hyperthermia', isBoolean: true },
    ],
  },
  {
    title: 'Airway Assessment',
    fields: [
      { key: 'difficultAirwayAnticipated', label: 'Difficult Airway Anticipated', isBoolean: true },
      { key: 'airwayAssessmentFindings', label: 'Airway Assessment Findings', isSentence: true },
    ],
  },
  {
    title: 'Anesthesia Plan',
    fields: [
      { key: 'regionalAnesthesiaTechnique', label: 'Regional Anesthesia Technique', isSentence: true },
      { key: 'bloodTransfusionConsent', label: 'Blood Transfusion Consent', isBoolean: true },
      { key: 'postoperativePainManagementDiscussed', label: 'Postoperative Pain Management Discussed', isBoolean: true },
    ],
  },
  {
    title: 'Consent Details',
    fields: [
      { key: 'consentGivenBy', label: 'Consent Given By', isSentence: true },
      { key: 'relationshipToPatient', label: 'Relationship to Patient', isSentence: true },
      { key: 'witnessName', label: 'Witness Name', isSentence: true },
      { key: 'consentSignatureDateTime', label: 'Consent Signature Date/Time', isDate: true },
      { key: 'patientQuestionsAnswered', label: 'Patient Questions Answered', isBoolean: true },
      { key: 'interpreterUsed', label: 'Interpreter Used', isBoolean: true },
      { key: 'interpreterLanguage', label: 'Interpreter Language', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const AnesthesiaConsentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.anesthesia_consent) return Array.isArray(r.anesthesia_consent) ? r.anesthesia_consent : [r.anesthesia_consent];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.anesthesia_consent) return Array.isArray(dd.anesthesia_consent) ? dd.anesthesia_consent : [dd.anesthesia_consent]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Anesthesia Consent</Text>
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
          <Text style={styles.documentTitle}>Anesthesia Consent</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {record.date && (
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                {`Anesthesia Consent ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => hasVal(record[f.key]));
              if (!hasAnyVal) return null;

              /* Section title rides INSIDE the first present field's wrap View (anti-orphan);
                 never a standalone <Text> sibling that could break to its own page bottom. */
              const presentFields = sectionConfig.fields.filter(f => hasVal(record[f.key]));

              return (
                <View key={sIdx} style={styles.section}>
                  {presentFields.map((field, fIdx) => {
                    const val = record[field.key];
                    const showFieldLabel = field.label.toLowerCase() !== (sectionConfig.title || '').toLowerCase();
                    const leadingTitle = fIdx === 0 ? sectionConfig.title : null;

                    if (field.isBoolean) return <View key={field.key}>{renderFieldRow(field.label, val ? 'Yes' : 'No', showFieldLabel, leadingTitle)}</View>;
                    if (field.isDate) return <View key={field.key}>{renderDateFieldPDF(field.label, val, showFieldLabel, leadingTitle)}</View>;
                    if (field.isArray) return <View key={field.key}>{renderArrayFieldPDF(field.label, val, showFieldLabel, leadingTitle)}</View>;
                    if (field.isSentence) return <View key={field.key}>{renderSentenceSection(field.label, val, showFieldLabel, leadingTitle)}</View>;
                    return <View key={field.key}>{renderFieldRow(field.label, val, showFieldLabel, leadingTitle)}</View>;
                  })}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AnesthesiaConsentDocumentPDFTemplate;

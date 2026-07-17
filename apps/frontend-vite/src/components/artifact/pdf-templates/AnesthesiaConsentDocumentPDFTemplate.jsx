/**
 * AnesthesiaConsentDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — A4 — anesthesia consent
 * Collection: anesthesia_consent
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: 'Helvetica', fontSize: 13, lineHeight: 1.35, backgroundColor: '#ffffff', color: '#111827' },
  documentHeader: { marginBottom: 10 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#0f172a', paddingBottom: 9, borderBottom: '2pt solid #000000', marginBottom: 10 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#1e3a8a' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1d4ed8', paddingBottom: 5, borderBottom: '1pt solid #000000', marginBottom: 6 },
  fieldBox: { marginBottom: 6 },
  fieldLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1e3a8a', paddingBottom: 3, borderBottom: '0.5pt solid #999999', marginBottom: 3 },
  fieldValue: { fontSize: 13, color: '#111827' },
  listItem: { fontSize: 13, color: '#111827', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#334155', marginTop: 2, marginBottom: 2 },
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

const STRING_FIELDS = ['anesthesiaType', 'scheduledProcedure', 'anesthesiologist', 'anesthesiologistLicenseNumber', 'asaClassification', 'npoDuration', 'lastOralIntake', 'complicationDetails', 'airwayAssessmentFindings', 'regionalAnesthesiaTechnique', 'consentGivenBy', 'relationshipToPatient', 'interpreterLanguage', 'witnessName'];
const COMMA_SPLIT_FIELDS = new Set(['airwayAssessmentFindings']);
const SEMICOLON_SPLIT_FIELDS = new Set(STRING_FIELDS);
const SEMICOLON_SEPARATOR = /;\s+/;

const stripDelims = (text) => {
  if (text === null || text === undefined) return '';
  return String(text).replace(/^[\s.;,]+/, '').replace(/[\s.;,]+$/, '').trim();
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    const boundary = ch === '.' && depth === 0 && (i + 1 >= text.length || /\s/.test(text[i + 1]));
    if (boundary) {
      if (/\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/.test(current)) { current += ch; continue; }
      const value = stripDelims(current); if (value) result.push(value); current = '';
      while (i + 1 < text.length && /\s/.test(text[i + 1])) i++;
    } else current += ch;
  }
  const value = stripDelims(current); if (value) result.push(value);
  return result;
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: stripDelims(m[2]) };
  return { isLabeled: false, label: '', value: text };
};

const splitOnChar = (text, separator) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === separator && depth === 0) {
      if (separator === ',' && /\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || '')) { current += ch; continue; }
      const t = stripDelims(current); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = stripDelims(current); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const segmentSentence = (sentence, fieldName) => {
  const semicolonItems = SEMICOLON_SPLIT_FIELDS.has(fieldName) && SEMICOLON_SEPARATOR.test(sentence) ? splitOnChar(sentence, ';') : [sentence];
  if (semicolonItems.length >= 2) return { label: null, items: semicolonItems };
  const parsed = parseLabel(sentence);
  const base = parsed.isLabeled ? parsed.value : sentence;
  const commaItems = COMMA_SPLIT_FIELDS.has(fieldName) ? splitOnChar(base, ',') : [stripDelims(base)];
  return { label: parsed.isLabeled ? parsed.label : null, items: commaItems };
};

const buildUnits = (value, fieldName) => {
  const units = [];
  splitBySentence(String(value || '')).forEach(sentence => {
    const { label, items } = segmentSentence(sentence, fieldName);
    const rows = items.map(stripDelims).filter(Boolean);
    const previous = units[units.length - 1];
    if (!label && previous && !previous.label) previous.rows.push(...rows);
    else units.push({ label, rows });
  });
  return units;
};

/* renderFieldRow: label + value inside fieldBox. leadingTitle (anti-orphan) rides INSIDE
   this box so the section title can never break away from its first field. */
const renderFieldRow = (label, value, showLabel = true, leadingTitle = null) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
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
    <View style={styles.fieldBox} wrap={false}>
      {leadingTitle && <Text style={styles.sectionTitle}>{leadingTitle}</Text>}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (fieldName, label, text, showLabel = true, leadingTitle = null) => {
  if (!hasVal(text)) return null;
  const rows = [];
  buildUnits(fmtVal(text), fieldName).forEach(unit => {
    if (unit.label) rows.push({ type: 'subtitle', text: unit.label });
    unit.rows.forEach((row, index) => rows.push({ type: 'item', text: row, num: index + 1 }));
  });
  if (rows.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={rows.length > 8}>
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
    <View style={styles.fieldBox} wrap={!leadingTitle && safeItems.length > 8}>
      {leadingTitle && <Text style={styles.sectionTitle}>{leadingTitle}</Text>}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {stripDelims(safeString(item))}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Record Information',
    fields: [
      { key: 'date', label: 'Consent Date', isDate: true },
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
        <Page size="A4" style={styles.page}>
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
      <Page size="A4" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Anesthesia Consent</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
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
                    if (field.isSentence) return <View key={field.key}>{renderSentenceSection(field.key, field.label, val, showFieldLabel, leadingTitle)}</View>;
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

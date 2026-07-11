/**
 * EmergencyDispositionDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — emergency department disposition
 * Collection: emergency_disposition
 * NO BLUE COLORS (#606060/#9a9a9a/#bcbcbc BANNED) — #000000/#333333/#cccccc/#f5f5f5 ONLY
 * Rule #74: sectionTitle rendered INSIDE the first present field's View (no orphan siblings).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { paddingBottom: 16 },  // paddingBottom ONLY — marginBottom shoves the whole record to the next page (Rule #74, memory 6a2d6af6)
  recordHeader: { marginBottom: 14 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
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

/* asUTCDate: parse a stored date/datetime string as WALL-CLOCK (tz-independent) — mirrors the JSX template. */
const asUTCDate = (dateValue) => {
  const s = String(dateValue?.$date || dateValue || '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) { const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)));
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  const d = asUTCDate(dateValue);
  return d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : String(dateValue);
};

const formatDateTime = (dateValue) => {
  if (!dateValue) return '';
  const d = asUTCDate(dateValue);
  return d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }) : String(dateValue);
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
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)|;\s+/)
    // A leading conditional/subordinate clause's colon is grammatical, not a Label:Value delimiter — drop it
    // so "If chest pain recurs: take 1 NTG…" reads as one flowing sentence (user pref July 7 2026).
    .map(s => s.trim().replace(/^((?:If|When|While|Unless|Until|Once|Whenever|Should|In case|As needed)\b[^:]{0,60}?):\s+/i, '$1 '))
    .filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z0-9][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  // (conditional-clause colons — "If chest pain recurs: …" — are stripped upstream in splitBySentence, so
  //  they never reach here as a false Label: Value; a real "Peak Troponin: 0.9" still parses normally.)
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

/* Field unit — ChiropracticConsultation renderFieldUnit pattern (PROVEN; memory 6a2d6af6 + 699004a9).
   ONE flattened wrap-gated View per field. The sectionTitle goes INSIDE the FIRST field's View (isFirst) —
   NEVER a standalone sibling (a standalone title orphans when a wrap=true section breaks after it). Each
   field's own rows gate its wrap: ≤22 rows (incl. title) → wrap=false → the whole unit (title glued to its
   content) moves to the next page together = no orphan, no overprint. >22 rows → wrap=true → flows. */
const titleRows = (isFirst) => (isFirst ? 1 : 0);

const renderFieldRow = (label, value, sectionTitle, isFirst, key) => {
  if (!hasVal(value)) return null;
  const rows = 2 + titleRows(isFirst);
  return (
    <View key={key} style={styles.fieldBox} wrap={rows > 22 ? true : false}>
      {isFirst && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField: formatted date value */
const renderDateFieldPDF = (label, value, sectionTitle, isFirst, key) => {
  if (!hasVal(value)) return null;
  const rows = 2 + titleRows(isFirst);
  return (
    <View key={key} style={styles.fieldBox} wrap={rows > 22 ? true : false}>
      {isFirst && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderDateTimeField: formatted date + time-of-day value */
const renderDateTimeFieldPDF = (label, value, sectionTitle, isFirst, key) => {
  if (!hasVal(value)) return null;
  const rows = 2 + titleRows(isFirst);
  return (
    <View key={key} style={styles.fieldBox} wrap={rows > 22 ? true : false}>
      {isFirst && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDateTime(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split — duplicate label suppression */
const renderSentenceSection = (label, text, sectionTitle, isFirst, key) => {
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
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        rows.push({ type: 'item', text: safeString(parsed.value), num: n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  const rowCount = 1 + rows.length + titleRows(isFirst);
  return (
    <View key={key} style={styles.fieldBox} wrap={rowCount > 22 ? true : false}>
      {isFirst && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
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
const renderArrayFieldPDF = (label, items, sectionTitle, isFirst, key) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  const rowCount = 1 + safeItems.length + titleRows(isFirst);
  return (
    <View key={key} style={styles.fieldBox} wrap={rowCount > 22 ? true : false}>
      {isFirst && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
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
    title: 'Disposition',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
      { key: 'dispositionType', label: 'Disposition Type', isSentence: true },
      { key: 'acuityLevelAtDisposition', label: 'Acuity Level at Disposition', isSentence: true },
      { key: 'admissionDiagnosis', label: 'Admission Diagnosis', isSentence: true },
      { key: 'codeStatus', label: 'Code Status', isSentence: true },
      { key: 'dispositionDelayReason', label: 'Disposition Delay Reason', isSentence: true },
    ],
  },
  {
    title: 'Admission / Transfer',
    fields: [
      { key: 'admittingService', label: 'Admitting Service', isSentence: true },
      { key: 'admittingPhysician', label: 'Admitting Physician', isSentence: true },
      { key: 'inpatientUnitAssigned', label: 'Inpatient Unit Assigned', isSentence: true },
      { key: 'transferFacility', label: 'Transfer Facility', isSentence: true },
      { key: 'transferReason', label: 'Transfer Reason', isSentence: true },
      { key: 'transportMode', label: 'Transport Mode', isSentence: true },
    ],
  },
  {
    title: 'Timing',
    fields: [
      { key: 'dispositionTimestamp', label: 'Disposition Timestamp', isDateTime: true },
      { key: 'bedRequestTime', label: 'Bed Request Time', isDateTime: true },
      { key: 'bedAssignedTime', label: 'Bed Assigned Time', isDateTime: true },
      { key: 'departureTime', label: 'Departure Time', isDateTime: true },
      { key: 'lengthOfStay', label: 'Length of Stay (minutes)', isNumber: true },
    ],
  },
  {
    title: 'Discharge & Follow-Up',
    fields: [
      { key: 'dischargeInstructions', label: 'Discharge Instructions', isSentence: true },
      { key: 'followUpProvider', label: 'Follow-Up Provider', isSentence: true },
      { key: 'followUpTimeframe', label: 'Follow-Up Timeframe', isSentence: true },
      { key: 'prescriptionsMedications', label: 'Prescriptions / Medications', isArray: true },
      { key: 'returnPrecautions', label: 'Return Precautions', isArray: true },
      { key: 'workRestrictionsProvided', label: 'Work Restrictions Provided', isBoolean: true },
    ],
  },
  {
    title: 'Special Flags',
    fields: [
      { key: 'leftWithoutBeingSeen', label: 'Left Without Being Seen', isBoolean: true },
      { key: 'leftAgainstMedicalAdvice', label: 'Left Against Medical Advice', isBoolean: true },
      { key: 'socialWorkConsultCompleted', label: 'Social Work Consult Completed', isBoolean: true },
    ],
  },
];

/* field presence respecting hide-zero + boolean */
const fieldPresent = (record, field) => {
  if (field.isNumber) return numberShowsPDF(record, field.key);
  if (field.isBoolean) return typeof record[field.key] === 'boolean';
  return hasVal(record[field.key]);
};

/* Dispatch to the field unit — returns the helper's OWN flattened wrap-gated View directly (NO extra
   wrapper View: an intermediate breakable View around an atomic unit lets react-pdf overprint it).
   sectionTitle + isFirst thread through so the title renders INSIDE the first field's View. */
const renderField = (record, field, sectionTitle, isFirst, key) => {
  const val = record[field.key];
  if (field.isDateTime) return renderDateTimeFieldPDF(field.label, val, sectionTitle, isFirst, key);
  if (field.isDate) return renderDateFieldPDF(field.label, val, sectionTitle, isFirst, key);
  if (field.isArray) return renderArrayFieldPDF(field.label, val, sectionTitle, isFirst, key);
  if (field.isSentence) return renderSentenceSection(field.label, val, sectionTitle, isFirst, key);
  return renderFieldRow(field.label, val, sectionTitle, isFirst, key);
};

/* ======= COMPONENT ======= */
const EmergencyDispositionDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.emergency_disposition) return Array.isArray(r.emergency_disposition) ? r.emergency_disposition : [r.emergency_disposition];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.emergency_disposition) return Array.isArray(dd.emergency_disposition) ? dd.emergency_disposition : [dd.emergency_disposition]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Emergency Department Disposition</Text>
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
          <Text style={styles.documentTitle}>Emergency Department Disposition</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {`Emergency Department Disposition ${index + 1}`}
              </Text>
            </View>

            {/* Sections — plain breakable View (NO section wrap). The sectionTitle rides INSIDE the FIRST
                present field's wrap-gated View (isFirst), so it can never be stranded alone. Each field is
                its own atomic (≤22 rows) unit that moves whole to the next page — no orphan, no overprint.
                (ChiropracticConsultation renderFieldSection pattern, memory 6a2d6af6 + 699004a9.) */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => fieldPresent(record, f));
              if (presentFields.length === 0) return null;
              return (
                <View key={sIdx} style={styles.section}>
                  {presentFields.map((field, fIdx) =>
                    renderField(record, field, sectionConfig.title, fIdx === 0, `${sIdx}-${fIdx}`)
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

export default EmergencyDispositionDocumentPDFTemplate;

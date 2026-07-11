/**
 * TelemedicineEncountersDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — telemedicine encounters
 * Collection: telemedicine_encounters
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
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
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#:'"_-]{1,80}?):\s+([\s\S]*)/);
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
      if (/^\d{4}\b/.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split — PERIOD-FIRST, NO scItems */
const renderSentenceSection = (label, text, showLabel) => {
  if (!hasVal(text)) return null;
  const strVal = fmtVal(text);
  const sentences = splitBySentence(strVal);
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
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* renderArrayFieldPDF: simple string arrays */
const renderArrayFieldPDF = (label, items, showLabel) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* renderVitalsPDF: custom vitals render */
const renderVitalsPDF = (vitals, showLabel) => {
  if (!Array.isArray(vitals) || vitals.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>VITAL SIGNS (SELF-REPORTED)</Text>}
      {vitals.map((v, i) => {
        if (!v || typeof v !== 'object') return null;
        const typeName = v.type ? v.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : `Vital ${i + 1}`;
        const parts = [];
        if (hasVal(v.value)) parts.push(`${v.value}${hasVal(v.unit) ? ' ' + v.unit : ''}`);
        if (hasVal(v.method)) parts.push(`(${v.method})`);
        return (
          <Text key={i} style={styles.listItem}>{i + 1}. {typeName}: {parts.join(' ')}</Text>
        );
      })}
    </View>
  );
};

/* renderMedicationsPDF: custom medications render */
const renderMedicationsPDF = (meds, showLabel) => {
  if (!Array.isArray(meds) || meds.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>CURRENT MEDICATION LIST</Text>}
      {meds.map((med, i) => {
        if (!med || typeof med !== 'object') return null;
        const parts = [med.name || `Medication ${i + 1}`];
        if (hasVal(med.dosage)) parts.push(med.dosage);
        if (hasVal(med.frequency)) parts.push(med.frequency);
        if (hasVal(med.route)) parts.push(`(${med.route})`);
        return (
          <Text key={i} style={styles.listItem}>{i + 1}. {parts.join(', ')}</Text>
        );
      })}
    </View>
  );
};

/* renderAllergiesPDF: custom allergies render */
const renderAllergiesPDF = (allergies, showLabel) => {
  if (!Array.isArray(allergies) || allergies.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>ALLERGIES & REACTIONS</Text>}
      {allergies.map((a, i) => {
        if (!a || typeof a !== 'object') return null;
        const parts = [a.allergen || `Allergen ${i + 1}`];
        if (hasVal(a.reaction)) parts.push(a.reaction);
        return (
          <Text key={i} style={styles.listItem}>{i + 1}. {parts.join(' - ')}</Text>
        );
      })}
    </View>
  );
};

/* renderPrescriptionsPDF: custom prescriptions render */
const renderPrescriptionsPDF = (rxs, showLabel) => {
  if (!Array.isArray(rxs) || rxs.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>PRESCRIPTIONS ISSUED</Text>}
      {rxs.map((rx, i) => {
        if (!rx || typeof rx !== 'object') return null;
        const parts = [rx.medication || `Prescription ${i + 1}`];
        if (hasVal(rx.directions)) parts.push(rx.directions);
        return (
          <Text key={i} style={styles.listItem}>{i + 1}. {parts.join(' - ')}</Text>
        );
      })}
    </View>
  );
};

/* renderLabOrdersPDF: custom lab orders render */
const renderLabOrdersPDF = (labs, showLabel) => {
  if (!Array.isArray(labs) || labs.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>LABORATORY ORDERS PLACED</Text>}
      {labs.map((lab, i) => {
        if (!lab || typeof lab !== 'object') return null;
        const parts = [lab.test || `Lab Order ${i + 1}`];
        if (hasVal(lab.indication)) parts.push(lab.indication);
        return (
          <Text key={i} style={styles.listItem}>{i + 1}. {parts.join(' - ')}</Text>
        );
      })}
    </View>
  );
};

/* renderImagingOrdersPDF: custom imaging orders render */
const renderImagingOrdersPDF = (imgs, showLabel) => {
  if (!Array.isArray(imgs) || imgs.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>IMAGING STUDIES ORDERED</Text>}
      {imgs.map((img, i) => {
        if (!img || typeof img !== 'object') return null;
        const parts = [img.modality || `Imaging ${i + 1}`];
        if (hasVal(img.region)) parts.push(img.region);
        if (hasVal(img.indication)) parts.push(`Indication: ${img.indication}`);
        return (
          <Text key={i} style={styles.listItem}>{i + 1}. {parts.join(' - ')}</Text>
        );
      })}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Encounter Information',
    fields: [
      { key: 'telemedicinePlatformUsed', label: 'Telemedicine Platform Used', isSentence: true },
      { key: 'encounterDurationMinutes', label: 'Encounter Duration (Minutes)' },
      { key: 'patientLocationDuringCall', label: 'Patient Location During Call', isSentence: true },
      { key: 'patientSatisfactionScore', label: 'Patient Satisfaction Score' },
      { key: 'technicalDifficulties', label: 'Technical Difficulties', isBoolean: true },
      { key: 'emergencyProtocolActivated', label: 'Emergency Protocol Activated', isBoolean: true },
    ],
  },
  {
    title: 'Chief Complaint',
    fields: [
      { key: 'patientChiefComplaint', label: 'Patient Chief Complaint', isSentence: true },
      { key: 'symptomDurationDays', label: 'Symptom Duration (Days)' },
      { key: 'painScaleScore', label: 'Pain Scale Score' },
    ],
  },
  {
    title: 'Vitals & Medications',
    fields: [
      { key: 'vitalSignsSelfReported', label: 'Vital Signs (Self-Reported)', isVitals: true },
      { key: 'currentMedicationList', label: 'Current Medication List', isMedications: true },
    ],
  },
  {
    title: 'Allergies & Reactions',
    fields: [
      { key: 'allergiesAndReactions', label: 'Allergies & Reactions', isAllergies: true },
    ],
  },
  {
    title: 'Diagnosis',
    fields: [
      { key: 'primaryDiagnosisIcd10', label: 'Primary Diagnosis (ICD-10)', isSentence: true },
      { key: 'secondaryDiagnosesIcd10', label: 'Secondary Diagnoses (ICD-10)', isArray: true },
    ],
  },
  {
    title: 'Orders',
    fields: [
      { key: 'prescriptionsIssued', label: 'Prescriptions Issued', isPrescriptions: true },
      { key: 'laboratoryOrdersPlaced', label: 'Laboratory Orders Placed', isLabOrders: true },
      { key: 'imagingStudiesOrdered', label: 'Imaging Studies Ordered', isImagingOrders: true },
    ],
  },
  {
    title: 'Referrals & Support',
    fields: [
      { key: 'referralToSpecialist', label: 'Referral to Specialist', isSentence: true },
      { key: 'clinicalDecisionSupport', label: 'Clinical Decision Support', isSentence: true },
      { key: 'interpretationServices', label: 'Interpretation Services', isSentence: true },
      { key: 'guardiansPresent', label: 'Guardians Present', isArray: true },
      { key: 'digitalImageSubmitted', label: 'Digital Image Submitted', isBoolean: true },
    ],
  },
  {
    title: 'Follow-Up Instructions',
    fields: [
      { key: 'followUpInstructions', label: 'Follow-Up Instructions', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const TelemedicineEncountersDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.telemedicine_encounters) return Array.isArray(r.telemedicine_encounters) ? r.telemedicine_encounters : [r.telemedicine_encounters];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.telemedicine_encounters) return Array.isArray(dd.telemedicine_encounters) ? dd.telemedicine_encounters : [dd.telemedicine_encounters]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Telemedicine Encounters</Text>
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
          <Text style={styles.documentTitle}>Telemedicine Encounters</Text>
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
                {`Telemedicine Encounter ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => hasVal(record[f.key]));
              if (presentFields.length === 0) return null;

              const renderField = (field) => {
                const val = record[field.key];
                const showLabel = field.label.toLowerCase() !== sectionConfig.title.toLowerCase();
                if (field.isBoolean) return renderFieldRow(field.label, val ? 'Yes' : 'No', showLabel);
                if (field.isArray) return renderArrayFieldPDF(field.label, val, showLabel);
                if (field.isVitals) return renderVitalsPDF(val, showLabel);
                if (field.isMedications) return renderMedicationsPDF(val, showLabel);
                if (field.isAllergies) return renderAllergiesPDF(val, showLabel);
                if (field.isPrescriptions) return renderPrescriptionsPDF(val, showLabel);
                if (field.isLabOrders) return renderLabOrdersPDF(val, showLabel);
                if (field.isImagingOrders) return renderImagingOrdersPDF(val, showLabel);
                if (field.isSentence) return renderSentenceSection(field.label, val, showLabel);
                return renderFieldRow(field.label, val, showLabel);
              };

              return (
                <View key={sIdx} style={styles.section}>
                  {/* Title + first field together -- prevents orphaned titles */}
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {renderField(presentFields[0])}
                  </View>
                  {/* Remaining fields */}
                  {presentFields.slice(1).map((field, fIdx) => (
                    <View key={fIdx}>{renderField(field)}</View>
                  ))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TelemedicineEncountersDocumentPDFTemplate;

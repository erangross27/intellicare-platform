/**
 * ShiftHandoffNotesDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — shift handoff notes
 * Collection: shift_handoff_notes
 *
 * PDF rules: No blue colors (#333333 only), sectionTitle fontSize 13 color #000000 uppercase
 * letterSpacing 0.5, NO borderBottom. Title INSIDE fieldBox with conditional wrap.
 * NEVER wrap={false} on recordContainer. wrap={false} ONLY on recordHeader.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  vitalRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4, paddingLeft: 8 },
  vitalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#333333', marginRight: 4 },
  vitalValue: { fontSize: 10, color: '#000000', marginRight: 10 },
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

/* ======= SECTION CONFIG ======= */
const SECTION_TITLES = {
  'acuity-scores': 'Acuity & Scoring',
  'vital-signs': 'Vital Signs Trends',
  'fluid-medications': 'Fluid Balance & Medications',
  'neuro-pain': 'Neuro / Pain / Ventilation',
  'access-devices': 'Access & Devices',
  'labs-safety': 'Labs & Safety',
  'care-planning': 'Care Planning & Disposition',
};

const FIELD_LABELS = {
  patientAcuityLevel: 'Patient Acuity Level',
  apacheIIScore: 'APACHE II Score',
  sofaScore: 'SOFA Score',
  glasgowComaScale: 'Glasgow Coma Scale',
  vitalSignsTrends: 'Vital Signs Trends',
  fluidBalanceTotal: 'Fluid Balance Total',
  medicationChanges: 'Medication Changes',
  vasopressorSupport: 'Vasopressor Support',
  mechanicalVentilation: 'Mechanical Ventilation',
  sedationScore: 'Sedation Score',
  painAssessment: 'Pain Assessment',
  centralVenousAccess: 'Central Venous Access',
  drainageDevices: 'Drainage Devices',
  laboratoryPending: 'Laboratory Pending',
  isolationPrecautions: 'Isolation Precautions',
  fallRiskAssessment: 'Fall Risk Assessment',
  skinIntegrityStatus: 'Skin Integrity Status',
  nutritionalSupport: 'Nutritional Support',
  familyCommunication: 'Family Communication',
  codeStatus: 'Code Status',
  consultationsPending: 'Consultations Pending',
  proceduresScheduled: 'Procedures Scheduled',
  dischargePreparation: 'Discharge Preparation',
};

const SECTION_FIELDS = {
  'acuity-scores': ['patientAcuityLevel', 'apacheIIScore', 'sofaScore', 'glasgowComaScale'],
  'vital-signs': ['vitalSignsTrends'],
  'fluid-medications': ['fluidBalanceTotal', 'medicationChanges', 'vasopressorSupport'],
  'neuro-pain': ['mechanicalVentilation', 'sedationScore', 'painAssessment'],
  'access-devices': ['centralVenousAccess', 'drainageDevices'],
  'labs-safety': ['laboratoryPending', 'isolationPrecautions', 'fallRiskAssessment', 'skinIntegrityStatus'],
  'care-planning': ['nutritionalSupport', 'familyCommunication', 'codeStatus', 'consultationsPending', 'proceduresScheduled', 'dischargePreparation'],
};

const NUMBER_FIELDS = ['apacheIIScore', 'sofaScore', 'glasgowComaScale', 'fluidBalanceTotal'];
const ARRAY_OF_STRINGS_FIELDS = ['medicationChanges', 'laboratoryPending', 'consultationsPending', 'proceduresScheduled'];
const ARRAY_OF_OBJECTS_FIELDS = ['vitalSignsTrends', 'centralVenousAccess', 'drainageDevices'];

/* ======= RENDER FIELD ======= */
const renderField = (record, fn, sectionTitle) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = label.toLowerCase() !== (sectionTitle || '').toLowerCase();

  /* Array of objects (real data MIXES object items and plain string items) — flatten BOTH so nothing is dropped */
  if (ARRAY_OF_OBJECTS_FIELDS.includes(fn)) {
    const items = Array.isArray(val) ? val.filter(v => (typeof v === 'string' ? v.trim() : (v && typeof v === 'object' && Object.keys(v).length > 0))) : [];
    if (items.length === 0) return null;
    return (
      <View key={fn} style={{ marginBottom: 6 }}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((item, i) => {
          let line;
          if (typeof item === 'string') {
            line = item;
          } else if (fn === 'vitalSignsTrends') {
            const parts = [];
            if (item.BP) parts.push(`BP ${item.BP}`);
            if (item.HR) parts.push(`HR ${item.HR}`);
            if (item.RR) parts.push(`RR ${item.RR}`);
            if (item.SpO2) parts.push(`SpO2 ${item.SpO2}%`);
            if (item.temp) parts.push(`Temp ${item.temp} F`);
            line = (item.time ? `${item.time} - ${parts.join(', ')}` : parts.join(', ')) || Object.entries(item).map(([k, v]) => `${k}: ${safeString(v)}`).join(', ');
          } else {
            line = Object.entries(item).map(([k, v]) => `${k}: ${safeString(v)}`).join(', ');
          }
          return <Text key={i} style={styles.listItem}>{i + 1}. {line}</Text>;
        })}
      </View>
    );
  }

  /* Array of strings */
  if (ARRAY_OF_STRINGS_FIELDS.includes(fn)) {
    const items = Array.isArray(val) ? val.filter(v => v && String(v).trim()) : [];
    if (items.length === 0) return null;
    return (
      <View key={fn} style={styles.fieldBox}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{`${i + 1}. ${safeString(item)}`}</Text>
        ))}
      </View>
    );
  }

  /* Number fields */
  if (NUMBER_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={styles.fieldBox}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{safeString(val)}</Text>
      </View>
    );
  }

  /* Default: string fields — split by sentence and number */
  const strVal = safeString(val);
  const sentences = strVal.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  if (sentences.length > 1) {
    return (
      <View key={fn} style={{ marginBottom: 6 }}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {sentences.map((s, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>
        ))}
      </View>
    );
  }
  return (
    <View key={fn} style={{ marginBottom: 6 }}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{strVal}</Text>
    </View>
  );
};

/* ======= RENDER SECTION ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => hasVal(record[f])).length;
  if (presentFields === 0) return null;

  return (
    <View key={sid} style={styles.section}>
      <View style={styles.fieldBox} wrap={presentFields > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {fields.map(f => renderField(record, f, title))}
      </View>
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const ShiftHandoffNotesDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].shift_handoff_notes && Array.isArray(docProp[0].shift_handoff_notes)) {
      records = docProp[0].shift_handoff_notes;
    } else {
      records = docProp;
    }
  } else if (docProp && docProp.shift_handoff_notes) {
    records = Array.isArray(docProp.shift_handoff_notes) ? docProp.shift_handoff_notes : [docProp.shift_handoff_notes];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Shift Handoff Notes</Text>
          </View>
          <Text style={styles.noDataText}>No shift handoff notes data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Shift Handoff Notes</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              {hasVal(record.createdAt) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>{record.patientAcuityLevel ? `Shift Handoff - Acuity: ${record.patientAcuityLevel}` : `Shift Handoff Notes ${idx + 1}`}</Text>
            </View>
            {renderSection(record, 'acuity-scores')}
            {renderSection(record, 'vital-signs')}
            {renderSection(record, 'fluid-medications')}
            {renderSection(record, 'neuro-pain')}
            {renderSection(record, 'access-devices')}
            {renderSection(record, 'labs-safety')}
            {renderSection(record, 'care-planning')}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ShiftHandoffNotesDocumentPDFTemplate;

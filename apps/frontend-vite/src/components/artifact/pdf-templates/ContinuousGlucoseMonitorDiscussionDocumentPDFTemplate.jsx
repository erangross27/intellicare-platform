/**
 * ContinuousGlucoseMonitorDiscussionDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — A4 — BLACK & WHITE only (#000000 titles/borders/values, NO blue).
 * Collection: continuous_glucose_monitor_discussion.
 *
 * BOX-FREE (no backgroundColor/border on field/section views; recordHeader = black bottom-border only).
 * Rule #74: each field is ONE wrap-gated <View> (rows<=8 -> wrap={false}; rows>8 -> wrap=undefined),
 * with its sectionTitle as the FIRST child of the first present field's View (anti-orphan — never a sibling).
 * Single-name skip: hide a field label when it equals the section title.
 * NUMBER fields -> hide-zero gate (numberShowsPDF) then plain value line.
 * BOOLEAN fields -> Yes/No line.
 * OBJECT field `targetGlucoseRange` rendered recursively as humanized key/value lines.
 * ARRAY string fields -> numbered list.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* Canonical box-free donor sizes: page 14 / title 26 / record 19 / section 16 +1pt rule /
   label 12 +0.5pt #999 rule / sub-label 11 +0.5pt #999 rule / value 14. NO left-bar borders, NO boxes. */
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4, textTransform: 'uppercase', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  nested: { marginLeft: 10, marginTop: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 10, color: '#000000' },
});

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'provider-info': 'Provider Information',
  'diabetes-context': 'Diabetes Context',
  'current-monitoring': 'Current Monitoring',
  'target-glucose-range': 'Target Glucose Range',
  'cgm-recommendation': 'CGM Recommendation',
  'device-setup': 'Device Setup',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', diabetesType: 'Diabetes Type',
  currentA1c: 'Current A1c (%)', totalDailyInsulinDose: 'Total Daily Insulin Dose (units)',
  insulinDeliveryMethod: 'Insulin Delivery Method', frequencyOfHypoglycemia: 'Frequency of Hypoglycemia',
  hypoglycemiaUnawareness: 'Hypoglycemia Unawareness', currentMonitoringMethod: 'Current Monitoring Method',
  fingerstickFrequency: 'Fingerstick Frequency', timeInRange: 'Time in Range (%)',
  targetGlucoseRange: 'Target Glucose Range', cgmDeviceRecommended: 'CGM Device Recommended',
  sensorWearDuration: 'Sensor Wear Duration', calibrationRequired: 'Calibration Required',
  smartphoneCompatibility: 'Smartphone Compatibility', cgmIndicationCriteria: 'CGM Indication Criteria',
  dataSharingDiscussed: 'Data Sharing Discussed', alarmSettingsReviewed: 'Alarm Settings Reviewed',
  prescriptionProvided: 'Prescription Provided', insurancePreauthorization: 'Insurance Preauthorization',
  patientEducationProvided: 'Patient Education Provided', barriersToCgmUse: 'Barriers to CGM Use',
  followUpInterval: 'Follow-Up Interval (days)',
};
const SECTION_FIELDS = {
  'provider-info': ['date', 'provider', 'facility'],
  'diabetes-context': ['diabetesType', 'currentA1c', 'totalDailyInsulinDose', 'insulinDeliveryMethod', 'frequencyOfHypoglycemia', 'hypoglycemiaUnawareness'],
  'current-monitoring': ['currentMonitoringMethod', 'fingerstickFrequency', 'timeInRange'],
  'target-glucose-range': ['targetGlucoseRange'],
  'cgm-recommendation': ['cgmDeviceRecommended', 'sensorWearDuration', 'calibrationRequired', 'smartphoneCompatibility', 'cgmIndicationCriteria'],
  'device-setup': ['dataSharingDiscussed', 'alarmSettingsReviewed', 'prescriptionProvided', 'insurancePreauthorization', 'patientEducationProvided', 'barriersToCgmUse', 'followUpInterval'],
};
const SECTION_ORDER = ['provider-info', 'diabetes-context', 'current-monitoring', 'target-glucose-range', 'cgm-recommendation', 'device-setup'];
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['currentA1c', 'fingerstickFrequency', 'totalDailyInsulinDose', 'timeInRange', 'sensorWearDuration', 'followUpInterval'];
const BOOLEAN_FIELDS = ['hypoglycemiaUnawareness', 'calibrationRequired', 'smartphoneCompatibility', 'dataSharingDiscussed', 'alarmSettingsReviewed', 'prescriptionProvided'];
const STRING_FIELDS = ['provider', 'facility', 'diabetesType', 'frequencyOfHypoglycemia', 'currentMonitoringMethod', 'cgmDeviceRecommended', 'insulinDeliveryMethod', 'insurancePreauthorization'];
const ARRAY_FIELDS = ['cgmIndicationCriteria', 'patientEducationProvided', 'barriersToCgmUse'];
const OBJECT_FIELDS = ['targetGlucoseRange'];
/* MEANINGFUL_ZERO_FIELDS: numeric fields where 0 is a valid clinical finding (timeInRange 0% = never in range;
   fingerstickFrequency 0 = CGM-only; totalDailyInsulinDose 0 = non-insulin-treated) → always show when present. */
const MEANINGFUL_ZERO_FIELDS = ['timeInRange', 'fingerstickFrequency', 'totalDailyInsulinDose'];

const KEY_OVERRIDES = {};
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

/* hide-zero: numeric "not recorded" (0) hidden unless doctor-edited */
const numberShowsPDF = (record, key) => {
  const val = record[key];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) return MEANINGFUL_ZERO_FIELDS.includes(key) || (Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key));
  return true;
};

/* recursive object node: label = bold heading; value = plain line below (NO inline "Label: value") */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.value}>1. {fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* count rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* Rule #74 (per-field gating): render a field as wrap-gated View(s) — EACH View is one wrap unit.
   sectionTitle goes INSIDE the first View (isFirst) — never a sibling. Returns an ARRAY of Views. */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (NUMBER_FIELDS.includes(field)) {
    if (!numberShowsPDF(record, field)) return [];
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>1. {String(val)}</Text>
      </View>
    )];
  }

  if (BOOLEAN_FIELDS.includes(field)) {
    if (typeof val !== 'boolean') return [];
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>1. {val ? 'Yes' : 'No'}</Text>
      </View>
    )];
  }

  if (!hasVal(val)) return [];

  if (DATE_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>1. {formatDate(val)}</Text>
      </View>
    )];
  }

  if (ARRAY_FIELDS.includes(field)) {
    const items = Array.isArray(val) ? val.filter(x => !isEmptyDeep(x)) : [];
    if (items.length === 0) return [];
    return [(
      <View key={field} style={styles.fieldGroup} wrap={items.length > 8 ? true : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((item, i) => (<Text key={i} style={styles.value}>{i + 1}. {fmtVal(item)}</Text>))}
      </View>
    )];
  }

  if (OBJECT_FIELDS.includes(field)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => {
      const rows = countRows(v);
      return (
        <View key={`${field}-${k}`} style={styles.fieldGroup} wrap={rows > 8 ? true : false}>
          {i === 0 ? titleNode : null}
          {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {renderObjectNode(humanizeKey(k), v, `${field}-${k}`, 1)}
        </View>
      );
    });
  }

  /* string — split into sentences */
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={sentences.length > 8 ? true : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {sentences.map((s, sIdx) => (<Text key={sIdx} style={styles.value}>{sIdx + 1}. {s}</Text>))}
      </View>
    )];
  }
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.value}>1. {strVal}</Text>
    </View>
  )];
};

const fieldPresent = (record, f) => {
  if (NUMBER_FIELDS.includes(f)) return numberShowsPDF(record, f);
  if (BOOLEAN_FIELDS.includes(f)) return typeof record[f] === 'boolean';
  return hasVal(record[f]);
};

const ContinuousGlucoseMonitorDiscussionDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.continuous_glucose_monitor_discussion) records = Array.isArray(data[0].continuous_glucose_monitor_discussion) ? data[0].continuous_glucose_monitor_discussion : [data[0].continuous_glucose_monitor_discussion];
    else records = data;
  } else if (data?.continuous_glucose_monitor_discussion) records = Array.isArray(data.continuous_glucose_monitor_discussion) ? data.continuous_glucose_monitor_discussion : [data.continuous_glucose_monitor_discussion];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.continuous_glucose_monitor_discussion) records = Array.isArray(dd.continuous_glucose_monitor_discussion) ? dd.continuous_glucose_monitor_discussion : [dd.continuous_glucose_monitor_discussion]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Continuous Glucose Monitor Discussion</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Continuous Glucose Monitor Discussion</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Continuous Glucose Monitor Discussion ${String(record._recordNumber || idx + 1)}`}</Text>
            </View>

            {/* Rule #74 (per-field gating): section View only provides spacing and always FLOWS.
                Each field is its own wrap-gated unit (via renderField), with the sectionTitle embedded
                INSIDE the first present field's View (anti-orphan). */}
            {SECTION_ORDER.map((sid) => {
              const fields = SECTION_FIELDS[sid];
              const presentFields = fields.filter(f => fieldPresent(record, f));
              if (presentFields.length === 0) return null;
              const title = SECTION_TITLES[sid];
              return (
                <View key={sid} style={styles.section}>
                  {presentFields.flatMap((f, fi) => renderField(record, f, title, fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default ContinuousGlucoseMonitorDiscussionDocumentPDFTemplate;

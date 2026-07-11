/**
 * PumpAdvancedSettingsDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — pump advanced settings
 * Collection: pump_advanced_settings
 * NO BLUE COLORS (#606060/#9a9a9a/#bcbcbc BANNED) — #000000/#333333/#cccccc/#f5f5f5 ONLY
 * Rule #74: each section = ONE wrap-gated View; sectionTitle is the View's FIRST child.
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
  if (typeof v === 'object') return objectEntries(v).length > 0;
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

/* formatDate: ISO/date string → readable; hides 1970 epoch sentinel */
const formatDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  if (d.getUTCFullYear() <= 1970) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

const OBJECT_KEY_LABELS = {
  day: 'Day',
  night: 'Night',
  sleepActivity: 'Sleep Activity',
  exerciseActivity: 'Exercise Activity',
  start: 'Start',
  end: 'End',
  startTime: 'Start Time',
  endTime: 'End Time',
  enabled: 'Enabled',
};

const humanizeKey = (key) => {
  if (OBJECT_KEY_LABELS[key]) return OBJECT_KEY_LABELS[key];
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
};

function objectEntries(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  return Object.entries(obj).filter(([, v]) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  });
}

const fmtObjectValue = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.join(', ');
  if (v && typeof v === 'object') return objectEntries(v).map(([k, val]) => `${humanizeKey(k)}: ${fmtObjectValue(val)}`).join('; ');
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

/* parseColonSpace: split on the FIRST ": " (colon+space) — safe when the label has
   colons without trailing spaces, e.g. "12:00AM-3:00AM: 0.55 U/hr". */
const parseColonSpace = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const i = text.indexOf(': ');
  if (i > 0) return { isLabeled: true, label: text.slice(0, i).trim(), value: text.slice(i + 2).trim() };
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

/* renderDateRow */
const renderDateRow = (label, value, sectionTitle) => {
  const d = formatDate(value);
  if (!d) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{d}</Text>
    </View>
  );
};

/* renderObjectField: labeled key:value rows; hide-empty */
const renderObjectFieldPDF = (label, value, sectionTitle) => {
  const entries = objectEntries(value);
  if (entries.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={entries.length > 8 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {entries.map(([k, v], i) => (
        <React.Fragment key={i}>
          <Text style={styles.nestedSubtitle}>{humanizeKey(k)}</Text>
          <Text style={styles.listItem}>{fmtObjectValue(v)}</Text>
        </React.Fragment>
      ))}
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

/* renderArrayField */
const renderArrayFieldPDF = (label, items, sectionTitle) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => {
        const itemStr = typeof item === 'object' && item !== null ? fmtObjectValue(item) : safeString(item);
        let p = parseLabel(itemStr);
        if (!p.isLabeled) p = parseColonSpace(itemStr);
        if (p.isLabeled) return (
          <React.Fragment key={i}>
            <Text style={styles.nestedSubtitle}>{p.label}</Text>
            <Text style={styles.listItem}>{p.value}</Text>
          </React.Fragment>
        );
        return <Text key={i} style={styles.listItem}>{i + 1}. {itemStr}</Text>;
      })}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Device',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'pumpManufacturer', label: 'Pump Manufacturer', isSentence: true },
      { key: 'pumpModelNumber', label: 'Pump Model', isSentence: true },
      { key: 'pumpSerialNumber', label: 'Pump Serial Number', isSentence: true },
      { key: 'softwareFirmwareVersion', label: 'Software/Firmware Version', isSentence: true },
    ],
  },
  {
    title: 'Basal & Bolus',
    fields: [
      { key: 'basalRateProfile', label: 'Basal Rate Profile', isArray: true },
      { key: 'bolusDeliveryMode', label: 'Bolus Delivery Mode', isSentence: true },
      { key: 'maxBolusLimit', label: 'Max Bolus Limit (U)', isNumber: true },
      { key: 'insulinCarbRatio', label: 'Insulin:Carb Ratio (1:x g)', isNumber: true },
      { key: 'correctionFactor', label: 'Correction Factor (1:x mg/dL)', isNumber: true },
      { key: 'activeInsulinTime', label: 'Active Insulin Time (hours)', isNumber: true },
    ],
  },
  {
    title: 'Target Glucose Range',
    fields: [
      { key: 'targetGlucoseRange', label: 'Target Glucose Range', isObject: true },
    ],
  },
  {
    title: 'Safety & Alarms',
    fields: [
      { key: 'occlusioPressureLimit', label: 'Occlusion Pressure Limit', isNumber: true },
      { key: 'lockoutInterval', label: 'Lockout Interval (minutes)', isNumber: true },
      { key: 'continuousRateLimit', label: 'Continuous Rate Limit (U/hr)', isNumber: true },
      { key: 'alarmVolumeLevel', label: 'Alarm Volume Level', isNumber: true },
      { key: 'batteryBackupDuration', label: 'Battery Backup Duration (hours)', isNumber: true },
      { key: 'autoSuspendThreshold', label: 'Auto-Suspend Threshold (mg/dL)', isNumber: true },
      { key: 'tempBasalDuration', label: 'Temp Basal Duration (minutes)', isNumber: true },
      { key: 'airInLineDetection', label: 'Air-In-Line Detection', isSentence: true },
      { key: 'doseErrorReductionSystem', label: 'Dose Error Reduction System', isSentence: true },
      { key: 'wirelessCommunicationEnabled', label: 'Wireless Communication Enabled', isSentence: true },
      { key: 'nightModeSchedule', label: 'Night Mode Schedule', isObject: true },
    ],
  },
];

/* field presence respecting hide-zero + date + object */
const fieldPresent = (record, field) => {
  if (field.isNumber) return numberShowsPDF(record, field.key);
  if (field.isDate) return Boolean(formatDate(record[field.key]));
  if (field.isObject) return objectEntries(record[field.key]).length > 0;
  return hasVal(record[field.key]);
};

const renderField = (record, field, sectionTitle, key) => {
  const val = record[field.key];
  if (field.isArray) return <View key={key}>{renderArrayFieldPDF(field.label, val, sectionTitle)}</View>;
  if (field.isObject) return <View key={key}>{renderObjectFieldPDF(field.label, val, sectionTitle)}</View>;
  if (field.isDate) return <View key={key}>{renderDateRow(field.label, val, sectionTitle)}</View>;
  if (field.isSentence) return <View key={key}>{renderSentenceSection(field.label, val, sectionTitle)}</View>;
  return <View key={key}>{renderFieldRow(field.label, val, sectionTitle)}</View>;
};

/* ======= COMPONENT ======= */
const PumpAdvancedSettingsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.pump_advanced_settings) return Array.isArray(r.pump_advanced_settings) ? r.pump_advanced_settings : [r.pump_advanced_settings];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.pump_advanced_settings) return Array.isArray(dd.pump_advanced_settings) ? dd.pump_advanced_settings : [dd.pump_advanced_settings]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Pump Advanced Settings</Text>
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
          <Text style={styles.documentTitle}>Pump Advanced Settings</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>
                {`Pump Advanced Settings ${index + 1}`}
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

export default PumpAdvancedSettingsDocumentPDFTemplate;

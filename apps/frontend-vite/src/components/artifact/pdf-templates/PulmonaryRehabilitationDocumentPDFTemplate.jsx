/**
 * PulmonaryRehabilitationDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — pulmonary rehabilitation
 * Collection: pulmonary_rehabilitation
 * NO BLUE COLORS (#606060/#9a9a9a/#bcbcbc BANNED) — #000000/#333333/#cccccc/#f5f5f5 ONLY
 * Rule #74: sectionTitle rendered INSIDE the first present field's View (no orphan siblings).
 *   OBJECT fields gated PER TOP-LEVEL ENTRY so a large object never overprints on page break.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  recordMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordMeta: { fontSize: 10, color: '#333333', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  subLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#cccccc', marginTop: 2 },
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

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return String(dateStr); }
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

/* recursive object node: label = bold heading; value = plain line below (NO inline "Label: value") */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.nestedSubtitle;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
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
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Program Overview',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'primaryDiagnosis', label: 'Primary Diagnosis', isSentence: true },
      { key: 'programPhase', label: 'Program Phase', isSentence: true },
      { key: 'sessionNumber', label: 'Session Number', isNumber: true },
      { key: 'totalProgramSessions', label: 'Total Program Sessions', isNumber: true },
      { key: 'secondaryDiagnoses', label: 'Secondary Diagnoses', isArray: true },
    ],
  },
  {
    title: 'Pulmonary Function',
    fields: [
      { key: 'baselineFev1', label: 'Baseline FEV1 (L)', isNumber: true },
      { key: 'baselineFvc', label: 'Baseline FVC (L)', isNumber: true },
      { key: 'currentFev1', label: 'Current FEV1 (L)', isNumber: true },
    ],
  },
  {
    title: 'Exercise Capacity & Oximetry',
    fields: [
      { key: 'sixMinuteWalkDistance', label: '6-Minute Walk Distance (m)', isNumber: true },
      { key: 'baselineOxygenSaturation', label: 'Baseline SpO2 (%)', isNumber: true },
      { key: 'exerciseOxygenSaturation', label: 'Exercise SpO2 (%)', isNumber: true },
      { key: 'supplementalOxygenRequired', label: 'Supplemental Oxygen Required', isSentence: true },
      { key: 'targetHeartRate', label: 'Target Heart Rate (bpm)', isNumber: true },
      { key: 'peakHeartRateDuringSession', label: 'Peak Heart Rate During Session (bpm)', isNumber: true },
    ],
  },
  {
    title: 'Exercise Prescription',
    fields: [
      { key: 'exercisePrescription', label: 'Exercise Prescription', isObject: true },
    ],
  },
  {
    title: 'Education & Support',
    fields: [
      { key: 'breathingTechniques', label: 'Breathing Techniques', isArray: true },
      { key: 'educationTopicsCovered', label: 'Education Topics Covered', isArray: true },
      { key: 'dyspneaScale', label: 'Dyspnea Scale', isSentence: true },
      { key: 'nutritionalCounseling', label: 'Nutritional Counseling', isSentence: true },
      { key: 'psychosocialSupport', label: 'Psychosocial Support', isSentence: true },
    ],
  },
  {
    title: 'Outcomes & Adverse Events',
    fields: [
      { key: 'functionalCapacityImprovement', label: 'Functional Capacity Improvement', isSentence: true },
      { key: 'adverseEvents', label: 'Adverse Events', isArray: true },
    ],
  },
];

/* field presence respecting hide-zero */
const fieldPresent = (record, field) => {
  if (field.isNumber) return numberShowsPDF(record, field.key);
  return hasVal(record[field.key]);
};

/* renderField — returns an ARRAY of Views (OBJECT gates per top-level entry, Rule #74) */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field.key];
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (field.isDate) {
    if (!hasVal(val)) return [];
    return [(
      <View key={field.key} style={styles.fieldBox} wrap={false}>
        {titleNode}
        <Text style={styles.fieldLabel}>{field.label}</Text>
        <Text style={styles.fieldValue}>{formatDate(val)}</Text>
      </View>
    )];
  }

  if (field.isNumber) {
    if (!numberShowsPDF(record, field.key)) return [];
    return [(
      <View key={field.key} style={styles.fieldBox} wrap={false}>
        {titleNode}
        <Text style={styles.fieldLabel}>{field.label}</Text>
        <Text style={styles.fieldValue}>{safeString(val)}</Text>
      </View>
    )];
  }

  if (field.isArray) {
    const node = renderArrayFieldPDF(field.label, val, isFirst ? sectionTitle : null);
    return node ? [node] : [];
  }

  if (field.isObject) {
    if (!hasVal(val) || isScalar(val)) return [];
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => {
      const rows = countRows(v);
      return (
        <View key={`${field.key}-${k}`} style={styles.fieldBox} wrap={rows > 8 ? undefined : false}>
          {i === 0 ? titleNode : null}
          {i === 0 ? <Text style={styles.fieldLabel}>{field.label}</Text> : null}
          {renderObjectNode(humanizeKey(k), v, `${field.key}-${k}`, 1)}
        </View>
      );
    });
  }

  /* sentence (string) */
  const node = renderSentenceSection(field.label, val, isFirst ? sectionTitle : null);
  return node ? [node] : [];
};

/* ======= COMPONENT ======= */
const PulmonaryRehabilitationDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.pulmonary_rehabilitation) return Array.isArray(r.pulmonary_rehabilitation) ? r.pulmonary_rehabilitation : [r.pulmonary_rehabilitation];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.pulmonary_rehabilitation) return Array.isArray(dd.pulmonary_rehabilitation) ? dd.pulmonary_rehabilitation : [dd.pulmonary_rehabilitation]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Pulmonary Rehabilitation</Text>
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
          <Text style={styles.documentTitle}>Pulmonary Rehabilitation</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header — date / provider / facility */}
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordMetaRow}>
                {hasVal(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
                {hasVal(record.provider) && <Text style={styles.recordMeta}>{safeString(record.provider)}</Text>}
                {hasVal(record.facility) && <Text style={styles.recordMeta}>{safeString(record.facility)}</Text>}
              </View>
              <Text style={styles.recordTitle}>
                {`Pulmonary Rehabilitation ${index + 1}`}
              </Text>
            </View>

            {/* Sections — sectionTitle rendered inside the first present field (Rule #74) */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => fieldPresent(record, f));
              if (presentFields.length === 0) return null;

              const viewsArr = [];
              presentFields.forEach((field, fIdx) => {
                viewsArr.push(...renderField(record, field, sectionConfig.title, fIdx === 0));
              });
              if (viewsArr.length === 0) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  {viewsArr}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PulmonaryRehabilitationDocumentPDFTemplate;

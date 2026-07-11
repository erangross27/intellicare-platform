/**
 * FollowUpIntelligencePDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — follow-up intelligence
 * Collection: follow_up_intelligence
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
  recordMeta: { fontSize: 11, color: '#333333', marginTop: 4 },
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
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
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
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)|;\s+/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

const prettySubLabel = (k) => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

/* flatten any value (scalar / array / nested object) to readable text — no [object Object] */
const flattenValue = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenValue).filter(Boolean).join('; ');
  if (typeof v === 'object') {
    return Object.entries(v)
      .filter(([, val]) => val !== null && val !== undefined && val !== '' && !(Array.isArray(val) && val.length === 0))
      .map(([k, val]) => `${prettySubLabel(k)}: ${flattenValue(val)}`)
      .join('; ');
  }
  return String(v);
};

/* renderArrayField — object items rendered as a subtitle + per-subfield lines (Copy/PDF readable) */
const renderArrayFieldPDF = (label, items, sectionTitle) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 6 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const keys = Object.keys(item).filter(k => item[k] !== null && item[k] !== undefined && item[k] !== '' && !(Array.isArray(item[k]) && item[k].length === 0));
          if (keys.length === 0) return null;
          const titleKey = keys.find(k => typeof item[k] === 'string' || typeof item[k] === 'number');
          return (
            <View key={i} wrap={false}>
              <Text style={styles.nestedSubtitle}>{i + 1}. {titleKey ? safeString(item[titleKey]) : `${label} ${i + 1}`}</Text>
              {keys.filter(k => k !== titleKey).map((k, ki) => (
                <Text key={ki} style={styles.listItem}>{prettySubLabel(k)}: {flattenValue(item[k])}</Text>
              ))}
            </View>
          );
        }
        return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>;
      })}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Interval History',
    fields: [
      { key: 'chiefComplaint', label: 'Chief Complaint', isSentence: true },
      { key: 'intervalHistoryChanges', label: 'Interval History Changes', isSentence: true },
      { key: 'medicationAdherence', label: 'Medication Adherence', isSentence: true },
      { key: 'symptomProgression', label: 'Symptom Progression', isSentence: true },
      { key: 'functionalStatusChange', label: 'Functional Status Change', isSentence: true },
    ],
  },
  {
    title: 'Trends',
    fields: [
      { key: 'vitalSignsTrends', label: 'Vital Signs Trends', isSentence: true },
      { key: 'laboratoryTrends', label: 'Laboratory Trends', isSentence: true },
      { key: 'imagingComparison', label: 'Imaging Comparison', isSentence: true },
      { key: 'treatmentResponseAssessment', label: 'Treatment Response Assessment', isSentence: true },
      { key: 'diseaseProgressionIndicators', label: 'Disease Progression Indicators', isArray: true },
    ],
  },
  {
    title: 'Adverse & Risk',
    fields: [
      { key: 'adverseEvents', label: 'Adverse Events', isArray: true },
      { key: 'redFlagSymptoms', label: 'Red Flag Symptoms', isArray: true },
      { key: 'comorbidityImpact', label: 'Comorbidity Impact', isSentence: true },
      { key: 'riskStratificationLevel', label: 'Risk Stratification Level', isSentence: true },
      { key: 'barriersToCare', label: 'Barriers to Care', isArray: true },
    ],
  },
  {
    title: 'Outcomes',
    fields: [
      { key: 'patientReportedOutcomes', label: 'Patient-Reported Outcomes', isSentence: true },
      { key: 'qualityOfLifeScore', label: 'Quality of Life Score', isNumber: true },
      { key: 'careGoalsProgress', label: 'Care Goals Progress', isSentence: true },
      { key: 'therapyModifications', label: 'Therapy Modifications', isArray: true },
    ],
  },
  {
    title: 'Follow-Up Plan',
    fields: [
      { key: 'nextFollowUpInterval', label: 'Next Follow-Up Interval', isSentence: true },
      { key: 'monitoringParameters', label: 'Monitoring Parameters', isArray: true },
      { key: 'consultationRequests', label: 'Consultation Requests', isArray: true },
      { key: 'patientEducationProvided', label: 'Patient Education Provided', isArray: true },
    ],
  },
];

/* field presence respecting hide-zero */
const fieldPresent = (record, field) => {
  if (field.isNumber) return numberShowsPDF(record, field.key);
  return hasVal(record[field.key]);
};

const renderField = (record, field, sectionTitle, key) => {
  const val = record[field.key];
  if (field.isArray) return <View key={key}>{renderArrayFieldPDF(field.label, val, sectionTitle)}</View>;
  if (field.isSentence) return <View key={key}>{renderSentenceSection(field.label, val, sectionTitle)}</View>;
  return <View key={key}>{renderFieldRow(field.label, val, sectionTitle)}</View>;
};

/* ======= COMPONENT ======= */
const FollowUpIntelligencePDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.follow_up_intelligence) return Array.isArray(r.follow_up_intelligence) ? r.follow_up_intelligence : [r.follow_up_intelligence];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.follow_up_intelligence) return Array.isArray(dd.follow_up_intelligence) ? dd.follow_up_intelligence : [dd.follow_up_intelligence]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Follow-Up Intelligence</Text>
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
          <Text style={styles.documentTitle}>Follow-Up Intelligence</Text>
        </View>

        {records.map((record, index) => {
          const metaParts = [];
          if (hasVal(record.provider)) metaParts.push(fmtVal(record.provider));
          if (hasVal(record.facility)) metaParts.push(fmtVal(record.facility));
          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>
                  {`Follow-Up Intelligence ${index + 1}`}
                </Text>
                {hasVal(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
                {metaParts.length > 0 && <Text style={styles.recordMeta}>{metaParts.join(' — ')}</Text>}
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
          );
        })}
      </Page>
    </Document>
  );
};

export default FollowUpIntelligencePDFTemplate;

/**
 * WorkplaceInjuryReportDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — workplace injury report
 * Collection: workplace_injury_report
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  oshaBadge: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#5c5c5c', backgroundColor: '#eaeaea', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
  chartSection: { marginBottom: 16, padding: 12, backgroundColor: '#e2e8f0', borderRadius: 4, borderWidth: 1, borderColor: '#a1a1a1' },
  chartTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#a1a1a1' },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 },
  legendColor: { width: 12, height: 12, borderRadius: 2, marginRight: 4 },
  legendText: { fontSize: 9, color: '#666666' },
  barChartRow: { marginBottom: 14 },
  barLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  barCategoryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barCategoryValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  barInterpretation: { fontSize: 9, color: '#666666' },
  barOuter: { height: 16, backgroundColor: '#a1a1a1', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  barInner: { height: 16, borderRadius: 4 },
  barScale: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleItem: { fontSize: 8, color: '#9ca3af' },
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

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
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
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value, useDateTime) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{useDateTime ? formatDateTime(value) : formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection */
const renderSentenceSection = (label, text) => {
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
const renderArrayFieldPDF = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* Severity helpers */
const getLostWorkTimeSeverity = (days) => {
  if (days === null || days === undefined) return null;
  const num = Number(days); if (isNaN(num)) return null;
  if (num === 0) return { label: 'No Lost Time', color: '#898989', description: 'Employee continued working', percentage: 5 };
  if (num <= 3) return { label: `${num} Days`, color: '#898989', description: 'Minor - Brief absence', percentage: 15 };
  if (num <= 7) return { label: `${num} Days`, color: '#7a7a7a', description: 'Moderate - Short-term absence', percentage: 35 };
  if (num <= 14) return { label: `${num} Days`, color: '#a7a7a7', description: 'Significant - Extended absence', percentage: 60 };
  if (num <= 30) return { label: `${num} Days`, color: '#777777', description: 'Severe - Prolonged absence', percentage: 85 };
  return { label: `${num} Days`, color: '#3a3a3a', description: 'Critical - Long-term disability', percentage: 100 };
};

const getRestrictedDutySeverity = (days) => {
  if (days === null || days === undefined) return null;
  const num = Number(days); if (isNaN(num)) return null;
  if (num === 0) return { label: 'No Restrictions', color: '#898989', description: 'Full duty capacity', percentage: 5 };
  if (num <= 7) return { label: `${num} Days`, color: '#7a7a7a', description: 'Short-term restrictions', percentage: 25 };
  if (num <= 14) return { label: `${num} Days`, color: '#a7a7a7', description: 'Moderate restrictions', percentage: 50 };
  if (num <= 30) return { label: `${num} Days`, color: '#777777', description: 'Extended restrictions', percentage: 75 };
  return { label: `${num} Days`, color: '#3a3a3a', description: 'Prolonged restrictions', percentage: 100 };
};

/* PDF Legend */
const PDFLegend = () => (
  <View style={styles.legendContainer}>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#898989' }]} /><Text style={styles.legendText}>0-3 days</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#7a7a7a' }]} /><Text style={styles.legendText}>4-7 days</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#a7a7a7' }]} /><Text style={styles.legendText}>8-14 days</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#777777' }]} /><Text style={styles.legendText}>15-30 days</Text></View>
    <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#3a3a3a' }]} /><Text style={styles.legendText}>30+ days</Text></View>
  </View>
);

/* PDF Bar Chart */
const PDFBarChart = ({ label, severity, maxDays = 30 }) => {
  if (!severity) return null;
  return (
    <View style={styles.barChartRow}>
      <Text style={styles.barLabel}>{String(label)}</Text>
      <View style={styles.barCategoryRow}>
        <Text style={[styles.barCategoryValue, { color: severity.color }]}>{String(severity.label)}</Text>
        <Text style={styles.barInterpretation}>{String(severity.description)}</Text>
      </View>
      <View style={styles.barOuter}>
        <View style={[styles.barInner, { width: `${severity.percentage}%`, backgroundColor: severity.color }]} />
      </View>
      <View style={styles.barScale}>
        <Text style={styles.scaleItem}>0</Text>
        <Text style={styles.scaleItem}>{Math.round(maxDays * 0.25)}</Text>
        <Text style={styles.scaleItem}>{Math.round(maxDays * 0.5)}</Text>
        <Text style={styles.scaleItem}>{Math.round(maxDays * 0.75)}</Text>
        <Text style={styles.scaleItem}>{maxDays}+</Text>
      </View>
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Report Information',
    fields: [
      { key: 'date', label: 'Report Date', isDate: true },
      { key: 'reportedDateTime', label: 'Date Reported', isDate: true, useDateTime: true },
      { key: 'workersCompCaseNumber', label: "Workers' Comp Case Number", isSentence: true },
    ],
  },
  {
    title: 'Employment Details',
    fields: [
      { key: 'employerName', label: 'Employer', isSentence: true },
      { key: 'jobTitle', label: 'Job Title', isSentence: true },
      { key: 'employmentStatus', label: 'Employment Status', isSentence: true },
      { key: 'workLocationAddress', label: 'Work Location', isSentence: true },
    ],
  },
  {
    title: 'Injury Summary',
    fields: [
      { key: 'injuryType', label: 'Injury Type', isSentence: true },
      { key: 'injuryDateTime', label: 'Injury Date/Time', isDate: true, useDateTime: true },
      { key: 'bodyPartsAffected', label: 'Body Parts Affected', isArray: true },
    ],
  },
  {
    title: 'Mechanism of Injury',
    fields: [
      { key: 'injuryMechanism', label: 'Mechanism of Injury', isSentence: true },
    ],
  },
  {
    title: 'Immediate Response',
    fields: [
      { key: 'workDutiesAtInjury', label: 'Work Duties at Injury', isSentence: true },
      { key: 'emergencyTreatmentLocation', label: 'Emergency Treatment Location', isSentence: true },
      { key: 'immediateSymptoms', label: 'Immediate Symptoms', isArray: true },
    ],
  },
  {
    title: 'Treatment Provided',
    fields: [
      { key: 'treatmentProvided', label: 'Treatment Provided', isArray: true },
    ],
  },
  {
    title: 'Risk Indicators',
    fields: [
      { key: 'oshaRecordable', label: 'OSHA Recordable' },
      { key: 'previousSimilarInjuries', label: 'Previous Similar Injuries' },
      { key: 'lostWorkTimeDays', label: 'Lost Work Time Days' },
      { key: 'restrictedDutyDays', label: 'Restricted Duty Days' },
    ],
    hasChart: true,
  },
  {
    title: 'Functional Impact',
    fields: [
      { key: 'functionalLimitations', label: 'Functional Limitations', isArray: true },
      { key: 'workModificationsRequired', label: 'Work Modifications Required', isArray: true },
    ],
  },
  {
    title: 'Recovery Timeline',
    fields: [
      { key: 'estimatedRecoveryTime', label: 'Estimated Recovery Time', isSentence: true },
      { key: 'returnToWorkDate', label: 'Return to Work Date', isDate: true },
    ],
  },
  {
    title: 'Safety & Witnesses',
    fields: [
      { key: 'supervisorName', label: 'Supervisor', isSentence: true },
      { key: 'witnessNames', label: 'Witnesses', isArray: true },
      { key: 'safetyEquipmentUsed', label: 'Safety Equipment Used', isArray: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const WorkplaceInjuryReportDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.workplace_injury_report) return Array.isArray(r.workplace_injury_report) ? r.workplace_injury_report : [r.workplace_injury_report];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.workplace_injury_report) return Array.isArray(dd.workplace_injury_report) ? dd.workplace_injury_report : [dd.workplace_injury_report]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Workplace Injury Report</Text>
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
          <Text style={styles.documentTitle}>Workplace Injury Report</Text>
        </View>

        {records.map((record, index) => {
          const lostTimeSeverity = getLostWorkTimeSeverity(record.lostWorkTimeDays);
          const restrictedDutySeverity = getRestrictedDutySeverity(record.restrictedDutyDays);

          return (
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
                  {`Workplace Injury Report ${index + 1}`}
                </Text>
                {record.oshaRecordable && (
                  <Text style={styles.oshaBadge}>OSHA Recordable</Text>
                )}
              </View>

              {/* Sections */}
              {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
                const hasAnyVal2 = sectionConfig.fields.some(f => hasVal(record[f.key]));
                const hasChart = sectionConfig.hasChart && (lostTimeSeverity || restrictedDutySeverity);
                if (!hasAnyVal2 && !hasChart) return null;

                return (
                  <View key={sIdx} style={styles.section}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {sectionConfig.fields.map((field, fIdx) => {
                      const val = record[field.key];
                      if (!hasVal(val)) return null;

                      if (field.isDate) return <View key={fIdx}>{renderDateFieldPDF(field.label, val, field.useDateTime)}</View>;
                      if (field.isArray) return <View key={fIdx}>{renderArrayFieldPDF(field.label, val)}</View>;
                      if (field.isSentence) return <View key={fIdx}>{renderSentenceSection(field.label, val)}</View>;
                      return <View key={fIdx}>{renderFieldRow(field.label, val)}</View>;
                    })}
                    {sectionConfig.hasChart && (lostTimeSeverity || restrictedDutySeverity) && (
                      <View style={styles.chartSection} wrap={false}>
                        <Text style={styles.chartTitle}>Work Impact Assessment</Text>
                        <PDFLegend />
                        {lostTimeSeverity && <PDFBarChart label="Lost Work Time Days" severity={lostTimeSeverity} maxDays={30} />}
                        {restrictedDutySeverity && <PDFBarChart label="Restricted Duty Days" severity={restrictedDutySeverity} maxDays={30} />}
                      </View>
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

export default WorkplaceInjuryReportDocumentPDFTemplate;

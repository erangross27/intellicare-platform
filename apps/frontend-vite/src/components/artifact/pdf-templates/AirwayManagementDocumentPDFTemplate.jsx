import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { paddingTop: 38, paddingHorizontal: 42, paddingBottom: 42, fontFamily: 'Helvetica', color: '#111827', fontSize: 13, lineHeight: 1.35 },
  documentHeader: { marginBottom: 18 },
  documentTitle: { fontSize: 26, fontWeight: 'bold', color: '#0f172a', paddingBottom: 9, borderBottom: '2pt solid #000000' },
  recordHeader: { marginBottom: 14 },
  recordTitle: { fontSize: 19, fontWeight: 'bold', color: '#1e3a8a' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1d4ed8', paddingBottom: 5, marginBottom: 8, borderBottom: '1pt solid #000000' },
  fieldBox: { marginBottom: 9, minHeight: 64 },
  fieldHeader: { marginBottom: 5 },
  fieldLabel: { fontSize: 14, fontWeight: 'bold', color: '#1e3a8a', paddingBottom: 3, borderBottom: '0.5pt solid #999999' },
  rowBlock: { marginLeft: 8, marginBottom: 5 },
  nestedSubtitle: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginBottom: 3 },
  fieldValue: { fontSize: 13, color: '#111827' },
  noData: { fontSize: 13, marginTop: 20 },
});

const SECTIONS = [
  { title: 'Airway Assessment', fields: [['date', 'Record Date', 'date'], ['airwayAssessmentScore', 'Airway Assessment Score'], ['thyromentalDistance', 'Thyromental Distance (cm)', 'number'], ['mouthOpeningDistance', 'Mouth Opening (cm)', 'number'], ['neckCircumference', 'Neck Circumference (cm)', 'number'], ['neckMobilityRestriction', 'Neck Mobility Restriction', 'boolean']] },
  { title: 'Intubation Details', fields: [['intubationMethod', 'Intubation Method', 'sentence'], ['laryngoscopeBladeType', 'Laryngoscope Blade'], ['endotrachealTubeSize', 'ET Tube Size (mm)', 'number'], ['endotrachealTubeType', 'ET Tube Type'], ['tubeDepthAtTeeth', 'Tube Depth at Teeth (cm)', 'number'], ['cormackLehaneGrade', 'Cormack-Lehane Grade'], ['intubationAttempts', 'Intubation Attempts', 'number']] },
  { title: 'Preoxygenation & Induction', fields: [['preoxygenationMethod', 'Preoxygenation Method', 'sentence'], ['inductionAgents', 'Induction Agents', 'arrayKeep'], ['neuromusculatBlocker', 'Neuromuscular Blocker']] },
  { title: 'Procedure Flags', fields: [['rapidSequenceIntubation', 'Rapid Sequence Intubation', 'boolean'], ['cricoidPressureApplied', 'Cricoid Pressure Applied', 'boolean'], ['difficultAirwayEncountered', 'Difficult Airway Encountered', 'boolean']] },
  { title: 'Alternative Devices & Confirmation', fields: [['alternativeAirwayDevices', 'Alternative Airway Devices', 'arrayKeep'], ['tubePlacementConfirmation', 'Tube Placement Confirmation', 'arrayComma']] },
  { title: 'Post-Intubation Values', fields: [['endTidalCO2Value', 'End-Tidal CO2 (mmHg)', 'number'], ['cuffPressure', 'Cuff Pressure (cmH2O)', 'number'], ['oxygenSaturationPostIntubation', 'SpO2 Post-Intubation (%)', 'number'], ['extubationTime', 'Extubation Date', 'date']] },
  { title: 'Complications', fields: [['complicationsDuringIntubation', 'Complications During Intubation', 'arrayKeep']] },
];
const PAGE_GROUPS = SECTIONS.map((_, index) => [index]);
const HIDE_ZERO_FIELDS = new Set(['thyromentalDistance', 'mouthOpeningDistance', 'neckCircumference', 'endotrachealTubeSize', 'tubeDepthAtTeeth', 'intubationAttempts', 'endTidalCO2Value', 'cuffPressure', 'oxygenSaturationPostIntubation']);
const hasVal = value => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.some(hasVal));
const fieldHasVal = (record, field) => hasVal(record?.[field]) && !(HIDE_ZERO_FIELDS.has(field) && Number(record[field]) === 0);
const formatDate = value => { if (!value) return ''; try { const raw = value?.$date?.$numberLong ?? value?.$date ?? value?.$numberLong ?? value, normalized = typeof raw === 'string' && /^-?\d+$/.test(raw) ? Number(raw) : raw, date = new Date(normalized); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); } };
const parseLabel = value => { const text = String(value || ''), match = text.match(/^([^:]{1,60}):\s+(.+)$/); return match && !/[([\]]/.test(match[1]) ? { subtitle: match[1].trim(), content: match[2].trim() } : { subtitle: '', content: text }; };
const splitComma = value => { const rows = []; let current = '', depth = 0; for (const char of String(value || '')) { if (char === '(') depth += 1; if (char === ')') depth = Math.max(0, depth - 1); if (char === ',' && depth === 0) { if (current.trim()) rows.push(current.trim()); current = ''; } else current += char; } if (current.trim()) rows.push(current.trim()); return rows; };
const splitSentence = value => String(value || '').split(/;\s+|\.(?!\d)(?:\s+|$)/).map(row => row.trim()).filter(row => row && !/^[;.,!?]+$/.test(row));
const textRows = (value, { sentences = false, commas = false } = {}) => (sentences ? splitSentence(value) : [String(value || '').trim()]).flatMap(part => { const parsed = parseLabel(part); const clauses = commas ? splitComma(parsed.content) : [parsed.content]; return clauses.filter(Boolean).map(row => ({ subtitle: parsed.subtitle, value: row })); });
const rowsFor = ([, , type], value) => {
  if (type === 'date') return [{ value: formatDate(value) }];
  if (type === 'boolean') return [{ value: value ? 'Yes' : 'No' }];
  if (type === 'number') return [{ value: String(value) }];
  if (type === 'sentence') return textRows(value, { sentences: true });
  if (type === 'arrayKeep') return (Array.isArray(value) ? value : []).flatMap(item => textRows(item, { sentences: true }));
  if (type === 'arrayComma') return (Array.isArray(value) ? value : []).flatMap(item => textRows(item, { sentences: true, commas: true }));
  return textRows(value);
};
const renderField = (config, value, key, sectionTitle) => {
  const [, label] = config, rows = rowsFor(config, value), showLabel = label !== sectionTitle;
  if (!rows.length) return null;
  const renderRow = (row, index, priorSubtitle) => <View key={`${key}-${index}`} style={styles.rowBlock} wrap={false}>{row.subtitle && row.subtitle !== priorSubtitle && <Text style={styles.nestedSubtitle}>{row.subtitle}</Text>}<Text style={styles.fieldValue}>{index + 1}. {row.value}</Text></View>;
  const first = rows[0];
  return <React.Fragment key={key}>{showLabel ? <View style={styles.fieldBox} wrap={false}><View style={styles.fieldHeader}><Text style={styles.fieldLabel}>{label}</Text></View><View style={styles.rowBlock}>{first.subtitle && <Text style={styles.nestedSubtitle}>{first.subtitle}</Text>}<Text style={styles.fieldValue}>1. {first.value}</Text></View></View> : renderRow(first, 0, '')}{rows.slice(1).map((row, offset) => renderRow(row, offset + 1, rows[offset].subtitle || ''))}</React.Fragment>;
};
const unwrap = source => {
  if (!source) return [];
  let rows = Array.isArray(source) ? source : [source];
  rows = rows.flatMap(row => {
    if (Array.isArray(row?.records)) return row.records;
    if (Array.isArray(row?._records)) return row._records;
    if (row?.airway_management_records) return Array.isArray(row.airway_management_records) ? row.airway_management_records : [row.airway_management_records];
    if (row?.documentData) { const nested = row.documentData; if (Array.isArray(nested)) return nested; if (nested?.airway_management_records) return Array.isArray(nested.airway_management_records) ? nested.airway_management_records : [nested.airway_management_records]; return [nested]; }
    return [row];
  });
  return rows.filter(row => row && typeof row === 'object');
};

const AirwayManagementDocumentPDFTemplate = ({ document: documentProp, data: dataProp, templateData }) => {
  const records = React.useMemo(() => unwrap(documentProp ?? dataProp ?? templateData), [documentProp, dataProp, templateData]);
  if (!records.length) return <Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Airway Management Records</Text></View><Text style={styles.noData}>No airway management records available</Text></Page></Document>;
  return <Document>{records.flatMap((record, recordIndex) => PAGE_GROUPS.map((indexes, pageIndex) => {
    const visible = indexes.map(index => ({ section: SECTIONS[index], index, fields: SECTIONS[index].fields.filter(([field]) => fieldHasVal(record, field)) })).filter(item => item.fields.length);
    if (!visible.length) return null;
    return <Page key={`${recordIndex}-${pageIndex}`} size="LETTER" style={styles.page}>{pageIndex === 0 && <View style={styles.documentHeader}><Text style={styles.documentTitle}>Airway Management Records</Text></View>}{pageIndex === 0 && <View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Airway Management Record {recordIndex + 1}</Text></View>}{visible.map(({ section, index, fields }) => <View key={`${index}-${section.title}`} style={styles.section}><View wrap={false}><Text style={styles.sectionTitle}>{section.title}</Text></View>{fields.map((config, fieldIndex) => renderField(config, record[config[0]], `${index}-${fieldIndex}`, section.title))}</View>)}</Page>;
  }))}</Document>;
};

export default AirwayManagementDocumentPDFTemplate;

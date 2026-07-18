import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const COLLECTION = 'bronchial_hygiene_therapy';
const COMMA_SPLIT_FIELDS = ['sputumCharacteristics'];
const ARRAY_FIELDS = new Set(['posturalDrainagePositions']);
const OBJECT_FIELDS = new Set([]);
const NARRATIVE_FIELDS = new Set(['sputumCharacteristics']);
const DATE_FIELDS = new Set(['therapyDate']);
const ZERO_SENTINEL_FIELDS = new Set(['postTherapySpO2', 'mieInsufflationPressureCmH2O', 'mieExsufflationPressureCmH2O', 'postTherapyPeakCoughFlowLPM']);
const KEY_OVERRIDES = {};
const LABELS = {
  therapyDate: 'Therapy Date', primaryIndication: 'Primary Indication', baselineSpO2: 'Baseline SpO2', postTherapySpO2: 'Post-Therapy SpO2',
  chestPhysiotherapyTechnique: 'Chest Physiotherapy Technique', posturalDrainagePositions: 'Postural Drainage Positions',
  percussionDurationMinutes: 'Percussion Duration (Minutes)', highFrequencyChestWallOscillation: 'High Frequency Chest Wall Oscillation',
  hfcwoFrequencyHz: 'HFCWO Frequency (Hz)', hfcwoPressureLevel: 'HFCWO Pressure Level',
  positiveExpiratoryPressureDevice: 'Positive Expiratory Pressure Device', pepPressureRangeCmH2O: 'PEP Pressure Range (cmH2O)',
  activeBreathingCycleCompleted: 'Active Breathing Cycle Completed', autogenicDrainagePhase: 'Autogenic Drainage Phase',
  mechanicalInsufflationExsufflation: 'Mechanical Insufflation-Exsufflation', mieInsufflationPressureCmH2O: 'MIE Insufflation Pressure (cmH2O)',
  mieExsufflationPressureCmH2O: 'MIE Exsufflation Pressure (cmH2O)', sputumCharacteristics: 'Sputum Characteristics', sputumVolumeML: 'Sputum Volume (mL)',
  preTherapyPeakCoughFlowLPM: 'Pre-Therapy Peak Cough Flow (LPM)', postTherapyPeakCoughFlowLPM: 'Post-Therapy Peak Cough Flow (LPM)',
  auscultationFindingsPreTherapy: 'Auscultation Findings Pre-Therapy', auscultationFindingsPostTherapy: 'Auscultation Findings Post-Therapy',
  nebulizedMucolyticAgent: 'Nebulized Mucolytic Agent', bronchodilatorPretreatment: 'Bronchodilator Pretreatment', therapyToleranceScore: 'Therapy Tolerance Score',
};
const SECTIONS = [
  { title: 'Session', fields: ['therapyDate', 'primaryIndication', 'therapyToleranceScore'] },
  { title: 'Oxygenation', fields: ['baselineSpO2', 'postTherapySpO2'] },
  { title: 'Chest Physiotherapy', fields: ['chestPhysiotherapyTechnique', 'percussionDurationMinutes'] },
  { title: 'Postural Drainage Positions', fields: ['posturalDrainagePositions'] },
  { title: 'HFCWO', fields: ['highFrequencyChestWallOscillation', 'hfcwoFrequencyHz', 'hfcwoPressureLevel'] },
  { title: 'PEP and Breathing', fields: ['positiveExpiratoryPressureDevice', 'pepPressureRangeCmH2O', 'activeBreathingCycleCompleted', 'autogenicDrainagePhase'] },
  { title: 'Mechanical Insufflation-Exsufflation', fields: ['mechanicalInsufflationExsufflation', 'mieInsufflationPressureCmH2O', 'mieExsufflationPressureCmH2O'] },
  { title: 'Sputum and Cough', fields: ['sputumCharacteristics', 'sputumVolumeML', 'preTherapyPeakCoughFlowLPM', 'postTherapyPeakCoughFlowLPM'] },
  { title: 'Auscultation', fields: ['auscultationFindingsPreTherapy', 'auscultationFindingsPostTherapy'] },
  { title: 'Medications', fields: ['nebulizedMucolyticAgent', 'bronchodilatorPretreatment'] },
];
const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.32, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', textAlign: 'center', borderBottom: '2pt solid #000000', paddingBottom: 6, marginBottom: 14 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '1pt solid #000000', paddingBottom: 4 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '1pt solid #000000', paddingBottom: 2, marginBottom: 6 },
  fieldGroup: { marginBottom: 7 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', borderBottom: '0.5pt solid #999999', paddingBottom: 1, marginBottom: 3 },
  subtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', marginTop: 3, marginBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.32, marginBottom: 4, paddingLeft: 10 },
  noData: { fontSize: 14, marginTop: 40, textAlign: 'center' },
});
const hasValue = value => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.some(hasValue)) && (typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(hasValue));
const isEpochDate = value => /^1970-01-01/.test(String(value?.$date || value || ''));
const formatDate = value => { const raw = value?.$date || value, match = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!match) return String(raw || ''); const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`); return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); };
const displayValue = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const humanizeKey = key => { if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key ?? '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const objectLeaves = (value, labelText = '') => {
  if (!hasValue(value)) return [];
  if (Array.isArray(value)) return value.flatMap(item => hasValue(item) ? (typeof item === 'object' ? objectLeaves(item, labelText) : [{ label: labelText, value: item }]) : []);
  if (typeof value === 'object') return Object.entries(value).flatMap(([key, child]) => { const childLabel = typeof child === 'object' && child !== null && !Array.isArray(child) ? (labelText ? `${labelText} - ${humanizeKey(key)}` : humanizeKey(key)) : humanizeKey(key); return objectLeaves(child, childLabel); });
  return [{ label: labelText, value }];
};
const parseLabel = text => { const match = String(text || '').match(/^([A-Z][A-Za-z0-9 /&()'"-]{1,60}?):\s+([\s\S]+)$/); return match ? { subtitle: match[1].trim(), value: match[2].trim() } : { subtitle: '', value: String(text || '').trim() }; };
const splitClauses = (text, splitCommas) => {
  const source = String(text || ''); if (!source.trim()) return []; const output = []; let start = 0; let depth = 0;
  const push = end => { const piece = source.slice(start, end).trim(); if (piece) output.push(piece); };
  for (let index = 0; index < source.length; index += 1) { const character = source[index]; if (character === '(') { depth += 1; continue; } if (character === ')') { depth = Math.max(0, depth - 1); continue; } if (depth) continue; const prefix = source.slice(0, index + 1), suffix = source.slice(index + 1); const protectedPeriod = character === '.' && (/\b(?:Dr|Mr|Mrs|Ms|Prof|Rev|Gen|Col|Sgt|St|Jr|Sr|vs|etc)\.$/.test(prefix) || /(?:^|\s)[A-Z]\.$/.test(prefix) && /^\s+[A-Z][A-Za-z'-]+,\s*(?:MD|DO|PhD|PharmD|PA|RN|NP|DDS|DMD|DVM|JD|FACP|FCAP|FACS|MPH|MBA|MSN|BSN|CSFA|CRNA)\b/.test(suffix)); const sentenceBreak = !protectedPeriod && (character === '.' || character === ';') && (index + 1 === source.length || /\s/.test(source[index + 1])); const commaBreak = splitCommas && character === ',' && !(/\d/.test(source[index - 1] || '') && /\d/.test(source[index + 1] || '')) && !/^\s*(?:and|or)\b/i.test(suffix) && (index + 1 === source.length || /\s/.test(source[index + 1])); if (!sentenceBreak && !commaBreak) continue; push(index); start = index + 1; }
  push(source.length); return output;
};
const unwrapRecords = source => { if (!source) return []; const queue = Array.isArray(source) ? [...source] : [source], records = []; while (queue.length) { const value = queue.shift(); if (!value) continue; if (Array.isArray(value)) { queue.unshift(...value); continue; } if (value[COLLECTION] !== undefined) { queue.unshift(value[COLLECTION]); continue; } if (value.documentData !== undefined) { queue.unshift(value.documentData); continue; } if (value.data !== undefined && !Object.keys(LABELS).some(field => hasValue(value[field]))) { queue.unshift(value.data); continue; } if (value.records !== undefined) { queue.unshift(value.records); continue; } if (typeof value === 'object') records.push(value); } return records.filter(record => Object.keys(LABELS).some(field => hasValue(record[field]))); };
const leafView = leaf => { const parsed = typeof leaf.value === 'string' ? parseLabel(leaf.value) : { subtitle: '', value: leaf.value }; const labeled = !!parsed.subtitle; const effectiveRaw = labeled ? parsed.value : leaf.value; const label = labeled ? (leaf.label ? `${leaf.label} - ${parsed.subtitle}` : parsed.subtitle) : leaf.label; return { label, effectiveRaw }; };
const rowsFor = (record, field) => { const value = record[field]; if (ZERO_SENTINEL_FIELDS.has(field) && (value === 0 || value === '0')) return []; if (!hasValue(value)) return []; if (DATE_FIELDS.has(field)) return isEpochDate(value) ? [] : [{ subtitle: '', value: formatDate(value) }]; if (ARRAY_FIELDS.has(field)) return value.filter(hasValue).map(item => { const parsed = typeof item === 'string' ? parseLabel(item) : { subtitle: '', value: item }; return parsed.subtitle ? { subtitle: parsed.subtitle, value: parsed.value } : { subtitle: '', value: displayValue(item) }; }); if (OBJECT_FIELDS.has(field)) return objectLeaves(value).map(leaf => { const view = leafView(leaf); return { subtitle: view.label, value: /^\d{4}-\d{2}-\d{2}/.test(String(view.effectiveRaw).trim()) ? formatDate(view.effectiveRaw) : displayValue(view.effectiveRaw) }; }); if (NARRATIVE_FIELDS.has(field)) return splitClauses(value, COMMA_SPLIT_FIELDS.includes(field)).map(text => parseLabel(text)); return [{ subtitle: '', value: displayValue(value) }]; };
const renderSection = (record, section, key) => { const fields = section.fields.filter(field => rowsFor(record, field).length); if (!fields.length) return null; const units = fields.flatMap(field => { const rows = rowsFor(record, field), showLabel = LABELS[field] !== section.title; return rows.map((row, index) => { const prior = index > 0 ? rows[index - 1].subtitle : null; return <View style={styles.fieldGroup} key={`${field}-${index}`} wrap={false}>{showLabel && index === 0 && <Text style={styles.fieldLabel}>{LABELS[field]}</Text>}{row.subtitle && row.subtitle !== prior && <Text style={styles.subtitle}>{row.subtitle}</Text>}<Text style={styles.fieldValue}>{index + 1}. {row.value}</Text></View>; }); }); const [first, ...rest] = units; return <View style={styles.section} key={key}><View wrap={false}><Text style={styles.sectionTitle}>{section.title}</Text>{first}</View>{rest}</View>; };

const BronchialHygieneTherapyDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp || data || templateData);
  if (!records.length) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Bronchial Hygiene Therapy</Text><Text style={styles.noData}>No bronchial hygiene therapy data available</Text></Page></Document>;
  return <Document><Page size="A4" style={styles.page} wrap><Text style={styles.documentTitle}>Bronchial Hygiene Therapy</Text>{records.map((record, index) => <React.Fragment key={record._id?.$oid || String(record._id || index)}><View style={styles.recordHeader} wrap={false}><Text style={styles.recordTitle}>Bronchial Hygiene Therapy {index + 1}</Text></View>{SECTIONS.map((section, sectionIndex) => renderSection(record, section, sectionIndex))}</React.Fragment>)}</Page></Document>;
};
export default BronchialHygieneTherapyDocumentPDFTemplate;

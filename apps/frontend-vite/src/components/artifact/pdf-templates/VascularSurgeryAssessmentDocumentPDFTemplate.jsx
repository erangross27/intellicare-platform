import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, color: '#000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 2 },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 2 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#ccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666' },
});

const SECTION_TITLES = {
  'vascular-history': 'Vascular History', 'arterial-perfusion': 'Arterial Perfusion Measurements',
  'pulse-examination': 'Pulse Examination', 'duplex-ultrasound': 'Duplex Ultrasound Findings',
  'wound-healing': 'Wound Healing Status', 'aneurysm-assessment': 'Aneurysm Assessment',
  'venous-assessment': 'Venous Assessment', 'classification-grafts': 'Classification & Grafts',
  'arterial-calcification': 'Arterial Calcification', 'limb-salvage': 'Limb Salvage Potential',
  'anticoagulation-symptoms': 'Anticoagulation & Symptoms', 'segmental-pressures': 'Segmental Pressures',
  'endovascular-interventions': 'Prior Endovascular Interventions', 'dvt-risk-factors': 'DVT Risk Factors',
};
const FIELD_LABELS = {
  patientVascularHistory: 'Vascular History', ankleBrachialIndex: 'Ankle-Brachial Index (ABI)',
  toeBrachialIndex: 'Toe-Brachial Index (TBI)', transcutaneousOxygenPressure: 'Transcutaneous Oxygen Pressure (TcPO2, mmHg)',
  carotidStenosisPercentage: 'Carotid Stenosis (%)', claudicationDistance: 'Claudication Distance (m)',
  pulsePalpationFindings: 'Pulse Palpation Findings', duplexUltrasoundFindings: 'Duplex Ultrasound Findings',
  woundHealingStatus: 'Wound Healing Status', aneurysmDiameter: 'Aneurysm Diameter (cm)', aneurysmLocation: 'Aneurysm Location',
  venousRefluxDuration: 'Venous Reflux Duration (s)', ceapClassification: 'CEAP Classification', varicoseVeinDistribution: 'Varicose Vein Distribution',
  rutherfordClassification: 'Rutherford Classification', graftPatencyStatus: 'Graft Patency Status',
  arterialCalcificationSeverity: 'Arterial Calcification Severity', limbSalvagePotential: 'Limb Salvage Potential',
  anticoagulationRegimen: 'Anticoagulation Regimen', restPainPresent: 'Rest Pain Present',
  segmentalPressures: 'Segmental Pressures', priorEndovascularInterventions: 'Prior Endovascular Interventions', dvtRiskFactors: 'DVT Risk Factors',
};
const SECTION_FIELDS = {
  'vascular-history': ['patientVascularHistory'],
  'arterial-perfusion': ['ankleBrachialIndex', 'toeBrachialIndex', 'transcutaneousOxygenPressure', 'carotidStenosisPercentage', 'claudicationDistance'],
  'pulse-examination': ['pulsePalpationFindings'], 'duplex-ultrasound': ['duplexUltrasoundFindings'],
  'wound-healing': ['woundHealingStatus'], 'aneurysm-assessment': ['aneurysmDiameter', 'aneurysmLocation'],
  'venous-assessment': ['venousRefluxDuration', 'ceapClassification', 'varicoseVeinDistribution'],
  'classification-grafts': ['rutherfordClassification', 'graftPatencyStatus'],
  'arterial-calcification': ['arterialCalcificationSeverity'], 'limb-salvage': ['limbSalvagePotential'],
  'anticoagulation-symptoms': ['anticoagulationRegimen', 'restPainPresent'], 'segmental-pressures': ['segmentalPressures'],
  'endovascular-interventions': ['priorEndovascularInterventions'], 'dvt-risk-factors': ['dvtRiskFactors'],
};
const SECTION_ORDER = Object.keys(SECTION_FIELDS);
const SENTENCE_FIELDS = new Set(['patientVascularHistory', 'pulsePalpationFindings', 'woundHealingStatus', 'duplexUltrasoundFindings', 'limbSalvagePotential', 'arterialCalcificationSeverity', 'anticoagulationRegimen']);
const ARRAY_FIELDS = new Set(['segmentalPressures', 'priorEndovascularInterventions', 'dvtRiskFactors']);
const COMMA_ARRAY_FIELDS = new Set(['patientVascularHistory', 'pulsePalpationFindings', 'woundHealingStatus']);
const HIDE_ZERO_FIELDS = new Set(['ankleBrachialIndex', 'toeBrachialIndex', 'transcutaneousOxygenPressure', 'carotidStenosisPercentage', 'claudicationDistance', 'aneurysmDiameter', 'venousRefluxDuration']);

const arrItemText = item => { if (item === null || item === undefined) return ''; if (typeof item === 'object') return Object.values(item).filter(value => value !== null && value !== undefined && value !== '').map(String).join(' - '); return String(item); };
const hasValue = (field, value) => { if (HIDE_ZERO_FIELDS.has(field) && value === 0) return false; if (ARRAY_FIELDS.has(field)) return Array.isArray(value) && value.some(item => arrItemText(item).trim()); if (value === null || value === undefined || value === '') return false; if (typeof value === 'string') return value.trim() !== ''; return true; };
const formatValue = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const parseLabel = text => { const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#:'"-]{1,80}?):\s+([\s\S]*)$/); return match ? { label: match[1].trim(), value: match[2].trim() } : { label: '', value: String(text || '').trim() }; };
const splitBySentence = text => String(text || '').split(/;\s+|(?<!\d)\.(?:\s+)/).map(item => item.trim()).filter(Boolean);
const splitByComma = text => { const values = []; let current = ''; let depth = 0; for (const character of String(text || '')) { if (character === '(') depth += 1; if (character === ')') depth = Math.max(0, depth - 1); if (character === ',' && depth === 0) { if (current.trim()) values.push(current.trim()); current = ''; } else current += character; } if (current.trim()) values.push(current.trim()); return values.length ? values : [String(text || '').trim()]; };
const fieldRows = (field, value) => {
  if (ARRAY_FIELDS.has(field)) return (Array.isArray(value) ? value : [value]).map(arrItemText).filter(Boolean).map(item => parseLabel(item));
  const text = formatValue(value);
  if (!SENTENCE_FIELDS.has(field)) return [{ label: '', value: text }];
  return splitBySentence(text).flatMap(clause => { const parsed = parseLabel(clause); const items = COMMA_ARRAY_FIELDS.has(field) ? splitByComma(parsed.value) : [parsed.value]; return items.map(item => ({ label: parsed.label, value: item })); });
};
const chunk = values => { const chunks = []; for (let index = 0; index < values.length; index += 6) chunks.push(values.slice(index, index + 6)); return chunks; };
const unwrapRecords = source => (Array.isArray(source) ? source : source ? [source] : []).flatMap(record => {
  if (Array.isArray(record?.wrapRecordsIntoSingleDocument)) return record.wrapRecordsIntoSingleDocument;
  if (Array.isArray(record?.records || record?._records)) return record.records || record._records;
  if (record?.vascular_surgery_assessment) return Array.isArray(record.vascular_surgery_assessment) ? record.vascular_surgery_assessment : [record.vascular_surgery_assessment];
  if (record?.documentData) return Array.isArray(record.documentData) ? record.documentData : record.documentData?.vascular_surgery_assessment ? (Array.isArray(record.documentData.vascular_surgery_assessment) ? record.documentData.vascular_surgery_assessment : [record.documentData.vascular_surgery_assessment]) : [record.documentData];
  return [record];
}).filter(record => record && typeof record === 'object');

const renderField = (record, field, sectionTitle, firstField) => {
  const rows = fieldRows(field, record[field]); const groups = [];
  rows.forEach(row => { const last = groups[groups.length - 1]; if (last && last.label === row.label) last.values.push(row.value); else groups.push({ label: row.label, values: [row.value] }); });
  const blocks = groups.flatMap(group => chunk(group.values).map((values, index) => ({ label: index === 0 ? group.label : '', values })));
  return blocks.map((block, blockIndex) => <View key={`${field}-${blockIndex}`} wrap={false}>{firstField && blockIndex === 0 && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}{blockIndex === 0 && <Text style={styles.fieldLabel}>{FIELD_LABELS[field] || field}</Text>}{block.label && <Text style={styles.subLabel}>{block.label}</Text>}{block.values.map((value, valueIndex) => <Text key={valueIndex} style={styles.value}>{valueIndex + 1}. {value}</Text>)}</View>);
};

const VascularSurgeryAssessmentDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp ?? data ?? templateData);
  return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Vascular Surgery Assessment</Text>{records.length ? records.map((record, recordIndex) => <React.Fragment key={recordIndex}><Text style={styles.recordTitle}>Vascular Surgery Assessment {(record._originalIdx ?? recordIndex) + 1}</Text>{SECTION_ORDER.map(sectionId => { const fields = SECTION_FIELDS[sectionId].filter(field => hasValue(field, record[field])); if (!fields.length) return null; return <View key={sectionId} style={styles.section}>{fields.flatMap((field, fieldIndex) => renderField(record, field, SECTION_TITLES[sectionId], fieldIndex === 0))}</View>; })}</React.Fragment>) : <Text style={styles.noData}>No vascular surgery assessment records available</Text>}<Text fixed style={styles.footer}>Vascular Surgery Assessment</Text></Page></Document>;
};

export default VascularSurgeryAssessmentDocumentPDFTemplate;

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 64, fontFamily: 'Helvetica', fontSize: 14, color: '#000', lineHeight: 1.4 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000' },
  fieldBox: { marginBottom: 7 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999' },
  value: { fontSize: 14, paddingLeft: 8, marginBottom: 2 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 9, color: '#666', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#ccc', paddingTop: 6 },
  noData: { fontSize: 14, textAlign: 'center', marginTop: 40, color: '#666' },
});

const SECTION_FIELDS = {
  'filling-phase': ['bladderCapacity', 'firstSensationVolume', 'firstDesireToVoidVolume', 'strongDesireToVoidVolume', 'bladderCompliance', 'fillingRate'],
  'voiding-phase': ['detrusorPressureAtMaxFlow', 'maximumFlowRate', 'averageFlowRate', 'voidedVolume', 'postVoidResidualVolume', 'voidingEfficiency'],
  'detrusor-assessment': ['detrusorOveractivity', 'detrusorContractilityIndex', 'detrusorSphincterDyssynergia'],
  'obstruction-incontinence': ['bladderOutletObstruction', 'stressIncontinence', 'leakPointPressure', 'abramsPhanickerNumber', 'schaferGrade'],
  'additional-studies': ['urethralPressureProfile', 'electromyographyFindings'],
};
const SECTION_TITLES = { 'filling-phase': 'Filling Phase', 'voiding-phase': 'Voiding Phase', 'detrusor-assessment': 'Detrusor Assessment', 'obstruction-incontinence': 'Obstruction & Incontinence', 'additional-studies': 'Additional Studies' };
const FIELD_LABELS = { bladderCapacity: 'Bladder Capacity', firstSensationVolume: 'First Sensation Volume', firstDesireToVoidVolume: 'First Desire to Void Volume', strongDesireToVoidVolume: 'Strong Desire to Void Volume', bladderCompliance: 'Bladder Compliance', fillingRate: 'Filling Rate', detrusorPressureAtMaxFlow: 'Detrusor Pressure at Max Flow', maximumFlowRate: 'Maximum Flow Rate', averageFlowRate: 'Average Flow Rate', voidedVolume: 'Voided Volume', postVoidResidualVolume: 'Post-Void Residual Volume', voidingEfficiency: 'Voiding Efficiency', detrusorOveractivity: 'Detrusor Overactivity', detrusorContractilityIndex: 'Detrusor Contractility Index', detrusorSphincterDyssynergia: 'Detrusor Sphincter Dyssynergia', bladderOutletObstruction: 'Bladder Outlet Obstruction', stressIncontinence: 'Stress Incontinence', leakPointPressure: 'Leak Point Pressure', abramsPhanickerNumber: 'Abrams-Griffiths Number', schaferGrade: 'Schafer Grade', urethralPressureProfile: 'Urethral Pressure Profile', electromyographyFindings: 'Electromyography Findings' };
const BOOLEAN_FIELDS = new Set(['detrusorOveractivity', 'bladderOutletObstruction', 'stressIncontinence', 'detrusorSphincterDyssynergia']);
const NUMBER_FIELDS = new Set(['bladderCapacity', 'firstSensationVolume', 'firstDesireToVoidVolume', 'strongDesireToVoidVolume', 'bladderCompliance', 'fillingRate', 'detrusorPressureAtMaxFlow', 'maximumFlowRate', 'averageFlowRate', 'voidedVolume', 'postVoidResidualVolume', 'voidingEfficiency', 'detrusorContractilityIndex', 'leakPointPressure', 'abramsPhanickerNumber']);
const UNIT_MAP = { bladderCapacity: 'mL', firstSensationVolume: 'mL', firstDesireToVoidVolume: 'mL', strongDesireToVoidVolume: 'mL', bladderCompliance: 'mL/cmH\u2082O', fillingRate: 'mL/min', detrusorPressureAtMaxFlow: 'cmH\u2082O', maximumFlowRate: 'mL/s', averageFlowRate: 'mL/s', voidedVolume: 'mL', postVoidResidualVolume: 'mL', voidingEfficiency: '%', leakPointPressure: 'cmH\u2082O' };
const hasVal = (field, value) => { if (value === null || value === undefined || value === '') return false; if (NUMBER_FIELDS.has(field)) return Number(value) !== 0 && Number.isFinite(Number(value)); if (typeof value === 'string') return value.trim() !== ''; return true; };
const safeString = value => String(value ?? '').replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'");
const splitText = value => String(value || '').split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\d)\.(?:\s+)|;\s+/).map(item => item.trim()).filter(Boolean);
const display = (field, value) => BOOLEAN_FIELDS.has(field) ? (value ? 'Yes' : 'No') : UNIT_MAP[field] ? `${value} ${UNIT_MAP[field]}` : safeString(value);

const fieldUnit = (field, value) => { const rows = typeof value === 'string' ? splitText(value) : [display(field, value)]; return <View key={field} style={styles.fieldBox}><View wrap={false}><Text style={styles.fieldLabel}>{FIELD_LABELS[field] || field}</Text><Text style={styles.value}>1. {rows[0]}</Text></View>{rows.slice(1).map((row, index) => <Text key={index} style={styles.value}>{index + 2}. {row}</Text>)}</View>; };
const renderSection = (record, sid) => { const units = (SECTION_FIELDS[sid] || []).filter(field => hasVal(field, record[field])).map(field => fieldUnit(field, record[field])); if (!units.length) return null; return <View key={sid} style={styles.section}><View wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>{units[0]}</View>{units.slice(1)}</View>; };
const unwrapRecords = source => (Array.isArray(source) ? source : source ? [source] : []).flatMap(record => { if (Array.isArray(record?.wrapRecordsIntoSingleDocument)) return record.wrapRecordsIntoSingleDocument; if (Array.isArray(record?.records || record?._records)) return record.records || record._records; if (record?.urodynamic_studies) return Array.isArray(record.urodynamic_studies) ? record.urodynamic_studies : [record.urodynamic_studies]; if (record?.documentData) return Array.isArray(record.documentData) ? record.documentData : record.documentData?.urodynamic_studies ? (Array.isArray(record.documentData.urodynamic_studies) ? record.documentData.urodynamic_studies : [record.documentData.urodynamic_studies]) : [record.documentData]; return [record]; }).filter(record => record && typeof record === 'object');

const UrodynamicStudiesDocumentPDFTemplate = ({ document: docProp, data, templateData }) => { const records = unwrapRecords(docProp ?? data ?? templateData); return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Urodynamic Studies</Text>{records.length ? records.map((record, index) => <React.Fragment key={index}><View wrap={false} break={index > 0}><Text style={styles.recordTitle}>Urodynamic Study {index + 1}</Text></View>{Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}</React.Fragment>) : <Text style={styles.noData}>No urodynamic study data available.</Text>}<Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text></Page></Document>; };

export default UrodynamicStudiesDocumentPDFTemplate;

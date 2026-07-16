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

const SECTION_TITLES = { cc: 'Chief Complaint & Symptoms', prostate: 'Prostate Assessment', renal: 'Renal Function', stones: 'Stone Disease & Hematuria', urodynamics: 'Urodynamics Results', incontinence: 'Incontinence Assessment', cystoscopy: 'Cystoscopy Findings', bladder: 'Bladder & Renal Assessment', sexual: 'Sexual Function & Fertility' };
const FIELD_LABELS = { chiefComplaint: 'Chief Complaint', voiding: 'Voiding Symptoms', ipssScore: 'IPSS Score', psaLevel: 'PSA Level', prostateSize: 'Prostate Size', digitalRectalExam: 'Digital Rectal Exam', creativeLevel: 'Creatinine Level', estimatedGFR: 'Estimated GFR', postVoidResidual: 'Post-Void Residual', kidneyStones: 'Kidney Stones', stoneComposition: 'Stone Composition', hematuria: 'Hematuria', urodynamicsResults: 'Urodynamics Results', incontinenceType: 'Incontinence Type', padTest24Hour: '24-Hour Pad Test', cystoscopyFindings: 'Cystoscopy Findings', bladderTumor: 'Bladder Tumor', renalMass: 'Renal Mass', bosniakClassification: 'Bosniak Classification', erectileDysfunction: 'Erectile Dysfunction', iief5Score: 'IIEF-5 Score', testosteroneLevel: 'Testosterone Level', varicocele: 'Varicocele', spermAnalysis: 'Sperm Analysis' };
const SECTION_FIELDS = { cc: ['chiefComplaint', 'voiding'], prostate: ['ipssScore', 'psaLevel', 'prostateSize', 'digitalRectalExam'], renal: ['creativeLevel', 'estimatedGFR', 'postVoidResidual'], stones: ['kidneyStones', 'stoneComposition', 'hematuria'], urodynamics: ['urodynamicsResults'], incontinence: ['incontinenceType', 'padTest24Hour'], cystoscopy: ['cystoscopyFindings'], bladder: ['bladderTumor', 'renalMass', 'bosniakClassification'], sexual: ['erectileDysfunction', 'iief5Score', 'testosteroneLevel', 'varicocele', 'spermAnalysis'] };
const SECTION_ORDER = Object.keys(SECTION_FIELDS);
const BOOLEAN_FIELDS = new Set(['kidneyStones', 'hematuria', 'bladderTumor', 'renalMass', 'erectileDysfunction']);
const NUMBER_FIELDS = new Set(['ipssScore', 'psaLevel', 'prostateSize', 'creativeLevel', 'estimatedGFR', 'postVoidResidual', 'padTest24Hour', 'iief5Score', 'testosteroneLevel']);
const COMMA_ARRAY_FIELDS = new Set(['voiding', 'cystoscopyFindings']);
const UNIT_MAP = { psaLevel: 'ng/mL', prostateSize: 'g', creativeLevel: 'mg/dL', estimatedGFR: 'mL/min/1.73m\u00B2', postVoidResidual: 'mL', padTest24Hour: 'g', testosteroneLevel: 'ng/dL' };

const hasField = (field, value) => { if (value === null || value === undefined || value === '') return false; if (BOOLEAN_FIELDS.has(field)) return typeof value === 'boolean'; if (NUMBER_FIELDS.has(field)) return Number.isFinite(Number(value)) && Number(value) !== 0; return typeof value === 'string' ? Boolean(value.trim()) : true; };
const formatField = (field, value) => BOOLEAN_FIELDS.has(field) ? (value ? 'Yes' : 'No') : UNIT_MAP[field] ? `${value} ${UNIT_MAP[field]}` : String(value ?? '');
const parseLabel = text => { const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)$/); return match ? { label: match[1].trim(), value: match[2].trim() } : { label: '', value: String(text || '').trim() }; };
const splitByComma = text => { const values = []; let current = ''; let depth = 0; for (const char of String(text || '')) { if (char === '(') depth += 1; if (char === ')') depth = Math.max(0, depth - 1); if (char === ',' && depth === 0) { if (current.trim()) values.push(current.trim()); current = ''; } else current += char; } if (current.trim()) values.push(current.trim()); return values.length ? values : [String(text || '').trim()]; };
const splitEditableClauses = text => { const source = String(text || ''); const values = []; let start = 0; for (let i = 0; i < source.length; i += 1) { const char = source[i]; const boundary = i === source.length - 1 || /\s/.test(source[i + 1]); const split = (char === ';' && boundary) || (char === '.' && !/\d/.test(source[i - 1] || '') && boundary); if (!split) continue; const value = source.slice(start, i).trim(); if (value) values.push(value); start = i + 1; while (/\s/.test(source[start] || '')) start += 1; } const tail = source.slice(start).trim(); if (tail) values.push(tail); return values; };
const displayCommaItem = (source, item, index) => /^No\s+/i.test(source) && index > 0 ? `No ${item.replace(/^(?:and|or)\s+/i, '').replace(/^No\s+/i, '')}` : item;
const stringGroups = (field, value) => { const groups = []; splitEditableClauses(value).forEach(clause => { const parsed = parseLabel(clause); const items = (COMMA_ARRAY_FIELDS.has(field) ? splitByComma(parsed.value) : [parsed.value]).map((item, index) => displayCommaItem(parsed.value, item, index)); const last = groups[groups.length - 1]; if (last && last.label === parsed.label) last.values.push(...items); else groups.push({ label: parsed.label, values: items }); }); return groups; };
const unwrapRecords = source => (Array.isArray(source) ? source : source ? [source] : []).flatMap(record => { if (Array.isArray(record?.wrapRecordsIntoSingleDocument)) return record.wrapRecordsIntoSingleDocument; if (Array.isArray(record?.records || record?._records)) return record.records || record._records; if (record?.urology_consultations) return Array.isArray(record.urology_consultations) ? record.urology_consultations : [record.urology_consultations]; if (record?.documentData) return Array.isArray(record.documentData) ? record.documentData : record.documentData?.urology_consultations ? (Array.isArray(record.documentData.urology_consultations) ? record.documentData.urology_consultations : [record.documentData.urology_consultations]) : [record.documentData]; return [record]; }).filter(record => record && typeof record === 'object');

const renderField = (record, field, sectionTitle, firstField) => {
  const value = record[field]; if (!hasField(field, value)) return [];
  const groups = NUMBER_FIELDS.has(field) || BOOLEAN_FIELDS.has(field) ? [{ label: '', values: [formatField(field, value)] }] : stringGroups(field, value);
  const blocks = groups.flatMap(group => { const result = []; for (let i = 0; i < group.values.length; i += 6) result.push({ label: i === 0 ? group.label : '', values: group.values.slice(i, i + 6) }); return result; });
  return blocks.map((block, index) => <View key={`${field}-${index}`} wrap={false}>{firstField && index === 0 && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}{index === 0 && FIELD_LABELS[field].toLowerCase() !== sectionTitle.toLowerCase() && <Text style={styles.fieldLabel}>{FIELD_LABELS[field]}</Text>}{block.label && <Text style={styles.subLabel}>{block.label}</Text>}{block.values.map((item, itemIndex) => <Text key={itemIndex} style={styles.value}>{itemIndex + 1}. {item}</Text>)}</View>);
};

const UrologyConsultationsDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp ?? data ?? templateData);
  return <Document><Page size="LETTER" style={styles.page}><Text style={styles.documentTitle}>Urology Consultations</Text>{records.length ? records.map((record, index) => <React.Fragment key={index}><View wrap={false} break={index > 0}><Text style={styles.recordTitle}>Urology Consultation {index + 1}</Text></View>{SECTION_ORDER.map(sectionId => { const present = SECTION_FIELDS[sectionId].filter(field => hasField(field, record[field])); if (!present.length) return null; return <View key={sectionId} style={styles.section}>{present.flatMap((field, fieldIndex) => renderField(record, field, SECTION_TITLES[sectionId], fieldIndex === 0))}</View>; })}</React.Fragment>) : <Text style={styles.noData}>No urology consultation data available.</Text>}<Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text></Page></Document>;
};

export default UrologyConsultationsDocumentPDFTemplate;

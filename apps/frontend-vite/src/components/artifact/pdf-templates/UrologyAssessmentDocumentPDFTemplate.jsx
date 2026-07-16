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
  details: 'Assessment Details',
  diagnostics: 'Diagnostics',
  'renal-stones': 'Renal & Stones',
  clinical: 'Clinical',
  'recommendations-notes': 'Recommendations & Notes',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility',
  urodynamicStudies: 'Urodynamic Studies', cystoscopy: 'Cystoscopy', psaLevels: 'PSA Levels',
  renalFunction: 'Renal Function', stoneAnalysis: 'Stone Analysis', findings: 'Findings',
  assessment: 'Assessment', plan: 'Plan', results: 'Results', recommendations: 'Recommendations', notes: 'Notes', status: 'Status',
};
const SECTION_FIELDS = {
  details: ['date', 'provider', 'facility'],
  diagnostics: ['urodynamicStudies', 'cystoscopy', 'psaLevels'],
  'renal-stones': ['renalFunction', 'stoneAnalysis'],
  clinical: ['findings', 'assessment', 'plan', 'results'],
  'recommendations-notes': ['recommendations', 'notes', 'status'],
};
const SECTION_ORDER = ['details', 'diagnostics', 'renal-stones', 'clinical', 'recommendations-notes'];
const OBJECT_FIELDS = new Set(['urodynamicStudies', 'cystoscopy', 'psaLevels', 'renalFunction', 'stoneAnalysis', 'results']);
const COMMA_SPLIT_PATHS = new Set(['cystoscopy.bladderMucosa', 'stoneAnalysis.size', 'plan']);
const KEY_OVERRIDES = { psa: 'PSA', gfr: 'GFR', egfr: 'eGFR', bun: 'BUN', uti: 'UTI', ph: 'pH', ct: 'CT', mri: 'MRI', usg: 'USG' };

const humanizeKey = key => { if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const text = String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return text ? text[0].toUpperCase() + text.slice(1) : ''; };
const formatDate = value => { if (!value) return ''; try { const date = new Date(value.$date || value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); } };
const isEmptyDeep = value => { if (value === null || value === undefined) return true; if (typeof value === 'boolean') return false; if (typeof value === 'number') return !Number.isFinite(value); if (typeof value === 'string') return !value.trim(); if (Array.isArray(value)) return value.every(isEmptyDeep); if (typeof value === 'object') return Object.values(value).every(isEmptyDeep); return false; };
const isScalar = value => value === null || typeof value !== 'object';
const fmtScalar = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const parseLabel = text => { const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)$/); return match ? { label: match[1].trim(), value: match[2].trim() } : { label: '', value: String(text || '').trim() }; };
const splitByComma = text => { const items = []; let current = ''; let depth = 0; for (const char of String(text || '')) { if (char === '(') depth += 1; if (char === ')') depth = Math.max(0, depth - 1); if (char === ',' && depth === 0) { if (current.trim()) items.push(current.trim()); current = ''; } else current += char; } if (current.trim()) items.push(current.trim()); return items.length ? items : [String(text || '').trim()]; };
const splitEditableClauses = text => { const source = String(text || ''); const clauses = []; let start = 0; for (let i = 0; i < source.length; i += 1) { const char = source[i]; const boundary = i === source.length - 1 || /\s/.test(source[i + 1]); const split = (char === ';' && boundary) || (char === '.' && !/\d/.test(source[i - 1] || '') && boundary); if (!split) continue; const value = source.slice(start, i).trim(); if (value) clauses.push(value); start = i + 1; while (/\s/.test(source[start] || '')) start += 1; } const tail = source.slice(start).trim(); if (tail) clauses.push(tail); return clauses; };
const stringGroups = (field, value) => { const groups = []; splitEditableClauses(value).forEach(clause => { const parsed = parseLabel(clause); const values = (COMMA_SPLIT_PATHS.has(field) ? splitByComma(parsed.value) : [parsed.value]).map(item => item.replace(/^\d+\.\s+/, '')); const last = groups[groups.length - 1]; if (last && last.label === parsed.label) last.values.push(...values); else groups.push({ label: parsed.label, values }); }); return groups; };
const chunk = values => { const result = []; for (let i = 0; i < values.length; i += 6) result.push(values.slice(i, i + 6)); return result; };

const flattenObjectGroups = (rootField, value, path = []) => {
  if (isEmptyDeep(value)) return [];
  if (isScalar(value)) {
    const pathKey = [rootField, ...path].join('.');
    const label = /^\d+$/.test(String(path[path.length - 1])) ? '' : humanizeKey(path[path.length - 1]);
    const groups = typeof value === 'string' ? stringGroups(pathKey, value) : [{ label: '', values: [fmtScalar(value)] }];
    return groups.map(group => ({ label: group.label || label, values: group.values }));
  }
  if (Array.isArray(value)) {
    const present = value.filter(item => !isEmptyDeep(item));
    if (present.every(isScalar)) {
      const label = humanizeKey(path[path.length - 1]);
      return [{ label, values: present.flatMap(item => typeof item === 'string' ? stringGroups([rootField, ...path].join('.'), item).flatMap(group => group.values) : [fmtScalar(item)]) }];
    }
    return present.flatMap((item, index) => flattenObjectGroups(rootField, item, [...path, String(index)]));
  }
  return Object.entries(value).filter(([, child]) => !isEmptyDeep(child)).flatMap(([key, child]) => flattenObjectGroups(rootField, child, [...path, key]));
};

const unwrapRecords = source => (Array.isArray(source) ? source : source ? [source] : []).flatMap(record => {
  if (Array.isArray(record?.wrapRecordsIntoSingleDocument)) return record.wrapRecordsIntoSingleDocument;
  if (Array.isArray(record?.records || record?._records)) return record.records || record._records;
  if (record?.urology_assessment) return Array.isArray(record.urology_assessment) ? record.urology_assessment : [record.urology_assessment];
  if (record?.documentData) return Array.isArray(record.documentData) ? record.documentData : record.documentData?.urology_assessment ? (Array.isArray(record.documentData.urology_assessment) ? record.documentData.urology_assessment : [record.documentData.urology_assessment]) : [record.documentData];
  return [record];
}).filter(record => record && typeof record === 'object');

const fieldGroups = (record, field) => {
  const value = record[field];
  if (isEmptyDeep(value)) return [];
  if (field === 'date') return [{ label: '', values: [formatDate(value)] }];
  if (field === 'recommendations') {
    const groups = [];
    (Array.isArray(value) ? value : []).forEach(item => {
      const date = item?.date ? formatDate(item.date) : '';
      const recommendation = String(item?.recommendation || '').trim();
      if (!recommendation) return;
      const last = groups[groups.length - 1];
      if (last && last.label === date) last.values.push(recommendation); else groups.push({ label: date, values: [recommendation] });
    });
    return groups;
  }
  if (OBJECT_FIELDS.has(field)) return flattenObjectGroups(field, value);
  return stringGroups(field, fmtScalar(value));
};

const renderField = (record, field, sectionTitle, firstField) => {
  const groups = fieldGroups(record, field);
  const fieldLabel = FIELD_LABELS[field] || field;
  const blocks = groups.flatMap(group => chunk(group.values).map((values, index) => ({ label: index === 0 ? group.label : '', values })));
  return blocks.map((block, index) => (
    <View key={`${field}-${index}`} wrap={false}>
      {firstField && index === 0 && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      {index === 0 && <Text style={styles.fieldLabel}>{fieldLabel}</Text>}
      {block.label && <Text style={styles.subLabel}>{block.label}</Text>}
      {block.values.map((value, valueIndex) => <Text key={valueIndex} style={styles.value}>{valueIndex + 1}. {value}</Text>)}
    </View>
  ));
};

const UrologyAssessmentDocumentPDFTemplate = ({ document: documentProp, data, templateData }) => {
  const records = unwrapRecords(documentProp ?? data ?? templateData);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Urology Assessment</Text>
        {records.length ? records.map((record, index) => (
          <React.Fragment key={index}>
            <View wrap={false} break={index > 0}><Text style={styles.recordTitle}>Urology Assessment {index + 1}</Text></View>
            {SECTION_ORDER.map(sectionId => {
              const present = SECTION_FIELDS[sectionId].filter(field => !isEmptyDeep(record[field]));
              if (!present.length) return null;
              return <View key={sectionId} style={styles.section}>{present.flatMap((field, fieldIndex) => renderField(record, field, SECTION_TITLES[sectionId], fieldIndex === 0))}</View>;
            })}
          </React.Fragment>
        )) : <Text style={styles.noData}>No urology assessment records available.</Text>}
        <Text style={styles.footer} fixed>This document contains Protected Health Information (PHI). Handle in accordance with HIPAA.</Text>
      </Page>
    </Document>
  );
};

export default UrologyAssessmentDocumentPDFTemplate;

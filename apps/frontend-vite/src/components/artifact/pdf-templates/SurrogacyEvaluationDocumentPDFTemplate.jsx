/**
 * Canonical box-free PDF for surrogacy_evaluation.
 * Mirrors SurrogacyEvaluationDocument JSX field order, grouping, and numbering.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 0, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.45, color: '#000000', backgroundColor: '#ffffff' },
  pageBody: { padding: 40, backgroundColor: '#ffffff' },
  documentHeader: { paddingBottom: 14 },
  documentTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  recordContainer: {},
  recordHeader: { paddingBottom: 8 },
  recordTitle: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  section: { paddingBottom: 8 },
  lastSection: { paddingBottom: 0 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  fieldBlock: { paddingTop: 4, paddingBottom: 2 },
  rowBlock: { paddingBottom: 2 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    paddingBottom: 2,
    marginBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    borderBottomStyle: 'solid',
  },
  nestedLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.45, paddingLeft: 8 },
  noDataText: { fontSize: 14, color: '#4b5563', paddingTop: 24 },
});

const SECTION_CONFIGS = [
  { id: 'carrier', title: 'Carrier Profile', fields: ['gestationalCarrierAge', 'gravidityParityHistory', 'previousUncomplictedLiveBirths', 'bodyMassIndexKgM2', 'cesareanSectionCount'] },
  { id: 'uterine', title: 'Uterine Assessment', fields: ['uterineAnatomyAssessment', 'endometrialThicknessMm', 'cervicalCompetenceHistory'] },
  { id: 'serology', title: 'Blood & Infectious Disease', fields: ['bloodTypeAndRhFactor', 'irregularAntibodyScreen', 'infectiousDiseasePanel', 'cytomegalovirusSerostatus', 'rubellaTiterImmunity', 'varicellaTiterImmunity'] },
  { id: 'thrombophilia', title: 'Thrombophilia & Labs', fields: ['thrombophiliaScreening', 'antiphospholipidAntibodyPanel', 'thyroidStimulatingHormoneMuL', 'hemoglobinA1cPercent'] },
  { id: 'psych', title: 'Psychological & Screening', fields: ['psychologicalClearanceStatus', 'minnesotaMultiphasicPersonalityInventoryResults', 'nicotineCotinineScreenResult', 'urineDrugScreenPanel'] },
  { id: 'obstetric', title: 'Obstetric History', fields: ['preexistingHypertensionHistory', 'gestationalDiabetesHistory', 'preeclampsiaEclampsiaHistory'] },
];

const FIELD_LABELS = {
  gestationalCarrierAge: 'Gestational Carrier Age',
  gravidityParityHistory: 'Gravidity and Parity History',
  previousUncomplictedLiveBirths: 'Previous Uncomplicated Live Births',
  bodyMassIndexKgM2: 'Body Mass Index (kg/m²)',
  cesareanSectionCount: 'Cesarean Section Count',
  uterineAnatomyAssessment: 'Uterine Anatomy Assessment',
  endometrialThicknessMm: 'Endometrial Thickness (mm)',
  cervicalCompetenceHistory: 'Cervical Competence History',
  bloodTypeAndRhFactor: 'Blood Type and Rh Factor',
  irregularAntibodyScreen: 'Irregular Antibody Screen',
  infectiousDiseasePanel: 'Infectious Disease Panel',
  cytomegalovirusSerostatus: 'Cytomegalovirus Serostatus',
  rubellaTiterImmunity: 'Rubella Titer Immunity',
  varicellaTiterImmunity: 'Varicella Titer Immunity',
  thrombophiliaScreening: 'Thrombophilia Screening',
  antiphospholipidAntibodyPanel: 'Antiphospholipid Antibody Panel',
  thyroidStimulatingHormoneMuL: 'TSH (mIU/L)',
  hemoglobinA1cPercent: 'Hemoglobin A1c (%)',
  psychologicalClearanceStatus: 'Psychological Clearance Status',
  minnesotaMultiphasicPersonalityInventoryResults: 'MMPI Results',
  nicotineCotinineScreenResult: 'Nicotine/Cotinine Screen Result',
  urineDrugScreenPanel: 'Urine Drug Screen Panel',
  preexistingHypertensionHistory: 'Pre-existing Hypertension History',
  gestationalDiabetesHistory: 'Gestational Diabetes History',
  preeclampsiaEclampsiaHistory: 'Preeclampsia/Eclampsia History',
};
const ARRAY_FIELDS = new Set();
const COMMA_ARRAY_FIELDS = new Set(['uterineAnatomyAssessment', 'bloodTypeAndRhFactor', 'infectiousDiseasePanel', 'cytomegalovirusSerostatus', 'thrombophiliaScreening']);
const KEEP_LABEL_COMMA_FIELDS = new Set();

const humanizeKey = (key) => String(key || '')
  .replace(/_/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/^./, character => character.toUpperCase());
const getPathValue = (record, path) => String(path).split('.').reduce((value, part) => value?.[part], record);
const scalarValue = (value) => {
  if (value && typeof value === 'object') {
    const numericKey = ['$numberInt', '$numberLong', '$numberDouble', '$numberDecimal'].find(key => value[key] !== undefined);
    if (numericKey) return Number(value[numericKey]);
  }
  return value;
};
const flattenLeafPaths = (value, prefix) => {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = `${prefix}.${key}`;
    if (child !== null && typeof child === 'object') return flattenLeafPaths(child, path);
    return child === '' || child === null || child === undefined ? [] : [path];
  });
};
const sectionFields = (record, section) => {
  if (section.id === 'results') return flattenLeafPaths(record?.results, 'results');
  if (section.id === 'recommendations') return Array.isArray(record?.recommendations)
    ? record.recommendations.flatMap((recommendation, index) => [
      recommendation?.recommendation ? `recommendations.${index}.recommendation` : null,
      recommendation?.date ? `recommendations.${index}.date` : null,
    ].filter(Boolean))
    : [];
  return section.fields.flatMap(field => {
    if (!ARRAY_FIELDS.has(field)) return [field];
    const values = record?.[field];
    return Array.isArray(values) ? values.map((_, index) => `${field}.${index}`) : [];
  });
};
const fieldLabel = (path) => {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];
  const parts = String(path).split('.');
  if (ARRAY_FIELDS.has(parts[0])) return FIELD_LABELS[parts[0]];
  if (parts[0] === 'recommendations') {
    const itemNumber = Number(parts[1]) + 1;
    return parts[2] === 'date' ? `Recommendation ${itemNumber} Date` : `Recommendation ${itemNumber}`;
  }
  return humanizeKey(parts[parts.length - 1]);
};
const isDateField = () => false;

const sameAsTitle = (label, title) => String(label || '').trim().toLowerCase() === String(title || '').trim().toLowerCase();

const safeString = (value) => String(scalarValue(value) ?? '')
  .replace(/\u00d7/g, 'x')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/[\u2013\u2014]/g, '-');

const hasVal = (input) => {
  const value = scalarValue(input);
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'object' ? Object.keys(value).length > 0 : true;
};

const formatDate = (value) => {
  if (!value) return '';
  try {
    const raw = value?.$date?.$numberLong ?? value?.$date ?? value;
    const date = new Date(typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw);
    if (Number.isNaN(date.getTime()) || date.getFullYear() < 1971) return '';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return safeString(value); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const delimiterWithWhitespace = /[.;]\s/;
  const result = [];
  let current = '';
  let parenthesisDepth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '(') parenthesisDepth += 1;
    else if (character === ')') parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    const isDelimiter = delimiterWithWhitespace.test(`${character}${text[index + 1] || ''}`) && parenthesisDepth === 0;
    const isProtectedTitle = character === '.' && /\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)$/.test(current);
    if (isDelimiter && !isProtectedTitle) {
      if (current.trim()) result.push(current.trim());
      current = '';
      while (/\s/.test(text[index + 1] || '')) index += 1;
    } else current += character;
  }
  const tail = current.replace(/[.;]+$/, '').trim();
  if (tail) result.push(tail);
  return result;
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const match = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (!match) return { isLabeled: false, label: '', value: text };
  return { isLabeled: true, label: match[1].trim(), value: match[2].trim() };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '(') { depth += 1; current += character; continue; }
    if (character === ')') { depth = Math.max(0, depth - 1); current += character; continue; }
    if (character !== ',' || depth !== 0) { current += character; continue; }
    const before = current.trim();
    const after = text.slice(index + 1);
    const afterTrimmed = after.trimStart();
    const numericThousands = /\d$/.test(before) && /^\d{3}\b/.test(afterTrimmed);
    const noFollowingSpace = after.length === afterTrimmed.length;
    if (numericThousands || noFollowingSpace) current += character;
    else { if (before) result.push(before); current = ''; }
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [text];
};

const buildStringGroups = (text, fieldName = '') => {
  const groups = [];
  splitBySentence(text).forEach(sentence => {
    const parsed = parseLabel(sentence);
    const splitCommas = (parsed.isLabeled && !KEEP_LABEL_COMMA_FIELDS.has(fieldName.split('.')[0])) || COMMA_ARRAY_FIELDS.has(fieldName);
    const source = parsed.isLabeled ? parsed.value : sentence;
    const rows = (splitCommas ? splitByComma(source) : [source])
      .map(value => safeString(value).replace(/[;.]+$/, '').trim())
      .filter(Boolean);
    if (!rows.length) return;
    if (!parsed.isLabeled && groups.length && !groups[groups.length - 1].label) groups[groups.length - 1].rows.push(...rows);
    else groups.push({ label: parsed.isLabeled ? parsed.label : '', rows });
  });
  return groups;
};

const fieldGroups = (record, config) => {
  const value = scalarValue(getPathValue(record, config.key));
  if (!hasVal(value)) return [];
  if (config.kind === 'date') {
    const formatted = formatDate(value);
    return formatted ? [{ label: '', rows: [formatted] }] : [];
  }
  if (typeof value === 'boolean') return [{ label: '', rows: [value ? 'Yes' : 'No'] }];
  return buildStringGroups(safeString(value), config.key);
};

const renderFieldNodes = (record, config, sectionTitle) => {
  const groups = fieldGroups(record, config);
  if (!groups.length) return [];
  const nodes = [];
  let firstFieldRow = true;
  groups.forEach((group, groupIndex) => {
    group.rows.forEach((row, rowIndex) => {
      const firstGroupRow = rowIndex === 0;
      nodes.push(
        <View key={`${config.key}-${groupIndex}-${rowIndex}`} style={firstFieldRow ? styles.fieldBlock : styles.rowBlock} wrap={false}>
          {firstFieldRow && !sameAsTitle(config.label, sectionTitle) ? <Text style={styles.fieldLabel}>{config.label}</Text> : null}
          {firstGroupRow && group.label ? <Text style={styles.nestedLabel}>{safeString(group.label)}</Text> : null}
          <Text style={styles.listItem}>{rowIndex + 1}. {safeString(row)}</Text>
        </View>,
      );
      firstFieldRow = false;
    });
  });
  return nodes;
};

const renderSection = (record, section) => {
  const configs = sectionFields(record, section).map(key => ({
    key,
    label: fieldLabel(key),
    kind: isDateField(key) ? 'date' : 'string',
  }));
  const nodes = configs.flatMap(config => renderFieldNodes(record, config, section.title));
  if (!nodes.length) return null;
  return (
    <View key={section.id} style={section.id === 'obstetric' ? [styles.section, styles.lastSection] : styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        {React.cloneElement(nodes[0], { key: `${section.id}-first` })}
      </View>
      {nodes.slice(1).map((node, index) => React.cloneElement(node, { key: `${section.id}-node-${index + 1}` }))}
    </View>
  );
};

const unwrapRecords = (data) => {
  if (!data) return [];
  const input = Array.isArray(data) ? data : [data];
  return input.flatMap(record => {
    if (record?.surrogacy_evaluation) return Array.isArray(record.surrogacy_evaluation) ? record.surrogacy_evaluation : [record.surrogacy_evaluation];
    if (record?.documentData) {
      const nested = record.documentData;
      if (Array.isArray(nested)) return nested;
      if (nested?.surrogacy_evaluation) return Array.isArray(nested.surrogacy_evaluation) ? nested.surrogacy_evaluation : [nested.surrogacy_evaluation];
      return [nested];
    }
    return [record];
  }).filter(record => record && typeof record === 'object');
};

const SurrogacyEvaluationDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);
  return (
    <Document>
      {records.length ? records.map((record, index) => (
        <Page size="A4" style={styles.page} key={record._id?.$oid || record._id || index}>
          <View style={styles.pageBody}>
            {index === 0 ? (
              <View style={styles.documentHeader} wrap={false}>
                <Text style={styles.documentTitle}>Surrogacy Evaluation</Text>
              </View>
            ) : null}
            <View style={styles.recordContainer}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>Surrogacy Evaluation {index + 1}</Text>
              </View>
              {SECTION_CONFIGS.map(section => renderSection(record, section))}
            </View>
          </View>
        </Page>
      )) : (
        <Page size="A4" style={styles.page}>
          <View style={styles.pageBody}>
            <View style={styles.documentHeader} wrap={false}>
              <Text style={styles.documentTitle}>Surrogacy Evaluation</Text>
            </View>
            <Text style={styles.noDataText}>No surrogacy evaluation records available.</Text>
          </View>
        </Page>
      )}
    </Document>
  );
};

export default SurrogacyEvaluationDocumentPDFTemplate;

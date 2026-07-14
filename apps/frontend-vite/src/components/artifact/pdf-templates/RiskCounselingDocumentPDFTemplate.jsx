import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 48, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.35, color: '#000' },
  documentHeader: { marginBottom: 20 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#000', borderBottomStyle: 'solid', marginBottom: 12 },
  block: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000', borderBottomStyle: 'solid', marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999', borderBottomStyle: 'solid', marginBottom: 3 },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  itemLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  fieldValue: { fontSize: 14 },
  listItem: { fontSize: 14, paddingLeft: 10 },
  noDataText: { fontSize: 14, marginTop: 30 },
  pageNumber: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 9, color: '#666', textAlign: 'center' },
});

const SECTIONS = [
  { id: 'cardiovascularMetabolic', title: 'Cardiovascular & Metabolic Risk', fields: ['cardiovascularRiskScore', 'bleedingRiskScore', 'osteoporosisFractureRisk', 'hypertensionTargetOrganDamage', 'diabeticRetinopathyRisk', 'diabeticNephropathyRisk'] },
  { id: 'organSystems', title: 'Organ Systems Risk', fields: ['fallRiskAssessment', 'thromboembolismRisk', 'perioperativeRiskIndex', 'renalDiseaseProgression', 'obesityComplicationRisk'] },
  { id: 'screeningSusceptibility', title: 'Screening & Susceptibility', fields: ['cancerScreeningRisk', 'strokeRiskFactors', 'infectiousDiseaseSusceptibility', 'polypharmacyRisk', 'cognitiveDeclineRisk', 'pregnancyComplicationRisk'] },
  { id: 'lifestyleGenetics', title: 'Lifestyle & Genetic Factors', fields: ['lifestyleModificationTargets', 'geneticPredispositionFactors', 'anticoagulationRiskBenefit'] },
];
const FIELD_LABELS = {
  cardiovascularRiskScore: 'Cardiovascular Risk Score', bleedingRiskScore: 'Bleeding Risk Score', osteoporosisFractureRisk: 'Osteoporosis Fracture Risk',
  hypertensionTargetOrganDamage: 'Hypertension Target Organ Damage', diabeticRetinopathyRisk: 'Diabetic Retinopathy Risk', diabeticNephropathyRisk: 'Diabetic Nephropathy Risk',
  fallRiskAssessment: 'Fall Risk Assessment', thromboembolismRisk: 'Thromboembolism Risk', perioperativeRiskIndex: 'Perioperative Risk Index', renalDiseaseProgression: 'Renal Disease Progression', obesityComplicationRisk: 'Obesity Complication Risk',
  cancerScreeningRisk: 'Cancer Screening Risk', strokeRiskFactors: 'Stroke Risk Factors', infectiousDiseaseSusceptibility: 'Infectious Disease Susceptibility', polypharmacyRisk: 'Polypharmacy Risk', cognitiveDeclineRisk: 'Cognitive Decline Risk', pregnancyComplicationRisk: 'Pregnancy Complication Risk',
  lifestyleModificationTargets: 'Lifestyle Modification Targets', geneticPredispositionFactors: 'Genetic Predisposition Factors', anticoagulationRiskBenefit: 'Anticoagulation Risk-Benefit',
};
const DATE_FIELDS = [];
const OBJECT_FIELDS = [];
const NARRATIVE_PATHS = [];
const PARENTHETICAL_LABEL_FIELDS = [];
const COMMA_FIELDS = ['cancerScreeningRisk', 'strokeRiskFactors', 'infectiousDiseaseSusceptibility', 'lifestyleModificationTargets', 'geneticPredispositionFactors'];
const COMMA_ARRAY_FIELDS = ['cancerScreeningRisk', 'strokeRiskFactors', 'infectiousDiseaseSusceptibility', 'lifestyleModificationTargets', 'geneticPredispositionFactors'];
const ARRAY_FIELDS = ['cancerScreeningRisk', 'strokeRiskFactors', 'infectiousDiseaseSusceptibility', 'lifestyleModificationTargets', 'geneticPredispositionFactors'];
const SEMICOLON_FIELDS = ['hypertensionTargetOrganDamage', 'diabeticRetinopathyRisk', 'diabeticNephropathyRisk', 'fallRiskAssessment', 'thromboembolismRisk', 'perioperativeRiskIndex', 'renalDiseaseProgression', 'obesityComplicationRisk', 'polypharmacyRisk', 'cognitiveDeclineRisk', 'pregnancyComplicationRisk', 'anticoagulationRiskBenefit', 'cancerScreeningRisk', 'strokeRiskFactors', 'infectiousDiseaseSusceptibility', 'lifestyleModificationTargets', 'geneticPredispositionFactors'];

const KEY_LABELS = {};
const humanizeKey = (key) => KEY_LABELS[key] || String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, (char) => char.toUpperCase()).trim();
const normalizeRulePath = (path) => String(path || '').replace(/\.\d+(?=\.|$)/g, '[]');
const fieldIn = (fields, path) => fields.includes(normalizeRulePath(path));
const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasVal);
  return typeof value === 'object' && Object.values(value).some(hasVal);
};
const isScalar = (value) => value === null || typeof value !== 'object';
const displayScalar = (value) => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '');
const formatDate = (value) => {
  try {
    const date = new Date(value?.$date || value);
    return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(value || ''); }
};
const isDatePathValue = (path, value) => DATE_FIELDS.includes(path)
  || (/(?:^|\.)(?:startDate|date)$/i.test(path) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value));
const splitGuardedComma = (text) => {
  const source = String(text || '');
  const result = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') { depth += 1; current += char; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); current += char; continue; }
    if (char !== ',' || depth > 0) { current += char; continue; }
    const before = current.trim();
    const after = source.slice(index + 1);
    const trimmed = after.trimStart();
    const nextWord = (trimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
    const previousWord = (before.match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
    const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(trimmed))
      || after.length === trimmed.length
      || ['and', 'or', 'then'].includes(nextWord)
      || ['and', 'or'].includes(previousWord);
    if (protectedComma) current += char;
    else { if (before) result.push(before); current = ''; }
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [source];
};
const splitBySentence = (text) => String(text || '')
  .split(/(?:;\s+|(?<=\d)\.(?=\s+[A-Z])\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/)
  .map((part) => part.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
  .filter(Boolean);
const splitFieldValue = (field, value) => {
  if (fieldIn(PARENTHETICAL_LABEL_FIELDS, field)) {
    const match = String(value || '').match(/^(.+?)\s*\(([A-Za-z][A-Za-z ]+):\s*([^)]+)\)\s*(.*)$/);
    if (match) return [match[1].trim(), match[2].trim() + ': ' + match[3].trim(), match[4].trim()].filter(Boolean);
  }
  const firstPass = fieldIn(SEMICOLON_FIELDS, field) || String(value ?? '').includes('. ')
    ? splitBySentence(value)
    : [String(value ?? '').trim()].filter(Boolean);
  return firstPass.flatMap((part) => fieldIn(COMMA_FIELDS, field) ? splitGuardedComma(part) : [part]);
};
const parseLabel = (text) => {
  const match = String(text || '').match(/^([A-Za-z0-9][A-Za-z0-9 /&()+-]{1,50}):\s+(.+)$/);
  return match ? { label: match[1].trim(), value: match[2].trim() } : null;
};
const normalizeDateKey = (value) => {
  if (!value) return 'no-date';
  try { return new Date(value.$date || value).toISOString().slice(0, 10); } catch { return String(value); }
};
const groupRecommendations = (items) => {
  const groups = new Map();
  items.forEach((item, index) => {
    const date = typeof item === 'object' && item ? item.date : null;
    const key = normalizeDateKey(date);
    if (!groups.has(key)) groups.set(key, { key, date, items: [] });
    groups.get(key).items.push({ item, index });
  });
  return [...groups.values()];
};

const recursiveBlocks = (value, basePath, itemLabel = '') => {
  if (!hasVal(value)) return [];
  if (isScalar(value)) {
    const shown = isDatePathValue(basePath, value) ? formatDate(value) : displayScalar(value);
    const rows = fieldIn(NARRATIVE_PATHS, basePath) ? splitFieldValue(basePath, shown) : [shown];
    return rows.map((row, index) => {
      const parsed = parseLabel(row);
      return {
        key: basePath + '-' + index,
        groupKey: basePath,
        subLabel: parsed ? humanizeKey(parsed.label) : (index === 0 ? humanizeKey(String(basePath).split('.').pop()) : ''),
        itemLabel,
        value: parsed?.value || row,
        rowNumber: rows.length > 1 ? index + 1 : undefined,
      };
    });
  }
  if (Array.isArray(value) && fieldIn(COMMA_ARRAY_FIELDS, basePath)) {
    const rows = value.flatMap((item) => splitFieldValue(basePath, item));
    return rows.map((row, index) => ({
      key: basePath + '-' + index,
      groupKey: basePath,
      subLabel: index === 0 ? humanizeKey(String(basePath).split('.').pop()) : '',
      itemLabel,
      value: row,
      rowNumber: rows.length > 1 ? index + 1 : undefined,
    }));
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => recursiveBlocks(item, basePath + '.' + index, itemLabel));
  return Object.entries(value).flatMap(([key, child]) => recursiveBlocks(child, basePath + '.' + key, itemLabel));
};
const narrativeBlocks = (field, value, title) => {
  if (!hasVal(value)) return [];
  const label = FIELD_LABELS[field] || humanizeKey(field);
  const showFieldLabel = label.toLowerCase() !== title.toLowerCase();
  const rows = DATE_FIELDS.includes(field) ? [formatDate(value)] : splitFieldValue(field, value);
  return rows.map((row, index) => {
    const parsed = parseLabel(row);
    return {
      key: field + '-' + index,
      groupKey: field,
      fieldLabel: index === 0 && showFieldLabel ? label : '',
      subLabel: parsed?.label || '',
      value: parsed?.value || row,
      rowNumber: rows.length > 1 ? index + 1 : undefined,
    };
  });
};
const arrayNarrativeBlocks = (field, value, title) => {
  if (!Array.isArray(value)) return [];
  const label = FIELD_LABELS[field] || humanizeKey(field);
  const showFieldLabel = label.toLowerCase() !== title.toLowerCase();
  const rows = value.flatMap((item) => splitFieldValue(field, item));
  return rows.map((row, index) => {
    const parsed = parseLabel(row);
    return {
      key: field + '-' + index,
      groupKey: field,
      fieldLabel: index === 0 && showFieldLabel ? label : '',
      subLabel: parsed?.label || '',
      value: parsed?.value || row,
      rowNumber: rows.length > 1 ? index + 1 : undefined,
    };
  });
};
const measurableBlocks = (items) => (Array.isArray(items) ? items : []).flatMap((item, itemIndex) => {
  const blocks = Object.entries(item || {}).flatMap(([key, value]) =>
    recursiveBlocks(value, 'measurableDisease.' + itemIndex + '.' + key));
  return blocks.map((block, blockIndex) => ({
    ...block,
    itemLabel: blockIndex === 0 ? 'Lesion ' + (itemIndex + 1) : '',
  }));
});
const recommendationBlocks = (items) => groupRecommendations(Array.isArray(items) ? items : []).flatMap((group) => {
  const blocks = [];
  if (group.date) blocks.push({ key: 'date-' + group.key, subLabel: 'Recommendation Date', value: formatDate(group.date) });
  group.items.forEach(({ item, index }, groupIndex) => {
    const recommendation = typeof item === 'string' ? item : item?.recommendation;
    if (hasVal(recommendation)) blocks.push({ key: 'recommendation-' + index, value: String(recommendation), rowNumber: group.items.length > 1 ? groupIndex + 1 : undefined });
  });
  return blocks;
});
const sectionBlocks = (record, section) => section.fields.flatMap((field) => {
  const value = record[field];
  if (OBJECT_FIELDS.includes(field)) return recursiveBlocks(value, field).map((block, index) => ({
    ...block,
    fieldLabel: index === 0 && FIELD_LABELS[field] !== section.title ? FIELD_LABELS[field] : '',
  }));
  if (fieldIn(ARRAY_FIELDS, field)) return arrayNarrativeBlocks(field, value, section.title);
  if (field === 'recommendations') return recommendationBlocks(value);
  return narrativeBlocks(field, value, section.title);
});
const groupShortFields = (blocks) => {
  const groups = [];
  blocks.forEach((block) => {
    const groupKey = block.groupKey || block.key;
    const previous = groups[groups.length - 1];
    if (previous?.key === groupKey) previous.blocks.push(block);
    else groups.push({ key: groupKey, blocks: [block] });
  });
  return groups;
};
const renderSection = (section, blocks) => {
  if (!blocks.length) return null;
  let blockIndex = 0;
  const sectionProps = blocks.length <= 8 ? { wrap: false } : {};
  return <View key={section.id} {...sectionProps}>{groupShortFields(blocks).map((group) => {
    const keepTogether = group.blocks.length <= 8;
    const groupProps = keepTogether ? { wrap: false } : {};
    return <View key={group.key} {...groupProps}>{group.blocks.map((block) => {
      const index = blockIndex++;
      return <View key={block.key} style={styles.block} wrap={false}>
        {index === 0 && <Text style={styles.sectionTitle}>{section.title}</Text>}
        {block.fieldLabel && <Text style={styles.fieldLabel}>{block.fieldLabel}</Text>}
        {block.itemLabel && <Text style={styles.itemLabel}>{block.itemLabel}</Text>}
        {block.subLabel && <Text style={styles.subLabel}>{block.subLabel}</Text>}
        <Text style={block.rowNumber ? styles.listItem : styles.fieldValue}>{block.rowNumber ? block.rowNumber + '. ' + block.value : block.value}</Text>
      </View>;
    })}</View>;
  })}</View>;
};
const unwrap = (data) => (Array.isArray(data) ? data : [data]).flatMap((record) => {
  if (record?.risk_counseling) return Array.isArray(record.risk_counseling) ? record.risk_counseling : [record.risk_counseling];
  if (record?.documentData) {
    const nested = record.documentData;
    if (Array.isArray(nested)) return nested;
    if (nested?.risk_counseling) return Array.isArray(nested.risk_counseling) ? nested.risk_counseling : [nested.risk_counseling];
    return [nested];
  }
  return [record];
}).filter((record) => record && typeof record === 'object');

export default function RiskCounselingDocumentPDFTemplate({ document: data }) {
  const records = React.useMemo(() => unwrap(data), [data]);
  return <Document><Page size="LETTER" style={styles.page}>
    <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Risk Counseling</Text></View>
    {!records.length && <Text style={styles.noDataText}>No risk counseling data available</Text>}
    {records.map((record, recordIndex) => <View key={recordIndex} style={styles.recordContainer} break={recordIndex > 0}>
      <View wrap={false}><Text style={styles.recordTitle}>Risk Counseling {recordIndex + 1}</Text></View>
      {SECTIONS.map((section) => renderSection(section, sectionBlocks(record, section)))}
    </View>)}
    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => pageNumber + ' / ' + totalPages} fixed />
  </Page></Document>;
}

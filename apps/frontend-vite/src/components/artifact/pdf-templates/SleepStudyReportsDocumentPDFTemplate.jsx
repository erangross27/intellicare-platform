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
  { id: 'studyDetails', title: 'Study Details', fields: ['additionalData'] },
  { id: 'sleepIndices', title: 'Sleep Indices', fields: ['apneaHypopneaIndex', 'respiratoryDisturbanceIndex', 'oxygenDesaturationIndex'] },
  { id: 'oxygenation', title: 'Oxygenation', fields: ['minimumOxygenSaturation', 'meanOxygenSaturation'] },
  { id: 'sleepArchitecture', title: 'Sleep Architecture', fields: ['totalSleepTime', 'sleepEfficiency', 'sleepLatency', 'remLatency', 'wakeAfterSleepOnset', 'arousalIndex'] },
  { id: 'respiratoryEvents', title: 'Respiratory Events', fields: ['centralApneaIndex', 'obstructiveApneaIndex', 'mixedApneaIndex', 'hypopneaIndex'] },
  { id: 'otherMeasurements', title: 'Other Measurements', fields: ['periodicLimbMovementIndex', 'epworthSleepinessScale', 'pittsburghSleepQualityIndex', 'snoreIntensity', 'sleepStageDistribution', 'cpapTitrationPressure', 'bodyPositionDependency', 'cheyneStokesBrewing'] },
];
const FIELD_LABELS = {
  additionalData: 'Study Details', apneaHypopneaIndex: 'Apnea-Hypopnea Index (AHI)', respiratoryDisturbanceIndex: 'Respiratory Disturbance Index (RDI)', oxygenDesaturationIndex: 'Oxygen Desaturation Index (ODI)', minimumOxygenSaturation: 'Minimum Oxygen Saturation', meanOxygenSaturation: 'Mean Oxygen Saturation', totalSleepTime: 'Total Sleep Time', sleepEfficiency: 'Sleep Efficiency', sleepLatency: 'Sleep Latency', remLatency: 'REM Latency', wakeAfterSleepOnset: 'Wake After Sleep Onset (WASO)', arousalIndex: 'Arousal Index', centralApneaIndex: 'Central Apnea Index', obstructiveApneaIndex: 'Obstructive Apnea Index', mixedApneaIndex: 'Mixed Apnea Index', hypopneaIndex: 'Hypopnea Index', periodicLimbMovementIndex: 'Periodic Limb Movement Index (PLMI)', epworthSleepinessScale: 'Epworth Sleepiness Scale (ESS)', pittsburghSleepQualityIndex: 'Pittsburgh Sleep Quality Index (PSQI)', snoreIntensity: 'Snore Intensity', sleepStageDistribution: 'Sleep Stage Distribution', cpapTitrationPressure: 'CPAP Titration Pressure', bodyPositionDependency: 'Body Position Dependency', cheyneStokesBrewing: 'Cheyne-Stokes Breathing',
};
const DATE_FIELDS = [];
const DATETIME_FIELDS = [];
const NUMBER_UNITS = {
  apneaHypopneaIndex: 'events/hr', respiratoryDisturbanceIndex: 'events/hr', oxygenDesaturationIndex: 'events/hr', minimumOxygenSaturation: '%', meanOxygenSaturation: '%', totalSleepTime: 'min', sleepEfficiency: '%', sleepLatency: 'min', remLatency: 'min', wakeAfterSleepOnset: 'min', arousalIndex: 'events/hr', centralApneaIndex: 'events/hr', obstructiveApneaIndex: 'events/hr', mixedApneaIndex: 'events/hr', hypopneaIndex: 'events/hr', periodicLimbMovementIndex: 'events/hr', cpapTitrationPressure: 'cmH2O', 'sleepStageDistribution[]': '%', 'additionalData.totalRecordingTime': 'min', 'additionalData.timeBelow90Percent': '%', 'additionalData.supineAHI': 'events/hr', 'additionalData.snoringPercentage': '%',
};
const OBJECT_FIELDS = ['additionalData', 'sleepStageDistribution', 'bodyPositionDependency'];
const MIXED_OBJECT_ARRAY_FIELDS = [];
const OBJECT_ITEM_LABELS = {};
const MIXED_SCALAR_OBJECT_FIELDS = ['bodyPositionDependency'];
const NARRATIVE_PATHS = ['additionalData.studyType', 'additionalData.indicationForStudy', 'sleepStageDistribution.diagnostic', 'sleepStageDistribution.cpap', 'bodyPositionDependency.supine', 'bodyPositionDependency.leftLateral', 'bodyPositionDependency.rightLateral', 'bodyPositionDependency.prone'];
const PARENTHETICAL_LABEL_FIELDS = [];
const PARENTHETICAL_SEMICOLON_FIELDS = [];
const COMMA_FIELDS = ['additionalData.studyType', 'sleepStageDistribution.diagnostic', 'sleepStageDistribution.cpap', 'bodyPositionDependency.supine', 'bodyPositionDependency.leftLateral', 'bodyPositionDependency.rightLateral', 'bodyPositionDependency.prone'];
const COMMA_ARRAY_SPLIT_FIELDS = [];
const ARRAY_FIELDS = [];
const SEMICOLON_FIELDS = ['additionalData.indicationForStudy'];
const HIDDEN_PATHS = ['additionalData.migratedFrom', 'additionalData.migratedAt', 'additionalData.originalId'];

const KEY_LABELS = { cpap: 'CPAP', cpapSettingsTrialed: 'CPAP Settings Trialed', supineAHI: 'Supine AHI', totalRecordingTime: 'Total Recording Time', timeBelow90Percent: 'Time Below 90 Percent', snoringPercentage: 'Snoring Percentage', finalPressure: 'Final Pressure', studyType: 'Study Type', indicationForStudy: 'Indication for Study', leftLateral: 'Left Lateral', rightLateral: 'Right Lateral' };
const humanizeKey = (key) => KEY_LABELS[key] || String(key || '').replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, (char) => char.toUpperCase()).trim();
const normalizeRulePath = (path) => String(path || '').replace(/\.\d+(?=\.|$)/g, '[]');
const fieldIn = (fields, path) => fields.includes(normalizeRulePath(path));
const pathHidden = (path) => HIDDEN_PATHS.includes(normalizeRulePath(path));
const unitForPath = (path) => NUMBER_UNITS[normalizeRulePath(path)] || NUMBER_UNITS[String(path || '').split('.')[0]];
const hasVal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'string' && ['null', 'n/a', 'none', 'undefined'].includes(value.trim().toLowerCase())) return false;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(hasVal);
  return typeof value === 'object' && Object.values(value).some(hasVal);
};
const isScalar = (value) => value === null || typeof value !== 'object';
const normalizeDisplayText = (value) => String(value ?? '').replace(/≥/g, '>=').replace(/≤/g, '<=');
const displayScalar = (value) => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : normalizeDisplayText(value);
const formatDate = (value) => {
  try {
    const raw = String(value?.$date || value || '');
    if (/^\d{4}-\d{2}$/.test(raw)) {
      const [year, month] = raw.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' });
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(value || ''); }
};
const formatDateTime = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value?.$date || value);
    return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
    const next = (trimmed.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
    const previous = (before.match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
    const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(trimmed))
      || after.length === trimmed.length
      || ['and', 'or', 'then'].includes(next)
      || ['and', 'or'].includes(previous);
    if (protectedComma) current += char;
    else { if (before) result.push(before); current = ''; }
  }
  if (current.trim()) result.push(current.trim());
  return (result.length ? result : [source]).map((item, index) => index > 0 ? item.replace(/^(?:and|or)\s+/i, '') : item);
};
const splitBySentence = (text) => String(text || '')
  .split(/(?:;\s+|(?<=\d)\.(?=\s+[A-Z])\s+|(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)\.\s+)/)
  .map((part) => part.replace(/^[;.,\s]+|[;.,\s]+$/g, '').trim())
  .filter(Boolean);
const splitFieldValue = (field, value) => {
  if (typeof value === 'boolean') return [value ? 'Yes' : 'No'];
  if (fieldIn(PARENTHETICAL_SEMICOLON_FIELDS, field)) {
    const match = String(value || '').match(/^(.+?)\s*\(([^;]+);\s*([^)]+)\)$/);
    if (match) return [match[1].trim(), match[2].trim(), match[3].trim()];
  }
  if (fieldIn(PARENTHETICAL_LABEL_FIELDS, field)) {
    const match = String(value || '').match(/^(.+?)\s*\(([A-Za-z][A-Za-z ]+):\s*([^)]+)\)\s*(.*)$/);
    if (match) return [match[1].trim(), match[2].trim() + ': ' + match[3].trim(), match[4].trim()].filter(Boolean);
  }
  const normalizedValue = typeof value === 'string' ? normalizeDisplayText(value) : value;
  const firstPass = fieldIn(SEMICOLON_FIELDS, field) || String(normalizedValue ?? '').includes('. ')
    ? splitBySentence(normalizedValue)
    : [String(normalizedValue ?? '').trim()].filter(Boolean);
  return firstPass.flatMap((part) => fieldIn(COMMA_FIELDS, field) || fieldIn(COMMA_ARRAY_SPLIT_FIELDS, field) ? splitGuardedComma(part) : [part]);
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
    const shown = isDatePathValue(basePath, value) ? formatDate(value)
      : DATETIME_FIELDS.includes(String(basePath).split('.')[0]) ? formatDateTime(value)
        : unitForPath(basePath) && typeof value === 'number' ? displayScalar(value) + ' ' + unitForPath(basePath)
          : displayScalar(value);
    const isNarrative = fieldIn(NARRATIVE_PATHS, basePath);
    const rows = isNarrative ? splitFieldValue(basePath, shown) : [shown];
    return rows.map((row, index) => {
      const parsed = parseLabel(row);
      return {
        key: basePath + '-' + index,
        groupKey: basePath,
        fieldLabel: isNarrative && index === 0 ? humanizeKey(String(basePath).split('.').pop()) : '',
        subLabel: parsed ? humanizeKey(parsed.label) : (!isNarrative && index === 0 ? humanizeKey(String(basePath).split('.').pop()) : ''),
        itemLabel,
        value: parsed?.value || row,
        rowNumber: rows.length > 1 ? index + 1 : undefined,
      };
    });
  }
  if (Array.isArray(value) && fieldIn(COMMA_ARRAY_SPLIT_FIELDS, basePath)) {
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
  const blocks = Object.entries(value).filter(([key]) => !pathHidden(basePath + '.' + key)).flatMap(([key, child]) => recursiveBlocks(child, basePath + '.' + key, itemLabel));
  if (!itemLabel && String(basePath).includes('.') && blocks.length) {
    return blocks.map((block, index) => ({ ...block, itemLabel: index === 0 ? humanizeKey(String(basePath).split('.').pop()) : block.itemLabel }));
  }
  return blocks;
};
const narrativeBlocks = (field, value, title) => {
  if (!hasVal(value)) return [];
  const label = FIELD_LABELS[field] || humanizeKey(field);
  const showFieldLabel = label.toLowerCase() !== title.toLowerCase();
  const rows = DATE_FIELDS.includes(field) ? [formatDate(value)]
    : DATETIME_FIELDS.includes(field) ? [formatDateTime(value)]
      : unitForPath(field) && typeof value === 'number' ? [displayScalar(value) + ' ' + unitForPath(field)]
        : splitFieldValue(field, value);
  return rows.map((row, index) => {
    const parsed = parseLabel(row);
    return {
      key: field + '-' + index,
      groupKey: field,
      fieldLabel: index === 0 && showFieldLabel ? label : '',
      subLabel: parsed ? humanizeKey(parsed.label) : '',
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
      subLabel: parsed ? humanizeKey(parsed.label) : '',
      value: parsed?.value || row,
      rowNumber: rows.length > 1 ? index + 1 : undefined,
    };
  });
};
const sleepStageBlocks = (value) => {
  const stageLabels = ['N1', 'N2', 'N3', 'REM'];
  return (Array.isArray(value) ? value : []).map((item, index) => ({
    key: 'sleepStageDistribution-' + index,
    groupKey: 'sleepStageDistribution-' + index,
    fieldLabel: index === 0 ? FIELD_LABELS.sleepStageDistribution : '',
    subLabel: stageLabels[index] || 'Stage ' + (index + 1),
    value: displayScalar(item) + ' %',
  }));
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
const objectArrayBlocks = (field, value) => (Array.isArray(value) ? value : [value]).flatMap((item, itemIndex) => {
  const blocks = recursiveBlocks(item, field + '.' + itemIndex);
  return blocks.map((block, blockIndex) => ({
    ...block,
    groupKey: field + '.' + itemIndex,
    itemLabel: blockIndex === 0 ? (OBJECT_ITEM_LABELS[field] || FIELD_LABELS[field] || humanizeKey(field)) + ' ' + (itemIndex + 1) : '',
  }));
});
const sectionBlocks = (record, section) => section.fields.flatMap((field) => {
  const value = record[field];
  if (field === 'sleepStageDistribution' && Array.isArray(value) && value.every(isScalar)) return sleepStageBlocks(value);
  if (MIXED_SCALAR_OBJECT_FIELDS.includes(field) && isScalar(value)) return narrativeBlocks(field, value, section.title);
  if (MIXED_OBJECT_ARRAY_FIELDS.includes(field) && Array.isArray(value) && value.some((item) => !isScalar(item))) return objectArrayBlocks(field, value).map((block, index) => ({
    ...block,
    fieldLabel: block.fieldLabel || (index === 0 && FIELD_LABELS[field] !== section.title ? FIELD_LABELS[field] : ''),
  }));
  if (OBJECT_FIELDS.includes(field)) return (OBJECT_ITEM_LABELS[field] ? objectArrayBlocks(field, value) : recursiveBlocks(value, field)).map((block, index) => ({
    ...block,
    fieldLabel: index === 0 && FIELD_LABELS[field] !== section.title ? FIELD_LABELS[field] : '',
    subLabel: block.fieldLabel || block.subLabel,
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
const chunkLongGroups = (groups, chunkSize = 6) => groups.flatMap((group) => {
  if (group.blocks.length <= 8) return [group];
  const chunks = [];
  for (let index = 0; index < group.blocks.length; index += chunkSize) {
    chunks.push({ key: group.key + '-chunk-' + index, blocks: group.blocks.slice(index, index + chunkSize) });
  }
  return chunks;
});
const renderSection = (section, blocks) => {
  if (!blocks.length) return null;
  let blockIndex = 0;
  const sectionProps = blocks.length <= 8 ? { wrap: false } : {};
  return <View key={section.id} {...sectionProps}>{chunkLongGroups(groupShortFields(blocks)).map((group) => {
    return <View key={group.key} wrap={false}>{group.blocks.map((block) => {
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
  if (record?.sleep_study_reports) return Array.isArray(record.sleep_study_reports) ? record.sleep_study_reports : [record.sleep_study_reports];
  if (record?.documentData) {
    const nested = record.documentData;
    if (Array.isArray(nested)) return nested;
    if (nested?.sleep_study_reports) return Array.isArray(nested.sleep_study_reports) ? nested.sleep_study_reports : [nested.sleep_study_reports];
    return [nested];
  }
  return [record];
}).filter((record) => record && typeof record === 'object');

export default function SleepStudyReportsDocumentPDFTemplate({ document: data }) {
  const records = React.useMemo(() => unwrap(data), [data]);
  return <Document><Page size="LETTER" style={styles.page}>
    <View style={styles.documentHeader} wrap={false}><Text style={styles.documentTitle}>Sleep Study Reports</Text></View>
    {!records.length && <Text style={styles.noDataText}>No sleep study reports data available</Text>}
    {records.map((record, recordIndex) => <View key={recordIndex} style={styles.recordContainer} break={recordIndex > 0}>
      <View wrap={false}><Text style={styles.recordTitle}>Sleep Study Reports Record {recordIndex + 1}</Text></View>
      {SECTIONS.map((section) => renderSection(section, sectionBlocks(record, section)))}
    </View>)}
    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => pageNumber + ' / ' + totalPages} fixed />
  </Page></Document>;
}

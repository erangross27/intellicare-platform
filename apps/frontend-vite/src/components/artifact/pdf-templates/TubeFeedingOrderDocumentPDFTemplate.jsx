/** Tube Feeding Order - canonical box-free PDF. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.35, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, marginBottom: 16, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 5, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 3, marginTop: 6, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 1, marginTop: 2, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  listItem: { fontSize: 14, lineHeight: 1.35, marginBottom: 0, paddingLeft: 8 },
  noDataText: { fontSize: 14, marginTop: 40 },
});

const SECTION_TITLES = {
  'formula-info': 'Formula Information',
  'feeding-route-method': 'Feeding Route and Method',
  'rate-advancement': 'Rate and Advancement',
  'caloric-protein-goals': 'Caloric and Protein Goals',
  'water-flush-protocol': 'Water Flush Protocol',
  'gastric-monitoring': 'Gastric Monitoring',
  'safety-positioning': 'Safety and Positioning',
  'cyclic-bolus-feeding': 'Cyclic and Bolus Feeding',
  'supplements-patency': 'Supplements and Patency',
  'risk-glycemic': 'Risk and Glycemic Control',
};

const FIELD_LABELS = {
  formulaName: 'Formula Name',
  formulaCaloriesDensity: 'Formula Calorie Density (kcal/mL)',
  proteinContentPerLiter: 'Protein Content (g/L)',
  feedingRouteType: 'Feeding Route Type',
  feedingTubeSize: 'Feeding Tube Size (Fr)',
  feedingMethodType: 'Feeding Method Type',
  initialInfusionRate: 'Initial Infusion Rate (mL/hr)',
  goalInfusionRate: 'Goal Infusion Rate (mL/hr)',
  rateAdvancementSchedule: 'Rate Advancement Schedule',
  dailyCaloricGoal: 'Daily Caloric Goal (kcal/day)',
  dailyProteinGoal: 'Daily Protein Goal (g/day)',
  freeWaterFlushVolume: 'Free Water Flush Volume (mL)',
  freeWaterFlushFrequency: 'Free Water Flush Frequency',
  gastricResidualVolumeThreshold: 'Gastric Residual Threshold (mL)',
  gastricResidualCheckFrequency: 'Gastric Residual Check Frequency',
  headOfBedElevation: 'Head of Bed Elevation (degrees)',
  prokineticsOrdered: 'Prokinetics Ordered',
  cyclicFeedingStartTime: 'Cyclic Feeding Start Time',
  cyclicFeedingDurationHours: 'Cyclic Feeding Duration (hours)',
  bolusVolume: 'Bolus Volume (mL)',
  bolusFrequency: 'Bolus Frequency',
  modularsSupplements: 'Modulars and Supplements',
  tubePatencyFlushSolution: 'Tube Patency Flush Solution',
  refeedingSyndromeRisk: 'Refeeding Syndrome Risk',
  glycemicControlProtocol: 'Glycemic Control Protocol',
};

const SECTION_FIELDS = {
  'formula-info': ['formulaName', 'formulaCaloriesDensity', 'proteinContentPerLiter'],
  'feeding-route-method': ['feedingRouteType', 'feedingTubeSize', 'feedingMethodType'],
  'rate-advancement': ['initialInfusionRate', 'goalInfusionRate', 'rateAdvancementSchedule'],
  'caloric-protein-goals': ['dailyCaloricGoal', 'dailyProteinGoal'],
  'water-flush-protocol': ['freeWaterFlushVolume', 'freeWaterFlushFrequency'],
  'gastric-monitoring': ['gastricResidualVolumeThreshold', 'gastricResidualCheckFrequency'],
  'safety-positioning': ['headOfBedElevation', 'prokineticsOrdered'],
  'cyclic-bolus-feeding': ['cyclicFeedingStartTime', 'cyclicFeedingDurationHours', 'bolusVolume', 'bolusFrequency'],
  'supplements-patency': ['modularsSupplements', 'tubePatencyFlushSolution'],
  'risk-glycemic': ['refeedingSyndromeRisk', 'glycemicControlProtocol'],
};

const TIME_FIELDS = new Set(['cyclicFeedingStartTime']);
const NUMBER_FIELDS = new Set(['formulaCaloriesDensity', 'proteinContentPerLiter', 'feedingTubeSize', 'initialInfusionRate', 'goalInfusionRate', 'dailyCaloricGoal', 'dailyProteinGoal', 'freeWaterFlushVolume', 'gastricResidualVolumeThreshold', 'headOfBedElevation', 'cyclicFeedingDurationHours', 'bolusVolume']);
const BOOLEAN_FIELDS = new Set(['prokineticsOrdered', 'refeedingSyndromeRisk']);
const ARRAY_FIELDS = new Set(['modularsSupplements']);
const COMMA_SPLIT_FIELDS = new Set(['glycemicControlProtocol']);
const MEANINGFUL_ZERO_FIELDS = new Set();

const safeString = value => String(value ?? '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...');
const hasVal = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.some(hasVal));
const formatDate = value => { try { const date = new Date(value?.$date || value); if (isNaN(date.getTime())) return safeString(value); return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); } catch { return safeString(value); } };

const splitTopLevelCommas = text => {
  const source = safeString(text);
  const parts = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; }
    else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

const splitBySentence = (text, field = '') => {
  const clauses = safeString(text).split(/(?<!\b[A-Z])(?<!\d)\.(?:\s+)|;\s+/).map(part => part.trim()).filter(Boolean);
  if (!COMMA_SPLIT_FIELDS.has(field)) return clauses;
  return clauses.flatMap(splitTopLevelCommas).filter(Boolean);
};

const unwrapRecords = data => (Array.isArray(data) ? data : data ? [data] : []).flatMap(record =>
  Array.isArray(record?.wrapRecordsIntoSingleDocument)
    ? record.wrapRecordsIntoSingleDocument
    : Array.isArray(record?.records || record?._records)
      ? (record.records || record._records)
      : record?.tube_feeding_order
    ? (Array.isArray(record.tube_feeding_order) ? record.tube_feeding_order : [record.tube_feeding_order])
    : record?.data?.tube_feeding_order
      ? (Array.isArray(record.data.tube_feeding_order) ? record.data.tube_feeding_order : [record.data.tube_feeding_order])
    : record?.documentData
      ? (Array.isArray(record.documentData) ? record.documentData : record.documentData?.tube_feeding_order ? (Array.isArray(record.documentData.tube_feeding_order) ? record.documentData.tube_feeding_order : [record.documentData.tube_feeding_order]) : [record.documentData])
      : [record]
).filter(record => record && typeof record === 'object');

const TubeFeedingOrderDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);

  const rowsForField = (record, field) => {
    const value = record[field];
    if (!hasVal(value)) return [];
    if (TIME_FIELDS.has(field)) return [safeString(value)];
    if (NUMBER_FIELDS.has(field)) {
      if (!Number.isFinite(Number(value))) return [];
      const doctorEdited = Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(field);
      return Number(value) !== 0 || MEANINGFUL_ZERO_FIELDS.has(field) || doctorEdited ? [safeString(value)] : [];
    }
    if (BOOLEAN_FIELDS.has(field)) return typeof value === 'boolean' ? [value ? 'Yes' : 'No'] : [];
    if (ARRAY_FIELDS.has(field)) return (Array.isArray(value) ? value : [value]).filter(hasVal).map(safeString);
    return splitBySentence(value, field);
  };

  const fieldBody = (record, field) => {
    const values = rowsForField(record, field);
    if (!values.length) return [];
    const label = FIELD_LABELS[field] || field;
    const rows = values.map((value, index) => <Text key={`${field}-${index}`} style={styles.listItem}>{index + 1}. {safeString(value)}</Text>);
    if (rows.length <= 6) return [<View key={`${field}-field`} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{rows}</View>];
    const [first, ...rest] = rows;
    return [<View key={`${field}-field`} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{first}</View>, ...rest];
  };

  const renderSection = (record, sectionId) => {
    let body = [];
    SECTION_FIELDS[sectionId].forEach(field => { body = body.concat(fieldBody(record, field)); });
    if (!body.length) return null;
    body = body.map((element, index) => React.cloneElement(element, { key: `${sectionId}-${index}` }));
    const [first, ...rest] = body;
    return <View key={sectionId}><View wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sectionId]}</Text>{first}</View>{rest}</View>;
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Tube Feeding Order</Text>
        {records.length === 0 && <Text style={styles.noDataText}>No tube feeding order records available</Text>}
        {records.map((record, index) => (
          <View key={index} break={index > 0}>
            <Text style={styles.recordTitle}>{`Tube Feeding Order ${index + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sectionId => renderSection(record, sectionId))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TubeFeedingOrderDocumentPDFTemplate;

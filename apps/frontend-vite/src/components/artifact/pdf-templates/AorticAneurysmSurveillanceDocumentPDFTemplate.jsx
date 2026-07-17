import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 13, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  header: { marginBottom: 24, paddingBottom: 12 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', textAlign: 'center', borderBottom: '2pt solid #000000', paddingBottom: 8 },
  recordCard: { marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', marginBottom: 12 },
  section: { marginBottom: 14 },
  pageStartSection: { paddingTop: 40 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, borderBottom: '1pt solid #000000', paddingBottom: 4 },
  fieldBlock: { marginBottom: 8, paddingLeft: 8 },
  fieldLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold', fontWeight: 'bold', marginBottom: 2, color: '#333333', borderBottom: '0.5pt solid #999999', paddingBottom: 2 },
  fieldValue: { fontSize: 13, lineHeight: 1.5, marginBottom: 4 },
  listItem: { fontSize: 13, lineHeight: 1.5, paddingLeft: 12, marginBottom: 4 },
  nestedLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 3, marginBottom: 2 },
  emptyState: { fontSize: 14, textAlign: 'center', paddingTop: 24 },
});

const SECTION_FIELDS = {
  'Aneurysm Measurements': ['aneurysmMaxDiameter', 'aneurysmLocation', 'previousDiameterMeasurement', 'annualGrowthRate', 'saccularMorphology'],
  'Anatomic Details': ['crawfordClassification', 'aorticNeckLength', 'aorticNeckAngulation', 'iliacArteryDiameter', 'aorticRootDiameter', 'sinotubularJunctionDiameter', 'aorticValvePathology'],
  'Thrombus & Wall Pathology': ['intraluminalThrombus', 'maxThrombusBurden', 'penetratingAorticUlcer', 'intramualHematoma', 'peakWallStress'],
  'Dissection History': ['aorticDissectionHistory', 'falseLumenStatus', 'primaryEntryTearLocation'],
  'Genetic & Connective Tissue': ['connectiveTissueDisorder', 'geneticMutationStatus'],
  'Surveillance Plan': ['surveillanceImagingModality', 'recommendedSurveillanceInterval', 'ruptureRiskScore'],
  'Post-Repair Surveillance': ['endoleakSurveillance', 'graftMigration', 'sacRegressionStatus'],
};

const LABELS = {
  aneurysmMaxDiameter: 'Aneurysm Max Diameter (cm)', aneurysmLocation: 'Aneurysm Location', previousDiameterMeasurement: 'Previous Diameter Measurement (cm)', annualGrowthRate: 'Annual Growth Rate (cm/year)', saccularMorphology: 'Saccular Morphology', crawfordClassification: 'Crawford Classification', aorticNeckLength: 'Aortic Neck Length (mm)', aorticNeckAngulation: 'Aortic Neck Angulation (degrees)', iliacArteryDiameter: 'Iliac Artery Diameter (mm)', aorticRootDiameter: 'Aortic Root Diameter (mm)', sinotubularJunctionDiameter: 'Sinotubular Junction Diameter (mm)', aorticValvePathology: 'Aortic Valve Pathology', intraluminalThrombus: 'Intraluminal Thrombus', maxThrombusBurden: 'Max Thrombus Burden (mm)', penetratingAorticUlcer: 'Penetrating Aortic Ulcer', intramualHematoma: 'Intramural Hematoma', peakWallStress: 'Peak Wall Stress (kPa)', aorticDissectionHistory: 'Aortic Dissection History', falseLumenStatus: 'False Lumen Status', primaryEntryTearLocation: 'Primary Entry Tear Location', connectiveTissueDisorder: 'Connective Tissue Disorder', geneticMutationStatus: 'Genetic Mutation Status', surveillanceImagingModality: 'Surveillance Imaging Modality', recommendedSurveillanceInterval: 'Recommended Surveillance Interval (months)', ruptureRiskScore: 'Rupture Risk Score', endoleakSurveillance: 'Endoleak Surveillance', graftMigration: 'Graft Migration (mm)', sacRegressionStatus: 'Sac Regression Status',
};

const BOOLEAN_FIELDS = new Set(['saccularMorphology', 'intraluminalThrombus', 'penetratingAorticUlcer', 'intramualHematoma', 'aorticDissectionHistory']);
const NARRATIVE_FIELDS = new Set(['aorticValvePathology', 'falseLumenStatus', 'connectiveTissueDisorder', 'geneticMutationStatus', 'endoleakSurveillance', 'sacRegressionStatus']);
const HIDE_ZERO_FIELDS = new Set(['aneurysmMaxDiameter', 'previousDiameterMeasurement', 'annualGrowthRate', 'aorticNeckLength', 'aorticNeckAngulation', 'iliacArteryDiameter', 'aorticRootDiameter', 'sinotubularJunctionDiameter', 'maxThrombusBurden', 'peakWallStress', 'recommendedSurveillanceInterval', 'ruptureRiskScore', 'graftMigration']);

const hasValue = (field, value) => {
  if (value === null || value === undefined || value === '') return false;
  if (HIDE_ZERO_FIELDS.has(field) && value === 0) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(item => item !== null && item !== undefined && String(item).trim() !== '');
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const splitBySentence = text => String(text || '').replace(/\b(Dr|Mr|Mrs|Ms|Prof|Rev|Gen|Col|Sgt|Jr|Sr|vs|etc)\./gi, '$1<dot>').split(/[.;]\s+/).map(value => value.replace(/<dot>/g, '.').replace(/[;.]+$/, '').trim()).filter(Boolean);
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#:'"-]{1,80}?):\s+([\s\S]*)/);
  return match ? { isLabeled: true, label: match[1].trim(), value: match[2].trim() } : { isLabeled: false, label: '', value: String(text || '') };
};
const splitByComma = text => {
  const source = String(text || ''); const parts = []; let current = ''; let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '(' || char === '[') depth++;
    if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
    if (char !== ',' || depth > 0) { current += char; continue; }
    const before = current.trim(); const after = source.slice(i + 1).trimStart();
    const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(after)) || /^(?:MD|DO|PhD|PharmD|RN|NP|PA-C)\b/i.test(after);
    if (protectedComma) current += char;
    else { if (before) parts.push(before); current = ''; }
  }
  if (current.trim()) parts.push(current.trim().replace(/[.;]$/, ''));
  return parts.length > 1 ? parts : [source];
};

const unwrap = data => {
  if (!data) return [];
  const input = Array.isArray(data) ? data : [data];
  return input.flatMap(item => {
    if (item?.aortic_aneurysm_surveillance) return Array.isArray(item.aortic_aneurysm_surveillance) ? item.aortic_aneurysm_surveillance : [item.aortic_aneurysm_surveillance];
    if (item?.data?.aortic_aneurysm_surveillance) return Array.isArray(item.data.aortic_aneurysm_surveillance) ? item.data.aortic_aneurysm_surveillance : [item.data.aortic_aneurysm_surveillance];
    if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
    if (item?.documentData?.aortic_aneurysm_surveillance) return Array.isArray(item.documentData.aortic_aneurysm_surveillance) ? item.documentData.aortic_aneurysm_surveillance : [item.documentData.aortic_aneurysm_surveillance];
    if (item?.documentData) return Array.isArray(item.documentData) ? item.documentData : [item.documentData];
    return [item];
  }).filter(item => item && typeof item === 'object');
};

const narrativeParts = (field, value) => splitBySentence(value).flatMap(sentence => {
  const parsed = parseLabel(sentence);
  const original = parsed.isLabeled ? parsed.value : sentence;
  const values = field === 'endoleakSurveillance' && parsed.isLabeled ? splitByComma(original) : [original];
  return values.map(part => ({ label: parsed.isLabeled ? parsed.label : '', value: part }));
});

const renderField = (field, value) => {
  if (!hasValue(field, value)) return null;
  const label = LABELS[field] || field;
  if (BOOLEAN_FIELDS.has(field)) return <View key={field} style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{value ? 'Yes' : 'No'}</Text></View>;
  if (NARRATIVE_FIELDS.has(field)) {
    const parts = narrativeParts(field, value);
    return <View key={field} style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{parts.map((part, index) => <React.Fragment key={`${field}-${index}`}>{part.label && (index === 0 || parts[index - 1]?.label !== part.label) && <Text style={styles.nestedLabel}>{part.label}</Text>}<Text style={styles.listItem}>{index + 1}. {part.value}</Text></React.Fragment>)}</View>;
  }
  return <View key={field} style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>;
};

const AorticAneurysmSurveillanceDocumentPDFTemplate = ({ document: documentProp, data }) => {
  const records = unwrap(documentProp || data);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}><Text style={styles.documentTitle}>Aortic Aneurysm Surveillance</Text></View>
        {records.length === 0 ? <Text style={styles.emptyState}>No records available</Text> : records.map((record, recordIndex) => (
          <React.Fragment key={recordIndex}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Aortic Aneurysm Surveillance ${recordIndex + 1}`}</Text></View>
            {Object.entries(SECTION_FIELDS).map(([title, fields]) => {
              if (!fields.some(field => hasValue(field, record[field]))) return null;
              const startsPage = ['Anatomic Details', 'Thrombus & Wall Pathology', 'Genetic & Connective Tissue', 'Surveillance Plan'].includes(title);
              return (
              <View key={title} style={startsPage ? [styles.section, styles.pageStartSection] : styles.section} wrap={false} break={startsPage}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {fields.map(field => renderField(field, record[field]))}
              </View>
              );
            })}
          </React.Fragment>
        ))}
      </Page>
    </Document>
  );
};

export default AorticAneurysmSurveillanceDocumentPDFTemplate;

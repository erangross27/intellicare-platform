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
  'Provider Information': ['reportingLaboratory'],
  'Specimen Information': ['date', 'specimenType', 'specimenCollectionDate', 'cultureMethod', 'cultureGrowthTime', 'polymicrobialGrowth'],
  'Organism Identification': ['organismIdentified', 'gramStainResult', 'colonyCount', 'coOrganisms'],
  'Susceptibility Testing': ['susceptibilityMethod', 'antibioticsPanelTested', 'susceptibilityProfile', 'minimumInhibitoryConcentration'],
  'Resistance Markers': ['esblDetected', 'mrsaStatus', 'carbapenemaseProduction', 'vreStatus', 'multidrugResistant', 'inductibleResistance', 'biofilmProduction'],
  Reporting: ['interpretiveComments', 'breakpointStandard'],
};

const LABELS = {
  reportingLaboratory: 'Reporting Laboratory', date: 'Date', specimenType: 'Specimen Type', specimenCollectionDate: 'Specimen Collection Date', cultureMethod: 'Culture Method', cultureGrowthTime: 'Culture Growth Time', polymicrobialGrowth: 'Polymicrobial Growth', organismIdentified: 'Organism Identified', gramStainResult: 'Gram Stain Result', colonyCount: 'Colony Count', coOrganisms: 'Co-Organisms', susceptibilityMethod: 'Susceptibility Method', antibioticsPanelTested: 'Antibiotics Panel Tested', susceptibilityProfile: 'Susceptibility Profile', minimumInhibitoryConcentration: 'Minimum Inhibitory Concentration', esblDetected: 'ESBL Detected', mrsaStatus: 'MRSA Status', carbapenemaseProduction: 'Carbapenemase Production', vreStatus: 'VRE Status', multidrugResistant: 'Multidrug Resistant', inductibleResistance: 'Inducible Resistance', biofilmProduction: 'Biofilm Production', interpretiveComments: 'Interpretive Comments', breakpointStandard: 'Breakpoint Standard',
};

const DATE_FIELDS = new Set(['date', 'specimenCollectionDate']);
const BOOLEAN_FIELDS = new Set(['esblDetected', 'mrsaStatus', 'carbapenemaseProduction', 'vreStatus', 'multidrugResistant', 'polymicrobialGrowth', 'biofilmProduction']);
const ARRAY_FIELDS = new Set(['antibioticsPanelTested', 'susceptibilityProfile', 'minimumInhibitoryConcentration', 'coOrganisms']);

const hasValue = value => {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some(item => item !== null && item !== undefined && String(item).trim() !== '');
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const formatDate = value => {
  if (!value) return '';
  try { const date = new Date(value.$date || value); return isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(value); }
};

const splitBySentence = text => String(text || '').replace(/\b(Dr|Mr|Mrs|Ms|Prof|Rev|Gen|Col|Sgt|Jr|Sr|vs|etc)\./gi, '$1<dot>').split(/(?<=[.;])\s+/).map(value => value.replace(/<dot>/g, '.').trim()).filter(Boolean);
const parseLabel = text => {
  const match = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
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
    if (item?.antimicrobial_susceptibility) return Array.isArray(item.antimicrobial_susceptibility) ? item.antimicrobial_susceptibility : [item.antimicrobial_susceptibility];
    if (item?.data) return Array.isArray(item.data) ? item.data : [item.data];
    if (item?.documentData?.antimicrobial_susceptibility) return Array.isArray(item.documentData.antimicrobial_susceptibility) ? item.documentData.antimicrobial_susceptibility : [item.documentData.antimicrobial_susceptibility];
    if (item?.documentData) return Array.isArray(item.documentData) ? item.documentData : [item.documentData];
    return [item];
  }).filter(item => item && typeof item === 'object');
};

const stringParts = (field, value) => splitBySentence(value).flatMap(sentence => {
  const parsed = parseLabel(sentence);
  if (field !== 'interpretiveComments') return [{ label: parsed.isLabeled ? parsed.label : '', value: parsed.isLabeled ? parsed.value : sentence }];
  const original = parsed.isLabeled ? parsed.value : sentence;
  const commaParts = splitByComma(original.replace(/[.;]+$/, ''));
  if (commaParts.length < 2) return [{ label: parsed.isLabeled ? parsed.label : '', value: original }];
  return commaParts.map(part => ({ label: parsed.isLabeled ? parsed.label : '', value: part }));
});

const arrayParts = (field, item) => {
  const parsed = parseLabel(item);
  const values = field === 'susceptibilityProfile' ? splitByComma(parsed.isLabeled ? parsed.value : String(item)) : [parsed.isLabeled ? parsed.value : String(item)];
  return values.map(value => ({ label: parsed.isLabeled ? parsed.label : '', value }));
};

const renderField = (field, value) => {
  if (!hasValue(value)) return null;
  const label = LABELS[field] || field;
  if (DATE_FIELDS.has(field)) return <View key={field} style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{formatDate(value)}</Text></View>;
  if (BOOLEAN_FIELDS.has(field)) return <View key={field} style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{value ? 'Yes' : 'No'}</Text></View>;
  if (ARRAY_FIELDS.has(field)) {
    const parts = value.filter(item => item !== null && item !== undefined && String(item).trim() !== '').flatMap(item => arrayParts(field, item));
    return <View key={field} style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{parts.map((part, index) => <React.Fragment key={`${field}-${index}`}>{part.label && (index === 0 || parts[index - 1]?.label !== part.label) && <Text style={styles.nestedLabel}>{part.label}</Text>}<Text style={styles.listItem}>{index + 1}. {part.value}</Text></React.Fragment>)}</View>;
  }
  if (typeof value === 'string') {
    const parts = stringParts(field, value);
    return <View key={field} style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{parts.length > 1 ? parts.map((part, index) => <React.Fragment key={`${field}-${index}`}>{part.label && (index === 0 || parts[index - 1]?.label !== part.label) && <Text style={styles.nestedLabel}>{part.label}</Text>}<Text style={styles.listItem}>{index + 1}. {part.value}</Text></React.Fragment>) : <Text style={styles.fieldValue}>{parts[0]?.value || value}</Text>}</View>;
  }
  return <View key={field} style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>;
};

const AntimicrobialSusceptibilityDocumentPDFTemplate = ({ document: documentProp, data }) => {
  const records = unwrap(documentProp || data);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}><Text style={styles.documentTitle}>Antimicrobial Susceptibility</Text></View>
        {records.length === 0 ? <Text style={styles.emptyState}>No records available</Text> : records.map((record, recordIndex) => (
          <React.Fragment key={recordIndex}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Antimicrobial Susceptibility ${recordIndex + 1}`}</Text></View>
            {Object.entries(SECTION_FIELDS).map(([title, fields]) => fields.some(field => hasValue(record[field])) ? (
              <View key={title} style={title === 'Susceptibility Testing' ? [styles.section, styles.pageStartSection] : styles.section} wrap={false} break={title === 'Susceptibility Testing'}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {fields.map(field => renderField(field, record[field]))}
              </View>
            ) : null)}
          </React.Fragment>
        ))}
      </Page>
    </Document>
  );
};

export default AntimicrobialSusceptibilityDocumentPDFTemplate;

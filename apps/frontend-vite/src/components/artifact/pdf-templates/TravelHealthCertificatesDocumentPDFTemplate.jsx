/** Travel Health Certificates — canonical box-free PDF, collection travel_health_certificates. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 5, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 3, marginTop: 7, marginBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 1, marginTop: 3, marginBottom: 1, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  listItem: { fontSize: 14, lineHeight: 1.35, marginBottom: 0.5, paddingLeft: 8 },
  noDataText: { fontSize: 14, marginTop: 40 },
});

const SECTION_TITLES = {
  'certificate-details': 'Certificate Details',
  'vaccinations': 'Vaccinations',
  'prophylaxis-safety': 'Prophylaxis & Safety',
};

const FIELD_LABELS = {
  patientIdentifier: 'Patient Identifier',
  certificateNumber: 'Certificate Number',
  destinationCountry: 'Destination Country',
  travelDeparturDate: 'Travel Departure Date',
  certificateValidityPeriod: 'Certificate Validity Period',
  issuingPhysicianLicense: 'Issuing Physician License',
  fitToTravelDeclaration: 'Fit to Travel Declaration',
  travelMedicalInsurance: 'Travel Medical Insurance',
  yellowFeverVaccinationDate: 'Yellow Fever Vaccination Date',
  yellowFeverLotNumber: 'Yellow Fever Lot Number',
  meningococcalVaccinationDate: 'Meningococcal Vaccination Date',
  hepatitisAVaccinationDate: 'Hepatitis A Vaccination Date',
  hepatitisBVaccinationDate: 'Hepatitis B Vaccination Date',
  typhoidVaccinationDate: 'Typhoid Vaccination Date',
  japaneseEncephalitisVaccinationDate: 'Japanese Encephalitis Vaccination Date',
  poliomyelitisBoosterDate: 'Poliomyelitis Booster Date',
  cholerapVaccinationDate: 'Cholera Vaccination Date',
  tdapVaccinationDate: 'Tdap Vaccination Date',
  mmrImmunityStatus: 'MMR Immunity Status',
  rabiesPreExposureProphylaxis: 'Rabies Pre-Exposure Prophylaxis',
  malariaProphylaxisPrescribed: 'Malaria Prophylaxis Prescribed',
  contraindications: 'Contraindications',
  chronicMedications: 'Chronic Medications',
  allergicReactions: 'Allergic Reactions',
};

const SECTION_FIELDS = {
  'certificate-details': ['patientIdentifier', 'certificateNumber', 'destinationCountry', 'travelDeparturDate', 'certificateValidityPeriod', 'issuingPhysicianLicense', 'fitToTravelDeclaration', 'travelMedicalInsurance'],
  'vaccinations': ['yellowFeverVaccinationDate', 'yellowFeverLotNumber', 'meningococcalVaccinationDate', 'hepatitisAVaccinationDate', 'hepatitisBVaccinationDate', 'typhoidVaccinationDate', 'japaneseEncephalitisVaccinationDate', 'poliomyelitisBoosterDate', 'cholerapVaccinationDate', 'tdapVaccinationDate', 'mmrImmunityStatus', 'rabiesPreExposureProphylaxis'],
  'prophylaxis-safety': ['malariaProphylaxisPrescribed', 'contraindications', 'chronicMedications', 'allergicReactions'],
};

const DATE_FIELDS = new Set(['travelDeparturDate', 'yellowFeverVaccinationDate', 'meningococcalVaccinationDate', 'hepatitisAVaccinationDate', 'hepatitisBVaccinationDate', 'typhoidVaccinationDate', 'japaneseEncephalitisVaccinationDate', 'poliomyelitisBoosterDate', 'cholerapVaccinationDate', 'tdapVaccinationDate']);
const BOOLEAN_FIELDS = new Set(['rabiesPreExposureProphylaxis', 'travelMedicalInsurance', 'fitToTravelDeclaration']);
const STRING_ARRAY_FIELDS = new Set(['contraindications', 'chronicMedications']);
const COMMA_ARRAY_FIELDS = new Set(['contraindications']);

const safeString = value => String(value ?? '').replace(/×/g, 'x').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');
const hasVal = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.filter(hasVal).length > 0);
const formatDate = value => { try { const date = new Date(value?.$date || value); if (isNaN(date.getTime())) return safeString(value); return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); } catch { return safeString(value); } };

const splitByComma = text => {
  const source = safeString(text);
  const result = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') { depth += 1; current += character; }
    else if (character === ')') { depth = Math.max(0, depth - 1); current += character; }
    else if (character === ',' && depth === 0) {
      const before = current.trim();
      const after = source.slice(index + 1).trimStart();
      if (/\d$/.test(before) || /^\d/.test(after)) current += character;
      else { if (before) result.push(before); current = ''; }
    } else current += character;
  }
  if (current.trim()) result.push(current.trim());
  return result.length ? result : [source];
};

const splitBySentence = text => {
  const source = safeString(text);
  const result = [];
  let current = '';
  let depth = 0;
  const push = () => { if (current.trim()) result.push(current.trim()); current = ''; };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    const next = source[index + 1] || '';
    const previousWord = current.trim().match(/([A-Za-z]+)$/)?.[1] || '';
    const safePeriod = character === '.' && depth === 0 && /\s/.test(next) && !['Mr', 'Mrs', 'Ms', 'Dr', 'St', 'Jr', 'Sr', 'Prof', 'Rev', 'Gen', 'Col', 'Sgt', 'vs', 'etc'].includes(previousWord) && !/\b[A-Z]$/.test(current) && !/\d$/.test(current);
    const safeSemicolon = character === ';' && depth === 0;
    if (safePeriod || safeSemicolon) { push(); while (/\s/.test(source[index + 1] || '')) index += 1; }
    else current += character;
  }
  push();
  return result.length ? result : [source];
};

const unwrapRecords = data => (Array.isArray(data) ? data : data ? [data] : []).flatMap(record => record?.travel_health_certificates ? (Array.isArray(record.travel_health_certificates) ? record.travel_health_certificates : [record.travel_health_certificates]) : record?.documentData ? (Array.isArray(record.documentData) ? record.documentData : record.documentData?.travel_health_certificates ? (Array.isArray(record.documentData.travel_health_certificates) ? record.documentData.travel_health_certificates : [record.documentData.travel_health_certificates]) : [record.documentData]) : [record]).filter(record => record && typeof record === 'object');

const TravelHealthCertificatesDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);

  const fieldBody = (record, fieldName) => {
    const value = record[fieldName];
    if (BOOLEAN_FIELDS.has(fieldName) ? typeof value !== 'boolean' : !hasVal(value)) return [];
    const label = FIELD_LABELS[fieldName] || fieldName;
    const values = [];
    if (DATE_FIELDS.has(fieldName)) values.push(formatDate(value));
    else if (BOOLEAN_FIELDS.has(fieldName)) values.push(value ? 'Yes' : 'No');
    else if (STRING_ARRAY_FIELDS.has(fieldName)) {
      (Array.isArray(value) ? value : [value]).filter(hasVal).forEach(item => {
        splitBySentence(item).forEach(clause => {
          const items = COMMA_ARRAY_FIELDS.has(fieldName) ? splitByComma(clause) : [clause];
          values.push(...items);
        });
      });
    } else values.push(...splitBySentence(value));

    const rows = values.map((item, index) => <Text key={index} style={styles.listItem}>{index + 1}. {safeString(item)}</Text>);
    if (rows.length <= 6) return [<View key={`${fieldName}-field`} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{rows}</View>];
    const [first, ...rest] = rows;
    return [<View key={`${fieldName}-field`} wrap={false}><Text style={styles.fieldLabel}>{label}</Text>{first}</View>, ...rest];
  };

  const renderSection = (record, sectionId) => {
    let body = [];
    SECTION_FIELDS[sectionId].forEach(fieldName => { body = body.concat(fieldBody(record, fieldName)); });
    if (!body.length) return null;
    body = body.map((element, index) => React.cloneElement(element, { key: `${sectionId}-${index}` }));
    const [first, ...rest] = body;
    return <View key={sectionId}><View wrap={false}><Text style={styles.sectionTitle}>{SECTION_TITLES[sectionId]}</Text>{first}</View>{rest}</View>;
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Travel Health Certificates</Text>
        {records.length === 0 && <Text style={styles.noDataText}>No travel health certificate records available</Text>}
        {records.map((record, index) => (
          <View key={index} break={index > 0}>
            <Text style={styles.recordTitle}>{`Travel Health Certificate ${index + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sectionId => renderSection(record, sectionId))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TravelHealthCertificatesDocumentPDFTemplate;

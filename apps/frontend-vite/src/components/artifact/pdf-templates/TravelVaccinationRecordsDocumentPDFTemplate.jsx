/** Travel Vaccination Records - canonical box-free PDF. */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', paddingBottom: 8, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', paddingBottom: 5, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', paddingBottom: 3, marginTop: 9, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 1, marginTop: 4, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  listItem: { fontSize: 14, lineHeight: 1.4, marginBottom: 1, paddingLeft: 8 },
  noDataText: { fontSize: 14, marginTop: 40 },
});

const SECTION_TITLES = {
  'travel-details': 'Travel Details',
  'vaccine-details': 'Vaccine Details',
  administration: 'Administration',
  'immunity-boosters': 'Immunity & Boosters',
  'provider-clinic': 'Provider & Clinic',
  'yellow-card-certification': 'Yellow Card Certification',
  'disease-risk': 'Disease & Risk',
  'safety-prophylaxis': 'Safety & Prophylaxis',
};

const FIELD_LABELS = {
  date: 'Date',
  destinationCountry: 'Destination Country',
  destinationRegions: 'Destination Regions',
  departureDate: 'Departure Date',
  returnDate: 'Return Date',
  travelDuration: 'Travel Duration (days)',
  travelPurpose: 'Travel Purpose',
  vaccineName: 'Vaccine Name',
  vaccineManufacturer: 'Vaccine Manufacturer',
  vaccineLotNumber: 'Vaccine Lot Number',
  diseaseTargeted: 'Disease Targeted',
  administrationDate: 'Administration Date',
  administrationRoute: 'Administration Route',
  administrationSite: 'Administration Site',
  dosageAmount: 'Dosage Amount',
  doseNumber: 'Dose Number',
  totalDosesRequired: 'Total Doses Required',
  immunityOnsetDate: 'Immunity Onset Date',
  protectionDuration: 'Protection Duration',
  nextDoseDue: 'Next Dose Due',
  boosterDueDate: 'Booster Due Date',
  vaccinatingProvider: 'Vaccinating Provider',
  clinicLocation: 'Clinic Location',
  yellowCardIssued: 'Yellow Card Issued',
  yellowCardNumber: 'Yellow Card Number',
  diseaseRiskLevel: 'Disease Risk Level',
  mandatoryVaccination: 'Mandatory Vaccination',
  adverseReactions: 'Adverse Reactions',
  contraindications: 'Contraindications',
  concomitantMedications: 'Concomitant Medications',
  malariaChemoprophylaxis: 'Malaria Chemoprophylaxis',
};

const SECTION_FIELDS = {
  'travel-details': ['date', 'destinationCountry', 'destinationRegions', 'departureDate', 'returnDate', 'travelDuration', 'travelPurpose'],
  'vaccine-details': ['vaccineName', 'vaccineManufacturer', 'vaccineLotNumber', 'diseaseTargeted'],
  administration: ['administrationDate', 'administrationRoute', 'administrationSite', 'dosageAmount', 'doseNumber', 'totalDosesRequired'],
  'immunity-boosters': ['immunityOnsetDate', 'protectionDuration', 'nextDoseDue', 'boosterDueDate'],
  'provider-clinic': ['vaccinatingProvider', 'clinicLocation'],
  'yellow-card-certification': ['yellowCardIssued', 'yellowCardNumber'],
  'disease-risk': ['diseaseRiskLevel', 'mandatoryVaccination'],
  'safety-prophylaxis': ['adverseReactions', 'contraindications', 'concomitantMedications', 'malariaChemoprophylaxis'],
};

const DATE_FIELDS = new Set(['date', 'departureDate', 'returnDate', 'administrationDate', 'immunityOnsetDate', 'nextDoseDue', 'boosterDueDate']);
const NUMBER_FIELDS = new Set(['travelDuration', 'doseNumber', 'totalDosesRequired']);
const BOOLEAN_FIELDS = new Set(['yellowCardIssued', 'mandatoryVaccination']);
const ARRAY_FIELDS = new Set(['destinationRegions', 'adverseReactions', 'contraindications', 'concomitantMedications']);

const safeString = value => String(value ?? '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...');
const hasVal = value => value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '') && (!Array.isArray(value) || value.some(hasVal));
const formatDate = value => { try { const date = new Date(value?.$date || value); if (isNaN(date.getTime())) return safeString(value); return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); } catch { return safeString(value); } };
const splitBySentence = text => safeString(text).split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\d)\.(?:\s+)|;\s+/).map(part => part.trim()).filter(Boolean);
const enumCanonical = value => ['Intramuscular', 'Subcutaneous', 'Oral', 'Intradermal'].find(option => option.toLowerCase() === safeString(value).toLowerCase()) || safeString(value);

const unwrapRecords = data => (Array.isArray(data) ? data : data ? [data] : []).flatMap(record =>
  record?.travel_vaccination_records
    ? (Array.isArray(record.travel_vaccination_records) ? record.travel_vaccination_records : [record.travel_vaccination_records])
    : record?.documentData
      ? (Array.isArray(record.documentData) ? record.documentData : record.documentData?.travel_vaccination_records ? (Array.isArray(record.documentData.travel_vaccination_records) ? record.documentData.travel_vaccination_records : [record.documentData.travel_vaccination_records]) : [record.documentData])
      : [record]
).filter(record => record && typeof record === 'object');

const TravelVaccinationRecordsDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);

  const rowsForField = (record, field) => {
    const value = record[field];
    if (!hasVal(value) && !(NUMBER_FIELDS.has(field) && value === 0)) return [];
    if (DATE_FIELDS.has(field)) return [formatDate(value)];
    if (NUMBER_FIELDS.has(field)) {
      if (!Number.isFinite(Number(value))) return [];
      const doctorEdited = Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(field);
      return Number(value) !== 0 || doctorEdited ? [safeString(value)] : [];
    }
    if (BOOLEAN_FIELDS.has(field)) return typeof value === 'boolean' ? [value ? 'Yes' : 'No'] : [];
    if (ARRAY_FIELDS.has(field)) return (Array.isArray(value) ? value : [value]).filter(hasVal).map(safeString);
    if (field === 'administrationRoute') return [enumCanonical(value)];
    if (field === 'diseaseRiskLevel' || field === 'malariaChemoprophylaxis') return splitBySentence(value);
    return [safeString(value)];
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
        <Text style={styles.documentTitle}>Travel Vaccination Records</Text>
        {records.length === 0 && <Text style={styles.noDataText}>No travel vaccination records available</Text>}
        {records.map((record, index) => (
          <View key={index} break={index > 0}>
            <Text style={styles.recordTitle}>{`Travel Vaccination ${index + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sectionId => renderSection(record, sectionId))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TravelVaccinationRecordsDocumentPDFTemplate;

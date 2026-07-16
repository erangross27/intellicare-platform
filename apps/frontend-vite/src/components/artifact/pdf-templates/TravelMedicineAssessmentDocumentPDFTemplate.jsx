/** Travel Medicine Assessment - canonical box-free PDF. */
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
  'trip-details': 'Trip Details',
  'vaccinations-prophylaxis': 'Vaccinations & Prophylaxis',
  'risk-assessment': 'Risk Assessment',
  'conditions-logistics': 'Conditions & Logistics',
};

const FIELD_LABELS = {
  date: 'Date',
  destinationCountries: 'Destination Countries',
  departureDate: 'Departure Date',
  returnDate: 'Return Date',
  tripDurationDays: 'Trip Duration (Days)',
  purposeOfTravel: 'Purpose of Travel',
  accommodationType: 'Accommodation Type',
  ruralExposure: 'Rural Exposure',
  vaccinesAdministered: 'Vaccines Administered',
  yellowFeverVaccineGiven: 'Yellow Fever Vaccine Given',
  certificateOfVaccinationIssued: 'Certificate of Vaccination Issued',
  malariaProphylaxisPrescribed: 'Malaria Prophylaxis Prescribed',
  malariaRiskLevel: 'Malaria Risk Level',
  travelersDiarrheaProphylaxis: "Traveler's Diarrhea Prophylaxis",
  altitudeSicknessRisk: 'Altitude Sickness Risk',
  insectBorneDiseasePrecautions: 'Insect-Borne Disease Precautions',
  foodWaterSafetyEducation: 'Food and Water Safety Education',
  preExistingConditions: 'Pre-Existing Conditions',
  immunocompromisedStatus: 'Immunocompromised Status',
  pregnancyStatus: 'Pregnancy Status',
  previousTravelHistory: 'Previous Travel History',
  exposureRisks: 'Exposure Risks',
  travelInsuranceStatus: 'Travel Insurance Status',
  emergencyContactAbroad: 'Emergency Contact Abroad',
};

const SECTION_FIELDS = {
  'trip-details': ['date', 'destinationCountries', 'departureDate', 'returnDate', 'tripDurationDays', 'purposeOfTravel', 'accommodationType'],
  'vaccinations-prophylaxis': ['vaccinesAdministered', 'yellowFeverVaccineGiven', 'certificateOfVaccinationIssued', 'malariaProphylaxisPrescribed', 'malariaRiskLevel', 'travelersDiarrheaProphylaxis'],
  'risk-assessment': ['ruralExposure', 'altitudeSicknessRisk', 'insectBorneDiseasePrecautions', 'foodWaterSafetyEducation', 'exposureRisks'],
  'conditions-logistics': ['preExistingConditions', 'immunocompromisedStatus', 'pregnancyStatus', 'previousTravelHistory', 'travelInsuranceStatus', 'emergencyContactAbroad'],
};

const DATE_FIELDS = new Set(['date', 'departureDate', 'returnDate']);
const NUMBER_FIELDS = new Set(['tripDurationDays']);
const BOOLEAN_FIELDS = new Set(['ruralExposure', 'yellowFeverVaccineGiven', 'certificateOfVaccinationIssued', 'altitudeSicknessRisk', 'foodWaterSafetyEducation', 'immunocompromisedStatus']);
const ARRAY_FIELDS = new Set(['destinationCountries', 'vaccinesAdministered', 'preExistingConditions', 'exposureRisks']);
const COMMA_SPLIT_FIELDS = new Set(['accommodationType', 'malariaProphylaxisPrescribed', 'insectBorneDiseasePrecautions']);

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
  const clauses = safeString(text).split(/(?<!\d)\.(?:\s+)|;\s+/).map(part => part.trim()).filter(Boolean);
  if (!COMMA_SPLIT_FIELDS.has(field)) return clauses;
  return clauses.flatMap(splitTopLevelCommas).filter(Boolean);
};

const unwrapRecords = data => (Array.isArray(data) ? data : data ? [data] : []).flatMap(record =>
  record?.travel_medicine_assessment
    ? (Array.isArray(record.travel_medicine_assessment) ? record.travel_medicine_assessment : [record.travel_medicine_assessment])
    : record?.documentData
      ? (Array.isArray(record.documentData) ? record.documentData : record.documentData?.travel_medicine_assessment ? (Array.isArray(record.documentData.travel_medicine_assessment) ? record.documentData.travel_medicine_assessment : [record.documentData.travel_medicine_assessment]) : [record.documentData])
      : [record]
).filter(record => record && typeof record === 'object');

const TravelMedicineAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = unwrapRecords(data);

  const rowsForField = (record, field) => {
    const value = record[field];
    if (!hasVal(value)) return [];
    if (DATE_FIELDS.has(field)) return [formatDate(value)];
    if (NUMBER_FIELDS.has(field)) {
      if (!Number.isFinite(Number(value))) return [];
      const doctorEdited = Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(field);
      return Number(value) !== 0 || doctorEdited ? [safeString(value)] : [];
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
        <Text style={styles.documentTitle}>Travel Medicine Assessment</Text>
        {records.length === 0 && <Text style={styles.noDataText}>No travel medicine assessment records available</Text>}
        {records.map((record, index) => (
          <View key={index} break={index > 0}>
            <Text style={styles.recordTitle}>{`Travel Medicine Assessment ${index + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sectionId => renderSection(record, sectionId))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default TravelMedicineAssessmentDocumentPDFTemplate;

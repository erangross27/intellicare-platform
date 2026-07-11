/**
 * TravelMedicineAssessmentDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — A4 — BLACK & WHITE only (#000000 titles/borders/values, NO blue).
 * Collection: travel_medicine_assessment.
 *
 * BOX-FREE (no backgroundColor/border on field/section views; recordHeader = black bottom-border only).
 * Rule #74 (per-field gating): each field renders as wrap-gated <View>(s) — the section View has NO wrap
 * prop (always flows / never compresses) and the sectionTitle is embedded INSIDE the first present
 * field's View (anti-orphan). Per-field wrap: wrap={rows > 8 ? undefined : false}; only recordHeader
 * is wrap={false}. Single-name skip: hide a field label when it equals the section title.
 *
 * Field classification mirrors the live component:
 *   DATE: date, departureDate, returnDate
 *   NUMBER (hide-zero): tripDurationDays
 *   BOOLEAN (Yes/No, false renders as "No"): ruralExposure, yellowFeverVaccineGiven,
 *     certificateOfVaccinationIssued, altitudeSicknessRisk, foodWaterSafetyEducation, immunocompromisedStatus
 *   STRING ARRAY (numbered): destinationCountries, vaccinesAdministered, preExistingConditions, exposureRisks
 *   STRING (per-sentence): everything else
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 11, color: '#000000', marginTop: 3 },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2, textTransform: 'uppercase' },
  value: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 1 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 10, color: '#000000' },
});

/* ═══════ CONSTANTS ═══════ */
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
  foodWaterSafetyEducation: 'Food & Water Safety Education',
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
const SECTION_ORDER = ['trip-details', 'vaccinations-prophylaxis', 'risk-assessment', 'conditions-logistics'];
const DATE_FIELDS = ['date', 'departureDate', 'returnDate'];
const NUMBER_FIELDS = ['tripDurationDays'];
const BOOLEAN_FIELDS = ['ruralExposure', 'yellowFeverVaccineGiven', 'certificateOfVaccinationIssued', 'altitudeSicknessRisk', 'foodWaterSafetyEducation', 'immunocompromisedStatus'];
const STRING_ARRAY_FIELDS = ['destinationCountries', 'vaccinesAdministered', 'preExistingConditions', 'exposureRisks'];

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

/* hide-zero numeric for PDF: hide 0/null UNLESS doctor-edited */
const numberShowsPDF = (record, field) => {
  const val = record[field];
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  if (Number.isNaN(num)) return false;
  if (num === 0) return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(field);
  return true;
};

/* Rule #74 (per-field gating): render a field as wrap-gated View(s). sectionTitle goes INSIDE the
   first View (isFirst) — never a sibling (would orphan). Returns an ARRAY of Views. */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (NUMBER_FIELDS.includes(field)) {
    if (!numberShowsPDF(record, field)) return [];
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>{String(val)}</Text>
      </View>
    )];
  }

  if (BOOLEAN_FIELDS.includes(field)) {
    if (typeof val !== 'boolean') return [];
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>{val ? 'Yes' : 'No'}</Text>
      </View>
    )];
  }

  if (!hasVal(val)) return [];

  if (DATE_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>{formatDate(val)}</Text>
      </View>
    )];
  }

  if (STRING_ARRAY_FIELDS.includes(field)) {
    const items = (Array.isArray(val) ? val : []).filter(x => !isEmptyDeep(x));
    if (items.length === 0) return [];
    return [(
      <View key={field} style={styles.fieldGroup} wrap={items.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((it, i) => (<Text key={i} style={styles.value}>{i + 1}. {fmtVal(it)}</Text>))}
      </View>
    )];
  }

  /* string — split into sentences */
  const strVal = fmtVal(val);
  const sentences = splitBySentence(strVal);
  if (sentences.length > 1) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={sentences.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {sentences.map((s, sIdx) => (<Text key={sIdx} style={styles.value}>{sIdx + 1}. {s}</Text>))}
      </View>
    )];
  }
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.value}>{strVal}</Text>
    </View>
  )];
};

/* a field is "present" for the section if it would render at least one View */
const fieldPresent = (record, field) => {
  if (NUMBER_FIELDS.includes(field)) return numberShowsPDF(record, field);
  if (BOOLEAN_FIELDS.includes(field)) return typeof record[field] === 'boolean';
  return hasVal(record[field]);
};

const TravelMedicineAssessmentDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.travel_medicine_assessment) records = Array.isArray(data[0].travel_medicine_assessment) ? data[0].travel_medicine_assessment : [data[0].travel_medicine_assessment];
    else records = data;
  } else if (data?.travel_medicine_assessment) records = Array.isArray(data.travel_medicine_assessment) ? data.travel_medicine_assessment : [data.travel_medicine_assessment];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.travel_medicine_assessment) records = Array.isArray(dd.travel_medicine_assessment) ? dd.travel_medicine_assessment : [dd.travel_medicine_assessment]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (<Document><Page size="A4" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Travel Medicine Assessment</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Travel Medicine Assessment</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Travel Medicine Assessment ${String(record._recordNumber || idx + 1)}`}</Text>
              {hasVal(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>

            {/* Rule #74 (per-field gating): the section View only provides spacing and always FLOWS
                (no wrap prop -> never compresses). Each field is its own wrap-gated unit (via renderField),
                with the sectionTitle embedded INSIDE the first present field's View (anti-orphan). */}
            {SECTION_ORDER.map((sid) => {
              const fields = SECTION_FIELDS[sid];
              const presentFields = fields.filter(f => fieldPresent(record, f));
              if (presentFields.length === 0) return null;
              const title = SECTION_TITLES[sid];
              return (
                <View key={sid} style={styles.section}>
                  {presentFields.flatMap((f, fi) => renderField(record, f, title, fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default TravelMedicineAssessmentDocumentPDFTemplate;

/**
 * TravelHealthCertificatesDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — A4 — BLACK & WHITE only (#000000 titles/borders/values, NO blue).
 * Collection: travel_health_certificates.
 *
 * TITLE-ONLY record header (no header date). BOX-FREE (no backgroundColor/border on
 * field/section views; recordHeader = black bottom-border only).
 * Rule #74 (per-field gating): each field is ONE wrap-gated <View> (renderField returns an
 * array of wrap-gated Views); the sectionTitle is embedded INSIDE the first present field's
 * View (isFirst); the section <View> has NO wrap prop; only recordHeader is wrap={false}.
 * Single-name skip: hide a field label when it equals the section title.
 * Booleans render Yes/No (false NOT hidden). Strings split on '. ' AND '; '.
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
const SECTION_ORDER = ['certificate-details', 'vaccinations', 'prophylaxis-safety'];
const DATE_FIELDS = ['travelDeparturDate', 'yellowFeverVaccinationDate', 'meningococcalVaccinationDate', 'hepatitisAVaccinationDate', 'hepatitisBVaccinationDate', 'typhoidVaccinationDate', 'japaneseEncephalitisVaccinationDate', 'poliomyelitisBoosterDate', 'cholerapVaccinationDate', 'tdapVaccinationDate'];
const BOOLEAN_FIELDS = ['rabiesPreExposureProphylaxis', 'travelMedicalInsurance', 'fitToTravelDeclaration'];
const STRING_ARRAY_FIELDS = ['contraindications', 'chronicMedications', 'allergicReactions'];

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

/* Rule #74 (per-field gating): render a field as a wrap-gated View — EACH View is one wrap unit
   (rows<=8 -> wrap={false}; rows>8 -> wrap=undefined flows). sectionTitle goes INSIDE the first
   present field's View (isFirst) — never a sibling (anti-orphan). Returns an ARRAY of Views. */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  const isBool = BOOLEAN_FIELDS.includes(field);
  if (isBool ? typeof val !== 'boolean' : !hasVal(val)) return [];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (DATE_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>{formatDate(val)}</Text>
      </View>
    )];
  }

  if (isBool) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>{val ? 'Yes' : 'No'}</Text>
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

const TravelHealthCertificatesDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.travel_health_certificates) records = Array.isArray(data[0].travel_health_certificates) ? data[0].travel_health_certificates : [data[0].travel_health_certificates];
    else records = data;
  } else if (data?.travel_health_certificates) records = Array.isArray(data.travel_health_certificates) ? data.travel_health_certificates : [data.travel_health_certificates];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.travel_health_certificates) records = Array.isArray(dd.travel_health_certificates) ? dd.travel_health_certificates : [dd.travel_health_certificates]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (<Document><Page size="A4" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Travel Health Certificates</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  const fieldPresent = (record, f) => BOOLEAN_FIELDS.includes(f) ? typeof record[f] === 'boolean' : hasVal(record[f]);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Travel Health Certificates</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Travel Health Certificate ${String(record._recordNumber || idx + 1)}`}</Text>
            </View>

            {/* Rule #74 (per-field gating): the section View only provides spacing and always FLOWS
                (no wrap prop). Each field is its own wrap-gated unit (via renderField), with the
                sectionTitle embedded INSIDE the first present field's View (anti-orphan). */}
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

export default TravelHealthCertificatesDocumentPDFTemplate;

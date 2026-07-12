import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    lineHeight: 1.5,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  documentTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 8,
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  recordTitle: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 6,
    marginTop: 6,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingBottom: 4,
    marginTop: 14,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    paddingBottom: 3,
    marginTop: 8,
    marginBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    borderBottomStyle: 'solid',
  },
  value: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
  },
  listItem: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 3,
    paddingLeft: 8,
  },
  noDataText: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    marginTop: 40,
  },
});

/* ======= CONFIG (mirrors ProviderInfoDocument.jsx) ======= */
const SECTION_TITLES = {
  'identification': 'Identification & Licensing',
  'specialties': 'Specialties',
  'board-certifications': 'Board Certifications',
  'education': 'Education & Training',
  'hospital-affiliations': 'Hospital Affiliations',
  'credentialing': 'Credentialing & Insurance',
  'clinical-privileges': 'Clinical Privileges',
  'quality-review': 'Quality & Review',
  'practice-details': 'Practice Details',
  'research-academic': 'Research & Academic',
};

const SECTION_ORDER = ['identification', 'specialties', 'board-certifications', 'education', 'hospital-affiliations', 'credentialing', 'clinical-privileges', 'quality-review', 'practice-details', 'research-academic'];

const SECTION_FIELDS = {
  'identification': ['npiNumber', 'deaNumber', 'medicalLicenseNumber', 'taxonomyCode'],
  'specialties': ['primarySpecialty', 'subspecialties'],
  'board-certifications': ['boardCertifications'],
  'education': ['medicalSchool', 'residencyProgram', 'fellowshipPrograms'],
  'hospital-affiliations': ['hospitalAffiliations'],
  'credentialing': ['credentialingStatus', 'malpracticeInsuranceCarrier', 'yearsInPractice'],
  'clinical-privileges': ['procedurePrivileges', 'prescribingAuthorizations'],
  'quality-review': ['qualityMetricsScore', 'peerReviewStatus', 'cmeCreditsCompleted'],
  'practice-details': ['telemedicineCapable', 'languagesSpoken'],
  'research-academic': ['academicAppointment', 'clinicalResearchInvolvement'],
};

const FIELD_LABELS = {
  npiNumber: 'NPI Number',
  deaNumber: 'DEA Number',
  medicalLicenseNumber: 'Medical License Number',
  taxonomyCode: 'Taxonomy Code',
  primarySpecialty: 'Primary Specialty',
  subspecialties: 'Subspecialties',
  boardCertifications: 'Board Certifications',
  medicalSchool: 'Medical School',
  residencyProgram: 'Residency Program',
  fellowshipPrograms: 'Fellowship Programs',
  hospitalAffiliations: 'Hospital Affiliations',
  credentialingStatus: 'Credentialing Status',
  malpracticeInsuranceCarrier: 'Malpractice Insurance Carrier',
  yearsInPractice: 'Years In Practice',
  procedurePrivileges: 'Procedure Privileges',
  prescribingAuthorizations: 'Prescribing Authorizations',
  qualityMetricsScore: 'Quality Metrics Score',
  peerReviewStatus: 'Peer Review Status',
  cmeCreditsCompleted: 'CME Credits Completed',
  telemedicineCapable: 'Telemedicine Capable',
  languagesSpoken: 'Languages Spoken',
  academicAppointment: 'Academic Appointment',
  clinicalResearchInvolvement: 'Clinical Research Involvement',
};

const BOOLEAN_FIELDS = ['telemedicineCapable'];
const NUMBER_FIELDS = ['yearsInPractice', 'qualityMetricsScore', 'cmeCreditsCompleted'];
const ARRAY_FIELDS = ['subspecialties', 'boardCertifications', 'fellowshipPrograms', 'hospitalAffiliations', 'procedurePrivileges', 'prescribingAuthorizations', 'languagesSpoken', 'clinicalResearchInvolvement'];

/* drop a field's own label when it duplicates the section title (single-name gate) */
const sameAsTitle = (label, sid) => (label || '').trim().toLowerCase() === (SECTION_TITLES[sid] || '').trim().toLowerCase();

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val)
    .replace(/×/g, 'x')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
};

const hasVal = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return true;
  if (typeof v === 'boolean') return true;
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/)
    .map(s => s.trim())
    .filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* flat Text element builder for a single field — returns [] when empty */
const fieldEls = (record, f, sid) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const show = !sameAsTitle(label, sid);
  const labelEl = <Text key={f + '-l'} style={styles.fieldLabel}>{label}</Text>;

  if (BOOLEAN_FIELDS.includes(f)) {
    const els = show ? [labelEl] : [];
    els.push(<Text key={f + '-v'} style={styles.value}>{val ? 'Yes' : 'No'}</Text>);
    return els;
  }
  if (NUMBER_FIELDS.includes(f)) {
    if (typeof val === 'number' && val === 0) return []; // sentinel zero — "not recorded"
    const els = show ? [labelEl] : [];
    els.push(<Text key={f + '-v'} style={styles.value}>{safeString(val)}</Text>);
    return els;
  }
  if (ARRAY_FIELDS.includes(f)) {
    const items = (Array.isArray(val) ? val : [val]).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
    if (!items.length) return [];
    const els = show ? [labelEl] : [];
    items.forEach((it, i) => els.push(<Text key={f + '-i' + i} style={styles.listItem}>{i + 1}. {safeString(it)}</Text>));
    return els;
  }
  // STRING
  const str = safeString(val);
  const sentences = splitBySentence(str);
  const els = show ? [labelEl] : [];
  if (sentences.length > 1) {
    sentences.forEach((s, i) => els.push(<Text key={f + '-s' + i} style={styles.value}>{s.replace(/[.;]+$/, '')}.</Text>));
  } else {
    els.push(<Text key={f + '-v'} style={styles.value}>{str}</Text>);
  }
  return els;
};

/* FLATTEN anti-orphan: glue the section title to its first body line so a title
   never lands alone at the bottom of a page; the rest flow naturally. */
const renderSection = (record, sid) => {
  let body = [];
  (SECTION_FIELDS[sid] || []).forEach(f => { body = body.concat(fieldEls(record, f, sid)); });
  if (!body.length) return null;
  const first = body[0];
  const rest = body.slice(1).map((el, i) => React.cloneElement(el, { key: 'f' + i }));
  return (
    <View key={sid}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
        {first}
      </View>
      {rest}
    </View>
  );
};

const ProviderInfoDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.provider_info) {
        return inputData[0].provider_info;
      }
      return inputData;
    }
    if (inputData.provider_info) {
      return inputData.provider_info;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Provider Info</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Provider Info</Text>

        {records.map((record, index) => (
          <View key={index} break={index > 0}>
            <Text style={styles.recordTitle}>{safeString(record.providerName) || `Provider Info ${index + 1}`}</Text>
            {SECTION_ORDER.map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ProviderInfoDocumentPDFTemplate;

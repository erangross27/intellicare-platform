/**
 * StiScreeningPanelDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — STI screening panel
 * Collection: sti_screening_panel
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page:            { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader:  { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle:   { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader:    { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  recordDateRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate:      { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle:     { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section:         { marginBottom: 16 },
  sectionTitle:    { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox:        { marginBottom: 10 },
  fieldLabel:      { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue:      { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem:        { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  separator:       { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText:      { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string')  return val;
  if (typeof val === 'number')  return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number')  return true;
  if (typeof v === 'string')  return v.trim() !== '';
  if (Array.isArray(v))       return v.length > 0;
  if (typeof v === 'object')  return Object.keys(v).length > 0;
  return true;
};

/* ======= SECTION CONFIG ======= */
const SECTION_TITLES = {
  'screening-info':   'Screening Information',
  'hiv-status':       'HIV Status',
  'syphilis-results': 'Syphilis Results',
  'bacterial-stis':   'Bacterial STIs',
  'viral-hepatitis':  'Viral Hepatitis',
  'additional-tests': 'Additional Tests',
};

const FIELD_LABELS = {
  screeningDate:                    'Screening Date',
  hivAntigenAntibodyResult:         'HIV Antigen/Antibody Result',
  hivViralLoadCopies:               'HIV Viral Load (copies/mL)',
  hivConfirmatoryMethod:            'HIV Confirmatory Method',
  cd4CountCellsPerMicroliter:       'CD4 Count (cells/µL)',
  cd4Cd8Ratio:                      'CD4/CD8 Ratio',
  prepEligibilityStatus:            'PrEP Eligibility Status',
  rprTiter:                         'RPR Titer',
  treponemaPallidumAntibody:        'Treponema Pallidum Antibody',
  syphilisStage:                    'Syphilis Stage',
  chlamydiaNaatResult:              'Chlamydia NAAT Result',
  gonorrheaNaatResult:              'Gonorrhea NAAT Result',
  specimenSourceSite:               'Specimen Source Site',
  mycoplasmaGenitaliumNaat:         'Mycoplasma Genitalium NAAT',
  antimicrobialResistanceMarkers:   'Antimicrobial Resistance Markers',
  hepatitisBSurfaceAntigen:         'Hepatitis B Surface Antigen',
  hepatitisBSurfaceAntibody:        'Hepatitis B Surface Antibody',
  hepatitisBCoreAntibody:           'Hepatitis B Core Antibody',
  hepatitisCantibodyResult:         'Hepatitis C Antibody Result',
  hcvRnaQuantitative:               'HCV RNA Quantitative',
  hsvTypeSpecificIgG:               'HSV Type-Specific IgG',
  trichomonasVaginalisResult:       'Trichomonas Vaginalis Result',
  humanPapillomavirusHighRisk:      'HPV High-Risk',
  hpvGenotyping:                    'HPV Genotyping',
  expeditedPartnerTherapyProvided:  'Expedited Partner Therapy Provided',
};

const SECTION_FIELDS = {
  'screening-info':   ['screeningDate'],
  'hiv-status':       ['hivAntigenAntibodyResult', 'hivViralLoadCopies', 'hivConfirmatoryMethod', 'cd4CountCellsPerMicroliter', 'cd4Cd8Ratio', 'prepEligibilityStatus'],
  'syphilis-results': ['rprTiter', 'treponemaPallidumAntibody', 'syphilisStage'],
  'bacterial-stis':   ['chlamydiaNaatResult', 'gonorrheaNaatResult', 'specimenSourceSite', 'mycoplasmaGenitaliumNaat', 'antimicrobialResistanceMarkers'],
  'viral-hepatitis':  ['hepatitisBSurfaceAntigen', 'hepatitisBSurfaceAntibody', 'hepatitisBCoreAntibody', 'hepatitisCantibodyResult', 'hcvRnaQuantitative'],
  'additional-tests': ['hsvTypeSpecificIgG', 'trichomonasVaginalisResult', 'humanPapillomavirusHighRisk', 'hpvGenotyping', 'expeditedPartnerTherapyProvided'],
};

const DATE_FIELDS    = ['screeningDate'];
const BOOLEAN_FIELDS = ['prepEligibilityStatus', 'expeditedPartnerTherapyProvided'];
const NUMBER_FIELDS  = ['hivViralLoadCopies', 'cd4CountCellsPerMicroliter', 'cd4Cd8Ratio', 'hcvRnaQuantitative'];
const ARRAY_FIELDS   = ['specimenSourceSite', 'hpvGenotyping', 'antimicrobialResistanceMarkers'];

/* ======= RENDER FIELD ======= */
const renderField = (record, fn, sectionTitle) => {
  const val = record[fn];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[fn] || fn;
  const showLabel = label.toLowerCase() !== (sectionTitle || '').toLowerCase();

  if (DATE_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={styles.fieldBox}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{formatDate(val)}</Text>
      </View>
    );
  }

  if (BOOLEAN_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={styles.fieldBox}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>
      </View>
    );
  }

  if (NUMBER_FIELDS.includes(fn)) {
    return (
      <View key={fn} style={styles.fieldBox}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{String(val)}</Text>
      </View>
    );
  }

  if (ARRAY_FIELDS.includes(fn)) {
    const items = Array.isArray(val) ? val.filter(i => i && String(i).trim()) : [];
    if (items.length === 0) return null;
    return (
      <View key={fn} style={styles.fieldBox}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{`${i + 1}. ${safeString(item)}`}</Text>
        ))}
      </View>
    );
  }

  return (
    <View key={fn} style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(val)}</Text>
    </View>
  );
};

/* ======= RENDER SECTION ======= */
const renderSection = (record, sid) => {
  const title = SECTION_TITLES[sid];
  const fields = SECTION_FIELDS[sid] || [];
  const presentFields = fields.filter(f => hasVal(record[f]));
  if (presentFields.length === 0) return null;
  return (
    <View key={sid} style={styles.fieldBox} wrap={presentFields.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {presentFields.map(f => renderField(record, f, title))}
    </View>
  );
};

/* ======= MAIN COMPONENT ======= */
const StiScreeningPanelDocumentPDFTemplate = ({ document: docProp }) => {
  let records = [];
  if (Array.isArray(docProp)) {
    if (docProp.length > 0 && docProp[0].sti_screening_panel && Array.isArray(docProp[0].sti_screening_panel)) {
      records = docProp[0].sti_screening_panel;
    } else {
      records = docProp;
    }
  } else if (docProp && docProp.sti_screening_panel) {
    records = Array.isArray(docProp.sti_screening_panel) ? docProp.sti_screening_panel : [docProp.sti_screening_panel];
  } else if (docProp) {
    records = [docProp];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>STI Screening Panel</Text>
          </View>
          <Text style={styles.noDataText}>No STI screening panel data available.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>STI Screening Panel</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View wrap={false} style={styles.recordHeader}>
              {hasVal(record.screeningDate) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.screeningDate)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>{`STI Screening Panel ${idx + 1}`}</Text>
            </View>
            {renderSection(record, 'screening-info')}
            {renderSection(record, 'hiv-status')}
            {renderSection(record, 'syphilis-results')}
            {renderSection(record, 'bacterial-stis')}
            {renderSection(record, 'viral-hepatitis')}
            {renderSection(record, 'additional-tests')}
            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default StiScreeningPanelDocumentPDFTemplate;

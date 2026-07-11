/**
 * DonorEggCycleDocumentPDFTemplate.jsx
 * July 2026 — box-free canonical — LETTER — BLACK & WHITE ONLY (#000000)
 * Collection: donor_egg_cycle. Mirrors DonorEggCycleDocument.jsx (4-area rule): numbered value rows,
 * enum canonical, arrays verbatim, sentence-split strings; section title rides INSIDE the first field's
 * glue View, per-field wrap={false} anti-orphan, break={idx>0}.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center' },
  recordContainer: { paddingBottom: 18 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 6 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 10, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldGroup: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 1 },
  noDataText: { fontSize: 14, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ═══════ CONFIG (mirror JSX) ═══════ */
const SECTION_TITLES = {
  'donor-profile': 'Donor Profile', 'stimulation': 'Stimulation', 'retrieval-fertilization': 'Retrieval & Fertilization',
  'embryo-results': 'Embryo Results', 'recipient-preparation': 'Recipient Preparation', 'transfer': 'Transfer',
};
const FIELD_LABELS = {
  donorAge: 'Donor Age', donorAmhLevel: 'Donor AMH Level', donorAntralFollicleCount: 'Donor Antral Follicle Count',
  donorDayThreeEstrogenLevel: 'Donor Day 3 Estrogen Level', donorDayThreeFshLevel: 'Donor Day 3 FSH Level',
  gonadotropinProtocol: 'Gonadotropin Protocol', totalGonadotropinDose: 'Total Gonadotropin Dose',
  stimulationDurationDays: 'Stimulation Duration (Days)', peakEstradiolLevel: 'Peak Estradiol Level',
  triggerMedicationType: 'Trigger Medication Type', oocytesRetrieved: 'Oocytes Retrieved', matureOocytesMii: 'Mature Oocytes (MII)',
  fertilizationMethod: 'Fertilization Method', twoProNucleiRate: '2PN Rate', blastocystFormationRate: 'Blastocyst Formation Rate',
  gardnerGradeBlastocysts: 'Gardner Grade Blastocysts', pgtaEuploidEmbryos: 'PGT-A Euploid Embryos',
  recipientEndometrialThickness: 'Recipient Endometrial Thickness', recipientEndometrialPattern: 'Recipient Endometrial Pattern',
  recipientEstrogenProtocol: 'Recipient Estrogen Protocol', progesteroneSupportType: 'Progesterone Support Type',
  embryosTransferred: 'Embryos Transferred', embryoTransferDay: 'Embryo Transfer Day', transferCatheterType: 'Transfer Catheter Type',
  ovarianHyperstimulationRisk: 'Ovarian Hyperstimulation Risk',
};
const SECTION_FIELDS = {
  'donor-profile': ['donorAge', 'donorAmhLevel', 'donorAntralFollicleCount', 'donorDayThreeEstrogenLevel', 'donorDayThreeFshLevel'],
  'stimulation': ['gonadotropinProtocol', 'totalGonadotropinDose', 'stimulationDurationDays', 'peakEstradiolLevel', 'triggerMedicationType'],
  'retrieval-fertilization': ['oocytesRetrieved', 'matureOocytesMii', 'fertilizationMethod', 'twoProNucleiRate', 'blastocystFormationRate'],
  'embryo-results': ['gardnerGradeBlastocysts', 'pgtaEuploidEmbryos'],
  'recipient-preparation': ['recipientEndometrialThickness', 'recipientEndometrialPattern', 'recipientEstrogenProtocol', 'progesteroneSupportType'],
  'transfer': ['embryosTransferred', 'embryoTransferDay', 'transferCatheterType', 'ovarianHyperstimulationRisk'],
};
const ARRAY_FIELDS = ['gardnerGradeBlastocysts'];
const STRING_FIELDS = ['triggerMedicationType', 'recipientEstrogenProtocol', 'progesteroneSupportType', 'transferCatheterType'];
const ENUM_FIELDS = {
  fertilizationMethod: ['Conventional IVF', 'ICSI', 'IVF + ICSI (Split)'],
  recipientEndometrialPattern: ['Trilaminar', 'Non-trilaminar', 'Homogeneous', 'Isoechoic'],
  ovarianHyperstimulationRisk: ['Low', 'Moderate', 'High'],
  gonadotropinProtocol: ['GnRH Antagonist', 'GnRH Agonist (Long)', 'Microdose Flare', 'Estrogen Priming Antagonist'],
};

/* ═══════ UTILS ═══════ */
const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0;
  return true;
};
const enumCanonical = (options, current) => {
  if (current === null || current === undefined || String(current).trim() === '') return '';
  const c = String(current).trim().toLowerCase();
  const match = (options || []).find(o => o.toLowerCase() === c);
  return match || String(current).trim();
};
const arrItem = (x) => (x === null || x === undefined) ? '' : (typeof x === 'object' ? (x.text || x.grade || JSON.stringify(x)) : String(x));
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const dispVal = (fn, v) => ENUM_FIELDS[fn] ? (enumCanonical(ENUM_FIELDS[fn], v) || String(v)) : (typeof v === 'number' ? String(v) : String(v));
const fieldRows = (record, fn) => {
  const v = record[fn];
  if (ARRAY_FIELDS.includes(fn)) {
    return (Array.isArray(v) ? v : [v]).filter(x => arrItem(x).trim() !== '').map((x, i) => ({ value: `${i + 1}. ${arrItem(x)}` }));
  }
  if (STRING_FIELDS.includes(fn)) {
    const s = splitBySentence(String(v));
    if (s.length > 1) return s.map((x, i) => ({ value: `${i + 1}. ${x}` }));
  }
  return [{ value: `1. ${dispVal(fn, v)}` }];
};

const renderField = (record, fn, sectionTitle) => {
  const label = FIELD_LABELS[fn] || fn;
  const rows = fieldRows(record, fn);
  return (
    <View key={fn} style={styles.fieldGroup} wrap={false}>
      {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((r, i) => <Text key={i} style={styles.fieldValue}>{r.value}</Text>)}
    </View>
  );
};

const renderSection = (record, sid) => {
  const fields = SECTION_FIELDS[sid] || [];
  const present = fields.filter(f => hasVal(record[f]));
  if (present.length === 0) return null;
  const title = SECTION_TITLES[sid];
  return present.map((f, i) => renderField(record, f, i === 0 ? title : null));
};

/* ═══════ MAIN ═══════ */
const DonorEggCycleDocumentPDFTemplate = ({ document: records }) => {
  const valid = (Array.isArray(records) ? records : [records]).filter(r => r && typeof r === 'object');
  const DOC_TITLE = 'Donor Egg Cycle';
  if (valid.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
          <Text style={styles.noDataText}>No donor egg cycle data available.</Text>
        </Page>
      </Document>
    );
  }
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>{DOC_TITLE}</Text></View>
        {valid.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`${DOC_TITLE} ${idx + 1}`}</Text>
            {Object.keys(SECTION_FIELDS).map(sid => renderSection(record, sid))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default DonorEggCycleDocumentPDFTemplate;

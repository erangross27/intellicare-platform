/**
 * SingleEmbryoTransferDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — single embryo transfer
 * Collection: single_embryo_transfer
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333333', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#333333', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#333333', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try { const d = new Date(dateStr.$date || dateStr); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateStr); }
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* ======= FIELD DEFINITIONS ======= */
const SECTION_FIELDS = {
  'provider-info': ['provider', 'facility'],
  'embryo-details': ['embryoIdentificationNumber', 'embryoDevelopmentalStage', 'embryoQualityGrade', 'innerCellMassGrade', 'trophectodermGrade'],
  'cryopreservation': ['embryoCryopreservationDate', 'embryoThawDate', 'embryoSurvivalPostThaw'],
  'transfer-procedure': ['transferCycleType', 'endometrialThickness', 'endometrialPattern', 'transferCatheterType', 'transferDifficulty', 'ultrasoundGuidance', 'embryoPlacementLocation'],
  'medications': ['proceduralMedications'],
  'hormonal-support': ['progesteroneSupplementationType', 'progesteroneDosage', 'estrogenSupplementation'],
  'genetic-testing': ['preimplantationGeneticTesting', 'geneticTestingResults'],
  'follow-up': ['scheduledPregnancyTestDate'],
};

const SECTION_TITLES = {
  'provider-info': 'Provider Information',
  'embryo-details': 'Embryo Details',
  'cryopreservation': 'Cryopreservation',
  'transfer-procedure': 'Transfer Procedure',
  'medications': 'Medications',
  'hormonal-support': 'Hormonal Support',
  'genetic-testing': 'Genetic Testing',
  'follow-up': 'Follow-Up',
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  embryoIdentificationNumber: 'Embryo Identification Number',
  embryoDevelopmentalStage: 'Embryo Developmental Stage',
  embryoQualityGrade: 'Embryo Quality Grade',
  innerCellMassGrade: 'Inner Cell Mass Grade',
  trophectodermGrade: 'Trophectoderm Grade',
  embryoCryopreservationDate: 'Embryo Cryopreservation Date',
  embryoThawDate: 'Embryo Thaw Date',
  embryoSurvivalPostThaw: 'Embryo Survival Post-Thaw',
  transferCycleType: 'Transfer Cycle Type',
  endometrialThickness: 'Endometrial Thickness',
  endometrialPattern: 'Endometrial Pattern',
  transferCatheterType: 'Transfer Catheter Type',
  transferDifficulty: 'Transfer Difficulty',
  ultrasoundGuidance: 'Ultrasound Guidance',
  embryoPlacementLocation: 'Embryo Placement Location',
  proceduralMedications: 'Procedural Medications',
  progesteroneSupplementationType: 'Progesterone Supplementation Type',
  progesteroneDosage: 'Progesterone Dosage',
  estrogenSupplementation: 'Estrogen Supplementation',
  preimplantationGeneticTesting: 'Preimplantation Genetic Testing',
  geneticTestingResults: 'Genetic Testing Results',
  scheduledPregnancyTestDate: 'Scheduled Pregnancy Test Date',
};

const DATE_FIELDS = ['date', 'embryoCryopreservationDate', 'embryoThawDate', 'scheduledPregnancyTestDate'];
const NUMBER_FIELDS = ['endometrialThickness'];
const ARRAY_FIELDS = ['proceduralMedications'];

/* ======= RENDER HELPERS ======= */
const renderSentenceField = (text, label, sectionTitle) => {
  if (!text || typeof text !== 'string') return null;
  const showLabel = label.toLowerCase() !== (sectionTitle || '').toLowerCase();
  const sentences = splitBySentence(text);
  if (sentences.length <= 1) {
    return (
      <View style={styles.fieldBox} wrap={false}>
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{text}</Text>
      </View>
    );
  }
  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {sentences.map((sentence, sIdx) => {
        const parsed = parseLabel(sentence);
        if (parsed.isLabeled) {
          const commaItems = splitByComma(parsed.value);
          if (commaItems.length >= 2) {
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{parsed.label}</Text>
                {commaItems.map((ci, ciIdx) => (
                  <Text key={ciIdx} style={styles.listItem}>{ciIdx + 1}. {ci}</Text>
                ))}
              </View>
            );
          }
          return (
            <View key={sIdx}>
              <Text style={styles.nestedSubtitle}>{parsed.label}</Text>
              <Text style={styles.listItem}>{parsed.value}</Text>
            </View>
          );
        }
        return <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>;
      })}
    </View>
  );
};

/* ======= COMPONENT ======= */
const SingleEmbryoTransferDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.records) {
    records = data.records;
  } else if (data) {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>SINGLE EMBRYO TRANSFER REPORT</Text>
          </View>
          <Text style={styles.noDataText}>No single embryo transfer data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>SINGLE EMBRYO TRANSFER REPORT</Text>
        </View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            {idx > 0 && <View style={styles.separator} />}
            <View style={styles.recordHeader}>
              <View style={styles.recordDateRow}>
                {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
              </View>
              <Text style={styles.recordTitle}>{record.provider || `Single Embryo Transfer ${idx + 1}`}</Text>
            </View>

            {/* Sections */}
            {Object.entries(SECTION_FIELDS).map(([sid, fields]) => {
              const sectionHasData = fields.some(f => hasVal(record[f]));
              if (!sectionHasData) return null;
              const sectionTitle = SECTION_TITLES[sid];

              return (
                <View key={sid} style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                  {fields.map(f => {
                    const val = record[f];
                    if (!hasVal(val)) return null;
                    const label = FIELD_LABELS[f] || f;
                    const showLabel = label.toLowerCase() !== (sectionTitle || '').toLowerCase();

                    if (DATE_FIELDS.includes(f)) {
                      return (
                        <View key={f} style={styles.fieldBox}>
                          {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
                          <Text style={styles.fieldValue}>{formatDate(val)}</Text>
                        </View>
                      );
                    }

                    if (NUMBER_FIELDS.includes(f)) {
                      return (
                        <View key={f} style={styles.fieldBox}>
                          {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
                          <Text style={styles.fieldValue}>{String(val)}</Text>
                        </View>
                      );
                    }

                    if (ARRAY_FIELDS.includes(f)) {
                      const items = Array.isArray(val) ? val : [val];
                      return (
                        <View key={f} style={styles.fieldBox}>
                          {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
                          {items.map((item, itemIdx) => {
                            const itemStr = typeof item === 'object' ? (item.text || item.recommendation || JSON.stringify(item)) : String(item);
                            return <Text key={itemIdx} style={styles.listItem}>{itemIdx + 1}. {itemStr}</Text>;
                          })}
                        </View>
                      );
                    }

                    /* String field with sentence parsing */
                    return <React.Fragment key={f}>{renderSentenceField(fmtVal(val), label, sectionTitle)}</React.Fragment>;
                  })}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SingleEmbryoTransferDocumentPDFTemplate;

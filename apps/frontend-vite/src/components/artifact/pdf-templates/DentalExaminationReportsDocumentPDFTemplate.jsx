/**
 * DentalExaminationReportsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — parseLabel + comma-split — no-boxes fieldBox
 * Collection: dental_examination_reports
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { marginBottom: 0, paddingBottom: 16 },
  recordHeader: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  section: { paddingBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 2 },
  fieldBox: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.4, marginBottom: 2, paddingLeft: 12 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 1 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#999999' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/\u00b5m/g, 'um').replace(/\u03bcm/g, 'um').replace(/\u00b0/g, ' deg')
    .replace(/\u00b1/g, '+/-').replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->').replace(/\u201c/g, '"').replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'").replace(/\u2014/g, '-').replace(/\u2013/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).trimStart();
      if (rest.startsWith('#')) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const FIELD_LABELS = {
  patientChiefComplaint: 'Patient Chief Complaint',
  oralHygieneStatus: 'Oral Hygiene Status',
  gingivitisIndex: 'Gingivitis Index',
  plaqueIndex: 'Plaque Index',
  bleedingOnProbing: 'Bleeding on Probing',
  furcationInvolvement: 'Furcation Involvement',
  toothMobility: 'Tooth Mobility',
  periodontalPocketDepths: 'Periodontal Pocket Depths',
  clinicalAttachmentLevel: 'Clinical Attachment Level',
  cariesRiskAssessment: 'Caries Risk Assessment',
  dmftScore: 'DMFT Score',
  fluorosisScore: 'Fluorosis Score',
  salivaryFlowRate: 'Salivary Flow Rate',
  occlusionClassification: 'Occlusion Classification',
  overjetMeasurement: 'Overjet Measurement',
  overbiteMeasurement: 'Overbite Measurement',
  tmjAssessment: 'TMJ Assessment',
  maximumMouthOpening: 'Maximum Mouth Opening',
  oralCancerScreening: 'Oral Cancer Screening',
  bruxismEvidence: 'Bruxism Evidence',
  prostheticStatus: 'Prosthetic Status',
  radiographicFindings: 'Radiographic Findings',
  pulpVitalityTests: 'Pulp Vitality Tests',
};

/* renderFieldRow: simple label + numbered value ("1." even for single values); optional single-name title hide */
const renderFieldRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  const showLabel = !sectionTitle || label.toLowerCase() !== String(sectionTitle).toLowerCase();
  return (
    <View style={{ marginBottom: 4 }}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.listItem}>1. {safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderCommaField: comma-split into numbered items ("1." even for a single value) */
const renderCommaField = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  const items = splitByComma(fmtVal(text));
  const showLabel = !sectionTitle || label.toLowerCase() !== String(sectionTitle).toLowerCase();
  return (
    <View style={{ marginBottom: 4 }}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {items.length >= 2
        ? items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)
        : <Text style={styles.listItem}>1. {safeString(fmtVal(text))}</Text>
      }
    </View>
  );
};

/* renderArrayField: array as label + numbered items (rows count toward section wrap-gate) */
const renderArrayField = (label, value) => {
  if (!hasVal(value)) return null;
  const items = (Array.isArray(value) ? value : [value]).filter(hasVal).map(it => (typeof it === 'object' ? JSON.stringify(it) : safeString(String(it))));
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}
    </View>
  );
};

/* arrayItemCount: number of rows an array field contributes to a section wrap-gate */
const arrayItemCount = (value) => {
  if (!hasVal(value)) return 0;
  return (Array.isArray(value) ? value : [value]).filter(hasVal).length;
};

/* renderSentenceSection: parseLabel + comma-split for heavy text fields */
const renderSentenceSection = (title, text) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
    } else {
      const nlParts = splitByComma(s.replace(/[;.]+$/, '').trim());
      if (nlParts.length >= 2) { nlParts.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); }); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    }
  });

  const wrapProp = rows.length > 8 ? true : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      <Text style={styles.fieldLabel}>{title}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const DentalExaminationReportsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.dental_examination_reports) return Array.isArray(r.dental_examination_reports) ? r.dental_examination_reports : [r.dental_examination_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dental_examination_reports) return Array.isArray(dd.dental_examination_reports) ? dd.dental_examination_reports : [dd.dental_examination_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Dental Examination Reports</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Dental Examination Reports</Text></View>

        {records.map((record, idx) => {
          /* Section 1: Chief Complaint — comma-split */
          const hasChief = hasVal(record.patientChiefComplaint);

          /* Section 2: Oral Hygiene — comma-split + numbers */
          const hasHygiene = hasVal(record.oralHygieneStatus) || hasVal(record.gingivitisIndex) || hasVal(record.plaqueIndex);

          /* Section 3: Periodontal */
          const perioFields = [
            { key: 'bleedingOnProbing', val: record.bleedingOnProbing },
            { key: 'furcationInvolvement', val: record.furcationInvolvement },
          ].filter(f => hasVal(f.val));
          const hasToothMobility = hasVal(record.toothMobility);
          const hasPocketDepths = hasVal(record.periodontalPocketDepths);
          const hasAttachmentLevel = hasVal(record.clinicalAttachmentLevel);

          /* Section 4: Caries */
          const cariesFields = [
            { key: 'cariesRiskAssessment', val: record.cariesRiskAssessment },
            { key: 'dmftScore', val: record.dmftScore },
            { key: 'fluorosisScore', val: record.fluorosisScore },
          ].filter(f => hasVal(f.val));

          /* Section 5: Occlusion */
          const occlusionFields = [
            { key: 'occlusionClassification', val: record.occlusionClassification },
            { key: 'overjetMeasurement', val: record.overjetMeasurement },
            { key: 'overbiteMeasurement', val: record.overbiteMeasurement },
          ].filter(f => hasVal(f.val));

          /* Section 6: TMJ — sentence + comma-split + nested subtitles */
          const hasTmj = hasVal(record.tmjAssessment) || hasVal(record.maximumMouthOpening) || hasVal(record.bruxismEvidence);

          /* Section 7: Oral Soft Tissue */
          const hasOralSoft = hasVal(record.oralCancerScreening);

          /* Section 7b: Salivary */
          const hasSalivary = hasVal(record.salivaryFlowRate);

          /* Section 8: Prosthetic */
          const hasProsthetic = hasVal(record.prostheticStatus);

          /* Section 9: Radiographic — comma-split */
          const hasRadio = hasVal(record.radiographicFindings);

          /* Section 10: Pulp Vitality */
          const hasPulp = hasVal(record.pulpVitalityTests);

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Dental Examination Report ${idx + 1}`}</Text>
              </View>

              {/* Section 1: Chief Complaint */}
              {hasChief && (
                <View style={styles.section}>
                  {renderCommaField('Chief Complaint', record.patientChiefComplaint)}
                </View>
              )}

              {/* Section 2: Oral Hygiene Assessment */}
              {hasHygiene && (() => {
                const totalItems = (hasVal(record.oralHygieneStatus) ? 1 : 0) + (hasVal(record.gingivitisIndex) ? 1 : 0) + (hasVal(record.plaqueIndex) ? 1 : 0);
                return (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={totalItems > 8 ? true : false}>
                      <Text style={styles.sectionTitle}>Oral Hygiene Assessment</Text>
                      {hasVal(record.oralHygieneStatus) && renderCommaField(FIELD_LABELS.oralHygieneStatus, record.oralHygieneStatus)}
                      {hasVal(record.gingivitisIndex) && renderFieldRow(FIELD_LABELS.gingivitisIndex, record.gingivitisIndex)}
                      {hasVal(record.plaqueIndex) && renderFieldRow(FIELD_LABELS.plaqueIndex, record.plaqueIndex)}
                    </View>
                  </View>
                );
              })()}

              {/* Section 3: Periodontal Assessment */}
              {(perioFields.length > 0 || hasToothMobility || hasPocketDepths || hasAttachmentLevel) && (() => {
                const perioRows = perioFields.length + (hasToothMobility ? 3 : 0) + arrayItemCount(record.periodontalPocketDepths) + arrayItemCount(record.clinicalAttachmentLevel);
                return (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={perioRows > 8 ? true : false}>
                      <Text style={styles.sectionTitle}>Periodontal Assessment</Text>
                      {perioFields.map((f, i) => (
                        <React.Fragment key={i}>{renderFieldRow(FIELD_LABELS[f.key], f.val)}</React.Fragment>
                      ))}
                      {hasToothMobility && renderCommaField(FIELD_LABELS.toothMobility, record.toothMobility)}
                      {hasPocketDepths && renderArrayField(FIELD_LABELS.periodontalPocketDepths, record.periodontalPocketDepths)}
                      {hasAttachmentLevel && renderArrayField(FIELD_LABELS.clinicalAttachmentLevel, record.clinicalAttachmentLevel)}
                    </View>
                  </View>
                );
              })()}

              {/* Section 4: Caries & Dental Indices */}
              {cariesFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Caries & Dental Indices</Text>
                    {cariesFields.map((f, i) => (
                      <React.Fragment key={i}>{renderFieldRow(FIELD_LABELS[f.key], f.val)}</React.Fragment>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 5: Occlusion Assessment */}
              {occlusionFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Occlusion Assessment</Text>
                    {occlusionFields.map((f, i) => (
                      <React.Fragment key={i}>{renderFieldRow(FIELD_LABELS[f.key], f.val)}</React.Fragment>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 6: TMJ Assessment — sentence fields with nested subtitles */}
              {hasTmj && (() => {
                const tmjSentences = splitBySentence(fmtVal(record.tmjAssessment || ''));
                const tmjRows = [];
                let n = 1;
                tmjSentences.forEach(s => {
                  const parsed = parseLabel(s);
                  if (parsed.isLabeled) {
                    const commaItems = splitByComma(parsed.value);
                    tmjRows.push({ type: 'subtitle', text: safeString(parsed.label) });
                    commaItems.forEach(ci => { tmjRows.push({ type: 'item', text: safeString(ci), num: n++ }); });
                  } else {
                    tmjRows.push({ type: 'item', text: safeString(s), num: n++ });
                  }
                });
                const totalItems = tmjRows.length + (hasVal(record.maximumMouthOpening) ? 1 : 0) + (hasVal(record.bruxismEvidence) ? 1 : 0);
                return (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={totalItems > 8 ? true : false}>
                      <Text style={styles.sectionTitle}>TMJ Assessment</Text>
                      {/* tmjAssessment label == section title → single-name (no duplicate "TMJ Assessment") */}
                      {tmjRows.length > 0 && (
                        <View style={{ marginBottom: 4 }}>
                          {tmjRows.map((row, i) => {
                            if (row.type === 'subtitle') return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
                            return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
                          })}
                        </View>
                      )}
                      {hasVal(record.maximumMouthOpening) && renderFieldRow(FIELD_LABELS.maximumMouthOpening, `${record.maximumMouthOpening} mm`)}
                      {hasVal(record.bruxismEvidence) && renderFieldRow(FIELD_LABELS.bruxismEvidence, record.bruxismEvidence)}
                    </View>
                  </View>
                );
              })()}

              {/* Section 7: Oral Soft Tissue Examination */}
              {hasOralSoft && (
                <View style={styles.section}>
                  {renderSentenceSection('Oral Cancer Screening', record.oralCancerScreening)}
                </View>
              )}

              {/* Section 7b: Salivary Assessment */}
              {hasSalivary && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Salivary Assessment</Text>
                    {renderFieldRow(FIELD_LABELS.salivaryFlowRate, record.salivaryFlowRate)}
                  </View>
                </View>
              )}

              {/* Section 8: Prosthetic Status */}
              {hasProsthetic && (
                <View style={styles.section}>
                  {renderSentenceSection('Prosthetic Status', record.prostheticStatus)}
                </View>
              )}

              {/* Section 9: Radiographic Findings — sentence split then comma split */}
              {hasRadio && (
                <View style={styles.section}>
                  {renderSentenceSection('Radiographic Findings', record.radiographicFindings)}
                </View>
              )}

              {/* Section 10: Pulp Vitality Tests */}
              {hasPulp && (
                <View style={styles.section}>
                  {renderSentenceSection('Pulp Vitality Tests', record.pulpVitalityTests)}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default DentalExaminationReportsDocumentPDFTemplate;

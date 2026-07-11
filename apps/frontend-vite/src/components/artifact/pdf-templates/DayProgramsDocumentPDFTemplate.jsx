/**
 * DayProgramsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — parseLabel + comma-split
 * Collection: day_programs
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 16 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
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

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"%>+-]{1,80}?):\s+([\s\S]+)$/);
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

const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
};

const FIELD_LABELS = {
  procedureCptCode: 'Procedure CPT Code',
  icd10DiagnosisCodes: 'ICD-10 Diagnosis Codes',
  admissionVitalSigns: 'Admission Vital Signs',
  dischargeVitalSigns: 'Discharge Vital Signs',
  preoperativeAsaScore: 'Preoperative ASA Score',
  postoperativePainScore: 'Postoperative Pain Score',
  aldreteScore: 'Aldrete Score',
  proceduralComplexity: 'Procedural Complexity',
  anesthesiaType: 'Anesthesia Type',
  procedureDurationMinutes: 'Procedure Duration (Minutes)',
  estimatedBloodLossML: 'Estimated Blood Loss (mL)',
  intraoperativeComplications: 'Intraoperative Complications',
  antibioticProphylaxis: 'Antibiotic Prophylaxis',
  surgicalSiteMarking: 'Surgical Site Marking',
  timeoutPerformed: 'Timeout Performed',
  implantDeviceUsed: 'Implant Device Used',
  medicationsAdministered: 'Medications Administered',
  dischargeMedications: 'Discharge Medications',
  postoperativeInstructions: 'Postoperative Instructions',
  pathologySpecimenCollected: 'Pathology Specimen Collected',
  pathologySpecimenType: 'Pathology Specimen Type',
  followUpScheduled: 'Follow-Up Scheduled',
  followUpTimeframe: 'Follow-Up Timeframe',
  dischargeReadiness: 'Discharge Readiness',
  escortPresent: 'Escort Present',
};

/* renderFieldRow: simple label + value */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.listItem}>1. {safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderArrayField: numbered list */
const renderArrayField = (label, arr) => {
  if (!hasVal(arr) || (Array.isArray(arr) && arr.length === 0) || String(arr).trim() === '') return null;
  const items = Array.isArray(arr) ? arr.filter(Boolean) : [arr].filter(Boolean);
  if (items.length === 0) return null;

  /* Parse labels for grouping */
  const allItems = [];
  items.forEach(item => {
    const parsed = parseLabel(String(item));
    allItems.push({ label: parsed.isLabeled ? parsed.label : null, value: parsed.isLabeled ? parsed.value : String(item) });
  });

  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {allItems.map((item, i) => {
        const prevLabel = i > 0 ? allItems[i - 1].label : null;
        const showLabel = item.label && item.label !== prevLabel;
        return (
          <View key={i}>
            {showLabel && <Text style={styles.nestedSubtitle}>{safeString(item.label)}</Text>}
            <Text style={styles.listItem}>{i + 1}. {safeString(item.value)}</Text>
          </View>
        );
      })}
    </View>
  );
};

/* renderLabelCommaField: comma-split with per-item label:value (vital signs) */
const renderLabelCommaField = (label, text) => {
  if (!hasVal(text)) return null;
  const items = splitByComma(fmtVal(text));
  if (items.length < 2) return renderFieldRow(label, text);

  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.map((ci, i) => {
        const parsed = parseLabel(ci.trim());
        return (
          <View key={i}>
            {parsed.isLabeled && <Text style={styles.nestedSubtitle}>{safeString(parsed.label)}</Text>}
            <Text style={styles.listItem}>1. {safeString(parsed.isLabeled ? parsed.value : ci)}</Text>
          </View>
        );
      })}
    </View>
  );
};

/* renderSemicolonField: semicolon-split into numbered items */
const renderSemicolonField = (label, text) => {
  if (!hasVal(text)) return null;
  const items = splitBySemicolon(fmtVal(text));
  if (items.length < 2) return renderFieldRow(label, text);

  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split for heavy text fields */
const renderSentenceField = (label, text, sectionTitleText) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return renderFieldRow(label, text);

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 3) commaItems.forEach((ci, i) => { rows.push({ type: 'item', text: safeString(ci), num: i + 1 }); });
      else rows.push({ type: 'item', text: safeString(parsed.value), num: 1 });
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  return (
    <View style={styles.fieldBox} wrap={rows.length > 8}>
      {sectionTitleText && <Text style={styles.sectionTitle}>{sectionTitleText}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const DayProgramsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.day_programs) return Array.isArray(r.day_programs) ? r.day_programs : [r.day_programs];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.day_programs) return Array.isArray(dd.day_programs) ? dd.day_programs : [dd.day_programs]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Day Programs</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Day Programs</Text></View>

        {records.map((record, idx) => {
          /* Section 1: Diagnosis Codes */
          const diagCodes = (Array.isArray(record.icd10DiagnosisCodes) ? record.icd10DiagnosisCodes : []).filter(Boolean);
          const hasCptCode = hasVal(record.procedureCptCode);
          const hasDiagnosisSection = diagCodes.length > 0 || hasCptCode;

          /* Section 2: Vital Signs */
          const hasAdmissionVitals = hasVal(record.admissionVitalSigns);
          const hasDischargeVitals = hasVal(record.dischargeVitalSigns);
          const hasVitalSigns = hasAdmissionVitals || hasDischargeVitals;

          /* Section 3: Clinical Scores */
          const clinicalFields = [
            { key: 'preoperativeAsaScore', val: record.preoperativeAsaScore },
            { key: 'postoperativePainScore', val: record.postoperativePainScore },
            { key: 'aldreteScore', val: record.aldreteScore },
            { key: 'proceduralComplexity', val: record.proceduralComplexity },
          ].filter(f => hasVal(f.val));

          /* Section 4: Procedure Details */
          const procSimple = [
            { key: 'anesthesiaType', val: record.anesthesiaType },
            { key: 'procedureDurationMinutes', val: record.procedureDurationMinutes },
            { key: 'estimatedBloodLossML', val: record.estimatedBloodLossML },
            { key: 'antibioticProphylaxis', val: record.antibioticProphylaxis },
            { key: 'surgicalSiteMarking', val: record.surgicalSiteMarking },
            { key: 'timeoutPerformed', val: record.timeoutPerformed },
            { key: 'implantDeviceUsed', val: record.implantDeviceUsed },
          ].filter(f => hasVal(f.val));
          const intraopComplications = (Array.isArray(record.intraoperativeComplications) ? record.intraoperativeComplications : []).filter(Boolean);
          const hasProcedure = procSimple.length > 0 || intraopComplications.length > 0;

          /* Section 5: Medications */
          const medsAdmin = (Array.isArray(record.medicationsAdministered) ? record.medicationsAdministered : []).filter(Boolean);
          const medsDischg = (Array.isArray(record.dischargeMedications) ? record.dischargeMedications : []).filter(Boolean);
          const hasMeds = medsAdmin.length > 0 || medsDischg.length > 0;

          /* Section 6: Post-Procedure */
          const postFieldsBefore = [
            { key: 'pathologySpecimenCollected', val: record.pathologySpecimenCollected },
            { key: 'pathologySpecimenType', val: record.pathologySpecimenType },
            { key: 'followUpScheduled', val: record.followUpScheduled },
          ].filter(f => hasVal(f.val));
          const postFieldsAfter = [
            { key: 'dischargeReadiness', val: record.dischargeReadiness },
            { key: 'escortPresent', val: record.escortPresent },
          ].filter(f => hasVal(f.val));
          const hasPostInstructions = hasVal(record.postoperativeInstructions);
          const hasFollowUpTimeframe = hasVal(record.followUpTimeframe);
          const hasPostProcedure = postFieldsBefore.length > 0 || postFieldsAfter.length > 0 || hasPostInstructions || hasFollowUpTimeframe;

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Day Program ${idx + 1}`}</Text>
              </View>

              {/* Section 1: Diagnosis Codes */}
              {hasDiagnosisSection && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={(diagCodes.length + (hasCptCode ? 1 : 0)) > 8}>
                    <Text style={styles.sectionTitle}>Diagnosis Codes</Text>
                    {hasCptCode && renderFieldRow(FIELD_LABELS.procedureCptCode, record.procedureCptCode)}
                    {diagCodes.map((code, i) => {
                      const parsed = parseLabel(String(code));
                      const prevParsed = i > 0 ? parseLabel(String(diagCodes[i - 1])) : { label: '' };
                      const showLabel = parsed.isLabeled && parsed.label !== prevParsed.label;
                      return (
                        <View key={i}>
                          {showLabel && <Text style={styles.nestedSubtitle}>{safeString(parsed.label)}</Text>}
                          <Text style={styles.listItem}>{i + 1}. {safeString(parsed.isLabeled ? parsed.value : String(code))}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Section 2: Vital Signs */}
              {hasVitalSigns && (() => {
                const totalItems = (hasAdmissionVitals ? splitByComma(fmtVal(record.admissionVitalSigns)).length : 0) + (hasDischargeVitals ? 1 : 0);
                return (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={totalItems > 8}>
                      <Text style={styles.sectionTitle}>Vital Signs</Text>
                      {hasAdmissionVitals && renderLabelCommaField(FIELD_LABELS.admissionVitalSigns, record.admissionVitalSigns)}
                      {hasDischargeVitals && renderFieldRow(FIELD_LABELS.dischargeVitalSigns, record.dischargeVitalSigns)}
                    </View>
                  </View>
                );
              })()}

              {/* Section 3: Clinical Scores */}
              {clinicalFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={clinicalFields.length > 8}>
                    <Text style={styles.sectionTitle}>Clinical Scores</Text>
                    {clinicalFields.map((f, i) => renderFieldRow(FIELD_LABELS[f.key], f.val))}
                  </View>
                </View>
              )}

              {/* Section 4: Procedure Details */}
              {hasProcedure && (() => {
                const totalProcItems = procSimple.length + intraopComplications.length;
                return (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={totalProcItems > 8}>
                      <Text style={styles.sectionTitle}>Procedure Details</Text>
                      {procSimple.map((f, i) => renderFieldRow(FIELD_LABELS[f.key], f.val))}
                      {intraopComplications.length > 0 && renderArrayField(FIELD_LABELS.intraoperativeComplications, intraopComplications)}
                    </View>
                  </View>
                );
              })()}

              {/* Section 5: Medications */}
              {hasMeds && (() => {
                const totalMedItems = medsAdmin.length + medsDischg.length;
                return (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={totalMedItems > 8}>
                      <Text style={styles.sectionTitle}>Medications</Text>
                      {medsAdmin.length > 0 && renderArrayField(FIELD_LABELS.medicationsAdministered, medsAdmin)}
                      {medsDischg.length > 0 && renderArrayField(FIELD_LABELS.dischargeMedications, medsDischg)}
                    </View>
                  </View>
                );
              })()}

              {/* Section 6: Post-Procedure */}
              {hasPostProcedure && (() => {
                const sentences = hasPostInstructions ? splitBySentence(fmtVal(record.postoperativeInstructions)) : [];
                const semiItems = hasFollowUpTimeframe ? splitBySemicolon(fmtVal(record.followUpTimeframe)) : [];
                const totalPostItems = postFieldsBefore.length + postFieldsAfter.length + sentences.length + semiItems.length;

                return (
                  <View style={styles.section}>
                    {/* Post-operative Instructions (sentence field — own fieldBox) */}
                    {hasPostInstructions && renderSentenceField(FIELD_LABELS.postoperativeInstructions, record.postoperativeInstructions, 'Post-Procedure')}

                    {/* Remaining post-procedure fields: before → followUpTimeframe → after */}
                    {(postFieldsBefore.length > 0 || postFieldsAfter.length > 0 || hasFollowUpTimeframe) && (
                      <View style={styles.fieldBox} wrap={(postFieldsBefore.length + postFieldsAfter.length + semiItems.length) > 8}>
                        {!hasPostInstructions && <Text style={styles.sectionTitle}>Post-Procedure</Text>}
                        {postFieldsBefore.map((f, i) => renderFieldRow(FIELD_LABELS[f.key], f.val))}
                        {hasFollowUpTimeframe && renderSemicolonField(FIELD_LABELS.followUpTimeframe, record.followUpTimeframe)}
                        {postFieldsAfter.map((f, i) => renderFieldRow(FIELD_LABELS[f.key], f.val))}
                      </View>
                    )}
                  </View>
                );
              })()}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default DayProgramsDocumentPDFTemplate;

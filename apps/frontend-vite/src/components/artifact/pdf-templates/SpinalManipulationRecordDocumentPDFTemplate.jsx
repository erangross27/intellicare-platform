/**
 * SpinalManipulationRecordDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — spinal manipulation record
 * Collection: spinal_manipulation_record
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#606060', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#6b7280', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#606060', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
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
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

/* parseLabel */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* splitBySentence */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

/* splitByComma */
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

/* ======= COMPONENT ======= */
const SpinalManipulationRecordDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.spinal_manipulation_record) return Array.isArray(r.spinal_manipulation_record) ? r.spinal_manipulation_record : [r.spinal_manipulation_record];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.spinal_manipulation_record) return Array.isArray(dd.spinal_manipulation_record) ? dd.spinal_manipulation_record : [dd.spinal_manipulation_record]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Spinal Manipulation Record</Text>
          </View>
          <Text style={styles.noDataText}>No spinal manipulation record data available</Text>
        </Page>
      </Document>
    );
  }

  /* Render a sentence-parsed string field */
  const renderStringField = (label, val) => {
    const str = safeString(val);
    if (!str) return null;
    const sentences = splitBySentence(str);
    if (sentences.length <= 1) {
      return (
        <View style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldValue}>{str}</Text>
        </View>
      );
    }
    let n = 1;
    return (
      <View style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {sentences.map((s, i) => {
          const parsed = parseLabel(s);
          if (parsed.isLabeled) {
            const commaItems = splitByComma(parsed.value);
            if (commaItems.length >= 2) {
              return (
                <View key={i}>
                  <Text style={styles.nestedSubtitle}>{parsed.label}</Text>
                  {commaItems.map((ci, j) => <Text key={j} style={styles.listItem}>{n++}. {ci}</Text>)}
                </View>
              );
            }
            return (
              <View key={i}>
                <Text style={styles.nestedSubtitle}>{parsed.label}</Text>
                <Text style={styles.listItem}>{n++}. {parsed.value}</Text>
              </View>
            );
          }
          return <Text key={i} style={styles.listItem}>{n++}. {s}</Text>;
        })}
      </View>
    );
  };

  /* Render array field */
  const renderArrayField = (label, val) => {
    const items = Array.isArray(val) ? val.filter(Boolean) : [];
    if (items.length === 0) return null;
    return (
      <View style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}
      </View>
    );
  };

  /* Render boolean field */
  const renderBooleanField = (label, val) => {
    if (!hasVal(val)) return null;
    return (
      <View style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{val ? 'Yes' : 'No'}</Text>
      </View>
    );
  };

  /* Render number field */
  const renderNumberField = (label, val) => {
    if (!hasVal(val)) return null;
    return (
      <View style={styles.fieldBox}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{String(val)}</Text>
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Spinal Manipulation Record</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {record.createdAt && <Text style={styles.recordDate}>{formatDate(record.createdAt)}</Text>}
              </View>
              <Text style={styles.recordTitle}>Spinal Manipulation Record {idx + 1}</Text>
            </View>

            {/* 1. Spinal Segments Treated */}
            {renderArrayField('Spinal Segments Treated', record.spinalSegmentsTreated)}

            {/* 2. Manipulation Technique */}
            {renderStringField('Manipulation Technique', record.manipulationTechnique)}

            {/* 3. Thrust Direction */}
            {renderStringField('Thrust Direction', record.thrustDirection)}

            {/* 4. Patient Positioning */}
            {renderStringField('Patient Positioning', record.patientPositioning)}

            {/* 5. Force & Amplitude */}
            {renderStringField('Force & Amplitude', record.forceAmplitude)}

            {/* 6. Vertebral Subluxation Complex */}
            {renderStringField('Vertebral Subluxation Complex', record.vertebralSubluxationComplex)}

            {/* 7. Range of Motion */}
            {hasVal(record.preManipulationRomCervical) || hasVal(record.postManipulationRomCervical) || hasVal(record.preManipulationRomLumbar) || hasVal(record.postManipulationRomLumbar) ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Range of Motion</Text>
                {renderStringField('Pre-Manipulation ROM (Cervical)', record.preManipulationRomCervical)}
                {renderStringField('Post-Manipulation ROM (Cervical)', record.postManipulationRomCervical)}
                {renderStringField('Pre-Manipulation ROM (Lumbar)', record.preManipulationRomLumbar)}
                {renderStringField('Post-Manipulation ROM (Lumbar)', record.postManipulationRomLumbar)}
              </View>
            ) : null}

            {/* 8. Pain & Disability Scores */}
            {hasVal(record.painVasPreTreatment) || hasVal(record.painVasPostTreatment) || hasVal(record.oswestryDisabilityIndex) || hasVal(record.neckDisabilityIndex) ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pain & Disability Scores</Text>
                {renderNumberField('Pain VAS Pre-Treatment', record.painVasPreTreatment)}
                {renderNumberField('Pain VAS Post-Treatment', record.painVasPostTreatment)}
                {renderNumberField('Oswestry Disability Index', record.oswestryDisabilityIndex)}
                {renderNumberField('Neck Disability Index', record.neckDisabilityIndex)}
              </View>
            ) : null}

            {/* 9. Palpation Findings */}
            {renderStringField('Palpation Findings', record.palpationFindings)}

            {/* 10. Sacroiliac Joint Dysfunction */}
            {renderStringField('Sacroiliac Joint Dysfunction', record.sacroiliacJointDysfunction)}

            {/* 11. Orthopedic & Neurological Tests */}
            {hasVal(record.straightLegRaiseTest) || hasVal(record.neurologicalClearance) || hasVal(record.dermatomeInvolvement) || hasVal(record.vertebrobasilarScreening) ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Orthopedic & Neurological Tests</Text>
                {renderStringField('Straight Leg Raise Test', record.straightLegRaiseTest)}
                {renderBooleanField('Neurological Clearance', record.neurologicalClearance)}
                {renderStringField('Dermatome Involvement', record.dermatomeInvolvement)}
                {renderStringField('Vertebrobasilar Screening', record.vertebrobasilarScreening)}
              </View>
            ) : null}

            {/* 12. Contraindications Screened */}
            {renderArrayField('Contraindications Screened', record.contraindicationsScreened)}

            {/* 13. Treatment Outcome */}
            {hasVal(record.cavitationAchieved) || hasVal(record.muscleEnergyTechniqueApplied) || hasVal(record.adverseReactionDocumented) || hasVal(record.informedConsentObtained) ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Treatment Outcome</Text>
                {renderBooleanField('Cavitation Achieved', record.cavitationAchieved)}
                {renderBooleanField('Muscle Energy Technique Applied', record.muscleEnergyTechniqueApplied)}
                {renderStringField('Adverse Reaction', record.adverseReactionDocumented)}
                {renderBooleanField('Informed Consent Obtained', record.informedConsentObtained)}
              </View>
            ) : null}

            {idx < records.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SpinalManipulationRecordDocumentPDFTemplate;

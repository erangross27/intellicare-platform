/**
 * SingleEmbryoTransferDetailsDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica -- LETTER size -- single embryo transfer details
 * Collection: single_embryo_transfer_details
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  recordMeta: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
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
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

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
    if (ch === '(' || ch === '"' || ch === "'") { depth++; current += ch; }
    else if (ch === ')' || (depth > 0 && (ch === '"' || ch === "'"))) { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, sectionTitle) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split with sequential counter */
const renderSentenceField = (label, text, counterRef, sectionTitle) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') {
    return renderFieldRow(label, text, sectionTitle);
  }
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: counterRef.n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
    }
  });

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* renderArrayField */
const renderArrayField = (label, items, counterRef, sectionTitle) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{counterRef.n++}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* ======= COMPONENT ======= */
const SingleEmbryoTransferDetailsDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.single_embryo_transfer_details) return Array.isArray(r.single_embryo_transfer_details) ? r.single_embryo_transfer_details : [r.single_embryo_transfer_details];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.single_embryo_transfer_details) return Array.isArray(dd.single_embryo_transfer_details) ? dd.single_embryo_transfer_details : [dd.single_embryo_transfer_details];
        return [dd];
      }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Single Embryo Transfer Details</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Single Embryo Transfer Details</Text>
        </View>

        {records.map((record, index) => {
          const ctr = { n: 1 };

          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Single Embryo Transfer Details ${index + 1}`}</Text>
                {record.transferDateTime && <Text style={styles.recordMeta}>{formatDate(record.transferDateTime)}</Text>}
                {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
              </View>

              {/* 1. Embryo Assessment */}
              {(hasVal(record.embryoQualityGrade) || hasVal(record.embryoDevelopmentalStage) || hasVal(record.innerCellMassGrade) || hasVal(record.trophectodermGrade)) && (() => {
                let _t1 = 'Embryo Assessment';
                return (
                <View style={styles.section}>
                  {hasVal(record.embryoQualityGrade) && (() => { const t = _t1; _t1 = null; return renderSentenceField('Embryo Quality Grade', record.embryoQualityGrade, ctr, t); })()}
                  {hasVal(record.embryoDevelopmentalStage) && (() => { const t = _t1; _t1 = null; return renderSentenceField('Embryo Developmental Stage', record.embryoDevelopmentalStage, ctr, t); })()}
                  {hasVal(record.innerCellMassGrade) && (() => { const t = _t1; _t1 = null; return renderSentenceField('Inner Cell Mass Grade', record.innerCellMassGrade, ctr, t); })()}
                  {hasVal(record.trophectodermGrade) && (() => { const t = _t1; _t1 = null; return renderSentenceField('Trophectoderm Grade', record.trophectodermGrade, ctr, t); })()}
                </View>
                );
              })()}

              {/* 2. Endometrial Preparation */}
              {(hasVal(record.endometrialThickness) || hasVal(record.endometrialPattern)) && (() => {
                let _t2 = 'Endometrial Preparation';
                return (
                <View style={styles.section}>
                  {hasVal(record.endometrialThickness) && (() => { const t = _t2; _t2 = null; return renderFieldRow('Endometrial Thickness', record.endometrialThickness, t); })()}
                  {hasVal(record.endometrialPattern) && (() => { const t = _t2; _t2 = null; return renderSentenceField('Endometrial Pattern', record.endometrialPattern, ctr, t); })()}
                </View>
                );
              })()}

              {/* 3. Transfer Procedure */}
              {(hasVal(record.transferCatheterType) || hasVal(record.cervicalDilatationRequired) || hasVal(record.transferDifficultyScore) || hasVal(record.ultrasoundGuidance) || hasVal(record.transferDateTime)) && (() => {
                let _t3 = 'Transfer Procedure';
                return (
                <View style={styles.section}>
                  {hasVal(record.transferCatheterType) && (() => { const t = _t3; _t3 = null; return renderSentenceField('Transfer Catheter Type', record.transferCatheterType, ctr, t); })()}
                  {hasVal(record.cervicalDilatationRequired) && (() => { const t = _t3; _t3 = null; return renderFieldRow('Cervical Dilatation Required', record.cervicalDilatationRequired, t); })()}
                  {hasVal(record.transferDifficultyScore) && (() => { const t = _t3; _t3 = null; return renderFieldRow('Transfer Difficulty Score', record.transferDifficultyScore, t); })()}
                  {hasVal(record.ultrasoundGuidance) && (() => { const t = _t3; _t3 = null; return renderFieldRow('Ultrasound Guidance', record.ultrasoundGuidance, t); })()}
                  {hasVal(record.transferDateTime) && (() => { const t = _t3; _t3 = null; return renderFieldRow('Transfer Date/Time', formatDate(record.transferDateTime), t); })()}
                </View>
                );
              })()}

              {/* 4. Embryo Loading */}
              {(hasVal(record.embryoLoadingVolume) || hasVal(record.uterineFundalDistance) || hasVal(record.catheterTipPosition)) && (() => {
                let _t4 = 'Embryo Loading';
                return (
                <View style={styles.section}>
                  {hasVal(record.embryoLoadingVolume) && (() => { const t = _t4; _t4 = null; return renderFieldRow('Embryo Loading Volume', record.embryoLoadingVolume, t); })()}
                  {hasVal(record.uterineFundalDistance) && (() => { const t = _t4; _t4 = null; return renderFieldRow('Uterine Fundal Distance', record.uterineFundalDistance, t); })()}
                  {hasVal(record.catheterTipPosition) && (() => { const t = _t4; _t4 = null; return renderFieldRow('Catheter Tip Position', record.catheterTipPosition, t); })()}
                </View>
                );
              })()}

              {/* 5. Contamination & Retention */}
              {(hasVal(record.bloodContamination) || hasVal(record.mucusContamination) || hasVal(record.embryoRetentionConfirmed)) && (() => {
                let _t5 = 'Contamination & Retention';
                return (
                <View style={styles.section}>
                  {hasVal(record.bloodContamination) && (() => { const t = _t5; _t5 = null; return renderFieldRow('Blood Contamination', record.bloodContamination, t); })()}
                  {hasVal(record.mucusContamination) && (() => { const t = _t5; _t5 = null; return renderFieldRow('Mucus Contamination', record.mucusContamination, t); })()}
                  {hasVal(record.embryoRetentionConfirmed) && (() => { const t = _t5; _t5 = null; return renderFieldRow('Embryo Retention Confirmed', record.embryoRetentionConfirmed, t); })()}
                </View>
                );
              })()}

              {/* 6. Hormonal Levels */}
              {(hasVal(record.progesteroneLevel) || hasVal(record.estradiolLevel) || hasVal(record.lutealPhaseSupport)) && (() => {
                let _t6 = 'Hormonal Levels';
                return (
                <View style={styles.section}>
                  {hasVal(record.progesteroneLevel) && (() => { const t = _t6; _t6 = null; return renderFieldRow('Progesterone Level', record.progesteroneLevel, t); })()}
                  {hasVal(record.estradiolLevel) && (() => { const t = _t6; _t6 = null; return renderFieldRow('Estradiol Level', record.estradiolLevel, t); })()}
                  {hasVal(record.lutealPhaseSupport) && (() => { const t = _t6; _t6 = null; return renderSentenceField('Luteal Phase Support', record.lutealPhaseSupport, ctr, t); })()}
                </View>
                );
              })()}

              {/* 7. Medications & Cryopreservation */}
              {(hasVal(record.premedication) || hasVal(record.embryoCryopreservationMethod) || hasVal(record.postTransferRestDuration)) && (() => {
                let _t7 = 'Medications & Cryopreservation';
                return (
                <View style={styles.section}>
                  {Array.isArray(record.premedication) && (() => { const t = _t7; _t7 = null; return renderArrayField('Premedication', record.premedication, ctr, t); })()}
                  {hasVal(record.embryoCryopreservationMethod) && (() => { const t = _t7; _t7 = null; return renderSentenceField('Embryo Cryopreservation Method', record.embryoCryopreservationMethod, ctr, t); })()}
                  {hasVal(record.postTransferRestDuration) && (() => { const t = _t7; _t7 = null; return renderFieldRow('Post-Transfer Rest Duration', record.postTransferRestDuration, t); })()}
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

export default SingleEmbryoTransferDetailsDocumentPDFTemplate;

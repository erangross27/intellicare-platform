/**
 * BunionSurgeryEvaluationDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica 26/20/19/15pt (large) -- LETTER size -- US medical platform
 * Collection: bunion_surgery_evaluation
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 15, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderWidth: 2, borderColor: '#000000', borderLeftWidth: 5, borderLeftColor: '#000000' },
  recordTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 14, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 15, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 15, lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 15, color: '#666666' },
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
  // Split on sentence boundaries (a period NOT after a title abbrev) AND on semicolons.
  // Mirrors the JSX splitBySentence so PDF matches the on-screen rows.
  return text.split(/(?:(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.|;)\s+/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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

/* renderSecTitle: render the section title ONCE, INSIDE the first present field's View (never as a
   standalone <Text> sibling — siblings orphan at a page bottom). secTitle = { text, used:false }, a
   fresh object per record; the first field that actually renders consumes (shows) it. */
const renderSecTitle = (secTitle) => {
  if (secTitle && !secTitle.used) { secTitle.used = true; return <Text style={styles.sectionTitle}>{secTitle.text}</Text>; }
  return null;
};

/* renderFieldRow: label + value inside fieldBox. wrap={false} + title-inside => title never orphans. */
const renderFieldRow = (secTitle, label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {renderSecTitle(secTitle)}
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split with sequential counter. sectionTitle rendered INSIDE
   the field View; wrap={rows>8?undefined:false} keeps title+content together (anti-orphan, Rule #74). */
const renderSentenceField = (secTitle, label, text, counterRef) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') {
    return renderFieldRow(secTitle, label, text);
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
      const commaItems = splitByComma(s);
      if (commaItems.length >= 2) {
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: counterRef.n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
      }
    }
  });

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {renderSecTitle(secTitle)}
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

/* ======= COMPONENT ======= */
const BunionSurgeryEvaluationDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.bunion_surgery_evaluation) return Array.isArray(r.bunion_surgery_evaluation) ? r.bunion_surgery_evaluation : [r.bunion_surgery_evaluation];
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.bunion_surgery_evaluation) return Array.isArray(dd.bunion_surgery_evaluation) ? dd.bunion_surgery_evaluation : [dd.bunion_surgery_evaluation];
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
            <Text style={styles.title}>Bunion Surgery Evaluation</Text>
          </View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.title}>Bunion Surgery Evaluation</Text>
        </View>
        {records.map((record, idx) => {
          const ctr = { n: 1 };
          // One section-title ref per section, consumed (rendered) by the FIRST present field of that
          // section so the title sits INSIDE a wrap-protected View and can never orphan. Fresh per record.
          const t1 = { text: 'Radiographic Measurements', used: false };
          const t2 = { text: 'Joint Assessment', used: false };
          const t3 = { text: 'Clinical Findings', used: false };
          const t4 = { text: 'Functional Scores', used: false };
          const t5 = { text: 'Surgical Plan', used: false };
          const t6 = { text: 'Risk Assessment', used: false };

          return (
            <View key={idx} style={styles.recordContainer}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Bunion Surgery Evaluation ${idx + 1}`}</Text>
                {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
              </View>

              {/* 1. Radiographic Measurements */}
              {(hasVal(record.halluxValgusAngle) || hasVal(record.intermetatarsalAngle) || hasVal(record.distalMetatarsalArticularAngle) || hasVal(record.metatarsusAdductusAngle) || hasVal(record.mearyAngle) || hasVal(record.calcanealpitchAngle) || hasVal(record.halluxInterphalangealAngle)) && (
                <View style={styles.section}>
                  {renderSentenceField(t1, 'Hallux Valgus Angle', record.halluxValgusAngle, ctr)}
                  {renderSentenceField(t1, 'Intermetatarsal Angle', record.intermetatarsalAngle, ctr)}
                  {renderSentenceField(t1, 'Distal Metatarsal Articular Angle', record.distalMetatarsalArticularAngle, ctr)}
                  {renderSentenceField(t1, 'Metatarsus Adductus Angle', record.metatarsusAdductusAngle, ctr)}
                  {renderSentenceField(t1, 'Meary Angle', record.mearyAngle, ctr)}
                  {renderSentenceField(t1, 'Calcaneal Pitch Angle', record.calcanealpitchAngle, ctr)}
                  {renderSentenceField(t1, 'Hallux Interphalangeal Angle', record.halluxInterphalangealAngle, ctr)}
                </View>
              )}

              {/* 2. Joint Assessment */}
              {(hasVal(record.sesamoidSubluxationGrade) || hasVal(record.firstMtpJointCongruency) || hasVal(record.firstMtpRangeOfMotion) || hasVal(record.halluximeterMeasurement) || hasVal(record.firstMtpJointDegenerativeChanges) || hasVal(record.firstTmtJointHypermobility) || hasVal(record.firstMetatarsalLength)) && (
                <View style={styles.section}>
                  {renderSentenceField(t2, 'Sesamoid Subluxation Grade', record.sesamoidSubluxationGrade, ctr)}
                  {renderSentenceField(t2, 'First MTP Joint Congruency', record.firstMtpJointCongruency, ctr)}
                  {renderSentenceField(t2, 'First MTP Range of Motion', record.firstMtpRangeOfMotion, ctr)}
                  {renderSentenceField(t2, 'Halluximeter Measurement', record.halluximeterMeasurement, ctr)}
                  {renderSentenceField(t2, 'First TMT Joint Hypermobility', record.firstTmtJointHypermobility, ctr)}
                  {renderSentenceField(t2, 'First MTP Joint Degenerative Changes', record.firstMtpJointDegenerativeChanges, ctr)}
                  {renderSentenceField(t2, 'First Metatarsal Length', record.firstMetatarsalLength, ctr)}
                </View>
              )}

              {/* 3. Clinical Findings */}
              {(hasVal(record.medialEminenceSize) || hasVal(record.bursitisOverMedialEminence)) && (
                <View style={styles.section}>
                  {renderSentenceField(t3, 'Medial Eminence Size', record.medialEminenceSize, ctr)}
                  {renderSentenceField(t3, 'Bursitis Over Medial Eminence', record.bursitisOverMedialEminence, ctr)}
                </View>
              )}

              {/* 4. Functional Scores */}
              {(hasVal(record.manchesterOxfordFootQuestionnaire) || hasVal(record.aofasHalluxScore)) && (
                <View style={styles.section}>
                  {renderSentenceField(t4, 'Manchester-Oxford Foot Questionnaire', record.manchesterOxfordFootQuestionnaire, ctr)}
                  {renderSentenceField(t4, 'AOFAS Hallux Score', record.aofasHalluxScore, ctr)}
                </View>
              )}

              {/* 5. Surgical Plan */}
              {hasVal(record.recommendedSurgicalProcedure) && (
                <View style={styles.section}>
                  {renderSentenceField(t5, 'Recommended Surgical Procedure', record.recommendedSurgicalProcedure, ctr)}
                </View>
              )}

              {/* 6. Risk Assessment */}
              {(hasVal(record.peripheralVascularStatus) || hasVal(record.diabeticFootRiskCategory) || hasVal(record.boneMineralDensityTScore) || hasVal(record.nicotineUseStatus)) && (
                <View style={styles.section}>
                  {renderSentenceField(t6, 'Peripheral Vascular Status', record.peripheralVascularStatus, ctr)}
                  {renderSentenceField(t6, 'Nicotine Use Status', record.nicotineUseStatus, ctr)}
                  {renderSentenceField(t6, 'Diabetic Foot Risk Category', record.diabeticFootRiskCategory, ctr)}
                  {renderSentenceField(t6, 'Bone Mineral Density T-Score', record.boneMineralDensityTScore, ctr)}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default BunionSurgeryEvaluationDocumentPDFTemplate;

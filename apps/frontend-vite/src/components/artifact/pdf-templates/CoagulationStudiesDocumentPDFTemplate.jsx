/**
 * CoagulationStudiesDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first field's View (anti-orphan, 6a2d6af6).
 * Every value numbered ("1." even for singles); booleans print Yes/No; mirrors Copy Section/Copy All.
 * Collection: coagulation_studies
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 12, color: '#000000', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldUnit: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined) return false; if (typeof v === 'number') return true; if (typeof v === 'boolean') return true; if (typeof v === 'string') return v.trim().length > 0; if (Array.isArray(v)) return v.length > 0; return Boolean(v); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; return String(v); };

/* One field = one wrap={false} glue unit (single-value rows never span pages);
   sectionTitle rides inside the FIRST present field's View. */
const renderField = ([label, value], title, isFirst) => (
  <View key={label} style={styles.fieldUnit} wrap={false}>
    {isFirst ? <Text style={styles.sectionTitle}>{title}</Text> : null}
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.listItem}>1. {fmtVal(value)}</Text>
  </View>
);

const renderSection = (title, fields) => {
  // Hide numeric 0 (the "not reported" extraction default) but keep boolean false → "No".
  const present = fields.filter(f => f && hasVal(f[1]) && !(typeof f[1] === 'number' && f[1] === 0));
  if (present.length === 0) return null;
  return (
    <View key={title} style={styles.section}>
      {present.map((f, fi) => renderField(f, title, fi === 0))}
    </View>
  );
};

const CoagulationStudiesDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.coagulation_studies) {
    records = Array.isArray(data.coagulation_studies) ? data.coagulation_studies : [data.coagulation_studies];
  } else if (data?.documentData) {
    const dd = data.documentData;
    records = Array.isArray(dd) ? dd : (dd?.coagulation_studies ? (Array.isArray(dd.coagulation_studies) ? dd.coagulation_studies : [dd.coagulation_studies]) : [dd]);
  } else if (data) {
    records = [data];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Coagulation Studies</Text></View>
          <Text style={styles.emptyState}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Coagulation Studies</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Coagulation Study {idx + 1}</Text>
              {record.date ? <Text style={styles.recordMeta}>{formatDate(record.date)}</Text> : null}
            </View>

            {renderSection('Basic Coagulation', [
              hasVal(record.prothrombinTime) ? ['Prothrombin Time (PT)', record.prothrombinTime] : null,
              hasVal(record.internationalNormalizedRatio) ? ['INR', record.internationalNormalizedRatio] : null,
              hasVal(record.activatedPartialThromboplastinTime) ? ['aPTT', record.activatedPartialThromboplastinTime] : null,
              hasVal(record.thrombinTime) ? ['Thrombin Time', record.thrombinTime] : null,
            ])}

            {renderSection('Fibrinolysis & Platelet Studies', [
              hasVal(record.fibrinogenLevel) ? ['Fibrinogen Level', record.fibrinogenLevel] : null,
              hasVal(record.plateletCount) ? ['Platelet Count', record.plateletCount] : null,
              hasVal(record.bleedingTime) ? ['Bleeding Time', record.bleedingTime] : null,
              hasVal(record.dDimerLevel) ? ['D-Dimer Level', record.dDimerLevel] : null,
              hasVal(record.fibrinDegradationProducts) ? ['Fibrin Degradation Products', record.fibrinDegradationProducts] : null,
            ])}

            {renderSection('Coagulation Factors', [
              hasVal(record.factorViiActivity) ? ['Factor VII Activity', record.factorViiActivity] : null,
              hasVal(record.factorViiiActivity) ? ['Factor VIII Activity', record.factorViiiActivity] : null,
              hasVal(record.factorIxActivity) ? ['Factor IX Activity', record.factorIxActivity] : null,
              hasVal(record.vonWillebrandFactor) ? ['von Willebrand Factor', record.vonWillebrandFactor] : null,
            ])}

            {renderSection('Natural Anticoagulant Inhibitors', [
              hasVal(record.proteinCActivity) ? ['Protein C Activity', record.proteinCActivity] : null,
              hasVal(record.proteinSActivity) ? ['Protein S Activity', record.proteinSActivity] : null,
              hasVal(record.antithrombinActivity) ? ['Antithrombin Activity', record.antithrombinActivity] : null,
            ])}

            {renderSection('Thrombophilia Screening', [
              hasVal(record.lupusAnticoagulantScreen) ? ['Lupus Anticoagulant Screen', record.lupusAnticoagulantScreen] : null,
              hasVal(record.anticardiolipinAntibody) ? ['Anticardiolipin Antibody', record.anticardiolipinAntibody] : null,
              hasVal(record.factorVLeidenMutation) ? ['Factor V Leiden Mutation', record.factorVLeidenMutation] : null,
              hasVal(record.prothrombinGeneMutation) ? ['Prothrombin Gene Mutation', record.prothrombinGeneMutation] : null,
            ])}

            {renderSection('Specialized Tests', [
              hasVal(record.reptilaseTime) ? ['Reptilase Time', record.reptilaseTime] : null,
              hasVal(record.plateletAggregationStudy) ? ['Platelet Aggregation Study', record.plateletAggregationStudy] : null,
              hasVal(record.claustThrombelastometry) ? ['Thrombelastometry (ROTEM)', record.claustThrombelastometry] : null,
            ])}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CoagulationStudiesDocumentPDFTemplate;

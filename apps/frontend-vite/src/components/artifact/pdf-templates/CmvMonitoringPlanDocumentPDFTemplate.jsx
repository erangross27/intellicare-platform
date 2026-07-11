/**
 * CmvMonitoringPlanDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first field's View (anti-orphan, 6a2d6af6).
 * Every value numbered ("1." even for singles); sentence fields split into numbered rows; unit
 * suffixes (copies/mL, cells/uL, days) mirror Copy Section/Copy All; symptoms array = single-name
 * section (no sub-label). Collection: cmv_monitoring_plan
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
// 0 is meaningful (e.g. undetectable viral load / 0 prior episodes) — numbers are always present.
const hasVal = (v) => { if (v === null || v === undefined) return false; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim().length > 0; if (Array.isArray(v)) return v.length > 0; return Boolean(v); };
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 months"
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

/* One field = one wrap-gated glue View; sectionTitle rides inside the FIRST present field's View.
   [label, value, kind] — kind 'sentence' splits into numbered rows; otherwise a single "1. value".
   Single-name rule: field label == section title → label hidden (symptoms). */
const renderField = ([label, value, kind], title, isFirst) => {
  const showLabel = label.toLowerCase() !== title.toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{title}</Text> : null;
  let rows;
  if (kind === 'sentence') {
    const sentences = splitBySentence(String(value));
    rows = sentences.length ? sentences : [String(value)];
  } else if (Array.isArray(value)) {
    rows = value.map(v => String(v));
  } else {
    rows = [String(value)];
  }
  return (
    <View key={label} style={styles.fieldUnit} wrap={rows.length + 2 > 8 ? true : false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((r, i) => <Text key={i} style={styles.listItem}>{i + 1}. {r}</Text>)}
    </View>
  );
};

const renderSection = (title, fields) => {
  const present = fields.filter(f => f && hasVal(f[1]));
  if (present.length === 0) return null;
  return (
    <View key={title} style={styles.section}>
      {present.map((f, fi) => renderField(f, title, fi === 0))}
    </View>
  );
};

const CmvMonitoringPlanDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.cmv_monitoring_plan) {
    records = Array.isArray(data.cmv_monitoring_plan) ? data.cmv_monitoring_plan : [data.cmv_monitoring_plan];
  } else if (data?.documentData) {
    const dd = data.documentData;
    records = Array.isArray(dd) ? dd : (dd?.cmv_monitoring_plan ? (Array.isArray(dd.cmv_monitoring_plan) ? dd.cmv_monitoring_plan : [dd.cmv_monitoring_plan]) : [dd]);
  } else if (data) {
    records = [data];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>CMV Monitoring Plan</Text></View>
          <Text style={styles.emptyState}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>CMV Monitoring Plan</Text></View>
        {records.map((record, idx) => {
          const symptoms = Array.isArray(record.cmvDiseaseSymptoms) ? record.cmvDiseaseSymptoms.filter(Boolean) : [];
          return (
            // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>CMV Monitoring Plan {idx + 1}</Text>
                {record.date ? <Text style={styles.recordMeta}>{formatDate(record.date)}</Text> : null}
              </View>

              {renderSection('Patient Information', [
                record.date ? ['Date', formatDate(record.date)] : null,
                ['Provider', record.provider],
                ['Facility', record.facility],
                ['Patient Immune Status', record.patientImmuneStatus, 'sentence'],
              ])}

              {renderSection('Transplant Information', [
                ['Transplant Type', record.transplantType],
                record.transplantDate ? ['Transplant Date', formatDate(record.transplantDate)] : null,
                ['Donor CMV Serostatus', record.donorCmvSerostatus],
                ['Recipient CMV Serostatus', record.recipientCmvSerostatus],
                ['Risk Stratification', record.riskStratification, 'sentence'],
              ])}

              {renderSection('Monitoring Details', [
                ['Monitoring Frequency', record.monitoringFrequency],
                ['Monitoring Method', record.monitoringMethod],
                hasVal(record.viralLoadThreshold) ? ['Viral Load Threshold', `${record.viralLoadThreshold} copies/mL`] : null,
                record.nextMonitoringDate ? ['Next Monitoring Date', formatDate(record.nextMonitoringDate)] : null,
              ])}

              {renderSection('Viral Status', [
                hasVal(record.currentViralLoad) ? ['Current Viral Load', `${record.currentViralLoad} copies/mL`] : null,
                ['Viral Load Trend', record.viralLoadTrend],
              ])}

              {renderSection('Clinical Status', [
                hasVal(record.cd4Count) ? ['CD4 Count', `${record.cd4Count} cells/uL`] : null,
                hasVal(record.previousCmvEpisodes) ? ['Previous CMV Episodes', String(record.previousCmvEpisodes)] : null,
                ['Immunosuppression Level', record.immunosuppressionLevel],
              ])}

              {/* Single-name section: label == title → items right under the title, no sub-label */}
              {renderSection('CMV Disease Symptoms', [
                symptoms.length ? ['CMV Disease Symptoms', symptoms] : null,
              ])}

              {renderSection('Treatment Information', [
                ['Prophylaxis Regimen', record.prophylaxisRegimen],
                hasVal(record.prophylaxisDuration) ? ['Prophylaxis Duration', `${record.prophylaxisDuration} days`] : null,
                ['Preemptive Therapy Indication', record.preemptiveTherapyIndication, 'sentence'],
                ['Drug Resistance Testing', record.drugResistanceTesting, 'sentence'],
                ['Ganciclovir Resistance', record.ganciclovirResistance, 'sentence'],
                ['Alternative Therapy Required', record.alternativeTherapyRequired, 'sentence'],
              ])}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default CmvMonitoringPlanDocumentPDFTemplate;

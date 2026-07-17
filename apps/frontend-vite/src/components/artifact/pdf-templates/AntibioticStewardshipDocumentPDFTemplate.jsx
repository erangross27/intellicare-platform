/**
 * AntibioticStewardshipDocumentPDFTemplate.jsx
 * Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: antibiotic_stewardship
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 13, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', borderBottom: '2pt solid #000000', paddingBottom: 8 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderWidth: 2, borderColor: '#000000', borderLeftWidth: 5, borderLeftColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 8, borderBottom: '1pt solid #000000', paddingBottom: 4 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 4, borderBottom: '0.5pt solid #999999', paddingBottom: 2 },
  fieldValue: { fontSize: 13, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 13, lineHeight: 1.5, marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#333333' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
/* hasNum: numeric value present and non-zero (hide-zero) */
const hasNum = (v) => hasVal(v) && Number(v) !== 0;
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (s) => { const m = s.replace(/[;.]+$/, '').trim().match(/^([A-Za-z][A-Za-z0-9 /()-]{1,40}):\s*(.+)$/s); return m ? { label: m[1].trim(), value: m[2].trim() } : { label: null, value: s }; };
const renderFieldRow = (label, value) => { if (!hasVal(value)) return null; return (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>); };
/* splitBySlash: split provider strings on " / " (whitespace-adjacent slash), parenthesis-aware.
   Commas inside a name ("Dr. X, MD, FIDSA") are credentials, NOT separators. Guards N/A, mg/mL, and/or. */
const splitBySlash = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  if (!/\s\/|\/\s/.test(text)) return [text];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === '/' && depth === 0 && (/\s/.test(text[i - 1] || '') || /\s/.test(text[i + 1] || ''))) { const t = cur.trim(); if (t) out.push(t); cur = ''; }
    else { cur += ch; }
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length > 0 ? out : [text];
};
/* renderProviderRow: provider field — split " / " into a numbered list; single provider stays a plain row */
const renderProviderRow = (label, value) => {
  if (!hasVal(value)) return null;
  const provs = splitBySlash(String(value));
  if (provs.length <= 1) return renderFieldRow(label, value);
  return (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>{label}</Text>{provs.map((p, i) => <Text key={i} style={styles.listItem}>{i + 1}. {p}</Text>)}</View>);
};
/* renderNumberRow: hide-zero — omit numeric 0 (no measurement) */
const renderNumberRow = (label, value) => { if (!hasVal(value) || Number(value) === 0) return null; return (<View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>); };
/* flattenItem: array item (string OR object) → readable text, avoids [object Object] */
const humanizeKey = (k) => String(k).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
const flattenItem = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'boolean') return item ? 'Yes' : 'No';
  if (typeof item === 'number' || typeof item === 'string') return String(item);
  if (Array.isArray(item)) return item.map(flattenItem).filter(Boolean).join(', ');
  if (typeof item === 'object') return Object.entries(item).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${humanizeKey(k)}: ${flattenItem(v)}`).join('; ');
  return String(item);
};

const renderArrayItems = (items) => {
  let rowNumber = 1;
  return items.flatMap((item, itemIndex) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.entries(item).filter(([, value]) => hasVal(value)).map(([key, value]) => (
        <View key={`${itemIndex}-${key}`} style={{ marginBottom: 3 }}>
          <Text style={styles.fieldLabel}>{humanizeKey(key)}</Text>
          <Text style={styles.listItem}>{rowNumber++}. {flattenItem(value)}</Text>
        </View>
      ));
    }
    const parsed = parseLabel(flattenItem(item));
    if (parsed.label) {
      return [
        <View key={itemIndex} style={{ marginBottom: 3 }}>
          <Text style={styles.fieldLabel}>{parsed.label}</Text>
          <Text style={styles.listItem}>{rowNumber++}. {parsed.value}</Text>
        </View>,
      ];
    }
    return [<Text key={itemIndex} style={styles.listItem}>{rowNumber++}. {flattenItem(item)}</Text>];
  });
};

const renderSentenceField = (label, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(String(text));
  if (sentences.length === 0) return null;
  let totalItems = sentences.length;
  sentences.forEach(s => { const p = parseLabel(s); const rv = p.label ? p.value : s; const ci = rv.split(/,\s+/).filter(x => x.trim()); if (ci.length > 1) totalItems += ci.length - 1; });
  return (<View style={styles.fieldBox}>
    {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
    <Text style={styles.fieldLabel}>{label}</Text>
    {sentences.map((s, i) => {
      const p = parseLabel(s);
      const rawVal = p.label ? p.value : s;
      const cItems = p.label ? rawVal.split(/,\s+/).filter(x => x.trim()) : [rawVal];
      return (<View key={i} style={{ marginBottom: 3, marginLeft: 8 }}>
        {p.label && <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>{p.label}</Text>}
        {cItems.length > 1 ? cItems.map((item, ci) => <Text key={ci} style={styles.listItem}>{ci + 1}. {item.trim()}</Text>) : <Text style={styles.listItem}>1. {rawVal}</Text>}
      </View>);
    })}
  </View>);
};

const AntibioticStewardshipDocumentPDFTemplate = ({ document: data }) => {
  // Handle data unwrapping
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.antibiotic_stewardship && Array.isArray(data.antibiotic_stewardship)) {
    records = data.antibiotic_stewardship;
  } else if (data?.data) {
    records = Array.isArray(data.data) ? data.data : [data.data];
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.antibiotic_stewardship) {
      records = docData.antibiotic_stewardship;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  records = records.flatMap(record => {
    if (record?.antibiotic_stewardship) return Array.isArray(record.antibiotic_stewardship) ? record.antibiotic_stewardship : [record.antibiotic_stewardship];
    if (record?.data) return Array.isArray(record.data) ? record.data : [record.data];
    if (record?.documentData) {
      const nested = record.documentData;
      if (Array.isArray(nested)) return nested;
      if (nested?.antibiotic_stewardship) return Array.isArray(nested.antibiotic_stewardship) ? nested.antibiotic_stewardship : [nested.antibiotic_stewardship];
      return [nested];
    }
    return [record];
  }).filter(record => record && typeof record === 'object');

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.documentTitle}>Antibiotic Stewardship</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Antibiotic Stewardship</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Antibiotic Stewardship ${idx + 1}`}</Text>
            </View>

            {/* 1. Provider Information */}
            {(hasVal(record.prescribingPhysician) || hasVal(record.stewardshipReviewer)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Provider Information</Text>
                {renderProviderRow('Prescribing Physician', record.prescribingPhysician)}
                {renderProviderRow('Stewardship Reviewer', record.stewardshipReviewer)}
              </View>
            )}

            {/* 2. Antibiotic Information */}
            {(hasVal(record.date) || hasVal(record.antibioticName) || hasVal(record.antibioticClass) || hasVal(record.indicationForUse) || hasVal(record.dosage) || hasVal(record.routeOfAdministration) || hasNum(record.durationOfTherapy)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Antibiotic Information</Text>
                  {renderFieldRow('Date', formatDate(record.date))}
                  {renderFieldRow('Antibiotic Name', record.antibioticName)}
                  {renderFieldRow('Antibiotic Class', record.antibioticClass)}
                  {renderFieldRow('Dosage', record.dosage)}
                  {renderFieldRow('Route of Administration', record.routeOfAdministration)}
                  {renderNumberRow('Duration of Therapy', record.durationOfTherapy)}
                </View>
                {hasVal(record.indicationForUse) && renderSentenceField('Indication for Use', record.indicationForUse)}
              </View>
            )}

            {/* 3. Microbiology */}
            {(hasVal(record.cultureSource) || hasVal(record.cultureSensitivity) || hasVal(record.microbiologyResult)) && (
              <View style={styles.section}>
                <View style={styles.fieldBox} wrap={false}>
                  <Text style={styles.sectionTitle}>Microbiology</Text>
                  {renderFieldRow('Culture Source', record.cultureSource)}
                </View>
                {Array.isArray(record.cultureSensitivity) && record.cultureSensitivity.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.cultureSensitivity.length > 8}>
                    <Text style={styles.fieldLabel}>Culture Sensitivity</Text>
                    {renderArrayItems(record.cultureSensitivity)}
                  </View>
                )}
                {hasVal(record.microbiologyResult) && renderSentenceField('Microbiology Result', record.microbiologyResult)}
              </View>
            )}

            {/* 4. Stewardship Review */}
            {(hasVal(record.interventionType) || hasVal(record.interventionAccepted) || hasVal(record.deEscalationPerformed)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Stewardship Review</Text>
                {renderSentenceField('Intervention Type', record.interventionType)}
                {renderFieldRow('Intervention Accepted', hasVal(record.interventionAccepted) ? (record.interventionAccepted ? 'Yes' : 'No') : null)}
                {renderFieldRow('De-Escalation Performed', hasVal(record.deEscalationPerformed) ? (record.deEscalationPerformed ? 'Yes' : 'No') : null)}
              </View>
            )}

            {/* 5. Clinical Monitoring */}
            {(hasVal(record.biomarkerValues) || hasVal(record.clinicalImprovement) || hasVal(record.adverseDrugReaction) || hasVal(record.therapeuticDrugMonitoring) || hasVal(record.renalAdjustmentRequired) || hasNum(record.creatinineClearance)) && (
              <View style={styles.section}>
                {Array.isArray(record.biomarkerValues) && record.biomarkerValues.length > 0 && (
                  <View style={styles.fieldBox} wrap={record.biomarkerValues.length > 8}>
                    <Text style={styles.sectionTitle}>Clinical Monitoring</Text>
                    <Text style={styles.fieldLabel}>Biomarker Values</Text>
                    {renderArrayItems(record.biomarkerValues)}
                  </View>
                )}
                <View style={styles.fieldBox} wrap={false}>
                  {(!Array.isArray(record.biomarkerValues) || record.biomarkerValues.length === 0) && <Text style={styles.sectionTitle}>Clinical Monitoring</Text>}
                  {renderFieldRow('Clinical Improvement', hasVal(record.clinicalImprovement) ? (record.clinicalImprovement ? 'Yes' : 'No') : null)}
                  {renderSentenceField('Adverse Drug Reaction', record.adverseDrugReaction)}
                  {renderFieldRow('Therapeutic Drug Monitoring', hasVal(record.therapeuticDrugMonitoring) ? (record.therapeuticDrugMonitoring ? 'Yes' : 'No') : null)}
                  {renderFieldRow('Renal Adjustment Required', hasVal(record.renalAdjustmentRequired) ? (record.renalAdjustmentRequired ? 'Yes' : 'No') : null)}
                  {renderNumberRow('Creatinine Clearance', record.creatinineClearance)}
                </View>
              </View>
            )}

            {/* 6. Therapy Flags */}
            {(hasVal(record.restrictedAntibiotic) || hasVal(record.empiricTherapy) || hasVal(record.prophylacticUse) || hasNum(record.timeToAppropriateTherapy) || hasNum(record.costSavingsEstimate)) && (
              <View style={styles.fieldBox} wrap={false}>
                <Text style={styles.sectionTitle}>Therapy Flags</Text>
                {renderFieldRow('Restricted Antibiotic', hasVal(record.restrictedAntibiotic) ? (record.restrictedAntibiotic ? 'Yes' : 'No') : null)}
                {renderFieldRow('Empiric Therapy', hasVal(record.empiricTherapy) ? (record.empiricTherapy ? 'Yes' : 'No') : null)}
                {renderFieldRow('Prophylactic Use', hasVal(record.prophylacticUse) ? (record.prophylacticUse ? 'Yes' : 'No') : null)}
                {renderNumberRow('Time to Appropriate Therapy', record.timeToAppropriateTherapy)}
                {renderNumberRow('Cost Savings Estimate', record.costSavingsEstimate)}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AntibioticStewardshipDocumentPDFTemplate;

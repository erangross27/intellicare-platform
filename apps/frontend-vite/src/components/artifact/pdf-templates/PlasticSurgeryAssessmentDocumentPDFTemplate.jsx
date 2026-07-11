import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Plastic Surgery Assessment PDF Template
 * BLACK & WHITE ONLY — every color is #000000. Helvetica. LETTER size.
 * Recursive object rendering for all object fields (Rule #74 wrap-gating).
 * NO borderRadius.
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordHeader: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 10, color: '#000000', marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  miniCard: { padding: 4, marginBottom: 6 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  subLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  arrayItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  leafRow: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  recommendedText: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 2 },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
});

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const fv = (val) => { if (val === undefined || val === null || val === '') return null; if (typeof val === 'boolean') return val ? 'Yes' : 'No'; return String(val); };
const safeArray = (val) => Array.isArray(val) ? val : [];

const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const splitIntoItems = (text) => {
  if (!text) return [];
  const numbered = text.split(/\s+(?=\d+\.\s)/).filter(s => s.trim()).map(s => s.trim());
  if (numbered.length > 1) return numbered;
  const bySemicolon = text.split(/;\s*/).filter(s => s.trim()).map(s => s.trim());
  if (bySemicolon.length > 1) return bySemicolon;
  const bySentence = text.split(/(?<!\b(?:Dr|Mr|Mrs|Ms|St|vs|Jr|Sr|No|Vol|Inc|Ltd|etc))\.\s+/).filter(s => s.trim()).map(s => s.trim());
  if (bySentence.length > 1) return bySentence.map(s => s.endsWith('.') ? s : s + '.');
  return [text.trim()];
};

/* Recursive object rendering — every nested leaf printed as "Label: value" */
const ObjectLeaves = ({ value, label, depth }) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) {
    return <Text style={styles.leafRow}>{(label ? label + ': ' : '') + fmtScalar(value)}</Text>;
  }
  if (Array.isArray(value)) {
    const items = value.filter(v => !isEmptyDeep(v));
    return (
      <View>
        {label ? <Text style={styles.subLabel}>{label}</Text> : null}
        {items.map((v, i) => (
          isScalar(v)
            ? <Text key={i} style={styles.arrayItem}>{`${i + 1}. ${fmtScalar(v)}`}</Text>
            : <View key={i} style={{ paddingLeft: 8 }}><ObjectLeaves value={v} label={null} depth={depth + 1} /></View>
        ))}
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View>
      {label ? <Text style={styles.subLabel}>{label}</Text> : null}
      {entries.map(([k, v]) => (
        <ObjectLeaves key={k} value={v} label={humanizeKey(k)} depth={depth + 1} />
      ))}
    </View>
  );
};

const ObjectSection = ({ title, value }) => {
  if (isEmptyDeep(value)) return null;
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View style={styles.section} wrap={entries.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {entries.map(([k, v]) => (
        <ObjectLeaves key={k} value={v} label={humanizeKey(k)} depth={0} />
      ))}
    </View>
  );
};

const NarrativeSection = ({ title, text }) => {
  if (fv(text) === null) return null;
  const items = splitIntoItems(text);
  return (
    <View style={styles.section} wrap={items.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <Text key={i} style={styles.arrayItem}>{`${i + 1}. ${item}`}</Text>
      ))}
    </View>
  );
};

const ArraySection = ({ title, items }) => {
  const arr = safeArray(items).filter(v => !isEmptyDeep(v));
  if (arr.length === 0) return null;
  return (
    <View style={styles.section} wrap={arr.length > 8 ? undefined : false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {arr.map((it, i) => (
        isScalar(it)
          ? <Text key={i} style={styles.arrayItem}>{`${i + 1}. ${fmtScalar(it)}`}</Text>
          : <View key={i} style={styles.miniCard}><ObjectLeaves value={it} label={`Item ${i + 1}`} depth={0} /></View>
      ))}
    </View>
  );
};

const PlasticSurgeryAssessmentDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) records = data;
  else if (data?.plastic_surgery_assessment) records = Array.isArray(data.plastic_surgery_assessment) ? data.plastic_surgery_assessment : [data.plastic_surgery_assessment];
  else if (data?.documentData) records = Array.isArray(data.documentData) ? data.documentData : [data.documentData];
  else if (data) records = [data];

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Plastic Surgery Assessment</Text></View>
          <Text style={styles.noDataText}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Plastic Surgery Assessment</Text></View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>Plastic Surgery Assessment {idx + 1}</Text>
              {record.date && <Text style={styles.recordMeta}>Date: {formatDate(record.date)}</Text>}
              {fv(record.type) !== null && <Text style={styles.recordMeta}>Type: {record.type}</Text>}
              {fv(record.provider) !== null && <Text style={styles.recordMeta}>Provider: {record.provider}</Text>}
              {fv(record.facility) !== null && <Text style={styles.recordMeta}>Facility: {record.facility}</Text>}
              {fv(record.status) !== null && <Text style={styles.recordMeta}>Status: {record.status}</Text>}
            </View>

            {/* Reconstruction Options Discussed (array of objects) */}
            {safeArray(record.reconstructionOptionsDiscussed).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Reconstruction Options Discussed</Text>
                {safeArray(record.reconstructionOptionsDiscussed).map((opt, optIdx) => (
                  <View key={optIdx} style={styles.miniCard} wrap={false}>
                    <Text style={styles.fieldLabel}>Option {optIdx + 1}: {opt.option || 'Unknown'}</Text>
                    {opt.recommended !== undefined && (
                      <Text style={styles.recommendedText}>Recommended: {opt.recommended ? 'Yes' : 'No'}</Text>
                    )}
                    {safeArray(opt.advantages).length > 0 && (
                      <View>
                        <Text style={styles.subLabel}>Advantages:</Text>
                        {safeArray(opt.advantages).map((adv, advIdx) => (
                          <Text key={advIdx} style={styles.arrayItem}>{advIdx + 1}. {adv}</Text>
                        ))}
                      </View>
                    )}
                    {safeArray(opt.disadvantages).length > 0 && (
                      <View>
                        <Text style={styles.subLabel}>Disadvantages:</Text>
                        {safeArray(opt.disadvantages).map((dis, disIdx) => (
                          <Text key={disIdx} style={styles.arrayItem}>{disIdx + 1}. {dis}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Object sections — recursive */}
            <ObjectSection title="Patient Preference" value={record.patientPreference} />
            <ArraySection title="Patient Concerns" items={record.patientConcerns} />
            <ObjectSection title="Donor Site Assessment" value={record.donorSiteAssessment} />
            <ObjectSection title="Measurements" value={record.measurements} />
            <ObjectSection title="Preoperative Photography" value={record.preoperativePhotography} />
            <ObjectSection title="Skin Analysis" value={record.skinAnalysis} />
            <ObjectSection title="Flap Assessment" value={record.flapAssessment} />
            <ObjectSection title="Implant Data" value={record.implantData} />
            <ObjectSection title="Vascular Examination" value={record.vascularExamination} />
            <ObjectSection title="Aesthetic Goals" value={record.aestheticGoals} />
            <ObjectSection title="Results" value={record.results} />

            {/* Narrative sections */}
            <NarrativeSection title="Findings" text={record.findings} />
            <NarrativeSection title="Assessment" text={record.assessment} />
            <NarrativeSection title="Plan" text={record.plan} />
            <NarrativeSection title="Notes" text={record.notes} />

            {/* Recommendations array */}
            <ArraySection title="Recommendations" items={record.recommendations} />
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PlasticSurgeryAssessmentDocumentPDFTemplate;

/**
 * ClinicalTrialDocumentsPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first field's View (anti-orphan, 6a2d6af6).
 * Every value numbered ("1." even for singles); labeled sentences/array items become label groups
 * (numbering restarts at labeled groups, continues across unlabeled rows); single-name rule applied.
 * Collection: clinical_trial_documents
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
  fieldGroup: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  itemTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const FIELD_LABELS = {
  protocolNumber: 'Protocol Number', studyPhase: 'Study Phase', studyCompletionStatus: 'Completion Status', performanceStatus: 'Performance Status',
  primaryEndpoint: 'Primary Endpoint', investigationalProduct: 'Investigational Product', dosageRegimen: 'Dosage Regimen',
  randomizationMethod: 'Randomization Method', dataMonitoringCommittee: 'Data Monitoring Committee',
  withdrawalReason: 'Withdrawal Reason', statisticalAnalysisPlan: 'Statistical Analysis Plan',
  secondaryEndpoints: 'Secondary Endpoints', inclusionCriteria: 'Inclusion Criteria', exclusionCriteria: 'Exclusion Criteria',
  adverseEvents: 'Adverse Events', seriousAdverseEvents: 'Serious Adverse Events', concomitantMedications: 'Concomitant Medications',
  biomarkerLevels: 'Biomarker Levels', efficacyMeasures: 'Efficacy Measures', qualityOfLifeScores: 'Quality of Life Scores',
  protocolDeviations: 'Protocol Deviations', regulatorySubmissions: 'Regulatory Submissions',
};
const SECTION_DEFS = [
  ['Protocol Overview', ['protocolNumber', 'studyPhase', 'studyCompletionStatus', 'performanceStatus']],
  ['Primary Endpoint', ['primaryEndpoint']],
  ['Secondary Endpoints', ['secondaryEndpoints']],
  ['Inclusion Criteria', ['inclusionCriteria']],
  ['Exclusion Criteria', ['exclusionCriteria']],
  ['Investigational Product', ['investigationalProduct', 'dosageRegimen']],
  ['Concomitant Medications', ['concomitantMedications']],
  ['Randomization', ['randomizationMethod']],
  ['Adverse Events', ['adverseEvents']],
  ['Serious Adverse Events', ['seriousAdverseEvents']],
  ['Protocol Deviations', ['protocolDeviations']],
  ['Biomarker Levels', ['biomarkerLevels']],
  ['Efficacy Measures', ['efficacyMeasures']],
  ['Quality of Life', ['qualityOfLifeScores']],
  ['Data Monitoring', ['dataMonitoringCommittee']],
  ['Statistical Analysis Plan', ['statisticalAnalysisPlan']],
  ['Regulatory Submissions', ['regulatorySubmissions']],
  ['Study Status', ['withdrawalReason']],
];
const ARRAY_FIELDS = ['secondaryEndpoints', 'inclusionCriteria', 'exclusionCriteria', 'adverseEvents', 'seriousAdverseEvents', 'concomitantMedications', 'biomarkerLevels', 'efficacyMeasures', 'qualityOfLifeScores', 'protocolDeviations', 'regulatorySubmissions'];
const LABEL_ARRAY_FIELDS = ['efficacyMeasures', 'qualityOfLifeScores', 'regulatorySubmissions', 'seriousAdverseEvents'];
const SENTENCE_FIELDS = ['primaryEndpoint', 'investigationalProduct', 'dosageRegimen', 'randomizationMethod', 'dataMonitoringCommittee', 'statisticalAnalysisPlan', 'withdrawalReason'];

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 months"
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };
const splitByComma = (text) => { if (!text) return []; const parts = []; let current = ''; let depth = 0; for (let i = 0; i < text.length; i++) { const ch = text[i]; if (ch === '(') depth++; else if (ch === ')') depth--; else if (ch === ',' && depth === 0 && i + 1 < text.length && text[i + 1] === ' ') { parts.push(current.trim()); current = ''; i++; continue; } current += ch; } if (current.trim()) parts.push(current.trim()); return parts.filter(Boolean); };

/* Sentence field → elements: labeled sentences become label groups (numbering restarts);
   plain sentences continue a running count. Mirrors the JSX + copy exactly. */
const sentenceElements = (val) => {
  const out = []; let running = 0;
  splitBySentence(fmtVal(val)).forEach((s, si) => {
    const parsed = parseLabel(s);
    if (parsed) {
      const items = splitByComma(parsed.content);
      out.push(
        <View key={`g${si}`}>
          <Text style={styles.fieldLabel}>{parsed.label}</Text>
          {(items.length ? items : [parsed.content]).map((ci, i) => <Text key={i} style={styles.listItem}>{i + 1}. {ci}</Text>)}
        </View>
      );
      running = 0;
      return;
    }
    running += 1;
    out.push(<Text key={`s${si}`} style={styles.listItem}>{running}. {s}</Text>);
  });
  return out;
};

/* Label array → parsed items become label groups (restart); dash-label items get a bold header;
   plain items continue a running count. */
const labelArrayElements = (arr) => {
  const out = []; let running = 0;
  arr.forEach((item, ai) => {
    const itemStr = String(item);
    const dashParts = itemStr.includes(' - ') ? itemStr.split(' - ') : null;
    const hasDashLabels = dashParts && dashParts.length > 1 && dashParts.slice(1).some(p => parseLabel(p));
    if (hasDashLabels) {
      out.push(
        <View key={`d${ai}`}>
          <Text style={styles.itemTitle}>{dashParts[0]}</Text>
          {dashParts.slice(1).map((dp, di) => { const p = parseLabel(dp); if (p) { const items = splitByComma(p.content); return (<View key={di}><Text style={styles.fieldLabel}>{p.label}</Text>{(items.length ? items : [p.content]).map((ci, i) => <Text key={i} style={styles.listItem}>{i + 1}. {ci}</Text>)}</View>); } running += 1; return <Text key={di} style={styles.listItem}>{running}. {dp}</Text>; })}
        </View>
      );
      running = 0;
      return;
    }
    const parsed = parseLabel(itemStr);
    if (parsed) {
      const items = splitByComma(parsed.content);
      out.push(
        <View key={`p${ai}`}>
          <Text style={styles.fieldLabel}>{parsed.label}</Text>
          {(items.length ? items : [parsed.content]).map((ci, i) => <Text key={i} style={styles.listItem}>{i + 1}. {ci}</Text>)}
        </View>
      );
      running = 0;
      return;
    }
    running += 1;
    out.push(<Text key={`i${ai}`} style={styles.listItem}>{running}. {itemStr}</Text>);
  });
  return out;
};

/* One field = one wrap-gated View; sectionTitle rides inside the FIRST present field's View.
   Single-name rule: field label == section title → hidden. */
const renderField = (record, f, title, isFirst) => {
  const val = record[f];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.toLowerCase() !== title.toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{title}</Text> : null;
  let body; let rows;
  if (ARRAY_FIELDS.includes(f)) {
    const arr = val.filter(Boolean);
    rows = arr.length;
    body = LABEL_ARRAY_FIELDS.includes(f) ? labelArrayElements(arr) : arr.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {fmtVal(it)}</Text>);
  } else if (SENTENCE_FIELDS.includes(f)) {
    rows = splitBySentence(fmtVal(val)).length;
    body = sentenceElements(val);
  } else {
    rows = 1;
    body = <Text style={styles.listItem}>1. {fmtVal(val)}</Text>;
  }
  return (
    <View key={f} style={styles.fieldGroup} wrap={rows + 2 > 8 ? true : false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  );
};

const ClinicalTrialDocumentsPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.clinical_trial_documents) return Array.isArray(r.clinical_trial_documents) ? r.clinical_trial_documents : [r.clinical_trial_documents];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.clinical_trial_documents) return Array.isArray(dd.clinical_trial_documents) ? dd.clinical_trial_documents : [dd.clinical_trial_documents]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Clinical Trial Documents</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Clinical Trial Documents</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Clinical Trial Documents ${idx + 1}`}</Text>
              {record.date ? <Text style={styles.recordMeta}>{formatDate(record.date)}</Text> : null}
            </View>
            {SECTION_DEFS.map(([title, fields]) => {
              const present = fields.filter(f => hasVal(record[f]));
              if (present.length === 0) return null;
              return (
                <View key={title} style={styles.section}>
                  {present.map((f, fi) => renderField(record, f, title, fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ClinicalTrialDocumentsPDFTemplate;

/**
 * ClinicalTrialsDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first unit's View (anti-orphan, 6a2d6af6).
 * Every value numbered ("1." even for singles); trialsOffered items = trial-name header + Phase /
 * Eligibility Criteria groups (primary shown ONCE as the header, 6a4746da); no "(undefined)" phases.
 * Collection: clinical_trials
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
  itemTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; return String(v ?? ''); };
const KEY_OVERRIDES = { ews: 'EWS', icu: 'ICU', ed: 'ED', los: 'LOS', dnr: 'DNR', poc: 'POC', orr: 'ORR', pfs: 'PFS', os: 'OS' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 months"
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };

// Object → per-leaf units {label: "Parent — Child", rows: ["value"]} (never "label: value" lines)
const objectUnits = (label, value) => {
  const units = [];
  if (isScalar(value)) { units.push({ label, rows: [fmtVal(value)] }); return units; }
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => units.push(...objectUnits(label ? `${label} — ${humanizeKey(k)}` : humanizeKey(k), v)));
  return units;
};

/* section = flowing container of per-unit glue Views; sectionTitle rides inside the FIRST unit.
   unit = {label|null (0.5pt-underlined), header|null (bold item title), rows[]}. Single-name applied
   by the callers (label omitted when == title). */
const renderSection = (title, units) => {
  const live = (units || []).filter(u => u && ((u.rows && u.rows.length > 0) || u.header));
  if (live.length === 0) return null;
  return (
    <View style={styles.section}>
      {live.map((u, i) => (
        <View key={i} style={styles.fieldUnit} wrap={(u.rows ? u.rows.length : 0) + 2 > 8 ? true : false}>
          {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
          {u.header ? <Text style={styles.itemTitle}>{u.header}</Text> : null}
          {u.label ? <Text style={styles.fieldLabel}>{u.label}</Text> : null}
          {(u.rows || []).map((r, j) => <Text key={j} style={styles.listItem}>{j + 1}. {r}</Text>)}
        </View>
      ))}
    </View>
  );
};

const ClinicalTrialsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.clinical_trials) return Array.isArray(r.clinical_trials) ? r.clinical_trials : [r.clinical_trials];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.clinical_trials) return Array.isArray(dd.clinical_trials) ? dd.clinical_trials : [dd.clinical_trials]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Clinical Trials</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Clinical Trials</Text></View>
        {records.map((record, idx) => {
          // Trials Offered: trial name as the item header (primary — shown ONCE), Phase +
          // Eligibility Criteria as labeled numbered groups. No "(undefined)" phase suffixes.
          const trialUnits = [];
          (record.trialsOffered || []).forEach(t => {
            trialUnits.push({ header: t.trialName || 'Trial', rows: [] });
            if (hasVal(t.phase)) trialUnits.push({ label: 'Phase', rows: [fmtVal(t.phase)] });
            if (t.eligibilityCriteria?.length) trialUnits.push({ label: 'Eligibility Criteria', rows: t.eligibilityCriteria.filter(Boolean).map(fmtVal) });
          });
          // Recommendations: date-grouped (labeled groups restart numbering)
          const recGroups = {};
          (record.recommendations || []).filter(r => r?.recommendation).forEach(r => { const d = r.date ? formatDate(r.date) : 'No Date'; if (!recGroups[d]) recGroups[d] = []; recGroups[d].push(r.recommendation); });
          const recUnits = Object.entries(recGroups).map(([d, items]) => ({ label: d, rows: items }));
          // Notes section: notes sentences (single-name → no label) + Status labeled row
          const notesUnits = [];
          if (hasVal(record.notes)) notesUnits.push({ label: null, rows: splitBySentence(String(record.notes)) });
          if (hasVal(record.status)) notesUnits.push({ label: 'Status', rows: [fmtVal(record.status)] });
          return (
            // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Clinical Trials ${idx + 1}`}</Text>
                {record.date ? <Text style={styles.recordMeta}>{formatDate(record.date)}</Text> : null}
              </View>
              {renderSection('Eligibility & Enrollment', [
                hasVal(record.eligible) ? { label: 'Eligible', rows: [fmtVal(record.eligible)] } : null,
                hasVal(record.enrolled) ? { label: 'Enrolled', rows: [fmtVal(record.enrolled)] } : null,
                hasVal(record.enrolledTrial) ? { label: 'Enrolled Trial', rows: [fmtVal(record.enrolledTrial)] } : null,
                hasVal(record.screeningStatus) ? { label: 'Screening Status', rows: [fmtVal(record.screeningStatus)] } : null,
              ])}
              {renderSection('Provider Information', [
                hasVal(record.provider) ? { label: 'Provider', rows: [fmtVal(record.provider)] } : null,
                hasVal(record.facility) ? { label: 'Facility', rows: [fmtVal(record.facility)] } : null,
              ])}
              {renderSection('Trials Offered', trialUnits)}
              {renderSection('Clinical', [
                hasVal(record.findings) ? { label: 'Findings', rows: splitBySentence(String(record.findings)) } : null,
                hasVal(record.plan) ? { label: 'Plan', rows: splitBySentence(String(record.plan)) } : null,
              ])}
              {renderSection('Results', hasVal(record.results) ? objectUnits('', record.results) : [])}
              {renderSection('Assessment', hasVal(record.assessment) ? [{ label: null, rows: splitBySentence(String(record.assessment)) }] : [])}
              {renderSection('Recommendations', recUnits)}
              {renderSection('Notes', notesUnits)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default ClinicalTrialsDocumentPDFTemplate;

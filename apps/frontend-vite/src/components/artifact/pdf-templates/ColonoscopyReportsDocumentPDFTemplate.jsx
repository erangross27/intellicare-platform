/**
 * ColonoscopyReportsDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first present field's View (anti-orphan, 6a2d6af6).
 * Fields render in SECTION_DEFS order (4-area mirror with the JSX + copy). Object arrays (polyps/biopsies)
 * mirror the JSX mini-cards: a generic "Polyp N"/"Biopsy N" subtitle then each present subfield as a
 * labeled numbered row (no primary-field double). Numbers with a "not recorded" 0 sentinel hidden
 * (Boston/cecal/withdrawal + cdaiScore); mayoScore keeps a meaningful 0; booleans Yes/No; sentence fields
 * split by sentence then comma (>=3). Collection: colonoscopy_reports
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
  itemSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginBottom: 3, marginTop: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const SECTION_DEFS = [
  ['Procedure Details', ['scopeInsertionDepth', 'cecalIntubationTime', 'withdrawalTime', 'bostonBowelPrepScale', 'patientPreparation', 'sedationUsed', 'cecalLandmarks']],
  ['Findings', ['polypsIdentified', 'inflammatoryChanges', 'histopathologyResults', 'adenomaDetectionRate']],
  ['Techniques', ['polypectomyTechnique', 'parisClassification', 'chromoendoscopyUsed']],
  ['Biopsies', ['biopsiesTaken']],
  ['Complications & Scores', ['complicationsDuringProcedure', 'mayoScore', 'cdaiScore', 'diverticulosisPresent', 'vascularLesions', 'tattoosPlaced']],
  ['Surveillance', ['nextSurveillanceInterval']],
];

const FIELD_LABELS = {
  patientPreparation: 'Patient Preparation', bostonBowelPrepScale: 'Boston Bowel Prep Scale',
  scopeInsertionDepth: 'Scope Insertion Depth', cecalIntubationTime: 'Cecal Intubation Time',
  withdrawalTime: 'Withdrawal Time', cecalLandmarks: 'Cecal Landmarks', sedationUsed: 'Sedation Used',
  polypsIdentified: 'Polyps Identified', inflammatoryChanges: 'Inflammatory Changes',
  histopathologyResults: 'Histopathology Results', adenomaDetectionRate: 'Adenoma Detection Rate',
  polypectomyTechnique: 'Polypectomy Technique', parisClassification: 'Paris Classification',
  chromoendoscopyUsed: 'Chromoendoscopy Used',
  biopsiesTaken: 'Biopsies Taken',
  complicationsDuringProcedure: 'Complications', mayoScore: 'Mayo Score', cdaiScore: 'CDAI Score',
  diverticulosisPresent: 'Diverticulosis Present', vascularLesions: 'Vascular Lesions', tattoosPlaced: 'Tattoos Placed',
  nextSurveillanceInterval: 'Next Surveillance Interval',
};

const ARRAY_FIELDS = ['cecalLandmarks', 'histopathologyResults', 'inflammatoryChanges', 'complicationsDuringProcedure', 'polypectomyTechnique', 'parisClassification', 'vascularLesions', 'tattoosPlaced'];
const OBJECT_ARRAY_FIELDS = ['polypsIdentified', 'biopsiesTaken'];
const SENTENCE_FIELDS = ['nextSurveillanceInterval', 'patientPreparation', 'sedationUsed'];
const OBJECT_SUBFIELDS = {
  polypsIdentified: [{ key: 'size', label: 'Size' }, { key: 'location', label: 'Location' }, { key: 'morphology', label: 'Morphology' }, { key: 'pathology', label: 'Pathology' }],
  biopsiesTaken: [{ key: 'location', label: 'Location' }, { key: 'number', label: 'Number' }],
};
const OBJECT_ITEM_LABEL = { polypsIdentified: 'Polyp', biopsiesTaken: 'Biopsy' };
// Numbers whose stored 0 is a "not recorded"/extraction-default sentinel (hide). mayoScore is NOT here —
// Mayo 0 = endoscopic remission is a meaningful result; cdaiScore cannot realistically be a real 0.
const HIDE_ZERO_FIELDS = ['bostonBowelPrepScale', 'cecalIntubationTime', 'withdrawalTime', 'cdaiScore'];

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fieldHasVal = (fn, v) => { if (HIDE_ZERO_FIELDS.includes(fn) && (v === 0 || v === '0')) return false; return hasVal(v); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 mg".
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
// Comma splitter for narrative lists (per sentence, >=3 gate). Paren-aware; keeps Oxford ", and/or X"
// attached; skips no-space commas ("$18,000") and date commas ("January 8, 2026").
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      parts.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};
// Sentence field → sentences, each comma-split into rows when it yields >=3 (Rule #73).
const sentenceCommaRows = (text) => splitBySentence(text).flatMap(s => { const p = splitByComma(s); return p.length >= 3 ? p : [s]; });

// Build a field's display model (label + typed line list) or null when the field has no value.
// Line kinds: 'subtitle' (object-item header), 'sublabel' (object subfield label), 'item' (numbered value row).
const buildFieldModel = (record, f) => {
  const label = FIELD_LABELS[f] || f;
  const val = record[f];
  const lines = [];
  if (OBJECT_ARRAY_FIELDS.includes(f)) {
    if (!hasVal(val)) return null;
    let any = false;
    (Array.isArray(val) ? val : [val]).forEach((item, i) => {
      if (!item || typeof item !== 'object') { lines.push({ kind: 'item', text: `${i + 1}. ${String(item)}` }); any = true; return; }
      const subs = (OBJECT_SUBFIELDS[f] || []).filter(sf => { const sv = item[sf.key]; return sv !== undefined && sv !== null && String(sv).trim() !== ''; });
      if (!subs.length) return;
      any = true;
      lines.push({ kind: 'subtitle', text: `${OBJECT_ITEM_LABEL[f] || label} ${i + 1}` });
      subs.forEach(sf => { lines.push({ kind: 'sublabel', text: sf.label }); lines.push({ kind: 'item', text: `1. ${item[sf.key]}` }); });
    });
    if (!any) return null;
  } else if (ARRAY_FIELDS.includes(f)) {
    const arr = (Array.isArray(val) ? val : (hasVal(val) ? [val] : [])).filter(hasVal);
    if (!arr.length) return null;
    arr.forEach((item, i) => lines.push({ kind: 'item', text: `${i + 1}. ${String(item)}` }));
  } else if (SENTENCE_FIELDS.includes(f)) {
    if (!fieldHasVal(f, val)) return null;
    const rows = sentenceCommaRows(String(val));
    (rows.length ? rows : [fmtVal(val)]).forEach((s, i) => lines.push({ kind: 'item', text: `${i + 1}. ${s}` }));
  } else {
    if (!fieldHasVal(f, val)) return null;
    lines.push({ kind: 'item', text: `1. ${fmtVal(val)}` });
  }
  return lines.length ? { f, label, lines } : null;
};

/* One field = one wrap-gated glue View; sectionTitle rides inside the FIRST present field's View.
   Single-name rule: field label == section title → no sub-label. Threshold 20 keeps every colonoscopy
   field (all short) as a whole glue block so no title/sub-label orphans; only truly long fields flow. */
const renderField = (model, title, isFirst) => {
  const showLabel = model.label.toLowerCase() !== title.toLowerCase();
  return (
    <View key={model.f} style={styles.fieldUnit} wrap={model.lines.length > 20 ? true : false}>
      {isFirst ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {showLabel ? <Text style={styles.fieldLabel}>{model.label}</Text> : null}
      {model.lines.map((ln, i) => {
        if (ln.kind === 'subtitle') return <Text key={i} style={styles.itemSubtitle}>{ln.text}</Text>;
        if (ln.kind === 'sublabel') return <Text key={i} style={styles.subLabel}>{ln.text}</Text>;
        return <Text key={i} style={styles.listItem}>{ln.text}</Text>;
      })}
    </View>
  );
};

const renderSection = (record, title, fields) => {
  const present = fields.map(f => buildFieldModel(record, f)).filter(Boolean);
  if (present.length === 0) return null;
  return (
    <View key={title} style={styles.section}>
      {present.map((m, fi) => renderField(m, title, fi === 0))}
    </View>
  );
};

const ColonoscopyReportsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.colonoscopy_reports) return Array.isArray(r.colonoscopy_reports) ? r.colonoscopy_reports : [r.colonoscopy_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.colonoscopy_reports) return Array.isArray(dd.colonoscopy_reports) ? dd.colonoscopy_reports : [dd.colonoscopy_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Colonoscopy Reports</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Colonoscopy Reports</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Colonoscopy Report ${idx + 1}`}</Text>
              {record.date ? <Text style={styles.recordMeta}>{formatDate(record.date)}</Text> : null}
            </View>
            {SECTION_DEFS.map(([title, fields]) => renderSection(record, title, fields))}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ColonoscopyReportsDocumentPDFTemplate;

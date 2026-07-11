/**
 * ClinicalScoresDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first unit's View (anti-orphan, 6a2d6af6).
 * Every value numbered ("1." even for singles). Numeric 0 = "not assessed" sentinel → hidden
 * (mirrors the JSX — the old PDF printed all 14 zero scores). `other` supports SCALAR values
 * (humanized key + numbered rows; >=3 comma parts split — mirrors the JSX mini-cards).
 * Collection: clinical_scores
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
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 10, color: '#000000' },
});

const FIELD_LABELS = {
  type: 'Score Type', provider: 'Provider', facility: 'Facility',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes', status: 'Status',
  TIMI: 'TIMI', GRACE: 'GRACE', HEART: 'HEART', CURB65: 'CURB-65', PESI: 'PESI', MELD: 'MELD',
  ChildPugh: 'Child-Pugh', eGFR: 'eGFR', CKDStage: 'CKD Stage', PHQ9: 'PHQ-9', GAD7: 'GAD-7',
  MMSE: 'MMSE', painScale: 'Pain Scale', ECOG: 'ECOG', Karnofsky: 'Karnofsky', MOCA: 'MoCA',
  CHA2DS2VASc: 'CHA2DS2-VASc', HASBLED: 'HAS-BLED', ASA: 'ASA', STOPBANG: 'STOP-BANG',
  Apfel: 'Apfel', RCRI: 'RCRI', NSQIP: 'NSQIP',
};
const STANDARD_SCORE_FIELDS = ['TIMI', 'GRACE', 'HEART', 'CURB65', 'PESI', 'MELD', 'ChildPugh', 'eGFR', 'CKDStage', 'PHQ9', 'GAD7', 'MMSE', 'painScale', 'ECOG', 'Karnofsky', 'MOCA'];
const OBJECT_SCORE_FIELDS = ['CHA2DS2VASc', 'HASBLED', 'ASA', 'STOPBANG', 'Apfel', 'RCRI', 'NSQIP'];

const KEY_OVERRIDES = { chf: 'CHF', cad: 'CAD', tia: 'TIA', bmi: 'BMI', osa: 'OSA', inr: 'INR', gfr: 'GFR', ecog: 'ECOG', asa: 'ASA', rcri: 'RCRI', nsqip: 'NSQIP', meld: 'MELD', timi: 'TIMI' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const lk = String(key).toLowerCase(); if (KEY_OVERRIDES[lk]) return KEY_OVERRIDES[lk]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
// Numeric 0 = "not assessed" sentinel → empty (mirrors the JSX hasVal convention)
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.some(hasVal); if (typeof v === 'object') return Object.values(v).some(hasVal); return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 months"
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
// Guarded comma split (paren-aware; "and"/"or" stays connected; no-space commas kept). Used when >= 3 parts.
const splitByComma = (text) => {
  const s = String(text || ''); const parts = []; let depth = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++; else if (c === ')') depth = Math.max(0, depth - 1);
    if (c === ',' && depth === 0 && s[i + 1] === ' ') { parts.push(cur.trim()); cur = ''; i++; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  const merged = [];
  parts.forEach(p => { if (/^(and|or)\b/i.test(p) && merged.length) merged[merged.length - 1] += ', ' + p; else merged.push(p); });
  return merged;
};

// Flatten an object into units [{label, rows}] — one unit per leaf, humanized keys, arrays as rows.
const objectUnits = (obj) => {
  const units = [];
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (!hasVal(v)) return;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) { objectUnits(v).forEach(u => units.push({ ...u, label: u.label ? `${humanizeKey(k)} ${u.label}` : humanizeKey(k) })); return; }
    if (Array.isArray(v)) { units.push({ label: humanizeKey(k), rows: v.filter(hasVal).map(fmtVal) }); return; }
    units.push({ label: humanizeKey(k), rows: [fmtVal(v)] });
  });
  return units;
};

// `other` scalar mirror of the JSX mini-cards: humanized key + rows (>=3 comma parts split).
const otherUnits = (other) => {
  const units = [];
  Object.entries(other || {}).forEach(([key, val]) => {
    if (!hasVal(val)) return;
    if (val !== null && typeof val === 'object') { objectUnits({ [key]: val }).forEach(u => units.push(u)); return; }
    const parts = typeof val === 'string' ? splitByComma(val) : [];
    units.push({ label: humanizeKey(key), rows: parts.length >= 3 ? parts : [fmtVal(val)] });
  });
  return units;
};

// section = flowing container of per-unit glue Views; sectionTitle rides inside the FIRST unit.
// Single-name rule: unit label == section title → hidden. unit.start = first row number (grouped lists).
const renderSection = (title, units) => {
  const live = (units || []).filter(u => u && u.rows && u.rows.length > 0);
  if (live.length === 0) return null;
  return (
    <View style={styles.section}>
      {live.map((u, i) => (
        <View key={i} style={styles.fieldUnit} wrap={u.rows.length + 2 > 8 ? true : false}>
          {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
          {u.label && u.label.toLowerCase() !== title.toLowerCase() ? <Text style={styles.fieldLabel}>{u.label}</Text> : null}
          {u.rows.map((r, j) => <Text key={j} style={styles.listItem}>{(u.start || 1) + j}. {r}</Text>)}
        </View>
      ))}
    </View>
  );
};

const ClinicalScoresDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.clinical_scores) return Array.isArray(r.clinical_scores) ? r.clinical_scores : [r.clinical_scores];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.clinical_scores) return Array.isArray(dd.clinical_scores) ? dd.clinical_scores : [dd.clinical_scores]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Clinical Scores</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Clinical Scores</Text></View>
        {records.map((record, idx) => {
          // recommendations: date-grouped; numbering restarts only at LABELED groups, unlabeled continues.
          const recsRaw = Array.isArray(record.recommendations) ? record.recommendations : [];
          const recItems = recsRaw.map(r => (r !== null && typeof r === 'object') ? { text: r.recommendation ?? r.text ?? r.value ?? '', date: r.date || '' } : { text: fmtVal(r), date: '' }).filter(r => hasVal(r.text));
          const recGroups = [];
          recItems.forEach(r => { const d = String(r.date || '').trim(); const last = recGroups[recGroups.length - 1]; if (last && last.date === d) last.items.push(r.text); else recGroups.push({ date: d, items: [r.text] }); });
          let running = 0;
          const recUnits = recGroups.map(g => { const start = g.date ? 1 : running + 1; running = g.date ? g.items.length : running + g.items.length; return { label: g.date ? formatDate(g.date) : null, rows: g.items, start }; });
          const notesUnits = [];
          if (hasVal(record.notes)) notesUnits.push({ label: 'Notes', rows: splitBySentence(String(record.notes)) });
          if (hasVal(record.status)) notesUnits.push({ label: 'Status', rows: [fmtVal(record.status)] });
          return (
            // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Clinical Scores ${idx + 1}`}</Text>
                {hasVal(record.date) ? <Text style={styles.recordMeta}>{formatDate(record.date)}</Text> : null}
              </View>
              {renderSection('Score Type', hasVal(record.type) ? [{ label: FIELD_LABELS.type, rows: [fmtVal(record.type)] }] : [])}
              {renderSection('Provider Information', ['provider', 'facility'].filter(f => hasVal(record[f])).map(f => ({ label: FIELD_LABELS[f], rows: [fmtVal(record[f])] })))}
              {renderSection('Standard Clinical Scores', STANDARD_SCORE_FIELDS.filter(f => hasVal(record[f])).map(f => ({ label: FIELD_LABELS[f] || f, rows: [fmtVal(record[f])] })))}
              {renderSection('Risk & Severity Scores', OBJECT_SCORE_FIELDS.filter(f => hasVal(record[f])).flatMap(f => objectUnits(record[f]).map(u => ({ ...u, label: `${FIELD_LABELS[f] || f} — ${u.label}` }))))}
              {renderSection('Clinical Scores & Biomarkers', otherUnits(record.other))}
              {renderSection('Results', hasVal(record.results) ? objectUnits(record.results) : [])}
              {renderSection('Findings', hasVal(record.findings) ? [{ label: FIELD_LABELS.findings, rows: splitBySentence(String(record.findings)) }] : [])}
              {renderSection('Assessment', hasVal(record.assessment) ? [{ label: FIELD_LABELS.assessment, rows: splitBySentence(String(record.assessment)) }] : [])}
              {renderSection('Plan', hasVal(record.plan) ? [{ label: FIELD_LABELS.plan, rows: splitBySentence(String(record.plan)) }] : [])}
              {renderSection('Recommendations', recUnits)}
              {renderSection('Notes', notesUnits)}
            </View>
          );
        })}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default ClinicalScoresDocumentPDFTemplate;

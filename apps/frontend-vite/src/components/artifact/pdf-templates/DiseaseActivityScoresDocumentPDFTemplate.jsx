/**
 * DiseaseActivityScoresDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: disease_activity_scores.
 *
 * BOX-FREE canonical (one-pass items 9-11): page 14 / title 26 / recordTitle 19 / sectionTitle 16 +
 * 1pt black rule / fieldLabel 13 + 0.5pt #999 rule / values 14. Rule #74: wrap is BOOLEAN only; each
 * field is its own glue unit; the sectionTitle rides inside the first unit. Every value row numbered.
 * break={idx>0} → one record per page. Mirrors the JSX/copy — single-name sections (assessment/notes/
 * status + the score-index objects) hide the sub-label; sentence fields expand by sentence → semicolon
 * → guarded comma. Empty sections drop.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 18, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 6 },
  recordHeader: { marginBottom: 4 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 2 },
  section: { marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 5, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldGroup: { marginBottom: 2 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2, paddingBottom: 1, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.35, color: '#000000', marginBottom: 1 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS (mirror the JSX) ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/×/g, 'x').replace(/²/g, '2')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean' || typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const formatDate = (dateValue) => { if (!dateValue) return ''; try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); } };

const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitBySemicolon = (text) => (!text || typeof text !== 'string') ? [] : text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) { const ch = text[i]; if (ch === '(') { depth++; current += ch; } else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; } else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; } else { current += ch; } }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
const splitGuardedComma = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      const noSpace = s[i + 1] !== ' ';
      let j = i + 1; while (j < s.length && s[j] === ' ') j++;
      const rest = s.slice(j); const nextChar = s[j] || '';
      const andOrAfter = /^(and|or)\b/i.test(rest);
      const andOrBefore = /\b(and|or)\s*$/i.test(cur);
      const dateComma = /\d\s*$/.test(cur) && /^\d{4}\b/.test(rest);
      const nextOk = /[A-Za-z(>]/.test(nextChar);
      if (!noSpace && !andOrAfter && !andOrBefore && !dateComma && nextOk) { const p = cur.trim(); if (p) out.push(p); cur = ''; continue; }
    }
    cur += ch;
  }
  const p = cur.trim(); if (p) out.push(p);
  return out;
};

/* sentenceLines: numbered copy/PDF lines for a sentence field (mirror formatSentenceFieldLines). */
const sentenceLines = (text) => {
  const sentences = splitBySentence(fmtVal(text));
  const lines = []; let n = 1;
  sentences.forEach(s => {
    const p = parseLabel(s);
    if (p.isLabeled) {
      const parts = splitByComma(p.value);
      lines.push(safeString(p.label) + ':');
      if (parts.length >= 2) parts.forEach(it => lines.push(`  ${n++}. ${safeString(it)}`));
      else lines.push(`  ${n++}. ${safeString(p.value)}`);
      return;
    }
    splitBySemicolon(s).forEach(part => {
      const items = splitGuardedComma(part);
      if (items.length >= 3) items.forEach(it => lines.push(`${n++}. ${safeString(it)}`));
      else lines.push(`${n++}. ${safeString(part.replace(/[;.]+$/, '').trim())}`);
    });
  });
  return lines;
};

/* ═══ UNIT BUILDERS ═══ each unit = { label, lines[] }; lines are pre-numbered strings. */
const scalarUnit = (label, val, isDate) => ({ label, lines: [`1. ${isDate ? formatDate(val) : safeString(fmtVal(val))}`] });
const objectUnits = (obj) => {
  const units = [];
  const walk = (o) => Object.entries(o).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    if (isScalar(v)) units.push({ label: humanizeKey(k), lines: [`1. ${safeString(fmtScalar(v))}`] });
    else { units.push({ label: humanizeKey(k), lines: [] }); walk(v); }
  });
  walk(obj);
  return units;
};
const recommendationsUnits = (recs) => {
  const units = []; let lastDate = null; let cur = null;
  recs.filter(r => !isEmptyDeep(r?.recommendation)).forEach(r => {
    const rec = safeString((r?.recommendation || '').trim());
    const date = (r?.date || '').trim();
    if (date !== lastDate || !cur) { cur = { label: date || null, lines: [] }; units.push(cur); lastDate = date; }
    cur.lines.push(`${cur.lines.length + 1}. ${rec}`);
  });
  return units;
};

const DiseaseActivityScoresDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.disease_activity_scores) return Array.isArray(r.disease_activity_scores) ? r.disease_activity_scores : [r.disease_activity_scores];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.disease_activity_scores) return Array.isArray(dd.disease_activity_scores) ? dd.disease_activity_scores : [dd.disease_activity_scores]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Disease Activity Scores">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Disease Activity Scores</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  const renderUnits = (title, units, keyPrefix) => units.length === 0 ? null : (
    <View style={styles.section}>
      {units.map((u, i) => (
        <View key={`${keyPrefix}-${i}`} style={styles.fieldGroup} wrap={u.lines.length > 8}>
          {i === 0 ? <Text style={styles.sectionTitle}>{title}</Text> : null}
          {u.label ? <Text style={styles.fieldLabel}>{safeString(u.label)}</Text> : null}
          {u.lines.map((ln, li) => <Text key={li} style={styles.value}>{safeString(ln)}</Text>)}
        </View>
      ))}
    </View>
  );

  const renderRecord = (record, idx) => {
    const S = [];

    const sess = [['Date', record.date, true], ['Provider', record.provider, false], ['Facility', record.facility, false]]
      .filter(([, v]) => hasVal(v)).map(([l, v, d]) => scalarUnit(l, v, d));
    if (sess.length) S.push({ title: 'Session Information', units: sess, key: 'si' });

    const ms = record.mayoScore;
    if (ms && typeof ms === 'object') {
      const mayo = [['Stool Frequency', ms.stoolFrequency], ['Rectal Bleeding', ms.rectalBleeding], ['Endoscopic Findings', ms.endoscopicFindings], ['Physician Assessment', ms.physicianAssessment], ['Total Score', ms.totalScore]]
        .filter(([, v]) => hasVal(v)).map(([l, v]) => scalarUnit(l, v, false));
      if (mayo.length) S.push({ title: 'Mayo Score', units: mayo, key: 'ms' });
    }

    // Score-index objects — single-name (section title == index name), so entries render directly.
    [['harveyBradshaw', 'Harvey-Bradshaw Index'], ['cdai', 'CDAI'], ['partialMayo', 'Partial Mayo Score'], ['simpleClinicalColitisActivity', 'Simple Clinical Colitis Activity Index'], ['pucai', 'PUCAI']].forEach(([fn, t], i) => {
      const o = record[fn];
      if (o && typeof o === 'object' && !isEmptyDeep(o)) { const u = objectUnits(o); if (u.length) S.push({ title: t, units: u, key: `idx${i}` }); }
    });

    if (hasVal(record.findings)) S.push({ title: 'Findings', units: [{ label: null, lines: sentenceLines(record.findings) }], key: 'fi' });
    if (hasVal(record.results) && !isScalar(record.results) && !isEmptyDeep(record.results)) { const u = objectUnits(record.results); if (u.length) S.push({ title: 'Results', units: u, key: 'res' }); }
    if (hasVal(record.assessment)) S.push({ title: 'Assessment', units: [{ label: null, lines: sentenceLines(record.assessment) }], key: 'as' });
    if (hasVal(record.plan)) S.push({ title: 'Plan', units: [{ label: null, lines: sentenceLines(record.plan) }], key: 'pl' });
    const recs = Array.isArray(record.recommendations) ? record.recommendations : [];
    if (recs.filter(r => !isEmptyDeep(r?.recommendation)).length) S.push({ title: 'Recommendations', units: recommendationsUnits(recs), key: 'rec' });
    if (hasVal(record.notes)) S.push({ title: 'Notes', units: [{ label: null, lines: sentenceLines(record.notes) }], key: 'nt' });
    if (hasVal(record.status)) S.push({ title: 'Status', units: [{ label: null, lines: [`1. ${safeString(fmtVal(record.status))}`] }], key: 'st' });

    return (
      <View key={idx} style={styles.recordContainer} break={idx > 0}>
        <View style={styles.recordHeader} wrap={false}>
          <Text style={styles.recordTitle}>{`Disease Activity Scores ${idx + 1}`}</Text>
        </View>
        {S.map(sec => renderUnits(sec.title, sec.units, sec.key))}
      </View>
    );
  };

  return (
    <Document title="Disease Activity Scores">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Disease Activity Scores</Text></View>
        {records.map((record, idx) => renderRecord(record, idx))}
      </Page>
    </Document>
  );
};

export default DiseaseActivityScoresDocumentPDFTemplate;

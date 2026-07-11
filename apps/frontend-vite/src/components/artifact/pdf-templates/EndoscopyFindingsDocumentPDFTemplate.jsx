import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Endoscopy Findings Document PDF Template — box-free B&W LETTER (July 2026 one-pass)
 * Mirrors the JSX SECTION_FIELDS / FIELD_LABELS / SECTION_TITLES. Flatten-under-Page
 * (record title + section field Views are DIRECT <Page> children) so a single record
 * never leaves an empty first page. Accepts merged pdfData from the inline-editing component.
 */

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 40, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 12, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, marginBottom: 16, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, marginTop: 10, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 2, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 2, marginTop: 5, marginBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  findingHeading: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2 },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.4, marginBottom: 3, paddingLeft: 4 },
  barTrack: { height: 9, backgroundColor: '#e0e0e0', borderRadius: 2, marginTop: 5, marginBottom: 2, width: '100%' },
  barFill: { height: 9, backgroundColor: '#555555', borderRadius: 2 },
  noData: { fontSize: 12, color: '#666666', marginTop: 40 },
});

/* ═══════ SCHEMA (mirrors the JSX) ═══════ */
const SECTION_ORDER = ['session-info', 'procedure-info', 'scores', 'findings-section', 'biopsies-section', 'complications-section', 'results-section', 'assessment-plan', 'recommendations-section', 'notes-section'];
const SECTION_TITLES = {
  'session-info': 'Session Information',
  'procedure-info': 'Procedure Information',
  'scores': 'Score Overview',
  'findings-section': 'Findings',
  'biopsies-section': 'Biopsies',
  'complications-section': 'Complications',
  'results-section': 'Results',
  'assessment-plan': 'Assessment & Plan',
  'recommendations-section': 'Recommendations',
  'notes-section': 'Notes',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status',
  procedureType: 'Procedure Type', extent: 'Extent',
  mayoEndoscopicScore: 'Mayo Endoscopic Score', rutgeerts: 'Rutgeerts Score',
  findings: 'Findings', 'biopsies.taken': 'Biopsies Taken', 'biopsies.locations': 'Biopsy Locations',
  complications: 'Complications', results: 'Results', assessment: 'Assessment', plan: 'Plan',
  recommendations: 'Recommendations', notes: 'Notes',
};
const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'procedure-info': ['procedureType', 'extent'],
  'scores': ['mayoEndoscopicScore', 'rutgeerts'],
  'findings-section': ['findings'],
  'biopsies-section': ['biopsies.taken', 'biopsies.locations'],
  'complications-section': ['complications'],
  'results-section': ['results'],
  'assessment-plan': ['assessment', 'plan'],
  'recommendations-section': ['recommendations'],
  'notes-section': ['notes'],
};
const SENTENCE_FIELDS = ['assessment', 'plan', 'notes'];
const DATE_FIELDS = ['date'];
const BOOLEAN_FIELDS = ['biopsies.taken'];
const STRING_ARRAY_FIELDS = ['biopsies.locations', 'complications'];
const OBJECT_FIELDS = ['results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const ENUM_FIELDS = ['status', 'procedureType'];

/* ═══════ ENUM / SCORE canonicalization (mirrors the JSX) ═══════ */
const ENUM_OPTIONS = {
  status: ['Active', 'Completed', 'Not Active'],
  procedureType: ['Colonoscopy', 'Flexible Sigmoidoscopy', 'EGD (Upper Endoscopy)', 'ERCP', 'Endoscopic Ultrasound (EUS)', 'Capsule Endoscopy', 'Enteroscopy', 'Proctoscopy'],
};
const MAYO_OPTIONS = ['0 (Normal)', '1 (Mild)', '2 (Moderate)', '3 (Severe)'];
const RUTGEERTS_OPTIONS = ['i0', 'i1', 'i2', 'i3', 'i4'];
const enumCanonical = (options, current) => { const cur = String(current ?? '').trim(); return options.find(o => o.toLowerCase() === cur.toLowerCase()) || cur; };
const canonScore = (f, val) => f === 'mayoEndoscopicScore' ? enumCanonical(MAYO_OPTIONS, val)
  : f === 'rutgeerts' ? enumCanonical(RUTGEERTS_OPTIONS, val)
  : ENUM_FIELDS.includes(f) ? enumCanonical(ENUM_OPTIONS[f] || [], val) : null;

/* ═══════ HELPERS ═══════ */
const formatDate = (dateString) => {
  if (!dateString) return '';
  try { return new Date(dateString.$date || dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return String(dateString); }
};
const getVal = (record, f) => { if (f.includes('.')) { let v = record; for (const p of f.split('.')) v = v == null ? undefined : v[p]; return v; } return record[f]; };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const extractMayoScore = (text) => { if (!text) return null; const str = String(text).toLowerCase(); const m = str.match(/^(\d)/i) || str.match(/score[:\s]*(\d)/i) || str.match(/mayo[:\s]*(\d)/i); if (m) { const s = parseInt(m[1], 10); if (s >= 0 && s <= 3) return s; } return null; };
const extractRutgeertsScore = (text) => { if (!text) return null; const str = String(text).toLowerCase(); const m = str.match(/i(\d)/i) || str.match(/(\d)/); if (m) { const s = parseInt(m[1], 10); if (s >= 0 && s <= 4) return s; } return null; };

const splitIntoSentences = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const nextCh = text[i + 1] || '';
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/\d/.test(nextCh) || /^(and|or)\b/i.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const KEY_OVERRIDES = { ef: 'EF', lvef: 'LVEF', hr: 'HR', bpm: 'BPM', gi: 'GI', ibd: 'IBD', wbc: 'WBC', rbc: 'RBC' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
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

/* sentence field → typed lines (box-free: no DASH text; sub-labels carry the underline) */
const sentenceLines = (text) => {
  const sentences = splitIntoSentences(text);
  const out = []; let n = 1;
  sentences.forEach(s => {
    const p = parseLabel(s);
    const parts = splitByComma(p.isLabeled ? p.value : s);
    if (p.isLabeled) {
      out.push({ isLabel: true, text: p.label });
      (parts.length >= 2 ? parts : [p.value]).forEach(it => out.push({ isLabel: false, text: `${n++}. ${it}` }));
    } else if (parts.length >= 2) {
      parts.forEach(it => out.push({ isLabel: false, text: `${n++}. ${it}` }));
    } else { out.push({ isLabel: false, text: `${n++}. ${s}` }); }
  });
  return out;
};
/* recursive object (results) → typed lines, numbered scalar leaves */
const objectLines = (obj) => {
  const out = [];
  const walk = (o) => {
    Object.entries(o).forEach(([k, v]) => {
      if (isEmptyDeep(v)) return;
      if (isScalar(v)) { out.push({ isLabel: true, text: humanizeKey(k) }); out.push({ isLabel: false, text: `1. ${fmtScalar(v)}` }); }
      else { out.push({ isLabel: true, text: humanizeKey(k) }); walk(v); }
    });
  };
  walk(obj);
  return out;
};

/* ═══════ FIELD RENDERERS → array of <View> (sectionTitle rides the first present field's View) ═══════ */
const renderField = (record, f, sid, idx, sectionTitle) => {
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.toLowerCase() !== (SECTION_TITLES[sid] || '').toLowerCase();
  const titleEl = sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;
  const key = `${idx}-${f}`;

  // FINDINGS — object array {location, finding, severity}, one wrap=false View per finding, stacked
  if (f === 'findings') {
    const arr = record.findings;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.map((item, i) => {
      const loc = item && item.location, finding = item && item.finding, severity = item && item.severity;
      if (!hasVal(loc) && !hasVal(finding) && !hasVal(severity)) return null;
      return (
        <View key={`${idx}-find-${i}`} wrap={false} style={styles.field}>
          {i === 0 && titleEl}
          <Text style={styles.findingHeading}>{`Finding ${i + 1}`}</Text>
          {hasVal(loc) && <Text style={styles.subLabel}>Location</Text>}
          {hasVal(loc) && <Text style={styles.fieldValue}>{`1. ${String(loc)}`}</Text>}
          {hasVal(finding) && <Text style={styles.subLabel}>Finding</Text>}
          {hasVal(finding) && <Text style={styles.fieldValue}>{`1. ${String(finding)}`}</Text>}
          {hasVal(severity) && <Text style={styles.subLabel}>Severity</Text>}
          {hasVal(severity) && <Text style={styles.fieldValue}>{`1. ${String(severity)}`}</Text>}
        </View>
      );
    }).filter(Boolean);
  }

  // SCORES — canonical value text + minimal grayscale fill bar (no text on the bar → Copy===PDF clean)
  if (f === 'mayoEndoscopicScore' || f === 'rutgeerts') {
    const raw = getVal(record, f); if (!hasVal(raw)) return null;
    const disp = canonScore(f, raw);
    const isMayo = f === 'mayoEndoscopicScore';
    const score = (isMayo ? extractMayoScore : extractRutgeertsScore)(disp);
    const maxScale = isMayo ? 3 : 4;
    const pct = score === null ? 0 : Math.max(6, (score / maxScale) * 100);
    return [(
      <View key={key} wrap={false} style={styles.field}>
        {titleEl}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{`1. ${disp}`}</Text>
        {score !== null && <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pct}%` }]} /></View>}
      </View>
    )];
  }

  // DATE
  if (DATE_FIELDS.includes(f)) {
    const val = getVal(record, f); if (!hasVal(val)) return null;
    return [(
      <View key={key} wrap={false} style={styles.field}>
        {titleEl}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{`1. ${formatDate(val)}`}</Text>
      </View>
    )];
  }

  // BOOLEAN
  if (BOOLEAN_FIELDS.includes(f)) {
    const val = getVal(record, f); if (val === null || val === undefined) return null;
    return [(
      <View key={key} wrap={false} style={styles.field}>
        {titleEl}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{`1. ${val ? 'Yes' : 'No'}`}</Text>
      </View>
    )];
  }

  // STRING ARRAY
  if (STRING_ARRAY_FIELDS.includes(f)) {
    const val = getVal(record, f); if (!Array.isArray(val) || val.length === 0) return null;
    return [(
      <View key={key} wrap={val.length > 12} style={styles.field}>
        {titleEl}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {val.map((it, i) => <Text key={i} style={styles.fieldValue}>{`${i + 1}. ${String(it)}`}</Text>)}
      </View>
    )];
  }

  // SENTENCE
  if (SENTENCE_FIELDS.includes(f)) {
    const val = getVal(record, f); if (!hasVal(val)) return null;
    const lines = sentenceLines(String(val)); if (!lines.length) return null;
    return [(
      <View key={key} wrap={lines.length > 8} style={styles.field}>
        {titleEl}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {lines.map((ln, i) => <Text key={i} style={ln.isLabel ? styles.subLabel : styles.fieldValue}>{ln.text}</Text>)}
      </View>
    )];
  }

  // OBJECT (results) — recursive
  if (OBJECT_FIELDS.includes(f)) {
    const val = getVal(record, f); if (isEmptyDeep(val) || isScalar(val)) return null;
    const lines = objectLines(val); if (!lines.length) return null;
    return [(
      <View key={key} wrap={lines.length > 10} style={styles.field}>
        {titleEl}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {lines.map((ln, i) => <Text key={i} style={ln.isLabel ? styles.subLabel : styles.fieldValue}>{ln.text}</Text>)}
      </View>
    )];
  }

  // OBJECT ARRAY (recommendations) — date-grouped, running numbering
  if (OBJECT_ARRAY_FIELDS.includes(f)) {
    const val = getVal(record, f); const recs = Array.isArray(val) ? val.filter(r => !isEmptyDeep(r)) : [];
    if (!recs.length) return null;
    const groups = [];
    recs.forEach(r => { const d = ((r && r.date) || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    let n = 1; const lines = [];
    groups.forEach(g => { if (g.date) lines.push({ isLabel: true, text: g.date }); g.items.forEach(r => lines.push({ isLabel: false, text: `${n++}. ${((r && r.recommendation) || '').trim()}` })); });
    return [(
      <View key={key} wrap={lines.length > 10} style={styles.field}>
        {titleEl}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {lines.map((ln, i) => <Text key={i} style={ln.isLabel ? styles.subLabel : styles.fieldValue}>{ln.text}</Text>)}
      </View>
    )];
  }

  // DEFAULT (enum + plain text)
  const val = getVal(record, f); if (!hasVal(val)) return null;
  const cv = canonScore(f, val);
  return [(
    <View key={key} wrap={false} style={styles.field}>
      {titleEl}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{`1. ${cv != null ? cv : fmtVal(val)}`}</Text>
    </View>
  )];
};

const EndoscopyFindingsDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (rawData) => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) {
      if (rawData.length === 0) return [];
      if (rawData[0]?.endoscopy_findings && Array.isArray(rawData[0].endoscopy_findings)) return rawData[0].endoscopy_findings;
      if (rawData[0]?._records && Array.isArray(rawData[0]._records)) return rawData[0]._records;
      if (rawData[0]?.records && Array.isArray(rawData[0].records)) return rawData[0].records;
      return rawData;
    }
    if (rawData.endoscopy_findings && Array.isArray(rawData.endoscopy_findings)) return rawData.endoscopy_findings;
    if (rawData._records && Array.isArray(rawData._records)) return rawData._records;
    if (rawData.records && Array.isArray(rawData.records)) return rawData.records;
    if (rawData.date || rawData.procedureType || rawData.findings || rawData.assessment) return [rawData];
    return [];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Endoscopy Findings</Text>
          <Text style={styles.noData}>No Endoscopy Findings data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Endoscopy Findings</Text>
        {records.flatMap((record, idx) => {
          const els = [<Text key={`rt-${idx}`} style={styles.recordTitle} break={idx > 0}>{`Endoscopy Findings ${idx + 1}`}</Text>];
          SECTION_ORDER.forEach(sid => {
            const fields = SECTION_FIELDS[sid] || [];
            const sectionViews = [];
            let firstAssigned = false;
            fields.forEach(f => {
              const views = renderField(record, f, sid, idx, firstAssigned ? null : SECTION_TITLES[sid]);
              if (views && views.length) { sectionViews.push(...views); firstAssigned = true; }
            });
            if (sectionViews.length) els.push(...sectionViews);
          });
          return els;
        })}
      </Page>
    </Document>
  );
};

export default EndoscopyFindingsDocumentPDFTemplate;

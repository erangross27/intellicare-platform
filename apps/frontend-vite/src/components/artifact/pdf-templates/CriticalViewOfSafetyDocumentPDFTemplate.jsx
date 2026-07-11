/**
 * CriticalViewOfSafetyDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER — B&W.
 * react-pdf 4.5.1: wrap = BOOLEANS; recordContainer paddingBottom only + break={idx>0} (Rule #75);
 * sectionTitle rides INSIDE the section's wrap-gated View (anti-orphan).
 * 4-area mirror of the JSX/copy: canonical splitBySentence ([;.] + abbrev guard) + guarded splitByComma;
 * comma-split fields and labeled sentences split at >=3 parts; recommendations grouped by consecutive date.
 * Collection: critical_view_of_safety
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginTop: 6, marginBottom: 4 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginTop: 4, marginBottom: 3 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 3, paddingLeft: 8, lineHeight: 1.4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const SECTION_TITLES = {
  'cvs-status': 'CVS Status',
  structures: 'Structures',
  'safety-complications': 'Safety & Complications',
  documentation: 'Documentation',
  recommendations: 'Recommendations',
};
const FIELD_LABELS = {
  achievedStatus: 'Achieved Status', calotTriangleDissected: 'Calot Triangle Dissected', twoStructuresRule: 'Two Structures Rule',
  structuresIdentified: 'Structures Identified', cysticArteryIsolated: 'Cystic Artery Isolated', cysticDuctIsolated: 'Cystic Duct Isolated', commonBileDuctCleared: 'Common Bile Duct Cleared', liverBedCleared: 'Liver Bed Cleared',
  safetySteps: 'Safety Steps', difficultiesEncountered: 'Difficulties Encountered', bailoutProcedure: 'Bailout Procedure', conversionNeeded: 'Conversion Needed', timeToAchieve: 'Time to Achieve',
  documentation: 'Documentation', recommendations: 'Recommendations',
};
const SECTION_FIELDS = {
  'cvs-status': ['achievedStatus', 'calotTriangleDissected', 'twoStructuresRule'],
  structures: ['structuresIdentified', 'cysticArteryIsolated', 'cysticDuctIsolated', 'commonBileDuctCleared', 'liverBedCleared'],
  'safety-complications': ['safetySteps', 'difficultiesEncountered', 'bailoutProcedure', 'conversionNeeded', 'timeToAchieve'],
  documentation: ['documentation'],
  recommendations: ['recommendations'],
};
const SECTION_ORDER = ['cvs-status', 'structures', 'safety-complications', 'documentation', 'recommendations'];
const COMMA_SPLIT_FIELDS = ['structuresIdentified'];
const SENTENCE_FIELDS = ['safetySteps', 'difficultiesEncountered', 'bailoutProcedure', 'documentation'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const YES_NO_FIELDS = ['achievedStatus', 'calotTriangleDissected', 'twoStructuresRule', 'cysticArteryIsolated', 'cysticDuctIsolated', 'conversionNeeded'];

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
// yes/no stored lowercase -> title-case display (mirror of the JSX dropdown labels).
const fmtYesNo = (v) => { const l = String(v ?? '').toLowerCase().trim(); if (l === 'yes') return 'Yes'; if (l === 'no') return 'No'; return fmtVal(v); };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#≥≤><%0-9-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };
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
      const t = cur.trim(); if (t) parts.push(t); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.filter(Boolean);
};

/* Build {k:'label'|'sub'|'row', t} lines for one field — the exact mirror of buildFieldLines. */
const fieldLines = (record, f) => {
  const label = FIELD_LABELS[f] || f;
  const val = record[f];
  const lines = [];
  if (OBJECT_ARRAY_FIELDS.includes(f)) {
    const recs = Array.isArray(val) ? val.filter(Boolean) : [];
    if (recs.length === 0) return lines;
    lines.push({ k: 'label', t: label });
    let lastDate = null; let n = 0;
    recs.forEach(r => {
      const rec = (r?.recommendation || '').trim();
      const date = (r?.date || '').trim();
      if (date !== lastDate) { if (date) { lines.push({ k: 'sub', t: date }); n = 0; } lastDate = date; }
      lines.push({ k: 'row', t: `${++n}. ${rec}` });
    });
    return lines;
  }
  if (!hasVal(val)) return lines;
  const displayVal = YES_NO_FIELDS.includes(f) ? fmtYesNo(val) : fmtVal(val);
  if (COMMA_SPLIT_FIELDS.includes(f)) {
    const items = splitByComma(displayVal);
    lines.push({ k: 'label', t: label });
    if (items.length >= 3) items.forEach((item, i) => lines.push({ k: 'row', t: `${i + 1}. ${item}` }));
    else lines.push({ k: 'row', t: `1. ${displayVal}` });
  } else if (SENTENCE_FIELDS.includes(f)) {
    lines.push({ k: 'label', t: label });
    let n = 0;
    splitBySentence(displayVal).forEach(s => {
      const p = parseLabel(s);
      if (p) { const ci = splitByComma(p.content); lines.push({ k: 'sub', t: p.label }); n = 0; if (ci.length >= 3) ci.forEach(c => lines.push({ k: 'row', t: `${++n}. ${c}` })); else lines.push({ k: 'row', t: `${++n}. ${p.content}` }); }
      else { const ci = splitByComma(s); if (ci.length >= 3) ci.forEach(c => lines.push({ k: 'row', t: `${++n}. ${c}` })); else lines.push({ k: 'row', t: `${++n}. ${s}` }); }
    });
  } else {
    lines.push({ k: 'label', t: label }, { k: 'row', t: `1. ${displayVal}` });
  }
  return lines;
};

const CriticalViewOfSafetyDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.critical_view_of_safety) return Array.isArray(r.critical_view_of_safety) ? r.critical_view_of_safety : [r.critical_view_of_safety];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.critical_view_of_safety) return Array.isArray(dd.critical_view_of_safety) ? dd.critical_view_of_safety : [dd.critical_view_of_safety]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Critical View of Safety</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Critical View of Safety</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Critical View of Safety ${idx + 1}`}</Text>
            </View>
            {SECTION_ORDER.map(sid => {
              const lines = (SECTION_FIELDS[sid] || []).flatMap(f => fieldLines(record, f));
              if (lines.length === 0) return null;
              return (
                <View key={sid} style={styles.section} wrap={lines.length > 20 ? true : false}>
                  <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                  {lines.map((ln, i) => ln.k === 'label'
                    ? <Text key={i} style={styles.fieldLabel}>{ln.t}</Text>
                    : ln.k === 'sub'
                      ? <Text key={i} style={styles.subLabel}>{ln.t}</Text>
                      : <Text key={i} style={styles.listItem}>{ln.t}</Text>)}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CriticalViewOfSafetyDocumentPDFTemplate;

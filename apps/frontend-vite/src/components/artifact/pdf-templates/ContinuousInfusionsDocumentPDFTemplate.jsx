/**
 * ContinuousInfusionsDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER — B&W.
 * react-pdf 4.5.1: wrap = BOOLEANS; recordContainer paddingBottom only + break={idx>0} (Rule #75);
 * sectionTitle rides INSIDE the section's wrap-gated View (anti-orphan).
 * 4-area mirror of the JSX/copy: canonical splitBySentence ([;.] + abbrev guard) + guarded splitByComma;
 * labeled sentence >=3 comma parts → sub-label + numbered rows (count restarts); labeled <3 → sub-label + "1. content";
 * unlabeled >=3 → numbered part rows (count continues); recommendations date-grouped.
 * Sections match the JSX exactly (incl. 'Vital Signs & Response' with Vital Signs / Response sub-labels).
 * Collection: continuous_infusions
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
  assessment: 'Assessment Info',
  vitalsResponse: 'Vital Signs & Response',
  interventions: 'Interventions',
  plan: 'Plan',
  recommendations: 'Recommendations',
};
const FIELD_LABELS = {
  assessmentDate: 'Assessment Date', assessmentTime: 'Assessment Time', clinicalStatus: 'Clinical Status',
  vitalSigns: 'Vital Signs', response: 'Response', interventions: 'Interventions', plan: 'Plan', recommendations: 'Recommendations',
};
const SECTION_FIELDS = {
  assessment: ['assessmentDate', 'assessmentTime', 'clinicalStatus'],
  vitalsResponse: ['vitalSigns', 'response'],
  interventions: ['interventions'],
  plan: ['plan'],
  recommendations: ['recommendations'],
};
const SECTION_ORDER = ['assessment', 'vitalsResponse', 'interventions', 'plan', 'recommendations'];
const SENTENCE_FIELDS = ['vitalSigns', 'interventions', 'response', 'plan'];
const DATE_FIELDS = ['assessmentDate'];

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
// Canonical: splits on '.' AND ';' with the abbreviation+decimal guard ("0.25 mcg" never breaks).
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#≥≤><%0-9-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };
// paren-aware; keep Oxford ", and/or"; skip no-space commas and date commas.
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

/* Build {k:'label'|'sub'|'row', t} lines for one field — the exact mirror of buildSectionCopyText. */
const fieldLines = (record, f, sectionTitle) => {
  const label = FIELD_LABELS[f] || f;
  const sameTitle = label.trim().toLowerCase() === (sectionTitle || '').trim().toLowerCase();
  const val = record[f];
  const lines = [];
  if (f === 'recommendations') {
    const arr = Array.isArray(val) ? val : [];
    if (arr.length === 0) return lines;
    const groups = {}; const order = [];
    arr.forEach(item => {
      const recText = typeof item === 'object' ? (item.recommendation || '') : String(item);
      const recDate = typeof item === 'object' && item.date ? formatDate(item.date) : '';
      const dk = recDate || 'No Date';
      if (!groups[dk]) { groups[dk] = []; order.push(dk); }
      groups[dk].push(recText);
    });
    order.forEach(dk => {
      lines.push({ k: 'sub', t: dk });
      let n = 0;
      groups[dk].forEach(rec => {
        const p = parseLabel(rec);
        if (p) { lines.push({ k: 'sub', t: p.label }, { k: 'row', t: `1. ${p.content}` }); n = 0; }
        else lines.push({ k: 'row', t: `${++n}. ${rec}` });
      });
    });
  } else if (!hasVal(val)) {
    return lines;
  } else if (SENTENCE_FIELDS.includes(f)) {
    if (!sameTitle) lines.push({ k: 'label', t: label });
    let n = 0;
    splitBySentence(fmtVal(val)).forEach(s => {
      const p = parseLabel(s);
      if (p) {
        const ci = splitByComma(p.content);
        lines.push({ k: 'sub', t: p.label }); n = 0;
        if (ci.length >= 3) ci.forEach(c => lines.push({ k: 'row', t: `${++n}. ${c}` }));
        else lines.push({ k: 'row', t: `${++n}. ${p.content}` });
      } else {
        const ci = splitByComma(s);
        if (ci.length >= 3) ci.forEach(c => lines.push({ k: 'row', t: `${++n}. ${c}` }));
        else lines.push({ k: 'row', t: `${++n}. ${s}` });
      }
    });
  } else if (DATE_FIELDS.includes(f)) {
    lines.push({ k: 'label', t: label }, { k: 'row', t: `1. ${formatDate(val)}` });
  } else {
    lines.push({ k: 'label', t: label }, { k: 'row', t: `1. ${fmtVal(val)}` });
  }
  return lines;
};

const ContinuousInfusionsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.continuous_infusions) return Array.isArray(r.continuous_infusions) ? r.continuous_infusions : [r.continuous_infusions];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.continuous_infusions) return Array.isArray(dd.continuous_infusions) ? dd.continuous_infusions : [dd.continuous_infusions]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Continuous Infusions</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Continuous Infusions</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Continuous Infusions ${idx + 1}`}</Text>
            </View>
            {SECTION_ORDER.map(sid => {
              const lines = (SECTION_FIELDS[sid] || []).flatMap(f => fieldLines(record, f, SECTION_TITLES[sid]));
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

export default ContinuousInfusionsDocumentPDFTemplate;

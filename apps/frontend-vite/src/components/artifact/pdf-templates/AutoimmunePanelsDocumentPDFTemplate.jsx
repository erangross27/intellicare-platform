/**
 * AutoimmunePanelsDocumentPDFTemplate.jsx
 * PDFDownloadLink + pdfData memo pattern, ASCII separators, Helvetica
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 24, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 8, backgroundColor: '#f0f0f0', padding: 8, borderWidth: 1, borderColor: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 4, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 4 },
  fieldBlock: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#3a3d40', marginBottom: 1 },
  fieldValue: { fontSize: 12, color: '#3a3d40', lineHeight: 1.4, paddingLeft: 12 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
  separator: { fontSize: 10, color: '#999999', marginBottom: 8, textAlign: 'center' },
  objLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, paddingLeft: 4 },
  objGroup: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#cccccc', marginBottom: 4 },
  objLeafBlock: { marginBottom: 3 },
  objLeafLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#3a3d40', marginBottom: 1 },
  objLeafValue: { fontSize: 11, color: '#3a3d40', paddingLeft: 12 },
});

const KEY_OVERRIDES = { ro: 'Anti-Ro', la: 'Anti-La', sm: 'Anti-Sm', rnp: 'Anti-RNP', scl70: 'Scl-70', jo1: 'Jo-1', antiRo: 'Anti-Ro', antiLa: 'Anti-La', antiSm: 'Anti-Sm', antiRnp: 'Anti-RNP', anticardiolipin: 'Anticardiolipin', beta2Glycoprotein: 'Beta-2-Glycoprotein', lupusAnticoagulant: 'Lupus Anticoagulant', igg: 'IgG', igm: 'IgM', iga: 'IgA', ssa: 'SSA', ssb: 'SSB', ena: 'ENA' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const splitBySentence = (t) => { if (!t || typeof t !== 'string') return []; return t.split(/(?<=[.!?])\s+|(?<=;)\s+/).filter(s => { const tr = s.trim(); return tr.length > 0 && tr.replace(/[.!?;,]+/g, '').trim().length > 0; }); };
// Paren-aware clause splitter (parity with the JSX). Splits on ';' + sentence-enders always; on a depth-0
// ',' only when includeComma AND not inside (), between digits, before a year, or before "and"/"or".
const CLAUSE_ABBREV = /(?:^|\s)(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|Lt|Capt|vs|etc|No|Fig|approx|Inc|Ltd)$/i;
const splitClauses = (text, includeComma) => {
  if (!text || typeof text !== 'string') return [{ text: text || '', sep: '' }];
  const parts = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; continue; }
    let isSep = false;
    if (depth === 0) {
      if (ch === ';') isSep = true;
      else if (ch === '.' || ch === '!' || ch === '?') { const next = text[i + 1]; if ((next === undefined || /\s/.test(next)) && !CLAUSE_ABBREV.test(current)) isSep = true; }
      else if (includeComma && ch === ',') {
        const prev = text[i - 1] || '', nx = text[i + 1] || '';
        const rest = text.slice(i + 1).trimStart();
        if (!((/\d/.test(prev) && /\d/.test(nx)) || /^\d{4}\b/.test(rest) || /^(?:and|or)\b/i.test(rest))) isSep = true;
      }
    }
    if (isSep) {
      let j = i + 1, ws = '';
      while (j < text.length && /\s/.test(text[j])) { ws += text[j]; j++; }
      const t = current.trim();
      if (t) parts.push({ text: t, sep: ch + ws });
      else if (parts.length) parts[parts.length - 1].sep += ch + ws;
      current = ''; i = j - 1;
      continue;
    }
    current += ch;
  }
  const tail = current.trim();
  if (tail) parts.push({ text: tail, sep: '' });
  return parts.length ? parts : [{ text: String(text), sep: '' }];
};

const AutoimmunePanelsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.autoimmune_panels) return Array.isArray(r.autoimmune_panels) ? r.autoimmune_panels : [r.autoimmune_panels];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.autoimmune_panels) return Array.isArray(dd.autoimmune_panels) ? dd.autoimmune_panels : [dd.autoimmune_panels]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
  const splitByComma = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/,\s*/).map(s => s.trim()).filter(s => s.length > 0); };

  // Stacked label-above-value (NEVER side-by-side "Label: value", no colon). Small/atomic → wrap={false}.
  const renderField = (label, value) => { if (!value || String(value).trim() === '') return null; return <View style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{String(value)}</Text></View>; };
  const renderSentenceField = (label, value) => { if (!value || String(value).trim() === '') return null; const ss = splitBySentence(String(value)); if (ss.length <= 1) return renderField(label, value); return <View style={styles.fieldContainer}><Text style={styles.sectionTitle}>{label}</Text>{ss.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</View>; };
  const renderLabeledCommaField = (label, value) => {
    if (!value || String(value).trim() === '') return null;
    const parsed = parseLabel(String(value));
    if (parsed.isLabeled) {
      const items = splitByComma(parsed.value);
      if (items.length > 1) {
        return (<View style={styles.fieldContainer}><Text style={styles.sectionTitle}>{label}</Text><Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, paddingLeft: 4 }}>{parsed.label}</Text>{items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>)}</View>);
      }
    }
    return renderSentenceField(label, value);
  };

  // Interpretation: own section title + numbered clause list (semicolon + guarded comma).
  const renderClauseField = (label, value, includeComma) => {
    if (!value || String(value).trim() === '') return null;
    const items = splitClauses(String(value), includeComma).map(p => p.text);
    if (items.length <= 1) return renderField(label, value);
    return <View style={styles.fieldContainer} wrap={items.length > 8}><Text style={styles.sectionTitle}>{label}</Text>{items.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</View>;
  };
  // Complement: stacked bold sub-label + numbered clause list INSIDE the Results section (never side-by-side).
  const renderClauseInline = (label, value, includeComma) => {
    if (!value || String(value).trim() === '') return null;
    const items = splitClauses(String(value), includeComma).map(p => p.text);
    if (items.length <= 1) return renderField(label, value);
    return <View style={{ marginBottom: 6 }}><Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#3a3d40', marginBottom: 3 }}>{label}</Text>{items.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</View>;
  };

  /* recursive grayscale object nodes */
  const renderObjectNodes = (value, keyPrefix) => {
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    return entries.map(([k, v]) => {
      if (isScalar(v)) return <View key={`${keyPrefix}-${k}`} style={styles.objLeafBlock} wrap={false}><Text style={styles.objLeafLabel}>{humanizeKey(k)}</Text><Text style={styles.objLeafValue}>{fmtScalar(v)}</Text></View>;
      return <View key={`${keyPrefix}-${k}`} style={styles.objGroup}><Text style={styles.objLabel}>{humanizeKey(k)}</Text>{renderObjectNodes(v, `${keyPrefix}-${k}`)}</View>;
    });
  };
  const countLeaves = (value) => { if (isEmptyDeep(value)) return 0; if (isScalar(value)) return 1; return Object.values(value).filter(v => !isEmptyDeep(v)).reduce((a, v) => a + countLeaves(v), 0); };
  const renderObjectSection = (label, value, keyPrefix) => {
    if (isEmptyDeep(value) || isScalar(value)) return null;
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const leaves = countLeaves(value);
    return (
      <View style={styles.fieldContainer} wrap={leaves > 8}>
        <Text style={styles.sectionTitle}>{label}</Text>
        {renderObjectNodes(value, keyPrefix)}
      </View>
    );
  };

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Autoimmune Panels</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Autoimmune Panels</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}><Text style={styles.recordTitle}>{`Autoimmune Panel ${idx + 1}`}</Text>{record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}</View>
            {idx > 0 && <Text style={styles.separator}>{'='.repeat(60)}</Text>}
            {(record.orderingProvider || record.lab) && <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Record Information</Text>{renderField('Ordering Provider', record.orderingProvider)}{renderField('Lab', record.lab)}</View>}
            {(record.panelType || record.indication) && <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Panel Information</Text>{renderField('Panel Type', record.panelType)}{renderField('Indication', record.indication)}</View>}
            {(record.ana || record.dsDna || record.rheumatoidFactor || record.antiCcp || record.complement || record.anca) && <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Results</Text>{renderField('ANA', record.ana)}{renderField('Anti-dsDNA', record.dsDna)}{renderField('Rheumatoid Factor', record.rheumatoidFactor)}{renderField('Anti-CCP', record.antiCcp)}{renderClauseInline('Complement', record.complement, false)}{renderField('ANCA', record.anca)}</View>}
            {renderObjectSection('ENA Panel', record.enaPanel, `ena-${idx}`)}
            {renderObjectSection('Antiphospholipid Antibodies', record.antiphospholipid, `apl-${idx}`)}
            {renderClauseField('Interpretation', record.interpretation, true)}
            {renderSentenceField('Clinical Correlation', record.clinicalCorrelation)}
            {renderLabeledCommaField('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AutoimmunePanelsDocumentPDFTemplate;

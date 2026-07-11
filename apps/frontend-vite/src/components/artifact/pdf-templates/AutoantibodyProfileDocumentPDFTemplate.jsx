/**
 * AutoantibodyProfileDocumentPDFTemplate.jsx
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
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#3a3a3a', marginBottom: 1 },
  fieldValue: { fontSize: 12, color: '#3a3a3a', lineHeight: 1.4, paddingLeft: 12 },
  listItem: { fontSize: 12, lineHeight: 1.5, paddingLeft: 12, marginBottom: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
  separator: { fontSize: 10, color: '#999999', marginBottom: 8, textAlign: 'center' },
  objLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#3a3a3a', marginTop: 4, marginBottom: 2 },
  objSubLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#3a3a3a', marginTop: 3, marginBottom: 1 },
  objValue: { fontSize: 12, lineHeight: 1.5, color: '#3a3a3a', marginBottom: 1 },
  objNested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#666666', marginTop: 2 },
  recDate: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#3a3a3a', marginTop: 4 },
});

/* recursive object node — grayscale only; label = bold heading, value = plain line */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.objSubLabel : styles.objLabel;
  if (isScalar(value)) {
    return (<View key={keyPath}>{label ? <Text style={LabelTag}>{label}</Text> : null}<Text style={styles.objValue}>{fmtScalar(value)}</Text></View>);
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (<View key={keyPath}>{label ? <Text style={LabelTag}>{label}</Text> : null}<View style={label ? styles.objNested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View></View>);
};

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const splitBySentence = (t) => { if (!t || typeof t !== 'string') return []; return t.split(/(?<=[.!?])\s+|(?<=;)\s+/).filter(s => { const tr = s.trim(); return tr.length > 0 && tr.replace(/[.!?;,]+/g, '').trim().length > 0; }); };
/* splitByComma: paren-aware comma split (fallback for single-sentence narrative). A depth-0 comma is a
   separator UNLESS inside parentheses OR the tail starts with a year OR "and"/"or" (keeps "..., and X"). */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).trimStart();
      if (/^\d{4}\b/.test(rest) || /^(?:and|or)\b/i.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const CORE_ANTIBODY_FIELDS = [['antiDsDna', 'Anti-dsDNA'], ['antiSmith', 'Anti-Smith'], ['antiSsaRo', 'Anti-SSA/Ro'], ['antiSsbLa', 'Anti-SSB/La'], ['antiRnp', 'Anti-RNP'], ['antiScl70', 'Anti-Scl-70'], ['antiCentromere', 'Anti-Centromere'], ['antiJo1', 'Anti-Jo-1'], ['antiCcp', 'Anti-CCP'], ['rheumatoidFactor', 'Rheumatoid Factor']];

const getNestedValue = (obj, path) => { if (!obj || !path) return undefined; return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj); };

const KEY_OVERRIDES = { ana: 'ANA', anca: 'ANCA', dsDna: 'dsDNA', ccp: 'CCP', rf: 'RF', igG: 'IgG', igM: 'IgM', igA: 'IgA' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const countRows = (val) => { if (isEmptyDeep(val)) return 0; if (isScalar(val)) return 1; if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; } let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n; };

const AutoantibodyProfileDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.autoantibody_profile) return Array.isArray(r.autoantibody_profile) ? r.autoantibody_profile : [r.autoantibody_profile];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.autoantibody_profile) return Array.isArray(dd.autoantibody_profile) ? dd.autoantibody_profile : [dd.autoantibody_profile]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  // Stacked label-above-value (NEVER side-by-side "Label: value", no colon). Each field is atomic.
  const renderField = (label, value, key) => {
    if (!value || (Array.isArray(value) && value.length === 0) || String(value).trim() === '') return null;
    const displayVal = typeof value === 'boolean' ? (value ? 'Positive' : 'Negative') : String(value);
    return <View key={key} style={styles.fieldBlock} wrap={false}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{displayVal}</Text></View>;
  };

  const renderSentenceField = (label, value) => {
    if (!value || String(value).trim() === '') return null;
    const sentences = splitBySentence(String(value));
    const ci = splitByComma(String(value));
    // sentence/semicolon split first; else fall back to the paren-aware comma split (and/or-guarded).
    const items = sentences.length > 1 ? sentences : (ci.length >= 2 ? ci : null);
    if (!items) return renderField(label, value);
    return <View style={styles.fieldContainer} wrap={items.length > 8}><Text style={styles.sectionTitle}>{label}</Text>{items.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {s}</Text>)}</View>;
  };

  if (!records || records.length === 0) {
    return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Autoantibody Profile</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Autoantibody Profile</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection}>
            <View wrap={false}>
              <Text style={styles.recordTitle}>{`Autoantibody Profile ${idx + 1}`}</Text>
              {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>
            {idx > 0 && <Text style={styles.separator}>{'='.repeat(60)}</Text>}

            {(record.provider || record.facility) && (
              <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Record Information</Text>
                {renderField('Provider', record.provider)}{renderField('Facility', record.facility)}{renderField('Status', record.status)}
              </View>
            )}

            {record.ana && (
              <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>ANA Panel</Text>
                {renderField('Titer', record.ana.titer)}{renderField('Pattern', record.ana.pattern)}{renderField('Positive', record.ana.positive)}
              </View>
            )}

            {CORE_ANTIBODY_FIELDS.some(([f]) => record[f]) && (
              <View style={styles.fieldContainer} wrap={CORE_ANTIBODY_FIELDS.filter(([f]) => record[f]).length > 8}><Text style={styles.sectionTitle}>Core Antibodies</Text>
                {CORE_ANTIBODY_FIELDS.map(([f, label]) => renderField(label, record[f], f))}
              </View>
            )}

            {record.antiphospholipidAntibodies && (
              <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>Antiphospholipid Antibodies</Text>
                {renderField('Anticardiolipin IgG', getNestedValue(record.antiphospholipidAntibodies, 'anticardiolipin.IgG'))}
                {renderField('Anticardiolipin IgM', getNestedValue(record.antiphospholipidAntibodies, 'anticardiolipin.IgM'))}
                {renderField('Beta-2 Glycoprotein IgG', getNestedValue(record.antiphospholipidAntibodies, 'beta2Glycoprotein.IgG'))}
                {renderField('Beta-2 Glycoprotein IgM', getNestedValue(record.antiphospholipidAntibodies, 'beta2Glycoprotein.IgM'))}
                {renderField('Lupus Anticoagulant', record.antiphospholipidAntibodies.lupusAnticoagulant)}
              </View>
            )}

            {record.anca && (
              <View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>ANCA Panel</Text>
                {renderField('c-ANCA', record.anca.cAnca)}{renderField('p-ANCA', record.anca.pAnca)}
                {renderField('Anti-PR3', record.anca.antiPr3)}{renderField('Anti-MPO', record.anca.antiMpo)}
              </View>
            )}

            {!isEmptyDeep(record.results) && (() => {
              const entries = Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v));
              if (entries.length === 0) return null;
              return entries.map(([k, v], i) => {
                const rows = countRows(v);
                return (
                  <View key={`results-${k}`} style={styles.fieldContainer} wrap={rows > 8 ? undefined : false}>
                    {i === 0 ? <Text style={styles.sectionTitle}>Results</Text> : null}
                    {renderObjectNode(humanizeKey(k), v, `results-${k}`, 1)}
                  </View>
                );
              });
            })()}

            {renderSentenceField('Findings', record.findings)}
            {renderSentenceField('Assessment', record.assessment)}
            {renderSentenceField('Plan', record.plan)}

            {Array.isArray(record.recommendations) && record.recommendations.filter(r => !isEmptyDeep(r)).length > 0 && (() => {
              const recs = record.recommendations.filter(r => !isEmptyDeep(r));
              const groups = [];
              recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
              return (
                <View style={styles.fieldContainer} wrap={recs.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {groups.map((group, gIdx) => (
                    <View key={gIdx}>
                      {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
                      {group.items.map((r, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {(r?.recommendation || '').trim()}</Text>))}
                    </View>
                  ))}
                </View>
              );
            })()}

            {renderSentenceField('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AutoantibodyProfileDocumentPDFTemplate;

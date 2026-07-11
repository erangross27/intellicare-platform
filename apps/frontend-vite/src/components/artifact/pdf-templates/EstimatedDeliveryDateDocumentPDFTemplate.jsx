/**
 * EstimatedDeliveryDateDocumentPDFTemplate.jsx
 * Box-free B&W LETTER PDF — mirrors EstimatedDeliveryDateDocument.jsx sections/labels exactly
 * (4-AREA RULE: JSX = Copy Section = Copy All = PDF). Collection: estimated_delivery_date.
 * react-pdf: wrap is BOOLEAN only; each section title rides inside its first field's wrap=false View
 * so it never orphans. Title/section/label each get a borderBottom underline (no boxes).
 * Narrative fields (method/findings/assessment/plan/notes) sentence-split ([.;]) + aggressive comma-split
 * + numbered; identity fields (provider/facility/status/gestationalAge/reliability) stay PLAIN.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20, paddingBottom: 8 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordHeader: { marginBottom: 12 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.5, marginBottom: 2, paddingLeft: 8, color: '#000000' },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  nested: { marginLeft: 10, paddingLeft: 8, marginTop: 2 },
  recDate: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, color: '#666666', borderTopWidth: 1, borderTopColor: '#000000', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

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
const KEY_OVERRIDES = { edd: 'EDD', lmp: 'LMP', ga: 'GA', crl: 'CRL', bpd: 'BPD', us: 'US', hc: 'HC', afi: 'AFI', efw: 'EFW' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* count rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{safeString(label)}</Text> : null}
        <Text style={styles.fieldValue}>{safeString(fmtScalar(value))}</Text>
      </View>
    );
  }
  if (Array.isArray(value)) {
    const items = value.filter(v => !isEmptyDeep(v));
    if (items.length === 0) return null;
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{safeString(label)}</Text> : null}
        <View style={label ? styles.nested : undefined}>{value.map((v, i) => isEmptyDeep(v) ? null : renderObjectNode(`${humanizeKey(label || 'Item')} ${i + 1}`, v, `${keyPath}-${i}`, depth + 1))}</View>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{safeString(label)}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const splitBySentenceRejoin = (text) => {
  if (!text || typeof text !== 'string') return [];
  const t = text.trim();
  if (!t) return [];
  if (/^\s*\d+[.)]\s/.test(t)) {
    return t.split(/(?<=[.)])\s+(?=\d+[.)]\s)/).map(s => s.trim()).filter(Boolean);
  }
  return splitBySentence(t);
};

const stripLeadingNum = (s) => String(s ?? '').replace(/^\s*\d+[.)]\s+/, '');

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
      const rest = text.slice(i + 1);
      const nextChar = rest.charAt(0);
      const restTrim = rest.replace(/^\s+/, '');
      if ((nextChar && /\d/.test(nextChar)) || /^(and|or|then)\b/i.test(restTrim) || /\b(and|or)$/i.test(current.trim())) {
        current += ch;
      } else {
        const t = current.trim(); if (t) result.push(t); current = '';
      }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderSentenceSection: parseLabel + comma-split for narrative fields (mirrors JSX formatSentenceFieldLines) */
const renderSentenceSection = (title, text, usePlanRejoin) => {
  if (!hasVal(text)) return null;
  const sentences = (usePlanRejoin ? splitBySentenceRejoin(fmtVal(text)) : splitBySentence(fmtVal(text))).map(s => usePlanRejoin ? stripLeadingNum(s) : s);
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    } else {
      const commaItems = splitByComma(s);
      if (commaItems.length >= 2) {
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: n++ });
      }
    }
  });

  return (
    <View style={styles.fieldBox} wrap={rows.length > 8}>
      <Text style={styles.fieldLabel}>{title}</Text>
      {rows.map((row, i) => row.type === 'subtitle'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
    </View>
  );
};

/* renderObjectSection: top-level OBJECT field (results) — per-key wrap-gated Views, title inside first */
const renderObjectSection = (title, val) => {
  if (isEmptyDeep(val) || isScalar(val)) return null;
  const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return entries.map(([k, v], i) => {
    const rows = countRows(v);
    return (
      <View key={`${title}-${k}`} style={styles.fieldBox} wrap={rows > 8}>
        {i === 0 ? <Text style={styles.sectionTitle}>{title}</Text> : null}
        {renderObjectNode(humanizeKey(k), v, `${title}-${k}`, 1)}
      </View>
    );
  });
};

/* renderRecommendationsSection: array of {recommendation, date}, date-grouped */
const renderRecommendationsSection = (title, val) => {
  const recs = Array.isArray(val) ? val.filter(r => hasVal(r?.recommendation)) : [];
  if (recs.length === 0) return null;
  const groups = [];
  recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
  return (
    <View style={styles.fieldBox} wrap={recs.length > 8}>
      <Text style={styles.fieldLabel}>{title}</Text>
      {groups.map((group, gIdx) => (
        <View key={gIdx}>
          {group.date ? <Text style={styles.recDate}>{safeString(group.date)}</Text> : null}
          {group.items.map((r, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {safeString((r?.recommendation || '').trim())}</Text>))}
        </View>
      ))}
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const EstimatedDeliveryDateDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.estimated_delivery_date) return Array.isArray(r.estimated_delivery_date) ? r.estimated_delivery_date : [r.estimated_delivery_date];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.estimated_delivery_date) return Array.isArray(dd.estimated_delivery_date) ? dd.estimated_delivery_date : [dd.estimated_delivery_date]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>Estimated Delivery Date</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Estimated Delivery Date</Text></View>

        {records.map((record, idx) => {
          const sessionFields = [
            ['date', record.date],
            ['provider', record.provider],
            ['facility', record.facility],
            ['status', record.status],
          ].filter(([, v]) => hasVal(v));

          const hasEddInfo = hasVal(record.gestationalAge) || hasVal(record.method) || hasVal(record.reliability);

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Estimated Delivery Date ${idx + 1}`}</Text>
              </View>

              {/* Session Information */}
              {sessionFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={sessionFields.length > 8}>
                    <Text style={styles.sectionTitle}>Session Information</Text>
                    {sessionFields.map(([key, val], i) => (
                      <View key={i} style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>{key === 'date' ? 'Date' : key === 'provider' ? 'Provider' : key === 'facility' ? 'Facility' : 'Status'}</Text>
                        <Text style={styles.fieldValue}>{key === 'date' ? formatDate(val) : safeString(fmtVal(val))}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* EDD Information — title glued to first present field; method is narrative (comma-split) */}
              {hasEddInfo && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>EDD Information</Text>
                    {hasVal(record.gestationalAge) && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>Gestational Age</Text>
                        <Text style={styles.fieldValue}>{safeString(fmtVal(record.gestationalAge))}</Text>
                      </View>
                    )}
                  </View>
                  {renderSentenceSection('Method', record.method)}
                  {hasVal(record.reliability) && (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Reliability</Text>
                      <Text style={styles.fieldValue}>{safeString(fmtVal(record.reliability))}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Clinical Details (narrative) */}
              {renderSentenceSection('Findings', record.findings)}
              {renderSentenceSection('Assessment', record.assessment)}
              {renderSentenceSection('Plan', record.plan, true)}

              {/* Results */}
              {renderObjectSection('Results', record.results)}

              {/* Recommendations */}
              {renderRecommendationsSection('Recommendations', record.recommendations)}

              {/* Notes */}
              {renderSentenceSection('Notes', record.notes)}
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default EstimatedDeliveryDateDocumentPDFTemplate;

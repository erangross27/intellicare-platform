/**
 * RehabilitationProtocolDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica -- LETTER size -- rehabilitation protocol
 * Collection: rehabilitation_protocol
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#000000', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  statusText: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', borderLeftStyle: 'solid', marginTop: 2 },
  recDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4 },
  phaseWrapper: { marginBottom: 12, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', borderLeftStyle: 'solid' },
  phaseTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4 },
  phaseField: { marginBottom: 4 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ═══════ OBJECT HELPERS ═══════ */
const KEY_OVERRIDES = { rom: 'ROM', cpm: 'CPM', ml: 'mL', bpm: 'BPM', hr: 'HR' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
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

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* count rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* renderObjectFieldPDF: OBJECT field as humanized key/value lines, Rule #74 wrap-gated */
const renderObjectFieldPDF = (label, val) => {
  if (!hasVal(val) || isScalar(val)) return null;
  const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  const rows = countRows(val);
  return (
    <View style={styles.fieldBox} wrap={rows > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${label}-${k}`, 1))}
    </View>
  );
};

/* renderRecommendationsPDF: array of {recommendation, date}, date-grouped numbered list */
const renderRecommendationsPDF = (label, val) => {
  const recs = Array.isArray(val) ? val.filter(r => (r?.recommendation || '').trim()) : [];
  if (recs.length === 0) return null;
  const groups = [];
  recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
  return (
    <View style={styles.fieldBox} wrap={recs.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {groups.map((group, gIdx) => (
        <View key={gIdx}>
          {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
          {group.items.map((r, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {(r?.recommendation || '').trim()}</Text>))}
        </View>
      ))}
    </View>
  );
};

/* ======= UTILS ======= */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.$date || dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};

const hasVal = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
};

const fmtVal = (v) => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  return String(v || '');
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateFieldPDF */
const renderDateFieldPDF = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split */
const renderSentenceSection = (label, text) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
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
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  const wrapProp = rows.length > 8 ? undefined : false;

  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* renderArrayFieldPDF */
const renderArrayFieldPDF = (label, items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* ======= COMPONENT ======= */
const RehabilitationProtocolDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.rehabilitation_protocol) return Array.isArray(r.rehabilitation_protocol) ? r.rehabilitation_protocol : [r.rehabilitation_protocol];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.rehabilitation_protocol) return Array.isArray(dd.rehabilitation_protocol) ? dd.rehabilitation_protocol : [dd.rehabilitation_protocol]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Rehabilitation Protocol</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Rehabilitation Protocol</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {record.date && (
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                {record.provider || `Rehabilitation Protocol ${index + 1}`}
              </Text>
              {record.status && (
                <Text style={styles.statusText}>Status: {record.status}</Text>
              )}
            </View>

            {/* General Information */}
            {(record.type || record.provider || record.facility) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>General Information</Text>
                {renderDateFieldPDF('Date', record.date)}
                {renderSentenceSection('Type', record.type)}
                {renderSentenceSection('Provider', record.provider)}
                {renderSentenceSection('Facility', record.facility)}
                {renderSentenceSection('Status', record.status)}
              </View>
            )}

            {/* Phases */}
            {record.phases && record.phases.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Rehabilitation Phases</Text>
                {record.phases.map((phase, phaseIdx) => (
                  <View key={phaseIdx} style={styles.phaseWrapper}>
                    <Text style={styles.phaseTitle}>{phase.phaseName || `Phase ${phaseIdx + 1}`}</Text>
                    {hasVal(phase.duration) && (
                      <View style={styles.phaseField}>
                        <Text style={styles.fieldLabel}>Duration</Text>
                        <Text style={styles.fieldValue}>{safeString(phase.duration)}</Text>
                      </View>
                    )}
                    {hasVal(phase.weightBearing) && (
                      <View style={styles.phaseField}>
                        <Text style={styles.fieldLabel}>Weight Bearing</Text>
                        <Text style={styles.fieldValue}>{safeString(phase.weightBearing)}</Text>
                      </View>
                    )}
                    {hasVal(phase.romGoals) && (
                      <View style={styles.phaseField}>
                        <Text style={styles.fieldLabel}>ROM Goals</Text>
                        <Text style={styles.fieldValue}>{safeString(phase.romGoals)}</Text>
                      </View>
                    )}
                    {phase.exercises && phase.exercises.length > 0 && renderArrayFieldPDF('Exercises', phase.exercises)}
                    {phase.restrictions && phase.restrictions.length > 0 && renderArrayFieldPDF('Restrictions', phase.restrictions)}
                    {phase.milestones && phase.milestones.length > 0 && renderArrayFieldPDF('Milestones', phase.milestones)}
                  </View>
                ))}
              </View>
            )}

            {/* Brace Protocol */}
            {record.braceProtocol && (record.braceProtocol.type || record.braceProtocol.settings || record.braceProtocol.duration) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Brace Protocol</Text>
                {renderSentenceSection('Brace Type', record.braceProtocol.type)}
                {renderSentenceSection('Brace Settings', record.braceProtocol.settings)}
                {renderSentenceSection('Brace Duration', record.braceProtocol.duration)}
              </View>
            )}

            {/* CPM Protocol */}
            {hasVal(record.cpmProtocol) && !isScalar(record.cpmProtocol) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>CPM Protocol</Text>
                {renderObjectFieldPDF('CPM Protocol', record.cpmProtocol)}
              </View>
            )}

            {/* Clinical Details */}
            {(record.findings || record.assessment || record.plan) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Clinical Details</Text>
                {renderSentenceSection('Findings', record.findings)}
                {renderSentenceSection('Assessment', record.assessment)}
                {renderSentenceSection('Plan', record.plan)}
              </View>
            )}

            {/* Results */}
            {hasVal(record.results) && !isScalar(record.results) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Results</Text>
                {renderObjectFieldPDF('Results', record.results)}
              </View>
            )}

            {/* Notes & Recommendations */}
            {(record.notes || (record.recommendations && record.recommendations.length > 0)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes & Recommendations</Text>
                {renderSentenceSection('Notes', record.notes)}
                {renderRecommendationsPDF('Recommendations', record.recommendations)}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default RehabilitationProtocolDocumentPDFTemplate;

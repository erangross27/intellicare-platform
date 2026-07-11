/**
 * DeepBrainStimulationDocumentPDFTemplate.jsx
 * Box-free bigger fonts (26/19/16/12/14) per checklist — LETTER B&W — new theme
 * Collection: deep_brain_stimulation
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4, textTransform: 'uppercase' },
  recordContainer: { marginBottom: 0, paddingBottom: 16 },
  recordHeader: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 12, color: '#000000', fontFamily: 'Helvetica' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', paddingBottom: 2 },
  fieldBox: { marginBottom: 6, paddingBottom: 4 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', paddingBottom: 1 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

/* ═══ UTILS ═══ */
const stripDelims = (t) => String(t || '').replace(/^[\s.;,]+/, '').replace(/[\s.;,]+$/, '').trim();

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/\u00b5m/g, 'um').replace(/\u03bcm/g, 'um').replace(/\u00b0/g, ' deg')
    .replace(/\u00b1/g, '+/-').replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->').replace(/\u201c/g, '"').replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'").replace(/\u2014/g, '-').replace(/\u2013/g, '-');
  return str;
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

const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const formatDate = (d) => {
  if (!d) return '';
  try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return String(d); }
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

/* ═══ OBJECT-FIELD HELPERS (recursive results) ═══ */
const KEY_OVERRIDES = {
  ef: 'EF', lvef: 'LVEF', bpm: 'BPM', stn: 'STN', gpi: 'GPi', vim: 'VIM',
  rightSide: 'Right Side', leftSide: 'Left Side', lastAdjustment: 'Last Adjustment',
};
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

/* objectRows: flatten object into {type, text, depth} rows for PDF */
const objectRows = (value, depth, out) => {
  if (isEmptyDeep(value)) return out;
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    if (isScalar(v)) {
      out.push({ type: 'leaf', label: humanizeKey(k), value: fmtScalar(v), depth });
    } else {
      out.push({ type: 'node', label: humanizeKey(k), depth });
      objectRows(v, depth + 1, out);
    }
  });
  return out;
};

const FIELD_LABELS = {
  date: 'Date',
  provider: 'Provider',
  facility: 'Facility',
  status: 'Status',
  target: 'Target',
  laterality: 'Laterality',
  implantDate: 'Implant Date',
  programmingSettings: 'Programming Settings',
  response: 'Response',
  complications: 'Complications',
  findings: 'Findings',
  results: 'Results',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};

/* renderFieldRow: simple label + value */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split for text fields */
const renderSentenceSection = (title, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  if (Array.isArray(text) && text.length === 0) return null;
  const strText = fmtVal(text);
  if (!strText.trim() || String(strText).trim() === '') return null;
  const sentences = splitBySentence(strText);
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
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{title}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* renderObjectSection: recursive OBJECT field (results) — flattened rows, Rule #74 wrap-gated */
const renderObjectSection = (title, value, sectionTitle) => {
  if (isEmptyDeep(value) || typeof value !== 'object') return null;
  const rows = objectRows(value, 0, []);
  if (rows.length === 0) return null;
  const wrapProp = rows.length > 8 ? undefined : false;
  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{title}</Text>
      {rows.map((row, i) => {
        const pad = { paddingLeft: 8 + row.depth * 10 };
        if (row.type === 'node') {
          return <Text key={i} style={[styles.nestedSubtitle, pad]}>{row.label}</Text>;
        }
        return <Text key={i} style={[styles.listItem, pad]}>{safeString(row.label)}: {safeString(row.value)}</Text>;
      })}
    </View>
  );
};

/* renderRecommendationsSection: array of {recommendation, date}, date-grouped header, Rule #74 wrap-gated */
const renderRecommendationsSection = (title, arr, sectionTitle) => {
  const recs = Array.isArray(arr) ? arr.filter(r => !isEmptyDeep(r)) : [];
  if (recs.length === 0) return null;
  const rows = []; let n = 1; let lastDate = null;
  recs.forEach(rec => {
    const text = (rec?.recommendation || '').trim();
    const d = (rec?.date || '').trim();
    if (!text) return;
    if (d && d !== lastDate) { rows.push({ type: 'subtitle', text: safeString(d) }); lastDate = d; }
    rows.push({ type: 'item', text: safeString(text), num: n++ });
  });
  if (rows.length === 0) return null;
  const wrapProp = rows.length > 8 ? undefined : false;
  return (
    <View style={styles.fieldBox} wrap={wrapProp}>
      {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
      <Text style={styles.fieldLabel}>{title}</Text>
      {rows.map((row, i) => {
        if (row.type === 'subtitle') return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const DeepBrainStimulationDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.deep_brain_stimulation) return Array.isArray(r.deep_brain_stimulation) ? r.deep_brain_stimulation : [r.deep_brain_stimulation];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.deep_brain_stimulation) return Array.isArray(dd.deep_brain_stimulation) ? dd.deep_brain_stimulation : [dd.deep_brain_stimulation]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Deep Brain Stimulation</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Deep Brain Stimulation</Text></View>

        {records.map((record, idx) => {
          /* Section 1: DBS Information */
          const dbsInfoFields = [
            { key: 'date', val: record.date, isDate: true },
            { key: 'provider', val: record.provider },
            { key: 'facility', val: record.facility },
            { key: 'status', val: record.status },
          ].filter(f => hasVal(f.val));

          /* Section 2: Stimulation Details */
          const stimFields = [
            { key: 'target', val: record.target },
            { key: 'laterality', val: record.laterality },
            { key: 'implantDate', val: record.implantDate, isDate: true },
          ].filter(f => hasVal(f.val));
          const hasProgSettings = record.programmingSettings && typeof record.programmingSettings === 'object' && Object.keys(record.programmingSettings).length > 0;
          const progEntries = hasProgSettings ? Object.entries(record.programmingSettings).filter(([, v]) => v !== null && v !== undefined && v !== '') : [];

          /* Section 3: Clinical Response */
          const hasResponse = hasVal(record.response);
          const complications = Array.isArray(record.complications) ? record.complications.filter(Boolean) : [];
          const hasComplications = complications.length > 0;

          /* Section 4: Findings & Results */
          const hasFindings = hasVal(record.findings);
          const hasResults = record.results && typeof record.results === 'object' && !isEmptyDeep(record.results);

          /* Section 5: Assessment & Plan — sentence fields + recommendations */
          const hasAssessment = hasVal(record.assessment);
          const hasPlan = hasVal(record.plan);
          const recommendations = Array.isArray(record.recommendations) ? record.recommendations.filter(r => !isEmptyDeep(r)) : [];
          const hasRecommendations = recommendations.length > 0;
          const hasNotes = hasVal(record.notes);

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Deep Brain Stimulation ${idx + 1}`}</Text>
              </View>

              {/* Section 1: DBS Information */}
              {dbsInfoFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={dbsInfoFields.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>DBS Information</Text>
                    {dbsInfoFields.map((f, i) => (
                      <View key={i} style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>{FIELD_LABELS[f.key]}</Text>
                        <Text style={styles.fieldValue}>{safeString(f.isDate ? formatDate(f.val) : fmtVal(f.val))}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 2: Stimulation Details */}
              {(stimFields.length > 0 || progEntries.length > 0) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={(stimFields.length + progEntries.length) > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Stimulation Details</Text>
                    {stimFields.map((f, i) => (
                      <View key={i} style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>{FIELD_LABELS[f.key]}</Text>
                        <Text style={styles.fieldValue}>{safeString(f.isDate ? formatDate(f.val) : fmtVal(f.val))}</Text>
                      </View>
                    ))}
                    {progEntries.length > 0 && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.fieldLabel}>Programming Settings</Text>
                        {progEntries.map(([k, v], pi) => (
                          <View key={pi} style={{ marginBottom: 2 }}>
                            <Text style={styles.nestedSubtitle}>{safeString(k)}</Text>
                            <Text style={styles.listItem}>{safeString(fmtVal(v))}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Section 3: Clinical Response */}
              {(hasResponse || hasComplications) && (
                <View style={styles.section}>
                  {hasResponse && renderSentenceSection('Response', record.response, 'Clinical Response')}
                  {hasComplications && (
                    <View style={styles.fieldBox} wrap={complications.length > 8 ? undefined : false}>
                      {!hasResponse && <Text style={styles.sectionTitle}>Clinical Response</Text>}
                      <Text style={styles.fieldLabel}>Complications</Text>
                      {complications.map((item, i) => (
                        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Section 4: Findings & Results */}
              {(hasFindings || hasResults) && (
                <View style={styles.section}>
                  {hasFindings && renderSentenceSection('Findings', record.findings, 'Findings & Results')}
                  {hasResults && renderObjectSection('Results', record.results, !hasFindings ? 'Findings & Results' : null)}
                </View>
              )}

              {/* Section 5: Assessment & Plan */}
              {(hasAssessment || hasPlan || hasRecommendations || hasNotes) && (
                <View style={styles.section}>
                  {hasAssessment && renderSentenceSection('Assessment', record.assessment, 'Assessment & Plan')}
                  {hasPlan && renderSentenceSection('Plan', record.plan, !hasAssessment ? 'Assessment & Plan' : null)}
                  {hasRecommendations && renderRecommendationsSection('Recommendations', recommendations, (!hasAssessment && !hasPlan) ? 'Assessment & Plan' : null)}
                  {hasNotes && renderSentenceSection('Notes', record.notes, (!hasAssessment && !hasPlan && !hasRecommendations) ? 'Assessment & Plan' : null)}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default DeepBrainStimulationDocumentPDFTemplate;

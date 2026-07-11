/**
 * EdCourseDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — parseLabel + comma-split for findings/details/notes
 * Collection: ed_course
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Box-free B&W LETTER (canonical, memory 6a2d6af6): underline rules — documentTitle 2pt / recordTitle+sectionTitle 1pt black / fieldLabel 0.5pt #999.
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { paddingBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 1.4, marginBottom: 3, paddingLeft: 8, color: '#000000' },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  nested: { marginLeft: 10, paddingLeft: 8, marginTop: 2 },
  recDate: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/\u00b5m/g, 'um').replace(/\u03bcm/g, 'um').replace(/\u00b0/g, ' deg')
    .replace(/\u00b1/g, '+/-').replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->').replace(/\u201c/g, '"').replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'").replace(/\u2014/g, '-').replace(/\u2013/g, '-');
  return str;
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
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fmtVal = (v) => { return String(v || ''); };

const KEY_OVERRIDES = { ed: 'ED', ekg: 'EKG', ecg: 'ECG', ct: 'CT', mri: 'MRI', cbc: 'CBC', bmp: 'BMP', cmp: 'CMP', wbc: 'WBC', rbc: 'RBC', bp: 'BP', hr: 'HR', rr: 'RR', spo2: 'SpO2', troponin: 'Troponin' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

/* recursive object node: label = bold heading; value = plain line below (grayscale) */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{safeString(fmtScalar(value))}</Text>
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

/* OBJECT field (results): one wrap-gated View per top-level key (Rule #74) */
const renderObjectSection = (title, val) => {
  if (!hasVal(val) || isScalar(val)) return null;
  const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return entries.map(([k, v], i) => {
    const rows = countRows(v);
    return (
      <View key={`results-${k}`} style={styles.fieldBox} wrap={rows > 8 ? undefined : false}>
        {i === 0 ? <Text style={styles.fieldLabel}>{title}</Text> : null}
        {renderObjectNode(humanizeKey(k), v, `results-${k}`, 1)}
      </View>
    );
  });
};

/* OBJECT_ARRAY field (recommendations): date-grouped numbered list, one wrap-gated View (Rule #74) */
const renderRecommendationsSection = (title, val) => {
  const recs = Array.isArray(val) ? val.filter(r => !isEmptyDeep(r)) : [];
  if (recs.length === 0) return null;
  const groups = [];
  recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
  return (
    <View style={styles.fieldBox} wrap={recs.length > 8 ? undefined : false}>
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const splitBySentence = (text) => {
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
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
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
const renderSentenceSection = (title, text) => {
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

/* ═══ COMPONENT ═══ */
const EdCourseDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.ed_course) return Array.isArray(r.ed_course) ? r.ed_course : [r.ed_course];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.ed_course) return Array.isArray(dd.ed_course) ? dd.ed_course : [dd.ed_course]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.documentTitle}>ED Course</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>ED Course</Text></View>

        {records.map((record, idx) => {
          /* Session Info fields */
          const sessionFields = [
            ['date', record.date],
            ['time', record.time],
            ['provider', record.provider],
            ['facility', record.facility],
            ['status', record.status],
          ].filter(([, v]) => hasVal(v));

          const hasEvent = hasVal(record.event);
          const hasDetails = hasVal(record.details);
          const hasFindings = hasVal(record.findings);
          const hasAssessment = hasVal(record.assessment);
          const hasPlan = hasVal(record.plan);
          const hasResults = hasVal(record.results) && !isScalar(record.results);
          const hasRecommendations = Array.isArray(record.recommendations) && record.recommendations.filter(r => !isEmptyDeep(r)).length > 0;
          const hasNotes = hasVal(record.notes);

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              {/* Record Header */}
              <View wrap={false}>
                <Text style={styles.recordTitle}>{`ED Course ${idx + 1}`}</Text>
              </View>

              {/* Session Information */}
              {sessionFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={sessionFields.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>Session Information</Text>
                    {sessionFields.map(([key, val], i) => {
                      const labelMap = { date: 'Date', time: 'Time', provider: 'Provider', facility: 'Facility', status: 'Status' };
                      return (
                        <View key={i} style={{ marginBottom: 4 }}>
                          <Text style={styles.fieldLabel}>{labelMap[key] || key}</Text>
                          <Text style={styles.fieldValue}>{key === 'date' ? formatDate(val) : safeString(fmtVal(val))}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Event */}
              {hasEvent && (
                <View style={styles.section}>
                  {renderSentenceSection('Event', record.event)}
                </View>
              )}

              {/* Details */}
              {hasDetails && (
                <View style={styles.section}>
                  {renderSentenceSection('Details', record.details)}
                </View>
              )}

              {/* Findings */}
              {hasFindings && (
                <View style={styles.section}>
                  {renderSentenceSection('Findings', record.findings)}
                </View>
              )}

              {/* Assessment */}
              {hasAssessment && (
                <View style={styles.section}>
                  {renderSentenceSection('Assessment', record.assessment)}
                </View>
              )}

              {/* Plan */}
              {hasPlan && (
                <View style={styles.section}>
                  {renderSentenceSection('Plan', record.plan)}
                </View>
              )}

              {/* Results (OBJECT) */}
              {hasResults && (
                <View style={styles.section}>
                  {renderObjectSection('Results', record.results)}
                </View>
              )}

              {/* Recommendations (OBJECT ARRAY) */}
              {hasRecommendations && (
                <View style={styles.section}>
                  {renderRecommendationsSection('Recommendations', record.recommendations)}
                </View>
              )}

              {/* Notes */}
              {hasNotes && (
                <View style={styles.section}>
                  {renderSentenceSection('Notes', record.notes)}
                </View>
              )}
            </View>
          );
        })}

      </Page>
    </Document>
  );
};

export default EdCourseDocumentPDFTemplate;

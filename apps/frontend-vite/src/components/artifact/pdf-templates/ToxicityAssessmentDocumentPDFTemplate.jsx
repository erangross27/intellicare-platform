/**
 * ToxicityAssessmentDocumentPDFTemplate.jsx
 * March 2026 -- Helvetica 20/14/12pt -- LETTER size -- US medical platform
 * Collection: toxicity_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 3, borderBottomColor: '#000000', paddingBottom: 14 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  recordContainer: { marginBottom: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordHeader: { marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderWidth: 2, borderColor: '#000000', borderLeftWidth: 5, borderLeftColor: '#000000' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  recordMeta: { fontSize: 11, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 12, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 12, lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  subLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 2 },
  nested: { marginLeft: 10 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

/* humanizeKey: dynamic object keys -> readable labels */
const KEY_OVERRIDES = { ctcae: 'CTCAE', id: 'ID' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[String(key).toLowerCase()]) return KEY_OVERRIDES[String(key).toLowerCase()];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') { if (v.$date) return false; return Object.values(v).every(isEmptyDeep); }
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); if (v && typeof v === 'object' && v.$date) return formatDate(v.$date); return String(v ?? ''); };

/* ======= UTILS ======= */
const formatDate = (d) => {
  if (!d) return '';
  try {
    const date = new Date(d.$date || d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(d); }
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
    if (ch === '(' || ch === '"' || ch === "'") { depth++; current += ch; }
    else if (ch === ')' || (depth > 0 && (ch === '"' || ch === "'"))) { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* recursive object node: label = bold heading; value = plain line below (NO inline "Label: value") */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  if (value && typeof value === 'object' && value.$date) {
    return (
      <View key={keyPath}>
        {label ? <Text style={styles.subLabel}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{formatDate(value.$date)}</Text>
      </View>
    );
  }
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  if (Array.isArray(value)) {
    const items = value.filter(x => !isEmptyDeep(x));
    if (items.length === 0) return null;
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <View style={label ? styles.nested : undefined}>
          {items.map((it, i) => isScalar(it)
            ? <Text key={i} style={styles.listItem}>{i + 1}. {fmtScalar(it)}</Text>
            : renderObjectNode('', it, `${keyPath}-${i}`, depth + 1))}
        </View>
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
  if (val && typeof val === 'object' && val.$date) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* renderObjectField: dynamic-key object -> wrap-gated Views, one per top-level key */
const renderObjectField = (label, obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const entries = Object.entries(obj).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return [];
  return entries.map(([k, v], i) => {
    const rows = countRows(v);
    return (
      <View key={`obj-${label}-${k}`} style={styles.fieldBox} wrap={rows > 8 ? undefined : false}>
        {i === 0 ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        {renderObjectNode(humanizeKey(k), v, `obj-${label}-${k}`, 1)}
      </View>
    );
  });
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: parseLabel + comma-split with sequential counter */
const renderSentenceField = (label, text, counterRef) => {
  if (!hasVal(text)) return null;
  if (typeof text !== 'string') {
    return renderFieldRow(label, text);
  }
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: counterRef.n++ }); });
      } else {
        rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
      }
    } else {
      rows.push({ type: 'item', text: safeString(s), num: counterRef.n++ });
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

/* renderArrayField */
const renderArrayField = (label, items, counterRef) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{counterRef.n++}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

const ToxicityAssessmentDocumentPDFTemplate = ({ document: data }) => {
  /* Handle data unwrapping */
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.toxicity_assessment && Array.isArray(data.toxicity_assessment)) {
    records = data.toxicity_assessment;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.toxicity_assessment) {
      records = docData.toxicity_assessment;
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Toxicity Assessment</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Toxicity Assessment</Text></View>
        {records.map((record, idx) => {
          const ctr = { n: 1 };

          return (
            <View key={idx} style={styles.recordContainer}>
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Toxicity Assessment ${idx + 1}`}</Text>
                {record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
              </View>

              {/* 1. Visit Information */}
              {(hasVal(record.date) || hasVal(record.provider) || hasVal(record.facility) || hasVal(record.status) || hasVal(record.ctcaeGrade)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Visit Information</Text>
                  {hasVal(record.date) && renderFieldRow('Date', formatDate(record.date))}
                  {renderSentenceField('Provider', record.provider, ctr)}
                  {renderSentenceField('Facility', record.facility, ctr)}
                  {renderSentenceField('Status', record.status, ctr)}
                  {renderObjectField('CTCAE Grading', record.ctcaeGrade)}
                </View>
              )}

              {/* 2. Adverse Events */}
              {Array.isArray(record.adverseEvents) && record.adverseEvents.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Adverse Events</Text>
                  {record.adverseEvents.filter(Boolean).map((ae, i) => (
                    <View key={i} style={styles.fieldBox} wrap={false}>
                      <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>{ae.event || `Event ${i + 1}`}</Text>
                      {hasVal(ae.grade) && <View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Grade</Text><Text style={styles.fieldValue}>{safeString(fmtVal(ae.grade))}</Text></View>}
                      {hasVal(ae.attribution) && <View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Attribution</Text><Text style={styles.fieldValue}>{safeString(fmtVal(ae.attribution))}</Text></View>}
                      {hasVal(ae.management) && <View style={{ marginBottom: 4 }}><Text style={styles.fieldLabel}>Management</Text><Text style={styles.fieldValue}>{safeString(fmtVal(ae.management))}</Text></View>}
                    </View>
                  ))}
                </View>
              )}

              {/* 3. Dose Management */}
              {(hasVal(record.doseModifications) || hasVal(record.treatmentDelays)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Dose Management</Text>
                  {Array.isArray(record.doseModifications) && renderArrayField('Dose Modifications', record.doseModifications, ctr)}
                  {Array.isArray(record.treatmentDelays) && renderArrayField('Treatment Delays', record.treatmentDelays, ctr)}
                </View>
              )}

              {/* 4. Supportive Measures */}
              {Array.isArray(record.supportiveCare) && record.supportiveCare.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Supportive Measures</Text>
                  {renderArrayField('Supportive Care', record.supportiveCare, ctr)}
                </View>
              )}

              {/* 5. Clinical Assessment */}
              {(hasVal(record.findings) || hasVal(record.assessment) || hasVal(record.plan) || hasVal(record.notes) || hasVal(record.recommendations) || hasVal(record.results)) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Clinical Assessment</Text>
                  {renderSentenceField('Findings', record.findings, ctr)}
                  {renderSentenceField('Assessment', record.assessment, ctr)}
                  {renderSentenceField('Plan', record.plan, ctr)}
                  {renderSentenceField('Notes', record.notes, ctr)}
                  {Array.isArray(record.recommendations) && renderArrayField('Recommendations', record.recommendations, ctr)}
                  {renderObjectField('Results', record.results)}
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default ToxicityAssessmentDocumentPDFTemplate;

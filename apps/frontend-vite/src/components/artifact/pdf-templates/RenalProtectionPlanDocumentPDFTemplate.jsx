/**
 * RenalProtectionPlanDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — renal protection plan
 * Collection: renal_protection_plan
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
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  subLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#000000', borderLeftStyle: 'solid' },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#cccccc', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
});

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
  return true;
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

/* ======= OBJECT HELPERS (results recursive renderer) ======= */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
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

/* ======= RENDER HELPERS — Rule #74 per-field wrap-gating =======
   Each returns an ARRAY of Views; each View is one wrap unit. The sectionTitle is
   rendered INSIDE the first View (isFirst), never as a standalone sibling. */
const renderStringField = (label, val, sectionTitle, isFirst) => {
  if (!hasVal(val)) return [];
  const strVal = safeString(val);
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;
  const sentences = splitBySentence(strVal);

  if (sentences.length > 1) {
    return [(
      <View key="str" style={styles.fieldBox} wrap={sentences.length > 8 ? undefined : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {sentences.map((sentence, sIdx) => {
          const parsed = parseLabel(sentence);
          if (parsed.isLabeled) {
            const commaItems = splitByComma(parsed.value);
            if (commaItems.length >= 2) {
              return (
                <View key={sIdx}>
                  <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                  {commaItems.map((ci, ciIdx) => (
                    <Text key={ciIdx} style={styles.listItem}>{ciIdx + 1}. {ci}</Text>
                  ))}
                </View>
              );
            }
            return (
              <View key={sIdx}>
                <Text style={styles.nestedSubtitle}>{parsed.label}:</Text>
                <Text style={styles.fieldValue}>{parsed.value}</Text>
              </View>
            );
          }
          return <Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>;
        })}
      </View>
    )];
  }

  return [(
    <View key="str" style={styles.fieldBox} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{strVal}</Text>
    </View>
  )];
};

const renderArrayField = (label, val, sectionTitle, isFirst) => {
  const items = Array.isArray(val) ? val.filter(Boolean) : [];
  if (items.length === 0) return [];
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;
  return [(
    <View key="arr" style={styles.fieldBox} wrap={items.length > 8 ? undefined : false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {items.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  )];
};

const renderDateField = (label, val, sectionTitle, isFirst) => {
  if (!hasVal(val)) return [];
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;
  return [(
    <View key="date" style={styles.fieldBox} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{formatDate(val)}</Text>
    </View>
  )];
};

const renderObjectField = (label, val, sectionTitle, isFirst) => {
  if (isEmptyDeep(val) || isScalar(val)) return [];
  const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return [];
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;
  /* each top-level key is its own wrap unit, gated on its row count */
  return entries.map(([k, v], i) => {
    const rows = countRows(v);
    return (
      <View key={`obj-${k}`} style={styles.fieldBox} wrap={rows > 8 ? undefined : false}>
        {i === 0 ? titleNode : null}
        {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        {renderObjectNode(humanizeKey(k), v, `${label}-${k}`, 1)}
      </View>
    );
  });
};

/* ======= COMPONENT ======= */
const RenalProtectionPlanDocumentPDFTemplate = ({ document: records = [] }) => {
  const data = Array.isArray(records) ? records : [records];

  if (!data || data.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Renal Protection Plan</Text>
          </View>
          <Text style={styles.noDataText}>No renal protection plan records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Renal Protection Plan</Text>
        </View>

        {data.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              {hasVal(record.date) && (
                <View style={styles.recordDateRow}>
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                </View>
              )}
              <Text style={styles.recordTitle}>Renal Protection Plan {idx + 1}</Text>
            </View>

            {/* 1. Provider Details — date, provider, facility (first present field carries title) */}
            {(() => {
              const fieldDefs = [
                ['date', record.date, renderDateField, 'Date'],
                ['provider', record.provider, renderStringField, 'Provider'],
                ['facility', record.facility, renderStringField, 'Facility'],
              ].filter(([, v]) => hasVal(v));
              return fieldDefs.map(([key, val, fn, label], i) => fn(label, val, 'Provider Details', i === 0).map((node, ni) => React.cloneElement(node, { key: `pd-${key}-${ni}` })));
            })()}

            {/* 2. Findings */}
            {renderStringField('Findings', record.findings, 'Findings', true).map((n, ni) => React.cloneElement(n, { key: `findings-${ni}` }))}

            {/* 3. Assessment */}
            {renderStringField('Assessment', record.assessment, 'Assessment', true).map((n, ni) => React.cloneElement(n, { key: `assessment-${ni}` }))}

            {/* 4. Hydration */}
            {renderStringField('Hydration', record.hydration, 'Hydration', true).map((n, ni) => React.cloneElement(n, { key: `hydration-${ni}` }))}

            {/* 5. Nephrotoxin Avoidance */}
            {renderArrayField('Nephrotoxin Avoidance', record.nephrotoxinAvoidance, 'Nephrotoxin Avoidance', true).map((n, ni) => React.cloneElement(n, { key: `nephro-${ni}` }))}

            {/* 6. Monitoring */}
            {renderArrayField('Monitoring', record.monitoring, 'Monitoring', true).map((n, ni) => React.cloneElement(n, { key: `monitoring-${ni}` }))}

            {/* 7. Results (object) */}
            {renderObjectField('Results', record.results, 'Results', true).map((n, ni) => React.cloneElement(n, { key: `results-${ni}` }))}

            {/* 8. Plan */}
            {renderStringField('Plan', record.plan, 'Plan', true).map((n, ni) => React.cloneElement(n, { key: `plan-${ni}` }))}

            {/* 9. Recommendations */}
            {renderArrayField('Recommendations', record.recommendations, 'Recommendations', true).map((n, ni) => React.cloneElement(n, { key: `recs-${ni}` }))}

            {/* 10. Consultations */}
            {renderStringField('Consultations', record.consultations, 'Consultations', true).map((n, ni) => React.cloneElement(n, { key: `consult-${ni}` }))}

            {/* 11. Notes & Status — first present field carries title */}
            {(() => {
              const fieldDefs = [
                ['notes', record.notes, 'Notes'],
                ['status', record.status, 'Status'],
              ].filter(([, v]) => hasVal(v));
              return fieldDefs.map(([key, val, label], i) => renderStringField(label, val, 'Notes & Status', i === 0).map((node, ni) => React.cloneElement(node, { key: `ns-${key}-${ni}` })));
            })()}

            {idx < data.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default RenalProtectionPlanDocumentPDFTemplate;

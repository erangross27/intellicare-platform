/**
 * SpondyloarthritisAssessmentDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — spondyloarthritis assessment
 * Collection: spondyloarthritis_assessment
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordDateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  recordDate: { fontSize: 11, color: '#000000', fontFamily: 'Helvetica' },
  recordTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
  fieldValue: { fontSize: 12, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 12, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
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

const splitBySemicolon = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
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

const humanizeKey = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

/* Flatten dynamic-key object for display (results). Nested objects expanded one level → no [object Object]. */
const flattenObject = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const items = [];
  Object.entries(obj).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    const label = humanizeKey(key);
    if (typeof value === 'boolean') {
      items.push({ key, label, value: value ? 'Yes' : 'No' });
    } else if (Array.isArray(value)) {
      items.push({ key, label, value: value.map(v => (v && typeof v === 'object') ? Object.values(v).join(' ') : String(v)).join(', ') });
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([subKey, subValue]) => {
        if (subValue !== null && subValue !== undefined && subValue !== '') {
          items.push({ key: `${key}.${subKey}`, label: `${label} - ${humanizeKey(subKey)}`, value: (subValue && typeof subValue === 'object') ? Object.values(subValue).join(' ') : String(subValue) });
        }
      });
    } else {
      items.push({ key, label, value: String(value) });
    }
  });
  return items;
};

const RECOMMENDATION_SUBFIELDS = [
  { key: 'recommendation', label: 'Recommendation' },
  { key: 'date', label: 'Date', isDate: true },
];

const SPINAL_MOBILITY_KEYS = ['schober', 'occiputToWall', 'chestExpansion', 'cervicalRotation'];
const SPINAL_MOBILITY_LABELS = {
  schober: 'Schober',
  occiputToWall: 'Occiput-to-Wall',
  chestExpansion: 'Chest Expansion',
  cervicalRotation: 'Cervical Rotation',
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, showLabel = true) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value, showLabel = true) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: splitBySemicolon pre-split + parseLabel + comma-split */
const renderSentenceSection = (label, text, showLabel = true) => {
  if (!hasVal(text)) return null;
  const semiItems = splitBySemicolon(fmtVal(text));
  const raw = semiItems.length >= 2 ? semiItems : splitBySentence(fmtVal(text));
  if (raw.length === 0) return null;

  const rows = [];
  let n = 1;
  raw.forEach(s => {
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
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
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
const renderArrayFieldPDF = (label, items, showLabel = true) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
      ))}
    </View>
  );
};

/* renderSpinalMobilityField: nested-subtitle + value row per key */
const renderSpinalMobilityFieldPDF = (label, obj, showLabel = true) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const activeKeys = SPINAL_MOBILITY_KEYS.filter(k => hasVal(obj[k]));
  if (activeKeys.length === 0) return null;

  return (
    <View style={styles.fieldBox}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {activeKeys.map((key, i) => {
        const keyLabel = SPINAL_MOBILITY_LABELS[key] || key;
        return (
          <View key={i}>
            <Text style={styles.nestedSubtitle}>{keyLabel}</Text>
            <Text style={styles.listItem}>{safeString(obj[key])}</Text>
          </View>
        );
      })}
    </View>
  );
};

/* renderObjectArrayFieldPDF: recommendations — {recommendation, date} objects or plain strings.
   Items flatten readable (no [object Object]); unknown keys appended so nothing is dropped. */
const renderObjectArrayFieldPDF = (label, items, showLabel = true) => {
  if (!Array.isArray(items)) return null;
  const safeItems = items.filter(it => it !== null && it !== undefined && it !== '');
  if (safeItems.length === 0) return null;
  const knownKeys = RECOMMENDATION_SUBFIELDS.map(sf => sf.key);
  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => {
        if (typeof item !== 'object' || item === null) {
          return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>;
        }
        const allDefs = [...RECOMMENDATION_SUBFIELDS, ...Object.keys(item).filter(k => !knownKeys.includes(k)).map(k => ({ key: k, label: humanizeKey(k) }))];
        const parts = allDefs.filter(sf => hasVal(item[sf.key])).map(sf => `${sf.label}: ${sf.isDate ? formatDate(item[sf.key]) : safeString(item[sf.key])}`);
        return <Text key={i} style={styles.listItem}>{i + 1}. {parts.join(' | ')}</Text>;
      })}
    </View>
  );
};

/* renderDynamicObjectFieldPDF: results — dynamic-key object → humanized label + value per leaf. */
const renderDynamicObjectFieldPDF = (label, obj, showLabel = true) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const items = flattenObject(obj);
  if (items.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={items.length > 8 ? undefined : false}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {items.map((item, i) => (
        <View key={i}>
          <Text style={styles.nestedSubtitle}>{safeString(item.label)}</Text>
          <Text style={styles.listItem}>{safeString(item.value)}</Text>
        </View>
      ))}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Record Information',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'status', label: 'Status', isSentence: true },
      { key: 'type', label: 'Type', isSentence: true },
    ],
  },
  {
    title: 'Disease Scores',
    fields: [
      { key: 'basdaiScore', label: 'BASDAI Score', isSentence: true },
      { key: 'basfiScore', label: 'BASFI Score', isSentence: true },
      { key: 'asdas', label: 'ASDAS', isSentence: true },
      { key: 'hlab27', label: 'HLA-B27', isSentence: true },
    ],
  },
  {
    title: 'Sacroiliitis',
    fields: [
      { key: 'sacroiliitis', label: 'Sacroiliitis', isSentence: true },
    ],
  },
  {
    title: 'Spinal Mobility',
    fields: [
      { key: 'spinalMobility', label: 'Spinal Mobility', isObject: true },
    ],
  },
  {
    title: 'Extra-Articular Manifestations',
    fields: [
      { key: 'enthesitis', label: 'Enthesitis', isArray: true },
      { key: 'dactylitis', label: 'Dactylitis', isArray: true },
    ],
  },
  {
    title: 'Findings',
    fields: [
      { key: 'findings', label: 'Findings', isSentence: true },
    ],
  },
  {
    title: 'Assessment',
    fields: [
      { key: 'assessment', label: 'Assessment', isSentence: true },
    ],
  },
  {
    title: 'Plan',
    fields: [
      { key: 'plan', label: 'Plan', isSentence: true },
    ],
  },
  {
    title: 'Recommendations',
    fields: [
      { key: 'recommendations', label: 'Recommendations', isObjectArray: true },
    ],
  },
  {
    title: 'Results',
    fields: [
      { key: 'results', label: 'Results', isDynamicObject: true },
    ],
  },
  {
    title: 'Notes',
    fields: [
      { key: 'notes', label: 'Notes', isSentence: true },
    ],
  },
];

/* ======= COMPONENT ======= */
const SpondyloarthritisAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.spondyloarthritis_assessment) return Array.isArray(r.spondyloarthritis_assessment) ? r.spondyloarthritis_assessment : [r.spondyloarthritis_assessment];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.spondyloarthritis_assessment) return Array.isArray(dd.spondyloarthritis_assessment) ? dd.spondyloarthritis_assessment : [dd.spondyloarthritis_assessment]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Spondyloarthritis Assessment</Text>
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
          <Text style={styles.documentTitle}>Spondyloarthritis Assessment</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header — title + first field wrap={false} */}
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {record.date && (
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>
                {`Spondyloarthritis Assessment ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => hasVal(record[f.key]));
              if (presentFields.length === 0) return null;

              /* Count total items for wrap/break decisions */
              let totalItems = presentFields.length;
              presentFields.forEach(f => {
                const v = record[f.key];
                if (Array.isArray(v)) totalItems += v.length;
                else if (typeof v === 'string') {
                  const semi = splitBySemicolon(v);
                  const s = semi.length >= 2 ? semi : splitBySentence(v);
                  if (s.length > 1) totalItems += s.length;
                }
              });

              const breakProp = totalItems >= 15 ? true : undefined;

              const renderField = (field) => {
                const val = record[field.key];
                const showFieldLabel = field.label.toLowerCase() !== sectionConfig.title.toLowerCase();
                if (field.isDate) return renderDateFieldPDF(field.label, val, showFieldLabel);
                if (field.isObjectArray) return renderObjectArrayFieldPDF(field.label, val, showFieldLabel);
                if (field.isArray) return renderArrayFieldPDF(field.label, val, showFieldLabel);
                if (field.isDynamicObject) return renderDynamicObjectFieldPDF(field.label, val, showFieldLabel);
                if (field.isObject) return renderSpinalMobilityFieldPDF(field.label, val, showFieldLabel);
                if (field.isSentence) return renderSentenceSection(field.label, val, showFieldLabel);
                return renderFieldRow(field.label, val, showFieldLabel);
              };

              return (
                <View key={sIdx} style={styles.section} break={breakProp}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {renderField(presentFields[0])}
                  </View>
                  {presentFields.slice(1).map((field, fIdx) => (
                    <View key={fIdx}>{renderField(field)}</View>
                  ))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default SpondyloarthritisAssessmentDocumentPDFTemplate;

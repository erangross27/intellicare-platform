/**
 * ProceduralSedationDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — procedural sedation
 * Collection: procedural_sedation
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
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).trimStart();
      if (/^\d{4}\b/.test(rest)) { current += ch; }
      else { const t = current.trim(); if (t) result.push(t); current = ''; }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* renderFieldRow: label + value inside fieldBox */
const renderFieldRow = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderDateField */
const renderDateFieldPDF = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{formatDate(value)}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split, with splitBySemicolon pre-split */
const renderSentenceSection = (label, text, showLabel) => {
  if (!hasVal(text)) return null;
  const strVal = fmtVal(text);

  /* splitBySemicolon pre-split before comma split */
  const scItems = splitBySemicolon(strVal);
  if (scItems.length >= 2) {
    const wrapProp = scItems.length > 8 ? undefined : false;
    return (
      <View style={styles.fieldBox} wrap={wrapProp}>
        {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
        {scItems.map((item, i) => {
          const parsed = parseLabel(item);
          if (parsed.isLabeled) {
            return (
              <React.Fragment key={i}>
                <Text style={styles.nestedSubtitle}>{safeString(parsed.label)}</Text>
                <Text style={styles.listItem}>{i + 1}. {safeString(parsed.value)}</Text>
              </React.Fragment>
            );
          }
          return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>;
        })}
      </View>
    );
  }

  const sentences = splitBySentence(strVal);
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
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((row, i) => {
        if (row.type === 'subtitle') {
          return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        }
        return <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>;
      })}
    </View>
  );
};

const humanizeKey = (key) => String(key).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase()).trim();

/* flatten an object item into a readable "Key: value, Key: value" string (no [object Object]) */
const flattenObjItem = (item) =>
  Object.entries(item).filter(([, v]) => hasVal(v)).map(([k, v]) => `${humanizeKey(k)}: ${safeString(fmtVal(v))}`).join(', ');

/* renderArrayField — items may be strings OR objects (recommendations); flatten objects readable */
const renderArrayFieldPDF = (label, items, showLabel) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.filter(hasVal);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 1}. {item && typeof item === 'object' && !Array.isArray(item) ? flattenObjItem(item) : safeString(item)}</Text>
      ))}
    </View>
  );
};

/* renderObjectFieldPDF — dynamic-key object (results), recursive, humanized keys + typed leaves */
const renderObjectFieldPDF = (label, obj, showLabel) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.entries(obj).filter(([, v]) => hasVal(v));
  if (entries.length === 0) return null;

  const rows = [];
  const walk = (o, depth) => {
    Object.entries(o).filter(([, v]) => hasVal(v)).forEach(([k, v]) => {
      const dispKey = humanizeKey(k);
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        rows.push({ type: 'subtitle', text: dispKey });
        walk(v, depth + 1);
      } else if (Array.isArray(v)) {
        rows.push({ type: 'subtitle', text: dispKey });
        v.filter(hasVal).forEach((it, i) => rows.push({ type: 'item', text: `${i + 1}. ${it && typeof it === 'object' && !Array.isArray(it) ? flattenObjItem(it) : safeString(it)}` }));
      } else {
        rows.push({ type: 'kv', key: dispKey, value: safeString(fmtVal(v)) });
      }
    });
  };
  walk(obj, 0);

  return (
    <View style={styles.fieldBox} wrap={rows.length > 8 ? undefined : false}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((row, i) => {
        if (row.type === 'subtitle') return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
        if (row.type === 'item') return <Text key={i} style={styles.listItem}>{row.text}</Text>;
        return (
          <View key={i} style={{ marginBottom: 2 }}>
            <Text style={styles.fieldValue}><Text style={styles.nestedSubtitle}>{row.key}: </Text>{row.value}</Text>
          </View>
        );
      })}
    </View>
  );
};

/* renderMedicationsPDF: array of medication objects */
const renderMedicationsPDF = (meds, showLabel) => {
  if (!Array.isArray(meds) || meds.length === 0) return null;
  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>MEDICATIONS</Text>}
      {meds.map((med, i) => {
        if (!med || typeof med !== 'object') return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(med)}</Text>;
        return (
          <React.Fragment key={i}>
            <Text style={styles.nestedSubtitle}>{safeString(med.name || `Medication ${i + 1}`)}</Text>
            {hasVal(med.dose) && <Text style={styles.listItem}>Dose: {safeString(med.dose)}</Text>}
            {hasVal(med.route) && <Text style={styles.listItem}>Route: {safeString(med.route)}</Text>}
            {hasVal(med.time) && <Text style={styles.listItem}>Time: {safeString(med.time)}</Text>}
          </React.Fragment>
        );
      })}
    </View>
  );
};

/* renderMonitoringPDF: nested object with preVitals, intraVitals, postVitals */
const renderMonitoringPDF = (mon, showLabel) => {
  if (!mon || typeof mon !== 'object' || Array.isArray(mon)) return null;
  const hasAny = (mon.preVitals && hasVal(mon.preVitals)) || (mon.intraVitals && hasVal(mon.intraVitals)) || (mon.postVitals && hasVal(mon.postVitals));
  if (!hasAny) return null;

  return (
    <View style={styles.fieldBox}>
      {showLabel !== false && <Text style={styles.fieldLabel}>MONITORING</Text>}
      {mon.preVitals && typeof mon.preVitals === 'object' && Object.keys(mon.preVitals).length > 0 && (
        <React.Fragment>
          <Text style={styles.nestedSubtitle}>Pre-Procedure Vitals</Text>
          {Object.entries(mon.preVitals).filter(([, v]) => hasVal(v)).map(([key, value], i) => {
            const formattedKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
            return <Text key={i} style={styles.listItem}>{formattedKey}: {safeString(value)}</Text>;
          })}
        </React.Fragment>
      )}
      {mon.intraVitals && Array.isArray(mon.intraVitals) && mon.intraVitals.length > 0 && (
        <React.Fragment>
          <Text style={styles.nestedSubtitle}>Intra-Procedure Monitoring</Text>
          {mon.intraVitals.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
          ))}
        </React.Fragment>
      )}
      {mon.postVitals && typeof mon.postVitals === 'object' && Object.keys(mon.postVitals).length > 0 && (
        <React.Fragment>
          <Text style={styles.nestedSubtitle}>Post-Procedure Vitals</Text>
          {Object.entries(mon.postVitals).filter(([, v]) => hasVal(v)).map(([key, value], i) => {
            const formattedKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
            return <Text key={i} style={styles.listItem}>{formattedKey}: {safeString(value)}</Text>;
          })}
        </React.Fragment>
      )}
    </View>
  );
};

/* SECTION CONFIGS */
const SECTION_CONFIGS = [
  {
    title: 'Record Information',
    fields: [
      { key: 'provider', label: 'Provider', isSentence: true },
      { key: 'facility', label: 'Facility', isSentence: true },
      { key: 'type', label: 'Type', isSentence: true },
      { key: 'status', label: 'Status', isSentence: true },
    ],
  },
  {
    title: 'Indication',
    fields: [
      { key: 'indication', label: 'Indication', isSentence: true },
    ],
  },
  {
    title: 'Medications',
    fields: [
      { key: 'medications', label: 'Medications', isMedications: true },
    ],
  },
  {
    title: 'Monitoring',
    fields: [
      { key: 'monitoring', label: 'Monitoring', isMonitoring: true },
    ],
  },
  {
    title: 'Findings & Assessment',
    fields: [
      { key: 'findings', label: 'Findings', isSentence: true },
      { key: 'assessment', label: 'Assessment', isSentence: true },
    ],
  },
  {
    title: 'Complications & Recovery',
    fields: [
      { key: 'complications', label: 'Complications', isArray: true },
      { key: 'recoveryTime', label: 'Recovery Time', isSentence: true },
    ],
  },
  {
    title: 'Plan & Recommendations',
    fields: [
      { key: 'plan', label: 'Plan', isSentence: true },
      { key: 'recommendations', label: 'Recommendations', isArray: true },
    ],
  },
  {
    title: 'Results',
    fields: [
      { key: 'results', label: 'Results', isObject: true },
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
const ProceduralSedationDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.procedural_sedation) return Array.isArray(r.procedural_sedation) ? r.procedural_sedation : [r.procedural_sedation];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.procedural_sedation) return Array.isArray(dd.procedural_sedation) ? dd.procedural_sedation : [dd.procedural_sedation]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Procedural Sedation</Text>
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
          <Text style={styles.documentTitle}>Procedural Sedation</Text>
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
                {`Procedural Sedation ${index + 1}`}
              </Text>
            </View>

            {/* Sections */}
            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const presentFields = sectionConfig.fields.filter(f => hasVal(record[f.key]));
              if (presentFields.length === 0) return null;

              const renderField = (field) => {
                const val = record[field.key];
                const showLabel = field.label.toLowerCase() !== sectionConfig.title.toLowerCase();
                if (field.isDate) return renderDateFieldPDF(field.label, val, showLabel);
                if (field.isArray) return renderArrayFieldPDF(field.label, val, showLabel);
                if (field.isMedications) return renderMedicationsPDF(val, showLabel);
                if (field.isMonitoring) return renderMonitoringPDF(val, showLabel);
                if (field.isObject) return renderObjectFieldPDF(field.label, val, showLabel);
                if (field.isSentence) return renderSentenceSection(field.label, val, showLabel);
                return renderFieldRow(field.label, val, showLabel);
              };

              return (
                <View key={sIdx} style={styles.section}>
                  {/* Title + first field together -- prevents orphaned titles */}
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>{sectionConfig.title}</Text>
                    {renderField(presentFields[0])}
                  </View>
                  {/* Remaining fields */}
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

export default ProceduralSedationDocumentPDFTemplate;

/**
 * VascularBypassSurgeryDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — vascular bypass surgery
 * Collection: vascular_bypass_surgery
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8 },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#333333', marginBottom: 2 },
  fieldValue: { fontSize: 11, lineHeight: 1.5, color: '#000000' },
  listItem: { fontSize: 11, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
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

/* formatValue: returns null ONLY for null/undefined/'' — numeric 0 and boolean false are real values (never truthiness) */
const formatValue = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  return s.replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?/g, '$1 $2');
};

const fmtVal = (v) => formatValue(v) ?? '';

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
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#:'"-]{1,80}?):\s+([\s\S]*)/);
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

/* renderGroupedRows: render subtitle/item rows as groups so a subtitle (or the
   field label) can never be orphaned from its content rows at a page break.
   - group with <=6 content rows: whole group stays together (wrap={false})
   - group with >6 content rows: subtitle + first row kept together, rest follow */
const renderGroupedRows = (rows, label, showLabel) => {
  const groups = [];
  rows.forEach(row => {
    if (row.type === 'subtitle') {
      groups.push({ subtitle: row.text, items: [] });
    } else {
      if (groups.length === 0) groups.push({ subtitle: null, items: [] });
      groups[groups.length - 1].items.push(row);
    }
  });

  const itemRow = (row, key) => (
    <Text key={key} style={styles.listItem}>{row.num}. {row.text}</Text>
  );

  return groups.map((group, gi) => {
    const head = (
      <>
        {gi === 0 && showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
        {group.subtitle !== null && <Text style={styles.nestedSubtitle}>{group.subtitle}</Text>}
      </>
    );
    if (group.items.length <= 6) {
      return (
        <View key={gi} wrap={false}>
          {head}
          {group.items.map((row, i) => itemRow(row, i))}
        </View>
      );
    }
    return (
      <View key={gi}>
        <View wrap={false}>
          {head}
          {itemRow(group.items[0], 'first')}
        </View>
        {group.items.slice(1).map((row, i) => itemRow(row, i))}
      </View>
    );
  });
};

/* renderFieldRow: label + value inside fieldBox (simple fields, booleans render Yes/No via formatValue) — unconditional wrap={false} */
const renderFieldRow = (label, value, showLabel) => {
  if (formatValue(value) === null) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: period-first splitting with semicolon fallback */
const renderSentenceField = (label, text, showLabel) => {
  if (formatValue(text) === null) return null;
  const strVal = fmtVal(text);

  const periodItems = splitBySentence(strVal);
  const isSemicolon = periodItems.length < 2;
  const sentences = isSemicolon ? splitBySemicolon(strVal) : periodItems;

  if (sentences.length < 2) {
    /* Single-value: try comma splitting */
    const commaItems = splitByComma(strVal);
    const hasOxfordComma = commaItems.some(ci => ci.trim().toLowerCase().startsWith('and '));
    if (commaItems.length >= 2 && !hasOxfordComma) {
      return (
        <View style={styles.fieldBox} wrap={commaItems.length > 8 ? undefined : false}>
          <View wrap={false}>
            {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
            <Text style={styles.listItem}>1. {safeString(commaItems[0])}</Text>
          </View>
          {commaItems.slice(1).map((ci, i) => (
            <Text key={i} style={styles.listItem}>{i + 2}. {safeString(ci)}</Text>
          ))}
        </View>
      );
    }
    return (
      <View style={styles.fieldBox} wrap={false}>
        {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.fieldValue}>{safeString(strVal)}</Text>
      </View>
    );
  }

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const semiSub = splitBySemicolon(parsed.value);
      const commaItems = semiSub.length >= 2 ? semiSub : splitByComma(parsed.value);
      const hasOxfordComma = commaItems.some(ci => ci.trim().toLowerCase().startsWith('and '));
      if (commaItems.length >= 2 && !hasOxfordComma) {
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
      {renderGroupedRows(rows, label, showLabel)}
    </View>
  );
};

/* SECTION CONFIGS — mirror JSX sections exactly (4-AREA RULE) */
const SECTION_CONFIGS = [
  {
    title: 'Provider Details',
    fields: [
      { key: 'date', label: 'Date', isDate: true },
      { key: 'provider', label: 'Provider' },
      { key: 'facility', label: 'Facility' },
    ],
  },
  {
    title: 'Graft Details',
    fields: [
      { key: 'bypassGraftType', label: 'Bypass Graft Type', isSentence: true },
      { key: 'proximalAnastomosisLocation', label: 'Proximal Anastomosis Location' },
      { key: 'distalAnastomosisLocation', label: 'Distal Anastomosis Location' },
      { key: 'graftDiameterMillimeters', label: 'Graft Diameter (mm)', hideZero: true },
      { key: 'graftLengthCentimeters', label: 'Graft Length (cm)', hideZero: true },
      { key: 'saphenousVeinDiameter', label: 'Saphenous Vein Diameter (mm)', hideZero: true },
    ],
  },
  {
    title: 'Classification & Scores',
    fields: [
      { key: 'rutherfordClassification', label: 'Rutherford Classification' },
      { key: 'wifiScore', label: 'WIfI Score' },
      { key: 'tasciilClassification', label: 'TASC II Classification' },
      { key: 'runoffScore', label: 'Runoff Score' },
      { key: 'glasgowAneurysmScore', label: 'Glasgow Aneurysm Score', hideZero: true },
    ],
  },
  {
    title: 'Hemodynamics',
    fields: [
      { key: 'preoperativeAnkleBrachialIndex', label: 'Preoperative ABI' },
      { key: 'postoperativeAnkleBrachialIndex', label: 'Postoperative ABI', hideZero: true },
      { key: 'toeBrachialIndex', label: 'Toe-Brachial Index' },
      { key: 'transcutaneousOxygenPressure', label: 'TcPO2 (mmHg)', hideZero: true },
      { key: 'intraoperativeGraftFlowRate', label: 'Intraoperative Graft Flow Rate (mL/min)', hideZero: true },
      { key: 'peakSystolicVelocityGraft', label: 'Peak Systolic Velocity - Graft (cm/s)', hideZero: true },
      { key: 'velocityRatioVr', label: 'Velocity Ratio (Vr)', hideZero: true },
    ],
  },
  {
    title: 'Operative Details',
    fields: [
      { key: 'clampTimeMinutes', label: 'Clamp Time (minutes)', hideZero: true },
      { key: 'estimatedBloodLossMilliliters', label: 'Estimated Blood Loss (mL)' },
      { key: 'completionAngiogramResult', label: 'Completion Angiogram Result', isSentence: true },
      { key: 'graftPatencyStatus', label: 'Graft Patency Status', isSentence: true },
      { key: 'limbSalvageStatus', label: 'Limb Salvage Status' },
    ],
  },
  {
    title: 'Anticoagulation Protocol',
    fields: [
      { key: 'anticoagulationProtocol', label: 'Anticoagulation Protocol', isSentence: true },
    ],
  },
];

const fieldHasVal = (record, f) => {
  const v = record[f.key];
  if (f.hideZero && v === 0) return false;
  return formatValue(v) !== null;
};

/* ======= COMPONENT ======= */
const VascularBypassSurgeryDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.vascular_bypass_surgery) return Array.isArray(r.vascular_bypass_surgery) ? r.vascular_bypass_surgery : [r.vascular_bypass_surgery];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.vascular_bypass_surgery) return Array.isArray(dd.vascular_bypass_surgery) ? dd.vascular_bypass_surgery : [dd.vascular_bypass_surgery]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Vascular Bypass Surgery</Text>
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
          <Text style={styles.documentTitle}>Vascular Bypass Surgery</Text>
        </View>

        {records.map((record, index) => {
          const recordNum = (record._originalIdx ?? index) + 1;
          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header — ONLY the numbered record title */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>
                  {`Vascular Bypass Surgery ${recordNum}`}
                </Text>
              </View>

              {/* Sections */}
              {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
                const presentFields = sectionConfig.fields.filter(f => fieldHasVal(record, f));
                if (presentFields.length === 0) return null;

                const renderField = (field) => {
                  const val = record[field.key];
                  const showLabel = field.label.toLowerCase() !== sectionConfig.title.toLowerCase();
                  if (field.isSentence) return renderSentenceField(field.label, val, showLabel);
                  if (field.isDate) return renderFieldRow(field.label, val ? formatDate(val) : val, showLabel);
                  return renderFieldRow(field.label, val, showLabel);
                };

                return (
                  <View key={sIdx} style={styles.section}>
                    {/* Title + first field together — prevents orphaned titles */}
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
          );
        })}
      </Page>
    </Document>
  );
};

export default VascularBypassSurgeryDocumentPDFTemplate;

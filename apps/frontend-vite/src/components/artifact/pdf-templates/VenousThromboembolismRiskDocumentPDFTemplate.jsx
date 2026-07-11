/**
 * VenousThromboembolismRiskDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — LETTER size — venous thromboembolism risk
 * Collection: venous_thromboembolism_risk
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
  recordDate: { fontSize: 11, color: '#333333', marginTop: 2 },
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
  const s = String(v || '');
  return s.replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?/g, '$1 $2');
};

/* arrItemText: same array-item stringification as JSX (4-AREA RULE) */
const arrItemText = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'object') return Object.values(item).filter(x => x !== null && x !== undefined && x !== '').map(String).join(' — ');
  return String(item);
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

/* renderFieldRow: label + value inside fieldBox (simple fields, booleans render Yes/No via fmtVal) — unconditional wrap={false} */
const renderFieldRow = (label, value, showLabel) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox} wrap={false}>
      {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.fieldValue}>{safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderSentenceField: period-first splitting with semicolon fallback */
const renderSentenceField = (label, text, showLabel) => {
  if (!hasVal(text)) return null;
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

/* renderArrayField (array of strings or objects — items render VERBATIM, never split: HIT warnings are clinically critical) */
const renderArrayFieldPDF = (label, items, showLabel) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const safeItems = items.map(arrItemText).filter(Boolean);
  if (safeItems.length === 0) return null;

  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8 ? undefined : false}>
      <View wrap={false}>
        {showLabel !== false && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.listItem}>1. {safeItems[0]}</Text>
      </View>
      {safeItems.slice(1).map((item, i) => (
        <Text key={i} style={styles.listItem}>{i + 2}. {item}</Text>
      ))}
    </View>
  );
};

/* SECTION CONFIGS — mirror JSX sections exactly (4-AREA RULE).
   hideZero mirrors JSX HIDE_ZERO_FIELDS: ALL 6 numerics — 0 = the score/value was
   not calculated in the source document (Wells/Padua apply to different patient contexts).
   Real decimals (e.g. obesityBmiValue 28.4, ddimerLevel 0.4) still display. */
const SECTION_CONFIGS = [
  {
    title: 'Risk Scores',
    fields: [
      { key: 'capriniScore', label: 'Caprini Score', hideZero: true },
      { key: 'capriniRiskCategory', label: 'Caprini Risk Category' },
      { key: 'wellsScore', label: 'Wells Score', hideZero: true },
      { key: 'paduaPredictionScore', label: 'Padua Prediction Score', hideZero: true },
      { key: 'bleedingRiskScore', label: 'Bleeding Risk Score', hideZero: true },
      { key: 'ddimerLevel', label: 'D-Dimer Level', hideZero: true },
    ],
  },
  {
    title: 'Risk Factors',
    fields: [
      { key: 'activeCancerPresent', label: 'Active Cancer' },
      { key: 'recentSurgeryType', label: 'Recent/Planned Surgery', isSentence: true },
      { key: 'immobilizationDuration', label: 'Immobilization Duration', isSentence: true },
      { key: 'priorVteHistory', label: 'Prior VTE History' },
      { key: 'inheritedThrombophilia', label: 'Inherited Thrombophilia', isSentence: true },
      { key: 'centralVenousCatheter', label: 'Central Venous Catheter' },
      { key: 'hormonalTherapy', label: 'Hormonal Therapy', isSentence: true },
      { key: 'pregnancyOrPostpartum', label: 'Pregnancy or Postpartum' },
      { key: 'obesityBmiValue', label: 'BMI', hideZero: true },
      { key: 'varicoseVeinsPresent', label: 'Varicose Veins' },
      { key: 'acuteInfectionSepsis', label: 'Acute Infection/Sepsis' },
      { key: 'respiratoryFailure', label: 'Respiratory Failure' },
    ],
  },
  {
    title: 'Anticoagulant Contraindications',
    fields: [
      { key: 'anticoagulantContraindications', label: 'Anticoagulant Contraindications', isArray: true },
    ],
  },
  {
    title: 'Prophylaxis Plan',
    fields: [
      { key: 'prophylaxisRecommended', label: 'Prophylaxis Recommended', isSentence: true },
      { key: 'mechanicalProphylaxisType', label: 'Mechanical Prophylaxis', isSentence: true },
      { key: 'pharmacologicAgentPrescribed', label: 'Pharmacologic Agent', isSentence: true },
      { key: 'prophylaxisDosage', label: 'Dosage & Duration', isSentence: true },
    ],
  },
  {
    title: 'Follow-Up',
    fields: [
      { key: 'reassessmentInterval', label: 'Reassessment Interval', isSentence: true },
    ],
  },
];

const fieldHasVal = (record, f) => {
  const v = record[f.key];
  if (f.hideZero && v === 0) return false;
  if (f.isArray) {
    return Array.isArray(v) && v.some(item => arrItemText(item));
  }
  return hasVal(v);
};

/* ======= COMPONENT ======= */
const VenousThromboembolismRiskDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.venous_thromboembolism_risk) return Array.isArray(r.venous_thromboembolism_risk) ? r.venous_thromboembolism_risk : [r.venous_thromboembolism_risk];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.venous_thromboembolism_risk) return Array.isArray(dd.venous_thromboembolism_risk) ? dd.venous_thromboembolism_risk : [dd.venous_thromboembolism_risk]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Venous Thromboembolism Risk</Text>
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
          <Text style={styles.documentTitle}>Venous Thromboembolism Risk</Text>
        </View>

        {records.map((record, index) => {
          const recordNum = (record._originalIdx ?? index) + 1;
          return (
            <View key={index} style={styles.recordContainer}>
              {index > 0 && <View style={styles.separator} />}

              {/* Record Header — date field is header-only in this schema: date line under the numbered record title */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>
                  {`Venous Thromboembolism Risk ${recordNum}`}
                </Text>
                {hasVal(record.date) && <Text style={styles.recordDate}>{formatDate(record.date)}</Text>}
              </View>

              {/* Sections */}
              {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
                const presentFields = sectionConfig.fields.filter(f => fieldHasVal(record, f));
                if (presentFields.length === 0) return null;

                const renderField = (field) => {
                  const val = record[field.key];
                  const showLabel = field.label.toLowerCase() !== sectionConfig.title.toLowerCase();
                  if (field.isArray) return renderArrayFieldPDF(field.label, val, showLabel);
                  if (field.isSentence) return renderSentenceField(field.label, val, showLabel);
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

export default VenousThromboembolismRiskDocumentPDFTemplate;

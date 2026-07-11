/**
 * DurableMedicalEquipmentOrdersDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — box-free B&W — Durable Medical Equipment Orders
 * Collection: durable_medical_equipment_orders
 * PDF: NO BLUE — all borders/titles use #000000. Config-driven, mirrors the JSX 4-area layout
 * (section title rides the first field, numbered values, DASH-style field labels, comma/sentence split).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center' },
  recordContainer: { paddingBottom: 16 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
});

/* ======= UTILS ======= */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
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

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

/* [.;] sentence split (mirror of the JSX splitBySentence) */
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

/* hide-zero (mirror of the JSX numberShows): an extraction-default 0 (quantity/cost) is hidden. */
const HIDE_ZERO = ['quantityOrdered', 'estimatedCostToPatient'];
const showField = (record, key, value) => {
  if (typeof value === 'boolean') return true;
  if (!hasVal(value)) return false;
  if (typeof value === 'number' && value === 0 && HIDE_ZERO.includes(key)) {
    return Array.isArray(record?.doctorEdits?.editedFields) && record.doctorEdits.editedFields.includes(key);
  }
  return true;
};

/* renderFieldRow: label + a single numbered value (mirrors Copy's "1. value") */
const renderFieldRow = (label, value, showLabel = true) => (
  <View style={styles.fieldBox} wrap={false}>
    {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
    <Text style={styles.listItem}>1. {safeString(value)}</Text>
  </View>
);

/* renderCommaFieldPDF: comma-list → one numbered row per item (mirrors JSX renderCommaField) */
const renderCommaFieldPDF = (label, text, showLabel = true) => {
  const items = splitByComma(fmtVal(text));
  if (items.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={items.length > 8}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split, numbered */
const renderSentenceSection = (label, text, showLabel = true) => {
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const commaItems = splitByComma(parsed.value);
      if (commaItems.length >= 2) {
        rows.push({ type: 'subtitle', text: safeString(parsed.label) });
        commaItems.forEach(ci => { rows.push({ type: 'item', text: safeString(ci), num: n++ }); });
      } else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    } else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
  });
  return (
    <View style={styles.fieldBox} wrap={rows.length > 8}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {rows.map((row, i) => (row.type === 'subtitle'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>))}
    </View>
  );
};

/* renderArrayFieldPDF: numbered list */
const renderArrayFieldPDF = (label, items, showLabel = true) => {
  const safeItems = (Array.isArray(items) ? items : []).filter(Boolean);
  if (safeItems.length === 0) return null;
  return (
    <View style={styles.fieldBox} wrap={safeItems.length > 8}>
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {safeItems.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}
    </View>
  );
};

/* per-field element by type (mirrors the JSX renderSection dispatch). showLabel=false for single-name
   fields (label == section title) so the label isn't printed twice. */
const renderFieldEl = (record, field, showLabel) => {
  const value = record[field.key];
  if (field.type === 'date') return renderFieldRow(field.label, formatDate(value), showLabel);
  if (field.type === 'boolean') return renderFieldRow(field.label, value ? 'Yes' : 'No', showLabel);
  if (field.type === 'currency') return renderFieldRow(field.label, `$${Number(value).toFixed(2)}`, showLabel);
  if (field.type === 'comma') return renderCommaFieldPDF(field.label, value, showLabel);
  if (field.type === 'sentence') return renderSentenceSection(field.label, value, showLabel);
  if (field.type === 'array') return renderArrayFieldPDF(field.label, value, showLabel);
  return renderFieldRow(field.label, fmtVal(value), showLabel);
};

/* SECTION CONFIGS — labels MUST mirror the JSX FIELD_LABELS exactly (4-area rule). */
const SECTION_CONFIGS = [
  { title: 'Order Information', fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'equipmentType', label: 'Equipment Type', type: 'comma' },
    { key: 'hcpcsCode', label: 'HCPCS Code' },
    { key: 'urgencyLevel', label: 'Urgency Level' },
  ] },
  { title: 'Equipment Details', fields: [
    { key: 'equipmentSpecifications', label: 'Equipment Specifications' },
    { key: 'quantityOrdered', label: 'Quantity Ordered' },
    { key: 'purchaseOrRental', label: 'Purchase or Rental' },
    { key: 'estimatedDuration', label: 'Estimated Duration' },
  ] },
  { title: 'Order Details', fields: [
    { key: 'prescribingProviderName', label: 'Prescribing Provider' },
    { key: 'prescribingProviderId', label: 'Prescribing Provider ID' },
    { key: 'orderDate', label: 'Order Date', type: 'date' },
    { key: 'faceToFaceEncounterDate', label: 'Face-to-Face Encounter Date', type: 'date' },
  ] },
  { title: 'Medical Necessity', fields: [
    { key: 'medicalNecessityJustification', label: 'Medical Necessity Justification', type: 'sentence' },
  ] },
  { title: 'Functional Limitations', fields: [
    { key: 'functionalLimitations', label: 'Functional Limitations', type: 'array' },
  ] },
  { title: 'Diagnosis Codes', fields: [
    { key: 'diagnosisCodesSupporting', label: 'Diagnosis Codes', type: 'array' },
  ] },
  { title: 'Insurance & Authorization', fields: [
    { key: 'insurancePayerName', label: 'Insurance Payer' },
    { key: 'priorAuthorizationRequired', label: 'Prior Authorization Required', type: 'boolean' },
    { key: 'priorAuthorizationNumber', label: 'Prior Authorization Number' },
    { key: 'estimatedCostToPatient', label: 'Estimated Cost to Patient', type: 'currency' },
  ] },
  { title: 'Supplier & Delivery', fields: [
    { key: 'supplierName', label: 'Supplier Name' },
    { key: 'supplierNpi', label: 'Supplier NPI' },
    { key: 'deliveryAddress', label: 'Delivery Address' },
    { key: 'deliveryInstructions', label: 'Delivery Instructions', type: 'sentence' },
  ] },
  { title: 'Compliance & Setup', fields: [
    { key: 'setupAndTrainingRequired', label: 'Setup & Training Required', type: 'boolean' },
    { key: 'complianceMonitoringRequired', label: 'Compliance Monitoring Required', type: 'boolean' },
    { key: 'replacementIndicator', label: 'Replacement Indicator', type: 'boolean' },
  ] },
];

/* ======= COMPONENT ======= */
const DurableMedicalEquipmentOrdersDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.durable_medical_equipment_orders) return Array.isArray(r.durable_medical_equipment_orders) ? r.durable_medical_equipment_orders : [r.durable_medical_equipment_orders];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.durable_medical_equipment_orders) return Array.isArray(dd.durable_medical_equipment_orders) ? dd.durable_medical_equipment_orders : [dd.durable_medical_equipment_orders]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Durable Medical Equipment Orders</Text>
          </View>
          <Text style={styles.noDataText}>No durable medical equipment orders available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Durable Medical Equipment Orders</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer} break={index > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`DME Order ${index + 1}`}</Text>
            </View>

            {SECTION_CONFIGS.map((sectionConfig, sIdx) => {
              const hasAnyVal = sectionConfig.fields.some(f => showField(record, f.key, record[f.key]));
              if (!hasAnyVal) return null;

              return (
                <View key={sIdx} style={styles.section}>
                  {(() => { let _t = false; return sectionConfig.fields.map((field, fIdx) => {
                    if (!showField(record, field.key, record[field.key])) return null;
                    const _first = !_t; _t = true;
                    // single-name rule: field label == section title → don't print the field label (title serves)
                    const _sl = field.label.toLowerCase() !== sectionConfig.title.toLowerCase();
                    const _el = renderFieldEl(record, field, _sl);
                    if (_first) return <View key={fIdx} wrap={false}><Text style={styles.sectionTitle}>{sectionConfig.title}</Text>{_el}</View>;
                    return <View key={fIdx}>{_el}</View>;
                  }); })()}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default DurableMedicalEquipmentOrdersDocumentPDFTemplate;

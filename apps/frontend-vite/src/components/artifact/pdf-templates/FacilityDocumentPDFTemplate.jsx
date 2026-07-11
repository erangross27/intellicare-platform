/**
 * FacilityDocumentPDFTemplate.jsx
 * Box-free B&W LETTER PDF — config-driven, mirrors FacilityDocument.jsx sections/labels exactly
 * (4-AREA RULE: JSX = Copy Section = Copy All = PDF). Collection: facility.
 * react-pdf: wrap is BOOLEAN only; each section glues its title to the first field so it never orphans.
 * All 10 capacity/equipment COUNTS hide a stored 0 (= "not recorded" extractor sentinel — mirror JSX).
 * Enums (trauma level, NICU level, teaching status) render canonical casing. String fields split on
 * [.;] + guarded comma-split ONLY when multi-sentence (mirror JSX renderStringField). NO date in this
 * schema (createdAt is an ingestion timestamp, NEVER rendered) — record header is the numbered title.
 * Title / section title / field label get borderBottom underlines.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  fieldBox: { marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, color: '#000000', lineHeight: 1.5 },
  listItem: { fontSize: 14, color: '#000000', lineHeight: 1.5, marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  noData: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 10, color: '#666666', borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

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
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      const nextChar = rest.charAt(0);
      const restTrim = rest.replace(/^\s+/, '');
      if ((nextChar && /\d/.test(nextChar)) || /^(and|or|then)\b/i.test(restTrim) || /\b(and|or)$/i.test(current.trim())) {
        current += ch;
      } else {
        const t = current.trim(); if (t) result.push(t); current = '';
      }
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* Numeric capacity/equipment COUNT fields — 0 = "not recorded" sentinel → hidden (mirror JSX). */
const NUMBER_FIELDS = ['bedCapacity', 'icuBeds', 'erBeds', 'operatingRooms', 'dialysisCapacity', 'helipads', 'catheterizationLabs', 'mriUnits', 'ctScanners', 'linearAccelerators'];

/* Enum canonical casing (mirror JSX ENUM_OPTIONS/enumCanonical). */
const ENUM_OPTIONS = {
  traumaLevel: ['Level I', 'Level II', 'Level III', 'Level IV', 'Level V'],
  nicuLevel: ['Level I', 'Level II', 'Level III', 'Level IV'],
  teachingStatus: ['Teaching', 'Non-Teaching'],
};
const enumCanonical = (fn, v) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const hit = (ENUM_OPTIONS[fn] || []).find(o => o.toLowerCase() === s.toLowerCase());
  return hit || (s.charAt(0).toUpperCase() + s.slice(1));
};

/* buildRows: multi-sentence string → numbered rows (parseLabel sub-heading + guarded comma-split). */
const buildRows = (items) => {
  const rows = []; let n = 1;
  items.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      if (parts.length >= 2) { rows.push({ type: 'sub', text: safeString(parsed.label) }); parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    } else {
      const parts = splitByComma(s);
      if (parts.length >= 2) { parts.forEach(p => rows.push({ type: 'item', text: safeString(p), num: n++ })); }
      else { rows.push({ type: 'item', text: safeString(s), num: n++ }); }
    }
  });
  return rows;
};

const renderRowsBlock = (label, rows, key) => {
  if (rows.length === 0) return null;
  return (
    <View key={key} style={styles.fieldBox} wrap={rows.length > 8}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {rows.map((row, i) => row.type === 'sub'
        ? <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>
        : <Text key={i} style={styles.listItem}>{row.num}. {row.text}</Text>)}
    </View>
  );
};

/* SECTION CONFIGS — mirror the JSX SECTION_TITLES / SECTION_FIELDS / FIELD_LABELS exactly. */
const SECTION_CONFIGS = [
  { title: 'General Information', fields: [
    { key: 'facilityName', label: 'Facility Name', type: 'string' },
    { key: 'npiNumber', label: 'NPI Number', type: 'string' },
    { key: 'facilityType', label: 'Facility Type', type: 'string' },
    { key: 'accreditationStatus', label: 'Accreditation Status', type: 'string' },
    { key: 'cmsProviderNumber', label: 'CMS Provider Number', type: 'string' },
    { key: 'traumaLevel', label: 'Trauma Level', type: 'enum' },
    { key: 'teachingStatus', label: 'Teaching Status', type: 'enum' },
    { key: 'emergencyServiceLevel', label: 'Emergency Service Level', type: 'string' },
    { key: 'nicuLevel', label: 'NICU Level', type: 'enum' },
  ] },
  { title: 'Capacity', fields: [
    { key: 'bedCapacity', label: 'Bed Capacity', type: 'number' },
    { key: 'icuBeds', label: 'ICU Beds', type: 'number' },
    { key: 'erBeds', label: 'ER Beds', type: 'number' },
    { key: 'operatingRooms', label: 'Operating Rooms', type: 'number' },
    { key: 'dialysisCapacity', label: 'Dialysis Capacity', type: 'number' },
    { key: 'helipads', label: 'Helipads', type: 'number' },
  ] },
  { title: 'Designations & Certifications', fields: [
    { key: 'magnetDesignation', label: 'Magnet Designation', type: 'bool' },
    { key: 'primaryStrokeCenter', label: 'Primary Stroke Center', type: 'bool' },
    { key: 'chestPainCenter', label: 'Chest Pain Center', type: 'bool' },
    { key: 'cancerProgramAccreditation', label: 'Cancer Program Accreditation', type: 'string' },
  ] },
  { title: 'Services & Equipment', fields: [
    { key: 'specialtyServices', label: 'Specialty Services', type: 'array' },
    { key: 'catheterizationLabs', label: 'Catheterization Labs', type: 'number' },
    { key: 'mriUnits', label: 'MRI Units', type: 'number' },
    { key: 'ctScanners', label: 'CT Scanners', type: 'number' },
    { key: 'linearAccelerators', label: 'Linear Accelerators', type: 'number' },
  ] },
];

const isPresent = (record, f) => {
  const v = record[f.key];
  if (NUMBER_FIELDS.includes(f.key)) {
    if (v === null || v === undefined || v === '') return false;
    const n = parseFloat(v); if (isNaN(n)) return false;
    return n !== 0; // 0 = "not recorded" sentinel (ALL facility counts — mirror JSX)
  }
  if (f.type === 'array') return Array.isArray(v) && v.filter(x => x && String(x).trim()).length > 0;
  return hasVal(v);
};

/* renderField: one wrap-glued View per field (label + value never split across a page). */
const renderField = (record, field, key) => {
  const val = record[field.key];
  if (field.type === 'array') {
    const rows = (Array.isArray(val) ? val : []).filter(x => x && String(x).trim()).map((t, i) => ({ type: 'item', text: safeString(String(t)), num: i + 1 }));
    return renderRowsBlock(field.label, rows, key);
  }
  if (field.type === 'string') {
    const sentences = splitBySentence(fmtVal(val));
    if (sentences.length > 1) return renderRowsBlock(field.label, buildRows(sentences), key);
  }

  const display = field.type === 'enum' ? enumCanonical(field.key, val)
    : field.type === 'bool' ? (val ? 'Yes' : 'No')
    : safeString(fmtVal(val));
  return (
    <View key={key} style={styles.fieldBox} wrap={false}>
      <Text style={styles.fieldLabel}>{field.label}</Text>
      <Text style={styles.fieldValue}>{display}</Text>
    </View>
  );
};

const FacilityDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.facility) return Array.isArray(r.facility) ? r.facility : [r.facility];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.facility) return Array.isArray(dd.facility) ? dd.facility : [dd.facility]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Facility</Text>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Facility</Text>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            {/* NO date in this schema (createdAt = ingestion timestamp, never rendered) */}
            <Text style={styles.recordTitle}>Facility {idx + 1}</Text>
            {SECTION_CONFIGS.map((cfg, sIdx) => {
              const present = cfg.fields.filter(f => isPresent(record, f));
              if (present.length === 0) return null;
              return (
                <View key={sIdx} style={styles.section}>
                  <View wrap={false}>
                    <Text style={styles.sectionTitle}>{cfg.title}</Text>
                    {renderField(record, present[0], 0)}
                  </View>
                  {present.slice(1).map((field, i) => renderField(record, field, i + 1))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default FacilityDocumentPDFTemplate;

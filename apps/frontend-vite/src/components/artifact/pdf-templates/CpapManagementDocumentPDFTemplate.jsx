/**
 * CpapManagementDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER — B&W.
 * react-pdf 4.5.1: wrap = BOOLEANS; recordContainer paddingBottom only + break={idx>0} (Rule #75);
 * sectionTitle rides INSIDE the section's wrap-gated View (anti-orphan).
 * 4-area mirror of the JSX/copy: canonical splitBySentence ([;.] + abbrev guard) + guarded splitByComma.
 * Numeric-0 = extraction-default "not set" sentinel → HIDE, EXCEPT residual-event/measurement fields
 * (residual AHI / central+obstructive apnea / mask leak) where 0 is a real therapeutic result.
 * Collection: cpap_management
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginTop: 6, marginBottom: 4 },
  subLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 2, marginTop: 4, marginBottom: 3 },
  listItem: { fontSize: 14, color: '#000000', marginBottom: 3, paddingLeft: 8, lineHeight: 1.4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const SECTION_TITLES = {
  'record-info': 'Record Information',
  'pressure-settings': 'Pressure Settings',
  'compliance-data': 'Compliance Data',
  'apnea-indices': 'Apnea Indices',
  'mask-equipment': 'Mask & Equipment',
  'side-effects': 'Side Effects',
};
const FIELD_LABELS = {
  date: 'Date', cpapMode: 'CPAP Mode', epworthSleepinessScore: 'Epworth Sleepiness Score',
  cpapPressureSetting: 'CPAP Pressure Setting', inspiratoryPressure: 'Inspiratory Pressure', expiratoryPressure: 'Expiratory Pressure',
  pressureRangeMin: 'Pressure Range Min', pressureRangeMax: 'Pressure Range Max', rampTime: 'Ramp Time', rampStartPressure: 'Ramp Start Pressure', humidifierSetting: 'Humidifier Setting',
  averageUsageHoursPerNight: 'Average Usage Hours Per Night', adherencePercentage: 'Adherence Percentage', residualAhiOnCpap: 'Residual AHI On CPAP', complianceDownloadDate: 'Compliance Download Date', therapeuticPressureAchieved: 'Therapeutic Pressure Achieved',
  centralApneaIndex: 'Central Apnea Index', obstructiveApneaIndex: 'Obstructive Apnea Index', maskLeakRate: 'Mask Leak Rate',
  maskType: 'Mask Type', maskSize: 'Mask Size', maskBrand: 'Mask Brand', machineManufacturer: 'Machine Manufacturer', machineSerialNumber: 'Machine Serial Number', nextMaskReplacement: 'Next Mask Replacement',
  sideEffectsReported: 'Side Effects Reported',
};
const SECTION_FIELDS = {
  'record-info': ['date', 'cpapMode', 'epworthSleepinessScore'],
  'pressure-settings': ['cpapPressureSetting', 'inspiratoryPressure', 'expiratoryPressure', 'pressureRangeMin', 'pressureRangeMax', 'rampTime', 'rampStartPressure', 'humidifierSetting'],
  'compliance-data': ['averageUsageHoursPerNight', 'adherencePercentage', 'residualAhiOnCpap', 'complianceDownloadDate', 'therapeuticPressureAchieved'],
  'apnea-indices': ['centralApneaIndex', 'obstructiveApneaIndex', 'maskLeakRate'],
  'mask-equipment': ['maskType', 'maskSize', 'maskBrand', 'machineManufacturer', 'machineSerialNumber', 'nextMaskReplacement'],
  'side-effects': ['sideEffectsReported'],
};
const SECTION_ORDER = ['record-info', 'pressure-settings', 'compliance-data', 'apnea-indices', 'mask-equipment', 'side-effects'];
const NUMBER_FIELDS = ['cpapPressureSetting', 'inspiratoryPressure', 'expiratoryPressure', 'pressureRangeMin', 'pressureRangeMax', 'averageUsageHoursPerNight', 'adherencePercentage', 'residualAhiOnCpap', 'maskLeakRate', 'humidifierSetting', 'rampTime', 'rampStartPressure', 'centralApneaIndex', 'obstructiveApneaIndex', 'epworthSleepinessScore'];
const DATE_FIELDS = ['date', 'complianceDownloadDate'];
const BOOLEAN_FIELDS = ['therapeuticPressureAchieved'];
const ARRAY_FIELDS = ['sideEffectsReported'];
/* Numeric 0 hidden as extraction-default UNLESS the field's 0 is a real therapeutic result. */
const MEANINGFUL_ZERO_FIELDS = new Set(['residualAhiOnCpap', 'maskLeakRate', 'centralApneaIndex', 'obstructiveApneaIndex']);

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fieldShows = (fn, v) => {
  if (typeof v === 'number' && v === 0 && NUMBER_FIELDS.includes(fn) && !MEANINGFUL_ZERO_FIELDS.has(fn)) return false;
  return hasVal(v);
};
// Canonical: splits on '.' AND ';' with the abbreviation+decimal guard.
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#≥≤><%0-9-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [];
  const parts = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (!/^\s/.test(rest)) { cur += ch; continue; }
      if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
      if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
      const t = cur.trim(); if (t) parts.push(t); cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.filter(Boolean);
};

/* Build {k:'label'|'sub'|'row', t} lines for one field — the exact mirror of buildFieldLines. */
const fieldLines = (record, f) => {
  const label = FIELD_LABELS[f] || f;
  const val = record[f];
  const lines = [];
  if (ARRAY_FIELDS.includes(f)) {
    const items = Array.isArray(val) ? val.filter(v => v !== null && v !== undefined && String(v).trim() !== '') : [];
    if (items.length === 0) return lines;
    lines.push({ k: 'label', t: label });
    items.forEach((item, i) => lines.push({ k: 'row', t: `${i + 1}. ${item}` }));
  } else if (DATE_FIELDS.includes(f)) {
    if (!hasVal(val)) return lines;
    lines.push({ k: 'label', t: label }, { k: 'row', t: `1. ${formatDate(val)}` });
  } else if (BOOLEAN_FIELDS.includes(f)) {
    if (!hasVal(val)) return lines;
    lines.push({ k: 'label', t: label }, { k: 'row', t: `1. ${val ? 'Yes' : 'No'}` });
  } else if (NUMBER_FIELDS.includes(f)) {
    if (!fieldShows(f, val)) return lines;
    lines.push({ k: 'label', t: label }, { k: 'row', t: `1. ${fmtVal(val)}` });
  } else {
    // string / enum
    if (!hasVal(val)) return lines;
    const str = fmtVal(val);
    const sentences = splitBySentence(str);
    if (sentences.length <= 1) {
      lines.push({ k: 'label', t: label }, { k: 'row', t: `1. ${str}` });
    } else {
      lines.push({ k: 'label', t: label });
      let n = 0;
      sentences.forEach(s => {
        const p = parseLabel(s);
        if (p) { const ci = splitByComma(p.content); lines.push({ k: 'sub', t: p.label }); n = 0; if (ci.length >= 3) ci.forEach(c => lines.push({ k: 'row', t: `${++n}. ${c}` })); else lines.push({ k: 'row', t: `${++n}. ${p.content}` }); }
        else { const ci = splitByComma(s); if (ci.length >= 3) ci.forEach(c => lines.push({ k: 'row', t: `${++n}. ${c}` })); else lines.push({ k: 'row', t: `${++n}. ${s}` }); }
      });
    }
  }
  return lines;
};

const CpapManagementDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.cpap_management) return Array.isArray(r.cpap_management) ? r.cpap_management : [r.cpap_management];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cpap_management) return Array.isArray(dd.cpap_management) ? dd.cpap_management : [dd.cpap_management]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>CPAP Management</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>CPAP Management</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`CPAP Management ${idx + 1}`}</Text>
            </View>
            {SECTION_ORDER.map(sid => {
              const lines = (SECTION_FIELDS[sid] || []).flatMap(f => fieldLines(record, f));
              if (lines.length === 0) return null;
              return (
                <View key={sid} style={styles.section} wrap={lines.length > 20 ? true : false}>
                  <Text style={styles.sectionTitle}>{SECTION_TITLES[sid]}</Text>
                  {lines.map((ln, i) => ln.k === 'label'
                    ? <Text key={i} style={styles.fieldLabel}>{ln.t}</Text>
                    : ln.k === 'sub'
                      ? <Text key={i} style={styles.subLabel}>{ln.t}</Text>
                      : <Text key={i} style={styles.listItem}>{ln.t}</Text>)}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default CpapManagementDocumentPDFTemplate;

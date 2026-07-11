/**
 * CpapBipapManagementDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER — B&W.
 * react-pdf 4.5.1: wrap = BOOLEANS; recordContainer paddingBottom only + break={idx>0} (Rule #75);
 * sectionTitle rides INSIDE the section's wrap-gated View (anti-orphan).
 * 4-area mirror of the JSX/copy: canonical splitBySentence ([;.] + abbrev guard) + guarded splitByComma;
 * labeled sentence >=3 comma parts → sub-label + numbered rows; else "1. content".
 * Numeric-0 = extraction-default "not set" sentinel → HIDE unless the field is a real-measurement zero
 * (AHI / central apnea / ODI / leak rate keep rendering 0).
 * Collection: cpap_bipap_management
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
  deviceSettings: 'Device & Settings',
  sleepIndices: 'Sleep Indices & Oxygenation',
  maskCompliance: 'Mask & Compliance',
  ventilation: 'Ventilation & Advanced Settings',
  assessmentScores: 'Assessment Scores & Follow-up',
};
const FIELD_LABELS = {
  deviceType: 'Device Type',
  prescribedPressureCmH2O: 'Prescribed Pressure (cmH2O)',
  ipapSettingCmH2O: 'IPAP Setting (cmH2O)',
  epapSettingCmH2O: 'EPAP Setting (cmH2O)',
  pressureSupportDelta: 'Pressure Support Delta',
  rampTimeSetting: 'Ramp Time Setting (min)',
  humidifierSetting: 'Humidifier Setting',
  apneaHypopneaIndex: 'Apnea-Hypopnea Index (AHI)',
  baselineAhiPreTreatment: 'Baseline AHI (Pre-Treatment)',
  residualAhiOnTherapy: 'Residual AHI on Therapy',
  centralApneaIndex: 'Central Apnea Index',
  oxygenDesaturationIndex: 'Oxygen Desaturation Index',
  supplementalOxygenFlowRate: 'Supplemental O2 Flow Rate (L/min)',
  maskType: 'Mask Type',
  maskFitIssues: 'Mask Fit Issues',
  averageDailyUsageHours: 'Average Daily Usage (hrs)',
  compliancePercentage: 'Compliance Percentage',
  leakRateLitersPerMinute: 'Leak Rate (L/min)',
  tidalVolumeTargetMl: 'Tidal Volume Target (mL)',
  backupRespiratoryRate: 'Backup Respiratory Rate',
  cheyneStokesCycleLength: 'Cheyne-Stokes Cycle Length',
  aerophagiaSymptoms: 'Aerophagia Symptoms',
  epworthSleepinessScore: 'Epworth Sleepiness Score',
  stopBangScore: 'STOP-BANG Score',
  lastTitrationStudyDate: 'Last Titration Study Date',
};
const SECTION_FIELDS = {
  deviceSettings: ['deviceType', 'prescribedPressureCmH2O', 'ipapSettingCmH2O', 'epapSettingCmH2O', 'pressureSupportDelta', 'rampTimeSetting', 'humidifierSetting'],
  sleepIndices: ['apneaHypopneaIndex', 'baselineAhiPreTreatment', 'residualAhiOnTherapy', 'centralApneaIndex', 'oxygenDesaturationIndex', 'supplementalOxygenFlowRate'],
  maskCompliance: ['maskType', 'maskFitIssues', 'averageDailyUsageHours', 'compliancePercentage', 'leakRateLitersPerMinute'],
  ventilation: ['tidalVolumeTargetMl', 'backupRespiratoryRate', 'cheyneStokesCycleLength', 'aerophagiaSymptoms'],
  assessmentScores: ['epworthSleepinessScore', 'stopBangScore', 'lastTitrationStudyDate'],
};
const SECTION_ORDER = ['deviceSettings', 'sleepIndices', 'maskCompliance', 'ventilation', 'assessmentScores'];
const ARRAY_FIELDS = ['maskFitIssues'];
const DATE_FIELDS = ['lastTitrationStudyDate'];
/* Numeric fields where 0 is a "not set" sentinel → hidden. AHI/central apnea/ODI/leak rate keep rendering 0. */
const SENTINEL_ZERO_FIELDS = new Set([
  'prescribedPressureCmH2O', 'ipapSettingCmH2O', 'epapSettingCmH2O', 'pressureSupportDelta',
  'averageDailyUsageHours', 'compliancePercentage', 'supplementalOxygenFlowRate',
  'rampTimeSetting', 'humidifierSetting', 'epworthSleepinessScore', 'stopBangScore',
  'tidalVolumeTargetMl', 'backupRespiratoryRate', 'cheyneStokesCycleLength',
]);

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fieldHasVal = (fn, v) => {
  if (SENTINEL_ZERO_FIELDS.has(fn)) { if (v === null || v === undefined || v === '') return false; const n = parseFloat(v); if (isNaN(n)) return false; return n !== 0; }
  return hasVal(v);
};
// Canonical: splits on '.' AND ';' with the abbreviation+decimal guard.
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#≥≤><%0-9-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };
// paren-aware; keep Oxford ", and/or X"; skip no-space commas and date commas.
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
    const arr = Array.isArray(val) ? val.filter(v => v !== null && v !== undefined && String(v).trim() !== '') : [];
    if (arr.length === 0) return lines;
    lines.push({ k: 'label', t: label });
    arr.forEach((item, i) => lines.push({ k: 'row', t: `${i + 1}. ${item}` }));
  } else if (DATE_FIELDS.includes(f)) {
    if (!fieldHasVal(f, val)) return lines;
    lines.push({ k: 'label', t: label }, { k: 'row', t: `1. ${formatDate(val)}` });
  } else {
    if (!fieldHasVal(f, val)) return lines;
    // narrative-safe: a string value with sentence/label structure still numbers correctly
    const str = fmtVal(val);
    const sentences = typeof val === 'string' ? splitBySentence(str) : [str];
    if (sentences.length <= 1 && !parseLabel(sentences[0] || '')) {
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

const CpapBipapManagementDocumentPDFTemplate = ({ document: data }) => {
  const records = React.useMemo(() => {
    if (!data) return [];
    let arr = Array.isArray(data) ? data : [data];
    arr = arr.flatMap(r => {
      if (r?.cpap_bipap_management) return Array.isArray(r.cpap_bipap_management) ? r.cpap_bipap_management : [r.cpap_bipap_management];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cpap_bipap_management) return Array.isArray(dd.cpap_bipap_management) ? dd.cpap_bipap_management : [dd.cpap_bipap_management]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [data]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>CPAP/BiPAP Management</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>CPAP/BiPAP Management</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`CPAP/BiPAP Management ${idx + 1}`}</Text>
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

export default CpapBipapManagementDocumentPDFTemplate;

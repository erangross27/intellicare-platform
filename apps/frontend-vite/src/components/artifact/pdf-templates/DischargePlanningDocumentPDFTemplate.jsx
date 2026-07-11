/**
 * DischargePlanningDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: discharge_planning.
 *
 * BOX-FREE canonical (one-pass items 9-11): page 14 / title 26 / recordTitle 19 / sectionTitle 16 +
 * 1pt black rule / fieldLabel 13 + 0.5pt #999 rule / values 14. Rule #74: wrap is BOOLEAN only; each
 * field is its own glue unit; the sectionTitle rides inside the first unit. Every value row numbered.
 * break={idx>0} → one record per page. Mirrors the JSX/copy exactly — array-of-objects (meds/appts)
 * render as identity header (numbered running) + each secondary attr as its own sub-label + value;
 * sentence fields expand by sentence → semicolon → guarded comma. Empty sections drop.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 18, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 6 },
  recordHeader: { marginBottom: 4 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 2 },
  section: { marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 5, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldGroup: { marginBottom: 2 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2, paddingBottom: 1, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.35, color: '#000000', marginBottom: 1 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS (mirror the JSX) ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/×/g, 'x').replace(/²/g, '2')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean' || typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isScalar = (v) => v === null || typeof v !== 'object';
const formatDate = (dateValue) => { if (!dateValue) return ''; try { const d = new Date(dateValue.$date || dateValue); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); } };

const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitBySemicolon = (text) => (!text || typeof text !== 'string') ? [] : text.split(/;\s*/).map(s => s.trim()).filter(Boolean);
const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) { const ch = text[i]; if (ch === '(') { depth++; current += ch; } else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; } else if (ch === ',' && depth === 0) { const t = current.trim(); if (t) result.push(t); current = ''; } else { current += ch; } }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
const splitGuardedComma = (text) => {
  const s = String(text || ''); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; }
    if (ch === ',' && depth === 0) {
      const noSpace = s[i + 1] !== ' ';
      let j = i + 1; while (j < s.length && s[j] === ' ') j++;
      const rest = s.slice(j); const nextChar = s[j] || '';
      const andOrAfter = /^(and|or)\b/i.test(rest);
      const andOrBefore = /\b(and|or)\s*$/i.test(cur);
      const dateComma = /\d\s*$/.test(cur) && /^\d{4}\b/.test(rest);
      const nextOk = /[A-Za-z(>]/.test(nextChar);
      if (!noSpace && !andOrAfter && !andOrBefore && !dateComma && nextOk) { const p = cur.trim(); if (p) out.push(p); cur = ''; continue; }
    }
    cur += ch;
  }
  const p = cur.trim(); if (p) out.push(p);
  return out;
};

/* sentenceLines: numbered copy/PDF lines for a sentence field (mirror formatSentenceFieldLines). */
const sentenceLines = (text) => {
  const sentences = splitBySentence(fmtVal(text));
  const lines = []; let n = 1;
  sentences.forEach(s => {
    const p = parseLabel(s);
    if (p.isLabeled) {
      const parts = splitByComma(p.value);
      lines.push(safeString(p.label) + ':');
      if (parts.length >= 2) parts.forEach(it => lines.push(`  ${n++}. ${safeString(it)}`));
      else lines.push(`  ${n++}. ${safeString(p.value)}`);
      return;
    }
    splitBySemicolon(s).forEach(part => {
      const items = splitGuardedComma(part);
      if (items.length >= 3) items.forEach(it => lines.push(`${n++}. ${safeString(it)}`));
      else lines.push(`${n++}. ${safeString(part.replace(/[;.]+$/, '').trim())}`);
    });
  });
  return lines;
};

/* ═══ UNIT BUILDERS ═══ each unit = { label, lines[] }; lines are pre-numbered strings. */
const scalarUnit = (label, val, isDate) => ({ label, lines: [`1. ${isDate ? formatDate(val) : fmtVal(val)}`] });
const arrayUnit = (label, arr) => ({ label, lines: arr.map((it, i) => `${i + 1}. ${safeString(it)}`) });
const objectsUnits = (items, headerFmt, subFields) => {
  const units = []; let n = 1;
  items.forEach(item => {
    const hv = headerFmt(item);
    if (hv === undefined || hv === null || hv === '') return;
    units.push({ label: null, lines: [`${n++}. ${safeString(hv)}`] }); // identity header (running number)
    subFields.forEach(f => {
      const v = item[f.key];
      if (v === undefined || v === null || v === '') return;
      const disp = f.type === 'date' ? formatDate(v) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
      units.push({ label: f.label, lines: [`1. ${safeString(disp)}`] });
    });
  });
  return units;
};

const DischargePlanningDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.discharge_planning) return Array.isArray(r.discharge_planning) ? r.discharge_planning : [r.discharge_planning];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.discharge_planning) return Array.isArray(dd.discharge_planning) ? dd.discharge_planning : [dd.discharge_planning]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Discharge Planning">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Discharge Planning</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  const renderUnits = (title, units, keyPrefix) => units.length === 0 ? null : (
    <View style={styles.section}>
      {units.map((u, i) => (
        <View key={`${keyPrefix}-${i}`} style={styles.fieldGroup} wrap={u.lines.length > 8}>
          {i === 0 ? <Text style={styles.sectionTitle}>{title}</Text> : null}
          {u.label ? <Text style={styles.fieldLabel}>{safeString(u.label)}</Text> : null}
          {u.lines.map((ln, li) => <Text key={li} style={styles.value}>{safeString(ln)}</Text>)}
        </View>
      ))}
    </View>
  );

  const renderRecord = (record, idx) => {
    const cdr = record.comprehensiveDischargeReadiness || {};
    const S = []; // [{title, units, key}]

    // Session Information
    const sess = [['date', record.date, true], ['provider', record.provider, false], ['facility', record.facility, false], ['status', record.status, false]]
      .filter(([, v]) => hasVal(v)).map(([k, v, d]) => scalarUnit(k === 'date' ? 'Date' : k === 'provider' ? 'Provider' : k === 'facility' ? 'Facility' : 'Status', v, d));
    if (sess.length) S.push({ title: 'Session Information', units: sess, key: 'si' });

    // Discharge Overview
    const ov = [];
    if (hasVal(record.expectedLOS)) ov.push(scalarUnit('Expected Length of Stay', record.expectedLOS, false));
    if (hasVal(record.dischargeDestination)) ov.push(scalarUnit('Discharge Destination', record.dischargeDestination, false));
    if (hasVal(record.returnToWork)) ov.push({ label: 'Return to Work', lines: sentenceLines(record.returnToWork) });
    if (ov.length) S.push({ title: 'Discharge Overview', units: ov, key: 'ov' });

    // String arrays (single-name → no sub-label)
    [['followUpInstructions', 'Follow-up Instructions'], ['activityRestrictions', 'Activity Restrictions'], ['warningSignsToWatch', 'Warning Signs to Watch']].forEach(([fn, t], i) => {
      if (Array.isArray(record[fn]) && record[fn].length) S.push({ title: t, units: [arrayUnit(null, record[fn])], key: `sa${i}` });
    });

    // Medical Stability
    const ms = cdr.medicalStability || {};
    const msU = [];
    if (ms.vitalSignsStable !== undefined) msU.push(scalarUnit('Vital Signs Stable', ms.vitalSignsStable, false));
    if (ms.mobilizing !== undefined) msU.push(scalarUnit('Mobilizing', ms.mobilizing, false));
    if (msU.length) S.push({ title: 'Medical Stability', units: msU, key: 'ms' });

    // Discharge Medications
    const dm = cdr.dischargeMedications || {};
    const dmU = [];
    if (dm.reconciliationCompleted !== undefined) dmU.push(scalarUnit('Reconciliation Completed', dm.reconciliationCompleted, false));
    const meds = dm.newMedications || [];
    if (meds.length) { const mu = objectsUnits(meds, m => m.medication || '', [{ key: 'indication', label: 'Indication' }, { key: 'duration', label: 'Duration' }]); if (mu.length) mu[0].label = 'New Medications'; dmU.push(...mu); }
    if (dmU.length) S.push({ title: 'Discharge Medications', units: dmU, key: 'dm' });

    // Patient Education
    const pe = cdr.patientEducation || {};
    const peU = [];
    if (pe.teachBackCompleted !== undefined) peU.push(scalarUnit('Teach-Back Completed', pe.teachBackCompleted, false));
    if (pe.writtenInstructions !== undefined) peU.push(scalarUnit('Written Instructions Provided', pe.writtenInstructions, false));
    if (Array.isArray(pe.topicsReviewed) && pe.topicsReviewed.length) peU.push(arrayUnit('Topics Reviewed', pe.topicsReviewed));
    if (peU.length) S.push({ title: 'Patient Education', units: peU, key: 'pe' });

    // Follow-up Scheduling
    const appts = (cdr.followUpScheduling || {}).appointments || [];
    if (appts.length) S.push({ title: 'Follow-up Scheduling', units: objectsUnits(appts, a => a.provider || '', [{ key: 'timing', label: 'Timing' }, { key: 'appointmentDate', label: 'Appointment Date', type: 'date' }, { key: 'scheduled', label: 'Scheduled' }]), key: 'fs' });

    // Readmission Risk
    const rr = cdr.readmissionRisk || {};
    const rrU = [];
    if (hasVal(rr.riskLevel)) rrU.push(scalarUnit('Risk Level', rr.riskLevel, false));
    if (Array.isArray(rr.riskFactors) && rr.riskFactors.length) rrU.push(arrayUnit('Risk Factors', rr.riskFactors));
    if (Array.isArray(rr.mitigationStrategies) && rr.mitigationStrategies.length) rrU.push(arrayUnit('Mitigation Strategies', rr.mitigationStrategies));
    if (rrU.length) S.push({ title: 'Readmission Risk', units: rrU, key: 'rr' });

    // Sentence fields (single-name → no sub-label)
    [['findings', 'Findings'], ['assessment', 'Assessment'], ['plan', 'Plan']].forEach(([fn, t], i) => {
      if (hasVal(record[fn])) S.push({ title: t, units: [{ label: null, lines: sentenceLines(record[fn]) }], key: `snt${i}` });
    });

    // Results (recursive object)
    if (hasVal(record.results) && !isScalar(record.results)) {
      const units = [];
      const walk = (o) => Object.entries(o).forEach(([k, v]) => { if (isEmptyDeep(v)) return; if (isScalar(v)) units.push({ label: humanizeKey(k), lines: [`1. ${safeString(fmtScalar(v))}`] }); else { units.push({ label: humanizeKey(k), lines: [] }); walk(v); } });
      walk(record.results);
      if (units.length) S.push({ title: 'Results', units, key: 'res' });
    }

    // Recommendations (date groups)
    if (Array.isArray(record.recommendations) && record.recommendations.length) {
      const grouped = {};
      record.recommendations.forEach(r2 => { const d = r2.date || 'Unknown'; if (!grouped[d]) grouped[d] = []; grouped[d].push(r2.recommendation || ''); });
      const units = Object.entries(grouped).map(([d, items]) => arrayUnit(formatDate(d) || d, items));
      if (units.length) S.push({ title: 'Recommendations', units, key: 'rec' });
    }

    // Notes
    if (hasVal(record.notes)) S.push({ title: 'Notes', units: [{ label: null, lines: sentenceLines(record.notes) }], key: 'nt' });

    return (
      <View key={idx} style={styles.recordContainer} break={idx > 0}>
        <View style={styles.recordHeader} wrap={false}>
          <Text style={styles.recordTitle}>{`Discharge Planning ${idx + 1}`}</Text>
        </View>
        {S.map(sec => renderUnits(sec.title, sec.units, sec.key))}
      </View>
    );
  };

  return (
    <Document title="Discharge Planning">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Discharge Planning</Text></View>
        {records.map((record, idx) => renderRecord(record, idx))}
      </Page>
    </Document>
  );
};

export default DischargePlanningDocumentPDFTemplate;

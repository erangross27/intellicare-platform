/**
 * DisabilityEvaluationsDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: disability_evaluations.
 *
 * BOX-FREE canonical (one-pass items 9-11): page 14 / title 26 / recordTitle 19 / sectionTitle 16 +
 * 1pt black rule / fieldLabel 13 + 0.5pt #999 rule / values 14. Rule #74: wrap is BOOLEAN only; each
 * field is its own glue unit; the sectionTitle rides inside the first field. Every value row numbered
 * ("1." even singles). break={idx>0} → one record per page. Mirrors the JSX exactly — sentence field →
 * numbered sentence lines (labeled sentences → their own sub-group), semicolon/array fields → numbered
 * items, hide-zero for graded scales (0 = not assessed) while functional 0 (ADL/Barthel/work/lift/walk/
 * VAS) shows. Empty sections drop. Record title = "Disability Evaluation N".
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 6 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldGroup: { marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS (mirror the JSX) ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/²/g, '2')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean' || typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
const splitBySemicolon = (text) => (!text || typeof text !== 'string') ? [] : text.split(/;\s*/).map(s => s.trim()).filter(s => s);
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

/* splitGuardedComma: guarded comma split (mirror the JSX) — paren-aware; skip no-space commas; keep
   Oxford ", and/or X" attached; skip date commas; next char letter/'('/'>'. Gated to >=3 items. */
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

/* hide-zero (mirror the JSX): functional 0s show (real max-impairment finding); graded-scale 0s hide. */
const MEANINGFUL_ZERO = new Set(['adlScore', 'barthelIndex', 'workCapacityPercentage', 'liftingCapacityKg', 'walkingToleranceMeters', 'painLevelVasScore']);
const NUMBER_FIELDS = new Set(['adlScore', 'iadlScore', 'barthelIndex', 'glasgowOutcomeScale', 'rankinScale', 'kurtzkeEdssScore', 'workCapacityPercentage', 'physicalImpairmentRating', 'cognitiveAssessmentScore', 'mmseMoCAScore', 'liftingCapacityKg', 'walkingToleranceMeters', 'hearingThresholdDb', 'painLevelVasScore', 'respiratoryFunctionFev1', 'ejectionFractionPercentage', 'psychiatricImpairmentGaf']);
const numShows = (fn, v) => {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v); if (Number.isNaN(n)) return false;
  if (n === 0) return MEANINGFUL_ZERO.has(fn);
  return true;
};

const DisabilityEvaluationsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.disability_evaluations) return Array.isArray(r.disability_evaluations) ? r.disability_evaluations : [r.disability_evaluations];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.disability_evaluations) return Array.isArray(dd.disability_evaluations) ? dd.disability_evaluations : [dd.disability_evaluations]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Disability Evaluations">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Disability Evaluations</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  const sectionTitle = (t) => <Text style={styles.sectionTitle}>{t}</Text>;

  const fieldGroup = (label, values, key, withTitle) => {
    if (!values || values.length === 0) return null;
    return (
      <View key={key} style={styles.fieldGroup} wrap={values.length > 8}>
        {withTitle}
        {label ? <Text style={styles.fieldLabel}>{safeString(label)}</Text> : null}
        {values.map((v, i) => <Text key={i} style={styles.value}>{`${i + 1}. ${safeString(v)}`}</Text>)}
      </View>
    );
  };

  const renderGroups = (title, groups, keyPrefix) => groups.length === 0 ? null : (
    <View style={styles.section}>
      {groups.map((g, i) => fieldGroup(g.label, g.values, `${keyPrefix}-${i}`, i === 0 ? sectionTitle(title) : null))}
    </View>
  );

  /* sentence field → groups: unlabeled sentences accumulate under the field label; a labeled sentence
     with >=2 comma items becomes its own sub-group (mirrors the JSX nested-mini-card). */
  const sentenceGroups = (fieldLabel, text) => {
    const sentences = splitBySentence(fmtVal(text));
    const groups = []; let main = null;
    const pushMain = (v) => { if (!main) { main = { label: fieldLabel, values: [] }; groups.push(main); } main.values.push(v); };
    sentences.forEach(s => {
      const p = parseLabel(s);
      if (p.isLabeled) { const items = splitByComma(p.value); if (items.length >= 2) { groups.push({ label: p.label, values: items }); return; } }
      splitBySemicolon(s).forEach(part => {
        const items = splitGuardedComma(part);
        if (items.length >= 3) items.forEach(it => pushMain(it));
        else pushMain(part.replace(/[;.]+$/, '').trim());
      });
    });
    return groups;
  };

  const renderRecord = (record, idx) => {
    const numG = (label, fn) => numShows(fn, record[fn]) ? { label, values: [safeString(fmtVal(record[fn]))] } : null;
    const strG = (label, fn) => hasVal(record[fn]) ? { label, values: [safeString(fmtVal(record[fn]))] } : null;
    const arrG = (label, fn) => { const a = (Array.isArray(record[fn]) ? record[fn] : []).filter(hasVal).map(x => safeString(fmtVal(x))); return a.length ? { label, values: a } : null; };
    const semiG = (label, fn) => { const p = hasVal(record[fn]) ? splitBySemicolon(fmtVal(record[fn])) : []; return p.length ? { label, values: p } : null; };

    const functional = hasVal(record.functionalCapacityEvaluation) ? sentenceGroups('Functional Capacity Evaluation', record.functionalCapacityEvaluation) : [];
    const scores = [numG('ADL Score', 'adlScore'), numG('IADL Score', 'iadlScore'), numG('Barthel Index', 'barthelIndex'), numG('Glasgow Outcome Scale', 'glasgowOutcomeScale'), numG('Rankin Scale', 'rankinScale'), numG('Kurtzke EDSS Score', 'kurtzkeEdssScore'), strG('WHO Disability Assessment', 'whoDisabilityAssessment'), numG('Work Capacity (%)', 'workCapacityPercentage'), numG('Physical Impairment Rating', 'physicalImpairmentRating')].filter(Boolean);
    const cognitive = [numG('Cognitive Assessment Score', 'cognitiveAssessmentScore'), numG('MMSE/MoCA Score', 'mmseMoCAScore')].filter(Boolean);
    const mobility = [arrG('Mobility Aid Requirement', 'mobilitAidRequirement'), numG('Lifting Capacity (kg)', 'liftingCapacityKg'), numG('Walking Tolerance (m)', 'walkingToleranceMeters'), semiG('Standing/Sitting Tolerance', 'standingSittingTolerance')].filter(Boolean);
    const sensory = [strG('Visual Acuity (Binocular)', 'visualAcuityBinocular'), numG('Hearing Threshold (dB)', 'hearingThresholdDb'), numG('Pain Level (VAS)', 'painLevelVasScore')].filter(Boolean);
    const cardio = [numG('Respiratory Function FEV1', 'respiratoryFunctionFev1'), strG('Cardiac Functional Class', 'cardiacFunctionalClass'), numG('Ejection Fraction (%)', 'ejectionFractionPercentage')].filter(Boolean);
    const neuro = [arrG('Neurological Deficits', 'neurologicalDeficits'), strG('Spinal Range of Motion', 'spinalRangeOfMotion')].filter(Boolean);
    const psychiatric = [numG('Psychiatric Impairment (GAF)', 'psychiatricImpairmentGaf')].filter(Boolean);

    return (
      <View key={idx} style={styles.recordContainer} break={idx > 0}>
        <View style={styles.recordHeader} wrap={false}>
          <Text style={styles.recordTitle}>{`Disability Evaluation ${idx + 1}`}</Text>
        </View>

        {renderGroups('Functional Capacity', functional, 'fc')}
        {renderGroups('Assessment Scores', scores, 'as')}
        {renderGroups('Cognitive', cognitive, 'cg')}
        {renderGroups('Mobility', mobility, 'mo')}
        {renderGroups('Sensory', sensory, 'se')}
        {renderGroups('Cardiorespiratory', cardio, 'cr')}
        {renderGroups('Neurological', neuro, 'ne')}
        {renderGroups('Psychiatric', psychiatric, 'ps')}
      </View>
    );
  };

  return (
    <Document title="Disability Evaluations">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Disability Evaluations</Text></View>
        {records.map((record, idx) => renderRecord(record, idx))}
      </Page>
    </Document>
  );
};

export default DisabilityEvaluationsDocumentPDFTemplate;

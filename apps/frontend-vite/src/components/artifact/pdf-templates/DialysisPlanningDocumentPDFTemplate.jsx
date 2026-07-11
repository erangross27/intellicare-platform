/**
 * DialysisPlanningDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: dialysis_planning.
 *
 * BOX-FREE canonical (one-pass items 9-11): page 14 / title 26 / recordTitle 19 / sectionTitle 16 +
 * 1pt black rule / fieldLabel 13 + 0.5pt #999 rule / values 14. Rule #74: wrap is BOOLEAN only; the
 * sectionTitle rides inside the first field; each field is its own glue unit. Every value row numbered.
 * break={idx>0} → one record per page. Mirrors the JSX exactly (data-driven from the same SECTION_FIELDS):
 * epoch-date sentinel (1970-01-01) hidden, sentence fields comma-split then parseLabel per part (colon
 * part → sub-label + value; header sentence ending ':' → sub-label), numbers stripped from source lists.
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
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 10, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ CONSTANTS (mirror the JSX) ═══ */
const SECTION_TITLES = {
  'session-info': 'Session Information', 'modality': 'Modality', 'vascular-access': 'Vascular Access Planning',
  'education': 'Education', 'timeline': 'Timeline', 'social-work': 'Social Work', 'home-assessment': 'Home Assessment',
  'findings-assessment-plan': 'Findings / Assessment / Plan', 'notes-section': 'Notes',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', status: 'Status',
  modalityPreference: 'Modality Preference', modalityOptions: 'Modality Options',
  'accessPlanning.veinMappingStatus': 'Vein Mapping Status',
  'accessPlanning.vascularSurgeryReferralTiming': 'Vascular Surgery Referral Timing',
  'accessPlanning.protectLeftArm': 'Protect Left Arm', 'accessPlanning.protectNonDominantArm': 'Protect Non-Dominant Arm',
  'accessPlanning.avoidPICCLines': 'Avoid PICC Lines', 'accessPlanning.avoidSubclavianAccess': 'Avoid Subclavian Access',
  'accessPlanning.referralToVascularSurgery': 'Referral to Vascular Surgery',
  accessStatus: 'Access Status', urgentStartCriteria: 'Urgent Start Criteria', contraindications: 'Contraindications',
  homeAssessment: 'Home Assessment', recommendations: 'Recommendations',
  educationStatus: 'Education Status', educationCompleted: 'Education Completed',
  'educationInitiated.modalityOptionsDiscussed': 'Modality Options Discussed',
  'educationInitiated.referredToRenalEducationClass': 'Referred to Renal Education Class',
  'educationInitiated.tourOfDialysisUnitScheduled': 'Tour of Dialysis Unit Scheduled',
  renalEducationClassDate: 'Renal Education Class Date',
  'dialysisUnitTour.scheduled': 'Tour Scheduled', 'dialysisUnitTour.status': 'Tour Status',
  estimatedStartDate: 'Estimated Start Date', estimatedTimeToDialysis: 'Estimated Time to Dialysis',
  socialWorkReferral: 'Social Work Referral', findings: 'Findings', assessment: 'Assessment', plan: 'Plan', notes: 'Notes',
};
const SECTION_FIELDS = {
  'session-info': ['date', 'provider', 'facility', 'status'],
  'modality': ['modalityPreference', 'modalityOptions'],
  'vascular-access': ['accessPlanning.veinMappingStatus', 'accessPlanning.vascularSurgeryReferralTiming', 'accessPlanning.protectLeftArm', 'accessPlanning.protectNonDominantArm', 'accessPlanning.avoidPICCLines', 'accessPlanning.avoidSubclavianAccess', 'accessPlanning.referralToVascularSurgery', 'accessStatus', 'urgentStartCriteria', 'contraindications'],
  'education': ['educationStatus', 'educationCompleted', 'educationInitiated.modalityOptionsDiscussed', 'educationInitiated.referredToRenalEducationClass', 'educationInitiated.tourOfDialysisUnitScheduled', 'renalEducationClassDate', 'dialysisUnitTour.scheduled', 'dialysisUnitTour.status'],
  'timeline': ['estimatedStartDate', 'estimatedTimeToDialysis'],
  'social-work': ['socialWorkReferral'],
  'home-assessment': ['homeAssessment'],
  'findings-assessment-plan': ['findings', 'assessment', 'plan', 'recommendations'],
  'notes-section': ['notes'],
};
const DATE_FIELDS = ['date', 'renalEducationClassDate', 'estimatedStartDate'];
const ARRAY_FIELDS = ['urgentStartCriteria', 'contraindications'];
const OBJECT_FIELDS = ['accessStatus', 'homeAssessment'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const BOOLEAN_FIELDS = ['educationCompleted', 'accessPlanning.protectLeftArm', 'accessPlanning.avoidPICCLines', 'accessPlanning.avoidSubclavianAccess', 'educationInitiated.modalityOptionsDiscussed', 'educationInitiated.referredToRenalEducationClass', 'educationInitiated.tourOfDialysisUnitScheduled', 'dialysisUnitTour.scheduled'];
const SENTENCE_FIELDS = ['estimatedTimeToDialysis', 'findings', 'assessment', 'plan', 'notes'];

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
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean' || typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const KEY_OVERRIDES = { avf: 'AVF', avg: 'AVG', pd: 'PD', cvc: 'CVC', picc: 'PICC', hd: 'HD' };
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

const resolveField = (record, fieldPath) => { const parts = fieldPath.split('.'); let val = record; for (const p of parts) { if (val == null) return undefined; val = val[p]; } return val; };

/* epoch-date sentinel (1970-01-01) → '' */
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try { const d = new Date(dateValue.$date || dateValue); if (isNaN(d.getTime())) return String(dateValue); if (d.getUTCFullYear() <= 1970 && d.getUTCMonth() === 0 && d.getUTCDate() === 1) return ''; return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateValue); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  if ((text.match(/(?:^|\s)\d+\.\s/g) || []).length >= 2) return text.split(/(?:^|\s)\d+\.\s+/).map(s => s.trim()).filter(Boolean);
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&().#'"%<>~+=-]{1,120}?):\s+([\s\S]+)$/);
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

/* sentenceRows: mirror the JSX sentence blocks → [{t:'sub'|'val', text, num}]. Numbering RESTARTS at
   each sub-label (one-pass item 3); the 0.5pt #999 rule under a sub-label is the PDF's '-' divider. */
const sentenceRows = (text) => {
  const rows = []; let n = 0;
  const sub = (t) => { rows.push({ t: 'sub', text: t }); n = 0; };
  const value = (t) => { rows.push({ t: 'val', num: ++n, text: t }); };
  splitBySentence(String(text)).forEach(s => {
    if (/:\s*$/.test(s)) { sub(s.replace(/\s*:\s*$/, '')); return; }
    const parsed = parseLabel(s);
    if (parsed.isLabeled) { const parts = splitByComma(parsed.value); sub(parsed.label); (parts.length >= 2 ? parts : [parsed.value]).forEach(value); return; }
    const parts = splitByComma(s);
    if (parts.length >= 2) { parts.forEach(part => { const pp = parseLabel(part); if (pp.isLabeled) { sub(pp.label); value(pp.value); } else { value(part); } }); return; }
    value(s);
  });
  return rows;
};

/* objectRows: recursive flat rows for object/array fields */
const objectRows = (label, value, depth, out) => {
  if (isEmptyDeep(value)) return out;
  if (isScalar(value)) { out.push({ t: 'val', label: safeString(label), text: safeString(fmtScalar(value)), depth }); return out; }
  if (label) out.push({ t: 'sub', text: safeString(label), depth });
  const cd = label ? depth + 1 : depth;
  if (Array.isArray(value)) value.filter(v => !isEmptyDeep(v)).forEach(v => objectRows('', v, cd, out));
  else Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectRows(humanizeKey(k), v, cd, out));
  return out;
};

const DialysisPlanningDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.dialysis_planning) return Array.isArray(r.dialysis_planning) ? r.dialysis_planning : [r.dialysis_planning];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dialysis_planning) return Array.isArray(dd.dialysis_planning) ? dd.dialysis_planning : [dd.dialysis_planning]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document title="Dialysis Planning">
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Dialysis Planning</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  const numberedValue = (num, text, key) => <Text key={key} style={styles.value}>{`${num}. ${safeString(text)}`}</Text>;

  /* Build a field's rendered rows (array of <Text>) mirroring the JSX. Returns [] if the field is empty. */
  const fieldRows = (record, f) => {
    const label = FIELD_LABELS[f] || f;
    const val = resolveField(record, f);
    const rows = [];
    if (DATE_FIELDS.includes(f)) {
      const d = formatDate(val); if (!d) return { label, rows: [] };
      rows.push(numberedValue(1, d, 'd'));
    } else if (BOOLEAN_FIELDS.includes(f)) {
      if (!hasVal(val)) return { label, rows: [] };
      rows.push(numberedValue(1, typeof val === 'boolean' ? (val ? 'Yes' : 'No') : fmtVal(val), 'b'));
    } else if (ARRAY_FIELDS.includes(f)) {
      const arr = (Array.isArray(val) ? val : []).filter(hasVal); if (arr.length === 0) return { label, rows: [] };
      arr.forEach((it, i) => rows.push(numberedValue(i + 1, fmtVal(it), `a-${i}`)));
    } else if (OBJECT_ARRAY_FIELDS.includes(f)) {
      const recs = (Array.isArray(val) ? val : []).filter(r => r && (r.recommendation || r.date)); if (recs.length === 0) return { label, rows: [] };
      let n = 0; let lastDate = null;
      recs.forEach((r, i) => { const d = (r.date || '').trim(); if (d && d !== lastDate) { rows.push(<Text key={`rd-${i}`} style={styles.subLabel}>{safeString(d)}</Text>); lastDate = d; } rows.push(numberedValue(++n, (r.recommendation || '').trim(), `r-${i}`)); });
    } else if (OBJECT_FIELDS.includes(f)) {
      if (!hasVal(val) || isScalar(val)) return { label, rows: [] };
      const orows = []; Object.entries(val).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => objectRows(humanizeKey(k), v, 0, orows));
      let n = 0;
      orows.forEach((r, i) => { if (r.t === 'sub') rows.push(<Text key={`o-${i}`} style={[styles.subLabel, { marginLeft: r.depth * 10 }]}>{r.text}</Text>); else rows.push(<Text key={`o-${i}`} style={[styles.value, { marginLeft: (r.depth || 0) * 10 }]}>{`${++n}. ${r.label ? r.label + ': ' : ''}${r.text}`}</Text>); });
    } else if (SENTENCE_FIELDS.includes(f)) {
      if (!hasVal(val)) return { label, rows: [] };
      sentenceRows(val).forEach((r, i) => { if (r.t === 'sub') rows.push(<Text key={`s-${i}`} style={styles.subLabel}>{safeString(r.text)}</Text>); else rows.push(numberedValue(r.num, r.text, `s-${i}`)); });
    } else {
      if (!hasVal(val)) return { label, rows: [] };
      rows.push(numberedValue(1, fmtVal(val), 'v'));
    }
    return { label, rows };
  };

  const renderRecord = (record, idx) => {
    const sectionEls = [];
    Object.keys(SECTION_FIELDS).forEach(sid => {
      const title = SECTION_TITLES[sid];
      const blocks = [];
      SECTION_FIELDS[sid].forEach(f => {
        const { label, rows } = fieldRows(record, f);
        if (rows.length === 0) return;
        const singleName = label.toLowerCase() === title.toLowerCase();
        blocks.push({ label, rows, singleName });
      });
      if (blocks.length === 0) return;
      sectionEls.push(
        <View key={sid} style={styles.section}>
          {blocks.map((b, i) => (
            <View key={i} style={styles.fieldGroup} wrap={b.rows.length > 8}>
              {i === 0 && <Text style={styles.sectionTitle}>{title}</Text>}
              {!b.singleName && <Text style={styles.fieldLabel}>{safeString(b.label)}</Text>}
              {b.rows}
            </View>
          ))}
        </View>
      );
    });

    return (
      <View key={idx} style={styles.recordContainer} break={idx > 0}>
        <View style={styles.recordHeader} wrap={false}>
          <Text style={styles.recordTitle}>{`Dialysis Planning ${idx + 1}`}</Text>
        </View>
        {sectionEls}
      </View>
    );
  };

  return (
    <Document title="Dialysis Planning">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Dialysis Planning</Text></View>
        {records.map((record, idx) => renderRecord(record, idx))}
      </Page>
    </Document>
  );
};

export default DialysisPlanningDocumentPDFTemplate;

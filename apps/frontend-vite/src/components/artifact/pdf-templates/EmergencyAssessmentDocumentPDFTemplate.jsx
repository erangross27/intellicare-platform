import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* Box-free B&W LETTER canonical (memory 6a2d6af6 + 6a45e766 item 9): no boxes/backgrounds — the
   structure is carried by horizontal underline rules (documentTitle 2pt, recordTitle/sectionTitle
   1pt black, fieldLabel 0.5pt #999). Mirrors the JSX SECTION_FIELDS order exactly. */
const styles = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 48, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.4, color: '#333333', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 18 },
  recordContainer: { marginBottom: 6 },
  recordHeadWrap: {},
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 10 },
  section: { marginBottom: 10 },
  fieldGroup: { marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 8, marginTop: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', marginBottom: 4, marginTop: 6 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#333333', marginTop: 4, marginBottom: 2 },
  listItem: { fontSize: 14, color: '#333333', marginBottom: 3, paddingLeft: 8, lineHeight: 1.35 },
  noDataText: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 40 },
});

/* Fixed-choice enums — mirror the JSX so the PDF shows the canonical option casing. */
const ENUM_OPTIONS = {
  triageLevel: ['ESI Level 1 (Resuscitation)', 'ESI Level 2 (Emergent)', 'ESI Level 3 (Urgent)', 'ESI Level 4 (Less Urgent)', 'ESI Level 5 (Non-Urgent)'],
  arrivalMode: ['EMS/Ambulance', 'Ambulatory / Walk-in', 'Private Vehicle', 'Wheelchair', 'Helicopter', 'Police', 'Public Transport', 'Air Transport'],
};
const enumCanonical = (fn, cur) => { const base = ENUM_OPTIONS[fn] || []; const hit = base.find(o => o.toLowerCase() === String(cur ?? '').toLowerCase()); return hit || String(cur ?? ''); };

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try { const d = new Date(dateStr.$date || dateStr); if (isNaN(d.getTime())) return String(dateStr); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(dateStr); }
};
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  return String(val);
};
const keyToLabel = (key) => String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/^./, s => s.toUpperCase()).trim();

/* ═══ sentence rendering — mirrors the JSX splitBySentence → parseLabel → comma-split ═══ */
const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};
const parseLabel = (text) => {
  const m = String(text || '').match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  return m ? { isLabeled: true, label: m[1].trim(), value: m[2].trim() } : { isLabeled: false, label: '', value: text || '' };
};
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (text[i + 1] && text[i + 1] !== ' ') { current += ch; continue; }                 // no-space comma
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }                           // ", and/or …"
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }                      // "… and/or ,"
      if (/\d\s*$/.test(current) && /^\d{4}\b/.test(rest)) { current += ch; continue; }       // date "Month D, YYYY"
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
// Findings kept WHOLE (unlabeled ECG-lead list "II, III, aVF" must not shatter). Plan/Notes still split.
const WHOLE_UNLABELED_FIELDS = new Set(['findings']);
const sentenceRows = (text, fn) => {
  const out = []; let n = 1;
  const whole = WHOLE_UNLABELED_FIELDS.has(fn);
  splitBySentence(String(text || '')).forEach(s => {
    const p = parseLabel(s);
    if (p.isLabeled) {
      out.push({ sub: true, text: p.label });
      const items = splitByComma(p.value);
      if (items.length >= 2) items.forEach(it => out.push({ text: `${n++}. ${it.replace(/[;.]+$/, '').trim()}` }));
      else out.push({ text: `${n++}. ${p.value}` });
    } else {
      const items = whole ? [] : splitByComma(String(s).replace(/[;.]+$/, '').trim());
      if (items.length >= 2) items.forEach(it => out.push({ text: `${n++}. ${it}` }));
      else out.push({ text: `${n++}. ${s}` });
    }
  });
  return out;
};

/* ═══ recursive object (results) → sub-label + numbered value rows ═══ */
const isScalar = (v) => v === null || typeof v !== 'object';
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const objectRows = (obj) => {
  const out = [];
  const walk = (label, value) => {
    if (isEmptyDeep(value)) return;
    if (isScalar(value)) { out.push({ sub: true, text: label }); out.push({ text: `1. ${safeString(value)}` }); return; }
    out.push({ sub: true, text: label });
    Object.entries(value).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v)).forEach(([k, v]) => walk(keyToLabel(k), v));
  };
  Object.entries(obj).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v)).forEach(([k, v]) => walk(keyToLabel(k), v));
  return out;
};

const EmergencyAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.emergency_assessment) return inputData[0].emergency_assessment;
      return inputData;
    }
    if (inputData.emergency_assessment) return inputData.emergency_assessment;
    return [inputData];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Emergency Assessment</Text>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  /* A field group = a wrap=false glue unit; the section title rides inside the FIRST visible field. */
  const renderField = (key, label, rows, showLabel, sectionTitle) => {
    const groupSize = rows.length + (showLabel ? 1 : 0) + (sectionTitle ? 1 : 0);
    return (
      <View key={key} style={styles.fieldGroup} wrap={groupSize > 8 ? true : false}>
        {sectionTitle ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null}
        {showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        {rows.map((r, i) => (r.sub ? <Text key={i} style={styles.subLabel}>{r.text}</Text> : <Text key={i} style={styles.listItem}>{r.text}</Text>))}
      </View>
    );
  };

  const buildSections = (record) => {
    const sections = [];
    const scalar = (label, value) => ({ label, showLabel: true, rows: [{ text: `1. ${value}` }] });

    // 1. Session Information
    const sess = [];
    if (record.date) sess.push(scalar('Date', formatDate(record.date)));
    if (record.provider) sess.push(scalar('Provider', safeString(record.provider)));
    if (record.facility) sess.push(scalar('Facility', safeString(record.facility)));
    if (record.status) sess.push(scalar('Status', safeString(record.status)));
    if (sess.length) sections.push({ title: 'Session Information', fields: sess });

    // 2. Triage & Arrival
    const triage = [];
    if (record.triageLevel) triage.push(scalar('Triage Level', enumCanonical('triageLevel', record.triageLevel)));
    if (record.arrivalMode) triage.push(scalar('Arrival Mode', enumCanonical('arrivalMode', record.arrivalMode)));
    if (record.chiefComplaintDuration) triage.push(scalar('Chief Complaint Duration', safeString(record.chiefComplaintDuration)));
    if (triage.length) sections.push({ title: 'Triage & Arrival', fields: triage });

    // 3. Primary Survey
    const ps = record.primarySurvey && typeof record.primarySurvey === 'object' ? record.primarySurvey : {};
    const psFields = [];
    [['airway', 'Airway'], ['breathing', 'Breathing'], ['circulation', 'Circulation'], ['disability', 'Disability'], ['exposure', 'Exposure']].forEach(([k, lbl]) => {
      if (ps[k] !== undefined && ps[k] !== null && String(ps[k]).trim() !== '') psFields.push(scalar(lbl, safeString(ps[k])));
    });
    if (psFields.length) sections.push({ title: 'Primary Survey', fields: psFields });

    // 4. Trauma Assessment (dynamic keys)
    const ta = record.traumaAssessment && typeof record.traumaAssessment === 'object' ? record.traumaAssessment : {};
    const taFields = [];
    Object.entries(ta).filter(([k, v]) => k !== '_id' && v !== null && v !== undefined && String(v).trim() !== '').forEach(([k, v]) => taFields.push(scalar(keyToLabel(k), safeString(v))));
    if (taFields.length) sections.push({ title: 'Trauma Assessment', fields: taFields });

    // 5. Resuscitation
    const res = record.resuscitation && typeof record.resuscitation === 'object' ? record.resuscitation : {};
    const resFields = [];
    if (res.ivAccess) resFields.push(scalar('IV Access', safeString(res.ivAccess)));
    [['fluids', 'Fluids'], ['medications', 'Medications'], ['procedures', 'Procedures']].forEach(([k, lbl]) => {
      const arr = Array.isArray(res[k]) ? res[k].filter(Boolean) : [];
      if (arr.length) resFields.push({ label: lbl, showLabel: true, rows: arr.map((it, i) => ({ text: `${i + 1}. ${safeString(it)}` })) });
    });
    if (resFields.length) sections.push({ title: 'Resuscitation', fields: resFields });

    // 6. Disposition
    const disp = record.disposition && typeof record.disposition === 'object' ? record.disposition : {};
    const dispFields = [];
    if (disp.outcome) dispFields.push(scalar('Outcome', safeString(disp.outcome)));
    if (disp.admitTo) dispFields.push(scalar('Admit To', safeString(disp.admitTo)));
    if (dispFields.length) sections.push({ title: 'Disposition', fields: dispFields });

    // 7. Results (recursive object) — single-name (label == section title → no field label)
    if (record.results && typeof record.results === 'object' && !isEmptyDeep(record.results)) {
      const rows = objectRows(record.results);
      if (rows.length) sections.push({ title: 'Results', fields: [{ label: 'Results', showLabel: false, rows }] });
    }

    // 8-10. Findings / Assessment / Plan (sentence, single-name)
    [['findings', 'Findings'], ['assessment', 'Assessment'], ['plan', 'Plan']].forEach(([k, lbl]) => {
      if (record[k] && String(record[k]).trim()) {
        const rows = sentenceRows(record[k], k);
        if (rows.length) sections.push({ title: lbl, fields: [{ label: lbl, showLabel: false, rows }] });
      }
    });

    // 11. Recommendations (date-grouped)
    const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(r => !isEmptyDeep(r)) : [];
    if (recs.length) {
      const rows = []; let lastDate = null; let n = 1;
      recs.forEach(r => {
        const rec = (r?.recommendation || '').trim(); const d = (r?.date || '').trim();
        if (d !== lastDate) { if (d) rows.push({ sub: true, text: d }); lastDate = d; n = 1; }
        rows.push({ text: `${n++}. ${rec}` });
      });
      sections.push({ title: 'Recommendations', fields: [{ label: 'Recommendations', showLabel: false, rows }] });
    }

    // 12. Notes (sentence, single-name)
    if (record.notes && String(record.notes).trim()) {
      const rows = sentenceRows(record.notes, 'notes');
      if (rows.length) sections.push({ title: 'Notes', fields: [{ label: 'Notes', showLabel: false, rows }] });
    }

    return sections;
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Emergency Assessment</Text>
        {records.map((record, index) => {
          const sections = buildSections(record);
          return (
            <View key={index} style={styles.recordContainer} break={index > 0}>
              <View style={styles.recordHeadWrap} wrap={false}>
                <Text style={styles.recordTitle}>Emergency Assessment {index + 1}</Text>
              </View>
              {sections.map((sec, si) => (
                <View key={si} style={styles.section}>
                  {sec.fields.map((fld, fi) => renderField(`${si}-${fi}`, fld.label, fld.rows, fld.showLabel, fi === 0 ? sec.title : null))}
                </View>
              ))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default EmergencyAssessmentDocumentPDFTemplate;

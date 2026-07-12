/**
 * PreconceptionCounselingDocumentPDFTemplate.jsx
 * Box-free — Helvetica — LETTER size — preconception counseling
 * Collection: preconception_counseling
 *
 * Bare underlined labels (no boxes): documentTitle / sectionTitle / fieldLabel carry their own
 * borderBottom rule; anti-orphan glue keeps each section title with its first field.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, color: '#000000', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 18 },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 14 },
  recordMetaRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  recordMeta: { fontSize: 12, color: '#555555', marginRight: 16 },
  recordTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', marginBottom: 3 },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  fieldBox: { marginBottom: 10 },
  separator: { marginTop: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#d1d5db', borderBottomStyle: 'solid' },
  noDataText: { fontSize: 14, color: '#555555', textAlign: 'center', marginTop: 40 },
});

/* ======= CONFIG (mirrors the JSX SECTION_TITLES / FIELD_LABELS) ======= */
const SECTION_TITLES = {
  'provider-info': 'Provider Information',
  'preconception-status': 'Preconception Status',
  'medication-adjustments': 'Medication Adjustments',
  'folic-acid': 'Folic Acid',
  'risks-discussed': 'Risks Discussed',
  'findings': 'Findings',
  'assessment': 'Assessment',
  'plan': 'Plan',
  'recommendations': 'Recommendations',
  'results': 'Results',
  'notes': 'Notes',
};

const FIELD_LABELS = {
  provider: 'Provider', facility: 'Facility', planning: 'Planning', targetHbA1c: 'Target HbA1c',
  contraceptionDiscussed: 'Contraception Discussed', geneticCounseling: 'Genetic Counseling',
  folicAcidDose: 'Dose', results: 'Results',
};

const sameAsTitle = (label, sid) => (SECTION_TITLES[sid] || '') === label;

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
  let s;
  if (typeof val === 'string') s = val;
  else if (typeof val === 'number') s = String(val);
  else if (typeof val === 'boolean') s = val ? 'Yes' : 'No';
  else if (typeof val === 'object' && val.$date) return formatDate(val.$date);
  else s = String(val);
  /* printable-only scrub (Helvetica has no × glyph; normalize smart punctuation) */
  return s.replace(/×/g, 'x').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/…/g, '...');
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

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))(?<!\b[A-Z])(?<!\d)[.;](?:\s+)/).map(s => s.replace(/^\d+\.\s+/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
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
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '') && !/^\s*\d{4}\b/.test(text.slice(i + 1))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

const humanizeKey = (key) => String(key).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());

const flattenResults = (obj, prefix = '') => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const rows = [];
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    const label = prefix ? `${prefix} - ${humanizeKey(k)}` : humanizeKey(k);
    if (v === null || v === undefined || v === '') return;
    if (typeof v === 'object' && !Array.isArray(v) && !v.$date) {
      rows.push(...flattenResults(v, label));
    } else if (Array.isArray(v)) {
      const joined = v.filter((x) => x !== null && x !== undefined && x !== '').map((x) => safeString(x)).join(', ');
      if (joined) rows.push({ label, value: joined });
    } else {
      rows.push({ label, value: safeString(v) });
    }
  });
  return rows;
};

/* stringValueElements: mirrors the JSX renderStringField / formatSentenceFieldLines.
   Multi-sentence (or a single "Label: a, b, c") → numbered listItems (+ sub-label);
   single value → one fieldValue. */
const stringValueElements = (strVal) => {
  const s = safeString(strVal);
  const sentences = splitBySentence(s);
  const pw = parseLabel(s);
  const singleLabeled = sentences.length === 1 && pw.isLabeled && splitByComma(pw.value).length >= 2;
  if (sentences.length <= 1 && !singleLabeled) {
    return [<Text style={styles.fieldValue}>{s}</Text>];
  }
  const els = [];
  let n = 1;
  const src = singleLabeled ? [s] : sentences;
  src.forEach((sent) => {
    const parsed = parseLabel(sent);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      els.push(<Text style={styles.nestedSubtitle}>{safeString(parsed.label)}</Text>);
      if (parts.length >= 2) {
        parts.forEach((p) => els.push(<Text style={styles.listItem}>{n++}. {safeString(p)}</Text>));
      } else {
        els.push(<Text style={styles.listItem}>{n++}. {safeString(parsed.value)}</Text>);
      }
    } else {
      els.push(<Text style={styles.listItem}>{n++}. {safeString(sent)}</Text>);
    }
  });
  return els;
};

/* Anti-orphan: glue the section title to its first body element (wrap={false}), rest flow. */
const renderSection = (title, elements) => {
  const els = elements.filter(Boolean);
  if (els.length === 0) return null;
  const [first, ...rest] = els;
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {first}
      </View>
      {rest.map((el, i) => <React.Fragment key={i}>{el}</React.Fragment>)}
    </View>
  );
};

const PreconceptionCounselingDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    records = data;
  } else if (data?.preconception_counseling && Array.isArray(data.preconception_counseling)) {
    records = data.preconception_counseling;
  } else if (data?.documentData) {
    const docData = data.documentData;
    if (Array.isArray(docData)) {
      records = docData;
    } else if (docData?.preconception_counseling) {
      records = Array.isArray(docData.preconception_counseling) ? docData.preconception_counseling : [docData.preconception_counseling];
    } else if (docData && typeof docData === 'object') {
      records = [docData];
    }
  } else if (data && typeof data === 'object') {
    records = [data];
  }

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.noDataText}>No preconception counseling records available</Text>
        </Page>
      </Document>
    );
  }

  /* scalar field element: bare underlined label (unless it duplicates the section title) + value */
  const scalarField = (sid, fn, value) => {
    const label = FIELD_LABELS[fn] || fn;
    return (
      <View style={styles.fieldBox}>
        {!sameAsTitle(label, sid) && <Text style={styles.fieldLabel}>{label}</Text>}
        {stringValueElements(value)}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Preconception Counseling</Text>

        {records.map((record, idx) => {
          const sections = [];

          /* 1. Provider Information */
          {
            const els = [];
            if (hasVal(record.provider)) els.push(scalarField('provider-info', 'provider', record.provider));
            if (hasVal(record.facility)) els.push(scalarField('provider-info', 'facility', record.facility));
            sections.push(renderSection('Provider Information', els));
          }

          /* 2. Preconception Status */
          {
            const els = [];
            if (hasVal(record.planning)) els.push(scalarField('preconception-status', 'planning', record.planning ? 'Yes' : 'No'));
            if (hasVal(record.targetHbA1c)) els.push(scalarField('preconception-status', 'targetHbA1c', record.targetHbA1c));
            if (hasVal(record.contraceptionDiscussed)) els.push(scalarField('preconception-status', 'contraceptionDiscussed', record.contraceptionDiscussed ? 'Yes' : 'No'));
            if (hasVal(record.geneticCounseling)) els.push(scalarField('preconception-status', 'geneticCounseling', record.geneticCounseling ? 'Yes' : 'No'));
            sections.push(renderSection('Preconception Status', els));
          }

          /* 3. Medication Adjustments (label duplicates title → no field label) */
          {
            const meds = Array.isArray(record.medicationAdjustments) ? record.medicationAdjustments.filter(Boolean) : [];
            const els = meds.map((med) => (
              <View style={styles.fieldBox}>
                <Text style={styles.nestedSubtitle}>{safeString(med.medication || med.name || '')}</Text>
                <Text style={styles.fieldValue}>{safeString(med.change || med.action || med.adjustment || '')}</Text>
              </View>
            ));
            sections.push(renderSection('Medication Adjustments', els));
          }

          /* 4. Folic Acid */
          {
            const els = [];
            if (hasVal(record.folicAcidDose)) els.push(scalarField('folic-acid', 'folicAcidDose', record.folicAcidDose));
            sections.push(renderSection('Folic Acid', els));
          }

          /* 5. Risks Discussed (label duplicates title) */
          {
            const risks = Array.isArray(record.risksDiscussed) ? record.risksDiscussed.filter(Boolean) : [];
            const els = risks.map((risk, i) => <Text style={styles.listItem}>{i + 1}. {safeString(risk)}</Text>);
            sections.push(renderSection('Risks Discussed', els));
          }

          /* 6-8. Findings / Assessment / Plan (label duplicates title → numbered sentences) */
          if (hasVal(record.findings)) sections.push(renderSection('Findings', stringValueElements(record.findings)));
          if (hasVal(record.assessment)) sections.push(renderSection('Assessment', stringValueElements(record.assessment)));
          if (hasVal(record.plan)) sections.push(renderSection('Plan', stringValueElements(record.plan)));

          /* 9. Recommendations (array of strings/objects) */
          {
            const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(Boolean) : [];
            const els = [];
            recs.forEach((rec, i) => {
              const recText = typeof rec === 'string' ? rec : safeString(rec.recommendation);
              const recDate = typeof rec === 'object' && rec.date ? formatDate(rec.date) : null;
              if (recDate) els.push(<Text style={styles.recordMeta}>{recDate}</Text>);
              els.push(<Text style={styles.listItem}>{i + 1}. {recText}</Text>);
            });
            sections.push(renderSection('Recommendations', els));
          }

          /* 10. Results (dynamic-key object, recursively flattened) */
          {
            const rows = flattenResults(record.results);
            const els = rows.map((r) => (
              <View style={styles.fieldBox}>
                <Text style={styles.fieldLabel}>{r.label}</Text>
                <Text style={styles.fieldValue}>{r.value}</Text>
              </View>
            ));
            sections.push(renderSection('Results', els));
          }

          /* 11. Notes */
          if (hasVal(record.notes)) sections.push(renderSection('Notes', stringValueElements(record.notes)));

          return (
            <View key={idx} style={styles.recordContainer}>
              <View style={styles.recordHeader}>
                {(hasVal(record.date) || hasVal(record.status)) && (
                  <View style={styles.recordMetaRow}>
                    {hasVal(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
                    {hasVal(record.status) && <Text style={styles.recordMeta}>Status: {safeString(record.status)}</Text>}
                  </View>
                )}
                <Text style={styles.recordTitle}>Preconception Counseling {idx + 1}</Text>
              </View>

              {sections.filter(Boolean).map((s, i) => <React.Fragment key={i}>{s}</React.Fragment>)}

              {idx < records.length - 1 && <View style={styles.separator} />}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default PreconceptionCounselingDocumentPDFTemplate;

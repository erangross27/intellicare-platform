/**
 * AmnioticFluidIndexCurrentDocumentPDFTemplate.jsx
 * June 2026 — Helvetica — A4 — BLACK & WHITE only (#000000 text, #ffffff bg). Box-free.
 * Collection: amniotic_fluid_index_current.
 *
 * Mirrors the JSX: buildUnits (period-split sentences; clausesOf = semicolon-first for ALL text,
 * comma >=3 ONLY for LABELED values, paren-aware + number-guard) → labeled values become sub-labels,
 * clauses become numbered rows. Rule #74 per-field wrap-gating (section title inside first field View);
 * Rule #75 break per record. Provider & Facility is its own section (not header meta).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 13, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14 },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' },
  recordContainer: { marginBottom: 24 },
  recordHeader: { marginBottom: 16, paddingBottom: 8 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 13, color: '#000000', marginTop: 3 },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2, textTransform: 'uppercase' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 1 },
  value: { fontSize: 13, lineHeight: 1.5, color: '#000000', marginBottom: 1 },
  listItem: { fontSize: 13, lineHeight: 1.5, color: '#000000', marginBottom: 1, paddingLeft: 10 },
  nested: { marginLeft: 10, marginTop: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 16, color: '#000000' },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 11, color: '#000000' },
});

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'afi-measurement': 'AFI Measurement',
  'quadrants-section': 'Quadrants',
  'interpretation-section': 'Interpretation',
  'provider-facility': 'Provider & Facility',
  'notes-section': 'Notes',
};
const FIELD_LABELS = {
  date: 'Date', gestationalAge: 'Gestational Age', afiValue: 'AFI Value (cm)', interpretation: 'Interpretation',
  mvp: 'MVP (cm)', priorAfi: 'Prior AFI (cm)', clinicalSignificance: 'Clinical Significance',
  recommendations: 'Recommendations', sonographer: 'Sonographer', obstetrician: 'Obstetrician',
  facility: 'Facility', notes: 'Notes', quadrants: 'Quadrants',
};
const SECTION_FIELDS = {
  'afi-measurement': ['afiValue', 'mvp', 'priorAfi', 'gestationalAge'],
  'quadrants-section': ['quadrants'],
  'interpretation-section': ['interpretation', 'clinicalSignificance', 'recommendations'],
  'provider-facility': ['obstetrician', 'sonographer', 'facility'],
  'notes-section': ['notes'],
};
const SECTION_ORDER = ['afi-measurement', 'quadrants-section', 'interpretation-section', 'provider-facility', 'notes-section'];
const DATE_FIELDS = ['date'];
const NUMBER_UNIT_FIELDS = ['afiValue'];
const OBJECT_FIELDS = ['quadrants'];

const KEY_OVERRIDES = {
  afi: 'AFI', mvp: 'MVP', sdp: 'SDP', ul: 'Upper Left', ur: 'Upper Right', ll: 'Lower Left', lr: 'Lower Right',
  q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4',
};
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

/* ═══════ SHARED TEXT PARSERS (mirror the JSX exactly) ═══════ */
const STRIP = (s) => String(s == null ? '' : s).replace(/[;.\s]+$/, '').trim();
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,80}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))\.(?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitOnChar = (text, sep) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === sep && depth === 0) {
      if (sep === ',' && /\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || '')) { cur += ch; continue; }
      const t = cur.trim(); if (t) out.push(t); cur = '';
    } else { cur += ch; }
  }
  const t = cur.trim(); if (t) out.push(t);
  return out;
};
// Semicolon = explicit list separator (always safe). Comma split ONLY for LABELED values (>=3) —
// never comma-split unlabeled narrative ("Riverside Women's Health Center, Division ..." stays whole).
const clausesOf = (base, isLabeled) => {
  const semi = splitOnChar(base, ';');
  if (semi.length >= 2) return { sep: '; ', items: semi };
  if (isLabeled) { const c = splitOnChar(base, ','); if (c.length >= 3) return { sep: ', ', items: c }; }
  return { sep: null, items: [String(base || '').trim()] };
};
// Decompose ONE sentence into {label, sep, items}. A semicolon list (>=2) is treated as a list FIRST
// (each clause kept whole, no leading-label hoist) — so "Date1: m1; Date2: m2; Date3: m3" yields
// 3 symmetric rows, not label=Date1 + asymmetric rows. Otherwise parseLabel → clausesOf (labeled-gated comma).
const segmentSentence = (sentence) => {
  const semi = splitOnChar(sentence, ';');
  if (semi.length >= 2) return { label: null, sep: '; ', items: semi.map(s => s.trim()) };
  const p = parseLabel(sentence);
  const { sep, items } = clausesOf(p.isLabeled ? p.value : sentence, p.isLabeled);
  return { label: p.isLabeled ? p.label : null, sep, items };
};
const buildUnits = (value) => {
  const sentences = splitBySentence(String(value || ''));
  const units = [];
  sentences.forEach((sentence) => {
    const { label, items } = segmentSentence(sentence);
    const rows = items.map((t) => STRIP(t));
    const last = units[units.length - 1];
    if (!label && last && !last.label) last.rows.push(...rows);
    else units.push({ label, rows });
  });
  return units;
};

/* recursive object node: label = bold heading; value = plain line below (box-free) */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.value}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

/* count rows for the wrap heuristic */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* Rule #74 (per-field gating): render a field as wrap-gated View(s) — EACH View is one wrap unit.
   sectionTitle goes INSIDE the first View (isFirst) — never a sibling. Returns an ARRAY of Views.
   @react-pdf v4: wrap={rows>8} boolean (undefined ≡ false). */
const renderField = (record, field, sectionTitle, isFirst) => {
  const val = record[field];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[field] || field;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (DATE_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>{formatDate(val)}</Text>
      </View>
    )];
  }

  if (NUMBER_UNIT_FIELDS.includes(field)) {
    /* scalar measurement (e.g. "14.2 cm") — bare value, NOT a numbered clause list (parity w/ JSX number-stepper + Copy) */
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.value}>{fmtVal(val)}</Text>
      </View>
    )];
  }

  if (OBJECT_FIELDS.includes(field)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => {
      const rows = countRows(v);
      return (
        <View key={`${field}-${k}`} style={styles.fieldGroup} wrap={rows > 8}>
          {i === 0 ? titleNode : null}
          {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {renderObjectNode(humanizeKey(k), v, `${field}-${k}`, 1)}
        </View>
      );
    });
  }

  /* string — clause units (mirror JSX buildUnits) */
  const units = buildUnits(fmtVal(val));
  if (units.length === 0) return [];
  const totalRows = units.reduce((a, u) => a + u.rows.length, 0);
  return [(
    <View key={field} style={styles.fieldGroup} wrap={totalRows > 8}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {units.map((u, uIdx) => (
        <View key={uIdx}>
          {u.label && <Text style={styles.subLabel}>{u.label}</Text>}
          {u.rows.map((r, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {r}</Text>))}
        </View>
      ))}
    </View>
  )];
};

const AmnioticFluidIndexCurrentDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.amniotic_fluid_index_current) records = Array.isArray(data[0].amniotic_fluid_index_current) ? data[0].amniotic_fluid_index_current : [data[0].amniotic_fluid_index_current];
    else records = data;
  } else if (data?.amniotic_fluid_index_current) records = Array.isArray(data.amniotic_fluid_index_current) ? data.amniotic_fluid_index_current : [data.amniotic_fluid_index_current];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.amniotic_fluid_index_current) records = Array.isArray(dd.amniotic_fluid_index_current) ? dd.amniotic_fluid_index_current : [dd.amniotic_fluid_index_current]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (<Document><Page size="A4" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Amniotic Fluid Index</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Amniotic Fluid Index</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Amniotic Fluid Index ${String(record._recordNumber || idx + 1)}`}</Text>
              {hasVal(record.date) && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}
            </View>

            {/* Rule #74 per-field gating: section View only spaces & flows; each field is its own
                wrap-gated unit with the sectionTitle inside the first present field's View. */}
            {SECTION_ORDER.map((sid) => {
              const fields = SECTION_FIELDS[sid];
              const presentFields = fields.filter(f => hasVal(record[f]));
              if (presentFields.length === 0) return null;
              const title = SECTION_TITLES[sid];
              return (
                <View key={sid} style={styles.section}>
                  {presentFields.flatMap((f, fi) => renderField(record, f, title, fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

export default AmnioticFluidIndexCurrentDocumentPDFTemplate;

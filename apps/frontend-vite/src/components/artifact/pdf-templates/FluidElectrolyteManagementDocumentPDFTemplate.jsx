/**
 * FluidElectrolyteManagementDocumentPDFTemplate.jsx
 * Box-free B&W LETTER (canonical, memory 6a2d6af6) — mirrors the JSX: real record.date (never createdAt),
 * a "Record Information" section (date/provider/facility, moved off the header pills), values numbered
 * ('1.' even singles), narratives split on [.;] (labeled → sub-label + numbered comma items), OBJECT fields
 * (bloodPressure/acidosisManagement/hyperkalemiaManagement/results) rendered recursively STACKED, ARRAY fields
 * (recommendations date-grouped; diureticRegimen per-item). Rule #74: each field is ONE wrap={false} atomic View
 * with the sectionTitle riding INSIDE the first present field's View. Single-name label gate. Static PHI footer.
 * Collection: fluid_electrolyte_management
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 16 },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 2 },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nested: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 0.5, borderLeftColor: '#999999', marginTop: 2 },
  recDate: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8 },
  footerText: { fontSize: 10, color: '#666666' },
});

const SECTION_ORDER = ['record-info', 'volume-status', 'electrolytes', 'management', 'assessment-section', 'notes-status'];
const SECTION_TITLES = {
  'record-info': 'Record Information',
  'volume-status': 'Volume Status',
  'electrolytes': 'Electrolytes',
  'management': 'Management',
  'assessment-section': 'Assessment',
  'notes-status': 'Notes & Status',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility',
  volumeStatus: 'Volume Status', dryWeight: 'Dry Weight', edema: 'Edema', bloodPressure: 'Blood Pressure',
  sodium: 'Sodium', potassium: 'Potassium', bicarbonate: 'Bicarbonate', chloride: 'Chloride',
  acidosisManagement: 'Acidosis Management', hyperkalemiaManagement: 'Hyperkalemia Management', diureticRegimen: 'Diuretic Regimen',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan', results: 'Results', recommendations: 'Recommendations',
  notes: 'Notes', status: 'Status',
};
const SECTION_FIELDS = {
  'record-info': ['date', 'provider', 'facility'],
  'volume-status': ['volumeStatus', 'dryWeight', 'edema', 'bloodPressure'],
  'electrolytes': ['sodium', 'potassium', 'bicarbonate', 'chloride'],
  'management': ['acidosisManagement', 'hyperkalemiaManagement', 'diureticRegimen'],
  'assessment-section': ['findings', 'assessment', 'plan', 'results', 'recommendations'],
  'notes-status': ['notes', 'status'],
};
const DATE_FIELDS = ['date'];
const COMMA_FIELDS = ['edema', 'sodium', 'potassium', 'bicarbonate', 'chloride'];
const OBJECT_FIELDS = ['bloodPressure', 'acidosisManagement', 'hyperkalemiaManagement', 'results'];
const ARRAY_FIELDS = ['diureticRegimen', 'recommendations'];

const KEY_OVERRIDES = { bp: 'BP', sbp: 'SBP', dbp: 'DBP', mg: 'Mg', meq: 'mEq', iv: 'IV', po: 'PO', egfr: 'eGFR', gfr: 'GFR' };
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (/\s/.test(String(key))) return String(key); // already human-readable — don't mangle
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

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
const isRecommendationArray = (v) => Array.isArray(v) && v.some(x => x && typeof x === 'object' && ('recommendation' in x));
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'number' ? String(val) : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
  str = str.replace(/[µμ]m/g, 'um').replace(/[µμ]g/g, 'mcg').replace(/[µμ]/g, 'u').replace(/°/g, ' deg').replace(/±/g, '+/-')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const parseLabel = (text) => { if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' }; const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: text }; };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
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
/* splitLeafCommas: paren-aware, splits ONLY on a comma followed by whitespace (mirrors the JSX object-leaf split) */
const splitLeafCommas = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && /\s/.test(text[i + 1] || '')) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* mirror the JSX/copy: multi-sentence → labeled sub-group (subLabel + numbered comma items) or numbered unlabeled row */
const sentenceRows = (text) => {
  const strip = (x) => String(x).replace(/[;.]+$/, '').trim();
  const sentences = splitBySentence(text);
  const rows = []; let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      const parts = splitByComma(parsed.value);
      const items = parts.length >= 2 ? parts : [parsed.value];
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      let m = 1; items.forEach(it => rows.push({ type: 'item', text: safeString(strip(it)), num: m++ }));
    } else {
      rows.push({ type: 'item', text: safeString(strip(s)), num: n++ });
    }
  });
  return rows;
};

/* recursive object node: sub-label heading + numbered value line (STACKED, never "key: value") */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (isScalar(value)) {
    const items = splitLeafCommas(safeString(fmtScalar(value)));
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        {items.map((it, i) => <Text key={i} style={styles.value}>{i + 1}. {it}</Text>)}
      </View>
    );
  }
  if (Array.isArray(value)) {
    const items = value.filter(v => !isEmptyDeep(v));
    if (items.length === 0) return null;
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <View style={label ? styles.nested : undefined}>
          {items.map((v, i) => isScalar(v)
            ? <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(v))}</Text>
            : renderObjectNode('', v, `${keyPath}-${i}`, depth + 1))}
        </View>
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

/* Rule #74: render a field as wrap={false} atomic View(s); sectionTitle rides inside the first View. */
const renderField = (record, f, sectionTitle, isFirst) => {
  const val = record[f];
  if (!hasVal(val)) return [];
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.trim().toLowerCase() !== (sectionTitle || '').trim().toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{sectionTitle}</Text> : null;

  if (ARRAY_FIELDS.includes(f)) {
    if (isRecommendationArray(val)) {
      const recs = (Array.isArray(val) ? val : []).filter(r => (r?.recommendation || '').trim());
      if (recs.length === 0) return [];
      const groups = [];
      recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
      return [(
        <View key={f} style={styles.fieldGroup} wrap={false}>
          {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
          {groups.map((group, gIdx) => (
            <View key={gIdx}>
              {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
              {group.items.map((r, i) => (<Text key={i} style={styles.value}>{i + 1}. {safeString((r?.recommendation || '').trim())}</Text>))}
            </View>
          ))}
        </View>
      )];
    }
    const items = (Array.isArray(val) ? val : []).filter(it => !isEmptyDeep(it));
    if (items.length === 0) return [];
    return [(
      <View key={f} style={styles.fieldGroup} wrap={false}>
        {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {items.map((it, i) => isScalar(it)
          ? <Text key={i} style={styles.value}>{i + 1}. {safeString(fmtScalar(it))}</Text>
          : <View key={i} style={styles.nested}>{Object.entries(it).filter(([, v]) => !isEmptyDeep(v)).map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${f}-${i}-${k}`, 1))}</View>)}
      </View>
    )];
  }

  if (OBJECT_FIELDS.includes(f)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => (
      <View key={`${f}-${k}`} style={styles.fieldGroup} wrap={false}>
        {i === 0 ? titleNode : null}
        {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        {renderObjectNode(humanizeKey(k), v, `${f}-${k}`, 1)}
      </View>
    ));
  }

  let body;
  if (DATE_FIELDS.includes(f)) {
    body = <Text style={styles.value}>1. {formatDate(val)}</Text>;
  } else if (COMMA_FIELDS.includes(f)) {
    body = splitLeafCommas(safeString(val)).map((p, i) => <Text key={i} style={styles.value}>{i + 1}. {p}</Text>);
  } else {
    const rows = sentenceRows(safeString(val));
    body = rows.length > 1
      ? rows.map((r, i) => r.type === 'subtitle'
        ? <Text key={i} style={styles.subLabel}>{r.text}</Text>
        : <Text key={i} style={styles.value}>{r.num}. {r.text}</Text>)
      : <Text style={styles.value}>1. {safeString(val)}</Text>;
  }
  return [(
    <View key={f} style={styles.fieldGroup} wrap={false}>
      {titleNode}{showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  )];
};

const FluidElectrolyteManagementDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;
  let records = [];
  if (Array.isArray(templateData)) {
    if (templateData.length > 0 && templateData[0].fluid_electrolyte_management && Array.isArray(templateData[0].fluid_electrolyte_management)) records = templateData[0].fluid_electrolyte_management;
    else records = templateData;
  } else if (templateData && templateData.fluid_electrolyte_management) {
    records = Array.isArray(templateData.fluid_electrolyte_management) ? templateData.fluid_electrolyte_management : [templateData.fluid_electrolyte_management];
  } else if (templateData) {
    records = [templateData];
  }
  records = records.filter(r => r && typeof r === 'object');

  if (!records || records.length === 0) {
    return (
      <Document><Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fluid & Electrolyte Management</Text></View>
        <Text style={styles.emptyState}>No fluid & electrolyte management data available.</Text>
      </Page></Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Fluid & Electrolyte Management</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <Text style={styles.recordTitle}>{`Fluid & Electrolyte Management ${idx + 1}`}</Text>
            {SECTION_ORDER.map((sid) => {
              const vis = (SECTION_FIELDS[sid] || []).filter(f => hasVal(record[f]));
              if (vis.length === 0) return null;
              return (
                <View key={sid} style={styles.section}>
                  {vis.flatMap((f, fi) => renderField(record, f, SECTION_TITLES[sid], fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
        </View>
      </Page>
    </Document>
  );
};

export default FluidElectrolyteManagementDocumentPDFTemplate;

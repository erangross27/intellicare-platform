/**
 * DermatologyAssessmentDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: dermatology_assessment.
 *
 * BOX-FREE canonical (ConsultationNotes donor): page 14 / title 26 / recordTitle 19 /
 * sectionTitle 16 + 1pt black rule / fieldLabel & subLabel 13 + 0.5pt #999 rule / values 14.
 * Rule #74: each field is ONE wrap-gated <View> with BOOLEAN wrap (rows>8 → true, else false);
 * sectionTitle rides INSIDE the first present field's View (anti-orphan — never a sibling).
 * Every value row numbered ("1." even for single values). Single-name label skip.
 * OBJECT fields rendered recursively; ARRAY leaves → numbered items (never index keys);
 * string leaves / sentence values with >=3 guarded comma items → numbered rows.
 * SENTENCE fields: [.;] split + parseLabel — labeled → sub-label + rows (numbering restarts);
 * unlabeled rows continue the running count.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  fieldGroup: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  subLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  lesionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nested: { marginLeft: 10, marginTop: 2 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══════ CONSTANTS ═══════ */
const SECTION_TITLES = {
  'provider-details': 'Provider Details',
  scores: 'Severity Scores',
  'biopsy-results': 'Biopsy Results',
  phototherapy: 'Phototherapy',
  photography: 'Dermoscopic Photography',
  'melanoma-surveillance': 'Melanoma Surveillance Plan',
  'systemic-therapy': 'Systemic Therapy Initiation',
  results: 'Results',
  findings: 'Findings',
  assessment: 'Assessment',
  plan: 'Plan',
  recommendations: 'Recommendations',
  notes: 'Notes',
};
const FIELD_LABELS = {
  date: 'Date', provider: 'Provider', facility: 'Facility', type: 'Type', status: 'Status',
  pasiScore: 'PASI Score', scoradIndex: 'SCORAD Index', dlqi: 'DLQI',
  biopsyResults: 'Biopsy Results', phototherapy: 'Phototherapy',
  dermoscopicPhotography: 'Dermoscopic Photography', melanomaSurveillancePlan: 'Melanoma Surveillance Plan',
  systemicTherapyInitiation: 'Systemic Therapy Initiation', results: 'Results',
  findings: 'Findings', assessment: 'Assessment', plan: 'Plan',
  recommendations: 'Recommendations', notes: 'Notes',
};
const SECTION_FIELDS = {
  'provider-details': ['date', 'provider', 'facility', 'type', 'status'],
  scores: ['pasiScore', 'scoradIndex', 'dlqi'],
  'biopsy-results': ['biopsyResults'],
  phototherapy: ['phototherapy'],
  photography: ['dermoscopicPhotography'],
  'melanoma-surveillance': ['melanomaSurveillancePlan'],
  'systemic-therapy': ['systemicTherapyInitiation'],
  results: ['results'],
  findings: ['findings'],
  assessment: ['assessment'],
  plan: ['plan'],
  recommendations: ['recommendations'],
  notes: ['notes'],
};
const SECTION_ORDER = [
  'provider-details', 'scores', 'biopsy-results', 'phototherapy', 'photography',
  'melanoma-surveillance', 'systemic-therapy', 'results',
  'findings', 'assessment', 'plan', 'recommendations', 'notes',
];
const DATE_FIELDS = ['date'];
const NUMBER_FIELDS = ['pasiScore', 'scoradIndex', 'dlqi'];
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];
const OBJECT_FIELDS = ['biopsyResults', 'phototherapy', 'dermoscopicPhotography', 'melanomaSurveillancePlan', 'systemicTherapyInitiation', 'results'];
const OBJECT_ARRAY_FIELDS = ['recommendations'];
const LESION_SUB_FIELDS = ['morphology', 'size', 'distribution', 'color', 'dermoscopyFindings'];
const LESION_LABELS = { morphology: 'Morphology', size: 'Size', distribution: 'Distribution', color: 'Color', dermoscopyFindings: 'Dermoscopy Findings' };

const KEY_OVERRIDES = {
  pasi: 'PASI', scorad: 'SCORAD', dlqi: 'DLQI', uvb: 'UVB', uva: 'UVA', puva: 'PUVA',
  nbuvb: 'NB-UVB', med: 'MED', tbse: 'TBSE', ifMelanoma: 'If Melanoma', ifDysplasticNevus: 'If Dysplastic Nevus',
};
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key]; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };

/* ═══════ UTILS (B&W) ═══════ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};
const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const hasVal = (v) => !isEmptyDeep(v);
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; const raw = text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); const result = []; for (let i = 0; i < raw.length; i++) { if (/^\d{1,2}$/.test(raw[i]) && i + 1 < raw.length) { result.push(`${raw[i]}. ${raw[i + 1]}`); i++; } else { result.push(raw[i]); } } return result; };
/* splitByComma: parenthesis-aware + guards — mirrors the JSX exactly */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      const noSpace = !/^\s/.test(rest);
      const nextWordM = rest.match(/^\s*([^\s,]+)/);
      const nextWord = nextWordM ? nextWordM[1].toLowerCase() : '';
      const prevWordM = current.match(/(\S+)\s*$/);
      const prevWord = prevWordM ? prevWordM[1].toLowerCase() : '';
      const nextCharM = rest.match(/^\s*(.)/);
      const nextChar = nextCharM ? nextCharM[1] : '';
      const badNext = nextChar && !/[A-Za-z>(]/.test(nextChar);
      if (noSpace || nextWord === 'and' || nextWord === 'or' || prevWord === 'and' || prevWord === 'or' || badNext) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
/* parseLabel: "Label: value" or "1. Label - value" — mirrors the JSX */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const nm = text.match(/^\d+\.\s*(.+?)\s*[-–]\s+([\s\S]*)/);
  if (nm) return { isLabeled: true, label: nm[1].trim(), value: nm[2].trim() };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* sentence field → typed lines: labeled sub-label restarts numbering; unlabeled rows run on */
const sentenceLines = (strVal) => {
  const lines = [];
  const sentences = splitBySentence(strVal);
  let running = 1;
  sentences.forEach(sentence => {
    const parsed = parseLabel(sentence);
    const value = (parsed.isLabeled ? parsed.value : sentence.replace(/^\d+\.\s*/, '')).replace(/[;.]+$/, '').trim();
    if (!value) return;
    const items = splitByComma(value);
    if (parsed.isLabeled) {
      lines.push({ sub: true, text: parsed.label });
      if (items.length >= 3) items.forEach((it, i) => lines.push({ sub: false, text: `${i + 1}. ${it}` }));
      else lines.push({ sub: false, text: `1. ${value}` });
    } else if (items.length >= 3) {
      items.forEach(it => lines.push({ sub: false, text: `${running++}. ${it}` }));
    } else {
      lines.push({ sub: false, text: `${running++}. ${value}` });
    }
  });
  return lines;
};

/* recursive object node: labels are bold ruled headings; every scalar row is numbered;
   arrays → numbered items (never "0"/"1" index keys); string leaf comma>=3 → numbered rows */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
  if (Array.isArray(value)) {
    let n = 0;
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{safeString(label)}</Text> : null}
        {value.filter(v => !isEmptyDeep(v)).map((v, i) => (
          isScalar(v)
            ? <Text key={i} style={styles.listItem}>{`${++n}. ${safeString(fmtScalar(v))}`}</Text>
            : <View key={i}>{renderObjectNode('', v, `${keyPath}-${i}`, depth + 1)}</View>
        ))}
      </View>
    );
  }
  if (isScalar(value)) {
    const items = typeof value === 'string' ? splitByComma(String(value)) : [];
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{safeString(label)}</Text> : null}
        {items.length >= 3
          ? items.map((it, i) => <Text key={i} style={styles.listItem}>{`${i + 1}. ${safeString(it)}`}</Text>)
          : <Text style={styles.listItem}>{`1. ${safeString(fmtScalar(value))}`}</Text>}
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{safeString(label)}</Text> : null}
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

/* Rule #74 (per-field gating): render a field as wrap-gated View(s). Returns an ARRAY of Views. */
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
        <Text style={styles.listItem}>{`1. ${safeString(formatDate(val))}`}</Text>
      </View>
    )];
  }

  if (NUMBER_FIELDS.includes(field)) {
    return [(
      <View key={field} style={styles.fieldGroup} wrap={false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        <Text style={styles.listItem}>{`1. ${safeString(fmtScalar(val))}`}</Text>
      </View>
    )];
  }

  if (OBJECT_ARRAY_FIELDS.includes(field)) {
    const recs = Array.isArray(val) ? val : [];
    if (recs.length === 0) return [];
    const groups = [];
    recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
    return [(
      <View key={field} style={styles.fieldGroup} wrap={recs.length > 8 ? true : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            {group.date ? <Text style={styles.subLabel}>{safeString(group.date)}</Text> : null}
            {group.items.map((r, i) => (<Text key={i} style={styles.listItem}>{`${i + 1}. ${safeString((r?.recommendation || '').trim())}`}</Text>))}
          </View>
        ))}
      </View>
    )];
  }

  if (OBJECT_FIELDS.includes(field)) {
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return [];
    return entries.map(([k, v], i) => {
      const rows = countRows(v);
      return (
        <View key={`${field}-${k}`} style={styles.fieldGroup} wrap={rows > 8 ? true : false}>
          {i === 0 ? titleNode : null}
          {i === 0 && showLabel ? <Text style={styles.fieldLabel}>{label}</Text> : null}
          {renderObjectNode(humanizeKey(k), v, `${field}-${k}`, showLabel ? 1 : 0)}
        </View>
      );
    });
  }

  /* SENTENCE strings — labeled sub-labels + numbered rows (mirrors Copy) */
  if (SENTENCE_FIELDS.includes(field)) {
    const lines = sentenceLines(fmtVal(val));
    if (lines.length === 0) return [];
    return [(
      <View key={field} style={styles.fieldGroup} wrap={lines.length > 8 ? true : false}>
        {titleNode}
        {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
        {lines.map((l, i) => (<Text key={i} style={l.sub ? styles.subLabel : styles.listItem}>{safeString(l.text)}</Text>))}
      </View>
    )];
  }

  /* plain string */
  return [(
    <View key={field} style={styles.fieldGroup} wrap={false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      <Text style={styles.listItem}>{`1. ${safeString(fmtVal(val))}`}</Text>
    </View>
  )];
};

/* Skin lesions — array of lesion objects (own section, location as ruled group header) */
const renderSkinLesions = (lesions) => {
  if (!Array.isArray(lesions) || lesions.filter(l => !isEmptyDeep(l)).length === 0) return null;
  return (
    <View style={styles.section}>
      {lesions.map((lesion, li) => {
        if (isEmptyDeep(lesion)) return null;
        const subRows = LESION_SUB_FIELDS.filter(sf => hasVal(lesion[sf]));
        const rows = 1 + subRows.length * 2;
        return (
          <View key={li} style={styles.fieldGroup} wrap={rows > 8 ? true : false}>
            {li === 0 ? <Text style={styles.sectionTitle}>Skin Lesions</Text> : null}
            <Text style={styles.lesionTitle}>{safeString(lesion.location || `Lesion ${li + 1}`)}</Text>
            {subRows.map(sf => {
              const items = splitByComma(String(lesion[sf]));
              return (
                <View key={sf}>
                  <Text style={styles.subLabel}>{LESION_LABELS[sf]}</Text>
                  {sf === 'dermoscopyFindings' && items.length >= 2
                    ? items.map((it, i) => <Text key={i} style={styles.listItem}>{`${i + 1}. ${safeString(it)}`}</Text>)
                    : <Text style={styles.listItem}>{`1. ${safeString(fmtVal(lesion[sf]))}`}</Text>}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
};

/* ═══════ COMPONENT ═══════ */
const DermatologyAssessmentDocumentPDFTemplate = ({ document: data }) => {
  let records = [];
  if (Array.isArray(data)) {
    if (data.length === 1 && data[0]?.dermatology_assessment) records = Array.isArray(data[0].dermatology_assessment) ? data[0].dermatology_assessment : [data[0].dermatology_assessment];
    else records = data;
  } else if (data?.dermatology_assessment) records = Array.isArray(data.dermatology_assessment) ? data.dermatology_assessment : [data.dermatology_assessment];
  else if (data?.documentData) { const dd = data.documentData; if (Array.isArray(dd)) records = dd; else if (dd?.dermatology_assessment) records = Array.isArray(dd.dermatology_assessment) ? dd.dermatology_assessment : [dd.dermatology_assessment]; else if (dd && typeof dd === 'object') records = [dd]; }
  else if (data && typeof data === 'object') records = [data];
  records = (records || []).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Dermatology Assessment</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Dermatology Assessment</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Dermatology Assessment ${idx + 1}`}</Text>
            </View>

            {/* Provider Details */}
            {(() => {
              const fields = SECTION_FIELDS['provider-details'];
              const present = fields.filter(f => hasVal(record[f]));
              if (present.length === 0) return null;
              return (<View style={styles.section}>{present.flatMap((f, fi) => renderField(record, f, SECTION_TITLES['provider-details'], fi === 0))}</View>);
            })()}

            {/* Skin Lesions (array of objects) */}
            {renderSkinLesions(record.skinLesions)}

            {/* Remaining sections (Rule #74 per-field gating) */}
            {SECTION_ORDER.filter(sid => sid !== 'provider-details').map((sid) => {
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
      </Page>
    </Document>
  );
};

export default DermatologyAssessmentDocumentPDFTemplate;

/**
 * ClosureTechniqueDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer paddingBottom only (marginBottom → empty page 1) + break={idx>0} (Rule #75, each
 * record starts a new page); sectionTitle rides INSIDE the first field's View (anti-orphan, 6a2d6af6).
 * Every value numbered ("1." even for singles); comma-split fields (suture sizes, materials, layers,
 * procedures) as numbered rows; labeled closure-sequence sentences as label groups; single-name rule.
 * Collection: closure_technique
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#000000' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  recordContainer: { paddingBottom: 8 },
  recordHeader: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 12, color: '#000000', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldUnit: { marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

const SECTION_DEFS = [
  ['Procedure', ['procedureName', 'facility']],
  ['Closure Details', ['closureLayer', 'closureTechnique', 'closureSequence']],
  ['Suture Details', ['sutureType', 'sutureMaterial', 'sutureSize', 'needleType']],
  ['Site Closure', ['portSiteClosure', 'skinClosure']],
  ['Additional Details', ['drains', 'hemostasis', 'tensionFree']],
  ['Notes', ['notes']],
];
const FIELD_LABELS = {
  procedureName: 'Procedure Name', closureLayer: 'Closure Layer', closureTechnique: 'Closure Technique',
  sutureType: 'Suture Type', sutureMaterial: 'Suture Material', sutureSize: 'Suture Size', needleType: 'Needle Type',
  closureSequence: 'Closure Sequence', portSiteClosure: 'Port Site Closure', skinClosure: 'Skin Closure',
  drains: 'Drains', hemostasis: 'Hemostasis', tensionFree: 'Tension Free', facility: 'Facility', notes: 'Notes',
};
const SENTENCE_FIELDS = ['closureSequence', 'notes'];
const COMMA_SPLIT_FIELDS = ['sutureMaterial', 'sutureSize', 'procedureName', 'closureLayer'];
const SPLIT_PATTERN = { procedureName: /;\s*/, sutureMaterial: /,\s*/, sutureSize: /,\s*/, closureLayer: /,\s*/ };

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'string') return v.trim() !== ''; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
// Abbreviation+decimal guard: never break on "Dr. Smith", "vs. standard", "3.5 months"
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

/* One field = one wrap-gated View; sectionTitle rides inside the FIRST present field's View.
   Single-name rule: field label == section title → hidden. Labeled sentences → label group +
   numbered comma rows (restart); plain sentences continue the running count. */
const renderField = (record, f, title, isFirst) => {
  const val = record[f];
  if (!hasVal(val)) return null;
  const label = FIELD_LABELS[f] || f;
  const showLabel = label.toLowerCase() !== title.toLowerCase();
  const titleNode = isFirst ? <Text style={styles.sectionTitle}>{title}</Text> : null;
  let body; let rows;
  if (SENTENCE_FIELDS.includes(f)) {
    const sentences = splitBySentence(fmtVal(val));
    rows = sentences.length;
    let running = 0;
    body = sentences.map((s, si) => {
      const p = parseLabel(s);
      if (p) {
        const items = p.content.split(/,\s*/).map(x => x.trim()).filter(Boolean);
        running = 0;
        return (
          <View key={si}>
            <Text style={styles.fieldLabel}>{p.label}</Text>
            {(items.length ? items : [p.content]).map((c, j) => <Text key={j} style={styles.listItem}>{j + 1}. {c}</Text>)}
          </View>
        );
      }
      running += 1;
      return <Text key={si} style={styles.listItem}>{running}. {s}</Text>;
    });
  } else if (COMMA_SPLIT_FIELDS.includes(f)) {
    const sp = SPLIT_PATTERN[f] || /,\s*/;
    const items = String(val).split(sp).map(x => x.trim()).filter(Boolean);
    rows = items.length;
    body = items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>);
  } else {
    rows = 1;
    body = <Text style={styles.listItem}>1. {fmtVal(val)}</Text>;
  }
  return (
    <View key={f} style={styles.fieldUnit} wrap={rows + 2 > 8 ? true : false}>
      {titleNode}
      {showLabel && <Text style={styles.fieldLabel}>{label}</Text>}
      {body}
    </View>
  );
};

const ClosureTechniqueDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.closure_technique) return Array.isArray(r.closure_technique) ? r.closure_technique : [r.closure_technique];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.closure_technique) return Array.isArray(dd.closure_technique) ? dd.closure_technique : [dd.closure_technique]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Closure Technique</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Closure Technique</Text></View>
        {records.map((record, idx) => (
          // Rule #75: every record after the first STARTS ON A NEW PAGE; never on record 0.
          <View key={idx} style={styles.recordContainer} break={idx > 0}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`Closure Technique ${idx + 1}`}</Text>
              {record.date ? <Text style={styles.recordMeta}>{formatDate(record.date)}</Text> : null}
            </View>
            {SECTION_DEFS.map(([title, fields]) => {
              const present = fields.filter(f => hasVal(record[f]));
              if (present.length === 0) return null;
              return (
                <View key={title} style={styles.section}>
                  {present.map((f, fi) => renderField(record, f, title, fi === 0))}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ClosureTechniqueDocumentPDFTemplate;

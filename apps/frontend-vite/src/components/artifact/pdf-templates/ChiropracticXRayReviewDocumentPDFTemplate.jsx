/**
 * ChiropracticXRayReviewDocumentPDFTemplate.jsx
 * Box-free line-based layout (ConsultationNotes donor) — LETTER size — B&W.
 * react-pdf 4.5.1 engine rules: wrap props are BOOLEANS (explicit undefined = unbreakable);
 * recordContainer uses paddingBottom only (marginBottom → empty page 1); per-FIELD gates with the
 * section title inside the first field's unit + leaf glue (anti-orphan, 6a2d6af6). Text-block fields
 * split by sentence then guarded comma (parseLabeledSentences); array items comma-split when >=3 parts.
 * Collection: chiropractic_x_ray_review
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
  recordMeta: { fontSize: 12, color: '#333333', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 3, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', borderBottomWidth: 0.5, borderBottomColor: '#999999', paddingBottom: 3, marginBottom: 4 },
  subLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 3, marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 3, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const safeArr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); };
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0) {
      if (!/\s/.test(text[i + 1] || '')) { current += ch; continue; }
      const rest = text.slice(i + 1).replace(/^\s+/, '');
      if (/^(and|or)\b/i.test(rest)) { current += ch; continue; }
      if (/\b(and|or)\s*$/i.test(current)) { current += ch; continue; }
      const t = current.trim(); if (t) result.push(t); current = '';
    }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};
const parseLabeledSentences = (text) => {
  const groups = []; let nullGroup = null;
  splitBySentence(String(text || '')).forEach(sentence => {
    const ci = sentence.indexOf(':');
    const label = ci > 0 && ci < 60 && !sentence.substring(0, ci).includes('.') ? sentence.substring(0, ci).trim() : null;
    if (label) { groups.push({ label, items: splitByComma(sentence.substring(ci + 1).trim()).map(p => p.replace(/[.;]+$/, '').trim()).filter(Boolean) }); nullGroup = null; }
    else { if (!nullGroup) { nullGroup = { label: null, items: [] }; groups.push(nullGroup); } splitByComma(sentence).forEach(p => { const t = p.replace(/[.;]+$/, '').trim(); if (t) nullGroup.items.push(t); }); }
  });
  return groups;
};

const FL = {
  patientChiefComplaint: 'Chief Complaint',
  cervicalLordosisAngle: 'Cervical Lordosis (°)', lumbarLordosisAngle: 'Lumbar Lordosis (°)', thoracicKyphosisAngle: 'Thoracic Kyphosis (°)', cobbAngleScoliosis: 'Cobb Angle (°)', scoliosisCurvePattern: 'Scoliosis Pattern', sacralBaseAngle: 'Sacral Base Angle (°)', legLengthDiscrepancy: 'Leg Length Discrepancy (mm)',
  atlasLateralityMeasurement: 'Atlas Laterality (mm)', adiFinding: 'ADI Finding (mm)',
  degenerativeDiscDiseaseGrade: 'DDD Grade',
  spondylolisthesisGrade: 'Spondylolisthesis Grade', spondylolisthesisLevel: 'Spondylolisthesis Level', parsDefectPresent: 'Pars Defect',
  georgesLineIntegrity: "George's Line Integrity", spinalCanalDiameter: 'Spinal Canal Diameter (mm)',
};
const TEXT_BLOCK_FIELDS = new Set(['patientChiefComplaint', 'degenerativeDiscDiseaseGrade']);
// Numeric angle/measurement fields: 0 is an "unmeasured" sentinel -> hide when 0.
const NUMBER_FIELDS = new Set(['cervicalLordosisAngle', 'lumbarLordosisAngle', 'thoracicKyphosisAngle', 'cobbAngleScoliosis', 'sacralBaseAngle', 'legLengthDiscrepancy', 'atlasLateralityMeasurement', 'adiFinding', 'spinalCanalDiameter']);
const hasFieldVal = (fn, v) => { if (NUMBER_FIELDS.has(fn) && (v === 0 || v === '0')) return false; return hasVal(v); };

const blockRowCount = (value) => { const g = parseLabeledSentences(String(value)); return g.reduce((s, gr) => s + gr.items.length + (gr.label ? 1 : 0), 0); };
const fieldRows = (fn, value) => TEXT_BLOCK_FIELDS.has(fn) ? blockRowCount(value) + 1 : 2;

/* one field as a wrap-gated unit; section title rides inside when isFirst. Single narrative field +
   its title fits one page, so wrap={false} up to ~22 rows (avoids the title-orphan). */
const renderFieldUnit = (fn, value, sTitle, isFirst) => {
  const rows = fieldRows(fn, value) + (isFirst ? 1 : 0);
  const showFieldLabel = (FL[fn] || fn).toLowerCase() !== String(sTitle).toLowerCase();
  let inner;
  if (TEXT_BLOCK_FIELDS.has(fn)) {
    let n = 0;
    inner = (
      <View style={{ marginBottom: 6 }}>
        {showFieldLabel && <Text style={styles.fieldLabel}>{FL[fn] || fn}</Text>}
        {parseLabeledSentences(String(value)).map((g, gi) => {
          if (g.label) n = 0;
          const start = n; n += g.items.length;
          return (
            <View key={gi}>
              {g.label && <Text style={styles.subLabel}>{g.label}</Text>}
              {g.items.map((it, i) => <Text key={i} style={styles.listItem}>{start + i + 1}. {it}</Text>)}
            </View>
          );
        })}
      </View>
    );
  } else {
    inner = (
      <View style={{ marginBottom: 6 }}>
        {showFieldLabel && <Text style={styles.fieldLabel}>{FL[fn] || fn}</Text>}
        <Text style={styles.listItem}>1. {fmtVal(value)}</Text>
      </View>
    );
  }
  return (
    <View key={fn} wrap={rows > 22 ? true : false}>
      {isFirst && <Text style={styles.sectionTitle}>{sTitle}</Text>}
      {inner}
    </View>
  );
};

const renderFieldSection = (sTitle, fields, record) => {
  const visible = fields.filter(f => hasFieldVal(f, record[f]));
  if (visible.length === 0) return null;
  return (<View style={styles.section}>{visible.map((f, i) => renderFieldUnit(f, record[f], sTitle, i === 0))}</View>);
};

// array item comma-splits into rows ONLY when >=3 parts (genuine list); else keep whole (Rule #73)
const arrToRows = (items) => {
  const rows = [];
  safeArr(items).forEach(it => { const parts = splitByComma(String(it)); (parts.length >= 3 ? parts : [String(it)]).forEach(p => { const t = p.replace(/[.;]+$/, '').trim(); if (t) rows.push(t); }); });
  return rows;
};

const renderArraySection = (sTitle, items) => {
  const rows = arrToRows(items);
  if (rows.length === 0) return null;
  return (
    <View style={styles.section} wrap={rows.length + 1 > 8 ? true : false}>
      <Text style={styles.sectionTitle}>{sTitle}</Text>
      {rows.map((t, i) => <Text key={i} style={styles.listItem}>{i + 1}. {t}</Text>)}
    </View>
  );
};

// Composite section: one section title + several sub-labeled arrays (Imaging, Disc). Each sub-group is
// its own wrap={false} glue unit; the section title rides inside the first present sub-group.
const renderArrayGroupSection = (sTitle, groups) => {
  const present = groups.map(g => ({ label: g.label, rows: arrToRows(g.items) })).filter(g => g.rows.length > 0);
  if (present.length === 0) return null;
  return (
    <View style={styles.section}>
      {present.map((g, gi) => (
        <View key={gi} wrap={g.rows.length + (gi === 0 ? 2 : 1) > 8 ? true : false}>
          {gi === 0 && <Text style={styles.sectionTitle}>{sTitle}</Text>}
          <Text style={styles.subLabel}>{g.label}</Text>
          {g.rows.map((t, i) => <Text key={i} style={styles.listItem}>{i + 1}. {t}</Text>)}
        </View>
      ))}
    </View>
  );
};

const ChiropracticXRayReviewDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.chiropractic_x_ray_review) return Array.isArray(r.chiropractic_x_ray_review) ? r.chiropractic_x_ray_review : [r.chiropractic_x_ray_review];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.chiropractic_x_ray_review) return Array.isArray(dd.chiropractic_x_ray_review) ? dd.chiropractic_x_ray_review : [dd.chiropractic_x_ray_review]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (<Document><Page size="LETTER" style={styles.page}><View style={styles.documentHeader}><Text style={styles.title}>Chiropractic X-Ray Review</Text></View><Text style={styles.emptyState}>No records available</Text></Page></Document>);
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Chiropractic X-Ray Review</Text></View>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordContainer}>
            <View style={styles.recordHeader} wrap={false}>
              <Text style={styles.recordTitle}>{`X-Ray Review ${idx + 1}`}</Text>
              {record.createdAt && <Text style={styles.recordMeta}>{formatDate(record.createdAt)}</Text>}
            </View>
            {renderFieldSection('Chief Complaint', ['patientChiefComplaint'], record)}
            {renderArrayGroupSection('Imaging', [{ label: 'Spinal Regions Imaged', items: record.spinalRegionImaged }, { label: 'Views Obtained', items: record.viewsObtained }])}
            {renderFieldSection('Curvature & Alignment', ['cervicalLordosisAngle', 'lumbarLordosisAngle', 'thoracicKyphosisAngle', 'cobbAngleScoliosis', 'scoliosisCurvePattern', 'sacralBaseAngle', 'legLengthDiscrepancy'], record)}
            {renderArraySection('Subluxation Listings', record.vertebralSubluxationListings)}
            {renderFieldSection('Upper Cervical', ['atlasLateralityMeasurement', 'adiFinding'], record)}
            {renderArrayGroupSection('Disc & Joint Findings', [{ label: 'Disc Space Narrowing', items: record.discSpaceNarrowingLevels }, { label: 'Osteophyte Formation', items: record.osteophyteFormationLocations }, { label: 'Facet Arthrosis', items: record.facetArthrosis }])}
            {renderFieldSection('Degenerative Disc Disease', ['degenerativeDiscDiseaseGrade'], record)}
            {renderFieldSection('Spondylolisthesis', ['spondylolisthesisGrade', 'spondylolisthesisLevel', 'parsDefectPresent'], record)}
            {renderFieldSection('Spinal Stability', ['georgesLineIntegrity', 'spinalCanalDiameter'], record)}
            {renderArraySection('Compression Fractures', record.vertebralBodyCompressionFractures)}
            {renderArraySection('Foraminal Stenosis', record.intervertebralForaminaStenosis)}
            {renderArraySection('Contraindications', record.contraIndicationsForManipulation)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ChiropracticXRayReviewDocumentPDFTemplate;

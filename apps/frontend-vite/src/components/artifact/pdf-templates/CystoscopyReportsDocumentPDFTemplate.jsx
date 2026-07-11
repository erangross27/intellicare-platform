/**
 * CystoscopyReportsDocumentPDFTemplate.jsx
 * March 2026 — Helvetica — LETTER size — parseLabel + comma-split
 * Collection: cystoscopy_reports
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12 },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#000000' },
  recordContainer: { paddingBottom: 16 },
  recordHeader: { marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#000000' },
  fieldBox: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', paddingLeft: 8 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 3 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/\u00b5m/g, 'um').replace(/\u03bcm/g, 'um').replace(/\u00b0/g, ' deg')
    .replace(/\u00b1/g, '+/-').replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->').replace(/\u201c/g, '"').replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'").replace(/\u2014/g, '-').replace(/\u2013/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
/* numHasVal: bladderCapacity (mL) and procedureDuration (min) are never legitimately 0, so 0 is a "not recorded" sentinel and is hidden. */
const numHasVal = (v) => { if (typeof v === 'number' && v === 0) return false; return hasVal(v); };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

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

const FIELD_LABELS = {
  procedureIndication: 'Procedure Indication',
  cystoscopeType: 'Cystoscope Type',
  anesthesiaType: 'Anesthesia Type',
  procedureDuration: 'Procedure Duration',
  urethralAppearance: 'Urethral Appearance',
  urethralStrictures: 'Urethral Strictures',
  bladderCapacity: 'Bladder Capacity',
  bladderMucosaAppearance: 'Bladder Mucosa Appearance',
  bladderLesions: 'Bladder Lesions',
  hunnerLesions: 'Hunner Lesions',
  glomerulations: 'Glomerulations',
  trabeculation: 'Trabeculation',
  diverticula: 'Diverticula',
  uretericOrifices: 'Ureteric Orifices',
  ureteralJets: 'Ureteral Jets',
  prostateAppearance: 'Prostate Appearance',
  prostateSize: 'Prostate Size',
  biopsyPerformed: 'Biopsy Performed',
  biopsyLocations: 'Biopsy Locations',
  resectionPerformed: 'Resection Performed',
  irrigationFluid: 'Irrigation Fluid',
  complications: 'Complications',
  catheterPlaced: 'Catheter Placed',
  catheterSize: 'Catheter Size',
};

/* renderFieldRow: simple label + value */
const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.listItem}>1. {safeString(fmtVal(value))}</Text>
    </View>
  );
};

/* renderCommaField: comma-split into numbered items */
const renderCommaField = (label, text) => {
  if (!hasVal(text)) return null;
  const items = splitByComma(fmtVal(text));
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.length >= 3
        ? items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)
        : <Text style={styles.listItem}>1. {safeString(fmtVal(text))}</Text>
      }
    </View>
  );
};

/* renderArrayField: numbered array items */
const renderArrayField = (label, arr) => {
  const safeArr = Array.isArray(arr) ? arr.filter(v => v !== null && v !== undefined && v !== '') : [];
  if (safeArr.length === 0) return null;
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {safeArr.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>)}
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const CystoscopyReportsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.cystoscopy_reports) return Array.isArray(r.cystoscopy_reports) ? r.cystoscopy_reports : [r.cystoscopy_reports];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cystoscopy_reports) return Array.isArray(dd.cystoscopy_reports) ? dd.cystoscopy_reports : [dd.cystoscopy_reports]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Cystoscopy Reports</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Cystoscopy Reports</Text></View>

        {records.map((record, idx) => {
          /* Section 1: Procedure Info */
          const procFields = [
            { key: 'procedureIndication', val: record.procedureIndication },
            { key: 'cystoscopeType', val: record.cystoscopeType },
            { key: 'anesthesiaType', val: record.anesthesiaType },
            { key: 'procedureDuration', val: record.procedureDuration, num: true },
          ].filter(f => (f.num ? numHasVal(f.val) : hasVal(f.val)));

          /* Section 2: Urethral Findings */
          const urethralSimple = [
            { key: 'urethralAppearance', val: record.urethralAppearance },
          ].filter(f => hasVal(f.val));
          const urethralStrictures = Array.isArray(record.urethralStrictures) ? record.urethralStrictures.filter(Boolean) : [];
          const hasUrethral = urethralSimple.length > 0 || urethralStrictures.length > 0;

          /* Section 3: Bladder Findings */
          const bladderSimple = [
            { key: 'bladderCapacity', val: record.bladderCapacity, num: true },
            { key: 'bladderMucosaAppearance', val: record.bladderMucosaAppearance, comma: true },
            { key: 'hunnerLesions', val: record.hunnerLesions },
            { key: 'glomerulations', val: record.glomerulations },
            { key: 'trabeculation', val: record.trabeculation },
          ].filter(f => (f.num ? numHasVal(f.val) : hasVal(f.val)));
          const bladderLesions = Array.isArray(record.bladderLesions) ? record.bladderLesions.filter(Boolean) : [];
          const diverticula = Array.isArray(record.diverticula) ? record.diverticula.filter(Boolean) : [];
          const hasBladder = bladderSimple.length > 0 || bladderLesions.length > 0 || diverticula.length > 0;

          /* Section 4: Ureteric & Prostate */
          const uretericFields = [
            { key: 'uretericOrifices', val: record.uretericOrifices, comma: true },
            { key: 'ureteralJets', val: record.ureteralJets },
            { key: 'prostateAppearance', val: record.prostateAppearance },
            { key: 'prostateSize', val: record.prostateSize },
          ].filter(f => hasVal(f.val));

          /* Section 5: Biopsy & Procedure */
          const biopsySimple = [
            { key: 'biopsyPerformed', val: record.biopsyPerformed },
            { key: 'resectionPerformed', val: record.resectionPerformed },
            { key: 'irrigationFluid', val: record.irrigationFluid },
            { key: 'catheterPlaced', val: record.catheterPlaced },
            { key: 'catheterSize', val: record.catheterSize },
          ].filter(f => hasVal(f.val));
          const biopsyLocations = Array.isArray(record.biopsyLocations) ? record.biopsyLocations.filter(Boolean) : [];
          const complications = Array.isArray(record.complications) ? record.complications.filter(Boolean) : [];
          const hasBiopsy = biopsySimple.length > 0 || biopsyLocations.length > 0 || complications.length > 0;

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Cystoscopy Reports ${idx + 1}`}</Text>
              </View>

              {/* Section 1: Procedure Info */}
              {procFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={procFields.length > 8}>
                    <Text style={styles.sectionTitle}>Procedure Info</Text>
                    {procFields.map((f, i) => (
                      <React.Fragment key={i}>
                        {renderFieldRow(FIELD_LABELS[f.key], f.val)}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 2: Urethral Findings */}
              {hasUrethral && (() => {
                const totalItems = urethralSimple.length + urethralStrictures.length;
                return (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={totalItems > 8}>
                      <Text style={styles.sectionTitle}>Urethral Findings</Text>
                      {urethralSimple.map((f, i) => (
                        <React.Fragment key={i}>{renderFieldRow(FIELD_LABELS[f.key], f.val)}</React.Fragment>
                      ))}
                      {renderArrayField('Urethral Strictures', urethralStrictures)}
                    </View>
                  </View>
                );
              })()}

              {/* Section 3: Bladder Findings */}
              {hasBladder && (() => {
                const totalItems = bladderSimple.length + bladderLesions.length + diverticula.length;
                return (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={totalItems > 8}>
                      <Text style={styles.sectionTitle}>Bladder Findings</Text>
                      {bladderSimple.map((f, i) => (
                        <React.Fragment key={i}>
                          {f.comma
                            ? renderCommaField(FIELD_LABELS[f.key], f.val)
                            : renderFieldRow(FIELD_LABELS[f.key], f.val)
                          }
                        </React.Fragment>
                      ))}
                      {renderArrayField('Bladder Lesions', bladderLesions)}
                      {renderArrayField('Diverticula', diverticula)}
                    </View>
                  </View>
                );
              })()}

              {/* Section 4: Ureteric & Prostate */}
              {uretericFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={uretericFields.length > 8}>
                    <Text style={styles.sectionTitle}>Ureteric & Prostate</Text>
                    {uretericFields.map((f, i) => (
                      <React.Fragment key={i}>
                        {f.comma
                          ? renderCommaField(FIELD_LABELS[f.key], f.val)
                          : renderFieldRow(FIELD_LABELS[f.key], f.val)
                        }
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 5: Biopsy & Procedure */}
              {hasBiopsy && (() => {
                const totalItems = biopsySimple.length + biopsyLocations.length + complications.length;
                return (
                  <View style={styles.section}>
                    <View style={styles.fieldBox} wrap={totalItems > 8}>
                      <Text style={styles.sectionTitle}>Biopsy & Procedure</Text>
                      {renderFieldRow(FIELD_LABELS.biopsyPerformed, record.biopsyPerformed)}
                      {renderArrayField('Biopsy Locations', biopsyLocations)}
                      {renderFieldRow(FIELD_LABELS.resectionPerformed, record.resectionPerformed)}
                      {renderFieldRow(FIELD_LABELS.irrigationFluid, record.irrigationFluid)}
                      {renderArrayField('Complications', complications)}
                      {renderFieldRow(FIELD_LABELS.catheterPlaced, record.catheterPlaced)}
                      {renderFieldRow(FIELD_LABELS.catheterSize, record.catheterSize)}
                    </View>
                  </View>
                );
              })()}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default CystoscopyReportsDocumentPDFTemplate;

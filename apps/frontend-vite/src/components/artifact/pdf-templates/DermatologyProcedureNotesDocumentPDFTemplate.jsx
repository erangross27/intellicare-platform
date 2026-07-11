/**
 * DermatologyProcedureNotesDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER — BLACK & WHITE only (#000000 titles/values, #999999 label rules).
 * Collection: dermatology_procedure_notes.
 *
 * BOX-FREE canonical: page 14 / title 26 / recordTitle 19 / sectionTitle 16 + 1pt black rule /
 * fieldLabel & subLabel 13 + 0.5pt #999 rule / values 14.
 * Rule #74: wrap is BOOLEAN only (rows>8 → true, else false); sectionTitle rides INSIDE the
 * section's field View. Every value row numbered ("1." even singles). Hide-zero sentinel
 * numerics (all derm metrics: 0 = not performed/not measured); epoch-1970 dates hidden.
 * Mirrors JSX/Copy: comma field → numbered rows; sentence field → parseLabel, labeled →
 * sub-label + rows (numbering restarts), unlabeled rows continue the running count.
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
  value: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#000000' },
});

/* ═══ UTILS ═══ */
const safeString = (val) => {
  if (val === null || val === undefined) return '';
  let str = typeof val === 'string' ? val : String(val);
  str = str.replace(/µm/g, 'um').replace(/μm/g, 'um').replace(/°/g, ' deg')
    .replace(/±/g, '+/-').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/→/g, '->').replace(/“/g, '"').replace(/”/g, '"')
    .replace(/‘/g, "'").replace(/’/g, "'").replace(/—/g, '-').replace(/–/g, '-');
  return str;
};

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };

/* MEANINGFUL_ZERO_FIELDS: derm numerics are sentinels at 0 (procedure not performed / not measured) → none meaningful at 0 */
const MEANINGFUL_ZERO_FIELDS = [];
const numHasVal = (key, v) => { if (v === null || v === undefined || v === '') return false; const n = Number(v); if (Number.isNaN(n)) return false; if (n === 0) return MEANINGFUL_ZERO_FIELDS.includes(key); return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    if (d.getFullYear() <= 1970) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(dateStr); }
};

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

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc))[.;](?:\s+)/).map(s => s.trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

const FIELD_LABELS = {
  procedureIndication: 'Procedure Indication',
  lesionLocation: 'Lesion Location',
  lesionSizeCm: 'Lesion Size (cm)',
  histopathologyResult: 'Histopathology Result',
  excisionMarginsClean: 'Excision Margins Clean',
  marginWidthMm: 'Margin Width (mm)',
  breslowThickness: 'Breslow Thickness',
  clarkLevel: 'Clark Level',
  specimenSent: 'Specimen Sent',
  dermatoscopeFindings: 'Dermatoscope Findings',
  anesthesiaType: 'Anesthesia Type',
  localAnestheticAgent: 'Local Anesthetic Agent',
  epinephrineUsed: 'Epinephrine Used',
  sutureType: 'Suture Type',
  sutureSize: 'Suture Size',
  layeredClosure: 'Layered Closure',
  reconstructionMethod: 'Reconstruction Method',
  hemostasisMethod: 'Hemostasis Method',
  sutureRemovalDate: 'Suture Removal Date',
  mohaStages: 'Mohs Stages',
  cryotherapyFreezeTime: 'Cryotherapy Freeze Time',
  cryotherapyFreezeCycles: 'Cryotherapy Freeze Cycles',
  laserWavelengthNm: 'Laser Wavelength (nm)',
  laserFluenceJcm2: 'Laser Fluence (J/cm2)',
  complicationsIntraoperative: 'Intraoperative Complications',
};

/* simple field: ruled label + numbered "1. value" */
const renderFieldRows = (key, value) => (
  <View key={key}>
    <Text style={styles.fieldLabel}>{FIELD_LABELS[key] || key}</Text>
    <Text style={styles.listItem}>{`1. ${safeString(fmtVal(value))}`}</Text>
  </View>
);

/* sentence field lines: labeled → sub-label + rows (restart); unlabeled → running count;
   >=3 guarded comma items → per-item rows */
const sentenceLines = (text) => {
  const sentences = splitBySentence(fmtVal(text));
  const lines = []; let running = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    const value = (parsed.isLabeled ? parsed.value : s).replace(/[;.]+$/, '').trim();
    if (!value) return;
    const parts = splitByComma(value);
    if (parsed.isLabeled) {
      lines.push({ sub: true, text: parsed.label });
      if (parts.length >= 3) parts.forEach((it, i) => lines.push({ sub: false, text: `${i + 1}. ${it}` }));
      else lines.push({ sub: false, text: `1. ${value}` });
    } else if (parts.length >= 3) {
      parts.forEach(it => lines.push({ sub: false, text: `${running++}. ${it}` }));
    } else {
      lines.push({ sub: false, text: `${running++}. ${value}` });
    }
  });
  return lines;
};

/* ═══ COMPONENT ═══ */
const DermatologyProcedureNotesDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.dermatology_procedure_notes) return Array.isArray(r.dermatology_procedure_notes) ? r.dermatology_procedure_notes : [r.dermatology_procedure_notes];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.dermatology_procedure_notes) return Array.isArray(dd.dermatology_procedure_notes) ? dd.dermatology_procedure_notes : [dd.dermatology_procedure_notes]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Dermatology Procedure Notes</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Dermatology Procedure Notes</Text></View>

        {records.map((record, idx) => {
          /* Section 1: Indication & Lesion */
          const indicationFields = [
            ['procedureIndication', record.procedureIndication],
            ['lesionLocation', record.lesionLocation],
            ['lesionSizeCm', record.lesionSizeCm],
          ].filter(([k, v]) => k === 'lesionSizeCm' ? numHasVal(k, v) : hasVal(v));

          /* Section 2: Histopathology & Excision */
          const histoSimple = [
            ['excisionMarginsClean', record.excisionMarginsClean],
            ['marginWidthMm', record.marginWidthMm],
            ['breslowThickness', record.breslowThickness],
            ['clarkLevel', record.clarkLevel],
            ['specimenSent', record.specimenSent],
          ].filter(([k, v]) => (k === 'marginWidthMm' || k === 'breslowThickness') ? numHasVal(k, v) : hasVal(v));
          const histoLines = hasVal(record.histopathologyResult) ? sentenceLines(record.histopathologyResult) : [];

          /* Section 3: Dermatoscopy */
          const dermaItems = hasVal(record.dermatoscopeFindings) ? splitByComma(fmtVal(record.dermatoscopeFindings)) : [];

          /* Section 4: Anesthesia & Closure */
          const anesthesiaFields = [
            ['anesthesiaType', record.anesthesiaType],
            ['localAnestheticAgent', record.localAnestheticAgent],
            ['epinephrineUsed', record.epinephrineUsed],
            ['sutureType', record.sutureType],
            ['sutureSize', record.sutureSize],
            ['layeredClosure', record.layeredClosure],
            ['reconstructionMethod', record.reconstructionMethod],
            ['hemostasisMethod', record.hemostasisMethod],
          ].filter(([, v]) => hasVal(v));
          const sutureDateFmt = hasVal(record.sutureRemovalDate) ? formatDate(record.sutureRemovalDate) : '';

          /* Section 5: Additional Parameters */
          const additionalFields = [
            ['mohaStages', record.mohaStages],
            ['cryotherapyFreezeTime', record.cryotherapyFreezeTime],
            ['cryotherapyFreezeCycles', record.cryotherapyFreezeCycles],
            ['laserWavelengthNm', record.laserWavelengthNm],
            ['laserFluenceJcm2', record.laserFluenceJcm2],
          ].filter(([k, v]) => numHasVal(k, v));

          /* Section 6: Complications */
          const complications = Array.isArray(record.complicationsIntraoperative) ? record.complicationsIntraoperative : [];

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Dermatology Procedure Note ${idx + 1}`}</Text>
              </View>

              {/* Section 1: Indication & Lesion */}
              {indicationFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldGroup} wrap={indicationFields.length * 2 > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Indication & Lesion</Text>
                    {indicationFields.map(([key, val]) => renderFieldRows(key, val))}
                  </View>
                </View>
              )}

              {/* Section 2: Histopathology & Excision */}
              {(histoLines.length > 0 || histoSimple.length > 0) && (
                <View style={styles.section}>
                  <View style={styles.fieldGroup} wrap={(histoSimple.length * 2 + histoLines.length) > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Histopathology & Excision</Text>
                    {histoLines.length > 0 && (
                      <View>
                        <Text style={styles.fieldLabel}>Histopathology Result</Text>
                        {histoLines.map((l, i) => (
                          <Text key={i} style={l.sub ? styles.subLabel : styles.listItem}>{safeString(l.text)}</Text>
                        ))}
                      </View>
                    )}
                    {histoSimple.map(([key, val]) => renderFieldRows(key, val))}
                  </View>
                </View>
              )}

              {/* Section 3: Dermatoscopy Findings */}
              {dermaItems.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldGroup} wrap={dermaItems.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Dermatoscopy Findings</Text>
                    <Text style={styles.fieldLabel}>Dermatoscope Findings</Text>
                    {dermaItems.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{`${i + 1}. ${safeString(item)}`}</Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 4: Anesthesia & Closure */}
              {(anesthesiaFields.length > 0 || sutureDateFmt) && (
                <View style={styles.section}>
                  <View style={styles.fieldGroup} wrap={(anesthesiaFields.length + (sutureDateFmt ? 1 : 0)) * 2 > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Anesthesia & Closure</Text>
                    {anesthesiaFields.map(([key, val]) => renderFieldRows(key, val))}
                    {sutureDateFmt ? (
                      <View>
                        <Text style={styles.fieldLabel}>Suture Removal Date</Text>
                        <Text style={styles.listItem}>{`1. ${safeString(sutureDateFmt)}`}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Section 5: Additional Parameters */}
              {additionalFields.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldGroup} wrap={additionalFields.length * 2 > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Additional Parameters</Text>
                    {additionalFields.map(([key, val]) => renderFieldRows(key, val))}
                  </View>
                </View>
              )}

              {/* Section 6: Complications */}
              {complications.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldGroup} wrap={complications.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Complications</Text>
                    <Text style={styles.fieldLabel}>Intraoperative Complications</Text>
                    {complications.map((item, i) => (
                      <Text key={i} style={styles.listItem}>{`${i + 1}. ${safeString(typeof item === 'string' ? item : JSON.stringify(item))}`}</Text>
                    ))}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default DermatologyProcedureNotesDocumentPDFTemplate;

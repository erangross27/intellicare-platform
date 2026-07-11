/**
 * FamilyMedicineAssessmentDocumentPDFTemplate.jsx
 * July 2026 — Helvetica — LETTER size — BLACK & WHITE ONLY (#000000, no color/no bars)
 * Data collection: family_medicine_assessment
 *
 * Box-free — underlines only (documentTitle 2pt, sectionTitle 1pt black, fieldLabel 0.5pt #999).
 * Rule #74 — sections are wrap={false} atomic blocks (never the unbreakable ternary wrap idiom);
 * sectionTitle rides INSIDE the section View as its first child (never an orphaned sibling).
 * Every flat scalar field renders a standalone label (JSX/PDF parity). Mental-health scores render
 * as text rows with interpretation (the bar chart is a screen-only visualization).
 * `date` is the clinical visit date the JSX edits; createdAt/updatedAt (ingestion) are never rendered.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.5, backgroundColor: '#ffffff', color: '#000000' },
  documentTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 16, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordContainer: { marginBottom: 20 },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 10 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  groupLabel: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 6, marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid' },
  fieldValue: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 4 },
  listItem: { fontSize: 14, lineHeight: 1.5, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  noDataText: { fontSize: 12, color: '#000000', textAlign: 'center', marginTop: 40 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#666666' },
});

/* ═══════ HELPERS ═══════ */
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const hasStr = (v) => v !== null && v !== undefined && String(v).trim() !== '';

const formatDate = (dateString) => {
  if (!dateString) return '';
  try { return new Date(dateString.$date || dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return String(dateString); }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const safe = text.replace(/\bvs\.\s/gi, 'vs​ ').replace(/\bDr\.\s/gi, 'Dr​ ').replace(/\bMr\.\s/gi, 'Mr​ ').replace(/\bMrs\.\s/gi, 'Mrs​ ').replace(/\bSt\.\s/gi, 'St​ ');
  const raw = safe.split(/[;.]\s+/).map(s => s.replace(/vs​/g, 'vs.').replace(/Dr​/g, 'Dr.').replace(/Mr​/g, 'Mr.').replace(/Mrs​/g, 'Mrs.').replace(/St​/g, 'St.').trim()).filter(s => s && !/^[;.,!?]+$/.test(s));
  const merged = [];
  for (const s of raw) {
    if (merged.length > 0 && s.length < 15 && !/^\d+[.)]/.test(s)) merged[merged.length - 1] += '. ' + s;
    else merged.push(s);
  }
  return merged;
};

const splitByComma = (text) => {
  if (!text) return [];
  const s = String(text); const out = []; let cur = ''; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ',' && depth === 0) {
      const nx = s[i + 1] || ''; const nextWord = s.slice(i + 1).trim().split(/\s+/)[0] || '';
      if (/\d/.test(nx.trim()) || /^(and|or)\b/i.test(nextWord)) { cur += ch; }
      else { const t = cur.trim(); if (t) out.push(t); cur = ''; }
    } else cur += ch;
  }
  const t = cur.trim(); if (t) out.push(t);
  return out.length ? out : [String(text)];
};

const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* PHQ-9 / AUDIT score interpretation (mirrors the JSX bar-chart legend) */
const scoreInterp = (fn, score) => {
  const n = Number(score); if (isNaN(n)) return '';
  if (fn === 'phq9Score') { if (n <= 4) return 'Minimal Depression'; if (n <= 9) return 'Mild Depression'; if (n <= 14) return 'Moderate Depression'; if (n <= 19) return 'Moderately Severe Depression'; return 'Severe Depression'; }
  if (fn === 'auditScore') { if (n <= 7) return 'Low Risk'; if (n <= 15) return 'Hazardous Drinking'; if (n <= 19) return 'Harmful Drinking'; return 'Possible Dependence'; }
  return '';
};

/* recursive object node (results): label = bold heading; value = plain line below (stacked, never side-by-side) */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={styles.groupLabel}>{label}</Text> : null}
      {entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}
    </View>
  );
};

/* one labeled scalar field: standalone label + value below */
const Field = ({ label, value }) => (hasStr(value) ? (
  <View>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{String(value)}</Text>
  </View>
) : null);

/* a sentence field (assessment/plan): single-name → title only + numbered rows; labeled sentence → sub-group */
const renderSentenceBody = (text) => {
  const sentences = splitBySentence(String(text || ''));
  let n = 0;
  return sentences.map((sentence, sIdx) => {
    const parsed = parseLabel(sentence);
    if (parsed.isLabeled) {
      const items = splitByComma(parsed.value);
      return (
        <View key={sIdx}>
          <Text style={styles.fieldLabel}>{parsed.label}</Text>
          {items.map((it, i) => <Text key={i} style={styles.listItem}>{i + 1}. {it}</Text>)}
        </View>
      );
    }
    n += 1;
    return <Text key={sIdx} style={styles.listItem}>{n}. {sentence.replace(/[;.]+$/, '').trim()}</Text>;
  });
};

const unwrap = (doc) => {
  if (!doc) return [];
  if (Array.isArray(doc)) return doc.flatMap(r => (r?.family_medicine_assessment ? (Array.isArray(r.family_medicine_assessment) ? r.family_medicine_assessment : [r.family_medicine_assessment]) : [r]));
  if (doc.family_medicine_assessment) return Array.isArray(doc.family_medicine_assessment) ? doc.family_medicine_assessment : [doc.family_medicine_assessment];
  if (doc.documentData) { const dd = doc.documentData; if (Array.isArray(dd)) return dd; if (dd?.family_medicine_assessment) return Array.isArray(dd.family_medicine_assessment) ? dd.family_medicine_assessment : [dd.family_medicine_assessment]; return [dd]; }
  return [doc];
};

const FamilyMedicineAssessmentDocumentPDFTemplate = ({ document: doc }) => {
  const records = unwrap(doc).filter(r => r && typeof r === 'object');

  if (records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.documentTitle}>Family Medicine Assessment</Text>
          <Text style={styles.noDataText}>No family medicine assessment records available.</Text>
        </Page>
      </Document>
    );
  }

  const CDM_GROUPS = [
    { key: 'diabetes', label: 'Diabetes', fields: [['hba1c', 'HbA1c'], ['goal', 'Goal'], ['status', 'Status']] },
    { key: 'hypertension', label: 'Hypertension', fields: [['bp', 'BP'], ['goal', 'Goal'], ['status', 'Status']] },
    { key: 'hyperlipidemia', label: 'Hyperlipidemia', fields: [['ldl', 'LDL'], ['hdl', 'HDL'], ['goal', 'Goal'], ['status', 'Status']] },
  ];
  const PS_GROUPS = [
    { key: 'colonoscopy', label: 'Colonoscopy', fields: [['status', 'Status'], ['referral', 'Referral']] },
    { key: 'diabetesScreening', label: 'Diabetes Screening', fields: [['hba1c', 'HbA1c'], ['microalbumin', 'Microalbumin']] },
  ];

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.documentTitle}>Family Medicine Assessment</Text>
        {records.map((record, idx) => {
          const ps = record.preventiveScreening || {};
          const imm = record.immunizationStatus || {};
          const cdm = record.chronicDiseaseManagement || {};
          const mhs = record.mentalHealthScreening || {};
          const sdoh = record.socialDeterminants || {};

          const psActive = PS_GROUPS.filter(g => ps[g.key] && g.fields.some(([k]) => hasStr(ps[g.key][k])));
          const cdmActive = CDM_GROUPS.filter(g => cdm[g.key] && g.fields.some(([k]) => hasStr(cdm[g.key][k])));
          const vaccines = Array.isArray(imm.vaccines) ? imm.vaccines.filter(v => hasStr(v)) : [];
          const mhScores = ['phq9Score', 'auditScore'].filter(f => mhs[f] !== undefined && mhs[f] !== null && String(mhs[f]).trim() !== '');
          const sdohKeys = Object.keys(sdoh).filter(k => hasStr(sdoh[k]));
          const results = record.results;
          const resultsEntries = (!isEmptyDeep(results) && !isScalar(results)) ? Object.entries(results).filter(([, v]) => !isEmptyDeep(v)) : [];
          const recs = Array.isArray(record.recommendations) ? record.recommendations.filter(r => !isEmptyDeep(r)) : [];

          return (
            <View key={idx} style={styles.recordContainer} break={idx > 0}>
              <Text style={styles.recordTitle}>Family Medicine Assessment {idx + 1}</Text>

              {/* Session Information */}
              {(hasStr(record.date) || hasStr(record.provider) || hasStr(record.facility) || hasStr(record.status)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Session Information</Text>
                  <Field label="Date" value={record.date ? formatDate(record.date) : ''} />
                  <Field label="Provider" value={record.provider} />
                  <Field label="Facility" value={record.facility} />
                  <Field label="Status" value={record.status} />
                </View>
              )}

              {/* Preventive Screening */}
              {psActive.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Preventive Screening</Text>
                  {psActive.map(g => (
                    <View key={g.key}>
                      <Text style={styles.groupLabel}>{g.label}</Text>
                      {g.fields.filter(([k]) => hasStr(ps[g.key][k])).map(([k, lbl]) => <Field key={k} label={lbl} value={ps[g.key][k]} />)}
                    </View>
                  ))}
                </View>
              )}

              {/* Immunization Status */}
              {vaccines.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Immunization Status</Text>
                  <Text style={styles.fieldLabel}>Vaccines</Text>
                  {vaccines.map((v, i) => <Text key={i} style={styles.listItem}>{i + 1}. {typeof v === 'string' ? v : String(v.name || JSON.stringify(v))}</Text>)}
                </View>
              )}

              {/* Chronic Disease Management */}
              {cdmActive.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Chronic Disease Management</Text>
                  {cdmActive.map(g => (
                    <View key={g.key}>
                      <Text style={styles.groupLabel}>{g.label}</Text>
                      {g.fields.filter(([k]) => hasStr(cdm[g.key][k])).map(([k, lbl]) => <Field key={k} label={lbl} value={cdm[g.key][k]} />)}
                    </View>
                  ))}
                </View>
              )}

              {/* Mental Health Screening — scores as text rows (bar chart is screen-only) */}
              {mhScores.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Mental Health Screening</Text>
                  {mhScores.map(f => {
                    const lbl = f === 'phq9Score' ? 'PHQ-9 Score' : 'AUDIT Score';
                    const max = f === 'phq9Score' ? 27 : 40;
                    const interp = scoreInterp(f, mhs[f]);
                    return <Field key={f} label={lbl} value={`${mhs[f]}/${max}${interp ? ` (${interp})` : ''}`} />;
                  })}
                </View>
              )}

              {/* Social Determinants */}
              {sdohKeys.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Social Determinants</Text>
                  {sdohKeys.map(k => <Field key={k} label={humanizeKey(k)} value={fmtScalar(sdoh[k])} />)}
                </View>
              )}

              {/* Assessment (single-name: title only + numbered rows) */}
              {hasStr(record.assessment) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Assessment</Text>
                  {renderSentenceBody(record.assessment)}
                </View>
              )}

              {/* Plan (single-name: title only + numbered rows) */}
              {hasStr(record.plan) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Plan</Text>
                  {renderSentenceBody(record.plan)}
                </View>
              )}

              {/* Results (recursive object) */}
              {resultsEntries.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {resultsEntries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `results-${k}`, 1))}
                </View>
              )}

              {/* Recommendations (array of {recommendation, date}) */}
              {recs.length > 0 && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {recs.map((r, i) => <Text key={i} style={styles.listItem}>{i + 1}. {String((r?.recommendation || r).toString().trim())}{hasStr(r?.date) ? ` (${String(r.date)})` : ''}</Text>)}
                </View>
              )}

              {/* Findings */}
              {hasStr(record.findings) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Findings</Text>
                  {renderSentenceBody(record.findings)}
                </View>
              )}

              {/* Notes */}
              {hasStr(record.notes) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  {renderSentenceBody(record.notes)}
                </View>
              )}
            </View>
          );
        })}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Protected Health Information (PHI) - Handle according to HIPAA guidelines</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default FamilyMedicineAssessmentDocumentPDFTemplate;

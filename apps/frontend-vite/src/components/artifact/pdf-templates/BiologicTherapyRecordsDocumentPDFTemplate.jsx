/**
 * BiologicTherapyRecordsDocumentPDFTemplate.jsx
 * PDFDownloadLink + pdfData memo pattern, Helvetica font, ASCII separators
 * Standard: 20pt title, 14pt section, 12pt content
 * Numbered items, no label:value format
 *
 * Page breaks: every section uses the <Section> helper (boolean wrap, title-inside, orphan-proof
 * glue for tall sections) — memory 6a3cda8c (@react-pdf 4.3.2 treats wrap={undefined} as false → overprint).
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  documentTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 24, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#000000', paddingBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  recordSection: { marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#cccccc' },
  recordTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 8, backgroundColor: '#f0f0f0', padding: 8, borderWidth: 1, borderColor: '#000000' },
  recordMeta: { fontSize: 11, marginBottom: 4, color: '#333333', paddingLeft: 4 },
  fieldContainer: { marginBottom: 20, marginTop: 8 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 6 },
  subSectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 6, marginTop: 10, paddingLeft: 4 },
  listItem: { fontSize: 12, lineHeight: 1.6, paddingLeft: 12, marginBottom: 5 },
  nestedBlock: { marginBottom: 14, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#cccccc', paddingTop: 6, paddingBottom: 6 },
  nestedTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
  separator: { fontSize: 10, color: '#999999', marginBottom: 8, textAlign: 'center' },
});

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const formatBoolean = (v) => { if (v === true) return 'Yes'; if (v === false) return 'No'; return ''; };
// Built-in Helvetica lacks µ → ≥ ≤ etc.; a missing glyph renders as garbage AND eats the next space — keep ASCII.
const pdfSafe = (s) => String(s == null ? '' : s).replace(/→/g, '->').replace(/←/g, '<-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/µ/g, 'u').replace(/μ/g, 'u').replace(/±/g, '+/-').replace(/×/g, 'x').replace(/÷/g, '/').replace(/°/g, ' deg').replace(/—/g, '-').replace(/–/g, '-');

// Section wrapper (Rule #74 + memory 6a3cda8c): the sectionTitle lives INSIDE the View, never as a
// standalone sibling. Small (<=8 rows) → atomic wrap={false}: the whole block moves to the next page
// intact (never orphans, and fits one page so never overprints). Tall (>8 rows) → wrap={true} with the
// title GLUED to the first child in a wrap={false} sub-View, so the title can't strand while the
// remaining rows flow across pages. BOOLEAN wrap only — @react-pdf 4.3.2 treats wrap={undefined} as
// wrap={false}, which on a >1-page section produces the "can't wrap ... bigger than page height" overprint.
const Section = ({ title, rows, children }) => {
  const kids = React.Children.toArray(children);
  if (kids.length === 0) return null;
  if (rows > 8) return (
    <View style={styles.fieldContainer} wrap={true}>
      <View wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{kids[0]}</View>
      {kids.slice(1)}
    </View>
  );
  return (<View style={styles.fieldContainer} wrap={false}><Text style={styles.sectionTitle}>{title}</Text>{kids}</View>);
};

// Recursive object/array → Text rows for switchingBiologics / responseAssessment object items.
const humanizeKey = (key) => { if (key === null || key === undefined || key === '') return ''; const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); return s.charAt(0).toUpperCase() + s.slice(1); };
const isScalar = (v) => v === null || typeof v !== 'object';
const isEmptyDeep = (v) => { if (v === null || v === undefined) return true; if (typeof v === 'boolean') return false; if (typeof v === 'number') return !Number.isFinite(v); if (typeof v === 'string') return v.trim() === ''; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
// Returns array of {label, value, depth} rows (label-only when value is null -> sub-title).
const flattenObjectRows = (value, depth = 0) => {
  const rows = [];
  if (isEmptyDeep(value) || isScalar(value)) return rows;
  if (Array.isArray(value)) { value.filter(v => !isEmptyDeep(v)).forEach((item, i) => { if (isScalar(item)) rows.push({ label: null, value: `${i + 1}. ${fmtScalar(item)}`, depth }); else { rows.push({ label: `Item ${i + 1}`, value: null, depth }); rows.push(...flattenObjectRows(item, depth + 1)); } }); return rows; }
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => { const label = humanizeKey(k); if (isScalar(v)) rows.push({ label, value: fmtScalar(v), depth }); else { rows.push({ label, value: null, depth }); rows.push(...flattenObjectRows(v, depth + 1)); } });
  return rows;
};

// Additional Details — flat unified-medical-schema fields (typed: isDate / isArray / else sentence).
const ADDITIONAL_CONFIGS = [
  { field: 'medicationName', label: 'Medication Name' },
  { field: 'startDate', label: 'Start Date', isDate: true },
  { field: 'baselineAssessment', label: 'Baseline Assessment' },
  { field: 'monitoringLabs', label: 'Monitoring Labs', isArray: true },
  { field: 'sideEffects', label: 'Side Effects' },
  { field: 'infusionReactions', label: 'Infusion Reactions' },
  { field: 'continuationPlan', label: 'Continuation Plan' },
  { field: 'provider', label: 'Provider' },
  { field: 'facility', label: 'Facility' },
  { field: 'notes', label: 'Notes' },
];
const hasAdditionalVal = (v) => { if (v === null || v === undefined) return false; if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').length > 0; return String(v).trim() !== ''; };

const BiologicTherapyRecordsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => { if (r?.biologic_therapy_records) return Array.isArray(r.biologic_therapy_records) ? r.biologic_therapy_records : [r.biologic_therapy_records]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.biologic_therapy_records) return Array.isArray(dd.biologic_therapy_records) ? dd.biologic_therapy_records : [dd.biologic_therapy_records]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) return <Document><Page size="A4" style={styles.page}><Text style={styles.documentTitle}>Biologic Therapy Records</Text><Text style={styles.emptyState}>No records available</Text></Page></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Biologic Therapy Records</Text>
        {records.map((record, idx) => {
          const overviewItems = [];
          if (record.biologicAgent) overviewItems.push(record.biologicAgent);
          if (record.indication) String(record.indication).split(/;\s*/).filter(s => s.trim()).forEach(item => overviewItems.push(item));
          if (record.mechanismOfAction) overviewItems.push(record.mechanismOfAction);

          return (
            <View key={idx} style={styles.recordSection} break={idx > 0}>
              <View wrap={false}><Text style={styles.recordTitle}>{`Biologic Therapy Record ${idx + 1}`}</Text>{record.date && <Text style={styles.recordMeta}>{formatDate(record.date)}</Text>}</View>

              {/* Overview */}
              {overviewItems.length > 0 && (
                <Section title="Overview" rows={overviewItems.length}>
                  {overviewItems.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {pdfSafe(item)}</Text>)}
                </Section>
              )}

              {/* Prior Therapies */}
              {record.priorTherapies?.length > 0 && (() => {
                const ptTotal = record.priorTherapies.reduce((n, t) => n + 1 + [t.duration, t.response, t.maxDose, t.reasonForDiscontinuation].filter(Boolean).length, 0);
                return (
                <Section title="Prior Therapies" rows={ptTotal}>
                  {record.priorTherapies.map((t, ti) => {
                    const subItems = [t.duration, t.response, t.maxDose, t.reasonForDiscontinuation].filter(Boolean);
                    return (
                      <View key={ti} style={styles.nestedBlock} wrap={false}>
                        <Text style={styles.nestedTitle}>{ti + 1}. {pdfSafe(t.therapy || `Therapy ${ti + 1}`)}</Text>
                        {subItems.map((item, si) => <Text key={si} style={styles.listItem}>{si + 1}. {pdfSafe(item)}</Text>)}
                      </View>
                    );
                  })}
                </Section>
                );
              })()}

              {/* Baseline Assessment */}
              {record.baselineDiseaseAssessment && (() => {
                const baTotal = 1 + (record.baselineDiseaseAssessment.biomarkers?.length || 0);
                return (
                <Section title="Baseline Disease Assessment" rows={baTotal}>
                  {record.baselineDiseaseAssessment.assessmentDate && <Text style={styles.listItem}>{formatDate(record.baselineDiseaseAssessment.assessmentDate)}</Text>}
                  {record.baselineDiseaseAssessment.biomarkers?.length > 0 && (<>
                    <Text style={styles.subSectionTitle}>Biomarkers</Text>
                    {record.baselineDiseaseAssessment.biomarkers.map((b, bi) => <Text key={bi} style={styles.listItem}>{bi + 1}. {pdfSafe(b.biomarker)} - {pdfSafe(b.value)}</Text>)}
                  </>)}
                </Section>
                );
              })()}

              {/* Administration Plan */}
              {record.biologicAdministrationPlan && (() => {
                const ap = record.biologicAdministrationPlan;
                const items = [ap.loadingDose, ap.maintenanceDose, ap.route, ap.frequency, ap.administrationSetting, ap.durationOfTherapy].filter(Boolean);
                if (items.length === 0) return null;
                return (
                  <Section title="Administration Plan" rows={items.length}>
                    {items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {pdfSafe(item)}</Text>)}
                  </Section>
                );
              })()}

              {/* First Dose */}
              {record.firstDoseAdministration && (() => {
                const fd = record.firstDoseAdministration;
                const items = [fd.date ? formatDate(fd.date) : null, fd.location, fd.dose, fd.patientEducation !== undefined ? formatBoolean(fd.patientEducation) : null].filter(Boolean);
                if (items.length === 0) return null;
                return (
                  <Section title="First Dose Administration" rows={items.length}>
                    {items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {pdfSafe(item)}</Text>)}
                  </Section>
                );
              })()}

              {/* Response Assessment — ARRAY of objects */}
              {Array.isArray(record.responseAssessment) && record.responseAssessment.filter(a => !isEmptyDeep(a)).length > 0 && (() => {
                const items = record.responseAssessment.filter(a => !isEmptyDeep(a));
                const raTotal = items.reduce((n, ra) => n + 1 + flattenObjectRows(ra).length, 0);
                return (
                <Section title="Response Assessment" rows={raTotal}>
                  {items.map((ra, ri) => {
                    const titleVal = ra.assessmentDate ? formatDate(ra.assessmentDate) : (ra.weeksOnTherapy !== undefined && ra.weeksOnTherapy !== null ? `Week ${ra.weeksOnTherapy}` : `Assessment ${ri + 1}`);
                    const rows = flattenObjectRows(ra);
                    return (
                      <View key={ri} style={styles.nestedBlock} wrap={rows.length > 8}>
                        <Text style={styles.nestedTitle}>{ri + 1}. {`Assessment ${ri + 1} - ${pdfSafe(titleVal)}`}</Text>
                        {rows.map((r, i) => r.value === null
                          ? <Text key={i} style={styles.subSectionTitle}>{pdfSafe(r.label)}</Text>
                          : <Text key={i} style={styles.listItem}>{r.label ? `${pdfSafe(r.label)}: ${pdfSafe(r.value)}` : pdfSafe(r.value)}</Text>)}
                      </View>
                    );
                  })}
                </Section>
                );
              })()}

              {/* Adverse Events */}
              {record.adverseEvents?.length > 0 && (() => {
                const aeTotal = record.adverseEvents.reduce((n, ae) => n + 1 + (ae.management ? 1 : 0), 0);
                return (
                <Section title="Adverse Events" rows={aeTotal}>
                  {record.adverseEvents.map((ae, ai) => (
                    <View key={ai} style={styles.nestedBlock} wrap={false}>
                      <Text style={styles.nestedTitle}>{ai + 1}. {pdfSafe(ae.event)}{ae.severity ? ` [${pdfSafe(ae.severity)}]` : ''}</Text>
                      {ae.management && <Text style={styles.listItem}>{pdfSafe(ae.management)}</Text>}
                    </View>
                  ))}
                </Section>
                );
              })()}

              {/* Safety Monitoring — triple-nested with colon-parsed values. rows = comma/colon-expanded count. */}
              {record.safetyMonitoring && (() => {
                const bs = record.safetyMonitoring.baselineScreening || {};
                const om = record.safetyMonitoring.ongoingMonitoring || {};
                const smTotal = [bs.tbTesting, bs.hepatitisPanel, bs.cbcBaseline, bs.lftsBaseline, om.labFrequency, om.infectionScreening, om.immunizationStatus]
                  .filter(Boolean).reduce((n, v) => n + 1 + String(v).split(/,\s*/).filter(s => s.trim()).length, 0);
                return (
                <Section title="Safety Monitoring" rows={smTotal}>
                  {record.safetyMonitoring.baselineScreening && (() => {
                    const bs2 = record.safetyMonitoring.baselineScreening;
                    const fields = [['tbTesting', 'TB Testing'], ['hepatitisPanel', 'Hepatitis Panel'], ['cbcBaseline', 'CBC'], ['lftsBaseline', 'LFTs']];
                    const hasAny = fields.some(([sf]) => bs2[sf]);
                    if (!hasAny) return null;
                    return (<>
                      <Text style={styles.subSectionTitle}>Baseline Screening</Text>
                      {fields.map(([sf, label]) => {
                        const val = bs2[sf]; if (!val) return null;
                        const items = String(val).split(/,\s*/).filter(s => s.trim());
                        return (<View key={sf} style={styles.nestedBlock} wrap={items.length > 8}><Text style={styles.nestedTitle}>{label}</Text>
                          {items.map((item, i) => { const ci = item.indexOf(':'); if (ci > 0) return (<View key={i} wrap={false}><Text style={styles.subSectionTitle}>{pdfSafe(item.substring(0, ci).trim())}</Text><Text style={styles.listItem}>{i + 1}. {pdfSafe(item.substring(ci + 1).trim())}</Text></View>); return <Text key={i} style={styles.listItem}>{i + 1}. {pdfSafe(item)}</Text>; })}
                        </View>);
                      })}
                    </>);
                  })()}
                  {record.safetyMonitoring.ongoingMonitoring && (() => {
                    const om2 = record.safetyMonitoring.ongoingMonitoring;
                    const fields = [['labFrequency', 'Lab Frequency'], ['infectionScreening', 'Infection Screening'], ['immunizationStatus', 'Immunization Status']];
                    const hasAny = fields.some(([sf]) => om2[sf]);
                    if (!hasAny) return null;
                    return (<>
                      <Text style={styles.subSectionTitle}>Ongoing Monitoring</Text>
                      {fields.map(([sf, label]) => {
                        const val = om2[sf]; if (!val) return null;
                        const items = String(val).split(/,\s*/).filter(s => s.trim());
                        return (<View key={sf} style={styles.nestedBlock} wrap={items.length > 8}><Text style={styles.nestedTitle}>{label}</Text>
                          {items.map((item, i) => { const ci = item.indexOf(':'); if (ci > 0) return (<View key={i} wrap={false}><Text style={styles.subSectionTitle}>{pdfSafe(item.substring(0, ci).trim())}</Text><Text style={styles.listItem}>{i + 1}. {pdfSafe(item.substring(ci + 1).trim())}</Text></View>); return <Text key={i} style={styles.listItem}>{i + 1}. {pdfSafe(item)}</Text>; })}
                        </View>);
                      })}
                    </>);
                  })()}
                </Section>
                );
              })()}

              {/* Insurance Authorization */}
              {record.insuranceAuthorization && (() => {
                const ia = record.insuranceAuthorization;
                const items = [ia.priorAuthorizationStatus, ia.approvalDate ? formatDate(ia.approvalDate) : null, ia.authorizationPeriod, ia.reauthorizationDue, ia.outOfPocketCost].filter(Boolean);
                const cItems = ia.copayAssistance ? [ia.copayAssistance.program, ia.copayAssistance.enrolled !== undefined ? formatBoolean(ia.copayAssistance.enrolled) : null, ia.copayAssistance.coverageAmount].filter(Boolean) : [];
                const insRows = items.length + (cItems.length > 0 ? 1 + cItems.length : 0);
                return (
                  <Section title="Insurance Authorization" rows={insRows}>
                    {items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {pdfSafe(item)}</Text>)}
                    {cItems.length > 0 && (<>
                      <Text style={styles.subSectionTitle}>Copay Assistance</Text>
                      {cItems.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {pdfSafe(item)}</Text>)}
                    </>)}
                  </Section>
                );
              })()}

              {/* Treatment Plan */}
              {record.treatmentPlan && (() => {
                const tp = record.treatmentPlan;
                const extra = [tp.responseThreshold, tp.durationOfTrial].filter(Boolean);
                const tpTotal = (tp.shortTermGoals?.length || 0) + (tp.longTermGoals?.length || 0) + extra.length + (tp.concomitantTherapies?.length || 0);
                return (
                <Section title="Treatment Plan" rows={tpTotal}>
                  {tp.shortTermGoals?.length > 0 && (<>
                    <Text style={styles.subSectionTitle}>Short-Term Goals</Text>
                    {tp.shortTermGoals.map((g, gi) => <Text key={gi} style={styles.listItem}>{gi + 1}. {pdfSafe(g)}</Text>)}
                  </>)}
                  {tp.longTermGoals?.length > 0 && (<>
                    <Text style={styles.subSectionTitle}>Long-Term Goals</Text>
                    {tp.longTermGoals.map((g, gi) => <Text key={gi} style={styles.listItem}>{gi + 1}. {pdfSafe(g)}</Text>)}
                  </>)}
                  {extra.map((item, i) => <Text key={`extra-${i}`} style={styles.listItem}>{i + 1}. {pdfSafe(item)}</Text>)}
                  {tp.concomitantTherapies?.length > 0 && (<>
                    <Text style={styles.subSectionTitle}>Concomitant Therapies</Text>
                    {tp.concomitantTherapies.map((t, ti) => <Text key={ti} style={styles.listItem}>{ti + 1}. {pdfSafe(t)}</Text>)}
                  </>)}
                </Section>
                );
              })()}

              {/* Switching Biologics — OBJECT, recursive flattened rows */}
              {record.switchingBiologics && !isEmptyDeep(record.switchingBiologics) && (() => {
                const rows = flattenObjectRows(record.switchingBiologics);
                if (rows.length === 0) return null;
                return (
                <Section title="Switching Biologics" rows={rows.length}>
                  {rows.map((r, i) => r.value === null
                    ? <Text key={i} style={styles.subSectionTitle}>{pdfSafe(r.label)}</Text>
                    : <Text key={i} style={styles.listItem}>{r.label ? `${pdfSafe(r.label)}: ${pdfSafe(r.value)}` : pdfSafe(r.value)}</Text>)}
                </Section>
                );
              })()}

              {/* Additional Details — flat schema fields. Rule #74: each field is one wrap-gated View;
                  sectionTitle is the FIRST child of the first present field's View (anti-orphan). */}
              {(() => {
                const present = ADDITIONAL_CONFIGS.filter(c => hasAdditionalVal(record[c.field]));
                if (present.length === 0) return null;
                return present.map((c, fi) => {
                  const val = record[c.field];
                  const titleNode = fi === 0 ? <Text style={styles.sectionTitle}>Additional Details</Text> : null;
                  if (c.isDate) {
                    return (<View key={c.field} style={styles.fieldContainer} wrap={false}>{titleNode}<Text style={styles.subSectionTitle}>{c.label}</Text><Text style={styles.listItem}>{formatDate(val)}</Text></View>);
                  }
                  if (c.isArray) {
                    const items = (Array.isArray(val) ? val : []).filter(x => x !== null && x !== undefined && String(x).trim() !== '');
                    return (<View key={c.field} style={styles.fieldContainer} wrap={items.length > 8}>{titleNode}<Text style={styles.subSectionTitle}>{c.label}</Text>{items.map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {pdfSafe(item)}</Text>)}</View>);
                  }
                  const sentences = String(val).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
                  return (<View key={c.field} style={styles.fieldContainer} wrap={sentences.length > 8}>{titleNode}<Text style={styles.subSectionTitle}>{c.label}</Text>{sentences.length > 1 ? sentences.map((s, i) => <Text key={i} style={styles.listItem}>{i + 1}. {pdfSafe(s)}</Text>) : <Text style={styles.listItem}>{pdfSafe(val)}</Text>}</View>);
                });
              })()}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default BiologicTherapyRecordsDocumentPDFTemplate;

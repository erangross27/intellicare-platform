/**
 * DeliveryPlanningDocumentPDFTemplate.jsx
 * Box-free bigger fonts (26/19/16/12/14) per checklist — LETTER B&W — new theme
 * Collection: delivery_planning
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 14, lineHeight: 1.4, backgroundColor: '#ffffff', color: '#000000' },
  documentHeader: { marginBottom: 20, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  title: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#000000', textAlign: 'center', marginBottom: 4, textTransform: 'uppercase' },
  recordContainer: { marginBottom: 0, paddingBottom: 16 },
  recordHeader: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid' },
  recordTitle: { fontSize: 19, fontFamily: 'Helvetica-Bold', color: '#000000' },
  recordMeta: { fontSize: 12, color: '#000000', fontFamily: 'Helvetica' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 4, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#000000', borderBottomStyle: 'solid', paddingBottom: 2 },
  fieldBox: { marginBottom: 6, paddingBottom: 4 },
  fieldLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#000000', marginBottom: 2 },
  fieldValue: { fontSize: 14, lineHeight: 1.4, color: '#000000' },
  listItem: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  nestedSubtitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 4, marginBottom: 2, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', paddingBottom: 1 },
  objectGroup: { marginLeft: 10, marginTop: 2, paddingLeft: 8 },
  objectLeafLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 3, borderBottomWidth: 0.5, borderBottomColor: '#999999', borderBottomStyle: 'solid', paddingBottom: 1 },
  objectLeafValue: { fontSize: 14, lineHeight: 1.4, color: '#000000', marginBottom: 2, paddingLeft: 8 },
  emptyState: { textAlign: 'center', padding: 40, fontSize: 14, color: '#666666' },
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

const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; if (typeof v === 'object') return Object.keys(v).length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const stripDelims = (t) => String(t || '').replace(/^[\s.;,]+/, '').replace(/[\s.;,]+$/, '').trim();

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

const renderFieldRow = (label, value) => {
  if (!hasVal(value)) return null;
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.listItem}>1. {stripDelims(safeString(fmtVal(value)))}</Text>
    </View>
  );
};

/* renderSentenceSection: parseLabel + comma-split for Label:value fields */
const renderSentenceSection = (title, text, sectionTitle) => {
  if (!hasVal(text)) return null;
  const sentences = splitBySentence(fmtVal(text));
  if (sentences.length === 0) return null;

  const rows = [];
  let n = 1;
  sentences.forEach(s => {
    const parsed = parseLabel(s);
    if (parsed.isLabeled) {
      /* labeled group: comma-split at >=3; numbering restarts at 1 (unlabeled rows continue running count) */
      const rawComma = splitByComma(parsed.value);
      const commaItems = rawComma.length >= 3 ? rawComma : [parsed.value];
      rows.push({ type: 'subtitle', text: safeString(parsed.label) });
      commaItems.forEach((ci, i) => { rows.push({ type: 'item', text: safeString(ci), num: i + 1 }); });
    } else {
      rows.push({ type: 'item', text: safeString(s), num: n++ });
    }
  });

  const wrapProp = rows.length > 8 ? true : false;
  /* single-name rule: field label == section title → show only the section title */
  const showFieldLabel = title && title.toLowerCase() !== String(sectionTitle || '').toLowerCase();

  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={wrapProp}>
        {sectionTitle && <Text style={styles.sectionTitle}>{sectionTitle}</Text>}
        {showFieldLabel && <Text style={styles.fieldLabel}>{title}</Text>}
        {rows.map((row, i) => {
          if (row.type === 'subtitle') {
            return <Text key={i} style={styles.nestedSubtitle}>{row.text}</Text>;
          }
          return <Text key={i} style={styles.listItem}>{row.num}. {stripDelims(row.text)}</Text>;
        })}
      </View>
    </View>
  );
};

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
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

/* countLeaves: number of scalar leaves in an object tree (for wrap-gating) */
const countLeaves = (obj) => {
  if (isEmptyDeep(obj)) return 0;
  if (isScalar(obj)) return 1;
  return Object.values(obj).reduce((acc, v) => acc + countLeaves(v), 0);
};

/* renderObjectTree: recursive grayscale object renderer */
const renderObjectTree = (value, keyPrefix) => {
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  return entries.map(([k, v]) => {
    if (isScalar(v)) {
      return (
        <View key={`${keyPrefix}-${k}`} style={{ marginBottom: 2 }}>
          <Text style={styles.objectLeafLabel}>{safeString(humanizeKey(k))}</Text>
          <Text style={styles.objectLeafValue}>1. {stripDelims(safeString(fmtScalar(v)))}</Text>
        </View>
      );
    }
    return (
      <View key={`${keyPrefix}-${k}`} style={{ marginBottom: 2 }}>
        <Text style={styles.nestedSubtitle}>{safeString(humanizeKey(k))}</Text>
        <View style={styles.objectGroup}>{renderObjectTree(v, `${keyPrefix}-${k}`)}</View>
      </View>
    );
  });
};

/* renderObjectSection: OBJECT field — recursive, leaf-count wrap-gated */
const renderObjectSection = (sectionTitle, value) => {
  if (!hasVal(value) || isScalar(value)) return null;
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  const leaves = countLeaves(value);
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={leaves > 8 ? true : false}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        {renderObjectTree(value, 'root')}
      </View>
    </View>
  );
};

/* renderRecommendationsSection: array of {recommendation, date}, date-grouped, count wrap-gated */
const renderRecommendationsSection = (sectionTitle, recsRaw) => {
  const recs = Array.isArray(recsRaw) ? recsRaw.filter(r => hasVal(r?.recommendation)) : [];
  if (recs.length === 0) return null;
  const groups = [];
  recs.forEach((rec) => {
    const d = (rec?.date || '').trim();
    const last = groups[groups.length - 1];
    if (last && last.date === d) last.items.push(rec);
    else groups.push({ date: d, items: [rec] });
  });
  return (
    <View style={styles.section}>
      <View style={styles.fieldBox} wrap={recs.length > 8 ? true : false}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        {groups.map((group, gi) => {
          let n = 1;
          return (
            <View key={gi} style={{ marginBottom: 2 }}>
              {group.date ? <Text style={styles.nestedSubtitle}>{safeString(group.date)}</Text> : null}
              {group.items.map((rec, ri) => (
                <Text key={ri} style={styles.listItem}>{n++}. {stripDelims(safeString(String(rec?.recommendation || '')))}</Text>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
};

/* ═══ COMPONENT ═══ */
const DeliveryPlanningDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.delivery_planning) return Array.isArray(r.delivery_planning) ? r.delivery_planning : [r.delivery_planning];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.delivery_planning) return Array.isArray(dd.delivery_planning) ? dd.delivery_planning : [dd.delivery_planning]; return [dd]; }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}><Text style={styles.title}>Delivery Planning</Text></View>
          <Text style={styles.emptyState}>No records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}><Text style={styles.title}>Delivery Planning</Text></View>

        {records.map((record, idx) => {
          const indArr = Array.isArray(record.indicationsForDelivery) ? record.indicationsForDelivery : [];
          const anesthArr = Array.isArray(record.anesthesiaConsiderations) ? record.anesthesiaConsiderations : [];
          const prepArr = Array.isArray(record.specialPreparations) ? record.specialPreparations : [];

          return (
            <View key={idx} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>{`Delivery Planning ${idx + 1}`}</Text>
              </View>

              {/* Section 1: Provider Information */}
              {(hasVal(record.date) || hasVal(record.provider) || hasVal(record.facility) || hasVal(record.status)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Provider Information</Text>
                    {hasVal(record.date) && renderFieldRow('Date', formatDate(record.date))}
                    {renderFieldRow('Provider', record.provider)}
                    {renderFieldRow('Facility', record.facility)}
                    {renderFieldRow('Status', record.status)}
                  </View>
                </View>
              )}

              {/* Section 2: Delivery Plan */}
              {(hasVal(record.targetGestationalAge) || hasVal(record.plannedDeliveryMode)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Delivery Plan</Text>
                    {renderFieldRow('Target Gestational Age', record.targetGestationalAge)}
                    {renderFieldRow('Planned Delivery Mode', record.plannedDeliveryMode)}
                  </View>
                </View>
              )}

              {/* Section 3: Indications for Delivery */}
              {indArr.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={indArr.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Indications for Delivery</Text>
                    {indArr.map((item, ri) => (
                      <Text key={ri} style={styles.listItem}>{ri + 1}. {stripDelims(safeString(String(item || '')))}</Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 4: Anesthesia & Neonatology */}
              {(anesthArr.length > 0 || hasVal(record.neonatologyConsult)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={(anesthArr.length + 1) > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Anesthesia & Neonatology</Text>
                    {anesthArr.length > 0 && (
                      <View style={{ marginBottom: 4 }}>
                        <Text style={styles.nestedSubtitle}>Anesthesia Considerations</Text>
                        {anesthArr.map((item, ai) => (
                          <Text key={ai} style={styles.listItem}>{ai + 1}. {stripDelims(safeString(String(item || '')))}</Text>
                        ))}
                      </View>
                    )}
                    {renderFieldRow('Neonatology Consult', record.neonatologyConsult)}
                  </View>
                </View>
              )}

              {/* Section 5: Special Preparations */}
              {prepArr.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={prepArr.length > 8 ? true : false}>
                    <Text style={styles.sectionTitle}>Special Preparations</Text>
                    {prepArr.map((item, pi) => (
                      <Text key={pi} style={styles.listItem}>{pi + 1}. {stripDelims(safeString(String(item || '')))}</Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Section 6: Delivery Conditions */}
              {(hasVal(record.earlyDeliveryConditions) || hasVal(record.trialOfLaborCriteria) || hasVal(record.postpartumContraception)) && (() => {
                const fields = [];
                if (hasVal(record.earlyDeliveryConditions)) fields.push('earlyDeliveryConditions');
                if (hasVal(record.trialOfLaborCriteria)) fields.push('trialOfLaborCriteria');
                if (hasVal(record.postpartumContraception)) fields.push('postpartumContraception');
                return (
                  <View style={styles.section}>
                    {/* earlyDeliveryConditions — parseLabel + comma-split */}
                    {hasVal(record.earlyDeliveryConditions) && renderSentenceSection('Early Delivery Conditions', record.earlyDeliveryConditions, 'Delivery Conditions')}
                    {/* trialOfLaborCriteria — simple */}
                    {hasVal(record.trialOfLaborCriteria) && !hasVal(record.earlyDeliveryConditions) && (
                      <View style={styles.fieldBox} wrap={false}>
                        <Text style={styles.sectionTitle}>Delivery Conditions</Text>
                        {renderFieldRow('Trial of Labor Criteria', record.trialOfLaborCriteria)}
                      </View>
                    )}
                    {hasVal(record.trialOfLaborCriteria) && hasVal(record.earlyDeliveryConditions) && (
                      <View style={styles.fieldBox} wrap={false}>
                        {renderFieldRow('Trial of Labor Criteria', record.trialOfLaborCriteria)}
                      </View>
                    )}
                    {/* postpartumContraception */}
                    {hasVal(record.postpartumContraception) && (
                      <View style={styles.fieldBox} wrap={false}>
                        {renderFieldRow('Postpartum Contraception', record.postpartumContraception)}
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Section 7: Findings & Assessment — parseLabel + comma-split */}
              {renderSentenceSection('Findings', record.findings, 'Findings & Assessment')}
              {renderSentenceSection('Assessment', record.assessment, hasVal(record.findings) ? null : 'Findings & Assessment')}

              {/* Section 8: Plan — parseLabel + comma-split */}
              {renderSentenceSection('Plan', record.plan, 'Plan')}

              {/* Section 9: Recommendations — object-array, date-grouped */}
              {renderRecommendationsSection('Recommendations', record.recommendations)}

              {/* Section 10: Results — recursive OBJECT */}
              {renderObjectSection('Results', record.results)}

              {/* Section 11: Notes — parseLabel + comma-split narrative */}
              {renderSentenceSection('Notes', record.notes, 'Notes')}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default DeliveryPlanningDocumentPDFTemplate;

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* BLACK & WHITE PDF — Helvetica LETTER 20pt/12pt */
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
    size: 'LETTER',
  },
  recordCard: {
    marginBottom: 16,
  },
  recordTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 8,
  },
  recordDate: {
    fontSize: 12,
    color: '#000000',
    marginBottom: 4,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldBlock: {
    marginBottom: 6,
    paddingLeft: 8,
  },
  fieldSubtitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 12,
    color: '#000000',
  },
  listItem: {
    fontSize: 12,
    color: '#000000',
    paddingLeft: 8,
    marginBottom: 2,
  },
  contentText: {
    fontSize: 12,
    color: '#000000',
    marginBottom: 4,
    paddingLeft: 8,
  },
  subLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 4,
    marginBottom: 1,
  },
  nested: {
    marginLeft: 10,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#000000',
    marginTop: 2,
  },
  recDate: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 4,
  },
});

/* ═══════ OBJECT/ARRAY HELPERS — grayscale-only ═══════ */
const KEY_OVERRIDES = {};
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];
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
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

/* recursive object node: label = bold heading; value = plain line below */
const renderObjectNode = (label, value, keyPath, depth, styles) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldSubtitle;
  if (isScalar(value)) {
    return (
      <View key={keyPath}>
        {label ? <Text style={LabelTag}>{label}</Text> : null}
        <Text style={styles.fieldValue}>{fmtScalar(value)}</Text>
      </View>
    );
  }
  const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
  if (entries.length === 0) return null;
  return (
    <View key={keyPath}>
      {label ? <Text style={LabelTag}>{label}</Text> : null}
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1, styles))}</View>
    </View>
  );
};

const PrognosisDiscussionDocumentPDFTemplate = ({ document: data }) => {
  /* Unwrap data */
  const unwrapData = (rawData) => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) {
      if (rawData.length === 0) return [];
      if (rawData[0]?.prognosis_discussion && Array.isArray(rawData[0].prognosis_discussion)) return rawData[0].prognosis_discussion;
      if (rawData[0]?._records && Array.isArray(rawData[0]._records)) return rawData[0]._records;
      if (rawData[0]?.records && Array.isArray(rawData[0].records)) return rawData[0].records;
      return rawData;
    }
    if (rawData.prognosis_discussion && Array.isArray(rawData.prognosis_discussion)) return rawData.prognosis_discussion;
    if (rawData._records && Array.isArray(rawData._records)) return rawData._records;
    if (rawData.records && Array.isArray(rawData.records)) return rawData.records;
    if (rawData.date || rawData.findings || rawData.notes || rawData.patientUnderstandingButAnxious) return [rawData];
    return [];
  };

  const records = unwrapData(data);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try { return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return dateString; }
  };

  const formatBoolean = (value) => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return '';
  };

  const hasResults = (v) => v && !isScalar(v) && !isEmptyDeep(v) && Object.entries(v).filter(([, x]) => !isEmptyDeep(x)).length > 0;

  const splitIntoSentences = (text) => {
    if (!text || typeof text !== 'string') return [];
    const sentences = text.split(/(?<=\.)\s+/);
    return sentences.map(s => s.trim()).filter(Boolean);
  };

  const parseFindingsWithLabels = (text) => {
    if (!text || typeof text !== 'string') return [];
    const groups = [];
    const sentences = text.split(/\.\s+/).filter(s => s.trim());
    let currentGroup = null;
    sentences.forEach(sentence => {
      const colonIdx = sentence.indexOf(':');
      if (colonIdx > 0 && colonIdx < 80) {
        if (currentGroup) groups.push(currentGroup);
        const label = sentence.substring(0, colonIdx).trim();
        const content = sentence.substring(colonIdx + 1).trim();
        const items = []; let current = ''; let parenDepth = 0;
        for (let i = 0; i < content.length; i++) {
          const char = content[i];
          if (char === '(') parenDepth++;
          else if (char === ')') parenDepth--;
          else if (char === ',' && parenDepth === 0) { if (current.trim()) items.push(current.trim()); current = ''; continue; }
          current += char;
        }
        if (current.trim()) items.push(current.trim());
        currentGroup = { label, items };
      } else {
        if (currentGroup) { currentGroup.items.push(sentence.trim()); } else { currentGroup = { label: null, items: [sentence.trim()] }; }
      }
    });
    if (currentGroup) groups.push(currentGroup);
    return groups;
  };

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text>No Prognosis Discussion data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {records.map((record, idx) => (
          <View key={idx} style={styles.recordCard}>
            <Text style={styles.recordTitle}>PROGNOSIS DISCUSSION {idx + 1}</Text>
            {record.date && <Text style={styles.recordDate}>Date: {formatDate(record.date)}</Text>}
            {record.status && <Text style={styles.recordDate}>Status: {record.status}</Text>}

            {/* Discussion Information */}
            {(record.date || record.provider || record.facility) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>DISCUSSION INFORMATION</Text>
                {record.date && (<View style={styles.fieldBlock}><Text style={styles.fieldSubtitle}>DATE</Text><Text style={styles.fieldValue}>{formatDate(record.date)}</Text></View>)}
                {record.provider && (<View style={styles.fieldBlock}><Text style={styles.fieldSubtitle}>PROVIDER</Text><Text style={styles.fieldValue}>{record.provider}</Text></View>)}
                {record.facility && (<View style={styles.fieldBlock}><Text style={styles.fieldSubtitle}>FACILITY</Text><Text style={styles.fieldValue}>{record.facility}</Text></View>)}
              </View>
            )}

            {/* Patient Response */}
            {(record.patientUnderstandingButAnxious || record.patientTearful !== undefined) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PATIENT RESPONSE</Text>
                {record.patientUnderstandingButAnxious && (<View style={styles.fieldBlock}><Text style={styles.fieldSubtitle}>PATIENT UNDERSTANDING</Text><Text style={styles.fieldValue}>{record.patientUnderstandingButAnxious}</Text></View>)}
                {record.patientTearful !== undefined && (<View style={styles.fieldBlock}><Text style={styles.fieldSubtitle}>PATIENT TEARFUL</Text><Text style={styles.fieldValue}>{formatBoolean(record.patientTearful)}</Text></View>)}
              </View>
            )}

            {/* Support System */}
            {(record.familySupport || record.brotherVerySupportive || record.providedEmotionalSupportAndResources !== undefined) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>SUPPORT SYSTEM</Text>
                {record.familySupport && (<View style={styles.fieldBlock}><Text style={styles.fieldSubtitle}>FAMILY SUPPORT</Text><Text style={styles.fieldValue}>{record.familySupport}</Text></View>)}
                {record.brotherVerySupportive && (<View style={styles.fieldBlock}><Text style={styles.fieldSubtitle}>BROTHER VERY SUPPORTIVE</Text><Text style={styles.fieldValue}>{record.brotherVerySupportive}</Text></View>)}
                {record.providedEmotionalSupportAndResources !== undefined && (<View style={styles.fieldBlock}><Text style={styles.fieldSubtitle}>EMOTIONAL SUPPORT PROVIDED</Text><Text style={styles.fieldValue}>{formatBoolean(record.providedEmotionalSupportAndResources)}</Text></View>)}
              </View>
            )}

            {/* Counseling */}
            {record.emphasizedProgressionCanBeSlowed !== undefined && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>COUNSELING</Text>
                <View style={styles.fieldBlock}><Text style={styles.fieldSubtitle}>PROGRESSION CAN BE SLOWED</Text><Text style={styles.fieldValue}>{formatBoolean(record.emphasizedProgressionCanBeSlowed)}</Text></View>
              </View>
            )}

            {/* Findings */}
            {record.findings && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>FINDINGS</Text>
                {parseFindingsWithLabels(record.findings).map((group, gIdx) => (
                  <View key={gIdx} style={styles.fieldBlock}>
                    {group.label && <Text style={styles.fieldSubtitle}>{group.label}</Text>}
                    {group.items.map((item, iIdx) => (<Text key={iIdx} style={styles.listItem}>{iIdx + 1}. {item}</Text>))}
                  </View>
                ))}
              </View>
            )}

            {/* Assessment & Plan */}
            {(record.assessment || record.plan) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>ASSESSMENT & PLAN</Text>
                {record.assessment && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>ASSESSMENT</Text>
                    {splitIntoSentences(record.assessment).map((sentence, sIdx) => (<Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>))}
                  </View>
                )}
                {record.plan && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldSubtitle}>PLAN</Text>
                    {splitIntoSentences(record.plan).map((sentence, sIdx) => (<Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>))}
                  </View>
                )}
              </View>
            )}

            {/* Results (OBJECT, recursive) */}
            {hasResults(record.results) && (
              <View style={styles.section}>
                {Object.entries(record.results).filter(([, v]) => !isEmptyDeep(v)).map(([k, v], i) => (
                  <View key={`results-${k}`} style={styles.fieldBlock} wrap={countRows(v) > 8 ? undefined : false}>
                    {i === 0 ? <Text style={styles.sectionTitle}>RESULTS</Text> : null}
                    {renderObjectNode(humanizeKey(k), v, `results-${k}`, 1, styles)}
                  </View>
                ))}
              </View>
            )}

            {/* Recommendations (ARRAY of {recommendation, date}) */}
            {Array.isArray(record.recommendations) && record.recommendations.filter(r => !isEmptyDeep(r)).length > 0 && (() => {
              const recs = record.recommendations.filter(r => !isEmptyDeep(r));
              const groups = [];
              recs.forEach((r) => { const d = (r?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push(r); else groups.push({ date: d, items: [r] }); });
              return (
                <View style={styles.section}>
                  <View style={styles.fieldBlock} wrap={recs.length > 8 ? undefined : false}>
                    <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
                    {groups.map((group, gIdx) => (
                      <View key={gIdx}>
                        {group.date ? <Text style={styles.recDate}>{group.date}</Text> : null}
                        {group.items.map((r, i) => (<Text key={i} style={styles.listItem}>{i + 1}. {(r?.recommendation || '').trim()}</Text>))}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}

            {/* Financial Concerns */}
            {record.financialConcernsSignificant && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>FINANCIAL CONCERNS</Text>
                {splitIntoSentences(record.financialConcernsSignificant).map((sentence, sIdx) => (<Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>))}
              </View>
            )}

            {/* Monitoring & Notes */}
            {record.willNeedCloseMonitoring && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>FOLLOW-UP MONITORING</Text>
                {splitIntoSentences(record.willNeedCloseMonitoring).map((sentence, sIdx) => (<Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>))}
              </View>
            )}

            {record.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>NOTES</Text>
                {splitIntoSentences(record.notes).map((sentence, sIdx) => (<Text key={sIdx} style={styles.listItem}>{sIdx + 1}. {sentence}</Text>))}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PrognosisDiscussionDocumentPDFTemplate;

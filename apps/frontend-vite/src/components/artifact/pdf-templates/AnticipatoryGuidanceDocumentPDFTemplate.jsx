import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 13,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  header: {
    marginBottom: 24,
    paddingBottom: 12,
  },
  documentTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    textAlign: 'center',
    borderBottom: '2pt solid #000000',
    paddingBottom: 8,
  },
  recordCard: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  recordTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#000000',
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 8,
    color: '#000000',
    borderBottom: '1pt solid #000000',
    paddingBottom: 4,
  },
  fieldBlock: {
    marginBottom: 8,
    paddingLeft: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    color: '#333333',
    borderBottom: '0.5pt solid #999999',
    paddingBottom: 2,
  },
  fieldValue: {
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 4,
    color: '#000000',
  },
  listItem: {
    fontSize: 13,
    paddingLeft: 12,
    marginBottom: 4,
    lineHeight: 1.5,
    color: '#000000',
  },
  contentText: {
    fontSize: 13,
    marginBottom: 6,
    paddingLeft: 8,
    lineHeight: 1.5,
    color: '#000000',
  },
  subLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginTop: 4,
    marginBottom: 1,
    color: '#333333',
  },
  nested: {
    marginLeft: 10,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#000000',
    marginTop: 2,
  },
});

/* recursive object node: label = bold heading; value = plain line below (B&W only) */
const renderObjectNode = (label, value, keyPath, depth) => {
  if (isEmptyDeep(value)) return null;
  const LabelTag = depth > 0 ? styles.subLabel : styles.fieldLabel;
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
      <View style={label ? styles.nested : undefined}>{entries.map(([k, v]) => renderObjectNode(humanizeKey(k), v, `${keyPath}-${k}`, depth + 1))}</View>
    </View>
  );
};

const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
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

const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const visibleArrayValue = (item) => {
  const text = safeString(item);
  const match = text.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/);
  return match ? match[2].trim() : text;
};

const visibleSentenceValue = (text) => {
  const value = safeString(text);
  const match = value.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/);
  return match ? match[2].trim() : value;
};

const splitTopLevelCommas = (text) => {
  const source = String(text || ''); const parts = []; let current = ''; let depth = 0;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      const before = current.trim(); const remainder = source.slice(i + 1); const after = remainder.trimStart();
      const next = (after.match(/^([A-Za-z]+)/) || [])[1]?.toLowerCase();
      const previous = (before.match(/([A-Za-z]+)$/) || [])[1]?.toLowerCase();
      const protectedComma = (/\d$/.test(before) && /^\d{3}\b/.test(after)) || remainder.length === after.length
        || ['and', 'or', 'then'].includes(next) || ['and', 'or'].includes(previous);
      if (!protectedComma) { if (before) parts.push(before); current = ''; continue; }
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts.length ? parts : [source];
};

const LABELED_COMMA_ARRAY_FIELDS = new Set(['nutrition', 'physicalActivity', 'safety', 'socialDevelopment', 'discipline', 'recommendations', 'sleep.concerns']);

const arrayItemShape = (item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return { text: safeString(item), date: null };
  const textKey = ['recommendation', 'text', 'value'].find(key => Object.hasOwn(item, key));
  return { text: textKey ? safeString(item[textKey]) : '', date: item.date || null };
};

const arrayDisplayParts = (fieldName, item) => {
  const { text } = arrayItemShape(item);
  const match = text.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/);
  if (!match) return [text];
  return LABELED_COMMA_ARRAY_FIELDS.has(fieldName) ? splitTopLevelCommas(match[2].trim()) : [match[2].trim()];
};

const sentenceDisplayParts = (text) => safeString(text).split(/(?<=[.;])\s+/).map(value => value.trim()).filter(Boolean).flatMap(value => {
  const match = value.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/);
  return match ? splitTopLevelCommas(match[2].trim()) : [value];
});

const recommendationDateKey = (value) => {
  if (!value) return 'no-date';
  try { return new Date(value.$date || value).toISOString().slice(0, 10); }
  catch { return String(value); }
};

const groupRecommendations = (items) => items.reduce((groups, item) => {
  const shape = arrayItemShape(item); const key = recommendationDateKey(shape.date);
  const group = groups.find(entry => entry.key === key);
  if (group) group.items.push(item);
  else groups.push({ key, date: shape.date, items: [item] });
  return groups;
}, []);

/* count rows for wrap heuristic (Rule #74) */
const countRows = (val) => {
  if (isEmptyDeep(val)) return 0;
  if (isScalar(val)) return 1;
  if (Array.isArray(val)) { let n = 0; val.filter(x => !isEmptyDeep(x)).forEach(it => { n += isScalar(it) ? 1 : 1 + countRows(it); }); return n; }
  let n = 0; Object.values(val).forEach(sub => { if (!isEmptyDeep(sub)) n += isScalar(sub) ? 2 : 1 + countRows(sub); }); return n;
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.filter(Boolean).join(', ');
  return String(val);
};

const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
      const d = new Date(dateVal.$date || dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateVal);
  }
};

const AnticipatoryGuidanceDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;

  let records = [];
  if (Array.isArray(templateData)) {
    records = templateData.flatMap(item => {
      if (item.anticipatory_guidance) return item.anticipatory_guidance;
      if (item.records) return item.records;
      if (item.data) return item.data;
      if (item.documentData?.anticipatory_guidance) return item.documentData.anticipatory_guidance;
      if (item.documentData) return item.documentData;
      return item;
    });
  } else if (templateData?.anticipatory_guidance) {
    records = Array.isArray(templateData.anticipatory_guidance) ? templateData.anticipatory_guidance : [templateData.anticipatory_guidance];
  } else if (templateData?.data) {
    records = Array.isArray(templateData.data) ? templateData.data : [templateData.data];
  } else if (templateData?.documentData?.anticipatory_guidance) {
    records = Array.isArray(templateData.documentData.anticipatory_guidance) ? templateData.documentData.anticipatory_guidance : [templateData.documentData.anticipatory_guidance];
  } else if (templateData?.documentData) {
    records = Array.isArray(templateData.documentData) ? templateData.documentData : [templateData.documentData];
  } else if (templateData && typeof templateData === 'object') {
    records = [templateData];
  }
  records = records.filter(r => r && Object.keys(r).length > 0);

  const renderArraySection = (title, arr, fieldName) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
    const rows = arr.flatMap(item => arrayDisplayParts(fieldName, item)).filter(Boolean);
    if (rows.length === 0) return null;
    return (
      <View style={styles.section}>
        <View wrap={false}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.listItem}>1. {rows[0]}</Text>
        </View>
        {rows.slice(1).map((item, i) => (
          <Text key={i} style={styles.listItem}>
            {i + 2}. {item}
          </Text>
        ))}
      </View>
    );
  };

  /* Results — recursive OBJECT. Rule #74: section title INSIDE the wrap-gated View;
     gate on total row count (>8 -> flow; <=8 -> wrap={false} keeps block intact). */
  const renderResultsSection = (title, obj) => {
    if (isEmptyDeep(obj) || isScalar(obj)) return null;
    const entries = Object.entries(obj).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const rows = countRows(obj);
    return (
      <View style={styles.section} wrap={rows > 8}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {entries.map(([k, v]) => (
          <View key={k} style={styles.fieldBlock}>
            {renderObjectNode(humanizeKey(k), v, k, 0)}
          </View>
        ))}
      </View>
    );
  };

  const renderTextSection = (title, text) => {
    if (!hasValue(text)) return null;
    const sentences = sentenceDisplayParts(text);
    return (
      <View style={styles.section}>
        {sentences.length > 1 ? (
          <>
            <View wrap={false}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.listItem}>1. {visibleSentenceValue(sentences[0])}</Text></View>
            {sentences.slice(1).map((s, i) => <Text key={i} style={styles.listItem}>{i + 2}. {visibleSentenceValue(s)}</Text>)}
          </>
        ) : (
          <View wrap={false}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.contentText}>{sentences[0]}</Text></View>
        )}
      </View>
    );
  };

  const renderRecommendationsSection = (items) => {
    if (!Array.isArray(items) || items.length === 0) return null;
    const rows = groupRecommendations(items).flatMap(group => [
      ...(group.date ? [{ type: 'date', value: formatDate(group.date) }] : []),
      ...group.items.flatMap(item => arrayDisplayParts('recommendations', item).map(value => ({ type: 'value', value }))),
    ]);
    if (rows.length === 0) return null;
    return (
      <View style={styles.section}>
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          <Text style={rows[0].type === 'date' ? styles.fieldLabel : styles.listItem}>{rows[0].type === 'date' ? rows[0].value : `1. ${rows[0].value}`}</Text>
        </View>
        {rows.slice(1).map((row, index) => <Text key={index} style={row.type === 'date' ? styles.fieldLabel : styles.listItem}>{row.type === 'date' ? row.value : `${rows.slice(0, index + 2).filter(entry => entry.type === 'value').length}. ${row.value}`}</Text>)}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.documentTitle}>Anticipatory Guidance</Text>
        </View>

        {records.map((record, idx) => {
          const sleep = record.sleep;

          return (
            <View key={idx} style={styles.recordCard}>
              <Text style={styles.recordTitle}>Anticipatory Guidance {idx + 1}</Text>

              {/* Guidance Information */}
              {(hasValue(record.date) || hasValue(record.provider) || hasValue(record.facility)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Guidance Information</Text>
                  {hasValue(record.date) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Date</Text>
                      <Text style={styles.fieldValue}>{formatDate(record.date)}</Text>
                    </View>
                  )}
                  {hasValue(record.provider) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Provider</Text>
                      <Text style={styles.fieldValue}>{safeString(record.provider)}</Text>
                    </View>
                  )}
                  {hasValue(record.facility) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Facility</Text>
                      <Text style={styles.fieldValue}>{safeString(record.facility)}</Text>
                    </View>
                  )}
                </View>
              )}

              {renderArraySection('Nutrition', record.nutrition, 'nutrition')}
              {renderArraySection('Physical Activity', record.physicalActivity, 'physicalActivity')}
              {renderTextSection('Screen Time', record.screenTime)}

              {/* Sleep */}
              {sleep && (hasValue(sleep.hoursRecommended) || hasValue(sleep.currentPattern) || (Array.isArray(sleep.concerns) && sleep.concerns.length > 0)) && (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Sleep</Text>
                  {hasValue(sleep.hoursRecommended) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Hours Recommended</Text>
                      <Text style={styles.fieldValue}>{safeString(sleep.hoursRecommended)}</Text>
                    </View>
                  )}
                  {hasValue(sleep.currentPattern) && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Current Pattern</Text>
                      {splitTopLevelCommas(visibleSentenceValue(sleep.currentPattern)).map((part, i) => <Text key={i} style={styles.listItem}>{i + 1}. {part}</Text>)}
                    </View>
                  )}
                  {Array.isArray(sleep.concerns) && sleep.concerns.length > 0 && (
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>Concerns</Text>
                      {sleep.concerns.flatMap(item => arrayDisplayParts('sleep.concerns', item)).map((item, i) => <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>)}
                    </View>
                  )}
                </View>
              )}

              {renderArraySection('Safety', record.safety, 'safety')}
              {renderArraySection('Dental Care', record.dental, 'dental')}
              {renderArraySection('Social Development', record.socialDevelopment, 'socialDevelopment')}
              {renderTextSection('Toileting', record.toileting)}
              {renderArraySection('Discipline', record.discipline, 'discipline')}
              {renderTextSection('Findings', record.findings)}
              {renderTextSection('Assessment', record.assessment)}
              {renderTextSection('Plan', record.plan)}
              {renderResultsSection('Results', record.results)}
              {renderRecommendationsSection(record.recommendations)}
              {renderTextSection('Notes', record.notes)}
              {renderTextSection('Status', record.status)}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};

export default AnticipatoryGuidanceDocumentPDFTemplate;

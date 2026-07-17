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
});

const hasValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
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

const AnticoagulationManagementDocumentPDFTemplate = ({ document: docProp, data }) => {
  const templateData = docProp || data;

  let records = [];
  if (Array.isArray(templateData)) {
    records = templateData.flatMap(item => {
      if (item.anticoagulation_management) return item.anticoagulation_management;
      if (item.records) return item.records;
      if (item.data) return item.data;
      if (item.documentData?.anticoagulation_management) return item.documentData.anticoagulation_management;
      if (item.documentData) return item.documentData;
      return item;
    });
  } else if (templateData?.anticoagulation_management) {
    records = Array.isArray(templateData.anticoagulation_management) ? templateData.anticoagulation_management : [templateData.anticoagulation_management];
  } else if (templateData?.data) {
    records = Array.isArray(templateData.data) ? templateData.data : [templateData.data];
  } else if (templateData?.documentData?.anticoagulation_management) {
    records = Array.isArray(templateData.documentData.anticoagulation_management) ? templateData.documentData.anticoagulation_management : [templateData.documentData.anticoagulation_management];
  } else if (templateData?.documentData) {
    records = Array.isArray(templateData.documentData) ? templateData.documentData : [templateData.documentData];
  } else if (templateData && typeof templateData === 'object') {
    records = [templateData];
  }
  records = records.filter(r => r && Object.keys(r).length > 0);

  const splitByComma = (t) => {
    if (!t || typeof t !== 'string') return [t];
    const parts = [];
    let depth = 0, cur = '';
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      if (ch === ',' && depth === 0) { const tr = cur.trim(); if (tr) parts.push(tr); cur = ''; }
      else cur += ch;
    }
    const tr = cur.trim().replace(/[.;]\s*$/, '');
    if (tr) parts.push(tr);
    return parts.length > 1 ? parts : [t];
  };

  const visibleTextParts = (text) => safeString(text).split(/(?<=[.;])\s+/).map(value => value.trim()).filter(Boolean).flatMap(value => {
    const labeled = value.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/);
    return labeled ? splitByComma(labeled[2].trim()) : [value];
  });

  const renderTextSection = (title, text) => {
    if (!hasValue(text)) return null;
    const dateOnly = /^\d{4}-\d{2}-\d{2}/.test(safeString(text));
    const sentences = dateOnly ? [formatDate(text)] : visibleTextParts(text);
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sentences.length > 1 ? (
          sentences.map((s, si) => <Text key={si} style={styles.listItem}>{si + 1}. {s}</Text>)
        ) : (
          <Text style={styles.contentText}>{sentences[0]}</Text>
        )}
      </View>
    );
  };

  const renderArraySection = (title, arr) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {arr.map((item, i) => (
          <Text key={i} style={styles.listItem}>
            {i + 1}. {safeString(item)}
          </Text>
        ))}
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.documentTitle}>Anticoagulation Management</Text>
        </View>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordCard}>
            <Text style={styles.recordTitle}>
              {record.anticoagulant || `Anticoagulation Management ${idx + 1}`}
            </Text>

            {/* Anticoagulation Information */}
            {(hasValue(record.anticoagulant) || hasValue(record.indication) || hasValue(record.date) || hasValue(record.provider) || hasValue(record.facility)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Anticoagulation Information</Text>
                {hasValue(record.anticoagulant) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Anticoagulant</Text>
                    <Text style={styles.fieldValue}>{safeString(record.anticoagulant)}</Text>
                  </View>
                )}
                {hasValue(record.indication) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Indication</Text>
                    <Text style={styles.fieldValue}>{safeString(record.indication)}</Text>
                  </View>
                )}
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

            {/* INR Monitoring */}
            {(hasValue(record.targetInr) || hasValue(record.currentInr)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>INR Monitoring</Text>
                {hasValue(record.targetInr) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Target INR</Text>
                    <Text style={styles.fieldValue}>{safeString(record.targetInr)}</Text>
                  </View>
                )}
                {hasValue(record.currentInr) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Current INR</Text>
                    <Text style={styles.fieldValue}>{safeString(record.currentInr)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* aPTT Monitoring */}
            {(hasValue(record.targetAptt) || hasValue(record.currentAptt)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>aPTT Monitoring</Text>
                {hasValue(record.targetAptt) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Target aPTT</Text>
                    <Text style={styles.fieldValue}>{safeString(record.targetAptt)}</Text>
                  </View>
                )}
                {hasValue(record.currentAptt) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Current aPTT</Text>
                    <Text style={styles.fieldValue}>{safeString(record.currentAptt)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Dosing */}
            {(hasValue(record.doseAdjustment) || hasValue(record.nextDose)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Dosing</Text>
                {hasValue(record.doseAdjustment) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Dose Adjustment</Text>
                    {visibleTextParts(record.doseAdjustment).map((part, i) => <Text key={i} style={styles.listItem}>{i + 1}. {part}</Text>)}
                  </View>
                )}
                {hasValue(record.nextDose) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Next Dose</Text>
                    <Text style={styles.fieldValue}>{safeString(record.nextDose)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Clinical Events */}
            {(hasValue(record.bleedingEvents) || hasValue(record.thromboticEvents)) && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Clinical Events</Text>
                {hasValue(record.bleedingEvents) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Bleeding Events</Text>
                    {visibleTextParts(record.bleedingEvents).map((part, i) => <Text key={i} style={styles.listItem}>{i + 1}. {part}</Text>)}
                  </View>
                )}
                {hasValue(record.thromboticEvents) && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Thrombotic Events</Text>
                    {visibleTextParts(record.thromboticEvents).map((part, i) => <Text key={i} style={styles.listItem}>{i + 1}. {part}</Text>)}
                  </View>
                )}
              </View>
            )}

            {/* Drug Interactions — grouped by label (Avoid, Caution) */}
            {record.drugInteractions && record.drugInteractions.length > 0 && (() => {
              const groups = {};
              const groupOrder = [];
              record.drugInteractions.forEach(item => {
                const str = safeString(item);
                const labelMatch = str.match(/^([A-Z][A-Za-z0-9 &/()>=<+%.#-]+):\s*(.+)$/);
                const key = labelMatch ? labelMatch[1].trim() : 'Other';
                const val = labelMatch ? labelMatch[2].trim() : str;
                if (!groups[key]) { groups[key] = []; groupOrder.push(key); }
                groups[key].push(...(labelMatch ? splitByComma(val) : [val]));
              });
              return (
                <View style={styles.section} wrap={false}>
                  <Text style={styles.sectionTitle}>Drug Interactions</Text>
                  {groupOrder.map((key, gi) => (
                    <View key={gi} style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>{key}</Text>
                      {groups[key].map((val, vi) => (
                        <Text key={vi} style={styles.listItem}>{vi + 1}. {val}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              );
            })()}
            {renderTextSection('Dietary Considerations', record.dietaryConsiderations)}
            {renderTextSection('Treatment Duration', record.durationPlan)}
            {renderTextSection('Follow-Up Testing', record.followUpTesting)}
            {renderTextSection('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default AnticoagulationManagementDocumentPDFTemplate;

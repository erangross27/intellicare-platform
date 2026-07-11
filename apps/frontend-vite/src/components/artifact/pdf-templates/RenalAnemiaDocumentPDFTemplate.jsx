import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// PDF Template Standard — March 2026
// Helvetica font, LETTER size, 20pt title, 14pt section, 12pt content
// Numbered lists (1., 2., 3.) NOT dashes
// minPresenceAhead={80} on sections
// String() wrapping for all dynamic values

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 20,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 12,
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordContainer: {
    marginBottom: 24,
    paddingBottom: 16,
  },
  recordHeader: {
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderWidth: 1,
    borderColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
    marginBottom: 8,
  },
  numberedItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 12,
  },
  itemNumber: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    width: 24,
  },
  itemContent: {
    fontSize: 12,
    color: '#000000',
    flex: 1,
    lineHeight: 1.4,
  },
  subLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
  },
  subValue: {
    fontSize: 12,
    color: '#000000',
    paddingLeft: 4,
  },
  row: {
    marginBottom: 8,
    paddingLeft: 12,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
  },
  value: {
    fontSize: 12,
    color: '#000000',
    lineHeight: 1.5,
    paddingLeft: 8,
  },
  noData: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
});

// Safe string conversion - handles arrays WITHOUT JSON.stringify brackets
const toSafeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Format date helper
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  try {
    const dateStr = dateValue.$date || dateValue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return String(dateValue);
  }
};

// Flatten ironStudies object for display
const flattenIronStudies = (ironStudies) => {
  if (!ironStudies || typeof ironStudies !== 'object') return [];
  const items = [];
  if (ironStudies.ferritin) items.push({ label: 'Ferritin', value: ironStudies.ferritin });
  if (ironStudies.tsat) items.push({ label: 'TSAT', value: ironStudies.tsat });
  if (ironStudies.tibc) items.push({ label: 'TIBC', value: ironStudies.tibc });
  return items;
};

// Flatten esaTherapy object for display
const flattenEsaTherapy = (esaTherapy) => {
  if (!esaTherapy || typeof esaTherapy !== 'object') return [];
  const items = [];
  if (esaTherapy.agent) items.push({ label: 'Agent', value: esaTherapy.agent });
  if (esaTherapy.dose) items.push({ label: 'Dose', value: esaTherapy.dose });
  if (esaTherapy.frequency) items.push({ label: 'Frequency', value: esaTherapy.frequency });
  if (esaTherapy.response) items.push({ label: 'Response', value: esaTherapy.response });
  return items;
};

// Flatten ironTherapy object for display
const flattenIronTherapy = (ironTherapy) => {
  if (!ironTherapy || typeof ironTherapy !== 'object') return [];
  const items = [];
  if (ironTherapy.route) items.push({ label: 'Route', value: ironTherapy.route });
  if (ironTherapy.agent) items.push({ label: 'Agent', value: ironTherapy.agent });
  if (ironTherapy.dose) items.push({ label: 'Dose', value: ironTherapy.dose });
  return items;
};

// humanizeKey for object leaf labels
const KEY_OVERRIDES = { tsat: 'TSAT', tibc: 'TIBC', esa: 'ESA', hgb: 'Hgb', rbc: 'RBC', iv: 'IV' };
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

// Flatten object into a list of { label, value, depth } leaf rows (recursive)
const flattenObjectRows = (value, depth = 0, out = []) => {
  if (isEmptyDeep(value) || isScalar(value)) return out;
  Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => {
    if (isScalar(v)) {
      out.push({ label: humanizeKey(k), value: fmtScalar(v), depth });
    } else {
      out.push({ label: humanizeKey(k), value: null, depth });
      flattenObjectRows(v, depth + 1, out);
    }
  });
  return out;
};

// Parse findings/assessment/plan/notes with label pattern
const parseFindingsWithLabels = (text) => {
  if (!text) return [];
  const textStr = String(text);

  const parts = textStr.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  const groups = [];
  let currentGroup = { label: '', items: [] };

  parts.forEach(part => {
    const colonIdx = part.indexOf(':');
    if (colonIdx > 0 && colonIdx < 60) {
      if (currentGroup.label || currentGroup.items.length > 0) {
        groups.push(currentGroup);
      }
      const label = part.substring(0, colonIdx).trim();
      const content = part.substring(colonIdx + 1).trim();
      currentGroup = { label, items: content ? [content] : [] };
    } else if (currentGroup.label) {
      currentGroup.items.push(part.trim());
    } else {
      if (!currentGroup.label && currentGroup.items.length === 0) {
        currentGroup.items.push(part.trim());
      } else {
        currentGroup.items.push(part.trim());
      }
    }
  });

  if (currentGroup.label || currentGroup.items.length > 0) {
    groups.push(currentGroup);
  }

  return groups.filter(g => g.label || g.items.length > 0);
};

const RenalAnemiaDocumentPDFTemplate = ({ document }) => {
  // Data unwrapping
  let records = [];
  if (Array.isArray(document)) {
    if (document.length > 0 && document[0]?.records) {
      records = document[0].records;
    } else if (document.length > 0 && document[0]?._records) {
      records = document[0]._records;
    } else {
      records = document;
    }
  } else if (document?.records) {
    records = document.records;
  } else if (document?._records) {
    records = document._records;
  } else if (document) {
    records = [document];
  }

  const validRecords = Array.isArray(records) ? records : [];

  // Empty check
  if (!validRecords.length) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>Renal Anemia</Text>
          </View>
          <Text style={styles.noData}>No data available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>Renal Anemia</Text>
        </View>

        {validRecords.map((record, idx) => (
          <View key={idx} style={styles.recordContainer} minPresenceAhead={80}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordTitle}>Renal Anemia {idx + 1}</Text>
            </View>

            {/* Record Information */}
            {(record.date || record.type || record.provider || record.facility || record.status) && (
              <View style={styles.section} wrap={false} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Record Information</Text>
                {record.date && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>1.</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subLabel}>Date</Text>
                      <Text style={styles.subValue}>{formatDate(record.date)}</Text>
                    </View>
                  </View>
                )}
                {record.type && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>2.</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subLabel}>Type</Text>
                      <Text style={styles.subValue}>{toSafeString(record.type)}</Text>
                    </View>
                  </View>
                )}
                {record.provider && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>3.</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subLabel}>Provider</Text>
                      <Text style={styles.subValue}>{toSafeString(record.provider)}</Text>
                    </View>
                  </View>
                )}
                {record.facility && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>4.</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subLabel}>Facility</Text>
                      <Text style={styles.subValue}>{toSafeString(record.facility)}</Text>
                    </View>
                  </View>
                )}
                {record.status && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>5.</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subLabel}>Status</Text>
                      <Text style={styles.subValue}>{toSafeString(record.status)}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Hemoglobin Status */}
            {(record.hemoglobin || record.hemoglobinTarget) && (
              <View style={styles.section} wrap={false} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Hemoglobin Status</Text>
                {record.hemoglobin && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>1.</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subLabel}>Hemoglobin</Text>
                      <Text style={styles.subValue}>{toSafeString(record.hemoglobin)}</Text>
                    </View>
                  </View>
                )}
                {record.hemoglobinTarget && (
                  <View style={styles.numberedItem}>
                    <Text style={styles.itemNumber}>2.</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subLabel}>Hemoglobin Target</Text>
                      <Text style={styles.subValue}>{toSafeString(record.hemoglobinTarget)}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Iron Studies */}
            {record.ironStudies && (() => {
              const items = flattenIronStudies(record.ironStudies);
              if (items.length === 0) return null;
              return (
                <View style={styles.section} wrap={false} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Iron Studies</Text>
                  {items.map((item, iIdx) => (
                    <View key={iIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{iIdx + 1}.</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.subLabel}>{toSafeString(item.label)}</Text>
                        <Text style={styles.subValue}>{toSafeString(item.value)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* ESA Therapy */}
            {record.esaTherapy && (() => {
              const items = flattenEsaTherapy(record.esaTherapy);
              if (items.length === 0) return null;
              return (
                <View style={styles.section} wrap={false} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>ESA Therapy</Text>
                  {items.map((item, iIdx) => (
                    <View key={iIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{iIdx + 1}.</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.subLabel}>{toSafeString(item.label)}</Text>
                        <Text style={styles.subValue}>{toSafeString(item.value)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Iron Therapy */}
            {record.ironTherapy && (() => {
              const items = flattenIronTherapy(record.ironTherapy);
              if (items.length === 0) return null;
              return (
                <View style={styles.section} wrap={false} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Iron Therapy</Text>
                  {items.map((item, iIdx) => (
                    <View key={iIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{iIdx + 1}.</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.subLabel}>{toSafeString(item.label)}</Text>
                        <Text style={styles.subValue}>{toSafeString(item.value)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Transfusion History */}
            {record.transfusionHistory && record.transfusionHistory.length > 0 && (
              <View style={styles.section} wrap={false} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Transfusion History</Text>
                {record.transfusionHistory.map((transfusion, tIdx) => {
                  const parts = [];
                  if (transfusion.date) parts.push(`Date: ${formatDate(transfusion.date)}`);
                  if (transfusion.units) parts.push(`Units: ${toSafeString(transfusion.units)}`);
                  if (transfusion.type) parts.push(`Type: ${toSafeString(transfusion.type)}`);
                  if (transfusion.reason) parts.push(`Reason: ${toSafeString(transfusion.reason)}`);
                  return (
                    <View key={tIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{tIdx + 1}.</Text>
                      <Text style={styles.itemContent}>{parts.join(' | ')}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Results */}
            {record.results && !isEmptyDeep(record.results) && (() => {
              const rows = flattenObjectRows(record.results);
              if (rows.length === 0) return null;
              return (
                <View style={styles.section} wrap={rows.length > 8 ? undefined : false} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Results</Text>
                  {rows.map((r, rIdx) => (
                    <View key={rIdx} style={[styles.row, { paddingLeft: 12 + r.depth * 12 }]}>
                      <Text style={styles.label}>{toSafeString(r.label)}</Text>
                      {r.value !== null && <Text style={styles.value}>{toSafeString(r.value)}</Text>}
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Findings */}
            {record.findings && (() => {
              const groups = parseFindingsWithLabels(record.findings);
              if (groups.length === 0) return null;
              return (
                <View style={styles.section} wrap={false} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Findings</Text>
                  {groups.map((group, gIdx) => (
                    <View key={gIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{gIdx + 1}.</Text>
                      <View style={{ flex: 1 }}>
                        {group.label && <Text style={styles.subLabel}>{toSafeString(group.label)}</Text>}
                        <Text style={styles.subValue}>{toSafeString(group.items.join(' '))}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Assessment */}
            {record.assessment && (() => {
              const groups = parseFindingsWithLabels(record.assessment);
              if (groups.length === 0) return null;
              return (
                <View style={styles.section} wrap={false} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Assessment</Text>
                  {groups.map((group, gIdx) => (
                    <View key={gIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{gIdx + 1}.</Text>
                      <View style={{ flex: 1 }}>
                        {group.label && <Text style={styles.subLabel}>{toSafeString(group.label)}</Text>}
                        <Text style={styles.subValue}>{toSafeString(group.items.join(' '))}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Plan */}
            {record.plan && (() => {
              const groups = parseFindingsWithLabels(record.plan);
              if (groups.length === 0) return null;
              return (
                <View style={styles.section} wrap={false} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Plan</Text>
                  {groups.map((group, gIdx) => (
                    <View key={gIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{gIdx + 1}.</Text>
                      <View style={{ flex: 1 }}>
                        {group.label && <Text style={styles.subLabel}>{toSafeString(group.label)}</Text>}
                        <Text style={styles.subValue}>{toSafeString(group.items.join(' '))}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* Recommendations */}
            {record.recommendations && record.recommendations.length > 0 && (
              <View style={styles.section} wrap={false} minPresenceAhead={80}>
                <Text style={styles.sectionTitle}>Recommendations</Text>
                {record.recommendations.map((rec, rIdx) => {
                  const recText = typeof rec === 'string' ? rec : (rec?.recommendation || '');
                  const recDate = typeof rec === 'object' && rec?.date ? ` (${formatDate(rec.date)})` : '';
                  return (
                    <View key={rIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{rIdx + 1}.</Text>
                      <Text style={styles.itemContent}>{toSafeString(recText)}{recDate}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Notes */}
            {record.notes && (() => {
              const groups = parseFindingsWithLabels(record.notes);
              if (groups.length === 0) return null;
              return (
                <View style={styles.section} wrap={false} minPresenceAhead={80}>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  {groups.map((group, gIdx) => (
                    <View key={gIdx} style={styles.numberedItem}>
                      <Text style={styles.itemNumber}>{gIdx + 1}.</Text>
                      <View style={{ flex: 1 }}>
                        {group.label && <Text style={styles.subLabel}>{toSafeString(group.label)}</Text>}
                        <Text style={styles.subValue}>{toSafeString(group.items.join(' '))}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default RenalAnemiaDocumentPDFTemplate;

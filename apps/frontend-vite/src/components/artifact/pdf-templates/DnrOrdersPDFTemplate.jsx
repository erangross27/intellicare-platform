import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

/**
 * DNR Orders PDF Template - February 2026
 * Professional Black & White Format for Printing
 *
 * wrap={false} strategy (from InheritancePatternDetails pattern):
 * - recordHeader: small, stays together
 * - Section title grouped INSIDE fieldBox: prevents orphaned titles
 * - fieldBox: wrap={false} for <=8 items, undefined for >8
 * - NEVER on sections or recordContainer (causes overlapping)
 *
 * NO borderBottom on sectionTitle (causes react-pdf to orphan titles)
 */

const safeString = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/\u03bcm/g, 'um')
    .replace(/\u00b0/g, 'deg')
    .replace(/\u00b1/g, '+/-')
    .replace(/\u00d7/g, 'x')
    .replace(/\u00f7/g, '/')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2022/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/[^\x00-\x7F]/g, '');
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 14,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentHeader: {
    marginBottom: 24,
    borderBottomWidth: 3,
    borderBottomColor: '#000000',
    paddingBottom: 14,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  documentSubtitle: {
    fontSize: 10,
    color: '#555555',
    textAlign: 'center',
    marginTop: 4,
  },
  recordContainer: {
    marginBottom: 28,
    paddingBottom: 20,
  },
  recordHeader: {
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderWidth: 2,
    borderColor: '#000000',
    borderLeftWidth: 5,
    borderLeftColor: '#000000',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  recordDate: {
    fontSize: 11,
    color: '#444444',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldBox: {
    borderWidth: 1,
    borderColor: '#cccccc',
    marginBottom: 6,
    padding: 8,
    paddingBottom: 6,
    backgroundColor: '#fafafa',
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  fieldValue: {
    fontSize: 11,
    color: '#000000',
    lineHeight: 1.5,
  },
  listItem: {
    fontSize: 11,
    color: '#000000',
    marginLeft: 12,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  subtitleLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
    marginTop: 6,
  },
  subtitleValue: {
    fontSize: 11,
    color: '#000000',
    marginLeft: 12,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  noRecords: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 40,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
    paddingTop: 6,
  },
});

const DnrOrdersPDFTemplate = ({ document, data }) => {
  const templateData = document || data;

  const hasValue = (val) => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'boolean') return true;
    if (typeof val === 'number') return val !== 0;
    return true;
  };

  const safeArray = (val) => {
    if (Array.isArray(val)) return val.filter(Boolean);
    return [];
  };

  const splitIntoItems = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(';').map(s => s.trim()).filter(Boolean);
  };

  const splitIntoSentences = (text) => {
    if (!text || typeof text !== 'string') return [];
    return text.split(/(?<=[.!?])\s+/).filter(s => s.trim()).map(s => s.trim());
  };

  const parseSubtitleItems = (text) => {
    if (!text || typeof text !== 'string') return [];
    const segments = text.split(/;\s*/);
    const items = [];
    for (const segment of segments) {
      if (!segment.trim()) continue;
      const colonMatch = segment.match(/^([^:]+):\s*(.+)$/);
      if (colonMatch) {
        items.push({ label: colonMatch[1].trim(), value: colonMatch[2].trim().replace(/\.$/, ''), isGeneric: false });
      } else {
        items.push({ label: '', value: segment.trim().replace(/\.$/, ''), isGeneric: true });
      }
    }
    return items;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getRecords = () => {
    if (!templateData) return [];
    let recordsArray = Array.isArray(templateData) ? templateData : [templateData];
    recordsArray = recordsArray.flatMap(record => {
      if (record?._records && Array.isArray(record._records)) return record._records;
      if (record?.records && Array.isArray(record.records)) return record.records;
      if (record?.dnr_orders && Array.isArray(record.dnr_orders)) return record.dnr_orders;
      if (record?.documentData) {
        const docData = record.documentData;
        if (Array.isArray(docData)) return docData;
        if (docData?.dnr_orders) return Array.isArray(docData.dnr_orders) ? docData.dnr_orders : [docData.dnr_orders];
        return [docData];
      }
      return record;
    });
    return recordsArray.filter(record => record && typeof record === 'object');
  };

  const records = getRecords();

  // All render functions include sectionTitle INSIDE the fieldBox
  const renderField = (sectionTitle, label, value) => {
    if (!hasValue(value)) return null;
    return (
      <View style={styles.fieldBox} wrap={false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        <Text style={styles.fieldLabel}>{safeString(label)}</Text>
        <Text style={styles.fieldValue}>{safeString(String(value))}</Text>
      </View>
    );
  };

  const renderItemsField = (sectionTitle, label, text) => {
    const items = splitIntoItems(text);
    if (items.length === 0) return null;
    return (
      <View style={styles.fieldBox} wrap={items.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        <Text style={styles.fieldLabel}>{safeString(label)}</Text>
        {items.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
        ))}
      </View>
    );
  };

  const renderSentenceField = (sectionTitle, label, text) => {
    const sentences = splitIntoSentences(text);
    if (sentences.length === 0) return null;
    return (
      <View style={styles.fieldBox} wrap={sentences.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        <Text style={styles.fieldLabel}>{safeString(label)}</Text>
        {sentences.map((s, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(s)}</Text>
        ))}
      </View>
    );
  };

  const renderSubtitleField = (sectionTitle, text) => {
    const items = parseSubtitleItems(text);
    if (items.length === 0) return null;
    return (
      <View style={styles.fieldBox} wrap={items.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        {items.map((item, i) => {
          if (item.isGeneric) {
            return <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item.value)}</Text>;
          }
          return (
            <View key={i}>
              <Text style={styles.subtitleLabel}>{safeString(item.label)}</Text>
              <Text style={styles.subtitleValue}>{safeString(item.value)}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderArrayField = (sectionTitle, label, items) => {
    const arr = safeArray(items);
    if (arr.length === 0) return null;
    return (
      <View style={styles.fieldBox} wrap={arr.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{safeString(sectionTitle)}</Text>
        <Text style={styles.fieldLabel}>{safeString(label)}</Text>
        {arr.map((item, i) => (
          <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
        ))}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <Text style={styles.title}>DNR Orders</Text>
          <Text style={styles.documentSubtitle}>Do Not Resuscitate Orders and Advance Directives</Text>
        </View>

        {records.length === 0 ? (
          <Text style={styles.noRecords}>No DNR order records available.</Text>
        ) : (
          records.map((record, index) => (
            <View key={record._id || index} style={styles.recordContainer}>
              {/* Record Header */}
              <View style={styles.recordHeader} wrap={false}>
                <Text style={styles.recordTitle}>
                  {safeString(`DNR Order ${index + 1}`)}
                </Text>
                {record.createdAt && (
                  <Text style={styles.recordDate}>Date: {formatDate(record.createdAt)}</Text>
                )}
                {record.codeStatusLevel && (
                  <Text style={styles.recordDate}>Code Status: {safeString(record.codeStatusLevel)}</Text>
                )}
              </View>

              {/* Section 1: Code Status */}
              {hasValue(record.codeStatusLevel) && (
                <View style={styles.section}>
                  {renderField('Code Status', 'Code Status Level', record.codeStatusLevel)}
                </View>
              )}

              {/* Section 2: Resuscitation Preferences */}
              {hasValue(record.resuscitationPreferences) && (
                <View style={styles.section}>
                  {renderItemsField('Resuscitation Preferences', 'Preferences', record.resuscitationPreferences)}
                </View>
              )}

              {/* Section 3: Advance Directive Status */}
              {hasValue(record.patientAdvanceDirectiveStatus) && (
                <View style={styles.section}>
                  {renderItemsField('Advance Directive Status', 'Directives', record.patientAdvanceDirectiveStatus)}
                </View>
              )}

              {/* Section 4: Healthcare Proxy */}
              {hasValue(record.healthcareProxyDesignated) && (
                <View style={styles.section}>
                  {renderItemsField('Healthcare Proxy', 'Designated Proxies', record.healthcareProxyDesignated)}
                </View>
              )}

              {/* Section 5: Functional Status Baseline */}
              {hasValue(record.functionalStatusBaseline) && (
                <View style={styles.section}>
                  {renderSentenceField('Functional Status Baseline', 'Status', record.functionalStatusBaseline)}
                </View>
              )}

              {/* Section 6: Nutrition & Hydration */}
              {hasValue(record.artificalNutritionHydration) && (
                <View style={styles.section}>
                  {renderField('Nutrition & Hydration', 'Artificial Nutrition & Hydration', record.artificalNutritionHydration)}
                </View>
              )}

              {/* Section 7: Emergency Contacts */}
              {hasValue(record.emergencyContactInformation) && (
                <View style={styles.section}>
                  {renderSubtitleField('Emergency Contacts', record.emergencyContactInformation)}
                </View>
              )}

              {/* Section 8: Organ Donation */}
              {hasValue(record.organDonationStatus) && (
                <View style={styles.section}>
                  {renderSentenceField('Organ Donation', 'Status', record.organDonationStatus)}
                </View>
              )}

              {/* Section 9: Palliative Care & Prognosis */}
              {(record.palliativeCarePlanActive === true || record.palliativeCarePlanActive === false ||
                hasValue(record.prognosisDiscussion) || hasValue(record.decisionMakingCapacity)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Palliative Care & Prognosis</Text>
                    {(record.palliativeCarePlanActive === true || record.palliativeCarePlanActive === false) && (
                      <View style={{ marginBottom: 6 }}>
                        <Text style={styles.fieldLabel}>{safeString('Palliative Care Plan Active')}</Text>
                        <Text style={styles.fieldValue}>{record.palliativeCarePlanActive ? 'Yes' : 'No'}</Text>
                      </View>
                    )}
                    {hasValue(record.decisionMakingCapacity) && (
                      <View style={{ marginBottom: 6 }}>
                        <Text style={styles.fieldLabel}>{safeString('Decision Making Capacity')}</Text>
                        <Text style={styles.fieldValue}>{safeString(record.decisionMakingCapacity)}</Text>
                      </View>
                    )}
                    {hasValue(record.prognosisDiscussion) && (
                      <View>
                        <Text style={styles.fieldLabel}>{safeString('Prognosis Discussion')}</Text>
                        <Text style={styles.fieldValue}>{safeString(record.prognosisDiscussion)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Section 10: Order & Additional Details */}
              {(hasValue(record.physianOrderDateTime) || hasValue(record.orderReviewSchedule) ||
                hasValue(record.hospitalVsOutpatientScope) || hasValue(record.comfortMeasuresSpecified) ||
                hasValue(record.witnessInformation) || hasValue(record.familyNotificationPreferences) ||
                hasValue(record.religiousConsiderations) || hasValue(record.reversalConditions)) && (
                <View style={styles.section}>
                  <View style={styles.fieldBox} wrap={false}>
                    <Text style={styles.sectionTitle}>Order & Additional Details</Text>
                    {hasValue(record.physianOrderDateTime) && (
                      <View style={{ marginBottom: 6 }}>
                        <Text style={styles.fieldLabel}>{safeString('Physician Order Date')}</Text>
                        <Text style={styles.fieldValue}>{safeString(formatDate(record.physianOrderDateTime))}</Text>
                      </View>
                    )}
                    {hasValue(record.orderReviewSchedule) && (
                      <View style={{ marginBottom: 6 }}>
                        <Text style={styles.fieldLabel}>{safeString('Order Review Schedule')}</Text>
                        <Text style={styles.fieldValue}>{safeString(record.orderReviewSchedule)}</Text>
                      </View>
                    )}
                    {hasValue(record.hospitalVsOutpatientScope) && (
                      <View style={{ marginBottom: 6 }}>
                        <Text style={styles.fieldLabel}>{safeString('Hospital vs Outpatient Scope')}</Text>
                        <Text style={styles.fieldValue}>{safeString(record.hospitalVsOutpatientScope)}</Text>
                      </View>
                    )}
                    {hasValue(record.familyNotificationPreferences) && (
                      <View style={{ marginBottom: 6 }}>
                        <Text style={styles.fieldLabel}>{safeString('Family Notification Preferences')}</Text>
                        <Text style={styles.fieldValue}>{safeString(record.familyNotificationPreferences)}</Text>
                      </View>
                    )}
                    {hasValue(record.religiousConsiderations) && (
                      <View style={{ marginBottom: 6 }}>
                        <Text style={styles.fieldLabel}>{safeString('Religious Considerations')}</Text>
                        <Text style={styles.fieldValue}>{safeString(record.religiousConsiderations)}</Text>
                      </View>
                    )}
                    {hasValue(record.reversalConditions) && (
                      <View>
                        <Text style={styles.fieldLabel}>{safeString('Reversal Conditions')}</Text>
                        <Text style={styles.fieldValue}>{safeString(record.reversalConditions)}</Text>
                      </View>
                    )}
                  </View>

                  {/* Arrays rendered separately with their own fieldBox + title */}
                  {hasValue(record.comfortMeasuresSpecified) && renderArrayField('Comfort Measures', 'Measures', record.comfortMeasuresSpecified)}
                  {hasValue(record.witnessInformation) && renderArrayField('Witness Information', 'Witnesses', record.witnessInformation)}
                </View>
              )}
            </View>
          ))
        )}

        <Text style={styles.footer}>Confidential Medical Document</Text>
      </Page>
    </Document>
  );
};

export default DnrOrdersPDFTemplate;

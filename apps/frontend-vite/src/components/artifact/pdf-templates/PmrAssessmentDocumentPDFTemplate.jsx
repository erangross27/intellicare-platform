import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
  },
  documentHeader: {
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#333333',
    borderBottomStyle: 'solid',
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'none',
  },
  recordContainer: {
    marginBottom: 24,
  },
  recordHeader: {
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    borderBottomStyle: 'solid',
  },
  recordDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 11,
    color: '#6b7280',
    fontFamily: 'Helvetica',
  },
  recordStatus: {
    fontSize: 11,
    color: '#333333',
    fontFamily: 'Helvetica-Bold',
  },
  recordTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    width: 180,
  },
  fieldValue: {
    fontSize: 12,
    color: '#333333',
    flex: 1,
  },
  listItem: {
    fontSize: 12,
    color: '#333333',
    marginBottom: 4,
    paddingLeft: 8,
  },
  subSectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#4b5563',
    marginBottom: 4,
    marginTop: 6,
  },
  separator: {
    marginTop: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    borderBottomStyle: 'solid',
  },
  noDataText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 40,
  },
  text: {
    fontSize: 12,
    color: '#333333',
    marginBottom: 6,
    lineHeight: 1.6,
  },
});

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(dateStr);
  }
};

const safeString = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') {
    if (val.$date) return formatDate(val.$date);
    return JSON.stringify(val);
  }
  return String(val);
};

const keyToLabel = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

const splitIntoItems = (text) => {
  if (!text) return [];
  const bySemicolon = text.split(/;\s*/).filter(s => s.trim()).map(s => s.trim());
  if (bySemicolon.length > 1) return bySemicolon;
  const bySentence = text.split(/(?<=[.!?])\s+/).filter(s => s.trim()).map(s => s.trim());
  if (bySentence.length > 1) return bySentence;
  return [text.trim()];
};

const stripNumber = (text) => text.replace(/^\d+\.\s*/, '');

const PmrAssessmentDocumentPDFTemplate = ({ document: data }) => {
  const unwrapData = (inputData) => {
    if (!inputData) return [];
    if (Array.isArray(inputData)) {
      if (inputData.length === 1 && inputData[0]?.pmr_assessment) {
        return inputData[0].pmr_assessment;
      }
      return inputData;
    }
    if (inputData.pmr_assessment) {
      return inputData.pmr_assessment;
    }
    return [inputData];
  };

  const records = unwrapData(data);

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>PMR Assessment</Text>
          </View>
          <Text style={styles.noDataText}>No data available</Text>
        </Page>
      </Document>
    );
  }

  const renderObjectSection = (title, obj) => {
    if (!obj || typeof obj !== 'object') return null;
    const entries = Object.entries(obj).filter(([k, v]) => safeString(v) && k !== '_id');
    if (entries.length === 0) return null;

    return (
      <View style={styles.section} wrap={entries.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {entries.map(([key, value], i) => (
            <View key={i} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{keyToLabel(key)}:</Text>
              <Text style={styles.fieldValue}>{safeString(value)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderArraySection = (title, arr) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return null;

    return (
      <View style={styles.section} wrap={arr.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {arr.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {safeString(item)}</Text>
          ))}
        </View>
      </View>
    );
  };

  const renderTextSection = (title, text) => {
    if (!text) return null;
    const items = splitIntoItems(text);

    return (
      <View style={styles.section} wrap={items.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {items.map((item, i) => (
            <Text key={i} style={styles.listItem}>{i + 1}. {stripNumber(item)}</Text>
          ))}
        </View>
      </View>
    );
  };

  /* Recursive flatten of a (possibly nested) object into label/value rows */
  const flattenObject = (obj, prefix, rows) => {
    if (!obj || typeof obj !== 'object') return;
    Object.entries(obj).filter(([k]) => k !== '_id').forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') return;
      if (Array.isArray(v)) {
        const arr = v.filter(x => safeString(x));
        if (arr.length === 0) return;
        rows.push({ label: `${prefix}${keyToLabel(k)}`, value: arr.map(safeString).join(', ') });
      } else if (typeof v === 'object') {
        flattenObject(v, `${prefix}${keyToLabel(k)} - `, rows);
      } else {
        rows.push({ label: `${prefix}${keyToLabel(k)}`, value: safeString(v) });
      }
    });
  };

  const renderNestedObjectSection = (title, obj) => {
    if (!obj || typeof obj !== 'object') return null;
    const rows = [];
    flattenObject(obj, '', rows);
    if (rows.length === 0) return null;
    return (
      <View style={styles.section} wrap={rows.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {rows.map((r, i) => (
            <View key={i} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{r.label}:</Text>
              <Text style={styles.fieldValue}>{r.value}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  /* Recommendations — array of {recommendation, date} */
  const renderRecommendationsSection = (title, arr) => {
    if (!arr || !Array.isArray(arr)) return null;
    const recs = arr.filter(r => (r?.recommendation || '').trim());
    if (recs.length === 0) return null;
    return (
      <View style={styles.section} wrap={recs.length > 8 ? undefined : false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {recs.map((r, i) => {
            const d = (r?.date || '').trim();
            return (
              <Text key={i} style={styles.listItem}>{i + 1}. {(r.recommendation || '').trim()}{d ? ` (${d})` : ''}</Text>
            );
          })}
        </View>
      </View>
    );
  };

  const renderStringSection = (title, value) => {
    if (!value) return null;
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          <Text style={styles.text}>{safeString(value)}</Text>
        </View>
      </View>
    );
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.documentTitle}>PMR Assessment</Text>
        </View>

        {records.map((record, index) => (
          <View key={index} style={styles.recordContainer}>
            {index > 0 && <View style={styles.separator} />}

            {/* Record Header */}
            <View style={styles.recordHeader} wrap={false}>
              <View style={styles.recordDateRow}>
                {record.date && (
                  <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                )}
                {record.status && (
                  <Text style={styles.recordStatus}>{record.status}</Text>
                )}
              </View>
              <Text style={styles.recordTitle}>PMR Assessment {index + 1}</Text>
              {record.facility && (
                <Text style={styles.recordDate}>Facility: {safeString(record.facility)}</Text>
              )}
              {record.provider && (
                <Text style={styles.recordDate}>Provider: {safeString(record.provider)}</Text>
              )}
            </View>

            {/* Functional History */}
            {record.functionalHistory && (() => {
              const fh = record.functionalHistory;
              const priorItems = fh.priorLevelOfFunction ? fh.priorLevelOfFunction.split(/,\s*/).filter(s => s.trim()) : [];
              const cfs = fh.currentFunctionalStatus || {};
              const cfsEntries = Object.entries(cfs).filter(([k, v]) => v && k !== '_id');
              if (priorItems.length === 0 && cfsEntries.length === 0) return null;

              const totalItems = priorItems.length + cfsEntries.length;
              return (
                <View style={styles.section} wrap={totalItems > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Functional History</Text>
                  <View style={styles.sectionContent}>
                    {priorItems.length > 0 && (
                      <>
                        <Text style={styles.subSectionTitle}>Prior Level of Function</Text>
                        {priorItems.map((item, i) => (
                          <Text key={`prior-${i}`} style={styles.listItem}>{i + 1}. {item}</Text>
                        ))}
                      </>
                    )}
                    {cfsEntries.length > 0 && (
                      <>
                        <Text style={styles.subSectionTitle}>Current Functional Status</Text>
                        {cfsEntries.map(([k, v], i) => (
                          <View key={`cfs-${i}`} style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>{keyToLabel(k)}:</Text>
                            <Text style={styles.fieldValue}>{safeString(v)}</Text>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                </View>
              );
            })()}

            {/* Functional Assessment */}
            {record.functionalAssessment && (() => {
              const fa = record.functionalAssessment;
              const entries = [];
              if (fa.fimScore !== undefined && fa.fimScore !== null) {
                entries.push({ label: 'FIM Score', value: String(fa.fimScore) });
              }
              if (fa.fimSubscales && typeof fa.fimSubscales === 'object') {
                const subscaleLabels = { selfCare: 'Self Care', transfers: 'Transfers', locomotion: 'Locomotion', communication: 'Communication', cognition: 'Cognition' };
                Object.entries(fa.fimSubscales).filter(([k, v]) => v && k !== '_id').forEach(([k, v]) => {
                  entries.push({ label: `FIM - ${subscaleLabels[k] || keyToLabel(k)}`, value: safeString(v) });
                });
              }
              const scoreFields = [
                { key: 'barthel', label: 'Barthel Index' },
                { key: 'bergBalance', label: 'Berg Balance Score' },
                { key: 'timedUpAndGo', label: 'Timed Up And Go' },
                { key: 'sixMinuteWalk', label: 'Six Minute Walk' },
                { key: 'tenMeterWalkTest', label: 'Ten Meter Walk Test' },
                { key: 'fuglMeyerUpperExtremity', label: 'Fugl-Meyer Upper Extremity' },
                { key: 'actionResearchArmTest', label: 'Action Research Arm Test' },
              ];
              scoreFields.forEach(({ key, label }) => {
                const val = fa[key];
                if (val !== undefined && val !== null && val !== '') {
                  entries.push({ label, value: safeString(val) });
                }
              });
              if (entries.length === 0) return null;

              return (
                <View style={styles.section} wrap={entries.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Functional Assessment</Text>
                  <View style={styles.sectionContent}>
                    {entries.map((entry, i) => (
                      <View key={i} style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>{entry.label}:</Text>
                        <Text style={styles.fieldValue}>{entry.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}

            {/* Balance Assessment */}
            {renderObjectSection('Balance Assessment', record.balanceAssessment)}

            {/* Gait Analysis */}
            {renderObjectSection('Gait Analysis', record.gaitAnalysis)}

            {/* Spasticity Assessment - Ashworth Scale */}
            {renderObjectSection('Spasticity Assessment - Ashworth Scale', record.spasticityAssessment?.ashworthScale)}

            {/* EMG / Nerve Conduction Studies */}
            {renderNestedObjectSection('EMG / Nerve Conduction Studies', record.emgStudies)}

            {/* Orthotic */}
            {renderNestedObjectSection('Orthotic', record.orthotic)}

            {/* COPM Priority Areas */}
            {(() => {
              const areas = record.copm?.priorityAreas;
              if (!areas || !Array.isArray(areas) || areas.length === 0) return null;
              return (
                <View style={styles.section} wrap={areas.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>COPM Priority Areas</Text>
                  <View style={styles.sectionContent}>
                    {areas.map((area, i) => (
                      <View key={i} style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>{area.activity}:</Text>
                        <Text style={styles.fieldValue}>Performance: {area.performanceScore}, Satisfaction: {area.satisfactionScore}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}

            {/* Swallow Study */}
            {renderObjectSection('Swallow Study', record.swallowStudy)}

            {/* Neuropsychological Testing */}
            {renderObjectSection('Neuropsychological Testing', record.neuropsychologicalTesting)}

            {/* Botulinum Toxin Injections */}
            {(() => {
              const bt = record.botulinumToxinInjections;
              if (!bt) return null;
              const muscles = bt.targetedMuscles || [];
              if (!bt.indication && !bt.plan && muscles.length === 0) return null;
              const totalBtItems = (bt.indication ? 1 : 0) + muscles.length + (bt.plan ? 1 : 0);
              return (
                <View style={styles.section} wrap={totalBtItems > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Botulinum Toxin Injections</Text>
                  <View style={styles.sectionContent}>
                    {bt.indication && (
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Indication:</Text>
                        <Text style={styles.fieldValue}>{bt.indication}</Text>
                      </View>
                    )}
                    {muscles.length > 0 && (
                      <>
                        <Text style={styles.subSectionTitle}>Targeted Muscles</Text>
                        {muscles.map((m, i) => (
                          <Text key={i} style={styles.listItem}>{i + 1}. {m}</Text>
                        ))}
                      </>
                    )}
                    {bt.plan && (
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Plan:</Text>
                        <Text style={styles.fieldValue}>{bt.plan}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })()}

            {/* Equipment */}
            {(() => {
              const equipment = record.equipment;
              if (!equipment || !Array.isArray(equipment) || equipment.length === 0) return null;
              return (
                <View style={styles.section} wrap={equipment.length > 6 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Equipment</Text>
                  <View style={styles.sectionContent}>
                    {equipment.map((eq, i) => (
                      <View key={i} style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>{eq.item}:</Text>
                        <Text style={styles.fieldValue}>
                          {[eq.indication && `Indication: ${eq.indication}`, eq.status && `Status: ${eq.status}`].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}

            {/* Therapy Interventions */}
            {(() => {
              const ti = record.therapyInterventions;
              if (!ti) return null;
              const therapies = [
                { key: 'physicalTherapy', title: 'Physical Therapy' },
                { key: 'occupationalTherapy', title: 'Occupational Therapy' },
                { key: 'speechTherapy', title: 'Speech Therapy' },
                { key: 'psychology', title: 'Psychology' },
              ];
              return therapies.map(({ key, title }) => {
                const therapy = ti[key];
                if (!therapy) return null;
                const interventions = therapy.interventions || [];
                if (interventions.length === 0 && !therapy.frequency && !therapy.duration) return null;
                return (
                  <View key={key} style={styles.section} wrap={interventions.length > 6 ? undefined : false}>
                    <Text style={styles.sectionTitle}>{title}</Text>
                    <View style={styles.sectionContent}>
                      {therapy.frequency && (
                        <View style={styles.fieldRow}>
                          <Text style={styles.fieldLabel}>Frequency:</Text>
                          <Text style={styles.fieldValue}>{therapy.frequency}</Text>
                        </View>
                      )}
                      {therapy.duration && (
                        <View style={styles.fieldRow}>
                          <Text style={styles.fieldLabel}>Duration:</Text>
                          <Text style={styles.fieldValue}>{therapy.duration}</Text>
                        </View>
                      )}
                      {interventions.length > 0 && (
                        <>
                          <Text style={styles.subSectionTitle}>Interventions</Text>
                          {interventions.map((item, i) => (
                            <Text key={i} style={styles.listItem}>{i + 1}. {item}</Text>
                          ))}
                        </>
                      )}
                    </View>
                  </View>
                );
              });
            })()}

            {/* Pharmacologic Plan */}
            {renderArraySection('Pharmacologic Plan', record.medicalManagement?.pharmacologicPlan)}

            {/* Spasticity Medications */}
            {(() => {
              const meds = record.medicalManagement?.spasticityMedications;
              if (!meds || !Array.isArray(meds) || meds.length === 0) return null;
              return (
                <View style={styles.section} wrap={meds.length > 8 ? undefined : false}>
                  <Text style={styles.sectionTitle}>Spasticity Medications</Text>
                  <View style={styles.sectionContent}>
                    {meds.map((med, i) => (
                      <View key={i} style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>{med.medication}:</Text>
                        <Text style={styles.fieldValue}>{med.action || ''}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}

            {/* Support Groups */}
            {renderArraySection('Support Groups', record.supportGroups)}

            {/* Discharge Planning */}
            {renderObjectSection('Discharge Planning', record.dischargePlanningPMR)}

            {/* Provider */}
            {record.provider && (
              <View style={styles.section} wrap={false}>
                <Text style={styles.sectionTitle}>Provider</Text>
                <View style={styles.sectionContent}>
                  <Text style={styles.text}>{safeString(record.provider)}</Text>
                </View>
              </View>
            )}

            {/* Findings */}
            {renderTextSection('Findings', record.findings)}

            {/* Assessment */}
            {renderTextSection('Assessment', record.assessment)}

            {/* Plan */}
            {renderTextSection('Plan', record.plan)}

            {/* Recommendations */}
            {renderRecommendationsSection('Recommendations', record.recommendations)}

            {/* Results */}
            {renderNestedObjectSection('Results', record.results)}

            {/* Notes */}
            {renderTextSection('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default PmrAssessmentDocumentPDFTemplate;

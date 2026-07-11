import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    textTransform: 'uppercase',
    color: '#000000'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 14,
    marginBottom: 6,
    color: '#000000',
    textTransform: 'uppercase'
  },
  subsectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 6,
    marginBottom: 4,
    color: '#000000',
    textTransform: 'uppercase'
  },
  line: {
    fontSize: 11,
    marginBottom: 2,
    color: '#000000',
    lineHeight: 1.4
  },
  bold: {
    fontWeight: 'bold'
  },
  listItem: {
    fontSize: 11,
    marginBottom: 2,
    marginLeft: 12,
    color: '#000000',
    lineHeight: 1.4
  },
  emptyLine: {
    marginBottom: 6
  }
});

const PsychiatricTreatmentPlanPDFTemplate = ({ data }) => {
  if (!data) return null;

  // Helper to format dates
  const formatDate = (isoDateString) => {
    if (!isoDateString) return 'N/A';
    try {
      const date = new Date(isoDateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    } catch (e) {
      console.error("Error formatting date:", e);
      return isoDateString; // Return original if parsing fails
    }
  };

  const renderList = (items) => {
    if (!items || items.length === 0) return null;
    return items.map((item, idx) => (
      <Text key={idx} style={styles.listItem}>• {item}</Text>
    ));
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>{data.type || 'PSYCHIATRIC TREATMENT PLAN'}</Text>

        {/* HEADER INFO */}
        <View>
          <Text style={styles.line}>DATE: {formatDate(data.date) || 'N/A'}</Text>
          <Text style={styles.line}>PROVIDER: {data.provider || 'N/A'}</Text>
          <Text style={styles.line}>FACILITY: {data.facility || 'N/A'}</Text>
          <Text style={styles.line}>STATUS: {data.status || 'Active'}</Text>
          <Text style={styles.emptyLine}> </Text>
        </View>

        {/* DIAGNOSES */}
        {data.diagnoses && data.diagnoses.length > 0 && (
          <View>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>DIAGNOSES</Text>
              {data.diagnoses[0] && (
                <View style={styles.emptyLine}>
                  <Text style={styles.line}><Text style={styles.bold}>DIAGNOSIS:</Text> {data.diagnoses[0].diagnosis}</Text>
                  {data.diagnoses[0].icdCode && <Text style={styles.line}><Text style={styles.bold}>ICD CODE:</Text> {data.diagnoses[0].icdCode}</Text>}
                  {data.diagnoses[0].specifiers && data.diagnoses[0].specifiers.length > 0 && (
                    <View>
                      <Text style={[styles.line, styles.bold]}>SPECIFIERS:</Text>
                      {renderList(data.diagnoses[0].specifiers)}
                    </View>
                  )}
                </View>
              )}
            </View>
            {data.diagnoses.slice(1).map((d, i) => (
              <View key={i} style={styles.emptyLine}>
                <Text style={styles.line}><Text style={styles.bold}>DIAGNOSIS:</Text> {d.diagnosis}</Text>
                {d.icdCode && <Text style={styles.line}><Text style={styles.bold}>ICD CODE:</Text> {d.icdCode}</Text>}
                {d.specifiers && d.specifiers.length > 0 && (
                  <View>
                    <Text style={[styles.line, styles.bold]}>SPECIFIERS:</Text>
                    {renderList(d.specifiers)}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* PHARMACOLOGICAL */}
        {data.pharmacological && data.pharmacological.length > 0 && (
          <View>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>PHARMACOLOGICAL TREATMENT</Text>
              {data.pharmacological[0] && (
                <View style={styles.emptyLine}>
                  <Text style={styles.line}><Text style={styles.bold}>MEDICATION:</Text> {data.pharmacological[0].intervention}</Text>
                  {data.pharmacological[0].rationale && <Text style={styles.line}><Text style={styles.bold}>RATIONALE:</Text> {data.pharmacological[0].rationale}</Text>}
                  {data.pharmacological[0].monitoring && <Text style={styles.line}><Text style={styles.bold}>MONITORING:</Text> {data.pharmacological[0].monitoring}</Text>}
                </View>
              )}
            </View>
            {data.pharmacological.slice(1).map((m, i) => (
              <View key={i} style={styles.emptyLine}>
                <Text style={styles.line}><Text style={styles.bold}>MEDICATION:</Text> {m.intervention}</Text>
                {m.rationale && <Text style={styles.line}><Text style={styles.bold}>RATIONALE:</Text> {m.rationale}</Text>}
                {m.monitoring && <Text style={styles.line}><Text style={styles.bold}>MONITORING:</Text> {m.monitoring}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* PSYCHOTHERAPY */}
        {data.psychotherapy && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>PSYCHOTHERAPY</Text>
            {data.psychotherapy.type && <Text style={styles.line}><Text style={styles.bold}>TYPE:</Text> {data.psychotherapy.type}</Text>}
            {data.psychotherapy.frequency && <Text style={styles.line}><Text style={styles.bold}>FREQUENCY:</Text> {data.psychotherapy.frequency}</Text>}
            {data.psychotherapy.provider && <Text style={styles.line}><Text style={styles.bold}>PROVIDER:</Text> {data.psychotherapy.provider}</Text>}
            {data.psychotherapy.goals && data.psychotherapy.goals.length > 0 && (
              <View>
                <Text style={[styles.line, styles.bold, { marginTop: 4 }]}>GOALS:</Text>
                {renderList(data.psychotherapy.goals)}
              </View>
            )}
            <Text style={styles.emptyLine}> </Text>
          </View>
        )}

        {/* NARRATIVES */}
        {data.findings && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>CLINICAL FINDINGS</Text>
            <Text style={styles.line}>{data.findings}</Text>
            <Text style={styles.emptyLine}> </Text>
          </View>
        )}

        {data.assessment && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>ASSESSMENT</Text>
            <Text style={styles.line}>{data.assessment}</Text>
            <Text style={styles.emptyLine}> </Text>
          </View>
        )}

        {data.plan && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>PLAN</Text>
            <Text style={styles.line}>{data.plan}</Text>
            <Text style={styles.emptyLine}> </Text>
          </View>
        )}

        {data.notes && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>NOTES</Text>
            <Text style={styles.line}>{data.notes}</Text>
            <Text style={styles.emptyLine}> </Text>
          </View>
        )}

        {/* RECOMMENDATIONS */}
        {data.recommendations && data.recommendations.length > 0 && (
          <View>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
              {data.recommendations[0] && (
                <View style={{ marginBottom: 4 }}>
                  <Text style={styles.line}>• {data.recommendations[0].recommendation} {data.recommendations[0].date ? `(${formatDate(data.recommendations[0].date)})` : ''}</Text>
                </View>
              )}
            </View>
            {data.recommendations.slice(1).map((r, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <Text style={styles.line}>• {r.recommendation} {r.date ? `(${formatDate(r.date)})` : ''}</Text>
              </View>
            ))}
            <Text style={styles.emptyLine}> </Text>
          </View>
        )}

        {/* SAFETY PLAN */}
        {data.safetyPlan && (
          <View>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>SAFETY PLAN</Text>
              
              {data.safetyPlan.warningSignsidentified && data.safetyPlan.warningSignsidentified.length > 0 && (
                <View>
                  <Text style={styles.subsectionTitle}>WARNING SIGNS</Text>
                  {renderList(data.safetyPlan.warningSignsidentified)}
                </View>
              )}
            </View>

            {data.safetyPlan.copingStrategies && data.safetyPlan.copingStrategies.length > 0 && (
              <View wrap={false}>
                <Text style={styles.subsectionTitle}>COPING STRATEGIES</Text>
                {renderList(data.safetyPlan.copingStrategies)}
              </View>
            )}

            {data.safetyPlan.supportsContacts && data.safetyPlan.supportsContacts.length > 0 && (
              <View wrap={false}>
                <Text style={styles.subsectionTitle}>SUPPORT CONTACTS</Text>
                {renderList(data.safetyPlan.supportsContacts)}
              </View>
            )}

            {data.safetyPlan.crisisNumbers && data.safetyPlan.crisisNumbers.length > 0 && (
              <View wrap={false}>
                <Text style={styles.subsectionTitle}>CRISIS NUMBERS</Text>
                {renderList(data.safetyPlan.crisisNumbers)}
              </View>
            )}

            {data.safetyPlan.meansRestriction && data.safetyPlan.meansRestriction.length > 0 && (
              <View wrap={false}>
                <Text style={styles.subsectionTitle}>MEANS RESTRICTION</Text>
                {renderList(data.safetyPlan.meansRestriction)}
              </View>
            )}

            {data.safetyPlan.childcarePlan && (
              <View wrap={false} style={{ marginTop: 4 }}>
                <Text style={[styles.line, styles.bold]}>CHILDCARE PLAN:</Text>
                <Text style={styles.line}>{data.safetyPlan.childcarePlan}</Text>
              </View>
            )}
            <Text style={styles.emptyLine}> </Text>
          </View>
        )}

        {/* FOLLOW UP */}
        {data.followUpPlan && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>FOLLOW UP PLAN</Text>
            {data.followUpPlan.nextAppointment && <Text style={styles.line}><Text style={styles.bold}>NEXT APPOINTMENT:</Text> {data.followUpPlan.nextAppointment}</Text>}
            {data.followUpPlan.frequency && <Text style={styles.line}><Text style={styles.bold}>FREQUENCY:</Text> {data.followUpPlan.frequency}</Text>}
            {data.followUpPlan.monitoring && data.followUpPlan.monitoring.length > 0 && (
              <View>
                <Text style={[styles.line, styles.bold, { marginTop: 4 }]}>MONITORING PARAMETERS:</Text>
                {renderList(data.followUpPlan.monitoring)}
              </View>
            )}
            <Text style={styles.emptyLine}> </Text>
          </View>
        )}

        {/* SUPPORT & LIFESTYLE */}
        {(data.supportGroups?.length > 0 || data.lifestyleModifications?.length > 0) && (
          <View>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>SUPPORT & LIFESTYLE</Text>
              
              {data.supportGroups && data.supportGroups.length > 0 && (
                <View>
                  <Text style={styles.subsectionTitle}>SUPPORT GROUPS</Text>
                  {renderList(data.supportGroups)}
                </View>
              )}
            </View>

            {data.lifestyleModifications && data.lifestyleModifications.length > 0 && (
              <View wrap={false}>
                <Text style={styles.subsectionTitle}>LIFESTYLE MODIFICATIONS</Text>
                {renderList(data.lifestyleModifications)}
              </View>
            )}
          </View>
        )}

      </Page>
    </Document>
  );
};

export default PsychiatricTreatmentPlanPDFTemplate;
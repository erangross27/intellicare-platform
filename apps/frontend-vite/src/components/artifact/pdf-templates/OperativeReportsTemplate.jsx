import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderLeft: '3px solid #7c7c7c',
    borderRadius: 2
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-start',
    flexWrap: 'wrap'
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000'
  },
  value: {
    fontSize: 10,
    color: '#333333',
    marginLeft: 4
  },
  section: {
    marginTop: 8,
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
    textDecoration: 'underline'
  },
  paragraph: {
    fontSize: 10,
    color: '#333333',
    lineHeight: 1.6,
    marginBottom: 6
  },
  listItem: {
    fontSize: 9,
    color: '#333333',
    marginLeft: 12,
    marginBottom: 3,
    lineHeight: 1.4
  },
  subsection: {
    marginLeft: 8,
    marginTop: 4,
    marginBottom: 4
  }
});

const OperativeReportsTemplate = ({ document }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <View style={styles.card}>
      {/* Date of Surgery */}
      {document.dateOfSurgery && (
        <View style={styles.row}>
          <Text style={styles.label}>Date of Surgery:</Text>
          <Text style={styles.value}>{formatDate(document.dateOfSurgery)}</Text>
        </View>
      )}

      {/* Surgeon */}
      {document.surgeon && (
        <View style={styles.row}>
          <Text style={styles.label}>Surgeon:</Text>
          <Text style={styles.value}>{document.surgeon}</Text>
        </View>
      )}

      {/* Assistant Surgeons */}
      {document.assistants && (
        <View style={styles.row}>
          <Text style={styles.label}>Assistants:</Text>
          <Text style={styles.value}>
            {Array.isArray(document.assistants) ? document.assistants.join(', ') : document.assistants}
          </Text>
        </View>
      )}

      {/* Anesthesiologist */}
      {document.anesthesiologist && (
        <View style={styles.row}>
          <Text style={styles.label}>Anesthesiologist:</Text>
          <Text style={styles.value}>{document.anesthesiologist}</Text>
        </View>
      )}

      {/* Anesthesia Type */}
      {document.anesthesiaType && (
        <View style={styles.row}>
          <Text style={styles.label}>Anesthesia:</Text>
          <Text style={styles.value}>{document.anesthesiaType}</Text>
        </View>
      )}

      {/* Preoperative Diagnosis */}
      {document.preoperativeDiagnosis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preoperative Diagnosis:</Text>
          {Array.isArray(document.preoperativeDiagnosis) ? (
            document.preoperativeDiagnosis.map((diagnosis, i) => (
              <Text key={i} style={styles.listItem}>• {diagnosis}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.preoperativeDiagnosis}</Text>
          )}
        </View>
      )}

      {/* Postoperative Diagnosis */}
      {document.postoperativeDiagnosis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Postoperative Diagnosis:</Text>
          {Array.isArray(document.postoperativeDiagnosis) ? (
            document.postoperativeDiagnosis.map((diagnosis, i) => (
              <Text key={i} style={styles.listItem}>• {diagnosis}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.postoperativeDiagnosis}</Text>
          )}
        </View>
      )}

      {/* Procedure Performed */}
      {document.procedurePerformed && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Procedure Performed:</Text>
          {Array.isArray(document.procedurePerformed) ? (
            document.procedurePerformed.map((procedure, i) => (
              <Text key={i} style={styles.listItem}>• {procedure}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.procedurePerformed}</Text>
          )}
        </View>
      )}

      {/* Indications */}
      {document.indications && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Indications:</Text>
          <Text style={styles.paragraph}>{document.indications}</Text>
        </View>
      )}

      {/* Operative Findings */}
      {document.operativeFindings && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operative Findings:</Text>
          <Text style={styles.paragraph}>{document.operativeFindings}</Text>
        </View>
      )}

      {/* Procedure Description */}
      {document.procedureDescription && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Procedure Description:</Text>
          <Text style={styles.paragraph}>{document.procedureDescription}</Text>
        </View>
      )}

      {/* Operative Report Details (from schema) */}
      {document.operativeReportDetails && (
        <View style={styles.section}>
          {/* Patient Positioning */}
          {document.operativeReportDetails.patientPositioning && (
            <View style={styles.subsection}>
              <Text style={styles.label}>Patient Positioning:</Text>
              <Text style={styles.value}>{document.operativeReportDetails.patientPositioning}</Text>
            </View>
          )}

          {/* Surgical Steps */}
          {document.operativeReportDetails.surgicalSteps && Array.isArray(document.operativeReportDetails.surgicalSteps) && (
            <View style={styles.subsection}>
              <Text style={styles.sectionTitle}>Surgical Steps:</Text>
              {document.operativeReportDetails.surgicalSteps.map((step, i) => (
                <Text key={i} style={styles.listItem}>
                  {step.stepNumber ? `${step.stepNumber}. ` : '• '}{step.description}
                </Text>
              ))}
            </View>
          )}

          {/* Operative Time */}
          {document.operativeReportDetails.operativeTime && (
            <View style={styles.subsection}>
              <Text style={styles.label}>Operative Time:</Text>
              <Text style={styles.value}>
                {document.operativeReportDetails.operativeTime.totalDuration ||
                 `${document.operativeReportDetails.operativeTime.startTime} - ${document.operativeReportDetails.operativeTime.endTime}`}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Specimens */}
      {document.specimens && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specimens:</Text>
          {Array.isArray(document.specimens) ? (
            document.specimens.map((specimen, i) => (
              <Text key={i} style={styles.listItem}>• {specimen.specimen || specimen}</Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.specimens}</Text>
          )}
        </View>
      )}

      {/* Estimated Blood Loss */}
      {document.estimatedBloodLoss && (
        <View style={styles.row}>
          <Text style={styles.label}>Estimated Blood Loss:</Text>
          <Text style={styles.value}>{document.estimatedBloodLoss}</Text>
        </View>
      )}

      {/* Complications */}
      {document.complications && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Complications:</Text>
          <Text style={styles.paragraph}>{document.complications}</Text>
        </View>
      )}

      {/* Condition */}
      {document.condition && (
        <View style={styles.row}>
          <Text style={styles.label}>Condition:</Text>
          <Text style={styles.value}>{document.condition}</Text>
        </View>
      )}
    </View>
  );
};

export default OperativeReportsTemplate;

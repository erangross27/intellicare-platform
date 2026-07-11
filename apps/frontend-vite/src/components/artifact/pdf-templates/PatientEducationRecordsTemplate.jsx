import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'left',
  },
  subsectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 8,
    marginBottom: 6,
    textAlign: 'left',
  },
  line: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 6,
    lineHeight: 1.6,
    textAlign: 'left',
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  indent: {
    marginLeft: 12,
  },
});

const PatientEducationRecordsTemplate = ({ document }) => {
  const doc = document;

  if (!doc) {
    return (
      <View>
        <Text style={styles.line}>No document data</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Provider */}
      {doc.providedBy && (
        <View wrap={false}>
          <Text style={styles.line}>
            <Text style={styles.textBold}>Provided by: </Text>
            {doc.providedBy}
          </Text>
        </View>
      )}

      {/* Topics Covered */}
      {doc.topics && Array.isArray(doc.topics) && doc.topics.length > 0 && (
        <View>
          {doc.topics.filter(topic => topic != null).map((item, index) => (
            <View key={index} style={{ marginBottom: 12, marginTop: index === 0 ? 16 : 8 }} wrap={false}>
              {/* Include section title with first topic */}
              {index === 0 && (
                <Text style={styles.sectionTitle}>Topics Covered</Text>
              )}

              <Text style={styles.subsectionTitle}>
                {index + 1}. {item.topic || 'Topic'}
              </Text>

              {item.materials && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Materials: </Text>
                  {item.materials}
                </Text>
              )}

              {item.details && (
                <Text style={styles.line}>
                  <Text style={styles.textBold}>Details: </Text>
                  {item.details}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Resources Provided */}
      {doc.resourcesProvided && Array.isArray(doc.resourcesProvided) && doc.resourcesProvided.length > 0 && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Resources Provided</Text>
          {doc.resourcesProvided.filter(resource => resource != null).map((resource, idx) => (
            <Text key={idx} style={[styles.line, styles.indent]}>
              • {resource}
            </Text>
          ))}
        </View>
      )}

      {/* Education Method */}
      {doc.educationMethod && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Education Method</Text>
          <Text style={styles.line}>{doc.educationMethod}</Text>
        </View>
      )}

      {/* Patient Understanding */}
      {doc.patientUnderstanding && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Patient Understanding</Text>
          <Text style={styles.line}>{doc.patientUnderstanding}</Text>
        </View>
      )}

      {/* Follow-up Education Needs */}
      {doc.followUpNeeds && Array.isArray(doc.followUpNeeds) && doc.followUpNeeds.length > 0 && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Follow-up Education Needs</Text>
          {doc.followUpNeeds.filter(need => need != null).map((need, idx) => (
            <Text key={idx} style={[styles.line, styles.indent]}>
              • {need}
            </Text>
          ))}
        </View>
      )}

      {/* Language/Interpreter Used */}
      {doc.language && (
        <View wrap={false}>
          <Text style={styles.sectionTitle}>Language</Text>
          <Text style={styles.line}>
            <Text style={styles.textBold}>Language: </Text>
            {doc.language}
          </Text>
          {doc.interpreterUsed && (
            <Text style={styles.line}>
              <Text style={styles.textBold}>Interpreter Used: </Text>
              Yes
            </Text>
          )}
        </View>
      )}

      {/* Duration */}
      {doc.duration && (
        <Text style={[styles.line, { marginTop: 8 }]}>
          <Text style={styles.textBold}>Duration: </Text>
          {doc.duration}
        </Text>
      )}

      {/* Date */}
      {doc.date && (
        <Text style={[styles.line, { marginTop: 4 }]}>
          <Text style={styles.textBold}>Date: </Text>
          {new Date(doc.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>
      )}
    </View>
  );
};

export default PatientEducationRecordsTemplate;

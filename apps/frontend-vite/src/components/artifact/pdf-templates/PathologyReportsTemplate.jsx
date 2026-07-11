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
  },
  diagnosisBox: {
    backgroundColor: '#e8e8e8',
    padding: 8,
    borderRadius: 4,
    marginTop: 6,
    marginBottom: 6
  },
  diagnosisText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000'
  }
});

const PathologyReportsTemplate = ({ document }) => {
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
      {/* Report Date */}
      {document.reportDate && (
        <View style={styles.row}>
          <Text style={styles.label}>Report Date:</Text>
          <Text style={styles.value}>{formatDate(document.reportDate)}</Text>
        </View>
      )}

      {/* Specimen Collection Date */}
      {document.specimenCollectionDate && (
        <View style={styles.row}>
          <Text style={styles.label}>Specimen Collection:</Text>
          <Text style={styles.value}>{formatDate(document.specimenCollectionDate)}</Text>
        </View>
      )}

      {/* Status */}
      {document.status && (
        <View style={styles.row}>
          <Text style={styles.label}>Status:</Text>
          <Text style={styles.value}>{document.status}</Text>
        </View>
      )}

      {/* Ordering Physician */}
      {document.orderingPhysician && (
        <View style={styles.row}>
          <Text style={styles.label}>Ordering Physician:</Text>
          <Text style={styles.value}>
            {document.orderingPhysician.name || document.orderingPhysician}
            {document.orderingPhysician.specialty && ` (${document.orderingPhysician.specialty})`}
          </Text>
        </View>
      )}

      {/* Pathologist */}
      {document.pathologist && (
        <View style={styles.row}>
          <Text style={styles.label}>Pathologist:</Text>
          <Text style={styles.value}>
            {document.pathologist.name || document.pathologist}
            {document.pathologist.credentials && `, ${document.pathologist.credentials}`}
          </Text>
        </View>
      )}

      {/* Diagnosis - Highlighted */}
      {document.diagnosis && (
        <View style={styles.diagnosisBox}>
          <Text style={styles.diagnosisText}>DIAGNOSIS: {document.diagnosis}</Text>
        </View>
      )}

      {/* Clinical Information */}
      {document.clinicalInformation && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clinical Information:</Text>
          <Text style={styles.paragraph}>{document.clinicalInformation}</Text>
        </View>
      )}

      {/* Specimens */}
      {document.specimens && Array.isArray(document.specimens) && document.specimens.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specimens:</Text>
          {document.specimens.map((specimen, i) => (
            <View key={i} style={styles.subsection}>
              {specimen.label && <Text style={styles.label}>Specimen {specimen.label}:</Text>}
              {specimen.type && <Text style={styles.listItem}>Type: {specimen.type}</Text>}
              {specimen.site && <Text style={styles.listItem}>Site: {specimen.site}</Text>}
              {specimen.procedure && <Text style={styles.listItem}>Procedure: {specimen.procedure}</Text>}
            </View>
          ))}
        </View>
      )}

      {/* Specimen (singular, legacy) */}
      {document.specimen && !document.specimens && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specimen:</Text>
          {document.specimen.type && <Text style={styles.listItem}>Type: {document.specimen.type}</Text>}
          {document.specimen.site && <Text style={styles.listItem}>Site: {document.specimen.site}</Text>}
          {document.specimen.procedure && <Text style={styles.listItem}>Procedure: {document.specimen.procedure}</Text>}
        </View>
      )}

      {/* Gross Description */}
      {document.grossDescription && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gross Description:</Text>
          <Text style={styles.paragraph}>{document.grossDescription}</Text>
        </View>
      )}

      {/* Microscopic Description */}
      {document.microscopicDescription && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Microscopic Description:</Text>
          <Text style={styles.paragraph}>{document.microscopicDescription}</Text>
        </View>
      )}

      {/* Microscopic Findings */}
      {document.microscopicFindings && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Microscopic Findings:</Text>
          {document.microscopicFindings.mitoticRate && (
            <Text style={styles.listItem}>Mitotic Rate: {document.microscopicFindings.mitoticRate}</Text>
          )}
          {document.microscopicFindings.necrosisPercentage && (
            <Text style={styles.listItem}>Necrosis: {document.microscopicFindings.necrosisPercentage}</Text>
          )}
        </View>
      )}

      {/* Immunohistochemistry */}
      {document.immunohistochemistry && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Immunohistochemistry:</Text>
          {Array.isArray(document.immunohistochemistry) ? (
            document.immunohistochemistry.map((result, i) => (
              <Text key={i} style={styles.listItem}>
                • {result.marker || result}: {result.result || ''}
              </Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.immunohistochemistry}</Text>
          )}
        </View>
      )}

      {/* Flow Cytometry */}
      {document.flowCytometry && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Flow Cytometry:</Text>
          <Text style={styles.paragraph}>{document.flowCytometry}</Text>
        </View>
      )}

      {/* Special Stains */}
      {document.specialStains && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Stains:</Text>
          {Array.isArray(document.specialStains) ? (
            document.specialStains.map((stain, i) => (
              <Text key={i} style={styles.listItem}>
                • {stain.stain || stain}: {stain.result || ''}
              </Text>
            ))
          ) : (
            <Text style={styles.paragraph}>{document.specialStains}</Text>
          )}
        </View>
      )}

      {/* Molecular Studies */}
      {document.molecularStudies && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Molecular Studies:</Text>
          <Text style={styles.paragraph}>{document.molecularStudies}</Text>
        </View>
      )}

      {/* Comment */}
      {document.comment && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comment:</Text>
          <Text style={styles.paragraph}>{document.comment}</Text>
        </View>
      )}

      {/* Consulting Pathologist */}
      {document.consultingPathologist && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consultation:</Text>
          <Text style={styles.listItem}>
            {document.consultingPathologist.name}
            {document.consultingPathologist.specialty && ` (${document.consultingPathologist.specialty})`}
          </Text>
          {document.consultingPathologist.consultationNote && (
            <Text style={styles.paragraph}>{document.consultingPathologist.consultationNote}</Text>
          )}
        </View>
      )}
    </View>
  );
};

export default PathologyReportsTemplate;

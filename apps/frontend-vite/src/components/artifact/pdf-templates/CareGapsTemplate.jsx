import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
    paddingBottom: 4,
    borderBottom: '1px solid #000000',
  },
  card: {
    backgroundColor: '#f9f9f9',
    border: '1px solid #cccccc',
    padding: 10,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  screeningTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 6,
  },
  badge: {
    fontSize: 8,
    fontWeight: 'bold',
    padding: '3px 8px',
    border: '1px solid #000000',
    backgroundColor: '#ffffff',
    color: '#000000',
    marginLeft: 4,
  },
  text: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 6,
    lineHeight: 1.5,
  },
  textBold: {
    fontWeight: 'bold',
    color: '#000000',
  },
  dateText: {
    fontSize: 9,
    color: '#000000',
    marginBottom: 4,
  },
  rationaleText: {
    fontSize: 9,
    color: '#000000',
    lineHeight: 1.4,
    marginTop: 4,
  },
  noGapsCard: {
    backgroundColor: '#f9f9f9',
    borderLeft: '3px solid #666666',
    padding: 10,
  },
  noGapsText: {
    fontSize: 11,
    color: '#000000',
    fontWeight: 'bold',
  },
});

const CareGapsTemplate = ({ document }) => {
  const doc = document;
  const screenings = doc.screenings || [];

  // Group screenings by category
  const groupedScreenings = screenings.reduce((acc, screening) => {
    const category = screening.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(screening);
    return acc;
  }, {});

  const getBorderColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'missing':
      case 'overdue':
        return '#666666';
      case 'due soon':
        return '#666666';
      default:
        return '#666666';
    }
  };

  return (
    <View>
      {screenings.length === 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Care Gaps Assessment</Text>
          <View style={styles.noGapsCard}>
            <Text style={styles.noGapsText}>
              ✓ No care gaps identified. Patient is up to date with recommended screenings and preventive care.
            </Text>
          </View>
        </View>
      ) : (
        <View>
          {Object.entries(groupedScreenings).map(([category, items], catIndex) => (
            <View key={catIndex} style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>{category}</Text>
              {items.map((screening, index) => (
                <View key={index} style={styles.card}>
                  <Text style={styles.screeningTitle}>
                    {screening.screeningType || screening.test}
                  </Text>

                  {screening.actionRequired && (
                    <Text style={styles.text}>
                      {screening.actionRequired}
                    </Text>
                  )}

                  {screening.dueDate && (
                    <Text style={styles.text}>
                      Due Date: {new Date(screening.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default CareGapsTemplate;

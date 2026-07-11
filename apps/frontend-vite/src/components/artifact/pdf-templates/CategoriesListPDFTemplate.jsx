import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * CategoriesListPDFTemplate - Generates PDF report of available medical data categories
 *
 * Used when exporting the medical data categories list to PDF format
 * Shows clean, professional table of all categories with document counts
 */

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#000000'
  },
  header: {
    marginBottom: 20,
    borderBottom: '1px solid #000000',
    paddingBottom: 15
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000'
  },
  patientInfo: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4
  },
  summary: {
    marginBottom: 20,
    paddingLeft: 0
  },
  summaryText: {
    fontSize: 11,
    color: '#000000',
    marginBottom: 3
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
    marginTop: 5
  },
  listItem: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 6,
    paddingLeft: 0
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#000000',
    textAlign: 'center',
    borderTop: '1px solid #000000',
    paddingTop: 10
  },
  footerText: {
    marginBottom: 2
  }
});

const CategoriesListPDFTemplate = ({ categories, patientName, patientId }) => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  const totalDocuments = categories.reduce((sum, cat) => sum + cat.count, 0);
  const totalCategories = categories.length - 1; // Exclude "Full Report" from count

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Available Medical Data for {patientName || 'Patient'}</Text>
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            Total Categories: {totalCategories}
          </Text>
          <Text style={styles.summaryText}>
            Total Documents: {totalDocuments}
          </Text>
        </View>

        {/* Section Title */}
        <Text style={styles.sectionTitle}>Medical Data Categories:</Text>

        {/* Simple Numbered List */}
        {categories.map((category, index) => (
          <Text key={index} style={styles.listItem}>
            {index + 1}. {category.displayName || category.name} - {category.count} {category.count === 1 ? 'document' : 'documents'}
          </Text>
        ))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>IntelliCare Medical Report - Confidential Patient Information</Text>
          <Text style={styles.footerText}>This document contains protected health information (PHI)</Text>
        </View>
      </Page>
    </Document>
  );
};

export default CategoriesListPDFTemplate;

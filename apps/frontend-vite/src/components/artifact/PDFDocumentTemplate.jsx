import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { getTemplateForCollection } from './pdf-templates';

/**
 * PDFDocumentTemplate - Generates clean, professional medical report PDFs
 *
 * Uses collection-specific templates from pdf-templates/ folder
 * Each collection has a dedicated template for perfect formatting
 * Falls back to GenericTemplate for collections without custom templates
 *
 * To add a new template:
 * 1. Create pdf-templates/YourCollectionTemplate.jsx
 * 2. Register it in pdf-templates/index.js
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
    borderBottom: '2px solid #000000',
    paddingBottom: 10,
    break: 'avoid'  // Prevent page break after header
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#000000'
  },
  subtitle: {
    fontSize: 10,
    color: '#444444',
    marginBottom: 3
  },
  recordCount: {
    fontSize: 9,
    color: '#666666'
  },
  section: {
    marginBottom: 15
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 10,
    color: '#000000',
    borderBottom: '1px solid #cccccc',
    paddingBottom: 3
  },
  card: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderLeft: '3px solid #3b82f6',
    borderRadius: 2
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#000000'
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    width: '30%'
  },
  value: {
    fontSize: 10,
    color: '#333333',
    width: '70%'
  },
  text: {
    fontSize: 10,
    color: '#333333',
    lineHeight: 1.5,
    marginBottom: 4
  },
  badge: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    padding: '3 8',
    borderRadius: 8,
    marginLeft: 10
  },
  separator: {
    borderBottom: '1px solid #e5e7eb',
    marginVertical: 10
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#999999',
    textAlign: 'center',
    borderTop: '1px solid #e5e7eb',
    paddingTop: 10
  }
});

const PDFDocumentTemplate = ({ category, categoryDisplay, documents, patientName }) => {
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

  const formatCategoryName = (name) => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const displayName = categoryDisplay || formatCategoryName(category);

  // Render document using collection-specific template ONLY
  const renderDocument = (doc, index) => {
    // Get template for this collection
    const TemplateComponent = getTemplateForCollection(category);

    if (!TemplateComponent) {
      // NO FALLBACK - fail clearly so we know to create the template
      return (
        <View key={index} style={styles.card}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#ef4444', marginBottom: 8 }}>
            ⚠️ NO PDF TEMPLATE FOR: {category}
          </Text>
          <Text style={{ fontSize: 10, color: '#666' }}>
            Please create: pdf-templates/{category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Template.jsx
          </Text>
        </View>
      );
    }

    return <TemplateComponent key={index} document={doc} />;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header} fixed>
          <Text style={styles.title}>{displayName}</Text>
          {patientName && (
            <Text style={styles.subtitle}>Patient: {patientName}</Text>
          )}
          <Text style={styles.recordCount}>
            {documents.length} {documents.length === 1 ? 'Record' : 'Records'}
          </Text>
          <Text style={styles.subtitle}>
            Generated: {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        {/* Documents - allow natural flow */}
        {documents.map((doc, index) => renderDocument(doc, index))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>IntelliCare Medical Report - Confidential Patient Information</Text>
        </View>
      </Page>
    </Document>
  );
};

export default PDFDocumentTemplate;

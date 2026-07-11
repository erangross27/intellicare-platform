import React, { lazy, Suspense } from 'react';
import './DocumentRenderer.css';

// Use lazy imports to match AIDocumentRenderer and enable proper code-splitting
const MedicationDocument = lazy(() => import('./templates/MedicationDocument'));
const LabResultsDocument = lazy(() => import('./templates/LabResultsDocument'));
const TableDocument = lazy(() => import('./templates/TableDocument'));
const PatientDocument = lazy(() => import('./templates/PatientDocument'));
const AnesthesiaDocument = lazy(() => import('./templates/AnesthesiaDocument'));
const MedicalProceduresDocument = lazy(() => import('./templates/MedicalProceduresDocument'));

// Loading fallback for lazy-loaded templates
const TemplateLoadingFallback = () => (
  <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
    Loading template...
  </div>
);

/**
 * DocumentRenderer - Routes documents to appropriate templates
 *
 * This component determines which template to use based on the category
 * and renders the document using that template.
 *
 * Props:
 * - document: object - Full document data
 * - category: string - Category/collection name
 * - patientId: string - Patient ID
 */

// Template mapping (Phase 3 - gradually adding all templates)
const COLLECTION_TEMPLATES = {
  // Patient Details
  'patient_details': 'PatientDocument',
  'patients': 'PatientDocument',

  // Medications
  'medications': 'MedicationDocument',
  'medication_optimization': 'MedicationDocument',
  'doctors_medications_recommendations_optimizations': 'MedicationDocument',

  // Laboratory Results
  'lab_results': 'LabResultsDocument',
  'lab_trending': 'LabResultsDocument',

  // Anesthesia Records
  'anesthesia_records': 'AnesthesiaDocument',

  // Medical Procedures
  'medical_procedures': 'MedicalProceduresDocument',

  // More templates will be added as they're created
};

// Simple fallback template component
const NarrativeDocument = ({ document, category }) => {
  // Helper to render any data structure
  const renderValue = (value, depth = 0) => {
    if (value === null || value === undefined) {
      return <span className="empty-value">-</span>;
    }

    // String or number
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return <span className="text-value">{String(value)}</span>;
    }

    // Date
    if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
      try {
        const date = new Date(value);
        return <span className="date-value">{date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</span>;
      } catch {
        return <span className="text-value">{String(value)}</span>;
      }
    }

    // Array
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="empty-value">None</span>;
      }
      return (
        <ul className="array-list" style={{ marginLeft: `${depth * 20}px` }}>
          {value.map((item, index) => (
            <li key={index} className="array-item">
              {renderValue(item, depth + 1)}
            </li>
          ))}
        </ul>
      );
    }

    // Object
    if (typeof value === 'object') {
      const entries = Object.entries(value).filter(([key]) =>
        !key.startsWith('_') && key !== 'patientId' && key !== 'documentId'
      );

      if (entries.length === 0) {
        return <span className="empty-value">-</span>;
      }

      return (
        <div className="object-content" style={{ marginLeft: `${depth * 20}px` }}>
          {entries.map(([key, val]) => (
            <div key={key} className="field-row">
              <div className="field-label">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
              </div>
              <div className="field-value">
                {renderValue(val, depth + 1)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return <span className="text-value">{String(value)}</span>;
  };

  // Get document title
  const getTitle = () => {
    if (document.title) return document.title;
    return category
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  // Filter out metadata fields
  const contentData = { ...document };
  delete contentData._id;
  delete contentData.patientId;
  delete contentData.documentId;
  delete contentData.date;
  delete contentData.createdAt;
  delete contentData.updatedAt;
  delete contentData.source;

  return (
    <div className="narrative-document">
      <h1 className="document-title">{getTitle()}</h1>
      <div className="document-body">
        {renderValue(contentData)}
      </div>
    </div>
  );
};

// Main DocumentRenderer component
const DocumentRenderer = ({ document, category, patientId }) => {
  // Get template name for this category
  const getTemplateName = () => {
    // Direct match
    if (COLLECTION_TEMPLATES[category]) {
      return COLLECTION_TEMPLATES[category];
    }

    // Wildcard patterns (will implement in Phase 3)
    // For now, use fallback
    return 'NarrativeDocument';
  };

  const templateName = getTemplateName();

  // Route to appropriate template (wrapped in Suspense for lazy-loaded components)
  const renderTemplate = () => {
    switch (templateName) {
      case 'PatientDocument':
        return <PatientDocument document={document} />;

      case 'MedicationDocument':
        return <MedicationDocument document={document} />;

      case 'LabResultsDocument':
        return <LabResultsDocument document={document} />;

      case 'AnesthesiaDocument':
        return <AnesthesiaDocument document={document} />;

      case 'MedicalProceduresDocument':
        return <MedicalProceduresDocument document={document} />;

      case 'TableDocument':
        return <TableDocument document={document} category={category} />;

      case 'NarrativeDocument':
        return <NarrativeDocument document={document} category={category} />;

      default:
        // Template not implemented - use TableDocument as default
        return <TableDocument document={document} category={category} />;
    }
  };

  return (
    <Suspense fallback={<TemplateLoadingFallback />}>
      {renderTemplate()}
    </Suspense>
  );
};

export default DocumentRenderer;

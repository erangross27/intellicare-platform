# Component Structure Reference

## File Organization

```
apps/frontend-vite/src/
├── components/
│   └── artifact/
│       ├── ArtifactPanel.jsx              # Main wrapper
│       ├── CategoryListView.jsx           # Level 1: Category list
│       ├── DocumentListView.jsx           # Level 2: Document list
│       ├── DocumentListItem.jsx           # Single document card
│       ├── DocumentDetailView.jsx         # Level 3: Document detail
│       ├── DocumentRenderer.jsx           # Template router
│       ├── LoadingSpinner.jsx             # Loading indicator
│       ├── ErrorMessage.jsx               # Error display
│       ├── ArtifactTriggerButton.jsx      # Button to open artifact
│       │
│       └── templates/
│           ├── MedicationDocument.jsx     # Medications template
│           ├── LabResultsDocument.jsx     # Lab results template
│           ├── VitalSignsDocument.jsx     # Vitals template
│           ├── AIInsightsDocument.jsx     # AI recommendations
│           ├── DiagnosisDocument.jsx      # Diagnoses template
│           ├── ProcedureDocument.jsx      # Procedures template
│           ├── TimelineDocument.jsx       # Hospital course
│           ├── TrendingDocument.jsx       # Trending analysis
│           ├── QualityMetricsDocument.jsx # Quality metrics
│           ├── AllergyDocument.jsx        # Allergies template
│           ├── ImagingDocument.jsx        # Imaging reports
│           ├── ComparisonDocument.jsx     # Medication optimization
│           ├── TableDocument.jsx          # Generic table
│           ├── NarrativeDocument.jsx      # Generic narrative
│           ├── SummaryDocument.jsx        # Generic summary
│           └── DocumentStyles.css         # Shared template styles
│
├── config/
│   └── documentTemplates.js               # Collection→Template mapping
│
├── utils/
│   └── artifactApi.js                     # API client for artifact
│
└── styles/
    └── artifact.css                       # Artifact-specific styles

apps/backend-api/
├── routes/
│   └── agent.js                           # Add 3 new endpoints
│
└── services/
    └── documentCountService.js            # Count docs per collection
```

## Component Hierarchy

```
ArtifactPanel
├─ State Management (level, category, documentId)
├─ Navigation Logic
├─ Open/Close Control
│
├─ CategoryListView (Level 1)
│   ├─ Fetch categories from API
│   ├─ Display category list
│   └─ Handle category selection
│
├─ DocumentListView (Level 2)
│   ├─ Fetch documents in category
│   ├─ Display document list (newest first)
│   ├─ DocumentListItem × N
│   │   ├─ Date display
│   │   ├─ Title
│   │   ├─ Preview text
│   │   └─ Click handler
│   └─ Back button to categories
│
└─ DocumentDetailView (Level 3)
    ├─ Fetch full document
    ├─ DocumentRenderer
    │   └─ Route to appropriate template
    │       ├─ MedicationDocument
    │       ├─ LabResultsDocument
    │       ├─ VitalSignsDocument
    │       ├─ AIInsightsDocument
    │       ├─ DiagnosisDocument
    │       ├─ ProcedureDocument
    │       ├─ TimelineDocument
    │       ├─ TrendingDocument
    │       ├─ QualityMetricsDocument
    │       ├─ AllergyDocument
    │       ├─ ImagingDocument
    │       ├─ ComparisonDocument
    │       ├─ TableDocument (fallback)
    │       ├─ NarrativeDocument (fallback)
    │       └─ SummaryDocument (fallback)
    ├─ Back button to document list
    └─ Print/Download buttons
```

## State Flow

```
User Action                    State Change                Result
───────────────────────────────────────────────────────────────────
"Show medical data"         → level: 'categories'       → CategoryListView
Click "Medications"         → level: 'documents'        → DocumentListView
                             category: 'medications'
Click specific document     → level: 'detail'           → DocumentDetailView
                             documentId: 'abc123'
Click "Back"                → level: 'documents'        → DocumentListView
Click "← Back"              → level: 'categories'       → CategoryListView
Close artifact              → level: null               → Panel closes
                             isOpen: false
```

## Props Flow

```
Parent Component
│
└─ ArtifactPanel
   │  Props: { isOpen, onClose, patientId }
   │  State: { level, selectedCategory, selectedDocument }
   │
   ├─ CategoryListView
   │  Props: { patientId, onSelectCategory }
   │  Callbacks: onSelectCategory(category)
   │
   ├─ DocumentListView
   │  Props: { patientId, category, onSelectDocument, onBack }
   │  State: { documents, loading, error }
   │  Callbacks: onSelectDocument(doc), onBack()
   │  Children:
   │  └─ DocumentListItem × N
   │     Props: { document, onClick }
   │
   └─ DocumentDetailView
      Props: { patientId, category, documentId, onBack }
      State: { document, loading, error }
      Callbacks: onBack()
      Children:
      └─ DocumentRenderer
         Props: { category, document }
         Renders: Appropriate template component
```

## API Integration

```
Component              API Call                                      Response
─────────────────────────────────────────────────────────────────────────────
CategoryListView    → GET /api/agent/patient/:id/categories        → { categories: [...] }

DocumentListView    → GET /api/agent/patient/:id/category/:name    → { documents: [...] }

DocumentDetailView  → GET /api/agent/patient/:id/category/:name/   → { document: {...} }
                      document/:documentId
```

## Template Rendering Logic

```javascript
// DocumentRenderer.jsx

import { COLLECTION_TEMPLATES, getTemplateForCollection } from '../../config/documentTemplates';

const DocumentRenderer = ({ category, document }) => {
  // Get template name for this collection
  const templateName = getTemplateForCollection(category);

  // Dynamic import (or static switch/case)
  const TemplateComponent = getTemplateComponent(templateName);

  // Render with document data
  return <TemplateComponent data={document.data} />;
};

function getTemplateComponent(templateName) {
  switch (templateName) {
    case 'MedicationDocument':
      return MedicationDocument;
    case 'LabResultsDocument':
      return LabResultsDocument;
    // ... all templates
    default:
      return NarrativeDocument;  // Fallback
  }
}
```

## CSS Class Naming Convention

```css
/* Component classes */
.artifact-panel
.artifact-panel.open
.artifact-panel.closed

/* View classes */
.category-list
.category-list-item
.document-list
.document-list-item
.document-detail

/* Template classes */
.medical-document
.medication-document
.lab-results-document
.vital-signs-document

/* State classes */
.loading-spinner
.error-message
.empty-state

/* Element classes */
.document-header
.document-title
.document-date
.document-content
.document-footer
.document-actions

/* Utility classes */
.back-button
.print-button
.download-button
.status-indicator
.trend-arrow
```

## Event Handlers

```javascript
// ArtifactPanel.jsx
const handlers = {
  openArtifact: () => setIsOpen(true),
  closeArtifact: () => setIsOpen(false),
  navigateToCategories: () => setLevel('categories'),
  navigateToDocuments: (category) => {
    setLevel('documents');
    setSelectedCategory(category);
  },
  navigateToDetail: (document) => {
    setLevel('detail');
    setSelectedDocument(document);
  },
  handlePrint: () => window.print(),
  handleDownload: () => { /* PDF download logic */ },
  handleError: (error) => setError(error),
  handleRetry: () => refetchData()
};
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Backend API                                                 │
│                                                              │
│  GET /api/agent/patient/:id/categories                      │
│  GET /api/agent/patient/:id/category/:name                  │
│  GET /api/agent/patient/:id/category/:name/document/:docId  │
│                                                              │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│  Frontend API Client (artifactApi.js)                        │
│                                                              │
│  - getCategories(patientId)                                 │
│  - getDocuments(patientId, category)                        │
│  - getDocument(patientId, category, documentId)             │
│                                                              │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│  Artifact Components                                         │
│                                                              │
│  CategoryListView → DocumentListView → DocumentDetailView   │
│                                              │               │
│                                              ↓               │
│                                      DocumentRenderer        │
│                                              │               │
│                                              ↓               │
│                                  Template Components         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Testing Structure

```
tests/
├── unit/
│   ├── ArtifactPanel.test.js
│   ├── CategoryListView.test.js
│   ├── DocumentListView.test.js
│   ├── DocumentDetailView.test.js
│   ├── DocumentRenderer.test.js
│   └── templates/
│       ├── MedicationDocument.test.js
│       ├── LabResultsDocument.test.js
│       └── ...
│
├── integration/
│   ├── navigation.test.js           # Test navigation between levels
│   ├── api-integration.test.js      # Test API calls
│   └── template-rendering.test.js   # Test template selection
│
└── e2e/
    ├── artifact-flow.test.js        # Full user flow
    └── print-download.test.js       # Print/download functionality
```

---

**Reference**: Use this document to understand component relationships and file organization.

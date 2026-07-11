# Phase 2: Frontend Core Components

## Overview
Create 7 core React components for artifact panel and 3-level navigation.

**Duration**: 3-4 days
**Tasks**: 10 total
**Dependencies**: Backend API endpoints from Phase 1

---

## Task 2.1: Create ArtifactPanel Component ⏱️ 3 hours

### Goal
Create main wrapper component that manages artifact panel state and display.

### File to Create
`apps/frontend-vite/src/components/artifact/ArtifactPanel.jsx`

### Component Structure
```jsx
const ArtifactPanel = ({ isOpen, onClose, patientId }) => {
  const [level, setLevel] = useState(null); // 'categories' | 'documents' | 'detail'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);

  return (
    <div className={`artifact-panel ${isOpen ? 'open' : 'closed'}`}>
      {/* Render appropriate view based on level */}
      {level === 'categories' && <CategoryListView ... />}
      {level === 'documents' && <DocumentListView ... />}
      {level === 'detail' && <DocumentDetailView ... />}
    </div>
  );
};
```

### Props
- `isOpen` (boolean): Whether panel is visible
- `onClose` (function): Callback to close panel
- `patientId` (string): Current patient ID

### State Management
```javascript
const [state, setState] = useState({
  level: null,           // Current navigation level
  selectedCategory: null, // e.g., 'medications'
  selectedDocument: null, // Full document object
  documents: [],         // List of documents in category
  categories: []         // List of all categories
});
```

### Layout
```css
.artifact-panel {
  position: fixed;
  right: 0;
  top: 0;
  width: 50%;
  height: 100vh;
  background: white;
  box-shadow: -2px 0 10px rgba(0,0,0,0.1);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  z-index: 100;
}

.artifact-panel.open {
  transform: translateX(0);
}
```

### What to Build
1. Panel container with slide-in animation
2. State management for 3 levels
3. Navigation between levels
4. Close button
5. Header with breadcrumbs

### Testing
- Panel opens/closes smoothly
- State updates correctly
- Navigation works between levels

---

## Task 2.2: Add Open/Close State Management ⏱️ 2 hours

### Goal
Implement logic to open/close artifact panel and manage sidebar collapse.

### File to Modify
Parent component that contains ArtifactPanel (likely main chat/patient view)

### State to Add
```javascript
const [artifactOpen, setArtifactOpen] = useState(false);
const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);

// When artifact opens, collapse right sidebar
const openArtifact = () => {
  setArtifactOpen(true);
  setRightSidebarCollapsed(true);
};

// When artifact closes, restore right sidebar
const closeArtifact = () => {
  setArtifactOpen(false);
  setRightSidebarCollapsed(false);
};
```

### Layout Adjustments
```jsx
<div className="main-layout">
  <Sidebar className="left-sidebar" /> {/* Always visible */}

  <div className="content-area">
    <ChatArea className={artifactOpen ? 'half-width' : 'full-width'} />
    <ArtifactPanel isOpen={artifactOpen} onClose={closeArtifact} />
  </div>

  <Sidebar
    className="right-sidebar"
    collapsed={rightSidebarCollapsed}
  />
</div>
```

### CSS
```css
.content-area {
  display: flex;
  flex: 1;
}

.chat-area.full-width {
  width: 100%;
}

.chat-area.half-width {
  width: 50%;
}
```

### What to Build
1. Open/close functions
2. Sidebar collapse logic
3. Width adjustments for chat area
4. Smooth transitions

### Testing
- Artifact opens and chat area resizes
- Right sidebar collapses
- Closing artifact restores layout
- Animations are smooth

---

## Task 2.3: Create CategoryListView Component ⏱️ 3 hours

### Goal
Component that displays vertical list of medical data categories (Level 1).

### File to Create
`apps/frontend-vite/src/components/artifact/CategoryListView.jsx`

### Component Structure
```jsx
const CategoryListView = ({ patientId, onSelectCategory }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, [patientId]);

  const fetchCategories = async () => {
    const response = await fetch(`/api/agent/patient/${patientId}/categories`);
    const data = await response.json();
    setCategories(data.categories);
    setLoading(false);
  };

  return (
    <div className="category-list">
      <h2>📋 Medical Data</h2>
      <p>Select a category:</p>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <ul>
          {categories.map(category => (
            <li key={category.name} onClick={() => onSelectCategory(category)}>
              <span className="icon">{category.icon}</span>
              <span className="name">{category.displayName}</span>
              <span className="count">({category.count})</span>
              <span className="arrow">→</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

### Props
- `patientId` (string): Current patient
- `onSelectCategory` (function): Callback when category clicked

### API Call
```javascript
GET /api/agent/patient/:patientId/categories
```

### Display
```
📋 MEDICAL DATA
───────────────────────

Select a category:

💊 Medications (12)          →
🔬 Lab Results (45)          →
📊 Vital Signs (120)         →
🏥 Diagnoses (8)             →
🚨 Allergies (3)             →
💡 AI Recommendations (3)    →
...
```

### CSS
```css
.category-list ul {
  list-style: none;
  padding: 0;
}

.category-list li {
  padding: 1rem;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.category-list li:hover {
  background: #f5f5f5;
}

.icon {
  font-size: 1.5rem;
}

.name {
  flex: 1;
  font-weight: 500;
}

.count {
  color: #666;
}

.arrow {
  color: #999;
}
```

### What to Build
1. Fetch categories from API
2. Display as vertical list
3. Show icon, name, count
4. Handle click to select category
5. Loading state
6. Empty state (no categories)
7. Error handling

### Testing
- Categories load correctly
- Click navigates to document list
- Loading spinner shows
- Error handled gracefully

---

## Task 2.4: Create DocumentListView Component ⏱️ 3 hours

### Goal
Component that displays list of documents in a category (Level 2).

### File to Create
`apps/frontend-vite/src/components/artifact/DocumentListView.jsx`

### Component Structure
```jsx
const DocumentListView = ({
  patientId,
  category,
  onSelectDocument,
  onBack
}) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, [patientId, category]);

  const fetchDocuments = async () => {
    const response = await fetch(
      `/api/agent/patient/${patientId}/category/${category.name}`
    );
    const data = await response.json();
    setDocuments(data.documents);
    setLoading(false);
  };

  return (
    <div className="document-list">
      <button onClick={onBack}>← Back</button>
      <h2>{category.icon} {category.displayName} ({documents.length})</h2>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="documents">
          {documents.map(doc => (
            <DocumentListItem
              key={doc._id}
              document={doc}
              onClick={() => onSelectDocument(doc)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

### Props
- `patientId` (string): Current patient
- `category` (object): Selected category
- `onSelectDocument` (function): Callback when document clicked
- `onBack` (function): Navigate back to categories

### API Call
```javascript
GET /api/agent/patient/:patientId/category/:categoryName
```

### Display
```
← Back    💊 MEDICATIONS (12)
─────────────────────────────

📄 January 20, 2025 ⭐
   Current medications
   12 active medications including
   Dupilumab, Fluticasone...
   [Click to view full details]

─────────────────────────────

📄 January 15, 2025
   Added Dupilumab
   Started biologic therapy for
   severe asthma...
   [Click to view full details]

─────────────────────────────
```

### What to Build
1. Fetch documents from API
2. Display as list (newest first)
3. Back button to return to categories
4. Loading state
5. Empty state (no documents)
6. Error handling
7. Use DocumentListItem component

### Testing
- Documents load correctly
- Sorted newest first
- Latest marked with ⭐
- Click opens document detail
- Back button works

---

## Task 2.5: Create DocumentListItem Component ⏱️ 1-2 hours

### Goal
Reusable component for single document in list.

### File to Create
`apps/frontend-vite/src/components/artifact/DocumentListItem.jsx`

### Component Structure
```jsx
const DocumentListItem = ({ document, onClick }) => {
  return (
    <div className="document-item" onClick={onClick}>
      <div className="header">
        <span className="icon">📄</span>
        <span className="date">{formatDate(document.date)}</span>
        {document.isLatest && <span className="badge">⭐</span>}
      </div>

      <h3 className="title">{document.title}</h3>

      <p className="preview">{document.preview}</p>

      <div className="footer">
        <span className="action">Click to view full details</span>
      </div>
    </div>
  );
};
```

### Props
- `document` (object): Document data
  - `_id`: Unique ID
  - `date`: Document date
  - `title`: Document title
  - `preview`: Preview text
  - `isLatest`: Boolean flag
- `onClick` (function): Click handler

### CSS
```css
.document-item {
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.document-item:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-color: #0066CC;
}

.document-item .header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.document-item .date {
  font-size: 0.9rem;
  color: #666;
}

.document-item .badge {
  font-size: 1.2rem;
}

.document-item .title {
  margin: 0.5rem 0;
  font-size: 1.1rem;
}

.document-item .preview {
  color: #666;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.document-item .action {
  color: #0066CC;
  font-size: 0.85rem;
}
```

### Helper Functions
```javascript
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};
```

### What to Build
1. Document card layout
2. Date formatting
3. Latest badge display
4. Hover effects
5. Click handling

### Testing
- Displays all document info
- Date formatted correctly
- Latest badge shows for newest
- Hover effect works
- Click triggers callback

---

## Task 2.6: Create DocumentDetailView Component ⏱️ 3 hours

### Goal
Component that shows full document with appropriate template (Level 3).

### File to Create
`apps/frontend-vite/src/components/artifact/DocumentDetailView.jsx`

### Component Structure
```jsx
const DocumentDetailView = ({
  patientId,
  category,
  documentId,
  onBack
}) => {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocument();
  }, [documentId]);

  const fetchDocument = async () => {
    const response = await fetch(
      `/api/agent/patient/${patientId}/category/${category.name}/document/${documentId}`
    );
    const data = await response.json();
    setDocument(data.document);
    setLoading(false);
  };

  return (
    <div className="document-detail">
      <button onClick={onBack}>← Back to list</button>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <DocumentRenderer
          category={category.name}
          document={document}
        />
      )}

      <div className="actions">
        <button onClick={handlePrint}>🖨️ Print</button>
        <button onClick={handleDownload}>📥 Download PDF</button>
      </div>
    </div>
  );
};
```

### Props
- `patientId` (string): Current patient
- `category` (object): Current category
- `documentId` (string): Document to display
- `onBack` (function): Navigate back to document list

### API Call
```javascript
GET /api/agent/patient/:patientId/category/:categoryName/document/:documentId
```

### What to Build
1. Fetch full document from API
2. Pass to DocumentRenderer
3. Back button
4. Print button
5. Download PDF button (optional for now)
6. Loading state
7. Error handling

### Testing
- Document loads correctly
- Renders with appropriate template
- Back button works
- Print button works

---

## Task 2.7: Create DocumentRenderer Component ⏱️ 2 hours

### Goal
Router component that selects appropriate template for document type.

### File to Create
`apps/frontend-vite/src/components/artifact/DocumentRenderer.jsx`

### Component Structure
```jsx
import MedicationDocument from './templates/MedicationDocument';
import LabResultsDocument from './templates/LabResultsDocument';
import AIInsightsDocument from './templates/AIInsightsDocument';
// ... import all templates

import { COLLECTION_TEMPLATES } from '../../config/documentTemplates';

const DocumentRenderer = ({ category, document }) => {
  // Get template name for this category
  const templateName = COLLECTION_TEMPLATES[category] || 'NarrativeDocument';

  // Render appropriate template
  switch (templateName) {
    case 'MedicationDocument':
      return <MedicationDocument data={document.data} />;
    case 'LabResultsDocument':
      return <LabResultsDocument data={document.data} />;
    case 'AIInsightsDocument':
      return <AIInsightsDocument data={document.data} />;
    // ... all other templates
    default:
      return <NarrativeDocument data={document.data} />;
  }
};
```

### Props
- `category` (string): Collection name (e.g., 'medications')
- `document` (object): Full document with data

### Mapping Config to Use
```javascript
// From TEMPLATE-MAPPING.md
export const COLLECTION_TEMPLATES = {
  'medications': 'MedicationDocument',
  'lab_results': 'LabResultsDocument',
  'intelligent_recommendations': 'AIInsightsDocument',
  // ... all mappings
};
```

### What to Build
1. Import all template components
2. Import mapping config
3. Switch/case or object lookup for template selection
4. Pass document data to template
5. Fallback to generic template if no mapping

### Testing
- Correct template renders for each category
- Data passed correctly to templates
- Fallback works for unmapped categories

---

## Task 2.8: Add Navigation Logic Between Levels ⏱️ 2 hours

### Goal
Implement state management and navigation between 3 levels.

### File to Modify
`ArtifactPanel.jsx` (created in Task 2.1)

### State Management
```javascript
const [state, setState] = useState({
  level: 'categories',      // Start at category list
  selectedCategory: null,
  selectedDocument: null,
  documentId: null
});

// Navigate to document list
const navigateToDocuments = (category) => {
  setState({
    level: 'documents',
    selectedCategory: category,
    selectedDocument: null,
    documentId: null
  });
};

// Navigate to document detail
const navigateToDetail = (document) => {
  setState({
    ...state,
    level: 'detail',
    documentId: document._id
  });
};

// Navigate back to categories
const navigateToCategories = () => {
  setState({
    level: 'categories',
    selectedCategory: null,
    selectedDocument: null,
    documentId: null
  });
};

// Navigate back to documents
const navigateToDocuments = () => {
  setState({
    ...state,
    level: 'documents',
    documentId: null
  });
};
```

### Render Logic
```jsx
return (
  <div className="artifact-panel">
    {state.level === 'categories' && (
      <CategoryListView
        patientId={patientId}
        onSelectCategory={navigateToDocuments}
      />
    )}

    {state.level === 'documents' && (
      <DocumentListView
        patientId={patientId}
        category={state.selectedCategory}
        onSelectDocument={navigateToDetail}
        onBack={navigateToCategories}
      />
    )}

    {state.level === 'detail' && (
      <DocumentDetailView
        patientId={patientId}
        category={state.selectedCategory}
        documentId={state.documentId}
        onBack={navigateToDocuments}
      />
    )}
  </div>
);
```

### What to Build
1. Navigation functions for each transition
2. State updates on navigation
3. Proper prop passing to child components
4. History/breadcrumb tracking (optional)

### Testing
- Can navigate from categories → documents → detail
- Back buttons work correctly
- State updates properly
- Component re-renders with correct data

---

## Task 2.9: Add Transitions and Animations ⏱️ 2 hours

### Goal
Add smooth animations for panel open/close and level transitions.

### CSS Animations to Add

**Panel Slide-in:**
```css
.artifact-panel {
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.artifact-panel.open {
  transform: translateX(0);
}
```

**Level Transitions:**
```css
.artifact-content {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Chat Area Resize:**
```css
.chat-area {
  transition: width 0.3s ease;
}
```

**Sidebar Collapse:**
```css
.right-sidebar {
  transition: all 0.3s ease;
}

.right-sidebar.collapsed {
  width: 0;
  overflow: hidden;
}
```

### What to Build
1. Panel slide animation
2. Fade-in for content changes
3. Smooth width transitions
4. Loading spinner animations

### Testing
- Animations are smooth (60fps)
- No jank or stuttering
- Transitions feel natural
- Works on different screen sizes

---

## Task 2.10: Connect to Backend APIs ⏱️ 2 hours

### Goal
Wire up all API calls with proper error handling.

### API Client Setup
```javascript
// utils/artifactApi.js
export const artifactApi = {
  async getCategories(patientId) {
    const response = await fetch(`/api/agent/patient/${patientId}/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    return response.json();
  },

  async getDocuments(patientId, categoryName) {
    const response = await fetch(`/api/agent/patient/${patientId}/category/${categoryName}`);
    if (!response.ok) throw new Error('Failed to fetch documents');
    return response.json();
  },

  async getDocument(patientId, categoryName, documentId) {
    const response = await fetch(`/api/agent/patient/${patientId}/category/${categoryName}/document/${documentId}`);
    if (!response.ok) throw new Error('Failed to fetch document');
    return response.json();
  }
};
```

### Error Handling
```javascript
const fetchCategories = async () => {
  try {
    setLoading(true);
    setError(null);
    const data = await artifactApi.getCategories(patientId);
    setCategories(data.categories);
  } catch (error) {
    setError(error.message);
    console.error('Error fetching categories:', error);
  } finally {
    setLoading(false);
  }
};
```

### Error Display
```jsx
{error && (
  <div className="error-message">
    ⚠️ {error}
    <button onClick={retry}>Retry</button>
  </div>
)}
```

### What to Build
1. Centralized API client
2. Error handling in all components
3. Retry functionality
4. Error display UI
5. Loading states

### Testing
- API calls work correctly
- Errors handled gracefully
- Retry works
- Loading states show

---

## Completion Checklist

After completing all tasks:
- [ ] All 7 core components created
- [ ] Navigation works between 3 levels
- [ ] Animations smooth
- [ ] APIs connected
- [ ] Error handling complete
- [ ] Loading states working
- [ ] Back buttons functional
- [ ] Ready for template implementation

---

**Total Time**: 3-4 days
**Dependencies**: Phase 1 (Backend API)
**Next Phase**: Document Templates
